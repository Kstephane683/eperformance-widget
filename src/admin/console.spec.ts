/**
 * Tests du shell de la console (tâche 6.3) : les onze modules, la navigation,
 * l'en-tête, et les deux règles qu'on ne veut pas voir régresser.
 *
 * L'API est ENTIÈREMENT simulée : les tests ne dépendent ni du réseau, ni d'un
 * compte réel. Les jeux d'essai contiennent volontairement des clés d'agent
 * internes (`sales-coach`, `closer-pro`) : c'est précisément ce que l'interface
 * ne doit JAMAIS afficher, et le test le vérifie sur le rendu, pas sur le code.
 */
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { VueWrapper } from '@vue/test-utils'

import App from '@/admin/App.vue'
import { API_BASE } from '@/admin/api'
import { MODULES } from '@/admin/navigation'
import { creerRouteur } from '@/admin/router'
import { useAdminAuthStore } from '@/admin/stores/auth'
import { useConsoleStore } from '@/admin/stores/console'
import { CLE_THEME, lireChoix } from '@/admin/theme'

enableAutoUnmount(afterEach)

// ============================================================
// Jeux d'essai — des données réalistes, jamais des agents affichés
// ============================================================

const CONVERSATIONS = [
  {
    conversation_id: 'conv_000001',
    site_id: 'eperformance_vitrine',
    status: 'escalated',
    human_active: false,
    // Clé de routage interne : ne doit jamais apparaître à l'écran
    assigned_agent: 'sales-coach',
    lead_captured: true,
    lead_name: 'Awa Traoré',
    lead_phone: '+225 01 51 17 06 66',
    message_count: 6,
    last_message: 'Je cherche à développer mon activité',
    last_message_role: 'user',
    created_at: '2026-09-17T09:00:00Z',
    last_message_at: '2026-09-18T09:00:00Z',
  },
  {
    conversation_id: 'conv_000002',
    site_id: 'blog_eperformance',
    status: 'resolved',
    human_active: false,
    assigned_agent: null,
    lead_captured: false,
    lead_name: null,
    lead_phone: null,
    message_count: 3,
    last_message: 'Merci, c’est clair',
    last_message_role: 'user',
    created_at: '2026-09-16T09:00:00Z',
    last_message_at: '2026-09-16T09:30:00Z',
  },
]

const STATS = {
  conversations: 2,
  conversations_en_attente: 1,
  leads_chatbot: 1,
  candidats: 1,
  candidats_en_attente: 1,
  users: 1,
}

const UTILISATEURS = [
  {
    id: 3,
    email: 'stephane@eperformance.pro',
    nom: 'Stéphane Ballo',
    role: 'admin',
    is_active: true,
    last_login: '2026-09-18T08:00:00Z',
    created_at: '2026-01-01T08:00:00Z',
  },
]

const CANDIDATS = [
  {
    id: 12,
    nom: 'Ibrahim Koné',
    email: 'ibrahim@exemple.fr',
    whatsapp: '+225 07 00 00 00 00',
    entreprise: 'Kone Conseil',
    secteur: 'Conseil',
    score: 72,
    statut: 'en_attente',
    niveau_accompagnement: 'croissance',
    created_at: '2026-09-15T09:00:00Z',
  },
]

/** Jeton factice : seule la charge utile est lue (menu de profil). */
function jetonFactice(): string {
  const base64url = (valeur: string) => {
    const octets = new TextEncoder().encode(valeur)
    const binaire = Array.from(octets, (octet) => String.fromCharCode(octet)).join('')
    return btoa(binaire).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  }
  return `${base64url('{"alg":"HS256"}')}.${base64url(
    JSON.stringify({ email: 'stephane@eperformance.pro', nom: 'Stéphane Ballo', role: 'admin' }),
  )}.signature`
}

