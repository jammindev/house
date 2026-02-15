# House Design System

Storybook-driven component library that mirrors the House product tokens (colors, spacing, semantic surfaces) and wraps Radix primitives for consistent UX across surfaces outside the Next.js app.

## Stack

- **React 19 + TypeScript 5** for authoring components.
- **Radix UI** (slot + tooltip today, more primitives can be layered in).
- **Vite** library build (ES + CJS) so the package can be consumed by Next.js or docs tooling.
- **Storybook 8 (React/Vite)** as the canonical playground/documentation site.

## Getting started

```bash
cd design-system
yarn install
yarn storybook   # starts Storybook on http://localhost:6006
```

Build the package (emits `dist/` plus declaration files) with:

```bash
yarn build
```

## Folder map

```
design-system/
  src/
    components/        # Radix-based primitives (Button, Badge, Card, Tooltip, CountBadge)
    styles/            # Global CSS tokens + palette definitions shared with Next.js
    theme/             # ThemeProvider helper for switching palette + light/dark mode
    stories/           # Foundations gallery (palettes) + component stories
    index.ts           # Library entry point exporting everything + importing CSS
  .storybook/          # Storybook 8 (react-vite) config + global decorators
```

## Using the package from Next.js

```tsx
import { ThemeProvider, Button } from "@house/design-system";

export function QuickAction() {
  return (
    <ThemeProvider palette="house">
      <Button size="lg">Nouvelle interaction</Button>
    </ThemeProvider>
  );
}
```

- The `ThemeProvider` ships with the same palette classes defined in `nextjs/src/app/globals.css` (`theme-house`, `theme-blue`, etc.) so swapping palettes in Storybook mirrors the production look & feel.
- Components rely only on CSS variables (`--color-*`, `--background`, `--foreground`, etc.), so adding a new palette is as simple as extending `src/styles/palettes.css` and `paletteOptions`.

## Next steps

- Port additional shadcn-based components (inputs, dialog, select, etc.) into this package using Radix primitives so the dashboard can gradually consume the design system.
- Expose tokens as JSON for tooling (Figma, documentation site) and add visual regression coverage to Storybook once CI lands.
