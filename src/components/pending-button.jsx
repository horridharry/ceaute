"use client";

import { PendingButton as SharedPendingButton } from "./ui/pending-button";

// Kept at this path so its existing consumers, including checkout, need no
// edits: the shared PendingButton with no styling of its own, exactly as
// this component always behaved. New code imports @/components/ui/pending-button.
export function PendingButton(props) {
  return <SharedPendingButton unstyled {...props} />;
}
