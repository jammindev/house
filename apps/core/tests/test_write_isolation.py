"""Isolation en écriture — aucune FK de serializer n'accepte un objet étranger.

Pendant de ``test_tenant_isolation.py``, qui ne parcourt que les **lectures**.

La différence de nature entre les deux compte : une lecture mal bornée se voit
— la liste montre ce qu'elle ne devrait pas. Une écriture mal bornée **ne se
voit pas** : elle réussit, l'utilisateur lit « enregistré », et l'objet d'un
autre foyer entre dans le graphe sans un mot.

Ce que ce fichier ne prétend pas être
-------------------------------------

Il ne ferme pas une faille. Au moment où il a été écrit, les cinq champs
relationnels non bornés du dépôt étaient **tous** rattrapés en aval — mais par
trois mécanismes différents, écrits indépendamment (un ``validate()``, un
``validate_<champ>``, un ``perform_create``). Chacun juste, aucun garanti.

Le test remplace « ça marche parce que quelqu'un y a pensé à chaque fois » par
« ça ne peut pas ne pas marcher ». C'est la même bascule que
``banking.compliance.REGISTRY`` pour l'argent, et que ``keys.test.ts`` pour l'i18n.
"""
import pytest
from django.apps import apps as django_apps
from rest_framework import serializers

from accounts.tests.factories import UserFactory
from core.models import HouseholdScopedModel
from core.serializers import HouseholdScopedPrimaryKeyRelatedField
from households.models import Household, HouseholdMember

# ── Exemptions ───────────────────────────────────────────────────────────────
#
# Même règle qu'en lecture : une exemption est une dette nommée, avec sa raison
# et ce qui protège à la place.

EXEMPT_FIELDS: set[tuple[str, str]] = {
    # (nom du serializer, nom du champ)
}


def _all_serializer_classes():
    """Tous les serializers déclarés dans les apps du projet.

    On importe les modules `serializers` de chaque app installée plutôt que de
    parcourir les vues : un serializer utilisé par un service métier (donc sans
    passer par une URL) doit être couvert aussi — c'est justement le cas de
    ``TrackerEntrySerializer``, instancié par ``trackers.services.add_entry``.
    """
    import importlib
    import inspect

    found = {}
    for config in django_apps.get_app_configs():
        module_name = f"{config.name}.serializers"
        try:
            module = importlib.import_module(module_name)
        except ModuleNotFoundError:
            continue
        for name, obj in inspect.getmembers(module, inspect.isclass):
            if not issubclass(obj, serializers.BaseSerializer):
                continue
            if obj.__module__ != module_name:
                continue  # importé d'ailleurs, il sera vu chez lui
            found[f"{module_name}.{name}"] = obj
    return found


def _relational_fields(serializer_class):
    """Les champs relationnels *déclarés* et leur queryset, sans instancier.

    On lit ``_declared_fields`` : instancier un ``ModelSerializer`` construit
    ses champs implicites, qui sont générés par DRF depuis le modèle et portent
    déjà la contrainte de la FK. Ce sont les champs **écrits à la main** qui
    posent un queryset explicite, et donc qui peuvent l'élargir.
    """
    # `_declared_fields` est posé par `SerializerMetaclass` : une classe qui
    # hérite directement de `BaseSerializer` ne l'a pas, et n'a pas de champ
    # déclaratif à vérifier.
    for name, field in getattr(serializer_class, "_declared_fields", {}).items():
        if isinstance(field, serializers.ManyRelatedField):
            field = field.child_relation
        if not isinstance(field, serializers.RelatedField):
            continue
        if field.read_only:
            continue
        yield name, field


@pytest.fixture
def two_households(db):
    household_a = Household.objects.create(name="Foyer A")
    household_b = Household.objects.create(name="Foyer B")
    alice = UserFactory()
    bob = UserFactory()
    HouseholdMember.objects.create(
        household=household_a, user=alice, role=HouseholdMember.Role.OWNER
    )
    HouseholdMember.objects.create(
        household=household_b, user=bob, role=HouseholdMember.Role.OWNER
    )
    return household_a, household_b, alice, bob


