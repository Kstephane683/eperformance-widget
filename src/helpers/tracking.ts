/**
 * Suivi des clics de suggestion — tâche 6.3-BIS A.8.
 *
 * Chaque clic sur une capacité produit une donnée commerciale : quelle
 * compétence intéresse, quand, dans quelle session. Deux destinations :
 *
 * 1. **Le backend**, via `visitor_info.suggestion_click` du prochain message.
 *    Le serveur enregistre un événement `suggestion_click` dans
 *    `chatbot_analytics` (avec l'agent réellement utilisé) : c'est la donnée
 *    exploitable — elle relie le clic à la réponse et à la conversation.
 * 2. **Le site hôte (contrat N3)**, via les événements `eperf:chatbot:message`
 *    et `eperf:chatbot:lead` que le SDK rediffuse sur le document de la page.
 *    Le tracking GA4 du site les écoute déjà.
 *
 * VIE PRIVÉE — règle absolue des deux relais vers la page hôte :
 *   · `intent` est une CATÉGORIE (`seo`, `mlm`, `clients`…) — jamais le texte
 *     du visiteur, jamais son libellé de saisie ;
 *   · `type` est une ÉNUMÉRATION fermée (`whatsapp_clic`, `formulaire`,
 *     `email_clic`) ;
 *   · jamais de nom, d'e-mail, de téléphone, ni de contenu de message.
 */

import { postToSdk } from '@/helpers/sdkBridge'

export interface ClicSuggestion {
  /** Clé de la capacité (identique à l'intent envoyé au backend) */
  suggestion_id: string
  /** Intent transmis — le backend route vers l'agent (mapping interne) */
  intent: string
  /** Libellé affiché au visiteur */
  label: string
  /** Horodatage ISO côté navigateur */
  timestamp: string
  /** Identifiant de session : regroupe les clics d'une même visite */
  session_id: string
}

/** Types de lead admis par le contrat N3 — énumération FERMÉE */
export type TypeLead = 'whatsapp_clic' | 'formulaire' | 'email_clic'

const SESSION_KEY = 'eperf_widget_session'

/**
 * Identifiant de session du widget.
 *
 * Il vit en `sessionStorage` : il disparaît à la fermeture de l'onglet, ce qui
 * est exactement la définition d'une session pour cette mesure. Deux onglets
 * ouverts = deux sessions, assumé.
 */
export function sessionId(): string {
  try {
    let id = sessionStorage.getItem(SESSION_KEY)
    if (!id) {
      id =
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? `sess_${crypto.randomUUID().slice(0, 12)}`
          : `sess_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`
      sessionStorage.setItem(SESSION_KEY, id)
    }
    return id
  } catch {
    // Navigation privée avec stockage bloqué : la mesure est perdue, le
    // widget continue de fonctionner (jamais de dépendance à la mesure).
    return 'sess_inconnue'
  }
}

/** Clic à transmettre au prochain message (consommé une seule fois) */
let clicEnAttente: ClicSuggestion | null = null

/**
 * Enregistre un clic de suggestion.
 * @param capacite clé d'intent + libellé (voir `data/capacites.ts`)
 */
export function tracerClicSuggestion(capacite: { intent: string; libelle: string }) {
  const clic: ClicSuggestion = {
    suggestion_id: capacite.intent,
    intent: capacite.intent,
    label: capacite.libelle,
    timestamp: new Date().toISOString(),
    session_id: sessionId(),
  }
  clicEnAttente = clic
  return clic
}

/** Dernier clic non encore transmis au backend, ou null */
export function clicEnAttenteDeTransmission(): ClicSuggestion | null {
  return clicEnAttente
}

/** À appeler une fois le message envoyé : le clic ne se rejoue pas */
export function consommerClicSuggestion(): ClicSuggestion | null {
  const clic = clicEnAttente
  clicEnAttente = null
  return clic
}

/** Réinitialisation (tests) */
export function reinitialiserTracking() {
  clicEnAttente = null
}

// ============================================================
// CONTRAT N3 — deux événements pour le tracking GA4 du site
//
// Le widget vit dans une iframe : il ne peut pas poser d'événement sur le
// document de la page hôte. Il les transmet au SDK par postMessage, et le SDK
// les rediffuse en CustomEvent sur `document` — noms et formes exacts
// attendus par `site-eperformance/assets/js/tracking.js` (et documentés dans
// `docs/chatbot-integration-noyau.md`).
// ============================================================

/**
 * Une réponse de Mia a été produite → `eperf:chatbot:message`.
 *
 * @param intent catégorie d'intention renvoyée par le backend
 *   (`metadata.intent`). Le texte du message ne sort JAMAIS d'ici.
 *   Le site retombe sur `'non_detecte'` si l'intent est vide — on envoie
 *   tout de même l'événement, pour compter le message.
 */
export function signalerMessage(intent: string | null | undefined) {
  postToSdk({ event: 'message', intent: intent || null })
}

/**
 * Capture de contact → `eperf:chatbot:lead`.
 *
 * @param type énumération fermée : `whatsapp_clic` (le visiteur part sur
 *   WhatsApp), `formulaire` (coordonnées capturées par le pipeline),
 *   `email_clic`.
 */
export function signalerLead(type: TypeLead) {
  postToSdk({ event: 'lead', leadType: type })
}

