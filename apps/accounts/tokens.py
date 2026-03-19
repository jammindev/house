"""Custom JWT token helpers for accounts app."""
from datetime import timedelta

from rest_framework_simplejwt.tokens import AccessToken


def get_impersonation_token(admin_user, target_user):
    """Generate a short-lived access token (1h) for impersonation.

    The token contains an `impersonated_by` claim with the admin's id.
    No refresh token is issued — the session expires with the access token.
    """
    token = AccessToken.for_user(target_user)
    token['impersonated_by'] = admin_user.id
    token.set_exp(lifetime=timedelta(hours=1))
    return {'access': str(token)}
