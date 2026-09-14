// Working-period boundaries and appointment starts sit on a fixed 15-minute
// grid. Treatment and add-on durations are any whole number of minutes, so an
// appointment may end off the grid. PostgreSQL enforces the grid on
// availability_rule and in create_validated_booking_hold.
export const APPOINTMENT_GRID_MINUTES = 15;

export function isOnAppointmentGrid(localTime) {
  const [hours, minutes] = String(localTime).split(":").map(Number);

  return (
    Number.isInteger(hours) &&
    Number.isInteger(minutes) &&
    minutes % APPOINTMENT_GRID_MINUTES === 0
  );
}
