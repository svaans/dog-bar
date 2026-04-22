import fs from "fs";
import path from "path";

import type { StaffMesaAssignment } from "@/lib/staff-mesa-types";

const FILE = path.join(process.cwd(), "data", "staff-mesa-assignments.json");

type FileShape = { assignments: StaffMesaAssignment[] };

function readRaw(): StaffMesaAssignment[] {
  try {
    if (!fs.existsSync(FILE)) return [];
    const raw = fs.readFileSync(FILE, "utf8");
    const data = JSON.parse(raw) as FileShape;
    return Array.isArray(data.assignments) ? data.assignments : [];
  } catch {
    return [];
  }
}

function writeRaw(rows: StaffMesaAssignment[]) {
  const dir = path.dirname(FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify({ assignments: rows }, null, 2), "utf8");
}

export function readAssignmentsJson(): StaffMesaAssignment[] {
  return readRaw();
}

export function writeAssignmentsJson(rows: StaffMesaAssignment[]): void {
  writeRaw(rows);
}
