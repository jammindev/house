"""Viewsets for household management API."""
from django.db import transaction
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from accounts.models import Household, HouseholdMember, User
from accounts.serializers import HouseholdSerializer, HouseholdListSerializer, HouseholdMemberSerializer
from accounts.permissions import IsHouseholdMember, IsHouseholdOwner


class HouseholdViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing households.
    
    list: Return households where user is a member
    create: Create a new household and auto-add creator as owner
    retrieve: Get details of a household
    update/partial_update: Update household (owner only)
    destroy: Delete household (owner only)
    """
    permission_classes = [IsAuthenticated]
    serializer_class = HouseholdSerializer

    def get_queryset(self):
        """Return only households where the user is a member."""
        return Household.objects.filter(
            members__user=self.request.user
        ).distinct().prefetch_related('members__user')

    def get_serializer_class(self):
        """Use lightweight serializer for list action."""
        if self.action == 'list':
            return HouseholdListSerializer
        return HouseholdSerializer

    def get_permissions(self):
        """
        Instantiate and return the list of permissions that this view requires.
        - List/Create: Authenticated users
        - Retrieve: Household members
        - Update/Delete: Household owners
        """
        if self.action in ['update', 'partial_update', 'destroy']:
            permission_classes = [IsAuthenticated, IsHouseholdOwner]
        elif self.action == 'retrieve':
            permission_classes = [IsAuthenticated, IsHouseholdMember]
        else:
            permission_classes = [IsAuthenticated]
        return [permission() for permission in permission_classes]

    @transaction.atomic
    def perform_create(self, serializer):
        """Create household and automatically add creator as owner."""
        household = serializer.save()
        HouseholdMember.objects.create(
            household=household,
            user=self.request.user,
            role='owner'
        )

    @action(detail=True, methods=['get'])
    def members(self, request, pk=None):
        """List all members of a household."""
        household = self.get_object()
        members = household.members.all()
        serializer = HouseholdMemberSerializer(members, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated, IsHouseholdOwner])
    def invite(self, request, pk=None):
        """
        Invite a user to join the household.
        
        Body: {
            "email": "user@example.com",
            "role": "member"  # optional, defaults to "member"
        }
        """
        household = self.get_object()
        email = request.data.get('email')
        role = request.data.get('role', 'member')

        if not email:
            return Response(
                {'error': 'Email is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Find user by email
        try:
            user = User.objects.get(email=email)
        except User.DoesNotExist:
            return Response(
                {'error': 'User with this email does not exist'},
                status=status.HTTP_404_NOT_FOUND
            )

        # Check if already a member
        if household.members.filter(user=user).exists():
            return Response(
                {'error': 'User is already a member of this household'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Create membership
        membership = HouseholdMember.objects.create(
            household=household,
            user=user,
            role=role
        )

        serializer = HouseholdMemberSerializer(membership)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'])
    def leave(self, request, pk=None):
        """
        Leave a household (non-owners only).
        Owners must transfer ownership or delete the household.
        """
        household = self.get_object()
        
        # Get user's membership
        try:
            membership = household.members.get(user=request.user)
        except HouseholdMember.DoesNotExist:
            return Response(
                {'error': 'You are not a member of this household'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Prevent owners from leaving (they must delete or transfer ownership)
        if membership.role == 'owner':
            owner_count = household.members.filter(role='owner').count()
            if owner_count == 1:
                return Response(
                    {'error': 'You are the only owner. Transfer ownership or delete the household instead.'},
                    status=status.HTTP_400_BAD_REQUEST
                )

        # Delete membership
        membership.delete()
        return Response(
            {'message': 'Successfully left the household'},
            status=status.HTTP_200_OK
        )

    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated, IsHouseholdOwner])
    def remove_member(self, request, pk=None):
        """
        Remove a member from the household (owner only).
        
        Body: {
            "user_id": 123
        }
        """
        household = self.get_object()
        user_id = request.data.get('user_id')

        if not user_id:
            return Response(
                {'error': 'user_id is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            membership = household.members.get(user_id=user_id)
        except HouseholdMember.DoesNotExist:
            return Response(
                {'error': 'User is not a member of this household'},
                status=status.HTTP_404_NOT_FOUND
            )

        # Prevent removing yourself as owner
        if membership.user == request.user and membership.role == 'owner':
            return Response(
                {'error': 'Use the leave endpoint to leave the household'},
                status=status.HTTP_400_BAD_REQUEST
            )

        membership.delete()
        return Response(
            {'message': 'Member removed successfully'},
            status=status.HTTP_200_OK
        )

    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated, IsHouseholdOwner])
    def update_role(self, request, pk=None):
        """
        Update a member's role (owner only).
        
        Body: {
            "user_id": 123,
            "role": "owner" | "member"
        }
        """
        household = self.get_object()
        user_id = request.data.get('user_id')
        new_role = request.data.get('role')

        if not user_id or not new_role:
            return Response(
                {'error': 'user_id and role are required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if new_role not in ['owner', 'member']:
            return Response(
                {'error': 'Invalid role. Must be "owner" or "member"'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            membership = household.members.get(user_id=user_id)
        except HouseholdMember.DoesNotExist:
            return Response(
                {'error': 'User is not a member of this household'},
                status=status.HTTP_404_NOT_FOUND
            )

        membership.role = new_role
        membership.save()

        serializer = HouseholdMemberSerializer(membership)
        return Response(serializer.data, status=status.HTTP_200_OK)
