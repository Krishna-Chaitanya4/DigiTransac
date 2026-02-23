/**
 * Detect if the app is running as an installed PWA (standalone mode).
 * Works across Chrome, Safari (iOS standalone property), and Edge.
 */
export function isPwaStandalone(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches
    || (navigator as unknown as { standalone?: boolean }).standalone === true; // iOS Safari
}
