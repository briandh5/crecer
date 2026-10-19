"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useState, type ReactNode } from "react";
import { todayISO } from "./date";
import { createDemoState, EMPTY_STATE, type DataState } from "./demo";
import type { Child, JournalEntry, Measurement, VaccineRecord } from "./types";

/**
 * Almacén de datos de la app.
 *
 * Modo demo: todo vive en localStorage (por dispositivo). Las formas de los datos son las mismas que las tablas
 * de supabase/migrations/0001_schema.sql, así que conectar Supabase consiste en sustituir las acciones de este
 * archivo por llamadas a supabase-js, sin tocar los componentes.
 */

const STORAGE_KEY = "crecer:v1";

export type NewChild = Omit<Child, "id" | "tone"> & { tone?: Child["tone"] };
export type NewMeasurement = Omit<Measurement, "id" | "source">;
export type NewJournalEntry = Omit<JournalEntry, "id">;

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

const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

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

function readStored(): DataState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DataState;
    return parsed?.version === 1 && Array.isArray(parsed.children) ? parsed : null;
  } catch {
    return null;
  }
}

interface Store {
  /** false hasta que se leyó localStorage (evita parpadeos y desajustes de hidratación). */
  ready: boolean;
  today: string;
  state: DataState;
  child: Child | null;
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
    addJournal(input: NewJournalEntry): void;
    removeJournal(id: string): void;
    clearDemo(): void;
    loadDemo(): void;
  };
}

const StoreContext = createContext<Store | null>(null);

export function StoreProvider({ children: tree }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, EMPTY_STATE);
  const [ready, setReady] = useState(false);
  const [today, setToday] = useState("2000-01-01");

  useEffect(() => {
    const t = todayISO();
    setToday(t);
    // Primera visita → datos de ejemplo. Después → lo guardado.
    dispatch({ type: "load", state: readStored() ?? createDemoState(t) });
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return; // no pisar lo guardado con el estado vacío inicial
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* almacenamiento lleno o bloqueado: la app sigue funcionando en memoria */
    }
  }, [ready, state]);

  // Al volver a abrir la pestaña otro día, "hoy" se actualiza.
  useEffect(() => {
    const onVisible = () => document.visibilityState === "visible" && setToday(todayISO());
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);

  const addChild = useCallback(
    (input: NewChild) => {
      const id = newId();
      dispatch({ type: "addChild", child: { ...input, id, tone: input.tone ?? TONES[state.children.length % TONES.length] } });
      return id;
    },
    [state.children.length],
  );

  const actions = useMemo<Store["actions"]>(
    () => ({
      setActive: (id) => dispatch({ type: "setActive", id }),
      addChild,
      updateChild: (id, patch) => dispatch({ type: "updateChild", id, patch }),
      removeChild: (id) => dispatch({ type: "removeChild", id }),
      addMeasurement: (input) => dispatch({ type: "addMeasurement", m: { ...input, id: newId(), source: "manual" } }),
      removeMeasurement: (id) => dispatch({ type: "removeMeasurement", id }),
      saveVaccine: (record) => dispatch({ type: "saveVaccine", record }),
      clearVaccine: (childId, vaccineId) => dispatch({ type: "clearVaccine", childId, vaccineId }),
      setMilestone: (childId, milestoneId, achievedAt) => dispatch({ type: "setMilestone", childId, milestoneId, achievedAt }),
      addJournal: (input) => dispatch({ type: "addJournal", entry: { ...input, id: newId() } }),
      removeJournal: (id) => dispatch({ type: "removeJournal", id }),
      clearDemo: () => dispatch({ type: "clearDemo" }),
      loadDemo: () => dispatch({ type: "load", state: createDemoState(todayISO()) }),
    }),
    [addChild],
  );

  const child = state.children.find((c) => c.id === state.activeChildId) ?? state.children[0] ?? null;
  const value = useMemo<Store>(() => ({ ready, today, state, child, actions }), [ready, today, state, child, actions]);

  return <StoreContext.Provider value={value}>{tree}</StoreContext.Provider>;
}

export function useStore(): Store {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore debe usarse dentro de <StoreProvider>");
  return ctx;
}
