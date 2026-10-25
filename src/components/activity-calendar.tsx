import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { ActivityList, type ActivityListContext } from "@/components/activity-list";
import { CalendarChip, CalendarDay } from "@/components/calendar-dnd";
import { Button } from "@/components/ui/button";
import type { ActivityRow } from "@/lib/activities";
import { ACTIVITY_COLOR_CLASSES, activityColor } from "@/lib/activity-bucket";
import { monthGrid, monthLabel, shiftMonth, WEEKDAY_LABELS } from "@/lib/calendar";
import { ACTIVITY_TYPE_LABELS } from "@/lib/constants";
import { cn } from "@/lib/utils";

const LEGEND = [
  { color: "red", label: "Vencida" },
  { color: "yellow", label: "Vence hoy" },
  { color: "green", label: "Planificada" },
  { color: "done", label: "Hecha" },
] as const;

/** Calendario mensual de la agenda (lunes a domingo), con colores de Odoo y arrastrar para reprogramar. */
export function ActivityCalendar({
  month,
  rows,
  ctx,
  hrefFor,
}: {
  month: string;
  rows: ActivityRow[];
  ctx: ActivityListContext;
  /** Link a otro mes conservando los filtros. */
  hrefFor: (month: string) => string;
}) {
  const weeks = monthGrid(month);
  const byDay = new Map<string, ActivityRow[]>();
  for (const r of rows) {
    const list = byDay.get(r.activity.dueDate) ?? [];
    list.push(r);
    byDay.set(r.activity.dueDate, list);
  }
  const name = (id: string) => ctx.names.get(id) ?? "—";

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="icon-sm" asChild>
          <Link href={hrefFor(shiftMonth(month, -1))} aria-label="Mes anterior">
            <ChevronLeft />
          </Link>
        </Button>
        <h2 className="min-w-40 text-center text-lg font-semibold">{monthLabel(month)}</h2>
        <Button variant="outline" size="icon-sm" asChild>
          <Link href={hrefFor(shiftMonth(month, 1))} aria-label="Mes siguiente">
            <ChevronRight />
          </Link>
        </Button>
        <Button variant="ghost" size="sm" asChild>
          <Link href={hrefFor(ctx.today.slice(0, 7))}>Hoy</Link>
        </Button>
        <div className="ml-auto flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          {LEGEND.map((l) => (
            <span key={l.color} className="flex items-center gap-1">
              <span className={cn("inline-block size-2.5 rounded-full", ACTIVITY_COLOR_CLASSES[l.color].dot)} />
              {l.label}
            </span>
          ))}
          <span className="hidden lg:inline">· Arrastrá una actividad a otro día para reprogramarla</span>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border bg-card shadow-[var(--surface-shadow)]">
        <div className="grid min-w-[56rem] grid-cols-7">
          {WEEKDAY_LABELS.map((d) => (
            <div key={d} className="border-b bg-muted/40 px-2 py-1.5 text-xs font-medium text-muted-foreground">
              {d}
            </div>
          ))}
          {weeks.flat().map((day, i) => {
            const inMonth = day.startsWith(month);
            const isToday = day === ctx.today;
            const items = byDay.get(day) ?? [];
            return (
              <CalendarDay
                key={day}
                date={day}
                className={cn(
                  "grid min-h-28 content-start gap-1 border-b p-1.5 transition-colors",
                  i % 7 !== 6 && "border-r",
                  !inMonth && "bg-muted/30",
                )}
              >
                <span
                  className={cn(
                    "justify-self-end px-1 text-xs tabular-nums",
                    !inMonth && "text-muted-foreground/60",
                    isToday && "rounded-full bg-primary px-1.5 font-semibold text-primary-foreground",
                  )}
                >
                  {Number(day.slice(8))}
                </span>
                {items.map((r) => {
                  const a = r.activity;
                  const done = Boolean(a.doneAt);
                  const color = activityColor(a.dueDate, ctx.today, done);
                  const who = ctx.showAssignee ? `${name(a.assignedTo)}: ` : "";
                  return (
                    <CalendarChip
                      key={a.id}
                      id={a.id}
                      date={a.dueDate}
                      draggable={!done}
                      className={ACTIVITY_COLOR_CLASSES[color].chip}
                      title={`${ACTIVITY_TYPE_LABELS[a.type]} · ${who}${a.title}`}
                      label={
                        <>
                          {who && <span className="font-semibold">{who}</span>}
                          {a.title}
                        </>
                      }
                    >
                      <ActivityList rows={[r]} ctx={ctx} />
                    </CalendarChip>
                  );
                })}
              </CalendarDay>
            );
          })}
        </div>
      </div>
    </div>
  );
}
