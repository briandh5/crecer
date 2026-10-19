// Pruebas de integración contra un servidor real (npm run build && npm start) con DATABASE_URL apuntando a una base de pruebas.
//   BASE_URL=http://localhost:3100 npm run test:integration
import assert from "node:assert/strict";
import { randomUUID, randomBytes } from "node:crypto";
import { test, before, after } from "node:test";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { SMTPServer } = require("smtp-server");
const { simpleParser } = require("mailparser");
const pg = require("pg");

const BASE = process.env.BASE_URL ?? "http://localhost:3100";
const IP = `10.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`;
const suffix = randomBytes(3).toString("hex");
const nameA = `ana-${suffix}`;
const nameB = `luis-${suffix}`;
const emailA = `ana-${suffix}@correo.test`;
const emailB = `luis-${suffix}@correo.test`;
const PASS = "una clave larga 123";

/** Cliente mínimo con cookie propia. */
function client(ip = IP) {
  let cookie = "";
  const call = async (path, { method = "GET", body, headers = {}, origin = BASE, raw } = {}) => {
    const h = { "x-real-ip": ip, ...headers };
    if (cookie) h.cookie = cookie;
    if (origin) h.origin = origin;
    let payload;
    if (raw !== undefined) payload = raw;
    else if (body !== undefined) {
      h["content-type"] = "application/json";
      payload = JSON.stringify(body);
    }
    const res = await fetch(BASE + path, { method, headers: h, body: payload, redirect: "manual" });
    const set = res.headers.getSetCookie?.() ?? [];
    for (const c of set) {
      const [pair] = c.split(";");
      if (pair.startsWith("crecer_session=")) cookie = pair.endsWith("=") ? "" : pair;
    }
    return res;
  };
  const json = async (...a) => {
    const res = await call(...a);
    return { status: res.status, body: await res.json().catch(() => null), res };
  };
  return { call, json, get cookie() { return cookie; }, set cookie(v) { cookie = v; } };
}

const A = client();
const B = client();
const childA = randomUUID();
const entryA = randomUUID();
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), randomBytes(2000)]);

before(async () => {
  const res = await fetch(BASE + "/demo").catch(() => null);
  assert.ok(res && res.status === 200, `El servidor no responde en ${BASE}`);
});

test("registro: valida usuario y contraseña", async () => {
  const good = { username: nameA, email: emailA, password: PASS };
  const cases = [
    { ...good, username: "ab" },
    { ...good, username: "con espacio" },
    { ...good, username: "api" },
    { ...good, password: "corta" },
    { ...good, password: "12345678" },
    { ...good, email: "" },
    { ...good, email: "sin-arroba" },
    { ...good, email: "a@b" },
    { ...good, email: null },
    { username: nameA, password: PASS }, // sin correo
  ];
  for (const body of cases) {
    const r = await A.json("/api/auth/register", { method: "POST", body });
    assert.equal(r.status, 400, JSON.stringify(body));
    assert.ok(r.body.error);
  }
  assert.equal(A.cookie, "", "un registro inválido no abre sesión");
});

test("registro y login: crea cuenta, abre sesión y no repite usuario", async () => {
  const r = await A.json("/api/auth/register", { method: "POST", body: { username: nameA.toUpperCase(), email: ` ${emailA.toUpperCase()} `, password: PASS } });
  assert.equal(r.status, 201);
  assert.equal(r.body.username, nameA, "se guarda en minúsculas");
  assert.match(A.cookie, /^crecer_session=.{40,}/);
  const setCookie = r.res.headers.get("set-cookie");
  assert.match(setCookie, /HttpOnly/i);
  assert.match(setCookie, /SameSite=lax/i);

  const dup = await B.json("/api/auth/register", { method: "POST", body: { username: nameA, email: emailB, password: PASS } });
  assert.equal(dup.status, 409);
  assert.match(dup.body.error, /usuario/);
  const dupMail = await B.json("/api/auth/register", { method: "POST", body: { username: nameB, email: emailA, password: PASS } });
  assert.equal(dupMail.status, 409);
  assert.match(dupMail.body.error, /correo/);

  const reg = await B.json("/api/auth/register", { method: "POST", body: { username: nameB, email: emailB, password: PASS } });
  assert.equal(reg.status, 201);
});

