// Maps the outcome of ceaute.transition_treatment_add_on and
// ceaute.transition_treatment_group (202609220002) to what the provider sees.
// PostgreSQL decides which transitions are allowed; these messages only
// explain its answer. Anything it did not anticipate becomes a generic
// message rather than raw database text.

export const TRANSITIONS = ["archive", "restore", "delete"];

const PAST_TENSE = {
  archive: "archived",
  restore: "restored",
  delete: "deleted",
};

// Where the record went, so the provider knows which filter to look in.
const WHERE_NOW = {
  archive: " Find it under Archived.",
  restore: " Find it under Active.",
  delete: "",
};

export function isTransition(value) {
  return TRANSITIONS.includes(value);
}

function transitionSuccess(transition, name) {
  return {
    status: "done",
    message: `${name} ${PAST_TENSE[transition]}.${WHERE_NOW[transition]}`,
  };
}

// 'unchanged' (a repeated request) is reported like the first success: the
// record is in the state the provider asked for.
export function addOnTransitionOutcome({ transition, name, error }) {
  if (!error) {
    return transitionSuccess(transition, name);
  }

  if (error.code === "CE010") {
    return {
      status: "error",
      message:
        transition === "delete"
          ? "Archive this add-on before deleting it."
          : "That change isn’t available for this add-on.",
    };
  }

  if (error.code === "CE002") {
    return { status: "error", message: "That add-on no longer exists." };
  }

  return {
    status: "error",
    message: `Couldn’t ${transition} ${name}. Try again in a moment.`,
  };
}

export function groupTransitionOutcome({ transition, name, error }) {
  if (!error) {
    return transitionSuccess(transition, name);
  }

  if (error.code === "CE011") {
    return { status: "blocked", message: "" };
  }

  if (error.code === "CE010") {
    return {
      status: "error",
      message:
        transition === "delete"
          ? "Archive this group before deleting it."
          : "That change isn’t available for this group.",
    };
  }

  if (error.code === "CE012") {
    return { status: "error", message: "That treatment group no longer exists." };
  }

  return {
    status: "error",
    message: `Couldn’t ${transition} ${name}. Try again in a moment.`,
  };
}

const pluralise = (count, word) => `${count} ${word}${count === 1 ? "" : "s"}`;

// The explanation shown when a group still has treatments. Archived
// treatments count, because they still point at the group.
export function blockedGroupMessage({ transition, name, treatments }) {
  const total = treatments.length;
  const archived = treatments.filter((treatment) => !treatment.is_active).length;
  const contents =
    archived === total
      ? pluralise(archived, "archived treatment")
      : `${pluralise(total, "treatment")}${archived ? `, including ${archived} archived` : ""}`;

  return {
    title: `${name} can’t be ${transition === "delete" ? "deleted" : "archived"} yet`,
    body: `It still contains ${contents}. Move each one to another group or to No group, then try again.`,
  };
}
