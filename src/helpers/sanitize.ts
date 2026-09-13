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

/** Extrait le texte brut d'un html backend (fallback affichage sans rendu riche).
 *  Même exclusion que sanitizeMessageHtml : les boutons backend (suggestions
 *  remplacées par les quick replies natifs) ne doivent PAS fuir dans le texte. */
export function htmlToText(html: string): string {
  const clean = DOMPurify.sanitize(html, { FORBID_TAGS })
  const host = document.createElement('div')
  host.innerHTML = clean
  return host.textContent?.trim() ?? ''
}

/**
 * Rendu markdown minimal (le backend renvoie du markdown dans le texte) :
 * **gras**, *italique*, `code`, listes ordonnées "1. ", listes à puces "- ",
 * liens [texte](https://…) . Le texte est échappé AVANT transformation —
 * sortie HTML sûre (les URLs javascript: ne matchent pas et restent du texte).
 */
export function renderMarkdown(text: string): string {
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

  const inline = (line: string): string =>
    line
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\*([^*\n]+)\*/g, '<em>$1</em>')
      .replace(/`([^`\n]+)`/g, '<code>$1</code>')
      .replace(
        /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g,
        '<a href="$2" target="_blank" rel="noopener">$1</a>',
      )

  const htmlLines: string[] = []
  let listType: 'ol' | 'ul' | null = null

  const closeList = () => {
    if (listType) {
      htmlLines.push(`</${listType}>`)
      listType = null
    }
  }

  for (const rawLine of escaped.split('\n')) {
    const line = rawLine.trim()

    // Ligne vide → fermer la liste en cours (séparateur visuel)
    if (!line) {
      closeList()
      continue
    }

    // Liste ordonnée : "1. item" / "1) item"
    const ordered = line.match(/^(\d+)[.)]\s+(.*)$/)
    if (ordered) {
      if (listType !== 'ol') {
        closeList()
        htmlLines.push('<ol>')
        listType = 'ol'
      }
      htmlLines.push(`<li>${inline(ordered[2])}</li>`)
      continue
    }

    // Liste à puces : "- item" / "* item" / "• item"
    const bullet = line.match(/^[-*•]\s+(.*)$/)
    if (bullet) {
      if (listType !== 'ul') {
        closeList()
        htmlLines.push('<ul>')
        listType = 'ul'
      }
      htmlLines.push(`<li>${inline(bullet[1])}</li>`)
      continue
    }

    // Paragraphe normal
    closeList()
    htmlLines.push(`<p>${inline(line)}</p>`)
  }
  closeList()

  return htmlLines.join('')
}
