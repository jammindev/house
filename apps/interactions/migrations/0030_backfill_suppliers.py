"""Peupler le catalogue avec les fournisseurs déjà saisis, et unifier leur orthographe.

Sans cette passe, un foyer qui a deux ans de dépenses derrière lui ouvrirait un
select vide : le catalogue ne connaîtrait que ce qui est saisi *après* la
livraison, et la fonctionnalité ne servirait qu'aux nouveaux foyers.

La passe fait deux choses, et la seconde est le vrai gain :

1. elle inscrit chaque `Interaction.supplier` non vide au catalogue ;
2. elle **réécrit** la colonne avec l'orthographe retenue, choisie comme la plus
   fréquente. Les variantes qui ne différaient que par la casse ou les accents
   (« leroy merlin », « LEROY MERLIN ») fusionnent donc sur une seule valeur —
   c'est ce qui fait passer les chips de filtre de trois entrées à une et
   recompose `by_supplier` sur la bonne ligne.

Non destructive : aucune colonne supprimée, aucune valeur perdue autre qu'une
différence de casse. `RecurringExpense.supplier` reçoit le même traitement, sinon
la première occurrence confirmée réintroduirait l'ancienne orthographe.
"""
import unicodedata
from collections import defaultdict

from django.db import migrations


def _normalize(name):
    text = unicodedata.normalize("NFKD", str(name or ""))
    text = "".join(ch for ch in text if not unicodedata.combining(ch))
    return " ".join(text.casefold().split())


def backfill(apps, schema_editor):
    Interaction = apps.get_model("interactions", "Interaction")
    Supplier = apps.get_model("interactions", "Supplier")
    RecurringExpense = apps.get_model("budget", "RecurringExpense")

    # (household, clé normalisée) → {orthographe: nombre d'emplois}. L'orthographe
    # retenue est la plus employée : c'est celle que le foyer reconnaîtra, et la
    # première rencontrée n'aurait été qu'un artefact de l'ordre des lignes.
    spellings = defaultdict(lambda: defaultdict(int))

    rows = Interaction.objects.exclude(supplier="").values_list(
        "household_id", "supplier"
    )
    for household_id, supplier in rows.iterator():
        label = " ".join(str(supplier).split())
        if label:
            spellings[(household_id, _normalize(label))][label] += 1

    recurring_rows = RecurringExpense.objects.exclude(supplier="").values_list(
        "household_id", "supplier"
    )
    for household_id, supplier in recurring_rows.iterator():
        label = " ".join(str(supplier).split())
        if label:
            spellings[(household_id, _normalize(label))][label] += 1

    for (household_id, key), variants in spellings.items():
        canonical = max(variants.items(), key=lambda item: (item[1], item[0]))[0]
        Supplier.objects.create(
            household_id=household_id, name=canonical, normalized_name=key
        )
        for variant in variants:
            if variant == canonical:
                continue
            Interaction.objects.filter(
                household_id=household_id, supplier=variant
            ).update(supplier=canonical)
            RecurringExpense.objects.filter(
                household_id=household_id, supplier=variant
            ).update(supplier=canonical)


def unbackfill(apps, schema_editor):
    """Vider le catalogue.

    L'orthographe unifiée reste : elle est le résultat correct, et rien ne dit
    quelle variante portait quelle ligne avant la fusion. Revenir en arrière rend
    la table vide, pas les fautes de frappe.
    """
    apps.get_model("interactions", "Supplier").objects.all().delete()


class Migration(migrations.Migration):

    dependencies = [
        ("interactions", "0029_supplier"),
        ("budget", "0002_recurringexpense"),
    ]

    operations = [
        migrations.RunPython(backfill, unbackfill),
    ]
