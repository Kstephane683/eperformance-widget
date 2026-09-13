import { defineStore } from 'pinia'

import type { WidgetConfig } from '@/types/api'

/** Valeurs par défaut ePerformance — overridables via window.ePerformanceConfig */
const DEFAULTS: WidgetConfig & { whatsappNumber: string } = {
  apiUrl: 'https://web-production-4ab53.up.railway.app',
  siteId: 'eperformance_vitrine',
  locale: 'fr',
  color: '#c9a96e',
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
