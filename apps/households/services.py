"""Household invitation services.

One rule holds this module together: **an invitation is a link, not a message.**
No mail leaves the server (prod has no SMTP host), so the owner shares the
`/join/<token>` URL themselves. An address is optional — when it happens to
match an existing House account, the in-app notification path applies *on top*
of the link, never instead of it.
"""
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from django.utils import translation
from django.utils.translation import gettext_lazy as _
from rest_framework.exceptions import APIException

from notifications.service import create_notification

from .models import Household, HouseholdInvitation, HouseholdMember

User = get_user_model()


class InvitationError(APIException):
    """A refusal the user can act on — rendered as a plain `{"detail": "…"}`.

    Deliberately not a `serializers.ValidationError`: that one wraps every value
    in a list, so `detail` would arrive as `["…"]` and every front-end that reads
    `data.detail` as a string would print an array.
    """
    status_code = 400


class AlreadyMemberError(InvitationError):
    """The address already belongs to a member of this household."""


class AccountExistsError(InvitationError):
    """The link was opened anonymously for an address that already has an account."""


def find_user_by_email(email):
    """Case-insensitive lookup — `Jean@X.com` and `jean@x.com` are one account.

    The exact-match version of this lookup is what made every invitation in prod
    fail with a 404; login and password reset have always been case-insensitive.
    """
    if not email:
        return None
    return User.objects.filter(email__iexact=email.strip()).first()


@transaction.atomic
def create_invitation(*, household: Household, invited_by, email: str = "", role: str = HouseholdMember.Role.MEMBER):
    """Create a pending invitation and return it (its token is the shareable link).

    `email` is optional: without it the link is addressed to nobody in
    particular, which is the whole point of being shareable by hand.
    """
    email = (email or "").strip().lower()

    if role not in {HouseholdMember.Role.OWNER, HouseholdMember.Role.MEMBER}:
        raise InvitationError(_("Invalid role. Must be owner or member."))

    invited_user = find_user_by_email(email)

    if invited_user and HouseholdMember.objects.filter(household=household, user=invited_user).exists():
        raise AlreadyMemberError(_("User is already a member of this household."))

    if email:
        pending = HouseholdInvitation.objects.filter(
            household=household,
            email=email,
            status=HouseholdInvitation.Status.PENDING,
        ).first()
        if pending and not pending.is_expired:
            raise InvitationError(
                _("An invitation is already pending for this address. Share its link, or revoke it first.")
            )

    invitation = HouseholdInvitation.objects.create(
        household=household,
        invited_user=invited_user,
        email=email,
        invited_by=invited_by,
        role=role,
        status=HouseholdInvitation.Status.PENDING,
    )

    if invited_user:
        _notify_invited_user(invitation)

    return invitation


def _notify_invited_user(invitation):
    """In-app notification — only possible when the invitee already has an account."""
    inviter = invitation.invited_by
    inviter_name = (inviter.display_name or inviter.email) if inviter else ""
    user_locale = getattr(invitation.invited_user, "locale", "en") or "en"
    household = invitation.household

    with translation.override(user_locale):
        notif_title = _("You've been invited to join %(name)s") % {"name": household.name}
        notif_body = _("%(inviter)s invited you to join their household.") % {"inviter": inviter_name}

    create_notification(
        user=invitation.invited_user,
        notification_type="household_invitation",
        title=str(notif_title),
        body=str(notif_body),
        payload={
            "household_id": str(household.id),
            "household_name": household.name,
            "invitation_id": str(invitation.id),
        },
    )


def get_pending_invitation(token):
    """The pending invitation behind a token, or None.

    Restricted to `pending` on purpose: a revoked or already-used link must not
    even disclose the household's name to whoever still holds it. An *expired*
    one stays visible, so the page can say "expired" instead of "invalid" — that
    distinction is actionable (ask for a new link) and leaks nothing new, since
    the link was legitimately shared with this person.

    Archived households are excluded too: `destroy` is a soft delete, so without
    this an old link kept opening a foyer that no longer exists — and since
    `HouseholdViewSet.get_queryset` filters archived ones out, the newcomer
    joined a household they could never see.
    """
    if not token:
        return None
    return (
        HouseholdInvitation.objects
        .select_related("household", "invited_by")
        .filter(
            token=token,
            status=HouseholdInvitation.Status.PENDING,
            household__archived_at__isnull=True,
        )
        .first()
    )


def assert_addressed_to(invitation, user):
    """An addressed invitation is for that address — whoever is logged in.

    The anonymous path pins the email by construction (it *creates* the account),
    but the authenticated path used to accept anybody holding the link: a
    forwarded invitation addressed to Claire enrolled Marc's existing account.
    Pinning on one side only was the surprising half of a rule stated as whole.
    """
    if not invitation.email:
        return
    if invitation.invited_user_id == user.id:
        return
    if (user.email or "").strip().lower() == invitation.email:
        return
    raise InvitationError(
        _("This invitation is addressed to %(email)s. Log in with that account to accept it.")
        % {"email": invitation.email}
    )


@transaction.atomic
def consume_invitation(invitation, user, *, switch=True):
    """Turn a usable invitation into a membership for `user`.

    Returns `(membership, already_member)`. Accepting is idempotent from the
    user's point of view: a link sent to somebody who already joined marks
    itself used rather than showing them an error about a household they are
    already in.
    """
    # Claim the link with a conditional UPDATE before doing anything else: two
    # requests arriving together both saw it `pending`, and a blind save let each
    # create its own account and membership — a single link enrolling two people.
    # Postgres serialises the UPDATE, so exactly one gets a row.
    claimed = (
        HouseholdInvitation.objects
        .filter(pk=invitation.pk, status=HouseholdInvitation.Status.PENDING)
        .update(status=HouseholdInvitation.Status.ACCEPTED, invited_user=user)
    )
    if not claimed:
        raise InvitationError(_("This invitation link has already been used."))
    invitation.status = HouseholdInvitation.Status.ACCEPTED
    invitation.invited_user = user

    membership, created = HouseholdMember.objects.get_or_create(
        household=invitation.household,
        user=user,
        defaults={"role": invitation.role},
    )

    # A user with no active household would otherwise land on an empty app.
    if switch or not user.active_household_id:
        user.active_household_id = invitation.household_id
        user.save(update_fields=["active_household_id"])

    from notifications.service import mark_read_by_payload
    mark_read_by_payload(user, "household_invitation", invitation_id=str(invitation.id))

    return membership, not created


@transaction.atomic
def join_with_new_account(invitation, *, email, password, display_name=""):
    """Create the account behind an anonymously-opened link, then join.

    Refuses to touch an existing account: a leaked link must never be a way to
    take over an address. The visitor is told to log in and reopen the link.
    """
    email = (email or "").strip().lower()
    if not email:
        raise InvitationError(_("Email is required."))

    if find_user_by_email(email):
        raise AccountExistsError(
            _("An account already exists for this address. Log in, then open the link again.")
        )

    if not password:
        raise InvitationError(_("Password is required."))

    user = User(
        email=email,
        display_name=(display_name or "").strip(),
        locale=getattr(invitation.household, "preferred_language", "") or "en",
    )
    try:
        validate_password(password, user)
    except DjangoValidationError as exc:
        # Joined into one `detail` string: the join page has a single error slot,
        # and a `{"password": [...]}` payload would print as an array there.
        raise InvitationError(" ".join(exc.messages)) from exc

    user.set_password(password)
    user.save()

    consume_invitation(invitation, user, switch=True)
    return user
