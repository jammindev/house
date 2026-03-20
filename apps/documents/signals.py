from django.db import models
from django.db.models.signals import post_delete
from django.dispatch import receiver
from django.core.files.storage import default_storage


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
