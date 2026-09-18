#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Mesures de cohérence design — tâche 6.9.

Cinq mesures indépendantes, chacune écrite dans son fichier JSON et imprimée
avec ses chiffres. Aucune ne « déclare » : chacune lit des valeurs réelles,
compte, calcule ou empreinte.

  1. `jetons`    — les jetons réellement déclarés et réellement consommés dans
                   les SEPT périmètres (source canonique du noyau, site, blog,
                   widget, console, application Mia, pages publiques), comparés
                   nom par nom, thème par thème, avec l'empreinte SHA-256 de
                   chaque jeu de valeurs.
  2. `polices`   — les familles et les fichiers de police des périmètres, avec
                   l'empreinte de chaque fichier, et la recherche de toute
                   référence à une fonderie distante.
  3. `echelles`  — arrondis, espacements et durées : valeurs comparées, échelles
                   complètes ou non, et compte des couleurs littérales.
  4. `emoji`     — les emoji du produit (chaînes d'interface / commentaires /
                   palette de saisie), avant et après la correction.
  5. `mia`       — ce que Mia écrit réellement en conversation : échantillon
                   obtenu de l'API de PRODUCTION, compté.

    python3 mesures.py              # les cinq mesures
    python3 mesures.py jetons
    python3 mesures.py polices
    python3 mesures.py echelles
    python3 mesures.py emoji
    python3 mesures.py mia          # appelle l'API de production (réseau requis)

