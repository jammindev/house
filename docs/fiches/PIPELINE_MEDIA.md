# Pipeline média — où vivent les octets, qui les sert, quand ils sont transformés

> Fiche liée au [parcours 29](../parcours/PARCOURS_29_ALBUM_DU_FOYER.md).
> Voir aussi [AUTO_HEBERGEMENT.md](AUTO_HEBERGEMENT.md) pour la notion de
> capacité optionnelle, dont ce chantier fait un usage central.

## 1. Le problème

Un fichier n'est pas une ligne de base de données. Il est gros, il coûte cher à
déplacer, et il a **trois vies distinctes** : il arrive, il est transformé, il est
servi. Tant qu'un foyer en a deux cents, la solution la plus simple gagne à tous
les coups — on écrit sur le disque, on transforme dans la requête, on sert avec le
serveur web. C'est ce que fait House aujourd'hui, et c'était le bon choix.

À dix mille photos, chacun de ces trois raccourcis se paie, et ils se paient
séparément :

- **écrire sur le disque du serveur** finit par saturer un volume qu'on ne peut
  agrandir qu'en redémarrant la machine ;
- **transformer dans la requête** transforme un import de deux cents photos en
  deux cents requêtes longues, chacune occupant un worker gunicorn pendant que le
  processeur ré-encode un HEIC ;
- **servir depuis le serveur** met toute la bande passante des images sur le lien
  d'une seule machine.

Le piège, c'est que ces trois problèmes *ressemblent* à un seul (« il faudrait
passer au cloud »). Les traiter comme un seul produit une réécriture qu'on ne
peut plus livrer par morceaux.

## 2. Le concept en deux phrases

Un pipeline média répond à **trois questions indépendantes** : où vivent les
octets, qui les envoie au navigateur, et à quel moment ils sont transformés.
Chacune se tranche séparément, et une architecture saine est celle où changer la
réponse à l'une ne force pas à changer les deux autres.

## 3. Comment on l'applique dans house

### Où vivent les octets

Deux emplacements possibles, derrière la même abstraction Django
(`default_storage`) :

- **le disque du serveur** — le défaut, et le seul mode de l'auto-hébergement ;
- **un stockage objet S3-compatible** — déclaré par configuration, jamais deviné.

La bascule est un **réglage explicite**, pas une déduction depuis `DEBUG` ou
depuis la présence d'une variable. C'est la leçon déjà payée par
`PROTECTED_MEDIA_ACCEL` : un mécanisme de transport qui se déduit d'un réglage de
confidentialité produit, le jour où on sort des deux déploiements connus, une
image cassée sans une ligne d'erreur.

### Qui envoie les octets

Trois modes, et c'est ici que se joue le contrôle d'accès :

| Mode | Qui sert | Où l'accès est vérifié |
|---|---|---|
| Django | gunicorn | dans la vue, avant de lire le fichier |
| `X-Accel-Redirect` | Nginx | dans la vue, qui répond un en-tête |
| URL présignée | le stockage objet | dans la vue **qui fabrique l'URL** |

Les deux premiers gardent Django sur le chemin des octets. Le troisième l'en
sort — et c'est **le vrai coût de l'option**, qu'il faut nommer précisément.

