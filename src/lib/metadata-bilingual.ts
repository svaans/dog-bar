import type { Metadata } from "next";

import type { UiLang } from "@/lib/ui-i18n";

type ShortMeta = {
  title?: string | Metadata["title"];
  description?: Metadata["description"];
};

/**
 * hreflang + canonical + Open Graph según idioma activo (rutas relativas al `metadataBase`).
 */
export function withAlternatesOg(
  lang: UiLang,
  pathEs: string,
  pathEn: string,
  base: ShortMeta,
): Metadata {
  const canonical = lang === "en" ? pathEn : pathEs;
  const titleText = typeof base.title === "string" ? base.title : undefined;

  return {
    ...base,
    alternates: {
      canonical,
      languages: {
        es: pathEs,
        en: pathEn,
        "x-default": pathEs,
      },
    },
    openGraph: {
      title: titleText,
      description: typeof base.description === "string" ? base.description : undefined,
      locale: lang === "en" ? "en_US" : "es_ES",
      alternateLocale: lang === "en" ? ["es_ES"] : ["en_US"],
      url: canonical,
      siteName: "Meraki",
      type: "website",
    },
    twitter: {
      card: "summary",
      title: titleText,
      description: typeof base.description === "string" ? base.description : undefined,
    },
  };
}
