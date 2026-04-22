import type { UiLang } from "@/lib/ui-i18n";

const HOME = {
  es: {
    metaTitle: "Meraki · carta y pedidos",
    metaDescription:
      "Carta digital y pedidos por mesa — Meraki beer company, pet friendly.",
    heroTitle: "Carta digital y pedidos por mesa",
    heroSubtitle:
      "Los clientes escanean un QR que lleva a su número de mesa, eligen en el móvil y el pedido llega a cocina y sala con la mesa bien visible.",
    cardQrTitle: "QRs para mesas",
    cardQrBody:
      "Genera una hoja lista para imprimir con un código por mesa (rango configurable).",
    cardQrCta: "Abrir impresión de QRs",
    cardClientTitle: "Clientes",
    cardClientBefore: "Cada mesa tiene su propia URL, por ejemplo",
    cardClientAfter:
      ". Esa es la dirección que debes codificar en el QR de la mesa 7.",
    cardClientCta: "Ver ejemplo mesa 1",
    cardStaffTitle: "Personal",
    cardStaffBefore:
      "Panel del equipo: pedidos en vivo, estados y herramientas del día. Si hay clave de acceso, te la da el encargado",
    cardStaffAfter: ".",
    cardStaffCta: "Abrir vista de pedidos",
    adminCartaCta: "Editar carta y precios",
    ownerKicker: "Meraki beer company",
    ownerTitle: "Un espacio pensado para el local",
    ownerBody1:
      "Meraki nace como cervecería con alma: cerveza artesanía, cocina con sabor latino y un ambiente donde las mascotas son bienvenidas. Esta herramienta acompaña al equipo en sala y cocina para que el servicio sea ágil sin perder el trato cercano del bar.",
    ownerBody2:
      "Desde aquí el encargado o encargada dispone de los accesos del negocio: impresión de QRs, prueba de mesa, panel del personal y edición de carta y precios cuando toque renovar temporada o raciones.",
    ownerHl1: "Pet friendly",
    ownerHl2: "Carta en español e inglés",
    ownerHl3: "Pedidos digitalizados por mesa",
    footerNote: "Proyecto de apoyo para Meraki · mascotas bienvenidas",
    langEs: "ES",
    langEn: "EN",
  },
  en: {
    metaTitle: "Meraki · menu & orders",
    metaDescription: "Digital menu and table ordering — Meraki beer company, pet friendly.",
    heroTitle: "Digital menu and table orders",
    heroSubtitle:
      "Guests scan a QR to their table number, order on their phone, and the ticket reaches kitchen and bar with the table clearly shown.",
    cardQrTitle: "Table QR codes",
    cardQrBody: "Print a sheet with one code per table (configurable range).",
    cardQrCta: "Open QR printing",
    cardClientTitle: "Guests",
    cardClientBefore: "Each table has its own URL, for example",
    cardClientAfter: ". Encode that address in the QR for table 7.",
    cardClientCta: "Open sample table 1",
    cardStaffTitle: "Staff",
    cardStaffBefore:
      "Team board: live orders, statuses and daily tools. If a team key is used, the manager will share it",
    cardStaffAfter: ".",
    cardStaffCta: "Open orders view",
    adminCartaCta: "Edit menu & prices",
    ownerKicker: "Meraki beer company",
    ownerTitle: "Built for running the venue",
    ownerBody1:
      "Meraki is a craft beer bar with heart: house beers, Latin‑inspired food, and a genuinely pet‑friendly welcome. This app supports floor and kitchen so service stays fast without losing the human touch guests come for.",
    ownerBody2:
      "From this page whoever runs the venue reaches the business tools: QR printing, a table preview, the staff board, and the menu editor when you need to update dishes or prices for a new season.",
    ownerHl1: "Pet friendly",
    ownerHl2: "Menu in Spanish & English",
    ownerHl3: "Table‑based digital ordering",
    footerNote: "Meraki support project · pets welcome",
    langEs: "ES",
    langEn: "EN",
  },
} as const;

export type HomeUiKey = keyof typeof HOME.es;

export function homeT(key: HomeUiKey, lang: UiLang): string {
  return HOME[lang][key] ?? HOME.es[key];
}
