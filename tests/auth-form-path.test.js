import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { authenticationFormPath } from "../src/lib/auth/form-path.js";

test("a failed login carries its email into account creation", () => {
  const failedLoginPath = authenticationFormPath("/sign-in", {
    error: "no-account",
    next: "/dashboard/locations",
    email: "new.provider@example.test",
  });
  const failedLoginUrl = new URL(failedLoginPath, "https://ceaute.example");

  assert.equal(failedLoginUrl.searchParams.get("email"), "new.provider@example.test");

  assert.equal(
    authenticationFormPath("/sign-up", {
      next: failedLoginUrl.searchParams.get("next"),
      email: failedLoginUrl.searchParams.get("email"),
    }),
    "/sign-up?next=%2Fdashboard%2Flocations&email=new.provider%40example.test",
  );
});

test("auth form links reject an unsafe return path while preserving the email", () => {
  assert.equal(
    authenticationFormPath("/sign-up", {
      next: "//evil.example",
      email: "editable@example.test",
    }),
    "/sign-up?email=editable%40example.test",
  );
});

test("the sign-in failure and both forms wire the carried email through", async () => {
  const [actions, signInForm, signUpForm] = await Promise.all([
    readFile(
      new URL("../src/app/(authenticate)/actions.js", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL(
        "../src/app/(authenticate)/_components/signin-form.jsx",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL(
        "../src/app/(authenticate)/_components/signup-form.jsx",
        import.meta.url,
      ),
      "utf8",
    ),
  ]);

  assert.match(actions, /error: result\.outcome,[\s\S]*next,[\s\S]*email,/);
  assert.match(signInForm, /defaultValue=\{initialEmail\}/);
  assert.match(signInForm, /authenticationFormPath\("\/sign-up", \{[\s\S]*email: initialEmail/);
  assert.match(signUpForm, /defaultValue=\{initialEmail\}/);
  assert.doesNotMatch(signUpForm, /readOnly/);
});
