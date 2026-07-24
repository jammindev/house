import base64

from cryptography.hazmat.primitives import serialization
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = "Génère une paire de clés VAPID pour le Web Push (à copier dans le .env)."

    def handle(self, *args, **options):
        from py_vapid import Vapid01

        vapid = Vapid01()
        vapid.generate_keys()

        priv_der = vapid.private_key.private_bytes(
            encoding=serialization.Encoding.DER,
            format=serialization.PrivateFormat.PKCS8,
            encryption_algorithm=serialization.NoEncryption(),
        )
        private_key = base64.urlsafe_b64encode(priv_der).decode().rstrip("=")

        raw_pub = vapid.public_key.public_bytes(
            encoding=serialization.Encoding.X962,
            format=serialization.PublicFormat.UncompressedPoint,
        )
        public_key = base64.urlsafe_b64encode(raw_pub).decode().rstrip("=")

        self.stdout.write("VAPID_PUBLIC_KEY=" + public_key)
        self.stdout.write("VAPID_PRIVATE_KEY=" + private_key)
        self.stdout.write(
            self.style.WARNING(
                "Ajoute aussi VAPID_ADMIN_EMAIL=<ton-email>. "
                "Garde la clé privée secrète (ne jamais la committer)."
            )
        )
