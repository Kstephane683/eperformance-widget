<template>
  <!--
    Recherche globale — l'entrée de l'en-tête, volontairement discrète : une
    pilule de 260 px, jamais un bandeau. Elle cherche dans les conversations
    déjà chargées, dans les candidatures et les comptes (chargés à la première
    recherche), dans les publications et dans les compétences de Mia.

    Motif ARIA « combobox » complet : `aria-expanded`, `aria-controls`,
    `aria-activedescendant` et options `role="option"` — l'opérateur peut
    parcourir les résultats aux flèches sans quitter le champ.
  -->
  <div ref="racine" class="adm-recherche-globale">
    <div class="adm-recherche">
      <svg
        class="adm-recherche__icone"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.8"
        stroke-linecap="round"
        aria-hidden="true"
        focusable="false"
      >
        <circle cx="11" cy="11" r="6.5" />
        <path d="M16 16l4.5 4.5" />
      </svg>
      <input
        ref="champ"
        :value="terme"
        type="search"
        role="combobox"
        aria-label="Rechercher dans la console"
        aria-autocomplete="list"
        aria-controls="adm-resultats-recherche"
        :aria-expanded="panneauOuvert"
        :aria-activedescendant="actif >= 0 ? `adm-resultat-${actif}` : undefined"
        placeholder="Rechercher un visiteur, un prospect, un article…"
        autocomplete="off"
        @input="surSaisie"
        @focus="panneauVisible = true"
        @keydown.down.prevent="deplacer(1)"
        @keydown.up.prevent="deplacer(-1)"
        @keydown.enter.prevent="choisir(actif)"
        @keydown.esc="fermerPanneau"
      />
    </div>

    <div v-if="panneauOuvert" class="adm-resultats" data-testid="resultats-recherche">
      <p v-if="rechercheEnCours && resultats.length === 0" class="adm-resultats__vide">
        Recherche…
      </p>
      <p v-else-if="resultats.length === 0" class="adm-resultats__vide">
        Aucun résultat pour « {{ terme.trim() }} ».
      </p>

      <ul
        v-else
        id="adm-resultats-recherche"
        role="listbox"
        aria-label="Résultats de recherche"
        class="adm-resultats__liste"
      >
        <template v-for="(resultat, index) in resultats" :key="resultat.id">
          <li
            v-if="index === 0 || resultats[index - 1].rubrique !== resultat.rubrique"
            class="adm-resultats__rubrique"
            aria-hidden="true"
          >
            {{ resultat.rubrique }}
          </li>
          <li
            :id="`adm-resultat-${index}`"
            role="option"
            :aria-selected="index === actif"
            class="adm-resultat"
            :class="{ 'adm-resultat--actif': index === actif }"
            @mousedown.prevent="choisir(index)"
          >
            <span class="adm-resultat__corps">
              <span class="adm-resultat__titre">{{ resultat.titre }}</span>
              <span class="adm-resultat__detail">{{ resultat.detail }}</span>
            </span>
            <svg
              v-if="resultat.urlExterne"
              class="adm-resultat__marque"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.8"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
              focusable="false"
            >
              <path d="M14 4h6v6" />
              <path d="M20 4 11 13" />
              <path d="M18 14.5V19a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 19V7.5A1.5 1.5 0 0 1 5 6h4.5" />
            </svg>
          </li>
        </template>
      </ul>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

import { fetchAdminCandidats, fetchAdminUsers, type AdminCandidat, type AdminUser } from '../api'
import { chercherDansLaConsole } from '../recherche'
import { useConsoleStore } from '../stores/console'
import { usePopover } from '../popover'

const router = useRouter()
const consoleStore = useConsoleStore()

const racine = ref<HTMLElement | null>(null)
const champ = ref<HTMLInputElement | null>(null)

const terme = ref('')
const actif = ref(-1)
const panneauVisible = ref(false)
const candidats = ref<AdminCandidat[]>([])
const utilisateurs = ref<AdminUser[]>([])
const sourcesChargees = ref(false)
const rechercheEnCours = ref(false)

