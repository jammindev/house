/**
 * Read the active household ID injected by Django's `active_household_context`
 * processor via the `house-global-context` <script> tag in base_app.html.
 *
 * Usage:
 *   const householdId = useHouseholdId(); // string | undefined
 */
export function useHouseholdId(): string | undefined {
  const script = document.getElementById('house-global-context');
  if (!script?.textContent) return undefined;
  try {
    const val = JSON.parse(script.textContent);
    return typeof val === 'string' ? val : undefined;
  } catch {
    return undefined;
  }
}
