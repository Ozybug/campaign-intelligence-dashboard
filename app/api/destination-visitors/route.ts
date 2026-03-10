import { NextResponse } from 'next/server';
import { getDestinationVisitors } from '@/lib/metabase';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const start = searchParams.get('start');
    const end   = searchParams.get('end');
    const data = await getDestinationVisitors(start, end);
    return NextResponse.json(data);
  } catch (error) {
    console.error('[API/destination-visitors]', error);
    return NextResponse.json({ error: 'Failed to fetch destination visitors' }, { status: 500 });
  }
}
