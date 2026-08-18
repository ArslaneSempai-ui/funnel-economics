/**
 * Build the hosted demo.
 *
 * The model is arithmetic on a seeded draw — no database, no network — so the whole thing
 * compiles to ES modules and runs in the visitor's browser. Every control works, including
 * the one that matters: change what a fix costs and watch the priority order invert while
 * the funnel table above it does not move.
 *
 * That is the finding, and it is the difference between reading a claim and testing it.
 *
 * `src/ui.html` stays the single source; the only difference on the hosted side is a
 * `window.LOCAL` shim answering the same routes with the same shapes.
 */

import { readFileSync, writeFileSync, mkdirSync, cpSync, existsSync } from "node:fs";
import { isMain } from "./cli.ts";

const root = new URL("..", import.meta.url).pathname;

const SHIM = `<script type="module">
import { generate, SCENARIO } from "./js/population.js";
import { measure, worstStep, endToEnd } from "./js/funnel.js";
import { priceAll, LEVERS, SCENARIOS } from "./js/value.js";
import { ASSUMPTIONS, BOUNDS } from "./js/assumptions.js";

const users = generate();
let assumptions = { ...ASSUMPTIONS };
let levers = structuredClone(LEVERS);
let scenario = "depart";

const LEVER_BOUNDS = { cost: [1000, 5000000], ceiling: [0.001, 0.40] };

const etat = () => {
  const rates = measure(users);
  const priced = priceAll(SCENARIO, assumptions, levers);
  return {
    rates,
    endToEnd: endToEnd(users),
    worst: worstStep(rates),
    priced: priced.map((p, i) => ({ ...p, valeurRang: i + 1 })),
    /*
     * Trois champs que ce shim ne renvoyait pas.
     *
     * Sans eux, l'écran publié rendait une section entièrement vide — celle qui porte la
     * trouvaille de l'outil, et que la bannière invite le lecteur à manipuler. Le serveur
     * local les fournissait, la démo non, et rien ne comparait les deux : c'est exactement
     * la dérive que ce fichier est censé rendre impossible, arrivée dans le fichier
     * lui-même.
     */
    ordreDepart: priceAll(SCENARIO, assumptions, LEVERS).map((p) => p.step),
    scenarios: SCENARIOS.map((s2) => ({ id: s2.id, actif: s2.id === scenario })),
    classements: SCENARIOS.map((s2) => ({
      id: s2.id,
      rangs: priceAll(SCENARIO, assumptions, { ...LEVERS, ...s2.levers })
        .map((p, i) => ({ etape: p.step, rang: i + 1, parDollar: p.perDollar })),
    })),
    levers, assumptions, bounds: BOUNDS,
  };
};

window.LOCAL = async (chemin, corps) => {
  if (chemin === "/api/etat") return etat();

  if (chemin === "/api/hypotheses") {
    if (corps.remise) assumptions = { ...ASSUMPTIONS };
    else for (const [cle, [min, max]] of Object.entries(BOUNDS)) {
      const v = corps[cle];
      if (typeof v === "number" && Number.isFinite(v)) {
        assumptions = { ...assumptions, [cle]: Math.min(max, Math.max(min, v)) };
      }
    }
    return etat();
  }

  if (chemin === "/api/leviers") {
    if (corps.remise) { levers = structuredClone(LEVERS); scenario = "depart"; }
    else if (typeof corps.scenario === "string") {
      const sc = SCENARIOS.find((x) => x.id === corps.scenario);
      if (sc) { levers = { ...structuredClone(LEVERS), ...structuredClone(sc.levers) }; scenario = sc.id; }
    }
    else {
      const { step, champ, valeur } = corps;
      if (levers[step] && (champ === "cost" || champ === "ceiling") && Number.isFinite(valeur)) {
        const [min, max] = LEVER_BOUNDS[champ];
        levers = { ...levers, [step]: { ...levers[step], [champ]: Math.min(max, Math.max(min, valeur)) } };
      }
    }
    return etat();
  }
  return {};
};
` + "</" + "script>\n";

const BANNER = `<p class="renvoi" style="margin-bottom:1.5rem">
This runs entirely in your browser — no server, nothing leaves your machine. The funnel is
<b>synthetic and seeded</b>. <b>Change what a fix costs, under "the ranking is not in the
funnel", and watch the priority order invert</b> while the table above it does not move a
pixel. <a href="https://github.com/ArslaneSempai-ui/funnel-economics">Source and method</a>.
</p>`;

export function build(): void {
  const docs = root + "docs";
  mkdirSync(docs, { recursive: true });

  let html = readFileSync(root + "src/ui.html", "utf8");
  html = html.replace('href="/registre.css"', 'href="registre.css"');
  html = html.replace('from "/graphes.js"', 'from "./graphes.js"');

  /* Under the title, not above it: a note about how the demo works, placed before the page
   * has said what it is, reads as a cookie notice and gets skipped exactly like one. */
  const header = html.indexOf('class="haut"');
  const closes = html.indexOf("\n  </div>", header) + "\n  </div>".length;
  html = html.slice(0, closes) + "\n" + BANNER + html.slice(closes);
  html = html.replace('<script type="module">', SHIM + '<script type="module">');
  writeFileSync(docs + "/index.html", html);

  cpSync(root + "src/registre.css", docs + "/registre.css");
  cpSync(root + "src/graphes.js", docs + "/graphes.js");
  if (existsSync(root + "images")) cpSync(root + "images", docs + "/images", { recursive: true });
  writeFileSync(docs + "/.nojekyll", "");

  console.log("docs/ built");
}

if (isMain(import.meta)) build();
