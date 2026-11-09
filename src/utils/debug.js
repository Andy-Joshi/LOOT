/**
 * Utility to check if developer/debug mode is active.
 *
 * Developer tools and art review buttons are hidden from the normal UI,
 * but can be enabled for testing and verification via:
 * - URL query parameter: ?debug=1 or ?debug=true
 * - URL hash: #debug
 * - Global window property: window.__LOOT_DEBUG__ = true
 */
export function isDebugMode() {
  if (typeof window === 'undefined') return false
  try {
    const params = new URLSearchParams(window.location.search)
    if (params.get('debug') === '1' || params.get('debug') === 'true') {
      return true
    }
    if (window.location.hash.includes('debug')) {
      return true
    }
    if (window.__LOOT_DEBUG__) {
      return true
    }
    return false
  } catch {
    return false
  }
}
