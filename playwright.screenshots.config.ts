import { defineConfig, devices } from '@playwright/test';

/**
 * Les captures du README, produites par le même harnais que les tests E2E.
 *
 * Pourquoi une configuration séparée plutôt qu'un `.spec.ts` de plus dans
 * `e2e/` : générer des images n'est pas un test. Rangées avec les tests, ces
 * captures tourneraient à chaque `npm run test:e2e`, réécriraient six fichiers
 * versionnés à chaque exécution, et pollueraient le diff de toute PR qui touche
 * au style. On veut l'inverse — un geste explicite, `npm run screenshots`.
 *
 * Ce qui est **réutilisé**, en revanche, c'est tout ce qui compte :
 * `e2e/global.setup.ts` migre, lance `seed_demo_data --flush` et se connecte.
 * Les captures sortent donc du **foyer de démonstration** et de lui seul —
 * c'est le critère 3 du lot 6 (« aucune donnée d'un foyer réel dans
 * docs/assets/ ») tenu par construction plutôt que par vigilance.
 */
export default defineConfig({
  fullyParallel: false,
  workers: 1,
  reporter: 'list',

  use: {
    baseURL: 'http://localhost:8002',
    // Les captures du README anglais montrent l'interface en anglais. Le
    // `locale` de l'utilisateur de démo est basculé dans le setup ; celui du
    // navigateur suit, pour les dates et les montants.
    locale: 'en-GB',
    timezoneId: 'Europe/Paris',
    screenshot: 'off',
    video: 'off',
  },

  webServer: {
    command:
      'DJANGO_SETTINGS_MODULE=config.settings.e2e venv/bin/python manage.py runserver 127.0.0.1:8002 --noreload',
    url: 'http://127.0.0.1:8002',
    reuseExistingServer: false,
    stdout: 'pipe',
    stderr: 'pipe',
    timeout: 60_000,
  },

  projects: [
    // `testMatch` se résout depuis le `testDir` du projet : sans un `testDir`
    // propre à chacun, le setup n'est jamais trouvé — et les captures échouent
    // toutes sur un `storageState` absent, ce qui ne dit pas du tout que c'est
    // l'authentification qui manque.
    // Le setup est celui des tests E2E, et il cherche « Mot de passe » : il doit
    // donc tourner en français comme eux. Les captures, elles, sont prises en
    // anglais juste après — c'est le `beforeAll` de `capture.spec.ts` qui
    // bascule la langue du foyer de démonstration.
    { name: 'setup', testDir: './e2e', testMatch: 'global.setup.ts', use: { locale: 'fr-FR' } },
    {
      name: 'capture',
      testDir: './scripts/screenshots',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 900 },
        deviceScaleFactor: 2,
        storageState: 'e2e/.auth/user.json',
      },
      dependencies: ['setup'],
    },
  ],
});