function reponseJson(donnees: unknown, status = 200): Response {
  return new Response(JSON.stringify(donnees), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function installerApi(): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (entree: RequestInfo | URL, init?: RequestInit) => {
      const url = String(entree).replace(API_BASE, '')
      if (url.includes('/admin/stats')) return reponseJson(STATS)
      if (url.includes('/admin/conversations/')) {
        const identifiant = url.split('/').pop() ?? ''
        const resume = CONVERSATIONS.find((c) => c.conversation_id === identifiant)
        return reponseJson({
          conversation: resume ?? CONVERSATIONS[0],
          lead: { name: 'Awa Traoré', email: 'awa@exemple.fr', phone: '+225 01 51 17 06 66' },
          messages: [
            {
              id: 1,
              role: 'user',
              content: 'Bonjour',
              human: false,
              agent_used: null,
              intent: null,
              created_at: '2026-09-18T09:00:00Z',
            },
            {
              id: 2,
              role: 'assistant',
              content: 'Bonjour, je suis Mia.',
              human: false,
              // Fuite potentielle : l'ancien écran affichait cette valeur
              agent_used: 'sales-coach',
              intent: 'greeting',
              created_at: '2026-09-18T09:00:05Z',
            },
          ],
        })
      }
      if (url.includes('/admin/conversations')) {
        return reponseJson({ conversations: CONVERSATIONS, total: CONVERSATIONS.length })
      }
      if (url.includes('/admin/users')) return reponseJson({ users: UTILISATEURS, total: 1 })
      if (url.includes('/admin/candidats')) return reponseJson({ candidats: CANDIDATS, total: 1 })
      if (init?.method === 'POST') return reponseJson({}, 200)
      return reponseJson({}, 404)
    }),
  )
}

// ============================================================
// Montage
// ============================================================

async function monterConsole(chemin = '/'): Promise<{
  wrapper: VueWrapper
  routeur: ReturnType<typeof creerRouteur>
}> {
  const pinia = createPinia()
  setActivePinia(pinia)
  const routeur = creerRouteur()
  await routeur.push(chemin)
  await routeur.isReady()

  const wrapper = mount(App, {
    global: { plugins: [pinia, routeur] },
    attachTo: document.body,
  })
  await flushPromises()
  return { wrapper, routeur }
}

beforeEach(() => {
  localStorage.clear()
  document.documentElement.removeAttribute('data-theme')
  document.head.querySelector('meta[name="theme-color"]')?.remove()
  localStorage.setItem('eperf_admin_token', jetonFactice())
  installerApi()
})

// ============================================================
// Les onze modules
// ============================================================

describe('Console — les onze modules', () => {
  // Monter onze fois le shell (store + routeur + API simulée) prend quelques
  // secondes : le délai est explicite plutôt que subi.
  it(
    'rend chaque module, avec son titre dans l’en-tête et un contenu réel',
    async () => {
      for (const module of MODULES) {
        const { wrapper } = await monterConsole(module.chemin)
        await flushPromises()

        expect(wrapper.find('h1').text(), `titre de ${module.nom}`).toBe(module.libelle)

        const lien = wrapper.find(`a.adm-lien[data-module="${module.nom}"]`)
        expect(lien.exists(), `entrée de barre latérale pour ${module.nom}`).toBe(true)
        expect(lien.attributes('aria-current'), `aria-current de ${module.nom}`).toBe('page')

        // Un module ne rend pas une page blanche : son contenu porte du texte
        const contenu = wrapper.find('#adm-contenu').text()
        expect(contenu.length, `contenu de ${module.nom}`).toBeGreaterThan(30)

        wrapper.unmount()
      }
    },
    30_000,
  )

  it('ne pose aria-current que sur le module actif', async () => {
    const { wrapper } = await monterConsole('/prospects')
    const actifs = wrapper.findAll('a.adm-lien[aria-current="page"]')
    expect(actifs).toHaveLength(1)
    expect(actifs[0].attributes('data-module')).toBe('prospects')
  })

  it('groupe les modules par intention dans la barre latérale', async () => {
    const { wrapper } = await monterConsole('/conversations')
    const groupeTitres = wrapper.findAll('.adm-barre__groupe-titre').map((n) => n.text())
    expect(groupeTitres).toEqual(['Pilotage', 'Conversations', 'Contenu', 'Réglages'])
    expect(wrapper.findAll('a.adm-lien')).toHaveLength(11)
  })

  it('parcourt les modules au clavier, dans l’ordre affiché', async () => {
    const { wrapper } = await monterConsole('/tableau-de-bord')
    const modules = wrapper.find('.adm-barre__modules')

    const premier = wrapper.find('a.adm-lien[data-module="tableau-de-bord"]').element as HTMLElement
    premier.focus()

    await modules.trigger('keydown', { key: 'ArrowDown' })
    expect((document.activeElement as HTMLElement).dataset.module).toBe('activite')

    await modules.trigger('keydown', { key: 'ArrowUp' })
    expect((document.activeElement as HTMLElement).dataset.module).toBe('tableau-de-bord')

    await modules.trigger('keydown', { key: 'End' })
    expect((document.activeElement as HTMLElement).dataset.module).toBe('integrations')

    await modules.trigger('keydown', { key: 'Home' })
    expect((document.activeElement as HTMLElement).dataset.module).toBe('tableau-de-bord')
  })

  it('mène au contenu par le lien d’évitement', async () => {
    const { wrapper } = await monterConsole('/conversations')
    const lien = wrapper.find('a.adm-evitement')
    expect(lien.attributes('href')).toBe('#adm-contenu')
    await lien.trigger('click')
    expect(document.activeElement?.id).toBe('adm-contenu')
  })
})

