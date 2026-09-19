#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Preuve D7d — « le rendu ne change pas d'un pixel ».

Le renommage du vocabulaire de `admin.css` (le conteneur à 12 px n'est plus une
« carte » mais un « bloc dense ») change des NOMS, pas des VALEURS. Il faut le
prouver, et pas l'affirmer.

POURQUOI PAS UNE COMPARAISON DE CAPTURES SEULE
----------------------------------------------
Elle a été essayée d'abord, et elle ne prouve rien ici. Deux exécutions du MÊME
build, sur la même machine, divergent de 1 à 5 niveaux sur 2 à 41 pixels par
image (lissage des icônes SVG). Le bruit est du même ordre que ce qu'un
renommage raté produirait sur une bordure — la mesure ne distingue pas le
signal du bruit. Ni `--deterministic-mode` (qui bloque la capture Playwright),
ni le profil de couleur, ni la désactivation du GPU ne le font taire.

Le rendu est pourtant entièrement déterminé par trois choses : le DOM, la
cascade CSS et le moteur. C'est donc le DOM qu'on mesure, et on le mesure
EXHAUSTIVEMENT :

  · tous les éléments de la page (`querySelectorAll('*')`) ;
  · pour chacun, TOUTES les propriétés calculées (`getComputedStyle`) ;
  · pour chacun, sa géométrie à 0,01 px près (`getBoundingClientRect`).

Deux empreintes égales disent que chaque élément reçoit exactement les mêmes
valeurs calculées qu'avant le renommage : même cascade, donc même rendu — pour
la page entière, pas pour cinq rôles échantillonnés.

Les noms de classe sont NORMALISÉS avant empreinte (`adm-bloc` → `adm-carte`) :
c'est justement ce qui doit changer, et une empreinte qui le contiendrait
échouerait par construction.

Les captures restent produites, à côté : elles servent à VOIR, pas à prouver.
Leur bruit de fond est mesuré et publié dans le rapport.

Le serveur, le jeu d'essai de l'API et le jeton viennent du harnais de 6.9.

    python3 preuve-d7d.py avant
    python3 preuve-d7d.py apres
    python3 preuve-d7d.py comparer avant apres
