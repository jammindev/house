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
