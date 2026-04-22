import { NextResponse } from "next/server";

import { jsonErrorFromException } from "@/lib/api-error-response";
import { listOrders } from "@/lib/orders-store";
import type { Order } from "@/types/orders";

export const runtime = "nodejs";

/** Respuesta mínima para el cliente en mesa (sin datos internos). */
function toPublicOrder(o: Order) {
  return {
    id: o.id,
    mesa: o.mesa,
    status: o.status,
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
    customerNote: o.customerNote,
    customerDisplayName: o.customerDisplayName,
    lines: o.lines.map((l) => ({
      name: l.name,
      quantity: l.quantity,
      optionsLabel: l.optionsLabel,
      unitPriceEuros: l.unitPriceEuros,
    })),
  };
}

export async function GET(_req: Request, ctx: { params: Promise<{ mesa: string }> }) {
  const { mesa: raw } = await ctx.params;
  const mesa = parseInt(raw, 10);
  if (!Number.isFinite(mesa) || mesa < 1 || mesa > 99) {
    return NextResponse.json({ error: "Mesa no válida" }, { status: 400 });
  }
  try {
    const active = await listOrders(false);
    const mine = active.filter((o) => o.mesa === mesa);
    return NextResponse.json(
      { free: mine.length === 0, orders: mine.map(toPublicOrder) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return jsonErrorFromException(e);
  }
}
