import { isTimestamp, isRecord } from "./utils";
import { describe, test, expect } from "bun:test";

const timestampTestCases: [string, boolean][] = [
  // From the RFC
  ["1985-04-12T23:20:50.52Z", true],
  ["1990-12-31T23:59:60Z", true],
  ["1990-12-31T15:59:60-08:00", true],
  ["1937-01-01T12:00:27.87+00:20", true],

  // T and Z can be t or z
  ["1985-04-12t23:20:50.52z", true],

  // From http://henry.precheur.org/python/rfc3339
  ["2008-04-02T20:00:00Z", true],
  ["1970-01-01T00:00:00Z", true],

  // https://github.com/chronotope/chrono/blob/main/src/format/parse.rs
  ["2015-01-20T17:35:20-08:00", true], // normal case
  ["1944-06-06T04:04:00Z", true], // D-day
  ["2001-09-11T09:45:00-08:00", true],
  ["2015-01-20T17:35:20.001-08:00", true],
  ["2015-01-20T17:35:20.000031-08:00", true],
  ["2015-01-20T17:35:20.000000004-08:00", true],
  ["2015-01-20T17:35:20.000000000452-08:00", true], // too small
  ["2015-02-30T17:35:20-08:00", false], // bad day of month
  ["2015-01-20T25:35:20-08:00", false], // bad hour
  ["2015-01-20T17:65:20-08:00", false], // bad minute
  ["2015-01-20T17:35:90-08:00", false], // bad second

  // Ensure the regex is anchored
  ["x1985-04-12T23:20:50.52Zx", false],
  ["1985-04-12T23:20:50.52Zx", false],

  // Unhandled in original code, invalid month
  ["1990-00-31T23:59:60Z", false],
];

describe("isTimestamp()", () => {
  for (const [time, expected] of timestampTestCases) {
    test(`correctly validates: ${time}`, () => {
      expect(isTimestamp(time)).toBe(expected);
    });
  }
});

test("isRecord()", () => {
  expect(isRecord({})).toBeTrue();
  expect(isRecord({ foo: null })).toBeTrue();
  expect(isRecord(null)).toBeFalse();
  expect(isRecord(undefined)).toBeFalse();
  expect(isRecord(0)).toBeFalse();
  expect(isRecord(1)).toBeFalse();
  expect(isRecord(0n)).toBeFalse();
  expect(isRecord(1n)).toBeFalse();
  expect(isRecord(false)).toBeFalse();
  expect(isRecord(true)).toBeFalse();
  expect(isRecord("")).toBeFalse();
  expect(isRecord("string")).toBeFalse();
  expect(isRecord([])).toBeFalse();
  expect(isRecord([true])).toBeFalse();
});
