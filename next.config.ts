import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Images reach the server as Server Action form data, and Next's default
      // ceiling for that is 1 MB — below the 10 MB an inspiration image and the
      // 5 MB a portfolio image are each allowed to be, so without this the
      // limits the product states could never actually be used. The headroom
      // over 10 MB is multipart overhead and the few small fields beside the
      // file. The real per-image limits stay where they are enforced: on the
      // Storage buckets and in the database.
      bodySizeLimit: "11mb",
    },
  },
  async redirects() {
    return [
      {
        source: "/provider/onboarding",
        destination: "/dashboard/onboarding",
        permanent: false,
      },
      {
        source: "/provider/profile",
        destination: "/dashboard/profile",
        permanent: false,
      },
      {
        source: "/provider/setup",
        destination: "/dashboard/onboarding",
        permanent: false,
      },
      {
        source: "/dashboard/page/portfolio",
        destination: "/dashboard/profile/portfolio",
        permanent: false,
      },
      {
        source: "/dashboard/page/preview",
        destination: "/dashboard/profile/preview",
        permanent: false,
      },
      {
        source: "/dashboard/page",
        destination: "/dashboard/profile",
        permanent: false,
      },
      {
        source: "/dashboard/groups/new",
        destination: "/dashboard/treatment-groups/new",
        permanent: false,
      },
      {
        source: "/dashboard/groups/:groupId/edit",
        destination: "/dashboard/treatment-groups/:groupId/edit",
        permanent: false,
      },
      {
        source: "/dashboard/groups",
        destination: "/dashboard/treatment-groups",
        permanent: false,
      },
      {
        source: "/provider/bookings/:bookingId",
        destination: "/dashboard/bookings/:bookingId",
        permanent: false,
      },
      {
        source: "/provider/bookings",
        destination: "/dashboard/bookings",
        permanent: false,
      },
      {
        source: "/provider/treatments/add-ons/update/:addOnId",
        destination: "/dashboard/add-ons/:addOnId/edit",
        permanent: false,
      },
      {
        source: "/provider/treatments/add-ons/create",
        destination: "/dashboard/add-ons/new",
        permanent: false,
      },
      {
        source: "/provider/treatments/add-ons",
        destination: "/dashboard/add-ons",
        permanent: false,
      },
      {
        source: "/provider/treatments/groups",
        destination: "/dashboard/treatment-groups",
        permanent: false,
      },
      {
        source: "/provider/treatments/update/:treatmentId",
        destination: "/dashboard/treatments/:treatmentId/edit",
        permanent: false,
      },
      {
        source: "/provider/treatments/create",
        destination: "/dashboard/treatments/new",
        permanent: false,
      },
      {
        source: "/provider/treatments",
        destination: "/dashboard/treatments",
        permanent: false,
      },
      {
        source: "/provider/availability",
        destination: "/dashboard/availability",
        permanent: false,
      },
      {
        source: "/provider/page/location",
        destination: "/dashboard/locations",
        permanent: false,
      },
      {
        source: "/provider/page/portfolio",
        destination: "/dashboard/profile/portfolio",
        permanent: false,
      },
      {
        source: "/provider/page/preview",
        destination: "/dashboard/profile/preview",
        permanent: false,
      },
      {
        source: "/provider/page",
        destination: "/dashboard/profile",
        permanent: false,
      },
      {
        source: "/provider/settings/booking",
        destination: "/dashboard/settings/booking",
        permanent: false,
      },
      {
        source: "/provider/settings/payments",
        destination: "/dashboard/settings/payments",
        permanent: false,
      },
      {
        source: "/provider/settings",
        destination: "/dashboard/settings",
        permanent: false,
      },
      {
        source: "/provider",
        destination: "/dashboard",
        permanent: false,
      },
      {
        source: "/:username/booking/:treatmentId/details",
        destination: "/:username/book/:treatmentId/checkout",
        permanent: false,
      },
      {
        source: "/:username/booking/:treatmentId",
        destination: "/:username/book/:treatmentId/time",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
