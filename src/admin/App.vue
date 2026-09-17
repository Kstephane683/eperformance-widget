<template>
  <!--
    Shell admin : bascule Login / Cockpit pilotée par le store auth
    (réactive, y compris sur 401 → logout automatique).

    Cockpit unifié : navigation par modules (sidebar desktop, tabs
    horizontales mobiles) → router-view. Le badge affiche les
    conversations en attente humaine (rafraîchi 30s).
  -->
  <LoginView v-if="!auth.isAuthenticated" />
  <div v-else class="cockpit">
    <nav class="cockpit__nav">
      <div class="cockpit__brand">
        <span class="cockpit__brand-badge" aria-hidden="true">A</span>
        <span class="cockpit__brand-name">ePerformance</span>
      </div>

      <div class="cockpit__modules">
        <RouterLink
          v-for="mod in modules"
          :key="mod.to"
          :to="{ name: mod.to }"
          class="cockpit__link"
          :class="{ 'cockpit__link--active': isActive(mod.to) }"
        >
          <span class="cockpit__icon" aria-hidden="true" v-html="mod.icon"></span>
          <span class="cockpit__label">{{ mod.label }}</span>
          <span v-if="mod.badge && stats && stats[mod.badge] > 0" class="cockpit__badge">
            {{ stats[mod.badge] }}
          </span>
        </RouterLink>
      </div>

      <button type="button" class="cockpit__logout" @click="logout">Déconnexion</button>
    </nav>

    <main class="cockpit__main">
      <RouterView />
    </main>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { RouterLink, RouterView, useRoute, useRouter } from 'vue-router'

import { fetchAdminStats, type AdminStats } from './api'
import { useAdminAuthStore } from './stores/auth'

const auth = useAdminAuthStore()
const route = useRoute()
const router = useRouter()

interface ModuleEntry {
  to: string
  icon: string
  label: string
  badge?: keyof AdminStats
}

const modules: ModuleEntry[] = [
  { to: 'chatbot', icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M21 12a8 8 0 0 1-8 8H7l-4 3v-5.6A8 8 0 1 1 21 12z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>`, label: 'Chatbot', badge: 'conversations_en_attente' },
  { to: 'candidats', icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 3L2 8l10 5 10-5-10-5z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M6 10.5V16c0 1.5 2.7 3 6 3s6-1.5 6-3v-5.5" stroke="currentColor" stroke-width="1.8"/></svg>`, label: 'Candidats', badge: 'candidats_en_attente' },
  { to: 'users', icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><circle cx="9" cy="8" r="3.2" stroke="currentColor" stroke-width="1.8"/><path d="M2.5 20c0-3.3 2.9-5.5 6.5-5.5s6.5 2.2 6.5 5.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M16.5 5.6a3 3 0 0 1 0 5.8M18 14.8c2.1.6 3.5 2.2 3.5 4.2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`, label: 'Utilisateurs' },
  { to: 'crm', icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.8"/><path d="M15.5 8.5l-2 5-5 2 2-5 5-2z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>`, label: 'CRM LWS' },
]

const isActive = (name: string) => route.name === name

const stats = ref<AdminStats | null>(null)
let statsTimer: ReturnType<typeof setInterval> | null = null

async function refreshStats() {
  try {
    stats.value = await fetchAdminStats()
  } catch {
    // Silencieux : le badge garde la dernière valeur connue
  }
}

onMounted(() => {
  void refreshStats()
  statsTimer = setInterval(refreshStats, 30_000)
})

onUnmounted(() => {
  if (statsTimer) clearInterval(statsTimer)
})

function logout() {
  auth.logout()
  router.push({ name: 'login' })
}
</script>

<style>
/* Montage dédié #admin (admin.html) — même gabarit plein écran que #app.
   body est position:fixed (style.css, héritage widget) : le layout admin
   occupe 100% du viewport et chaque volet scrolle en interne. */
#admin {
  height: 100%;
  display: flex;
  flex-direction: column;
}
</style>

<style scoped>
.cockpit {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: row;
  background: var(--ep-bg);
  color: var(--ep-text);
}

/* ---------- Navigation ---------- */
.cockpit__nav {
  width: 220px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 16px 12px;
  border-right: 1px solid var(--ep-border-soft);
  background: #0c0c10;
}

.cockpit__brand {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 4px 8px 14px;
}

.cockpit__brand-badge {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  background: linear-gradient(135deg, #c9a96e 0%, #e2c07a 100%);
  color: #0a0a0e;
  display: grid;
  place-items: center;
  font-family: var(--ep-font-title);
  font-weight: 700;
}

.cockpit__brand-name {
  font-family: var(--ep-font-title);
  font-size: 17px;
  color: var(--ep-gold-light);
}

.cockpit__modules {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.cockpit__link {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 10px;
  color: var(--ep-text);
  text-decoration: none;
  font-size: 14px;
  transition: background 0.15s ease;
}

.cockpit__link:hover {
  background: rgba(201, 169, 110, 0.1);
}

.cockpit__link--active {
  background: rgba(201, 169, 110, 0.15);
  color: var(--ep-gold-light);
  font-weight: 600;
}

.cockpit__icon {
  font-size: 16px;
}

.cockpit__badge {
  margin-left: auto;
  min-width: 20px;
  padding: 1px 6px;
  border-radius: var(--ep-radius-full);
  background: #e07070;
  color: #fff;
  font-size: 11px;
  font-weight: 700;
  text-align: center;
}

.cockpit__logout {
  padding: 10px 12px;
  border: 1px solid var(--ep-border-soft);
  border-radius: 10px;
  background: transparent;
  color: var(--ep-text-muted);
  font-size: 13px;
  cursor: pointer;
  transition: color 0.15s ease, border-color 0.15s ease;
}

.cockpit__logout:hover {
  color: var(--ep-text);
  border-color: var(--ep-border);
}

/* ---------- Zone principale ---------- */
.cockpit__main {
  flex: 1;
  min-width: 0;
  overflow: auto;
  padding: 16px 20px;
}

/* ---------- Mobile : tabs horizontales scrollables ---------- */
@media (max-width: 900px) {
  .cockpit {
    flex-direction: column;
  }

  .cockpit__nav {
    width: 100%;
    flex-direction: row;
    align-items: center;
    padding: 10px 12px;
    border-right: none;
    border-bottom: 1px solid var(--ep-border-soft);
  }

  .cockpit__brand {
    padding: 0;
  }

  .cockpit__brand-name {
    display: none;
  }

  .cockpit__modules {
    flex-direction: row;
    gap: 6px;
    overflow-x: auto;
    padding: 0 4px;
    scrollbar-width: none;
  }

  .cockpit__modules::-webkit-scrollbar {
    display: none;
  }

  .cockpit__link {
    padding: 8px 12px;
    white-space: nowrap;
  }

  .cockpit__logout {
    padding: 8px 10px;
    font-size: 12px;
  }

  .cockpit__main {
    padding: 12px;
  }
}
</style>
