"""Changelog / « Nouveautés » — journal des changements livrés en prod.

Contrairement à la plupart des modèles du projet, ``ChangelogEntry`` n'est **pas**
household-scoped : c'est de l'infra applicative (le même changelog pour tous les
foyers). Les entrées sont dérivées automatiquement du ``git log`` (commits
conventionnels ``type(scope): description``) par la command ``generate_changelog``.
"""
from django.db import models


class ChangelogEntry(models.Model):
    """Un changement user-facing livré en prod, dérivé d'un commit sur ``main``.

    Une entrée = un commit dont le type est retenu (``feat`` / ``fix`` / ``perf``).
    ``summary`` est une phrase FR lisible (repolie par Claude à la génération) ;
    ``raw_subject`` garde le sujet de commit original pour la traçabilité.
    """

    class ChangeType(models.TextChoices):
        FEAT = "feat", "Nouveauté"
        FIX = "fix", "Correction"
        PERF = "perf", "Performance"

    commit_sha = models.CharField(max_length=40, unique=True, db_index=True)
    pr_number = models.PositiveIntegerField(null=True, blank=True)
    module = models.CharField(
        max_length=50,
        db_index=True,
        help_text="Scope du commit conventionnel (ex: 'projects'), ou 'general'.",
    )
    change_type = models.CharField(max_length=20, choices=ChangeType.choices)
    summary = models.TextField(help_text="Phrase FR lisible, repolie par l'IA.")
    raw_subject = models.TextField(help_text="Sujet du commit d'origine.")
    committed_at = models.DateTimeField(db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-committed_at"]
        verbose_name = "Entrée de changelog"
        verbose_name_plural = "Entrées de changelog"

    def __str__(self) -> str:
        return f"{self.change_type}({self.module}): {self.raw_subject[:60]}"


class ChangelogState(models.Model):
    """Singleton : état de la dernière génération — ce qui est réellement live.

    Permet de répondre honnêtement à « où en est la prod ? » même quand le dernier
    déploiement ne contenait aucun changement user-facing (donc aucune
    ``ChangelogEntry`` créée) : ``head_sha`` / ``head_committed_at`` reflètent le
    tip de ``main`` au moment de la génération, pas la dernière entrée retenue.
    """

    head_sha = models.CharField(max_length=40)
    head_committed_at = models.DateTimeField()
    generated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "État du changelog"
        verbose_name_plural = "État du changelog"

    def save(self, *args, **kwargs):
        self.pk = 1  # singleton
        super().save(*args, **kwargs)

    @classmethod
    def load(cls) -> "ChangelogState | None":
        return cls.objects.filter(pk=1).first()

    def __str__(self) -> str:
        return f"HEAD {self.head_sha[:7]} @ {self.generated_at:%Y-%m-%d %H:%M}"
