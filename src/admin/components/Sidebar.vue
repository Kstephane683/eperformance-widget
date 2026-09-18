<template>
  <!--
    Barre latérale — 11 modules groupés par INTENTION (pilotage, conversations,
    contenu, réglages), et non une liste plate. C'est la structure d'Intercom :
    on ne cherche pas un écran, on cherche ce qu'on veut faire.

    Desktop : colonne fixe de 264 px. Mobile (<= 1000 px) : tiroir hors-champ,
    ouvert par le bouton de l'en-tête, refermé au choix d'un module, à `Échap`
    ou au clic sur le voile — la structure groupée est conservée, ce qu'une
    rangée d'onglets horizontaux ne permettait pas.
  -->
  <nav
    id="adm-modules"
    ref="racine"
    class="adm-barre"
    :class="{ 'adm-barre--ouverte': ouvert }"
    aria-label="Modules de la console"
    @keydown.esc="fermer"
  >
    <div class="adm-barre__marque">
      <BrandLogo />
      <span class="adm-barre__contexte">Console</span>
    </div>

    <div ref="listeModules" class="adm-barre__modules" @keydown="surTouche">
      <div v-for="groupe in MODULES_PAR_GROUPE" :key="groupe.id" class="adm-barre__groupe">
        <p :id="`adm-groupe-${groupe.id}`" class="adm-barre__groupe-titre" :title="groupe.intention">
          {{ groupe.titre }}
        </p>
        <ul class="adm-barre__liste" :aria-labelledby="`adm-groupe-${groupe.id}`">
          <li v-for="module in groupe.modules" :key="module.nom">
            <RouterLink
              :to="{ name: module.nom }"
              class="adm-lien"
              :class="{ 'adm-lien--actif': module.nom === actif }"
              :data-module="module.nom"
              :aria-current="module.nom === actif ? 'page' : undefined"
              @click="fermer"
            >
              <svg
                class="adm-lien__icone"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.7"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
                focusable="false"
              >
                <path v-for="(trace, index) in module.icone" :key="index" :d="trace" />
              </svg>
              <span class="adm-lien__libelle">{{ module.libelle }}</span>
              <span v-if="compteur(module)" class="adm-compteur" :aria-label="`${compteur(module)} en attente`">
                {{ compteur(module) }}
              </span>
            </RouterLink>
          </li>
        </ul>
      </div>
    </div>

    <div class="adm-barre__pied">
      <p class="adm-eyebrow">Assistant</p>
      <p class="adm-barre__pied-nom">Mia</p>
      <p class="adm-barre__pied-texte">
        Répond en continu et transmet à un conseiller quand il faut prendre la main.
      </p>
    </div>
  </nav>

  <!-- Voile du tiroir mobile : purement décoratif, la fermeture est aussi
       offerte par Échap et par le choix d'un module. -->
  <div
    v-if="ouvert"
    class="adm-barre__voile"
    data-testid="voile-tiroir"
    aria-hidden="true"
    @click="fermer"
  ></div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'

import BrandLogo from '@/components/BrandLogo.vue'
import { MODULES_PAR_GROUPE, type Module } from '../navigation'
import { useConsoleStore } from '../stores/console'

const props = defineProps<{ ouvert: boolean }>()
const emit = defineEmits<{ fermer: [] }>()

const route = useRoute()
const consoleStore = useConsoleStore()

/** Module actif — lu sur la route, jamais deviné depuis un état local. */
const actif = computed(() => String(route.name ?? ''))

const racine = ref<HTMLElement | null>(null)
const listeModules = ref<HTMLElement | null>(null)

/**
 * À l'ouverture du tiroir (mobile), le focus entre dans le menu — sur le module
 * actif s'il existe, sinon sur le premier. Sans cela, ouvrir le menu au clavier
 * laisserait le focus derrière le voile.
 */
watch(
  () => props.ouvert,
  (estOuvert) => {
    if (!estOuvert) return
    void nextTick(() => {
      const cible =
        racine.value?.querySelector<HTMLAnchorElement>('a.adm-lien--actif') ??
        racine.value?.querySelector<HTMLAnchorElement>('a.adm-lien')
      cible?.focus()
    })
  },
)

/** Pastille : nombre de conversations / candidatures en attente. */
function compteur(module: Module): number {
  if (!module.badge) return 0
  return consoleStore.stats?.[module.badge] ?? 0
}

function fermer(): void {
  emit('fermer')
}

/**
 * Navigation au clavier : les flèches parcourent les modules dans l'ordre
 * affiché, `Début`/`Fin` vont aux extrémités. Les liens restent tous tabulables
 * (aucun `tabindex` mobile) : l'ordre naturel du document est déjà le bon, les
 * flèches ne font qu'aller plus vite.
 */