// ============================================================
// Règle produit : seul Mia est visible
// ============================================================

describe('Console — aucun agent interne n’apparaît', () => {
  it('affiche Mia et un conseiller, jamais une clé de routage', async () => {
    const { wrapper } = await monterConsole('/conversations')
    await flushPromises()

    // On ouvre la conversation dont le jeu d'essai porte `assigned_agent`
    const item = wrapper.find('.adm-boite__item')
    expect(item.exists()).toBe(true)
    await item.trigger('click')
    await flushPromises()

    const texte = wrapper.text()
    expect(texte).toContain('Mia')
    expect(texte).not.toContain('sales-coach')
    expect(texte).not.toContain('closer-pro')
    expect(texte).not.toContain('sales')
    // Ni sélecteur d'assignation, ni pastille d'agent
    expect(wrapper.find('select[aria-label*="gent"]').exists()).toBe(false)
    expect(texte.toLowerCase()).not.toContain('assigner')
  })

  it('n’expose aucun compteur d’agents dans la barre latérale', async () => {
    const { wrapper } = await monterConsole('/conversations')
    const textes = wrapper.findAll('a.adm-lien').map((lien) => lien.text().toLowerCase())
    for (const texte of textes) {
      expect(texte).not.toContain('agent')
    }
  })
})

// ============================================================
// En-tête — recherche, notifications, profil
// ============================================================

