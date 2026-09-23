"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { FormError } from "@/components/ui/form-feedback";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { keepFormValuesOnSubmit } from "@/lib/forms/keep-form-values";
import { submitBookingReview } from "../actions";

export function ReviewForm({ bookingId }) {
  const [state, formAction, pending] = useActionState(submitBookingReview, null);
  const ratingError = state?.field === "rating" ? state.message : "";

  return (
    <form action={formAction} onSubmit={keepFormValuesOnSubmit(formAction)} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="booking_id" value={bookingId} />
      <Field label="Rating" htmlFor="rating" error={ratingError}>
        {(control) => (
          <Select {...control} name="rating" defaultValue="">
            <option value="">Choose a rating</option>
            <option value="5">5 stars</option>
            <option value="4">4 stars</option>
            <option value="3">3 stars</option>
            <option value="2">2 stars</option>
            <option value="1">1 star</option>
          </Select>
        )}
      </Field>
      <Field label="Comment" htmlFor="comment" optional hint="Up to 1,000 characters.">
        {(control) => <Textarea {...control} name="comment" maxLength={1000} rows={4} className="resize-none" />}
      </Field>
      <FormError>{state?.status === "error" && !ratingError ? state.message : ""}</FormError>
      <Button type="submit" disabled={pending} aria-busy={pending || undefined} className="w-max">
        {pending ? "Saving…" : "Submit review"}
      </Button>
    </form>
  );
}
