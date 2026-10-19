import milestonesJson from "../data/milestones.json";
import vaccinesJson from "../data/vaccines.json";
import type { MilestoneDef, VaccineDef } from "./types";

export const VACCINES = vaccinesJson as VaccineDef[];
export const MILESTONES = milestonesJson as MilestoneDef[];
