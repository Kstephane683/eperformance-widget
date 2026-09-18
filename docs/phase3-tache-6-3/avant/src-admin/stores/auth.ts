/**
 * Store auth admin — JWT OAuth2 en localStorage ('eperf_admin_token').
 * Source de vérité d'affichage du shell (App.vue) : isAuthenticated est
 * réactif, un logout déclenché par un 401 API bascule instantanément
 * l'interface sur l'écran de login.
 */
import { defineStore } from 'pinia'

import { ADMIN_TOKEN_KEY, adminLogin } from '../api'

function readStoredToken(): string | null {
  try {
    return localStorage.getItem(ADMIN_TOKEN_KEY)
  } catch {
    return null
  }
}

export const useAdminAuthStore = defineStore('adminAuth', {
  state: () => ({
    token: readStoredToken(),
  }),

  getters: {
    isAuthenticated: (state) => state.token !== null,
  },

  actions: {
    /** POST /api/auth/login (form-urlencoded) puis persistance du token. */
    async login(email: string, password: string): Promise<void> {
      const token = await adminLogin(email, password)
      this.token = token
      try {
        localStorage.setItem(ADMIN_TOKEN_KEY, token)
      } catch {
        /* localStorage indisponible : la session vivra en mémoire */
      }
    },

    /** Clear token (manuel ou automatique sur 401 via api.ts). */
    logout(): void {
      this.token = null
      try {
        localStorage.removeItem(ADMIN_TOKEN_KEY)
      } catch {
        /* ignore */
      }
    },
  },
})
