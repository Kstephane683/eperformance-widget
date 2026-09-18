#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Sous-ensembles de polices pour les pages publiques — tâche 6.4.

POURQUOI. Les polices auto-hébergées pèsent 264 Ko sur la page de présentation
(5 graisses × 38–63 Ko), soit près des deux tiers du poids total : c'est le
premier poste de dépense de Lighthouse, et le seul qui empêchait la
performance mesurée de dépasser la cible de 90 en mobile.

CE QUI EST FAIT. Chaque graisse utilisée par les pages publiques est réduite au
jeu de caractères réellement employé par ces deux pages (plus une réserve :
ASCII, latin-1, ponctuation typographique française). Les glyphes conservés sont
**identiques pixel pour pixel** — un sous-ensemble ne redessine rien, il retire
des caractères. Le design n'est donc pas touché.

RÉSULTAT MESURÉ — NON RETENU. Les polices du projet étaient DÉJÀ réduites au
latin (chaque fichier porte ~250 glyphes, dont les 208 du jeu de caractères des
pages) : le gain réel n'est que de 7 % (57 Ko au lieu de 61), pour 308 Ko de
fichiers supplémentaires dans le dépôt. Le sous-ensemblage a donc été ABANDONNÉ
au profit d'une décision plus efficace : déclarer moins de graisses. Ce script
reste dans le dépôt comme trace de la mesure — il est rejouable si les polices
changent un jour.

CE QUI N'EST PAS FAIT. Le widget n'est PAS concerné : son texte est dynamique
(réponses de Mia, titres d'articles, noms saisis par le visiteur), il lui faut
les polices complètes. Les fichiers de `public/fonts/` restent intacts ; les
sous-ensembles vivent dans `public/fonts/pages-public/`.

    python3 subset-polices.py
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

from fontTools import subset

DEPOT = Path(__file__).resolve().parents[2]
SOURCE = DEPOT / "public" / "fonts"
CIBLE = SOURCE / "pages-public"

# Graisses utilisées par src/application.css
FACES = [
    "cormorant-garamond-600.woff2",
    "cormorant-garamond-700.woff2",
    "dm-sans-400.woff2",
    "dm-sans-500.woff2",
    "dm-sans-600.woff2",
    "dm-sans-700.woff2",
]

PAGES = [
    DEPOT / "application" / "index.html",
    DEPOT / "application" / "mia" / "index.html",
    DEPOT / "src" / "application" / "commun.ts",
    DEPOT / "src" / "application" / "portail.ts",
    DEPOT / "src" / "application" / "mia.ts",
]

# Réserve : caractères qu'un texte d'interface peut afficher sans figurer dans
# les sources (messages d'état, nombres, unités, ponctuation française).
RESERVE = (
    "".join(chr(c) for c in range(0x20, 0x7F))  # ASCII imprimable
    + "".join(chr(c) for c in range(0xA0, 0x100))  # latin-1 (accents français)
    + "«»—–…’‘“”€°×·•→←↑↓✓✕²³½¼¾№"
)


def lire_jeu_de_caracteres() -> str:
    caracteres: set[str] = set(RESERVE)
    for page in PAGES:
        if not page.exists():
            continue
        texte = page.read_text(encoding="utf-8")
        # Les entités HTML et les noms de balises ne sont pas du texte affiché :
        # on les retire pour ne pas élargir le sous-ensemble inutilement.
        texte = re.sub(r"<[^>]*>", " ", texte)
        texte = re.sub(r"&[a-zA-Z]+;", " ", texte)
        caracteres.update(texte)
    return "".join(sorted(caracteres))


def main() -> None:
    CIBLE.mkdir(parents=True, exist_ok=True)
    jeu = lire_jeu_de_caracteres()
    print(f"jeu de caractères : {len(jeu)} caractères distincts")

    for nom in FACES:
        source = SOURCE / nom
        if not source.exists():
            print(f"  ! {nom} absent — ignoré", file=sys.stderr)
            continue
        avant = source.stat().st_size
        options = subset.Options()
        options.flavor = "woff2"
        options.with_zopfli = True
        # On conserve les métriques verticales et les noms de famille : sans
        # elles, le navigateur composerait différemment.
        options.layout_features = ["*"]
        options.name_IDs = ["*"]
        options.notdef_outline = True
        police = subset.load_font(str(source), options)
        sous_ensemble = subset.Subsetter(options=options)
        sous_ensemble.populate(text=jeu)
        sous_ensemble.subset(police)
        destination = CIBLE / nom
        subset.save_font(police, str(destination), options)
        apres = destination.stat().st_size
        print(f"  · {nom} : {avant / 1024:.0f} Ko → {apres / 1024:.0f} Ko ({100 * apres / avant:.0f} %)")


if __name__ == "__main__":
    main()
