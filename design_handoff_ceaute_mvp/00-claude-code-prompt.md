# Suggested first prompt for Claude Code

Paste this into Claude Code with the repo open, after copying the
`design_handoff_ceaute_mvp/` folder into the project root (or somewhere it can read).

---

```
Read design_handoff_ceaute_mvp/README.md, then 01-foundations.md, 02-components.md,
04-divergences-and-gaps.md and 05-build-order.md. The HTML files in
design_handoff_ceaute_mvp/designs/ are design references — recreate them in this
codebase's Next.js + Tailwind setup, don't copy their inline styles.

Create a branch called feat/design-system.

Start with Phase 0 from 05-build-order.md only, and stop there so I can review:

1. Add the five colours from 01-foundations.md to the Tailwind theme, plus the amber
   pending colour.
2. Load Geist 400/500/600 and make it the only font family. Remove any monospace.
3. Replace every pink-600 / pink-700 / pink-800 with the new plum accent (#8c2b52),
   with #6f2141 as the hover. Grep to confirm none remain.

Do not change any server action, data loader, validation rule or route behaviour in this
phase — it is colour and type only. Show me the diff summary when you're done, and list
anything that looked wrong or ambiguous while you were in there.
```

---

## After phase 0

Work through the phases in `05-build-order.md` one at a time, reviewing between each.
Phase 1 (components) is the one worth being fussy about — every screen afterwards inherits
whatever you accept there.

Two things worth telling Claude Code explicitly when you get to phase 3 and beyond:

- **Keep the existing logic.** The booking flow, availability calculation, hold mechanics,
  Stripe handoff and validation are all correct and tested. This work is a re-skin plus
  the new screens named in `04-divergences-and-gaps.md` §A. If a design seems to require
  changing a server action, check §A first — it is probably listed, and if it is not,
  ask rather than assume.

- **The gaps are the interesting part.** `04-divergences-and-gaps.md` §A lists twelve
  things the designs need that the code does not have yet, and §B lists eight things the
  code gets wrong. Those are the real work; the rest is assembly.
