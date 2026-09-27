import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// "Continue to payment" stops before Stripe when the hold's amounts differ
// from what Review and pay showed: the amount due now, the total, and the
// amount kept after a late cancellation (owner decision, 27 September 2026).
// Example: Full payment keeping 50% switched to a £40 flat deposit on a £40
// booking leaves due now and total unchanged, but the amount kept goes from
// £20 to £40. The server action and page cannot run here, so these tests pin
// the source: Review posts the quoted amount, and the action compares it with
// the hold's stored amount in the same terms_changed condition.

const REPO_ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const BOOK_DIR = path.join(REPO_ROOT, "src/app/(public-provider)/[username]/book");
const ACTIONS = path.join(BOOK_DIR, "actions.js");
const CHECKOUT_PAGE = path.join(BOOK_DIR, "[treatmentId]/checkout/page.jsx");

function withoutComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

function read(file) {
  return withoutComments(readFileSync(file, "utf8"));
}

// The body of the `if (...)` that redirects to the held page with
// notice=terms_changed.
function termsChangedCondition(source) {
  const redirectAt = source.indexOf("redirect(`${returnPath}&notice=terms_changed`)");
  assert.ok(redirectAt > 0, "continueToPayment redirects with notice=terms_changed");
  const ifAt = source.lastIndexOf("if (", redirectAt);
  assert.ok(ifAt > 0, "the terms_changed redirect sits inside an if");
  return source.slice(ifAt, redirectAt);
}

test("Review and pay posts the quoted late-cancellation amount", () => {
  const page = read(CHECKOUT_PAGE);

  assert.match(
    page,
    /expected_kept_pence:\s*String\(terms\?\.late_cancellation_retained_pence \?\? ""\)/,
  );
  // Alongside the other two expected amounts, in the Review form's hidden fields.
  const hiddenAt = page.indexOf("hidden={{");
  assert.ok(hiddenAt > 0, "Review and pay has hidden fields");
  const hidden = page.slice(hiddenAt, page.indexOf("}}", hiddenAt));
  for (const field of ["expected_due_now_pence", "expected_total_pence", "expected_kept_pence"]) {
    assert.ok(hidden.includes(`${field}:`), `hidden fields include ${field}`);
  }
});

test("continueToPayment reads the expected and held late-cancellation amounts", () => {
  const actions = read(ACTIONS);

  assert.match(
    actions,
    /const expectedKeptPence = wholePence\(formData\.get\("expected_kept_pence"\)\);/,
  );
  assert.match(
    actions,
    /const heldKept = wholePence\(booking\.service_snapshot\?\.commitment_amount_pence\);/,
  );
});

test("a changed late-cancellation amount stops on terms_changed with the other amounts", () => {
  const condition = termsChangedCondition(read(ACTIONS));

  for (const check of [
    /expectedDueNowPence === null/,
    /expectedTotalPence === null/,
    /expectedKeptPence === null/,
    /heldDueNow !== expectedDueNowPence/,
    /heldTotal !== expectedTotalPence/,
    /heldKept !== expectedKeptPence/,
  ]) {
    assert.match(condition, check);
  }
});

test("the guard runs before Checkout is claimed", () => {
  const actions = read(ACTIONS);
  const guard = actions.indexOf("heldKept !== expectedKeptPence");
  const claim = actions.indexOf("openCheckoutForHold({");

  assert.ok(guard > 0 && claim > 0);
  assert.ok(guard < claim, "the late-cancellation check comes before openCheckoutForHold");
});
