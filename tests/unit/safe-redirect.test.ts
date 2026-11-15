import { describe, expect, it } from "vitest";
import { safeNext } from "@/lib/safe-redirect";

describe("safeNext (open redirect)", () => {
  it("aceita caminhos internos", () => {
    expect(safeNext("/painel/frota?status=ativo")).toBe("/painel/frota?status=ativo");
  });

  it.each(["//evil.com", "/\\evil.com", "/\\/evil.com", "https://evil.com", "evil.com", "/\tevil", "", null, 42])(
    "rejeita %j",
    (value) => {
      expect(safeNext(value, "/inicio")).toBe("/inicio");
    },
  );
});
