import { NextResponse } from "next/server";

export function ok(data: unknown) {
  return NextResponse.json(data);
}

export function fail(err: unknown, status = 500) {
  const message = err instanceof Error ? err.message : String(err);
  console.error(message);
  return NextResponse.json({ error: message }, { status });
}
