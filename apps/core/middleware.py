from django.conf import settings
from django.http import HttpResponseRedirect
from django.utils.translation import get_language_from_request


LANGUAGE_COOKIE_NAME = settings.LANGUAGE_COOKIE_NAME  # 'django_language'


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

    def __call__(self, request):
        # Ignorer si un cookie de langue est déjà posé
        if request.COOKIES.get(LANGUAGE_COOKIE_NAME):
            return self.get_response(request)

        # Ignorer si l'URL a déjà un préfixe de langue (ex. /fr/...)
        path = request.path_info
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
