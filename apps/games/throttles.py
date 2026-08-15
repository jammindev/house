"""Le seul geste des jeux qui coûte de l'argent — donc le seul à part.

Le plancher global (`core.throttles`) borne des **requêtes** ; il compte pareil
un `GET /games/hunts/` et une génération d'énigmes, alors que la seconde achète
un appel au fournisseur. C'est la règle du `CLAUDE.md` : *ce qui coûte de
l'argent se borne à part de ce qui coûte une requête* — même raison que
`document_upload` et `ocr_reprocess`.

Le cap est volontairement bas, et ce n'est pas une restriction d'usage : on
compose une chasse une fois, on regénère peut-être deux ou trois fois pour
ajuster le ton, et on joue. Vingt par heure laisse largement la place à un
parent qui hésite ; un onglet resté ouvert sur une boucle, non.
"""
from rest_framework.throttling import UserRateThrottle


class HuntRiddlesThrottle(UserRateThrottle):
    """20 générations d'énigmes par heure et par utilisateur."""

    scope = "hunt_riddles"
