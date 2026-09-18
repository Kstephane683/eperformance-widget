<template>
  <!--
    Shell de la console : écran de connexion, ou (une fois authentifié) la
    structure à deux colonnes — barre latérale groupée à gauche, en-tête et
    contenu à droite.

    Le shell porte trois responsabilités, et rien d'autre :
      · la bascule login / console, pilotée par le store d'authentification
        (un 401 déclenche la déconnexion, l'interface suit immédiatement) ;
      · le rafraîchissement périodique des données partagées (statistiques et
        liste des conversations) — en pause quand l'onglet est caché ;
      · le tiroir mobile (ouverture, fermeture, retour du focus).
  -->
  <LoginView v-if="!auth.isAuthenticated" />

  <div v-else class="adm">
    <a class="adm-evitement" href="#adm-contenu" @click.prevent="allerAuContenu">
      Aller au contenu
    </a>

    <Sidebar :ouvert="tiroirOuvert" @fermer="fermerTiroir" />

    <div class="adm__colonne">
      <Header
        ref="entete"
        :module="moduleCourant"
        :tiroir-ouvert="tiroirOuvert"
        :jeton="auth.token"
        @basculer-tiroir="basculerTiroir"
        @deconnexion="deconnecter"
      />

      <main id="adm-contenu" ref="contenu" class="adm-contenu" tabindex="-1">
        <div class="adm-contenu__interieur">
          <RouterView />
        </div>
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { RouterView, useRoute, useRouter } from 'vue-router'

import Header from './components/Header.vue'
import Sidebar from './components/Sidebar.vue'
import LoginView from './views/LoginView.vue'
import { MODULE_PAR_DEFAUT, moduleParNom } from './navigation'
import { synchroniserCouleurBarre, suivreSysteme } from './theme'
import { useAdminAuthStore } from './stores/auth'
import { useConsoleStore } from './stores/console'

const auth = useAdminAuthStore()
const consoleStore = useConsoleStore()
const route = useRoute()
const router = useRouter()

/** Module actif — le titre et le sous-titre de l'en-tête en découlent. */
const moduleCourant = computed(() => moduleParNom(route.name))

// ============================================================
// Tiroir mobile
// ============================================================

const tiroirOuvert = ref(false)
const entete = ref<InstanceType<typeof Header> | null>(null)
const contenu = ref<HTMLElement | null>(null)

function basculerTiroir(): void {
  tiroirOuvert.value = !tiroirOuvert.value
}

/** Ferme le tiroir et rend le focus au bouton qui l'a ouvert (WCAG 2.1.2). */
function fermerTiroir(rendreFocus = true): void {
  if (!tiroirOuvert.value) return
  tiroirOuvert.value = false
  if (rendreFocus) entete.value?.boutonMenu?.focus()
}

function allerAuContenu(): void {
  contenu.value?.focus()
}

function surToucheDocument(evenement: KeyboardEvent): void {
  if (evenement.key === 'Escape' && tiroirOuvert.value) fermerTiroir()
}

// Un changement de module referme le tiroir : sur mobile, rester devant un
// menu qui recouvre l'écran qu'on vient d'ouvrir serait une impasse.
watch(() => route.fullPath, () => fermerTiroir(false))

// ============================================================
// Données partagées — statistiques et liste des conversations
// ============================================================

const PERIODE_MS = 30_000
let minuteur: number | null = null

function tic(): void {
  if (document.hidden) return
  void consoleStore.chargerStats()
  void consoleStore.chargerConversations()
}

function demarrer(): void {
  tic()
  minuteur = window.setInterval(tic, PERIODE_MS)
  document.addEventListener('visibilitychange', tic)
}

function arreter(): void {
  if (minuteur !== null) window.clearInterval(minuteur)
  minuteur = null
  document.removeEventListener('visibilitychange', tic)
}

// ============================================================
// Cycle de vie
// ============================================================

let arreterSuiviSysteme: (() => void) | null = null

onMounted(() => {
  // Le thème est posé avant le premier rendu (script de admin.html) ; ici on
  // aligne la couleur de barre du navigateur sur le jeton `--bg`, et on suit la
  // préférence du système tant que l'opérateur n'a rien choisi.
  synchroniserCouleurBarre()
  arreterSuiviSysteme = suivreSysteme()
  document.addEventListener('keydown', surToucheDocument)
  if (auth.isAuthenticated) demarrer()
})

onBeforeUnmount(() => {
  arreter()
  arreterSuiviSysteme?.()
  document.removeEventListener('keydown', surToucheDocument)
})

// Connexion / déconnexion : le rafraîchissement suit l'état d'authentification.
watch(
  () => auth.isAuthenticated,
  (connecte) => {
    if (connecte) demarrer()
    else arreter()
  },
)

function deconnecter(): void {
  auth.logout()
  consoleStore.reinitialiser()
  void router.push({ name: 'login' })
}

// Route protégée atteinte sans session : on reste sur le module par défaut.
watch(
  () => route.name,
  (nom) => {
    if (nom && !moduleParNom(nom) && nom !== 'login') {
      void router.replace({ name: MODULE_PAR_DEFAUT })
    }
  },
)
</script>

<style>
/* Montage dédié #admin (admin.html) — même gabarit plein écran que #app.
   body est position:fixed (style.css, héritage widget) : la console occupe
   100% du viewport et chaque volet défile en interne. */
#admin {
  height: 100%;
  display: flex;
  flex-direction: column;
}
</style>
