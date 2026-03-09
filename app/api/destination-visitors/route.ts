import { NextResponse } from 'next/server';
import { getDestinationVisitors } from '@/lib/metabase';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const data = await getDestinationVisitors();
    return NextResponse.json(data);
  } catch (error) {
    console.error('[API/destination-visitors]', error);
    return NextResponse.json({ error: 'Failed to fetch destination visitors' }, { status: 500 });
  }
}
