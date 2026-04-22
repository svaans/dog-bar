import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { MesaOrderExperience } from "@/components/mesa/MesaOrderExperience";
import { withAlternatesOg } from "@/lib/metadata-bilingual";
import { mesaFormat, mesaT, type UiLang } from "@/lib/ui-i18n";

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ mesa: string }>;
  searchParams: Promise<{ lang?: string }>;
}): Promise<Metadata> {
  const { mesa: mesaRaw } = await params;
  const mesa = parseInt(mesaRaw, 10);
  const sp = await searchParams;
  const lang: UiLang = sp.lang === "en" ? "en" : "es";
  if (!Number.isFinite(mesa) || mesa < 1 || mesa > 99) {
    return { title: "Meraki" };
  }
  const pathEs = `/mesa/${mesa}`;
  const pathEn = `/mesa/${mesa}?lang=en`;
  return withAlternatesOg(lang, pathEs, pathEn, {
    title: mesaFormat(mesaT("metaPageTitle", lang), mesa),
    description: mesaT("metaPageDescription", lang),
  });
}

export default async function MesaPage({
  params,
  searchParams,
}: {
  params: Promise<{ mesa: string }>;
  searchParams: Promise<{ lang?: string }>;
}) {
  const { mesa: mesaRaw } = await params;
  const mesa = parseInt(mesaRaw, 10);
  if (!Number.isFinite(mesa) || mesa < 1 || mesa > 99) {
    notFound();
  }
  const sp = await searchParams;
  const lang = sp.lang === "en" ? "en" : "es";

  return <MesaOrderExperience mesa={mesa} lang={lang} />;
}
