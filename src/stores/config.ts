import { defineStore } from 'pinia'

import type { WidgetConfig } from '@/types/api'

/**
 * Couleur d'accent par défaut, selon le thème résolu.
 * Valeurs canoniques eperf.css : `--gold` sombre = #c9a96e (l.245),
 * clair = #856b37 (DÉCISION D6, DESIGN-SYSTEM-UNIFIE §2.3 — #8a6f38 mesure
 * 4,37:1 sur --bg2, sous le seuil AA).
 * Le SDK fournit déjà cette valeur en query param ; ce défaut ne sert qu'au
 * développement direct du widget (sans SDK).
 */
function defaultGold(): string {
  const theme =
    document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light'
  return theme === 'dark' ? '#c9a96e' : '#856b37'
}

/** Valeurs par défaut ePerformance — overridables via window.ePerformanceConfig */
const DEFAULTS: WidgetConfig & { whatsappNumber: string } = {
  apiUrl: 'https://web-production-4ab53.up.railway.app',
  siteId: 'eperformance_vitrine',
  locale: 'fr',
  color: defaultGold(),
  whatsappNumber: '+2250151170666',
}

export const useConfigStore = defineStore('config', {
  state: () => ({
    config: { ...DEFAULTS } as WidgetConfig & { whatsappNumber: string },
  }),
  actions: {
    /** Applique les overrides du SDK (window.ePerformanceConfig) */
    configure(overrides: Partial<WidgetConfig>) {
      Object.assign(this.config, overrides)
    },
  },
})
