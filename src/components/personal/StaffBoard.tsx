"use client";

import {
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import { usePathname } from "next/navigation";

import { summarizeOrders } from "@/lib/order-stats";
import {
  notifyStaffNewOrder,
  requestStaffNotificationPermission,
  staffNotificationSupported,
} from "@/lib/staff-notification";
import { playStaffBeep } from "@/lib/staff-beep";
import { OrderPrintButton } from "@/components/personal/OrderPrintButton";
import { formatHaceMinutos, orderAgeAccentClass } from "@/lib/relative-time";
import { staffFill, staffT, type StaffUiKey } from "@/lib/staff-i18n";
import { lineEmphasisClass, type StaffViewRole } from "@/lib/staff-roles";
import type { UiLang } from "@/lib/ui-i18n";
import type { Order, OrderStatus } from "@/types/orders";

const SOUND_LS = "meraki_staff_sound";
const NOTIF_LS = "meraki_staff_notif";
const ROLE_LS = "meraki_staff_role";

function ymdEuropeMadrid(d = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Madrid",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

function parseRole(raw: string | null): StaffViewRole {
  if (raw === "cocina" || raw === "sala" || raw === "todos") return raw;
  return "todos";
}

function formatTime(iso: string, lang: UiLang) {
  const d = new Date(iso);
  return d.toLocaleTimeString(lang === "en" ? "en-GB" : "es-ES", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatMoney(n: number | null, lang: UiLang) {
  if (n === null) return "—";
  return n.toLocaleString(lang === "en" ? "en-GB" : "es-ES", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function shortId(id: string) {
  return id.replace(/-/g, "").slice(0, 8).toUpperCase();
}

type StaffView = "activos" | "historial";

type ActiveStatusFilter = "todos" | "nuevo" | "preparando" | "listo";

const STAFF_NAME_LS = "meraki_staff_display_name";
const STAFF_SETTINGS_OPEN_LS = "meraki_staff_settings_expanded";
const STAFF_COMPACT_KDS_LS = "meraki_staff_compact_kds";

function yesterdayYmdMadrid() {
  const today = ymdEuropeMadrid();
  const [y, m, d] = today.split("-").map((x) => parseInt(x, 10));
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() - 1);
  return ymdEuropeMadrid(dt);
}

function orderLineStats(order: Order) {
  const units = order.lines.reduce((s, l) => s + l.quantity, 0);
  return { lines: order.lines.length, units };
}

function formatSyncAge(seconds: number, lang: UiLang): string {
  if (seconds < 15) return staffT("syncJustNow", lang);
  if (seconds < 120) return staffFill(staffT("syncSecondsAgo", lang), { n: seconds });
  const mins = Math.floor(seconds / 60);
  return staffFill(staffT("syncMinutesAgo", lang), { n: mins });
}

const STATUS_I18N: Record<OrderStatus, StaffUiKey> = {
  nuevo: "statusNuevo",
  preparando: "statusPreparando",
  listo: "statusListo",
  entregado: "statusEntregado",
  cancelado: "statusCancelado",
};

export type StaffBoardVariant = "default" | "cocina" | "barra";

export type StaffBoardProps = {
  menuTabByItemId: Record<string, string>;
  /** Orden de pestañas de la carta (ids), para ticket impreso y coherencia. */
  menuTabOrder?: string[];
  variant?: StaffBoardVariant;
  lang?: UiLang;
};

export function StaffBoard({
  menuTabByItemId,
  menuTabOrder = [],
  variant = "default",
  lang = "es",
}: StaffBoardProps) {
  const pathname = usePathname() || "/personal";
  const [key, setKey] = useState("");
  const [hydratedKey, setHydratedKey] = useState<string | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [role, setRole] = useState<StaffViewRole>("todos");
  const [view, setView] = useState<StaffView>("activos");
  const [historyDay, setHistoryDay] = useState(() => ymdEuropeMadrid());
  const [historyMeta, setHistoryMeta] = useState<{ day: string; timeZone: string } | null>(
    null,
  );

  const [activeOrders, setActiveOrders] = useState<Order[]>([]);
  const [historyOrders, setHistoryOrders] = useState<Order[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [importingBackup, setImportingBackup] = useState(false);
  const backupFileRef = useRef<HTMLInputElement>(null);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [staffName, setStaffName] = useState("");
  const [mesaFilter, setMesaFilter] = useState("");
  const [activeStatusFilter, setActiveStatusFilter] = useState<ActiveStatusFilter>("todos");
  const [historyStatusFilter, setHistoryStatusFilter] = useState<
    "todos" | OrderStatus
  >("todos");
  const [lastSyncAt, setLastSyncAt] = useState<number | null>(null);
  const [syncTick, setSyncTick] = useState(0);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [loadError, setLoadError] = useState<{
    scope: "active" | "history";
    message: string;
  } | null>(null);
  const [compactFinger, setCompactFinger] = useState(false);

  const bootstrapped = useRef(false);
  const seenOrderIds = useRef(new Set<string>());
  const [nowTick, setNowTick] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNowTick(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const saved = window.localStorage.getItem("meraki_staff_key");
    const snd = window.localStorage.getItem(SOUND_LS) === "1";
    const roleSaved = parseRole(window.localStorage.getItem(ROLE_LS));
    const notifWanted = window.localStorage.getItem(NOTIF_LS) === "1";
    const notifOk =
      notifWanted &&
      staffNotificationSupported() &&
      Notification.permission === "granted";
    const nm = window.localStorage.getItem(STAFF_NAME_LS) ?? "";
    startTransition(() => {
      if (saved) setKey(saved);
      setHydratedKey(saved ?? "");
      setSoundEnabled(snd);
      setRole(roleSaved);
      setNotificationsEnabled(Boolean(notifOk));
      if (nm) setStaffName(nm);
    });
  }, []);

  useEffect(() => {
    if (variant === "cocina") {
      startTransition(() => setRole("cocina"));
      window.localStorage.setItem(ROLE_LS, "cocina");
    } else if (variant === "barra") {
      startTransition(() => setRole("sala"));
      window.localStorage.setItem(ROLE_LS, "sala");
    }
  }, [variant]);

  useEffect(() => {
    if (hydratedKey === null) return;
    if (hydratedKey.length > 0) {
      setSettingsOpen(window.localStorage.getItem(STAFF_SETTINGS_OPEN_LS) === "1");
    } else {
      setSettingsOpen(true);
    }
  }, [hydratedKey]);

  useEffect(() => {
    if (variant !== "cocina" && variant !== "barra") return;
    setCompactFinger(window.localStorage.getItem(STAFF_COMPACT_KDS_LS) === "1");
  }, [variant]);

  useEffect(() => {
    if (hydratedKey === null) return;
    const id = window.setInterval(() => setSyncTick((t) => t + 1), 5000);
    return () => window.clearInterval(id);
  }, [hydratedKey]);

  const effectiveKey = hydratedKey === null ? null : hydratedKey;
  const hasSavedKey = Boolean(effectiveKey && effectiveKey.length > 0);
  const compactKdsActive =
    compactFinger && (variant === "cocina" || variant === "barra");
  const syncAgeSeconds = useMemo(() => {
    if (lastSyncAt === null) return 0;
    return Math.max(0, Math.floor((Date.now() - lastSyncAt) / 1000));
  }, [lastSyncAt, syncTick]);

  const fetchActiveOrders = useCallback(async () => {
    if (effectiveKey === null) return;
    const qs = new URLSearchParams();
    qs.set("scope", "active");
    const res = await fetch(`/api/orders?${qs.toString()}`, {
      cache: "no-store",
      headers: effectiveKey ? { "x-staff-key": effectiveKey } : {},
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setLoadError({
        scope: "active",
        message: typeof data.error === "string" ? data.error : staffT("errLoadOrders", lang),
      });
      return;
    }
    setLoadError((prev) => (prev?.scope === "active" ? null : prev));
    setError(null);
    setLastSyncAt(Date.now());
    setActiveOrders(data.orders ?? []);
  }, [effectiveKey, lang]);

  const fetchHistoryOrders = useCallback(async () => {
    if (effectiveKey === null) return;
    const qs = new URLSearchParams();
    qs.set("scope", "day");
    qs.set("day", historyDay);
    const res = await fetch(`/api/orders?${qs.toString()}`, {
      cache: "no-store",
      headers: effectiveKey ? { "x-staff-key": effectiveKey } : {},
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setLoadError({
        scope: "history",
        message: typeof data.error === "string" ? data.error : staffT("errLoadHistory", lang),
      });
      return;
    }
    setLoadError((prev) => (prev?.scope === "history" ? null : prev));
    setError(null);
    setLastSyncAt(Date.now());
    setHistoryOrders(data.orders ?? []);
    if (typeof data.day === "string" && typeof data.timeZone === "string") {
      setHistoryMeta({ day: data.day, timeZone: data.timeZone });
      setHistoryDay(data.day);
    }
  }, [effectiveKey, historyDay, lang]);

  useEffect(() => {
    if (effectiveKey === null || view !== "activos") return;
    let cancelled = false;
    const tick = async () => {
      if (cancelled) return;
      await fetchActiveOrders();
    };
    void tick();
    const id = window.setInterval(tick, 2500);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [effectiveKey, fetchActiveOrders, view]);

  useEffect(() => {
    if (effectiveKey === null || view !== "historial") return;
    queueMicrotask(() => {
      void fetchHistoryOrders();
    });
  }, [effectiveKey, fetchHistoryOrders, view, historyDay]);

  useEffect(() => {
    if (effectiveKey === null) return;

    if (!bootstrapped.current) {
      for (const o of activeOrders) {
        seenOrderIds.current.add(o.id);
      }
      if (activeOrders.length > 0) {
        bootstrapped.current = true;
      }
      return;
    }

    let shouldBeep = false;
    const nuevoOrders: Order[] = [];
    for (const o of activeOrders) {
      if (seenOrderIds.current.has(o.id)) continue;
      seenOrderIds.current.add(o.id);
      if (o.status === "nuevo") {
        if (soundEnabled) shouldBeep = true;
        nuevoOrders.push(o);
      }
    }
    if (shouldBeep && document.visibilityState === "visible") {
      playStaffBeep();
    }
    if (notificationsEnabled) {
      for (const o of nuevoOrders) {
        notifyStaffNewOrder(o);
      }
    }
  }, [activeOrders, effectiveKey, notificationsEnabled, soundEnabled]);

  function saveKey() {
    window.localStorage.setItem("meraki_staff_key", key);
    setHydratedKey(key);
    bootstrapped.current = false;
    seenOrderIds.current.clear();
  }

  function clearKey() {
    window.localStorage.removeItem("meraki_staff_key");
    setKey("");
    setHydratedKey("");
    setActiveOrders([]);
    setHistoryOrders([]);
    bootstrapped.current = false;
    seenOrderIds.current.clear();
  }

  function onSoundChange(e: ChangeEvent<HTMLInputElement>) {
    const next = e.target.checked;
    setSoundEnabled(next);
    window.localStorage.setItem(SOUND_LS, next ? "1" : "0");
    if (next) {
      playStaffBeep();
    }
  }

  async function onNotificationChange(e: ChangeEvent<HTMLInputElement>) {
    if (!e.target.checked) {
      setNotificationsEnabled(false);
      window.localStorage.removeItem(NOTIF_LS);
      return;
    }
    if (!staffNotificationSupported()) {
      setError(staffT("errNotifBrowser", lang));
      return;
    }
    const p = await requestStaffNotificationPermission();
    if (p === "granted") {
      setNotificationsEnabled(true);
      window.localStorage.setItem(NOTIF_LS, "1");
      setError(null);
      try {
        new Notification(staffT("notifActivatedTitle", lang), {
          body: staffT("notifActivatedBody", lang),
        });
      } catch {
        // HTTP u otros límites del navegador
      }
    } else {
      setError(staffT("errNotifDenied", lang));
    }
  }

  function setStaffRole(next: StaffViewRole) {
    setRole(next);
    window.localStorage.setItem(ROLE_LS, next);
  }

  function persistSettingsOpen(open: boolean) {
    setSettingsOpen(open);
    if (typeof window !== "undefined" && hydratedKey !== null && hydratedKey.length > 0) {
      window.localStorage.setItem(STAFF_SETTINGS_OPEN_LS, open ? "1" : "0");
    }
  }

  function setCompactFingerPersist(next: boolean) {
    setCompactFinger(next);
    window.localStorage.setItem(STAFF_COMPACT_KDS_LS, next ? "1" : "0");
  }

  function retryLastFetch() {
    if (!loadError) return;
    if (loadError.scope === "active") void fetchActiveOrders();
    else void fetchHistoryOrders();
  }

  const patchStatus = useCallback(
    async (orderId: string, status: OrderStatus) => {
      if (status === "cancelado" && typeof window !== "undefined") {
        if (!window.confirm(staffT("confirmCancelOrder", lang))) return;
      }
      const orderSnapshot =
        activeOrders.find((x) => x.id === orderId) ??
        historyOrders.find((x) => x.id === orderId);
      const res = await fetch(`/api/orders/${orderId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(effectiveKey ? { "x-staff-key": effectiveKey } : {}),
        },
        body: JSON.stringify({
          status,
          actorName: staffName.trim() || undefined,
          ...(orderSnapshot?.updatedAt
            ? { baseUpdatedAt: orderSnapshot.updatedAt }
            : {}),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 409) {
        await fetchActiveOrders();
        if (view === "historial") await fetchHistoryOrders();
        setError(data.error ?? staffT("errOrderConflict", lang));
        return;
      }
      if (!res.ok) {
        setError(data.error ?? staffT("errPatch", lang));
        return;
      }
      setError(null);
      await fetchActiveOrders();
      if (view === "historial") {
        await fetchHistoryOrders();
      }
    },
    [
      activeOrders,
      effectiveKey,
      fetchActiveOrders,
      fetchHistoryOrders,
      historyOrders,
      lang,
      staffName,
      view,
    ],
  );

  async function downloadExport() {
    if (effectiveKey === null) return;
    setExporting(true);
    try {
      const qs = new URLSearchParams();
      qs.set("day", historyDay);
      const res = await fetch(`/api/orders/export?${qs.toString()}`, {
        headers: effectiveKey ? { "x-staff-key": effectiveKey } : {},
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? staffT("errExportCsv", lang));
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `meraki-pedidos-${historyDay}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }

  async function downloadBackupJson() {
    if (effectiveKey === null) return;
    const res = await fetch("/api/orders/backup", {
      headers: effectiveKey ? { "x-staff-key": effectiveKey } : {},
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? staffT("errBackupDownload", lang));
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `meraki-backup-pedidos.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function onBackupFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.currentTarget.files?.[0];
    e.currentTarget.value = "";
    if (!file || effectiveKey === null) return;
    setImportingBackup(true);
    setError(null);
    try {
      const text = await file.text();
      const data = JSON.parse(text) as unknown;
      if (!Array.isArray(data)) {
        setError(staffT("errBackupArray", lang));
        return;
      }
      const res = await fetch("/api/orders/import", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(effectiveKey ? { "x-staff-key": effectiveKey } : {}),
        },
        body: JSON.stringify(data),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error ?? staffT("errImportRejected", lang));
        return;
      }
      await fetchActiveOrders();
      await fetchHistoryOrders();
    } catch {
      setError(staffT("errJsonInvalid", lang));
    } finally {
      setImportingBackup(false);
    }
  }

  const sortedActive = useMemo(() => {
    return [...activeOrders].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );
  }, [activeOrders]);

  const sortedHistory = useMemo(() => {
    return [...historyOrders].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );
  }, [historyOrders]);

  const displayed = view === "activos" ? sortedActive : sortedHistory;

  const historySummary = useMemo(
    () => summarizeOrders(historyOrders),
    [historyOrders],
  );

  const visibleOrders = useMemo(() => {
    let list = displayed;
    const raw = mesaFilter.trim();
    if (raw) {
      const n = parseInt(raw, 10);
      if (!Number.isNaN(n) && String(n) === raw) {
        list = list.filter((o) => o.mesa === n);
      } else {
        list = list.filter((o) => String(o.mesa).includes(raw));
      }
    }
    if (view === "activos" && activeStatusFilter !== "todos") {
      list = list.filter((o) => o.status === activeStatusFilter);
    }
    if (view === "historial" && historyStatusFilter !== "todos") {
      list = list.filter((o) => o.status === historyStatusFilter);
    }
    return list;
  }, [
    displayed,
    mesaFilter,
    view,
    activeStatusFilter,
    historyStatusFilter,
  ]);

  const filtersActive =
    Boolean(mesaFilter.trim()) ||
    (view === "activos" && activeStatusFilter !== "todos") ||
    (view === "historial" && historyStatusFilter !== "todos");

  const nuevoCount = useMemo(
    () => activeOrders.filter((o) => o.status === "nuevo").length,
    [activeOrders],
  );

  const nextAction: Partial<Record<OrderStatus, { label: string; next: OrderStatus }>> =
    useMemo(
      () => ({
        nuevo: { label: staffT("actionStart", lang), next: "preparando" },
        preparando: { label: staffT("actionMarkReady", lang), next: "listo" },
        listo: { label: staffT("actionDelivered", lang), next: "entregado" },
      }),
      [lang],
    );

  const activeStatusFilterOptions = useMemo(
    () =>
      (
        [
          ["todos", "filterTodos"],
          ["nuevo", "statusNuevo"],
          ["preparando", "statusPreparando"],
          ["listo", "statusListo"],
        ] as const
      ).map(([id, key]) => ({
        id: id as ActiveStatusFilter,
        label: staffT(key, lang),
      })),
    [lang],
  );

  const historyStatusFilterOptions = useMemo(
    () =>
      (
        [
          ["todos", "filterTodos"],
          ["nuevo", "statusNuevo"],
          ["preparando", "statusPreparando"],
          ["listo", "statusListo"],
          ["entregado", "statusEntregado"],
          ["cancelado", "statusCancelado"],
        ] as const
      ).map(([id, key]) => ({
        id: id as "todos" | OrderStatus,
        label: staffT(key, lang),
      })),
    [lang],
  );

  const statusLabel = useCallback(
    (s: OrderStatus) => staffT(STATUS_I18N[s], lang),
    [lang],
  );

  if (effectiveKey === null) {
    return (
      <p className="rounded-xl bg-white/80 px-4 py-3 text-sm text-[#5c432e] ring-1 ring-[#e2c9a0]">
        {staffT("loading", lang)}
      </p>
    );
  }

  const langLinks = (
    <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-[#5c432e]">
      <a
        href={`${pathname}?lang=es`}
        className={lang === "es" ? "font-bold text-[#3d291c]" : "underline decoration-[#c4a574]"}
      >
        {staffT("langEs", lang)}
      </a>
      <span className="text-[#b89a6e]">|</span>
      <a
        href={`${pathname}?lang=en`}
        className={lang === "en" ? "font-bold text-[#3d291c]" : "underline decoration-[#c4a574]"}
      >
        {staffT("langEn", lang)}
      </a>
    </div>
  );

  const accessFields = (
    <>
      <p className="mt-1 text-sm text-[#6b5138]">{staffT("accessBody", lang)}</p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
        <input
          type="password"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder={staffT("keyPlaceholder", lang)}
          className="w-full rounded-xl border border-[#d8bf9a] bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#c2763a]/50 sm:max-w-xs"
        />
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={saveKey}
            className="rounded-full bg-[#3d291c] px-4 py-2 text-sm font-semibold text-[#f6ead3]"
          >
            {staffT("saveConnect", lang)}
          </button>
          <button
            type="button"
            onClick={clearKey}
            className="rounded-full bg-[#e8d4b5] px-4 py-2 text-sm font-medium text-[#3d291c]"
          >
            {staffT("clear", lang)}
          </button>
        </div>
      </div>
    </>
  );

  const staffNameField = (
    <label className="block text-xs font-medium uppercase tracking-wide text-[#5c432e]">
      {staffT("yourNameLabel", lang)}
      <input
        type="text"
        value={staffName}
        onChange={(e) => setStaffName(e.target.value)}
        onBlur={() => {
          const t = staffName.trim();
          if (t) window.localStorage.setItem(STAFF_NAME_LS, t.slice(0, 80));
          else window.localStorage.removeItem(STAFF_NAME_LS);
        }}
        placeholder={staffT("yourNamePlaceholder", lang)}
        className="mt-1 w-full max-w-md rounded-xl border border-[#d8bf9a] bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#c2763a]/50"
      />
    </label>
  );

  const soundNotifBlock = (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
      <label className="flex cursor-pointer items-center gap-2 text-sm text-[#3d291c]">
        <input
          type="checkbox"
          checked={soundEnabled}
          onChange={onSoundChange}
          className="h-4 w-4 rounded border-[#c4a574] text-[#c2763a] focus:ring-[#c2763a]"
        />
        {staffT("soundNewOrder", lang)}
      </label>
      <label
        className={`flex cursor-pointer items-center gap-2 text-sm text-[#3d291c] ${
          !staffNotificationSupported() ? "cursor-not-allowed opacity-50" : ""
        }`}
      >
        <input
          type="checkbox"
          checked={notificationsEnabled}
          disabled={!staffNotificationSupported()}
          onChange={(e) => void onNotificationChange(e)}
          className="h-4 w-4 rounded border-[#c4a574] text-[#c2763a] focus:ring-[#c2763a] disabled:opacity-50"
        />
        {staffT("notifNewOrder", lang)}
      </label>
      <p className="text-xs leading-snug text-[#6b5138] sm:max-w-md">{staffT("notifHint", lang)}</p>
    </div>
  );

  const kitchenRoleBlock =
    variant === "default" ? (
      <div className="rounded-xl bg-white/70 p-3 ring-1 ring-[#ead4b2]">
        <p className="text-xs font-semibold uppercase tracking-wide text-[#5c432e]">
          {staffT("kitchenBarViewTitle", lang)}
        </p>
        <p className="mt-1 text-sm text-[#6b5138]">{staffT("kitchenBarViewBody", lang)}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {(
            [
              { id: "todos" as const, label: staffT("roleTodos", lang) },
              { id: "cocina" as const, label: staffT("roleKitchen", lang) },
              { id: "sala" as const, label: staffT("roleBar", lang) },
            ] as const
          ).map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => setStaffRole(r.id)}
              className={`rounded-full px-3 py-1.5 text-sm font-semibold transition ${
                role === r.id
                  ? "bg-[#c2763a] text-white"
                  : "bg-white text-[#3d291c] ring-1 ring-[#e2c9a0] hover:bg-[#fff3da]"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>
    ) : null;

  return (
    <div className="space-y-4">
      {hasSavedKey ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[#fff9ec]/90 px-3 py-2.5 shadow-sm ring-1 ring-[#e2c9a0]">
          {langLinks}
          <div className="flex flex-wrap items-center gap-3 text-xs text-[#5c432e]">
            {lastSyncAt !== null ? (
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2 w-2 shrink-0 rounded-full bg-emerald-500 shadow-sm ring-2 ring-emerald-200" />
                <span className="font-medium">
                  {staffFill(staffT("syncUpdatedAgo", lang), {
                    ago: formatSyncAge(syncAgeSeconds, lang),
                  })}
                </span>
              </span>
            ) : null}
            <button
              type="button"
              onClick={() =>
                view === "activos" ? void fetchActiveOrders() : void fetchHistoryOrders()
              }
              className="font-semibold text-[#c2763a] underline decoration-[#c4a574]"
            >
              {staffT("refreshNow", lang)}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex justify-end">{langLinks}</div>
      )}

      {!hasSavedKey ? (
        <div className="rounded-2xl bg-[#fff9ec]/90 p-4 shadow-sm ring-1 ring-[#e2c9a0]">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[#5c432e]">
            {staffT("accessTitle", lang)}
          </h2>
          {accessFields}
          <div className="mt-4 border-t border-[#e8cfa5] pt-4">{staffNameField}</div>
        </div>
      ) : null}

      {!hasSavedKey ? (
        <div className="rounded-2xl bg-[#fff9ec]/90 px-4 py-3 shadow-sm ring-1 ring-[#e2c9a0]">
          {soundNotifBlock}
        </div>
      ) : null}

      {hasSavedKey ? (
        <div className="overflow-hidden rounded-xl bg-[#fef6e7]/90 ring-1 ring-[#e8cfa5]">
          <button
            type="button"
            onClick={() => persistSettingsOpen(!settingsOpen)}
            className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm font-semibold text-[#3d291c] hover:bg-[#fff3da]/60"
          >
            <span>
              {settingsOpen ? staffT("settingsHide", lang) : staffT("settingsShow", lang)}
            </span>
            <span className="text-xs text-[#5c432e]" aria-hidden>
              {settingsOpen ? "▲" : "▼"}
            </span>
          </button>
          {settingsOpen ? (
            <div className="space-y-4 border-t border-[#e8cfa5] px-4 pb-4 pt-3">
              <div>
                <h2 className="text-xs font-semibold uppercase tracking-wide text-[#5c432e]">
                  {staffT("settingsPanelTitle", lang)}
                </h2>
                <div className="mt-2 rounded-xl bg-white/70 p-3 ring-1 ring-[#ead4b2]">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-[#5c432e]">
                    {staffT("accessTitle", lang)}
                  </h3>
                  {accessFields}
                </div>
                <div className="mt-3">{staffNameField}</div>
              </div>
              {kitchenRoleBlock}
              <div className="rounded-xl bg-white/70 p-3 ring-1 ring-[#ead4b2]">{soundNotifBlock}</div>
            </div>
          ) : null}
        </div>
      ) : null}

      {(variant === "cocina" || variant === "barra") ? (
        <label className="flex cursor-pointer items-start gap-3 rounded-xl bg-[#fff9ec]/90 px-4 py-3 text-sm text-[#3d291c] shadow-sm ring-1 ring-[#e2c9a0]">
          <input
            type="checkbox"
            checked={compactFinger}
            onChange={(e) => setCompactFingerPersist(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-[#c4a574] text-[#c2763a] focus:ring-[#c2763a]"
          />
          <span>
            <span className="font-semibold">{staffT("compactViewLabel", lang)}</span>
            <span className="mt-0.5 block text-xs font-normal text-[#6b5138]">
              {staffT("compactViewHint", lang)}
            </span>
          </span>
        </label>
      ) : null}

      <div className="flex flex-wrap gap-2 rounded-2xl bg-[#fff9ec]/90 p-2 shadow-sm ring-1 ring-[#e2c9a0]">
        {(
          [
            { id: "activos" as const, label: staffT("tabActive", lang) },
            { id: "historial" as const, label: staffT("tabHistory", lang) },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setView(t.id)}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
              view === t.id
                ? "bg-[#3d291c] text-[#f6ead3]"
                : "bg-white text-[#3d291c] ring-1 ring-[#e2c9a0] hover:bg-[#fff3da]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {view === "historial" ? (
        <div className="flex flex-col gap-3 rounded-2xl bg-[#fff9ec]/90 p-4 shadow-sm ring-1 ring-[#e2c9a0]">
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
          <div>
            <label className="block text-xs font-medium uppercase tracking-wide text-[#5c432e]">
              {staffT("dayServer", lang)}
            </label>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <input
                type="date"
                value={historyDay}
                onChange={(e) => setHistoryDay(e.target.value)}
                className="rounded-xl border border-[#d8bf9a] bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#c2763a]/50"
              />
              <button
                type="button"
                onClick={() => setHistoryDay(ymdEuropeMadrid())}
                className="rounded-full border border-[#c4a574] bg-white px-3 py-1.5 text-xs font-semibold text-[#3d291c] hover:bg-[#fff3da]"
              >
                {staffT("dayToday", lang)}
              </button>
              <button
                type="button"
                onClick={() => setHistoryDay(yesterdayYmdMadrid())}
                className="rounded-full border border-[#c4a574] bg-white px-3 py-1.5 text-xs font-semibold text-[#3d291c] hover:bg-[#fff3da]"
              >
                {staffT("dayYesterday", lang)}
              </button>
            </div>
            {historyMeta ? (
              <p className="mt-1 text-xs text-[#6b5138]">
                {staffFill(staffT("tzHistoryNote", lang), { tz: historyMeta.timeZone })}
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void fetchHistoryOrders()}
              className="rounded-full border border-[#c4a574] bg-white px-4 py-2 text-sm font-semibold text-[#3d291c] hover:bg-[#fff3da]"
            >
              {staffT("refresh", lang)}
            </button>
            <button
              type="button"
              disabled={exporting}
              onClick={() => void downloadExport()}
              className="rounded-full bg-[#2f7a4a] px-4 py-2 text-sm font-semibold text-white hover:bg-[#276642] disabled:opacity-50"
            >
              {exporting ? staffT("generating", lang) : staffT("downloadCsv", lang)}
            </button>
            <button
              type="button"
              onClick={() => void downloadBackupJson()}
              className="rounded-full border border-[#3d291c] bg-[#3d291c] px-4 py-2 text-sm font-semibold text-[#f6ead3] hover:bg-[#2c1f14]"
            >
              {staffT("backupJson", lang)}
            </button>
            <input
              ref={backupFileRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => void onBackupFile(e)}
            />
            <button
              type="button"
              disabled={importingBackup}
              onClick={() => backupFileRef.current?.click()}
              className="rounded-full border border-[#c2763a] bg-[#fff3da] px-4 py-2 text-sm font-semibold text-[#7a2f2f] hover:bg-[#ffe8c4] disabled:opacity-50"
            >
              {importingBackup ? staffT("importingBackup", lang) : staffT("restoreJson", lang)}
            </button>
          </div>
          </div>
          <p className="text-xs text-[#8a2f2f]">
            {staffT("restoreWarning", lang)}
          </p>
        </div>
      ) : null}

      <div className="rounded-2xl bg-[#fff9ec]/90 p-4 shadow-sm ring-1 ring-[#e2c9a0]">
        <p className="text-xs font-semibold uppercase tracking-wide text-[#5c432e]">
          {staffT("mesaFilterTitle", lang)}
        </p>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
          <input
            type="text"
            inputMode="numeric"
            value={mesaFilter}
            onChange={(e) => setMesaFilter(e.target.value)}
            placeholder={staffT("mesaPlaceholder", lang)}
            className="w-full max-w-xs rounded-xl border border-[#d8bf9a] bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#c2763a]/50"
          />
          {filtersActive ? (
            <button
              type="button"
              onClick={() => {
                setMesaFilter("");
                setActiveStatusFilter("todos");
                setHistoryStatusFilter("todos");
              }}
              className="text-sm font-semibold text-[#c2763a] underline decoration-[#e2c9a0]"
            >
              {staffT("clearFilters", lang)}
            </button>
          ) : null}
        </div>
      </div>

      {view === "activos" ? (
        <div className="rounded-2xl bg-[#fff9ec]/90 p-4 shadow-sm ring-1 ring-[#e2c9a0]">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#5c432e]">
            {staffT("queueTitle", lang)}
          </p>
          {nuevoCount > 0 ? (
            <button
              type="button"
              onClick={() => setActiveStatusFilter("nuevo")}
              className={`mt-3 w-full rounded-xl px-4 py-2.5 text-left text-sm font-bold transition sm:w-auto ${
                activeStatusFilter === "nuevo"
                  ? "bg-amber-500 text-[#1f140d] ring-2 ring-amber-600"
                  : "bg-amber-100 text-[#5c3d0a] ring-1 ring-amber-300 hover:bg-amber-200"
              }`}
            >
              {staffT("soloNuevosCta", lang)}{" "}
              <span className="tabular-nums">({nuevoCount})</span>
            </button>
          ) : null}
          <div className="mt-3 flex flex-wrap gap-2">
            {activeStatusFilterOptions.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setActiveStatusFilter(f.id)}
                className={`rounded-full px-3 py-1.5 text-sm font-semibold transition ${
                  activeStatusFilter === f.id
                    ? "bg-[#3d291c] text-[#f6ead3]"
                    : "bg-white text-[#3d291c] ring-1 ring-[#e2c9a0] hover:bg-[#fff3da]"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="rounded-2xl bg-[#fff9ec]/90 p-4 shadow-sm ring-1 ring-[#e2c9a0]">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#5c432e]">
            {staffT("historyStatusTitle", lang)}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {historyStatusFilterOptions.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setHistoryStatusFilter(f.id)}
                className={`rounded-full px-3 py-1.5 text-sm font-semibold transition ${
                  historyStatusFilter === f.id
                    ? "bg-[#3d291c] text-[#f6ead3]"
                    : "bg-white text-[#3d291c] ring-1 ring-[#e2c9a0] hover:bg-[#fff3da]"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {!hasSavedKey && variant === "default" ? (
        <div className="rounded-2xl bg-[#fff9ec]/90 p-4 shadow-sm ring-1 ring-[#e2c9a0]">
          {kitchenRoleBlock}
        </div>
      ) : null}

      {loadError ? (
        <div className="flex flex-col gap-2 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-900 ring-1 ring-red-200 sm:flex-row sm:items-center sm:justify-between">
          <p>{loadError.message}</p>
          <button
            type="button"
            onClick={() => void retryLastFetch()}
            className="shrink-0 rounded-full bg-[#7a2f2f] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#631f1f]"
          >
            {staffT("retryFetch", lang)}
          </button>
        </div>
      ) : null}

      {error ? (
        <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800 ring-1 ring-red-200">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm font-medium text-[#3d291c]">
          {view === "activos" ? (
            <>
              {staffT("activeOrdersHeader", lang)}{" "}
              <span className="tabular-nums text-[#c2763a]">{sortedActive.length}</span>
              {filtersActive ? (
                <span className="text-[#6b5138]">
                  {" "}
                  · {staffT("showingWord", lang)}{" "}
                  <span className="tabular-nums text-[#c2763a]">
                    {visibleOrders.length}
                  </span>
                </span>
              ) : null}
            </>
          ) : (
            <>
              {staffT("historyOrdersHeader", lang)}{" "}
              <span className="tabular-nums text-[#c2763a]">{sortedHistory.length}</span>
              {filtersActive ? (
                <span className="text-[#6b5138]">
                  {" "}
                  · {staffT("showingWord", lang)}{" "}
                  <span className="tabular-nums text-[#c2763a]">
                    {visibleOrders.length}
                  </span>
                </span>
              ) : null}
            </>
          )}
          {view === "activos" && nuevoCount > 0 ? (
            <span className="mt-1 block text-xs text-[#6b5138]">
              {nuevoCount === 1
                ? staffT("newOne", lang)
                : staffFill(staffT("newMany", lang), { n: nuevoCount })}
            </span>
          ) : view === "activos" ? (
            <span className="mt-1 block text-xs text-[#6b5138]">{staffT("noNewOrders", lang)}</span>
          ) : (
            <span className="mt-1 block text-xs text-[#6b5138]">
              {filtersActive
                ? staffFill(staffT("showingFiltered", lang), {
                    visible: visibleOrders.length,
                    total: displayed.length,
                    s: displayed.length === 1 ? "" : "s",
                  })
                : staffFill(staffT("ordersThatDay", lang), {
                    n: displayed.length,
                    s: displayed.length === 1 ? "" : "s",
                  })}
            </span>
          )}
        </div>
        {!hasSavedKey ? (
          <button
            type="button"
            onClick={() =>
              view === "activos" ? void fetchActiveOrders() : void fetchHistoryOrders()
            }
            className="text-sm font-medium text-[#5c432e] underline decoration-[#c4a574]"
          >
            {staffT("refreshNow", lang)}
          </button>
        ) : null}
      </div>

      {view === "historial" && historyOrders.length > 0 ? (
        <div className="rounded-2xl bg-[#fef6e7] p-4 text-sm text-[#3d291c] shadow-sm ring-1 ring-[#e8cfa5]">
          <h3 className="font-serif text-base font-semibold text-[#2c1f14]">
            {staffT("daySummaryTitle", lang)}
          </h3>
          <p className="mt-2 text-xs text-[#6b5138]">{staffT("daySummaryBody", lang)}</p>
          <dl className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl bg-white/80 px-3 py-2 ring-1 ring-[#ead4b2]">
              <dt className="text-xs uppercase tracking-wide text-[#6b5138]">
                {staffT("labelOrdersCount", lang)}
              </dt>
              <dd className="text-xl font-bold tabular-nums text-[#c2763a]">
                {historySummary.orderCount}
              </dd>
            </div>
            <div className="rounded-xl bg-white/80 px-3 py-2 ring-1 ring-[#ead4b2]">
              <dt className="text-xs uppercase tracking-wide text-[#6b5138]">
                {staffT("labelKnownTotal", lang)}
              </dt>
              <dd className="text-xl font-bold tabular-nums text-[#2f7a4a]">
                {historySummary.knownTotalEuros.toLocaleString(lang === "en" ? "en-GB" : "es-ES", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}{" "}
                €
              </dd>
            </div>
            <div className="rounded-xl bg-white/80 px-3 py-2 ring-1 ring-[#ead4b2]">
              <dt className="text-xs uppercase tracking-wide text-[#6b5138]">
                {staffT("labelUnitsServed", lang)}
              </dt>
              <dd className="text-xl font-bold tabular-nums text-[#3d291c]">
                {historySummary.totalUnits}
              </dd>
            </div>
            <div className="rounded-xl bg-white/80 px-3 py-2 ring-1 ring-[#ead4b2]">
              <dt className="text-xs uppercase tracking-wide text-[#6b5138]">
                {staffT("labelNoMenuPrice", lang)}
              </dt>
              <dd className="text-xl font-bold tabular-nums text-[#7a5c3e]">
                {historySummary.unitsWithoutKnownPrice}
              </dd>
            </div>
          </dl>
          <p className="mt-3 text-xs text-[#5c432e]">
            {staffT("byStatus", lang)}{" "}
            {(
              [
                "nuevo",
                "preparando",
                "listo",
                "entregado",
                "cancelado",
              ] as const
            )
              .map((s) => `${statusLabel(s)} ${historySummary.byStatus[s]}`)
              .join(" · ")}
          </p>
        </div>
      ) : null}

      {!displayed.length ? (
        <p className="text-center text-sm text-[#6b5138]">
          {view === "activos" ? staffT("emptyActive", lang) : staffT("emptyDay", lang)}
        </p>
      ) : !visibleOrders.length ? (
        <p className="text-center text-sm text-[#6b5138]">{staffT("emptyFiltered", lang)}</p>
      ) : (
        <ul className="space-y-3">
          {visibleOrders.map((o) => {
            const stats = orderLineStats(o);
            return (
            <li
              key={o.id}
              className={`rounded-2xl bg-[#fff9ec]/95 shadow-sm ring-1 ring-[#e2c9a0] ${
                compactKdsActive ? "p-3" : "p-4"
              } ${
                view === "activos" && o.status === "nuevo" ? "ring-2 ring-amber-400" : ""
              } ${view === "activos" ? orderAgeAccentClass(o.status, o.createdAt, nowTick) : ""}`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-wide text-[#7a5c3e]">
                    {formatTime(o.createdAt, lang)} ·{" "}
                    {formatHaceMinutos(o.createdAt, nowTick, lang)} · {statusLabel(o.status)} ·{" "}
                    {staffT("refWord", lang)}{" "}
                    <span className="font-mono tabular-nums">{shortId(o.id)}</span>
                    <span className="ml-1 inline-block rounded-md bg-white/90 px-1.5 py-0.5 align-middle text-xs font-semibold normal-case tracking-normal text-[#3d291c] ring-1 ring-[#e2c9a0]">
                      {staffFill(staffT("orderStatsBadge", lang), {
                        lines: stats.lines,
                        units: stats.units,
                      })}
                    </span>
                  </p>
                  {o.lastActorName ? (
                    <p className="mt-0.5 text-xs text-[#6b5138]">
                      {staffT("lastChange", lang)}{" "}
                      <span className="font-medium">{o.lastActorName}</span>
                    </p>
                  ) : null}
                  {o.statusLog && o.statusLog.length > 0 ? (
                    <details className="mt-1 max-w-sm text-xs text-[#6b5138]">
                      <summary className="cursor-pointer select-none font-semibold text-[#5c432e] hover:underline">
                        {staffT("statusHistory", lang)}
                        {o.statusLog.length > 1 ? (
                          <span className="tabular-nums font-normal text-[#6b5138]">
                            {" "}
                            ({o.statusLog.length})
                          </span>
                        ) : null}
                      </summary>
                      <ul className="mt-1 max-h-28 space-y-0.5 overflow-y-auto border-l border-[#e2c9a0] pl-2">
                        {o.statusLog.slice(-12).map((e, i) => (
                          <li key={`${o.id}-log-${e.at}-${i}`}>
                            <span className="tabular-nums text-[#5c432e]">
                              {formatTime(e.at, lang)}
                            </span>{" "}
                            · {statusLabel(e.status)}
                            {e.actor ? (
                              <span className="text-[#6b5138]">
                                {" "}
                                · <span className="font-medium">{e.actor}</span>
                              </span>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    </details>
                  ) : null}
                  <p
                    className={`font-bold tabular-nums text-[#2c1f14] ${
                      compactKdsActive ? "text-3xl" : "text-2xl"
                    }`}
                  >
                    {staffT("tableWord", lang)} {o.mesa}
                  </p>
                  {o.customerDisplayName ? (
                    <p className="mt-0.5 text-sm font-medium text-[#5c432e]">
                      {o.customerDisplayName}
                    </p>
                  ) : null}
                  {o.customerNote ? (
                    <p className="mt-1 text-sm text-[#6b5138]">
                      <span className="font-semibold">{staffT("noteLabel", lang)}</span>{" "}
                      {o.customerNote}
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-wrap justify-end gap-2">
                  <OrderPrintButton
                    order={o}
                    lang={lang}
                    menuTabByItemId={menuTabOrder.length ? menuTabByItemId : undefined}
                    menuTabOrder={menuTabOrder.length ? menuTabOrder : undefined}
                  />
                  {view === "activos" ? (
                    <>
                      {nextAction[o.status] ? (
                        <button
                          type="button"
                          onClick={() => void patchStatus(o.id, nextAction[o.status]!.next)}
                          className={`rounded-full bg-[#2f7a4a] font-semibold text-white hover:bg-[#276642] ${
                            compactKdsActive ? "px-4 py-2 text-base" : "px-3 py-1.5 text-sm"
                          }`}
                        >
                          {nextAction[o.status]!.label}
                        </button>
                      ) : null}
                      {o.status === "preparando" ? (
                        <button
                          type="button"
                          onClick={() => void patchStatus(o.id, "nuevo")}
                          className={`rounded-full border border-[#c4a574] bg-white font-semibold text-[#3d291c] hover:bg-[#fff3da] ${
                            compactKdsActive ? "px-3 py-2 text-sm" : "px-3 py-1.5 text-xs"
                          }`}
                        >
                          {staffT("backToNew", lang)}
                        </button>
                      ) : null}
                      {o.status === "listo" ? (
                        <button
                          type="button"
                          onClick={() => void patchStatus(o.id, "preparando")}
                          className={`rounded-full border border-[#c4a574] bg-white font-semibold text-[#3d291c] hover:bg-[#fff3da] ${
                            compactKdsActive ? "px-3 py-2 text-sm" : "px-3 py-1.5 text-xs"
                          }`}
                        >
                          {staffT("backToPrep", lang)}
                        </button>
                      ) : null}
                      {o.status !== "cancelado" && o.status !== "entregado" ? (
                        <button
                          type="button"
                          onClick={() => void patchStatus(o.id, "cancelado")}
                          className={`rounded-full bg-[#f0e2c8] font-medium text-[#7a2f2f] hover:bg-[#e7d2b0] ${
                            compactKdsActive ? "px-4 py-2 text-sm" : "px-3 py-1.5 text-sm"
                          }`}
                        >
                          {staffT("cancelOrder", lang)}
                        </button>
                      ) : null}
                    </>
                  ) : o.status === "entregado" || o.status === "cancelado" ? (
                    <>
                      {o.status === "entregado" ? (
                        <button
                          type="button"
                          onClick={() => void patchStatus(o.id, "listo")}
                          className={`rounded-full border border-[#c4a574] bg-white font-semibold text-[#3d291c] hover:bg-[#fff3da] ${
                            compactKdsActive ? "px-3 py-2 text-sm" : "px-3 py-1.5 text-xs"
                          }`}
                        >
                          {staffT("fixBackToReady", lang)}
                        </button>
                      ) : null}
                      {o.status === "cancelado" ? (
                        <button
                          type="button"
                          onClick={() => void patchStatus(o.id, "nuevo")}
                          className={`rounded-full border border-[#8a6a3a] bg-[#fff3da] font-semibold text-[#3d291c] hover:bg-[#ffe8c4] ${
                            compactKdsActive ? "px-3 py-2 text-sm" : "px-3 py-1.5 text-xs"
                          }`}
                        >
                          {staffT("restoreOrder", lang)}
                        </button>
                      ) : null}
                    </>
                  ) : null}
                </div>
              </div>
              <ul className="mt-3 space-y-1.5 text-sm text-[#3d291c]">
                {o.lines.map((l, i) => (
                  <li
                    key={`${o.id}-${i}`}
                    className={`flex justify-between gap-3 ${lineEmphasisClass(
                      l.menuItemId,
                      role,
                      menuTabByItemId,
                    )}`}
                  >
                    <span className="min-w-0">
                      <span className="tabular-nums font-semibold">{l.quantity}×</span>{" "}
                      {l.name}
                      {l.optionsLabel ? (
                        <span className="text-[#6b5138]"> ({l.optionsLabel})</span>
                      ) : null}
                    </span>
                    <span className="shrink-0 tabular-nums text-[#5c432e]">
                      {formatMoney(l.unitPriceEuros, lang)} €
                    </span>
                  </li>
                ))}
              </ul>
            </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
