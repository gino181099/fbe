import { formatMoney } from "@/lib/format";
import { type MonthlyRow, formatMonth } from "@/lib/monthly";
import { cn } from "@/lib/utils";

type SeriesKey = "billed" | "collected" | "expenses" | "margin";

const SERIES: { key: SeriesKey; label: string; color: string }[] = [
  { key: "billed", label: "Facturado", color: "bg-primary" },
  { key: "collected", label: "Cobrado", color: "bg-emerald-600" },
  { key: "expenses", label: "Gastos", color: "bg-amber-500" },
  { key: "margin", label: "Margen", color: "bg-sky-500" },
];

const HEIGHT = 200; // px del área de barras

/** Barras agrupadas por mes (server component, sin librerías). Solo dibuja las series con valores (no `null`). */
export function MonthlyChart({ rows }: { rows: MonthlyRow[] }) {
  const visible = SERIES.filter((s) => rows.some((r) => r[s.key] != null));
  const values = rows.flatMap((r) => visible.map((s) => r[s.key] ?? 0));
  const maxPos = Math.max(0, ...values);
  const maxNeg = Math.max(0, ...values.map((v) => -v));
  const range = maxPos + maxNeg || 1;
  const posHeight = (HEIGHT * maxPos) / range;
  const negHeight = HEIGHT - posHeight;

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
        {visible.map((s) => (
          <span key={s.key} className="flex items-center gap-1.5">
            <span className={cn("size-3 rounded-sm", s.color)} />
            {s.label}
          </span>
        ))}
        {visible.some((s) => s.key === "margin") && maxNeg > 0 && (
          <span className="flex items-center gap-1.5">
            <span className="size-3 rounded-sm bg-red-600" />
            Margen negativo
          </span>
        )}
      </div>
      <div className="overflow-x-auto">
        <div className="flex min-w-[640px] gap-2">
          {rows.map((r) => (
            <div key={r.month} className="flex flex-1 flex-col items-stretch">
              <div className="flex items-end justify-center gap-0.5 border-b" style={{ height: posHeight }}>
                {visible.map((s) => {
                  const v = r[s.key] ?? 0;
                  return (
                    <div
                      key={s.key}
                      title={`${s.label} ${formatMonth(r.month)}: ${formatMoney(v)}`}
                      className={cn("w-full max-w-4 rounded-t-sm", s.color)}
                      style={{ height: v > 0 ? Math.max(1, (HEIGHT * v) / range) : 0 }}
                    />
                  );
                })}
              </div>
              {negHeight > 0 && (
                <div className="flex items-start justify-center gap-0.5" style={{ height: negHeight }}>
                  {visible.map((s) => {
                    const v = r[s.key] ?? 0;
                    return (
                      <div
                        key={s.key}
                        title={`${s.label} ${formatMonth(r.month)}: ${formatMoney(v)}`}
                        className={cn("w-full max-w-4 rounded-b-sm", v < 0 ? "bg-red-600" : "")}
                        style={{ height: v < 0 ? Math.max(1, (HEIGHT * -v) / range) : 0 }}
                      />
                    );
                  })}
                </div>
              )}
              <div className="mt-1 text-center text-xs whitespace-nowrap text-muted-foreground">
                {formatMonth(r.month)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
