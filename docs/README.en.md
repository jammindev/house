# A guide to this project's documentation (which is in French)

Maisonnée was built for one real household, in French. The interface speaks
English, French, German and Spanish — but the documentation, the architecture
notes and some code comments are in French, and they will stay that way. Keeping
one accurate document beats maintaining a translation that quietly drifts.

**This page is not a translation.** It is a map: what each French document holds,
and why it might be worth running through a translator. Most of it is unusual
enough to be worth the detour — this repository documents *why* far more than
*what*.

## Where the reasoning lives

| Where | What it is | Why you may care |
|---|---|---|
| **`CLAUDE.md`** (root) | The project's rulebook. Every rule is tied to a bug that actually happened in production, with the reasoning kept and the name of the regression test that guards it. | The fastest way to understand *why* the code looks like it does — and the file to read before changing anything. It is the single most useful file here. |
| **`docs/fiches/`** | Concept notes — "the lesson". Each one states the problem, the concept in two sentences, how it was applied here, the trade-offs, and **what was rejected and why**. Covers RAG, embeddings, idempotent bank-statement import, expense mapping, PWA push, self-hosting. | Background on the non-obvious parts, and the decisions you would otherwise re-litigate in a pull request. |
| **`docs/parcours/`** | One set of documents per body of work ("parcours"): a product document (what problem, for whom, what is deliberately excluded) and a technical backlog split into independently shippable lots. | What is planned, what is out of scope on purpose, and where the current work sits. |
| **`docs/MODULES/`** | Status of each Django app: what to fix, what to build, what to improve. | Where to start on a given module. |
| **`docs/journal/`** | Dated notes from working sessions — decisions as they were made, including the ones that were later reversed. | Archaeology: why a given choice was made on a given day. |
| **`docs/self-hosting/`** | **In English.** The operator's manual: install, optional keys, backup **and restore**, upgrades, releases, troubleshooting. | Start here if you want to run Maisonnée. It assumes Docker and nothing else. |
| **`DEPLOYMENT.md`** (root) | The maintainer's own VPS deployment, including a networking primer. | Not an install guide — it assumes one specific server, Traefik, and a self-hosted CI runner. Worth reading for the deploy invariants it documents (why the proxy doesn't fall with the app, why migrations run before traffic switches). |
| **Commit messages & issues** | French, conventional commits (`type(scope): description`). | The changelog is generated from them. |

## What is already in English

- the **interface**, in four languages (`ui/src/locales/`);
- **code identifiers, function names and test names** — and the test names are
  worth a look on their own: they are named after the defect they prevent
  (`TestTheTwoScreensAgree`, `TestSavingASplitNeverUndoesAReconciliation`,
  `TestTheMarkerAgreesWithTheControl`). Break an invariant and the failing test
  tells you which one, and why it exists;
- `README.md`, `CONTRIBUTING.md`, `SECURITY.md`, `CODE_OF_CONDUCT.md`, the issue
  templates, and the self-hosting documentation.

## If you only read three things

1. **`CLAUDE.md`, the "Argent" (money) section** — the invariants that make the
   financial side trustworthy: nothing is counted twice, nothing sits in a silent
   in-between state, a counter cannot have two definitions, a discrepancy is never
   stated twice in two voices.
2. **`docs/fiches/AUTO_HEBERGEMENT.md`** — what changes when software leaves its
   author's machine: the threat model, optional capabilities, the licence, and why
   backups are a feature rather than a piece of advice.
3. **The parcours document for whatever you are touching** — it usually says, in
   plain words, what the feature refuses to do and why.

## Translating

**Translating any of these is a genuinely useful contribution** — probably the
easiest way to make a first, meaningful one. Two rules keep it from backfiring:

1. **The French file stays the source of truth.** A correction goes into the
   original first; a translation is never edited in its place.
2. **A translation records the date and commit of the version it mirrors**, and
   lives next to its original as `<NAME>.en.md` — never in a parallel `en/`
   directory, which makes drift invisible.

And the part people find surprising: **a translation nobody updates is worse than
no translation at all.** It looks authoritative while being wrong, and the file
someone reads is never the file someone fixes. If one goes stale and you cannot
refresh it, delete it — that is a contribution too.

This is the same rule the rest of the project follows for numbers: two things that
disagree do not average out, they discredit each other.
