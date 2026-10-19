"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from "react";
import { todayISO } from "./date";
import { createDemoState, EMPTY_STATE, type DataState } from "./demo";
import type { Child, JournalEntry, Measurement, VaccineRecord } from "./types";

/**
 * Almacén de datos de la app. Dos modos con las mismas acciones:
 *
 * - "remote" (cuenta): el estado inicial viene del servidor; cada acción se aplica al instante en pantalla
 *   y se envía en orden a /api/actions (src/server/actions.ts). Si algo falla, se vuelve a pedir el estado real.
 * - "demo": todo vive en localStorage de este dispositivo, con dos perfiles de ejemplo y sin fotos.
 */

const DEMO_KEY = "crecer:v1";
const activeKey = (username: string) => `crecer:active:${username}`;

export type NewChild = Omit<Child, "id" | "tone"> & { tone?: Child["tone"] };
export type NewMeasurement = Omit<Measurement, "id" | "source">;
export type NewJournalEntry = Omit<JournalEntry, "id" | "hasPhoto">;

type Action =
  | { type: "load"; state: DataState }
  | { type: "setActive"; id: string }
  | { type: "addChild"; child: Child }
  | { type: "updateChild"; id: string; patch: Partial<Omit<Child, "id">> }
  | { type: "removeChild"; id: string }
  | { type: "addMeasurement"; m: Measurement }
  | { type: "removeMeasurement"; id: string }
  | { type: "saveVaccine"; record: VaccineRecord }
  | { type: "clearVaccine"; childId: string; vaccineId: string }
  | { type: "setMilestone"; childId: string; milestoneId: string; achievedAt: string | null }
  | { type: "addJournal"; entry: JournalEntry }
  | { type: "removeJournal"; id: string }
  | { type: "clearDemo" };

/** Acciones que solo afectan a esta pantalla y no se envían al servidor. */
const LOCAL_ONLY = new Set<Action["type"]>(["load", "setActive", "clearDemo"]);

const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) =>
        (Number(c) ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (Number(c) / 4)))).toString(16),
      );

const TONES: Child["tone"][] = ["moss", "sage", "terracotta", "sand"];

function birthMeasurement(child: Child, previousId?: string): Measurement | null {
  if (child.birthWeightKg == null && child.birthLengthCm == null && child.birthHeadCm == null) return null;
  return {
    id: previousId ?? newId(),
    childId: child.id,
    measuredAt: child.birthDate,
    weightKg: child.birthWeightKg,
    heightCm: child.birthLengthCm,
    headCm: child.birthHeadCm,
    note: "Datos de nacimiento",
    source: "birth",
  };
}

/** Mantiene la medición "de nacimiento" alineada con la ficha, igual que el trigger de la base de datos. */
function syncBirth(measurements: Measurement[], child: Child): Measurement[] {
  const existing = measurements.find((m) => m.childId === child.id && m.source === "birth");
  const rest = measurements.filter((m) => m !== existing);
  const next = birthMeasurement(child, existing?.id);
  return next ? [...rest, next] : rest;
}

function reducer(state: DataState, action: Action): DataState {
  switch (action.type) {
    case "load":
      return action.state;
    case "setActive":
      return state.children.some((c) => c.id === action.id) ? { ...state, activeChildId: action.id } : state;
    case "addChild":
      return {
        ...state,
        children: [...state.children, action.child],
        measurements: syncBirth(state.measurements, action.child),
        activeChildId: action.child.id,
      };
    case "updateChild": {
      const children = state.children.map((c) => (c.id === action.id ? { ...c, ...action.patch } : c));
      const updated = children.find((c) => c.id === action.id);
      return { ...state, children, measurements: updated ? syncBirth(state.measurements, updated) : state.measurements };
    }
    case "removeChild": {
      const children = state.children.filter((c) => c.id !== action.id);
      const own = <T extends { childId: string }>(rows: T[]) => rows.filter((r) => r.childId !== action.id);
      return {
        ...state,
        children,
        measurements: own(state.measurements),
        vaccineRecords: own(state.vaccineRecords),
        milestoneRecords: own(state.milestoneRecords),
        journal: own(state.journal),
        activeChildId: state.activeChildId === action.id ? (children[0]?.id ?? null) : state.activeChildId,
      };
    }
    case "addMeasurement":
      return { ...state, measurements: [...state.measurements, action.m] };
    case "removeMeasurement":
      // La medición de nacimiento se edita desde la ficha, no desde el historial.
      return { ...state, measurements: state.measurements.filter((m) => m.id !== action.id || m.source === "birth") };
    case "saveVaccine": {
      const { childId, vaccineId } = action.record;
      const rest = state.vaccineRecords.filter((r) => !(r.childId === childId && r.vaccineId === vaccineId));
      return { ...state, vaccineRecords: [...rest, action.record] };
    }
    case "clearVaccine":
      return {
        ...state,
        vaccineRecords: state.vaccineRecords.filter((r) => !(r.childId === action.childId && r.vaccineId === action.vaccineId)),
      };
    case "setMilestone": {
      const rest = state.milestoneRecords.filter((r) => !(r.childId === action.childId && r.milestoneId === action.milestoneId));
      return {
        ...state,
        milestoneRecords: action.achievedAt
          ? [...rest, { childId: action.childId, milestoneId: action.milestoneId, achievedAt: action.achievedAt }]
          : rest,
      };
    }
    case "addJournal":
      return { ...state, journal: [...state.journal, action.entry] };
    case "removeJournal":
      return { ...state, journal: state.journal.filter((j) => j.id !== action.id) };
    case "clearDemo":
      return { ...EMPTY_STATE };
  }
}

