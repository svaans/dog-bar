import { NextResponse } from "next/server";

import { jsonErrorFromException } from "@/lib/api-error-response";
import { isAllowedStaffStatusChange } from "@/lib/order-transitions";
import { getOrder, updateOrderStatus } from "@/lib/orders-store";
import { getStaffProvidedKey } from "@/lib/staff-request";
import { staffKeyMatches } from "@/lib/staff-auth";
import type { OrderStatus } from "@/types/orders";

export const runtime = "nodejs";

const STATUSES: OrderStatus[] = [
  "nuevo",
  "preparando",
  "listo",
  "entregado",
  "cancelado",
];

const STALE_ORDER_MSG =
  "Este pedido ya se ha actualizado en otro sitio. Pulsa «Actualizar ya» en la lista.";

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  if (!staffKeyMatches(getStaffProvidedKey(req))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await ctx.params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "No se pudo leer la petición" }, { status: 400 });
  }

  const bodyObj = body as {
    status?: unknown;
    actorName?: unknown;
    baseUpdatedAt?: unknown;
  };
  const status = bodyObj?.status;
  const actorName =
    typeof bodyObj.actorName === "string" ? bodyObj.actorName.trim().slice(0, 80) : "";
  const baseUpdatedAt =
    typeof bodyObj.baseUpdatedAt === "string" ? bodyObj.baseUpdatedAt.trim() : undefined;

  if (typeof status !== "string" || !STATUSES.includes(status as OrderStatus)) {
    return NextResponse.json({ error: "Estado no válido" }, { status: 400 });
  }

  let current;
  try {
    current = await getOrder(id);
  } catch (e) {
    return jsonErrorFromException(e);
  }
  if (!current) {
    return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 });
  }

  const nextStatus = status as OrderStatus;
  if (!isAllowedStaffStatusChange(current.status, nextStatus)) {
    return NextResponse.json(
      {
        error: `Transición no permitida: ${current.status} → ${nextStatus}`,
      },
      { status: 400 },
    );
  }

  let result;
  try {
    result = await updateOrderStatus(id, nextStatus, {
      actorName: actorName || undefined,
      ifUpdatedAt: baseUpdatedAt,
    });
  } catch (e) {
    return jsonErrorFromException(e);
  }
  if (!result.ok) {
    if (result.reason === "conflict") {
      return NextResponse.json({ error: STALE_ORDER_MSG }, { status: 409 });
    }
    return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, order: result.order });
}

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  if (!staffKeyMatches(getStaffProvidedKey(req))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const { id } = await ctx.params;
  let order;
  try {
    order = await getOrder(id);
  } catch (e) {
    return jsonErrorFromException(e);
  }
  if (!order) {
    return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 });
  }
  return NextResponse.json({ order });
}
