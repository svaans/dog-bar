import fs from "fs";
import path from "path";

import type { EmployeeRecord } from "@/lib/employee-types";

const FILE = path.join(process.cwd(), "data", "employees.json");

type FileShape = { employees: EmployeeRecord[] };

function readRaw(): EmployeeRecord[] {
  try {
    if (!fs.existsSync(FILE)) return [];
    const raw = fs.readFileSync(FILE, "utf8");
    const data = JSON.parse(raw) as FileShape;
    return Array.isArray(data.employees) ? data.employees : [];
  } catch {
    return [];
  }
}

function writeRaw(rows: EmployeeRecord[]) {
  const dir = path.dirname(FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify({ employees: rows }, null, 2), "utf8");
}

export function readEmployeesJson(): EmployeeRecord[] {
  return readRaw();
}

export function writeEmployeesJson(rows: EmployeeRecord[]): void {
  writeRaw(rows);
}
