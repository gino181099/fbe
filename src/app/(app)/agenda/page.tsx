import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays, CalendarPlus, List } from "lucide-react";
import { ActivityCalendar } from "@/components/activity-calendar";
import { ActivityFields } from "@/components/activity-fields";
import { ActivityList, type ActivityListContext } from "@/components/activity-list";
import { FormDialog } from "@/components/form-dialog";
import { PageHeader, StatCard } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { getActivities, getActivityLinkOptions } from "@/lib/activities";
import { ACTIVITY_BUCKET_LABELS, type ActivityBucket, activityBucket } from "@/lib/activity-bucket";
import { getUserNames, getUsers } from "@/lib/audit";
import { monthGrid, parseMonth } from "@/lib/calendar";
import { today } from "@/lib/format";
import { requireUser } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { saveActivity } from "./actions";

export const metadata: Metadata = { title: "Agenda" };

const str = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || undefined;
const BUCKETS: ActivityBucket[] = ["vencida", "hoy", "semana", "despues"];

export default async function AgendaPage({ searchParams }: PageProps<"/agenda">) {
  const user = await requireUser();
  const sp = await searchParams;
  // usuario: vacío = mías, "todos" = de todos, o el id de alguien.
  const who = str(sp.usuario);
  const isList = str(sp.vista) === "lista";
  const showDone = isList && str(sp.estado) === "hechas";
  const date = today();
  const month = parseMonth(str(sp.mes)) ?? date.slice(0, 7);
  const assignedTo = who === "todos" ? undefined : (who ?? user.id);
  const weeks = monthGrid(month);

  const [pending, listOrMonth, users, names, linkOptions] = await Promise.all([
    getActivities({ assignedTo, done: false }),
    isList
      ? showDone
        ? getActivities({ assignedTo, done: true })
        : null
      : getActivities({ assignedTo, from: weeks[0][0], to: weeks.at(-1)!.at(-1) }),
    getUsers(),
    getUserNames(),
    getActivityLinkOptions(),
  ]);
  const userOptions = users.map((u) => ({ id: u.id, name: u.name ?? u.username ?? "—" }));
  const ctx: ActivityListContext = {
    users: userOptions,
    names,
    currentUserId: user.id,
    today: date,
    linkOptions,
    showAssignee: assignedTo !== user.id,
  };
  const groups = new Map<ActivityBucket, typeof pending>(BUCKETS.map((b) => [b, []]));
  for (const r of pending) groups.get(activityBucket(r.activity.dueDate, date))!.push(r);
  const whose =
    assignedTo === user.id ? "Mis actividades" : assignedTo ? `Actividades de ${names.get(assignedTo) ?? "—"}` : "Actividades de todos";

  /** Link conservando los filtros actuales. */
  const href = (changes: Record<string, string | undefined>) => {
    const params = new URLSearchParams();
    const merged = { usuario: who, vista: isList ? "lista" : undefined, mes: sp.mes ? month : undefined, ...changes };
    for (const [k, v] of Object.entries(merged)) if (v) params.set(k, v);
    const qs = params.toString();
    return qs ? `/agenda?${qs}` : "/agenda";
  };

  return (
    <>
      <PageHeader
        title="Agenda"
        description={`${whose}: lo que hay que hacer, para cuándo y de quién es.`}
        actions={
          <FormDialog
            title="Nueva actividad"
            action={saveActivity.bind(null, null)}
            successMessage="Actividad agendada"
            className="sm:max-w-xl"
            trigger={
              <Button>
                <CalendarPlus /> Nueva actividad
              </Button>
            }
          >
            <ActivityFields users={userOptions} currentUserId={user.id} defaultDate={date} linkOptions={linkOptions} />
          </FormDialog>
        }
      />

      <div className="flex flex-wrap items-end gap-2">
        <div className="flex rounded-lg border p-0.5">
          <Button variant="ghost" size="sm" asChild className={cn(!isList && "bg-muted")}>
            <Link href={href({ vista: undefined, estado: undefined })}>
              <CalendarDays /> Calendario
            </Link>
          </Button>
          <Button variant="ghost" size="sm" asChild className={cn(isList && "bg-muted")}>
            <Link href={href({ vista: "lista", mes: undefined })}>
              <List /> Lista
            </Link>
          </Button>
        </div>
        <form className="flex flex-wrap items-end gap-2">
          {!isList && <input type="hidden" name="mes" value={month} />}
          {isList && <input type="hidden" name="vista" value="lista" />}
          <NativeSelect name="usuario" defaultValue={who ?? ""} aria-label="De quién">
            <NativeSelectOption value="">Mías</NativeSelectOption>
            <NativeSelectOption value="todos">De todos</NativeSelectOption>
            {userOptions
              .filter((u) => u.id !== user.id)
              .map((u) => (
                <NativeSelectOption key={u.id} value={u.id}>
                  De {u.name}
                </NativeSelectOption>
              ))}
          </NativeSelect>
          {isList && (
            <NativeSelect name="estado" defaultValue={showDone ? "hechas" : ""} aria-label="Estado">
              <NativeSelectOption value="">Pendientes</NativeSelectOption>
              <NativeSelectOption value="hechas">Hechas</NativeSelectOption>
            </NativeSelect>
          )}
          <Button type="submit" variant="secondary">
            Filtrar
          </Button>
        </form>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {BUCKETS.map((b) => (
          <StatCard key={b} label={ACTIVITY_BUCKET_LABELS[b]} value={groups.get(b)!.length} />
        ))}
      </div>

      {!isList ? (
        <ActivityCalendar month={month} rows={listOrMonth ?? []} ctx={ctx} hrefFor={(m) => href({ mes: m })} />
      ) : showDone ? (
        <ActivityList rows={listOrMonth ?? []} ctx={ctx} empty="Todavía no hay actividades hechas." />
      ) : pending.length === 0 ? (
        <ActivityList rows={[]} ctx={ctx} empty="No hay actividades pendientes. ¡Todo al día!" />
      ) : (
        BUCKETS.filter((b) => groups.get(b)!.length > 0).map((b) => (
          <section key={b} className="grid gap-2">
            <h2 className={b === "vencida" ? "font-semibold text-destructive" : "font-semibold"}>
              {ACTIVITY_BUCKET_LABELS[b]}
            </h2>
            <ActivityList rows={groups.get(b)!} ctx={ctx} />
          </section>
        ))
      )}
    </>
  );
}
