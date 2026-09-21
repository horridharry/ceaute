import {
  minutesToDuration,
  nonNegativePriceToPence,
  penceToPrice,
} from "../../_lib/price-duration";

// Treatments must cost something, so zero is rejected as well.
export function priceToPence(value) {
  const pricePence = nonNegativePriceToPence(value);

  return pricePence ? pricePence : null;
}

export function treatmentToProviderTreatment(treatment) {
  const durationMinutes = Number(treatment.duration_minutes ?? 0);

  return {
    treatmentId: treatment.id,
    providerPageId: treatment.provider_page_id,
    name: treatment.name,
    description: treatment.description ?? "",
    price: penceToPrice(treatment.price_pence),
    price_pence: treatment.price_pence,
    duration: minutesToDuration(durationMinutes),
    duration_minutes: durationMinutes,
    discovery_category_id: treatment.discovery_category_id ?? "",
    discovery_category_name: treatment.discovery_category?.name ?? "",
    treatment_group_id: treatment.treatment_group_id ?? "",
    treatment_group_name: treatment.treatment_group?.name ?? "",
    is_active: Boolean(treatment.is_active),
    image_url: treatment.image_url ?? "",
    updated_at: treatment.updated_at,
  };
}
