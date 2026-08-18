"""Domain helpers for the equipment app.

Deux responsabilités, et la seconde est la raison d'être de ce module :

1. calculer la prochaine échéance d'entretien ;
2. **dire l'état d'un équipement en un mot** — garantie et entretien — pour que
   la liste, la fiche et le compteur du bandeau lisent tous la même fonction.

Le point 2 est né d'un défaut réel : la fiche écrivait « Garantie : Expirée » en
rouge pendant que la liste affichait la même date en gris, au milieu des autres.
Deux écrans, deux voix sur le même fait — et c'est le lecteur qui arbitrait. La
règle du dépôt (« un écart ne se dit jamais deux fois avec deux voix ») s'applique
mot pour mot ici : le verdict se calcule **une fois, côté serveur**, et se sert
tel quel aux deux écrans.
"""

import calendar
import unicodedata
from datetime import date

from django.utils.translation import gettext_lazy as _  # noqa: F401  (admin labels)

#: Fenêtre d'anticipation, en jours. Une garantie qui expire dans trois semaines
#: est une information ; la même dans trois ans est du bruit.
WARRANTY_SOON_DAYS = 60
MAINTENANCE_SOON_DAYS = 30


def compute_next_service_due(last_service_at, maintenance_interval_months) -> date | None:
    """Return the next maintenance date or ``None`` if it cannot be computed."""
    if not last_service_at or not maintenance_interval_months:
        return None

    total_month = last_service_at.month - 1 + maintenance_interval_months
    year = last_service_at.year + total_month // 12
    month = total_month % 12 + 1
    max_day = calendar.monthrange(year, month)[1]
    day = min(last_service_at.day, max_day)
    return last_service_at.replace(year=year, month=month, day=day)


def warranty_state(equipment, today: date) -> dict:
    """Verdict de garantie : ``unknown`` | ``expired`` | ``expiring`` | ``valid``.

    ``unknown`` n'est **pas** ``expired`` : une garantie non renseignée n'est pas
    une garantie perdue, c'est une case que personne n'a remplie. Les confondre
    afficherait un reproche là où il n'y a qu'une absence de saisie — même
    principe que ``inflow_nature == ""`` face à ``"other"``.
    """
    expires_on = equipment.warranty_expires_on
    if not expires_on:
        return {"state": "unknown", "date": None, "days": None}

    days = (expires_on - today).days
    if days < 0:
        state = "expired"
    elif days <= WARRANTY_SOON_DAYS:
        state = "expiring"
    else:
        state = "valid"
    return {"state": state, "date": expires_on, "days": days}


def maintenance_state(equipment, today: date) -> dict:
    """Verdict d'entretien : ``unknown`` | ``overdue`` | ``due_soon`` | ``ok``.

    ``unknown`` couvre les deux absences qui empêchent tout calcul — pas
    d'intervalle déclaré, ou aucun entretien connu. Un équipement sans intervalle
    n'est pas « à jour » : il n'est pas suivi, et l'annoncer vert serait la coche
    verte d'un contrôle qui n'a rien vérifié.
    """
    next_due = compute_next_service_due(
        equipment.last_service_at, equipment.maintenance_interval_months
    )
    if next_due is None:
        return {"state": "unknown", "date": None, "days": None}

    days = (next_due - today).days
    if days < 0:
        state = "overdue"
    elif days <= MAINTENANCE_SOON_DAYS:
        state = "due_soon"
    else:
        state = "ok"
    return {"state": state, "date": next_due, "days": days}


#: Les états qui réclament un geste — ceux que le bandeau compte et que les
#: pastilles filtrent. Déclarés ici pour que le compteur et le filtre ne puissent
#: pas diverger : ce sont les mêmes clés des deux côtés.
ATTENTION_FILTERS = {
    "maintenance_overdue": ("maintenance", "overdue"),
    "maintenance_due_soon": ("maintenance", "due_soon"),
    "warranty_expired": ("warranty", "expired"),
    "warranty_expiring": ("warranty", "expiring"),
}


def attention_states(equipment, today: date) -> dict:
    """Les deux verdicts d'un équipement, sous la forme servie par l'API."""
    return {
        "warranty_state": warranty_state(equipment, today),
        "maintenance_state": maintenance_state(equipment, today),
    }


def matches_attention(equipment, key: str, today: date) -> bool:
    """L'équipement tombe-t-il dans la pastille ``key`` ?"""
    axis, expected = ATTENTION_FILTERS[key]
    verdict = (
        warranty_state(equipment, today)
        if axis == "warranty"
        else maintenance_state(equipment, today)
    )
    return verdict["state"] == expected


