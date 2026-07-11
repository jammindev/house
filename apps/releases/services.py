"""Génération du changelog depuis le ``git log``.

Pipeline : ``git log`` → parse conventional-commit → filtre les types user-facing
→ repolit les descriptions via Claude (avec fallback gracieux) → persiste.

Aucune dépendance à la couche LLM household-scoped (``agent.llm``) : le changelog
est de l'infra applicative, pas de l'activité foyer. On appelle donc le SDK
Anthropic directement, et si la clé manque ou l'appel échoue, on retombe sur la
description brute du commit.
"""
from __future__ import annotations

import json
import logging
import re
import subprocess
from dataclasses import dataclass
from datetime import datetime

from django.conf import settings
from django.db import transaction
from django.utils.dateparse import parse_datetime

from .models import ChangelogEntry, ChangelogState

logger = logging.getLogger(__name__)

# Types de commits retenus dans le changelog user-facing.
KEPT_TYPES = {"feat", "fix", "perf"}

# type(scope)!: description   — scope et « ! » (breaking) optionnels.
_CONVENTIONAL_RE = re.compile(
    r"^(?P<type>\w+)(?:\((?P<scope>[\w./-]+)\))?(?P<breaking>!)?:\s*(?P<desc>.+)$"
)
# Références de PR en fin de sujet : « … (#235) (#238) » ou « … (#227, #228) ».
_PR_TRAILER_RE = re.compile(r"(?:\s*\(#[\d,\s#]+\))+\s*$")
_PR_NUMBER_RE = re.compile(r"#(\d+)")

# Séparateurs ASCII improbables dans un message de commit → parsing robuste.
_FIELD_SEP = "\x1f"
_RECORD_SEP = "\x1e"
_GIT_FORMAT = f"%H{_FIELD_SEP}%cI{_FIELD_SEP}%s{_RECORD_SEP}"


@dataclass
class ParsedCommit:
    sha: str
    committed_at: datetime
    raw_subject: str
    change_type: str
    module: str
    description: str
    pr_number: int | None


def read_git_log(*, since_sha: str | None = None, limit: int | None = None) -> str:
    """Retourne la sortie brute de ``git log`` au format interne (records \\x1e)."""
    args = ["git", "log", f"--pretty=format:{_GIT_FORMAT}"]
    if since_sha:
        args.append(f"{since_sha}..HEAD")
    if limit:
        args.append(f"-n{limit}")
    result = subprocess.run(
        args,
        cwd=str(settings.BASE_DIR),
        capture_output=True,
        text=True,
        check=True,
    )
    return result.stdout


def parse_git_log(raw: str) -> list[ParsedCommit]:
    """Parse la sortie de ``git log`` en commits retenus (types user-facing)."""
    commits: list[ParsedCommit] = []
    for record in raw.split(_RECORD_SEP):
        record = record.strip("\n")
        if not record:
            continue
        try:
            sha, iso, subject = record.split(_FIELD_SEP)
        except ValueError:
            continue
        parsed = _parse_subject(sha, iso, subject)
        if parsed is not None:
            commits.append(parsed)
    return commits


def _parse_subject(sha: str, iso: str, subject: str) -> ParsedCommit | None:
    match = _CONVENTIONAL_RE.match(subject.strip())
    if not match:
        return None
    change_type = match.group("type").lower()
    if change_type not in KEPT_TYPES:
        return None

    trailer = _PR_TRAILER_RE.search(subject)
    pr_number = None
    if trailer:
        numbers = _PR_NUMBER_RE.findall(trailer.group(0))
        if numbers:
            # Le dernier « (#N) » est la PR de merge sur main.
            pr_number = int(numbers[-1])

    description = _PR_TRAILER_RE.sub("", match.group("desc")).strip()
    committed_at = parse_datetime(iso)
    if committed_at is None:
        return None

    return ParsedCommit(
        sha=sha,
        committed_at=committed_at,
        raw_subject=subject.strip(),
        change_type=change_type,
        module=(match.group("scope") or "general").lower(),
        description=description,
        pr_number=pr_number,
    )


_POLISH_SYSTEM = (
    "Tu réécris des descriptions de commits Git en phrases de changelog "
    "destinées à des utilisateurs non techniques, en français. "
    "Pour chaque entrée, produis UNE phrase courte, claire, orientée bénéfice, "
    "sans jargon, sans nom de fichier ni terme technique, sans point final. "
    "Garde le sens exact — n'invente rien. "
    'Réponds UNIQUEMENT par un tableau JSON de chaînes, dans le même ordre '
    "que les entrées reçues, sans texte autour."
)


