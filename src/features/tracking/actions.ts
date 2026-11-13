"use server";
import { revalidatePath } from "next/cache";
import { ownerActionContext } from "@/lib/auth/context";
import { translateError } from "@/lib/errors";
import { fail, success, type FormState } from "@/lib/form-state";
import { ROUTES } from "@/lib/domain/tracking";

/** Controle do rastreamento SIMULADO (sem GPS físico). Posição = função do tempo acumulado. */
export async function controlTracking(vehicleId: string, command: "start" | "pause" | "reset", routeKey?: string): Promise<FormState> {
  try {
    const ctx = await ownerActionContext();
    const { data: sim } = await ctx.supabase.from("tracking_simulations").select("*").eq("vehicle_id", vehicleId).maybeSingle();
    const now = new Date();
    const route = routeKey && ROUTES.some((r) => r.key === routeKey) ? routeKey : (sim?.route_key ?? ROUTES[0].key);
    let patch: Record<string, unknown>;
    if (command === "start") {
      patch = { status: "running", resumed_at: now.toISOString(), route_key: route };
    } else if (command === "pause") {
      const extra = sim?.status === "running" && sim.resumed_at ? Math.floor((now.getTime() - Date.parse(sim.resumed_at)) / 1000) : 0;
      patch = { status: "paused", accumulated_seconds: (sim?.accumulated_seconds ?? 0) + extra, resumed_at: null };
    } else {
      patch = { status: "stopped", accumulated_seconds: 0, resumed_at: null, route_key: route };
    }
    const { error } = sim
      ? await ctx.supabase.from("tracking_simulations").update(patch).eq("id", sim.id)
      : await ctx.supabase.from("tracking_simulations").insert({ vehicle_id: vehicleId, organization_id: ctx.orgId, route_key: route, ...patch });
    if (error) return fail(translateError(error));
  } catch (e) {
    return fail(translateError(e as Error));
  }
  revalidatePath("/painel/rastreamento");
  return success(command === "start" ? "Simulação iniciada." : command === "pause" ? "Simulação pausada." : "Simulação reiniciada.");
}

export async function setGeofence(vehicleId: string, radius: number): Promise<FormState> {
  if (!Number.isFinite(radius) || radius < 200 || radius > 50000) return fail("Raio entre 200 m e 50 km.");
  try {
    const ctx = await ownerActionContext();
    const { error } = await ctx.supabase.from("tracking_simulations").update({ geofence_radius_m: Math.round(radius) }).eq("vehicle_id", vehicleId).eq("organization_id", ctx.orgId);
    if (error) return fail(translateError(error));
  } catch (e) {
    return fail(translateError(e as Error));
  }
  revalidatePath("/painel/rastreamento");
  return success("Geofence atualizada.");
}
