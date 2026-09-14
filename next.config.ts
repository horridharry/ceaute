import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/provider/onboarding",
        destination: "/dashboard/onboarding",
        permanent: false,
      },
      {
        source: "/provider/profile",
        destination: "/dashboard/page",
        permanent: false,
      },
      {
        source: "/provider/setup",
        destination: "/dashboard/onboarding",
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
        destination: "/dashboard/groups",
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
        destination: "/dashboard/page/portfolio",
        permanent: false,
      },
      {
        source: "/provider/page/preview",
        destination: "/dashboard/page/preview",
        permanent: false,
      },
      {
        source: "/provider/page",
        destination: "/dashboard/page",
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
