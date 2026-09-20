# PostHog Self-driving setup report

## Summary

PostHog Self-driving has been configured with Session Replay, Error Tracking, and Support enabled; native health, error, and support signal sources are active. The scout troop was materialized and focused on the application’s product, web, revenue, and instrumentation surfaces. Findings will begin appearing in the [Self-driving inbox](https://eu.posthog.com/project/279216/inbox) within about 30 minutes.

## Files modified or created

| File | Change |
| --- | --- |
| `posthog-self-driving-report.md` | Created as the setup record for this Self-driving configuration. |

No application source files were modified.

## AI data processing

Approved by the wizard’s organization-level gate before this setup ran.

## GitHub

The PostHog GitHub App was already connected before this setup, as confirmed by the wizard preflight.

## Products enabled

| Product | Result | Application check |
| --- | --- | --- |
| Session Replay | Already enabled | Web SDK initialization does not disable session recording. |
| Error Tracking | Already enabled | Web SDK explicitly enables exception capture. |
| Support (Conversations) | Enabled | Tickets will arrive only after an inbound email, inbox, or Slack channel is connected in PostHog. |

## Signal sources

| Signal source | Action | Notes |
| --- | --- | --- |
| `signals_scout` / `cross_source_issue` | On by default | No configuration row is required; no earlier opt-out existed. |
| `health_checks` / `health_issue` | Enabled | Source configuration created. |
| `error_tracking` / `issue_created` | Enabled | Source configuration created. |
| `error_tracking` / `issue_reopened` | Enabled | Source configuration created. |
| `error_tracking` / `issue_spiking` | Enabled | Source configuration created. |
| `conversations` / `ticket` | Enabled | Source configuration created; dormant until a Support channel is connected. |
| `session_replay` / `session_analysis_cluster` | Skipped | Retired source; Replay Vision scanners provide replay coverage instead. |
| `replay_vision` | Skipped | Scanner-level `emits_signals` authorizes this route directly. |

## Connected tools

No external issue-tracker, support-desk, error-tracker, security-scanner, feedback, or search tool was selected. No external responder was enabled.

## Scout troop

**Run budget:** 100 runs/day; 0 runs used today; 100 remaining. The project is enrolled in the early-access scout program. Announcement: “Scouts are in early access. Each project gets up to 100 scout runs a day. Contact team-self-driving@posthog.com if you need more.”

### Enabled (5)

| Scout | Why it is active |
| --- | --- |
| General | Cross-product coverage and correlations not owned by a specialist. |
| Product analytics | Watches core application journey regressions. |
| Web analytics | Watches acquisition, landing-page, and attribution changes. |
| Revenue analytics | Watches payment and revenue-data health; Stripe is used by the application. |
| Health checks | Surfaces actionable PostHog instrumentation and configuration gaps. |

### Disabled (22)

| Scout | Why it is disabled |
| --- | --- |
| AI observability | No AI/LLM workload evidence. |
| Anomaly detection | No established saved insight or dashboard coverage yet. |
| APM | No distributed tracing evidence. |
| Conversations | Support has no inbound channel yet; the native ticket source covers it once connected. |
| CSP violations | No CSP reporting evidence. |
| Customer analytics | No B2B account-analytics evidence. |
| Data pipelines | No pipeline or CDP-destination evidence. |
| Data warehouse | No connected warehouse source. |
| Error tracking | Covered by enabled native error signal sources. |
| Experiments | No active experiment evidence. |
| Feature flags | No active feature-flag evidence. |
| Inbox validation | Fresh setup has no resolved Self-driving fixes to validate. |
| Insight alerts | No configured insight-alert evidence. |
| Logs | No logs-product evidence. |
| MCP tool calls | No MCP telemetry surface to monitor. |
| Observability gaps | Kept selective while the focused health scout covers setup gaps. |
| Replay vision | No prior Replay Vision observations yet; it can be enabled later after scanner data accumulates. |
| Session replay | Covered by the Replay Vision scanners below. |
| Skills store | No team skill-store activity to monitor. |
| Surveys | No surveys exist. |
| Tasks | No tasks-product activity to monitor. |
| Web vitals | No web-vitals evidence yet. |

## Custom scouts

No custom scouts were created. Two product-specific candidates were proposed and declined:

- **Booking checkout reliability:** would have watched sustained drops between checkout starts and completed payments, or material increases in payment failures. The broad revenue scout provides partial coverage, but this would have been more specific to the booking funnel.
- **Provider activation progress:** would have watched provider progression from onboarding through payment readiness to public-page publication, flagging sustained stage-specific stalls.

The generic error, replay, product, web, revenue, and health surfaces were ruled out as custom-scout targets because they already have an enabled specialist or their own native pipeline. If a future custom scout becomes noisy, set its config’s `emit` field to `false` in PostHog to change it to dry-run mode.

## Replay Vision scanners

A Replay Vision scanner is an LLM that watches individual session recordings on a schedule and pushes qualifying findings to the Self-driving inbox. These are the only items in this setup that spend Replay Vision quota. Each finding enters at half weight and needs independent corroboration before promotion into a report.

| Monitor | Status | Query scope | Sampling | Estimate |
| --- | --- | --- | --- | --- |
| **Ceaute booking flow breakage** | Created | Recordings that visited the `/book/` journey, the customer’s booking and checkout completion flow. | 50% | 0 matched recordings in the sampled seven-day window; 0 observations and 0 credits/month currently estimated. |
| **Ceaute booking frustration** | Created | Sessions containing `$rageclick`; no URL filter was added, preserving its separate behavioral scope. | 100% | 0 matched recordings in the sampled seven-day window; 0 observations and 0 credits/month currently estimated. |

The organization has 2,500 Replay Vision credits remaining this period and is not exhausted. There are no recordings in the estimates’ recent window, so both monitors are armed and will begin evaluating recordings when traffic arrives.

## Follow-ups

- [ ] Connect an inbound Support channel (email, inbox, or Slack) in PostHog so the enabled Support ticket responder can receive tickets.
- [ ] Send production traffic and recordings, then review the two scanner outputs; rate observations in the Replay Vision UI to receive configuration recommendations.
- [ ] Revisit disabled specialists when their underlying product surface becomes active, especially feature flags, experiments, web vitals, surveys, and logs.

## What happens next

The scout coordinator picks up fresh configurations within roughly 30 minutes. Scout runs draw from the project’s daily run budget, and qualifying findings cluster into reports in the Self-driving inbox. Immediately actionable reports can begin coding tasks.
