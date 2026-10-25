import type { Metadata } from "next";
import Link from "next/link";
import { CalendarPlus } from "lucide-react";
import { ActivityFields } from "@/components/activity-fields";
import { ActivityList, type ActivityListContext } from "@/components/activity-list";
import { FormDialog } from "@/components/form-dialog";
import { PageHeader, StatCard } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { getActivities, getActivityLinkOptions } from "@/lib/activities";
import { ACTIVITY_BUCKET_LABELS, type ActivityBucket, activityBucket } from "@/lib/activity-bucket";
import { getUserNames, getUsers } from "@/lib/audit";
import { today } from "@/lib/format";
import { requireUser } from "@/lib/permissions";
import { saveActivity } from "./actions";

export const metadata: Metadata = { title: "Agenda" };

const str = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || undefined;
const BUCKETS: ActivityBucket[] = ["vencida", "hoy", "semana", "despues"];

export default async function AgendaPage({ searchParams }: PageProps<"/agenda">) {
  const user = await requireUser();
  const sp = await searchParams;
  // usuario: vacío = mías, "todos" = de todos, o el id de alguien.
  const who = str(sp.usuario);
  const showDone = str(sp.estado) === "hechas";
  const assignedTo = who === "todos" ? undefined : (who ?? user.id);

  const [rows, users, names, linkOptions] = await Promise.all([
    getActivities({ assignedTo, done: showDone }),
    getUsers(),
    getUserNames(),
    getActivityLinkOptions(),
  ]);
  const date = today();
  const userOptions = users.map((u) => ({ id: u.id, name: u.name ?? u.username ?? "—" }));
  const ctx: ActivityListContext = {
    users: userOptions,
    names,
    currentUserId: user.id,
    today: date,
    linkOptions,
    showAssignee: assignedTo !== user.id,
  };
  const groups = new Map<ActivityBucket, typeof rows>(BUCKETS.map((b) => [b, []]));
  if (!showDone) for (const r of rows) groups.get(activityBucket(r.activity.dueDate, date))!.push(r);
  const whose = assignedTo === user.id ? "Mis actividades" : assignedTo ? `Actividades de ${names.get(assignedTo) ?? "—"}` : "Actividades de todos";

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

      <form className="flex flex-wrap items-end gap-2">
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
        <NativeSelect name="estado" defaultValue={showDone ? "hechas" : ""} aria-label="Estado">
          <NativeSelectOption value="">Pendientes</NativeSelectOption>
          <NativeSelectOption value="hechas">Hechas</NativeSelectOption>
        </NativeSelect>
        <Button type="submit" variant="secondary">
          Filtrar
        </Button>
        {(who || showDone) && (
          <Button variant="ghost" asChild>
            <Link href="/agenda">Limpiar</Link>
          </Button>
        )}
      </form>

      {showDone ? (
        <ActivityList rows={rows} ctx={ctx} empty="Todavía no hay actividades hechas." />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {BUCKETS.map((b) => (
              <StatCard key={b} label={ACTIVITY_BUCKET_LABELS[b]} value={groups.get(b)!.length} />
            ))}
          </div>
          {rows.length === 0 ? (
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
      )}
    </>
  );
}
