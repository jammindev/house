# Releases

## Versioning

Semantic versioning, with the meaning that matters to someone running this:

| Part | Changes when |
|---|---|
| `MAJOR` | Something you have to act on — a manual step, a dropped setting, a database major bump |
| `MINOR` | Features, and additive migrations. `pull && up -d`. |
| `PATCH` | Fixes only |

**The project is `0.x`, and that is a statement, not a placeholder.** It has run
one real household for a year; it has not yet run yours. `0.x` says the shape of
things can still move between minors, and that the release notes are worth
reading rather than skimming.

## What a tag produces

Pushing a `v*` tag runs `.github/workflows/release.yml`, which:

1. runs the backup-and-restore round trip — **blocking**: a version people will
   install must be one we have seen restore itself;
2. builds `linux/amd64` **and** `linux/arm64` (a Pi or a NAS is half the
   self-hosting audience, and an amd64-only image answers them `exec format
   error`, which teaches nobody anything);
3. pushes to `ghcr.io/jammindev/maisonnee` as `X.Y.Z`, `X.Y` and — unless it is a
   pre-release — `latest`;
4. starts the image once and runs `manage.py check --deploy` on it. An image
   nobody started is not a published image, it is a published hope.

## Pinning a version

`latest` is the default and follows every release. To decide for yourself when to
move:

```bash
# .env
MAISONNEE_IMAGE=ghcr.io/jammindev/maisonnee:0.1.0
```

`0.1` (no patch) tracks fixes within a minor without ever changing features —
usually the setting you want on a machine you don't want to think about.

## Release notes

Each tag carries notes derived from the commit history: what changed, and
whether the release contains a migration. Commits follow
`type(scope): description`, and only `feat`, `fix` and `perf` reach the notes —
refactors and chores stay internal.

## If `docker compose up` says `denied`

The image is public since 2026-08-13, so this should not happen. If it does,
nothing on your side needs changing — it means the package visibility has
regressed, and an issue is the fastest fix.

You can check for yourself, without an account:

```bash
docker logout ghcr.io && docker pull ghcr.io/jammindev/maisonnee:latest
```

Two things make this failure mode easy to reach and worth naming: a **newly
created** `ghcr.io` package is private by default even when pushed from a public
repository, and an organisation can forbid public packages outright — the two
settings are independent of each other and of the repository's own visibility.
