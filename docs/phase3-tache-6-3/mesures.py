#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Mesures de la tâche 6.3 (dashboard admin) — deux mesures indépendantes :

1. `mesures-couleurs.json` — COMPTE des couleurs littérales (hexadécimales et
   rgb()/rgba()) dans le périmètre du dashboard (`admin.html` + `src/admin/**`),
   avant et après. Le « avant » est lu dans le build conservé
   (`docs/phase3-tache-6-3/dist-avant/admin.html` + `assets/admin-*.css|js`,
   artefacts compilés du commit précédent) et dans les sources d'origine telles
   qu'elles ont été livrées ; le « après » est lu dans les sources courantes et
   dans `dist/`. Un compte ne se déclare pas, il se mesure.

2. `mesures-contraste.json` — RATIOS DE CONTRASTE WCAG 2.1 calculés pour chaque
   paire texte/fond réellement utilisée par l'interface, dans les deux thèmes.
   Les valeurs sont lues dans `src/styles/jetons.css` (source canonique) : le
   script ne redéclare aucune couleur, il lit celles qui sont livrées. Les
   compositions (fond translucide posé sur un fond opaque) sont calculées en
   composant alpha sur le fond réel — c'est le cas des traces d'état.

    python3 mesures.py            # les deux mesures
    python3 mesures.py couleurs   # compte des couleurs
    python3 mesures.py contraste  # ratios de contraste
    python3 mesures.py jetons     # jetons consommés vs jetons déclarés
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

DEPOT = Path(__file__).resolve().parents[2]  # …/eperformance-widget
DOSSIER = Path(__file__).resolve().parent
JETONS = DEPOT / "src" / "styles" / "jetons.css"

# Périmètre mesuré : le dashboard admin uniquement. Le SDK (`src/sdk/`) est gelé
# par contrat et le widget (`src/style.css`, `src/styles/jetons.css`) EST la
# source des jetons — ni l'un ni l'autre n'entre dans ce compte.
PERIMETRE_SOURCES = [DEPOT / "admin.html", DEPOT / "src" / "admin"]
AVANT_SOURCES_EN_LIGNE = {
    # Fichiers tels qu'ils étaient au commit précédent, conservés ici pour que
    # la mesure « avant » reste vérifiable après la réécriture des sources.
    "docs/phase3-tache-6-3/avant/admin.html": None,
}

RE_HEX = re.compile(r"#[0-9a-fA-F]{3,8}\b")
RE_RGB = re.compile(r"\brgba?\([^)]*\)")


# --------------------------------------------------------------------------
# 1. Compte des couleurs littérales
# --------------------------------------------------------------------------


def compter_couleurs(chemin: Path) -> tuple[int, int]:
    """(hexadécimales, rgb/rgba) d'un fichier, hors commentaires HTML."""
    texte = chemin.read_text(encoding="utf-8", errors="replace")
    if chemin.suffix == ".html":
        texte = re.sub(r"<!--.*?-->", "", texte, flags=re.S)
    return len(RE_HEX.findall(texte)), len(RE_RGB.findall(texte))


def compter_arborescence(racine: Path, avec_tests: bool = False) -> dict[str, int]:
    """Compte récursivement ; une racine fichier est acceptée.

    `avec_tests=False` (défaut) mesure le PÉRIMÈTRE D'INTERFACE : les sources
    livrées. Les fichiers `.spec.ts` sont comptés à part — ils contiennent des
    valeurs littérales qui ne s'affichent jamais (le `#fdfcfa` renvoyé par un
    `getComputedStyle` simulé, le motif de détection lui-même).
    """
    fichiers = (
        [racine]
        if racine.is_file()
        else sorted(
            p
            for p in racine.rglob("*")
            if p.is_file()
            and p.suffix in {".css", ".vue", ".ts", ".html"}
            and (avec_tests or not p.name.endswith(".spec.ts"))
        )
    )
    total_hex = total_rgb = 0
    detail = []
    for fichier in fichiers:
        hexa, rgb = compter_couleurs(fichier)
        if hexa or rgb:
            detail.append(
                {"fichier": str(fichier.relative_to(DEPOT)), "hex": hexa, "rgb": rgb}
            )
        total_hex += hexa
        total_rgb += rgb
    return {"hex": total_hex, "rgb": total_rgb, "detail": detail}


