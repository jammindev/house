from django.conf import settings
from django.http import HttpResponseRedirect
from django.utils.translation import activate, get_language_from_request


LANGUAGE_COOKIE_NAME = settings.LANGUAGE_COOKIE_NAME  # 'django_language'


class UserLocaleMiddleware:
    """
    Pour les utilisateurs connectés, active la langue stockée dans User.locale
    et synchronise le cookie django_language en conséquence.

    Ce middleware doit être déclaré APRÈS AuthenticationMiddleware dans MIDDLEWARE.
    Il prend le dessus sur LocaleMiddleware pour les utilisateurs authentifiés,
    garantissant une source de vérité unique : User.locale.
    """

    BYPASS_PREFIXES = ('/api/', '/admin/', '/static/', '/media/', '/i18n/')

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        path = request.path_info
        if any(path.startswith(p) for p in self.BYPASS_PREFIXES):
            return self.get_response(request)

        if request.user.is_authenticated:
            user_locale = getattr(request.user, 'locale', None)
            if user_locale:
                activate(user_locale)
                request.LANGUAGE_CODE = user_locale

        response = self.get_response(request)

        # Synchronise le cookie pour que les prochaines requêtes (et
        # AcceptLanguageRedirectMiddleware) voient la bonne langue.
        if request.user.is_authenticated:
            user_locale = getattr(request.user, 'locale', None)
            if user_locale:
                response.set_cookie(
                    LANGUAGE_COOKIE_NAME,
                    user_locale,
                    max_age=getattr(settings, 'LANGUAGE_COOKIE_AGE', 365 * 24 * 3600),
                    path=getattr(settings, 'LANGUAGE_COOKIE_PATH', '/'),
                    domain=getattr(settings, 'LANGUAGE_COOKIE_DOMAIN', None),
                    secure=getattr(settings, 'LANGUAGE_COOKIE_SECURE', False),
                    httponly=getattr(settings, 'LANGUAGE_COOKIE_HTTPONLY', False),
                    samesite=getattr(settings, 'LANGUAGE_COOKIE_SAMESITE', 'Lax'),
                )

        return response


