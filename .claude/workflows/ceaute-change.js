export const meta = {
  name: 'ceaute-change',
  description: 'Take one Ceaute change through product, engineering and verification lanes, stopping at owner gates',
  whenToUse: 'A settled change request. Run with stage "plan" first; pass the returned brief and plan back with stage "build". Fuzzy ideas go to /ceaute-grill first; shipping goes to /ceaute-release after.',
  phases: [
    { title: 'Product', detail: 'brief from docs/product.md, decisions and ceaute-product-design' },
    { title: 'Engineering', detail: 'surveyor maps the slice, planner writes fenced tasks' },
    { title: 'Plan review', detail: 'two critics: invariants and product/scope' },
    { title: 'Preflight', detail: 'refuse to build on main or preview' },
    { title: 'Implement', detail: 'one agent per task, sequential, inside its file fence' },
    { title: 'Verify', detail: 'change checklist commands plus a diff review' },
  ],
}

// Usage (from the lead session):
//   Workflow({ name: 'ceaute-change', args: { request: '...' } })
//     -> { status: 'needs-owner-decisions' | 'plan-ready', brief, plan, objections }
//   Workflow({ name: 'ceaute-change', args: { request, stage: 'build', brief, plan } })
//     -> { status, tasks, checks, findings, acceptance }
// The workflow never commits, pushes, resets a database, runs db push or
// touches production. Browser acceptance and release stay in the lead session.

const request = args && args.request
if (!request) throw new Error('Pass args.request: the change, in the owner\'s words')
const stage = args.stage || 'plan'

const str = { type: 'string' }
const strs = { type: 'array', items: str }

const BRIEF = {
  type: 'object',
  properties: {
    visible: { type: 'boolean', description: 'Does a user see any difference?' },
    journeys: strs,
    changes: { ...strs, description: 'Observable behaviour after the change, one line each' },
    preserve: { ...strs, description: 'Rules that must still hold, each citing the doc or ADR it comes from' },
    open_decisions: {
      type: 'array',
      items: {
        type: 'object',
        properties: { question: str, recommended: str, why: str, source: str },
        required: ['question', 'recommended', 'why'],
      },
    },
    docs_to_update: strs,
  },
  required: ['visible', 'journeys', 'changes', 'preserve', 'open_decisions', 'docs_to_update'],
}

const SURVEY = {
  type: 'object',
  properties: {
    slice: {
      type: 'array',
      items: { type: 'object', properties: { file: str, role: str, lines: str }, required: ['file', 'role'] },
    },
    authoritative_layer: str,
    existing_tests: strs,
    observations: strs,
  },
  required: ['slice', 'authoritative_layer', 'existing_tests'],
}

const PLAN = {
  type: 'object',
  properties: {
    summary: str,
    one_way_door: { type: 'boolean' },
    decision_record: { ...str, description: 'Title of the ADR to write, or empty' },
    migration: { type: 'boolean' },
    tasks: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: str,
          title: str,
          files: strs,
          change: { ...str, description: 'Exactly what changes, precise enough for an agent that makes no decisions' },
          protected: { type: 'boolean', description: 'Touches money, database, email, auth, RLS or a protected path' },
          tests: strs,
        },
        required: ['id', 'title', 'files', 'change', 'protected', 'tests'],
      },
    },
    docs_updates: strs,
    acceptance: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          item: str,
          method: { type: 'string', enum: ['automated', 'database', 'browser', 'owner-keyboard', 'stripe', 'email'] },
        },
        required: ['item', 'method'],
      },
    },
    risks: strs,
  },
  required: ['summary', 'one_way_door', 'migration', 'tasks', 'docs_updates', 'acceptance', 'risks'],
}

const CRITIQUE = {
  type: 'object',
  properties: {
    verdict: { type: 'string', enum: ['approve', 'revise'] },
    objections: {
      type: 'array',
      items: {
        type: 'object',
        properties: { severity: { type: 'string', enum: ['blocking', 'minor'] }, point: str, evidence: str },
        required: ['severity', 'point', 'evidence'],
      },
    },
  },
  required: ['verdict', 'objections'],
}

const DONE = {
  type: 'object',
  properties: {
    status: { type: 'string', enum: ['done', 'stopped'] },
    files_changed: strs,
    summary: str,
    stop_reason: str,
  },
  required: ['status', 'files_changed', 'summary'],
}

