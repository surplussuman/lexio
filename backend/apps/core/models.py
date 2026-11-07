import uuid

from django.db import models


class AICallLog(models.Model):
    """LLD §17.2: every AI call logged with model version, token counts and
    latency — the raw material for the §17.3 cost-management targets."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    provider = models.CharField(max_length=20)
    model = models.CharField(max_length=60, blank=True)
    call_type = models.CharField(max_length=40)
    input_tokens = models.IntegerField(default=0)
    output_tokens = models.IntegerField(default=0)
    latency_ms = models.IntegerField(default=0)
    error = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [models.Index(fields=["call_type", "-created_at"])]

    def __str__(self):
        return f"{self.provider}/{self.call_type} {self.latency_ms}ms"
