import type { UiLang } from "@/lib/ui-i18n";

const PRIV = {
  es: {
    metaTitle: "Privacidad · Meraki",
    title: "Privacidad y datos",
    lead:
      "Los pedidos que haces desde esta mesa se envían al equipo del local (cocina y sala). Pueden incluir una nota o un nombre en mesa si los has escrito.",
    p2:
      "Esos datos los usa Meraki solo para preparar y servir el pedido. Si tienes dudas sobre cuánto tiempo se guardan o quieres que borren algo, habla con el encargado del bar.",
    linkHome: "Ir al inicio",
  },
  en: {
    metaTitle: "Privacy · Meraki",
    title: "Privacy & data",
    lead:
      "Orders you send from this table go to the venue team (kitchen and floor). They may include a note or table name if you entered them.",
    p2:
      "Meraki uses that information only to prepare and serve your order. For retention or deletion, ask the venue manager.",
    linkHome: "Home",
  },
} as const;

export type PrivacyUiKey = keyof typeof PRIV.es;

export function privacyT(key: PrivacyUiKey, lang: UiLang): string {
  return PRIV[lang][key] ?? PRIV.es[key];
}
