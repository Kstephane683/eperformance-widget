/**
 * Tests de la tâche 6.4 (Bloc B), côté socle PWA.
 *
 *   · politique de l'invite d'installation — jamais au premier chargement,
 *     jamais pendant une conversation, refus mémorisé 30 jours ;
 *   · capture et rejeu de `beforeinstallprompt` ;
 *   · détection d'environnement (iframe, mode application, plateforme) ;
 *   · état réseau (écran hors-ligne) ;
 *   · thème hors iframe (choix mémorisé, préférence système).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { estDansIframe, estModeApplication, estSafari, plateforme } from '@/helpers/environnement'
import {
  capterInviteNavigateur,
  CLE_ETAT_INSTALLATION,
  declencherInstallation,
  DELAI_REFUS_MS,
  doitProposerInvitation,
  ecrireEtatInstallation,
  enregistrerInstallation,
  enregistrerRefus,
  enregistrerVisite,
  inviteNavigateurDisponible,
  lireEtatInstallation,
  urlInstallation,
  VISITES_MINIMUM,
  type EtatInstallation,
  type EvenementInstallation,
} from '@/helpers/installation'
import { horsLigne, initReseau, reverifierReseau } from '@/helpers/reseau'
import { appliquerTheme, basculerTheme, CLE_THEME, lireThemeMemorise } from '@/helpers/theme'

const etatVierge: EtatInstallation = { refusLe: null, visites: 0, installee: false }

function contexteInvite(overrides: Partial<Parameters<typeof doitProposerInvitation>[0]> = {}) {
  return {
    etat: { ...etatVierge, visites: VISITES_MINIMUM },
    modeApplication: false,
    delaiEcoule: true,
    route: 'home',
    conversationEnCours: false,
    ...overrides,
  }
}

beforeEach(() => {
  localStorage.clear()
  vi.unstubAllGlobals()
})

describe('Invite d’installation — politique d’affichage', () => {
  it('ne se propose JAMAIS au premier chargement', () => {
    expect(doitProposerInvitation(contexteInvite({ etat: { ...etatVierge, visites: 1 } }))).toBe(false)
    expect(doitProposerInvitation(contexteInvite({ etat: etatVierge }))).toBe(false)
  })

  it('ne se propose pas avant la fin du délai de politesse', () => {
    expect(doitProposerInvitation(contexteInvite({ delaiEcoule: false }))).toBe(false)
  })

  it('ne se propose JAMAIS pendant une conversation', () => {
    expect(doitProposerInvitation(contexteInvite({ route: 'conversation' }))).toBe(false)
    expect(doitProposerInvitation(contexteInvite({ conversationEnCours: true }))).toBe(false)
  })

  it('ne se propose pas si l’application est déjà installée', () => {
    expect(doitProposerInvitation(contexteInvite({ modeApplication: true }))).toBe(false)
    expect(
      doitProposerInvitation(contexteInvite({ etat: { ...etatVierge, visites: 3, installee: true } })),
    ).toBe(false)
  })

  it('se propose à la deuxième visite, sur un écran d’onglet, sans conversation', () => {
    expect(doitProposerInvitation(contexteInvite())).toBe(true)
  })

  it('respecte le refus pendant 30 jours, puis oublie', () => {
    const maintenant = Date.parse('2026-09-18T12:00:00Z')
    const refuse = { ...etatVierge, visites: 2, refusLe: maintenant - 1000 }
    expect(doitProposerInvitation(contexteInvite({ etat: refuse, maintenant }))).toBe(false)
    expect(
      doitProposerInvitation({
        ...contexteInvite({ etat: refuse }),
        etat: { ...refuse, refusLe: maintenant - DELAI_REFUS_MS - 1000 },
        maintenant,
      }),
    ).toBe(true)
  })
})

describe('Invite d’installation — mémoire', () => {
  it('compte les visites et oublie un refus périmé', () => {
    const maintenant = Date.parse('2026-09-18T12:00:00Z')
    ecrireEtatInstallation({ visites: 1, refusLe: maintenant - DELAI_REFUS_MS - 1, installee: false })
    const apres = enregistrerVisite(localStorage, maintenant)
    expect(apres.visites).toBe(2)
    expect(apres.refusLe).toBeNull()
  })

  it('mémorise le refus et l’installation', () => {
    const maintenant = Date.parse('2026-09-18T12:00:00Z')
    enregistrerRefus(localStorage, maintenant)
    expect(lireEtatInstallation(localStorage).refusLe).toBe(maintenant)
    enregistrerInstallation(localStorage)
    const etat = lireEtatInstallation(localStorage)
    expect(etat.installee).toBe(true)
    expect(etat.refusLe).toBeNull()
  })

  it('retombe sur un état vierge si le stockage est illisible', () => {
    localStorage.setItem(CLE_ETAT_INSTALLATION, '{pas du json')
    expect(lireEtatInstallation(localStorage)).toEqual(etatVierge)
  })
})

describe('Invite du navigateur (Chromium)', () => {
  function evenementFactice(choix: 'accepted' | 'dismissed'): EvenementInstallation {
    const evenement = new Event('beforeinstallprompt') as EvenementInstallation
    evenement.prompt = vi.fn().mockResolvedValue(undefined)
    evenement.userChoice = Promise.resolve({ outcome: choix })
    return evenement
  }

  it('capture l’événement, empêche son comportement par défaut et le rejoue', async () => {
    capterInviteNavigateur()
    const evenement = evenementFactice('accepted')
    const empecher = vi.spyOn(evenement, 'preventDefault')
    window.dispatchEvent(evenement)
    expect(empecher).toHaveBeenCalled()
    expect(inviteNavigateurDisponible()).toBe(true)

    const resultat = await declencherInstallation()
    expect(resultat).toBe('accepte')
    expect(evenement.prompt).toHaveBeenCalled()
    // Une seule fois : l'invite ne peut pas être rejouée
    expect(inviteNavigateurDisponible()).toBe(false)
    expect(await declencherInstallation()).toBe('indisponible')
  })

  it('mémorise un refus et ne propose plus rien', async () => {
    capterInviteNavigateur()
    window.dispatchEvent(evenementFactice('dismissed'))
    expect(await declencherInstallation()).toBe('refuse')
    expect(lireEtatInstallation(localStorage).refusLe).not.toBeNull()
  })
})

describe('Détection d’environnement', () => {
  it('reconnaît un document de premier niveau comme mode application', () => {
    expect(estDansIframe()).toBe(false) // jsdom : pas d'iframe parente
  })

  it('reconnaît le mode application installé (display-mode standalone)', () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn((requete: string) => ({
        matches: requete === '(display-mode: standalone)',
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    )
    expect(estModeApplication()).toBe(true)
  })

  it('classe iPhone, Android et ordinateur', () => {
    const ua = (valeur: string) =>
      vi.stubGlobal('navigator', { userAgent: valeur, maxTouchPoints: 0 })
    ua('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1')
    expect(plateforme()).toBe('ios')
    expect(estSafari()).toBe(true)
    ua('Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36')
    expect(plateforme()).toBe('android')
    expect(estSafari()).toBe(false)
    ua('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36')
    expect(plateforme()).toBe('ordinateur')
  })

  it('construit l’URL de la page d’installation depuis le document courant', () => {
    expect(urlInstallation()).toBe('http://localhost:3000/application/mia/')
  })
})

describe('État réseau', () => {
  it('affiche l’écran d’attente hors ligne puis le retire au retour', () => {
    const nettoyer = initReseau()
    expect(horsLigne.value).toBe(false)

    vi.stubGlobal('navigator', { onLine: false, userAgent: 'test' })
    window.dispatchEvent(new Event('offline'))
    expect(horsLigne.value).toBe(true)

    vi.stubGlobal('navigator', { onLine: true, userAgent: 'test' })
    window.dispatchEvent(new Event('online'))
    expect(horsLigne.value).toBe(false)
    expect(reverifierReseau()).toBe(false)
    nettoyer()
  })
})

describe('Thème hors iframe', () => {
  it('mémorise un choix explicite et le relit', () => {
    appliquerTheme('dark')
    expect(localStorage.getItem(CLE_THEME)).toBe('dark')
    expect(lireThemeMemorise(localStorage)).toBe('dark')
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    appliquerTheme('light')
    expect(basculerTheme()).toBe('dark')
  })
})
