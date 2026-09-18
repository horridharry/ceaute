import { Select } from "@/components/ui/field";

// Duration is a select and never free text. Every option is a multiple of 15
// minutes, which is what guarantees a treatment or add-on can never misalign
// with the product's 15-minute slot grid (01-foundations.md "Fixed product
// constants"). The same control handles an add-on's "adds to time" by starting
// at 0 instead of 15.
export const DURATION_STEP_MINUTES = 15;
export const TREATMENT_MAX_MINUTES = 480;
export const ADD_ON_MAX_MINUTES = 120;

export function formatDurationOption(minutes) {
  const total = Number(minutes ?? 0);
  const hours = Math.floor(total / 60);
  const remainder = total % 60;

  if (hours && remainder) return `${hours}h ${remainder}m`;
  if (hours) return `${hours}h`;
  return `${remainder}m`;
}

export function durationOptions({
  min = DURATION_STEP_MINUTES,
  max = TREATMENT_MAX_MINUTES,
  step = DURATION_STEP_MINUTES,
} = {}) {
  const options = [];
  for (let minutes = min; minutes <= max; minutes += step) {
    options.push(minutes);
  }
  return options;
}

export function DurationSelect({
  min = DURATION_STEP_MINUTES,
  max = TREATMENT_MAX_MINUTES,
  step = DURATION_STEP_MINUTES,
  zeroLabel = "No extra time",
  label = "Duration",
  ...selectProps
}) {
  return (
    <Select label={label} {...selectProps}>
      {durationOptions({ min, max, step }).map((minutes) => (
        <option key={minutes} value={minutes}>
          {minutes === 0 ? zeroLabel : formatDurationOption(minutes)}
        </option>
      ))}
    </Select>
  );
}

// An add-on may add nothing to the appointment, so its range starts at zero.
export function AddOnDurationSelect(props) {
  return (
    <DurationSelect
      min={0}
      max={ADD_ON_MAX_MINUTES}
      label="Adds to time"
      {...props}
    />
  );
}