`apps/core/views_media.py` est la seule porte du foyer qui ne passe ni par un
viewset ni par un queryset : elle reçoit un chemin et rend des octets. Elle porte
trois règles gagnées au prix de vrais incidents, dont un où 177 documents sur 202
sont devenus invisibles en production (issue #517). La troisième dit l'essentiel :
**un fichier se rattache à un foyer en base, pas par la forme de son chemin.**

Une URL présignée ne connaît pas cette règle. Elle est un **secret porteur** :
qui l'a, l'ouvre. La sécurité repose donc entièrement sur le fait qu'elle est
courte à vivre et qu'elle ne s'obtient qu'en demandant à Django, qui, lui, fait
toujours le contrôle du foyer et de `is_private`. D'où trois contraintes non
négociables :

1. **durée de validité courte** (quelques minutes), suffisante pour afficher une
   page, insuffisante pour partager un lien ;
2. **jamais persistée** — ni dans un JSON stocké, ni dans un index de recherche,
   ni dans une notification ;
3. **jamais fabriquée en masse à l'avance** : une galerie signe les vignettes de
   la page affichée, pas celles des dix mille photos du foyer.

### Quand ils sont transformés

Aujourd'hui : dans la requête. Lecture EXIF, ré-encodage, redimensionnement,
vignettes, OCR — tout se passe pendant que le navigateur attend.

Demain : **l'upload écrit, le worker transforme.** La requête d'upload fait le
strict minimum — vérifier le quota, poser le fichier, créer la ligne — et rend la
main. Le reste est une tâche de fond, et le document porte un
`processing_state`.

Le détail qui décide de la qualité perçue : **une photo dont la vignette n'est
pas encore générée est un état, pas une erreur.** Si la galerie ne sait pas
distinguer les deux, un import de deux cents photos affiche deux cents cases
cassées, et l'utilisateur conclut que l'import a échoué alors qu'il se déroule
parfaitement. C'est la même famille de bug que « un compteur à zéro a deux
sens » : l'absence d'information et l'information « rien » ne se disent jamais
pareil.

## 4. Pourquoi cette implémentation

### Une file adossée à Postgres, pas Celery + Redis

La pile de production n'a **pas de Redis** ; elle a `db`, `web`, deux conteneurs
`scheduler` et `nginx`. Le projet sait donc déjà faire tourner un processus de
fond — ce qu'il ne sait pas faire tourner, c'est un *broker*.

Introduire Redis, c'est un service de plus à sauvegarder, à surveiller, à mettre
à jour — et surtout à **imposer à l'auto-hébergeur**, dont la pile tient
aujourd'hui en trois conteneurs. Une file dont le broker est la base Postgres
déjà présente ne coûte qu'un conteneur worker, sur le modèle exact des
`scheduler` existants.

La contrepartie est réelle et doit être écrite : un broker ORM interroge la base
en boucle, et ça ne passe pas à l'échelle d'un SaaS multi-milliers de foyers.
C'est un **choix daté**, juste au volume d'un foyer et à rejuger si l'échelle
change — pas une position de principe.

### L'upload direct au stockage, et son corollaire de sécurité

Deux cents photos à 4 Mo, c'est 800 Mo qui traversent gunicorn puis Nginx pour
finir dans un bucket. Faire signer au serveur une autorisation d'écriture, et
laisser le navigateur envoyer directement, retire complètement Django du chemin
des octets.

Le corollaire n'est pas optionnel : **le serveur ne voit plus le contenu au
moment de l'upload.** Or `validate_upload` vérifie les *magic bytes* et ignore
délibérément le `Content-Type` annoncé par le client. Cette vérification ne peut
donc plus vivre là où elle est. Elle se déplace dans le worker, et le document
reste en **quarantaine** — `processing_state` non résolu, jamais servi, jamais
listé — tant qu'elle n'a pas réussi. Sans ce déplacement, l'upload direct
revient à accepter n'importe quel fichier dans le bucket sur la seule parole du
client.

### Un curseur, pas un offset

Une galerie paginée par `?page=2` suppose que la liste ne bouge pas entre deux
pages. Pendant un import, elle bouge par le haut : chaque photo qui arrive
décale tout, et l'utilisateur qui fait défiler voit des doublons et rate des
photos — sans qu'aucune requête soit fausse.

La pagination par curseur ancre la page suivante sur **la dernière ligne lue**,
pas sur un rang. Elle exige en revanche un ordre **total et stable** : la galerie
trie par `effective_date` (un `COALESCE(taken_at, created_at)` annoté), qui n'est
pas unique — deux photos d'une même rafale partagent la seconde. Le tri doit donc
être complété par un départage stable, sinon le curseur saute des lignes.

### Compter les octets sur le disque, pas l'original

Un fichier importé produit plusieurs objets : l'original, la version normalisée
(ré-encodée, redimensionnée), et les vignettes. Un quota qui ne compte que
l'original annonce à l'utilisateur 20 à 40 % de moins que ce qu'il occupe
réellement — et c'est l'hébergeur qui paie la différence. Le compteur mesure ce
qui est stocké.

Et il ne se dénormalise pas : c'est un `Sum` sur une colonne indexée, recalculable
à tout moment — même règle que le solde bancaire et que le « dépensé » d'un
budget. Un total dénormalisé qui dérive est pire que pas de total, parce que
personne ne peut plus dire lequel des deux chiffres est faux.

## 5. Ce qu'on a écarté et pourquoi

- **Celery + Redis.** Le standard de l'écosystème, et le bon choix dès qu'il y a
  plusieurs machines. Ici il ajoute un service à opérer et une dépendance à
  imposer à l'auto-hébergement, pour une charge qui tient largement dans un
  worker.
- **Un `PAGE_SIZE` global dans `REST_FRAMEWORK`.** Ça paginerait *toutes* les
  réponses de l'API d'un coup, donc changerait leur forme pour cinquante-sept
  viewsets et casserait tous les clients qui lisent un tableau. La pagination se
  pose viewset par viewset, en commençant par celui qui en souffre.
- **Redimensionner l'image dans le navigateur avant l'envoi.** Ça diviserait la
  bande passante par dix — et ça détruirait l'EXIF, donc la date de prise de vue,
  donc le tri de la galerie. Le piège est déjà documenté et a déjà mordu une fois
  côté serveur (`read_taken_at` doit précéder `normalize_image`). L'original part
  tel quel ; c'est le worker qui allège.
- **Rendre le stockage objet obligatoire.** Ce serait imposer un compte chez un
  fournisseur à qui veut héberger House chez lui — l'inverse exact de ce que le
  parcours 28 a construit.
- **Des URLs non devinables sur un stockage public.** Un UUID dans un chemin
  public n'est pas un contrôle d'accès : il fuit par le presse-papier, l'historique
  du navigateur, le référent HTTP. Une photo d'intérieur mérite un contrôle réel,
  pas une adresse difficile à taper.

## 6. Pour aller plus loin

- [django-storages](https://django-storages.readthedocs.io/) — backends de
  stockage Django, dont S3
- [Amazon S3 — presigned URLs](https://docs.aws.amazon.com/AmazonS3/latest/userguide/using-presigned-url.html)
  — le mécanisme, valable pour tous les fournisseurs S3-compatibles
- [DRF — Cursor pagination](https://www.django-rest-framework.org/api-guide/pagination/#cursorpagination)
  — et la contrainte d'ordre total qu'elle impose
- [django-q2](https://django-q2.readthedocs.io/) — file de tâches à broker ORM
- [Apple Shortcuts — Find Photos](https://support.apple.com/guide/shortcuts/) —
  filtrage par date et par lieu côté téléphone
