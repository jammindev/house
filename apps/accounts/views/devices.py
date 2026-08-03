"""Gestion des jetons d'appareil — créer, lister, révoquer.

Trois règles portées par cette vue :

- **Le secret n'est rendu qu'une fois.** La liste ne le contient jamais ; seule la
  création le renvoie. C'est ce qui rend le jeton différent d'un mot de passe.
- **Un utilisateur ne voit que ses propres jetons.** Un jeton est personnel : il
  porte les droits de celui qui l'a émis, pas ceux du foyer.
- **Un jeton d'appareil ne peut pas s'auto-administrer.** Cette vue ne déclare pas
  ``allows_device_token`` : un raccourci volé ne peut donc ni en émettre un autre,
  ni révoquer celui qui le gêne. C'est le refus par défaut de
  ``DeviceTokenScopeMiddleware`` qui l'assure, sans qu'on ait à y penser.
"""
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from accounts.models import DeviceToken
from accounts.serializers import DeviceTokenIssuedSerializer, DeviceTokenSerializer


class DeviceTokenViewSet(
    mixins.ListModelMixin,
    mixins.CreateModelMixin,
    viewsets.GenericViewSet,
):
    """`/api/accounts/devices/`"""

    permission_classes = [IsAuthenticated]
    serializer_class = DeviceTokenSerializer

    def get_queryset(self):
        return DeviceToken.objects.filter(user=self.request.user)

    def create(self, request, *args, **kwargs):
        name = (request.data.get("name") or "").strip()
        if not name:
            return Response(
                {"name": ["This field is required."]},
                status=status.HTTP_400_BAD_REQUEST,
            )

        token, raw = DeviceToken.issue(user=request.user, name=name[:100])
        payload = DeviceTokenIssuedSerializer(token).data
        payload["token"] = raw  # la seule fois où il sort d'ici
        return Response(payload, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"])
    def revoke(self, request, pk=None):
        """Couper l'accès d'un appareil, tout de suite.

        Idempotent : révoquer deux fois n'est pas une erreur. Rendre un 400 sur le
        second appel obligerait l'appelant à connaître un état qu'il vient
        justement de demander à changer.
        """
        token = self.get_queryset().filter(pk=pk).first()
        if token is None:
            return Response(status=status.HTTP_404_NOT_FOUND)
        token.revoke()
        return Response(DeviceTokenSerializer(token).data)
