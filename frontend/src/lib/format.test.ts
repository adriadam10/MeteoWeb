import { describe, expect, it } from "vitest";
import { compassIndex, toKmh } from "./format";

describe("compassIndex", () => {
  it.each([
    [0, 0],
    [11, 0],
    [12, 1],
    [180, 8],
    [340, 15],
    [355, 0],
    [-10, 0],
  ])("%d° → point %d", (degrees, expected) => {
    expect(compassIndex(degrees)).toBe(expected);
  });
});

describe("toKmh", () => {
  it("converts m/s and keeps nulls", () => {
    expect(toKmh(10)).toBeCloseTo(36);
    expect(toKmh(null)).toBeNull();
  });
});