def mesurer_couleurs() -> dict:
    resultat: dict[str, object] = {}
    admin = DEPOT / "src" / "admin"

    # ---- APRÈS : sources livrées (interface) + build courant
    interface = compter_arborescence(admin)
    html_hex, html_rgb = compter_couleurs(DEPOT / "admin.html")
    interface["hex"] += html_hex
    interface["rgb"] += html_rgb
    tests = compter_arborescence(admin, avec_tests=True)
    resultat["apres"] = {
        "sources": interface,
        "admin_html": (html_hex, html_rgb),
        "hex_dans_les_tests": tests["hex"] - interface["hex"],
        "rgb_dans_les_tests": tests["rgb"] - interface["rgb"],
    }

    # ---- AVANT : sources d'origine conservées dans avant/
    avant = DOSSIER / "avant"
    if avant.is_dir():
        source_avant = compter_arborescence(avant / "src-admin")
        html_hex, html_rgb = compter_couleurs(avant / "admin.html")
        source_avant["hex"] += html_hex
        source_avant["rgb"] += html_rgb
        resultat["avant"] = {"sources": source_avant, "admin_html": (html_hex, html_rgb)}

    # ---- Contrôle : le build compilé (CSS + JS de l'entrée admin)
    for etiquette, dossier in (("dist_avant", DOSSIER / "dist-avant"), ("dist", DEPOT / "dist")):
        if not dossier.is_dir():
            continue
        hexa = rgb = 0
        fichiers: list[str] = []
        for fichier in sorted(dossier.glob("assets/admin-*")):
            h, r = compter_couleurs(fichier)
            hexa += h
            rgb += r
            if h or r:
                fichiers.append(f"{fichier.name} ({h} hex, {r} rgb)")
        h, r = compter_couleurs(dossier / "admin.html")
        resultat[etiquette] = {"hex": hexa + h, "rgb": rgb + r, "fichiers": fichiers}

    return resultat


# --------------------------------------------------------------------------
# 2. Contraste WCAG 2.1
# --------------------------------------------------------------------------


def lire_jetons() -> dict[str, dict[str, str]]:
    """Extrait les jetons des blocs `:root` (clair) et `[data-theme='dark']`."""
    texte = JETONS.read_text(encoding="utf-8")
    theme: dict[str, dict[str, str]] = {"clair": {}, "sombre": {}}
    bloc = None
    for ligne in texte.splitlines():
        if re.match(r"^\s*:root\s*\{", ligne):
            bloc = "clair"
            continue
        if re.search(r"^\s*\[data-theme='dark'\]\s*\{", ligne):
            bloc = "sombre"
            continue
        if bloc and ligne.strip() == "}":
            bloc = None
            continue
        if bloc:
            trouve = re.match(r"\s*(--[\w-]+)\s*:\s*([^;]+);", ligne)
            if trouve:
                theme[bloc][trouve.group(1)] = trouve.group(2).strip()
    return theme


def resoudre(valeur: str, jetons: dict[str, str], profondeur: int = 0) -> str:
    """Résout un nom de jeton (`--x`) ou une valeur `var(--x)`."""
    valeur = valeur.strip()
    trouve = re.fullmatch(r"(?:var\()?(--[\w-]+)\)?", valeur)
    if trouve and profondeur < 4:
        cible = jetons.get(trouve.group(1))
        if cible is None:
            raise KeyError(f"jeton inconnu : {trouve.group(1)}")
        return resoudre(cible, jetons, profondeur + 1)
    return valeur


