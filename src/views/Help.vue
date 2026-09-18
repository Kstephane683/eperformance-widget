<template>
  <div class="ep-vue">
    <h1 class="ep-vue__titre">Aide</h1>
    <p class="ep-vue__sous-titre">Les guides du blog ePerformance, par sujet.</p>

    <!--
      Ce que Mia peut faire pour vous (A.9) — les neuf capacités, mêmes
      libellés et mêmes clés d'intent que les suggestions de l'accueil (A.8).
      Chaque clic ouvre la conversation avec l'intent chargé : la réponse
      démontre la compétence, sans jamais nommer d'agent.
      Section TOUJOURS visible, y compris en recherche : c'est l'entrée la
      plus utile quand le visiteur ne sait pas quoi chercher.
    -->
    <section class="ep-aide__capacites" aria-labelledby="ep-capacites-titre">
      <span id="ep-capacites-titre" class="ep-eyebrow">Ce que Mia peut faire pour vous</span>
      <ul class="ep-liste ep-liste--capacites">
        <li v-for="capacite in CAPACITES" :key="capacite.intent">
          <button
            type="button"
            class="ep-ligne ep-ligne--capacite"
            :data-suggestion="capacite.intent"
            :data-label="capacite.libelle"
            @click="envoyer(capacite)"
          >
            <span class="ep-pastille" aria-hidden="true">
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none">
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
            <span class="ep-ligne__corps">
              <span class="ep-ligne__titre">{{ capacite.libelle }}</span>
            </span>
            <svg
              class="ep-ligne__chevron"
              width="16"
              height="16"
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

    <div class="ep-recherche">
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M11 4.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13zM15.8 15.8 20 20"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linecap="round"
        />
      </svg>
      <input
        :value="blog.recherche"
        type="search"
        placeholder="Trouver une réponse"
        aria-label="Trouver une réponse"
        @input="blog.definirRecherche(($event.target as HTMLInputElement).value)"
      />
    </div>

    <p v-if="blog.isLoading" class="ep-etat">Chargement de l’aide…</p>

    <!-- Recherche en cours : résultats à plat, toutes collections confondues -->
    <template v-else-if="enRecherche">
      <p class="ep-compteur" role="status">
        {{ resultats.length }} résultat{{ resultats.length > 1 ? 's' : '' }} pour « {{ blog.recherche }} »
      </p>
      <ul v-if="resultats.length" class="ep-liste">
        <li v-for="article in resultats" :key="article.slug">
          <ArticleCard :article="article" />
        </li>
      </ul>
      <p v-else class="ep-etat">
        Aucun article ne correspond. Posez votre question à Mia : elle répond dans la conversation.
      </p>
    </template>

    <!-- Collection ouverte : ses articles -->
    <template v-else-if="collection">
      <button type="button" class="ep-retour" @click="blog.ouvrirCollection(null)">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M14.5 5.5 8 12l6.5 6.5"
            stroke="currentColor"
            stroke-width="2.2"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
        Toutes les collections
      </button>
      <div class="ep-collection__entete">
        <h2 class="ep-collection__titre">{{ collection.titre }}</h2>
        <p class="ep-compteur">{{ collection.nombre }} article{{ collection.nombre > 1 ? 's' : '' }}</p>
      </div>
      <ul class="ep-liste">
        <li v-for="article in articlesCollection" :key="article.slug">
          <ArticleCard :article="article" />
        </li>
      </ul>
    </template>

    <!-- Liste des collections : « N collections » puis une ligne par sujet -->
    <template v-else>
      <p class="ep-compteur" role="status">
        {{ blog.nombreCollections }} collection{{ blog.nombreCollections > 1 ? 's' : '' }}
      </p>
      <ul class="ep-liste">
        <li v-for="entree in blog.collections" :key="entree.slug">
          <button type="button" class="ep-ligne" @click="blog.ouvrirCollection(entree.slug)">
            <span class="ep-pastille" aria-hidden="true">
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none">
                <path
                  v-for="(trace, i) in vignette(entree.slug).traces"
                  :key="i"
                  :d="trace"
                  stroke="currentColor"
                  stroke-width="1.7"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
            </span>
            <span class="ep-ligne__corps">
              <span class="ep-ligne__titre">{{ entree.titre }}</span>
              <span class="ep-ligne__texte">
                {{ entree.nombre }} article{{ entree.nombre > 1 ? 's' : '' }}
                <template v-if="entree.slogan"> · {{ entree.slogan }}</template>
              </span>
            </span>
            <svg
              class="ep-ligne__chevron"
              width="16"
              height="16"
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
      <p v-if="blog.estHorsLigne" class="ep-etat">
        Version hors ligne : les articles sont servis depuis la copie embarquée du widget.
      </p>
    </template>

    <!--
      Réglage des notifications (P3-PUSH) — placé après le contenu d'aide :
      c'est un réglage, il ne passe pas devant la base de connaissances. Le
      bloc décide seul de s'afficher, et ne s'affiche pas du tout quand l'API
      push est absente de ce contexte ou quand le serveur n'a pas encore de clé
      publique. Aucune demande de permission n'est émise sans un clic ici.
    -->
    <ReglageNotifications />
  </div>
