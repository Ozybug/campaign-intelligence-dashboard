import { NextRequest, NextResponse } from 'next/server';
import {
  getSchematicCampaigns,
  createSchematicCampaign,
  updateSchematicCampaign,
  deleteSchematicCampaign,
  SchematicCampaign,
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

// ── GET /api/schematic ────────────────────────────────────────────────────────
export async function GET() {
  const env = checkEnv();
  if (env) return env;

  try {
    const campaigns = await getSchematicCampaigns();
    return NextResponse.json({ campaigns });
  } catch (err: any) {
    console.error('[GET /api/schematic]', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// ── POST /api/schematic  (create) ─────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const env = checkEnv();
  if (env) return env;

  try {
    const campaign: SchematicCampaign = await req.json();
    if (!campaign.id || !campaign.title?.trim() || !campaign.startDate) {
      return NextResponse.json({ error: 'id, title, and startDate are required' }, { status: 400 });
    }
    await createSchematicCampaign(campaign);
    return NextResponse.json({ success: true }, { status: 201 });
  } catch (err: any) {
    console.error('[POST /api/schematic]', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// ── PUT /api/schematic  (update) ──────────────────────────────────────────────
export async function PUT(req: NextRequest) {
  const env = checkEnv();
  if (env) return env;

  try {
    const campaign: SchematicCampaign = await req.json();
    if (!campaign.id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }
    const updated = await updateSchematicCampaign(campaign);
    if (!updated) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[PUT /api/schematic]', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// ── DELETE /api/schematic  (delete) ───────────────────────────────────────────
export async function DELETE(req: NextRequest) {
  const env = checkEnv();
  if (env) return env;

  try {
    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });
    const deleted = await deleteSchematicCampaign(id);
    if (!deleted) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[DELETE /api/schematic]', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