def vers_rgba(couleur: str) -> tuple[float, float, float, float]:
    """`#rgb`, `#rrggbb`, `rgb()`, `rgba()` → (r, g, b, a) 0-255 / 0-1."""
    couleur = couleur.strip()
    if couleur.startswith("#"):
        hexa = couleur[1:]
        if len(hexa) == 3:
            hexa = "".join(c * 2 for c in hexa)
        return (int(hexa[0:2], 16), int(hexa[2:4], 16), int(hexa[4:6], 16), 1.0)
    trouve = re.fullmatch(r"rgba?\(([^)]*)\)", couleur)
    if trouve:
        parts = [p.strip() for p in trouve.group(1).split(",")]
        r, g, b = (float(p) for p in parts[:3])
        a = float(parts[3]) if len(parts) > 3 else 1.0
        return (r, g, b, a)
    raise ValueError(f"couleur illisible : {couleur}")


def resoudre_vars(expression: str, jetons: dict[str, str]) -> str:
    """Remplace tous les `var(--x)` d'une expression par leur valeur, récursivement.

    Nécessaire parce qu'un jeton peut être un `color-mix(in srgb, var(--y) p%,
    transparent)` : la référence imbriquée doit être résolue AVANT le calcul du
    mélange, sinon la couleur n'est pas calculable.
    """
    for _ in range(6):
        trouve = re.search(r"var\((--[\w-]+)\)", expression)
        if not trouve:
            return expression
        cible = jetons.get(trouve.group(1))
        if cible is None:
            raise KeyError(f"jeton inconnu : {trouve.group(1)}")
        expression = expression[: trouve.start()] + cible + expression[trouve.end() :]
    return expression


def melange(fond: str, couleur: str) -> tuple[float, float, float, float]:
    """Résout `color-mix(in srgb, X p%, transparent)` sur un fond opaque."""
    trouve = re.fullmatch(
        r"color-mix\(in srgb,\s*(.+?)\s+([\d.]+)%\s*,\s*transparent\)", couleur.strip()
    )
    if not trouve:
        return vers_rgba(couleur)
    base = vers_rgba(trouve.group(1))
    part = float(trouve.group(2)) / 100
    fond_rgba = vers_rgba(fond)
    return (
        base[0] * part + fond_rgba[0] * (1 - part),
        base[1] * part + fond_rgba[1] * (1 - part),
        base[2] * part + fond_rgba[2] * (1 - part),
        1.0,
    )


def composer(expression: str, jetons: dict[str, str], dessous: str) -> tuple[float, float, float]:
    """Compose une expression CSS (opaque, rgba ou color-mix) sur une couleur
    opaque : c'est le seul moyen de connaître la couleur RÉELLE d'une trace
    translucide — celle que l'œil voit, et donc celle qu'il faut mesurer."""
    expression = expression.strip()
    if re.fullmatch(r"--[\w-]+", expression):
        expression = jetons[expression]
    expression = resoudre_vars(expression, jetons).strip()
    trouve = re.fullmatch(
        r"color-mix\(in srgb,\s*(.+?)\s+([\d.]+)%\s*,\s*transparent\)", expression
    )
    if trouve:
        teinte = composer(trouve.group(1), jetons, dessous)
        part = float(trouve.group(2)) / 100
        fond = vers_rgba(dessous)
        return tuple(teinte[i] * part + fond[i] * (1 - part) for i in range(3))  # type: ignore[return-value]
    r, g, b, a = vers_rgba(expression)
    if a >= 1:
        return (r, g, b)
    fond = vers_rgba(dessous)
    return (r * a + fond[0] * (1 - a), g * a + fond[1] * (1 - a), b * a + fond[2] * (1 - a))


def luminance(rgb: tuple[float, float, float]) -> float:
    def canal(v: float) -> float:
        v /= 255
        return v / 12.92 if v <= 0.03928 else ((v + 0.055) / 1.055) ** 2.4

    r, g, b = (canal(c) for c in rgb)
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def ratio(texte: str, fond: str, jetons: dict[str, str]) -> float:
    """Ratio de contraste WCAG 2.1 entre un texte et son fond (composé)."""
    page = jetons["--bg_de_page"]
    couleur_fond = composer(fond, jetons, page)
    couleur_texte = composer(texte, jetons, "rgb(%.0f, %.0f, %.0f)" % couleur_fond)
    lum1 = luminance(couleur_texte)
    lum2 = luminance(couleur_fond)
    clair, sombre = max(lum1, lum2), min(lum1, lum2)
    return round((clair + 0.05) / (sombre + 0.05), 2)