</template>

<script setup lang="ts">
/**
 * Onglet Aide — la base de connaissances du blog, et le réglage des
 * notifications.
 *
 * Source : `chatbot-index.json` (collections + articles publiés), chargé par
 * le store blog (réseau puis repli embarqué). Les articles s'ouvrent sur le
 * blog dans un nouvel onglet : le widget ne duplique pas le contenu éditorial.
 *
 * Le réglage des notifications (P3-PUSH, `ReglageNotifications`) vit ici parce
 * que c'est le seul endroit du widget qui ressemble à des réglages — et parce
 * que l'activation doit rester une action volontaire, jamais une invite.
 */
import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'

import ArticleCard from '@/components/ArticleCard.vue'
import ReglageNotifications from '@/components/ReglageNotifications.vue'
import { CAPACITES, payloadSuggestion, type Capacite } from '@/data/capacites'
import { tracerClicSuggestion } from '@/helpers/tracking'
import { vignetteCollection } from '@/helpers/iconesCollections'
import { useBlogStore } from '@/stores/blog'
import { useIntentStore } from '@/stores/intent'

const blog = useBlogStore()
const router = useRouter()
const intent = useIntentStore()

const vignette = vignetteCollection

const enRecherche = computed(() => blog.recherche.trim().length > 0)
const resultats = computed(() => blog.resultatsRecherche)
const collection = computed(() => blog.collectionCourante)
const articlesCollection = computed(() =>
  collection.value ? blog.articlesDeCollection(collection.value.slug) : [],
)

/**
 * Capacité de Mia cliquée depuis l'aide (A.9) → conversation ouverte avec
 * l'intent chargé, exactement comme depuis l'accueil (A.8).
 */
function envoyer(capacite: Capacite) {
  tracerClicSuggestion(capacite)
  intent.envoyerDansConversation(capacite.libelle, payloadSuggestion(capacite))
  router.push({ name: 'conversation' })
}

onMounted(() => {
  void blog.load()
})
</script>

<style scoped>
/* Les neuf capacités, en tête d'onglet */
.ep-aide__capacites {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.ep-liste--capacites {
  gap: 6px;
}

/* Ligne de capacité : même recette que .ep-ligne, padding resserré (neuf
   lignes doivent rester lisibles sans écraser la recherche et les articles) */
.ep-ligne--capacite {
  padding: 10px 12px;
}

.ep-collection__entete {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.ep-collection__titre {
  font-family: var(--police-titres);
  font-size: 20px;
  font-weight: 600;
  line-height: 1.1;
  letter-spacing: -0.02em;
}

/* Retour : recette .btn-ghost (eperf.css:530-532) */
.ep-retour {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  align-self: flex-start;
  padding: 6px 12px 6px 8px;
  border: 1px solid var(--border);
  border-radius: var(--arrondi-bouton);
  background: transparent;
  color: var(--gold);
  font-family: inherit;
  font-size: 12.5px;
  font-weight: 600;
  transition: background-color var(--t) var(--ease-out), border-color var(--t) var(--ease-out);
}

.ep-retour:hover {
  background: var(--gold-bg);
  border-color: var(--gold-border);
}
</style>
