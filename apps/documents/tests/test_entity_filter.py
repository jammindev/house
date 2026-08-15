# documents/tests/test_entity_filter.py
"""
Le filtre par entité de l'API documents — et le défaut qu'il a produit.

`?tree=<id>` était **ignoré en silence** parce que la liste des paramètres
acceptés était écrite en dur (`zone, project, equipment, task, chicken`). Un
filtre ignoré ne rend pas moins de documents : il les rend **tous**. L'onglet
Documents du verger affichait donc la photothèque entière du foyer le jour de sa
livraison, sans qu'aucun test ne rougisse.

Le garde-fou du bas est celui qui compte : il est **dérivé du registre**, donc il
rougira pour le prochain module searchable, pas seulement pour le verger.
"""
from __future__ import annotations

import pytest
from django.contrib.contenttypes.models import ContentType
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from agent import searchables
from documents.models import Document, DocumentLink
from households.models import Household, HouseholdMember
from orchard.models import Tree
from zones.models import Zone

from accounts.models import User


def _setup():
    household = Household.objects.create(name="Le mas")
    user = User.objects.create_user(email="doc-filter@example.com", password="pass1234")
    HouseholdMember.objects.create(
        household=household, user=user, role=HouseholdMember.Role.OWNER
    )
    user.active_household = household
    user.save(update_fields=["active_household"])
    zone = Zone.objects.create(household=household, name="Verger", created_by=user)
    return household, user, zone


def _document(household, user, name):
    return Document.objects.create(
        household=household, created_by=user, name=name, file_path=f"docs/{name}"
    )


def _link(document, instance):
    DocumentLink.objects.create(
        document=document,
        content_type=ContentType.objects.get_for_model(type(instance)),
        object_id=instance.id,
    )


def _client(user):
    client = APIClient()
    client.force_authenticate(user=user)
    return client


@pytest.mark.django_db
class TestAnEntityFilterNeverReturnsEverything:
    """Le défaut signalé : « dans les documents, et photos je les vois toutes »."""

    def test_a_subject_only_shows_its_own_documents(self):
        household, user, zone = _setup()
        tree = Tree.objects.create(
            household=household, created_by=user, name="Le gros pommier", zone=zone
        )
        mine = _document(household, user, "facture-pommier.pdf")
        _link(mine, tree)
        _document(household, user, "assurance-maison.pdf")  # lié à rien

        response = _client(user).get(reverse("document-list"), {"tree": str(tree.id)})

        assert response.status_code == status.HTTP_200_OK
        names = [d["name"] for d in response.data]
        assert names == ["facture-pommier.pdf"]

    def test_the_generic_linked_to_form_agrees_with_the_short_one(self):
        household, user, zone = _setup()
        tree = Tree.objects.create(
            household=household, created_by=user, name="Prunier", zone=zone
        )
        mine = _document(household, user, "taille.pdf")
        _link(mine, tree)
        _document(household, user, "autre.pdf")

        client = _client(user)
        short = client.get(reverse("document-list"), {"tree": str(tree.id)})
        generic = client.get(
            reverse("document-list"), {"linked_to": f"tree:{tree.id}"}
        )
        assert [d["id"] for d in short.data] == [d["id"] for d in generic.data]

    def test_documents_of_another_subject_are_excluded(self):
        household, user, zone = _setup()
        apple = Tree.objects.create(
            household=household, created_by=user, name="Pommier", zone=zone
        )
        plum = Tree.objects.create(
            household=household, created_by=user, name="Prunier", zone=zone
        )
        doc = _document(household, user, "chez-le-prunier.pdf")
        _link(doc, plum)

        response = _client(user).get(reverse("document-list"), {"tree": str(apple.id)})
        assert response.data == []


@pytest.mark.django_db
class TestAnUnresolvableFilterRefuses:
    """Sur-partager en silence est pire que refuser."""

    def test_an_unknown_entity_type_is_a_400_not_all_documents(self):
        household, user, zone = _setup()
        _document(household, user, "prive.pdf")

        response = _client(user).get(
            reverse("document-list"), {"linked_to": "licorne:00000000-0000-0000-0000-000000000000"}
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_a_malformed_linked_to_is_a_400(self):
        household, user, zone = _setup()
        _document(household, user, "prive.pdf")

        response = _client(user).get(reverse("document-list"), {"linked_to": "tree"})
        assert response.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.django_db
class TestTheFilterCoversTheRegistry:
    """Le garde-fou : il vaut pour le **prochain** module, pas seulement le verger.

    `linked_to` est la forme sur laquelle toute nouvelle entité doit passer — les
    raccourcis (`?zone=`…) sont une liste close, parce que `?interaction=` est
    déjà pris par la FK `Document.interaction` et qu'un paramètre ne peut pas
    porter deux sens. Ce test vérifie donc que **tout type enregistré filtre
    vraiment** par cette forme-là : un type qui passerait à travers renverrait
    tous les documents du foyer, ce qui est exactement le défaut d'origine.
    """

    def test_every_searchable_type_really_filters_through_its_shortcut(self):
        """Un type enregistré dont le raccourci serait ignoré rendrait TOUT."""
        from documents.views import _PARAMS_RESERVED_BY_ANOTHER_FILTER

        household, user, zone = _setup()
        _document(household, user, "sans-lien.pdf")
        client = _client(user)
        blank_uuid = "00000000-0000-0000-0000-000000000000"

        for spec in searchables.REGISTRY:
            if spec.entity_type in _PARAMS_RESERVED_BY_ANOTHER_FILTER:
                continue
            response = client.get(
                reverse("document-list"), {spec.entity_type: blank_uuid}
            )
            assert response.status_code == status.HTTP_200_OK, spec.entity_type
            assert response.data == [], (
                f"?{spec.entity_type}= a été ignoré — l'API a renvoyé "
                f"{len(response.data)} document(s) au lieu d'aucun"
            )

    def test_every_searchable_type_really_filters_through_linked_to(self):
        household, user, zone = _setup()
        # Un document qui n'est lié à rien : c'est lui qui apparaîtrait si le
        # filtre était ignoré.
        _document(household, user, "sans-lien.pdf")
        client = _client(user)
        blank_uuid = "00000000-0000-0000-0000-000000000000"

        for spec in searchables.REGISTRY:
            response = client.get(
                reverse("document-list"), {"linked_to": f"{spec.entity_type}:{blank_uuid}"}
            )
            assert response.status_code == status.HTTP_200_OK, spec.entity_type
            assert response.data == [], (
                f"linked_to={spec.entity_type}: a été ignoré — l'API a renvoyé "
                f"{len(response.data)} document(s) au lieu d'aucun"
            )
