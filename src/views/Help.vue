<template>
  <div class="ep-vue">
    <h1 class="ep-vue__titre">Aide</h1>
    <p class="ep-vue__sous-titre">Les guides du blog ePerformance, par sujet.</p>

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
  </div>
</template>

<script setup lang="ts">
/**
 * Onglet Aide — la base de connaissances du blog.
 *
 * Source : `chatbot-index.json` (collections + articles publiés), chargé par
 * le store blog (réseau puis repli embarqué). Les articles s'ouvrent sur le
 * blog dans un nouvel onglet : le widget ne duplique pas le contenu éditorial.
 */
import { computed, onMounted } from 'vue'

import ArticleCard from '@/components/ArticleCard.vue'
import { vignetteCollection } from '@/helpers/iconesCollections'
import { useBlogStore } from '@/stores/blog'

const blog = useBlogStore()

const vignette = vignetteCollection

const enRecherche = computed(() => blog.recherche.trim().length > 0)
const resultats = computed(() => blog.resultatsRecherche)
const collection = computed(() => blog.collectionCourante)
const articlesCollection = computed(() =>
  collection.value ? blog.articlesDeCollection(collection.value.slug) : [],
)

onMounted(() => {
  void blog.load()
})
</script>

<style scoped>
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
