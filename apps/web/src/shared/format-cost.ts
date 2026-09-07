export function formatCostUsd(value: number, locale: string) {
  const minimum = 0.000001;
  const formatted = new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 4,
    maximumFractionDigits: 6,
  }).format(value > 0 && value < minimum ? minimum : value);
  return value > 0 && value < minimum ? `<${formatted}` : formatted;
}
