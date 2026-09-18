/**
 * Portail des applications ePerformance — `/application/index.html`.
 *
 * Entrée Vite dédiée. Le portail présente l'application Mia et mène à sa page
 * de présentation comme à son ouverture directe. Il est écrit pour accueillir
 * d'autres applications : la grille des cartes est la structure, la carte Mia
 * en est aujourd'hui la seule occupante.
 */

import '@/application.css'

import { initialiserPagePublique } from '@/application/commun'

initialiserPagePublique()