Le script ne modifie RIEN : il lit des fichiers et, pour `mia`, interroge une
API en lecture. Aucun fichier n'est écrit hors de `docs/phase3-tache-6-9/`.
"""

from __future__ import annotations

import hashlib
import json
import re
import sys
import time
import unicodedata
import urllib.error
import urllib.request
from pathlib import Path

DEPOT = Path(__file__).resolve().parents[2]          # …/eperformance-widget
RACINE = DEPOT.parents[1]                             # …/OX6A
DOSSIER = Path(__file__).resolve().parent

NOYAU = RACINE / "agent-ia-web" / "eperf_core" / "assets" / "css"
SITE = RACINE / "site-eperformance" / "assets" / "css"
BLOG = RACINE / "blog-eperformance" / "assets" / "css"

API_PRODUCTION = "https://web-production-4ab53.up.railway.app"

# ==========================================================================
# Périmètres
# ==========================================================================

PERIMETRES: dict[str, dict] = {
    "noyau": {
        "libelle": "Source canonique du design system (noyau, couches 1 et 2)",
        "feuilles": [NOYAU / "10-primitives.css", NOYAU / "20-semantic.css"],
        "sources_consommation": [NOYAU],
        "role": "SOURCE",
    },
    "site": {
        "libelle": "Site eperformance.pro (assets/css/eperf.css)",
        "feuilles": [SITE / "eperf.css"],
        "sources_consommation": [SITE / "eperf.css"],
        "role": "PAIR",
    },
    "blog": {
        "libelle": "Blog eperformance.pro (assets/css/eperf.css)",
        "feuilles": [BLOG / "eperf.css"],
        "sources_consommation": [BLOG / "eperf.css"],
        "role": "PAIR",
    },
    "widget": {
        "libelle": "Widget visiteur (src/styles/jetons.css pour les valeurs, "
                   "src/** hors console et pages pour la consommation)",
        "feuilles": [DEPOT / "src" / "styles" / "jetons.css"],
        "sources_consommation": [
            DEPOT / "src" / "style.css", DEPOT / "src" / "App.vue",
            DEPOT / "src" / "views", DEPOT / "src" / "components",
            DEPOT / "src" / "stores", DEPOT / "src" / "helpers",
        ],
        "role": "CONSOMMATEUR",
    },
    "console": {
        "libelle": "Console d'administration (11 modules, src/admin/**)",
        "feuilles": [DEPOT / "src" / "styles" / "jetons.css"],
        "sources_consommation": [DEPOT / "src" / "admin", DEPOT / "src" / "style.css"],
        "role": "CONSOMMATEUR",
    },
    "application-mia": {
        "libelle": "Application Mia installable — MÊME document que le widget, "
                   "ouvert hors iframe (mode application)",
        "feuilles": [DEPOT / "src" / "styles" / "jetons.css"],
        "sources_consommation": [DEPOT / "src" / "style.css", DEPOT / "src" / "App.vue",
                                 DEPOT / "src" / "views", DEPOT / "src" / "components"],
        "role": "CONSOMMATEUR",
    },
    "pages-publiques": {
        "libelle": "Pages publiques /application et /application/mia",
        "feuilles": [DEPOT / "src" / "styles" / "jetons.css"],
        "sources_consommation": [DEPOT / "src" / "application.css",
                                 DEPOT / "src" / "application", DEPOT / "application"],
        "role": "CONSOMMATEUR",
    },
}

# Correspondance de noms entre la couche 2 du noyau et les feuilles du site.
# Elle n'est PAS inventée ici : elle est écrite en tête de `src/styles/jetons.css`
# (lignes 12 à 18, commentaire du propriétaire du dépôt). Chaque correspondance
# est ensuite VÉRIFIÉE par la comparaison de valeurs : une correspondance fausse
# ne se contente pas de rater, elle produit une divergence nommée dans le
# rapport. Le tableau est donc une hypothèse, et la mesure en est la preuve.
CORRESPONDANCES = {
    "--bg": "--fond",
    "--bg2": "--fond-2",
    "--card": "--surface",
    "--card2": "--surface-2",
    "--text": "--texte",
    "--soft": "--texte-doux",
    "--muted": "--texte-discret",
    "--gold": "--accent",
    "--gold2": "--accent-appuye",
    "--gold-bg": "--accent-trace",
    "--gold-border": "--accent-filet",
    "--gold-glow": "--accent-halo",
    "--on-gold": "--sur-accent",
    "--border": "--filet",
    "--border2": "--filet-2",
    "--border-strong": "--filet-controle",
    "--succes": "--succes",
    "--succes-filet": "--succes-filet",
    "--succes-trace": "--succes-trace",
    "--alerte": "--alerte",
    "--alerte-filet": "--alerte-filet",
    "--alerte-trace": "--alerte-trace",
    "--info": "--info",
    "--info-filet": "--info-filet",
    "--info-trace": "--info-trace",
    "--red-text": "--erreur",
    "--red-border": "--erreur-filet",
    "--red-bg": "--erreur-trace",
    "--wa": "--whatsapp",
    "--wa-text": "--whatsapp-texte",
    "--police-titres": "--police-titres",
    "--police-corps": "--police-corps",
    "--arrondi-input": "--rayon-champ",
    "--arrondi-bloc": "--rayon-bloc",
    "--arrondi-carte": "--rayon-carte",
    "--arrondi-bouton": "--rayon-bouton",
    "--t": "--duree",
    "--t-fast": "--duree-rapide",
    "--t-slow": "--duree-lente",
    "--ease-out": "--courbe",
    "--shadow-sm": "--ombre-1",
    "--shadow-md": "--ombre-2",
    "--shadow-lg": "--ombre-3",
    "--shadow-gold": "--ombre-accent",
}

# Échelles comparées comme des ÉCHELLES (l'ordre et l'amplitude comptent, pas
# seulement la valeur d'un jeton isolé).
ECHELLES = {
    "arrondis": {
        "site": ["--arrondi-input", "--arrondi-bloc", "--arrondi-carte", "--arrondi-bouton"],
        "noyau": ["--rayon-champ", "--rayon-bloc", "--rayon-carte", "--rayon-bouton"],
    },
    "espacements": {
        "site": [],
        "noyau": ["--p-espace-1", "--p-espace-2", "--p-espace-3", "--p-espace-4",
                  "--p-espace-5", "--p-espace-6", "--p-espace-7", "--p-espace-8"],
    },
    "durees": {
        "site": ["--t-fast", "--t", "--t-slow"],
        "noyau": ["--duree-rapide", "--duree", "--duree-lente"],
    },
}


# ==========================================================================
# Lecture du CSS
# ==========================================================================

RE_DECLARATION = re.compile(r"(--[\w-]+)\s*:\s*([^;{}]+);")
RE_VAR = re.compile(r"var\(\s*(--[\w-]+)")
RE_SELECTEUR = re.compile(
    r":root\s*\{|\[data-theme\s*=\s*['\"]dark['\"]\]\s*\{", re.I)


def lire_feuille(chemin: Path) -> dict[str, dict[str, str]]:
    """Extrait les jetons d'une feuille, thème par thème.

    Analyse par ACCOLADES COMPTÉES, avec la pile des règles englobantes. Trois
    pièges sont ainsi évités, et chacun a été rencontré :

      · le noyau imbrique ses thèmes dans `@layer tokens { … }` : lire le
        fichier à plat ferait basculer tout le reste dans le mauvais thème ;
      · un `@media (prefers-reduced-motion) { :root { … } }` en fin de fichier
        REPOSE `--duree` à 1 ms : le prendre pour le thème clair faisait
        apparaître une divergence de durée qui n'existe pas à l'écran ;
      · une accolade dans un commentaire décalerait la profondeur — les
        commentaires sont donc retirés avant l'analyse.

    Un bloc n'est retenu que si son sélecteur est EXACTEMENT `:root` ou
    `[data-theme='dark']` (ou `"dark"`), et s'il n'est pas sous `@media`.
    """
    if not chemin.is_file():
        return {}
    texte = re.sub(r"/\*.*?\*/", "", chemin.read_text(encoding="utf-8", errors="replace"),
                   flags=re.S)
    jetons: dict[str, dict[str, str]] = {"clair": {}, "sombre": {}}

    pile: list[str] = []           # sélecteurs/at-rules ouverts
    tampon = ""
    position = 0
    while position < len(texte):
        caractere = texte[position]
        if caractere == "{":
            selecteur = re.sub(r"\s+", " ", tampon).strip()
            englobantes = " ".join(pile)
            theme = None
            if not re.search(r"@(media|supports|container)", englobantes, re.I):
                if re.fullmatch(r":root", selecteur, re.I):
                    theme = "clair"
                elif re.fullmatch(r"\[data-theme\s*=\s*['\"]dark['\"]\]", selecteur, re.I):
                    theme = "sombre"
            pile.append(selecteur)
            if theme:
                # corps du bloc : jusqu'à son accolade fermante
                profondeur, index, fin_bloc = 1, position + 1, len(texte)
                while index < len(texte):
                    if texte[index] == "{":
                        profondeur += 1
                    elif texte[index] == "}":
                        profondeur -= 1
                        if profondeur == 0:
                            fin_bloc = index
                            break
                    index += 1
                for nom, valeur in RE_DECLARATION.findall(texte[position + 1:fin_bloc]):
                    jetons[theme][nom] = valeur.strip()
            tampon = ""
        elif caractere == "}":
            if pile:
                pile.pop()
            tampon = ""
        elif caractere == ";":
            # une at-rule terminée par `;` (`@layer a, b, c;`) n'ouvre rien
            tampon = ""
        else:
            tampon += caractere
        position += 1
    return jetons


def jetons_consommes(cibles: list[Path]) -> list[str]:
    """Noms de jetons réellement utilisés dans `var()` — sources de code
    comprises, pas seulement les feuilles de jetons."""
    trouves: set[str] = set()
    for cible in cibles:
        fichiers = [cible] if cible.is_file() else sorted(
            f for f in cible.rglob("*")
            if f.is_file() and f.suffix in {".css", ".vue", ".ts"}
            and not f.name.endswith(".spec.ts"))
        for fichier in fichiers:
            trouves.update(
                RE_VAR.findall(fichier.read_text(encoding="utf-8", errors="replace")))
    return sorted(trouves)


def empreinte(theme: dict[str, str]) -> str:
    contenu = "\n".join(f"{nom}={valeur}" for nom, valeur in sorted(theme.items()))
    return hashlib.sha256(contenu.encode("utf-8")).hexdigest()


# ==========================================================================
# 1. Jetons
# ==========================================================================


def resoudre(valeur: str, table: dict[str, str], profondeur: int = 0) -> str:
    """Résout `var(--x)` sur la table donnée, récursivement."""
    if profondeur > 8:
        return valeur
    trouve = re.fullmatch(r"\s*var\(\s*(--[\w-]+)\s*\)\s*", valeur)
    if trouve:
        cible = table.get(trouve.group(1))
        if cible is None:
            return f"<{trouve.group(1)} non déclaré>"
        return resoudre(cible, table, profondeur + 1)
    return valeur


# --------------------------------------------------------------------------
# Canonisation des valeurs
#
# Comparer des valeurs CSS en texte brut ne mesure rien : `rgba(138,111,56,.07)`
# et `color-mix(in srgb, #8a6f38 7%, transparent)` sont LA MÊME COULEUR écrite
# de deux façons, tandis que `12px` et `10px` sont deux valeurs différentes qui
# se ressemblent. On résout donc les `var()`, on convertit les couleurs en
# quadruplets (r, g, b, a) et on compare des NOMBRES.
# --------------------------------------------------------------------------


def vers_rgba(couleur: str) -> tuple[float, float, float, float] | None:
    """`#rgb`, `#rrggbb`, `rgb()`, `rgba()` vers (r, g, b, a). None si illisible."""
    couleur = couleur.strip()
    if couleur.startswith("#"):
        hexa = couleur[1:]
        if len(hexa) == 3:
            hexa = "".join(c * 2 for c in hexa)
        if len(hexa) not in (6, 8):
            return None
        return (int(hexa[0:2], 16), int(hexa[2:4], 16), int(hexa[4:6], 16),
                int(hexa[6:8], 16) / 255 if len(hexa) == 8 else 1.0)
    trouve = re.fullmatch(r"rgba?\(([^)]*)\)", couleur)
    if trouve:
        parts = [p.strip() for p in trouve.group(1).replace(",", " ").split()]
        if len(parts) < 3:
            return None
        canaux = []
        for part in parts[:3]:
            canaux.append(float(part[:-1]) * 2.55 if part.endswith("%") else float(part))
        alpha = 1.0
        if len(parts) > 3:
            alpha = float(parts[3][:-1]) / 100 if parts[3].endswith("%") else float(parts[3])
        return (canaux[0], canaux[1], canaux[2], alpha)
    return None


def resoudre_tout(valeur: str, table: dict[str, str], profondeur: int = 0) -> str:
    """Remplace TOUS les `var(--x)` d'une expression, récursivement."""
    if profondeur > 8:
        return valeur
    trouve = re.search(r"var\(\s*(--[\w-]+)\s*\)", valeur)
    if not trouve:
        return valeur
    cible = table.get(trouve.group(1))
    remplacement = cible if cible is not None else trouve.group(0)
    return resoudre_tout(valeur[:trouve.start()] + remplacement + valeur[trouve.end():],
                         table, profondeur + 1)


