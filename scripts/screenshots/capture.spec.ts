import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { expect, test } from '@playwright/test';

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
}

/**
 * Six écrans, choisis sur planche-contact parmi une dizaine.
 *
 * Ce qui a été écarté, et pourquoi — c'est la partie utile de cette liste :
 *
 * - **Analyse des dépenses** : le graphe couvre douze mois dont neuf vides sur
 *   la seed. Neuf colonnes à zéro dans un README racontent un produit vide.
 * - **Projets** : deux fiches, deux barres de budget à peine entamées (90 € sur
 *   8 500 €). Beaucoup de filtres, peu de matière.
 * - **Assistant** : sans clé d'API sur l'instance de démo, l'écran montre à
 *   juste titre une capacité indisponible. Honnête, mais ce n'est pas une
 *   vitrine.
 *
 * L'ordre est celui du README, et il est délibéré : le tableau de bord d'abord
 * (l'argent et le dehors y sont côte à côte), puis l'argent, puis le dehors. Un
 * lecteur qui s'arrête à la troisième image doit déjà avoir compris que ce
 * n'est pas un gestionnaire de comptes.
 */
const SHOTS: Shot[] = [
  { name: '01-dashboard', path: '/app/dashboard', ready: /dashboard|today|household/i },
  { name: '02-bank-journal', path: '/app/money/transactions', ready: /transaction|account|journal/i },
  { name: '03-budgets', path: '/app/money/budgets', ready: /budget/i },
  { name: '04-chicken-coop', path: '/app/chickens', ready: /chicken|egg|hen/i },
  { name: '05-electricity', path: '/app/electricity', ready: /electricity|board|circuit/i },
  { name: '06-tasks', path: '/app/tasks', ready: /task/i },
];

for (const shot of SHOTS) {
  test(`capture ${shot.name}`, async ({ page }) => {
    await page.goto(shot.path);
    // On attend un repère de contenu, pas un délai fixe : une capture prise
    // pendant un squelette de chargement est une capture qui ment.
    await expect(page.locator('body')).toContainText(shot.ready, { timeout: 20_000 });
    await page.waitForLoadState('networkidle');
    // Les graphes et les compteurs s'animent à l'apparition ; sans cette pause
    // on photographie une barre à mi-course.
    await page.waitForTimeout(1200);
    await page.screenshot({ path: path.join(OUT, `${shot.name}.png`) });
  });
}
