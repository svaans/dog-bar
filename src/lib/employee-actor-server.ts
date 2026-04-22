import { getEmployeeSessionFromCookies } from "@/lib/employee-session";
import { getActiveEmployeeById } from "@/lib/employees-store";

/** Nombre para actor en pedidos / mesa si hay sesión de empleado válida. */
export async function resolveStaffActorDisplayName(): Promise<string | null> {
  const sess = await getEmployeeSessionFromCookies();
  if (!sess) return null;
  const emp = await getActiveEmployeeById(sess.sub);
  return emp?.displayName?.trim() ? emp.displayName.trim().slice(0, 80) : null;
}