def canoniser(valeur: str, table: dict[str, str]) -> str:
    """Forme canonique d'une valeur de jeton, comparable d'un périmètre à l'autre.

    Une couleur devient `rgba(r, g, b, a)` avec des canaux entiers : la même
    teinte écrite en hexadécimal, en `rgb()` ou en `color-mix()` produit alors
    exactement la même chaîne, et une différence de syntaxe ne se déguise plus
    en divergence de valeur.
    """
    if valeur is None:
        return "<absent>"
    texte = resoudre_tout(valeur.strip(), table)

    # Couleur composée : `color-mix(in srgb, X p%, transparent)` = rgba(X, p/100)
    trouve = re.fullmatch(
        r"color-mix\(\s*in\s+srgb\s*,\s*(.+?)\s+([\d.]+)%\s*,\s*transparent\s*\)",
        texte, re.I)
    if trouve:
        base = canoniser(trouve.group(1), table)
        rgba_base = vers_rgba(base)
        # `color-mix(X p%, transparent)` ET `rgba(X, p/100)` sont LA MÊME
        # COULEUR. Sans cette conversion, une différence d'ÉCRITURE entre le
        # site et le widget se présenterait comme une divergence de valeur —
        # c'était le cas des trois voiles d'accent en thème sombre, qui sont
        # numériquement identiques.
        if rgba_base is not None and rgba_base[3] >= 1:
            return (f"rgba({round(rgba_base[0])}, {round(rgba_base[1])}, "
                    f"{round(rgba_base[2])}, {round(float(trouve.group(2)) / 100, 4)})")
        return f"color-mix({base} {trouve.group(2)}%)"

    rgba = vers_rgba(texte)
    if rgba is not None:
        return (f"rgba({round(rgba[0])}, {round(rgba[1])}, {round(rgba[2])}, "
                f"{round(rgba[3], 4)})")

    # Valeur composite (ombre, police, durée) : on normalise les espaces.
    return re.sub(r"\s+", " ", texte)


def luminance(rgb: tuple[float, float, float]) -> float:
    def canal(valeur: float) -> float:
        valeur /= 255
        return valeur / 12.92 if valeur <= 0.03928 else ((valeur + 0.055) / 1.055) ** 2.4

    r, v, b = (canal(c) for c in rgb)
    return 0.2126 * r + 0.7152 * v + 0.0722 * b


def contraste(couleur_a: str, couleur_b: str) -> float:
    """Ratio WCAG 2.1 entre deux couleurs opaques données en hexadécimal."""
    a, b = vers_rgba(couleur_a), vers_rgba(couleur_b)
    if not a or not b:
        return 0.0
    la, lb = luminance(a[:3]), luminance(b[:3])
    clair, sombre = max(la, lb), min(la, lb)
    return round((clair + 0.05) / (sombre + 0.05), 2)


def mesurer_jetons() -> dict:
    resultat: dict[str, dict] = {}
    for nom, perimetre in PERIMETRES.items():
        feuilles = perimetre["feuilles"]
        jetons = {"clair": {}, "sombre": {}}
        for feuille in feuilles:
            lus = lire_feuille(feuille)
            for theme in ("clair", "sombre"):
                jetons[theme].update(lus.get(theme, {}))
        resultat[nom] = {
            "libelle": perimetre["libelle"],
            "role": perimetre["role"],
            "feuilles": [str(f.relative_to(RACINE)) for f in feuilles if f.is_file()],
            "feuilles_absentes": [str(f) for f in feuilles if not f.is_file()],
            "declares_clair": len(jetons["clair"]),
            "declares_sombre": len(jetons["sombre"]),
            "empreinte_clair": empreinte(jetons["clair"]),
            "empreinte_sombre": empreinte(jetons["sombre"]),
            "consommes": len(jetons_consommes(perimetre["sources_consommation"])),
            "liste_consommes": jetons_consommes(perimetre["sources_consommation"]),
            "valeurs": jetons,
        }

    # --- Formes canoniques : on compare des VALEURS, pas des écritures --------
    # La table de résolution d'un thème, c'est le thème clair PUIS le thème
    # sombre : c'est la cascade CSS elle-même. Résoudre le sombre avec la table
    # du clair (ou l'inverse) ferait apparaître des divergences qui n'existent
    # pas à l'écran — la première version de ce script le faisait.
    for nom, bloc in resultat.items():
        bloc["canonique"] = {}
        for theme in ("clair", "sombre"):
            table = {**bloc["valeurs"]["clair"], **bloc["valeurs"][theme]}
            bloc["canonique"][theme] = {
                jeton: canoniser(valeur, table)
                for jeton, valeur in bloc["valeurs"][theme].items()
            }
        bloc["canonique_du_theme"] = {
            theme: {**bloc["canonique"]["clair"], **bloc["canonique"][theme]}
            for theme in ("clair", "sombre")
        }

    # --- Comparaison A : entre périmètres du MÊME espace de noms -------------
    pairs = ["site", "blog", "widget", "console", "application-mia", "pages-publiques"]
    comparaison: list[dict] = []
    for theme in ("clair", "sombre"):
        noms = sorted({
            nom
            for perimetre in pairs
            for nom in resultat[perimetre]["canonique"][theme]
        })
        for nom in noms:
            valeurs = {
                perimetre: resultat[perimetre]["canonique"][theme].get(nom)
                for perimetre in pairs
            }
            declarees = {v for v in valeurs.values() if v is not None}
            if len(declarees) > 1:
                brutes = {
                    perimetre: resultat[perimetre]["valeurs"][theme].get(nom)
                    for perimetre in pairs
                }
                comparaison.append({
                    "theme": theme,
                    "jeton": nom,
                    "valeurs_canoniques": {p: v for p, v in valeurs.items() if v is not None},
                    "valeurs_brutes": {p: v for p, v in brutes.items() if v is not None},
                    "justification": (
                        "Décision D6 documentée : l'accent clair du site (#8a6f38) "
                        "mesure 4,37:1 sur --bg2, sous le seuil AA ; le widget "
                        "#856b37 le remet au-dessus. Vérifié par calcul dans "
                        "_verification_accent."
                        if nom in ("--gold", "--gold-bg", "--gold-border", "--gold-glow")
                        else None),
                })
    resultat["_comparaison_par_nom"] = {
        "perimetres": pairs,
        "jetons_compares": len({
            nom for perimetre in pairs
            for theme in ("clair", "sombre")
            for nom in resultat[perimetre]["valeurs"][theme]
        }),
        "divergences": comparaison,
        "nombre_divergences": len(comparaison),
    }

    # --- Vérification de la divergence d'accent (D6) -------------------------
    # Elle est documentée ; on la CALCULE plutôt que de la croire sur parole.
    verification = []
    for nom_theme, fond in (("clair", "--bg2"), ("sombre", "--bg")):
        table_site = resultat["site"]["valeurs"][nom_theme]
        table_widget = resultat["widget"]["valeurs"][nom_theme]
        couleur_fond = table_site.get(fond) or table_widget.get(fond)
        for etiquette, table in (("site", table_site), ("widget", table_widget)):
            accent = table.get("--gold")
            if accent and couleur_fond:
                verification.append({
                    "theme": nom_theme,
                    "perimetre": etiquette,
                    "accent": accent,
                    "fond": f"{fond} {couleur_fond}",
                    "ratio": contraste(accent, couleur_fond),
                    "seuil_AA": 4.5,
                    "conforme": contraste(accent, couleur_fond) >= 4.5,
                })
    resultat["_verification_accent"] = verification

    # --- Comparaison B : noyau et feuilles du site, via la correspondance -----
    noyau = resultat["noyau"]
    divergence_noyau: list[dict] = []
    verifiees = 0
    for theme in ("clair", "sombre"):
        table_noyau = {**noyau["valeurs"]["clair"], **noyau["valeurs"][theme]}
        table_widget = {**resultat["widget"]["valeurs"]["clair"],
                        **resultat["widget"]["valeurs"][theme]}
        for nom_site, nom_noyau in sorted(CORRESPONDANCES.items()):
            valeur_site = resultat["widget"]["valeurs"][theme].get(nom_site)
            brut_noyau = noyau["valeurs"][theme].get(nom_noyau)
            if valeur_site is None or brut_noyau is None:
                continue
            verifiees += 1
            canonique_site = canoniser(valeur_site, table_widget)
            canonique_noyau = canoniser(brut_noyau, table_noyau)
            if canonique_site != canonique_noyau:
                divergence_noyau.append({
                    "theme": theme,
                    "jeton_site": nom_site,
                    "valeur_site": valeur_site,
                    "canonique_site": canonique_site,
                    "jeton_noyau": nom_noyau,
                    "valeur_noyau": brut_noyau,
                    "canonique_noyau": canonique_noyau,
                })
    resultat["_comparaison_noyau"] = {
        "correspondances": len(CORRESPONDANCES),
        "paires_verifiees": verifiees,
        "divergences": divergence_noyau,
        "nombre_divergences": len(divergence_noyau),
    }
    return resultat


