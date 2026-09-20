import { NextResponse } from 'next/server';

/** Retired entry points cannot start jobs, write data, or send reports. */
export function deferredResponse(): NextResponse {
  return NextResponse.json(
    { error: 'This feature is unavailable during the Arc restart.' },
    { status: 410 },
  );
}
