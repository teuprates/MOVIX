import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { consumeRateLimit } from "@/lib/rate-limit";
import { createTestDb, expectDbError, type TestDb } from "./harness";

let db: TestDb;
let userA: string;
let userB: string;

beforeAll(async () => {
  db = await createTestDb();
  userA = await db.createUser("rate-a@movix.test", "Usuário A");
  userB = await db.createUser("rate-b@movix.test", "Usuário B");
});

afterAll(async () => {
  await db?.pg.close();
});

async function consume(user: string | null, bucket: string, max = 2, windowSeconds = 60) {
  const [row] = await db.as<{ allowed: boolean }>(user,
    "select public.consume_rate_limit($1, $2, $3) as allowed", [bucket, max, windowSeconds]);
  return row.allowed;
}

describe("rate limit persistente", () => {
  it("permite p_max chamadas e bloqueia a próxima sem registrar hits negados", async () => {
    expect(await consume(userA, "limite")).toBe(true);
    expect(await consume(userA, "limite")).toBe(true);
    expect(await consume(userA, "limite")).toBe(false);
    const [{ count }] = await db.admin<{ count: number }>(
      "select count(*)::int as count from public.rate_limit_hits where user_id = $1 and bucket = 'limite'", [userA]);
    expect(count).toBe(2);
  });

  it("isola usuários e buckets", async () => {
    expect(await consume(userA, "isolamento", 1)).toBe(true);
    expect(await consume(userA, "isolamento", 1)).toBe(false);
    expect(await consume(userB, "isolamento", 1)).toBe(true);
    expect(await consume(userB, "isolamento", 1)).toBe(false);
    expect(await consume(userA, "outro-bucket", 1)).toBe(true);
  });

  it("descarta apenas hits expirados do usuário e bucket atuais", async () => {
    await db.admin(`insert into public.rate_limit_hits (user_id, bucket, hit_at) values
      ($1, 'expiracao', now() - interval '61 seconds'),
      ($2, 'expiracao', now() - interval '61 seconds'),
      ($1, 'preservado', now() - interval '61 seconds')`, [userA, userB]);
    expect(await consume(userA, "expiracao", 1)).toBe(true);
    expect(await consume(userA, "expiracao", 1)).toBe(false);
    const rows = await db.admin<{ user_id: string; bucket: string }>(
      "select user_id, bucket from public.rate_limit_hits where hit_at < now() - interval '60 seconds'");
    expect(rows).toEqual(expect.arrayContaining([
      { user_id: userB, bucket: "expiracao" },
      { user_id: userA, bucket: "preservado" },
    ]));
    expect(rows).not.toContainEqual({ user_id: userA, bucket: "expiracao" });
  });

  it("nega execução para anon e retorna false sem auth.uid()", async () => {
    await expectDbError(consume(null, "anon"), /permission denied/);
    const [row] = await db.admin<{ allowed: boolean }>(
      "select public.consume_rate_limit('sem-usuario', 1, 60) as allowed");
    expect(row.allowed).toBe(false);
  });

  it.each([null, "", "x".repeat(65)])("rejeita bucket inválido: %s", async (bucket) => {
    await expectDbError(db.as(userA, "select public.consume_rate_limit($1, 1, 60)", [bucket]),
      /MOVIX_INVALID_RATE_LIMIT/);
  });

  it.each([null, 0, -1, 3601])("rejeita máximo e janela inválidos: %s", async (value) => {
    await expectDbError(db.as(userA, "select public.consume_rate_limit('validacao', $1, 60)", [value]),
      /MOVIX_INVALID_RATE_LIMIT/);
    await expectDbError(db.as(userA, "select public.consume_rate_limit('validacao', 1, $1)", [value]),
      /MOVIX_INVALID_RATE_LIMIT/);
  });

  it("aceita os limites superiores de parâmetros e bucket", async () => {
    expect(await consume(userA, "x".repeat(64), 3600, 3600)).toBe(true);
  });

  it.each(["authenticated", "anon"])("impede acesso direto como %s", async (role) => {
    const user = role === "authenticated" ? userA : null;
    for (const sql of [
      "select * from public.rate_limit_hits",
      "insert into public.rate_limit_hits (user_id, bucket) values (auth.uid(), 'forjado')",
      "update public.rate_limit_hits set hit_at = now()",
      "delete from public.rate_limit_hits",
    ]) {
      await expectDbError(db.as(user, sql), /permission denied/);
    }
  });

  it("mantém RLS habilitado sem policies", async () => {
    const [table] = await db.admin<{ relrowsecurity: boolean }>(
      "select relrowsecurity from pg_class where oid = 'public.rate_limit_hits'::regclass");
    expect(table.relrowsecurity).toBe(true);
    expect(await db.admin("select * from pg_policies where schemaname = 'public' and tablename = 'rate_limit_hits'"))
      .toHaveLength(0);
  });
});

describe("helper do rate limit", () => {
  it.each([true, false])("preserva a decisão %s do RPC com os parâmetros esperados", async (allowed) => {
    const rpc = vi.fn().mockResolvedValue({ data: allowed, error: null });
    const client = { rpc } as unknown as SupabaseClient;
    expect(await consumeRateLimit(client, "assistente", 10, 60)).toBe(allowed);
    expect(rpc).toHaveBeenCalledWith("consume_rate_limit", {
      p_bucket: "assistente", p_max: 10, p_window_seconds: 60,
    });
  });

  it.each(["resposta", "exceção"])("libera e registra aviso em erro de %s", async (mode) => {
    const error = new Error("RPC indisponível");
    const rpc = mode === "resposta"
      ? vi.fn().mockResolvedValue({ data: null, error })
      : vi.fn().mockRejectedValue(error);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      expect(await consumeRateLimit({ rpc } as unknown as SupabaseClient, "assistente", 10, 60)).toBe(true);
      expect(warn).toHaveBeenCalledWith(expect.any(String), error);
    } finally {
      warn.mockRestore();
    }
  });
});