"""

from __future__ import annotations

import hashlib
import importlib.util
import json
import re
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright
from PIL import Image, ImageChops

DOSSIER = Path(__file__).resolve().parent
DEPOT = DOSSIER.parents[1]
HARNAIS_69 = DEPOT / "docs" / "phase3-tache-6-9" / "composants.py"

_spec = importlib.util.spec_from_file_location("composants_69", HARNAIS_69)
harnais = importlib.util.module_from_spec(_spec)
assert _spec.loader is not None
_spec.loader.exec_module(harnais)

# Les onze modules, dans l'ordre de la navigation.
MODULES = [
    "tableau-de-bord", "activite", "performance", "conversations", "prospects",
    "candidatures", "connaissances", "publications", "competences",
    "utilisateurs", "integrations",
]
THEMES = ("light", "dark")
VUE = {"width": 1440, "height": 900}

# Le renommage à prouver. Il sert dans les DEUX sens : à l'écriture des
# sélecteurs, et à la normalisation qui rend les deux états comparables.
AVANT, APRES = "adm-carte", "adm-bloc"

MESURE_DOM = r"""([ancien, nouveau]) => {
  // Normalisation SYMÉTRIQUE : les deux écritures tombent sur le même mot
  // neutre, si bien que les deux états sont comparables sans que le script ait
  // à savoir lequel il est en train de mesurer. Un sens unique qui prendrait
  // le nom de l'état pour argent comptant échouerait le jour où on l'appelle
  // sur l'autre.
  const NEUTRE = 'adm-BLOC-DENSE'
  const normaliser = (t) => t.split(ancien).join(NEUTRE).split(nouveau).join(NEUTRE)
  const morceaux = []
  for (const el of document.querySelectorAll('*')) {
    const s = getComputedStyle(el)
    const r = el.getBoundingClientRect()
    // Les propriétés personnalisées (`--…`) sont énumérées dans un ordre qui
    // n'est PAS stable d'un chargement à l'autre : sans tri, l'empreinte
    // changeait à chaque exécution alors que rien n'avait bougé. On trie par
    // nom — ce sont les couples (nom, valeur) qui comptent, pas leur ordre.
    const paires = []
    for (let i = 0; i < s.length; i++) paires.push(s[i] + ':' + s.getPropertyValue(s[i]))
    paires.sort()
    const boite = [r.x, r.y, r.width, r.height].map((v) => Math.round(v * 100)).join(',')
    // `el.className` est un SVGAnimatedString sur les éléments SVG : on lit
    // l'attribut, qui est une chaîne partout.
    const classes = el.getAttribute('class') || ''
    morceaux.push(el.tagName + '[' + normaliser(classes) + ']' + boite + '|' + paires.join(';'))
  }
  return morceaux.join('\n')
}"""


# Attendre « assez longtemps » ne suffit pas : à 900 ms, une vue sur trois
# n'avait pas fini de se poser et l'empreinte changeait d'une exécution à
# l'autre (un pixel de largeur, une fois sur huit). On attend donc un ÉTAT, pas
# une durée : la géométrie et le nombre d'éléments doivent être identiques
# quatre mesures de suite. C'est ce qui a fait tomber le bruit à zéro.
ATTENDRE_STABILITE = r"""() => new Promise((resolve) => {
  let precedent = null
  let stables = 0
  const tic = () => {
    const etat = document.querySelectorAll('*').length + '/' +
      document.documentElement.scrollHeight + '/' +
      document.querySelector('.adm-contenu')?.scrollHeight
    if (etat === precedent) {
      if (++stables >= 4) return resolve(etat)
    } else {
      stables = 0
      precedent = etat
    }
    setTimeout(tic, 120)
  }
  tic()
})"""


def capturer(nom: str) -> Path:
    """Capture les onze modules × deux thèmes, et EMPREINTE ce qui est mesuré.

    Les empreintes brutes ne sont PAS versionnées : chaque relevé pèse environ
    3 Mo de propriétés calculées, et 22 relevés par état n'ont rien à faire
    dans un dépôt public. Ce qui est versionné, c'est ce qui prouve — le
    SHA-256 de chaque relevé, le nombre d'éléments, et les captures.
    """
    sortie = DOSSIER / f"preuve-d7d-{nom}"
    sortie.mkdir(parents=True, exist_ok=True)
    bruts = DOSSIER / ".releves" / nom
    bruts.mkdir(parents=True, exist_ok=True)
    empreintes: dict[str, dict] = {}
    serveur = harnais.demarrer_serveur()
    try:
        with sync_playwright() as p:
            navigateur = p.chromium.launch()
            for theme in THEMES:
                with navigateur.new_context(viewport=VUE, locale="fr-FR",
                                            color_scheme=theme) as ctx:
                    ctx.add_init_script(
                        "\n".join([
                            "try {",
                            f"  window.localStorage.setItem('eperf-theme', '{theme}');",
                            f"  window.localStorage.setItem('eperf_admin_token', '{harnais.JETON}');",
                            "} catch (e) {}",
                        ]))
                    for module in MODULES:
                        page = ctx.new_page()
                        harnais.installer_api(page)
                        page.goto(f"{harnais.BASE}/dist/admin.html#/{module}",
                                  wait_until="load")
                        try:
                            page.wait_for_selector(".adm-contenu", timeout=25_000)
                            page.wait_for_function(ATTENDRE_STABILITE, timeout=15_000)
                            page.wait_for_timeout(300)
                        except Exception:  # noqa: BLE001
                            print(f"  ! {theme}/{module} : contenu non monté")
                        # Les deux écritures sont ramenées au même mot neutre
                        # avant empreinte : les deux états sont donc comparables
                        # sans que le script ait à savoir lequel il mesure.
                        dom = page.evaluate(MESURE_DOM, [AVANT, APRES])
                        cle = f"{theme}-{module}"
                        (bruts / f"{cle}.dom.txt").write_text(dom, encoding="utf-8")
                        empreintes[cle] = {
                            "sha256": hashlib.sha256(dom.encode("utf-8")).hexdigest(),
                            "elements": len(dom.splitlines()),
                        }
                        page.screenshot(path=str(sortie / f"{cle}.png"))
                        print(f"  · {theme:5s} {module:18s} "
                              f"{empreintes[cle]['elements']:5d} éléments  "
                              f"dom {empreintes[cle]['sha256'][:12]}")
                        page.close()
            navigateur.close()
    finally:
        serveur.shutdown()
        try:
            serveur.server_close()
        except OSError:
            pass
    (DOSSIER / f"preuve-d7d-{nom}-empreintes.json").write_text(
        json.dumps({"etat": nom, "modules": MODULES, "themes": list(THEMES),
                    "normalisation": [AVANT, APRES], "vues": empreintes},
                   ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return sortie


def empreintes(nom: str) -> dict[str, dict]:
    """Les empreintes versionnées d'un état."""
    chemin = DOSSIER / f"preuve-d7d-{nom}-empreintes.json"
    return json.loads(chemin.read_text(encoding="utf-8"))["vues"]


