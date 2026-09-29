import { describe, expect, it } from "vitest";
import { parseAmount } from "./parse-amount";

describe("parseAmount", () => {
  it.each([
    ["50.000", 50000],
    ["1.500.000,50", 1500000.5],
    ["1500.5", 1500.5],
    ["$ 200000", 200000],
    ["-1.000", -1000],
    ["1.500,50", 1500.5],
  ])("interpreta %j como %d", (input, expected) => {
    expect(parseAmount(input)).toBe(expected);
  });

  it.each(["", "  ", "abc"])("devuelve null para %j", (input) => {
    expect(parseAmount(input)).toBeNull();
  });
});
