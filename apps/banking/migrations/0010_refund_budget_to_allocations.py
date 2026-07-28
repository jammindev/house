"""Replier ``BankTransaction.refund_budget`` en lignes de ventilation.

Un remboursement crédite désormais **plusieurs** enveloppes, avec un montant par
enveloppe. Garder l'ancienne colonne à côté de la nouvelle table donnerait deux
façons de dire la même chose — donc deux totaux qui finiraient par diverger, et
`_refunded_by_budget` devrait choisir laquelle croire. C'est exactement l'écart
« dit deux fois avec deux voix » que le module existe pour supprimer.

La conversion est donc **totale** : chaque ligne qui portait un `refund_budget`
devient une ligne de ventilation du **montant entier** de la recette, ce qui est
précisément ce que l'ancienne colonne signifiait. Aucun total ne change.

L'inverse est reconstructible tant qu'une recette ne crédite qu'une enveloppe ;
au-delà, la colonne ne saurait pas le représenter — d'où un `reverse` qui ne
remonte que le cas unique et laisse tomber ce qu'une seule FK ne peut pas porter.
"""
from django.db import migrations


def forwards(apps, schema_editor):
    BankTransaction = apps.get_model("banking", "BankTransaction")
    RefundAllocation = apps.get_model("banking", "RefundAllocation")

    rows = BankTransaction.objects.filter(refund_budget__isnull=False).select_related(
        "refund_budget"
    )
    RefundAllocation.objects.bulk_create(
        [
            RefundAllocation(
                household_id=txn.household_id,
                transaction=txn,
                budget_id=txn.refund_budget_id,
                # Le montant entier : c'est ce que « cette recette crédite cette
                # enveloppe » voulait dire quand il n'y avait qu'une FK.
                amount=txn.amount,
                created_by_id=txn.created_by_id,
                updated_by_id=txn.updated_by_id,
            )
            for txn in rows
        ]
    )


def backwards(apps, schema_editor):
    BankTransaction = apps.get_model("banking", "BankTransaction")
    RefundAllocation = apps.get_model("banking", "RefundAllocation")

    for allocation in RefundAllocation.objects.all():
        BankTransaction.objects.filter(pk=allocation.transaction_id).update(
            refund_budget_id=allocation.budget_id
        )


class Migration(migrations.Migration):
    dependencies = [
        ("banking", "0009_refundallocation"),
    ]

    operations = [
        migrations.RunPython(forwards, backwards),
        migrations.RemoveConstraint(
            model_name="banktransaction",
            name="bank_txn_refund_budget_only_on_refund",
        ),
        migrations.RemoveField(
            model_name="banktransaction",
            name="refund_budget",
        ),
    ]
