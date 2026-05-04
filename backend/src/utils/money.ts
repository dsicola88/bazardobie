import { Decimal } from "@prisma/client/runtime/library";

export function toDecimal(n: number | string): Decimal {
  return new Decimal(typeof n === "string" ? n : String(n));
}

export function decimalToNumber(d: Decimal): number {
  return d.toNumber();
}
