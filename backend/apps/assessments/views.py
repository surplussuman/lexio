from django.db import IntegrityError, transaction
from django.db.models import Q
from django.http import HttpResponse
from django.utils import timezone
from rest_framework import status
from rest_framework.generics import ListAPIView
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.analysis.runner import start_analysis
from apps.core.storage import get_storage
from apps.core.tts import TTSUnavailable, tts

from .generation import generate_doubt_questions, generate_gd_turn, prompt_for
from .models import OBJECTIVE_MODES, TEXT_MODES, VOICE_MODES, AssessmentSession, Mode
from .serializers import (
    AbandonSessionSerializer,
    DoubtsRequestSerializer,
    DraftSerializer,
    GdTurnRequestSerializer,
    PromptSerializer,
    SessionListSerializer,
    SessionSerializer,
    SpeakRequestSerializer,
    StartSessionSerializer,
    SubmitSessionSerializer,
    mode_catalog,
)


class ModeListView(APIView):
    """The assessments hub (§16.2 /onboarding). Each mode carries its own
    state — done, in progress, or not started — so the student can see at a
    glance what is left and pick an unfinished one back up."""

    def get(self, request):
        sessions = AssessmentSession.objects.filter(user=request.user, is_baseline=True).select_related("score")
        # Model default ordering is newest-first, so the first session seen
        # per mode in each bucket below is always the most recent one.
        completed, in_progress, scoring = {}, {}, {}
        unfinished_statuses = {
            AssessmentSession.Status.SUBMITTED,
            AssessmentSession.Status.PROCESSING,
            AssessmentSession.Status.FAILED,
        }
        for session in sessions:
            if session.status == AssessmentSession.Status.COMPLETE and session.mode not in completed:
                completed[session.mode] = session
            elif session.status == AssessmentSession.Status.RECORDING and session.mode not in in_progress:
                in_progress[session.mode] = session
            elif session.status in unfinished_statuses and session.mode not in scoring:
                scoring[session.mode] = session

        modes = []
        for mode in mode_catalog():
            done = completed.get(mode["id"])
            open_session = in_progress.get(mode["id"])
            still_scoring = scoring.get(mode["id"])
            modes.append(
                {
                    **mode,
                    "completed": bool(done),
                    "completed_at": done.completed_at if done else None,
                    "session_id": str(done.id) if done else None,
                    "in_progress": bool(open_session) and not done,
                    "resume_session_id": str(open_session.id) if open_session and not done else None,
                    # Submitted and being scored in the background — a click
                    # here retries a transient failure rather than starting
                    # over; nothing here needs the student to do anything.
                    "scoring": bool(still_scoring) and not done and not open_session,
                }
            )

        return Response(
            {
                "modes": modes,
                "modes_completed": len(completed),
                # Reports unlock only when every mode is done — see
                # apps.analysis.overview for why they're held back.
                "baseline_complete": len(completed) == len(modes),
            }
        )


class PromptView(APIView):
    def get(self, request, mode):
        if mode not in Mode.values:
            return Response(
                {"error": {"code": "unknown_mode", "message": f"Unknown mode '{mode}'."}},
                status=status.HTTP_404_NOT_FOUND,
            )
        prompt = prompt_for(request.user, mode, int(request.query_params.get("level", 1)))
        if prompt is None:
            return Response(
                {"error": {"code": "no_prompt", "message": f"No prompts available for mode '{mode}'."}},
                status=status.HTTP_404_NOT_FOUND,
            )
        return Response({"prompt": PromptSerializer(prompt).data})


