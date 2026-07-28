"""Sonde de vie — `GET /health/`.

Sert de point d'appui au deploy (issue #449) : le healthcheck Docker du service
`web` et le `up -d --wait` du pipeline s'y accrochent pour savoir quand le
conteneur neuf est prêt à recevoir du trafic.

Volontairement une preuve de **vie**, pas de santé : aucune requête, aucun accès
à la base. Deux raisons.

- La sonde tourne toutes les 10 s pour la vie du conteneur, à côté du trafic réel.
- Un hoquet de postgres marquerait `web` malade alors qu'il va très bien, et le
  prochain `up -d --wait` attendrait pour rien. La santé de la base a ses propres
  détecteurs ; ce n'est pas ce qu'on demande ici.

Ce qu'elle prouve, et c'est tout ce qu'on lui demande : gunicorn écoute, Django est
chargé, l'URLconf résout, les middlewares passent.
"""
from django.http import JsonResponse


def health(request):
    response = JsonResponse({"status": "ok"})
    # Un healthcheck servi depuis un cache ne mesure plus rien.
    response["Cache-Control"] = "no-store"
    return response