test("login: contraseña incorrecta y usuario inexistente dan el mismo error", async () => {
  const c = client();
  const bad = await c.json("/api/auth/login", { method: "POST", body: { username: nameA, password: "otra clave larga" } });
  const ghost = await c.json("/api/auth/login", { method: "POST", body: { username: `nadie-${suffix}`, password: "otra clave larga" } });
  assert.equal(bad.status, 401);
  assert.equal(ghost.status, 401);
  assert.equal(bad.body.error, ghost.body.error);
  assert.equal(c.cookie, "");
  const ok = await c.json("/api/auth/login", { method: "POST", body: { username: nameA.toUpperCase(), password: PASS } });
  assert.equal(ok.status, 200);
  assert.match(c.cookie, /^crecer_session=/);
});

test("login: se bloquea tras demasiados fallos", async () => {
  const victim = `bloqueo-${suffix}`;
  const c = client();
  await c.json("/api/auth/register", { method: "POST", body: { username: victim, email: `${victim}@correo.test`, password: PASS } });
  const other = client();
  let last;
  for (let i = 0; i < 11; i++) last = await other.json("/api/auth/login", { method: "POST", body: { username: victim, password: `mala clave ${i} larga` } });
  assert.equal(last.status, 429);
  // Aun con la contraseña buena, durante el bloqueo no entra.
  const blocked = await other.json("/api/auth/login", { method: "POST", body: { username: victim, password: PASS } });
  assert.equal(blocked.status, 429);
});

test("CSRF: sin Origin o con Origin ajeno se rechaza", async () => {
  const noOrigin = await A.json("/api/actions", { method: "POST", body: { action: {} }, origin: null });
  assert.equal(noOrigin.status, 403);
  const foreign = await A.json("/api/actions", { method: "POST", body: { action: {} }, origin: "https://malo.example" });
  assert.equal(foreign.status, 403);
  const login = await client().json("/api/auth/login", { method: "POST", body: { username: nameA, password: PASS }, origin: "https://malo.example" });
  assert.equal(login.status, 403);
});

test("sin sesión no hay acceso", async () => {
  const anon = client();
  assert.equal((await anon.json("/api/state")).status, 401);
  assert.equal((await anon.json("/api/actions", { method: "POST", body: { action: { type: "removeChild", id: randomUUID() } } })).status, 401);
  assert.equal((await anon.call(`/api/photos/${entryA}`)).status, 401);
});

