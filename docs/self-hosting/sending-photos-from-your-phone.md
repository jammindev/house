# Sending photos from your phone

Maisonnée can receive photos straight from your phone's share menu — no app to
install from a store, and no password stored on the device.

How it works depends on the platform, and the difference is not ours to fix:
**Safari does not support the Web Share Target API**, so an installed web app on
iPhone cannot receive shared content. Android can, so it does.

|  | Android | iOS |
|---|---|---|
| Mechanism | Web Share Target (built in) | Shortcuts app |
| What you configure | Nothing | A device token, once |
| Setup time | Install the app | About two minutes |

---

## Android — nothing to configure

1. Open your Maisonnée instance in Chrome.
2. Install it (*Add to Home screen* / *Install app*).
3. In your gallery, select photos → **Share** → **Maisonnée**.

That's it. The session you already have is used; there is no token to create.

> **HTTPS is required.** Service workers — and therefore installable web apps and
> share targets — only run on secure origins. If your instance is served over plain
> HTTP, Maisonnée will not appear in the share menu, and nothing will report an
> error: the option simply will not be there. Put a TLS certificate in front of your
> instance (a reverse proxy with Let's Encrypt is enough).

> **Already installed?** Android registers a share target when the app is installed.
> If you installed Maisonnée before this feature existed, uninstall and reinstall it
> from the home screen so the system picks it up.

---

## iOS — a device token and a shortcut

### 1. Create a device token

In Maisonnée: **Settings → Devices → Create token**.

The token is shown **once**. Only a fingerprint of it is stored on the server, so it
cannot be recovered — copy it right away. If you lose it, revoke it and create
another; that costs nothing.

A device token can do exactly one thing: upload a file. It cannot read your
household journal, your accounts, or your documents, and it cannot create or revoke
other tokens. Revoking it takes effect on the very next request.

### 2. Build the shortcut

Open the **Shortcuts** app, create a new shortcut, and in its details enable **Show
in Share Sheet** with **Images** as the only accepted type.

Then add two actions:

**1. Repeat with Each** — over **Shortcut Input**

**2. Get Contents of URL** *(inside the loop)*

| Field | Value |
|---|---|
| URL | `https://<your-instance>/api/documents/documents/upload/` |
| Method | `POST` |
| Headers | `Authorization` = `Device <your token>` |
| Request Body | **Form** — *not JSON* |
| Form field `file` | type **File** → *Repeat Item* |
| Form field `type` | type **Text** → `photo` |

Two details cost people the most time:

- **Request Body must be `Form`.** JSON cannot carry a file, and the error message
  points at the file field rather than at the body type.
- **The `type` field is not cosmetic.** It decides what the server does with the
  image: `photo` generates thumbnails and puts it in the gallery; anything else
  treats the file as a document and runs text extraction on it — which, on a
  photograph, costs an AI call and returns nothing useful.

### 3. Use it

In Photos, select one or more photos → **Share** → scroll to the actions list →
your shortcut. The photos land in the gallery, keeping their capture date.

### Sharing the shortcut with other people

Do **not** share the shortcut you just built: it contains your token in a header,
and an iCloud shortcut link is public. Anyone who opens it could upload into your
household.

To share one, build a second shortcut where the instance URL and the token come
from **Import Questions** (Shortcuts asks them when the shortcut is imported)
instead of being written into the actions. That version holds no secret, works
against any instance, and each person answers with their own token.

Every member of a household should have their **own** token, so that revoking one
device never affects anybody else.
