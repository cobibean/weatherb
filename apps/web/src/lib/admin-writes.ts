import { NextResponse } from 'next/server';

/** Hosted admin is read-only until the panel's write surface has been separately reviewed. */
export function adminWritesEnabled(): boolean {
  return process.env.ADMIN_WRITES_ENABLED === 'true';
}

export function adminReadOnlyResponse(): NextResponse {
  return NextResponse.json({ error: 'Admin panel is read-only' }, { status: 403 });
}