# ==========================================================================
# 2. Polices
# ==========================================================================

RE_FONT_FACE = re.compile(r"@font-face\s*\{([^}]*)\}", re.I)
RE_SSRC = re.compile(r"src\s*:\s*([^;]+);", re.I)
RE_URL = re.compile(r"url\(\s*['\"]?([^'\")]+)['\"]?\s*\)")
RE_FAMILLE = re.compile(r"font-family\s*:\s*([^;]+);", re.I)

FONDERIES_DISTANTES = [
    "fonts.googleapis.com", "fonts.gstatic.com", "use.typekit.net",
    "fonts.bunny.net", "cdn.jsdelivr.net", "kit.fontawesome.com",
]


def md5(chemin: Path) -> str:
    return hashlib.md5(chemin.read_bytes()).hexdigest()


def mesurer_polices() -> dict:
    importe = {"widget": [DEPOT / "src" / "style.css"],
               "application-mia": [DEPOT / "src" / "style.css"],
               "pages-publiques": [DEPOT / "src" / "application.css"],
               "console": [DEPOT / "src" / "style.css"],
               "site": [SITE / "eperf.css"],
               "blog": [BLOG / "eperf.css"],
               "noyau": [NOYAU / "30-base.css", NOYAU / "20-semantic.css"]}
    resultat: dict[str, dict] = {}
    for nom, feuilles in importe.items():
        declarations = []
        for feuille in feuilles:
            if not feuille.is_file():
                continue
            texte = feuille.read_text(encoding="utf-8", errors="replace")
            for bloc in RE_FONT_FACE.findall(texte):
                famille = RE_FAMILLE.search(bloc)
                poids = re.search(r"font-weight\s*:\s*([^;]+);", bloc, re.I)
                style = re.search(r"font-style\s*:\s*([^;]+);", bloc, re.I)
                source = RE_SSRC.search(bloc)
                fichiers = []
                if source:
                    for url in RE_URL.findall(source.group(1)):
                        chemin = (feuille.parent / url).resolve()
                        fichiers.append({
                            "url": url,
                            "existe": chemin.is_file(),
                            "md5": md5(chemin) if chemin.is_file() else None,
                            "octets": chemin.stat().st_size if chemin.is_file() else None,
                        })
                declarations.append({
                    "famille": famille.group(1).strip().strip("'\"") if famille else None,
                    "poids": poids.group(1).strip() if poids else None,
                    "style": style.group(1).strip() if style else None,
                    "fichiers": fichiers,
                })
        resultat[nom] = {
            "declarations": len(declarations),
            "familles": sorted({d["famille"] for d in declarations if d["famille"]}),
            "familles_du_noeud": sorted({
                (d["famille"], d["poids"], d["style"]) for d in declarations
            }),
            "empreinte": hashlib.sha256(
                json.dumps(sorted(
                    [(d["famille"], d["poids"], d["style"],
                      tuple(f["url"] for f in d["fichiers"])) for d in declarations],
                    key=str), ensure_ascii=False).encode("utf-8")).hexdigest(),
            "detail": declarations,
        }

    # Fichiers auto-hébergés : mêmes empreintes d'un périmètre à l'autre ?
    dossiers = {
        "widget": DEPOT / "public" / "fonts",
        "application-mia": DEPOT / "public" / "fonts",
        "console": DEPOT / "public" / "fonts",
        "pages-publiques": DEPOT / "public" / "fonts",
        "site": SITE.parent / "fonts",
        "blog": BLOG.parent / "fonts",
    }
    fichiers: dict[str, dict[str, str]] = {}
    for nom, dossier in dossiers.items():
        if dossier.is_dir():
            fichiers[nom] = {f.name: md5(f) for f in sorted(dossier.glob("*.woff2"))}

    # Références à une fonderie distante : sources ET artefacts compilés.
    motifs = "|".join(re.escape(h) for h in FONDERIES_DISTANTES)
    re_distante = re.compile(motifs, re.I)
    # On scanne la RACINE des deux sites, pas seulement leur dossier `assets` :
    # une page HTML peut charger une fonderie distante sans passer par eperf.css.
    # La première version de cette mesure ne regardait que `assets/css` et
    # annonçait « 0 référence » — c'était faux, et c'est ce qui a fait étendre
    # le périmètre. Un zéro qui vient d'un périmètre trop étroit ne vaut rien.
    frontieres = [
        DEPOT / "src", DEPOT / "index.html", DEPOT / "admin.html",
        DEPOT / "application", DEPOT / "public", DEPOT / "dist",
        RACINE / "site-eperformance", RACINE / "blog-eperformance", NOYAU,
    ]
    references: list[str] = []
    for frontiere in frontieres:
        if not frontiere.exists():
            continue
        fichiers_a_lire = [frontiere] if frontiere.is_file() else [
            f for f in frontiere.rglob("*")
            if f.is_file() and f.suffix in {".css", ".html", ".js", ".ts", ".vue", ".json"}
            and "node_modules" not in f.parts
        ]
        for fichier in fichiers_a_lire:
            try:
                texte = fichier.read_text(encoding="utf-8", errors="replace")
            except OSError:
                continue
            for numero, ligne in enumerate(texte.splitlines(), 1):
                if re_distante.search(ligne):
                    references.append(
                        f"{fichier.relative_to(RACINE)}:{numero}: {ligne.strip()[:110]}")

    return {
        "perimetres": resultat,
        "fichiers_auto_heberges": {
            nom: {"nombre": len(table), "md5": table}
            for nom, table in fichiers.items()
        },
        "references_fonderie_distante": references,
        "nombre_references_distantes": len(references),
    }


