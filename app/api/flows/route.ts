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

// Normalise a single flow object from MoEngage into the shape FlowsList.tsx expects
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normaliseFlow(f: any) {
    return {
        id: f.id || f._id || f.flow_id || '',
        name: f.name || f.flow_name || f.campaign_name || 'Unnamed Flow',
        status: f.status || f.flow_status || 'Draft',
        trigger: f.trigger || f.trigger_type || f.entry_trigger || '',
        channel: f.channel || f.channels || '',
        enrolledUsers: f.enrolledUsers ?? f.enrolled_users ?? f.total_users ?? 0,
        completedUsers: f.completedUsers ?? f.completed_users ?? f.success_users ?? 0,
        exitedUsers: f.exitedUsers ?? f.exited_users ?? f.exit_users ?? 0,
        conversionRate: f.conversionRate ?? f.conversion_rate ?? 0,
        createdAt: f.createdAt || f.created_at || f.create_time || new Date().toISOString(),
        updatedAt: f.updatedAt || f.updated_at || f.update_time || new Date().toISOString(),
        tags: f.tags || [],
    };
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

        const raw = await res.json();

        // MoEngage may return { data: { flows: [...] } } or { flows: [...] } or a plain array
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const rawFlows: any[] =
            raw?.data?.flows ??
            raw?.flows ??
            (Array.isArray(raw) ? raw : []);

        const flows = rawFlows.map(normaliseFlow);

        // Compute summary totals for the summary cards in FlowsList
        const active = flows.filter((f) => f.status === 'Active').length;
        const paused = flows.filter((f) => f.status === 'Paused').length;
        const draft = flows.filter((f) => f.status === 'Draft').length;
        const totalEnrolled = flows.reduce((sum, f) => sum + (f.enrolledUsers || 0), 0);
        const avgConversionRate =
            flows.length > 0
                ? flows.reduce((sum, f) => sum + (f.conversionRate || 0), 0) / flows.length
                : 0;

        const summary = {
            total: flows.length,
            active,
            paused,
            draft,
            totalEnrolled,
            avgConversionRate: Math.round(avgConversionRate * 10) / 10,
        };

        return NextResponse.json({ flows, summary });
    } catch (err) {
        console.error('[Flows API] Fetch error:', err);
        return NextResponse.json({ error: 'Failed to fetch flows' }, { status: 500 });
    }
}