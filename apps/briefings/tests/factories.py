"""Factory-boy factories for briefings app tests."""
import factory
from factory.django import DjangoModelFactory

from briefings.models import Briefing


class BriefingFactory(DjangoModelFactory):
    """Factory for Briefing — household and created_by must be supplied by each test."""

    class Meta:
        model = Briefing
        skip_postgeneration_save = True

    title = factory.Faker("sentence", nb_words=4)
    prompt = factory.Faker("sentence", nb_words=8)
    condition = ""
    channel = Briefing.Channel.TELEGRAM
    briefing_type = Briefing.Type.RECURRING
    is_private = False
    is_active = False
    # household and created_by must be provided by each test
