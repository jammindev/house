# Lot 2 — `docker compose up` : ce que le plan n'avait pas vu

**2026-07-31** · parcours 28 · issue #488

Le lot devait produire un fichier. Il a produit un fichier et **deux réparations**
que rien n'aurait signalées autrement — parce qu'aucun des deux défauts ne se voit
sur le déploiement de l'auteur.

## Le plan disait « db + web + nginx + scheduler ». C'est faux d'un service.

Le compose devait embarquer nginx, comme la production. Sauf qu'un nginx a besoin
de sa configuration, et une configuration se monte depuis un répertoire — donc
depuis un dépôt cloné. Le critère du lot est `curl -O docker-compose.yml`, **un
seul fichier**. Les deux seules issues étaient de recopier la conf nginx dans le
compose (deux textes, dont un dérivera de l'autre — exactement ce que le projet
refuse partout ailleurs) ou de se passer de nginx.

On s'en passe. Et il s'avère qu'on ne perd presque rien : whitenoise est dans le
middleware **depuis toujours** et sert déjà les fichiers statiques en production —
nginx ne fait que proxifier `/static/` vers Django. Restait le service des médias
protégés, qui délègue à nginx par `X-Accel-Redirect`.

## Défaut n° 1 — un mécanisme de transport déduit d'un réglage de débogage

`views_media` choisissait son mécanisme sur `settings.DEBUG` :

```python
if settings.DEBUG:
    return static_serve(...)          # Django sert
response["X-Accel-Redirect"] = ...    # sinon, nginx sert
```

Le raccourci est juste tant qu'il n'existe que deux déploiements : le dev
(`DEBUG=True`, pas de nginx) et la prod (`DEBUG=False`, nginx). Il devient faux à
la troisième combinaison — `DEBUG=False` **sans** nginx, qui est précisément la
pile auto-hébergée. Le navigateur y recevait une réponse **vide** portant un
en-tête que personne n'allait interpréter : une image cassée, aucune erreur nulle
part, dans les logs pas plus qu'à l'écran.

Le mécanisme se déclare maintenant (`PROTECTED_MEDIA_ACCEL`). Ce n'est pas un
renommage : `DEBUG` répond à « est-ce que j'affiche les tracebacks », et rien dans
cette question ne dit qui envoie les octets d'un PDF.

## Défaut n° 2 — un réglage qui avait l'air posé et ne faisait rien

Le premier chargement de l'instance a servi **900 546 octets** de JavaScript brut.
`config/settings/base.py` déclarait pourtant :

```python
STATICFILES_STORAGE = "whitenoise.storage.CompressedManifestStaticFilesStorage"
```

Django **5.1 a supprimé ce réglage** au profit de `STORAGES`. Il ne provoque ni
erreur, ni avertissement : il est simplement ignoré. Le fichier de configuration
affirmait donc depuis des mois quelque chose de faux, et en production le `gzip on`
de nginx recompressait à la volée — masquant la moitié du problème et payant du
CPU pour chaque visiteur.

Rétabli sous la forme que Django lit, avec brotli : **215 636 octets**, compressés
une fois au `collectstatic`, c'est-à-dire au build de l'image. Quatre fois moins,
et plus rien à faire à l'exécution.

C'est le même motif que le test d'isolation du lot 1 qui passait sans rien
vérifier : **un contrôle qu'on n'a jamais vu échouer n'est pas un contrôle**, et un
réglage qu'on n'a jamais vu agir n'est pas un réglage.

## Ce qui remplace nginx pour la configuration : un module de réglages

`config/settings/selfhost.py` remplit les défauts puis **importe**
`production.py`. Le durcissement de l'auteur et celui d'un inconnu sont le même
texte — donc `test_production_settings.py` continue de surveiller le seul fichier
qui compte, et tout durcissement futur suivra sans qu'on y pense. Une copie aurait
divergé, et le jour où deux textes divergent, aucun des deux ne fait plus autorité.

Un seul bouton, facultatif : `MAISONNEE_PUBLIC_URL`. Absent, l'instance est une
boîte sur un réseau local — `ALLOWED_HOSTS` permissif (elle se joint par IP, par
nom `.local`, par nom Tailscale, et aucun n'est connu d'avance), cookies non
`Secure` puisque le navigateur les jetterait. Déclaré, `ALLOWED_HOSTS` se réduit à
**ce seul hôte**, cookies `Secure` et HSTS d'un an.

> **La liste d'hôtes se referme au moment exact où l'exposition s'élargit.**

C'est le point du fichier. Laisser l'utilisateur deviner qu'il doit resserrer,
c'est garantir qu'il ne le fera pas.

Et ce module ne redirige **jamais** vers HTTPS lui-même : un proxy qui omet
`X-Forwarded-Proto` fait croire à Django que la requête est en clair, Django
renvoie vers `https://`, le proxy repasse sans le header, et le navigateur tourne
jusqu'à l'erreur. C'est le piège classique de l'auto-hébergement, et il ne se
manifeste que chez celui qui héberge — donc jamais chez celui qui l'a écrit.

## Ce qui a été vérifié, et comment

Pas par relecture. La pile a tourné :

| Critère | Résultat |
|---|---|
| `curl -O` puis `docker compose up`, sans éditer un fichier | app en 200 sur `:8000`, identifiants encadrés dans la sortie |
| Connexion avec le mot de passe généré | jeton JWT obtenu |
| `down` puis `up` | migrations « no migrations to apply », `create_admin` silencieux, **le même mot de passe fonctionne** — donc même clé secrète, donc volume d'état correct |
| Profil `demo` | 20 opérations importées, 15 dépenses ventilées, 2 à ranger, 9 enveloppes |
| Compression | 900 546 → 215 636 octets, `Content-Encoding: br` |

Et le test des réglages a été **cassé volontairement** avant d'être cru : forcer
`ALLOWED_HOSTS` à `*` fait bien échouer le test qui prétend que l'exposition le
resserre.

## Le foyer de démonstration n'est pas en règle, exprès

Deux opérations restent sans budget. Une démo entièrement verte ne montre jamais le
Contrôle — l'écran qui fait le sel du module Argent — et laisse croire qu'un vrai
foyer termine un mois sans une seule ligne en suspens.

Le relevé passe par le **vrai chemin d'import** (`import_statement_file` sur un CSV
construit à la volée), jamais par des `objects.create`. L'idempotence vient alors
gratuitement de `unique(account, dedup_hash)` — et surtout, la seed casse le jour
où l'import casse, ce qui est exactement le jour où on veut le savoir.
