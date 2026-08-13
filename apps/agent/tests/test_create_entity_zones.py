"""« Crée une note dans la chambre » — le tool ``create_entity`` place la zone.

Régression (#579) : les writables ``note`` et ``task`` ne résolvaient les zones
que depuis l'**ancre** de conversation. Dans l'assistant global — le seul chemin
qui reste depuis que les onglets « Assistant » ont disparu des vues de détail —
l'ancre est toujours ``None``, et un contexte simplement *épinglé* n'en est pas
une. La note partait donc sans zone, en silence : rien de rouge, une note
parfaitement valide, simplement rangée nulle part.

Ce que ces tests tiennent :

- une zone se désigne par son **nom** autant que par son id (contrat déjà en
  place pour ``stock_item``, ``tracker``, ``meter``) ;
- l'inconnu et l'ambigu sont des **messages récupérables**, pas une note muette
  — sinon l'agent confirmerait un rangement qui n'a pas eu lieu ;
- une zone d'un autre foyer n'est jamais résolvable ;
- l'ancre reste un **défaut**, jamais un écrasement de ce que l'utilisateur a dit.
"""
from __future__ import annotations

import pytest

from accounts.tests.factories import UserFactory
from agent import tools
from interactions.models import Interaction
from tasks.models import Task
from zones.models import Zone


@pytest.fixture
def owner(db):
    return UserFactory(email="agent-zone-owner@example.com")


@pytest.fixture
def bathroom(household, owner):
    return Zone.objects.create(household=household, name="Salle de bain", created_by=owner)


@pytest.fixture
def bedroom(household, owner):
    return Zone.objects.create(household=household, name="Chambre", created_by=owner)


def _create(household, user, entity_type, fields, *, anchor=None):
    return tools.dispatch(
        "create_entity",
        {"entity_type": entity_type, "fields": fields},
        household=household,
        user=user,
        context_entity=anchor,
    )


def _zones_of(obj) -> set[str]:
    """Les ids de zone attachés, lus par le M2M (through ``InteractionZone``)."""
    return {str(z.id) for z in obj.zones.all()}


class TestANoteLandsInTheNamedZone:
    def test_zone_by_name(self, household, owner, bathroom):
        result = _create(
            household,
            owner,
            "note",
            {"subject": "Fuite sous le lavabo", "zone": "Salle de bain"},
        )
        note = Interaction.objects.get(subject="Fuite sous le lavabo")
        assert _zones_of(note) == {str(bathroom.id)}
        assert "could not create" not in result.rendered

    def test_zone_by_name_is_case_insensitive(self, household, owner, bathroom):
        _create(household, owner, "note", {"subject": "Joint à refaire", "zone": "salle de bain"})
        note = Interaction.objects.get(subject="Joint à refaire")
        assert _zones_of(note) == {str(bathroom.id)}

    def test_zone_by_id(self, household, owner, bedroom):
        _create(
            household,
            owner,
            "note",
            {"subject": "Repeindre le plafond", "zone": str(bedroom.id)},
        )
        note = Interaction.objects.get(subject="Repeindre le plafond")
        assert _zones_of(note) == {str(bedroom.id)}

    def test_zone_ids_list_is_accepted(self, household, owner, bathroom, bedroom):
        _create(
            household,
            owner,
            "note",
            {
                "subject": "Volets à huiler",
                "zone_ids": [str(bathroom.id), str(bedroom.id)],
            },
        )
        note = Interaction.objects.get(subject="Volets à huiler")
        assert _zones_of(note) == {str(bathroom.id), str(bedroom.id)}

    def test_the_users_own_phrasing_resolves(self, household, owner, bathroom):
        """Le modèle recopie souvent les mots de l'utilisateur, article compris."""
        _create(
            household,
            owner,
            "note",
            {"subject": "Silicone à refaire", "zone": "dans la salle de bain"},
        )
        note = Interaction.objects.get(subject="Silicone à refaire")
        assert _zones_of(note) == {str(bathroom.id)}

    def test_the_most_precise_name_that_fits_the_phrase_wins(
        self, household, owner, bathroom
    ):
        Zone.objects.create(household=household, name="Salle", created_by=owner)
        _create(
            household,
            owner,
            "note",
            {"subject": "Miroir piqué", "zone": "dans la salle de bain"},
        )
        note = Interaction.objects.get(subject="Miroir piqué")
        assert _zones_of(note) == {str(bathroom.id)}

    def test_no_zone_stays_zone_less(self, household, owner, bathroom):
        """Une note sans zone reste sans zone — pas de repli inventé."""
        _create(household, owner, "note", {"subject": "Idée de vacances"})
        note = Interaction.objects.get(subject="Idée de vacances")
        assert _zones_of(note) == set()


