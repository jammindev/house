"""API ViewSets for accounts app."""
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer, TokenRefreshSerializer

from accounts.models import User
from accounts.serializers import UserSerializer


class EmailTokenObtainPairSerializer(TokenObtainPairSerializer):
    """Custom token serializer that uses email instead of username."""
    username_field = "email"


class AuthViewSet(viewsets.ViewSet):
    """ViewSet for authentication endpoints (login, refresh)."""
    permission_classes = [AllowAny]

    @action(detail=False, methods=["post"], url_path="login")
    def login(self, request):
        """Login endpoint that returns JWT tokens."""
        serializer = EmailTokenObtainPairSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        return Response(serializer.validated_data)

    @action(detail=False, methods=["post"], url_path="refresh")
    def refresh(self, request):
        """Refresh JWT token endpoint."""
        serializer = TokenRefreshSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        return Response(serializer.validated_data)


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

    @action(detail=False, methods=['get'])
    def me(self, request):
        """Return the current authenticated user."""
        serializer = self.get_serializer(request.user)
        return Response(serializer.data)
