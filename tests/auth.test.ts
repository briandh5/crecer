import assert from "node:assert/strict";
import { test } from "node:test";
import { hashPassword, hashToken, newSessionToken, validatePassword, validateUsername, verifyPassword } from "../src/server/auth-core.ts";

test("usuarios: normaliza y valida", () => {
  assert.deepEqual(validateUsername("  BrianDH444 "), { ok: true, value: "briandh444" });
  assert.deepEqual(validateUsername("mi_perfil-2"), { ok: true, value: "mi_perfil-2" });
  for (const bad of ["ab", "a".repeat(31), "con espacio", "tilde-ñ", "-guion", "_guion", "punto.com", "../etc", "a/b", "", null, 42]) {
    assert.equal(validateUsername(bad).ok, false, `debería rechazar ${JSON.stringify(bad)}`);
  }
});

test("usuarios: nombres reservados no se pueden registrar", () => {
  for (const name of ["api", "demo", "login", "crecimiento", "vacunas", "hitos", "diario", "perfil", "admin"]) {
    assert.equal(validateUsername(name).ok, false, name);
  }
});

test("contraseñas: mínimo 8, no triviales", () => {
  assert.equal(validatePassword("corta").ok, false);
  assert.equal(validatePassword("12345678").ok, false);
  assert.equal(validatePassword("password").ok, false);
  assert.equal(validatePassword("briandh444", "briandh444").ok, false, "igual al usuario");
  assert.equal(validatePassword("x".repeat(201)).ok, false);
  assert.equal(validatePassword("una frase larga y rara 7").ok, true);
});

test("scrypt: verifica la correcta, rechaza la incorrecta, sal distinta cada vez", async () => {
  const h1 = await hashPassword("mi contraseña ñandú");
  const h2 = await hashPassword("mi contraseña ñandú");
  assert.notEqual(h1, h2);
  assert.match(h1, /^scrypt\$16384\$8\$1\$/);
  assert.equal(await verifyPassword("mi contraseña ñandú", h1), true);
  assert.equal(await verifyPassword("mi contraseña ñandu", h1), false);
  assert.equal(await verifyPassword("x", "formato-roto"), false);
});

test("sesiones: el token es aleatorio y solo se guarda su hash", () => {
  const a = newSessionToken();
  const b = newSessionToken();
  assert.notEqual(a.token, b.token);
  assert.equal(a.hash, hashToken(a.token));
  assert.ok(a.token.length >= 40);
  assert.notEqual(a.token, a.hash);
});