const CHECKS = {
  type: 'object',
  properties: {
    results: {
      type: 'array',
      items: {
        type: 'object',
        properties: { command: str, status: { type: 'string', enum: ['pass', 'fail', 'not-run'] }, detail: str },
        required: ['command', 'status', 'detail'],
      },
    },
  },
  required: ['results'],
}

const FINDINGS = {
  type: 'object',
  properties: {
    findings: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          severity: { type: 'string', enum: ['blocking', 'minor'] },
          file: str,
          line: { type: 'number' },
          claim: str,
          evidence: str,
        },
        required: ['severity', 'file', 'claim', 'evidence'],
      },
    },
  },
  required: ['findings'],
}

const VERDICT = {
  type: 'object',
  properties: { real: { type: 'boolean' }, reason: str },
  required: ['real', 'reason'],
}

const json = (v) => JSON.stringify(v, null, 2)

// ---------------------------------------------------------------- plan

if (stage === 'plan') {
  phase('Product')
  const brief = await agent(
    `You are the product lane for one Ceaute change. You decide nothing yourself: you state what the owner has already decided and surface what they have not.

Change request (owner's words):
${request}

Read only what the request touches: the relevant sections of docs/product.md, docs/domain.md, docs/decisions/README.md and any record it links that applies. If a user would see any difference, load the ceaute-product-design skill and read its references, including references/undecided.md and references/copy.md.

Return a brief:
- changes: observable behaviour after the change, in product language, using Treatments / Treatment Groups / Add-ons exactly as docs/domain.md does.
- preserve: every rule from those documents the change must keep, each citing where it comes from.
- open_decisions: every product choice the request needs that no document settles (new copy, a new field, a changed rule, navigation, anything listed as undecided). A settled decision is not open; do not re-ask it. Give each a recommended answer and why. If the request contradicts a settled decision, the open decision is whether to revisit it, naming the document.
- docs_to_update: which docs will describe the new behaviour.
Do not design screens, write code or look at implementation beyond what is needed to understand current behaviour.`,
    { label: 'product-brief', phase: 'Product', schema: BRIEF, effort: 'high' },
  )
  if (!brief) throw new Error('Product lane returned nothing')
  if (brief.open_decisions.length) {
    log(`${brief.open_decisions.length} product decision(s) need the owner; stopping before engineering`)
    return {
      status: 'needs-owner-decisions',
      brief,
      next: 'Settle these with the owner (or /ceaute-grill), record them in docs, then rerun stage "plan".',
    }
  }

  phase('Engineering')
  const survey = await agent(
    `Map the vertical slice for this Ceaute change, using the "Where a change belongs" table in docs/architecture.md as the starting point.

Change request: ${request}

Product brief:
${json(brief)}

Report, with file:line citations: the route page, its actions.js, the src/lib modules and the database functions or migrations that own the behaviour; which layer is authoritative for each rule in "preserve"; the existing tests (tests/ and supabase/tests) that cover the slice; and anything alarming as an observation. Report facts only.`,
    { label: 'survey-slice', phase: 'Engineering', agentType: 'surveyor', schema: SURVEY },
  )

  const planPrompt = (extra) => `You are the engineering lane for one Ceaute change. Turn the settled product brief into the smallest correct plan, following docs/engineering-principles.md (the five principles, the invariants and the change checklist) and docs/architecture.md.

Change request: ${request}

Product brief (settled; do not add product scope):
${json(brief)}

Surveyed slice:
${json(survey)}

Rules for the plan:
- If a rule is authoritative in PostgreSQL, the first task is a new migration in supabase/migrations/ and JavaScript follows. Never edit an existing migration. Load supabase-postgres-best-practices for database tasks, stripe-best-practices for payments (the pinned API version in src/lib/stripe/server.js stays), resend or email-best-practices for email, and the guide in node_modules/next/dist/docs/ for Next.js code.
- Each task names every file it may touch (its fence) and describes the change precisely enough for an agent that may not make decisions. Tasks run in order, so a later task may depend on an earlier one.
- Mark a task protected if it touches supabase/migrations/, src/app/api/, src/proxy.ts, src/lib/payments/, src/lib/stripe/, src/lib/emails/, src/lib/supabase/, auth, RLS, booking, refund, cancellation or address redaction.
- Include the tests each task adds or changes, and the doc updates from the brief as their own task.
- one_way_door is true for snapshot shapes, payment state, public URLs, webhook contracts or stored data others depend on; then name the decision record to write.
- acceptance lists what must be seen to work and how: automated, database (npm run test:db), browser, owner-keyboard, stripe, email.
- No refactors unless the change is blocked without one.${extra || ''}`

  let plan = await agent(planPrompt(), { label: 'plan', phase: 'Engineering', schema: PLAN, effort: 'high' })
  if (!plan) throw new Error('Engineering lane returned no plan')

  phase('Plan review')
  const LENSES = [
    {
      key: 'invariants',
      prompt: 'the invariants in docs/engineering-principles.md and ADRs 001-003: PostgreSQL owns booking, refund, publication, ownership and private-address rules; payment is confirmed only by the verified webhook; RLS is not weakened; the service-role key never reaches the browser; external work is claimed in the database first. Also check the protected flags, test coverage and that every migration is new.',
    },
    {
      key: 'product-scope',
      prompt: 'fidelity to the product brief and simplicity: does every brief change have a task, does any task add behaviour the brief did not ask for, is anything a refactor that is not needed, are fences too wide, is the docs update included, and does it follow ceaute-product-design for anything visible.',
    },
  ]
  const critiques = (await parallel(LENSES.map((l) => () =>
    agent(
      `Critique this Ceaute change plan through one lens only: ${l.prompt}

Check claims against the code and docs; cite evidence. Mark an objection blocking only if shipping the plan as written would break a rule, lose a brief requirement or add unrequested scope.

Brief:
${json(brief)}

Plan:
${json(plan)}`,
      { label: `critic:${l.key}`, phase: 'Plan review', schema: CRITIQUE, effort: 'high' },
    ).then((c) => c && { lens: l.key, ...c }),
  ))).filter(Boolean)

  const blocking = critiques.flatMap((c) => c.objections.filter((o) => o.severity === 'blocking').map((o) => ({ lens: c.lens, ...o })))
  let revised = false
  if (blocking.length) {
    log(`${blocking.length} blocking objection(s); revising the plan once`)
    const next = await agent(
      planPrompt(`\n\nA review found these blocking objections to the previous plan. Fix each, or keep the original and state why in risks:\n${json(blocking)}\n\nPrevious plan:\n${json(plan)}`),
      { label: 'plan-revision', phase: 'Plan review', schema: PLAN, effort: 'high' },
    )
    if (next) { plan = next; revised = true }
  }

  return {
    status: 'plan-ready',
    brief,
    plan,
    survey,
    objections: critiques.flatMap((c) => c.objections.map((o) => ({ lens: c.lens, ...o }))),
    revised_after_review: revised,
    next: 'Owner approves the plan, the lead session creates a feature branch, then rerun with stage "build" passing brief and plan.',
  }
}