const resultats = computed(() =>
  chercherDansLaConsole(terme.value, {
    conversations: consoleStore.conversations,
    candidats: candidats.value,
    utilisateurs: utilisateurs.value,
  }),
)

const panneauOuvert = computed(
  () => panneauVisible.value && terme.value.trim().length >= 2,
)

/** Ferme le panneau sans toucher au terme saisi. */
function fermerPanneau(): void {
  panneauVisible.value = false
  actif.value = -1
}

usePopover({ racine, ouvert: panneauOuvert, declencheur: champ, fermer: fermerPanneau })

/** Charge les sources lourdes une seule fois, au premier besoin. */
async function chargerSources(): Promise<void> {
  if (sourcesChargees.value || rechercheEnCours.value) return
  rechercheEnCours.value = true
  try {
    const [candidatsReponse, utilisateursReponse] = await Promise.all([
      fetchAdminCandidats().catch(() => ({ candidats: [] as AdminCandidat[] })),
      fetchAdminUsers().catch(() => ({ users: [] as AdminUser[] })),
    ])
    candidats.value = candidatsReponse.candidats
    utilisateurs.value = utilisateursReponse.users
    sourcesChargees.value = true
  } finally {
    rechercheEnCours.value = false
  }
}

function surSaisie(evenement: Event): void {
  terme.value = (evenement.target as HTMLInputElement).value
  panneauVisible.value = true
  actif.value = resultats.value.length > 0 ? 0 : -1
  if (terme.value.trim().length >= 2) void chargerSources()
}

function deplacer(pas: number): void {
  if (resultats.value.length === 0) return
  panneauVisible.value = true
  const total = resultats.value.length
  actif.value = (actif.value + pas + total) % total
}

function choisir(index: number): void {
  const resultat = resultats.value[index]
  if (!resultat) return
  fermerPanneau()
  if (resultat.urlExterne) {
    window.open(resultat.urlExterne, '_blank', 'noopener')
    return
  }
  void router.push({ name: resultat.vers.nom, query: resultat.vers.query })
  terme.value = ''
}

// Le terme change (effacement au clavier) : l'option active n'a plus de sens.
watch(terme, (valeur) => {
  if (valeur.trim().length < 2) actif.value = -1
})
</script>

<style scoped>
.adm-recherche-globale {
  position: relative;
}

.adm-recherche {
  width: clamp(180px, 26vw, 320px);
}

.adm-recherche__icone {
  width: 15px;
  height: 15px;
  flex-shrink: 0;
}

/* Bord du panneau : même surface que les barres, filet discret. Aucune ombre
   lourde — l'en-tête ne doit pas concurrencer la barre latérale. */
.adm-resultats {
  position: absolute;
  inset-inline-end: 0;
  top: calc(100% + 8px);
  z-index: 30;
  width: min(420px, 92vw);
  max-height: min(60vh, 460px);
  overflow-y: auto;
  padding: 8px;
  border: 1px solid var(--border);
  border-radius: var(--arrondi-bloc);
  background: var(--card);
  box-shadow: var(--shadow-md);
  scrollbar-width: thin;
  scrollbar-color: var(--border-strong) transparent;
}

.adm-resultats__vide {
  margin: 0;
  padding: 12px;
  font-size: 13px;
  color: var(--muted);
}

.adm-resultats__liste {
  margin: 0;
  padding: 0;
  list-style: none;
}

.adm-resultats__rubrique {
  padding: 10px 12px 4px;
  font-size: 10.5px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--muted);
}

.adm-resultat {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 12px;
  border-radius: var(--arrondi-input);
  cursor: pointer;
}

.adm-resultat--actif {
  background: var(--gold-bg);
}

.adm-resultat__corps {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.adm-resultat__titre {
  font-size: 13.5px;
  font-weight: 600;
  color: var(--text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.adm-resultat--actif .adm-resultat__titre {
  color: var(--gold2);
}

.adm-resultat__detail {
  font-size: 12px;
  color: var(--muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.adm-resultat__marque {
  width: 15px;
  height: 15px;
  margin-left: auto;
  flex-shrink: 0;
  color: var(--muted);
}
</style>