describe('Console — en-tête', () => {
  it('cherche dans les conversations et ouvre le module avec le filtre', async () => {
    const { wrapper, routeur } = await monterConsole('/tableau-de-bord')
    await flushPromises()

    const champ = wrapper.find('.adm-recherche input')
    await champ.setValue('awa')
    await flushPromises()

    const resultats = wrapper.findAll('[role="option"]')
    expect(resultats.length).toBeGreaterThan(0)

    await champ.trigger('keydown', { key: 'Enter' })
    await flushPromises()

    expect(routeur.currentRoute.value.name).toBe('conversations')
    expect(routeur.currentRoute.value.query.q).toBe('Awa Traoré')
  })

  it('annonce l’état du champ de recherche aux technologies d’assistance', async () => {
    const { wrapper } = await monterConsole('/tableau-de-bord')
    const champ = wrapper.find('.adm-recherche input')
    expect(champ.attributes('role')).toBe('combobox')
    expect(champ.attributes('aria-expanded')).toBe('false')

    await champ.setValue('awa')
    await flushPromises()
    expect(champ.attributes('aria-expanded')).toBe('true')
    expect(champ.attributes('aria-controls')).toBe('adm-resultats-recherche')
  })

  it('liste ce qui attend un conseiller, avec un lien vers le module', async () => {
    const { wrapper } = await monterConsole('/tableau-de-bord')
    await flushPromises()

    const cloche = wrapper.find('.adm-notifications button')
    expect(cloche.attributes('aria-expanded')).toBe('false')
    await cloche.trigger('click')

    expect(cloche.attributes('aria-expanded')).toBe('true')
    const panneau = wrapper.find('#adm-panneau-notifications')
    expect(panneau.exists()).toBe(true)
    expect(panneau.text()).toContain('attend un conseiller')
    expect(panneau.text()).toContain('candidature')

    const lien = panneau.find('a')
    expect(lien.attributes('href')).toContain('conversations')
  })

  it('applique le thème choisi et le mémorise', async () => {
    const { wrapper } = await monterConsole('/tableau-de-bord')

    await wrapper.find('.adm-profil__declencheur').trigger('click')
    const sombre = wrapper.find('.adm-profil__option input[value="sombre"]')
    await sombre.setValue()

    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    expect(lireChoix()).toBe('sombre')
    expect(localStorage.getItem(CLE_THEME)).toBe('dark')

    const systeme = wrapper.find('.adm-profil__option input[value="systeme"]')
    await systeme.setValue()
    expect(localStorage.getItem(CLE_THEME)).toBeNull()
  })

  it('affiche l’identité lue dans le jeton', async () => {
    const { wrapper } = await monterConsole('/tableau-de-bord')
    await wrapper.find('.adm-profil__declencheur').trigger('click')
    const panneau = wrapper.find('#adm-panneau-profil')
    expect(panneau.text()).toContain('Stéphane Ballo')
    expect(panneau.text()).toContain('stephane@eperformance.pro')
  })

  it('déconnecte et vide les données de la session', async () => {
    const { wrapper, routeur } = await monterConsole('/conversations')
    await flushPromises()
    expect(useConsoleStore().conversations.length).toBe(2)

    await wrapper.find('.adm-profil__declencheur').trigger('click')
    const sortie = wrapper
      .findAll('.adm-profil__sortie, .adm-panneau button')
      .find((bouton) => bouton.text().includes('Déconnexion'))
    expect(sortie).toBeDefined()
    await sortie?.trigger('click')
    await flushPromises()

    expect(useAdminAuthStore().isAuthenticated).toBe(false)
    expect(useConsoleStore().conversations).toHaveLength(0)
    expect(routeur.currentRoute.value.name).toBe('login')
    expect(wrapper.text()).toContain('Console d’administration du chatbot')
  })
})

// ============================================================
// Tiroir mobile
// ============================================================

describe('Console — tiroir mobile', () => {
  it('s’ouvre au bouton, se ferme à Échap et rend le focus au bouton', async () => {
    const { wrapper } = await monterConsole('/conversations')
    const burger = wrapper.find('.adm-entete__burger')

    expect(burger.attributes('aria-expanded')).toBe('false')
    expect(burger.attributes('aria-controls')).toBe('adm-modules')

    await burger.trigger('click')
    await flushPromises()
    expect(burger.attributes('aria-expanded')).toBe('true')
    expect(wrapper.find('.adm-barre--ouverte').exists()).toBe(true)
    expect(wrapper.find('[data-testid="voile-tiroir"]').exists()).toBe(true)
    // Le focus est entré dans le menu, sur le module actif
    expect((document.activeElement as HTMLElement).dataset.module).toBe('conversations')

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await flushPromises()
    expect(burger.attributes('aria-expanded')).toBe('false')
    expect(document.activeElement).toBe(burger.element)
  })

  it('se referme quand on choisit un module', async () => {
    const { wrapper, routeur } = await monterConsole('/conversations')
    await wrapper.find('.adm-entete__burger').trigger('click')
    await flushPromises()

    await wrapper.find('a.adm-lien[data-module="prospects"]').trigger('click')
    await flushPromises()

    expect(routeur.currentRoute.value.name).toBe('prospects')
    expect(wrapper.find('.adm-barre--ouverte').exists()).toBe(false)
  })
})
