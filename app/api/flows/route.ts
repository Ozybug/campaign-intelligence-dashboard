import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const MOENGAGE_APP_ID = process.env.MOENGAGE_APP_ID || '';
const MOENGAGE_SECRET_KEY = process.env.MOENGAGE_SECRET_KEY || '';
const MOENGAGE_DATA_API_BASE = process.env.MOENGAGE_DATA_API_BASE || 'https://dashboard-03.moengage.com';

function getAuthHeader(): string {
    const credentials = `${MOENGAGE_APP_ID}:${MOENGAGE_SECRET_KEY}`;
    const encoded = Buffer.from(credentials).toString('base64');
    return `Basic ${encoded}`;
}

export async function GET() {
    try {
        if (!MOENGAGE_APP_ID || !MOENGAGE_SECRET_KEY) {
            return NextResponse.json({ error: 'MoEngage credentials not configured' }, { status: 500 });
        }

        const url = `${MOENGAGE_DATA_API_BASE}/v4/flows/all?app_id=${MOENGAGE_APP_ID}`;

        const res = await fetch(url, {
            headers: {
                'Authorization': getAuthHeader(),
                'Content-Type': 'application/json',
            },
            cache: 'no-store',
        });

        if (!res.ok) {
            const errorText = await res.text();
            console.error(`[Flows API] MoEngage error ${res.status}:`, errorText);
            return NextResponse.json(
                { error: `MoEngage API error: ${res.status}`, detail: errorText },
                { status: res.status }
            );
        }

        const data = await res.json();
        return NextResponse.json(data);
    } catch (err) {
        console.error('[Flows API] Fetch error:', err);
        return NextResponse.json({ error: 'Failed to fetch flows' }, { status: 500 });
    }
}