<template>
  <div class="ep-vue">
    <header class="ep-accueil__entete">
      <h1 class="ep-vue__titre">Bonjour</h1>
      <p class="ep-vue__sous-titre">En quoi pouvons-nous vous être utile ?</p>
    </header>

    <!-- Carte de saisie : ouvre la conversation avec le focus dans le champ -->
    <button type="button" class="ep-saisie" @click="poserQuestion">
      <span class="ep-saisie__libelle">Poser une question</span>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M5 12h13M13 6.5 18.5 12 13 17.5"
          stroke="currentColor"
          stroke-width="1.9"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
    </button>

    <!--
      Recherche libre, en tête : « Trouver une réponse » n'est pas une
      capacité de Mia, c'est la porte d'entrée quand le visiteur ne sait pas
      ce qu'il cherche. Elle ouvre l'onglet Aide avec le champ de recherche
      actif (A.8).
    -->
    <section class="ep-accueil__bloc">
      <button type="button" class="ep-suggestion ep-suggestion--recherche" @click="chercher">
        <span class="ep-suggestion__icone" aria-hidden="true">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
            <path
              d="M11 4.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13zM15.8 15.8 20 20"
              stroke="currentColor"
              stroke-width="1.7"
              stroke-linecap="round"
            />
          </svg>
        </span>
        <span class="ep-suggestion__texte">Trouver une réponse</span>
        <svg
          class="ep-suggestion__fleche"
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M9 6l6 6-6 6"
            stroke="currentColor"
            stroke-width="1.9"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </button>
    </section>

    <!-- Article vedette : le dernier publié du blog (aide + actualités
         partagent la même source, chatbot-index.json) -->
    <!--
      Les neuf capacités de Mia, par famille (A.8). Chaque clic envoie
      `[intent:<clé>] <libellé>` à Mia : la bulle affiche le libellé, le
      backend route vers l'expertise correspondante — sans jamais nommer
      l'agent. Le clic est tracé (capacité, horodatage, session).
      `data-suggestion` / `data-label` sont posés pour la mesure et les tests.
    -->
    <section
      v-for="famille in FAMILLES"
      :key="famille.titre"
      class="ep-accueil__bloc"
      :aria-labelledby="`ep-famille-${slug(famille.titre)}`"
    >
      <span :id="`ep-famille-${slug(famille.titre)}`" class="ep-eyebrow">{{ famille.titre }}</span>
      <ul class="ep-suggestions">
        <li v-for="capacite in famille.capacites" :key="capacite.intent">
          <button
            type="button"
            class="ep-suggestion"
            :data-suggestion="capacite.intent"
            :data-label="capacite.libelle"
            @click="envoyer(capacite)"
          >
            <span class="ep-suggestion__icone" aria-hidden="true">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
                <path
                  v-for="(trace, i) in capacite.traces"
                  :key="i"
                  :d="trace"
                  stroke="currentColor"
                  stroke-width="1.7"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
            </span>
            <span class="ep-suggestion__texte">{{ capacite.libelle }}</span>
            <svg
              class="ep-suggestion__fleche"
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M9 6l6 6-6 6"
                stroke="currentColor"
                stroke-width="1.9"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
          </button>
        </li>
      </ul>
    </section>

    <!--
      Article vedette : le dernier publié du blog (aide + actualités
      partagent la même source, chatbot-index.json).
      Placé APRÈS les capacités (tâche 6.3-BIS A.8) : le panneau desktop fait
      650 px de haut et la carte d'article en occupe près de 300 — placée
      avant, elle repoussait les neuf capacités sous la ligne de flottaison,
      alors que ce sont elles qui montrent ce que Mia sait faire. La structure
      Intercom est conservée (titre, saisie, suggestions, article), seul
      l'ordre change.
    -->
    <section v-if="vedette" class="ep-accueil__bloc" aria-labelledby="ep-vedette-titre">
      <span id="ep-vedette-titre" class="ep-eyebrow">Dernier article</span>
      <ArticleCard :article="vedette" />
    </section>

    <p v-else-if="blog.isLoading" class="ep-etat">Chargement des articles…</p>
  </div>
