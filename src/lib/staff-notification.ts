import type { Order } from "@/types/orders";

export function staffNotificationSupported() {
  return typeof window !== "undefined" && "Notification" in window;
}

export function staffNotificationPermission(): NotificationPermission | "unsupported" {
  if (!staffNotificationSupported()) return "unsupported";
  return Notification.permission;
}

/** Debe llamarse tras un gesto del usuario (p. ej. activar el interruptor). */
export async function requestStaffNotificationPermission(): Promise<NotificationPermission> {
  if (!staffNotificationSupported()) return "denied";
  try {
    return await Notification.requestPermission();
  } catch {
    return "denied";
  }
}

export function notifyStaffNewOrder(order: Pick<Order, "mesa" | "id">) {
  if (!staffNotificationSupported()) return;
  if (Notification.permission !== "granted") return;
  try {
    new Notification("Meraki · pedido nuevo", {
      body: `Mesa ${order.mesa}: revisa el panel para ver el detalle.`,
      tag: order.id,
      lang: "es",
    });
  } catch {
    // Algunos navegadores bloquean notificaciones en contextos no seguros (HTTP).
  }
}