# ==========================================================================
# 3. Échelles, arrondis, couleurs littérales
# ==========================================================================

RE_HEX = re.compile(r"#[0-9a-fA-F]{3,8}\b")

# Sources des RECETTES d'interface (mise en page), pour la mesure des espacements.
INTERMITTENT_SOURCES = {
    "widget": [DEPOT / "src" / "style.css", DEPOT / "src" / "views",
               DEPOT / "src" / "components"],
    "console": [DEPOT / "src" / "admin"],
    "pages-publiques": [DEPOT / "src" / "application.css"],
}
RE_RGB = re.compile(r"\brgba?\([^)]*\)")

# Sources d'INTERFACE du produit : ce qui s'affiche. Les fichiers de test sont
# comptés à part (leurs valeurs simulées ne s'affichent jamais), et le SDK est
# isolé : il est gelé par contrat et porte les replis de jetons pour un site hôte.
INTERFACE = {
    "widget": [DEPOT / "src" / "style.css"],
    "console": [DEPOT / "src" / "admin"],
    "pages-publiques": [DEPOT / "src" / "application.css", DEPOT / "application"],
    "application-mia": [DEPOT / "index.html"],
    "console-html": [DEPOT / "admin.html"],
    "sdk gele": [DEPOT / "src" / "sdk" / "entry.ts"],
    "config widget": [DEPOT / "src" / "stores" / "config.ts"],
}

# Le « avant » de cette tâche : l'état livré, lu directement dans l'historique
# Git plutôt que recopié — un avant recopié n'est pas un avant.
AVANT_GIT = "HEAD~1"


def compter_fichier(chemin: Path, avec_tests: bool = False) -> tuple[int, int]:
    if chemin.suffix not in {".css", ".vue", ".ts", ".html", ".json"}:
        return 0, 0
    if chemin.name.endswith(".spec.ts") and not avec_tests:
        return 0, 0
    texte = chemin.read_text(encoding="utf-8", errors="replace")
    if chemin.suffix == ".html":
        texte = re.sub(r"<!--.*?-->", "", texte, flags=re.S)
    if chemin.suffix in {".ts", ".vue"}:
        texte = re.sub(r"/\*.*?\*/", "", texte, flags=re.S)
    return len(RE_HEX.findall(texte)), len(RE_RGB.findall(texte))


def compter_perimetre(cibles: list[Path], avec_tests: bool = False) -> dict:
    total_hex = total_rgb = 0
    detail = []
    for cible in cibles:
        fichiers = [cible] if cible.is_file() else sorted(
            f for f in cible.rglob("*")
            if f.is_file() and f.suffix in {".css", ".vue", ".ts", ".html"}
        )
        for fichier in fichiers:
            hexa, rgb = compter_fichier(fichier, avec_tests)
            if hexa or rgb:
                detail.append({"fichier": str(fichier.relative_to(DEPOT)),
                               "hex": hexa, "rgb": rgb})
            total_hex += hexa
            total_rgb += rgb
    return {"hex": total_hex, "rgb": total_rgb, "detail": detail}


def mesurer_echelles() -> dict:
    jetons: dict[str, dict[str, dict[str, str]]] = {}
    for nom, perimetre in PERIMETRES.items():
        jetons[nom] = {"clair": {}, "sombre": {}}
        for feuille in perimetre["feuilles"]:
            lues = lire_feuille(feuille)
            for theme in ("clair", "sombre"):
                jetons[nom][theme].update(lues.get(theme, {}))
    echelles = {}
    for nom_echelle, definition in ECHELLES.items():
        bloc = {}
        for espace, noms in definition.items():
            if espace == "noyau":
                table = dict(jetons["noyau"]["clair"])
                table.update({f"--{k}": v for k, v in
                              {p.split("--p-")[-1]: v for p, v in
                               dict(jetons["noyau"]["clair"]).items() if p.startswith("--p-")}.items()})
                valeurs = {n: resoudre(jetons["noyau"]["clair"].get(n), jetons["noyau"]["clair"])
                           for n in noms}
            else:
                source = jetons["widget"]["clair"]
                valeurs = {n: source.get(n) for n in noms}
            bloc[espace] = valeurs
        echelles[nom_echelle] = bloc

    # Espacements : le noyau porte une échelle de 8 crans ; le site en porte une
    # autre, nommée autrement. On mesure les deux et on dit ce qui manque.
    espacements_noyau = {n: v for n, v in jetons["noyau"]["clair"].items()
                         if n.startswith("--p-espace-")}
    espacements_site = {n: v for n, v in jetons["site"]["clair"].items()
                        if "espace" in n or "gouttiere" in n or "gutter" in n
                        or "padding" in n or "section" in n}

    # Espacements réellement écrits dans les recettes d'interface : combien
    # passent par un jeton, combien sont écrits en littéral. Le noyau porte une
    # échelle de huit crans ; le site n'en porte pas. La conséquence se mesure
    # ici plutôt que de se constater à l'œil.
    RE_ESPACEMENT = re.compile(
        r"\b(padding|margin|gap|row-gap|column-gap|inset)"
        r"(?:-(?:top|right|bottom|left|block|inline|x|y))?\s*:\s*([^;}]+)")
    espacements_recettes = {"par_jeton": 0, "litteral": 0, "valeurs_litterales": {}}
    for nom in ("widget", "console", "pages-publiques"):
        for cible in INTERMITTENT_SOURCES.get(nom, []):
            fichiers = [cible] if cible.is_file() else sorted(
                f for f in cible.rglob("*")
                if f.is_file() and f.suffix in {".css", ".vue"}
                and not f.name.endswith(".spec.ts"))
            for fichier in fichiers:
                texte = re.sub(r"/\*.*?\*/", "",
                               fichier.read_text(encoding="utf-8", errors="replace"), flags=re.S)
                for _, valeur in RE_ESPACEMENT.findall(texte):
                    if "var(" in valeur:
                        espacements_recettes["par_jeton"] += 1
                    elif re.search(r"\d(?:\.\d+)?(px|rem|em)", valeur):
                        espacements_recettes["litteral"] += 1
                        for nombre in re.findall(r"\d(?:\.\d+)?(?:px|rem)", valeur):
                            espacements_recettes["valeurs_litterales"][nombre] = (
                                espacements_recettes["valeurs_litterales"].get(nombre, 0) + 1)

    # Les couleurs littérales restantes dans les coquilles HTML : ce sont les
    # `theme-color`, et une balise meta NE PEUT PAS lire une variable CSS. On
    # vérifie qu'elles valent bien le jeton correspondant.
    couleurs_coquilles = []
    for fichier, motif in ((DEPOT / "index.html", r'name="theme-color"'),
                           (DEPOT / "application" / "index.html", r'name="theme-color"'),
                           (DEPOT / "application" / "mia" / "index.html", r'name="theme-color"')):
        if not fichier.is_file():
            continue
        for ligne in fichier.read_text(encoding="utf-8").splitlines():
            for couleur in RE_HEX.findall(ligne):
                couleurs_coquilles.append({
                    "fichier": str(fichier.relative_to(DEPOT)), "couleur": couleur,
                    "role": "theme-color" if "theme-color" in ligne else "autre",
                })

    # Les valeurs littérales sont-elles AU MOINS sur l'échelle du noyau ?
    # 0.25rem = 4px, 0.5rem = 8px, 0.75rem = 12px, 1rem = 16px, 1.5rem = 24px,
    # 2rem = 32px, 2.75rem = 44px, 4rem = 64px.
    echelle_px = {4, 8, 12, 16, 24, 32, 44, 64}
    sur_echelle = hors_echelle = 0
    for valeur, nombre in espacements_recettes["valeurs_litterales"].items():
        pixels = (round(float(valeur[:-3]) * 16) if valeur.endswith("rem")
                  else round(float(valeur[:-2])))
        if pixels in echelle_px:
            sur_echelle += nombre
        else:
            hors_echelle += nombre
    espacements_recettes["occurrences_sur_l_echelle_du_noyau"] = sur_echelle
    espacements_recettes["occurrences_hors_echelle"] = hors_echelle

    # Couleurs littérales, par périmètre, et le total d'interface.
    compte = {nom: compter_perimetre(cibles) for nom, cibles in INTERFACE.items()}
    interface = {nom: compte[nom] for nom in
                 ("widget", "console", "pages-publiques", "application-mia", "console-html")}
    total_hex = sum(bloc["hex"] for bloc in interface.values())
    total_rgb = sum(bloc["rgb"] for bloc in interface.values())

    # Détail justifié : chaque couleur littérale restante, avec son emplacement.
    restantes = []
    for nom, bloc in compte.items():
        for ligne in bloc["detail"]:
            restantes.append({"perimetre": nom, **ligne})

    # Les `theme-color` des coquilles valent-elles le jeton `--bg` ?
    table_bg = {"clair": jetons["widget"]["clair"].get("--bg"),
                "sombre": jetons["widget"]["sombre"].get("--bg")}
    for entree in couleurs_coquilles:
        entree["jeton_attendu"] = table_bg
        entree["vaut_le_jeton_bg"] = entree["couleur"] in table_bg.values()

    return {
        "arrondis_et_durees": echelles,
        "espacements_recettes": espacements_recettes,
        "couleurs_des_coquilles": couleurs_coquilles,
        "espacements": {
            "echelle_du_noyau": espacements_noyau,
            "echelle_du_site": espacements_site,
            "nombre_crans_noyau": len(espacements_noyau),
            "nombre_crans_site": len(espacements_site),
        },
        "couleurs_litterales": {
            "par_perimetre": compte,
            "interface_total_hex": total_hex,
            "interface_total_rgb": total_rgb,
            "avant_git": AVANT_GIT,
            "detail_restant": restantes,
        },
    }


