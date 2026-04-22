import type { Metadata } from "next";
import { Suspense } from "react";

import { StaffBoard } from "@/components/personal/StaffBoard";
import { buildTabIdMap } from "@/lib/menu-tab-map";
import { getMenuTabs } from "@/lib/menu-loader";
import { withAlternatesOg } from "@/lib/metadata-bilingual";
import type { UiLang } from "@/lib/ui-i18n";

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string }>;
}): Promise<Metadata> {
  const sp = await searchParams;
  const lang: UiLang = sp.lang === "en" ? "en" : "es";
  return withAlternatesOg(lang, "/personal/sala", "/personal/sala?lang=en", {
    title: lang === "en" ? "Floor · Staff" : "Sala · Personal",
    description:
      lang === "en"
        ? "Tables grid and live assignments."
        : "Rejilla de mesas y asignación en vivo.",
  });
}

export default async function SalaPage({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string }>;
}) {
  const sp = await searchParams;
  const lang: UiLang = sp.lang === "en" ? "en" : "es";
  const menuTabs = getMenuTabs();
  const menuTabByItemId = buildTabIdMap(menuTabs);
  const menuTabOrder = menuTabs.map((t) => t.id);

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <Suspense fallback={<p className="text-sm text-[#5c432e]">Cargando…</p>}>
        <StaffBoard
          menuTabByItemId={menuTabByItemId}
          menuTabOrder={menuTabOrder}
          variant="default"
          module="sala"
          lang={lang}
        />
      </Suspense>
    </div>
  );
}

