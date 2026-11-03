import { describe, expect, it } from "vitest";
import { blockedMinutes, clientIp, MAX_LOGIN_FAILURES } from "./login-limit";

const now = new Date("2026-11-01T12:00:00Z");
const minutesAgo = (m: number) => new Date(now.getTime() - m * 60000);

describe("blockedMinutes", () => {
  it("no bloquea con menos fallos que el máximo", () => {
    expect(blockedMinutes([minutesAgo(1), minutesAgo(2), minutesAgo(3), minutesAgo(4)], now)).toBe(0);
  });

  it("bloquea al llegar al máximo hasta que vence el quinto más reciente", () => {
    const failures = [1, 2, 3, 4, 10].map(minutesAgo);
    expect(failures).toHaveLength(MAX_LOGIN_FAILURES);
    expect(blockedMinutes(failures, now)).toBe(5);
  });

  it("ignora los fallos fuera de la ventana", () => {
    expect(blockedMinutes([1, 2, 3, 4, 15, 20].map(minutesAgo), now)).toBe(0);
  });

  it("con más fallos cuenta desde el quinto más reciente", () => {
    expect(blockedMinutes([1, 2, 3, 4, 5, 14].map(minutesAgo), now)).toBe(10);
  });

  it("nunca devuelve menos de un minuto estando bloqueado", () => {
    const failures = [1, 2, 3, 4].map(minutesAgo).concat(new Date(now.getTime() - 14.99 * 60000));
    expect(blockedMinutes(failures, now)).toBe(1);
  });
});

describe("clientIp", () => {
  it("prefiere x-real-ip", () => {
    expect(clientIp(new Headers({ "x-real-ip": "1.2.3.4", "x-forwarded-for": "5.6.7.8" }))).toBe("1.2.3.4");
  });

  it("usa la primera de x-forwarded-for", () => {
    expect(clientIp(new Headers({ "x-forwarded-for": "5.6.7.8, 10.0.0.1" }))).toBe("5.6.7.8");
  });

  it("sin headers devuelve un valor fijo", () => {
    expect(clientIp(new Headers())).toBe("desconocida");
  });
});
