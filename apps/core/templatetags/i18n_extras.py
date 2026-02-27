from django import template
from django.conf import settings

register = template.Library()


@register.filter
def strip_lang_prefix(path: str) -> str:
    """
    Strip the language prefix from a URL path so it can be passed as `next`
    to Django's set_language view.

    Examples:
        /fr/app/dashboard/  →  /app/dashboard/
        /de/app/zones/      →  /app/zones/
        /app/dashboard/     →  /app/dashboard/   (default lang, no-op)
    """
    lang_codes = {code for code, _ in settings.LANGUAGES}
    parts = path.split("/", 2)  # ['', '<possible_lang>', 'rest/of/path']
    if len(parts) >= 2 and parts[1] in lang_codes:
        return "/" + (parts[2] if len(parts) > 2 else "")
    return path
