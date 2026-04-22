import { randomUUID } from "crypto";
import { NextResponse } from "next/server";

import { jsonErrorFromException } from "@/lib/api-error-response";
import { getMenuItemById } from "@/lib/menu-loader";
import { orderPostRateLimitResponse } from "@/lib/order-post-rate-limit";
import { createOrder, listOrders, listOrdersForCalendarDay } from "@/lib/orders-store";
import { getStaffProvidedKey } from "@/lib/staff-request";
import { staffKeyMatches } from "@/lib/staff-auth";
import {
  getRestaurantTimeZone,
  todayCalendarDateKey,
} from "@/lib/timezone";
import {
  formatSelectionsLabel,
  modifiersComplete,
  resolveUnitPrice,
} from "@/lib/pricing";
import type { Order, OrderLine } from "@/types/orders";

export const runtime = "nodejs";

/** Evita cuerpos enormes o bucles muy largos al resolver precios. */
const MAX_LINES_PER_ORDER = 50;

export async function GET(req: Request) {
  if (!staffKeyMatches(getStaffProvidedKey(req))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const url = new URL(req.url);
  const scope = url.searchParams.get("scope") ?? "active";

  if (scope === "day") {
    const tz = getRestaurantTimeZone();
    const dayRaw = url.searchParams.get("day")?.trim() || todayCalendarDateKey(tz);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dayRaw)) {
      return NextResponse.json({ error: "Fecha no válida" }, { status: 400 });
    }
    try {
      const orders = await listOrdersForCalendarDay(dayRaw, tz);
      return NextResponse.json({ orders, day: dayRaw, timeZone: tz });
    } catch (e) {
      return jsonErrorFromException(e);
    }
  }

  if (scope !== "active") {
    return NextResponse.json({ error: "Solicitud no válida" }, { status: 400 });
  }

  const all = url.searchParams.get("all") === "1";
  try {
    const orders = await listOrders(all);
    return NextResponse.json({ orders, timeZone: getRestaurantTimeZone() });
  } catch (e) {
    return jsonErrorFromException(e);
  }
}

type IncomingLine = {
  menuItemId: string;
  quantity: number;
  selections?: Record<string, string>;
};

export async function POST(req: Request) {
  const limited = orderPostRateLimitResponse(req);
  if (limited) return limited;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "No se pudo leer el pedido" }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  }

  const { mesa, lines, customerNote, customerDisplayName } = body as {
    mesa?: unknown;
    lines?: unknown;
    customerNote?: unknown;
    customerDisplayName?: unknown;
  };

  const mesaNum =
    typeof mesa === "number"
      ? mesa
      : typeof mesa === "string"
        ? parseInt(mesa, 10)
        : NaN;

  if (!Number.isFinite(mesaNum) || mesaNum < 1 || mesaNum > 99) {
    return NextResponse.json({ error: "Mesa no válida" }, { status: 400 });
  }

  if (!Array.isArray(lines) || lines.length === 0) {
    return NextResponse.json({ error: "Pedido vacío" }, { status: 400 });
  }
  if (lines.length > MAX_LINES_PER_ORDER) {
    return NextResponse.json({ error: "Pedido demasiado grande" }, { status: 400 });
  }

  const resolvedLines: OrderLine[] = [];

  for (const raw of lines as IncomingLine[]) {
    if (!raw || typeof raw.menuItemId !== "string") {
      return NextResponse.json({ error: "Línea inválida" }, { status: 400 });
    }
    const qty = Number(raw.quantity);
    if (!Number.isFinite(qty) || qty < 1 || qty > 20) {
      return NextResponse.json({ error: "Cantidad no válida" }, { status: 400 });
    }

    const item = getMenuItemById(raw.menuItemId);
    if (!item) {
      return NextResponse.json(
        { error: `Producto desconocido: ${raw.menuItemId}` },
        { status: 400 },
      );
    }

    const selections =
      raw.selections && typeof raw.selections === "object"
        ? (raw.selections as Record<string, string>)
        : {};

    if (!modifiersComplete(item, selections)) {
      return NextResponse.json(
        { error: `Faltan opciones en: ${item.name}` },
        { status: 400 },
      );
    }

    const unitPrice = resolveUnitPrice(item, selections);
    if (unitPrice === null && item.priceEuros === null && !item.modifiers?.length) {
      // copas sin precio: permitido
    } else if (unitPrice === null && item.modifiers?.length) {
      return NextResponse.json(
        { error: `No se pudo calcular el precio de: ${item.name}` },
        { status: 400 },
      );
    }

    const optionsLabel = formatSelectionsLabel(item, selections);
    resolvedLines.push({
      menuItemId: item.id,
      name: item.name,
      quantity: qty,
      unitPriceEuros: unitPrice,
      optionsLabel: optionsLabel || undefined,
    });
  }

  const now = new Date().toISOString();
  const displayName =
    typeof customerDisplayName === "string" && customerDisplayName.trim()
      ? customerDisplayName.trim().slice(0, 120)
      : undefined;

  const order: Order = {
    id: randomUUID(),
    mesa: mesaNum,
    createdAt: now,
    updatedAt: now,
    status: "nuevo",
    lines: resolvedLines,
    customerDisplayName: displayName,
    customerNote:
      typeof customerNote === "string" && customerNote.trim()
        ? customerNote.trim().slice(0, 500)
        : undefined,
    statusLog: [{ at: now, status: "nuevo" }],
  };

  try {
    await createOrder(order);
  } catch (e) {
    return jsonErrorFromException(e);
  }
  return NextResponse.json({ ok: true, orderId: order.id });
}
