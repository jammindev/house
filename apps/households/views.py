"""
Households views - REST API for household management.
"""
from django.utils.translation import gettext_lazy as _
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db import transaction

from .models import Household, HouseholdMember
from .serializers import HouseholdSerializer, HouseholdDetailSerializer, HouseholdMemberSerializer
from core.permissions import IsHouseholdMember, IsHouseholdOwner


class HouseholdViewSet(viewsets.ModelViewSet):
    """
    ViewSet for household CRUD operations.
    
    List: Returns households the user is a member of
    Create: Creates new household and enrolls user as owner
    Retrieve: Gets household details with members
    Update: Only owners can update
    Delete: Only owners can delete
    """
    permission_classes = [IsAuthenticated]
    serializer_class = HouseholdSerializer

    def get_permissions(self):
        """Apply role-based permissions for management actions."""
        if self.action in {'update', 'partial_update', 'destroy', 'invite', 'remove_member', 'update_role'}:
            return [IsAuthenticated(), IsHouseholdOwner()]
        if self.action in {'retrieve', 'members', 'leave'}:
            return [IsAuthenticated(), IsHouseholdMember()]
        return [IsAuthenticated()]

    def get_queryset(self):
        """Return households where user is a member."""
        return Household.objects.filter(
            householdmember__user=self.request.user
        ).distinct()

    def get_serializer_class(self):
        """Use detailed serializer for retrieve action."""
        if self.action == 'retrieve':
            return HouseholdDetailSerializer
        return HouseholdSerializer

    @transaction.atomic
    def create(self, request, *args, **kwargs):
        """
        Create household and enroll creator as owner.
        Mimics create_household_with_owner RPC from Supabase.
        """
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        # Create household
        household = serializer.save()
        
        # Enroll user as owner
        HouseholdMember.objects.create(
            household=household,
            user=request.user,
            role=HouseholdMember.Role.OWNER
        )
        
        # Return household with membership info
        return Response(
            HouseholdDetailSerializer(household).data,
            status=status.HTTP_201_CREATED
        )

    def update(self, request, *args, **kwargs):
        """Only owners can update household."""
        household = self.get_object()
        
        # Check if user is owner
        if not HouseholdMember.objects.filter(
            household=household,
            user=request.user,
            role=HouseholdMember.Role.OWNER
        ).exists():
            return Response(
                {"detail": _("Only household owners can update.")},
                status=status.HTTP_403_FORBIDDEN
            )
        
        return super().update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        """Only owners can delete household."""
        household = self.get_object()
        
        # Check if user is owner
        if not HouseholdMember.objects.filter(
            household=household,
            user=request.user,
            role=HouseholdMember.Role.OWNER
        ).exists():
            return Response(
                {"detail": _("Only household owners can delete.")},
                status=status.HTTP_403_FORBIDDEN
            )
        
        return super().destroy(request, *args, **kwargs)

    @action(detail=True, methods=['get'])
    def members(self, request, pk=None):
        """Get all members of a household."""
        household = self.get_object()
        members = HouseholdMember.objects.filter(household=household)
        serializer = HouseholdMemberSerializer(members, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def leave(self, request, pk=None):
        """
        Leave a household.
        Prevents last owner from leaving (mimics Supabase leave_household RPC).
        """
        household = self.get_object()
        
        try:
            membership = HouseholdMember.objects.get(
                household=household,
                user=request.user
            )
        except HouseholdMember.DoesNotExist:
            return Response(
                {"detail": _("You are not a member of this household.")},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Check if user is the last owner
        if membership.role == HouseholdMember.Role.OWNER:
            owners_count = HouseholdMember.objects.filter(
                household=household,
                role=HouseholdMember.Role.OWNER
            ).count()
            
            if owners_count == 1:
                return Response(
                    {"detail": _("Cannot leave household as the last owner.")},
                    status=status.HTTP_400_BAD_REQUEST
                )
        
        membership.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=['post'])
    def invite(self, request, pk=None):
        """
        Invite a user to household (by email).
        Only owners can invite.
        """
        household = self.get_object()
        
        # Check if user is owner
        if not HouseholdMember.objects.filter(
            household=household,
            user=request.user,
            role=HouseholdMember.Role.OWNER
        ).exists():
            return Response(
                {"detail": _("Only household owners can invite members.")},
                status=status.HTTP_403_FORBIDDEN
            )
        
        email = request.data.get('email')
        role = request.data.get('role', HouseholdMember.Role.MEMBER)
        
        if not email:
            return Response(
                {"detail": _("Email is required.")},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        from accounts.models import User
        try:
            invited_user = User.objects.get(email=email)
        except User.DoesNotExist:
            return Response(
                {"detail": _("No user found with that email address.")},
                status=status.HTTP_404_NOT_FOUND
            )

        if HouseholdMember.objects.filter(household=household, user=invited_user).exists():
            return Response(
                {"detail": _("User is already a member of this household.")},
                status=status.HTTP_400_BAD_REQUEST
            )

        membership = HouseholdMember.objects.create(
            household=household,
            user=invited_user,
            role=role,
        )
        return Response(
            {"detail": _("User successfully added to household."), "user_id": str(invited_user.id)},
            status=status.HTTP_201_CREATED
        )

    @action(detail=True, methods=['post'])
    def remove_member(self, request, pk=None):
        """Remove a member from household (owner only)."""
        household = self.get_object()
        user_id = request.data.get('user_id')
        if not user_id:
            return Response(
                {'detail': _('user_id is required.')},
                status=status.HTTP_400_BAD_REQUEST,
            )

        membership = HouseholdMember.objects.filter(household=household, user_id=user_id).first()
        if not membership:
            return Response(
                {'detail': _('User is not a member of this household.')},
                status=status.HTTP_404_NOT_FOUND,
            )

        if membership.role == HouseholdMember.Role.OWNER:
            owners_count = HouseholdMember.objects.filter(
                household=household,
                role=HouseholdMember.Role.OWNER,
            ).count()
            if owners_count == 1:
                return Response(
                    {'detail': _('Cannot remove the last owner of the household.')},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        membership.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=['post'])
    def update_role(self, request, pk=None):
        """Update a member role in household (owner only)."""
        household = self.get_object()
        user_id = request.data.get('user_id')
        role = request.data.get('role')

        if not user_id or not role:
            return Response(
                {'detail': _('user_id and role are required.')},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if role not in {HouseholdMember.Role.OWNER, HouseholdMember.Role.MEMBER}:
            return Response(
                {'detail': _('Invalid role. Must be owner or member.')},
                status=status.HTTP_400_BAD_REQUEST,
            )

        membership = HouseholdMember.objects.filter(household=household, user_id=user_id).first()
        if not membership:
            return Response(
                {'detail': _('User is not a member of this household.')},
                status=status.HTTP_404_NOT_FOUND,
            )

        if membership.role == HouseholdMember.Role.OWNER and role == HouseholdMember.Role.MEMBER:
            owners_count = HouseholdMember.objects.filter(
                household=household,
                role=HouseholdMember.Role.OWNER,
            ).count()
            if owners_count == 1:
                return Response(
                    {'detail': _('Cannot demote the last owner of the household.')},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        membership.role = role
        membership.save(update_fields=['role'])
        return Response(HouseholdMemberSerializer(membership).data, status=status.HTTP_200_OK)