# ==========================================================================
# 4. Emoji
# ==========================================================================

# Même expression que les tests du dépôt (`src/admin/regles.spec.ts`,
# `src/application/pages.spec.ts`) : mes chiffres sont donc comparables aux
# leurs, et la définition de ce qu'est un emoji est celle du dépôt.
RE_EMOJI = re.compile(
    "["
    "\U0001F000-\U0001FAFF"
    "\u2190-\u21FF"
    "\u2600-\u27BF"
    "\u2B00-\u2BFF"
    "\uFE0F\u200D"
    "]")

# Sources d'INTERFACE du widget : ce que le visiteur voit.
SOURCES_EMOJI = {
    "widget (vues, composants, stores)": [DEPOT / "src" / "views",
                                          DEPOT / "src" / "components",
                                          DEPOT / "src" / "stores",
                                          DEPOT / "src" / "helpers",
                                          DEPOT / "src" / "data"],
    "console": [DEPOT / "src" / "admin"],
    "pages publiques": [DEPOT / "application", DEPOT / "src" / "application.css"],
    "coquilles HTML": [DEPOT / "index.html", DEPOT / "admin.html"],
    "manifestes": [DEPOT / "public" / "mia-manifest.webmanifest",
                   DEPOT / "public" / "admin-manifest.webmanifest"],
    "SDK (gele)": [DEPOT / "src" / "sdk"],
}

def lire_blob_git(chemin: Path, revision: str) -> str:
    """Contenu d'un fichier tel qu'il était à une révision donnée.

    Sert au « avant » de la mesure des emoji : la version réellement livrée,
    lue dans l'historique plutôt que recopiée à la main.
    """
    import subprocess

    relatif = chemin.relative_to(DEPOT).as_posix()
    resultat = subprocess.run(
        ["git", "show", f"{revision}:{relatif}"],
        cwd=DEPOT, capture_output=True, text=True, check=False)
    return resultat.stdout if resultat.returncode == 0 else ""


# Révision Git du « avant » de la correction des emoji : le commit qui a livré
# les chaînes d'interface porteuses d'un emoji. Écrite en clair plutôt que
# « HEAD~n » : un décalage de l'historique ne doit pas déplacer silencieusement
# le point de comparaison.
AVANT_EMOJI = "fcd9df0^"


# Une déclaration de palette de saisie : les emoji que l'UTILISATEUR insère dans
# SON message. Ce n'est pas une chaîne d'interface écrite par le produit.
RE_PALETTE = re.compile(r"const EMOJIS\s*=\s*\[")


def lignes_de_commentaire(texte: str) -> set[int]:
    """Numéros (base 0) des lignes situées DANS un commentaire.

    Lecture par RÉGIONS, ligne à ligne, comme le ferait un relecteur :

      · une région s'ouvre sur une ligne dont le contenu, une fois les espaces
        de tête retirés, commence par `<!--`, `/*` ou `*` ;
      · elle se ferme sur la ligne qui contient `-->` ou `*/`.

    Un détecteur de commentaires caractère par caractère a été essayé d'abord,
    et il s'est trompé : l'attribut `accept="image/*,.pdf,…"` du champ de
    pièce jointe ouvre un `/*` qui n'est pas un commentaire, et le détecteur
    avalait alors tout le fichier jusqu'au `*/` de la section de style. Résultat
    mesuré : la palette de saisie comptée comme du code, et 0 emoji de palette
    au lieu de 1. La lecture par régions ne peut pas faire cette erreur, parce
    qu'un `/*` au milieu d'une ligne n'ouvre rien.

    La règle appliquée est celle du dépôt (`src/admin/regles.spec.ts`) : une
    flèche typographique dans un commentaire n'est pas un emoji d'interface.
    """
    lignes = texte.splitlines()
    dans_commentaire: set[int] = set()
    ouvert = False
    for numero, ligne in enumerate(lignes):
        nue = ligne.strip()
        if ouvert:
            dans_commentaire.add(numero)
            if "-->" in nue or "*/" in nue:
                ouvert = False
            continue
        if nue.startswith(("<!--", "/*", "*")):
            dans_commentaire.add(numero)
            if not (nue.endswith("-->") or nue.endswith("*/")):
                ouvert = True
        elif nue.startswith("//"):
            dans_commentaire.add(numero)
    return dans_commentaire


