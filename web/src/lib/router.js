// Minimal client-side router: no new dependency, just History API + a tiny
// path matcher. Cortex Lab only needs two routes at this stage (Section 3 of
// docs/UI_VISION.md defines the rest of the route map for later phases).
import { useEffect, useState, useCallback } from 'react'

const ROUTES = [
  { pattern: '/', name: 'overview', params: [] },
  { pattern: '/missions/:missionId', name: 'mission', params: ['missionId'] },
]

function matchPath(pathname) {
  for (const route of ROUTES) {
    const patternParts = route.pattern.split('/').filter(Boolean)
    const pathParts = pathname.split('/').filter(Boolean)
    if (patternParts.length !== pathParts.length) continue

    const params = {}
    let matched = true
    for (let i = 0; i < patternParts.length; i += 1) {
      const patternPart = patternParts[i]
      const pathPart = pathParts[i]
      if (patternPart.startsWith(':')) {
        params[patternPart.slice(1)] = decodeURIComponent(pathPart)
      } else if (patternPart !== pathPart) {
        matched = false
        break
      }
    }
    if (matched) return { name: route.name, params }
  }
  return { name: 'not-found', params: {} }
}

export function navigate(path) {
  if (typeof window === 'undefined') return
  // Preserve the current query string (e.g. ?demo=1) unless the caller's
  // path already carries its own — internal navigation must not silently
  // drop it, since useLedger reads it fresh on every render.
  const target = path.includes('?') ? path : `${path}${window.location.search}`
  if (window.location.pathname + window.location.search === target) return
  window.history.pushState({}, '', target)
  window.dispatchEvent(new PopStateEvent('popstate'))
}

export function useRoute() {
  const [pathname, setPathname] = useState(() => (
    typeof window === 'undefined' ? '/' : window.location.pathname
  ))

  useEffect(() => {
    const onPopState = () => setPathname(window.location.pathname)
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  const goTo = useCallback((path) => navigate(path), [])

  return { ...matchPath(pathname), pathname, navigate: goTo }
}
