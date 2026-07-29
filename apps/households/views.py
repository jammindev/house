"""
Households views - REST API for household management.
"""
from django.contrib.auth import login as auth_login
from django.utils import timezone
from django.utils.translation import gettext_lazy as _
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db import transaction

from rest_framework.permissions import AllowAny
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

from . import services
from .models import Household, HouseholdMember, HouseholdInvitation
from .serializers import (
    HouseholdSerializer,
    HouseholdDetailSerializer,
    HouseholdMemberSerializer,
    HouseholdInvitationSerializer,
    HouseholdInvitationLinkSerializer,
    InvitationPreviewSerializer,
)
from .throttles import InvitationJoinThrottle
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
        if self.action in {
            'update', 'partial_update', 'destroy',
            'invite', 'invitations', 'revoke_invitation',
            'remove_member', 'update_role',
        }:
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

    @action(detail=False, methods=['post'], url_path='switch')
    def switch_active(self, request):
        """Switch the active household for the current user."""
        household_id = request.data.get('household_id')
        if not household_id:
            return Response({'detail': _('household_id is required.')}, status=status.HTTP_400_BAD_REQUEST)
        try:
            # Ensure user is a member of this household
            HouseholdMember.objects.get(household_id=household_id, user=request.user)
        except HouseholdMember.DoesNotExist:
            return Response({'detail': _('Not a member of this household.')}, status=status.HTTP_403_FORBIDDEN)
        request.user.active_household_id = household_id
        request.user.save(update_fields=['active_household_id'])
        return Response({'detail': 'Switched.'})

    @action(detail=False, methods=['get'], url_path='active-members')
    def active_members(self, request):
        """Get members of the active household (resolved by middleware, no ID required)."""
        household = request.household
        if not household:
            return Response([])
        members = HouseholdMember.objects.filter(household=household).select_related('user')
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
        """Create an invitation link for this household.

        `email` is **optional** — the owner shares the returned `join_url`
        themselves, so a link addressed to nobody in particular is legitimate.
        When the address does have a House account, an in-app notification goes
        out on top of the link.
        """
        household = self.get_object()

        invitation = services.create_invitation(
            household=household,
            invited_by=request.user,
            email=request.data.get('email') or '',
            role=request.data.get('role') or HouseholdMember.Role.MEMBER,
        )

        return Response(
            HouseholdInvitationLinkSerializer(invitation).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=['get'], url_path='invitations')
    def invitations(self, request, pk=None):
        """Pending invitation links of this household (owner only) — to copy or revoke."""
        household = self.get_object()
        invitations = HouseholdInvitation.objects.filter(
            household=household,
            status=HouseholdInvitation.Status.PENDING,
        ).select_related('invited_by').order_by('-created_at')
        return Response(HouseholdInvitationLinkSerializer(invitations, many=True).data)

    @action(detail=True, methods=['post'], url_path='revoke-invitation')
    def revoke_invitation(self, request, pk=None):
        """Kill a shared link (owner only). A leaked link must be stoppable."""
        household = self.get_object()
        invitation_id = request.data.get('invitation_id')
        if not invitation_id:
            return Response(
                {'detail': _('invitation_id is required.')},
                status=status.HTTP_400_BAD_REQUEST,
            )

        invitation = HouseholdInvitation.objects.filter(
            household=household,
            id=invitation_id,
        ).first()
        if not invitation:
            return Response(
                {'detail': _('Invitation not found.')},
                status=status.HTTP_404_NOT_FOUND,
            )

        if invitation.status != HouseholdInvitation.Status.PENDING:
            return Response(
                {'detail': _('This invitation is no longer pending.')},
                status=status.HTTP_400_BAD_REQUEST,
            )

        invitation.status = HouseholdInvitation.Status.REVOKED
        invitation.save(update_fields=['status'])
        return Response(status=status.HTTP_204_NO_CONTENT)

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

    @action(detail=True, methods=['post'])
    def accept(self, request, pk=None):
        """
        Accept an invitation.
        Body: {"switch": true} optionally switches active_household_id to the new household.
        """
        invitation = self.get_object()

        if not invitation.is_usable:
            return Response(
                {"detail": _("This invitation has expired.") if invitation.is_expired
                           else _("This invitation is no longer pending.")},
                status=status.HTTP_400_BAD_REQUEST,
            )

        should_switch = bool(request.data.get("switch", False))
        had_no_active = not request.user.active_household_id
        services.consume_invitation(invitation, request.user, switch=should_switch)

        return Response(
            {
                "detail": _("You have joined %(name)s.") % {"name": invitation.household.name},
                "household_id": str(invitation.household.id),
                "switched": should_switch or had_no_active,
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


class JoinHouseholdView(APIView):
    """Public endpoint behind a shared invitation link — `/api/households/join/<token>/`.

    GET  previews the invitation so the visitor knows what they are joining.
    POST joins: creates the account when nobody is logged in, or enrolls the
         current user when somebody is.

    Deliberately `AllowAny`: the token *is* the credential. It is 32 random bytes
    and single-use, and the endpoint is throttled per IP.
    """
    permission_classes = [AllowAny]
    throttle_classes = [InvitationJoinThrottle]

    def get(self, request, token=None):
        invitation = services.get_pending_invitation(token)
        if invitation is None:
            return Response(
                {"detail": _("This invitation link is not valid.")},
                status=status.HTTP_404_NOT_FOUND,
            )
        return Response(InvitationPreviewSerializer(invitation).data)

    def post(self, request, token=None):
        invitation = services.get_pending_invitation(token)
        if invitation is None:
            return Response(
                {"detail": _("This invitation link is not valid.")},
                status=status.HTTP_404_NOT_FOUND,
            )

        if invitation.is_expired:
            return Response(
                {"detail": _("This invitation has expired. Ask for a new link.")},
                status=status.HTTP_410_GONE,
            )

        # Already logged in — no account to create, just enroll.
        if request.user and request.user.is_authenticated:
            services.assert_addressed_to(invitation, request.user)
            _membership, already_member = services.consume_invitation(
                invitation, request.user, switch=True
            )
            return Response(
                {
                    "detail": _("You are already a member of %(name)s.") % {"name": invitation.household.name}
                    if already_member
                    else _("You have joined %(name)s.") % {"name": invitation.household.name},
                    "household_id": str(invitation.household_id),
                    "already_member": already_member,
                    "created_account": False,
                },
                status=status.HTTP_200_OK,
            )

        # Anonymous — an addressed invitation pins the email, so a forwarded link
        # cannot be used to open an account under a different address.
        email = invitation.email or request.data.get("email") or ""
        user = services.join_with_new_account(
            invitation,
            email=email,
            password=request.data.get("password") or "",
            display_name=request.data.get("display_name") or "",
        )

        # Log them straight in — otherwise joining ends on a login screen and the
        # password they just chose has to be typed again. The SPA authenticates
        # with the JWT pair; the session cookie is what lets native `<img
        # src="/media/…">` requests carry auth (see TokenObtainPairWithSessionView).
        auth_login(request, user, backend="django.contrib.auth.backends.ModelBackend")
        refresh = RefreshToken.for_user(user)

        return Response(
            {
                "detail": _("You have joined %(name)s.") % {"name": invitation.household.name},
                "household_id": str(invitation.household_id),
                "already_member": False,
                "created_account": True,
                "access": str(refresh.access_token),
                "refresh": str(refresh),
            },
            status=status.HTTP_201_CREATED,
        )
