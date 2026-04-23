import { NextResponse } from "next/server";

export function startTimer() {
  return process.hrtime.bigint();
}

export function elapsedTimeNs(startedAt: bigint) {
  return (process.hrtime.bigint() - startedAt).toString();
}

export function timedJson(
  startedAt: bigint,
  payload: Record<string, unknown>,
  init?: ResponseInit,
) {
  return NextResponse.json(
    {
      ...payload,
      time_ns: elapsedTimeNs(startedAt),
    },
    init,
  );
}
