<template>
  <!--
    Menu de profil : qui est connecté, le thème de la console, et la déconnexion.
    L'identité est lue dans le jeton (charge utile du JWT) — si elle est absente,
    la console affiche un libellé neutre plutôt qu'une valeur inventée.

    Le thème est ici, et non dans la barre latérale : c'est un réglage de
    l'opérateur, pas un module. Trois états explicites (clair, sombre, système).
  -->
  <div ref="racine" class="adm-profil">
    <button
      ref="bouton"
      type="button"
      class="adm-entete__bouton adm-profil__declencheur"
      aria-haspopup="true"
      aria-controls="adm-panneau-profil"
      :aria-expanded="ouvert"
      aria-label="Profil et préférences"
      @click="basculer"
    >
      <span class="adm-profil__pastille" aria-hidden="true">{{ identite.initiales }}</span>
      <span class="adm-profil__nom">{{ identite.nom ?? identite.email ?? 'Administrateur' }}</span>
      <svg
        class="adm-profil__chevron"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.8"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
        focusable="false"
      >
        <path d="M6 9.5l6 6 6-6" />
      </svg>
    </button>

    <div
      v-if="ouvert"
      id="adm-panneau-profil"
      ref="panneau"
      class="adm-panneau"
      role="dialog"
      aria-label="Profil et préférences"
      tabindex="-1"
    >
      <div class="adm-profil__identite">
        <p class="adm-profil__identite-nom">{{ identite.nom ?? 'Administrateur' }}</p>
        <p v-if="identite.email" class="adm-profil__identite-email">{{ identite.email }}</p>
        <p v-if="identite.role" class="adm-profil__identite-role">{{ identite.role }}</p>
      </div>

      <fieldset class="adm-profil__theme">
        <legend class="adm-profil__legende">Thème</legend>
        <label v-for="option in OPTIONS_THEME" :key="option.valeur" class="adm-profil__option">
          <input
            type="radio"
            name="adm-theme"
            :value="option.valeur"
            :checked="choix === option.valeur"
            @change="choisirTheme(option.valeur)"
          />
          <span>{{ option.libelle }}</span>
        </label>
      </fieldset>

      <button type="button" class="adm-btn adm-btn--discret adm-profil__sortie" @click="deconnecter">
        Déconnexion
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'

import { lireIdentite } from '../identite'
import { appliquerChoix, lireChoix, type ChoixTheme } from '../theme'
import { usePopover } from '../popover'

const props = defineProps<{ jeton: string | null }>()
const emit = defineEmits<{ deconnexion: [] }>()

const OPTIONS_THEME: ReadonlyArray<{ valeur: ChoixTheme; libelle: string }> = [
  { valeur: 'clair', libelle: 'Clair' },
  { valeur: 'sombre', libelle: 'Sombre' },
  { valeur: 'systeme', libelle: 'Système' },
]

const racine = ref<HTMLElement | null>(null)
const bouton = ref<HTMLButtonElement | null>(null)
const panneau = ref<HTMLElement | null>(null)
const ouvert = ref(false)
const choix = ref<ChoixTheme>(lireChoix())

const identite = computed(() => lireIdentite(props.jeton))

function fermer(): void {
  ouvert.value = false
}

function basculer(): void {
  ouvert.value = !ouvert.value
}

function choisirTheme(valeur: ChoixTheme): void {
  choix.value = valeur
  appliquerChoix(valeur)
}

function deconnecter(): void {
  fermer()
  emit('deconnexion')
}

usePopover({ racine, ouvert, declencheur: bouton, cible: panneau, fermer })
</script>

<style scoped>
.adm-profil {
  position: relative;
}

.adm-profil__declencheur {
  gap: 8px;
  padding-inline: 8px 10px;
}

/* Pastille d'initiales — recette .quote-avatar du site */
.adm-profil__pastille {
  width: 30px;
  height: 30px;
  flex-shrink: 0;
  display: grid;
  place-items: center;
  border-radius: 50%;
  border: 1px solid var(--gold-border);
  background: var(--gold-bg);
  color: var(--gold);
  font-size: 12px;
  font-weight: 700;
}

.adm-profil__nom {
  max-width: 130px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
  font-weight: 600;
  color: var(--text);
}

.adm-profil__chevron {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
  color: var(--muted);
}

.adm-panneau {
  position: absolute;
  inset-inline-end: 0;
  top: calc(100% + 8px);
  z-index: 30;
  width: min(280px, 92vw);
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 14px;
  border: 1px solid var(--border);
  border-radius: var(--arrondi-bloc);
  background: var(--card);
  box-shadow: var(--shadow-md);
}

.adm-profil__identite {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.adm-profil__identite-nom {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--text);
}

.adm-profil__identite-email,
.adm-profil__identite-role {
  margin: 0;
  font-size: 12px;
  color: var(--muted);
  overflow: hidden;
  text-overflow: ellipsis;
}

.adm-profil__theme {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin: 0;
  padding: 10px 0 0;
  border: none;
  border-top: 1px solid var(--border);
}

.adm-profil__legende {
  padding: 0 0 2px;
  font-size: 10.5px;
  font-weight: 700;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--muted);
}

.adm-profil__option {
  display: flex;
  align-items: center;
  gap: 9px;
  min-height: 36px;
  font-size: 13px;
  color: var(--soft);
  cursor: pointer;
}

.adm-profil__option input {
  width: 16px;
  height: 16px;
  accent-color: var(--gold);
  cursor: pointer;
}

.adm-profil__sortie {
  width: 100%;
}

@media (max-width: 720px) {
  .adm-profil__nom,
  .adm-profil__chevron {
    display: none;
  }
}
</style>