class StartSessionView(APIView):
    def post(self, request):
        serializer = StartSessionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        mode = serializer.validated_data["mode"]
        level = serializer.validated_data.get("level", 1)
        is_baseline = serializer.validated_data["is_baseline"]

        if is_baseline:
            done = AssessmentSession.objects.filter(
                user=request.user, mode=mode, is_baseline=True, status=AssessmentSession.Status.COMPLETE
            ).first()
            if done:
                # One shot per mode for the baseline. Retaking it while the
                # rest are unfinished is how a student ends up with a picture
                # of one mode and no picture of themselves.
                return Response(
                    {
                        "error": {
                            "code": "already_completed",
                            "message": "You've already completed this assessment. Finish the remaining ones to unlock your reports.",
                            "session_id": str(done.id),
                        }
                    },
                    status=status.HTTP_409_CONFLICT,
                )

            # An assessment they started and walked away from is still theirs —
            # hand the same session (and the same prompt) straight back.
            existing = self._open_session(request.user, mode)
            if existing:
                if self._is_abandonable(existing):
                    # The prompt it was built against was retired from the
                    # bank in the meantime (content gets edited — this is how
                    # Presentation's slide-less prompt survived its own
                    # rework: an in-progress session keeps its prompt FK
                    # forever otherwise). Nothing was ever entered against it,
                    # so it's replaced rather than resumed into a broken page.
                    existing.status = AssessmentSession.Status.FAILED
                    existing.error = "Prompt was retired from the bank before this session was submitted."
                    existing.save(update_fields=["status", "error"])
                else:
                    return Response(
                        {"session": SessionSerializer(existing).data, "resumed": True},
                        status=status.HTTP_200_OK,
                    )

            # The audio/text/answers for this mode already reached us — what's
            # left is only scoring, which needs none of that resubmitted. A
            # session still being scored (submitted/processing) just gets
            # handed back as-is for the frontend to keep polling; one whose
            # scoring failed (a transient AI hiccup, not anything the student
            # did) gets retried right here, against the exact same stored
            # response — never a fresh prompt, never asking it again.
            unfinished = self._unfinished_submission(request.user, mode)
            if unfinished:
                if unfinished.status == AssessmentSession.Status.FAILED:
                    unfinished.status = AssessmentSession.Status.PROCESSING
                    unfinished.error = ""
                    unfinished.save(update_fields=["status", "error"])
                    start_analysis(unfinished.id)
                    unfinished.refresh_from_db()
                return Response(
                    {"session": SessionSerializer(unfinished).data, "resumed": True},
                    status=status.HTTP_200_OK,
                )

        seen = AssessmentSession.objects.filter(user=request.user, mode=mode).values_list("prompt_id", flat=True)
        prompt = prompt_for(request.user, mode, level, exclude_ids=list(seen))
        if prompt is None:
            return Response(
                {"error": {"code": "no_prompt", "message": f"No prompts available for mode '{mode}'."}},
                status=status.HTTP_404_NOT_FOUND,
            )

        try:
            with transaction.atomic():
                session = AssessmentSession.objects.create(
                    user=request.user, mode=mode, is_baseline=is_baseline, prompt=prompt
                )
        except IntegrityError:
            # Another request opened this mode between the check above and
            # here. That session is the real one; this request joins it rather
            # than creating a duplicate the student's draft could get lost in.
            existing = self._open_session(request.user, mode, is_baseline=is_baseline)
            if existing is None:
                raise
            return Response({"session": SessionSerializer(existing).data, "resumed": True}, status=status.HTTP_200_OK)

        return Response(
            {"session": SessionSerializer(session).data, "resumed": False}, status=status.HTTP_201_CREATED
        )

    @staticmethod
    def _open_session(user, mode, is_baseline=True) -> AssessmentSession | None:
        return (
            AssessmentSession.objects.filter(
                user=user, mode=mode, is_baseline=is_baseline, status=AssessmentSession.Status.RECORDING
            )
            .select_related("prompt")
            .order_by("started_at")  # oldest open one — the draft belongs to it
            .first()
        )

    @staticmethod
    def _unfinished_submission(user, mode, is_baseline=True) -> AssessmentSession | None:
        """The most recent session for this mode that was submitted but never
        finished scoring — mid-flight (submitted/processing) or lost to a
        transient failure. Either way its response is already safely stored;
        see the call site in `post`.

        A FAILED session only counts here if it actually got as far as
        `/submit` (`submitted_at` set) — one that failed earlier, e.g. an
        abandoned or retired-prompt session with nothing ever entered against
        it, has no response to retry and should still start fresh.
        """
        return (
            AssessmentSession.objects.filter(user=user, mode=mode, is_baseline=is_baseline)
            .filter(
                Q(
                    status__in=[
                        AssessmentSession.Status.SUBMITTED,
                        AssessmentSession.Status.PROCESSING,
                    ]
                )
                | Q(status=AssessmentSession.Status.FAILED, submitted_at__isnull=False)
            )
            .select_related("prompt")
            .order_by("-started_at")
            .first()
        )

    @staticmethod
    def _is_abandonable(session) -> bool:
        """Safe to replace with a fresh prompt only when there is nothing in
        it to lose: the prompt it holds was retired from the bank, and the
        student never got far enough to have a draft, a recording or an
        answer against it. Real progress is never discarded, even against a
        retired prompt — that student finishes with the version they saw."""
        if session.prompt.is_active:
            return False
        return not session.draft and not session.media_key and not session.raw_response