function readDemo(): DataState | null {
  try {
    const raw = localStorage.getItem(DEMO_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DataState;
    return parsed?.version === 1 && Array.isArray(parsed.children) ? parsed : null;
  } catch {
    return null;
  }
}

class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function api(url: string, init: RequestInit): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(url, { credentials: "same-origin", ...init });
  } catch {
    throw new ApiError(0, "Sin conexión. Revisa tu internet; tus cambios recientes no se guardaron.");
  }
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new ApiError(res.status, body?.error ?? "No se pudo guardar.");
  }
  return res;
}

const postAction = (action: Action) =>
  api("/api/actions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) });

const postPhoto = (entryId: string, photo: Blob) =>
  api(`/api/photos/${entryId}`, { method: "POST", headers: { "Content-Type": "image/jpeg" }, body: photo });

export interface SyncStatus {
  /** Cambios que todavía no llegaron al servidor. */
  pending: number;
  error: string | null;
  sessionExpired: boolean;
  dismissError(): void;
}

interface Store {
  /** false hasta que se calculó "hoy" en el dispositivo (evita parpadeos y desajustes de hidratación). */
  ready: boolean;
  today: string;
  mode: "demo" | "remote";
  username: string;
  /** Prefijo de las rutas de este perfil: "/briandh444" o "/demo". */
  base: string;
  /** Correo de la cuenta; solo en modo cuenta. */
  email: string | null;
  setEmail(email: string): void;
  state: DataState;
  child: Child | null;
  sync: SyncStatus;
  /** URL para mostrar la foto de un recuerdo (la local mientras se sube, luego la del servidor). */
  photoUrl(entry: JournalEntry): string | null;
  actions: {
    setActive(id: string): void;
    addChild(input: NewChild): string;
    updateChild(id: string, patch: Partial<Omit<Child, "id">>): void;
    removeChild(id: string): void;
    addMeasurement(input: NewMeasurement): void;
    removeMeasurement(id: string): void;
    saveVaccine(record: VaccineRecord): void;
    clearVaccine(childId: string, vaccineId: string): void;
    setMilestone(childId: string, milestoneId: string, achievedAt: string | null): void;
    addJournal(input: NewJournalEntry, photo?: Blob | null): void;
    removeJournal(id: string): void;
    clearDemo(): void;
    loadDemo(): void;
    logout(): Promise<void>;
  };
}

const StoreContext = createContext<Store | null>(null);

interface ProviderProps {
  mode: "demo" | "remote";
  username: string;
  /** Estado inicial cuando es una cuenta (viene del servidor). */
  initial?: DataState;
  /** Correo de la cuenta (null si todavía no lo registró). */
  email?: string | null;
  children: ReactNode;
}

export function StoreProvider({ mode, username, initial, email: initialEmail = null, children: tree }: ProviderProps) {
  const [email, setEmail] = useState<string | null>(initialEmail);
  const [state, dispatch] = useReducer(reducer, initial ?? EMPTY_STATE);
  const [ready, setReady] = useState(false);
  const [today, setToday] = useState("2000-01-01");
  const [pending, setPending] = useState(0);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);

  const stateRef = useRef(state);
  stateRef.current = state;
  const chain = useRef<Promise<void>>(Promise.resolve());
  const pendingRef = useRef(0);
  const failed = useRef(false);
  const localPhotos = useRef(new Map<string, string>());

  useEffect(() => {
    const t = todayISO();
    setToday(t);
    if (mode === "demo") {
      // Primera visita → datos de ejemplo. Después → lo guardado en este dispositivo.
      dispatch({ type: "load", state: readDemo() ?? createDemoState(t) });
    } else {
      try {
        const saved = localStorage.getItem(activeKey(username));
        if (saved) dispatch({ type: "setActive", id: saved });
      } catch {
        /* sin almacenamiento local: se usa el primer perfil */
      }
    }
    setReady(true);
    const photos = localPhotos.current;
    return () => photos.forEach((url) => URL.revokeObjectURL(url));
  }, [mode, username]);

  // Demo: guardar en este dispositivo.
  useEffect(() => {
    if (mode !== "demo" || !ready) return; // no pisar lo guardado con el estado vacío inicial
    try {
      localStorage.setItem(DEMO_KEY, JSON.stringify(state));
    } catch {
      /* almacenamiento lleno o bloqueado: la app sigue funcionando en memoria */
    }
  }, [mode, ready, state]);

  // Cuenta: recordar qué hijo estaba abierto en este dispositivo.
  useEffect(() => {
    if (mode !== "remote" || !ready || !state.activeChildId) return;
    try {
      localStorage.setItem(activeKey(username), state.activeChildId);
    } catch {
      /* ignorar */
    }
  }, [mode, ready, username, state.activeChildId]);

  // Aviso si se intenta cerrar la pestaña con cambios sin enviar.
  useEffect(() => {
    if (pending === 0) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [pending]);

  const resync = useCallback(async () => {
    try {
      const res = await api("/api/state", { method: "GET", cache: "no-store" });
      const fresh = (await res.json()) as DataState;
      const current = stateRef.current.activeChildId;
      dispatch({ type: "load", state: { ...fresh, activeChildId: fresh.children.some((c) => c.id === current) ? current : fresh.activeChildId } });
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) setSessionExpired(true);
    }
  }, []);

  // Al volver a la pestaña: "hoy" se actualiza y, en una cuenta, se traen los cambios hechos desde otro dispositivo.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      setToday(todayISO());
      if (mode === "remote" && pendingRef.current === 0) void resync();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [mode, resync]);

  /** Envía los cambios al servidor de uno en uno y en orden. Tras un fallo, descarta el resto y recarga el estado real. */
  const enqueue = useCallback(
    (job: () => Promise<unknown>) => {
      pendingRef.current += 1;
      setPending(pendingRef.current);
      chain.current = chain.current
        .then(async () => {
          if (failed.current) return;
          try {
            await job();
          } catch (e) {
            failed.current = true;
            const err = e instanceof ApiError ? e : new ApiError(0, "No se pudo guardar.");
            if (err.status === 401) setSessionExpired(true);
            setSyncError(err.message);
          }
        })
        .finally(async () => {
          pendingRef.current -= 1;
          setPending(pendingRef.current);
          if (pendingRef.current === 0 && failed.current) {
            await resync();
            failed.current = false;
          }
        });
    },
    [resync],
  );

  const send = useCallback(
    (action: Action) => {
      dispatch(action);
      if (mode === "remote" && !LOCAL_ONLY.has(action.type)) enqueue(() => postAction(action));
    },
    [mode, enqueue],
  );

  const childCount = state.children.length;
  const actions = useMemo<Store["actions"]>(
    () => ({
      setActive: (id) => dispatch({ type: "setActive", id }),
      addChild: (input) => {
        const id = newId();
        send({ type: "addChild", child: { ...input, id, tone: input.tone ?? TONES[childCount % TONES.length] } });
        return id;
      },
      updateChild: (id, patch) => send({ type: "updateChild", id, patch }),
      removeChild: (id) => send({ type: "removeChild", id }),
      addMeasurement: (input) => send({ type: "addMeasurement", m: { ...input, id: newId(), source: "manual" } }),
      removeMeasurement: (id) => send({ type: "removeMeasurement", id }),
      saveVaccine: (record) => send({ type: "saveVaccine", record }),
      clearVaccine: (childId, vaccineId) => send({ type: "clearVaccine", childId, vaccineId }),
      setMilestone: (childId, milestoneId, achievedAt) => send({ type: "setMilestone", childId, milestoneId, achievedAt }),
      addJournal: (input, photo) => {
        const id = newId();
        const withPhoto = !!photo && mode === "remote";
        if (withPhoto) localPhotos.current.set(id, URL.createObjectURL(photo!));
        send({ type: "addJournal", entry: { ...input, id, hasPhoto: withPhoto } });
        if (withPhoto) enqueue(() => postPhoto(id, photo!));
      },
      removeJournal: (id) => {
        const url = localPhotos.current.get(id);
        if (url) {
          URL.revokeObjectURL(url);
          localPhotos.current.delete(id);
        }
        send({ type: "removeJournal", id });
      },
      clearDemo: () => dispatch({ type: "clearDemo" }),
      loadDemo: () => dispatch({ type: "load", state: createDemoState(todayISO()) }),
      logout: async () => {
        await api("/api/auth/logout", { method: "POST" }).catch(() => {});
        window.location.assign("/");
      },
    }),
    [send, enqueue, mode, childCount],
  );

  const photoUrl = useCallback(
    (entry: JournalEntry) => (entry.hasPhoto ? (localPhotos.current.get(entry.id) ?? `/api/photos/${entry.id}`) : null),
    [],
  );

  const child = state.children.find((c) => c.id === state.activeChildId) ?? state.children[0] ?? null;
  const sync = useMemo<SyncStatus>(
    () => ({ pending, error: syncError, sessionExpired, dismissError: () => setSyncError(null) }),
    [pending, syncError, sessionExpired],
  );
  const value = useMemo<Store>(
    () => ({ ready, today, mode, username, base: `/${username}`, email, setEmail, state, child, sync, photoUrl, actions }),
    [ready, today, mode, username, email, state, child, sync, photoUrl, actions],
  );

  return <StoreContext.Provider value={value}>{tree}</StoreContext.Provider>;
}

export function useStore(): Store {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore debe usarse dentro de <StoreProvider>");
  return ctx;
}