</template>

<script setup lang="ts">
// Écran d'accueil du widget — structure Intercom (titre, carte de saisie,
// suggestions, article vedette) et, depuis la tâche 6.3-BIS (A.8), les NEUF
// capacités de Mia réparties en trois familles.
import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'

import ArticleCard from '@/components/ArticleCard.vue'
import { FAMILLES, payloadSuggestion, type Capacite } from '@/data/capacites'
import { tracerClicSuggestion } from '@/helpers/tracking'
import { useBlogStore } from '@/stores/blog'
import { useIntentStore } from '@/stores/intent'

const router = useRouter()
const blog = useBlogStore()
const intent = useIntentStore()

/** Article vedette : le plus récent publié, servi par l'index du blog */
const vedette = computed(() => blog.dernierArticle)

/** Identifiant DOM stable à partir d'un titre de famille (aria-labelledby) */
function slug(titre: string): string {
  return titre
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

function poserQuestion() {
  intent.demanderFocus()
  router.push({ name: 'conversation' })
}

/** « Trouver une réponse » : ouvre l'aide, champ de recherche prêt */
function chercher() {
  intent.demanderFocus()
  router.push({ name: 'aide' })
}

/**
 * Capacité cliquée → conversation ouverte + message envoyé à Mia.
 * Le libellé EST le message ; le préfixe d'intent ne sert qu'au routage
 * interne du backend (jamais affiché, jamais nommé d'agent).
 */
function envoyer(capacite: Capacite) {
  tracerClicSuggestion(capacite)
  intent.envoyerDansConversation(capacite.libelle, payloadSuggestion(capacite))
  router.push({ name: 'conversation' })
}

onMounted(() => {
  // Charge l'index du blog (réseau puis repli embarqué) : sans lui, pas
  // d'article vedette — mais l'écran reste utilisable.
  void blog.load()
})
</script>

<style scoped>
.ep-accueil__entete {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

/* Carte de saisie : recette .card (eperf.css:737-745) — surface, filet de
   contrôle, rayon de carte, ombre au survol. */
.ep-saisie {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 15px 18px;
  border: 1px solid var(--border-strong);
  border-radius: var(--arrondi-carte);
  background: var(--card);
  color: var(--muted);
  font-family: inherit;
  font-size: 14.5px;
  text-align: left;
  box-shadow: var(--shadow-sm);
  transition: border-color var(--t) var(--ease-out), box-shadow var(--t) var(--ease-out),
    transform var(--t) var(--ease-out);
}

.ep-saisie:hover {
  border-color: var(--gold);
  box-shadow: var(--shadow-md);
  transform: translateY(-2px);
}

.ep-saisie__libelle {
  flex: 1;
}

.ep-accueil__bloc {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.ep-suggestions {
  display: flex;
  flex-direction: column;
  gap: 6px;
  list-style: none;
}

/* Ligne de suggestion : recette .ep-ligne (filet + survol d'accent) */
.ep-suggestion {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 12px 14px;
  border: 1px solid var(--border);
  border-radius: var(--arrondi-bloc);
  background: var(--card);
  color: var(--text);
  font-family: inherit;
  font-size: 13.5px;
  text-align: left;
  transition: border-color var(--t) var(--ease-out), background-color var(--t) var(--ease-out);
}

.ep-suggestion:hover {
  border-color: var(--gold-border);
  background: var(--card2);
}

/* Recherche libre : même ligne, mais posée au-dessus des familles et
   détachée visuellement (elle n'est pas une compétence de Mia) */
.ep-suggestion--recherche {
  border-color: var(--border-strong);
}

.ep-suggestion__icone {
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  flex-shrink: 0;
  border-radius: var(--arrondi-input);
  background: var(--gold-bg);
  color: var(--gold);
}

.ep-suggestion__texte {
  flex: 1;
  min-width: 0;
}

.ep-suggestion__fleche {
  color: var(--gold);
  flex-shrink: 0;
}
</style>
