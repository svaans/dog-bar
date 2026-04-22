import type { Metadata } from "next";
import Link from "next/link";

import { homeT } from "@/lib/home-i18n";
import { withAlternatesOg } from "@/lib/metadata-bilingual";
import type { UiLang } from "@/lib/ui-i18n";

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string }>;
}): Promise<Metadata> {
  const sp = await searchParams;
  const lang: UiLang = sp.lang === "en" ? "en" : "es";
  return withAlternatesOg(lang, "/", "/?lang=en", {
    title: homeT("metaTitle", lang),
    description: homeT("metaDescription", lang),
  });
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string }>;
}) {
  const sp = await searchParams;
  const lang: UiLang = sp.lang === "en" ? "en" : "es";
  const q = `?lang=${lang}`;

  const highlights = [
    homeT("ownerHl1", lang),
    homeT("ownerHl2", lang),
    homeT("ownerHl3", lang),
  ];

  return (
    <div className="flex flex-1 flex-col">
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-5 py-12">
        <header className="space-y-3 text-center sm:text-left">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <p className="text-xs uppercase tracking-[0.28em] text-[#5c432e]/80">
              Meraki beer company
            </p>
            <div className="flex gap-2 text-xs font-medium text-[#5c432e] sm:ml-auto">
              <Link
                href="/?lang=es"
                className={lang === "es" ? "font-bold text-[#3d291c]" : "underline decoration-[#c4a574]"}
              >
                {homeT("langEs", lang)}
              </Link>
              <span className="text-[#b89a6e]">|</span>
              <Link
                href="/?lang=en"
                className={lang === "en" ? "font-bold text-[#3d291c]" : "underline decoration-[#c4a574]"}
              >
                {homeT("langEn", lang)}
              </Link>
            </div>
          </div>
          <h1 className="font-serif text-4xl font-bold leading-tight text-[#2c1f14] sm:text-5xl">
            {homeT("heroTitle", lang)}
          </h1>
          <p className="text-lg text-[#5c432e]">{homeT("heroSubtitle", lang)}</p>
        </header>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-2xl bg-[#fff9ec]/90 p-5 shadow-sm ring-1 ring-[#e2c9a0]">
            <h2 className="font-serif text-xl font-semibold text-[#2c1f14]">
              {homeT("cardQrTitle", lang)}
            </h2>
            <p className="mt-2 text-sm text-[#5c432e]">{homeT("cardQrBody", lang)}</p>
            <Link
              href={`/impresion-qr${q}`}
              className="mt-4 inline-flex rounded-full border border-[#c4a574] bg-white px-4 py-2 text-sm font-semibold text-[#3d291c] hover:bg-[#fff3da]"
            >
              {homeT("cardQrCta", lang)}
            </Link>
          </div>
          <div className="rounded-2xl bg-[#fff9ec]/90 p-5 shadow-sm ring-1 ring-[#e2c9a0]">
            <h2 className="font-serif text-xl font-semibold text-[#2c1f14]">
              {homeT("cardClientTitle", lang)}
            </h2>
            <p className="mt-2 text-sm text-[#5c432e]">
              {homeT("cardClientBefore", lang)}{" "}
              <code className="rounded bg-[#f0e2c8] px-1.5 py-0.5 text-xs">…/mesa/7</code>
              {homeT("cardClientAfter", lang)}
            </p>
            <Link
              href={`/mesa/1${q}`}
              className="mt-4 inline-flex rounded-full bg-[#3d291c] px-4 py-2 text-sm font-semibold text-[#f6ead3] hover:bg-[#2a1c13]"
            >
              {homeT("cardClientCta", lang)}
            </Link>
          </div>
          <div className="rounded-2xl bg-[#fff9ec]/90 p-5 shadow-sm ring-1 ring-[#e2c9a0]">
            <h2 className="font-serif text-xl font-semibold text-[#2c1f14]">
              {homeT("cardStaffTitle", lang)}
            </h2>
            <p className="mt-2 text-sm text-[#5c432e]">
              {homeT("cardStaffBefore", lang)}
              {homeT("cardStaffAfter", lang)}
            </p>
            <Link
              href={`/personal${q}`}
              className="mt-4 inline-flex rounded-full bg-[#c2763a] px-4 py-2 text-sm font-semibold text-white hover:bg-[#a86430]"
            >
              {homeT("cardStaffCta", lang)}
            </Link>
            <Link
              href={`/admin/carta${q}`}
              className="mt-2 inline-flex rounded-full border border-[#c4a574] bg-white px-4 py-2 text-sm font-semibold text-[#3d291c] hover:bg-[#fff3da]"
            >
              {homeT("adminCartaCta", lang)}
            </Link>
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl bg-[#2c1f14] text-[#f6ead3] shadow-md ring-1 ring-[#1a120c]">
          <div className="border-b border-[#f6ead3]/15 px-6 py-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#e2c9a0]/90">
              {homeT("ownerKicker", lang)}
            </p>
            <h3 className="mt-1 font-serif text-2xl font-bold text-[#fff9ec]">
              {homeT("ownerTitle", lang)}
            </h3>
          </div>
          <div className="grid gap-6 px-6 py-6 sm:grid-cols-[1fr_auto] sm:items-start">
            <div className="space-y-4 text-sm leading-relaxed text-[#f0e4cf]">
              <p>{homeT("ownerBody1", lang)}</p>
              <p>{homeT("ownerBody2", lang)}</p>
            </div>
            <ul className="flex flex-col gap-2 text-sm sm:min-w-[12rem]">
              {highlights.map((h) => (
                <li
                  key={h}
                  className="rounded-xl border border-[#f6ead3]/20 bg-[#3d291c]/80 px-3 py-2 text-center font-medium text-[#fff3da] sm:text-left"
                >
                  {h}
                </li>
              ))}
            </ul>
          </div>
        </section>
      </main>
      <footer className="border-t border-[#e2c9a0]/80 py-4 text-center text-xs text-[#6b5138]">
        {homeT("footerNote", lang)}
      </footer>
    </div>
  );
}
