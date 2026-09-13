import { defineStore } from 'pinia'

import type { WidgetConfig } from '@/types/api'

/** Valeurs par défaut ePerformance — overridables via window.ePerformanceConfig */
const DEFAULTS: WidgetConfig = {
  apiUrl: 'https://web-production-4ab53.up.railway.app',
  siteId: 'eperformance_vitrine',
  locale: 'fr',
  color: '#c9a96e',
}

export const useConfigStore = defineStore('config', {
  state: () => ({
    config: { ...DEFAULTS } as WidgetConfig,
  }),
  actions: {
    /** Applique les overrides du SDK (window.ePerformanceConfig) */
    configure(overrides: Partial<WidgetConfig>) {
      Object.assign(this.config, overrides)
    },
  },
})