test("flujo completo de datos: hijo, medición, vacuna, hito, recuerdo con foto", async () => {
  const act = (action) => A.json("/api/actions", { method: "POST", body: { action } });
  const ok = async (action) => assert.equal((await act(action)).status, 200, JSON.stringify(action).slice(0, 120));

  await ok({ type: "addChild", child: { id: childA, name: "Valentina", birthDate: "2024-06-17", sex: "female", tone: "terracotta", bloodType: "O+", allergies: ["Polen"], notes: "Nació a término", birthWeightKg: 3.2, birthLengthCm: 49.5, birthHeadCm: 34.2 } });
  await ok({ type: "addChild", child: { id: childA, name: "Valentina", birthDate: "2024-06-17", sex: "female", tone: "terracotta", bloodType: "O+", allergies: ["Polen"], notes: "Nació a término", birthWeightKg: 3.2, birthLengthCm: 49.5, birthHeadCm: 34.2 } }); // reintento idempotente
  await ok({ type: "addMeasurement", m: { id: randomUUID(), childId: childA, measuredAt: "2025-06-17", weightKg: 9.3, heightCm: 75, headCm: null, note: "Control" } });
  await ok({ type: "saveVaccine", record: { childId: childA, vaccineId: "bcg", appliedAt: "2024-06-18", lot: "A123", place: "Centro de salud" } });
  await ok({ type: "saveVaccine", record: { childId: childA, vaccineId: "bcg", appliedAt: "2024-06-19", lot: "B999", place: "" } }); // actualiza
  await ok({ type: "setMilestone", childId: childA, milestoneId: "mg-2-1", achievedAt: "2024-08-20" });
  await ok({ type: "setMilestone", childId: childA, milestoneId: "mg-4-1", achievedAt: "2024-10-20" });
  await ok({ type: "setMilestone", childId: childA, milestoneId: "mg-4-1", achievedAt: null });
  await ok({ type: "addJournal", entry: { id: entryA, childId: childA, kind: "sonrisa", title: "Primera sonrisa", occurredAt: "2024-08-10", note: "Nos derretimos" } });

  const photo = await A.call(`/api/photos/${entryA}`, { method: "POST", headers: { "content-type": "image/jpeg" }, raw: JPEG });
  assert.equal(photo.status, 201);

  const st = await A.json("/api/state");
  assert.equal(st.status, 200);
  const s = st.body;
  assert.equal(s.children.length, 1);
  assert.deepEqual([s.children[0].name, s.children[0].birthDate, s.children[0].birthWeightKg, s.children[0].allergies], ["Valentina", "2024-06-17", 3.2, ["Polen"]]);
  const birth = s.measurements.find((m) => m.source === "birth");
  assert.ok(birth, "el trigger crea la medición de nacimiento");
  assert.deepEqual([birth.measuredAt, birth.weightKg, birth.heightCm, birth.headCm], ["2024-06-17", 3.2, 49.5, 34.2]);
  assert.equal(s.measurements.length, 2);
  assert.equal(s.vaccineRecords.length, 1);
  assert.deepEqual([s.vaccineRecords[0].lot, s.vaccineRecords[0].appliedAt], ["B999", "2024-06-19"]);
  assert.deepEqual(s.milestoneRecords.map((m) => m.milestoneId), ["mg-2-1"]);
  assert.deepEqual([s.journal[0].title, s.journal[0].hasPhoto], ["Primera sonrisa", true]);

  const img = await A.call(`/api/photos/${entryA}`);
  assert.equal(img.status, 200);
  assert.equal(img.headers.get("content-type"), "image/jpeg");
  assert.equal(img.headers.get("x-content-type-options"), "nosniff");
  assert.ok(Buffer.from(await img.arrayBuffer()).equals(JPEG));

  // Editar la ficha de nacimiento actualiza el primer punto de la curva.
  await ok({ type: "updateChild", id: childA, patch: { birthWeightKg: 3.4, name: "Vale" } });
  const st2 = (await A.json("/api/state")).body;
  assert.equal(st2.children[0].name, "Vale");
  assert.equal(st2.measurements.find((m) => m.source === "birth").weightKg, 3.4);

  // La medición de nacimiento no se puede borrar desde el historial.
  await ok({ type: "removeMeasurement", id: birth.id });
  assert.ok((await A.json("/api/state")).body.measurements.some((m) => m.source === "birth"));
});

test("fotos: solo JPEG real y con tamaño razonable", async () => {
  const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47]), randomBytes(100)]);
  const notJpeg = await A.call(`/api/photos/${entryA}`, { method: "POST", headers: { "content-type": "image/jpeg" }, raw: png });
  assert.equal(notJpeg.status, 415);
  const big = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), randomBytes(2_600_000)]);
  const tooBig = await A.call(`/api/photos/${entryA}`, { method: "POST", headers: { "content-type": "image/jpeg" }, raw: big });
  assert.equal(tooBig.status, 413);
  const empty = await A.call(`/api/photos/${entryA}`, { method: "POST", headers: { "content-type": "image/jpeg" }, raw: Buffer.alloc(0) });
  assert.equal(empty.status, 413);
  const badId = await A.call(`/api/photos/no-es-uuid`);
  assert.equal(badId.status, 404);
  // La foto original sigue intacta.
  const img = await A.call(`/api/photos/${entryA}`);
  assert.ok(Buffer.from(await img.arrayBuffer()).equals(JPEG));
});

