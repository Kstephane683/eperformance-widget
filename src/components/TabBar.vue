<template>
  <!--
    Barre de navigation basse — 4 onglets, icônes SVG uniquement (aucun emoji).
    Sémantique ARIA complète : role=tablist / tab / tabpanel (le panneau est
    rendu par App.vue), aria-selected, tabindex mobile (roving) et navigation
    clavier ← → début/fin.
  -->
  <nav class="ep-tabs" role="tablist" aria-label="Navigation du widget">
    <button
      v-for="(onglet, index) in ONGLETS"
      :id="`ep-tab-${onglet.name}`"
      :key="onglet.name"
      ref="boutons"
      type="button"
      role="tab"
      class="ep-tab"
      :class="{ 'ep-tab--actif': estActif(onglet.name) }"
      :aria-selected="estActif(onglet.name) ? 'true' : 'false'"
      :aria-controls="`ep-panel-${onglet.name}`"
      :tabindex="estActif(onglet.name) ? 0 : -1"
      @click="aller(onglet.name)"
      @keydown="onTouche($event, index)"
    >
      <svg
        class="ep-tab__icone"
        :class="{ 'ep-tab__icone--plein': onglet.plein && estActif(onglet.name) }"
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
      >
        <path
          v-for="(trace, i) in onglet.traces"
          :key="i"
          :d="trace"
          stroke="currentColor"
          :stroke-width="onglet.plein && estActif(onglet.name) ? 0 : 1.7"
          :fill="onglet.plein && estActif(onglet.name) ? 'currentColor' : 'none'"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
      <span class="ep-tab__label">{{ onglet.label }}</span>
    </button>
  </nav>
</template>

<script setup lang="ts">
import { nextTick, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

/**
 * Les onglets sont des routes (hash history) : la navigation ne recharge
 * jamais l'iframe. Chaque icône est décrite par ses tracés SVG (données
 * pures, jamais de HTML injecté).
 */
const ONGLETS = [
  {
    name: 'home',
    label: 'Accueil',
    plein: true,
    traces: ['M4 10.4 12 4l8 6.4V19a1.6 1.6 0 0 1-1.6 1.6h-3.2v-5.2H8.8v5.2H5.6A1.6 1.6 0 0 1 4 19z'],
  },
  {
    name: 'messages',
    label: 'Messages',
    plein: false,
    traces: [
      'M20.4 11.6a8.4 8.4 0 0 1-12.5 7.4L3.6 20.4l1.4-4.3A8.4 8.4 0 1 1 20.4 11.6z',
      'M9.4 9.2a4.6 4.6 0 0 0 5.4 5.4',
    ],
  },
  {
    name: 'aide',
    label: 'Aide',
    plein: false,
    traces: [
      'M12 3.6a8.4 8.4 0 1 0 0 16.8 8.4 8.4 0 0 0 0-16.8z',
      'M12 10.6a1.6 1.6 0 1 1 2.2 1.5c-.6.3-1.1.7-1.1 1.4v.4',
      'M13.1 16.6h.01',
    ],
  },
  {
    name: 'actualites',
    label: 'Actualités',
    plein: false,
    traces: [
      'M4.6 5.2h11.2a1.6 1.6 0 0 1 1.6 1.6v11.6H6.2a1.6 1.6 0 0 1-1.6-1.6z',
      'M17.4 9.2h2.2a1.6 1.6 0 0 1 1.6 1.6v6.4a1.8 1.8 0 0 1-3.6 0',
      'M7.4 8.6h5M7.4 12h5M7.4 15.4h3',
    ],
  },
] as const

const route = useRoute()
const router = useRouter()
const boutons = ref<HTMLButtonElement[]>([])

function estActif(name: string): boolean {
  return route.name === name
}

function aller(name: string) {
  if (estActif(name)) return
  router.push({ name })
}

/** ← → parcourent les onglets, Début/Fin vont aux extrémités (motif WAI-ARIA) */
async function onTouche(evenement: KeyboardEvent, index: number) {
  const dernier = ONGLETS.length - 1
  let cible = index
  switch (evenement.key) {
    case 'ArrowRight':
      cible = index === dernier ? 0 : index + 1
      break
    case 'ArrowLeft':
      cible = index === 0 ? dernier : index - 1
      break
    case 'Home':
      cible = 0
      break
    case 'End':
      cible = dernier
      break
    default:
      return
  }
  evenement.preventDefault()
  aller(ONGLETS[cible].name)
  await nextTick()
  boutons.value[cible]?.focus()
}
</script>

<style scoped>
.ep-tabs {
  display: flex;
  align-items: stretch;
  border-top: 1px solid var(--border);
  background: color-mix(in srgb, var(--card) 92%, transparent);
  backdrop-filter: blur(14px) saturate(150%);
  -webkit-backdrop-filter: blur(14px) saturate(150%);
  padding-bottom: env(safe-area-inset-bottom);
  flex-shrink: 0;
}

.ep-tab {
  position: relative;
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  padding: 9px 4px 8px;
  border: none;
  background: transparent;
  color: var(--muted);
  font-family: inherit;
  font-size: 11px;
  font-weight: 600;
  transition: color var(--t) var(--ease-out);
}

.ep-tab:hover {
  color: var(--gold);
}

/* Onglet actif : --gold + indicateur (filet haut), jamais la seule couleur
   pour porter l'information (WCAG 1.4.1) — le libellé s'épaissit aussi. */
.ep-tab--actif {
  color: var(--gold);
}

.ep-tab--actif::before {
  content: '';
  position: absolute;
  top: -1px;
  left: 22%;
  right: 22%;
  height: 2px;
  border-radius: 0 0 2px 2px;
  background: var(--gold);
}

.ep-tab__icone {
  width: 21px;
  height: 21px;
}
</style>
