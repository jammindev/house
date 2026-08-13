<div align="center">

<img src="docs/assets/brand/logo-mark.svg" alt="" width="72" />

# Maisonnée

**Everything a household keeps alive.**
Indoors and out: the money, the works, the meters, the garden, the animals.

[Install](#install-it-in-three-lines) · [What it does](#what-it-does) ·
[What it does not do](#what-it-does-not-do) ·
[Self-hosting docs](docs/self-hosting/README.md) · [Français](README.fr.md)

</div>

![The dashboard: what needs attention today, with the money and the outdoors side by side](docs/assets/screenshots/01-dashboard.png)

---

## The idea

Most household software makes you choose a corner. A budgeting app for the
money. A todo app for the chores. A spreadsheet for the meter readings. A note
somewhere for when the boiler was last serviced. Each one is fine, and none of
them knows about the others — so nothing ever adds up.

Maisonnée keeps one register for the whole household. The bathroom renovation is
a project, a pile of receipts, a set of before/after photos and a line in the
"Home" budget **at the same time**. The chicken feed is stock, a recurring chore,
and €0.22 per egg. The consumer unit in the cellar is a diagram you can actually
read when something trips.

The rule the money side is built on:

> **Every euro is either filed or flagged.** Nothing sits in a silent
> in-between.

Import a bank statement and every line has to land somewhere — split across
budgets, attached to a project, marked as an internal transfer, or listed as
something still to sort out. What the app cannot explain, it says out loud
instead of quietly averaging it away.

## Install it in three lines

```bash
curl -O https://raw.githubusercontent.com/jammindev/house/main/docker-compose.yml
docker compose up
open http://localhost:8000
```

No Python, no Node, no `git clone`, no API key to subscribe to. The first start
pulls the image, creates the database, applies the schema and creates your first
account — the password is printed once in the output, so copy it.

Runs on `amd64` and `arm64`: a Raspberry Pi 4/5, an N100 box or a Synology are
all enough. About 2 GB of RAM and 5 GB of disk to start.

Full guide: [docs/self-hosting/install.md](docs/self-hosting/install.md) —
including putting it behind Caddy or Traefik, backups, and upgrades.

## What it does

### The money, down to the line

![The bank journal: every operation exactly as the bank recorded it, each one allocated or flagged](docs/assets/screenshots/02-bank-journal.png)

Import a CSV statement and reconcile it. One bank line can split across several
budgets and attach to a project at once — 150 € at the hardware store can be
90 € of "the bathroom" and 60 € of general upkeep. Refunds credit the envelope
back. Internal transfers between your own accounts stop counting as spending.
And a **Control** tab lists, with a reason, everything the app cannot account
for: a missing opening balance, a period never imported, a statement whose
printed balances do not add up.

### Budgets that admit what they don't know

![Budgets: nested categories, ceilings, and what is over](docs/assets/screenshots/03-budgets.png)

Monthly ceilings, nested categories, and a ceiling is **optional** — "Gifts" can
be a tracked category with no limit, because inventing a number to get a category
makes every other bar meaningless. Spending shows in two figures: the part a bank
line proves, and the part still waiting for one.

### The outdoors is not an afterthought

![The chicken coop: laying, feed, cost per egg, chores and the flock](docs/assets/screenshots/04-chicken-coop.png)

Chickens, water, electricity, stock, the garden — same register as the money,
which is why the coop can tell you what an egg costs. Laying, feed reserves,
recurring chores, and each hen with her own history.

![The electrical board: rows, breakers and RCDs, as they are in the cellar](docs/assets/screenshots/05-electricity.png)

The consumer unit, drawn as it actually is. Circuits, protective devices, what
feeds what — the thing you want when a breaker trips and you are standing in the
cellar with a torch.

### And the ordinary things

![Tasks: what is due, for whom, and where](docs/assets/screenshots/06-tasks.png)

Tasks and recurring chores, zones and equipment, documents with full-text search
over their contents, insurance policies, a shopping list, photos.

### Optional, if you bring a key

An assistant that answers questions about *your* household and can create things
for you; semantic search; a monthly recap written in plain language; push
notifications; a Telegram bot. Each of these needs a key or a service you supply.
**None of them is required**, and the interface says plainly when one is
unavailable rather than offering a button that fails.

## What it does not do

Written down so you find out here rather than after installing:

- **No bank aggregation.** You export a CSV from your bank and import it. There
  is no Plaid, no Bridge, no screen-scraping your bank account.
- **No hosted version.** You run it, or you don't run it. There is no account to
  create on someone else's server.
- **No native mobile app.** It is a PWA: installable, works offline for reading,
  takes shared photos from Android and iOS.
- **No telemetry.** Nothing calls home. Ever.
- **No multi-currency.** Amounts are euros.
- **AI is opt-in and yours.** No key, no assistant — and the rest of the app is
  untouched.
- **Not a team product.** It models a household: a few people who trust each
  other and share a roof.

## Status

**v0.1.0.** Built for one real household and used daily by it since 2025. It has
had one user for most of its life, which shows in both directions: the parts that
household uses are worn smooth, and the parts it doesn't are younger than they
look.

Being honest about the shape of it:

- The interface speaks **English, French, German and Spanish**.
- The internal documentation and some code comments are **in French**. That is a
  deliberate, documented choice, not neglect — see
  [CONTRIBUTING.md](CONTRIBUTING.md). Issues and pull requests in English are
  welcome, and [docs/README.en.md](docs/README.en.md) is an English guide to what
  the French docs contain.
- Backup **and restore** are scripted and exercised in CI on every release,
  because a backup nobody has restored is not a backup.
- Destructive migrations ship in two steps, so an upgrade never needs you to be
  watching.

If you install it, the most useful thing you can do is tell the author what
broke. That is worth more right now than a pull request.

## Documentation

| | |
|---|---|
| [Self-hosting](docs/self-hosting/README.md) | Install, backup and restore, upgrades, troubleshooting |
| [AI providers](docs/self-hosting/ai-providers.md) | Which keys unlock what, and what happens without them |
| [Contributing](CONTRIBUTING.md) | How to help, and the language the project is written in |
| [Security](SECURITY.md) | Reporting a vulnerability, privately |
| [English guide to the docs](docs/README.en.md) | What the French documentation holds, and what is worth reading |

## Licence

[AGPL-3.0-only](LICENSE). Run it, change it, share it. If you host a modified
version *for other people*, publish your changes — hosting it for your own family
is not "for other people", it is the normal use of this software.

The **name and the mark are not covered by the licence**; a redistributed fork
carries its own name. The details, without lawyer-speak:
[docs/assets/brand/README.md](docs/assets/brand/README.md).
