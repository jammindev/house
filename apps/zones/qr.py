"""Rendu des étiquettes QR d'une zone (parcours 31).

Les codes sont produits **côté serveur**. Une bibliothèque JS de génération
aurait ajouté une dépendance front pour un écran qu'un foyer ouvre une fois dans
sa vie ; `segno` est du Python pur, sans extension C, et ne pèse ni sur l'image
Docker ni sur le bundle.

L'URL encodée réutilise ``settings.FRONTEND_URL`` — le même réglage que le lien
d'invitation. Une seule définition de « l'adresse publique de cette instance » :
deux en feraient dériver une, et un QR imprimé avec la mauvaise ne se corrige
qu'en décollant les étiquettes.
"""
from __future__ import annotations

import io

import segno

from django.conf import settings

#: Niveau de correction d'erreur. `M` tolère ~15 % de surface abîmée — le bon
#: compromis pour une étiquette scotchée près d'un interrupteur, qui sera cornée
#: bien avant d'être remplacée. `L` serait plus dense mais fragile, `Q`/`H`
#: grossiraient le code sans raison sur une URL aussi courte.
ERROR_CORRECTION = 'm'


def label_path(zone) -> str:
    """Le chemin que porte l'étiquette — relatif, pour les tests et l'affichage."""
    return f"/z/{zone.qr_token}"


def label_url(zone) -> str:
    """L'URL absolue encodée dans le QR."""
    return f"{settings.FRONTEND_URL.rstrip('/')}{label_path(zone)}"


def render_svg(url: str, *, scale: int = 4) -> str:
    """Le QR d'une URL, en SVG inline (sans déclaration XML ni namespace superflu).

    Le SVG part tel quel dans une réponse JSON puis dans le DOM : pas de fichier
    intermédiaire, pas de route média à protéger.
    """
    qr = segno.make(url, error=ERROR_CORRECTION)
    # segno écrit du SVG **en octets**, jamais en texte — d'où le tampon binaire
    # puis le décodage. Un `StringIO` lève un `TypeError` au premier write.
    buffer = io.BytesIO()
    qr.save(
        buffer,
        kind='svg',
        scale=scale,
        border=2,
        xmldecl=False,
        svgns=True,
        nl=False,
    )
    return buffer.getvalue().decode('utf-8')


def label_for(zone, *, scale: int = 4) -> dict:
    """Tout ce qu'il faut pour imprimer l'étiquette d'une pièce."""
    url = label_url(zone)
    return {
        'zone_id': str(zone.id),
        'name': zone.name,
        'full_path': zone.full_path,
        'path': label_path(zone),
        'url': url,
        'svg': render_svg(url, scale=scale),
    }
