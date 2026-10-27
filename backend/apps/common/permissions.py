from rest_framework import permissions


def is_admin(user) -> bool:
    return bool(user and user.is_authenticated and (user.is_staff or user.is_superuser))


class IsAdmin(permissions.BasePermission):
    def has_permission(self, request, view):
        return is_admin(request.user)


class IsAdminOrReadOnly(permissions.BasePermission):
    """Public read access; writes are restricted to administrators."""

    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return True
        return is_admin(request.user)


class IsOwnerOrAdminOrReadOnly(permissions.BasePermission):
    """Authenticated users can create; only the author (or an admin) can edit/delete."""

    owner_field = "user"

    def has_permission(self, request, view):
        return request.method in permissions.SAFE_METHODS or bool(
            request.user and request.user.is_authenticated
        )

    def has_object_permission(self, request, view, obj):
        if request.method in permissions.SAFE_METHODS:
            return True
        owner = getattr(obj, getattr(view, "owner_field", self.owner_field))
        return owner == request.user or is_admin(request.user)
