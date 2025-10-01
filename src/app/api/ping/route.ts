import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ ok: true, method: 'GET', timestamp: new Date().toISOString() });
}

export async function POST() {
  return NextResponse.json({ ok: true, method: 'POST', timestamp: new Date().toISOString() });
}