test("aislamiento: B no puede ver ni tocar los datos de A", async () => {
  const act = (action) => B.json("/api/actions", { method: "POST", body: { action } });

  assert.equal((await B.call(`/api/photos/${entryA}`)).status, 404, "no ve la foto de A");
  const up = await B.call(`/api/photos/${entryA}`, { method: "POST", headers: { "content-type": "image/jpeg" }, raw: Buffer.concat([JPEG, Buffer.from("x")]) });
  assert.equal(up.status, 404, "no puede reemplazar la foto de A");

  assert.equal((await act({ type: "addMeasurement", m: { id: randomUUID(), childId: childA, measuredAt: "2025-01-01", weightKg: 1, heightCm: null, headCm: null, note: "" } })).status, 404);
  assert.equal((await act({ type: "saveVaccine", record: { childId: childA, vaccineId: "hexa-1", appliedAt: "2024-08-17", lot: "", place: "" } })).status, 404);
  assert.equal((await act({ type: "setMilestone", childId: childA, milestoneId: "mg-2-2", achievedAt: "2024-08-20" })).status, 404);
  assert.equal((await act({ type: "addJournal", entry: { id: randomUUID(), childId: childA, kind: "otro", title: "x", occurredAt: "2024-08-10", note: "" } })).status, 404);
  assert.equal((await act({ type: "updateChild", id: childA, patch: { name: "Hackeado" } })).status, 404);
  assert.equal((await act({ type: "addChild", child: { id: childA, name: "Robado", birthDate: "2020-01-01", sex: "male", tone: "moss", bloodType: "unknown", allergies: [], notes: "", birthWeightKg: null, birthLengthCm: null, birthHeadCm: null } })).status, 404, "no puede apropiarse del id de A");
  // Borrados ajenos: responden bien pero no hacen nada.
  assert.equal((await act({ type: "removeChild", id: childA })).status, 200);
  assert.equal((await act({ type: "removeJournal", id: entryA })).status, 200);

  const sb = (await B.json("/api/state")).body;
  assert.equal(sb.children.length, 0);
  assert.equal(sb.journal.length, 0);

  const sa = (await A.json("/api/state")).body;
  assert.equal(sa.children.length, 1, "A conserva a su hijo");
  assert.equal(sa.children[0].name, "Vale", "y su nombre no cambió");
  assert.equal(sa.journal.length, 1);
  assert.equal(sa.journal[0].hasPhoto, true);
  assert.equal(sa.measurements.length, 2);
});

test("validación: datos inválidos se rechazan", async () => {
  const act = (action) => A.json("/api/actions", { method: "POST", body: { action } });
  const m = (over) => ({ id: randomUUID(), childId: childA, measuredAt: "2025-01-01", weightKg: 10, heightCm: null, headCm: null, note: "", ...over });
  const cases = [
    { type: "addMeasurement", m: m({ id: "no-uuid" }) },
    { type: "addMeasurement", m: m({ measuredAt: "2999-01-01" }) },
    { type: "addMeasurement", m: m({ measuredAt: "2025-02-30" }) },
    { type: "addMeasurement", m: m({ weightKg: -5 }) },
    { type: "addMeasurement", m: m({ weightKg: null }) },
    { type: "addMeasurement", m: m({ note: "x".repeat(500) }) },
    { type: "saveVaccine", record: { childId: childA, vaccineId: "no-existe", appliedAt: "2024-08-17", lot: "", place: "" } },
    { type: "setMilestone", childId: childA, milestoneId: "no-existe", achievedAt: "2024-08-17" },
    { type: "updateChild", id: childA, patch: { ownerId: randomUUID() } },
    { type: "updateChild", id: childA, patch: { sex: "otro" } },
    { type: "hackear", id: childA },
    "texto",
    null,
  ];
  for (const c of cases) assert.equal((await act(c)).status, 400, JSON.stringify(c).slice(0, 100));
  assert.equal((await A.json("/api/actions", { method: "POST", raw: "{no es json" })).status, 400);
});

test("páginas: acceso por usuario", async () => {
  const anon = client();
  const gate = await anon.call(`/${nameA}`);
  assert.equal(gate.status, 200);
  const html = await gate.text();
  assert.match(html, /Entra con tu contraseña/);
  assert.doesNotMatch(html, /Valentina|Vale/, "no filtra datos sin sesión");

  const mine = await A.call(`/${nameA}`);
  assert.equal(mine.status, 200);
  assert.match(await mine.text(), /Vale/, "con sesión, el servidor entrega los datos de A");

  const crossed = await B.call(`/${nameA}`);
  const crossedHtml = await crossed.text();
  // React separa «@» y el nombre con un comentario HTML; lo quitamos antes de comparar.
  assert.match(crossedHtml.replaceAll("<!-- -->", ""), new RegExp(`Este perfil es de @${nameA}`));
  assert.doesNotMatch(crossedHtml, /Vale/, "B no ve datos de A");

  assert.equal((await anon.call("/demo")).status, 200);
  const upper = await anon.call(`/${nameA.toUpperCase()}`);
  assert.equal(upper.status, 307, "mayúsculas redirigen a minúsculas");
  assert.equal((await anon.call("/usuario con espacios")).status, 404);
  const landing = await A.call("/");
  assert.equal(landing.status, 307, "con sesión, la portada lleva al perfil");
  assert.match(landing.headers.get("location"), new RegExp(`/${nameA}$`));
});

