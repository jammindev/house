from rest_framework import serializers


class PushKeysSerializer(serializers.Serializer):
    p256dh = serializers.CharField(max_length=255)
    auth = serializers.CharField(max_length=255)


class SubscribeSerializer(serializers.Serializer):
    """Shape of ``PushSubscription.toJSON()`` from the browser."""

    endpoint = serializers.CharField()
    keys = PushKeysSerializer()


class UnsubscribeSerializer(serializers.Serializer):
    endpoint = serializers.CharField()
