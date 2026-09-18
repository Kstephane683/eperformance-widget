/**
 * Tests de la zone de saisie (tâche 6.2-bis) : bouton d'envoi désactivé à
 * vide, charge utile d'envoi (texte + pièce jointe), GIF annoncé indisponible,
 * micro qui se dégrade proprement sans Web Speech API, lien de confidentialité.
 */
import { mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import ChatInput from '@/components/ChatInput.vue'

function monter() {
  return mount(ChatInput, { global: { plugins: [createPinia()] } })
}

beforeEach(() => {
  // jsdom n'expose pas l'API de dictée : c'est le cas « dégradé propre »
  delete (window as { SpeechRecognition?: unknown }).SpeechRecognition
  delete (window as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition
})

describe('ChatInput — envoi', () => {
  it('désactive le bouton d’envoi tant que le champ est vide', async () => {
    const wrapper = monter()
    const bouton = wrapper.find('button[type="submit"]')

    expect(bouton.attributes('disabled')).toBeDefined()

    // Des espaces ne suffisent pas : rien à envoyer
    await wrapper.find('input.ep-input').setValue('   ')
    expect(wrapper.find('button[type="submit"]').attributes('disabled')).toBeDefined()

    await wrapper.find('input.ep-input').setValue('Bonjour Mia')
    expect(wrapper.find('button[type="submit"]').attributes('disabled')).toBeUndefined()
  })

  it('émet le texte saisi puis vide le champ', async () => {
    const wrapper = monter()

    await wrapper.find('input.ep-input').setValue('  Comment calculer mon CAC ?  ')
    await wrapper.find('form').trigger('submit')

    expect(wrapper.emitted('send')?.[0]).toEqual([
      { content: 'Comment calculer mon CAC ?', attachment: null },
    ])
    expect((wrapper.find('input.ep-input').element as HTMLInputElement).value).toBe('')
  })

  it('désactive le champ pendant l’envoi (prop disabled)', () => {
    const wrapper = mount(ChatInput, {
      props: { disabled: true },
      global: { plugins: [createPinia()] },
    })
    expect(wrapper.find('input.ep-input').attributes('disabled')).toBeDefined()
    expect(wrapper.find('button[type="submit"]').attributes('disabled')).toBeDefined()
  })

  it('insère un emoji dans le champ', async () => {
    const wrapper = monter()

    await wrapper.find('button[title="Emojis"]').trigger('click')
    const barre = wrapper.find('.ep-emoji-bar')
    expect(barre.exists()).toBe(true)

    await barre.find('button').trigger('click')
    expect((wrapper.find('input.ep-input').element as HTMLInputElement).value).not.toBe('')
  })
})

describe('ChatInput — actions annexes', () => {
  it('annonce la recherche de GIF comme indisponible (écart assumé)', () => {
    const wrapper = monter()
    const bouton = wrapper.find('.ep-action--indisponible')

    expect(bouton.exists()).toBe(true)
    expect(bouton.attributes('aria-disabled')).toBe('true')
    expect(bouton.attributes('title')).toContain('indisponible')
    // La description lecteur d'écran accompagne le bouton
    const idAide = bouton.attributes('aria-describedby')
    expect(idAide).toBeTruthy()
    expect(wrapper.find(`#${idAide}`).text()).toContain('aucun service tiers')
  })

  it('dégrade proprement le micro quand la Web Speech API est absente', async () => {
    const wrapper = monter()
    const micro = wrapper.find('button[aria-label*="dictée"], button[title*="dictée"]')

    expect(micro.exists()).toBe(true)
    expect(micro.attributes('aria-disabled')).toBe('true')

    await micro.trigger('click')
    expect(wrapper.find('.ep-dictee').text()).toContain('pas disponible')
  })

  it('expose le lien de politique de confidentialité', () => {
    const wrapper = monter()
    const lien = wrapper.find('.ep-legal a')

    expect(lien.attributes('href')).toBe('https://eperformance.pro/politique-confidentialite.html')
    expect(lien.attributes('target')).toBe('_blank')
    expect(lien.attributes('rel')).toContain('noopener')
  })

  it('propose un champ de fichier local (aucun upload serveur)', () => {
    const wrapper = monter()
    const champ = wrapper.find('input[type="file"]')

    expect(champ.exists()).toBe(true)
    expect(wrapper.find('button[aria-label="Joindre un fichier"]').exists()).toBe(true)
  })
})
