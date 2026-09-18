/**
 * Page de présentation de Mia — `/application/mia/index.html`.
 *
 * Entrée Vite dédiée : le HTML porte le contenu (indexable, lisible sans
 * JavaScript), ce module n'ajoute que l'interactivité commune aux pages
 * publiques (thème, installation, service worker).
 */

import '@/application.css'

import { initialiserPagePublique } from '@/application/commun'

initialiserPagePublique()
