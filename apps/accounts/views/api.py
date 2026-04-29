"""API ViewSets for accounts app."""
import logging
import os

logger = logging.getLogger(__name__)

from django.conf import settings
from django.contrib.auth import authenticate, login as auth_login, logout as auth_logout
from django.contrib.auth.password_validation import validate_password
from django.contrib.auth.tokens import default_token_generator
from django.core.exceptions import ValidationError
from django.core.mail import EmailMultiAlternatives
from django.template.loader import render_to_string
from django.utils.encoding import force_bytes, force_str
from django.utils.http import urlsafe_base64_decode, urlsafe_base64_encode
from django.utils.translation import gettext_lazy as _

from rest_framework import viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.permissions import AllowAny, IsAuthenticated, IsAdminUser
from rest_framework.response import Response
from rest_framework import status
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from rest_framework_simplejwt.views import TokenObtainPairView

from accounts.models import User
from accounts.serializers import UserSerializer
from accounts.throttles import (
    ChangePasswordRateThrottle,
    LoginEmailRateThrottle,
    LoginIPRateThrottle,
    PasswordResetRequestThrottle,
)
from accounts.tokens import get_impersonation_token
from core.file_validation import validate_upload, ALLOWED_IMAGE_TYPES, AVATAR_MAX_SIZE


class AuthViewSet(viewsets.ViewSet):
    """ViewSet for session-based authentication endpoints."""

    def get_permissions(self):
        if self.action in {"login", "password_reset", "password_reset_confirm"}:
            return [AllowAny()]
        return [IsAuthenticated()]

    @action(
        detail=False,
        methods=["post"],
        url_path="login",
        throttle_classes=[LoginIPRateThrottle, LoginEmailRateThrottle],
    )
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

    @action(
        detail=False,
        methods=["post"],
        url_path="password-reset",
        throttle_classes=[PasswordResetRequestThrottle],
    )
    def password_reset(self, request):
        """Request a password reset email.

        POST /api/accounts/auth/password-reset/
        Body: { email }

        Always returns 200 — never reveals whether the email exists in the database.
        If a user with that email exists, an email is sent with a reset link.
        """
        email = (request.data.get("email") or "").strip().lower()
        if not email:
            return Response(
                {"detail": _("Email is required.")},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            user = User.objects.get(email__iexact=email, is_active=True)
        except User.DoesNotExist:
            user = None

        if user is not None:
            uid = urlsafe_base64_encode(force_bytes(user.pk))
            token = default_token_generator.make_token(user)
            reset_url = f"{settings.FRONTEND_URL.rstrip('/')}/reset-password?uid={uid}&token={token}"

            context = {"user": user, "reset_url": reset_url}
            text_body = render_to_string("accounts/emails/password_reset.txt", context)
            html_body = render_to_string("accounts/emails/password_reset.html", context)

            message = EmailMultiAlternatives(
                subject=str(_("Reset your House password")),
                body=text_body,
                from_email=settings.DEFAULT_FROM_EMAIL,
                to=[user.email],
            )
            message.attach_alternative(html_body, "text/html")
            message.send(fail_silently=False)
            logger.info("Password reset email sent to user_id=%s", user.id)

        return Response(
            {"detail": _("If an account with that email exists, a reset link has been sent.")},
            status=status.HTTP_200_OK,
        )

    @action(
        detail=False,
        methods=["post"],
        url_path="password-reset/confirm",
    )
    def password_reset_confirm(self, request):
        """Confirm a password reset with token + new password.

        POST /api/accounts/auth/password-reset/confirm/
        Body: { uid, token, new_password }
        """
        uid = request.data.get("uid", "")
        token = request.data.get("token", "")
        new_password = request.data.get("new_password", "")

        if not uid or not token or not new_password:
            return Response(
                {"detail": _("uid, token and new_password are required.")},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            user_id = force_str(urlsafe_base64_decode(uid))
            user = User.objects.get(pk=user_id, is_active=True)
        except (TypeError, ValueError, OverflowError, User.DoesNotExist):
            return Response(
                {"detail": _("Invalid or expired reset link.")},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not default_token_generator.check_token(user, token):
            return Response(
                {"detail": _("Invalid or expired reset link.")},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            validate_password(new_password, user=user)
        except ValidationError as exc:
            return Response(
                {"detail": " ".join(exc.messages)},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user.set_password(new_password)
        user.save(update_fields=["password"])
        logger.info("Password reset completed for user_id=%s", user.id)
        return Response(
            {"detail": _("Password has been reset successfully.")},
            status=status.HTTP_200_OK,
        )


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
        throttle_classes=[ChangePasswordRateThrottle],
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

    @action(detail=True, methods=['post'], url_path='impersonate', permission_classes=[IsAdminUser])
    def impersonate(self, request, pk=None):
        """Generate a short-lived impersonation token for the target user.

        POST /api/accounts/users/{id}/impersonate/
        Only accessible to staff users.
        """
        target = self.get_object()
        if target == request.user:
            return Response(
                {'detail': _('You cannot impersonate yourself.')},
                status=status.HTTP_400_BAD_REQUEST,
            )
        tokens = get_impersonation_token(request.user, target)
        logger.info(
            "Impersonation: admin=%s (id=%s) impersonating user=%s (id=%s)",
            request.user.email, request.user.id,
            target.email, target.id,
        )
        return Response(tokens, status=status.HTTP_200_OK)

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

        validate_upload(avatar_file, allowed_types=ALLOWED_IMAGE_TYPES, max_size=AVATAR_MAX_SIZE, field_name='avatar')

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


class TokenObtainPairWithSessionView(TokenObtainPairView):
    """JWT login that also opens a Django session.

    Le SPA s'authentifie via `Authorization: Bearer <jwt>`, mais les requêtes
    `<img src=...>` et `<a href=...>` vers `/media/...` partent sans ce header
    (le navigateur n'envoie automatiquement que les cookies). Sans session,
    `serve_protected_media` voit AnonymousUser → 401.

    Poser un cookie sessionid au moment du login JWT permet aux requêtes
    natives de transporter l'auth. Les appels API gardent leur Bearer header.
    """

    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        try:
            serializer.is_valid(raise_exception=True)
        except TokenError as exc:
            raise InvalidToken(exc.args[0])
        auth_login(
            request,
            serializer.user,
            backend='django.contrib.auth.backends.ModelBackend',
        )
        return Response(serializer.validated_data, status=status.HTTP_200_OK)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def me_view(request):
    """Lightweight me endpoint for SPA auth context."""
    user = request.user
    avatar_url = None
    if user.avatar:
        avatar_url = request.build_absolute_uri(user.avatar.url)
    return Response({
        'id': str(user.id),
        'email': user.email,
        'first_name': user.first_name,
        'last_name': user.last_name,
        'active_household': str(user.active_household_id) if user.active_household_id else None,
        'is_staff': user.is_staff,
        'locale': user.locale or '',
        'avatar': avatar_url,
    })
