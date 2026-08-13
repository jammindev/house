"""Plancher de débit — ce qu'un compte peut coûter à l'instance, par défaut.

Jusqu'ici les limites étaient **déclarées vue par vue** : l'agent, la connexion, la
recherche, le changement de mot de passe. Tout le reste de l'API — c'est-à-dire
l'écrasante majorité des endpoints — n'en avait aucune, parce que
``DEFAULT_THROTTLE_CLASSES`` n'était pas posé. Le défaut se lit mal en revue : le
diff d'une vue bornée et celui d'une vue nue sont identiques, et la vue nue est
celle qu'on écrit sans y penser.

Ce que ça coûtait concrètement, sur une instance dont les sources sont publiques :

- **des euros** — chaque écriture d'entité déclenche un embedding
  (``EMBEDDING_INDEXING_ENABLED``), donc un appel au fournisseur. Un script qui
  crée dix mille tâches en achète dix mille ;
- **du disque** — l'envoi de documents n'avait pas plus de limite que le reste.

D'où deux classes, appliquées **par défaut à toute vue DRF** qui n'en déclare pas
d'autres. Une vue qui pose son propre ``throttle_classes`` **remplace** celui-ci
(c'est la sémantique de DRF) : les caps plus serrés de l'agent et de la connexion
restent donc les seuls à s'appliquer là où ils sont posés — ce plancher ne les
desserre jamais.

Les deux axes sont volontairement larges : ils n'existent pas pour discipliner un
foyer, mais pour qu'une boucle emballée s'arrête avant la facture. Un humain
derrière un navigateur ne les atteint pas ; un script les atteint en quelques
secondes.

⚠️ **Un throttle vaut ce que vaut son cache.** DRF compte dans
``django.core.cache``. Avec le ``LocMemCache`` par défaut et quatre workers
gunicorn, chaque compteur existe en quatre exemplaires : « 5 tentatives de
connexion par minute » en autorise vingt, et tout repart à zéro à chaque deploy.
C'est la règle « un compteur ne peut pas avoir deux définitions » appliquée au
débit — ici il en avait quatre. Le cache de base est donc partagé
(``CACHES`` dans ``config/settings/base.py``), et c'est ce qui rend cette limite
vraie plutôt qu'affichée.
"""
from rest_framework.throttling import AnonRateThrottle, UserRateThrottle


class GlobalUserBurstThrottle(UserRateThrottle):
    """Rafale par utilisateur — absorbe une boucle emballée en quelques secondes."""

    scope = "user_burst"


class GlobalUserSustainedThrottle(UserRateThrottle):
    """Plafond horaire par utilisateur — borne ce qu'un compte coûte sur la durée."""

    scope = "user_sustained"


class GlobalAnonThrottle(AnonRateThrottle):
    """Plafond par IP pour ce qui s'atteint sans compte.

    Les endpoints anonymes connus (connexion, réinitialisation, invitation,
    inscription) portent déjà un throttle nommé, plus serré, qui remplace
    celui-ci. Il couvre donc ce qu'on ajoutera demain sans y penser.
    """

    scope = "anon"
