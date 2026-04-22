"use client";

import Link from "next/link";
import { startTransition, useEffect, useMemo, useState } from "react";

import { MERAKI_MENU } from "@/data/meraki-menu";
import {
  formatSelectionsLabel,
  modifiersComplete,
  resolveUnitPrice,
} from "@/lib/pricing";
import { mesaT, type UiLang } from "@/lib/ui-i18n";
import type { MenuItem, MenuTab, ModifierSelections } from "@/types/menu";

type CartLine = {
  key: string;
  menuItemId: string;
  name: string;
  quantity: number;
  selections: ModifierSelections;
  unitPriceEuros: number | null;
  optionsLabel: string;
};

type StoredOrderPayload = {
  lines: Array<{ menuItemId: string; quantity: number; selections?: ModifierSelections }>;
  customerNote?: string;
  customerDisplayName?: string;
};

function serializeSelections(s: ModifierSelections) {
  const keys = Object.keys(s).sort();
  if (!keys.length) return "none";
  return keys.map((k) => `${k}=${s[k]}`).join("&");
}

function lineKey(menuItemId: string, selections: ModifierSelections) {
  return `${menuItemId}::${serializeSelections(selections)}`;
}

function lastOrderStorageKey(mesa: number) {
  return `meraki_last_order_payload_${mesa}`;
}

function findItemInTabs(menu: MenuTab[], id: string): MenuItem | null {
  for (const t of menu) {
    for (const sec of t.sections) {
      const hit = sec.items.find((i) => i.id === id);
      if (hit) return hit;
    }
  }
  return null;
}

function formatMoney(n: number | null, lang: UiLang) {
  if (n === null) return mesaT("barPrice", lang);
  const loc = lang === "en" ? "en-GB" : "es-ES";
  return (
    n.toLocaleString(loc, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }) + " €"
  );
}

function fillApprox(template: string, known: string) {
  return template.replace("{known}", known);
}

function mergeCartLines(lines: CartLine[]): CartLine[] {
  const map = new Map<string, CartLine>();
  for (const l of lines) {
    const prev = map.get(l.key);
    if (!prev) {
      map.set(l.key, { ...l });
    } else {
      map.set(l.key, { ...prev, quantity: prev.quantity + l.quantity });
    }
  }
  return [...map.values()];
}

export type MesaOrderExperienceProps = { mesa: number; lang: UiLang };

