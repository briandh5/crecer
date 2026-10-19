// Pruebas de integración contra un servidor real (npm run build && npm start) con DATABASE_URL apuntando a una base de pruebas.
//   BASE_URL=http://localhost:3100 npm run test:integration
import assert from "node:assert/strict";
import { randomUUID, randomBytes } from "node:crypto";
import { test, before } from "node:test";

const BASE = process.env.BASE_URL ?? "http://localhost:3100";
const IP = `10.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`;
const suffix = randomBytes(3).toString("hex");
const nameA = `ana-${suffix}`;
const nameB = `luis-${suffix}`;
const PASS = "una clave larga 123";

/** Cliente mínimo con cookie propia. */
function client() {
  let cookie = "";
  const call = async (path, { method = "GET", body, headers = {}, origin = BASE, raw } = {}) => {
    const h = { "x-real-ip": IP, ...headers };
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
  for (const [username, password] of [["ab", PASS], ["con espacio", PASS], ["api", PASS], [nameA, "corta"], [nameA, "12345678"]]) {
    const r = await A.json("/api/auth/register", { method: "POST", body: { username, password } });
    assert.equal(r.status, 400, `${username}/${password}`);
    assert.ok(r.body.error);
  }
  assert.equal(A.cookie, "", "un registro inválido no abre sesión");
});

test("registro y login: crea cuenta, abre sesión y no repite usuario", async () => {
  const r = await A.json("/api/auth/register", { method: "POST", body: { username: nameA.toUpperCase(), password: PASS } });
  assert.equal(r.status, 201);
  assert.equal(r.body.username, nameA, "se guarda en minúsculas");
  assert.match(A.cookie, /^crecer_session=.{40,}/);
  const setCookie = r.res.headers.get("set-cookie");
  assert.match(setCookie, /HttpOnly/i);
  assert.match(setCookie, /SameSite=lax/i);

  const dup = await B.json("/api/auth/register", { method: "POST", body: { username: nameA, password: PASS } });
  assert.equal(dup.status, 409);

  const reg = await B.json("/api/auth/register", { method: "POST", body: { username: nameB, password: PASS } });
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
  await c.json("/api/auth/register", { method: "POST", body: { username: victim, password: PASS } });
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
