<template>
  <!--
    Compétences de Mia — ce que Mia sait faire, par famille de besoin.
    Source unique : `src/data/capacites.ts`, partagée avec les suggestions du
    widget et l'onglet Aide. Les vignettes sont des tracés SVG DÉCRITS EN CLAIR
    (jamais de `v-html`, jamais d'emoji) : c'est la règle du design system.

    Aucune clé technique n'est affichée : ce que l'opérateur lit ici est le
    libellé du besoin du visiteur, pas le nom du composant qui y répond.
  -->
  <div class="adm-page">
    <p class="adm-note">
      <strong>{{ nombreCapacites }}</strong> compétences réparties en
      {{ FAMILLES.length }} familles. Mia choisit elle-même la compétence adaptée à la
      demande du visiteur ; c’est aussi ce que l’accueil du widget propose en suggestions.
    </p>

    <section v-for="famille in familles" :key="famille.titre" class="adm-famille">
      <div class="adm-filet"><span class="adm-eyebrow">{{ famille.titre }}</span></div>

      <ul class="adm-grille">
        <li v-for="capacite in famille.capacites" :key="capacite.libelle" class="adm-carte adm-competence">
          <span class="adm-competence__vignette" aria-hidden="true">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.7"
              stroke-linecap="round"
              stroke-linejoin="round"
              focusable="false"
            >
              <path v-for="(trace, index) in capacite.traces" :key="index" :d="trace" />
            </svg>
          </span>
          <p class="adm-competence__libelle">{{ capacite.libelle }}</p>
        </li>
      </ul>
    </section>

    <p class="adm-note">
      Cette liste est la même que celle envoyée au moteur de Mia : la modifier change
      les suggestions de l’accueil du widget comme les réponses de la conversation.
    </p>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import { FAMILLES } from '@/data/capacites'

const familles = computed(() => FAMILLES)
const nombreCapacites = computed(() =>
  FAMILLES.reduce((somme, famille) => somme + famille.capacites.length, 0),
)
</script>

<style scoped>
.adm-famille {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.adm-competence {
  flex-direction: row;
  align-items: center;
  gap: 12px;
}

/* Vignette d'accent : icône sur trace d'or, jamais une image */
.adm-competence__vignette {
  width: 38px;
  height: 38px;
  flex-shrink: 0;
  display: grid;
  place-items: center;
  border-radius: var(--arrondi-input);
  border: 1px solid var(--gold-border);
  background: var(--gold-bg);
  color: var(--gold);
}

.adm-competence__vignette svg {
  width: 20px;
  height: 20px;
}

.adm-competence__libelle {
  margin: 0;
  font-size: 13.5px;
  font-weight: 600;
  color: var(--text);
}
</style>