def mesurer_contraste() -> dict:
    jetons = lire_jetons()
    # (libellé, texte, fond, seuil) — les seuils sont ceux de WCAG 2.1 AA :
    # 4.5 pour du texte courant, 3.0 pour un texte large (>= 24 px ou >= 18,66 px
    # gras) et pour un Contrôle au sens de 1.4.11 (filet, indicateur d'état).
    paires = [
        ("texte sur fond de page", "--text", "--bg", 4.5),
        ("texte sur surface", "--text", "--card", 4.5),
        ("texte sur surface 2", "--text", "--card2", 4.5),
        ("texte doux sur surface", "--soft", "--card", 4.5),
        ("texte discret sur fond de page", "--muted", "--bg", 4.5),
        ("texte discret sur surface", "--muted", "--card", 4.5),
        ("texte discret sur sidebar", "--muted", "--bg2", 4.5),
        ("accent sur fond de page", "--gold", "--bg", 4.5),
        ("accent sur surface", "--gold", "--card", 4.5),
        ("accent appuyé sur surface", "--gold2", "--card", 4.5),
        ("élément actif sur sa trace", "--gold2", "--gold-bg", 4.5),
        ("texte sur accent plein", "--on-gold", "--gold", 4.5),
        ("état succès sur sa trace", "--succes", "--succes-trace", 4.5),
        ("état alerte sur sa trace", "--alerte", "--alerte-trace", 4.5),
        ("état info sur sa trace", "--info", "--info-trace", 4.5),
        ("erreur sur sa trace", "--red-text", "--red-bg", 4.5),
        ("badge d'alerte sur sidebar", "--alerte", "--alerte-trace", 4.5),
        ("filet de contrôle sur surface", "--border-strong", "--card", 3.0),
        ("filet de contrôle sur fond de page", "--border-strong", "--bg", 3.0),
        ("filet décoratif sur surface", "--border", "--card", 1.0),
    ]
    # Les paires d'état sont aussi mesurées POSÉES SUR LA SIDEBAR (--bg2) et sur
    # la surface, parce que c'est là que vivent les pastilles de statut.
    resultats = {}
    for nom_theme, valeurs in jetons.items():
        # Le fond de page est la référence de composition : un jeton translucide
        # n'a de couleur qu'une fois posé dessus.
        valeurs["--bg_de_page"] = valeurs["--bg"]
        lignes = []
        for libelle, texte, fond, seuil in paires:
            valeur = ratio(texte, fond, valeurs)
            lignes.append(
                {
                    "paire": libelle,
                    "texte": f"{texte} {valeurs.get(texte, '')}",
                    "fond": f"{fond} {valeurs.get(fond, '')}",
                    "ratio": valeur,
                    "seuil": seuil,
                    "conforme": valeur >= seuil,
                }
            )
        # Pastilles posées sur la sidebar (fond réel --bg2)
        for libelle, texte in (
            ("état succès sur sidebar", "--succes"),
            ("état alerte sur sidebar", "--alerte"),
            ("état info sur sidebar", "--info"),
            ("texte discret sur sidebar", "--muted"),
            ("accent appuyé sur sidebar", "--gold2"),
        ):
            valeur = ratio(texte, "--bg2", valeurs)
            lignes.append(
                {
                    "paire": libelle,
                    "texte": f"{texte} {valeurs.get(texte, '')}",
                    "fond": f"--bg2 {valeurs.get('--bg2', '')}",
                    "ratio": valeur,
                    "seuil": 4.5,
                    "conforme": valeur >= 4.5,
                }
            )
        resultats[nom_theme] = lignes

    total = sum(len(v) for v in resultats.values())
    non_conformes = [
        f"{theme} / {ligne['paire']} = {ligne['ratio']}:1"
        for theme, lignes in resultats.items()
        for ligne in lignes
        if not ligne["conforme"]
    ]
    return {
        "total": total,
        "non_conformes": non_conformes,
        "themes": resultats,
    }


