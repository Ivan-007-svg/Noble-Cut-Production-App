export function calculateMustBeReadyBy(deliveryDateStr, bufferDays = 2) {
  const deliveryDate = new Date(deliveryDateStr);
  const mbrDate = new Date(deliveryDate);
  mbrDate.setDate(deliveryDate.getDate() - bufferDays);
  return mbrDate.toISOString().split('T')[0]; // Format: YYYY-MM-DD
}

