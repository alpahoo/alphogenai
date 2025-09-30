import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { R2Client } from '@/libs/r2-client';

export async function GET(
  _request: NextRequest,
  { params }: { params: { key: string } }
) {
  try {
    const { key } = params;
    
    if (!key) {
      return NextResponse.json({ error: 'Missing key parameter' }, { status: 400 });
    }

    const r2Client = new R2Client();
    const signedUrl = await r2Client.getSignedUrl(key, 3600);
    
    return NextResponse.redirect(signedUrl);
  } catch (error) {
    console.error('Asset serving error:', error);
    return NextResponse.json({ error: 'Failed to serve asset' }, { status: 500 });
  }
}
