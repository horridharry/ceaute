import { getBookingSettings, updateBookingSettings } from "./actions";
import { BookingSettingsForm } from "./_components/booking-settings-form";

export default async function Page() {
  const settings = await getBookingSettings();

  return (
    <BookingSettingsForm
      settings={settings}
      updateBookingSettings={updateBookingSettings}
    />
  );
}
