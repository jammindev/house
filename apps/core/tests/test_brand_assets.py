"""Les garde-fous de l'identité — vérifiés depuis Python, seul côté qui voit tout.

Trois défauts possibles, tous silencieux, tous rencontrés en écrivant le lot 8 :

1. **Un SVG invalide ne s'affiche pas, et ne dit rien.** Le premier
   `logo-mark.svg` contenait « ``--primary`` » dans son commentaire d'en-tête, or
   XML interdit ``--`` dans un commentaire. Le fichier était donc du XML cassé :
   ``<img>`` refusait de le charger, le logo était absent *partout*, et la seule
   trace était un `Event` sans message dans `onerror`. Rien n'aurait rougi.

2. **Le tracé recopié dérive de sa source.** `ui/src/design-system/logo.tsx`
   recopie le ``d`` de `logo-mark.svg` plutôt que de l'importer (un `import` de
   SVG dépendrait d'un plugin de bundler, et `docs/` est hors du root Vite). Deux
   exemplaires d'une même valeur divergent toujours — sauf si quelque chose les
   compare.

3. **Une icône référencée et absente** produit un carré vide sur l'écran
   d'accueil d'un téléphone, et personne ne teste l'installation d'une PWA.
"""
from __future__ import annotations

import json
import re
import xml.dom.minidom
from pathlib import Path

import pytest

REPO = Path(__file__).resolve().parents[3]
BRAND = REPO / "docs" / "assets" / "brand"
ICONS = REPO / "static" / "icons"
LOGO_TSX = REPO / "ui" / "src" / "design-system" / "logo.tsx"
MANIFEST = REPO / "templates" / "manifest.json"
INDEX = REPO / "templates" / "index.html"

BRAND_COLOR = "#3F5741"


def _svg_files():
    return sorted(BRAND.glob("*.svg")) + sorted(ICONS.glob("*.svg"))


class TestEverySvgIsWellFormed:
    """Un SVG cassé se comporte comme un SVG absent, sans le dire."""

    def test_the_discovery_finds_the_brand_files(self):
        # Sans ce garde-fou, un dossier renommé rendrait la classe entière verte
        # en ne validant rien.
        found = {p.name for p in _svg_files()}
        assert {"logo-mark.svg", "logo.svg", "logo-wordmark.svg"} <= found, found

    @pytest.mark.parametrize("path", _svg_files(), ids=lambda p: p.name)
    def test_it_parses_as_xml(self, path):
        try:
            xml.dom.minidom.parse(str(path))
        except Exception as exc:  # noqa: BLE001 — on veut le message brut
            pytest.fail(f"{path.relative_to(REPO)} n'est pas du XML valide : {exc}")

    @pytest.mark.parametrize("path", _svg_files(), ids=lambda p: p.name)
    def test_no_double_hyphen_in_comments(self, path):
        """Le piège exact du premier jet, nommé pour qu'il ne revienne pas."""
        for comment in re.findall(r"<!--(.*?)-->", path.read_text(), flags=re.S):
            assert "--" not in comment, (
                f"{path.relative_to(REPO)} : « -- » dans un commentaire XML, "
                "ce qui rend le fichier invalide et le logo invisible."
            )


class TestTheMarkHasASingleDefinition:
    """Le tracé du composant et celui de la source de marque ne divergent pas."""

    def test_the_path_matches_the_brand_source(self):
        svg = (BRAND / "logo-mark.svg").read_text()
        tsx = LOGO_TSX.read_text()

        in_svg = re.search(r'\sd="([^"]+)"', svg)
        assert in_svg, "aucun attribut d= dans logo-mark.svg"
        in_tsx = re.search(r"LOGO_MARK_PATH\s*=\s*\n?\s*'([^']+)'", tsx)
        assert in_tsx, "LOGO_MARK_PATH introuvable dans logo.tsx"

        normalise = lambda d: re.sub(r"\s+", " ", d).strip()  # noqa: E731
        assert normalise(in_tsx.group(1)) == normalise(in_svg.group(1)), (
            "Le tracé de logo.tsx a dérivé de docs/assets/brand/logo-mark.svg. "
            "La source est le SVG."
        )

    def test_the_component_carries_no_colour_of_its_own(self):
        """La marque est en `currentColor`, jamais dans une couleur de thème."""
        code = "\n".join(
            line
            for line in LOGO_TSX.read_text().splitlines()
            if not line.lstrip().startswith(("*", "//", "/*"))
        )
        assert not re.search(r"#[0-9a-fA-F]{3,8}\b", code), "couleur en dur dans logo.tsx"
        assert not re.search(r"\b(?:rgb|hsl)a?\(", code), "couleur en dur dans logo.tsx"
        assert not re.search(r"(?:bg|text|fill|stroke)-primary", code), (
            "la marque reprend `--primary`, que les 17 thèmes repeignent"
        )


