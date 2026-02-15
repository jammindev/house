from django.db import models


class TodoItem(models.Model):
    title = models.TextField()
    urgent = models.BooleanField(default=False)
    description = models.TextField(blank=True, null=True)
    done = models.BooleanField(default=False)
    done_at = models.DateTimeField(blank=True, null=True)
    owner = models.ForeignKey(
        "accounts.User",
        on_delete=models.CASCADE,
        related_name="todo_items",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "todo_list"
        ordering = ["-urgent", "-created_at"]

    def __str__(self):
        return self.title
