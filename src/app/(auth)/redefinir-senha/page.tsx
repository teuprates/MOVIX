import type { Metadata } from "next";
import { NewPasswordForm } from "@/features/auth/forms";
import { requireSession } from "@/lib/auth/context";

export const metadata: Metadata = { title: "Nova senha" };

export default async function NewPasswordPage() {
  await requireSession("/redefinir-senha");
  return (
    <div>
      <h1 className="font-display text-3xl font-semibold tracking-tight">Defina uma nova senha</h1>
      <div className="mt-8"><NewPasswordForm /></div>
    </div>
  );
}
