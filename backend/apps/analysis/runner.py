"""How analysis gets off the request thread.

LLD §5.2 specifies: submit returns immediately, the client polls
/status until the AI analysis completes. That needs the work to happen
out-of-band. A Celery worker is the production answer (and is in the stack
for exactly this), but it means running a third process in local dev for no
benefit yet — so this uses a small thread pool instead. The API contract the
frontend is built against is identical either way.

To move to Celery later: make `analyse_session` a shared_task and replace the
`_EXECUTOR.submit(...)` line with `.delay(...)`. Nothing else changes.
"""
import logging
from concurrent.futures import ThreadPoolExecutor

from django.conf import settings
from django.db import connection

logger = logging.getLogger(__name__)

_EXECUTOR = ThreadPoolExecutor(max_workers=4, thread_name_prefix="lexio-analysis")


def _run_and_close(session_id):
    from .services import analyse_session

    try:
        analyse_session(session_id)
    except Exception:
        logger.exception("Background analysis failed for %s", session_id)
    finally:
        # Each thread gets its own DB connection; close it so it isn't leaked.
        connection.close()


def start_analysis(session_id) -> None:
    if settings.ANALYSIS_SYNC:
        from .services import analyse_session

        analyse_session(session_id)
        return
    _EXECUTOR.submit(_run_and_close, session_id)
