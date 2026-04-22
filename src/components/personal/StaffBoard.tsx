"use client";

import {
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import { usePathname } from "next/navigation";

import { summarizeOrders } from "@/lib/order-stats";
import {
  notifyStaffNewOrder,
  staffNotificationSupported,
} from "@/lib/staff-notification";
import { playStaffBeep } from "@/lib/staff-beep";
import { OrderPrintButton } from "@/components/personal/OrderPrintButton";
import { getMesaCount } from "@/lib/mesa-count";
import { formatHaceMinutos, orderAgeAccentClass } from "@/lib/relative-time";
import { staffFill, staffT, type StaffUiKey } from "@/lib/staff-i18n";
import { lineEmphasisClass, type StaffViewRole } from "@/lib/staff-roles";
import type { UiLang } from "@/lib/ui-i18n";
import type { StaffDayReportRow } from "@/lib/day-staff-report";
import type { EmployeePublic } from "@/lib/employee-types";
import type { StaffMesaAssignment } from "@/lib/staff-mesa-types";
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

function formatDurationShort(ms: number, lang: UiLang): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return lang === "en" ? `${h}h ${m % 60}m` : `${h} h ${m % 60} min`;
  if (m > 0) return lang === "en" ? `${m}m` : `${m} min`;
  return lang === "en" ? `${s}s` : `${s} s`;
}

const STATUS_I18N: Record<OrderStatus, StaffUiKey> = {
  nuevo: "statusNuevo",
  preparando: "statusPreparando",
  listo: "statusListo",
  entregado: "statusEntregado",
  cancelado: "statusCancelado",
};

export type StaffBoardVariant = "default" | "cocina" | "barra";
export type StaffBoardModule = "sala" | "admin" | "cocina" | "barra";

export type StaffBoardProps = {
  menuTabByItemId: Record<string, string>;
  /** Orden de pestañas de la carta (ids), para ticket impreso y coherencia. */
  menuTabOrder?: string[];
  variant?: StaffBoardVariant;
  module?: StaffBoardModule;
  lang?: UiLang;
};

