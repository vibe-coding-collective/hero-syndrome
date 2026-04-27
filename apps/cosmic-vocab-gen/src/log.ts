export function log(message: string): void {
  const ts = new Date().toISOString();
  console.log(`[${ts}] ${message}`);
}

export function fmt(n: number, digits = 2): string {
  return n.toFixed(digits);
}
