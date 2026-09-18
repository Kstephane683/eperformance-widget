<template>
  <!--
    Invite d'installation — BANDEAU DANS LE FLUX, sous le header.

    Position : c'est la seule qui garantit par construction zéro recouvrement
    avec la zone de saisie et le bouton d'envoi (mesuré en px² par le harnais
    `docs/phase3-tache-6-4/captures.py`). Un bandeau flottant aurait exigé des
    calculs de hauteur à chaque ouverture de clavier — précisément ce que la
    tâche 6.2-BIS avait dû corriger sur `.sticky-cta`.

    Politique d'affichage : `doitProposerInvitation()` de `installation.ts`
    (jamais au premier chargement, jamais pendant une conversation, refus
    mémorisé 30 jours). Le composant ne décide rien, il applique.
  -->
  <aside
    v-if="visible"
    class="ep-invite"
    aria-label="Installer l’application Mia"
    data-testid="invite-installation"
  >
    <span class="ep-invite__icone" aria-hidden="true">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <path
          d="M12 3.5v11m0 0 4-4m-4 4-4-4M4.5 16.5v2a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-2"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
    </span>

    <p class="ep-invite__texte">
      Gardez Mia sous la main : installée, elle s’ouvre en plein écran, sans passer par le
      navigateur.
    </p>

    <div class="ep-invite__actions">
      <button type="button" class="ep-invite__poser" @click="installer">
        {{ libelleAction }}
      </button>
      <button type="button" class="ep-invite__plus-tard" @click="plusTard">Plus tard</button>
    </div>
  </aside>
</template>

<script setup lang="ts">
/**
 * Invite d'installation dans le widget.
 *
 * Deux chemins, jamais confondus :
 *   · l'invite du navigateur a été capturée (Chromium) → le bouton déclenche
 *     l'installation directement, sans quitter le widget ;
 *   · sinon (iOS Safari, Firefox, iframe) → le bouton ouvre la page
 *     `/application/mia`, seul endroit où l'installation est sans ambiguïté :
 *     dans une iframe, le manifeste pris en compte est celui de la PAGE HÔTE
 *     (le site ePerformance, qui a le sien) — installer depuis le widget
 *     installerait le site, pas Mia.
 */
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRoute } from 'vue-router'

import {
  capterInviteNavigateur,
  declencherInstallation,
  DELAI_AVANT_INVITE_MS,
  doitProposerInvitation,
  enregistrerRefus,
  enregistrerVisite,
  etatInstallationInitial,
  inviteNavigateurDisponible,
  urlInstallation,
  type EtatInstallation,
} from '@/helpers/installation'
import { estDansIframe, estModeApplication, plateforme } from '@/helpers/environnement'
import { useMessagesStore } from '@/stores/messages'

const route = useRoute()
const messages = useMessagesStore()

const etat = ref<EtatInstallation>(etatInstallationInitial())
const delaiEcoule = ref(false)
const masquee = ref(false)
const inviteDisponible = ref(false)

let minuteur: ReturnType<typeof setTimeout> | null = null

/** Une conversation est engagée dès que le visiteur a écrit (hors accueil de Mia) */
const conversationEnCours = computed(() => messages.messages.some((m) => m.role === 'user'))

const visible = computed(() => {
  if (masquee.value) return false
  return doitProposerInvitation({
    etat: etat.value,
    modeApplication: estModeApplication(),
    delaiEcoule: delaiEcoule.value,
    route: String(route.name ?? ''),
    conversationEnCours: conversationEnCours.value,
  })
})

/**
 * Libellé du bouton. Sur iOS Safari il n'existe pas d'invite programmatique :
 * on annonce « Comment installer » plutôt que « Installer », pour ne pas
 * promettre une action qui n'aura pas lieu.
 */
const libelleAction = computed(() => {
  if (inviteDisponible.value) return 'Installer'
  if (plateforme() === 'ios') return 'Comment installer'
  return 'Installer l’application'
})

async function installer() {
  const resultat = await declencherInstallation()
  if (resultat === 'accepte' || resultat === 'refuse') {
    masquee.value = true
    etat.value = { ...etat.value, installee: resultat === 'accepte' }
    return
  }
  // Pas d'invite en attente : la page d'installation prend le relais. Dans une
  // iframe, un nouvel onglet — la navigation de l'iframe afficherait la page
  // dans le panneau du widget.
  const url = urlInstallation()
  if (estDansIframe()) {
    window.open(url, '_blank', 'noopener')
  } else {
    window.location.assign(url)
  }
  masquee.value = true
}

function plusTard() {
  masquee.value = true
  // Le refus est mémorisé (30 jours) : on ne repropose pas à chaque écran.
  enregistrerRefus()
}

onMounted(() => {
  capterInviteNavigateur()
  inviteDisponible.value = inviteNavigateurDisponible()
  etat.value = enregistrerVisite()
  // Jamais dans les premières secondes : l'invite attend que la page vive.
  minuteur = setTimeout(() => {
    delaiEcoule.value = true
    inviteDisponible.value = inviteNavigateurDisponible()
  }, DELAI_AVANT_INVITE_MS)
})

onUnmounted(() => {
  if (minuteur) clearTimeout(minuteur)
})
</script>

<style scoped>
/* Bandeau : filet, fond de carte, aucune ombre — il est dans le flux, il n'a
   pas à se détacher de la surface. */
.ep-invite {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  padding: 10px 14px;
  border-bottom: 1px solid var(--border);
  background: var(--card2);
  flex-shrink: 0;
}

.ep-invite__icone {
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  flex-shrink: 0;
  border-radius: var(--arrondi-input);
  background: var(--gold-bg);
  color: var(--gold);
}

.ep-invite__texte {
  flex: 1;
  min-width: 12rem;
  font-size: 12.5px;
  line-height: 1.5;
  color: var(--soft);
}

.ep-invite__actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

/* Action principale : recette .btn-gold du site (fond d'accent, --on-gold) */
.ep-invite__poser {
  padding: 8px 14px;
  border: none;
  border-radius: var(--arrondi-bouton);
  background: var(--gold);
  color: var(--on-gold);
  font-family: inherit;
  font-size: 12.5px;
  font-weight: 600;
  transition: background-color var(--t) var(--ease-out), transform var(--t-fast) var(--ease-out);
}

.ep-invite__poser:hover {
  background: var(--gold2);
}

.ep-invite__poser:active {
  transform: translateY(1px);
}

/* Action secondaire : recette .btn-quiet — le texte seul, sans contour */
.ep-invite__plus-tard {
  padding: 8px 10px;
  border: none;
  border-radius: var(--arrondi-bouton);
  background: transparent;
  color: var(--muted);
  font-family: inherit;
  font-size: 12.5px;
  transition: color var(--t) var(--ease-out);
}

.ep-invite__plus-tard:hover {
  color: var(--gold);
}

/* Mobile : le bandeau passe sur deux lignes (texte puis actions) */
@media (max-width: 420px) {
  .ep-invite {
    align-items: flex-start;
  }

  .ep-invite__actions {
    width: 100%;
    justify-content: flex-end;
  }
}
</style>
