import type { Metadata } from "next";
import { Suspense } from "react";

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
  return withAlternatesOg(lang, "/personal", "/personal?lang=en", {
    title: staffT("metaPersonalTitle", lang),
    description: staffT("metaPersonalDesc", lang),
  });
}

export default async function PersonalPage({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string }>;
}) {
  const sp = await searchParams;
  const lang: UiLang = sp.lang === "en" ? "en" : "es";
  const suffix = `?lang=${lang}`;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <header className="mb-6">
        <p className="text-xs uppercase tracking-[0.2em] text-[#5c432e]/80">
          Meraki beer company
        </p>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h1 className="font-serif text-3xl font-semibold text-[#2c1f14]">
            {staffT("personalPageTitle", lang)}
          </h1>
          <div className="flex gap-2 text-xs font-medium text-[#5c432e]">
            <a
              href={`/personal?lang=es`}
              className={lang === "es" ? "font-bold text-[#3d291c]" : "underline decoration-[#c4a574]"}
            >
              {staffT("langEs", lang)}
            </a>
            <span className="text-[#b89a6e]">|</span>
            <a
              href={`/personal?lang=en`}
              className={lang === "en" ? "font-bold text-[#3d291c]" : "underline decoration-[#c4a574]"}
            >
              {staffT("langEn", lang)}
            </a>
          </div>
        </div>
        <p className="mt-2 text-sm text-[#5c432e]">
          Elige el módulo del equipo:
        </p>
      </header>
      <div className="grid gap-4 sm:grid-cols-2">
        <a
          href={`/personal/sala${suffix}`}
          className="rounded-2xl bg-[#fff9ec]/90 p-5 shadow-sm ring-1 ring-[#e2c9a0] hover:bg-[#fff3da]"
        >
          <h2 className="font-serif text-xl font-semibold text-[#2c1f14]">Sala · Mesero</h2>
          <p className="mt-2 text-sm text-[#5c432e]">
            Mesas en rejilla, asignación con un toque y vista rápida de quién cubre qué.
          </p>
        </a>
        <a
          href={`/personal/cocina${suffix}`}
          className="rounded-2xl bg-[#fff9ec]/90 p-5 shadow-sm ring-1 ring-[#e2c9a0] hover:bg-[#fff3da]"
        >
          <h2 className="font-serif text-xl font-semibold text-[#2c1f14]">
            {staffT("personalShortcutKitchen", lang)}
          </h2>
          <p className="mt-2 text-sm text-[#5c432e]">
            Cola de pedidos para cocina (solo lo que toca cocina).
          </p>
        </a>
        <a
          href={`/personal/barra${suffix}`}
          className="rounded-2xl bg-[#fff9ec]/90 p-5 shadow-sm ring-1 ring-[#e2c9a0] hover:bg-[#fff3da]"
        >
          <h2 className="font-serif text-xl font-semibold text-[#2c1f14]">
            {staffT("personalShortcutBar", lang)}
          </h2>
          <p className="mt-2 text-sm text-[#5c432e]">Cola de pedidos para barra/sala.</p>
        </a>
        <a
          href={`/personal/admin${suffix}`}
          className="rounded-2xl bg-[#2c1f14] p-5 text-[#f6ead3] shadow-sm ring-1 ring-[#1a120c] hover:bg-[#3d291c]"
        >
          <h2 className="font-serif text-xl font-semibold text-[#fff9ec]">Admin</h2>
          <p className="mt-2 text-sm text-[#f0e4cf]">
            Empleados (PIN), historial del día, exportaciones e informes.
          </p>
        </a>
      </div>
    </div>
  );
}