class TestAnUnresolvableZoneIsSaidNotSwallowed:
    def test_unknown_zone_creates_nothing(self, household, owner, bathroom):
        result = _create(
            household, owner, "note", {"subject": "Fuite", "zone": "Cave à vin"}
        )
        assert "Cave à vin" in result.rendered
        assert not Interaction.objects.filter(subject="Fuite").exists()

    def test_ambiguous_zone_creates_nothing(self, household, owner):
        Zone.objects.create(household=household, name="Chambre parentale", created_by=owner)
        Zone.objects.create(household=household, name="Chambre enfant", created_by=owner)
        result = _create(
            household, owner, "note", {"subject": "Fuite", "zone": "Chambre"}
        )
        assert "Chambre parentale" in result.rendered and "Chambre enfant" in result.rendered
        assert not Interaction.objects.filter(subject="Fuite").exists()

    def test_a_zone_of_another_household_is_not_resolvable(
        self, household, other_household, owner
    ):
        foreign = Zone.objects.create(
            household=other_household, name="Garage du voisin", created_by=owner
        )
        result = _create(
            household, owner, "note", {"subject": "Fuite", "zone": str(foreign.id)}
        )
        assert "could not create" in result.rendered
        assert not Interaction.objects.filter(subject="Fuite").exists()


class TestTheAnchorIsADefaultNotAnOverride:
    def test_anchored_zone_still_applies_without_an_explicit_zone(
        self, household, owner, bedroom
    ):
        _create(
            household,
            owner,
            "note",
            {"subject": "Prise cassée"},
            anchor=("zone", str(bedroom.id)),
        )
        note = Interaction.objects.get(subject="Prise cassée")
        assert _zones_of(note) == {str(bedroom.id)}

    def test_an_explicit_zone_wins_over_the_anchor(
        self, household, owner, bedroom, bathroom
    ):
        _create(
            household,
            owner,
            "note",
            {"subject": "Miroir à fixer", "zone": "Salle de bain"},
            anchor=("zone", str(bedroom.id)),
        )
        note = Interaction.objects.get(subject="Miroir à fixer")
        assert _zones_of(note) == {str(bathroom.id)}


class TestATaskLandsInTheNamedZone:
    """Même trou sur les tâches, masqué par le repli sur la zone racine."""

    def test_zone_by_name(self, household, owner, bathroom):
        # La salle de bain est *sous* la racine : sans ça le repli du service
        # (première zone sans parent) pourrait tomber sur elle et rendre le test
        # vert alors que la zone demandée n'a pas été lue.
        root = Zone.objects.create(household=household, name="Maison", created_by=owner)
        bathroom.parent = root
        bathroom.save(update_fields=["parent"])

        _create(
            household,
            owner,
            "task",
            {"subject": "Détartrer la douche", "zone": "Salle de bain"},
        )
        task = Task.objects.get(subject="Détartrer la douche")
        assert _zones_of(task) == {str(bathroom.id)}

    def test_unknown_zone_creates_nothing(self, household, owner, bathroom):
        result = _create(
            household, owner, "task", {"subject": "Ranger", "zone": "Cave à vin"}
        )
        assert "Cave à vin" in result.rendered
        assert not Task.objects.filter(subject="Ranger").exists()
