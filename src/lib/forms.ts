import { z } from "zod";
import { parseAmount } from "./parse-amount";

/** Convierte FormData en objeto: los campos vacíos pasan a undefined. */
export function formToObject(formData: FormData) {
  const obj: Record<string, string | undefined> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value !== "string" || key.startsWith("$ACTION")) continue;
    obj[key] = value.trim() === "" ? undefined : value.trim();
  }
  return obj;
}

// Acepta "1.500.000,50", "50.000" o "1500000.50".
const toAmount = (v: unknown) => (typeof v === "string" ? (parseAmount(v) ?? NaN) : v);

export const zMoney = z.preprocess(toAmount, z.number({ error: "Monto inválido" }).finite());
export const zMoneyOpt = z.preprocess(toAmount, z.number({ error: "Monto inválido" }).finite()).optional();
export const zIntOpt = z.coerce.number().int().positive().optional();
export const zDate = z.string({ error: "Fecha requerida" }).regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida");
export const zText = z.string().max(2000).optional();

export function firstError(error: z.ZodError) {
  const issue = error.issues[0];
  return issue ? `${issue.path.join(".") || "Dato"}: ${issue.message}` : "Datos inválidos";
}
