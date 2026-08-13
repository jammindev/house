"""Débits propres aux documents — le seul endroit où une requête achète deux choses.

`DocumentViewSet.upload` est l'endpoint le plus cher de l'API, et il ne le
disait pas : chaque envoi écrit jusqu'à 20 Mo sur le disque **et**, pour tout
document qui n'est pas une photo, déclenche un appel de vision *synchrone*
(`views._run_extraction`). Un script d'envoi en boucle achetait donc de l'OCR au
rythme du réseau, sur la clé de l'instance, en remplissant le volume au passage.

Les deux caps sont séparés parce que les deux gestes ne coûtent pas la même chose :

- `DocumentUploadThrottle` borne l'arrivée de fichiers — disque et OCR ensemble ;
- `OcrReprocessThrottle` borne la **relance** d'extraction sur un document déjà
  là, qui ne coûte rien en disque et tout en fournisseur. Sans cap propre, il
  suffisait d'envoyer un fichier une fois pour re-facturer son OCR sans limite.

Volontairement plus larges que ce qu'un foyer consomme : un envoi groupé de
photos de chantier doit passer. Ils existent pour qu'une boucle s'arrête, pas
pour rationner un usage réel.
"""
from rest_framework.throttling import UserRateThrottle


class DocumentUploadThrottle(UserRateThrottle):
    """120 envois par heure et par utilisateur — disque et vision à la fois."""

    scope = "document_upload"


class OcrReprocessThrottle(UserRateThrottle):
    """20 relances d'OCR par heure et par utilisateur — coût pur fournisseur."""

    scope = "ocr_reprocess"
