# core/tests/test_static_cache_headers.py
"""Un nom de fichier empreinté se met en cache pour toujours — les autres, non.

Le défaut mesuré en production : `main-DIchQxlR.js`, 243 Ko, servi avec
`cache-control: max-age=60`. Un nom qui porte son empreinte avec un cache d'une
minute, c'est le bundle retéléchargé à chaque minute de navigation. La compression
réglée juste au-dessus dans `base.py` payait 243 Ko au lieu de 824 — soixante fois
par heure au lieu d'une.

WhiteNoise ne pose `immutable` que sur ce qu'il **reconnaît** comme versionné, et
sa reconnaissance passe par le manifeste de Django. Le projet n'en a pas, exprès
(Vite empreinte déjà les noms), donc le test interne échouait toujours en silence.

Ce qui est vérifié ici est le **motif**, compilé comme WhiteNoise le compile
(`re.compile(...)` puis `.search(url)`, cf. `whitenoise/base.py`) — et surtout ses
**deux** bords : ce qu'il doit figer, et ce qu'il ne doit jamais figer. Figer un
favicon pour un an veut dire qu'un changement de marque n'atteint jamais un
navigateur qui a déjà visité, et ça ne se rattrape pas côté serveur.
"""
from __future__ import annotations

import re
from pathlib import Path

import pytest
from django.conf import settings

#: Compilé exactement comme le fait WhiteNoise quand le réglage est une chaîne.
MATCHER = re.compile(settings.WHITENOISE_IMMUTABLE_FILE_TEST)


def is_immutable(url: str) -> bool:
    return bool(MATCHER.search(url))


class TestFingerprintedAssetsAreCachedForever:
    @pytest.mark.parametrize(
        "url",
        [
            "/static/react/assets/main-DIchQxlR.js",
            "/static/react/assets/AccountsPage-CqAVU8Y_.js",
            "/static/react/assets/AttachToTransactionDialog-B-g-LVFH.js",
            "/static/react/assets/BudgetCategoryDetailPage-BTaG9FG_.js",
            "/static/react/assets/index-a1B2c3D4.css",
        ],
    )
    def test_a_vite_asset_is_recognised(self, url):
        assert is_immutable(url)

    def test_the_underscore_and_dash_of_base64url_are_accepted(self):
        """Vite encode son hash en base64url : `-` et `_` en font partie.

        Un motif écrit en `[A-Za-z0-9]` seul laisserait passer la majorité des
        noms — soit un correctif qui a l'air posé et ne l'est pas, exactement le
        défaut qu'on répare.
        """
        assert is_immutable("/static/react/assets/AccountsPage-CqAVU8Y_.js")
        assert is_immutable("/static/react/assets/AttachToTransactionDialog-B-g-LVFH.js")

    def test_it_does_not_depend_on_the_static_prefix(self):
        """Ancré sur le dossier de sortie de Vite, pas sur `STATIC_URL`.

        Le préfixe statique change selon le déploiement ; `react/assets` non.
        """
        assert is_immutable("/ailleurs/react/assets/main-DIchQxlR.js")


class TestEverythingElseKeepsAShortCache:
    @pytest.mark.parametrize(
        "url",
        [
            # Ceux-là changent sous le même nom : les figer rendrait un changement
            # de marque invisible pour tout navigateur ayant déjà visité.
            "/static/icons/favicon.svg",
            "/static/icons/favicon-32.png",
            "/static/icons/apple-touch-icon.png",
            "/static/icons/icon-192.png",
            "/static/icons/icon-192-maskable.png",
            "/static/icons/icon-512.png",
            "/manifest.webmanifest",
            "/service-worker.js",
            # Un nom sans empreinte, même au bon endroit.
            "/static/react/assets/main.js",
            "/static/react/assets/style.css",
            # Une empreinte trop courte n'en est pas une.
            "/static/react/assets/main-abc.js",
            # Une extension qu'on ne sert pas empreintée ici.
            "/static/react/assets/logo-DIchQxlR.svg",
        ],
    )
    def test_it_is_not_frozen(self, url):
        assert not is_immutable(url)


class TestItAgreesWithWhatViteActuallyBuilds:
    """Le contrôle qui vaut le plus : les vrais noms produits par le build.

    Ignoré quand les assets ne sont pas construits — la CI backend ne lance pas
    Vite. Un test qui échoue faute de build n'apprend rien ; un test qui *passe*
    faute de build serait pire, d'où l'assertion de non-vacuité.
    """

    def test_every_built_asset_is_recognised(self):
        assets = Path(settings.BASE_DIR) / "static" / "react" / "assets"
        if not assets.is_dir():
            pytest.skip("assets Vite non construits (npm run build)")

        built = [p.name for p in assets.iterdir() if p.suffix in {".js", ".css"}]
        if not built:
            pytest.skip("aucun asset construit")

        missed = [n for n in built if not is_immutable(f"/static/react/assets/{n}")]
        assert missed == [], f"{len(missed)} assets non reconnus, ex. {missed[:5]}"

    def test_no_icon_is_swept_up_by_the_pattern(self):
        icons = Path(settings.BASE_DIR) / "static" / "icons"
        if not icons.is_dir():
            pytest.skip("icônes absentes")

        frozen = [p.name for p in icons.iterdir() if is_immutable(f"/static/icons/{p.name}")]
        assert frozen == [], f"icônes figées à tort : {frozen}"
