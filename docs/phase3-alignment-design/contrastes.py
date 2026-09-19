#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Ratios de contraste avant / après — alignement design phase 3.

Ce script ne RÉÉCRIT pas la mesure : il importe celle de la tâche 6.9
(`docs/phase3-tache-6-9/mesures.py`) — lecture de feuille par accolades
comptées, résolution des `var()`, `color-mix()` vers `rgba()`, luminance
relative et ratio WCAG 2.1. Une deuxième implémentation de la même formule
finirait par diverger de la première, et deux chiffres contradictoires valent
moins qu'un seul chiffre reproductible.

Ce qui est mesuré ici, et pourquoi :

  D4   — le filet d'un bouton secondaire contre la surface sur laquelle il est
         posé. C'est le seul des cinq écarts qui a un seuil WCAG chiffré
         (1.4.11, 3:1) ; il est mesuré contre TOUTES les surfaces réelles où le
         bouton peut se trouver, pas seulement contre une.
  D7a  — les deux voiles d'erreur : la teinte effectivement composée sur la
         surface (c'est elle qu'on voit) et le ratio du texte d'erreur posé
         dessus. Un voile à 6 % ne se lit pas comme une couleur, il se lit
         comme un écart avec la surface : c'est cet écart qui est calculé.
  D7b  — le halo de l'ombre d'accent : teinte composée et alpha.
  D7c  — une durée, pas un ratio : elle est lue dans le fichier, pas calculée.

    python3 contrastes.py             # imprime et écrit mesures-contrastes.json
    python3 contrastes.py avant       # idem, nommé « avant »
    python3 contrastes.py apres       # idem, nommé « apres »
"""

from __future__ import annotations

import importlib.util
import json
import sys
from pathlib import Path

DOSSIER = Path(__file__).resolve().parent
DEPOT = DOSSIER.parents[1]
MESURES_69 = DEPOT / "docs" / "phase3-tache-6-9" / "mesures.py"
JETONS = DEPOT / "src" / "styles" / "jetons.css"

# Import du harnais de 6.9 sans le réécrire ni le modifier.
_spec = importlib.util.spec_from_file_location("mesures_69", MESURES_69)
mesures = importlib.util.module_from_spec(_spec)
assert _spec.loader is not None
_spec.loader.exec_module(mesures)


def jetons_du_widget() -> dict[str, dict[str, str]]:
    """Les jetons déclarés dans `src/styles/jetons.css`, thème par thème."""
    return mesures.lire_feuille(JETONS)


def couleur(valeur: str, table: dict[str, str]) -> str:
    """Une valeur de jeton vers `rgba(r, g, b, a)` — via la canonisation de 6.9.

    `resoudre_tout()` ne résout que les `var()` ; un `color-mix()` reste écrit
    tel quel et n'est pas une couleur lisible. `canoniser()` le convertit en
    `rgba()`, ce qui rend les deux écritures comparables — c'est exactement ce
    qu'il fait pour la comparaison de jetons de 6.9.
    """
    return mesures.canoniser(mesures.resoudre_tout(valeur, table), table)


def rgba_de(valeur: str, table: dict[str, str]) -> tuple[float, float, float, float]:
    """Le quadruplet (r, g, b, a) d'une valeur de couleur, `color-mix()` inclus."""
    trouve = mesures.vers_rgba(couleur(valeur, table))
    if trouve is None:
        raise ValueError(f"valeur non convertible en couleur : {valeur!r}")
    return trouve


def aplatir(valeur: str, table: dict[str, str]) -> tuple[int, int, int]:
    """Les canaux d'une couleur, alpha ignoré."""
    r, v, b, _ = rgba_de(valeur, table)
    return round(r), round(v), round(b)


def composer(valeur: str, surface: str, table: dict[str, str]) -> tuple[int, int, int]:
    """Couleur effectivement vue : `valeur` (alpha inclus) posée sur `surface`."""
    dessus = rgba_de(valeur, table)
    dessous = rgba_de(surface, table)
    a = dessus[3]
    return tuple(  # type: ignore[return-value]
        round(dessus[i] * a + dessous[i] * (1 - a)) for i in range(3))


def hexa(rgb: tuple[int, int, int]) -> str:
    return "#{:02x}{:02x}{:02x}".format(*rgb)


def ratio(couleur_a: str, surface: str) -> float:
    """Ratio WCAG entre deux couleurs, la seconde opaque."""
    return mesures.contraste(couleur_a, surface)


def ecart(valeur: str, surface: str, table: dict[str, str]) -> float:
    """Ratio entre la couleur COMPOSÉE sur la surface et la surface elle-même.

    C'est la seule façon honnête de chiffrer un voile : à 6 % d'alpha, la
    « couleur » du voile n'existe pas, c'est l'écart avec le fond qui se voit.
    """
    return mesures.contraste(hexa(composer(valeur, surface, table)), surface)