# Révision Git du « avant » de la correction des emoji : le commit qui a livré
# les chaînes d'interface porteuses d'un emoji. Écrite en clair plutôt que
# « HEAD~n » : un décalage de l'historique ne doit pas déplacer silencieusement
# le point de comparaison.
AVANT_EMOJI = "fcd9df0^"


# Une déclaration de palette de saisie : les emoji que l'UTILISATEUR insère dans
# SON message. Ce n'est pas une chaîne d'interface écrite par le produit.
RE_PALETTE = re.compile(r"const EMOJIS\s*=\s*\[")


def sans_commentaires(texte: str) -> str:
    """Retire les commentaires en CONSERVANT les numéros de ligne.

    Le contenu d'un commentaire est remplacé par des espaces, les sauts de
    ligne sont gardés : la ligne 283 du fichier reste la ligne 283 du texte
    analysé. Sans cela, la classification « commentaire / interface » se
    trompe sur toute ligne de continuation d'un commentaire de plusieurs
    lignes — et c'est exactement l'erreur qu'a faite la première version de
    cette mesure, qui comptait 3 commentaires comme des chaînes d'interface.

    La règle appliquée est celle du dépôt (`src/admin/regles.spec.ts`) : une
    flèche typographique dans un commentaire n'est pas un emoji d'interface.
    """
    resultat = list(texte)
    i, n = 0, len(texte)
    while i < n:
        if texte.startswith("<!--", i):
            fin = texte.find("-->", i + 4)
            fin = n if fin == -1 else fin + 3
        elif texte.startswith("/*", i):
            fin = texte.find("*/", i + 2)
            fin = n if fin == -1 else fin + 2
        elif texte.startswith("//", i):
            fin = texte.find("\n", i)
            fin = n if fin == -1 else fin
        else:
            i += 1
            continue
        for j in range(i, fin):
            if resultat[j] != "\n":
                resultat[j] = " "
        i = fin
    return "".join(resultat)


def mesurer_emoji(avant: bool = False) -> dict:
    """Compte les emoji, par nature d'occurrence.

    Trois natures, trois décisions différentes :
      · `interface`   — une chaîne que le produit écrit (libellé, message,
                        état). Règle n°8 : zéro. C'est ce qui a été corrigé.
      · `commentaire` — du texte de code, jamais rendu. Hors du champ de la
                        règle, mesuré pour être complet.
      · `palette`     — les emoji que l'UTILISATEUR insère dans son message.
                        Ce n'est pas une chaîne du produit : décision au
                        propriétaire, signalée et non modifiée.
    """
    # Le « avant » se lit dans l'HISTORIQUE Git, pas dans une copie recopiée :
    # une copie finit par diverger, et un avant qui a divergé ne prouve rien.
    lire = (lambda chemin: lire_blob_git(chemin, AVANT_EMOJI)) if avant else (
        lambda chemin: chemin.read_text(encoding="utf-8", errors="replace"))

    resultat: dict[str, dict] = {}
    for etiquette, cibles in SOURCES_EMOJI.items():
        fichiers = []
        for cible in cibles:
            if cible.is_file():
                fichiers.append(cible)
            elif cible.is_dir():
                fichiers.extend(sorted(
                    f for f in cible.rglob("*")
                    if f.is_file() and f.suffix in {".ts", ".vue", ".html", ".json", ".css"}
                    and not f.name.endswith(".spec.ts")))
        occurrences = {"interface": [], "commentaire": [], "palette": []}
        for fichier in fichiers:
            texte = lire(fichier)
            # Deux lectures : le texte intégral (pour situer) et le texte sans
            # commentaires (pour classer). Les numéros de ligne coïncident.
            integral = texte.splitlines()
            commentaires = lignes_de_commentaire(texte)
            lignes = texte.splitlines()
            # Une palette de saisie est reconnue à sa déclaration : la ligne et
            # sa précédente (tableaux écrits sur deux lignes).
            lignes_palette = {
                numero for numero, ligne in enumerate(lignes) if RE_PALETTE.search(ligne)
            }
            lignes_palette |= {numero - 1 for numero in tuple(lignes_palette)}

            for numero, ligne in enumerate(integral):
                emojis = RE_EMOJI.findall(ligne)
                if not emojis:
                    continue
                if numero in lignes_palette:
                    nature = "palette"
                elif numero in commentaires:
                    nature = "commentaire"
                else:
                    nature = "interface"
                occurrences[nature].append({
                    "fichier": str(fichier.relative_to(DEPOT)),
                    "ligne": numero + 1,
                    "emoji": "".join(emojis),
                    "extrait": ligne.strip()[:100],
                })
        resultat[etiquette] = {
            "fichiers_lus": len(fichiers),
            "interface": len(occurrences["interface"]),
            "commentaire": len(occurrences["commentaire"]),
            "palette": len(occurrences["palette"]),
            "detail": occurrences,
        }
    total_interface = sum(bloc["interface"] for bloc in resultat.values())
    total_commentaire = sum(bloc["commentaire"] for bloc in resultat.values())
    total_palette = sum(bloc["palette"] for bloc in resultat.values())
    return {
        "reference": f"{AVANT_EMOJI} (avant la correction)" if avant else "arbre de travail",
        "expression": "mêmes plages que src/admin/regles.spec.ts",
        "par_perimetre": resultat,
        "total_interface": total_interface,
        "total_commentaire": total_commentaire,
        "total_palette": total_palette,
    }


# ==========================================================================
# 5. Ce que Mia écrit réellement
# ==========================================================================


