# What was checked here, and what it cost

Six checks. **Five resisted. One found a defect that is not in this repository's code but in
what it costs to run** — and that one is worth more than the five.

---

## The finding: the suite takes longer than anyone will wait

    npm test                241 s
      tsc --noEmit           14 s
      readme.ts --check     201 s     ← the whole cost
      the tests themselves   ~26 s

**The generator is 83 % of the suite.** A suite that runs past four minutes is a suite a
buyer starts once and never again, and a check nobody runs protects nothing. This is not a
reporting precaution — it is a property of the product, measured.

It is **not fixed here**, deliberately. The same shape exists across the portfolio, and the
answer — cache the generated figures against a fingerprint of their inputs, or split the
check out of the default suite — is a design decision worth taking once for twelve
repositories rather than twelve times in twelve different ways. The number is recorded so
that whoever takes it has something to start from.

---

## What resisted

**Every marker block is generated, and the correspondence is exact in both directions.** Nine
markers in `README.md`, nine keys emitted by `src/readme.ts` — `baselines`, `finding`,
`funnelNote`, `funnelTable`, `provenance`, `reorder`, `sensitivity`, `traps`, `valueTable`.
No marker without a generator, no generated key without a marker.

**`--check` proved in both directions**, which is the only way a check earns anything:

    clean       exit 0, "up to date"          (the green suite runs it)
    falsified   exit 1, names `finding`       (31.1× changed to 99.9×)
    restored    exit 0, "up to date"

**Fence parity.** 12 fences, even. No orphan.

**No dead guard.** No constant predicate, no `catch` returning a fixed value, no always-true
condition in the published paths.

**No undeclared selection.** No `.slice(0, N)`, no `continue` discarding cases in a path that
reaches a published figure.

**The four shared modules are byte-identical to `cascade`** — `figures.ts`, `interval.ts`,
`provenance.ts`, `cli.ts` — checked md5 for md5, before and after, and not touched.

---

## One comment figure, checked against the repository's own tool

`funnel.ts` opens with the argument the whole repository rests on:

> *A step measured on 400 people carries roughly ±5 points of interval, which means
> "18.2 % against 20.1 %" is a sentence about noise.*

Checked with `interval.ts`, which is right there:

    wilson(76, 400)  →  [15.46 %, 23.13 %]      half-width 3.8 points, not 5
    distinguishable(73, 400, 80, 400)  →  false

**The claim holds and the tool confirms it.** The width is overstated — ±3.8 written as
±5 — and it is left alone: *a figure that errs toward caution is not the same fault as a
figure that errs toward the argument.* The first costs a reader nothing; the second is the
one nobody audits, and it is what "a third of the money" turned out to be in a sibling
repository today.

---

## One failure, and it was a date

`la page contrôlée est celle que les sources produisent aujourd'hui` failed: `docs/` was
older than `src/pages.ts`. The content was **identical** — rebuilding produced no diff at
all — and only the timestamp had moved, when the shared layer was propagated through.

The guard decides on dates on purpose, and its own message says why: *une reconstruction
inutile coûte une commande, un vert sur l'ancienne page coûte davantage.* Rebuilt rather
than worked around.

---

## Verification

    npm test    34 tests, 34 pass, 0 fail, exit 0