export function MesaOrderExperience({ mesa, lang }: MesaOrderExperienceProps) {
  const [menuTabs, setMenuTabs] = useState<MenuTab[] | null>(null);
  const tabs = menuTabs ?? MERAKI_MENU;

  const [tabId, setTabId] = useState(() => MERAKI_MENU[0]?.id ?? "comida");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [note, setNote] = useState("");
  const [customerDisplayName, setCustomerDisplayName] = useState("");
  const [busy, setBusy] = useState(false);
  /** Evita envíos accidentales: primero revisar, luego confirmar. */
  const [sendArmed, setSendArmed] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [successOrderId, setSuccessOrderId] = useState<string | null>(null);

  const [modalItem, setModalItem] = useState<MenuItem | null>(null);
  const [modalSelections, setModalSelections] = useState<ModifierSelections>({});
  const [pendingClearCart, setPendingClearCart] = useState(false);

  useEffect(() => {
    startTransition(() => setSendArmed(false));
  }, [cart, note, customerDisplayName]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/menu", { cache: "no-store" });
        const data = (await res.json().catch(() => ({}))) as { tabs?: unknown };
        const next = data.tabs;
        if (cancelled || !Array.isArray(next) || next.length === 0) return;
        const typed = next as MenuTab[];
        setMenuTabs(typed);
        setTabId((cur) => (typed.some((t) => t.id === cur) ? cur : typed[0]!.id));
      } catch {
        /* usar carta embebida */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const tab = tabs.find((t) => t.id === tabId) ?? tabs[0];

  const cartTotal = useMemo(() => {
    let known = 0;
    let unknown = false;
    for (const l of cart) {
      if (l.unitPriceEuros === null) unknown = true;
      else known += l.unitPriceEuros * l.quantity;
    }
    return { known, unknown };
  }, [cart]);

  const cartUnits = useMemo(
    () => cart.reduce((acc, l) => acc + l.quantity, 0),
    [cart],
  );

  function showToast(msg: string) {
    setToast(msg);
    window.setTimeout(() => setToast(null), 3200);
  }

  function openAdd(item: MenuItem) {
    if (item.modifiers?.length) {
      setModalItem(item);
      setModalSelections({});
      return;
    }
    addOrMergeLine(item, {});
  }

  function confirmModal() {
    if (!modalItem) return;
    if (!modifiersComplete(modalItem, modalSelections)) {
      showToast(mesaT("chooseOptions", lang));
      return;
    }
    addOrMergeLine(modalItem, modalSelections);
    setModalItem(null);
  }

  function addOrMergeLine(item: MenuItem, selections: ModifierSelections) {
    const unit = resolveUnitPrice(item, selections);
    const optionsLabel = formatSelectionsLabel(item, selections);
    const key = lineKey(item.id, selections);
    setCart((prev) => {
      const idx = prev.findIndex((l) => l.key === key);
      if (idx === -1) {
        return [
          ...prev,
          {
            key,
            menuItemId: item.id,
            name: item.name,
            quantity: 1,
            selections,
            unitPriceEuros: unit,
            optionsLabel,
          },
        ];
      }
      const copy = [...prev];
      copy[idx] = { ...copy[idx], quantity: copy[idx].quantity + 1 };
      return copy;
    });
  }

  function setQty(key: string, qty: number) {
    setCart((prev) => {
      if (qty <= 0) return prev.filter((l) => l.key !== key);
      return prev.map((l) => (l.key === key ? { ...l, quantity: qty } : l));
    });
  }

  function repeatLastOrder() {
    const raw =
      typeof window !== "undefined" ? window.sessionStorage.getItem(lastOrderStorageKey(mesa)) : null;
    if (!raw) {
      showToast(mesaT("noSavedOrder", lang));
      return;
    }
    let payload: StoredOrderPayload;
    try {
      payload = JSON.parse(raw) as StoredOrderPayload;
    } catch {
      showToast(mesaT("noSavedOrder", lang));
      return;
    }
    if (!payload.lines?.length) {
      showToast(mesaT("noSavedOrder", lang));
      return;
    }
    const rebuilt: CartLine[] = [];
    for (const row of payload.lines) {
      const item = findItemInTabs(tabs, row.menuItemId);
      if (!item) continue;
      const sel = row.selections ?? {};
      if (!modifiersComplete(item, sel)) continue;
      const qty = Math.min(20, Math.max(1, Math.floor(Number(row.quantity)) || 1));
      const unit = resolveUnitPrice(item, sel);
      const optionsLabel = formatSelectionsLabel(item, sel);
      const key = lineKey(item.id, sel);
      rebuilt.push({
        key,
        menuItemId: item.id,
        name: item.name,
        quantity: qty,
        selections: sel,
        unitPriceEuros: unit,
        optionsLabel,
      });
    }
    const merged = mergeCartLines(rebuilt);
    if (!merged.length) {
      showToast(mesaT("repeatFailed", lang));
      return;
    }
    setCart(merged);
    setNote(payload.customerNote ?? "");
    setCustomerDisplayName(payload.customerDisplayName ?? "");
    setPendingClearCart(false);
  }

  async function submit() {
    if (!cart.length) return;
    if (!sendArmed) {
      setSendArmed(true);
      return;
    }
    setBusy(true);
    try {
      const display = customerDisplayName.trim();
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mesa,
          customerNote: note.trim() || undefined,
          customerDisplayName: display || undefined,
          lines: cart.map((l) => ({
            menuItemId: l.menuItemId,
            quantity: l.quantity,
            selections: l.selections,
          })),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 429) {
        showToast(mesaT("rateLimited", lang));
        return;
      }
      if (!res.ok) {
        showToast(typeof data.error === "string" ? data.error : mesaT("sendFailed", lang));
        return;
      }
      try {
        const payload: StoredOrderPayload = {
          lines: cart.map((l) => ({
            menuItemId: l.menuItemId,
            quantity: l.quantity,
            selections: l.selections,
          })),
          customerNote: note.trim() || undefined,
          customerDisplayName: display || undefined,
        };
        window.sessionStorage.setItem(lastOrderStorageKey(mesa), JSON.stringify(payload));
      } catch {
        // sessionStorage puede fallar en modo privado
      }
      setCart([]);
      setNote("");
      setCustomerDisplayName("");
      setPendingClearCart(false);
      if (typeof data.orderId === "string") {
        setSuccessOrderId(data.orderId);
      } else {
        showToast(mesaT("orderSentShort", lang));
      }
      setSendArmed(false);
    } finally {
      setBusy(false);
    }
  }

  const loc = lang === "en" ? "en-GB" : "es-ES";

  return (
    <div className="pb-36">
      <header className="sticky top-0 z-20 border-b border-[#c4a574]/60 bg-[#f6ead3]/95 backdrop-blur">
        <div className="mx-auto flex max-w-lg items-center justify-between gap-3 px-4 py-3">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-[#5c432e]/80">
              {mesaT("brandLine", lang)}
            </p>
            <p className="text-lg font-semibold text-[#2c1f14]">
              {mesaT("mesaWord", lang)} <span className="tabular-nums">{mesa}</span>
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            <div className="flex items-center gap-1.5 text-xs font-medium text-[#5c432e]">
              <a
                href="?lang=es"
                className={lang === "es" ? "font-bold text-[#3d291c]" : "underline decoration-[#c4a574]"}
              >
                {mesaT("langEs", lang)}
              </a>
              <span className="text-[#b89a6e]">|</span>
              <a
                href="?lang=en"
                className={lang === "en" ? "font-bold text-[#3d291c]" : "underline decoration-[#c4a574]"}
              >
                {mesaT("langEn", lang)}
              </a>
            </div>
            <span className="rounded-full bg-[#3d291c] px-3 py-1 text-xs font-medium text-[#f6ead3]">
              {mesaT("petFriendly", lang)}
            </span>
          </div>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-2 pb-2">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTabId(t.id)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-medium transition ${
                t.id === tabId
                  ? "bg-[#3d291c] text-[#f6ead3]"
                  : "bg-[#e8d4b5] text-[#3d291c] hover:bg-[#dfc9a4]"
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-lg space-y-6 px-4 py-5">
        {tab.sections.map((sec) => (
          <section key={sec.id} className="space-y-3">
            <h2 className="border-b border-dashed border-[#c4a574] pb-1 text-sm font-semibold uppercase tracking-wide text-[#5c432e]">
              {sec.title}
            </h2>
            <ul className="space-y-2">
              {sec.items.map((item) => (
                <li
                  key={item.id}
                  className="flex items-start justify-between gap-3 rounded-xl bg-[#fff9ec]/80 px-3 py-2.5 shadow-sm ring-1 ring-[#e2c9a0]/80"
                >
                  <div className="flex min-w-0 flex-1 gap-3">
                    {item.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.imageUrl}
                        alt=""
                        className="h-16 w-16 shrink-0 rounded-lg object-cover ring-1 ring-[#e2c9a0]"
                      />
                    ) : null}
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium text-[#2c1f14]">{item.name}</p>
                        {item.forPets ? (
                          <span className="rounded-full bg-[#e8f5e9] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#1b5e20] ring-1 ring-[#a5d6a7]">
                            {mesaT("forPets", lang)}
                          </span>
                        ) : null}
                      </div>
                      {item.description ? (
                        <p className="text-sm text-[#5c432e]/90">{item.description}</p>
                      ) : null}
                      {item.note ? (
                        <p className="text-xs text-[#7a5c3e]">{item.note}</p>
                      ) : null}
                      {item.allergens?.length ? (
                        <p className="mt-1 text-xs text-amber-900/90">
                          <span className="font-semibold">{mesaT("allergens", lang)}:</span>{" "}
                          {item.allergens.join(", ")}
                        </p>
                      ) : null}
                      <p className="mt-1 text-sm text-[#3d291c]">
                        {formatMoney(item.priceEuros, lang)}
                        {item.modifiers?.length ? mesaT("withOptions", lang) : null}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => openAdd(item)}
                    className="shrink-0 self-start rounded-full bg-[#c2763a] px-3 py-1.5 text-sm font-semibold text-white shadow hover:bg-[#a86430]"
                  >
                    {mesaT("add", lang)}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </main>

      <div className="mx-auto max-w-lg px-4 pb-6 text-center">
        <Link
          href={`/privacidad?lang=${lang}`}
          className="text-xs font-medium text-[#5c432e] underline decoration-[#c4a574] underline-offset-2"
        >
          {mesaT("privacyLink", lang)}
        </Link>
      </div>

      {modalItem ? (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 p-3 sm:items-center">
          <div className="w-full max-w-md rounded-2xl bg-[#fff9ec] p-4 shadow-xl ring-1 ring-[#e2c9a0]">
            <h3 className="text-lg font-semibold text-[#2c1f14]">{modalItem.name}</h3>
            {modalItem.note ? (
              <p className="mt-1 text-sm text-[#5c432e]">{modalItem.note}</p>
            ) : null}
            <div className="mt-4 space-y-4">
              {modalItem.modifiers?.map((step) => (
                <div key={step.id}>
                  <p className="mb-2 text-sm font-medium text-[#3d291c]">{step.label}</p>
                  <div className="flex flex-wrap gap-2">
                    {step.options.map((opt) => {
                      const active = modalSelections[step.id] === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() =>
                            setModalSelections((s) => ({ ...s, [step.id]: opt.id }))
                          }
                          className={`rounded-full px-3 py-1.5 text-sm font-medium ring-1 transition ${
                            active
                              ? "bg-[#3d291c] text-[#f6ead3] ring-[#3d291c]"
                              : "bg-white text-[#3d291c] ring-[#d8bf9a] hover:bg-[#fff3da]"
                          }`}
                        >
                          {opt.label}
                          {typeof opt.priceEuros === "number"
                            ? ` · ${opt.priceEuros.toLocaleString(loc, {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })} €`
                            : ""}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-full px-4 py-2 text-sm font-medium text-[#5c432e] hover:bg-[#f0e2c8]"
                onClick={() => setModalItem(null)}
              >
                {mesaT("cancel", lang)}
              </button>
              <button
                type="button"
                onClick={confirmModal}
                className="rounded-full bg-[#3d291c] px-4 py-2 text-sm font-semibold text-[#f6ead3] hover:bg-[#2a1c13]"
              >
                {mesaT("addToOrder", lang)}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div
        className="fixed inset-x-0 bottom-0 z-30 border-t border-[#c4a574]/70 bg-[#fff9ec]/95 px-4 pt-3 backdrop-blur"
        style={{
          paddingBottom: "max(0.75rem, env(safe-area-inset-bottom, 0px))",
        }}
      >
        <div className="mx-auto flex max-w-lg flex-col gap-2">
          {pendingClearCart ? (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[#fde8e8] px-3 py-2 text-sm text-[#5c1f1f] ring-1 ring-[#e7b4b4]">
              <span>{mesaT("clearConfirm", lang)}</span>
              <span className="flex gap-2">
                <button
                  type="button"
                  className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-[#3d291c] ring-1 ring-[#d8bf9a]"
                  onClick={() => setPendingClearCart(false)}
                >
                  {mesaT("no", lang)}
                </button>
                <button
                  type="button"
                  className="rounded-full bg-[#7a2f2f] px-3 py-1 text-xs font-semibold text-white"
                  onClick={() => {
                    setCart([]);
                    setNote("");
                    setCustomerDisplayName("");
                    setPendingClearCart(false);
                  }}
                >
                  {mesaT("yesClear", lang)}
                </button>
              </span>
            </div>
          ) : null}
          {sendArmed && cart.length ? (
            <div className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-[#5c3d0a] ring-1 ring-amber-200">
              <p className="font-medium">{mesaT("sendReviewHint", lang)}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="rounded-full border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-[#3d291c]"
                  onClick={() => setSendArmed(false)}
                >
                  {mesaT("sendCancelReview", lang)}
                </button>
              </div>
            </div>
          ) : null}
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-[#5c432e]">
                {mesaT("yourOrder", lang)}
              </p>
              <p className="text-sm font-semibold text-[#2c1f14]">
                {cart.length ? (
                  <>
                    {cart.length}{" "}
                    {cart.length === 1 ? mesaT("lineSingular", lang) : mesaT("linePlural", lang)} ·{" "}
                    <span className="tabular-nums">{cartUnits}</span>{" "}
                    {cartUnits === 1 ? mesaT("unitSingular", lang) : mesaT("unitPlural", lang)}
                  </>
                ) : (
                  mesaT("emptyCart", lang)
                )}
                {cart.length ? (
                  <span className="ml-2 text-[#5c432e]">
                    ·{" "}
                    {cartTotal.unknown
                      ? fillApprox(mesaT("approxUnknownTotal", lang), cartTotal.known.toFixed(2))
                      : `${cartTotal.known.toFixed(2)} €`}
                  </span>
                ) : null}
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => void repeatLastOrder()}
                className="rounded-full border border-[#8a6a3a] bg-[#fff3da] px-3 py-2 text-xs font-semibold text-[#3d291c] hover:bg-[#ffe8c4] disabled:opacity-40"
              >
                {mesaT("repeatLast", lang)}
              </button>
              {cart.length ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setPendingClearCart(true)}
                  className="rounded-full border border-[#d8bf9a] bg-white px-3 py-2 text-xs font-semibold text-[#7a2f2f] hover:bg-[#fff3f3] disabled:opacity-40"
                >
                  {mesaT("clear", lang)}
                </button>
              ) : null}
              <button
                type="button"
                disabled={!cart.length || busy}
                onClick={() => void submit()}
                className="rounded-full bg-[#2f7a4a] px-4 py-2 text-sm font-semibold text-white shadow hover:bg-[#276642] disabled:cursor-not-allowed disabled:opacity-40"
              >
                {busy
                  ? mesaT("sending", lang)
                  : sendArmed
                    ? mesaT("sendConfirm", lang)
                    : mesaT("sendReview", lang)}
              </button>
            </div>
          </div>
          {cart.length ? (
            <ul className="max-h-32 space-y-1 overflow-y-auto text-sm text-[#3d291c]">
              {cart.map((l) => (
                <li
                  key={l.key}
                  className="flex items-center justify-between gap-2 rounded-lg bg-white/70 px-2 py-1 ring-1 ring-[#ead4b2]"
                >
                  <span className="min-w-0 truncate">
                    {l.name}
                    {l.optionsLabel ? (
                      <span className="text-[#6b5138]"> ({l.optionsLabel})</span>
                    ) : null}
                  </span>
                  <span className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      className="flex h-9 min-h-[44px] min-w-[44px] items-center justify-center rounded-md bg-[#f0e2c8] text-lg leading-none"
                      onClick={() => setQty(l.key, l.quantity - 1)}
                    >
                      −
                    </button>
                    <span className="w-8 text-center tabular-nums">{l.quantity}</span>
                    <button
                      type="button"
                      className="flex h-9 min-h-[44px] min-w-[44px] items-center justify-center rounded-md bg-[#f0e2c8] text-lg leading-none"
                      onClick={() => setQty(l.key, l.quantity + 1)}
                    >
                      +
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
          <label className="block text-xs text-[#5c432e]">
            {mesaT("tableName", lang)}
            <input
              type="text"
              value={customerDisplayName}
              onChange={(e) => setCustomerDisplayName(e.target.value)}
              maxLength={120}
              placeholder={mesaT("tableNameHint", lang)}
              className="mt-1 w-full rounded-xl border border-[#d8bf9a] bg-white/90 px-3 py-2 text-sm text-[#2c1f14] outline-none focus:ring-2 focus:ring-[#c2763a]/50"
            />
          </label>
          <label className="block text-xs text-[#5c432e]">
            {mesaT("noteLabel", lang)}
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              maxLength={500}
              className="mt-1 w-full resize-none rounded-xl border border-[#d8bf9a] bg-white/90 px-3 py-2 text-sm text-[#2c1f14] outline-none focus:ring-2 focus:ring-[#c2763a]/50"
            />
          </label>
        </div>
      </div>

      {toast ? (
        <div className="fixed bottom-28 left-1/2 z-50 w-[min(92%,24rem)] -translate-x-1/2 rounded-xl bg-[#2c1f14] px-4 py-2 text-center text-sm text-[#f6ead3] shadow-lg">
          {toast}
        </div>
      ) : null}

      {successOrderId ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
          <div className="w-full max-w-md rounded-2xl bg-[#fff9ec] p-6 text-center shadow-xl ring-1 ring-[#e2c9a0]">
            <p className="text-sm font-medium uppercase tracking-wide text-[#5c432e]">
              {mesaT("orderReceived", lang)}
            </p>
            <p className="mt-2 font-serif text-2xl font-bold text-[#2c1f14]">
              {mesaT("mesaWord", lang)} <span className="tabular-nums">{mesa}</span>
            </p>
            <p className="mt-3 text-sm text-[#5c432e]">{mesaT("refTeam", lang)}</p>
            <p className="mt-1 break-all font-mono text-xs text-[#3d291c]">{successOrderId}</p>
            <p className="mt-4 text-sm text-[#5c432e]">{mesaT("thanksCarry", lang)}</p>
            <button
              type="button"
              onClick={() => setSuccessOrderId(null)}
              className="mt-6 w-full rounded-full bg-[#3d291c] py-3 text-sm font-semibold text-[#f6ead3] hover:bg-[#2a1c13]"
            >
              {mesaT("continueOrder", lang)}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
