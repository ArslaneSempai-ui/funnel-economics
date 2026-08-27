/**
 * LES PORTES PAR OÙ UN CHIFFRE ENTRE — LES DEUX, PAS UNE.
 *
 * Un chiffre saisi sur cet écran traverse deux implémentations distinctes : `src/server.ts`
 * quand la page est servie en local, et le shim `window.LOCAL` de `docs/index.html` quand
 * elle est visitée en ligne. Ce sont deux corps de code séparés qui prétendent au même
 * comportement, et rien ne les tient ensemble automatiquement.
 *
 * D'où ce fichier. Deux défauts mesurés le 27 août 2026 vivaient chacun d'un seul côté :
 *
 *   1. `lire()` convertissait AVANT toute garde. `Number("")` vaut `0`, pas `NaN` : vider un
 *      champ envoyait un zéro fini que les deux portes acceptaient, puis bornaient. Mesuré
 *      en direct : le coût de `signup` passait de 40 000 $ à 1 000 $, et le revenu annuel par
 *      client de 1 200 $ à 50 $ — sans un mot, alors que le classement publié est une
 *      fonction des deux. La garde ne pouvait pas vivre en aval : aucune des deux portes ne
 *      distingue ce zéro-là d'un zéro tapé. Elle vit là où le vide est encore visible.
 *
 *   2. Le serveur remet le scénario actif à vide dès qu'un levier est réglé à la main ; le
 *      shim l'oubliait. La pastille « pageEpuisee » restait donc allumée sur la page publiée
 *      pendant qu'on montait son coût — un état que le serveur local ne peut pas produire,
 *      donc que personne ne voyait en développement.
 *
 * Le shim est EXÉCUTÉ ici, pas relu. Un contrôle qui cherche une chaîne dans le fichier
 * publié dit que le texte est là ; il ne dit pas que la page se comporte comme la source.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const racine = fileURLToPath(new URL("..", import.meta.url));
const PUBLIEE = racine + "docs/index.html";
const SOURCE = racine + "src/ui.html";

/**
 * `lire()` sorti du fichier et rendu appelable.
 *
 * Le motif est une AFFIRMATION sur la forme du fichier : s'il ne trouve plus rien, ce test
 * passerait en silence sur zéro cas. Il tombe à la place, en disant que c'est le motif qui
 * est périmé et non le code qui est sain.
 */
function lireDe(chemin: string): (v: unknown) => number {
  const source = readFileSync(chemin, "utf8");
  const m = /const lire = \(v\) => \{\n([\s\S]*?)\n\};/.exec(source);
  assert.ok(m, `${chemin} : la lecture des champs n'a pas été trouvée. Le motif est périmé — `
    + `et un motif périmé rend vert sans avoir rien regardé, ce qui est pire que rouge.`);
  return new Function("v", m![1]!) as (v: unknown) => number;
}

test("un champ vide n'entre pas comme un zéro — sur les deux portes", () => {
  const portes: [string, string][] = [["la source", SOURCE], ["la page publiée", PUBLIEE]];

  for (const [quoi, chemin] of portes) {
    const lire = lireDe(chemin);

    /* Le témoin positif d'abord : une garde qui refuse tout refuserait aussi ces deux-là. */
    assert.equal(lire("40000"), 40_000, `${quoi} : un nombre tapé normalement doit passer`);
    assert.equal(lire("2,4"), 2.4, `${quoi} : la virgule décimale doit rester acceptée`);
    assert.equal(lire("2 400"), 2_400, `${quoi} : l'espace des milliers doit rester accepté`);

    /* Ce que le zéro silencieux valait : la borne basse, appliquée sans un mot. */
    for (const vide of ["", "   ", "\t", null, undefined]) {
      assert.equal(Number.isFinite(lire(vide)), false,
        `${quoi} : ${JSON.stringify(vide)} est arrivé comme un nombre fini — les gardes en `
        + `aval ne peuvent pas le distinguer d'un zéro tapé, et il sera borné puis publié`);
    }
  }

  /*
   * ET LES DEUX PORTES DOIVENT PORTER LA MÊME LECTURE.
   *
   * Le correctif de sécurité qui n'atteint qu'un des deux fichiers est le mode d'échec de
   * cette famille : arbre propre, suite verte, et les visiteurs exécutent l'ancienne version.
   */
  const extrait = (c: string) => /const lire = \(v\) => \{\n([\s\S]*?)\n\};/.exec(readFileSync(c, "utf8"))![1];
  assert.equal(extrait(PUBLIEE), extrait(SOURCE),
    "la page publiée et sa source ne lisent pas les champs pareil — `npm run pages` n'a pas "
    + "été relancé, et ce que les visiteurs exécutent n'est pas ce qui a été corrigé");
});

/** Le shim de la page publiée, rendu importable : ses imports pointent sur `docs/js/`. */
async function shimPublie(): Promise<{ LOCAL: (c: string, corps?: unknown) => Promise<any> }> {
  const html = readFileSync(PUBLIEE, "utf8");
  const m = /<script type="module">\n(import[\s\S]*?window\.LOCAL_POSE[\s\S]*?)\n<\/script>/.exec(html);
  assert.ok(m, "le shim n'a pas été trouvé dans la page publiée — motif périmé, ou démo cassée");

  const code = m![1]!.replace(/from "\.\/js\//g, `from "${racine}docs/js/`);
  const dossier = mkdtempSync(join(tmpdir(), "funnel-shim-"));
  const fichier = join(dossier, "shim.mjs");
  writeFileSync(fichier, `const window = globalThis;\n${code}\nexport const LOCAL = window.LOCAL;\n`);
  return await import(fichier) as { LOCAL: (c: string, corps?: unknown) => Promise<any> };
}

test("la page publiée refuse ce que le serveur local refuse, et oublie le scénario comme lui", async () => {
  const { LOCAL } = await shimPublie();

  const depart = await LOCAL("/api/etat");
  const coutDepart = depart.levers.signup.cost;
  assert.ok(coutDepart > 0, "le shim ne rend pas d'état exploitable — rien à conclure de la suite");

  /* Un champ vidé arrive ici en `NaN` : il ne doit pas bouger le coût. */
  const apres = await LOCAL("/api/leviers", { step: "signup", champ: "cost", valeur: NaN });
  assert.equal(apres.levers.signup.cost, coutDepart,
    "un champ vide a modifié un levier sur la page publiée — c'est le classement affiché "
    + "au visiteur qui change, et rien à l'écran ne le dit");

  /* Puis la parité de scénario : régler un levier à la main éteint la pastille. */
  const nomme = await LOCAL("/api/leviers", { scenario: "pageEpuisee" });
  assert.equal(nomme.scenarios.find((s: any) => s.id === "pageEpuisee")?.actif, true,
    "le scénario nommé ne s'active pas — le cas suivant ne prouverait rien");

  const manuel = await LOCAL("/api/leviers", { step: "signup", champ: "cost", valeur: 500_000 });
  assert.equal(manuel.scenarios.some((s: any) => s.actif), false,
    "un levier réglé à la main laisse une pastille de scénario allumée sur la page publiée : "
    + "elle annonce des leviers qui ne sont plus les siens. Le serveur local, lui, l'éteint.");
});
