import { NextResponse } from "next/server";

export function jsonError(message: string, status = 400, field?: string) {
  return NextResponse.json({ error: message, ...(field ? { field } : {}) }, { status });
}

export function isUniqueError(error: unknown) {
  return error instanceof Error && /unique constraint|constraint_unique|constraint failed/i.test(error.message);
}

export function csvCell(value: unknown) {
  const raw = String(value ?? "");
  const safe = /^[\t\r ]*[=+\-@]/.test(raw) ? `'${raw}` : raw;
  return `"${safe.replace(/"/g, '""')}"`;
}
