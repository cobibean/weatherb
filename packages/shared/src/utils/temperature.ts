export function celsiusToFahrenheitTenths(celsius: number): number {
  const fahrenheit = (celsius * 9) / 5 + 32;
  return Math.round(fahrenheit * 10);
}

export function fahrenheitTenthsToDisplay(tenths: number): number {
  return Math.round(tenths / 10);
}
