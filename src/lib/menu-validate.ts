import type { UiLang } from "@/lib/ui-i18n";
import type { MenuItem, MenuSection, MenuTab, ModifierOption, ModifierStep } from "@/types/menu";

const MAX_TABS = 24;
const MAX_SECTIONS_PER_TAB = 48;
const MAX_ITEMS_PER_SECTION = 200;
const MAX_ID_LEN = 80;
const MAX_LABEL_LEN = 140;
const MAX_DESC = 600;
const MAX_NOTE = 200;
const MAX_URL = 500;
const MAX_ALLERGENS = 24;
const MAX_OPT_PER_STEP = 40;
const MAX_STEPS = 12;
const MAX_PRICE = 9999.99;

function msg(lang: UiLang, es: string, en: string): string {
  return lang === "en" ? en : es;
}

function trimStr(s: unknown, max: number): string {
  if (typeof s !== "string") return "";
  return s.trim().slice(0, max);
}

function normalizeOption(o: unknown): ModifierOption {
  const raw = (o && typeof o === "object" ? o : {}) as ModifierOption;
  const id = trimStr(raw.id, MAX_ID_LEN);
  const label = trimStr(raw.label, MAX_LABEL_LEN);
  const out: ModifierOption = { id, label };
  if (typeof raw.priceEuros === "number" && Number.isFinite(raw.priceEuros)) {
    const p = Math.round(raw.priceEuros * 100) / 100;
    if (p >= 0 && p <= MAX_PRICE) out.priceEuros = p;
  }
  return out;
}

function normalizeStep(s: ModifierStep): ModifierStep {
  const optionsRaw = Array.isArray(s.options) ? s.options : [];
  return {
    id: trimStr(s.id, MAX_ID_LEN),
    label: trimStr(s.label, MAX_LABEL_LEN),
    options: optionsRaw.map((o) => normalizeOption(o)).filter((o) => o.id && o.label),
  };
}

function normalizeItem(raw: Record<string, unknown>): MenuItem {
  const it = raw as MenuItem;
  const priceRaw = it.priceEuros;
  const priceEuros =
    priceRaw === null || priceRaw === undefined
      ? null
      : typeof priceRaw === "number" && Number.isFinite(priceRaw)
        ? Math.min(MAX_PRICE, Math.max(0, Math.round(priceRaw * 100) / 100))
        : null;

  const allergens = Array.isArray(it.allergens)
    ? it.allergens
        .map((a) => (typeof a === "string" ? trimStr(a, 32) : ""))
        .filter(Boolean)
        .slice(0, MAX_ALLERGENS)
    : undefined;

  const modifiers = Array.isArray(it.modifiers)
    ? it.modifiers.map(normalizeStep).filter((st) => st.id && st.label && st.options.length > 0)
    : undefined;

  const out: MenuItem = {
    id: trimStr(it.id, MAX_ID_LEN),
    name: trimStr(it.name, MAX_LABEL_LEN),
    priceEuros,
  };
  const desc = trimStr(it.description, MAX_DESC);
  if (desc) out.description = desc;
  const note = trimStr(it.note, MAX_NOTE);
  if (note) out.note = note;
  if (allergens?.length) out.allergens = allergens;
  const img = trimStr(it.imageUrl, MAX_URL);
  if (img) out.imageUrl = img;
  if (it.forPets === true) out.forPets = true;
  if (modifiers?.length) out.modifiers = modifiers.slice(0, MAX_STEPS);
  return out;
}

export type MenuValidationResult =
  | { ok: true; tabs: MenuTab[] }
  | { ok: false; errors: string[] };

