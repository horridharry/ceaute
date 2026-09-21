const DAYS_BY_NAME = {
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
  sunday: 0,
};

const NAMES_BY_DAY = Object.fromEntries(
  Object.entries(DAYS_BY_NAME).map(([name, value]) => [value, name]),
);

export function weekdayNameToNumber(name) {
  return DAYS_BY_NAME[name] ?? null;
}

export function weekdayNumberToName(day) {
  return NAMES_BY_DAY[day] ?? null;
}