class SaveDraftView(APIView):
    """Autosave for work in progress. Whatever the student has typed, answered
    or presented so far survives them closing the tab."""

    def post(self, request):
        serializer = DraftSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        session = _owned_session(request.user, data["session_id"])
        if session is None:
            return Response(
                {"error": {"code": "not_found", "message": "Session not found."}},
                status=status.HTTP_404_NOT_FOUND,
            )
        if session.status != AssessmentSession.Status.RECORDING:
            return Response(
                {"error": {"code": "already_submitted", "message": "This session has already been submitted."}},
                status=status.HTTP_409_CONFLICT,
            )

        session.draft = {**(session.draft or {}), **data["draft"], "saved_at": timezone.now().isoformat()}
        if data.get("integrity_signals"):
            session.integrity_signals = {**(session.integrity_signals or {}), **data["integrity_signals"]}
        session.save(update_fields=["draft", "integrity_signals"])
        return Response({"saved_at": session.draft["saved_at"]})


class PresentationDoubtsView(APIView):
    """A couple of AI follow-up questions generated live from what the
    student just said, slide by slide — asked cold, with no slide to lean
    on, the same way a real audience presses on a claim. Called mid-session,
    before submit, while the recording and camera are still running.

    Generation failing is never fatal here: an empty `questions` list just
    tells the frontend to skip the follow-up round and go straight to
    review — it must never be able to block finishing an assessment."""

    def post(self, request):
        serializer = DoubtsRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        session = _owned_session(request.user, data["session_id"])
        if session is None or session.mode != Mode.PRESENT:
            return Response(
                {"error": {"code": "not_found", "message": "Session not found."}},
                status=status.HTTP_404_NOT_FOUND,
            )
        if session.status != AssessmentSession.Status.RECORDING:
            return Response(
                {"error": {"code": "already_submitted", "message": "This session has already been submitted."}},
                status=status.HTTP_409_CONFLICT,
            )

        slides = session.prompt.payload.get("slides", [])
        questions = generate_doubt_questions(slides, data.get("slide_timings") or [])
        return Response({"questions": questions})


class GdTurnView(APIView):
    """The next line in a live group-discussion room: one AI peer continuing
    the discussion, reacting to what the student just said, or — for
    `event="idle_nudge"` — directly prompting a student who hasn't spoken
    yet. Called repeatedly through the room session, each time the floor
    opens up; generation failing just means that beat stays quiet, it can
    never block the discussion or the eventual submit."""

    def post(self, request):
        serializer = GdTurnRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        session = _owned_session(request.user, data["session_id"])
        if session is None or session.mode != Mode.GD:
            return Response(
                {"error": {"code": "not_found", "message": "Session not found."}},
                status=status.HTTP_404_NOT_FOUND,
            )
        if session.status != AssessmentSession.Status.RECORDING:
            return Response(
                {"error": {"code": "already_submitted", "message": "This session has already been submitted."}},
                status=status.HTTP_409_CONFLICT,
            )

        peers = session.prompt.payload.get("peers", [])
        turn = generate_gd_turn(
            session.prompt.text, peers, data.get("history") or [], data["event"], request.user.name
        )
        return Response({"turn": turn})


class SpeakView(APIView):
    """One spoken line for an AI persona — a GD peer or the Presentation
    follow-up avatar — as real synthesized audio (apps.core.tts), not the
    browser's own robotic speechSynthesis. Gender picks the voice pool so a
    male-presenting avatar never gets a female voice or vice versa; the
    frontend already knows each persona's gender from its assigned avatar
    (see AvatarPlayer.avatarGender). No provider configured, or the call
    failing outright, is a normal condition here, not an error — the client
    falls back to speechSynthesis itself (lib/tts.js), so a live room or
    doubt round must never stall on this."""

    def post(self, request):
        serializer = SpeakRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        try:
            audio = tts().speak(data["text"], gender=data["gender"], seed=data.get("voice_seed") or "")
        except TTSUnavailable:
            return Response(status=status.HTTP_204_NO_CONTENT)
        return HttpResponse(audio, content_type="audio/mpeg")


