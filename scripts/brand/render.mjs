import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium } from '@playwright/test';

/**
 * L'aperçu social, rendu dans un navigateur puis quantifié.
 *
 * Pourquoi un script et pas une note « refaire l'image dans Figma » : cette
 * image porte **le même texte que le README**, et les deux dérivent. La
 * première version disait « the money, the works » et s'arrêtait à « everything
 * a household keeps alive » — elle était juste le jour où elle a été faite, et
 * fausse trois heures plus tard, quand le README a été recadré sur l'assistant.
 * Une image de marque qu'on ne sait pas refaire en une commande ne se corrige
 * jamais : on la garde parce que la refaire coûte trop cher.
 *
 * C'est la même règle que les captures du README (`scripts/screenshots/`) et
 * que les icônes (`docs/assets/brand/regenerate-icons.md`) : ce qui est versionné
 * doit être **ce que le script produit**, sinon la reproductibilité est une
 * affirmation invérifiable.
 *
 *   node scripts/brand/render.mjs
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const SRC = path.join(__dirname, 'social-preview.html');
const OUT = path.join(ROOT, 'docs/assets/brand/social-preview.png');

// 1280×640 : le format que GitHub attend pour un aperçu social, et le ratio 2:1
// que reprennent Slack, Mastodon et les cartes Twitter. Rendu à l'échelle 1 —
// GitHub redimensionne, et un PNG rétina de 4 Mo pour une vignette lue à 500 px
// pèserait sur le dépôt sans rien ajouter à l'écran.
const WIDTH = 1280;
const HEIGHT = 640;

const browser = await chromium.launch();
try {
  const page = await browser.newPage({
    viewport: { width: WIDTH, height: HEIGHT },
    deviceScaleFactor: 1,
  });
  await page.goto(`file://${SRC}`);
  // Sans cette attente, la capture part parfois sur la police de repli : le
  // texte est alors au bon endroit mais pas dans la bonne fonte, ce qui ne se
  // voit qu'en comparant deux rendus côte à côte.
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: OUT });
} finally {
  await browser.close();
}

console.log(`rendu → ${path.relative(ROOT, OUT)}`);
