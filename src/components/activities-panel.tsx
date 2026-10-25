import { CalendarPlus } from "lucide-react";
import { saveActivity } from "@/app/(app)/agenda/actions";
import { ActivityFields, type FixedLink } from "@/components/activity-fields";
import { ActivityList, type ActivityListContext } from "@/components/activity-list";
import { FormDialog } from "@/components/form-dialog";
import { Button } from "@/components/ui/button";
import { getActivities } from "@/lib/activities";
import { getUserNames, getUsers } from "@/lib/audit";
import { today } from "@/lib/format";

/** Actividades de una ficha: pendientes, botón para agendar una nueva (ya vinculada) y las últimas hechas. */
export async function ActivitiesPanel({ link, currentUserId }: { link: FixedLink; currentUserId: string }) {
  const filter = { [link.field]: link.id };
  const [pending, done, users, names] = await Promise.all([
    getActivities({ ...filter, done: false }),
    getActivities({ ...filter, done: true, limit: 10 }),
    getUsers(),
    getUserNames(),
  ]);
  const ctx: ActivityListContext = {
    users: users.map((u) => ({ id: u.id, name: u.name ?? u.username ?? "—" })),
    names,
    currentUserId,
    today: today(),
    fixedLink: link,
    showAssignee: true,
  };
  return (
    <div className="grid gap-3">
      <FormDialog
        title="Programar actividad"
        action={saveActivity.bind(null, null)}
        successMessage="Actividad agendada"
        className="sm:max-w-xl"
        trigger={
          <Button variant="outline" className="w-fit">
            <CalendarPlus /> Programar actividad
          </Button>
        }
      >
        <ActivityFields users={ctx.users} currentUserId={currentUserId} defaultDate={ctx.today} fixedLink={link} />
      </FormDialog>
      <ActivityList rows={pending} ctx={ctx} empty="No hay actividades pendientes." />
      {done.length > 0 && (
        <details className="grid gap-2">
          <summary className="cursor-pointer text-sm text-muted-foreground">Últimas hechas ({done.length})</summary>
          <div className="pt-2">
            <ActivityList rows={done} ctx={ctx} />
          </div>
        </details>
      )}
    </div>
  );
}