def mesurer() -> dict:
    j = jetons_du_widget()
    resultat: dict[str, dict] = {}

    # ---------------------------------------------------------------- D4 -----
    # Le filet du bouton secondaire, contre toutes les surfaces réelles.
    d4: dict[str, dict] = {}
    for cle in ("clair", "sombre"):
        table = {**j["clair"], **j[cle]}
        bloc: dict[str, str] = {}
        for nom in ("--border", "--border-strong"):
            bloc[nom] = couleur(table[nom], table)
        d4[cle] = {
            "jetons": bloc,
            "surfaces": {},
        }
        for surface in ("--bg", "--bg2", "--card"):
            valeur_surface = couleur(table[surface], table)
            d4[cle]["surfaces"][surface] = {
                "surface": valeur_surface,
                "border": {
                    "ratio": ratio(bloc["--border"], valeur_surface),
                },
                "border-strong": {
                    "ratio": ratio(bloc["--border-strong"], valeur_surface),
                },
            }
    resultat["D4_filet_bouton_secondaire"] = d4

    # --------------------------------------------------------------- D7a -----
    # Les deux voiles d'erreur : teinte composée + lisibilité du texte dessus.
    d7a: dict[str, dict] = {}
    for cle in ("clair", "sombre"):
        table = {**j["clair"], **j[cle]}
        bloc: dict[str, dict] = {}
        for nom in ("--red-bg", "--red-border"):
            brut = table[nom]
            for surface in ("--bg", "--card"):
                valeur_surface = couleur(table[surface], table)
                bloc[f"{nom} sur {surface}"] = {
                    "declaration": brut,
                    "canonique": couleur(brut, table),
                    "composee": hexa(composer(brut, valeur_surface, table)),
                    "ecart_avec_la_surface": ecart(brut, valeur_surface, table),
                }
        # Le texte d'erreur, lui, ne change pas : il est mesuré pour mémoire,
        # sur la surface ET sur son propre voile — c'est ainsi qu'on le lit.
        texte = couleur(table["--red-text"], table)
        for surface in ("--bg", "--card"):
            valeur_surface = couleur(table[surface], table)
            bloc[f"--red-text sur {surface}"] = {
                "canonique": texte,
                "ratio": ratio(texte, valeur_surface),
            }
        voile = hexa(composer(table["--red-bg"], table["--card"], table))
        bloc["--red-text sur --red-bg"] = {
            "canonique": texte,
            "surface_composee": voile,
            "ratio": ratio(texte, voile),
        }
        d7a[cle] = bloc
    resultat["D7a_voiles_erreur"] = d7a

    # --------------------------------------------------------------- D7b -----
    # L'ombre : la couleur du halo est le dernier mot de l'expression.
    d7b: dict[str, dict] = {}
    for cle in ("clair", "sombre"):
        table = {**j["clair"], **j[cle]}
        ombre = table["--shadow-gold"]
        resolue = mesures.resoudre_tout(ombre, table)
        morceaux = mesures.re.findall(
            r"rgba?\([^)]*\)|#[0-9a-fA-F]{3,8}|color-mix\([^;]*\)", resolue)
        halo = morceaux[-1] if morceaux else ""
        fond = couleur(table["--bg"], table)
        d7b[cle] = {
            "declaration": ombre,
            "resolue": resolue,
            "halo_declare": halo,
            "halo_canonique": couleur(halo, table) if halo else "",
            "halo_alpha": round(rgba_de(halo, table)[3], 4) if halo else None,
            "halo_compose_sur_bg": hexa(composer(halo, fond, table)) if halo else "",
        }
    resultat["D7b_ombre_accent"] = d7b

    # --------------------------------------------------------------- D7c -----
    d7c: dict[str, str] = {}
    for cle in ("clair", "sombre"):
        table = {**j["clair"], **j[cle]}
        d7c[f"--t ({cle})"] = table["--t"]
        d7c[f"--t-fast ({cle})"] = table["--t-fast"]
    resultat["D7c_durees"] = d7c

    return resultat


def main() -> int:
    nom = sys.argv[1] if len(sys.argv) > 1 else "avant"
    donnees = mesurer()

    print(f"Ratios de contraste — état « {nom} »")
    print(f"  source des jetons : {JETONS.relative_to(DEPOT)}")
    print(f"  moteur de calcul  : {MESURES_69.relative_to(DEPOT)} (importé, non réécrit)")

    d4 = donnees["D4_filet_bouton_secondaire"]
    for theme in ("clair", "sombre"):
        print(f"\n  D4 — filet de bouton secondaire, thème {theme}")
        for surface, bloc in d4[theme]["surfaces"].items():
            print(f"    sur {surface:6s} ({bloc['surface']}) : "
                  f"--border {bloc['border']['ratio']:.2f}:1   "
                  f"--border-strong {bloc['border-strong']['ratio']:.2f}:1")

    d7a = donnees["D7a_voiles_erreur"]
    for cle in ("clair", "sombre"):
        print(f"\n  D7a — voiles d'erreur, thème {cle}")
        for nom_voile, bloc in d7a[cle].items():
            if "composee" in bloc:
                print(f"    {nom_voile:24s} {bloc['canonique']:38s} "
                      f"→ {bloc['composee']}  écart {bloc['ecart_avec_la_surface']:.2f}:1")
            elif "surface_composee" in bloc:
                print(f"    {nom_voile:24s} {bloc['canonique']:38s} "
                      f"sur {bloc['surface_composee']}  ratio {bloc['ratio']:.2f}:1")
            else:
                print(f"    {nom_voile:24s} {bloc['canonique']:38s} ratio {bloc['ratio']:.2f}:1")

    d7b = donnees["D7b_ombre_accent"]
    print("\n  D7b — ombre d'accent")
    for cle in ("clair", "sombre"):
        bloc = d7b[cle]
        print(f"    {cle:7s} {bloc['resolue']:46s}")
        print(f"            halo {bloc['halo_canonique']}  alpha {bloc['halo_alpha']:.2f} "
              f"→ composé sur fond {bloc['halo_compose_sur_bg']}")

    print("\n  D7c — durées d'état actif")
    for nom_jeton, valeur in donnees["D7c_durees"].items():
        print(f"    {nom_jeton:18s} {valeur}")

    sortie = DOSSIER / f"mesures-contrastes-{nom}.json"
    sortie.write_text(json.dumps(donnees, ensure_ascii=False, indent=2) + "\n",
                      encoding="utf-8")
    print(f"\n  écrit : {sortie.relative_to(DEPOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
