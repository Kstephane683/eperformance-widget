/**
 * Socle commun des pages publiques de l'application Mia
 * (`/application` et `/application/mia`).
 *
 * Ces pages sont des documents HTML statiques : tout le contenu est dans le
 * balisage (lisible sans JavaScript, indexable), et ce module n'ajoute que
 * l'interactivité — bascule de thème, installation, entretien du cache local.
 * Aucun framework ici : le widget embarque Vue, ces pages n'en ont pas besoin.
 */

import { estModeApplication, plateforme } from '@/helpers/environnement'
import {
  capterInviteNavigateur,
  declencherInstallation,
  inviteNavigateurDisponible,
  lireEtatInstallation,
} from '@/helpers/installation'
import { enregistrerServiceWorker, viderCachesApplication } from '@/helpers/pwa'
import { basculerTheme } from '@/helpers/theme'

/** Branche le bouton de bascule de thème (recette .theme-toggle du site) */
function brancherTheme(): void {
  const bouton = document.querySelector<HTMLButtonElement>('[data-bascule-theme]')
  if (!bouton) return
  bouton.addEventListener('click', () => {
    const theme = basculerTheme()
    bouton.setAttribute(
      'aria-label',
      theme === 'dark' ? 'Passer au thème clair' : 'Passer au thème sombre',
    )
  })
}

/** Annonce un message dans une zone `aria-live` de la page */
function annoncer(message: string): void {
  const zone = document.querySelector<HTMLElement>('[data-message-installation]')
  if (!zone) return
  zone.textContent = message
}

/**
 * Branche le bouton « Installer l'application ».
 *
 *   · application déjà installée (mode standalone, ou installation mémorisée)
 *     → le bouton disparaît et le bandeau « installée » s'affiche ;
 *   · invite du navigateur disponible (Chromium) → installation directe ;
 *   · sinon (Safari/iOS, Firefox, navigateur sans invite) → on conduit le
 *     visiteur aux étapes écrites, qui sont toujours affichées plus bas.
 */
function brancherInstallation(): void {
  const bouton = document.querySelector<HTMLButtonElement>('[data-installer]')
  const etat = document.querySelector<HTMLElement>('[data-etat-installation]')
  const etapes = document.querySelector<HTMLElement>('[data-etapes-installation]')

  if (estModeApplication() || lireEtatInstallation().installee) {
    bouton?.setAttribute('hidden', '')
    etat?.removeAttribute('hidden')
  }

  bouton?.addEventListener('click', async () => {
    const resultat = await declencherInstallation()
    if (resultat === 'accepte') {
      bouton.setAttribute('hidden', '')
      etat?.removeAttribute('hidden')
      annoncer('Mia est installée sur cet appareil.')
      return
    }
    if (resultat === 'refuse') {
      annoncer('Installation annulée. Vous pouvez réessayer quand vous voulez.')
      return
    }
    // Pas d'invite en attente : les étapes écrites prennent le relais.
    etapes?.scrollIntoView({ block: 'start', behavior: 'smooth' })
    etapes?.setAttribute('data-mis-en-avant', '')
    annoncer(
      plateforme() === 'ios'
        ? 'Votre navigateur ne propose pas l’installation automatique : suivez les étapes ci-dessous.'
        : 'Suivez les étapes ci-dessous pour installer Mia depuis votre navigateur.',
    )
  })
}

/** Bouton d'entretien (portail) : vide les caches du service worker */
function brancherEntretien(): void {
  const bouton = document.querySelector<HTMLButtonElement>('[data-vider-cache]')
  if (!bouton) return
  bouton.addEventListener('click', async () => {
    const ok = await viderCachesApplication()
    annoncer(
      ok
        ? 'Cache local vidé. Rechargez la page pour repartir de la dernière version.'
        : 'Aucun cache à vider dans ce navigateur.',
    )
  })
}

/** Initialise tout ce qui est commun aux pages publiques */
export function initialiserPagePublique(): void {
  brancherTheme()
  // L'événement d'installation peut arriver avant que le bouton ne soit branché
  capterInviteNavigateur()
  brancherInstallation()
  brancherEntretien()
  // Installabilité : le service worker est enregistré dès la page publique
  // (elle porte le manifeste), donc avant même d'ouvrir l'application.
  void enregistrerServiceWorker()
}

/** Vrai si le navigateur peut installer directement (utilisé par les tests) */
export function installationDirecteDisponible(): boolean {
  return inviteNavigateurDisponible()
}
