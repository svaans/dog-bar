import type { Metadata } from "next";

import { CartaEditor } from "@/components/admin/CartaEditor";
import { adminT } from "@/lib/admin-i18n";
import { withAlternatesOg } from "@/lib/metadata-bilingual";
import type { UiLang } from "@/lib/ui-i18n";

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string }>;
}): Promise<Metadata> {
  const sp = await searchParams;
  const lang: UiLang = sp.lang === "en" ? "en" : "es";
  return withAlternatesOg(lang, "/admin/carta", "/admin/carta?lang=en", {
    title: adminT("metaTitle", lang),
    description: adminT("metaDescription", lang),
  });
}

export default async function AdminCartaPage({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string }>;
}) {
  const sp = await searchParams;
  const lang: UiLang = sp.lang === "en" ? "en" : "es";

  return <CartaEditor lang={lang} />;
}
