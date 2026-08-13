# Régénérer les icônes depuis `logo-mark.svg`

Les PNG de `static/icons/` sont rendus **dans un navigateur**, par un canvas, et
non par un outil de rastérisation installé sur la machine.

Ce n'est pas une commodité, c'est le contrôle : le moteur qui rend l'icône est
celui qui l'affichera, et c'est le seul moyen de *regarder* le résultat à 16 px
plutôt que de supposer qu'il tient. Le premier dessin de ce lot se lisait comme
un cadenas — aucune relecture du SVG ne l'aurait dit, une planche-contact l'a dit
en une seconde.

## Ce qu'il faut produire

| Fichier | Taille | `purpose` | Signe occupe |
|---|---|---|---|
| `icon-192.png` | 192 | `any` | 68 %, carré arrondi (22 %) |
| `icon-512.png` | 512 | `any` | 68 %, carré arrondi (22 %) |
| `icon-192-maskable.png` | 192 | `maskable` | **56 %**, carré plein |
| `icon-512-maskable.png` | 512 | `maskable` | **56 %**, carré plein |
| `apple-touch-icon.png` | 180 | — | 68 %, carré arrondi |
| `favicon-32.png` | 32 | — | 68 %, carré arrondi |

Fond `#3F5741`, signe `#FFFFFF`.

**Les deux `purpose` sont deux fichiers.** Android rogne jusqu'à 20 % de chaque
bord d'une icône `maskable` : lui servir l'icône `any` (ce que faisait le
manifeste avant ce lot, avec `"purpose": "any maskable"` sur un seul PNG) rogne
dans le dessin. D'où les 56 % : le signe reste dans le cercle sûr.

## La procédure

1. Servir le dossier de travail en HTTP — un `file://` ne suffit pas, le canvas
   refuse ensuite de s'exporter (origine opaque) :

   ```bash
   mkdir -p /tmp/brand && cp docs/assets/brand/logo-mark.svg /tmp/brand/mark.svg
   cd /tmp/brand && python3 -m http.server 8777
   ```

2. Déposer dans `/tmp/brand/` une page qui charge `mark.svg`, le dessine sur un
   canvas à chaque taille et exporte en PNG (`canvas.toBlob`). Le harnais utilisé
   pour ce lot est reproduit à la fin de ce fichier.

3. **Regarder la planche-contact** — la marque de 16 à 128 px, sur fond clair et
   sur fond sombre — avant de copier quoi que ce soit dans `static/icons/`.

## Deux pièges rencontrés, tous deux silencieux

- **`--` est interdit dans un commentaire XML.** Le premier `logo-mark.svg`
  contenait « `--primary` » dans son en-tête : XML invalide, donc `<img>` refusait
  de le charger, donc le logo était cassé *partout* — sans message d'erreur autre
  qu'une image vide. Valider avant de rendre :

  ```bash
  python3 -c "import xml.dom.minidom;xml.dom.minidom.parse('docs/assets/brand/logo-mark.svg')"
  ```

- **Un `<img>` qui charge un SVG échoue en silence.** `onerror` reçoit un `Event`
  sans message. Pour savoir *pourquoi*, passer le texte par `DOMParser` et lire
  le `<parsererror>` : c'est lui qui nomme la ligne et la colonne.

## Le harnais

À déposer en `/tmp/brand/render.html`. `run()` écrit les PNG via un `POST` vers un
petit serveur local ; adapter la destination si besoin.

```html
<!doctype html><meta charset="utf-8">
<script>
const BRAND = '#3F5741', MARK = '#FFFFFF';
const svg = async () => (await fetch('mark.svg')).text();
const tint = (s, c) => s.replace(/currentColor/g, c);
const img = (s) => new Promise((res, rej) => {
  const i = new Image(); i.onload = () => res(i); i.onerror = rej;
  i.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s);
});
function rounded(x, size, r) {
  x.beginPath();
  x.moveTo(r, 0); x.lineTo(size - r, 0); x.quadraticCurveTo(size, 0, size, r);
  x.lineTo(size, size - r); x.quadraticCurveTo(size, size, size - r, size);
  x.lineTo(r, size); x.quadraticCurveTo(0, size, 0, size - r);
  x.lineTo(0, r); x.quadraticCurveTo(0, 0, r, 0); x.closePath();
}
async function icon(size, name, maskable) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const x = c.getContext('2d');
  const mark = await img(tint(await svg(), MARK));
  x.fillStyle = BRAND;
  const ratio = maskable ? 0.56 : 0.68;
  if (maskable) x.fillRect(0, 0, size, size);
  else { rounded(x, size, size * 0.22); x.fill(); }
  const inner = size * ratio, off = (size - inner) / 2;
  x.drawImage(mark, off, off, inner, inner);
  const blob = await new Promise(r => c.toBlob(r, 'image/png'));
  await fetch('/save?name=' + name, { method: 'POST', body: blob });
}
window.run = async () => {
  await icon(192, 'icon-192.png', false);
  await icon(512, 'icon-512.png', false);
  await icon(192, 'icon-192-maskable.png', true);
  await icon(512, 'icon-512-maskable.png', true);
  await icon(180, 'apple-touch-icon.png', false);
  await icon(32, 'favicon-32.png', false);
  return 'ok';
};
</script>
```
