/**
 * The screen, served locally.
 *
 * Everything the page needs is arithmetic on a seeded draw, so the state lives in memory:
 * this is a calculator, not a ledger. Each visitor to the hosted build gets their own copy
 * for the same reason.
 */

import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFileSync } from "node:fs";
import { generate, SCENARIO } from "./population.ts";
import { measure, worstStep, endToEnd } from "./funnel.ts";
import { priceAll, LEVERS, SCENARIOS } from "./value.ts";
import { ASSUMPTIONS, BOUNDS } from "./assumptions.ts";
import { isMain } from "./cli.ts";
import type { Assumptions } from "./assumptions.ts";
import type { Improvable, Levers } from "./value.ts";

const PORT = Number(process.env.PORT ?? 4800);

let assumptions: Assumptions = { ...ASSUMPTIONS };
let levers: Levers = structuredClone(LEVERS);
let scenario = "depart";

const users = generate();

function json(res: ServerResponse, corps: unknown, code = 200): void {
  const load = JSON.stringify(corps);
  res.writeHead(code, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(load),
  });
  res.end(load);
}

function corps(req: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resoudre, rejeter) => {
    let brut = "";
    req.on("data", (b) => { brut += b; if (brut.length > 50_000) rejeter(new Error("request too large")); });
    req.on("end", () => { try { resoudre(brut ? JSON.parse(brut) : {}); } catch (e) { rejeter(e); } });
    req.on("error", rejeter);
  });
}

/** Sanity bounds on the levers: a fix that costs nothing and buys everything is not a lever. */
const LEVER_BOUNDS = { cost: [1_000, 5_000_000], ceiling: [0.001, 0.40] } as const;

export function etat() {
  const rates = measure(users);
  const priced = priceAll(SCENARIO, assumptions, levers);
  return {
    rates,
    endToEnd: endToEnd(users),
    worst: worstStep(rates),
    priced: priced.map((p, i) => ({ ...p, valeurRang: i + 1 })),
    /* The order under the starting levers, so the screen can show the change rather than
     * asking the reader to have memorised the previous state. */
    ordreDepart: priceAll(SCENARIO, assumptions, LEVERS).map((p) => p.step),
    scenarios: SCENARIOS.map((s2) => ({ id: s2.id, actif: s2.id === scenario })),
    levers,
    assumptions,
    bounds: BOUNDS,
  };
}

const serveur = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);
  try {
    if (url.pathname === "/") {
      const html = readFileSync(new URL("./ui.html", import.meta.url).pathname, "utf8");
      // The file changes during development: never serve a stale copy.
      res.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
      res.end(html);
      return;
    }

    if (url.pathname === "/graphes.js") {
      const js = readFileSync(new URL("./graphes.js", import.meta.url).pathname, "utf8");
      res.writeHead(200, { "content-type": "text/javascript; charset=utf-8", "cache-control": "no-store" });
      res.end(js);
      return;
    }

    if (url.pathname === "/registre.css") {
      const css = readFileSync(new URL("./registre.css", import.meta.url).pathname, "utf8");
      res.writeHead(200, { "content-type": "text/css; charset=utf-8", "cache-control": "no-store" });
      res.end(css);
      return;
    }

    if (url.pathname === "/api/etat") return json(res, etat());

    if (url.pathname === "/api/hypotheses" && req.method === "POST") {
      const recu = await corps(req);
      if (recu.remise) assumptions = { ...ASSUMPTIONS };
      else {
        for (const [cle, [min, max]] of Object.entries(BOUNDS) as [keyof Assumptions, [number, number]][]) {
          const v = recu[cle];
          if (typeof v === "number" && Number.isFinite(v)) {
            assumptions = { ...assumptions, [cle]: Math.min(max, Math.max(min, v)) };
          }
        }
      }
      return json(res, etat());
    }

    if (url.pathname === "/api/leviers" && req.method === "POST") {
      const recu = await corps(req);
      if (recu.remise) { levers = structuredClone(LEVERS); scenario = "depart"; }
      else if (typeof recu.scenario === "string") {
        const sc = SCENARIOS.find((x) => x.id === recu.scenario);
        if (sc) { levers = { ...structuredClone(LEVERS), ...structuredClone(sc.levers) } as Levers; scenario = sc.id; }
      } else {
        const step = String(recu.step ?? "") as Improvable;
        const champ = String(recu.champ ?? "") as "cost" | "ceiling";
        const v = recu.valeur;
        if (levers[step] && (champ === "cost" || champ === "ceiling") && typeof v === "number" && Number.isFinite(v)) {
          const [min, max] = LEVER_BOUNDS[champ];
          levers = { ...levers, [step]: { ...levers[step], [champ]: Math.min(max, Math.max(min, v)) } };
          scenario = "";
        }
      }
      return json(res, etat());
    }

    res.writeHead(404).end("not found");
  } catch (error) {
    // The error reaches the screen rather than a log nobody reads.
    json(res, { erreur: error instanceof Error ? error.message : String(error) }, 500);
  }
});

/*
 * Bind the loopback interface, not every interface.
 *
 * `listen(PORT)` on its own has Node listen on `::` — the tool becomes reachable by anyone
 * on the same network. On a café wifi that exposes a screen nobody meant to share.
 */
if (isMain(import.meta)) {
  serveur.listen(PORT, "127.0.0.1", () => {
    console.log(`Where the funnel leaks → http://localhost:${PORT}`);
  });
}
