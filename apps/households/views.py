"""
Households views - REST API for household management.
"""
from django.utils import timezone
from django.utils.translation import gettext_lazy as _
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db import transaction

from .models import Household, HouseholdMember, HouseholdInvitation
from .serializers import HouseholdSerializer, HouseholdDetailSerializer, HouseholdMemberSerializer, HouseholdInvitationSerializer
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
        """Return non-archived households where user is a member."""
        return Household.objects.filter(
            householdmember__user=self.request.user,
            archived_at__isnull=True,
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

    def destroy(self, request, *args, **kwargs):
        """
        Soft-delete: mark as archived instead of removing from DB.
        Only owners can archive (enforced by get_permissions).
        """
        household = self.get_object()
        household.archived_at = timezone.now()
        household.save(update_fields=['archived_at'])
        return Response(status=status.HTTP_204_NO_CONTENT)

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
        """Invite a user to household (by email)."""
        household = self.get_object()

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

        if HouseholdInvitation.objects.filter(
            household=household,
            invited_user=invited_user,
            status=HouseholdInvitation.Status.PENDING,
        ).exists():
            return Response(
                {"detail": _("An invitation is already pending for this user.")},
                status=status.HTTP_400_BAD_REQUEST
            )

        invitation = HouseholdInvitation.objects.create(
            household=household,
            invited_user=invited_user,
            invited_by=request.user,
            role=role,
            status=HouseholdInvitation.Status.PENDING,
        )

        from notifications.service import create_notification
        from django.utils import translation
        inviter_name = request.user.display_name or request.user.email
        user_locale = getattr(invited_user, "locale", "en") or "en"
        with translation.override(user_locale):
            notif_title = _("You've been invited to join %(name)s") % {"name": household.name}
            notif_body = _("%(inviter)s invited you to join their household.") % {"inviter": inviter_name}
        create_notification(
            user=invited_user,
            notification_type="household_invitation",
            title=notif_title,
            body=notif_body,
            payload={
                "household_id": str(household.id),
                "household_name": household.name,
                "invitation_id": str(invitation.id),
            },
        )

        return Response(
            {"detail": _("Invitation sent."), "invitation_id": str(invitation.id)},
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


class HouseholdInvitationViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ViewSet for the invited user to list, accept, or decline pending invitations.
    Only the invited user sees their own invitations.
    """
    permission_classes = [IsAuthenticated]
    serializer_class = HouseholdInvitationSerializer

    def get_queryset(self):
        return HouseholdInvitation.objects.filter(
            invited_user=self.request.user,
            status=HouseholdInvitation.Status.PENDING,
        ).select_related('household', 'invited_by').order_by('-created_at')

    @transaction.atomic
    @action(detail=True, methods=['post'])
    def accept(self, request, pk=None):
        """
        Accept an invitation.
        Body: {"switch": true} optionally switches active_household_id to the new household.
        """
        invitation = self.get_object()

        if invitation.status != HouseholdInvitation.Status.PENDING:
            return Response(
                {"detail": _("This invitation is no longer pending.")},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Create membership
        _member, created = HouseholdMember.objects.get_or_create(
            household=invitation.household,
            user=request.user,
            defaults={"role": invitation.role},
        )

        # Mark invitation accepted
        invitation.status = HouseholdInvitation.Status.ACCEPTED
        invitation.save(update_fields=["status"])

        # Optionally switch active household; always set if the user has none yet
        should_switch = request.data.get("switch", False)
        had_no_active = not request.user.active_household_id
        if should_switch or had_no_active:
            request.user.active_household_id = invitation.household.id
            request.user.save(update_fields=["active_household_id"])
        switched = bool(should_switch or had_no_active)

        # Mark related notification(s) as read
        from notifications.service import mark_read_by_payload
        mark_read_by_payload(request.user, "household_invitation", invitation_id=str(invitation.id))

        return Response(
            {
                "detail": _("You have joined %(name)s.") % {"name": invitation.household.name},
                "household_id": str(invitation.household.id),
                "switched": switched,
            },
            status=status.HTTP_200_OK,
        )

    @transaction.atomic
    @action(detail=True, methods=['post'])
    def decline(self, request, pk=None):
        """Decline an invitation."""
        invitation = self.get_object()

        if invitation.status != HouseholdInvitation.Status.PENDING:
            return Response(
                {"detail": _("This invitation is no longer pending.")},
                status=status.HTTP_400_BAD_REQUEST,
            )

        invitation.status = HouseholdInvitation.Status.DECLINED
        invitation.save(update_fields=["status"])

        # Mark related notification(s) as read
        from notifications.service import mark_read_by_payload
        mark_read_by_payload(request.user, "household_invitation", invitation_id=str(invitation.id))

        return Response(
            {"detail": _("Invitation declined.")},
            status=status.HTTP_200_OK,
        )