# --------------------------------------------------------------------------
# 3. Jetons consommés par la console vs jetons déclarés
# --------------------------------------------------------------------------

RE_JETON_UTILISE = re.compile(r"var\(\s*(--[\w-]+)")


def jetons_consommes() -> list[str]:
    """Noms de jetons utilisés dans les sources de la console (hors tests)."""
    trouves: set[str] = set()
    for fichier in sorted((DEPOT / "src" / "admin").rglob("*")):
        if not fichier.is_file() or fichier.suffix not in {".vue", ".ts"}:
            continue
        if fichier.name.endswith(".spec.ts"):
            continue
        trouves.update(RE_JETON_UTILISE.findall(fichier.read_text(encoding="utf-8")))
    return sorted(trouves)


def jetons_declares() -> set[str]:
    """Noms de jetons déclarés dans les feuilles canoniques."""
    declares: set[str] = set()
    for feuille in (DEPOT / "src" / "styles" / "jetons.css", DEPOT / "src" / "style.css"):
        for ligne in feuille.read_text(encoding="utf-8").splitlines():
            trouve = re.match(r"\s*(--[\w-]+)\s*:", ligne)
            if trouve:
                declares.add(trouve.group(1))
    return declares


def mesurer_jetons() -> dict:
    consommes = jetons_consommes()
    declares = jetons_declares()
    inconnus = [jeton for jeton in consommes if jeton not in declares]
    return {
        "consommes": len(consommes),
        "declares": len(declares),
        "inconnus": inconnus,
        "liste_consommes": consommes,
        "primitives_du_noyau": [j for j in consommes if j.startswith("--p-")],
    }


def main() -> int:
    quoi = sys.argv[1] if len(sys.argv) > 1 else "tout"

    if quoi in {"tout", "couleurs"}:
        couleurs = mesurer_couleurs()
        (DOSSIER / "mesures-couleurs.json").write_text(
            json.dumps(couleurs, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
        )
        print("couleurs littérales (hex / rgb), périmètre interface :")
        for cle in ("avant", "apres"):
            if cle in couleurs:
                bloc = couleurs[cle]["sources"]  # type: ignore[index]
                print(f"  {cle:6s} hex={bloc['hex']:3d}  rgb={bloc['rgb']:3d}")
        for cle in ("dist_avant", "dist"):
            if cle in couleurs:
                bloc = couleurs[cle]  # type: ignore[index]
                print(f"  {cle:10s} hex={bloc['hex']:3d}  rgb={bloc['rgb']:3d}")
        if "apres" in couleurs:
            print(
                f"  (dans les fichiers de test : "
                f"{couleurs['apres']['hex_dans_les_tests']} hex, "  # type: ignore[index]
                f"{couleurs['apres']['rgb_dans_les_tests']} rgb — non affichés)"  # type: ignore[index]
            )

    if quoi in {"tout", "contraste"}:
        contraste = mesurer_contraste()
        (DOSSIER / "mesures-contraste.json").write_text(
            json.dumps(contraste, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
        )
        print(f"\ncontraste : {contraste['total']} paires mesurées")
        if contraste["non_conformes"]:
            print("  NON CONFORMES :")
            for ligne in contraste["non_conformes"]:
                print(f"    - {ligne}")
        else:
            print("  toutes les paires atteignent leur seuil")

    if quoi in {"tout", "jetons"}:
        jetons = mesurer_jetons()
        (DOSSIER / "mesures-jetons.json").write_text(
            json.dumps(jetons, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
        )
        print(
            f"\njetons : {jetons['consommes']} consommés par la console, "
            f"{jetons['declares']} déclarés dans les feuilles canoniques"
        )
        if jetons["inconnus"]:
            print("  JETONS NON DÉCLARÉS :")
            for jeton in jetons["inconnus"]:
                print(f"    - {jeton}")
        else:
            print("  aucun jeton inconnu")
        if jetons["primitives_du_noyau"]:
            print(f"  PRIMITIVES CONSOMMÉES À TORT : {jetons['primitives_du_noyau']}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
