import { NextResponse } from "next/server";

export function jsonErrorFromException(e: unknown, status = 500): NextResponse {
  const prod = process.env.NODE_ENV === "production";
  const message = prod
    ? "Ha ocurrido un error. Inténtalo más tarde o avisa al encargado."
    : e instanceof Error
      ? e.message
      : "Error";
  return NextResponse.json({ error: message }, { status });
}
