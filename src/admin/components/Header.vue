<template>
  <!--
    En-tête de la console : le titre du module courant, la recherche, les
    notifications, le profil.

    Il est VOLONTAIREMENT discret — 64 px, filet unique, aucun aplat de marque —
    pour ne pas concurrencer la barre latérale, qui porte l'identité et la
    navigation. Le titre qu'il affiche est celui du module actif : l'opérateur
    sait toujours où il est, et aucune vue n'a besoin de le répéter.
  -->
  <header class="adm-entete">
    <button
      ref="boutonMenu"
      type="button"
      class="adm-entete__bouton adm-entete__burger"
      aria-controls="adm-modules"
      :aria-expanded="tiroirOuvert"
      :aria-label="tiroirOuvert ? 'Fermer le menu des modules' : 'Ouvrir le menu des modules'"
      @click="emit('basculer-tiroir')"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.8"
        stroke-linecap="round"
        aria-hidden="true"
        focusable="false"
      >
        <path d="M4 7h16M4 12h16M4 17h16" />
      </svg>
    </button>

    <div class="adm-entete__titre">
      <h1 class="adm-entete__titre-texte">{{ module?.libelle ?? 'Console' }}</h1>
      <p v-if="module" class="adm-entete__sous-titre">{{ module.description }}</p>
    </div>

    <div class="adm-entete__outils">
      <GlobalSearch />
      <NotificationsMenu />
      <ProfileMenu :jeton="jeton" @deconnexion="emit('deconnexion')" />
    </div>
  </header>
</template>

<script setup lang="ts">
import { ref } from 'vue'

import GlobalSearch from './GlobalSearch.vue'
import NotificationsMenu from './NotificationsMenu.vue'
import ProfileMenu from './ProfileMenu.vue'
import type { Module } from '../navigation'

defineProps<{ module: Module | undefined; tiroirOuvert: boolean; jeton: string | null }>()
const emit = defineEmits<{ 'basculer-tiroir': []; deconnexion: [] }>()

/** Exposé au shell : il rend le focus au bouton quand le tiroir se referme. */
const boutonMenu = ref<HTMLButtonElement | null>(null)
defineExpose({ boutonMenu })
</script>

<style scoped>
.adm-entete {
  position: sticky;
  top: 0;
  z-index: 20;
  display: flex;
  align-items: center;
  gap: 14px;
  min-height: 64px;
  padding: 10px 20px;
  border-bottom: 1px solid var(--border);
  /* Verre : le contenu qui défile passe dessous sans le heurter */
  background: var(--voile);
  backdrop-filter: blur(14px);
}

.adm-entete__bouton {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-width: 40px;
  min-height: 40px;
  padding: 0 8px;
  border: 1px solid var(--border);
  border-radius: var(--arrondi-bouton);
  background: var(--card);
  color: var(--soft);
  cursor: pointer;
  transition: border-color var(--t-fast) var(--ease-out), color var(--t-fast) var(--ease-out),
    background-color var(--t-fast) var(--ease-out);
}

.adm-entete__bouton:hover {
  border-color: var(--gold-border);
  color: var(--gold);
}

.adm-entete__bouton svg {
  width: 18px;
  height: 18px;
}

.adm-entete__bouton[aria-expanded='true'] {
  border-color: var(--gold-border);
  background: var(--gold-bg);
  color: var(--gold);
}

.adm-entete__burger {
  display: none;
}

.adm-entete__titre {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
}

/* Titre de module en Cormorant, 20 px : présent, jamais plus fort que la marque */
.adm-entete__titre-texte {
  margin: 0;
  font-family: var(--police-titres);
  font-size: 20px;
  font-weight: 600;
  line-height: 1.15;
  letter-spacing: -0.01em;
  color: var(--text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.adm-entete__sous-titre {
  margin: 0;
  font-size: 12px;
  color: var(--muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.adm-entete__outils {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: auto;
}

@media (max-width: 1000px) {
  .adm-entete {
    padding: 10px 14px;
  }

  .adm-entete__burger {
    display: inline-flex;
  }
}

@media (max-width: 720px) {
  .adm-entete__sous-titre {
    display: none;
  }
}
</style>
