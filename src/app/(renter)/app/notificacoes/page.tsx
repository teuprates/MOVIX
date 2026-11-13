import { requireRenter } from "@/lib/auth/context";
import { NotificationList } from "@/features/notifications/notification-list";

export const metadata = { title: "Notificações" };

export default async function RenterNotificationsPage({ searchParams }: PageProps<"/app/notificacoes">) {
  const { filtro } = await searchParams;
  const { supabase, userId } = await requireRenter();
  return (
    <div className="space-y-4">
      <h1 className="font-display text-2xl font-semibold">Notificações</h1>
      <NotificationList supabase={supabase} userId={userId} filter={filtro === "nao-lidas" ? "nao-lidas" : "todas"} basePath="/app/notificacoes" />
    </div>
  );
}
