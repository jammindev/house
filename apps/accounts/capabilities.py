"""L'e-mail sortant — réinitialisation de mot de passe, invitation adressée.

Ce que cette capacité **ne** conditionne **pas**, et c'est le point : inviter un
second membre. Le lien ``/join/<token>`` se copie à la main et suffit à faire
entrer quelqu'un dans le foyer. L'e-mail est un confort, jamais le véhicule
unique — sans quoi un foyer auto-hébergé resterait à une personne, ce qui vide
de son sens un produit dont l'unité est le foyer.
"""
from __future__ import annotations

from django.conf import settings

# Backends qui n'envoient rien vers l'extérieur. `console` et `locmem` sont des
# défauts de développement et de test ; `dummy` avale tout. Les traiter comme
# « disponible » ferait annoncer « e-mail envoyé » à un utilisateur qui
# n'attendrait plus rien d'autre.
_NON_DELIVERING_BACKENDS = (
    "django.core.mail.backends.console.EmailBackend",
    "django.core.mail.backends.locmem.EmailBackend",
    "django.core.mail.backends.dummy.EmailBackend",
)


def email_available() -> bool:
    """Un e-mail part-il vraiment d'ici ?

    Le backend SMTP sans ``EMAIL_HOST`` compte pour indisponible : Django tente
    alors ``localhost:587``, et l'échec arrive au moment de l'envoi, loin de
    l'écran qui l'a promis.
    """
    backend = getattr(settings, "EMAIL_BACKEND", "") or ""
    if not backend or backend in _NON_DELIVERING_BACKENDS:
        return False
    if backend == "django.core.mail.backends.smtp.EmailBackend":
        return bool(getattr(settings, "EMAIL_HOST", "") or "")
    # Backend tiers (Anymail, SES…) : celui qui l'installe l'a configuré.
    return True