def mesurer_mia(questions: list[str] | None = None) -> dict:
    """Échantillon de réponses RÉELLES de Mia, compté.

    Les consignes données au modèle ne sont pas modifiées : la présence d'un
    emoji dans une réponse relève de la personnalité de Mia, et le propriétaire
    a demandé que sa signature soit conservée. On mesure donc — combien de
    réponses sur l'échantillon en portent — au lieu d'en juger.
    """
    questions = questions or [
        "Bonjour, je vends des cosmétiques en ligne et je veux doubler mes commandes.",
        "Comment gagner en visibilité sans payer de publicité ?",
        "Est-ce que je peux automatiser la relance de mes clients ?",
        "Combien coûte un accompagnement ?",
        "Je veux un site qui convertit mieux, par où commencer ?",
        "Bonjour",
        "Merci beaucoup, c'est très clair.",
        "Je veux arrêter de perdre du temps sur les devis.",
        "Quels sont vos délais ?",
        "Pouvez-vous m'aider pour le référencement local ?",
    ]
    reponses = []
    for question in questions:
        # Le contrat du backend porte `text` et non `content` (voir
        # src/types/api.ts, interface BackendMessage) : une première version de
        # cette mesure envoyait `content` et recevait « Empty message » — un 400
        # qui ne dit pas quel champ manque. Le corps est donc celui que le
        # widget envoie réellement, relevé dans src/api/railway.ts.
        corps = json.dumps({
            "messages": [{"role": "user", "text": question}],
            "site_id": "eperformance_vitrine",
            "conversation_id": None,
            "user_id": None,
            "visitor_info": {"page_url": "https://eperformance.pro/",
                             "referrer": "https://eperformance.pro/"},
        }).encode("utf-8")
        requete = urllib.request.Request(
            f"{API_PRODUCTION}/api/chatbot/message",
            data=corps, headers={"Content-Type": "application/json"}, method="POST")
        resultat: dict | None = None
        for tentative in range(1, 5):
            try:
                with urllib.request.urlopen(requete, timeout=90) as reponse:
                    charge = json.loads(reponse.read().decode("utf-8"))
                texte = charge.get("text") or ""
                emojis = RE_EMOJI.findall(texte)
                resultat = {
                    "question": question,
                    "longueur": len(texte),
                    "emoji": "".join(emojis),
                    "nombre_emoji": len(emojis),
                    "extrait": texte[:200],
                }
                break
            except urllib.error.HTTPError as erreur:
                detail = erreur.read().decode("utf-8", "replace")[:160]
                if erreur.code == 429 and tentative < 4:
                    # Le backend limite le débit : on attend, puis on réessaie.
                    # Une réponse non obtenue n'est PAS comptée comme une réponse
                    # sans emoji — ce serait un biais dans le résultat.
                    time.sleep(20 * tentative)
                    continue
                resultat = {"question": question, "erreur": f"HTTP {erreur.code}",
                            "detail": detail}
                break
            except Exception as erreur:  # noqa: BLE001 — le réseau ne doit pas tuer la mesure
                resultat = {"question": question, "erreur": str(erreur)[:160]}
                break
        reponses.append(resultat or {"question": question, "erreur": "inconnue"})
        # Le backend limite le débit : on respire entre deux questions.
        time.sleep(12)
        print(f"  · {question[:50]:52s} emoji={reponses[-1].get('nombre_emoji')} "
              f"{reponses[-1].get('erreur', '')}", flush=True)
    valides = [r for r in reponses if "erreur" not in r]
    avec = [r for r in valides if r["nombre_emoji"]]
    return {
        "source": "API de production (POST /api/chatbot/message)",
        "consignes_du_modele": "non modifiées — décision au propriétaire",
        "echantillon": len(reponses),
        "reponses_obtenues": len(valides),
        "reponses_avec_emoji": len(avec),
        "ratio": round(len(avec) / len(valides), 3) if valides else None,
        "emoji_distincts": sorted({r["emoji"] for r in avec}),
        "detail": reponses,
    }


# ==========================================================================
# Entrée
# ==========================================================================


def ecrire(nom: str, donnees: dict) -> Path:
    chemin = DOSSIER / f"mesures-{nom}.json"
    chemin.write_text(json.dumps(donnees, ensure_ascii=False, indent=2) + "\n",
                      encoding="utf-8")
    return chemin


def main() -> int:
    quoi = sys.argv[1] if len(sys.argv) > 1 else "tout"

    if quoi in ("tout", "jetons"):
        m = mesurer_jetons()
        ecrire("jetons", m)
        print("Jetons — périmètres :")
        for nom, bloc in m.items():
            if nom.startswith("_"):
                continue
            print(f"  {nom:18s} {bloc['declares_clair']:3d} clair / "
                  f"{bloc['declares_sombre']:3d} sombre · {bloc['consommes']:3d} consommés · "
                  f"empreinte clair {bloc['empreinte_clair'][:12]}")
        a = m["_comparaison_par_nom"]
        print(f"  comparaison par nom : {a['jetons_compares']} jetons comparés, "
              f"{a['nombre_divergences']} divergence(s)")
        for d in a["divergences"]:
            print(f"    - {d['theme']} {d['jeton']} : {d['valeurs_canoniques']}")
            if d.get("justification"):
                print(f"        justifié : {d['justification'][:80]}…")
        b = m["_comparaison_noyau"]
        print(f"  comparaison noyau et site : {b['paires_verifiees']} paires vérifiées sur "
              f"{b['correspondances']} correspondances, {b['nombre_divergences']} divergence(s)")
        for d in b["divergences"]:
            print(f"    - {d['theme']} {d['jeton_site']} = {d['valeur_site']} "
                  f"({d['canonique_site']}) ≠ noyau {d['jeton_noyau']} = "
                  f"{d['valeur_noyau']} ({d['canonique_noyau']})")
        print("  vérification de la divergence d'accent (calcul, pas confiance) :")
        for v in m["_verification_accent"]:
            print(f"    {v['theme']:7s} {v['perimetre']:6s} {v['accent']} sur "
                  f"{v['fond']} = {v['ratio']}:1 "
                  f"({'conforme' if v['conforme'] else 'SOUS LE SEUIL AA'})")

    if quoi in ("tout", "polices"):
        m = mesurer_polices()
        ecrire("polices", m)
        print("\nPolices — déclarations par périmètre :")
        for nom, bloc in m["perimetres"].items():
            if bloc["declarations"]:
                print(f"  {nom:18s} {bloc['declarations']:2d} déclarations · "
                      f"familles {bloc['familles']} · empreinte {bloc['empreinte'][:12]}")
        for nom, bloc in m["fichiers_auto_heberges"].items():
            print(f"  fichiers {nom:8s} : {bloc['nombre']} .woff2")
        print(f"  références à une fonderie distante : {m['nombre_references_distantes']}")
        for reference in m["references_fonderie_distante"][:5]:
            print(f"    - {reference}")

    if quoi in ("tout", "echelles"):
        m = mesurer_echelles()
        ecrire("echelles", m)
        c = m["couleurs_litterales"]
        print("\nÉchelles et couleurs :")
        print(f"  couleurs littérales (interface) : {c['interface_total_hex']} hex, "
              f"{c['interface_total_rgb']} rgb")
        for nom, bloc in c["par_perimetre"].items():
            print(f"    {nom:18s} hex={bloc['hex']:3d} rgb={bloc['rgb']:3d}")
        e = m["espacements"]
        print(f"  espacements : {e['nombre_crans_noyau']} crans au noyau, "
              f"{e['nombre_crans_site']} au site")

    if quoi in ("tout", "emoji"):
        avant = mesurer_emoji(avant=True)
        apres = mesurer_emoji(avant=False)
        ecrire("emoji", {"avant": avant, "apres": apres,
                         "correction": {
                             "interface": avant["total_interface"] - apres["total_interface"],
                             "commentaire": avant["total_commentaire"] - apres["total_commentaire"],
                             "palette": avant["total_palette"] - apres["total_palette"],
                         }})
        print("\nEmoji — chaînes d'interface du produit :")
        for nom in avant["par_perimetre"]:
            a, b = avant["par_perimetre"][nom], apres["par_perimetre"][nom]
            if a["interface"] or b["interface"] or a["palette"] or b["palette"]:
                print(f"  {nom:34s} interface {a['interface']} vers {b['interface']} · "
                      f"palette {a['palette']} vers {b['palette']}")
        print(f"  TOTAL interface {avant['total_interface']} vers "
              f"{apres['total_interface']} "
              f"(corrigés : {avant['total_interface'] - apres['total_interface']})")
        print(f"  TOTAL commentaire {avant['total_commentaire']} vers "
              f"{apres['total_commentaire']} (hors interface)")
        print(f"  TOTAL palette de saisie {avant['total_palette']} vers "
              f"{apres['total_palette']} (décision au propriétaire)")

    if quoi in ("tout", "mia"):
        print("\nCe que Mia écrit réellement (API de production) :")
        m = mesurer_mia()
        ecrire("mia", m)
        print(f"  {m['reponses_avec_emoji']} réponses avec emoji sur "
              f"{m['reponses_obtenues']} obtenues (ratio {m['ratio']})")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
