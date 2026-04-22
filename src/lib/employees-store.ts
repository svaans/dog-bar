import { randomUUID } from "crypto";

import type { EmployeePublic, EmployeeRecord } from "@/lib/employee-types";
import { getOrderStorageMode } from "@/lib/order-storage-mode";
import { hashPin, verifyPin } from "@/lib/pin-hash";
import * as jsonIo from "@/lib/employees-io-json";
import * as supabaseIo from "@/lib/employees-io-supabase";

async function readAll(): Promise<EmployeeRecord[]> {
  return getOrderStorageMode() === "supabase"
    ? await supabaseIo.readEmployeesSupabase()
    : jsonIo.readEmployeesJson();
}

export async function countActiveEmployees(): Promise<number> {
  const all = await readAll();
  return all.filter((e) => e.active).length;
}

export async function getActiveEmployeeById(id: string): Promise<EmployeePublic | null> {
  const all = await readAll();
  const e = all.find((x) => x.active && x.id === id);
  if (!e) return null;
  return { id: e.id, employeeNumber: e.employeeNumber, displayName: e.displayName };
}

export async function listEmployeesForAdmin(): Promise<EmployeePublic[]> {
  const all = await readAll();
  return all
    .map((e) => ({
      id: e.id,
      employeeNumber: e.employeeNumber,
      displayName: e.displayName,
    }))
    .sort((a, b) => a.employeeNumber - b.employeeNumber);
}

export async function listEmployeesForAdminWithActive(): Promise<
  (EmployeePublic & { active: boolean })[]
> {
  const all = await readAll();
  return all
    .map((e) => ({
      id: e.id,
      employeeNumber: e.employeeNumber,
      displayName: e.displayName,
      active: e.active,
    }))
    .sort((a, b) => a.employeeNumber - b.employeeNumber);
}

export async function verifyEmployeeLogin(
  employeeNumber: number,
  plainPin: string,
): Promise<EmployeeRecord | null> {
  const all = await readAll();
  const row = all.find((e) => e.active && e.employeeNumber === employeeNumber);
  if (!row) return null;
  return verifyPin(plainPin, row.pinHash) ? row : null;
}

export async function createEmployee(input: {
  employeeNumber: number;
  displayName: string;
  pin: string;
}): Promise<EmployeeRecord> {
  const trimmedName = input.displayName.trim().slice(0, 80);
  if (!trimmedName) throw new Error("Nombre vacío");
  if (!Number.isFinite(input.employeeNumber) || input.employeeNumber < 1 || input.employeeNumber > 999) {
    throw new Error("Número de empleado no válido");
  }
  const pin = input.pin.trim();
  if (pin.length < 4 || pin.length > 12 || !/^\d+$/.test(pin)) {
    throw new Error("El PIN debe ser solo dígitos, entre 4 y 12.");
  }

  const row: EmployeeRecord = {
    id: randomUUID(),
    employeeNumber: input.employeeNumber,
    displayName: trimmedName,
    pinHash: hashPin(pin),
    active: true,
    createdAt: new Date().toISOString(),
  };

  if (getOrderStorageMode() === "supabase") {
    await supabaseIo.insertEmployeeSupabase(row);
    return row;
  }

  const all = jsonIo.readEmployeesJson();
  if (all.some((e) => e.employeeNumber === row.employeeNumber)) {
    throw new Error("Ese número de empleado ya existe.");
  }
  all.push(row);
  jsonIo.writeEmployeesJson(all);
  return row;
}

export async function setEmployeeActive(id: string, active: boolean): Promise<void> {
  if (getOrderStorageMode() === "supabase") {
    await supabaseIo.setEmployeeActiveSupabase(id, active);
    return;
  }
  const all = jsonIo.readEmployeesJson();
  const next = all.map((e) => (e.id === id ? { ...e, active } : e));
  if (!next.some((e) => e.id === id)) throw new Error("Empleado no encontrado.");
  jsonIo.writeEmployeesJson(next);
}
