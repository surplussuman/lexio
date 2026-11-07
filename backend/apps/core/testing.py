"""Shared test base classes. `manage.py test` (Django's built-in runner) has
no fixture system like pytest's `conftest.py`, so cross-cutting test setup —
here, clearing the Redis-backed cache so DRF throttling and cached reads
don't leak between tests — is done via a mixin every app's tests inherit
from instead."""
import logging

from django.core.cache import cache
from django.test import TestCase, TransactionTestCase, override_settings
from rest_framework.test import APITestCase

# Every test runs against the `fake` AI/STT providers and analyses inline.
# This is what guarantees the suite never spends API credits, never needs a
# network, and is deterministic. Inherit from the classes below and it's
# automatic — don't subclass Django's TestCase directly.
TEST_SETTINGS = dict(
    AI_PROVIDER_PRIMARY="fake",
    AI_PROVIDER_FALLBACK="fake",
    STT_PROVIDER_PRIMARY="fake",
    STT_PROVIDER_FALLBACK="fake",
    TTS_PROVIDER_PRIMARY="fake",
    TTS_PROVIDER_FALLBACK="fake",
    ANALYSIS_SYNC=True,
    # In-memory channel layer: WebSocket tests shouldn't need Redis running.
    CHANNEL_LAYERS={"default": {"BACKEND": "channels.layers.InMemoryChannelLayer"}},
)


class ClearsCacheMixin:
    def setUp(self):
        super().setUp()
        cache.clear()
        # Several paths log warnings deliberately on the unhappy route (e.g.
        # analysing a session before content has been seeded). Tests assert on
        # behaviour, not log output, so keep the runner's output readable.
        logging.disable(logging.CRITICAL)

    def tearDown(self):
        logging.disable(logging.NOTSET)
        cache.clear()
        super().tearDown()


@override_settings(**TEST_SETTINGS)
class LexioTestCase(ClearsCacheMixin, TestCase):
    pass


@override_settings(**TEST_SETTINGS)
class LexioAPITestCase(ClearsCacheMixin, APITestCase):
    pass


@override_settings(**TEST_SETTINGS)
class LexioTransactionTestCase(ClearsCacheMixin, TransactionTestCase):
    """For WebSocket/consumer tests. A normal TestCase wraps each test in an
    uncommitted transaction, which the consumer's own DB threads can't see —
    so those tests need real commits. Slower, so use it only where required."""

    reset_sequences = True
