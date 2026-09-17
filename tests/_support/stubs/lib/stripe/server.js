// Test stand-in for src/lib/stripe/server.js. Unit tests inject a fake Stripe
// client; reaching this default means a code path forgot to accept one.
export function getStripe() {
  throw new Error("Unit tests must inject a Stripe client.");
}
