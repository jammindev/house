"""Sérialiseurs des jeux du foyer (parcours 31, lot 2).

Deux vues d'une même chasse, et la différence est **du métier** :

- ``HuntSerializer`` sert la **composition** — le parent voit tout, trésor
  compris, puisque c'est lui qui l'écrit ;
- ``HuntPlaySerializer`` sert la **partie** — il masque le trésor tant que la
  chasse n'est pas terminée, et ne montre que l'étape courante.

Une seule fuite du trésor gâche la partie, et elle est irrattrapable : le texte
ne peut pas être « désrévélé ». C'est la raison d'être des deux sérialiseurs.
"""
from rest_framework import serializers

from core.serializers import HouseholdScopedPrimaryKeyRelatedField as ScopedFK
from zones.models import Zone

from .models import Hunt, HuntStep
from .riddles import AGE_BANDS, DEFAULT_AGE, MAX_ZONES
from .services import current_step


class HuntStepSerializer(serializers.ModelSerializer):
    zone_name = serializers.CharField(source='zone.name', read_only=True)

    class Meta:
        model = HuntStep
        fields = ['id', 'position', 'zone', 'zone_name', 'riddle', 'found_at']
        # `position` est **déduit de l'ordre du tableau**, jamais envoyé par le
        # client : deux étapes au même rang rendraient l'ordre de la chasse
        # dépendant du plan d'exécution PostgreSQL, et « l'étape suivante »
        # cesserait d'avoir un sens. Même raison que `Zone.position`.
        read_only_fields = ['id', 'position', 'found_at']


class HuntSerializer(serializers.ModelSerializer):
    """Vue de composition — le parent voit tout ce qu'il a écrit."""

    steps = HuntStepSerializer(many=True, required=False)
    step_count = serializers.SerializerMethodField()
    found_count = serializers.SerializerMethodField()

    class Meta:
        model = Hunt
        fields = [
            'id', 'name', 'status', 'treasure_text', 'steps',
            'step_count', 'found_count', 'started_at', 'finished_at',
            'created_at', 'updated_at', 'created_by',
        ]
        read_only_fields = [
            'id', 'status', 'started_at', 'finished_at',
            'created_at', 'updated_at', 'created_by',
        ]

    def get_step_count(self, obj) -> int:
        return obj.steps.count()

    def get_found_count(self, obj) -> int:
        return obj.steps.filter(found_at__isnull=False).count()

    def validate_steps(self, value):
        if not value:
            return value
        household = self.context['request'].household
        for entry in value:
            zone = entry.get('zone')
            # Le scope foyer se vérifie **ici** : sans ça, un client composerait
            # une chasse traversant les pièces d'un autre foyer, et le scan y
            # répondrait 403 sans qu'on comprenne pourquoi.
            if zone is not None and zone.household_id != household.id:
                raise serializers.ValidationError(
                    "Every step must point at a room of this household."
                )
        return value

    def create(self, validated_data):
        steps = validated_data.pop('steps', [])
        hunt = Hunt.objects.create(**validated_data)
        self._write_steps(hunt, steps)
        return hunt

    def update(self, instance, validated_data):
        steps = validated_data.pop('steps', None)
        for field, value in validated_data.items():
            setattr(instance, field, value)
        instance.save()
        if steps is not None:
            # Remplacement complet : l'éditeur de composition possède ses étapes.
            instance.steps.all().delete()
            self._write_steps(instance, steps)
        return instance

    @staticmethod
    def _write_steps(hunt, steps):
        for position, entry in enumerate(steps):
            HuntStep.objects.create(
                household=hunt.household,
                hunt=hunt,
                position=position,
                zone=entry['zone'],
                riddle=entry.get('riddle', ''),
            )


class HuntPlaySerializer(serializers.ModelSerializer):
    """Vue de partie — ce que le téléphone qui circule a le droit de savoir."""

    current_step = serializers.SerializerMethodField()
    step_count = serializers.SerializerMethodField()
    found_count = serializers.SerializerMethodField()
    treasure_text = serializers.SerializerMethodField()

    class Meta:
        model = Hunt
        fields = [
            'id', 'name', 'status', 'current_step', 'step_count',
            'found_count', 'treasure_text', 'started_at', 'finished_at',
        ]

    def get_current_step(self, obj):
        step = current_step(obj)
        if step is None:
            return None
        # L'énigme et le rang, **jamais la zone** : la réponse est précisément ce
        # que les joueurs doivent trouver en se déplaçant.
        return {
            'id': str(step.id),
            'position': step.position,
            'riddle': step.riddle,
        }

    def get_step_count(self, obj) -> int:
        return obj.steps.count()

    def get_found_count(self, obj) -> int:
        return obj.steps.filter(found_at__isnull=False).count()

    def get_treasure_text(self, obj) -> str | None:
        """Le trésor n'existe qu'une fois la chasse terminée."""
        if obj.status != Hunt.Status.DONE:
            return None
        return obj.treasure_text


class RiddleRequestSerializer(serializers.Serializer):
    """Ce que le composeur envoie pour demander des énigmes.

    Il envoie **son brouillon**, pas un identifiant de chasse : le geste a lieu
    pendant la composition, souvent sur une chasse qui n'existe pas encore en
    base. C'est aussi ce qui garantit le critère du lot — la génération ne peut
    rien écrire, puisqu'elle ne sait même pas où écrire.
    """

    # `ScopedFK` et non `PrimaryKeyRelatedField` : le champ **refuse** une pièce
    # hors du foyer au lieu de s'en remettre à une validation écrite à côté.
    # Sans lui, un client ferait écrire des énigmes sur les pièces du voisin — et
    # en apprendrait les noms au passage, puisque le nom est ce qu'on envoie au
    # modèle. Tenu par `core/tests/test_write_isolation.py`.
    zones = ScopedFK(model=Zone, many=True, allow_empty=False)
    age = serializers.ChoiceField(
        choices=sorted(AGE_BANDS), required=False, default=DEFAULT_AGE
    )

    def validate_zones(self, value):
        if len(value) > MAX_ZONES:
            raise serializers.ValidationError(
                f"A hunt cannot exceed {MAX_ZONES} rooms."
            )
        return value