export function StaffBoard({
  menuTabByItemId,
  menuTabOrder = [],
  variant = "default",
  module,
  lang = "es",
}: StaffBoardProps) {
  const pathname = usePathname() || "/personal";
  const effectiveModule: StaffBoardModule =
    module ??
    (variant === "cocina" ? "cocina" : variant === "barra" ? "barra" : "sala");
  const showHistory = effectiveModule === "admin";
  const showEmployeeAdmin = effectiveModule === "admin";
  const showFloor = effectiveModule === "sala";
  const showOrders = effectiveModule === "admin" || effectiveModule === "cocina" || effectiveModule === "barra";
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
  const [successHint, setSuccessHint] = useState<string | null>(null);
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
  // (legacy) antes había input + botón; ahora usamos rejilla de mesas.
  const [staffAssignments, setStaffAssignments] = useState<StaffMesaAssignment[]>([]);
  const [floorAssignError, setFloorAssignError] = useState<string | null>(null);
  const [staffReportRows, setStaffReportRows] = useState<StaffDayReportRow[] | null>(null);
  const [staffReportLoading, setStaffReportLoading] = useState(false);
  const [profilesEnabled, setProfilesEnabled] = useState(false);
  const [employeeMe, setEmployeeMe] = useState<EmployeePublic | null>(null);
  const [employeeBootLoading, setEmployeeBootLoading] = useState(false);
  const [adminEmpList, setAdminEmpList] = useState<(EmployeePublic & { active: boolean })[]>([]);
  const [adminEmpSaving, setAdminEmpSaving] = useState(false);
  const [newEmpNumber, setNewEmpNumber] = useState("");
  const [newEmpName, setNewEmpName] = useState("");
  const [newEmpPin, setNewEmpPin] = useState("");
  const [adminEmpMsg, setAdminEmpMsg] = useState<string | null>(null);
  const [empLoginNumber, setEmpLoginNumber] = useState("");
  const [empLoginPin, setEmpLoginPin] = useState("");
  const [empLoginErr, setEmpLoginErr] = useState<string | null>(null);
  const mesaCount = useMemo(() => getMesaCount(), []);
  const [mesaActionOpen, setMesaActionOpen] = useState(false);
  const [mesaActionMesa, setMesaActionMesa] = useState<number | null>(null);

  const bootstrapped = useRef(false);
  const seenOrderIds = useRef(new Set<string>());
  const [nowTick, setNowTick] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNowTick(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const saved = window.localStorage.getItem("meraki_staff_key");
    const sndRaw = window.localStorage.getItem(SOUND_LS);
    const snd = sndRaw === null ? true : sndRaw === "1";
    const roleSaved = parseRole(window.localStorage.getItem(ROLE_LS));
    const notifRaw = window.localStorage.getItem(NOTIF_LS);
    const notifWanted = notifRaw === null ? true : notifRaw === "1";
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
    // Por defecto: sonido + notificaciones "queridas" activadas (si el navegador lo permite).
    if (sndRaw === null) window.localStorage.setItem(SOUND_LS, "1");
    if (notifRaw === null) window.localStorage.setItem(NOTIF_LS, "1");
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
    // En módulos de cocina/barra dejamos solo Activos (sin historial/export).
    if (variant === "cocina" || variant === "barra") {
      startTransition(() => setView("activos"));
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

  useEffect(() => {
    if (!successHint) return;
    const id = window.setTimeout(() => setSuccessHint(null), 4500);
    return () => window.clearTimeout(id);
  }, [successHint]);

  const effectiveKey = hydratedKey === null ? null : hydratedKey;
  const hasSavedKey = Boolean(effectiveKey && effectiveKey.length > 0);

  const myFloorMesasKey = useMemo(() => {
    const label = (employeeMe?.displayName ?? staffName).trim().toLowerCase();
    if (!label) return "";
    return staffAssignments
      .filter((a) => a.staffName.trim().toLowerCase() === label)
      .map((a) => a.mesa)
      .sort((a, b) => a - b)
      .join(",");
  }, [staffAssignments, staffName, employeeMe]);

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

  const fetchStaffAssignments = useCallback(async () => {
    if (effectiveKey === null || !effectiveKey) return;
    const res = await fetch("/api/staff/mesa-assignments", {
      cache: "no-store",
      headers: { "x-staff-key": effectiveKey },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      if (res.status === 401) {
        setFloorAssignError(lang === "en" ? "Not authorized (team key)." : "No autorizado (clave de equipo).");
      } else {
        setFloorAssignError(
          typeof data.error === "string" ? data.error : staffT("errLoadFloor", lang),
        );
      }
      return;
    }
    setFloorAssignError(null);
    setStaffAssignments(Array.isArray(data.assignments) ? data.assignments : []);
  }, [effectiveKey, lang]);

  const postFloorMesa = useCallback(
    async (action: "join" | "leave", mesa: number) => {
      if (effectiveKey === null || !effectiveKey) return;
      const name = staffName.trim();
      if (!employeeMe && !name) {
        setFloorAssignError(staffT("floorNeedName", lang));
        return;
      }
      const res = await fetch("/api/staff/mesa-assignments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-staff-key": effectiveKey,
        },
        body: JSON.stringify(
          employeeMe ? { action, mesa } : { action, mesa, staffName: name },
        ),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setFloorAssignError(
          typeof data.error === "string" ? data.error : staffT("errFloorAction", lang),
        );
        return;
      }
      setFloorAssignError(null);
      await fetchStaffAssignments();
    },
    [effectiveKey, employeeMe, staffName, lang, fetchStaffAssignments],
  );

  const fetchDayStaffReport = useCallback(async () => {
    if (effectiveKey === null || !effectiveKey) return;
    setStaffReportLoading(true);
    setStaffReportRows(null);
    try {
      const qs = new URLSearchParams({ day: historyDay });
      const res = await fetch(`/api/orders/day-staff-report?${qs}`, {
        cache: "no-store",
        headers: { "x-staff-key": effectiveKey },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : staffT("errStaffReport", lang));
        return;
      }
      setError(null);
      setStaffReportRows(Array.isArray(data.byStaff) ? data.byStaff : []);
    } finally {
      setStaffReportLoading(false);
    }
  }, [effectiveKey, historyDay, lang]);

  const refetchEmployeeBootstrap = useCallback(async () => {
    if (effectiveKey === null || !effectiveKey) {
      startTransition(() => {
        setProfilesEnabled(false);
        setEmployeeMe(null);
        setEmployeeBootLoading(false);
      });
      return;
    }
    setEmployeeBootLoading(true);
    try {
      const r = await fetch("/api/staff/employee/bootstrap", {
        cache: "no-store",
        headers: { "x-staff-key": effectiveKey },
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        setProfilesEnabled(false);
        setEmployeeMe(null);
        return;
      }
      setProfilesEnabled(Boolean(d.profilesEnabled));
      if (d.employee?.id && typeof d.employee.displayName === "string") {
        setEmployeeMe({
          id: String(d.employee.id),
          employeeNumber: Number(d.employee.employeeNumber),
          displayName: String(d.employee.displayName),
        });
      } else {
        setEmployeeMe(null);
      }
    } finally {
      setEmployeeBootLoading(false);
    }
  }, [effectiveKey]);

  const fetchAdminEmpList = useCallback(async () => {
    if (effectiveKey === null || !effectiveKey) return;
    const adminKey = window.localStorage.getItem("meraki_admin_key")?.trim() || "";
    const r = await fetch("/api/admin/employees", {
      cache: "no-store",
      headers: adminKey ? { "x-admin-key": adminKey } : {},
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) return;
    setAdminEmpList(Array.isArray(d.employees) ? d.employees : []);
  }, [effectiveKey]);

  useEffect(() => {
    void refetchEmployeeBootstrap();
  }, [refetchEmployeeBootstrap]);

  useEffect(() => {
    if (hasSavedKey && settingsOpen) void fetchAdminEmpList();
  }, [hasSavedKey, settingsOpen, fetchAdminEmpList]);

  useEffect(() => {
    if (!employeeMe?.displayName) return;
    const t = employeeMe.displayName.trim().slice(0, 80);
    if (!t) return;
    startTransition(() => setStaffName(t));
    window.localStorage.setItem(STAFF_NAME_LS, t);
  }, [employeeMe?.displayName, employeeMe?.id]);

  useEffect(() => {
    setStaffReportRows(null);
  }, [historyDay]);

  useEffect(() => {
    if (effectiveKey === null || !effectiveKey) return;
    let cancelled = false;
    const tick = async () => {
      if (cancelled) return;
      await fetchStaffAssignments();
    };
    void tick();
    const id = window.setInterval(tick, 4300);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [effectiveKey, fetchStaffAssignments]);

  useEffect(() => {
    if (effectiveKey === null || !effectiveKey) return;
    if (!myFloorMesasKey) return;
    if (!employeeMe && !staffName.trim()) return;
    const id = window.setInterval(() => {
      void (async () => {
        const mesas = myFloorMesasKey
          .split(",")
          .map((x) => parseInt(x, 10))
          .filter((n) => Number.isFinite(n));
        for (const m of mesas) {
          await fetch("/api/staff/mesa-assignments", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-staff-key": effectiveKey,
            },
            body: JSON.stringify(
              employeeMe
                ? { action: "join", mesa: m }
                : { action: "join", mesa: m, staffName: staffName.trim() },
            ),
          });
        }
        await fetchStaffAssignments();
      })();
    }, 42_000);
    return () => window.clearInterval(id);
  }, [effectiveKey, employeeMe, staffName, myFloorMesasKey, fetchStaffAssignments]);

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
    let cancelled = false;
    const tick = async () => {
      if (cancelled) return;
      await fetchHistoryOrders();
    };
    void tick();
    const id = window.setInterval(tick, 4000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
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
    setEmployeeMe(null);
    setProfilesEnabled(false);
    setAdminEmpList([]);
    setAdminEmpMsg(null);
    setEmpLoginErr(null);
  }

  // Nota: la solicitud de permisos de notificación suele requerir gesto de usuario.
  // Aquí dejamos las notificaciones "queridas" por defecto (localStorage=1) y
  // solo se activarán si el navegador ya tiene permiso.

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
          ...(!employeeMe ? { actorName: staffName.trim() || undefined } : {}),
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
      employeeMe,
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

  async function clearEntireOrderHistory() {
    if (effectiveKey === null) return;
    if (!window.confirm(staffT("clearAllHistoryConfirm", lang))) return;
    setError(null);
    setSuccessHint(null);
    try {
      const res = await fetch("/api/orders/clear-all", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(effectiveKey ? { "x-staff-key": effectiveKey } : {}),
        },
        body: JSON.stringify({ confirm: "BORRAR_TODO" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(
          typeof data.error === "string" ? data.error : staffT("clearAllHistoryErr", lang),
        );
        return;
      }
      setSuccessHint(staffT("clearAllHistoryOk", lang));
      await fetchActiveOrders();
      await fetchHistoryOrders();
    } catch {
      setError(staffT("clearAllHistoryErr", lang));
    }
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

  const employeeGateActive = hasSavedKey && profilesEnabled;
  const gateBlocked = employeeGateActive && (employeeBootLoading || employeeMe === null);

  function isFloorMine(n: string): boolean {
    const t = n.trim().toLowerCase();
    if (employeeMe) return t === employeeMe.displayName.trim().toLowerCase();
    return staffName.trim().length > 0 && t === staffName.trim().toLowerCase();
  }

  function openMesaActions(mesa: number) {
    setMesaActionMesa(mesa);
    setMesaActionOpen(true);
  }

  async function attendMesaFromModal(mesa: number) {
    await postFloorMesa("join", mesa);
    setSuccessHint(lang === "en" ? `Table ${mesa} covered` : `Mesa ${mesa} atendida`);
    setMesaActionOpen(false);
  }

  async function leaveMesaFromModal(mesa: number) {
    await postFloorMesa("leave", mesa);
    setSuccessHint(lang === "en" ? `Left table ${mesa}` : `Has salido de mesa ${mesa}`);
    setMesaActionOpen(false);
  }

  function openOrderForMesa(mesa: number) {
    const suffix = lang === "en" ? "?lang=en" : "";
    window.open(`/mesa/${mesa}${suffix}`, "_blank", "noopener,noreferrer");
  }

  async function submitEmployeeLogin() {
    if (effectiveKey === null || !effectiveKey) return;
    setEmpLoginErr(null);
    const n = parseInt(empLoginNumber.trim(), 10);
    if (!Number.isFinite(n) || n < 1 || n > 999) {
      setEmpLoginErr(staffT("employeeNumberInvalid", lang));
      return;
    }
    const r = await fetch("/api/staff/employee/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-staff-key": effectiveKey,
      },
      body: JSON.stringify({ employeeNumber: n, pin: empLoginPin }),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) {
      setEmpLoginErr(typeof d.error === "string" ? d.error : staffT("errEmployeeLogin", lang));
      return;
    }
    if (d.employee) {
      const emp = {
        id: String(d.employee.id),
        employeeNumber: Number(d.employee.employeeNumber),
        displayName: String(d.employee.displayName),
      };
      setEmployeeMe(emp);
      const t = emp.displayName.trim().slice(0, 80);
      setStaffName(t);
      if (t) window.localStorage.setItem(STAFF_NAME_LS, t);
    }
    setEmpLoginPin("");
    await refetchEmployeeBootstrap();
  }

  async function submitEmployeeLogout() {
    if (effectiveKey === null || !effectiveKey) return;
    await fetch("/api/staff/employee/logout", {
      method: "POST",
      headers: { "x-staff-key": effectiveKey },
    });
    setEmployeeMe(null);
    await refetchEmployeeBootstrap();
  }

  async function submitCreateEmployee(e: FormEvent) {
    e.preventDefault();
    if (effectiveKey === null || !effectiveKey) return;
    setAdminEmpMsg(null);
    const n = parseInt(newEmpNumber.trim(), 10);
    if (!Number.isFinite(n) || n < 1 || n > 999) {
      setAdminEmpMsg(staffT("errInvalidMesa", lang));
      return;
    }
    setAdminEmpSaving(true);
    try {
      const r = await fetch("/api/admin/employees", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(window.localStorage.getItem("meraki_admin_key")?.trim()
            ? { "x-admin-key": window.localStorage.getItem("meraki_admin_key")!.trim() }
            : {}),
        },
        body: JSON.stringify({
          employeeNumber: n,
          displayName: newEmpName.trim(),
          pin: newEmpPin.trim(),
        }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        setAdminEmpMsg(typeof d.error === "string" ? d.error : staffT("errAdminEmployees", lang));
        return;
      }
      setNewEmpNumber("");
      setNewEmpName("");
      setNewEmpPin("");
      setAdminEmpMsg(staffT("employeeCreatedOk", lang));
      await fetchAdminEmpList();
      await refetchEmployeeBootstrap();
    } finally {
      setAdminEmpSaving(false);
    }
  }

  async function deactivateEmployee(id: string) {
    if (effectiveKey === null || !effectiveKey) return;
    if (
      !window.confirm(
        lang === "en" ? "Deactivate this employee profile?" : "¿Desactivar este perfil de empleado?",
      )
    ) {
      return;
    }
    const r = await fetch(`/api/admin/employees/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...(window.localStorage.getItem("meraki_admin_key")?.trim()
          ? { "x-admin-key": window.localStorage.getItem("meraki_admin_key")!.trim() }
          : {}),
      },
      body: JSON.stringify({ active: false }),
    });
    if (!r.ok) return;
    await fetchAdminEmpList();
    await refetchEmployeeBootstrap();
  }

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

  // Sonido y notificaciones: activados por defecto, sin toggles en UI.

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
                {!profilesEnabled ? <div className="mt-3">{staffNameField}</div> : null}
                {profilesEnabled && employeeMe ? (
                  <div className="mt-3 rounded-xl bg-white/70 p-3 ring-1 ring-[#ead4b2]">
                    <p className="text-sm font-medium text-[#3d291c]">
                      {staffFill(staffT("employeeLoggedAs", lang), {
                        name: employeeMe.displayName,
                        n: String(employeeMe.employeeNumber),
                      })}
                    </p>
                    <button
                      type="button"
                      onClick={() => void submitEmployeeLogout()}
                      className="mt-2 rounded-full border border-[#c4a574] bg-white px-4 py-2 text-sm font-semibold text-[#3d291c] hover:bg-[#fff3da]"
                    >
                      {staffT("employeeLogoutBtn", lang)}
                    </button>
                  </div>
                ) : null}
                {profilesEnabled && !employeeMe ? (
                  <p className="mt-3 text-xs text-[#6b5138]">
                    {staffT("employeeSettingsNeedLogin", lang)}
                  </p>
                ) : null}
                {showEmployeeAdmin ? (
                  <div className="mt-4 border-t border-[#e8cfa5] pt-4">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-[#5c432e]">
                    {staffT("employeeAdminTitle", lang)}
                  </h3>
                  <p className="mt-1 text-xs text-[#6b5138]">{staffT("employeeAdminBody", lang)}</p>
                  <form
                    onSubmit={(e) => void submitCreateEmployee(e)}
                    className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end"
                  >
                    <label className="block text-xs font-medium text-[#5c432e]">
                      {staffT("employeeNumberLabel", lang)}
                      <input
                        type="text"
                        inputMode="numeric"
                        value={newEmpNumber}
                        onChange={(e) => setNewEmpNumber(e.target.value)}
                        placeholder={staffT("employeeNewNumberPh", lang)}
                        className="mt-1 w-24 rounded-xl border border-[#d8bf9a] bg-white px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-[#c2763a]/50"
                      />
                    </label>
                    <label className="block min-w-[10rem] flex-1 text-xs font-medium text-[#5c432e]">
                      {staffT("yourNameLabel", lang)}
                      <input
                        type="text"
                        value={newEmpName}
                        onChange={(e) => setNewEmpName(e.target.value)}
                        placeholder={staffT("employeeNewNamePh", lang)}
                        className="mt-1 w-full max-w-xs rounded-xl border border-[#d8bf9a] bg-white px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-[#c2763a]/50"
                      />
                    </label>
                    <label className="block text-xs font-medium text-[#5c432e]">
                      {staffT("employeePinLabel", lang)}
                      <input
                        type="password"
                        inputMode="numeric"
                        autoComplete="new-password"
                        value={newEmpPin}
                        onChange={(e) => setNewEmpPin(e.target.value)}
                        placeholder={staffT("employeeNewPinPh", lang)}
                        className="mt-1 w-36 rounded-xl border border-[#d8bf9a] bg-white px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-[#c2763a]/50"
                      />
                    </label>
                    <button
                      type="submit"
                      disabled={adminEmpSaving}
                      className="rounded-full bg-[#3d291c] px-4 py-2 text-sm font-semibold text-[#f6ead3] hover:bg-[#2c1f14] disabled:opacity-50"
                    >
                      {staffT("employeeCreateBtn", lang)}
                    </button>
                  </form>
                  {adminEmpMsg ? (
                    <p className="mt-2 text-xs font-medium text-[#2f7a4a]">{adminEmpMsg}</p>
                  ) : null}
                  {settingsOpen && adminEmpList.length > 0 ? (
                    <div className="mt-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-[#5c432e]">
                        {staffT("employeeListTitle", lang)}
                      </p>
                      <ul className="mt-2 space-y-2 text-sm">
                        {adminEmpList.map((emp) => (
                          <li
                            key={emp.id}
                            className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white/80 px-3 py-2 ring-1 ring-[#ead4b2]"
                          >
                            <span className="text-[#3d291c]">
                              <span className="tabular-nums font-semibold">#{emp.employeeNumber}</span>{" "}
                              {emp.displayName}{" "}
                              <span className="text-xs text-[#6b5138]">
                                {emp.active ? staffT("employeeActive", lang) : staffT("employeeInactive", lang)}
                              </span>
                            </span>
                            {emp.active ? (
                              <button
                                type="button"
                                onClick={() => void deactivateEmployee(emp.id)}
                                className="rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-semibold text-red-900 hover:bg-red-100"
                              >
                                {staffT("employeeDeactivateBtn", lang)}
                              </button>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
                ) : null}
              </div>
              {kitchenRoleBlock}
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

      {gateBlocked ? (
        <div className="rounded-2xl border-2 border-amber-300 bg-amber-50/95 p-5 shadow-sm ring-1 ring-amber-200">
          <h2 className="font-serif text-lg font-semibold text-[#2c1f14]">
            {staffT("employeeGateTitle", lang)}
          </h2>
          <p className="mt-2 text-sm text-[#6b5138]">{staffT("employeeGateBody", lang)}</p>
          {employeeBootLoading ? (
            <p className="mt-4 text-sm text-[#5c432e]">{staffT("loading", lang)}</p>
          ) : (
            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
              <label className="block text-xs font-medium text-[#5c432e]">
                {staffT("employeeNumberLabel", lang)}
                <input
                  type="text"
                  inputMode="numeric"
                  value={empLoginNumber}
                  onChange={(e) => setEmpLoginNumber(e.target.value)}
                  className="mt-1 w-full max-w-[10rem] rounded-xl border border-[#d8bf9a] bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#c2763a]/50"
                />
              </label>
              <label className="block text-xs font-medium text-[#5c432e]">
                {staffT("employeePinLabel", lang)}
                <input
                  type="password"
                  inputMode="numeric"
                  value={empLoginPin}
                  onChange={(e) => setEmpLoginPin(e.target.value)}
                  className="mt-1 w-full max-w-[10rem] rounded-xl border border-[#d8bf9a] bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#c2763a]/50"
                />
              </label>
              <button
                type="button"
                onClick={() => void submitEmployeeLogin()}
                className="rounded-full bg-[#3d291c] px-5 py-2.5 text-sm font-semibold text-[#f6ead3] hover:bg-[#2c1f14]"
              >
                {staffT("employeeLoginBtn", lang)}
              </button>
            </div>
          )}
          {empLoginErr ? (
            <p className="mt-3 text-xs font-medium text-red-800">{empLoginErr}</p>
          ) : null}
        </div>
      ) : null}

      {!gateBlocked ? (
        <>
      {showHistory ? (
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
      ) : (
        <div className="rounded-2xl bg-[#fff9ec]/90 p-3 text-sm font-semibold text-[#5c432e] shadow-sm ring-1 ring-[#e2c9a0]">
          {staffT("tabActive", lang)}
        </div>
      )}

      {showHistory && view === "historial" ? (
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
            <button
              type="button"
              onClick={() => void clearEntireOrderHistory()}
              className="rounded-full border border-red-300 bg-red-50 px-4 py-2 text-sm font-semibold text-red-900 hover:bg-red-100"
            >
              {staffT("clearAllHistoryBtn", lang)}
            </button>
          </div>
          </div>
          <p className="text-xs text-[#8a2f2f]">
            {staffT("restoreWarning", lang)}
          </p>
        </div>
      ) : null}

      {showOrders ? (
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
      ) : null}

      {showFloor && hasSavedKey ? (
        <div className="rounded-2xl bg-[#fff9ec]/90 p-4 shadow-sm ring-1 ring-[#e2c9a0]">
          <h3 className="font-serif text-base font-semibold text-[#2c1f14]">
            {staffT("floorBlockTitle", lang)}
          </h3>
          <p className="mt-2 text-xs text-[#6b5138]">{staffT("floorGridHint", lang)}</p>
          <p className="mt-2 text-xs text-[#5c432e]">{staffT("floorHeartbeatNote", lang)}</p>

          {(() => {
            const maxMesa = mesaCount;
            const coveredCount = new Set(staffAssignments.map((a) => a.mesa)).size;
            const coveredInRange = new Set(
              staffAssignments.filter((a) => a.mesa >= 1 && a.mesa <= maxMesa).map((a) => a.mesa),
            ).size;
            const freeInRange = maxMesa - coveredInRange;
            return (
              <p className="mt-2 text-xs text-[#6b5138]">
                <span className="font-semibold text-[#3d291c]">
                  {coveredInRange}
                </span>{" "}
                atendidas ·{" "}
                <span className="font-semibold text-[#3d291c]">{freeInRange}</span> libres
                {coveredCount > coveredInRange
                  ? " · (hay mesas atendidas fuera del rango visible)"
                  : ""}
              </p>
            );
          })()}

          <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-8 md:grid-cols-10">
            {Array.from({ length: mesaCount }, (_, i) => i + 1).map((m) => {
              const rows = staffAssignments
                .filter((a) => a.mesa === m)
                .sort((a, b) => a.staffName.localeCompare(b.staffName));
              const mine = rows.some((r) => isFloorMine(r.staffName));
              const isCovered = rows.length > 0;
              const primaryJoinedAt = rows.length
                ? Math.min(
                    ...rows
                      .map((r) => new Date(r.joinedAt).getTime())
                      .filter((t) => Number.isFinite(t)),
                  )
                : NaN;
              const dur = Number.isFinite(primaryJoinedAt)
                ? formatDurationShort(nowTick - primaryJoinedAt, lang)
                : null;
              const label =
                rows.length === 0
                  ? null
                  : rows.length === 1
                    ? rows[0].staffName
                    : `${rows[0].staffName} +${rows.length - 1}`;
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => openMesaActions(m)}
                  className={`group rounded-xl px-2 py-2 text-left transition ring-1 ${
                    mine
                      ? "bg-[#2f7a4a] text-white ring-[#276642]"
                      : isCovered
                        ? "bg-white text-[#3d291c] ring-[#d8bf9a] hover:bg-[#fff3da]"
                        : "bg-[#fff3da] text-[#3d291c] ring-[#e2c9a0] hover:bg-[#ffe8c4]"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-base font-bold tabular-nums">{m}</span>
                    {mine ? (
                      <span className="text-[10px] font-semibold uppercase tracking-wide opacity-90">
                        yo
                      </span>
                    ) : null}
                  </div>
                  <div
                    className={`mt-1 line-clamp-1 text-[11px] ${
                      mine ? "text-white/90" : "text-[#6b5138]"
                    }`}
                    title={rows.map((r) => r.staffName).join(", ")}
                  >
                    {label ?? "—"}
                    {dur ? ` · ${dur}` : ""}
                  </div>
                </button>
              );
            })}
          </div>

          {mesaActionOpen && mesaActionMesa !== null ? (
            <div
              className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
              role="dialog"
              aria-modal="true"
              onClick={() => setMesaActionOpen(false)}
            >
              <div
                className="w-full max-w-md rounded-2xl bg-[#fff9ec] p-4 shadow-lg ring-1 ring-[#e2c9a0]"
                onClick={(e) => e.stopPropagation()}
              >
                <h3 className="font-serif text-lg font-semibold text-[#2c1f14]">
                  {staffFill(staffT("floorMesaActionsTitle", lang), { n: String(mesaActionMesa) })}
                </h3>
                <p className="mt-1 text-sm text-[#5c432e]">
                  {staffT("floorMesaActionsBody", lang)}
                </p>

                {(() => {
                  const rows = staffAssignments.filter((a) => a.mesa === mesaActionMesa);
                  const mine = rows.some((r) => isFloorMine(r.staffName));
                  const who = rows.length
                    ? rows.map((r) => r.staffName).sort((a, b) => a.localeCompare(b)).join(", ")
                    : (lang === "en" ? "Free" : "Libre");
                  return (
                    <p className="mt-3 text-sm text-[#3d291c]">
                      <span className="font-semibold">{lang === "en" ? "Current:" : "Ahora:"}</span>{" "}
                      {who}
                      {mine ? (lang === "en" ? " (you)" : " (tú)") : ""}
                    </p>
                  );
                })()}

                <div className="mt-4 flex flex-col gap-2">
                  {staffAssignments.some((a) => a.mesa === mesaActionMesa && isFloorMine(a.staffName)) ? (
                    <button
                      type="button"
                      onClick={() => void leaveMesaFromModal(mesaActionMesa)}
                      className="rounded-full border border-[#c4a574] bg-white px-4 py-2 text-sm font-semibold text-[#3d291c] hover:bg-[#fff3da]"
                    >
                      {staffT("floorActionLeave", lang)}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void attendMesaFromModal(mesaActionMesa)}
                      className="rounded-full bg-[#2f7a4a] px-4 py-2 text-sm font-semibold text-white hover:bg-[#276642]"
                    >
                      {staffT("floorActionAttend", lang)}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => openOrderForMesa(mesaActionMesa)}
                    className="rounded-full bg-[#3d291c] px-4 py-2 text-sm font-semibold text-[#f6ead3] hover:bg-[#2c1f14]"
                  >
                    {staffT("floorActionOpenOrder", lang)}
                  </button>
                  <button
                    type="button"
                    onClick={() => setMesaActionOpen(false)}
                    className="rounded-full border border-[#d8bf9a] bg-transparent px-4 py-2 text-sm font-semibold text-[#5c432e] hover:bg-white/60"
                  >
                    {staffT("floorActionClose", lang)}
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          {floorAssignError ? (
            <p className="mt-2 text-xs font-medium text-red-800">{floorAssignError}</p>
          ) : null}
          {staffAssignments.length === 0 ? (
            <p className="mt-3 text-sm text-[#6b5138]">{staffT("floorNobody", lang)}</p>
          ) : null}
        </div>
      ) : null}

      {showOrders && view === "activos" ? (
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
      ) : showOrders ? (
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
      ) : null}

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

      {successHint ? (
        <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-900 ring-1 ring-emerald-200">
          {successHint}
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

      {showHistory && view === "historial" && hasSavedKey ? (
        <div className="rounded-2xl bg-[#fff9ec]/90 p-4 shadow-sm ring-1 ring-[#e2c9a0]">
          <h3 className="font-serif text-base font-semibold text-[#2c1f14]">
            {staffT("dayStaffReportTitle", lang)}
          </h3>
          <p className="mt-2 text-xs text-[#6b5138]">{staffT("dayStaffReportBody", lang)}</p>
          <button
            type="button"
            disabled={staffReportLoading}
            onClick={() => void fetchDayStaffReport()}
            className="mt-3 rounded-full bg-[#2f7a4a] px-4 py-2 text-sm font-semibold text-white hover:bg-[#276642] disabled:opacity-50"
          >
            {staffReportLoading
              ? staffT("dayStaffReportLoading", lang)
              : staffT("dayStaffReportBtn", lang)}
          </button>
          {staffReportRows !== null && !staffReportLoading ? (
            staffReportRows.length === 0 ? (
              <p className="mt-3 text-sm text-[#6b5138]">{staffT("dayStaffReportEmpty", lang)}</p>
            ) : (
              <div className="mt-4 overflow-x-auto rounded-xl ring-1 ring-[#ead4b2]">
                <table className="w-full min-w-[28rem] border-collapse text-left text-sm">
                  <thead className="bg-[#fef6e7] text-xs uppercase tracking-wide text-[#5c432e]">
                    <tr>
                      <th className="px-3 py-2 font-semibold">
                        {staffT("dayStaffReportColPerson", lang)}
                      </th>
                      <th className="px-3 py-2 font-semibold tabular-nums">
                        {staffT("dayStaffReportColDeliveries", lang)}
                      </th>
                      <th className="px-3 py-2 font-semibold">
                        {staffT("dayStaffReportColTables", lang)}
                      </th>
                      <th className="px-3 py-2 font-semibold tabular-nums">
                        {staffT("dayStaffReportColRevenue", lang)}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {staffReportRows.map((row) => (
                      <tr key={row.staffKey} className="border-t border-[#ead4b2] bg-white/90">
                        <td className="px-3 py-2 font-medium text-[#3d291c]">
                          {row.staffKey === "__sin_nombre__"
                            ? staffT("sinNombreStaff", lang)
                            : row.displayName}
                        </td>
                        <td className="px-3 py-2 tabular-nums text-[#3d291c]">{row.deliveries}</td>
                        <td className="px-3 py-2 text-[#5c432e]">{row.tables.join(", ")}</td>
                        <td className="px-3 py-2 tabular-nums font-semibold text-[#2f7a4a]">
                          {row.revenueEuros.toLocaleString(lang === "en" ? "en-GB" : "es-ES", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}{" "}
                          €
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          ) : null}
        </div>
      ) : null}

      {showOrders ? (
        !displayed.length ? (
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
        )
      ) : null}
        </>
      ) : null}
    </div>
  );
}
