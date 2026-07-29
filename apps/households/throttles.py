"""Throttles for the public invitation-link endpoint.

The token is 32 random bytes, so guessing one is not the threat. What a throttle
buys is a ceiling on account creation from a single source if a link ever leaks.
"""
from rest_framework.throttling import AnonRateThrottle


class InvitationJoinThrottle(AnonRateThrottle):
    """Per IP, anonymous requests only — which is exactly the account-creating path."""
    scope = "invitation_join"
