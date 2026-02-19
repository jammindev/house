/**
 * shell.ts — Bundle global pour les templates Django
 *
 * Expose sur window :
 *  - htmx      : navigation SPA-like via hx-boost
 *  - Alpine    : toggle sidebar mobile
 *  - lucide    : icônes data-lucide="..."
 *
 * Chargé une seule fois dans base_app.html via {% vite_asset 'src/shell.ts' %}
 */

import htmx from "htmx.org";
import Alpine from "alpinejs";
import { createIcons, icons } from "lucide";

// ── HTMX ─────────────────────────────────────────────────────────────────────
(window as unknown as Record<string, unknown>).htmx = htmx;

// ── Alpine ───────────────────────────────────────────────────────────────────
(window as unknown as Record<string, unknown>).Alpine = Alpine;
Alpine.start();

// ── Lucide ───────────────────────────────────────────────────────────────────
function initLucide() {
  createIcons({ icons });
}

// Init initiale
initLucide();

// Relance après chaque swap HTMX (nouveau contenu injecté dans #main-content)
document.addEventListener("htmx:afterSwap", initLucide);

// La progress bar et le sync aria-current sont gérés dans le script inline
// de base_app.html pour rester au plus proche du DOM Django.
