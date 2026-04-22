"use client";

import { staffFill, staffT } from "@/lib/staff-i18n";
import { sortOrderLinesByMenuTab } from "@/lib/sort-order-lines-by-menu-tab";
import type { UiLang } from "@/lib/ui-i18n";
import type { Order } from "@/types/orders";

function esc(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function OrderPrintButton({
  order,
  lang = "es",
  menuTabByItemId,
  menuTabOrder,
}: {
  order: Order;
  lang?: UiLang;
  menuTabByItemId?: Record<string, string>;
  menuTabOrder?: string[];
}) {
  function print() {
    const linesForPrint =
      menuTabByItemId && menuTabOrder?.length
        ? sortOrderLinesByMenuTab(order.lines, menuTabByItemId, menuTabOrder)
        : order.lines;
    const linesHtml = linesForPrint
      .map(
        (l) =>
          `<tr><td>${l.quantity}×</td><td>${esc(l.name)}${l.optionsLabel ? ` <small>(${esc(l.optionsLabel)})</small>` : ""}</td><td style="text-align:right">${l.unitPriceEuros === null ? "—" : l.unitPriceEuros.toFixed(2)}</td></tr>`,
      )
      .join("");
    const titleLine = esc(staffFill(staffT("printMesaLine", lang), { n: String(order.mesa) }));
    const refLine = esc(staffFill(staffT("printRefFooter", lang), { id: order.id }));
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Ticket</title>
    <style>
      body{font-family:system-ui,sans-serif;padding:12px;max-width:320px;margin:0 auto;}
      h1{font-size:18px;margin:0 0 8px;}
      table{width:100%;border-collapse:collapse;font-size:13px;}
      td{padding:4px 0;border-bottom:1px solid #ddd;vertical-align:top;}
      .muted{color:#555;font-size:12px;}
      @media print { body { padding: 0; } }
    </style></head><body>
      <h1>${titleLine}</h1>
      <p class="muted">${new Date(order.createdAt).toLocaleString(lang === "en" ? "en-GB" : "es-ES")}</p>
      ${order.customerDisplayName ? `<p><strong>${esc(order.customerDisplayName)}</strong></p>` : ""}
      ${order.customerNote ? `<p class="muted">${esc(order.customerNote)}</p>` : ""}
      <table><tbody>${linesHtml}</tbody></table>
      <p class="muted" style="margin-top:12px">${refLine}</p>
      <script>window.onload=function(){window.print();setTimeout(function(){window.close()},300);}</script>
    </body></html>`;
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.open();
    w.document.write(html);
    w.document.close();
  }

  return (
    <button
      type="button"
      onClick={print}
      className="rounded-full border border-[#c4a574] bg-white px-3 py-1.5 text-xs font-semibold text-[#3d291c] hover:bg-[#fff3da]"
    >
      {staffT("ticketPrint", lang)}
    </button>
  );
}
