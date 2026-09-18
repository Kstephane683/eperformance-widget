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

    <!-- Article vedette : le dernier publié du blog (aide + actualités
         partagent la même source, chatbot-index.json) -->
    <section v-if="vedette" class="ep-accueil__bloc" aria-labelledby="ep-vedette-titre">
      <span id="ep-vedette-titre" class="ep-eyebrow">Dernier article</span>
      <ArticleCard :article="vedette" />
    </section>

    <p v-else-if="blog.isLoading" class="ep-etat">Chargement des articles…</p>

    <!-- Suggestions : chacune envoie son libellé comme message à Mia -->
    <section class="ep-accueil__bloc" aria-labelledby="ep-suggestions-titre">
      <span id="ep-suggestions-titre" class="ep-eyebrow">Suggestions</span>
      <ul class="ep-suggestions">
        <li v-for="suggestion in SUGGESTIONS" :key="suggestion.libelle">
          <button type="button" class="ep-suggestion" @click="envoyer(suggestion.libelle)">
            <span class="ep-suggestion__icone" aria-hidden="true">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
                <path
                  v-for="(trace, i) in suggestion.traces"
                  :key="i"
                  :d="trace"
                  stroke="currentColor"
                  stroke-width="1.7"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
            </span>
            <span class="ep-suggestion__texte">{{ suggestion.libelle }}</span>
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
  </div>
</template>

<script setup lang="ts">
// Écran d'accueil du widget (tâche 6.2-bis) — remplace l'écran minimal
// « Mia / Démarrer la conversation » par la structure Intercom : titre,
// carte de saisie, article vedette, suggestions.
import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'

import ArticleCard from '@/components/ArticleCard.vue'
import { useBlogStore } from '@/stores/blog'
import { useIntentStore } from '@/stores/intent'

const router = useRouter()
const blog = useBlogStore()
const intent = useIntentStore()

/** Article vedette : le plus récent publié, servi par l'index du blog */
const vedette = computed(() => blog.dernierArticle)

/**
 * Suggestions de l'accueil — chaque libellé est envoyé tel quel à Mia
 * (comportement Intercom : la suggestion EST le message).
 */
const SUGGESTIONS = [
  {
    libelle: 'Trouver une réponse',
    traces: ['M11 4.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13z', 'M15.8 15.8 20 20'],
  },
  {
    libelle: 'Exploiter l’IA et l’automatisation',
    traces: ['M12 4.2l1.7 4.3 4.3 1.7-4.3 1.7L12 16.2l-1.7-4.3L6 10.2l4.3-1.7z'],
  },
  {
    libelle: 'Créer un site web qui convertit',
    traces: ['M3.5 5.5h17v13h-17z', 'M3.5 9.5h17', 'M7 13h10'],
  },
  {
    libelle: 'Améliorer mon acquisition',
    traces: ['M4 19.5V13M9.6 19.5V8.5M15.2 19.5v-5M20.8 19.5V5', 'M3 21h18'],
  },
  {
    libelle: 'Parler à un conseiller',
    traces: ['M12 4.2a4 4 0 1 1 0 8 4 4 0 0 1 0-8z', 'M5 20.2a7 7 0 0 1 14 0'],
  },
] as const

function poserQuestion() {
  intent.demanderFocus()
  router.push({ name: 'conversation' })
}

/** Suggestion cliquée → conversation ouverte + message envoyé à Mia */
function envoyer(message: string) {
  intent.envoyerDansConversation(message)
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
