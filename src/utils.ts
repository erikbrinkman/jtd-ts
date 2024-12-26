const timestampRegex =
  /^(\d{4})-(\d{2})-(\d{2})[tT](\d{2}):(\d{2}):(\d{2})(\.\d+)?([zZ]|((\+|-)(\d{2}):(\d{2})))$/;

/** true if string is a timestamp */
export function isTimestamp(inp: string): boolean {
  const matches = timestampRegex.exec(inp);
  if (!matches) return false;
  const [, year, month, day, hour, minute, second] = matches.map((match) =>
    parseInt(match)
  );
  return (
    0 < month &&
    month <= 12 &&
    day <= maxDay(year, month) &&
    hour < 24 &&
    minute < 60 &&
    second <= 60
  );
}

function maxDay(year: number, month: number) {
  if (month === 2) {
    return isLeapYear(year) ? 29 : 28;
  }

  return MONTH_LENGTHS[month - 1];
}

function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

const MONTH_LENGTHS = [
  31,
  0, // Feb is handled separately
  31,
  30,
  31,
  30,
  31,
  31,
  30,
  31,
  30,
  31,
];

/** guard for string records */
export function isRecord(inp: unknown): inp is Record<string, unknown> {
  return typeof inp === "object" && inp !== null && !Array.isArray(inp);
}

/** valid integer types */
export type IntType =
  | "int8"
  | "uint8"
  | "int16"
  | "uint16"
  | "int32"
  | "uint32";

export const intBounds: Readonly<Record<IntType, readonly [number, number]>> = {
  int8: [-128, 128],
  int16: [-32768, 32768],
  int32: [-2147483648, 2147483648],
  uint8: [0, 256],
  uint16: [0, 65536],
  uint32: [0, 4294967296],
} as const;
