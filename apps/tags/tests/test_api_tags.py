import pytest
from django.contrib.contenttypes.models import ContentType
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from accounts.tests.factories import UserFactory
from households.models import Household, HouseholdMember
from interactions.models import Interaction
from tags.models import Tag, TagLink
from zones.models import Zone


def _client_for(user) -> APIClient:
    client = APIClient()
    client.force_authenticate(user=user)
    return client


def _household(name: str) -> Household:
    return Household.objects.create(name=name)


def _membership(user, household, role=HouseholdMember.Role.OWNER):
    return HouseholdMember.objects.create(user=user, household=household, role=role)


def _zone(household, user, name: str) -> Zone:
    return Zone.objects.create(household=household, name=name, created_by=user)


def _interaction(household, user, zone, subject="Tagged interaction") -> Interaction:
    interaction = Interaction.objects.create(
        household=household,
        created_by=user,
        subject=subject,
        type="note",
        occurred_at="2026-03-07T10:00:00Z",
    )
    interaction.zones.add(zone)
    return interaction


@pytest.fixture
def owner(db):
    return UserFactory(email="tags-owner@example.com")


@pytest.fixture
def household(db, owner):
    instance = _household("Tags House")
    _membership(owner, instance)
    owner.active_household = instance
    owner.save(update_fields=["active_household"])
    return instance


@pytest.fixture
def owner_client(owner):
    return _client_for(owner)


@pytest.mark.django_db
class TestTagsApi:
    def test_create_tag_uses_selected_household(self, owner_client, household):
        url = reverse("tag-list")
        response = owner_client.post(
            url,
            {"name": "urgent", "type": Tag.TagType.INTERACTION},
            format="json",
            HTTP_X_HOUSEHOLD_ID=str(household.id),
        )

        assert response.status_code == status.HTTP_201_CREATED
        created = Tag.objects.get(id=response.data["id"])
        assert created.household == household

    def test_list_tags_is_household_scoped(self, owner_client, owner, household):
        visible = Tag.objects.create(household=household, created_by=owner, name="visible", type=Tag.TagType.INTERACTION)
        other_household = _household("Hidden Tags House")
        _membership(owner, other_household)
        Tag.objects.create(household=other_household, created_by=owner, name="hidden", type=Tag.TagType.INTERACTION)

        url = reverse("tag-list")
        response = owner_client.get(url, HTTP_X_HOUSEHOLD_ID=str(household.id))

        assert response.status_code == status.HTTP_200_OK
        assert [item["name"] for item in response.data] == [visible.name]

    def test_list_tags_can_filter_by_type_and_search(self, owner_client, owner, household):
        Tag.objects.create(household=household, created_by=owner, name="urgent", type=Tag.TagType.INTERACTION)
        Tag.objects.create(household=household, created_by=owner, name="warranty", type=Tag.TagType.DOCUMENT)
        Tag.objects.create(household=household, created_by=owner, name="roof leak", type=Tag.TagType.INTERACTION)

        url = reverse("tag-list")
        response = owner_client.get(
            url,
            {"type": Tag.TagType.INTERACTION, "search": "roof"},
            HTTP_X_HOUSEHOLD_ID=str(household.id),
        )

        assert response.status_code == status.HTTP_200_OK
        assert [item["name"] for item in response.data] == ["roof leak"]


@pytest.mark.django_db
class TestTagLinksApi:
    def test_create_tag_link_for_owned_interaction(self, owner_client, owner, household):
        zone = _zone(household, owner, "Kitchen")
        interaction = _interaction(household, owner, zone)
        tag = Tag.objects.create(household=household, created_by=owner, name="repair", type=Tag.TagType.INTERACTION)

        url = reverse("tag-link-list")
        response = owner_client.post(
            url,
            {
                "tag": str(tag.id),
                "content_type": ContentType.objects.get_for_model(Interaction).id,
                "object_id": str(interaction.id),
            },
            format="json",
            HTTP_X_HOUSEHOLD_ID=str(household.id),
        )

        assert response.status_code == status.HTTP_201_CREATED
        assert TagLink.objects.filter(household=household, tag=tag, object_id=str(interaction.id)).exists()

    def test_filter_tag_links_by_content_type_and_object_id(self, owner_client, owner, household):
        zone = _zone(household, owner, "Garage")
        interaction = _interaction(household, owner, zone, subject="Filter me")
        tag = Tag.objects.create(household=household, created_by=owner, name="maintenance", type=Tag.TagType.INTERACTION)
        link = TagLink.objects.create(
            household=household,
            created_by=owner,
            tag=tag,
            content_type=ContentType.objects.get_for_model(Interaction),
            object_id=str(interaction.id),
        )

        url = reverse("tag-link-list")
        response = owner_client.get(
            url,
            {"content_type": link.content_type_id, "object_id": str(interaction.id)},
            HTTP_X_HOUSEHOLD_ID=str(household.id),
        )

        assert response.status_code == status.HTTP_200_OK
        assert [item["id"] for item in response.data] == [str(link.id)]

    def test_reject_tag_link_when_tag_household_differs(self, owner_client, owner, household):
        zone = _zone(household, owner, "Hall")
        interaction = _interaction(household, owner, zone)
        other_household = _household("Other Tag House")
        _membership(owner, other_household)
        foreign_tag = Tag.objects.create(household=other_household, created_by=owner, name="foreign", type=Tag.TagType.INTERACTION)

        url = reverse("tag-link-list")
        response = owner_client.post(
            url,
            {
                "tag": str(foreign_tag.id),
                "content_type": ContentType.objects.get_for_model(Interaction).id,
                "object_id": str(interaction.id),
            },
            format="json",
            HTTP_X_HOUSEHOLD_ID=str(household.id),
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "tag" in response.data

    def test_reject_tag_link_when_object_household_differs(self, owner_client, owner, household):
        tag = Tag.objects.create(household=household, created_by=owner, name="urgent", type=Tag.TagType.INTERACTION)
        other_household = _household("Other Object House")
        _membership(owner, other_household)
        foreign_zone = _zone(other_household, owner, "Attic")
        foreign_interaction = _interaction(other_household, owner, foreign_zone, subject="Foreign")

        url = reverse("tag-link-list")
        response = owner_client.post(
            url,
            {
                "tag": str(tag.id),
                "content_type": ContentType.objects.get_for_model(Interaction).id,
                "object_id": str(foreign_interaction.id),
            },
            format="json",
            HTTP_X_HOUSEHOLD_ID=str(household.id),
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "object_id" in response.data

    def test_update_tag_link_revalidates_target_object(self, owner_client, owner, household):
        zone = _zone(household, owner, "Office")
        interaction = _interaction(household, owner, zone, subject="Owned")
        tag = Tag.objects.create(household=household, created_by=owner, name="todo", type=Tag.TagType.INTERACTION)
        link = TagLink.objects.create(
            household=household,
            created_by=owner,
            tag=tag,
            content_type=ContentType.objects.get_for_model(Interaction),
            object_id=str(interaction.id),
        )

        other_household = _household("Update Foreign House")
        _membership(owner, other_household)
        foreign_zone = _zone(other_household, owner, "Foreign room")
        foreign_interaction = _interaction(other_household, owner, foreign_zone, subject="Foreign")

        url = reverse("tag-link-detail", kwargs={"pk": link.id})
        response = owner_client.patch(
            url,
            {"object_id": str(foreign_interaction.id)},
            format="json",
            HTTP_X_HOUSEHOLD_ID=str(household.id),
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "object_id" in response.data