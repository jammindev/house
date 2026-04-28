# households/signals.py
from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver


@receiver(post_save, sender='households.Household')
def create_root_zone_for_household(sender, instance, created, **kwargs):
    """Each household has exactly one root zone (parent=None) named 'Maison'."""
    if not created:
        return
    from zones.models import Zone
    if not Zone.objects.filter(household=instance, parent__isnull=True).exists():
        Zone.objects.create(household=instance, name='Maison')


@receiver(post_save, sender='households.HouseholdMember')
def set_active_household_on_join(sender, instance, created, **kwargs):
    """When a user joins a household for the first time, auto-set it as active."""
    if not created:
        return
    user = instance.user
    if user.active_household_id is None:
        user.active_household_id = instance.household_id
        user.save(update_fields=['active_household_id'])


@receiver(post_delete, sender='households.HouseholdMember')
def clear_active_household_on_leave(sender, instance, **kwargs):
    """When a user leaves their active household, pick another or clear it."""
    user = instance.user
    if str(user.active_household_id) != str(instance.household_id):
        return
    # Pick another membership if available
    other = (
        instance.user.householdmember_set
        .exclude(household_id=instance.household_id)
        .values_list('household_id', flat=True)
        .first()
    )
    user.active_household_id = other
    user.save(update_fields=['active_household_id'])
