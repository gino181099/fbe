import { describe, expect, it } from "vitest";
import { activityBucket } from "./activity-bucket";

describe("activityBucket", () => {
  const today = "2026-10-25";
  it("vencida si la fecha ya pasó", () => expect(activityBucket("2026-10-24", today)).toBe("vencida"));
  it("hoy", () => expect(activityBucket(today, today)).toBe("hoy"));
  it("próximos 7 días, incluido el séptimo", () => {
    expect(activityBucket("2026-10-26", today)).toBe("semana");
    expect(activityBucket("2026-11-01", today)).toBe("semana");
  });
  it("más adelante", () => expect(activityBucket("2026-11-02", today)).toBe("despues"));
  it("cruza fin de mes y de año", () => {
    expect(activityBucket("2027-01-02", "2026-12-30")).toBe("semana");
    expect(activityBucket("2026-12-31", "2027-01-01")).toBe("vencida");
  });
});