// ---------------------------------------------------------------- build

if (stage !== 'build') throw new Error(`Unknown stage "${stage}"; use "plan" or "build"`)
const brief = args.brief
const plan = args.plan
if (!brief || !plan) throw new Error('stage "build" needs args.brief and args.plan from an approved plan run')

phase('Preflight')
const pre = await agent(
  'Run `git branch --show-current` and `git status --porcelain`. Change nothing. Return the branch and the dirty paths.',
  {
    label: 'preflight',
    phase: 'Preflight',
    agentType: 'surveyor',
    schema: { type: 'object', properties: { branch: str, dirty: strs }, required: ['branch', 'dirty'] },
  },
)
if (!pre || ['main', 'preview', ''].includes(pre.branch)) {
  return { status: 'blocked', reason: `Refusing to build on "${pre && pre.branch}". Create a feature branch first.` }
}
if (pre.dirty.length) {
  return { status: 'blocked', reason: 'Working tree is not clean; commit or stash first so the diff review sees only this change.', dirty: pre.dirty }
}

phase('Implement')
const done = []
for (const t of plan.tasks) {
  const r = await agent(
    `Implement task ${t.id} of an approved Ceaute plan, and nothing else.

Task: ${t.title}
Change: ${t.change}
Files you may touch (the fence): ${t.files.join(', ')}
Tests to add or update: ${t.tests.join('; ') || 'none named'}

Product brief, for context only; do not add to it:
${json({ changes: brief.changes, preserve: brief.preserve })}

Earlier tasks already done:
${json(done.map((d) => ({ id: d.id, files: d.files_changed, summary: d.summary })))}

Read every file in the fence in full before editing. Stay inside the fence except for strictly necessary import updates. If the task needs a decision the brief and plan do not make, or cannot be done inside the fence, stop and report instead of guessing. Never edit an existing migration, run db push, db reset, link, deploy, change env vars, commit or push. Run the unit tests relevant to your change before returning.`,
    {
      label: `task:${t.id}`,
      phase: 'Implement',
      // Protected work (money, database, email, auth) stays on the session model; the rest goes to the Sonnet implementer.
      agentType: t.protected ? undefined : 'bounded-implementer',
      effort: t.protected ? 'high' : undefined,
      schema: DONE,
    },
  )
  if (!r || r.status === 'stopped') {
    return {
      status: 'stopped',
      stopped_at: t.id,
      reason: r ? r.stop_reason : 'implementer returned nothing',
      tasks: done,
      remaining: plan.tasks.slice(plan.tasks.indexOf(t)).map((x) => x.id),
    }
  }
  done.push({ id: t.id, ...r })
}

