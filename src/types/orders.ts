export type OrderStatus =
  | "nuevo"
  | "preparando"
  | "listo"
  | "entregado"
  | "cancelado";

export type StatusLogEntry = {
  at: string;
  status: OrderStatus;
  actor?: string;
};

export type OrderLine = {
  menuItemId: string;
  name: string;
  quantity: number;
  unitPriceEuros: number | null;
  optionsLabel?: string;
};

export type Order = {
  id: string;
  mesa: number;
  createdAt: string;
  updatedAt: string;
  status: OrderStatus;
  lines: OrderLine[];
  customerNote?: string;
  /** Nombre en mesa, celebración, reserva… (opcional, visible al personal). */
  customerDisplayName?: string;
  /** Quién hizo el último cambio de estado (texto libre desde el navegador del personal). */
  lastActorName?: string;
  /** Historial reciente de cambios de estado. */
  statusLog?: StatusLogEntry[];
};
