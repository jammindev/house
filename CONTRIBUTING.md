# Contributing to Maisonnée

*Version française : [CONTRIBUTING.fr.md](CONTRIBUTING.fr.md)*

> **This project was built for one real household, in French.** The interface
> speaks English, French, German and Spanish; the internal documentation and some
> code comments are in French. Issues and pull requests in English are welcome.
>
> If that sounds like a wall, start with **[docs/README.en.md](docs/README.en.md)**:
> an English guide to what each French document contains, and why you might want
> to read it.

Thanks for being here. A few things worth knowing before you spend time on this.

## What this project is, and what it is not

Maisonnée is a household operating system: money, tasks, documents, meters,
equipment, projects — and yes, chickens. It was written for one family's actual
life, not for a market. That shapes what gets accepted.

It is maintained by **one person**, alongside a full-time job. Expect thoughtful
answers, not fast ones.

## Before writing code: open an issue

Please **open an issue before starting work** on anything beyond a typo or an
obvious bug fix.

This is not bureaucracy. Refusing a pull request that someone spent a weekend on
is genuinely unpleasant, and it happens when the feature does not fit a direction
that was never written down. A five-line issue first saves that.

Expect a plain answer, including "no" with a reason. A no is not a judgement on
the idea — it usually means one more thing to maintain for ten years.

## Getting it running

> **A one-command `docker compose up` is being built** and is not there yet. Until
> it lands, the development setup below is the only supported way to run the
> project. Sorry about the venv.

Development setup (Django on `:8001`, Vite on `:5174`):

```bash
python -m venv venv && source venv/bin/activate
pip install -r requirements/dev.txt
npm install
python manage.py runserver 8001    # backend
npm run dev                        # frontend
```

## Running the tests

All three must be green before a pull request is reviewed:

```bash
pytest                              # backend, ~4000 tests
npm run lint                        # ESLint over ui/src
npx tsc -b ui/tsconfig.json         # typecheck
```

End-to-end tests need the Django server running on `:8001`:

```bash
npm run test:e2e
```

## House rules that will come up in review

These are not style preferences. Each one exists because something broke in
production, and each is enforced by a test.

- **Never use `defaultValue` in a `t()` call.** A missing key must show as a raw
  key, not as silently acceptable English. Every key must exist in all four
  locale files. (`ui/src/locales/keys.test.ts`)
- **Never use a fixed Tailwind colour.** Use design-system tokens (`bg-card`,
  `text-muted-foreground`, `border-border`…), never `bg-white` or `text-slate-900`.
- **Never use `<input type="number">` for a decimal.** Use `DecimalInput`. Typing
  "12,5" on a French keyboard in a number field produced **512 €** in one browser
  and **5 €** in another — a wrong amount saved silently.
- **Never use `toISOString()` for a calendar date.** Use `toLocalISODate` /
  `todayISO`. UTC conversion moves anything between midnight and 2 a.m. to the
  previous day.
- **A mutation lives in its feature's `hooks.ts`,** and its `onSuccess` declares
  the data root it wrote — not the list of caches to refresh.
- **Money is queried through `interactions.queries.expenses()`.** Never cast a
  JSON field to sum an amount.

The full reasoning for each — with the bug that caused it — is in
[`CLAUDE.md`](CLAUDE.md). It is in French, and it is the single most useful file
in the repository.

## Commits

Commit subjects follow the conventional format, because they feed the changelog
automatically:

```
<type>(<scope>): <description>
```

`feat`, `fix` and `perf` appear in the changelog; `refactor`, `chore`, `docs`,
`test`, `ci`, `build` and `style` are internal. **Always set a scope** — it is the
module concerned (`money`, `tasks`, `agent`…), and it becomes the entry's filter.

Commit messages are written in French in this repository. **Yours may be in
English** — the structure is what matters, and descriptions are rewritten for the
public changelog anyway.

## Sign your commits off (DCO)

This project uses the [Developer Certificate of Origin](https://developercertificate.org/)
rather than a contributor licence agreement. You keep your copyright; you simply
state that you have the right to submit the code:

```bash
git commit -s -m "fix(tasks): ..."
```

which appends `Signed-off-by: Your Name <your@email>` to the message.

No CLA, deliberately: signing away rights is a real cost for a contributor, and it
would only buy the ability to relicense later — a distant option against immediate
friction.

## Licence

Maisonnée is **AGPL-3.0-only**. Contributions are accepted under that licence.

In practice: you can run it, modify it and share it freely, including for your own
household. If you *host a modified version for other people*, you must publish
your modifications. Self-hosting for your own family is not "hosting for others" —
it is the normal use of this software.

The **name and the logo are not covered by the licence.** The code is free; the
identity is not. A fork that is not this project should carry its own name. What
you may and may not do with the name and the mark is spelled out — without
lawyer-speak, and in more detail than this paragraph — in
[docs/assets/brand/README.md](docs/assets/brand/README.md). Short version:
talking about Maisonnée is always fine, running a modified copy at home is always
fine, and redistributing one under this name is not.

## Translations

The documentation is in French. Translating any of it is a genuinely useful
contribution — see [docs/README.en.md](docs/README.en.md) for what exists and the
two rules that keep translations from going stale.

## Security

Please do not open a public issue for a vulnerability. See
[SECURITY.md](SECURITY.md).

## One thing about repository access

The production deployment runs on the maintainer's own server, triggered by
pushes to `main`. **Write access to this repository is therefore shell access to
that machine**, which is why contributions go through forks and pull requests —
the normal open-source flow — and why write access is not granted. Nothing
personal; it is a property of the setup.