class ActiveHouseholdMiddleware:
    """
    Résout le household actif de l'utilisateur une seule fois par requête
    et l'expose via request.household.

    Doit être déclaré APRÈS AuthenticationMiddleware dans MIDDLEWARE.

    Priorité de résolution de l'utilisateur :
      1. Bearer JWT (Authorization header) — couvre l'impersonation et les appels API
      2. Jeton d'appareil (``Authorization: Device …``) — raccourci iOS
      3. DRF force_authenticate (_force_auth_user) — tests unitaires
      4. Session Django — navigation web classique

    ⚠️ **Le n°2 doit vivre ici, et pas seulement dans une classe d'authentification
    DRF.** Ce middleware tourne **avant** DRF : une classe d'authentification seule
    authentifierait bien l'utilisateur au niveau de la vue, mais ``request.household``
    aurait déjà été fixé à ``None`` — et tout envoi depuis un téléphone répondrait
    « A valid household context is required », sans que rien ne désigne le middleware.
    Régression : ``accounts/tests/test_device_tokens.py::TestTheTokenResolvesTheHousehold``.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    @staticmethod
    def _user_from_jwt(request):
        """Tente de résoudre l'utilisateur depuis le Bearer token JWT, sans lever d'exception."""
        auth_header = request.META.get('HTTP_AUTHORIZATION', '')
        if not auth_header.startswith('Bearer '):
            return None
        token_str = auth_header[7:]
        try:
            from rest_framework_simplejwt.tokens import AccessToken
            from django.contrib.auth import get_user_model
            token = AccessToken(token_str)
            user_id = token.get('user_id')
            if not user_id:
                return None
            User = get_user_model()
            return User.objects.filter(pk=user_id, is_active=True).first()
        except Exception:
            return None

    @staticmethod
    def _user_from_device_token(request):
        """L'utilisateur porteur d'un jeton d'appareil, sans lever d'exception.

        Le format de l'en-tête n'est pas réécrit ici : il vient de
        ``accounts.authentication``, seule définition, pour que le middleware et la
        classe DRF ne puissent pas diverger.
        """
        try:
            from accounts.authentication import raw_token_from_request
            from accounts.models import DeviceToken

            raw = raw_token_from_request(request)
            if not raw:
                return None
            token = DeviceToken.resolve(raw)
            if token is None or not token.user.is_active:
                return None
            # Gardé pour DeviceTokenScopeMiddleware, qui décide juste après ce que
            # ce jeton a le droit d'atteindre — sans refaire la requête.
            request.device_token = token
            return token.user
        except Exception:
            return None

    def __call__(self, request):
        request.household = None

        # 1. JWT Bearer token (prioritaire : couvre l'impersonation)
        user = self._user_from_jwt(request)

        if not (user and user.is_authenticated):
            # 2. Jeton d'appareil — voir l'avertissement du docstring
            user = self._user_from_device_token(request)

        if not (user and user.is_authenticated):
            # 3. DRF force_authenticate sets _force_auth_user on the raw Django request
            # before middleware runs, but AuthenticationMiddleware still sets
            # request.user = AnonymousUser from session. Fall back to it for tests.
            force_user = getattr(request, '_force_auth_user', None)
            if force_user:
                user = force_user

        if not (user and user.is_authenticated):
            # 4. Session Django (navigation web classique)
            user = getattr(request, 'user', None)

        if user and user.is_authenticated:
            active_id = getattr(user, 'active_household_id', None)
            if active_id:
                from households.models import Household
                request.household = Household.objects.filter(id=active_id).first()
            if not request.household:
                membership = (
                    user.householdmember_set
                    .select_related('household')
                    .order_by('household__name')
                    .first()
                )
                if membership:
                    request.household = membership.household
        return self.get_response(request)


class AcceptLanguageRedirectMiddleware:
    """
    Quand un utilisateur arrive sur une URL sans préfixe de langue ET sans cookie
    de langue, redirige vers l'URL préfixée correspondant à son Accept-Language.

    Exemples :
        Safari en français, pas de cookie :
            /app/dashboard/  →  /fr/app/dashboard/
        Safari en anglais ou langue non supportée, pas de cookie :
            /app/dashboard/  →  /app/dashboard/  (pas de redirect, anglais = défaut)
        Cookie présent : on laisse LocaleMiddleware gérer, pas de redirect.
    """

    def __init__(self, get_response):
        self.get_response = get_response
        lang_codes = {code for code, _ in settings.LANGUAGES}
        lang_codes.discard(settings.LANGUAGE_CODE.split("-")[0])  # retirer la langue par défaut
        self.non_default_langs = lang_codes  # ex. {'fr', 'de', 'es'}

    # Prefixes that must never be language-redirected
    BYPASS_PREFIXES = ('/api/', '/admin/', '/static/', '/media/', '/i18n/')

    def __call__(self, request):
        # Ignorer les chemins non-web (API, admin, assets…)
        path = request.path_info
        if any(path.startswith(p) for p in self.BYPASS_PREFIXES):
            return self.get_response(request)

        # Les utilisateurs connectés sont gérés par UserLocaleMiddleware
        # (qui active User.locale et synchronise le cookie) → pas de redirect ici.
        if request.user.is_authenticated:
            return self.get_response(request)

        # Ignorer si un cookie de langue est déjà posé
        if request.COOKIES.get(LANGUAGE_COOKIE_NAME):
            return self.get_response(request)

        # Ignorer si l'URL a déjà un préfixe de langue (ex. /fr/...)
        parts = path.split("/", 2)
        if len(parts) >= 2 and parts[1] in self.non_default_langs:
            return self.get_response(request)

        # Pas de cookie, pas de préfixe → détecter via Accept-Language
        lang = get_language_from_request(request, check_path=False)
        lang_prefix = lang.split("-")[0]  # 'fr-CA' → 'fr'

        if lang_prefix in self.non_default_langs:
            # Rediriger vers /fr<path>
            redirect_url = f"/{lang_prefix}{path}"
            if request.META.get("QUERY_STRING"):
                redirect_url += f"?{request.META['QUERY_STRING']}"
            return HttpResponseRedirect(redirect_url)

        return self.get_response(request)


class DeviceTokenScopeMiddleware:
    """Un jeton d'appareil n'atteint que ce qui l'a explicitement accepté.

    **Le refus est le défaut.** Une vue ajoutée demain sans y penser refuse les
    jetons ; elle ne les accepte qu'en le déclarant :

        class DocumentViewSet(...):
            allows_device_token = ('upload',)   # ou True pour toute la vue

    C'est la règle de ``core/views_media.py`` (« ce qui n'est pas explicitement
    autorisé est refusé ») portée à l'authentification. Un jeton qui vaudrait pour
    toute l'API ne serait plus un jeton d'appareil mais un mot de passe sous un autre
    nom : il lirait le journal du foyer, les comptes bancaires et les documents
    privés depuis un raccourci recopié sur un téléphone.

    ⚠️ **Pourquoi un middleware et pas une permission DRF.** Une permission déclarée
    dans ``DEFAULT_PERMISSION_CLASSES`` est **remplacée**, pas complétée, dès qu'une
    vue définit son propre ``permission_classes`` — ce que fait la quasi-totalité des
    viewsets du projet, ``DocumentViewSet`` compris. Le refus par défaut n'aurait
    donc protégé que les vues qui n'ont rien déclaré, c'est-à-dire l'inverse de ce
    qu'on cherche. ``process_view`` s'exécute après la résolution d'URL et avant la
    vue : il voit la classe, et rien ne peut le contourner.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        return self.get_response(request)

    def process_view(self, request, view_func, view_args, view_kwargs):
        from django.http import JsonResponse

        if getattr(request, 'device_token', None) is None:
            return None  # pas un jeton d'appareil : rien à dire

        view_class = getattr(view_func, 'cls', None) or getattr(view_func, 'view_class', None)
        allowed = getattr(view_class, 'allows_device_token', False)

        if allowed is True:
            return None
        if allowed:
            # DRF pose le mappage méthode → action sur la **vue** (`ViewSetMixin.as_view`),
            # pas dans `initkwargs`. Le lire au mauvais endroit rend `allowed` toujours
            # faux, donc refuse l'envoi que la vue avait pourtant déclaré accepter.
            actions = getattr(view_func, 'actions', None) or {}
            if actions.get(request.method.lower()) in allowed:
                return None

        return JsonResponse(
            {'detail': "This device token is not allowed on this endpoint."},
            status=403,
        )
