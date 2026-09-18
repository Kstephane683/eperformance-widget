/**
 * Identité de l'opérateur connecté, lue dans le JWT.
 *
 * Le backend renvoie un JWT OAuth2 signé ; sa CHARGE UTILE est lisible sans clé
 * (la signature, elle, n'est vérifiée que par le serveur). On y lit seulement de
 * quoi afficher « qui est connecté » dans le menu de profil — c'est une commodité
 * d'affichage, JAMAIS un contrôle d'accès : l'autorisation reste au serveur, qui
 * répond 401/403 et déclenche la déconnexion (voir `api.ts`).
 *
 * Si le jeton n'est pas un JWT, ou si sa charge ne porte ni courriel ni nom, on
 * retombe sur un libellé neutre : la console ne doit jamais afficher
 * « undefined » ni inventer une identité.
 */

export interface Identite {
  /** Courriel du compte, si le jeton le porte */
  email: string | null
  /** Nom affiché, si le jeton le porte */
  nom: string | null
  /** Rôle applicatif, s'il est présent dans le jeton */
  role: string | null
  /** Une ou deux initiales pour la pastille de profil (jamais vide) */
  initiales: string
}

const IDENTITE_INCONNUE: Identite = {
  email: null,
  nom: null,
  role: null,
  initiales: '·',
}

/** Décode une portion base64url en texte UTF-8 (aucune dépendance, aucun npm). */
function decoderBase64Url(portion: string): string {
  const base64 = portion.replace(/-/g, '+').replace(/_/g, '/')
  const complete = base64 + '='.repeat((4 - (base64.length % 4)) % 4)
  const binaire = atob(complete)
  const octets = Uint8Array.from(binaire, (caractere) => caractere.charCodeAt(0))
  return new TextDecoder().decode(octets)
}

/** Initiales : « Stéphane Ballo » → « SB », « admin@eperformance.pro » → « AE ». */
export function initialesDe(source: string): string {
  const mots = source
    .split(/[\s._@+-]+/)
    .map((mot) => mot.trim())
    .filter((mot) => mot.length > 0)
  if (mots.length === 0) return '·'
  if (mots.length === 1) return mots[0].slice(0, 2).toUpperCase()
  return (mots[0][0] + mots[1][0]).toUpperCase()
}

function texte(valeur: unknown): string | null {
  return typeof valeur === 'string' && valeur.trim().length > 0 ? valeur.trim() : null
}

/**
 * Lit l'identité dans un JWT. Ne lève jamais : un jeton illisible donne
 * l'identité neutre (`·`), pas une exception dans le rendu de l'en-tête.
 */
export function lireIdentite(jeton: string | null): Identite {
  if (typeof jeton !== 'string' || jeton.length === 0) return IDENTITE_INCONNUE
  const portions = jeton.split('.')
  if (portions.length < 2) return IDENTITE_INCONNUE

  let charge: Record<string, unknown>
  try {
    const analyse: unknown = JSON.parse(decoderBase64Url(portions[1]))
    if (analyse === null || typeof analyse !== 'object') return IDENTITE_INCONNUE
    charge = analyse as Record<string, unknown>
  } catch {
    return IDENTITE_INCONNUE
  }

  const email = texte(charge.email) ?? texte(charge.sub) ?? texte(charge.preferred_username)
  const nom =
    texte(charge.nom) ??
    texte(charge.name) ??
    texte(charge.full_name) ??
    texte(charge.fullname)
  const brutRole = charge.role ?? charge.roles ?? charge.scope
  const role = Array.isArray(brutRole)
    ? texte(brutRole[0])
    : texte(brutRole)?.split(/[\s,]+/)[0] ?? null

  const sourceInitiales = nom ?? email
  return {
    email,
    nom,
    role,
    initiales: sourceInitiales ? initialesDe(sourceInitiales) : '·',
  }
}
