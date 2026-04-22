import type { Metadata } from "next";
import Link from "next/link";
import QRCode from "qrcode";

import { PrintButton } from "@/components/PrintButton";
import { getMesaCount } from "@/lib/mesa-count";
import { withAlternatesOg } from "@/lib/metadata-bilingual";
import { qrPrintT } from "@/lib/qr-print-i18n";
import { resolvePublicBaseUrl } from "@/lib/public-base-url";
import type { UiLang } from "@/lib/ui-i18n";

type QrSearchParams = { desde?: string; hasta?: string; lang?: string };

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<QrSearchParams>;
}): Promise<Metadata> {
  const sp = await searchParams;
  const lang: UiLang = sp.lang === "en" ? "en" : "es";
  const maxMesa = getMesaCount();
  const desde = Math.max(1, parseInt(sp.desde ?? "1", 10) || 1);
  const hastaRaw = parseInt(sp.hasta ?? String(maxMesa), 10) || maxMesa;
  const hasta = Math.min(maxMesa, Math.max(desde, hastaRaw));
  const qsEs = new URLSearchParams();
  qsEs.set("desde", String(desde));
  qsEs.set("hasta", String(hasta));
  const pathEs = `/impresion-qr?${qsEs.toString()}`;
  const qsEn = new URLSearchParams(qsEs);
  qsEn.set("lang", "en");
  const pathEn = `/impresion-qr?${qsEn.toString()}`;
  return withAlternatesOg(lang, pathEs, pathEn, {
    title: qrPrintT("metaTitle", lang),
    description: qrPrintT("metaDescription", lang),
  });
}

type Props = {
  searchParams: Promise<QrSearchParams>;
};

function mesaOrderUrl(base: string, mesa: number, lang: UiLang) {
  const path = `${base}/mesa/${mesa}`;
  return lang === "en" ? `${path}?lang=en` : path;
}

function rangeQuery(desde: number, hasta: number, lang: UiLang) {
  const qs = new URLSearchParams();
  qs.set("desde", String(desde));
  qs.set("hasta", String(hasta));
  if (lang === "en") qs.set("lang", "en");
  const s = qs.toString();
  return s ? `?${s}` : "";
}

export default async function ImpresionQrPage({ searchParams }: Props) {
  const sp = await searchParams;
  const lang: UiLang = sp.lang === "en" ? "en" : "es";
  const maxMesa = getMesaCount();
  const desde = Math.max(1, parseInt(sp.desde ?? "1", 10) || 1);
  const hastaRaw = parseInt(sp.hasta ?? String(maxMesa), 10) || maxMesa;
  const hasta = Math.min(maxMesa, Math.max(desde, hastaRaw));
  const base = await resolvePublicBaseUrl();
  const mesas = Array.from({ length: hasta - desde + 1 }, (_, i) => desde + i);
  const items = await Promise.all(
    mesas.map(async (mesa) => {
      const url = mesaOrderUrl(base, mesa, lang);
      const src = await QRCode.toDataURL(url, {
        errorCorrectionLevel: "M",
        margin: 1,
        width: 220,
        color: { dark: "#2c1f14", light: "#fff9ec" },
      });
      return { mesa, url, src };
    }),
  );

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: #fff !important; }
          .qr-print-root { padding: 12mm; }
        }
      `}</style>
      <div className="qr-print-root mx-auto max-w-5xl px-4 py-8">
        <div className="no-print mb-8 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-4">
              <Link
                href={lang === "en" ? "/?lang=en" : "/"}
                className="text-sm font-medium text-[#5c432e] underline"
              >
                {qrPrintT("backHome", lang)}
              </Link>
              <div className="flex gap-2 text-xs font-medium text-[#5c432e]">
                <Link
                  href={`/impresion-qr${rangeQuery(desde, hasta, "es")}`}
                  className={lang === "es" ? "font-bold text-[#3d291c]" : "underline decoration-[#c4a574]"}
                >
                  {qrPrintT("langEs", lang)}
                </Link>
                <span className="text-[#b89a6e]">|</span>
                <Link
                  href={`/impresion-qr${rangeQuery(desde, hasta, "en")}`}
                  className={lang === "en" ? "font-bold text-[#3d291c]" : "underline decoration-[#c4a574]"}
                >
                  {qrPrintT("langEn", lang)}
                </Link>
              </div>
            </div>
            <h1 className="mt-2 font-serif text-3xl font-bold text-[#2c1f14]">
              {qrPrintT("title", lang)}
            </h1>
            <p className="mt-2 max-w-xl text-sm text-[#5c432e]">
              {qrPrintT("baseUsed", lang)}{" "}
              <span className="break-all rounded bg-[#f0e2c8] px-1.5 py-0.5 font-mono text-xs">
                {base}
              </span>
              . {qrPrintT("baseHint", lang)}
            </p>
            <p className="mt-2 text-sm text-[#6b5138]">
              {qrPrintT("rangeIntro", lang)}{" "}
              <span className="tabular-nums">{desde}</span>
              {qrPrintT("rangeDash", lang)}
              <span className="tabular-nums">{hasta}</span>. {qrPrintT("rangeHelp", lang)}
            </p>

            <form
              method="get"
              action="/impresion-qr"
              className="mt-4 flex max-w-md flex-col gap-3 rounded-xl bg-[#fff9ec]/90 p-4 ring-1 ring-[#e2c9a0] sm:flex-row sm:flex-wrap sm:items-end"
            >
              {lang === "en" ? <input type="hidden" name="lang" value="en" /> : null}
              <label className="flex flex-col text-xs font-medium text-[#5c432e]">
                {qrPrintT("formFrom", lang)}
                <input
                  name="desde"
                  type="number"
                  min={1}
                  max={99}
                  defaultValue={desde}
                  className="mt-1 w-24 rounded-lg border border-[#d8bf9a] bg-white px-2 py-1.5 text-sm tabular-nums text-[#2c1f14]"
                />
              </label>
              <label className="flex flex-col text-xs font-medium text-[#5c432e]">
                {qrPrintT("formTo", lang)}
                <input
                  name="hasta"
                  type="number"
                  min={1}
                  max={99}
                  defaultValue={hasta}
                  className="mt-1 w-24 rounded-lg border border-[#d8bf9a] bg-white px-2 py-1.5 text-sm tabular-nums text-[#2c1f14]"
                />
              </label>
              <button
                type="submit"
                className="rounded-full bg-[#c2763a] px-4 py-2 text-sm font-semibold text-white hover:bg-[#a86430]"
              >
                {qrPrintT("formSubmit", lang)}
              </button>
            </form>
            <p className="mt-2 max-w-xl text-xs text-[#6b5138]">{qrPrintT("formHint", lang)}</p>
          </div>
          <PrintButton label={qrPrintT("printSheet", lang)} />
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
          {items.map(({ mesa, url, src }) => (
            <div
              key={mesa}
              className="flex flex-col items-center rounded-2xl bg-[#fff9ec] p-3 text-center shadow-sm ring-1 ring-[#e2c9a0] print:shadow-none print:ring-0"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" width={160} height={160} className="h-40 w-40" />
              <p className="mt-2 font-serif text-lg font-bold text-[#2c1f14]">
                {qrPrintT("tableWord", lang)} <span className="tabular-nums">{mesa}</span>
              </p>
              <p className="mt-1 max-w-[12rem] break-all text-[10px] leading-tight text-[#6b5138] print:text-[9px]">
                {url}
              </p>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
