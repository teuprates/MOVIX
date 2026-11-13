import { redirect } from "next/navigation";
import { getIsPlatformAdmin, getMemberships, requireSession } from "@/lib/auth/context";

/** Roteador pós-login: decide a área conforme vínculos (validados pelo banco), nunca por metadados. */
export default async function HomeRouter() {
  const { profile } = await requireSession("/inicio");
  const [memberships, isAdmin] = await Promise.all([getMemberships(), getIsPlatformAdmin()]);
  if (memberships.some((m) => m.role === "owner" && m.status === "approved")) redirect("/painel");
  if (memberships.some((m) => m.role === "renter")) redirect("/app");
  if (isAdmin) redirect("/admin");
  if (profile?.intended_role === "renter") redirect("/app");
  redirect("/onboarding");
}