function surTouche(evenement: KeyboardEvent): void {
  const touches = ['ArrowDown', 'ArrowUp', 'Home', 'End']
  if (!touches.includes(evenement.key)) return
  const liens = Array.from(
    listeModules.value?.querySelectorAll<HTMLAnchorElement>('a.adm-lien') ?? [],
  )
  if (liens.length === 0) return
  evenement.preventDefault()

  const courant = liens.findIndex((lien) => lien === document.activeElement)
  let cible = 0
  if (evenement.key === 'End') cible = liens.length - 1
  else if (evenement.key === 'ArrowDown') cible = courant < 0 ? 0 : (courant + 1) % liens.length
  else if (evenement.key === 'ArrowUp') {
    cible = courant < 0 ? liens.length - 1 : (courant - 1 + liens.length) % liens.length
  }
  liens[cible]?.focus()
}
</script>

<style scoped>
.adm-barre {
  display: flex;
  flex-direction: column;
  gap: 12px;
  /* Le pied respire : sur mobile, le tiroir défile et le dernier bloc ne doit
     pas se coller au bord de l'écran. */
  padding: 16px 12px 24px;
  background: var(--bg2);
  border-right: 1px solid var(--border);
  min-height: 0;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: var(--border-strong) transparent;
}

/* ---------- Marque ---------- */
.adm-barre__marque {
  display: flex;
  flex-direction: column;
  gap: 7px;
  padding: 4px 10px 12px;
  border-bottom: 1px solid var(--border);
}

.adm-barre__contexte {
  font-size: 10.5px;
  font-weight: 600;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--muted);
}

/* ---------- Groupes ---------- */
.adm-barre__modules {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.adm-barre__groupe-titre {
  margin: 0 0 6px;
  padding: 0 12px;
  font-size: 10.5px;
  font-weight: 700;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--muted);
}

.adm-barre__liste {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.adm-lien {
  position: relative;
  display: flex;
  align-items: center;
  gap: 10px;
  /* 44 px : cible tactile confortable, y compris sur un écran de portable */
  min-height: 44px;
  padding: 9px 12px;
  border-radius: var(--arrondi-input);
  color: var(--soft);
  font-size: 13.5px;
  text-decoration: none;
  transition: background-color var(--t-fast) var(--ease-out), color var(--t-fast) var(--ease-out);
}

.adm-lien:hover {
  background: var(--neutre-trace);
  color: var(--text);
}

/* État actif : fond d'accent + barre d'accent + graisse — trois signaux, pour
   que l'état se lise aussi sans percevoir la teinte (WCAG 1.4.1). */
.adm-lien--actif {
  background: var(--gold-bg);
  color: var(--gold2);
  font-weight: 600;
}

.adm-lien--actif::before {
  content: '';
  position: absolute;
  inset-inline-start: 0;
  inset-block: 22%;
  width: 3px;
  border-radius: var(--arrondi-bouton);
  background: var(--gold);
}

.adm-lien__icone {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
}

.adm-lien__libelle {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.adm-compteur {
  margin-left: auto;
}

/* ---------- Pied : le seul nom visible, Mia ---------- */
.adm-barre__pied {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 12px;
  border: 1px solid var(--border);
  border-radius: var(--arrondi-bloc);
  background: var(--card);
}

.adm-barre__pied-nom {
  margin: 0;
  font-family: var(--police-titres);
  font-size: 17px;
  font-weight: 600;
  color: var(--gold2);
}

.adm-barre__pied-texte {
  margin: 2px 0 0;
  font-size: 11.5px;
  line-height: 1.5;
  color: var(--muted);
}

/* ---------- Mobile : tiroir ---------- */
.adm-barre__voile {
  position: fixed;
  inset: 0;
  z-index: 40;
  background: var(--voile-fort);
  backdrop-filter: blur(2px);
}

@media (max-width: 1000px) {
  .adm-barre {
    position: fixed;
    inset-block: 0;
    inset-inline-start: 0;
    z-index: 50;
    width: min(300px, 86vw);
    transform: translateX(-101%);
    transition: transform var(--t) var(--ease-out);
    box-shadow: var(--shadow-lg);
  }

  .adm-barre--ouverte {
    transform: translateX(0);
  }
}

/* Sur desktop, le voile ne doit jamais s'afficher (l'état `ouvert` peut rester
   vrai si la fenêtre est élargie alors que le tiroir était ouvert). */
@media (min-width: 1001px) {
  .adm-barre__voile {
    display: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .adm-barre {
    transition: none;
  }
}
</style>
