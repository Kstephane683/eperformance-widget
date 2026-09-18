#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Génération des icônes de l'application Mia (tâche 6.4, Bloc B).

SOURCE UNIQUE : le logo de marque du site, /home/ballo/OX6A/site-eperformance/
icon-512.png (monogramme « eP » or sur fond sombre). Aucun dessin n'est
inventé : le script recadre le monogramme, le recompose aux dimensions exigées
et rejoue les couleurs canoniques du design system.

Produit :
  public/icons/mia-192.png            192×192   « any »
  public/icons/mia-512.png            512×512   « any »
  public/icons/mia-maskable-192.png   192×192   « maskable » (zone sûre 80 %)
  public/icons/mia-maskable-512.png   512×512   « maskable »
  public/apple-touch-icon.png         180×180   iOS (fond opaque, sans transparence)
  public/demarrage/mia-<L>x<H>-<theme>.png      écrans de démarrage iOS

Les écrans de démarrage sont l'icône posée sur le fond canonique du thème
(--bg : #fdfcfa en clair, #08080c en sombre) — recette d'écran d'ouverture,
jamais un visuel publicitaire.

    python3 generer-icones.py
"""

from __future__ import annotations

from pathlib import Path

from PIL import Image

RACINE = Path(__file__).resolve().parents[2]  # …/eperformance-widget
SOURCE = Path("/home/ballo/OX6A/site-eperformance/icon-512.png")
ICONES = RACINE / "public" / "icons"
DEMARRAGE = RACINE / "public" / "demarrage"

# Jetons canoniques (src/styles/jetons.css, copie d'eperf.css)
FOND_CLAIR = (253, 252, 250)  # --bg clair  #fdfcfa
FOND_SOMBRE = (8, 8, 12)  # --bg sombre #08080c

# Écrans de démarrage : (largeur, hauteur) en pixels physiques
# 390×844, 393×852, 430×932 en @3 ; iPad 820×1180 en @2.
DEMARRAGES = [(1170, 2532), (1179, 2556), (1290, 2796), (1640, 2360)]


def fond_de(im: Image.Image) -> tuple[int, int, int]:
    """Couleur de fond du logo source (coin supérieur gauche)."""
    return im.convert("RGB").getpixel((2, 2))


def cadre_monogramme(im: Image.Image, fond: tuple[int, int, int]) -> Image.Image:
    """Recadre le monogramme : tous les pixels qui diffèrent du fond."""
    rgb = im.convert("RGB")
    largeur, hauteur = rgb.size
    pixels = rgb.load()
    seuil = 18  # tolérance : le fond n'est pas parfaitement uniforme
    x_min, y_min, x_max, y_max = largeur, hauteur, 0, 0
    for y in range(hauteur):
        for x in range(largeur):
            r, g, b = pixels[x, y]
            if abs(r - fond[0]) + abs(g - fond[1]) + abs(b - fond[2]) > seuil:
                x_min, y_min = min(x_min, x), min(y_min, y)
                x_max, y_max = max(x_max, x), max(y_max, y)
    if x_max <= x_min or y_max <= y_min:  # source inattendue : on rend telle quelle
        return rgb
    marge = 6
    return rgb.crop(
        (
            max(0, x_min - marge),
            max(0, y_min - marge),
            min(largeur, x_max + marge),
            min(hauteur, y_max + marge),
        )
    )


def composer(taille: int, monogramme: Image.Image, fond: tuple[int, int, int], part: float) -> Image.Image:
    """Monogramme centré sur un fond opaque ; `part` = largeur relative du logo."""
    canevas = Image.new("RGB", (taille, taille), fond)
    cible = max(1, int(taille * part))
    ratio = cible / monogramme.width
    logo = monogramme.resize(
        (cible, max(1, int(monogramme.height * ratio))), Image.Resampling.LANCZOS
    )
    canevas.paste(logo, ((taille - logo.width) // 2, (taille - logo.height) // 2))
    return canevas


def main() -> None:
    ICONES.mkdir(parents=True, exist_ok=True)
    DEMARRAGE.mkdir(parents=True, exist_ok=True)

    source = Image.open(SOURCE).convert("RGB")
    fond = fond_de(source)
    monogramme = cadre_monogramme(source, fond)
    print(f"source {source.size} · fond {fond} · monogramme {monogramme.size}")

    # Icônes « any » : la composition d'origine du propriétaire, aux tailles
    # demandées (le monogramme occupe la même proportion que dans le logo).
    part_any = monogramme.width / source.width
    for taille in (192, 512):
        composer(taille, monogramme, fond, part_any).save(ICONES / f"mia-{taille}.png", optimize=True)
        print(f"  icons/mia-{taille}.png")

    # Icônes « maskable » : la zone sûre d'Android est un cercle de 80 % du
    # côté. Le monogramme est ramené à 55 % pour rester entier sous toutes les
    # découpes (cercle, goutte, arrondi carré).
    for taille in (192, 512):
        composer(taille, monogramme, fond, 0.55).save(
            ICONES / f"mia-maskable-{taille}.png", optimize=True
        )
        print(f"  icons/mia-maskable-{taille}.png")

    # iOS : 180×180, fond opaque (Apple n'accepte pas la transparence)
    composer(180, monogramme, fond, part_any).save(RACINE / "public" / "apple-touch-icon.png", optimize=True)
    print("  apple-touch-icon.png")

    # Favicons : le widget portait encore le logo par défaut de Vite
    # (`public/favicon.svg`, éclair violet). Le favicon de la marque le remplace
    # dans les pages publiques et dans l'application ; `favicon.svg` reste en
    # place pour la console d'administration (hors périmètre de cette tâche).
    for taille in (32, 16):
        composer(taille, monogramme, fond, part_any).save(
            RACINE / "public" / f"favicon-{taille}.png", optimize=True
        )
        print(f"  favicon-{taille}.png")

    # Écrans de démarrage : l'icône de l'application sur le fond du thème
    icone_app = composer(512, monogramme, fond, part_any)
    for largeur, hauteur in DEMARRAGES:
        for theme, fond_theme in (("clair", FOND_CLAIR), ("sombre", FOND_SOMBRE)):
            canevas = Image.new("RGB", (largeur, hauteur), fond_theme)
            cible = int(min(largeur, hauteur) * 0.28)
            icone = icone_app.resize((cible, cible), Image.Resampling.LANCZOS)
            canevas.paste(icone, ((largeur - cible) // 2, (hauteur - cible) // 2))
            chemin = DEMARRAGE / f"mia-{largeur}x{hauteur}-{theme}.png"
            canevas.save(chemin, optimize=True)
            print(f"  demarrage/{chemin.name}")


if __name__ == "__main__":
    main()
