import type { Metadata } from "next";
import Link from "next/link";

import { privacyT } from "@/lib/privacy-i18n";
import { withAlternatesOg } from "@/lib/metadata-bilingual";
import type { UiLang } from "@/lib/ui-i18n";

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string }>;
}): Promise<Metadata> {
  const sp = await searchParams;
  const lang: UiLang = sp.lang === "en" ? "en" : "es";
  return withAlternatesOg(lang, "/privacidad", "/privacidad?lang=en", {
    title: privacyT("metaTitle", lang),
    description: privacyT("lead", lang),
  });
}

export default async function PrivacidadPage({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string }>;
}) {
  const sp = await searchParams;
  const lang: UiLang = sp.lang === "en" ? "en" : "es";

  return (
    <main className="mx-auto max-w-lg px-5 py-12 text-[#3d291c]">
      <div className="mb-6 flex justify-end gap-2 text-xs font-medium text-[#5c432e]">
        <Link
          href="/privacidad?lang=es"
          className={lang === "es" ? "font-bold text-[#3d291c]" : "underline decoration-[#c4a574]"}
        >
          ES
        </Link>
        <span className="text-[#b89a6e]">|</span>
        <Link
          href="/privacidad?lang=en"
          className={lang === "en" ? "font-bold text-[#3d291c]" : "underline decoration-[#c4a574]"}
        >
          EN
        </Link>
      </div>
      <p className="text-xs uppercase tracking-[0.2em] text-[#5c432e]/80">Meraki beer company</p>
      <h1 className="mt-2 font-serif text-3xl font-bold text-[#2c1f14]">{privacyT("title", lang)}</h1>
      <p className="mt-4 text-sm leading-relaxed text-[#5c432e]">{privacyT("lead", lang)}</p>
      <p className="mt-4 text-sm leading-relaxed text-[#5c432e]">{privacyT("p2", lang)}</p>
      <div className="mt-8">
        <Link href={`/?lang=${lang}`} className="text-sm font-medium text-[#c2763a] underline">
          {privacyT("linkHome", lang)}
        </Link>
      </div>
    </main>
  );
}
