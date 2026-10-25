import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { dumpMigrationAt } from "./db-dump";

const sha = (s: string) => createHash("sha256").update(s).digest("hex");
const files = [
  { sql: "create table a (id int);\n--> statement-breakpoint\ncreate table b (id int);\n", when: 100 },
  { sql: "alter table a add column x int;\n", when: 200 },
];

describe("dumpMigrationAt", () => {
  it("usa migrationAt si el volcado lo trae", () => {
    expect(dumpMigrationAt({ migration: "cualquiera", migrationAt: 999 }, files)).toBe(999);
  });

  it("sin migraciones devuelve null", () => {
    expect(dumpMigrationAt({ migration: null }, files)).toBeNull();
  });

  it("encuentra el hash calculado con LF", () => {
    expect(dumpMigrationAt({ migration: sha(files[1].sql) }, files)).toBe(200);
  });

  it("encuentra el hash calculado con CRLF (otra PC con autocrlf)", () => {
    expect(dumpMigrationAt({ migration: sha(files[0].sql.replace(/\n/g, "\r\n")) }, files)).toBe(100);
  });

  it("funciona aunque el .sql de esta PC tenga CRLF y el volcado venga de una con LF", () => {
    const crlfFiles = files.map((f) => ({ ...f, sql: f.sql.replace(/\n/g, "\r\n") }));
    expect(dumpMigrationAt({ migration: sha(files[0].sql) }, crlfFiles)).toBe(100);
  });

  it("hash desconocido (versión más nueva) devuelve undefined", () => {
    expect(dumpMigrationAt({ migration: sha("otra migración") }, files)).toBeUndefined();
  });
});
