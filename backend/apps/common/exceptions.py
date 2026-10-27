from django.db.models import ProtectedError
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import exception_handler as drf_exception_handler


def exception_handler(exc, context):
    """Map referential-integrity errors to a clean 409 instead of a 500."""
    if isinstance(exc, ProtectedError):
        return Response(
            {"detail": "No se puede eliminar: existen elementos relacionados que dependen de este registro."},
            status=status.HTTP_409_CONFLICT,
        )
    return drf_exception_handler(exc, context)