def polish_descriptions(commits: list[ParsedCommit]) -> list[str]:
    """Repolit les descriptions via Claude. Fallback = description brute.

    Un seul appel pour tout le lot (moins cher, ton cohérent). En cas d'absence
    de clé API, d'erreur réseau ou de réponse malformée, on retombe proprement
    sur les descriptions d'origine.
    """
    if not commits:
        return []

    fallback = [c.description for c in commits]

    api_key = getattr(settings, "ANTHROPIC_API_KEY", "") or ""
    if not api_key:
        logger.info("releases: ANTHROPIC_API_KEY absente — descriptions brutes")
        return fallback

    try:
        import anthropic
    except ImportError:
        logger.warning("releases: SDK anthropic absent — descriptions brutes")
        return fallback

    payload = [
        {"type": c.change_type, "module": c.module, "description": c.description}
        for c in commits
    ]
    user = (
        "Voici les entrées à réécrire (JSON). Renvoie un tableau JSON de "
        f"{len(payload)} chaînes, même ordre :\n\n{json.dumps(payload, ensure_ascii=False)}"
    )

    try:
        client = anthropic.Anthropic(api_key=api_key)
        message = client.messages.create(
            model=getattr(settings, "LLM_TEXT_MODEL", "claude-haiku-4-5-20251001"),
            max_tokens=2048,
            system=_POLISH_SYSTEM,
            messages=[{"role": "user", "content": user}],
        )
        text = "".join(
            getattr(block, "text", "") for block in getattr(message, "content", [])
        ).strip()
        polished = json.loads(_strip_code_fence(text))
        if isinstance(polished, list) and len(polished) == len(commits):
            return [str(p).strip() or fb for p, fb in zip(polished, fallback)]
        logger.warning("releases: réponse LLM de taille inattendue — fallback")
    except Exception as exc:  # noqa: BLE001 — best-effort, jamais bloquant
        logger.warning("releases: polissage LLM échoué (%s) — fallback", exc)

    return fallback


def _strip_code_fence(text: str) -> str:
    """Retire un éventuel bloc ```json … ``` autour de la réponse."""
    text = text.strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text)
        text = re.sub(r"\s*```$", "", text)
    return text.strip()


@transaction.atomic
def generate_changelog(
    *,
    since_sha: str | None = "auto",
    limit: int | None = None,
    use_llm: bool = True,
) -> list[ChangelogEntry]:
    """Génère les entrées manquantes depuis le git log et met à jour l'état.

    ``since_sha='auto'`` (défaut) : ne traite que les commits postérieurs à la
    dernière entrée connue. ``None`` : tout l'historique (backfill). Une valeur
    explicite : depuis ce SHA. Idempotent — les commits déjà stockés sont ignorés.
    """
    resolved_since = _resolve_since(since_sha)
    raw = read_git_log(since_sha=resolved_since, limit=limit)
    commits = parse_git_log(raw)

    existing = set(
        ChangelogEntry.objects.filter(
            commit_sha__in=[c.sha for c in commits]
        ).values_list("commit_sha", flat=True)
    )
    fresh = [c for c in commits if c.sha not in existing]

    summaries = polish_descriptions(fresh) if use_llm else [c.description for c in fresh]

    created = [
        ChangelogEntry.objects.create(
            commit_sha=c.sha,
            pr_number=c.pr_number,
            module=c.module,
            change_type=c.change_type,
            summary=summary,
            raw_subject=c.raw_subject,
            committed_at=c.committed_at,
        )
        for c, summary in zip(fresh, summaries)
    ]

    _update_state()
    return created


def _resolve_since(since_sha: str | None) -> str | None:
    if since_sha != "auto":
        return since_sha
    latest = ChangelogEntry.objects.order_by("-committed_at").first()
    return latest.commit_sha if latest else None


def _update_state() -> None:
    """Enregistre le tip de main courant comme état live."""
    head = read_git_log(limit=1)
    for record in head.split(_RECORD_SEP):
        record = record.strip("\n")
        if not record:
            continue
        try:
            sha, iso, _subject = record.split(_FIELD_SEP)
        except ValueError:
            continue
        committed_at = parse_datetime(iso)
        if committed_at is None:
            continue
        state = ChangelogState.load() or ChangelogState()
        state.head_sha = sha
        state.head_committed_at = committed_at
        state.save()
        return