# ---------------------------------------------------------------------------
# Catégories
# ---------------------------------------------------------------------------
#
# `category` a longtemps été un champ texte libre pré-rempli « general ». Sur un
# parc de 21 objets, la base portait 13 orthographes — `voiture`, `Machine`,
# `machine`, `outil`, `tool`, `garden`, `jardin`, `hvac`, `heating`… — affichées
# brutes, donc en anglais dans une interface française. Un axe de classement dont
# chaque saisie invente une valeur ne classe rien et ne se filtre pas.
#
# Le vocabulaire est donc fermé. Les **libellés** utilisateur vivent dans le
# namespace i18n `equipment.category.*` du front, pas en `gettext` ici : ajouter
# une catégorie ne doit pas imposer un passage dans quatre `.po` (même règle que
# les `kind` de l'argent).

#: Toute valeur inconnue retombe ici — jamais une catégorie inventée en silence.
CATEGORY_FALLBACK = "other"

#: Orthographes acceptées → valeur canonique. La clé est normalisée (casse et
#: accents neutralisés) avant lecture.
CATEGORY_ALIASES: dict[str, str] = {
    "heating": "heating",
    "chauffage": "heating",
    "hvac": "heating",
    "vmc": "heating",
    "ventilation": "heating",
    "climatisation": "heating",
    "plomberie": "plumbing",
    "plumbing": "plumbing",
    "sanitaire": "plumbing",
    "appliance": "appliance",
    "appliances": "appliance",
    "electromenager": "appliance",
    "menager": "appliance",
    "tool": "tool",
    "tools": "tool",
    "outil": "tool",
    "outils": "tool",
    "outillage": "tool",
    "machine": "tool",
    "bricolage": "tool",
    "garden": "garden",
    "jardin": "garden",
    "jardinage": "garden",
    "exterieur": "garden",
    "mobility": "mobility",
    "voiture": "mobility",
    "vehicule": "mobility",
    "velo": "mobility",
    "bike": "mobility",
    "car": "mobility",
    "multimedia": "multimedia",
    "informatique": "multimedia",
    "computer": "multimedia",
    "electronics": "multimedia",
    "electronique": "multimedia",
    "furniture": "furniture",
    "meuble": "furniture",
    "meubles": "furniture",
    "mobilier": "furniture",
    "security": "security",
    "securite": "security",
    "alarme": "security",
    "general": CATEGORY_FALLBACK,
    "divers": CATEGORY_FALLBACK,
    "autre": CATEGORY_FALLBACK,
    "other": CATEGORY_FALLBACK,
}


def _normalize_key(value: str) -> str:
    """Casse, accents et espaces neutralisés — la clé de lecture des alias.

    Volontairement local plutôt qu'emprunté à ``interactions.normalize_supplier_name``
    (qui dit la même chose pour les fournisseurs) : faire dépendre le catalogue des
    équipements du module argent pour trois lignes coûterait plus cher que ces
    trois lignes.
    """
    text = unicodedata.normalize("NFKD", str(value or ""))
    text = "".join(ch for ch in text if not unicodedata.combining(ch))
    return " ".join(text.casefold().split())


def normalize_category(value: str | None) -> str:
    """Ramener une saisie libre au vocabulaire fermé.

    Renvoie ``other`` pour l'inconnu — l'appelant qui tient à la valeur d'origine
    doit la conserver ailleurs (la migration la range dans les tags).
    """
    key = _normalize_key(value)
    if not key:
        return CATEGORY_FALLBACK
    return CATEGORY_ALIASES.get(key, CATEGORY_FALLBACK)


#: Même mécanique pour l'état d'usure. Le défaut historique du formulaire était
#: « good » ; la base portait aussi « Neuf ». Deux langues dans une colonne que
#: la fiche affichait telle quelle.
CONDITION_FALLBACK = "good"

CONDITION_ALIASES: dict[str, str] = {
    "new": "new", "neuf": "new", "neuve": "new", "nouveau": "new",
    "good": "good", "bon": "good", "bon etat": "good", "correct": "good", "ok": "good",
    "fair": "fair", "moyen": "fair", "usage": "fair", "use": "fair", "passable": "fair",
    "poor": "poor", "mauvais": "poor", "mauvais etat": "poor", "fatigue": "poor",
    "broken": "broken", "casse": "broken", "hs": "broken", "hors service": "broken",
    "en panne": "broken",
}


def normalize_condition(value: str | None) -> str:
    """Ramener un état d'usure au vocabulaire fermé (inconnu → ``good``)."""
    key = _normalize_key(value)
    if not key:
        return CONDITION_FALLBACK
    return CONDITION_ALIASES.get(key, CONDITION_FALLBACK)
