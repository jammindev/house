/**
 * Notifications client utilities — shared between React components and vanilla JS.
 *
 * BELL_REFRESH_EVENT mirrors BELL_REFRESH_EVENT in notifications/service.py.
 * If the name changes, update both places.
 */

export const BELL_REFRESH_EVENT = 'bellRefresh';

/**
 * Dispatch the bellRefresh event on document.body so HTMX re-fetches the
 * bell fragment on all listening divs (desktop + mobile).
 */
export function triggerBellRefresh(): void {
  document.body.dispatchEvent(new Event(BELL_REFRESH_EVENT));
}
