# Vercel function region experiment — 17 September 2026

One hypothesis, one configuration change, one before/after measurement.

**Hypothesis.** The dominant remaining navigation latency comes from Vercel
Functions executing in Washington, D.C. (`iad1`) while Supabase is in AWS
`eu-west-1` (Ireland). Moving the *same build* to a region next to the
database should remove most of it.

Branch: `perf/colocate-vercel-supabase`. Status at time of writing: **not
committed, not deployed, not merged**. Nothing external was changed.

## Current state (before)

| Item | Value | Evidence |
| --- | --- | --- |
| Next.js | 16.3.3 (App Router, all routes dynamic, `src/proxy.ts` as middleware) | `package.json`, `npm run build` |
| Vercel runtime | Node.js Vercel Functions (Fluid compute is the default for projects created after 23 April 2025) | no `runtime = 'edge'` exports anywhere; Vercel docs |
| `vercel.json` | did not exist | repo root |
| Route-level region/runtime config | none (`preferredRegion` is deprecated in Next.js 16 and unused here) | `grep` for `export const runtime|preferredRegion` in `src/` |
| Function execution region | **`iad1`** (Vercel default for every new project) | `X-Vercel-Id: lhr1::iad1::…` on every response from ceaute.com |
| Supabase region | `aws-1-eu-west-1` (Ireland) | `supabase/.temp/pooler-url` |
| Dashboard "Function Regions" setting | unknown; the local Vercel CLI token is expired so the project could not be read. Not required: `vercel.json` `regions` overrides the dashboard. | Vercel API returned `invalidToken` |

`x-vercel-execution-region` is **not** emitted by Vercel. The execution region
is the middle segment of `x-vercel-id` (`<edge>::<function region>::<id>`); a
two-segment id means no function ran (e.g. the `www` → apex 308).

## Region choice

Vercel regions considered (all Fluid-compute capable):

| Region | AWS region | Distance to Supabase (`eu-west-1`) |
| --- | --- | --- |
| `iad1` (current) | us-east-1 | ~70–80 ms RTT per query |
| `lhr1` | eu-west-2 | ~10–12 ms RTT (inter-region, London ↔ Dublin) |
| `dub1` | **eu-west-1, same region as the database** | ~1–2 ms RTT (intra-region) |

**Chosen: `dub1`.** A page render makes one to four sequential database
requests (claims → provider page → page query), so compute↔database distance
is paid several times per navigation while browser↔compute distance is paid
once. Putting the function in the same AWS region as Postgres, Auth and
Storage minimises the repeated leg. London users pay the London → Dublin hop
once per request (~10 ms) instead of once per query.

`lhr1` rejected: every query would still cross the Irish Sea; it only wins if
the page made zero database calls. Multi-region (`["dub1","lhr1"]`) rejected:
it needs Pro, splits cold-start warmth across two regions, and would put some
requests back on the worse path. Nothing else changed (no failover regions,
no per-function overrides).

## Change

New file `vercel.json` (only file in the diff besides this report):

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "regions": ["dub1"]
}
```

Application code untouched. The cron routes, Stripe webhooks and proxy are not
configured separately: the proxy runs at the edge regardless of this setting;
the Stripe and cron route handlers move to `dub1` with everything else, which
is harmless (Supabase Cron calls them over the public URL and Stripe delivers
webhooks globally).

## Verification (repository)

```
npm test          # 75 tests, 75 pass
npm run typecheck # clean
npm run lint      # clean
npm run build     # success, all routes dynamic, proxy present
npm run test:db   # NOT RUN — Docker unavailable on this machine (unchanged)
```

## Baseline measurement (before, `iad1`)

Method: from London, `curl` each route 10 times, ~0.5 s apart, headers only
kept, body discarded, `Cache-Control: no-cache`. Columns: total time,
time-to-first-byte, `x-vercel-id`. Script in the "How to re-run" section.

Run at 00:47 UTC, production `https://ceaute.com`, `X-Vercel-Cache: MISS` on
every sample, HTTP 200 on every sample, function region `iad1` on **20/20**.

| Route | n | min | median | max | first sample | exec region |
| --- | --- | --- | --- | --- | --- | --- |
| `/discover?category=gel-nails` | 10 | 349 ms | **537 ms** | 937 ms | 937 ms | `iad1` ×10 |
| `/@unknown` | 10 | 316 ms | **328 ms** | 690 ms | 690 ms | `iad1` ×10 |

Raw samples (`time_total_ms` / `ttfb_ms` / `x-vercel-id`):

```
/discover?category=gel-nails
 937/535 lhr1::iad1::gfls6-1789606062707-d6fd7ff8d208   <- first request (warming)
 576/213 lhr1::iad1::2xlsm-1789606065458-2ab1333f45b1
 549/206 lhr1::iad1::2xlsm-1789606067928-074f0e397e37
 502/176 lhr1::iad1::ldkqh-1789606070383-d511385ff2eb
 349/190 lhr1::iad1::wjqgh-1789606072770-8f00c90d3dc7
 551/225 lhr1::iad1::ztp59-1789606075080-93e5c30ce9ae
 525/224 lhr1::iad1::lwljl-1789606077527-dfc1befad3ed
 520/197 lhr1::iad1::rnpp6-1789606079890-28b471e327b5
 389/204 lhr1::iad1::9zq78-1789606082306-f8aefec93640
 555/205 lhr1::iad1::b7wwt-1789606084569-703dfa7cfcfe
/@unknown
 690/206 lhr1::iad1::rmqn6-1789606087112-ef5d2f51fa02   <- first request
 331/198 lhr1::iad1::c2r24-1789606089710-cf21a568460b
 354/273 lhr1::iad1::297ww-1789606091937-b531a631dea5
 326/183 lhr1::iad1::rc55k-1789606094132-e32bfb282264
 316/187 lhr1::iad1::rmqn6-1789606096366-c233bc45cc92
 320/231 lhr1::iad1::jmf9t-1789606098603-c8c60a892612
 323/187 lhr1::iad1::24stb-1789606100779-0d8edf7b7145
 336/200 lhr1::iad1::twqq9-1789606103027-4adda609fae6
 316/192 lhr1::iad1::9b9vg-1789606105224-beb04c844559
 352/216 lhr1::iad1::24stb-1789606107437-4f4161080ef4
```