test("cerrar sesión invalida la cookie", async () => {
  const old = A.cookie;
  assert.equal((await A.json("/api/auth/logout", { method: "POST" })).status, 200);
  assert.equal(A.cookie, "");
  const reuse = client();
  reuse.cookie = old;
  assert.equal((await reuse.json("/api/state")).status, 401, "el token viejo ya no sirve");
  const again = await A.json("/api/auth/login", { method: "POST", body: { username: nameA, password: PASS } });
  assert.equal(again.status, 200);
  assert.equal((await A.json("/api/state")).body.children.length, 1, "los datos siguen ahí al volver a entrar");
});


// ---------------------------------------------------------------------------------------------
// Recuperación de contraseña y cuenta. Necesita el servidor arrancado con
//   SMTP_HOST=127.0.0.1 SMTP_PORT=2525 SMTP_SECURE=false APP_URL=<BASE_URL>
// y DATABASE_URL (para caducar un enlace a mano).
// ---------------------------------------------------------------------------------------------
const inbox = [];
const sink = new SMTPServer({
  authOptional: true,
  disabledCommands: ["STARTTLS", "AUTH"],
  onData(stream, _session, cb) {
    simpleParser(stream).then((mail) => {
      inbox.push({ to: mail.to.value.map((a) => a.address), subject: mail.subject, text: mail.text, html: mail.html });
      cb();
    }, cb);
  },
});
await new Promise((resolve) => sink.listen(2525, "127.0.0.1", resolve));
after(() => sink.close());

const db = process.env.DATABASE_URL ? new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: false, max: 1 }) : null;
after(() => db?.end());

const mailsTo = (addr) => inbox.filter((m) => m.to.includes(addr));
async function waitForMails(addr, n, ms = 6000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (mailsTo(addr).length >= n) return mailsTo(addr);
    await new Promise((r) => setTimeout(r, 100));
  }
  return mailsTo(addr);
}
const tokenOf = (mail) => new URL(mail.text.match(/https?:\/\/\S+/)[0]).searchParams.get("token");

test("recuperación: respuesta idéntica exista o no la cuenta, y solo se envía correo a cuentas reales", async () => {
  const c = client("10.9.9.1");
  const ghost = await c.json("/api/auth/forgot", { method: "POST", body: { identifier: `nadie-${suffix}` } });
  const ghostMail = await c.json("/api/auth/forgot", { method: "POST", body: { identifier: `nadie-${suffix}@correo.test` } });
  const real = await c.json("/api/auth/forgot", { method: "POST", body: { identifier: nameB } });
  assert.deepEqual([ghost.status, ghostMail.status, real.status], [200, 200, 200]);
  assert.deepEqual(ghost.body, real.body, "misma respuesta para cuentas que existen y que no");
  const mails = await waitForMails(emailB, 1);
  assert.equal(mails.length, 1);
  assert.equal(inbox.filter((m) => m.to.some((a) => a.startsWith("nadie-"))).length, 0);
  assert.match(mails[0].subject, /contraseña/i);
  assert.match(mails[0].text, new RegExp(`@${nameB}`));
  assert.match(mails[0].text, new RegExp(`^.*${BASE.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")}/restablecer\\?token=`, "m"));
  assert.ok(tokenOf(mails[0]).length >= 40);
  assert.match(mails[0].html, /restablecer\?token=/);
});

