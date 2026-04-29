"""
File validation via magic bytes — no external dependencies.

Validates the actual file content rather than the client-supplied Content-Type,
which is trivially falsifiable.
"""
from django.utils.translation import gettext_lazy as _
from rest_framework.exceptions import ValidationError

# (mime_type, label, detector)
# detector(header: bytes) -> bool
_SIGNATURES = [
    (
        'image/jpeg',
        _('JPEG image'),
        lambda h: h[:3] == b'\xff\xd8\xff',
    ),
    (
        'image/png',
        _('PNG image'),
        lambda h: h[:8] == b'\x89PNG\r\n\x1a\n',
    ),
    (
        'image/gif',
        _('GIF image'),
        lambda h: h[:6] in (b'GIF87a', b'GIF89a'),
    ),
    (
        'image/webp',
        _('WebP image'),
        lambda h: h[:4] == b'RIFF' and h[8:12] == b'WEBP',
    ),
    (
        'image/heic',
        _('HEIC image'),
        lambda h: len(h) >= 12 and h[4:8] == b'ftyp' and h[8:12] in (b'heic', b'heix', b'hevc', b'hevx'),
    ),
    (
        'image/heif',
        _('HEIF image'),
        lambda h: len(h) >= 12 and h[4:8] == b'ftyp' and h[8:12] in (b'mif1', b'msf1', b'heim', b'heis', b'hevm', b'hevs'),
    ),
    (
        'application/pdf',
        _('PDF document'),
        lambda h: h[:4] == b'%PDF',
    ),
]

ALLOWED_DOCUMENT_TYPES = {
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/heic',
    'image/heif',
    'application/pdf',
}
ALLOWED_IMAGE_TYPES = {'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/heic', 'image/heif'}

DOCUMENT_MAX_SIZE = 20 * 1024 * 1024   # 20 MB
AVATAR_MAX_SIZE = 2 * 1024 * 1024      # 2 MB


def detect_mime_type(file) -> str | None:
    """Read the first bytes and return the detected MIME type, or None."""
    file.seek(0)
    header = file.read(16)
    file.seek(0)
    for mime, _label, detector in _SIGNATURES:
        if detector(header):
            return mime
    return None


def validate_upload(file, allowed_types: set[str], max_size: int, field_name: str = 'file'):
    """
    Validate an uploaded file's content (magic bytes) and size.
    Raises ValidationError on failure.
    Returns the detected MIME type on success.
    """
    if file.size > max_size:
        raise ValidationError({
            field_name: [_(
                'File too large (%(size)d MB). Maximum allowed: %(max)d MB.'
            ) % {
                'size': file.size // (1024 * 1024),
                'max': max_size // (1024 * 1024),
            }]
        })

    mime = detect_mime_type(file)
    if mime not in allowed_types:
        allowed_labels = [
            label for m, label, _ in _SIGNATURES if m in allowed_types
        ]
        raise ValidationError({
            field_name: [_(
                'Unsupported file type. Allowed: %(types)s.'
            ) % {'types': ', '.join(str(l) for l in allowed_labels)}]
        })

    return mime
