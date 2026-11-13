import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";

const root = path.resolve(__dirname, "../..");

/** Cria um Postgres em memória com o shim do Supabase e TODAS as migrations reais aplicadas. */
export async function createTestDb() {
  const db = await PGlite.create({ extensions: { btree_gist } });
  await db.exec(readFileSync(path.join(__dirname, "supabase-shim.sql"), "utf8"));
  await db.exec("set search_path = public, extensions;");
  const dir = path.join(root, "supabase/migrations");
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
    try {
      await db.exec(readFileSync(path.join(dir, file), "utf8"));
    } catch (error) {
      throw new Error(`Falha ao aplicar ${file}: ${(error as Error).message}`);
    }
  }
  return new TestDb(db);
}

export class TestDb {
  constructor(readonly pg: PGlite) {}

  /** Executa como superusuário (equivalente a service role / SQL editor). */
  async admin<T = Record<string, unknown>>(sql: string, params: unknown[] = []) {
    await this.pg.exec("reset role; select set_config('request.jwt.claim.sub', '', false);");
    return (await this.pg.query<T>(sql, params)).rows;
  }

  /** Executa como usuário autenticado (RLS aplicada), simulando o JWT do Supabase. */
  async as<T = Record<string, unknown>>(userId: string | null, sql: string, params: unknown[] = []) {
    await this.pg.exec("reset role;");
    await this.pg.query("select set_config('request.jwt.claim.sub', $1, false)", [userId ?? ""]);
    await this.pg.exec(userId ? "set role authenticated;" : "set role anon;");
    try {
      return (await this.pg.query<T>(sql, params)).rows;
    } finally {
      await this.pg.exec("reset role;");
    }
  }

  async createUser(email: string, fullName: string, intendedRole: "owner" | "renter" = "owner") {
    const [row] = await this.admin<{ id: string }>(
      "insert into auth.users (email, raw_user_meta_data) values ($1, $2) returning id",
      [email, JSON.stringify({ full_name: fullName, intended_role: intendedRole })],
    );
    return row.id;
  }
}

export async function expectDbError(promise: Promise<unknown>, pattern: RegExp) {
  try {
    await promise;
  } catch (error) {
    const message = (error as Error).message;
    if (!pattern.test(message)) {
      throw new Error(`Erro inesperado: "${message}" (esperado ${pattern})`);
    }
    return;
  }
  throw new Error(`A operação deveria falhar com ${pattern}`);
}
