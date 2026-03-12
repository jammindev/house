import factory
from factory.django import DjangoModelFactory
from tasks.models import Task


class TaskFactory(DjangoModelFactory):
    class Meta:
        model = Task
        skip_postgeneration_save = True

    subject = factory.Faker('sentence', nb_words=4)
    content = factory.Faker('text', max_nb_chars=200)
    status = Task.Status.PENDING
    priority = Task.Priority.NORMAL
    due_date = None
    is_private = False
    assigned_to = None
    completed_by = None
    completed_at = None
    project = None
    source_interaction = None
    # household and created_by must be provided by each test