class AbandonSessionView(APIView):
    """Confirms an assessment the student chose to walk away from mid-take —
    the backend half of the leave-guard warning on presentation (and any
    future mode that needs it): a live take can't be paused and resumed with
    the same integrity a written draft can, so leaving mid-session fails it
    outright rather than leaving it open to quietly resume later. The next
    `start` for this mode gets a fresh session and a fresh prompt."""

    def post(self, request):
        serializer = AbandonSessionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        session = _owned_session(request.user, serializer.validated_data["session_id"])
        if session is None:
            return Response(
                {"error": {"code": "not_found", "message": "Session not found."}},
                status=status.HTTP_404_NOT_FOUND,
            )
        if session.status == AssessmentSession.Status.RECORDING:
            session.status = AssessmentSession.Status.FAILED
            session.error = "Left before finishing — this assessment was not completed in one sitting."
            session.save(update_fields=["status", "error"])

        return Response({"session_id": str(session.id), "status": session.status})


class SubmitSessionView(APIView):
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def post(self, request):
        serializer = SubmitSessionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        session = _owned_session(request.user, data["session_id"])
        if session is None:
            return Response(
                {"error": {"code": "not_found", "message": "Session not found."}},
                status=status.HTTP_404_NOT_FOUND,
            )

        if session.status != AssessmentSession.Status.RECORDING:
            return Response(
                {"error": {"code": "already_submitted", "message": "This session has already been submitted."}},
                status=status.HTTP_409_CONFLICT,
            )

        error = self._attach_response(session, data)
        if error:
            return Response({"error": error}, status=status.HTTP_400_BAD_REQUEST)

        if data.get("integrity_signals"):
            session.integrity_signals = {**(session.integrity_signals or {}), **data["integrity_signals"]}

        session.status = AssessmentSession.Status.PROCESSING
        session.submitted_at = timezone.now()
        if data.get("duration_seconds"):
            session.duration_seconds = data["duration_seconds"]
        session.draft = {}  # submitted — the draft has served its purpose
        session.save()

        start_analysis(session.id)
        session.refresh_from_db()
        return Response({"session_id": str(session.id), "status": session.status}, status=status.HTTP_202_ACCEPTED)

    @staticmethod
    def _attach_response(session, data) -> dict | None:
        if session.mode in VOICE_MODES:
            audio = data.get("audio")
            if not audio:
                return {"code": "missing_audio", "message": "This mode requires an audio recording."}
            key = f"sessions/{session.user_id}/{session.id}.webm"
            result = get_storage().save(key, audio.read(), content_type="audio/webm")
            session.media_key = key
            session.media_url = result.url
            # Presentation carries per-slide timings and the camera read
            # alongside the audio (see apps/analysis/presentation.py).
            session.raw_response = {
                **(session.raw_response or {}),
                **{
                    k: data[k]
                    for k in ("slide_timings", "visual_metrics", "doubt_questions", "discussion_log")
                    if data.get(k) is not None
                },
            }
            return None

        if session.mode in TEXT_MODES:
            text = (data.get("text") or "").strip()
            if not text:
                return {"code": "missing_text", "message": "This mode requires a written response."}
            session.raw_response = {"text": text}
            return None

        if session.mode in OBJECTIVE_MODES:
            answers = data.get("answers")
            if not isinstance(answers, list) or not answers:
                return {"code": "missing_answers", "message": "This mode requires an answers array."}
            session.raw_response = {"answers": answers}
            return None

        return {"code": "unsupported_mode", "message": f"No submission handler for mode '{session.mode}'."}


class SessionStatusView(APIView):
    def get(self, request, session_id):
        session = _owned_session(request.user, session_id)
        if session is None:
            return Response(
                {"error": {"code": "not_found", "message": "Session not found."}},
                status=status.HTTP_404_NOT_FOUND,
            )
        return Response({"session_id": str(session.id), "status": session.status, "error": session.error})


class BaselineReportView(APIView):
    """§16.2 /report — the overview across all eight modes, unlocked only once
    every mode is done."""

    def get(self, request):
        from apps.analysis.overview import baseline_report

        return Response(baseline_report(request.user))


class SessionHistoryView(ListAPIView):
    serializer_class = SessionListSerializer

    def get_queryset(self):
        return (
            AssessmentSession.objects.filter(user=self.request.user)
            .select_related("score")
            .order_by("-started_at")
        )


def _owned_session(user, session_id) -> AssessmentSession | None:
    return AssessmentSession.objects.filter(id=session_id, user=user).select_related("prompt").first()
