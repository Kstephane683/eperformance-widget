/**
 * Types du contrat d'interface Widget ↔ Backend Railway
 * Source de vérité : /home/ballo/OX6A/CONTRAT-INTERFACE-V2.md (validé production, commit 06e8ac6)
 *
 * ⚠️ Format Deep Chat : le backend n'accepte QUE role 'user' | 'ai' en entrée
 * (pattern Pydantic ^(user|ai)$) et renvoie 'user' | 'assistant' (format DB).
 */

// ============================================================
// RÔLES — 3 contextes distincts, ne pas mélanger
// ============================================================

/** Rôle interne du widget (affichage) */
export type WidgetRole = 'user' | 'agent'

/** Rôle ENVOI au backend (POST /api/chatbot/message) — format Deep Chat */
export type BackendSendRole = 'user' | 'ai'

/** Rôle RÉCEPTION du backend (metadata + GET /conversation) — format DB */
export type BackendRecvRole = 'user' | 'assistant'

export function toBackendRole(role: WidgetRole): BackendSendRole {
  return role === 'agent' ? 'ai' : 'user'
}

export function fromBackendRole(role: BackendRecvRole): WidgetRole {
  return role === 'assistant' ? 'agent' : 'user'
}

// ============================================================
// POST /api/chatbot/message
// ============================================================

export interface BackendMessage {
  role: BackendSendRole
  text: string
  /**
   * Image jointe à CE message (extension A.1 du contrat V2).
   * Le backend ne la lit que sur le dernier message ; les messages
   * précédents n'en portent pas (les images ne sont pas conservées).
   */
  image?: ImagePayload | null
}

/**
 * Image transmise au backend — base64 sans préfixe de type.
 *
 * Le type MIME déclaré est **documentaire** : le serveur détecte le format
 * réel par les premiers octets (magic bytes). Un `.png` qui contient du JPEG
 * est traité comme du JPEG. Formats acceptés : JPEG, PNG, GIF, WebP.
 */
export interface ImagePayload {
  /** Image encodée en base64 (sans préfixe `data:`) */
  data: string
  /** Type MIME déclaré — informatif, écrasé par la détection de contenu */
  media_type: string | null
  /** low | high | auto — `auto` si absent */
  detail: 'low' | 'high' | 'auto'
  /** Nom de fichier d'origine — informatif */
  name: string | null
}

export interface VisitorInfo {
  page_url?: string
  referrer?: string
  [key: string]: unknown
}

/** Request POST /message — le widget envoie TOUT l'historique à chaque message */
export interface ChatbotMessageRequest {
  messages: BackendMessage[]
  site_id: string
  conversation_id?: string | null
  user_id?: number | null
  visitor_info?: VisitorInfo
}

/** Metadata renvoyée par le backend (source de vérité pour le widget) */
export interface ChatbotMetadata {
  conversation_id: string
  intent: string | null
  agent_used: string | null
  actions: unknown[] | null
  /** Suggestions = source des boutons natifs Vue (ne JAMAIS parser le HTML) */
  suggestions: string[] | null
  processing_time?: number
  /** Un humain a pris la main: le LLM est en pause sur cette conversation */
  human_active?: boolean
  error?: string
}

/** Response POST /message — exactement un de text/html est non-null */
export interface ChatbotMessageResponse {
  text: string | null
  html: string | null
  files: Array<Record<string, unknown>> | null
  metadata: ChatbotMetadata | null
}

// ============================================================
// GET /api/chatbot/conversation/{conversation_id}
// ============================================================

export type ConversationStatus = 'active' | 'resolved' | 'escalated' | 'abandoned'

export interface ConversationHistoryMessage {
  role: BackendRecvRole
  content: string
  /** Nom du conseiller humain (Phase 2 — Tâche 5.3) */
  human_name?: string | null
  intent: string | null
  agent_used: string | null
  actions: unknown
  suggestions: string[] | null
  created_at: string | null
}

export interface ConversationHistoryResponse {
  conversation_id: string
  site_id: string
  status: ConversationStatus
  created_at: string | null
  updated_at: string | null
  messages: ConversationHistoryMessage[]
}

// ============================================================
// ÉTAT INTERNE WIDGET
// ============================================================

/**
 * Pièce jointe d'un message (tâche 6.2-bis, étendue A.1).
 *
 * Une IMAGE est transmise au backend (base64) et analysée par Mia : c'est le
 * seul type de pièce jointe que le contrat V2 sait transporter. Les autres
 * fichiers restent locaux — leur nom part dans le texte du message, rien de
 * plus (aucun endpoint d'upload au contrat).
 */
export interface MessageAttachment {
  name: string
  /** Data URL de l'aperçu — affichée dans la bulle, et décodée pour l'envoi */
  dataUrl: string | null
  /** Type MIME du fichier (celui du navigateur) */
  mediaType?: string | null
  /** Vrai si c'est une image : seule catégorie envoyée au backend (A.1) */
  estImage?: boolean
  /** Taille en octets (garde-fou d'envoi) */
  taille?: number | null
}

export interface WidgetMessage {
  id: string
  role: WidgetRole
  content: string
  /** HTML raw backend, déjà sanitisé DOMPurify avant stockage */
  html?: string | null
  agent_used?: string | null
  /** Nom réel du conseiller humain (Phase 2 — tâche 5.3) */
  human_name?: string | null
  /** Pièce jointe locale (aperçu) — jamais transmise au backend */
  attachment?: MessageAttachment | null
  quick_replies?: string[]
  created_at: string
}

export interface WidgetConfig {
  apiUrl: string
  siteId: string
  locale: 'fr'
  color: string
  /** Racine du blog, où est publié chatbot-index.json (onglets Aide/Actualités) */
  blogIndexUrl: string
}
