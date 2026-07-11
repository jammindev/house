"""Tests du parsing git → changelog (logique pure, sans réseau ni LLM)."""
import pytest

from releases import services
from releases.models import ChangelogEntry, ChangelogState

FIELD = "\x1f"
RECORD = "\x1e"


def _raw(*rows):
    """Construit une sortie git log factice au format interne."""
    return "".join(
        f"{sha}{FIELD}{iso}{FIELD}{subject}{RECORD}" for sha, iso, subject in rows
    )


ISO = "2026-07-08T12:00:00+02:00"


class TestParseGitLog:
    def test_parses_feat_with_scope_and_pr(self):
        raw = _raw(("abc123", ISO, "feat(projects): achat projet (#238)"))
        [commit] = services.parse_git_log(raw)
        assert commit.change_type == "feat"
        assert commit.module == "projects"
        assert commit.description == "achat projet"
        assert commit.pr_number == 238
        assert commit.raw_subject == "feat(projects): achat projet (#238)"

    def test_scopeless_commit_defaults_to_general(self):
        raw = _raw(("d1", ISO, "fix: corrige un bug sans scope"))
        [commit] = services.parse_git_log(raw)
        assert commit.module == "general"
        assert commit.change_type == "fix"
        assert commit.pr_number is None

    def test_takes_last_pr_number_as_merge_pr(self):
        raw = _raw(("d2", ISO, "feat(dash): refonte (#227, #228, #229) (#232)"))
        [commit] = services.parse_git_log(raw)
        assert commit.pr_number == 232
        assert commit.description == "refonte"

    @pytest.mark.parametrize("subject", [
        "refactor(agent): interne",
        "chore: bump deps",
        "docs: readme",
        "test: ajoute un test",
        "ci: pipeline",
        "un message non conventionnel",
    ])
    def test_filters_non_user_facing_types(self, subject):
        raw = _raw(("d3", ISO, subject))
        assert services.parse_git_log(raw) == []

    def test_keeps_only_feat_fix_perf(self):
        raw = _raw(
            ("a", ISO, "feat(x): f"),
            ("b", ISO, "fix(y): g"),
            ("c", ISO, "perf(z): h"),
            ("d", ISO, "refactor(w): i"),
        )
        commits = services.parse_git_log(raw)
        assert [c.change_type for c in commits] == ["feat", "fix", "perf"]


class TestGenerateChangelog:
    @pytest.fixture(autouse=True)
    def _stub_git(self, monkeypatch):
        raw = _raw(
            ("sha_feat", ISO, "feat(projects): nouvelle fonctionnalité (#100)"),
            ("sha_fix", ISO, "fix(tasks): corrige un bug (#101)"),
            ("sha_chore", ISO, "chore: ménage"),
        )
        monkeypatch.setattr(services, "read_git_log", lambda **kwargs: raw)

    def test_creates_entries_for_kept_commits_only(self, db):
        created = services.generate_changelog(since_sha=None, use_llm=False)
        assert len(created) == 2
        assert ChangelogEntry.objects.count() == 2
        assert set(ChangelogEntry.objects.values_list("module", flat=True)) == {
            "projects",
            "tasks",
        }

    def test_is_idempotent(self, db):
        services.generate_changelog(since_sha=None, use_llm=False)
        again = services.generate_changelog(since_sha=None, use_llm=False)
        assert again == []
        assert ChangelogEntry.objects.count() == 2

    def test_updates_live_state(self, db):
        services.generate_changelog(since_sha=None, use_llm=False)
        state = ChangelogState.load()
        assert state is not None
        assert state.head_sha == "sha_feat"

    def test_no_llm_uses_raw_description(self, db):
        [feat, _fix] = sorted(
            services.generate_changelog(since_sha=None, use_llm=False),
            key=lambda e: e.module,
        )
        assert feat.summary == "nouvelle fonctionnalité"
