import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { expect, test, type Page } from '@playwright/test';

/**
 * Les captures du README.
 *
 * Elles sortent du **foyer de démonstration** (`seed_demo_data`, « Famille
 * Mercier », adresses `@demo.local`) et de lui seul : le harnais est celui des
 * tests E2E, qui purge et resème la base avant de se connecter. C'est le
 * critère 3 du lot 6 — « aucune donnée d'un foyer réel dans `docs/assets/` » —
 * tenu par construction, et pas par la vigilance de celui qui prend les images.
 *
 * ⚠️ **Ce que ces captures doivent montrer.** La doc produit du parcours 28 est
 * explicite : un tableau de budgets et une liste de tâches racontent un
 * gestionnaire de comptes, et vendraient le produit générique plutôt que le
 * vrai. Ce qui distingue Maisonnée d'un YNAB auto-hébergé, c'est que les poules,
 * l'eau et l'électricité sont dans le même registre que l'argent. Le dehors doit
 * donc être dans la sélection, pas en annexe.
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const OUT = path.join(ROOT, 'docs/assets/screenshots');
const PYTHON = path.join(ROOT, 'venv/bin/python');

/**
 * Quantification sur 256 couleurs, en fin de course.
 *
 * Une capture d'interface est faite d'aplats : elle se quantifie sans perte
 * visible et perd ~60 % de son poids. Six captures rétina pèsent 1,9 Mo brutes
 * pour un dépôt de 9,7 Mo — soit 20 % de plus rien qu'en images, et le parcours
 * demande explicitement de surveiller ça.
 *
 * L'étape est **dans le harnais**, pas dans une note « pensez à compresser » :
 * sinon les fichiers versionnés cessent d'être ceux que le script produit, et la
 * reproductibilité (critère 2 du lot) devient une affirmation invérifiable.
 */
function optimise() {
  execFileSync(
    PYTHON,
    [
      '-c',
      [
        'import pathlib',
        'from PIL import Image',
        `for p in sorted(pathlib.Path(${JSON.stringify(OUT)}).glob('*.png')):`,
        "    im = Image.open(p).convert('RGB')",
        '    q = im.quantize(colors=256, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)',
        '    q.save(p, optimize=True)',
      ].join('\n'),
    ],
    { cwd: ROOT },
  );
}

test.afterAll(() => optimise());

/** Les captures partent en anglais : le README que lit un inconnu est en anglais. */
test.beforeAll(() => {
  execFileSync(
    PYTHON,
    [
      path.join(ROOT, 'manage.py'),
      'shell',
      '-c',
      "from accounts.models import User; User.objects.filter(email__endswith='@demo.local').update(locale='en')",
    ],
    { cwd: ROOT, env: { ...process.env, DJANGO_SETTINGS_MODULE: 'config.settings.e2e' } },
  );
});

interface Shot {
  /** Nom du fichier, sans extension. */
  name: string;
  path: string;
  /** Un repère qui prouve que la page a fini de charger — jamais un `waitForTimeout` seul. */
  ready: RegExp | string;
  /** Un geste à faire avant de photographier (ouvrir une conversation, un onglet…). */
  action?: (page: Page) => Promise<void>;
}

/**
 * Sept écrans, choisis sur planche-contact, et **dans cet ordre**.
 *
 * L'ordre est la partie qui compte. Une première version ouvrait sur le tableau
 * de bord et rangeait l'assistant en annexe — ce qui racontait un gestionnaire
 * de comptes avec une option IA, c'est-à-dire l'inverse du produit. Ce qui est
 * unique ici n'est pas le budget : c'est qu'un assistant puisse répondre sur le
 * foyer, et il ne le peut que parce que les chantiers, le journal, les documents
 * et les compteurs sont dans le même registre.
 *
 * D'où : l'assistant qui cite ses sources, puis la mémoire dans laquelle il
 * puise, puis seulement le reste.
 *
 * Écartés, et pourquoi :
 *
 * - **Analyse des dépenses** : le graphe couvre douze mois dont neuf vides sur
 *   la seed. Neuf colonnes à zéro dans un README racontent un produit vide.
 * - **Projets** : deux fiches, deux barres de budget à peine entamées (90 € sur
 *   8 500 €). Beaucoup de filtres, peu de matière.
 * - **Tâches** : une liste de tâches ressemble à toutes les listes de tâches.
 */
const SHOTS: Shot[] = [
  {
    name: '01-assistant',
    path: '/app/agent',
    ready: /Novoceram/i,
    // ⚠️ Une modale de consentement (« Before you start ») recouvre la page à la
    // première visite : elle dit ce qui part chez le fournisseur avant qu'on
    // s'en serve. Elle interceptait tous les clics — trois sélecteurs ont
    // échoué avant qu'on la voie, chacun avec un message qui n'en parlait pas.
    // Une fois la modale levée, il reste à ouvrir la conversation : la page
    // s'affiche sur l'état vide, elle ne reprend pas la dernière discussion.
    action: async (page) => {
      const notice = page.getByRole('button', { name: /got it|j'ai compris|compris/i });
      if (await notice.count()) await notice.first().click();
      await page.locator('[data-testid="agent-conversation-item"] button').first().click();
      // Le fil est ouvert quand la référence citée est à l'écran — pas avant.
      await expect(page.locator('body')).toContainText(/NOV-6060-ANT/i, { timeout: 10_000 });
    },
  },
  { name: '02-journal', path: '/app/interactions', ready: /journal|activity|note/i },
  { name: '03-dashboard', path: '/app/dashboard', ready: /dashboard|today|household/i },
  { name: '04-bank-journal', path: '/app/money/transactions', ready: /transaction|account|journal/i },
  { name: '05-budgets', path: '/app/money/budgets', ready: /budget/i },
  { name: '06-chicken-coop', path: '/app/chickens', ready: /chicken|egg|hen/i },
  { name: '07-electricity', path: '/app/electricity', ready: /electricity|board|circuit/i },
];

for (const shot of SHOTS) {
  test(`capture ${shot.name}`, async ({ page }) => {
    await page.goto(shot.path);
    // On attend un repère de contenu, pas un délai fixe : une capture prise
    // pendant un squelette de chargement est une capture qui ment.
    await expect(page.locator('body')).toContainText(shot.ready, { timeout: 20_000 });
    if (shot.action) await shot.action(page);
    await page.waitForLoadState('networkidle');
    // Les graphes et les compteurs s'animent à l'apparition ; sans cette pause
    // on photographie une barre à mi-course.
    await page.waitForTimeout(1200);
    await page.screenshot({ path: path.join(OUT, `${shot.name}.png`) });
  });
}