phase('Verify')
const checksRun = agent(
  `Run the Ceaute change checklist commands from docs/engineering-principles.md and report each: npm test, npm run typecheck, npm run lint, npm run build. Do not edit any file and do not fix failures; report the relevant output lines.
Do not run npx supabase db reset or npm run test:db: resetting wipes the owner's local data. Report "npm run test:db" as not-run with detail "${plan.migration ? 'needed: a migration changed; run after npx supabase db reset' : 'not needed: no migration'}".`,
  { label: 'checks', phase: 'Verify', schema: CHECKS, effort: 'low' },
)

const REVIEW_LENSES = [
  {
    key: 'correctness-invariants',
    prompt: 'correctness bugs, and any breach of the invariants in docs/engineering-principles.md (PostgreSQL authority, webhook-only confirmation, RLS, service-role key, claim-before-request idempotency) or of the brief\'s preserve list.',
  },
  {
    key: 'product-scope',
    prompt: 'whether the diff delivers every change in the brief and nothing more: unrequested behaviour, copy or fields, edits outside the planned fences, missing tests, missing doc updates, and ceaute-product-design rules for anything visible.',
  },
]
const reviewRun = pipeline(
  REVIEW_LENSES,
  (l) => agent(
    `Review the uncommitted Ceaute change (git diff, plus git status for new files) for ${l.prompt}
Report only defects you can point to at a file and line, with evidence. No style preferences.

Brief:
${json(brief)}

Plan:
${json(plan)}`,
    { label: `review:${l.key}`, phase: 'Verify', schema: FINDINGS, effort: 'high' },
  ),
  (review, l) => parallel((review ? review.findings : []).map((f) => () =>
    f.severity !== 'blocking'
      ? Promise.resolve({ lens: l.key, ...f, verdict: null })
      : agent(
        `Try to refute this review finding on the uncommitted Ceaute diff. Read the code yourself. Return real=false if the finding is wrong, already handled elsewhere, or outside what the brief asked for; default to real=false if you cannot confirm it.

Finding:
${json(f)}`,
        { label: `refute:${f.file}`, phase: 'Verify', schema: VERDICT },
      ).then((v) => ({ lens: l.key, ...f, verdict: v })),
  )),
)

const [checks, reviewed] = await Promise.all([checksRun, reviewRun])
const findings = reviewed.filter(Boolean).flat().filter(Boolean)
const confirmed = findings.filter((f) => f.severity === 'blocking' && f.verdict && f.verdict.real)
const dismissed = findings.filter((f) => f.severity === 'blocking' && !(f.verdict && f.verdict.real))
const minor = findings.filter((f) => f.severity === 'minor')
const failed = (checks ? checks.results : []).filter((c) => c.status === 'fail')

return {
  status: failed.length || confirmed.length ? 'needs-fixes' : 'ready-for-acceptance',
  tasks: done,
  checks: checks ? checks.results : 'checks agent returned nothing',
  blocking_findings: confirmed,
  dismissed_findings: dismissed,
  minor_findings: minor,
  // Everything outside automated checks starts unverified (docs/verification.md): the lead session and owner close these.
  acceptance: plan.acceptance.map((a) => ({
    ...a,
    status: a.method === 'automated' && checks && !failed.length ? 'verified' : 'unverified',
  })),
  decision_record: plan.one_way_door ? plan.decision_record : '',
  next: 'Fix any blocking findings, run browser acceptance in the lead session per docs/verification.md, ask the owner for the keyboard pass, then /ceaute-release.',
}
