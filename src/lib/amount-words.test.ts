import { describe, expect, it } from "vitest";
import { amountInWords, integerToWords } from "./amount-words";

describe("integerToWords", () => {
  it.each([
    [0, "cero"],
    [1, "un"],
    [15, "quince"],
    [16, "dieciséis"],
    [21, "veintiún"],
    [31, "treinta y un"],
    [100, "cien"],
    [101, "ciento un"],
    [999, "novecientos noventa y nueve"],
    [1000, "mil"],
    [21000, "veintiún mil"],
    [120500, "ciento veinte mil quinientos"],
    [1_000_000, "un millón"],
    [2_500_000, "dos millones quinientos mil"],
    [1_234_567, "un millón doscientos treinta y cuatro mil quinientos sesenta y siete"],
    [1_000_000_000, "mil millones"],
  ])("%i → %s", (n, words) => {
    expect(integerToWords(n)).toBe(words);
  });

  it("rechaza negativos y no enteros", () => {
    expect(() => integerToWords(-1)).toThrow();
    expect(() => integerToWords(1.5)).toThrow();
  });
});

describe("amountInWords", () => {
  it("formato Pesos … con NN/100", () => {
    expect(amountInWords(120500.5)).toBe("Pesos ciento veinte mil quinientos con 50/100");
    expect(amountInWords(1234567.89)).toBe(
      "Pesos un millón doscientos treinta y cuatro mil quinientos sesenta y siete con 89/100",
    );
  });

  it("centavos 0 y 5", () => {
    expect(amountInWords(1000)).toBe("Pesos mil con 00/100");
    expect(amountInWords(1.05)).toBe("Pesos un con 05/100");
    expect(amountInWords(0)).toBe("Pesos cero con 00/100");
  });

  it("redondea a centavos sin errores de coma flotante", () => {
    expect(amountInWords(0.1 + 0.2)).toBe("Pesos cero con 30/100");
    expect(amountInWords(99.999)).toBe("Pesos cien con 00/100");
  });

  it("rechaza negativos", () => {
    expect(() => amountInWords(-5)).toThrow();
    expect(() => amountInWords(Number.NaN)).toThrow();
  });
});