def comparer_pixels(a: Path, b: Path) -> list[dict]:
    details: list[dict] = []
    for nom in sorted(f.name for f in a.glob("*.png")):
        if not (b / nom).is_file():
            continue
        if (a / nom).read_bytes() == (b / nom).read_bytes():
            details.append({"capture": nom, "identique_a_l_octet": True})
            continue
        im_a = Image.open(a / nom).convert("RGB")
        im_b = Image.open(b / nom).convert("RGB")
        if im_a.size != im_b.size:
            details.append({"capture": nom, "taille": [im_a.size, im_b.size]})
            continue
        ecart = ImageChops.difference(im_a, im_b)
        pixels = [(x, y, ecart.getpixel((x, y)))
                  for y in range(im_a.size[1]) for x in range(im_a.size[0])
                  if ecart.getpixel((x, y)) != (0, 0, 0)]
        details.append({
            "capture": nom, "identique_a_l_octet": False,
            "pixels_differents": len(pixels),
            "pixels_total": im_a.size[0] * im_a.size[1],
            "delta_max_sur_255": max((max(d) for _, _, d in pixels), default=0),
            "zone": ecart.getbbox(),
        })
    return details


def comparer(gauche: str, droite: str) -> int:
    a = DOSSIER / f"preuve-d7d-{gauche}"
    b = DOSSIER / f"preuve-d7d-{droite}"
    ea, eb = empreintes(gauche), empreintes(droite)

    print(f"Preuve D7d — « {gauche} » contre « {droite} », classe normalisée "
          f"({AVANT} et {APRES} ramenés au même mot neutre)\n")

    noms = sorted(set(ea) | set(eb))
    dom_identiques = [n for n in noms if ea.get(n, {}).get("sha256") == eb.get(n, {}).get("sha256")]
    dom_differentes = [n for n in noms if n not in dom_identiques]

    print("  CASCADE — empreinte du DOM complet : tous les éléments, toutes les")
    print("  propriétés calculées, la géométrie de chacun :")
    print(f"    {len(dom_identiques)} vue(s) identique(s) sur {len(noms)}")
    for nom in dom_differentes:
        print(f"    DIFFÉRENT  {nom}")

    px = comparer_pixels(a, b)
    octet = sum(1 for d in px if d.get("identique_a_l_octet"))
    bouges = [d for d in px if not d.get("identique_a_l_octet")]
    print("\n  CAPTURES — planche visuelle (instrument de contrôle, pas de preuve) :")
    print(f"    {octet} capture(s) identique(s) à l'octet sur {len(px)}")
    if bouges:
        pire = max(d.get("delta_max_sur_255", 0) for d in bouges)
        total = sum(d.get("pixels_differents", 0) for d in bouges)
        print(f"    {len(bouges)} capture(s) au bruit de lissage : {total} pixels sur "
              f"{sum(d.get('pixels_total', 0) for d in bouges)}, delta maximal {pire}/255")

    rapport = {
        "gauche": gauche, "droite": droite, "renommage": [AVANT, APRES],
        "cascade_identiques": dom_identiques, "cascade_differentes": dom_differentes,
        "captures": px, "captures_identiques_a_l_octet": octet,
    }
    (DOSSIER / f"preuve-d7d-{gauche}-{droite}.json").write_text(
        json.dumps(rapport, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return 0 if not dom_differentes else 1


def comparer_css() -> int:
    """Preuve complémentaire : les artefacts COMPILÉS, à l'octet.

    Le build d'avant est celui que la tâche 6.9 a archivé (`dist-avant`) : le
    refabriquer depuis une copie du dépôt donnerait un « avant » qui n'est pas
    celui qui a été mesuré.

    Deux écritures sont neutralisées avant comparaison, et une seule est un
    effet du renommage :

      · `adm-bloc` → `adm-carte`, la substitution inverse de D7d ;
      · `data-v-…` → `data-v-MASQUE`, la portée des styles Vue. Le nom de cette
        portée dérive du contenu du fichier `.vue` : renommer la classe a donc
        changé le nom de portée de `Sidebar.vue`. Un sélecteur d'attribut de
        portée ne porte aucune propriété — l'empreinte DOM de la cascade le
        prouve séparément (22/22) — et le build est par ailleurs reproductible :
        deux compilations de la même source donnent le même fichier.
    """
    avant = DEPOT / "docs" / "phase3-tache-6-9" / "dist-avant" / "assets"
    apres = DEPOT / "dist" / "assets"
    resultat: dict[str, dict] = {}
    print("Preuve D7d — artefacts compilés, à l'octet\n")
    for motif in ("admin-*.css", "style-*.css", "commun-*.css"):
        fichiers = sorted(apres.glob(motif))
        if not fichiers:
            continue
        apres_fichier = fichiers[0]
        # Le build d'avant porte le même nom de fichier à hachage près : on le
        # retrouve par son préfixe.
        prefixe = apres_fichier.name.split("-")[0]
        avant_fichier = next(iter(sorted(avant.glob(f"{prefixe}-*.css"))), None)
        if avant_fichier is None:
            continue
        texte_avant = avant_fichier.read_text()
        texte_apres = apres_fichier.read_text()
        inverse = texte_apres.replace(APRES, AVANT)
        masque = lambda t: re.sub(r"data-v-[0-9a-f]+", "data-v-MASQUE", t)  # noqa: E731
        identique = masque(texte_avant) == masque(inverse)
        resultat[prefixe] = {
            "avant": avant_fichier.name, "apres": apres_fichier.name,
            "occurrences_avant": texte_avant.count(AVANT),
            "occurrences_apres": texte_apres.count(AVANT),
            "occurrences_nouveau": texte_apres.count(APRES),
            "identique_a_l_octet_modulo_renommage": identique,
        }
        print(f"  {avant_fichier.name} → {apres_fichier.name}")
        print(f"    « {AVANT} » : {texte_avant.count(AVANT)} avant, "
              f"{texte_apres.count(AVANT)} après ; "
              f"« {APRES} » après : {texte_apres.count(APRES)}")
        print(f"    identique à l'octet modulo renommage : {identique}\n")

    # Les gabarits compilés : aucune trace de l'ancien nom ne doit subsister.
    js = sorted(apres.glob("admin-*.js"))
    if js:
        contenu = js[0].read_text()
        resultat["gabarits_compiles"] = {
            "fichier": js[0].name, "occurrences_avant": contenu.count(AVANT),
            "occurrences_nouveau": contenu.count(APRES),
        }
        print(f"  {js[0].name} : « {AVANT} » = {contenu.count(AVANT)}, "
              f"« {APRES} » = {contenu.count(APRES)}")

    (DOSSIER / "preuve-d7d-gerbes.json").write_text(
        json.dumps(resultat, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return 0 if all(v.get("identique_a_l_octet_modulo_renommage", True)
                    for v in resultat.values()) else 1


def main() -> int:
    if len(sys.argv) >= 2 and sys.argv[1] == "comparer":
        return comparer(sys.argv[2], sys.argv[3])
    if len(sys.argv) >= 2 and sys.argv[1] == "css":
        return comparer_css()
    nom = sys.argv[1] if len(sys.argv) > 1 else "avant"
    print(f"Empreinte DOM des onze modules de la console — état « {nom} »")
    sortie = capturer(nom)
    print(f"\n  écrit dans {sortie.relative_to(DEPOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
