"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useState } from "react";

import { CartaVisualEditor } from "@/components/admin/CartaVisualEditor";
import { adminT } from "@/lib/admin-i18n";
import { validateMenuTabs } from "@/lib/menu-validate";
import type { UiLang } from "@/lib/ui-i18n";
import type { MenuTab } from "@/types/menu";

export function CartaEditor({ lang }: { lang: UiLang }) {
  const pathname = usePathname() || "/admin/carta";
  const [key, setKey] = useState("");
  const [tabs, setTabs] = useState<MenuTab[] | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const loadCurrent = useCallback(async () => {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/menu", { cache: "no-store" });
      const data = await res.json();
      const raw = data.tabs as MenuTab[] | undefined;
      if (!Array.isArray(raw)) {
        setMsg(adminT("adminErrLoad", lang));
        return;
      }
      setTabs(structuredClone(raw));
    } catch {
      setMsg(adminT("adminErrLoad", lang));
    } finally {
      setBusy(false);
    }
  }, [lang]);

  async function save() {
    if (!tabs) {
      setMsg(adminT("adminErrNothingLoaded", lang));
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const result = validateMenuTabs(tabs, lang);
      if (!result.ok) {
        setMsg(result.errors.join("\n"));
        return;
      }
      const res = await fetch("/api/admin/menu", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(key ? { "x-staff-key": key } : {}),
        },
        body: JSON.stringify({ tabs: result.tabs }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const err =
          Array.isArray(data.errors) && data.errors.length
            ? (data.errors as string[]).join("\n")
            : (data.error as string) ?? adminT("adminErrSave", lang);
        setMsg(err);
        return;
      }
      setTabs(structuredClone(result.tabs));
      setMsg(adminT("adminMsgSaved", lang));
    } catch {
      setMsg(adminT("adminErrInvalid", lang));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href={lang === "en" ? "/?lang=en" : "/"}
          className="text-sm text-[#5c432e] underline"
        >
          {adminT("adminBackHome", lang)}
        </Link>
        <div className="flex gap-2 text-xs font-medium text-[#5c432e]">
          <Link
            href={`${pathname}?lang=es`}
            className={lang === "es" ? "font-bold text-[#3d291c]" : "underline decoration-[#c4a574]"}
          >
            {adminT("langEs", lang)}
          </Link>
          <span className="text-[#b89a6e]">|</span>
          <Link
            href={`${pathname}?lang=en`}
            className={lang === "en" ? "font-bold text-[#3d291c]" : "underline decoration-[#c4a574]"}
          >
            {adminT("langEn", lang)}
          </Link>
        </div>
      </div>
      <h1 className="mt-4 font-serif text-3xl font-bold text-[#2c1f14]">{adminT("adminTitle", lang)}</h1>
      <p className="mt-2 text-sm text-[#5c432e]">
        {adminT("adminIntroA", lang)} {adminT("adminIntroB", lang)} {adminT("adminIntroC", lang)}
      </p>
      <div className="mt-4 space-y-4">
        <input
          type="password"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder={adminT("adminKeyPlaceholder", lang)}
          className="w-full max-w-sm rounded-xl border border-[#d8bf9a] bg-white px-3 py-2 text-sm"
        />
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => void loadCurrent()}
            className="rounded-full bg-[#3d291c] px-4 py-2 text-sm font-semibold text-[#f6ead3] disabled:opacity-50"
          >
            {adminT("adminLoadBtn", lang)}
          </button>
          <button
            type="button"
            disabled={busy || !tabs}
            onClick={() => void save()}
            className="rounded-full bg-[#c2763a] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {adminT("adminSaveBtn", lang)}
          </button>
        </div>
        {tabs ? (
          <CartaVisualEditor lang={lang} tabs={tabs} onChange={setTabs} />
        ) : (
          <p className="text-sm text-[#6b5138]">{adminT("adminLoadHint", lang)}</p>
        )}
        {msg ? (
          <pre className="whitespace-pre-wrap rounded-xl bg-[#fff9ec] p-3 text-sm text-[#3d291c] ring-1 ring-[#e2c9a0]">
            {msg}
          </pre>
        ) : null}
      </div>
    </div>
  );
}