These agree with the 16 September figures (530–550 ms warm, ~1.5 s cold; a
1.88 s cold `/@unknown` was also seen earlier this session). Reference RTTs
from this London machine: TCP connect to Supabase Ireland 15–40 ms, to the
Vercel `lhr1` edge 18–33 ms.

Note on TTFB: `/discover` TTFB is ~200 ms but total is ~530 ms because the
route streams (`loading.jsx` shell first, then the data-dependent HTML). Total
time is the number to compare; TTFB mostly measures the edge proxy hop.

## How to re-run (after deployment)

Save the script below as `measure.sh` and run
`bash measure.sh after-dub1 10 https://ceaute.com`. To observe a cold start,
wait at least 15 minutes with no traffic and run it again with N=1 first.

```bash
#!/usr/bin/env bash
# Usage: measure.sh <label> [N] [BASE]
set -u
LABEL="${1:-run}"; N="${2:-10}"; BASE="${3:-https://ceaute.com}"
ROUTES=("/discover?category=gel-nails" "/@unknown")
OUT="${OUT_DIR:-.}/latency-${LABEL}.csv"
echo "label,route,sample,http,time_total_ms,ttfb_ms,x_vercel_id,exec_region,x_vercel_cache" > "$OUT"
for R in "${ROUTES[@]}"; do
  for i in $(seq 1 "$N"); do
    H=$(mktemp)
    T=$(curl -sS -o /dev/null -D "$H" -w "%{http_code} %{time_total} %{time_starttransfer}" \
         -H "Cache-Control: no-cache" "${BASE}${R}")
    CODE=$(echo "$T" | cut -d' ' -f1)
    TOT=$(echo "$T" | awk '{printf "%d", $2*1000}')
    TTFB=$(echo "$T" | awk '{printf "%d", $3*1000}')
    VID=$(grep -i '^x-vercel-id:' "$H" | tr -d '\r' | awk '{print $2}')
    VC=$(grep -i '^x-vercel-cache:' "$H" | tr -d '\r' | awk '{print $2}')
    EXEC=$(echo "$VID" | awk -F'::' '{print (NF>=3)?$2:"(none)"}')
    echo "$LABEL,$R,$i,$CODE,$TOT,$TTFB,$VID,$EXEC,$VC" >> "$OUT"
    rm -f "$H"; sleep 0.5
  done
done
echo "== $LABEL  ($BASE, N=$N per route) =="
for R in "${ROUTES[@]}"; do
  awk -F',' -v r="$R" -v l="$LABEL" '$1==l && $2==r {print $5, $4, $8}' "$OUT" | sort -n | awk -v r="$R" '
    { v[NR]=$1; codes[$2]++; regs[$3]++ }
    END { n=NR; med=(n%2)?v[(n+1)/2]:(v[n/2]+v[n/2+1])/2
      printf "%-32s n=%d  min=%dms  median=%dms  max=%dms", r, n, v[1], med, v[n]
      printf "  http={"; for (c in codes) printf "%s:%d ", c, codes[c]; printf "}"
      printf "  exec_region={"; for (g in regs) printf "%s:%d ", g, regs[g]; printf "}\n" }'
done
echo "raw: $OUT"
```

Proof of region: every `x-vercel-id` in the "after" run must read
`lhr1::dub1::…`. If any sample still shows `::iad1::` the deployment did not
pick up `vercel.json` (or an older deployment is still serving) and the
timings are not comparable.

## Success / failure criteria (stated before deployment)

Same application, same database, only the execution region differs.

- **Supported** if execution region is `dub1` on all samples and warm medians
  fall substantially: `/discover?category=gel-nails` from ~537 ms towards the
  local-from-London figure (85–100 ms) plus one London↔Dublin hop, i.e.
  roughly 200 ms or less; `/@unknown` from ~328 ms to roughly 150 ms or less.
  Cold starts should also drop because the JWKS fetch and first queries no
  longer cross the Atlantic.
- **Falsified / weakened** if execution region is demonstrably `dub1` yet
  `/discover` stays around 450–550 ms warm. Then geography was not the
  dominant cost and the remaining time is in the server/query execution path
  (or the edge→function hop), which is the next thing to instrument.
- **Inconclusive** if `x-vercel-id` still shows `iad1`, if `X-Vercel-Cache`
  is not `MISS`, or if the after run hits a different build than the before
  run.

## Unrelated findings (not acted on)

- The local Vercel CLI token in `%APPDATA%\com.vercel.cli\Data\auth.json` is
  expired (`invalidToken`); `vercel login` is needed before any CLI deploy.
- `/@unknown` returns HTTP 200 (streamed not-found), as already recorded on
  16 September. Not a regression from the earlier performance work.