test("recuperación: por correo, con caducidad, un solo uso y sesiones cerradas", async () => {
  const user = `recu-${suffix}`;
  const mail = `${user}@correo.test`;
  const OLD = "contraseña vieja 123";
  const NEW = "contraseña nueva 456";
  const dev1 = client("10.9.9.2");
  const reg = await dev1.json("/api/auth/register", { method: "POST", body: { username: user, email: mail, password: OLD } });
  assert.equal(reg.status, 201);
  assert.equal((await dev1.json("/api/state")).status, 200);

  // Se puede pedir con el correo (en minúsculas o no).
  const req1 = await client("10.9.9.2").json("/api/auth/forgot", { method: "POST", body: { identifier: mail.toUpperCase() } });
  assert.equal(req1.status, 200);
  const [m1] = await waitForMails(mail, 1);
  const tok1 = tokenOf(m1);

  // Un segundo enlace anula el primero.
  await client("10.9.9.3").json("/api/auth/forgot", { method: "POST", body: { identifier: user } });
  const m2 = (await waitForMails(mail, 2))[1];
  const tok2 = tokenOf(m2);
  assert.notEqual(tok1, tok2);
  const stale = await client("10.9.9.4").json("/api/auth/reset", { method: "POST", body: { token: tok1, password: NEW } });
  assert.equal(stale.status, 400, "el enlace anterior ya no sirve");

  // Contraseña débil: se rechaza sin gastar el enlace.
  const weak = await client("10.9.9.4").json("/api/auth/reset", { method: "POST", body: { token: tok2, password: "corta" } });
  assert.equal(weak.status, 400);
  const same = await client("10.9.9.4").json("/api/auth/reset", { method: "POST", body: { token: tok2, password: user } });
  assert.equal(same.status, 400);

  // Token inventado o vacío.
  for (const t of ["", "x", randomBytes(32).toString("base64url")]) {
    assert.equal((await client("10.9.9.4").json("/api/auth/reset", { method: "POST", body: { token: t, password: NEW } })).status, 400);
  }

  // Caducado a mano: no sirve.
  if (db) {
    await db.query(`update public.password_resets set expires_at = now() - interval '1 minute' where user_id = (select id from public.users where username = $1)`, [user]);
    const expired = await client("10.9.9.4").json("/api/auth/reset", { method: "POST", body: { token: tok2, password: NEW } });
    assert.equal(expired.status, 400, "enlace vencido");
    await db.query(`update public.password_resets set expires_at = now() + interval '30 minutes' where user_id = (select id from public.users where username = $1)`, [user]);
  }

  // Éxito.
  const ok = await client("10.9.9.4").json("/api/auth/reset", { method: "POST", body: { token: tok2, password: NEW } });
  assert.equal(ok.status, 200);
  assert.equal(ok.body.username, user);

  const reuse = await client("10.9.9.4").json("/api/auth/reset", { method: "POST", body: { token: tok2, password: "otra contraseña 789" } });
  assert.equal(reuse.status, 400, "un enlace solo se usa una vez");

  assert.equal((await dev1.json("/api/state")).status, 401, "la sesión abierta antes del cambio se cerró");
  assert.equal((await client("10.9.9.4").json("/api/auth/login", { method: "POST", body: { username: user, password: OLD } })).status, 401, "la vieja ya no entra");
  const fresh = client("10.9.9.4");
  assert.equal((await fresh.json("/api/auth/login", { method: "POST", body: { username: user, password: NEW } })).status, 200);
  // Y también se puede entrar con el correo.
  const byMail = client("10.9.9.4");
  assert.equal((await byMail.json("/api/auth/login", { method: "POST", body: { username: mail, password: NEW } })).status, 200);
  assert.equal((await byMail.json("/api/state")).status, 200);
});

test("recuperación: límite por cuenta y por IP, y origen obligatorio", async () => {
  const user = `limite-${suffix}`;
  const mail = `${user}@correo.test`;
  await client("10.9.9.5").json("/api/auth/register", { method: "POST", body: { username: user, email: mail, password: PASS } });
  const ip = "10.9.9.6";
  for (let i = 0; i < 4; i++) {
    const r = await client(ip).json("/api/auth/forgot", { method: "POST", body: { identifier: user } });
    assert.equal(r.status, 200, "siempre la misma respuesta, aunque ya no envíe");
  }
  await new Promise((r) => setTimeout(r, 1000));
  assert.equal(mailsTo(mail).length, 3, "máximo 3 correos por hora y cuenta");
  const many = client("10.9.9.7");
  let last;
  for (let i = 0; i < 6; i++) last = await many.json("/api/auth/forgot", { method: "POST", body: { identifier: `x${i}-${suffix}` } });
  assert.equal(last.status, 429, "máximo 5 solicitudes por hora y por IP");
  assert.equal((await client("10.9.9.8").json("/api/auth/forgot", { method: "POST", body: { identifier: user }, origin: "https://malo.example" })).status, 403);
  assert.equal((await client("10.9.9.8").json("/api/auth/reset", { method: "POST", body: { token: "x", password: PASS }, origin: null })).status, 403);
});

