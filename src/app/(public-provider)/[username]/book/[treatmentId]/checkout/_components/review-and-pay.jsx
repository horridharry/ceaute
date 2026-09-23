"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { buttonClassName } from "@/components/ui/button-classes";
import { Field } from "@/components/ui/field";
import { FormError } from "@/components/ui/form-feedback";
import { Input } from "@/components/ui/input";
import { Notice } from "@/components/ui/notice";
import { keepFormValuesOnSubmit } from "@/lib/forms/keep-form-values";
import { continueToPayment } from "../../../actions";
import { BookingSummaryCard, CancellationBlock, PaymentBlock } from "./booking-summary";
import { CheckoutFinePrint } from "./checkout-fine-print";

// Review and pay (approved 23 September 2026): readable before signing in,
// one screen before Stripe, saved contact details as one line with Change,
// and a single action that holds the time and opens payment.
export function ReviewAndPay({
  provider,
  appointment,
  lines,
  money,
  cancellation,
  signedIn,
  contact,
  hidden,
  links,
}) {
  const [state, formAction, pending] = useActionState(continueToPayment, null);
  const [editingDetails, setEditingDetails] = useState(contact?.missing ?? false);
  const fieldErrors = state?.fieldErrors ?? {};
  const showDetailFields = editingDetails || Boolean(state?.needsDetails) || Boolean(fieldErrors.full_name || fieldErrors.phone);
  const unavailable = !money || state?.status === "unavailable";

  return (
    <>
      <div className="mt-6">
        <BookingSummaryCard provider={provider} appointment={appointment} lines={lines} />
      </div>

      {money ? (
        <>
          <div className="mt-8">
            <PaymentBlock money={money} providerName={provider.name} />
          </div>
          <div className="mt-8">
            <CancellationBlock cancellation={cancellation} providerName={provider.name} />
          </div>
        </>
      ) : null}

      {unavailable ? (
        <Notice tone="neutral" className="mt-8">
          {provider.name} isn’t taking online bookings right now. Nothing has been charged.
        </Notice>
      ) : !signedIn ? (
        <div className="sticky bottom-0 -mx-5 mt-8 border-t border-line bg-surface px-5 pb-[calc(12px+env(safe-area-inset-bottom,0px))] pt-3 sm:static sm:mx-0 sm:border-0 sm:p-0">
          <div className="flex items-center justify-between gap-3">
            <p className="flex flex-col tabular-nums">
              <span className="text-xs text-ink-muted">Pay now</span>
              <span className="text-base font-semibold">{money.dueNow}</span>
            </p>
            <Link href={links.signIn} className={buttonClassName({ variant: "primary" })}>
              Log in to book
            </Link>
          </div>
          <p className="mt-2 text-xs text-ink-muted">
            New to Ceaute?{" "}
            <Link href={links.signUp} className="font-semibold text-accent">
              Create an account
            </Link>
            . Your choices are kept.
          </p>
        </div>
      ) : (
        <form action={formAction} onSubmit={keepFormValuesOnSubmit(formAction)} className="mt-8" noValidate>
          {Object.entries(hidden).map(([name, value]) =>
            Array.isArray(value)
              ? value.map((item) => <input key={`${name}-${item}`} type="hidden" name={name} value={item} />)
              : <input key={name} type="hidden" name={name} value={value} />,
          )}

          <section aria-labelledby="details-heading">
            <h2 id="details-heading" className="text-lg font-semibold tracking-tight">
              Your details
            </h2>
            {showDetailFields ? (
              <div className="mt-3 flex flex-col gap-4">
                <p className="text-sm text-ink-muted">
                  {provider.name} uses these to contact you about this booking. We save them to your account.
                </p>
                <Field label="Full name" htmlFor="full_name" error={fieldErrors.full_name ?? ""}>
                  {(control) => (
                    <Input {...control} name="full_name" autoComplete="name" defaultValue={contact?.name ?? ""} />
                  )}
                </Field>
                <Field
                  label="Mobile number"
                  htmlFor="phone"
                  hint="A UK number."
                  error={fieldErrors.phone ?? ""}
                >
                  {(control) => (
                    <Input {...control} name="phone" type="tel" autoComplete="tel" defaultValue={contact?.phone ?? ""} />
                  )}
                </Field>
              </div>
            ) : (
              <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-line px-4 py-3">
                <div className="min-w-0 text-sm">
                  <p className="font-medium">{contact.name}</p>
                  <p className="truncate text-ink-muted">
                    {contact.phoneDisplay} · {contact.email}
                  </p>
                </div>
                <Button type="button" variant="text" onClick={() => setEditingDetails(true)}>
                  Change<span className="sr-only"> your details</span>
                </Button>
              </div>
            )}
          </section>

          {state?.status === "own_hold" ? (
            <Notice className="mt-6" role="alert">
              You already have a booking in progress at this time.{" "}
              <Link href={state.holdHref} className="font-semibold underline underline-offset-2">
                Go to it
              </Link>
              , or choose another time.
            </Notice>
          ) : null}
          <FormError className="mt-4">{state?.formError ?? ""}</FormError>

          <div className="sticky bottom-0 -mx-5 mt-8 border-t border-line bg-surface px-5 pb-[calc(12px+env(safe-area-inset-bottom,0px))] pt-3 sm:static sm:mx-0 sm:border-0 sm:p-0">
            <div className="flex items-center justify-between gap-3">
              <p className="flex flex-col tabular-nums">
                <span className="text-xs text-ink-muted">Pay now</span>
                <span className="text-base font-semibold">{money.dueNow}</span>
              </p>
              <Button type="submit" disabled={pending} aria-busy={pending || undefined}>
                {pending ? "Opening payment…" : "Continue to payment"}
              </Button>
            </div>
          </div>
        </form>
      )}

      {unavailable ? null : <CheckoutFinePrint className="mt-3" />}
    </>
  );
}
