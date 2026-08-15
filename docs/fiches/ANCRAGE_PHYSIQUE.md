# Ancrer un objet numérique dans un lieu physique

> Comment une application web peut savoir que quelqu'un se trouve **vraiment**
> dans une pièce — sans GPS, sans capteur, sans compte, et sans lui demander de
> le jurer.

## 1. Le problème

Une chasse au trésor (parcours 31) repose entièrement sur une question que le web
ne sait pas poser : *est-ce que tu es bien dans la buanderie ?* Tant que la
réponse est un bouton « j'y suis », le jeu n'existe pas — il s'effondre au premier
enfant qui comprend qu'il peut appuyer depuis le canapé.

Le problème est plus général que le jeu. C'est celui de tout système qui doit
relier un enregistrement à un endroit : inventaire par emplacement, relevé de
compteur, maintenance sur site, prise de service. À chaque fois, la même
question : **qu'est-ce qui, dans le monde physique, prouve une présence ?**

## 2. Le concept en deux phrases

On dépose dans le lieu un **secret imprimé** — un jeton aléatoire encodé dans un
QR code — et on considère que le présenter, c'est y être. La preuve n'est plus
déclarative mais **possessive** : elle ne repose pas sur ce que l'utilisateur
affirme, mais sur une information qu'il ne peut obtenir qu'en se déplaçant.

C'est exactement le raisonnement d'un lien d'invitation : le jeton *est*
l'identifiant, et le détenir suffit. La différence tient au support — un lien
d'invitation circule par message, un jeton d'ancrage est **scotché à un mur** et
n'a de valeur que là où il est collé.

## 3. Comment on l'a appliqué dans house

- **`Zone.qr_token`** — 43 caractères d'aléa (`secrets.token_urlsafe(32)`),
  unique, non éditable, posé à la création et rétro-rempli par migration. Il est
  **distinct de l'UUID de la zone**.
- **Le QR encode une URL** — `https://<instance>/z/<token>` — et rien d'autre.
- **L'appareil photo natif l'ouvre.** Aucun code de scan n'est écrit.
- **La route `/z/:token` est une page publique du SPA**, sur le modèle de
  `/join/:token`. Elle appelle `POST /api/zones/scan/`, qui est la **seule**
  autorité : c'est le serveur qui dit à quelle zone correspond le jeton, et si
  une chasse en cours vient d'avancer.
- **Les étiquettes s'impriment depuis l'app** (`/app/zones/print-qr`), une planche
  par foyer, nom de la pièce sous chaque code. Les QR sont rendus **côté serveur**
  en SVG.

## 4. Pourquoi cette implémentation

**Un jeton, pas l'UUID de la zone.** L'UUID d'une zone circule déjà partout :
dans les URLs de l'app, dans les payloads d'API, dans les liens que l'agent
produit. S'en servir comme preuve de présence, c'est publier la réponse du jeu
dans la barre d'adresse — le premier enfant qui sait lire une URL valide les six
étapes sans quitter le canapé. Un jeton dédié, jamais renvoyé par les endpoints de
lecture ordinaires, garde son seul rôle : prouver qu'on tient le papier.

**L'appareil photo natif, pas un scanner intégré.** Le raisonnement paraît
esthétique ; il est en réalité tranché par une ligne de configuration. nginx pose
en production `Permissions-Policy: camera=(), microphone=(), geolocation=()` : un
scanner in-app (`getUserMedia`) serait **bloqué par l'en-tête**, et l'activer
reviendrait à ouvrir la caméra à toute l'application pour un usage de deux minutes
par an. S'ajoute le fait que Safari iOS n'implémente pas `BarcodeDetector` : le
scanner exigerait une bibliothèque de décodage embarquée. Le chemin natif coûte
zéro ligne et zéro permission.

**La résolution dans le SPA, pas une redirection Django.** L'authentification de
House est un JWT en `localStorage` : une vue Django qui reçoit `/z/<token>` ne
sait **pas** qui la consulte et ne peut donc ni vérifier l'appartenance au foyer,
ni faire avancer une chasse. La page du SPA, elle, porte le jeton d'auth dans son
client HTTP. Le catch-all de `config/urls.py` sert déjà `index.html` sur toute
route hors `api/` : la route courte ne coûte aucune configuration serveur.

**Le serveur arbitre, le client affiche.** « Est-ce la bonne pièce ? » est
tranché par `POST /api/zones/scan/`, jamais par comparaison côté client entre la
zone scannée et l'étape courante. C'est la règle du dépôt — *un écart ne se dit
jamais deux fois avec deux voix* — appliquée à un jeu : un client qui déciderait
lui-même pourrait être poussé à dire oui, et l'avancement se rejouerait
différemment d'un appareil à l'autre.

**Les QR se rendent côté serveur.** Une bibliothèque JS de génération aurait
ajouté une dépendance front pour un écran ouvert une fois dans la vie d'un foyer.
`segno` est du Python pur, sans extension C — il n'alourdit ni l'image Docker ni
le bundle.

## 5. Ce qu'on a écarté, et pourquoi

| Piste | Pourquoi non |
|---|---|
| **Bouton « j'y suis »** | aucune preuve ; le jeu meurt au premier contournement. Gardé uniquement comme secours de dépannage, jamais comme défaut |
| **Photo prise sur place** | ne prouve pas le lieu (on photographie une photo), alourdit chaque étape, et demande un arbitre humain |
| **GPS / géorepérage** | inutilisable à l'intérieur : la précision civile est de l'ordre de la maison entière, pas de la pièce |
| **NFC** | le geste est meilleur, mais iOS ne lit les tags en arrière-plan que sur certains modèles, et il faut acheter du matériel. Le QR s'imprime sur du papier ordinaire |
| **Bluetooth (balises)** | des piles à changer dans chaque pièce pour un jeu joué trois fois par an |
| **Réseau Wi-Fi comme preuve de présence** | prouve qu'on est dans la maison, jamais dans quelle pièce |

## 6. Pour aller plus loin

- [Norme ISO/IEC 18004](https://www.iso.org/standard/62021.html) — le QR code, sa
  correction d'erreur (niveau `M` retenu ici : lisible avec ~15 % de la surface
  abîmée, ce qui compte pour une étiquette scotchée près d'un interrupteur).
- [`Permissions-Policy` sur MDN](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Permissions-Policy)
  — l'en-tête qui a tranché le débat du scanner intégré.
- [`segno`](https://segno.readthedocs.io/) — génération de QR en Python pur.
- Fiches voisines : [PWA_PUSH.md](./PWA_PUSH.md) pour ce que l'app peut faire sur
  un téléphone, [AUTO_HEBERGEMENT.md](./AUTO_HEBERGEMENT.md) pour la question des
  URL publiques d'instance.
