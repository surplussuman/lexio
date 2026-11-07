"""Practice-session WebSocket consumer (LLD §8.5, §18.1).

Deviation from §18.2, flagged deliberately: the LLD relays raw audio chunks
from the browser to a streaming STT provider. Live captions here come from the
browser's own speech recognition instead, and only the *text* crosses the
socket. Reasons: it needs no streaming-STT subscription, it removes audio
relay latency, and §18.3 already specifies the live metrics as client-side.
The authoritative transcript for a *recorded* session still goes through
AssemblyAI (apps.core.stt). The socket contract below is unchanged, so
server-side streaming can be swapped in without touching the client.
"""
import json
import logging

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncJsonWebsocketConsumer

from .models import PracticeSession

logger = logging.getLogger(__name__)

NUDGE_MIN_INTERVAL_S = 25  # §8.2 nudges every ~30s; this guards against spam


class PracticeConsumer(AsyncJsonWebsocketConsumer):
    """Events (LLD §8.5):

    client → server: practice:transcript_chunk, practice:request_question,
                     practice:end
    server → client: practice:ready, practice:coaching_tip,
                     practice:next_question, practice:session_end,
                     practice:error
    """

    async def connect(self):
        self.session_id = self.scope["url_route"]["kwargs"]["session_id"]
        user = self.scope.get("user")

        if user is None or not user.is_authenticated:
            await self.close(code=4401)  # unauthenticated
            return

        self.session = await self._load_session(self.session_id, user)
        if self.session is None:
            await self.close(code=4404)  # not this user's session, or gone
            return

        self._last_nudge_at = 0.0
        await self.accept()
        await self.send_json(
            {
                "type": "practice:ready",
                "session_id": str(self.session.id),
                "session_type": self.session.session_type,
                "topic": self.session.topic,
                "turns": self.session.turns,
            }
        )

    async def receive_json(self, content, **kwargs):
        event = content.get("type")

        if event == "practice:transcript_chunk":
            await self._handle_chunk(content)
        elif event == "practice:request_question":
            await self._handle_next_question(content)
        elif event == "practice:end":
            await self._handle_end(content)
        else:
            await self.send_json({"type": "practice:error", "message": f"Unknown event '{event}'."})

    async def _handle_chunk(self, content):
        text = (content.get("transcript") or "").strip()
        elapsed = float(content.get("elapsed_s") or 0)
        if not text:
            return

        if elapsed - self._last_nudge_at < NUDGE_MIN_INTERVAL_S:
            return
        self._last_nudge_at = elapsed

        nudge = await self._coaching_nudge(text)
        if nudge:
            await self.send_json({"type": "practice:coaching_tip", **nudge})

    async def _handle_next_question(self, content):
        answer = (content.get("answer") or "").strip()
        if answer:
            await self._record_turn(answer)

        question = await self._next_question()
        await self.send_json(
            {"type": "practice:next_question", "question": question, "question_number": self.session.question_count}
        )

    async def _handle_end(self, content):
        answer = (content.get("answer") or "").strip()
        if answer:
            await self._record_turn(answer)

        session = await self._end_session(content.get("metrics") or {})
        await self.send_json(
            {
                "type": "practice:session_end",
                "session_id": str(session.id),
                "status": session.status,
                "error": session.error,
                "redirect_to": f"/practice/{session.id}/summary",
            }
        )
        await self.close()

    # --- DB / AI work, off the event loop ---------------------------------

    @database_sync_to_async
    def _load_session(self, session_id, user):
        return (
            PracticeSession.objects.filter(
                id=session_id, user=user, status=PracticeSession.Status.ACTIVE
            ).first()
        )

    @database_sync_to_async
    def _coaching_nudge(self, text):
        from .services import coaching_nudge

        try:
            return coaching_nudge(self.session, text)
        except Exception:
            logger.exception("Coaching nudge failed for %s", self.session.id)
            return None  # a missing tip must never interrupt the session

    @database_sync_to_async
    def _record_turn(self, text):
        from .services import record_student_turn

        record_student_turn(self.session, text)

    @database_sync_to_async
    def _next_question(self):
        from .services import next_question

        return next_question(self.session)

    @database_sync_to_async
    def _end_session(self, metrics):
        from .services import end_session

        return end_session(self.session, metrics)

    async def decode_json(self, text_data, **kwargs):
        try:
            return json.loads(text_data)
        except json.JSONDecodeError:
            return {"type": "invalid"}
