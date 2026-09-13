/**
 * Sanitization HTML backend — contrat V2 §Normalisations.
 *
 * Le backend renvoie le texte du message dans `html` (quand il y a des
 * suggestions), avec des boutons onclick="window.deepChatSendMessage(...)"
 * qui n'existent pas dans ce widget. On utilise metadata.suggestions (JSON)
 * pour les boutons natifs, donc le HTML est nettoyé : boutons retirés,
 * event handlers supprimés, styles inline du dark theme conservés.
 */

import DOMPurify from 'dompurify'

const FORBID_TAGS = ['script', 'style', 'iframe', 'form', 'button', 'input', 'object', 'embed']

export function sanitizeMessageHtml(html: string): string {
  const clean = DOMPurify.sanitize(html, { FORBID_TAGS })

  // Retirer les conteneurs devenus vides (ex: div des boutons supprimés)
  const host = document.createElement('div')
  host.innerHTML = clean
  host.querySelectorAll('div').forEach((el) => {
    if (!el.textContent?.trim() && !el.querySelector('img, a, video')) {
      el.remove()
    }
  })

  return host.innerHTML
}

/** Extrait le texte brut d'un html backend (fallback affichage sans rendu riche) */
export function htmlToText(html: string): string {
  const clean = DOMPurify.sanitize(html, { FORBID_TAGS: ['script', 'style'] })
  const host = document.createElement('div')
  host.innerHTML = clean
  return host.textContent?.trim() ?? ''
}
