import { requireOwner } from "@/lib/auth/context";
import { NotificationList } from "@/features/notifications/notification-list";
import { PageHeader } from "@/components/ui/primitives";

export const metadata = { title: "Notificações" };

export default async function OwnerNotificationsPage({ searchParams }: PageProps<"/painel/notificacoes">) {
  const { filtro } = await searchParams;
  const { supabase, userId } = await requireOwner();
  return (
    <>
      <PageHeader title="Notificações" description="Central interna de alertas. Comunicação externa é feita por links de WhatsApp, sem envio automático." />
      <NotificationList supabase={supabase} userId={userId} filter={filtro === "nao-lidas" ? "nao-lidas" : "todas"} basePath="/painel/notificacoes" />
    </>
  );
}
