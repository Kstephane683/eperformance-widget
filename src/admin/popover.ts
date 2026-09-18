/**
 * Comportement commun des panneaux flottants de l'en-tête (recherche,
 * notifications, profil) : fermeture au clic extérieur, à `Échap`, et retour du
 * focus sur le bouton qui les a ouverts.
 *
 * Écrire trois fois ce comportement, c'est garantir que l'un des trois oubliera
 * `Échap` — c'est exactement le genre d'écart qui rend une console impraticable
 * au clavier. Le contrat est donc écrit ici, une fois :
 *   · `Échap` ferme ET rend le focus au déclencheur (WCAG 2.1, 2.1.2) ;
 *   · un clic hors du panneau ferme sans voler le focus ;
 *   · le focus suit l'ouverture quand `focusables` est fourni.
 */

import { onBeforeUnmount, watch } from 'vue'
import type { Ref } from 'vue'

export interface OptionsPopover {
  /** Élément racine qui contient le déclencheur ET le panneau */
  racine: Ref<HTMLElement | null>
  /** État d'ouverture (v-model du composant) */
  ouvert: Ref<boolean>
  /** Déclencheur : reçoit le focus à la fermeture au clavier */
  declencheur?: Ref<HTMLElement | null>
  /** Élément à focaliser à l'ouverture (par défaut : le déclencheur) */
  cible?: Ref<HTMLElement | null>
  /** Callback de fermeture (met à jour l'état du parent) */
  fermer: () => void
}

export function usePopover(options: OptionsPopover): void {
  const { racine, ouvert, declencheur, cible, fermer } = options

  function surClicDocument(evenement: MouseEvent): void {
    const noeud = evenement.target
    if (!(noeud instanceof Node)) return
    if (racine.value && !racine.value.contains(noeud)) fermer()
  }

  function surToucheDocument(evenement: KeyboardEvent): void {
    if (evenement.key !== 'Escape') return
    fermer()
    declencheur?.value?.focus()
  }

  function brancher(): void {
    document.addEventListener('click', surClicDocument, true)
    document.addEventListener('keydown', surToucheDocument)
  }

  function debrancher(): void {
    document.removeEventListener('click', surClicDocument, true)
    document.removeEventListener('keydown', surToucheDocument)
  }

  watch(
    ouvert,
    (estOuvert) => {
      if (estOuvert) brancher()
      else debrancher()
    },
    { immediate: true },
  )

  onBeforeUnmount(debrancher)

  // Le focus suit l'ouverture : sans cela, un panneau ouvert au clavier laisse
  // le focus sur le déclencheur et la navigation interne ne démarre pas.
  watch(ouvert, async (estOuvert) => {
    if (!estOuvert) return
    await Promise.resolve()
    const element = cible?.value ?? declencheur?.value ?? null
    element?.focus()
  })
}
