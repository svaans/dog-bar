"use client";

import { useCallback, useMemo, useState } from "react";

import { adminT } from "@/lib/admin-i18n";
import type { UiLang } from "@/lib/ui-i18n";
import type { MenuItem, MenuTab, ModifierOption, ModifierStep } from "@/types/menu";

function shortId() {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 10);
}

function slugFromName(name: string): string {
  const base = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
  return base || `item-${shortId()}`;
}

type Props = {
  lang: UiLang;
  tabs: MenuTab[];
  onChange: (next: MenuTab[]) => void;
};

export function CartaVisualEditor({ lang, tabs, onChange }: Props) {
  const [activeTabId, setActiveTabId] = useState(() => tabs[0]?.id ?? "");

  const activeTab = useMemo(
    () => tabs.find((t) => t.id === activeTabId) ?? tabs[0],
    [tabs, activeTabId],
  );

  const setActiveFromTabs = useCallback(
    (next: MenuTab[]) => {
      if (!next.find((t) => t.id === activeTabId)) {
        setActiveTabId(next[0]?.id ?? "");
      }
      onChange(next);
    },
    [activeTabId, onChange],
  );

  if (!tabs.length) {
    return (
      <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-amber-200">
        {adminT("adminEmptyTabs", lang)}
      </p>
    );
  }

  const tab = activeTab ?? tabs[0];

  function addTab() {
    const id = `tab-${shortId()}`;
    setActiveTabId(id);
    onChange([...tabs, { id, label: adminT("adminNewTabLabel", lang), sections: [] }]);
  }

  function removeTab(tabId: string) {
    if (tabs.length <= 1) return;
    const next = tabs.filter((t) => t.id !== tabId);
    setActiveFromTabs(next);
  }

  function updateTab(tabId: string, label: string) {
    onChange(tabs.map((t) => (t.id === tabId ? { ...t, label } : t)));
  }

  function addSection(tabId: string) {
    const secId = `sec-${shortId()}`;
    onChange(
      tabs.map((t) =>
        t.id !== tabId
          ? t
          : {
              ...t,
              sections: [
                ...t.sections,
                { id: secId, title: adminT("adminNewSectionTitle", lang), items: [] },
              ],
            },
      ),
    );
  }

  function updateSectionTitle(tabId: string, secId: string, title: string) {
    onChange(
      tabs.map((t) =>
        t.id !== tabId
          ? t
          : {
              ...t,
              sections: t.sections.map((s) => (s.id === secId ? { ...s, title } : s)),
            },
      ),
    );
  }

  function removeSection(tabId: string, secId: string) {
    onChange(
      tabs.map((t) =>
        t.id !== tabId ? t : { ...t, sections: t.sections.filter((s) => s.id !== secId) },
      ),
    );
  }

  function moveSection(tabId: string, secId: string, dir: -1 | 1) {
    onChange(
      tabs.map((t) => {
        if (t.id !== tabId) return t;
        const i = t.sections.findIndex((s) => s.id === secId);
        const j = i + dir;
        if (i < 0 || j < 0 || j >= t.sections.length) return t;
        const copy = [...t.sections];
        const tmp = copy[i];
        copy[i] = copy[j]!;
        copy[j] = tmp!;
        return { ...t, sections: copy };
      }),
    );
  }

  function addItem(tabId: string, secId: string) {
    const nid = `item-${shortId()}`;
    const blank: MenuItem = {
      id: nid,
      name: adminT("adminNewItemName", lang),
      priceEuros: 0,
    };
    onChange(
      tabs.map((t) =>
        t.id !== tabId
          ? t
          : {
              ...t,
              sections: t.sections.map((s) =>
                s.id === secId ? { ...s, items: [...s.items, blank] } : s,
              ),
            },
      ),
    );
  }

  function updateItem(tabId: string, secId: string, itemId: string, patch: Partial<MenuItem>) {
    onChange(
      tabs.map((t) =>
        t.id !== tabId
          ? t
          : {
              ...t,
              sections: t.sections.map((s) =>
                s.id !== secId
                  ? s
                  : {
                      ...s,
                      items: s.items.map((it) => (it.id === itemId ? { ...it, ...patch } : it)),
                    },
              ),
            },
      ),
    );
  }

  function removeItem(tabId: string, secId: string, itemId: string) {
    onChange(
      tabs.map((t) =>
        t.id !== tabId
          ? t
          : {
              ...t,
              sections: t.sections.map((s) =>
                s.id === secId ? { ...s, items: s.items.filter((it) => it.id !== itemId) } : s,
              ),
            },
      ),
    );
  }

  function moveItem(tabId: string, secId: string, itemId: string, dir: -1 | 1) {
    onChange(
      tabs.map((t) => {
        if (t.id !== tabId) return t;
        return {
          ...t,
          sections: t.sections.map((s) => {
            if (s.id !== secId) return s;
            const i = s.items.findIndex((it) => it.id === itemId);
            const j = i + dir;
            if (i < 0 || j < 0 || j >= s.items.length) return s;
            const copy = [...s.items];
            const tmp = copy[i];
            copy[i] = copy[j]!;
            copy[j] = tmp!;
            return { ...s, items: copy };
          }),
        };
      }),
    );
  }

  function suggestIdFromName(tabId: string, secId: string, itemId: string, name: string) {
    const base = slugFromName(name);
    const allIds = new Set<string>();
    for (const tt of tabs) {
      for (const se of tt.sections) {
        for (const it of se.items) {
          if (it.id !== itemId) allIds.add(it.id);
        }
      }
    }
    let id = base;
    let n = 2;
    while (allIds.has(id)) {
      id = `${base}-${n++}`;
    }
    updateItem(tabId, secId, itemId, { id, name });
  }

  function setModifiers(tabId: string, secId: string, itemId: string, mods: ModifierStep[] | undefined) {
    updateItem(tabId, secId, itemId, { modifiers: mods?.length ? mods : undefined });
  }

  function addModifierStep(tabId: string, secId: string, itemId: string, item: MenuItem) {
    const step: ModifierStep = {
      id: `step-${shortId()}`,
      label: adminT("adminModStepLabelPh", lang),
      options: [{ id: `opt-${shortId()}`, label: adminT("adminModOptionLabelPh", lang) }],
    };
    setModifiers(tabId, secId, itemId, [...(item.modifiers ?? []), step]);
  }

  function updateModStep(
    tabId: string,
    secId: string,
    itemId: string,
    steps: ModifierStep[],
    stepId: string,
    patch: Partial<ModifierStep>,
  ) {
    const next = steps.map((st) => (st.id === stepId ? { ...st, ...patch } : st));
    setModifiers(tabId, secId, itemId, next);
  }

  function removeModStep(tabId: string, secId: string, itemId: string, steps: ModifierStep[], stepId: string) {
    setModifiers(
      tabId,
      secId,
      itemId,
      steps.filter((s) => s.id !== stepId),
    );
  }

  function addModOption(
    tabId: string,
    secId: string,
    itemId: string,
    steps: ModifierStep[],
    stepId: string,
  ) {
    const next = steps.map((st) =>
      st.id === stepId
        ? {
            ...st,
            options: [
              ...st.options,
              { id: `opt-${shortId()}`, label: adminT("adminModOptionLabelPh", lang) },
            ],
          }
        : st,
    );
    setModifiers(tabId, secId, itemId, next);
  }

  function updateModOption(
    tabId: string,
    secId: string,
    itemId: string,
    steps: ModifierStep[],
    stepId: string,
    optId: string,
    patch: Partial<ModifierOption>,
  ) {
    const next = steps.map((st) =>
      st.id !== stepId
        ? st
        : {
            ...st,
            options: st.options.map((o) => (o.id === optId ? { ...o, ...patch } : o)),
          },
    );
    setModifiers(tabId, secId, itemId, next);
  }

  function removeModOption(
    tabId: string,
    secId: string,
    itemId: string,
    steps: ModifierStep[],
    stepId: string,
    optId: string,
  ) {
    const next = steps.map((st) =>
      st.id !== stepId
        ? st
        : {
            ...st,
            options:
              st.options.length <= 1 ? st.options : st.options.filter((o) => o.id !== optId),
          },
    );
    setModifiers(tabId, secId, itemId, next);
  }

  const btn =
    "rounded-lg border border-[#d8bf9a] bg-white px-2 py-1 text-xs font-medium text-[#3d291c] hover:bg-[#fff3da] disabled:opacity-40";
  const inp = "mt-0.5 w-full rounded-lg border border-[#d8bf9a] bg-white px-2 py-1.5 text-sm text-[#2c1f14]";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-2 border-b border-[#e2c9a0] pb-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium uppercase tracking-wide text-[#6b5138]">
            {adminT("adminTabsHeading", lang)}
          </p>
          <div className="mt-1 flex flex-wrap gap-1">
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveTabId(t.id)}
                className={`rounded-full px-3 py-1.5 text-sm font-medium ring-1 transition ${
                  t.id === tab.id
                    ? "bg-[#3d291c] text-[#f6ead3] ring-[#3d291c]"
                    : "bg-white text-[#3d291c] ring-[#d8bf9a] hover:bg-[#fff3da]"
                }`}
              >
                {t.label || t.id}
              </button>
            ))}
          </div>
        </div>
        <button type="button" className={btn} onClick={() => addTab()}>
          {adminT("adminAddTab", lang)}
        </button>
        <button
          type="button"
          className={btn}
          disabled={tabs.length <= 1}
          onClick={() => removeTab(tab.id)}
        >
          {adminT("adminRemoveTab", lang)}
        </button>
      </div>

      <div className="rounded-xl bg-[#fff9ec]/80 p-4 ring-1 ring-[#e2c9a0]">
        <label className="block text-xs font-medium text-[#5c432e]">
          {adminT("adminTabName", lang)}
          <input
            className={inp}
            value={tab.label}
            onChange={(e) => updateTab(tab.id, e.target.value)}
          />
        </label>
        <p className="mt-1 text-xs text-[#6b5138]">
          {adminT("adminTabIdHint", lang)} <code className="rounded bg-[#f0e2c8] px-1">{tab.id}</code>
        </p>
      </div>

      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-serif text-lg font-semibold text-[#2c1f14]">
            {adminT("adminSectionsHeading", lang)}
          </h2>
          <button type="button" className={btn} onClick={() => addSection(tab.id)}>
            {adminT("adminAddSection", lang)}
          </button>
        </div>

        {tab.sections.length === 0 ? (
          <p className="text-sm text-[#6b5138]">{adminT("adminNoSections", lang)}</p>
        ) : null}

        {tab.sections.map((sec) => (
          <section
            key={sec.id}
            className="rounded-2xl border border-[#e2c9a0] bg-white/90 p-4 shadow-sm"
          >
            <div className="flex flex-wrap items-start gap-2">
              <label className="min-w-[12rem] flex-1 text-xs font-medium text-[#5c432e]">
                {adminT("adminSectionTitle", lang)}
                <input
                  className={inp}
                  value={sec.title}
                  onChange={(e) => updateSectionTitle(tab.id, sec.id, e.target.value)}
                />
              </label>
              <div className="flex flex-wrap gap-1 pt-5">
                <button type="button" className={btn} onClick={() => moveSection(tab.id, sec.id, -1)}>
                  ↑
                </button>
                <button type="button" className={btn} onClick={() => moveSection(tab.id, sec.id, 1)}>
                  ↓
                </button>
                <button type="button" className={btn} onClick={() => addItem(tab.id, sec.id)}>
                  {adminT("adminAddProduct", lang)}
                </button>
                <button
                  type="button"
                  className={`${btn} text-red-800 ring-red-200 hover:bg-red-50`}
                  onClick={() => removeSection(tab.id, sec.id)}
                >
                  {adminT("adminRemoveSection", lang)}
                </button>
              </div>
            </div>

            <ul className="mt-4 space-y-3">
              {sec.items.map((it) => (
                <li
                  key={it.id}
                  className="rounded-xl bg-[#fef6e7]/90 p-3 ring-1 ring-[#ead4b2]"
                >
                  <details>
                    <summary className="cursor-pointer list-none font-medium text-[#2c1f14] [&::-webkit-details-marker]:hidden">
                      <span className="inline-flex flex-wrap items-baseline gap-x-2 gap-y-1">
                        <span>{it.name || "—"}</span>
                        <span className="text-sm font-normal text-[#6b5138]">
                          {it.priceEuros === null
                            ? adminT("adminPriceAskBar", lang)
                            : `${it.priceEuros.toFixed(2)} €`}
                        </span>
                        <span className="text-xs text-[#8a6a3a]">· {it.id}</span>
                      </span>
                    </summary>
                    <div className="mt-3 grid gap-3 border-t border-[#ead4b2] pt-3 sm:grid-cols-2">
                      <label className="block text-xs text-[#5c432e]">
                        {adminT("adminItemId", lang)}
                        <input
                          className={inp}
                          value={it.id}
                          onChange={(e) => updateItem(tab.id, sec.id, it.id, { id: e.target.value })}
                        />
                      </label>
                      <label className="block text-xs text-[#5c432e]">
                        {adminT("adminItemName", lang)}
                        <input
                          className={inp}
                          value={it.name}
                          onChange={(e) => updateItem(tab.id, sec.id, it.id, { name: e.target.value })}
                        />
                      </label>
                      <div className="sm:col-span-2 flex flex-wrap items-end gap-3">
                        <label className="block min-w-[8rem] flex-1 text-xs text-[#5c432e]">
                          {adminT("adminItemPrice", lang)}
                          <input
                            type="number"
                            min={0}
                            step="0.01"
                            disabled={it.priceEuros === null}
                            className={inp}
                            value={it.priceEuros === null ? "" : it.priceEuros}
                            onChange={(e) => {
                              const v = e.target.value;
                              if (v === "") updateItem(tab.id, sec.id, it.id, { priceEuros: 0 });
                              else {
                                const n = parseFloat(v);
                                if (Number.isFinite(n))
                                  updateItem(tab.id, sec.id, it.id, { priceEuros: n });
                              }
                            }}
                          />
                        </label>
                        <label className="flex items-center gap-2 pb-2 text-sm text-[#3d291c]">
                          <input
                            type="checkbox"
                            checked={it.priceEuros === null}
                            onChange={(e) =>
                              updateItem(tab.id, sec.id, it.id, {
                                priceEuros: e.target.checked ? null : 0,
                              })
                            }
                          />
                          {adminT("adminPriceNullToggle", lang)}
                        </label>
                        <button
                          type="button"
                          className={btn}
                          onClick={() => suggestIdFromName(tab.id, sec.id, it.id, it.name)}
                        >
                          {adminT("adminSuggestId", lang)}
                        </button>
                      </div>
                      <label className="block text-xs text-[#5c432e] sm:col-span-2">
                        {adminT("adminItemDesc", lang)}
                        <textarea
                          rows={2}
                          className={inp}
                          value={it.description ?? ""}
                          onChange={(e) =>
                            updateItem(tab.id, sec.id, it.id, {
                              description: e.target.value || undefined,
                            })
                          }
                        />
                      </label>
                      <label className="block text-xs text-[#5c432e]">
                        {adminT("adminItemNote", lang)}
                        <input
                          className={inp}
                          value={it.note ?? ""}
                          onChange={(e) =>
                            updateItem(tab.id, sec.id, it.id, { note: e.target.value || undefined })
                          }
                        />
                      </label>
                      <label className="block text-xs text-[#5c432e]">
                        {adminT("adminItemAllergens", lang)}
                        <input
                          className={inp}
                          placeholder="gluten, lacteos…"
                          value={(it.allergens ?? []).join(", ")}
                          onChange={(e) => {
                            const parts = e.target.value
                              .split(/[,;]+/)
                              .map((s) => s.trim())
                              .filter(Boolean);
                            updateItem(tab.id, sec.id, it.id, {
                              allergens: parts.length ? parts : undefined,
                            });
                          }}
                        />
                      </label>
                      <label className="block text-xs text-[#5c432e] sm:col-span-2">
                        {adminT("adminItemImage", lang)}
                        <input
                          className={inp}
                          value={it.imageUrl ?? ""}
                          onChange={(e) =>
                            updateItem(tab.id, sec.id, it.id, {
                              imageUrl: e.target.value.trim() || undefined,
                            })
                          }
                        />
                      </label>
                      <label className="flex items-center gap-2 text-sm text-[#3d291c] sm:col-span-2">
                        <input
                          type="checkbox"
                          checked={Boolean(it.forPets)}
                            onChange={(e) =>
                            updateItem(tab.id, sec.id, it.id, {
                              forPets: e.target.checked ? true : undefined,
                            })
                          }
                        />
                        {adminT("adminItemPets", lang)}
                      </label>
                    </div>

                    <div className="mt-4 border-t border-[#ead4b2] pt-3">
                      <p className="text-xs font-medium text-[#5c432e]">{adminT("adminModifiersHeading", lang)}</p>
                      <div className="mt-2 space-y-3">
                        {(it.modifiers ?? []).map((step) => (
                          <div
                            key={step.id}
                            className="rounded-lg bg-white/80 p-2 ring-1 ring-[#e8cfa5]"
                          >
                            <div className="flex flex-wrap gap-2">
                              <input
                                className={`${inp} max-w-[10rem]`}
                                placeholder="id paso"
                                value={step.id}
                                onChange={(e) =>
                                  updateModStep(tab.id, sec.id, it.id, it.modifiers ?? [], step.id, {
                                    id: e.target.value,
                                  })
                                }
                              />
                              <input
                                className={`${inp} min-w-[8rem] flex-1`}
                                placeholder={adminT("adminModStepLabelPh", lang)}
                                value={step.label}
                                onChange={(e) =>
                                  updateModStep(tab.id, sec.id, it.id, it.modifiers ?? [], step.id, {
                                    label: e.target.value,
                                  })
                                }
                              />
                              <button
                                type="button"
                                className={btn}
                                onClick={() =>
                                  addModOption(tab.id, sec.id, it.id, it.modifiers ?? [], step.id)
                                }
                              >
                                {adminT("adminAddOption", lang)}
                              </button>
                              <button
                                type="button"
                                className={`${btn} text-red-800`}
                                onClick={() =>
                                  removeModStep(tab.id, sec.id, it.id, it.modifiers ?? [], step.id)
                                }
                              >
                                × {adminT("adminRemoveStep", lang)}
                              </button>
                            </div>
                            <ul className="mt-2 space-y-1 pl-1">
                              {step.options.map((opt) => (
                                <li key={opt.id} className="flex flex-wrap items-center gap-2 text-sm">
                                  <input
                                    className={`${inp} w-24`}
                                    value={opt.id}
                                    onChange={(e) =>
                                      updateModOption(
                                        tab.id,
                                        sec.id,
                                        it.id,
                                        it.modifiers ?? [],
                                        step.id,
                                        opt.id,
                                        { id: e.target.value },
                                      )
                                    }
                                  />
                                  <input
                                    className={`${inp} min-w-[6rem] flex-1`}
                                    value={opt.label}
                                    onChange={(e) =>
                                      updateModOption(
                                        tab.id,
                                        sec.id,
                                        it.id,
                                        it.modifiers ?? [],
                                        step.id,
                                        opt.id,
                                        { label: e.target.value },
                                      )
                                    }
                                  />
                                  <input
                                    type="number"
                                    step="0.01"
                                    className={`${inp} w-24`}
                                    placeholder="€"
                                    value={opt.priceEuros ?? ""}
                                    onChange={(e) => {
                                      const v = e.target.value;
                                      updateModOption(
                                        tab.id,
                                        sec.id,
                                        it.id,
                                        it.modifiers ?? [],
                                        step.id,
                                        opt.id,
                                        {
                                          priceEuros:
                                            v === "" ? undefined : Math.max(0, parseFloat(v) || 0),
                                        },
                                      );
                                    }}
                                  />
                                  <button
                                    type="button"
                                    className={btn}
                                    disabled={step.options.length <= 1}
                                    onClick={() =>
                                      removeModOption(
                                        tab.id,
                                        sec.id,
                                        it.id,
                                        it.modifiers ?? [],
                                        step.id,
                                        opt.id,
                                      )
                                    }
                                  >
                                    −
                                  </button>
                                </li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </div>
                      <button
                        type="button"
                        className={`${btn} mt-2`}
                        onClick={() => addModifierStep(tab.id, sec.id, it.id, it)}
                      >
                        {adminT("adminAddModifierStep", lang)}
                      </button>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2 border-t border-[#ead4b2] pt-3">
                      <button type="button" className={btn} onClick={() => moveItem(tab.id, sec.id, it.id, -1)}>
                        {adminT("adminItemUp", lang)}
                      </button>
                      <button type="button" className={btn} onClick={() => moveItem(tab.id, sec.id, it.id, 1)}>
                        {adminT("adminItemDown", lang)}
                      </button>
                      <button
                        type="button"
                        className={`${btn} text-red-800 ring-red-200`}
                        onClick={() => removeItem(tab.id, sec.id, it.id)}
                      >
                        {adminT("adminRemoveProduct", lang)}
                      </button>
                    </div>
                  </details>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
