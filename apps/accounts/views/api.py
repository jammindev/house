"""API ViewSets for accounts app."""
import os

from django.contrib.auth import authenticate, login as auth_login, logout as auth_logout
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.utils.translation import gettext_lazy as _

from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework import status

from accounts.models import User
from accounts.serializers import UserSerializer

class AuthViewSet(viewsets.ViewSet):
    """ViewSet for session-based authentication endpoints."""

    def get_permissions(self):
        if self.action == "login":
            return [AllowAny()]
        return [IsAuthenticated()]

    @action(detail=False, methods=["post"], url_path="login")
    def login(self, request):
        """Login endpoint that creates a Django authenticated session."""
        email = request.data.get("email")
        password = request.data.get("password")

        if not email or not password:
            return Response(
                {"detail": _("Email and password are required.")},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user = authenticate(request=request, username=email, password=password)
        if user is None:
            return Response({"detail": _("Invalid credentials.")}, status=status.HTTP_401_UNAUTHORIZED)

        auth_login(request, user)
        return Response(
            {
                "detail": _("Login successful."),
                "user": UserSerializer(user).data,
            },
            status=status.HTTP_200_OK,
        )

    @action(detail=False, methods=["post"], url_path="logout")
    def logout(self, request):
        """Logout endpoint that clears the Django authenticated session."""
        auth_logout(request)
        return Response({"detail": _("Logout successful.")}, status=status.HTTP_200_OK)


class UserViewSet(viewsets.ModelViewSet):
    """ViewSet for user CRUD operations."""
    queryset = User.objects.all().order_by("id")
    serializer_class = UserSerializer

    def get_queryset(self):
        """Filter queryset based on user permissions."""
        user = self.request.user
        if not user.is_authenticated:
            return User.objects.none()
        if user.is_staff:
            return User.objects.all().order_by("id")
        return User.objects.filter(id=user.id)

    def get_permissions(self):
        """Allow anyone to create users (registration), require auth for other actions."""
        if self.action == "create":
            return [AllowAny()]
        return [IsAuthenticated()]

    @action(detail=False, methods=['get', 'patch'])
    def me(self, request):
        """Return or update the current authenticated user."""
        if request.method == 'GET':
            serializer = self.get_serializer(request.user)
            return Response(serializer.data)

        # PATCH — only allow display_name, locale, theme, color_theme
        allowed_fields = {'display_name', 'locale', 'theme', 'color_theme'}
        data = {k: v for k, v in request.data.items() if k in allowed_fields}
        serializer = self.get_serializer(
            request.user, data=data, partial=True
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    @action(
        detail=False,
        methods=['post'],
        url_path='me/change-password',
        url_name='change-password',
    )
    def change_password(self, request):
        """Change the current user's password.

        POST /api/accounts/users/me/change-password/
        Body: { new_password, confirm_password }
        """
        new_password = request.data.get('new_password', '')
        confirm_password = request.data.get('confirm_password', '')

        if not new_password or not confirm_password:
            return Response(
                {'detail': _('new_password and confirm_password are required.')},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if len(new_password) < 8:
            return Response(
                {'detail': _('Password must be at least 8 characters.')},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if new_password != confirm_password:
            return Response(
                {'detail': _('Passwords do not match.')},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            validate_password(new_password, user=request.user)
        except ValidationError as exc:
            return Response(
                {'detail': ' '.join(exc.messages)},
                status=status.HTTP_400_BAD_REQUEST,
            )

        request.user.set_password(new_password)
        request.user.save(update_fields=['password'])
        return Response({'detail': _('Password updated successfully.')}, status=status.HTTP_200_OK)

    @action(
        detail=False,
        methods=['post', 'delete'],
        url_path='me/avatar',
        url_name='avatar',
        parser_classes=[MultiPartParser, FormParser],
    )
    def avatar(self, request):
        """Upload or delete the current user's avatar image.

        POST  /api/accounts/users/me/avatar/  — upload (multipart, field: avatar)
        DELETE /api/accounts/users/me/avatar/ — remove
        """
        if request.method == 'DELETE':
            if not request.user.avatar:
                return Response(
                    {'detail': _('No avatar to delete.')},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            # Delete the file from storage
            old_path = request.user.avatar
            request.user.avatar = None
            request.user.save(update_fields=['avatar'])
            try:
                if old_path and hasattr(old_path, 'path') and os.path.isfile(old_path.path):
                    os.remove(old_path.path)
            except OSError:
                pass
            return Response({'detail': _('Avatar removed.')}, status=status.HTTP_200_OK)

        # POST — upload
        avatar_file = request.FILES.get('avatar')
        if not avatar_file:
            return Response(
                {'avatar': [_('No file was submitted.')]},
                status=status.HTTP_400_BAD_REQUEST,
            )

        max_size = 2 * 1024 * 1024  # 2 MB
        if avatar_file.size > max_size:
            return Response(
                {'avatar': [_('File size exceeds 2 MB limit.')]},

                status=status.HTTP_400_BAD_REQUEST,
            )

        # Delete old avatar if exists
        if request.user.avatar:
            try:
                old_path = request.user.avatar.path
                if os.path.isfile(old_path):
                    os.remove(old_path)
            except OSError:
                pass

        request.user.avatar = avatar_file
        request.user.save(update_fields=['avatar'])

        avatar_url = request.user.avatar.url if request.user.avatar else ''
        return Response({'avatar_url': avatar_url}, status=status.HTTP_200_OK)
