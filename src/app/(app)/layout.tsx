import { AppSidebar } from "@/components/app-sidebar";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { countDueActivities } from "@/lib/activities";
import { requireUser } from "@/lib/permissions";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await requireUser();
  const dueActivities = await countDueActivities(user.id);
  return (
    <SidebarProvider>
      <AppSidebar
        user={{ name: user.name, email: user.email, image: user.image, username: user.username }}
        permissions={user.permissions}
        dueActivities={dueActivities}
      />
      <SidebarInset>
        <header className="flex h-12 shrink-0 items-center gap-2 border-b px-4 md:hidden">
          <SidebarTrigger />
          <Separator orientation="vertical" className="h-4" />
          <span className="text-sm font-medium">Frabel ERP</span>
        </header>
        <div className="flex flex-1 flex-col gap-6 p-4 md:p-8">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
