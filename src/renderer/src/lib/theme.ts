export type ThemePreference = 'dark' | 'light' | 'system'

const STORAGE_KEY = 'theme'

function resolveTheme(preference: ThemePreference): 'dark' | 'light' {
  if (preference === 'system') {
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
  }
  return preference
}

export function getStoredTheme(): ThemePreference {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored === 'dark' || stored === 'light' || stored === 'system') return stored
  return 'dark'
}

export function applyTheme(preference: ThemePreference): 'dark' | 'light' {
  const resolved = resolveTheme(preference)
  document.documentElement.dataset.theme = resolved
  return resolved
}

export function setThemePreference(preference: ThemePreference): 'dark' | 'light' {
  localStorage.setItem(STORAGE_KEY, preference)
  return applyTheme(preference)
}

export function initTheme(): ThemePreference {
  const preference = getStoredTheme()
  applyTheme(preference)
  return preference
}

export function cycleThemePreference(current: ThemePreference): ThemePreference {
  const order: ThemePreference[] = ['dark', 'light', 'system']
  const next = order[(order.indexOf(current) + 1) % order.length]
  setThemePreference(next)
  return next
}

export function themeLabel(preference: ThemePreference): string {
  switch (preference) {
    case 'dark':
      return 'Dark'
    case 'light':
      return 'Light'
    case 'system':
      return 'System'
  }
}
