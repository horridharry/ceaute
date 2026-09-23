import { cache } from "react";

// The provider's setup, derived from one PostgreSQL breakdown
// (ceaute.get_provider_page_publication_checks). The publish rule itself is
// built on the same breakdown, so the setup guide, Today and Settings →
// Publication cannot disagree with what publishing accepts. Nothing here is
// stored: a requirement that lapses on a draft simply shows up again.
//
// Four things stay separate:
//   setup complete    every task below is done
//   ready to publish  a draft whose setup is complete
//   published         the page's status, changed only on Publication
//   taking bookings   published, and PostgreSQL's
//                     provider_page_accepts_new_bookings holds
// A published page can stop taking bookings (an out-of-date agreement,
// booking terms saved before percentages, Stripe no longer ready, a balance
// owed) without being unpublished.

export const SETUP_TASKS = Object.freeze([
  {
    id: "profile",
    check: "has_business_profile",
    name: "Complete your business profile",
    detail: "Business name, username and category",
    href: "/dashboard/profile",
    cta: "Open Profile",
  },
  {
    id: "treatments",
    check: "has_bookable_treatment",
    name: "Add a treatment",
    detail: "With a category, a price of at least £1 and a duration",
    href: "/dashboard/treatments",
    cta: "Open Treatments",
  },
  {
    id: "portfolio",
    check: "has_visible_photo",
    name: "Add a photo of your work",
    detail: "At least one visible portfolio photo",
    href: "/dashboard/profile/portfolio",
    cta: "Open Portfolio",
  },
  {
    id: "location",
    check: "has_current_location",
    name: "Add where you work",
    detail: "Your current location and full address",
    href: "/dashboard/locations",
    cta: "Open Locations",
  },
  {
    id: "hours",
    check: "has_working_hours",
    name: "Set your working hours",
    detail: "At least one working day",
    href: "/dashboard/availability",
    cta: "Open Availability",
  },
  {
    id: "terms",
    check: "has_booking_terms",
    name: "Choose your booking terms",
    detail: "Full payment or deposit, a percentage and a cancellation window",
    href: "/dashboard/settings/booking",
    cta: "Open Booking settings",
  },
  {
    id: "payments",
    check: "payments_ready",
    name: "Connect Stripe",
    detail: "So Ceaute can pay you",
    href: "/dashboard/settings/payments",
    cta: "Open Payments",
  },
  {
    id: "agreement",
    check: "agreement_accepted",
    name: "Accept the provider agreement",
    detail: "Needed before you publish and take bookings",
    href: "/dashboard/settings/payments#provider-agreement",
    cta: "Read and accept",
  },
]);

// Why a live page is not taking new bookings, in the order a provider can act.
const PAUSE_REASONS = [
  { check: "agreement_accepted", taskId: "agreement", label: "Accept the current provider agreement" },
  { check: "has_booking_terms", taskId: "terms", label: "Choose a percentage in Booking settings" },
  { check: "payments_ready", taskId: "payments", label: "Finish setting up Stripe" },
];

export function describeSetup(checks) {
  if (!checks) {
    return null;
  }

  const tasks = SETUP_TASKS.map((task) => ({ ...task, done: checks[task.check] === true }));
  const doneCount = tasks.filter((task) => task.done).length;
  const setupComplete = doneCount === tasks.length;
  const status = checks.status ?? "draft";
  const published = status === "published";
  const acceptsNewBookings = published && checks.accepts_new_bookings === true;
  let pausedReasons = [];

  if (published && !acceptsNewBookings) {
    pausedReasons = PAUSE_REASONS.filter((reason) => checks[reason.check] !== true).map(
      (reason) => {
        const task = SETUP_TASKS.find((candidate) => candidate.id === reason.taskId);
        return { id: reason.taskId, label: reason.label, href: task.href };
      },
    );

    // Everything the page controls is in place, so what remains is a balance
    // owed to Ceaute, which the provider settles with Ceaute directly.
    if (pausedReasons.length === 0) {
      pausedReasons = [{ id: "balance", label: "Settle the outstanding balance with Ceaute", href: "" }];
    }
  }

  return {
    status,
    tasks,
    total: tasks.length,
    doneCount,
    nextTask: tasks.find((task) => !task.done) ?? null,
    setupComplete,
    readyToPublish: status === "draft" && checks.meets_publication_requirements === true,
    published,
    suspended: status === "suspended",
    acceptsNewBookings,
    pausedReasons,
    // The guide is for drafts that still have something to do. Published and
    // suspended pages never show it.
    showGuide: status === "draft" && !setupComplete,
  };
}

// One read per request, shared by the dashboard layout (the guide), Today and
// Publication.
export const getPublicationChecks = cache(async (supabase, providerPageId) => {
  const { data, error } = await supabase
    .schema("ceaute")
    .rpc("get_provider_page_publication_checks", {
      target_provider_page_id: providerPageId,
    });

  if (error) {
    throw new Error("Could not check your page's setup.", { cause: error });
  }

  return data?.[0] ?? null;
});

export async function getSetupState({ supabase, providerPage }) {
  return describeSetup(await getPublicationChecks(supabase, providerPage.id));
}