test("cuenta: cambiar contraseña y correo exige la contraseña actual", async () => {
  const user = `cuenta-${suffix}`;
  const mail = `${user}@correo.test`;
  const P1 = "primera clave 1234";
  const P2 = "segunda clave 5678";
  const d1 = client("10.9.9.10");
  const d2 = client("10.9.9.10");
  await d1.json("/api/auth/register", { method: "POST", body: { username: user, email: mail, password: P1 } });
  await d2.json("/api/auth/login", { method: "POST", body: { username: user, password: P1 } });
  assert.equal((await d2.json("/api/state")).status, 200);

  const anon = client("10.9.9.10");
  assert.equal((await anon.json("/api/account/password", { method: "POST", body: { current: P1, next: P2 } })).status, 401);
  assert.equal((await d1.json("/api/account/password", { method: "POST", body: { current: "equivocada 123", next: P2 } })).status, 403);
  assert.equal((await d1.json("/api/account/password", { method: "POST", body: { current: P1, next: "corta" } })).status, 400);
  assert.equal((await d1.json("/api/account/password", { method: "POST", body: { current: P1, next: P2 }, origin: null })).status, 403);
  assert.equal((await d1.json("/api/account/password", { method: "POST", body: { current: P1, next: P2 } })).status, 200);
  assert.equal((await d1.json("/api/state")).status, 200, "la sesión desde la que se cambió sigue abierta");
  assert.equal((await d2.json("/api/state")).status, 401, "las demás se cerraron");
  assert.equal((await client("10.9.9.10").json("/api/auth/login", { method: "POST", body: { username: user, password: P1 } })).status, 401);
  assert.equal((await client("10.9.9.10").json("/api/auth/login", { method: "POST", body: { username: user, password: P2 } })).status, 200);

  // Correo
  assert.equal((await d1.json("/api/account/email", { method: "POST", body: { password: "equivocada 123", email: "otro@correo.test" } })).status, 403);
  assert.equal((await d1.json("/api/account/email", { method: "POST", body: { password: P2, email: "no-es-correo" } })).status, 400);
  assert.equal((await d1.json("/api/account/email", { method: "POST", body: { password: P2, email: emailA } })).status, 409, "ya lo usa otra cuenta");
  const newMail = `nuevo-${suffix}@correo.test`;
  const ch = await d1.json("/api/account/email", { method: "POST", body: { password: P2, email: newMail.toUpperCase() } });
  assert.equal(ch.status, 200);
  assert.equal(ch.body.email, newMail);
  await client("10.9.9.11").json("/api/auth/forgot", { method: "POST", body: { identifier: user } });
  assert.equal((await waitForMails(newMail, 1)).length, 1, "ahora el enlace llega al correo nuevo");
  assert.equal(mailsTo(mail).length, 0, "y no al anterior");
});

test("cuentas sin correo (anteriores a la migración) no reciben enlaces", async () => {
  if (!db) return;
  const user = `sinmail-${suffix}`;
  await client("10.9.9.12").json("/api/auth/register", { method: "POST", body: { username: user, email: `${user}@correo.test`, password: PASS } });
  await db.query(`update public.users set email = null where username = $1`, [user]);
  const r = await client("10.9.9.12").json("/api/auth/forgot", { method: "POST", body: { identifier: user } });
  assert.equal(r.status, 200);
  await new Promise((res) => setTimeout(res, 800));
  assert.equal(mailsTo(`${user}@correo.test`).length, 0);
  // Puede agregar su correo desde «Cuenta».
  const c = client("10.9.9.12");
  await c.json("/api/auth/login", { method: "POST", body: { username: user, password: PASS } });
  const add = await c.json("/api/account/email", { method: "POST", body: { password: PASS, email: `${user}@correo.test` } });
  assert.equal(add.status, 200);
});
