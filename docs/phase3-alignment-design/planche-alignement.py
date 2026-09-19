#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Planche avant / après des corrections D4, D7a, D7b — tâche d'alignement.

Les captures existent déjà, produites par les harnais (`composants.py` de 6.9
et `voiles-erreur.py`). Cette planche ne mesure rien : elle les met côte à
côte, étiquetées, pour qu'un relecteur voie ce qui a changé sans ouvrir douze
fichiers.

D7c — la durée d'état actif — n'a pas d'image : 150 ms et 300 ms donnent la
MÊME image à l'arrêt. C'est le harnais qui la mesure, pas l'œil, et le rapport
donne les deux valeurs.

    python3 planche-alignement.py
"""

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

DOSSIER = Path(__file__).resolve().parent
DEPOT = DOSSIER.parents[1]

# (décision, titre lisible, fichier avant, fichier après)
LIGNES = [
    ("D4", "Console — bouton secondaire (filet)",
     "composants-avant/console-bouton-secondaire.png",
     "composants-apres/console-bouton-secondaire.png"),
    ("D7a", "Console — voile d'erreur, clair",
     "voiles-avant/console-adm-erreur-light.png",
     "voiles-apres/console-adm-erreur-light.png"),
    ("D7a", "Console — voile d'erreur, sombre",
     "voiles-avant/console-adm-erreur-dark.png",
     "voiles-apres/console-adm-erreur-dark.png"),
    ("D7a", "Console — refus de connexion, sombre",
     "voiles-avant/console-login-erreur-dark.png",
     "voiles-apres/console-login-erreur-dark.png"),
    ("D7b", "Widget — bouton d'accent (ombre)",
     "composants-avant/widget-bouton-accent.png",
     "composants-apres/widget-bouton-accent.png"),
    ("D7b", "Pages — bouton d'accent (ombre)",
     "composants-avant/pages-bouton-accent.png",
     "composants-apres/pages-bouton-accent.png"),
    ("D7b", "Console — bouton d'accent (ombre AJOUTÉE)",
     "composants-avant/console-bouton-accent.png",
     "composants-apres/console-bouton-accent.png"),
]

MARGE, GOUTTIERE, BANDE = 14, 10, 150
FOND, ENCRE, FILET = (250, 249, 246), (22, 21, 26), (229, 225, 217)


def police(taille: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    for chemin in ("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
                   "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"):
        if Path(chemin).is_file():
            try:
                return ImageFont.truetype(chemin, taille)
            except OSError:
                continue
    return ImageFont.load_default()


def main() -> int:
    vignettes = []
    for decision, titre, avant, apres in LIGNES:
        a = Image.open(DOSSIER / avant).convert("RGB")
        b = Image.open(DOSSIER / apres).convert("RGB")
        # Les deux images d'une ligne sont cadrées à la MÊME hauteur : sans
        # cela, deux agrandissements différents feraient croire à un écart
        # d'échelle. La hauteur de la ligne est celle du couple, pas celle de
        # la plus grande image de la planche — sinon les petits composants
        # flottent au milieu d'un vide qui ne montre rien.
        hauteur = max(a.height, b.height)
        vignettes.append((decision, titre, a, b, hauteur))

    largeur = max(max(v[2].width, v[3].width) for v in vignettes)
    total_h = 30 + sum(v[4] + 30 for v in vignettes) + MARGE
    total_w = MARGE + largeur + GOUTTIERE + largeur + MARGE

    planche = Image.new("RGB", (total_w, total_h), FOND)
    dessin = ImageDraw.Draw(planche)
    petite, normale = police(13), police(15)

    dessin.text((MARGE, 8), "AVANT", font=normale, fill=(140, 60, 60))
    dessin.text((MARGE + largeur + GOUTTIERE, 8), "APRÈS", font=normale, fill=(30, 110, 70))

    y = 30
    for decision, titre, a, b, hauteur in vignettes:
        dessin.text((MARGE, y), f"{decision} — {titre}", font=petite, fill=ENCRE)
        haut = y + 18
        for colonne, image in ((0, a), (1, b)):
            x = MARGE + colonne * (largeur + GOUTTIERE)
            dessin.rectangle([x - 1, haut - 1, x + largeur, haut + hauteur],
                             outline=FILET)
            planche.paste(image, (x + (largeur - image.width) // 2,
                                  haut + (hauteur - image.height) // 2))
        y = haut + hauteur + 12

    chemin = DOSSIER / "planche-avant-apres.png"
    planche.save(chemin)
    print(f"  planche : {chemin.relative_to(DEPOT)}  ({planche.width}×{planche.height})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
