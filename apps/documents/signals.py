from django.db import models
from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver
from django.core.files.storage import default_storage

from .services import sync_document_link, unsync_document_link
from .thumbnails import delete_thumbnails


@receiver(post_delete, sender='documents.Document')
def delete_document_file(sender, instance, **kwargs):
    """
    Delete the physical file when a Document is deleted — including bulk
    deletions via QuerySet.delete() which bypass model.delete().
    """
    if instance.file_path:
        try:
            if default_storage.exists(instance.file_path):
                default_storage.delete(instance.file_path)
        except OSError:
            pass
        delete_thumbnails(instance.file_path)


# --- Legacy through-table → DocumentLink sync -----------------------------------
# The 5 per-model through tables remain the write model during the phased
# migration; these signals keep the polymorphic DocumentLink read model in sync.
# Mapping: through model → the attribute naming its parent entity FK.
_THROUGH_MODELS = {
    'zones.ZoneDocument': 'zone',
    'interactions.InteractionDocument': 'interaction',
    'projects.ProjectDocument': 'project',
    'equipment.EquipmentDocument': 'equipment',
    'tasks.TaskDocument': 'task',
}


def _connect_through_sync():
    from django.apps import apps as django_apps

    for label, parent_attr in _THROUGH_MODELS.items():
        app_label, model_name = label.split('.')
        model = django_apps.get_model(app_label, model_name)

        def _on_save(sender, instance, _attr=parent_attr, **kwargs):
            sync_document_link(instance, _attr)

        def _on_delete(sender, instance, _attr=parent_attr, **kwargs):
            unsync_document_link(instance, _attr)

        post_save.connect(_on_save, sender=model, weak=False,
                          dispatch_uid=f'doclink_sync_save_{label}')
        post_delete.connect(_on_delete, sender=model, weak=False,
                            dispatch_uid=f'doclink_sync_delete_{label}')


_connect_through_sync()
