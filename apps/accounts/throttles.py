"""
Login-specific throttles.

Two independent axes:
- LoginIPRateThrottle   : limits attempts per IP address (blocks bots/scans)
- LoginEmailRateThrottle: limits attempts per email     (blocks targeted brute-force)

Rates are configurable via settings:
    DEFAULT_THROTTLE_RATES = {
        "login_ip":    "20/min",
        "login_email": "5/min",
    }
"""
from rest_framework.throttling import AnonRateThrottle, SimpleRateThrottle, UserRateThrottle


class LoginIPRateThrottle(AnonRateThrottle):
    """
    20 login attempts per minute per IP address.
    Uses AnonRateThrottle so it always applies (regardless of auth state).
    """
    scope = "login_ip"


class LoginEmailRateThrottle(SimpleRateThrottle):
    """
    5 login attempts per minute per email address.
    Covers the case where an attacker rotates IPs to target a single account.
    """
    scope = "login_email"

    def get_cache_key(self, request, view):
        email = request.data.get("email", "")
        if not email:
            return None  # no email → skip this throttle, IP throttle still applies
        return self.cache_format % {
            "scope": self.scope,
            "ident": email.lower().strip(),
        }


class ChangePasswordRateThrottle(UserRateThrottle):
    """5 password changes per hour per authenticated user."""
    scope = "change_password"