class TestThePwaIconsExistAndAreDistinct:
    """`any` et `maskable` sont deux fichiers, pas un `purpose` à deux mots."""

    def test_every_manifest_icon_exists_on_disk(self):
        manifest = json.loads(MANIFEST.read_text())
        for icon in manifest["icons"]:
            path = REPO / icon["src"].lstrip("/")
            assert path.is_file(), f"{icon['src']} est référencé et absent"

    def test_any_and_maskable_are_different_files(self):
        """Android rogne 20 % de chaque bord d'une icône `maskable`.

        Avant ce lot, les deux `purpose` pointaient le **même** PNG, avec
        `"purpose": "any maskable"` : Android rognait donc dans le dessin. Le
        manifeste était parfaitement valide, et l'icône installée amputée.
        """
        manifest = json.loads(MANIFEST.read_text())
        by_purpose: dict[str, set[str]] = {}
        for icon in manifest["icons"]:
            for purpose in icon.get("purpose", "any").split():
                by_purpose.setdefault(purpose, set()).add(icon["src"])

        assert "maskable" in by_purpose, "aucune icône maskable déclarée"
        assert "any" in by_purpose, "aucune icône `any` déclarée"
        shared = by_purpose["any"] & by_purpose["maskable"]
        assert not shared, (
            f"Ces fichiers servent aux deux usages : {sorted(shared)}. "
            "Une icône maskable doit garder le signe dans les 80 % centraux ; "
            "servir l'icône `any` la fait rogner dans le dessin."
        )

    def test_the_manifest_wears_the_product_name(self):
        manifest = json.loads(MANIFEST.read_text())
        assert manifest["name"] == "Maisonnée"
        assert manifest["short_name"] == "Maisonnée"
        # Le gris `#f3f4f6` d'avant n'était la marque de personne.
        assert manifest["theme_color"].upper() == BRAND_COLOR
        assert manifest["background_color"].upper() == BRAND_COLOR

    def test_the_page_links_icons_that_exist(self):
        html = INDEX.read_text()
        for href in re.findall(r'<link[^>]+href="(/static/icons/[^"]+)"', html):
            assert (REPO / href.lstrip("/")).is_file(), f"{href} est lié et absent"
        assert "<title>Maisonnée</title>" in html


class TestTheFrontDoorHasNoDeadLinks:
    """Les deux README sont la seule page que 95 % des visiteurs verront.

    Un lien mort y coûte plus cher que partout ailleurs : c'est la première
    chose qu'un inconnu clique, et il n'a aucune raison de supposer que le reste
    du dépôt est plus soigné. Renommer une capture ou déplacer un doc casse le
    README sans qu'aucun test existant ne s'en aperçoive — le fichier reste
    parfaitement valide, il pointe simplement dans le vide.
    """

    READMES = ("README.md", "README.fr.md")

    @pytest.mark.parametrize("readme", READMES)
    def test_every_relative_link_resolves(self, readme):
        text = (REPO / readme).read_text()
        dead = []
        for target in re.findall(r"\]\(([^)]+)\)", text):
            target = target.split("#")[0].strip()
            if not target or target.startswith(("http://", "https://", "mailto:")):
                continue
            if not (REPO / target).exists():
                dead.append(target)
        assert not dead, f"{readme} pointe dans le vide : {sorted(set(dead))}"

    @pytest.mark.parametrize("readme", READMES)
    def test_every_image_resolves(self, readme):
        text = (REPO / readme).read_text()
        dead = [
            src
            for src in re.findall(r"!\[[^\]]*\]\(([^)]+)\)", text)
            if not src.startswith("http") and not (REPO / src.split("#")[0]).exists()
        ]
        # Les balises <img> du bandeau centré comptent aussi.
        dead += [
            src
            for src in re.findall(r'<img[^>]+src="([^"]+)"', text)
            if not src.startswith("http") and not (REPO / src).exists()
        ]
        assert not dead, f"{readme} affiche des images absentes : {sorted(set(dead))}"

    def test_the_screenshots_are_the_six_the_harness_produces(self):
        """Les captures versionnées sont celles que `npm run screenshots` écrit.

        Sans ce contrôle, une capture ajoutée à la main — donc venue d'un vrai
        foyer — passerait inaperçue. C'est le critère 3 du lot 6 : aucune donnée
        d'un foyer réel dans `docs/assets/`.
        """
        spec = (REPO / "scripts/screenshots/capture.spec.ts").read_text()
        declared = set(re.findall(r"name: '([^']+)'", spec))
        on_disk = {p.stem for p in (REPO / "docs/assets/screenshots").glob("*.png")}
        assert declared == on_disk, (
            f"déclarées par le harnais : {sorted(declared)} ; "
            f"présentes sur disque : {sorted(on_disk)}"
        )
