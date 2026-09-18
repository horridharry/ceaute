"use client";

import { useEffect, useState } from "react";

// The held slot, sticky beneath the nav during a booking. A hairline row and a
// sentence, not a banner — no fill, no tint. The countdown ticks once a second
// with no animation, in tabular numerals so the row does not jitter.
//
// The hold itself is created and extended in the database
// (`create_validated_booking_hold`, then the Stripe Checkout expiry); this
// component only reads the expiry it is given.
function formatRemaining(milliseconds) {
  const total = Math.max(0, Math.ceil(milliseconds / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function HeldRow({ appointmentLabel, expiresAt, expiredLabel = "This time is no longer held" }) {
  const expiryTime = new Date(expiresAt).getTime();
  // Rendered on the server with no value, so the markup does not claim a
  // countdown the client has not measured yet.
  const [remaining, setRemaining] = useState(null);

  useEffect(() => {
    const update = () => setRemaining(Math.max(0, expiryTime - Date.now()));

    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [expiryTime]);

  const expired = remaining === 0;

  return (
    <div className="sticky top-0 z-30 border-b border-black/8 bg-white py-2.5">
      <p className="text-[13px] text-black/60" role="status">
        {expired ? (
          expiredLabel
        ) : (
          <>
            <span className="text-ink">{appointmentLabel}</span> is yours for{" "}
            <span className="font-medium tabular-nums text-plum">
              {remaining === null ? "" : `${formatRemaining(remaining)} min`}
            </span>
          </>
        )}
      </p>
    </div>
  );
}