export function validateMenuTabs(input: unknown, lang: UiLang = "es"): MenuValidationResult {
  const errors: string[] = [];

  if (!Array.isArray(input)) {
    errors.push(msg(lang, "La carta debe ser una lista de pestañas.", "The menu must be a list of tabs."));
    return { ok: false, errors };
  }
  if (input.length === 0 || input.length > MAX_TABS) {
    errors.push(
      msg(
        lang,
        `Debe haber entre 1 y ${MAX_TABS} pestañas.`,
        `There must be between 1 and ${MAX_TABS} tabs.`,
      ),
    );
    return { ok: false, errors };
  }

  const seenItemIds = new Map<string, string>();

  const tabsOut: MenuTab[] = [];

  for (let ti = 0; ti < input.length; ti++) {
    const tab = input[ti];
    if (!tab || typeof tab !== "object") {
      errors.push(msg(lang, `Pestaña ${ti + 1}: dato inválido.`, `Tab ${ti + 1}: invalid data.`));
      continue;
    }
    const t = tab as Record<string, unknown>;
    const tabId = trimStr(t.id, MAX_ID_LEN);
    const tabLabel = trimStr(t.label, MAX_LABEL_LEN);
    if (!tabId || !tabLabel) {
      errors.push(
        msg(
          lang,
          `Pestaña ${ti + 1}: id y nombre son obligatorios.`,
          `Tab ${ti + 1}: id and label are required.`,
        ),
      );
      continue;
    }
    if (!Array.isArray(t.sections)) {
      errors.push(
        msg(lang, `Pestaña «${tabLabel}»: falta la lista de secciones.`, `Tab «${tabLabel}»: sections missing.`),
      );
      continue;
    }
    if (t.sections.length > MAX_SECTIONS_PER_TAB) {
      errors.push(
        msg(
          lang,
          `Pestaña «${tabLabel}»: demasiadas secciones (máx. ${MAX_SECTIONS_PER_TAB}).`,
          `Tab «${tabLabel}»: too many sections (max ${MAX_SECTIONS_PER_TAB}).`,
        ),
      );
    }

    const sectionsOut: MenuSection[] = [];

    for (let si = 0; si < t.sections.length && si < MAX_SECTIONS_PER_TAB; si++) {
      const sec = t.sections[si];
      if (!sec || typeof sec !== "object") continue;
      const s = sec as Record<string, unknown>;
      const secId = trimStr(s.id, MAX_ID_LEN);
      const secTitle = trimStr(s.title, MAX_LABEL_LEN);
      if (!secId || !secTitle) {
        errors.push(
          msg(
            lang,
            `Pestaña «${tabLabel}», sección ${si + 1}: id y título obligatorios.`,
            `Tab «${tabLabel}», section ${si + 1}: id and title required.`,
          ),
        );
        continue;
      }
      if (!Array.isArray(s.items)) {
        errors.push(
          msg(
            lang,
            `Sección «${secTitle}»: falta la lista de productos.`,
            `Section «${secTitle}»: items missing.`,
          ),
        );
        continue;
      }

      const itemsOut: MenuItem[] = [];

      for (let ii = 0; ii < s.items.length && ii < MAX_ITEMS_PER_SECTION; ii++) {
        const it = s.items[ii];
        if (!it || typeof it !== "object") continue;
        const raw = it as Record<string, unknown>;
        const item = normalizeItem(raw);
        if (!item.id || !item.name) {
          errors.push(
            msg(
              lang,
              `Producto en «${secTitle}» (#${ii + 1}): id y nombre obligatorios.`,
              `Product in «${secTitle}» (#${ii + 1}): id and name required.`,
            ),
          );
          continue;
        }
        const dupPath = seenItemIds.get(item.id);
        if (dupPath) {
          errors.push(
            msg(
              lang,
              `Id de producto duplicado «${item.id}» (ya usado en ${dupPath}).`,
              `Duplicate product id «${item.id}» (already used in ${dupPath}).`,
            ),
          );
          continue;
        }
        seenItemIds.set(item.id, `«${tabLabel}» / «${secTitle}»`);

        if (item.modifiers) {
          for (const step of item.modifiers) {
            if (step.options.length > MAX_OPT_PER_STEP) {
              errors.push(
                msg(
                  lang,
                  `«${item.name}»: demasiadas opciones en un paso (máx. ${MAX_OPT_PER_STEP}).`,
                  `«${item.name}»: too many options in one step (max ${MAX_OPT_PER_STEP}).`,
                ),
              );
            }
          }
        }

        itemsOut.push(item);
      }

      if (itemsOut.length) {
        sectionsOut.push({ id: secId, title: secTitle, items: itemsOut });
      }
    }

    if (sectionsOut.length) {
      tabsOut.push({ id: tabId, label: tabLabel, sections: sectionsOut });
    }
  }

  if (!tabsOut.length) {
    errors.push(msg(lang, "La carta quedaría vacía tras validar.", "The menu would be empty after validation."));
    return { ok: false, errors };
  }

  if (errors.length) {
    return { ok: false, errors };
  }

  return { ok: true, tabs: tabsOut };
}
