"""Shared DRF exception handler enforcing the LLD §15.1 error envelope:
{ error: { code, message, details? } } for every non-2xx response.
"""
from rest_framework.views import exception_handler


def lexio_exception_handler(exc, context):
    response = exception_handler(exc, context)
    if response is None:
        return None

    detail = response.data
    code = getattr(exc, "default_code", exc.__class__.__name__)

    if isinstance(detail, dict) and "detail" in detail and len(detail) == 1:
        message = str(detail["detail"])
        details = None
    else:
        message = "Request failed validation."
        details = detail

    response.data = {"error": {"code": code, "message": message, "details": details}}
    return response
