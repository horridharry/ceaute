import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { processBookingRefund } from "./refunds";

// Scheduled recovery for refund operations whose synchronous driver failed.
// PostgreSQL chooses the operations and still leases each one through
// claim_booking_refund_operation, so this loop cannot create a duplicate
// Stripe refund; it only gives stuck operations another turn. One failing
// operation must not stop the rest of the batch.
export async function recoverStuckBookingRefunds({
  limit = 25,
  supabase = createServiceRoleClient(),
  processRefund = processBookingRefund,
} = {}) {
  const { data: operations, error } = await supabase.schema("ceaute").rpc(
    "list_retryable_booking_refund_operations",
    {
      max_operations: limit,
    },
  );

  if (error) {
    throw new Error("Could not list retryable refund operations.");
  }

  const summary = {
    listed: operations?.length ?? 0,
    outcomes: {},
    failed: 0,
  };

  for (const operation of operations ?? []) {
    try {
      const result = await processRefund(operation.refund_operation_id, {
        supabase,
      });
      summary.outcomes[result.action] = (summary.outcomes[result.action] ?? 0) + 1;
    } catch (processingError) {
      summary.failed += 1;
      console.error("Refund recovery failed for an operation", {
        refundOperationId: operation.refund_operation_id,
        message:
          processingError instanceof Error
            ? processingError.message
            : "Refund processing failed.",
      });
    }
  }

  return summary;
}
