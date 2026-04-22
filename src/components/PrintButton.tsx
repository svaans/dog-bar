"use client";

export function PrintButton({ label }: { label: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded-full bg-[#3d291c] px-4 py-2 text-sm font-semibold text-[#f6ead3] hover:bg-[#2a1c13]"
    >
      {label}
    </button>
  );
}
