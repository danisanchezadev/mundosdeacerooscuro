from rest_framework.permissions import SAFE_METHODS
from rest_framework.throttling import UserRateThrottle


class WriteRateThrottle(UserRateThrottle):
    """Extra, stricter limit that only applies to state-changing requests."""

    scope = "write"

    def allow_request(self, request, view):
        if request.method in SAFE_METHODS:
            return True
        return super().allow_request(request, view)
