import type { Metadata } from "next";
import { Suspense } from "react";

import { StaffBoard } from "@/components/personal/StaffBoard";
import { buildTabIdMap } from "@/lib/menu-tab-map";
import { getMenuTabs } from "@/lib/menu-loader";
import { staffT } from "@/lib/staff-i18n";
import { withAlternatesOg } from "@/lib/metadata-bilingual";
import type { UiLang } from "@/lib/ui-i18n";

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string }>;
}): Promise<Metadata> {
  const sp = await searchParams;
  const lang: UiLang = sp.lang === "en" ? "en" : "es";
  return withAlternatesOg(lang, "/personal/barra", "/personal/barra?lang=en", {
    title: staffT("metaBarraTitle", lang),
    description: staffT("metaBarraDesc", lang),
  });
}

export default async function BarraPage({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string }>;
}) {
  const sp = await searchParams;
  const lang: UiLang = sp.lang === "en" ? "en" : "es";
  const menuTabByItemId = buildTabIdMap(getMenuTabs());
  const suffix = `?lang=${lang}`;

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <header className="mb-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h1 className="font-serif text-2xl font-bold text-[#2c1f14]">
            {staffT("barraPageTitle", lang)}
          </h1>
          <div className="flex gap-2 text-xs font-medium text-[#5c432e]">
            <a
              href={`/personal/barra?lang=es`}
              className={lang === "es" ? "font-bold text-[#3d291c]" : "underline decoration-[#c4a574]"}
            >
              {staffT("langEs", lang)}
            </a>
            <span className="text-[#b89a6e]">|</span>
            <a
              href={`/personal/barra?lang=en`}
              className={lang === "en" ? "font-bold text-[#3d291c]" : "underline decoration-[#c4a574]"}
            >
              {staffT("langEn", lang)}
            </a>
          </div>
        </div>
        <p className="mt-2 text-sm text-[#5c432e]">{staffT("barraPageLead", lang)}</p>
        <p className="mt-2 text-xs">
          <a className="font-medium text-[#c2763a] underline" href={`/personal${suffix}`}>
            ← {staffT("personalPageTitle", lang)}
          </a>
        </p>
      </header>
      <Suspense fallback={<p className="text-sm text-[#5c432e]">{staffT("loading", lang)}</p>}>
        <StaffBoard menuTabByItemId={menuTabByItemId} variant="barra" lang={lang} />
      </Suspense>
    </div>
  );
}
