import { NextRequest, NextResponse } from 'next/server';
import {
  getOnsiteCampaigns,
  createOnsiteCampaign,
  updateOnsiteCampaign,
  deleteOnsiteCampaign,
  OnSiteCampaign,
} from '@/lib/sheets';

function checkEnv(): NextResponse | null {
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_KEY || !process.env.GOOGLE_SHEET_ID) {
    return NextResponse.json(
      { error: 'Google Sheets not configured. Set GOOGLE_SERVICE_ACCOUNT_KEY and GOOGLE_SHEET_ID env vars.' },
      { status: 503 },
    );
  }
  return null;
}

// ── GET /api/onsite ───────────────────────────────────────────────────────────
export async function GET() {
  const env = checkEnv();
  if (env) return env;

  try {
    const campaigns = await getOnsiteCampaigns();
    return NextResponse.json({ campaigns });
  } catch (err: any) {
    console.error('[GET /api/onsite]', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// ── POST /api/onsite  (create) ────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const env = checkEnv();
  if (env) return env;

  try {
    const campaign: OnSiteCampaign = await req.json();
    if (!campaign.id || !campaign.title?.trim() || !campaign.startDate) {
      return NextResponse.json({ error: 'id, title, and startDate are required' }, { status: 400 });
    }
    await createOnsiteCampaign(campaign);
    return NextResponse.json({ success: true }, { status: 201 });
  } catch (err: any) {
    console.error('[POST /api/onsite]', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// ── PUT /api/onsite  (update) ─────────────────────────────────────────────────
export async function PUT(req: NextRequest) {
  const env = checkEnv();
  if (env) return env;

  try {
    const campaign: OnSiteCampaign = await req.json();
    if (!campaign.id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }
    const updated = await updateOnsiteCampaign(campaign);
    if (!updated) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[PUT /api/onsite]', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// ── DELETE /api/onsite  (delete) ──────────────────────────────────────────────
export async function DELETE(req: NextRequest) {
  const env = checkEnv();
  if (env) return env;

  try {
    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });
    const deleted = await deleteOnsiteCampaign(id);
    if (!deleted) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[DELETE /api/onsite]', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
