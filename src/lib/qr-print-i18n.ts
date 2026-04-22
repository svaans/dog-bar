import type { UiLang } from "@/lib/ui-i18n";

const QR = {
  es: {
    metaTitle: "Impresión QR",
    metaDescription: "Hoja de códigos QR por número de mesa para Meraki.",
    backHome: "← Inicio",
    title: "QRs por mesa",
    baseUsed: "Enlace que llevará cada QR:",
    baseHint:
      "Si al imprimir o compartir ves otra dirección web, pide al encargado que revise la configuración pública de la app.",
    rangeIntro: "Mesas en esta hoja:",
    rangeDash: "–",
    rangeHelp: "Cambia el rango con el formulario de abajo.",
    tableWord: "Mesa",
    printSheet: "Imprimir hoja",
    formFrom: "Desde",
    formTo: "Hasta",
    formSubmit: "Actualizar vista",
    formHint: "Mesas entre 1 y 99. «Hasta» no puede ser menor que «Desde».",
    langEs: "ES",
    langEn: "EN",
  },
  en: {
    metaTitle: "QR printing",
    metaDescription: "Printable QR codes per table number for Meraki.",
    backHome: "← Home",
    title: "Table QR codes",
    baseUsed: "Link each QR will open:",
    baseHint:
      "If the web address looks wrong when you print or share, ask the manager to check the app’s public web settings.",
    rangeIntro: "Tables on this sheet:",
    rangeDash: "–",
    rangeHelp: "Change the range with the form below.",
    tableWord: "Table",
    printSheet: "Print sheet",
    formFrom: "From",
    formTo: "To",
    formSubmit: "Update preview",
    formHint: "Tables between 1 and 99. «To» cannot be less than «From».",
    langEs: "ES",
    langEn: "EN",
  },
} as const;

export type QrPrintUiKey = keyof typeof QR.es;

export function qrPrintT(key: QrPrintUiKey, lang: UiLang): string {
  return QR[lang][key] ?? QR.es[key];
}
