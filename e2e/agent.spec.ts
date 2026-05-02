import { test, expect } from './fixtures';
import type { Page, Route } from '@playwright/test';

const PRIVACY_KEY = 'agent.privacyAccepted.v1';

interface MockAnswer {
  answer: string;
  citations: Array<{
    entity_type: string;
    id: string;
    label: string;
    snippet: string;
    url_path: string;
  }>;
  metadata?: Record<string, unknown>;
}

async function mockAskAgent(page: Page, payload: MockAnswer | (() => MockAnswer)): Promise<void> {
  await page.route('**/api/agent/ask/', async (route: Route) => {
    const data = typeof payload === 'function' ? payload() : payload;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        answer: data.answer,
        citations: data.citations,
        metadata: data.metadata ?? { duration_ms: 1234, tokens_in: 100, tokens_out: 30, model: 'claude-haiku-4-5-20251001', hits_count: 1 },
      }),
    });
  });
}

async function setPrivacyAccepted(page: Page, accepted: boolean): Promise<void> {
  await page.addInitScript(([key, value]) => {
    if (value) {
      localStorage.setItem(key, 'true');
    } else {
      localStorage.removeItem(key);
    }
  }, [PRIVACY_KEY, accepted]);
}

// ---------------------------------------------------------------------------
// Page d'accueil + mention de confidentialité
// ---------------------------------------------------------------------------

test('affiche la page agent et la mention de confidentialité au premier usage', async ({ page }) => {
  await setPrivacyAccepted(page, false);
  await page.goto('/app/agent');

  await expect(page).toHaveURL(/\/app\/agent/);
  // La mention de confidentialité s'affiche d'abord (modale Radix qui aria-hide le reste).
  await expect(page.getByTestId('agent-privacy-notice')).toBeVisible();
  await expect(page.getByTestId('agent-input')).toBeDisabled();

  // Une fois acceptée, la modale se ferme et la page agent est utilisable.
  await page.getByTestId('agent-privacy-accept').click();
  await expect(page.getByTestId('agent-privacy-notice')).not.toBeVisible();
  await expect(page.getByRole('heading', { name: 'Agent' })).toBeVisible();
  await expect(page.getByTestId('agent-input')).toBeEnabled();
});

test('ne montre pas la mention si déjà acceptée', async ({ page }) => {
  await setPrivacyAccepted(page, true);
  await page.goto('/app/agent');

  await expect(page.getByTestId('agent-privacy-notice')).not.toBeVisible();
  await expect(page.getByTestId('agent-input')).toBeEnabled();
});

// ---------------------------------------------------------------------------
// Pose d'une question + bulles + citations
// ---------------------------------------------------------------------------

test('pose une question et reçoit une réponse avec citation cliquable', async ({ page }) => {
  await setPrivacyAccepted(page, true);
  await mockAskAgent(page, {
    answer:
      "D'après ta facture Engie de mars 2026, tu as payé 142,67€ <cite id=\"document:abc-123\"/>.",
    citations: [
      {
        entity_type: 'document',
        id: 'abc-123',
        label: 'Facture Engie mars 2026',
        snippet: 'Total à payer 142,67€ TTC',
        url_path: '/app/documents/abc-123',
      },
    ],
  });

  await page.goto('/app/agent');

  await page.getByTestId('agent-input').fill("Combien j'ai payé Engie en mars ?");
  await page.getByTestId('agent-send').click();

  // Bulle question
  await expect(page.getByTestId('agent-bubble-user')).toContainText("Combien j'ai payé Engie en mars ?");

  // Bulle réponse
  const agentBubble = page.getByTestId('agent-bubble-agent');
  await expect(agentBubble).toBeVisible();
  await expect(agentBubble).toContainText("D'après ta facture Engie");

  // Citation cliquable (au moins une, dans la bulle agent)
  const citation = agentBubble.getByTestId('agent-citation').first();
  await expect(citation).toBeVisible();
  await expect(citation).toContainText('Facture Engie mars 2026');
});

test('clique sur une citation et navigue vers la fiche entité', async ({ page }) => {
  await setPrivacyAccepted(page, true);
  await mockAskAgent(page, {
    answer: 'Voici l\'équipement <cite id="equipment:xyz-789"/>.',
    citations: [
      {
        entity_type: 'equipment',
        id: 'xyz-789',
        label: 'Chaudière Atlantic',
        snippet: 'Atlantic gaz condensation',
        url_path: '/app/equipment/xyz-789',
      },
    ],
  });

  await page.goto('/app/agent');
  await page.getByTestId('agent-input').fill('Quel est mon équipement de chauffage ?');
  await page.getByTestId('agent-send').click();

  const citation = page.getByTestId('agent-bubble-agent').getByTestId('agent-citation').first();
  await expect(citation).toBeVisible();

  // Le lien pointe vers la bonne URL — pas besoin de cliquer puisqu'aucune route equipment/xyz-789 n'existe en DB E2E.
  await expect(citation).toHaveAttribute('href', '/app/equipment/xyz-789');
});

// ---------------------------------------------------------------------------
// "Je ne sais pas" → pas de citation
// ---------------------------------------------------------------------------

test('réponse "je ne sais pas" → message sans citation', async ({ page }) => {
  await setPrivacyAccepted(page, true);
  await mockAskAgent(page, {
    answer:
      "Je n'ai pas trouvé d'information pertinente dans les données de ton foyer pour répondre à cette question.",
    citations: [],
    metadata: { reason: 'no_household_match' },
  });

  await page.goto('/app/agent');
  await page.getByTestId('agent-input').fill('Question hors-domaine zzz');
  await page.getByTestId('agent-send').click();

  const bubble = page.getByTestId('agent-bubble-agent');
  await expect(bubble).toContainText("Je n'ai pas trouvé");
  await expect(bubble.getByTestId('agent-citation')).toHaveCount(0);
});