class TestNoWritableForeignKeyAcceptsAForeignObject:
    """Le contrôle central : aucune FK écrite à la main n'est ouverte."""

    def test_the_serializers_are_actually_discovered(self):
        """Garde-fou du garde-fou — même raison qu'en lecture.

        Si la découverte casse, le test principal passe en ne vérifiant rien,
        et un contrôle muet ressemble exactement à une absence d'écart.
        """
        found = _all_serializer_classes()
        assert len(found) > 40, (
            f"Seulement {len(found)} serializers découverts — la découverte est "
            "probablement cassée, pas le dépôt subitement plus petit."
        )

    def test_every_writable_relation_to_a_household_model_is_scoped(self):
        unscoped = []
        for label, serializer_class in _all_serializer_classes().items():
            for name, field in _relational_fields(serializer_class):
                if (serializer_class.__name__, name) in EXEMPT_FIELDS:
                    continue

                queryset = getattr(field, "queryset", None)
                if queryset is None:
                    continue
                model = queryset.model
                if not issubclass(model, HouseholdScopedModel):
                    continue

                if not isinstance(field, HouseholdScopedPrimaryKeyRelatedField):
                    unscoped.append(f"{label}.{name}  →  {model._meta.label}")

        assert not unscoped, (
            "Ces champs de serializer acceptent l'identifiant de n'importe quel "
            "foyer :\n  "
            + "\n  ".join(unscoped)
            + "\n\nUtiliser `core.serializers.HouseholdScopedPrimaryKeyRelatedField"
            "(model=…)`, ou ajouter une exemption **justifiée** dans EXEMPT_FIELDS."
        )


@pytest.mark.django_db
class TestTheScopedFieldRefusesWhatItCannotSee:
    """Le comportement du champ lui-même, dans les quatre cas de contexte."""

    def _field(self, context):
        from tasks.models import Task

        field = HouseholdScopedPrimaryKeyRelatedField(model=Task)
        field._context = context
        return field

    def _task(self, household, user):
        from tasks.models import Task

        return Task.objects.create(
            household=household, subject="Tondre la pelouse", created_by=user
        )

    def test_an_explicit_household_id_wins(self, two_households):
        household_a, household_b, alice, _bob = two_households
        task_a = self._task(household_a, alice)

        assert self._field({"household_id": household_a.id}).get_queryset().filter(
            pk=task_a.pk
        ).exists()
        assert not self._field({"household_id": household_b.id}).get_queryset().filter(
            pk=task_a.pk
        ).exists()

    def test_the_request_household_is_used_when_there_is_no_explicit_id(
        self, two_households
    ):
        household_a, household_b, alice, _bob = two_households
        task_a = self._task(household_a, alice)

        class FakeRequest:
            household = household_b
            user = alice

        assert not self._field({"request": FakeRequest()}).get_queryset().filter(
            pk=task_a.pk
        ).exists()

    def test_without_an_active_household_it_falls_back_to_the_users_own(
        self, two_households
    ):
        household_a, _household_b, alice, bob = two_households
        task_a = self._task(household_a, alice)

        class AliceRequest:
            household = None
            user = alice

        class BobRequest:
            household = None
            user = bob

        assert self._field({"request": AliceRequest()}).get_queryset().filter(
            pk=task_a.pk
        ).exists()
        assert not self._field({"request": BobRequest()}).get_queryset().filter(
            pk=task_a.pk
        ).exists()

    def test_without_any_usable_context_it_accepts_nothing(self, two_households):
        """Le cas qui compte : sans contexte, on refuse tout.

        Un champ qui laisse passer quand il ne sait pas protège exactement tant
        que personne ne l'attaque. Fermer par défaut rend le défaut bruyant —
        un appelant qui oublie le contexte voit ses écritures refusées tout de
        suite, au lieu de les voir réussir trop largement pendant des mois.
        """
        household_a, _household_b, alice, _bob = two_households
        self._task(household_a, alice)

        assert not self._field({}).get_queryset().exists()


@pytest.mark.django_db
class TestAForeignObjectIsRefusedEndToEnd:
    """La garantie vue de l'API, pas seulement du champ."""

    def test_attaching_another_households_document_to_my_task_fails(
        self, client, two_households
    ):
        from django.core.files.base import ContentFile
        from django.core.files.storage import default_storage

        from documents.models import Document
        from tasks.models import Task

        household_a, household_b, alice, bob = two_households

        # Le document d'Alice, dans le foyer A.
        file_path = Document.build_upload_path(
            household_id=household_a.id, filename="rib.pdf"
        )
        default_storage.save(file_path, ContentFile(b"%PDF-1.4"))
        foreign_document = Document.objects.create(
            household=household_a, created_by=alice, name="RIB", file_path=file_path
        )

        # La tâche de Bob, dans le foyer B.
        own_task = Task.objects.create(
            household=household_b, subject="Ranger le garage", created_by=bob
        )

        client.force_login(bob)
        response = client.post(
            "/api/tasks/task-documents/",
            data={"task": str(own_task.id), "document": foreign_document.id},
            content_type="application/json",
        )

        assert response.status_code == 400, (
            "Rattacher le document d'un autre foyer doit être refusé à la "
            f"validation, pas accepté (reçu {response.status_code})."
        )
        assert "document" in response.json()
