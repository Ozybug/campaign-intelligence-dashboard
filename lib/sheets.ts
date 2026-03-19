/**
 * lib/sheets.ts
 * Google Sheets client + typed CRUD helpers for Schematic and On-Site campaigns.
 *
 * Required env vars:
 *   GOOGLE_SERVICE_ACCOUNT_KEY  – full contents of the service-account JSON key file
 *   GOOGLE_SHEET_ID             – the spreadsheet ID from the URL
 *
 * Sheet setup:
 *   Tab "Schematic" – row 1 headers:
 *     id | brand | mode | title | channel | format | startDate | endDate | stage |
 *     blackoutDates | messageTitle | subtitle | messageBody |
 *     recurringInterval | recurringCustomValue | recurringCustomUnit
 *
 *   Tab "OnSite" – row 1 headers:
 *     id | brand | title | osmTarget | osmTargetNames | redirectTarget |
 *     redirectTargetNames | priority | status | startDate | endDate
 */

import { google } from 'googleapis';

// ── Auth ──────────────────────────────────────────────────────────────────────

function getSheetsClient() {
  const key = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!key) throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY env var is not set');

  let credentials: object;
  try { credentials = JSON.parse(key); }
  catch { throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY is not valid JSON'); }

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  return google.sheets({ version: 'v4', auth });
}

function spreadsheetId(): string {
  const id = process.env.GOOGLE_SHEET_ID;
  if (!id) throw new Error('GOOGLE_SHEET_ID env var is not set');
  return id;
}

// ── Generic Sheets helpers ────────────────────────────────────────────────────

/** Convert a 1-based column number to a letter (1→A, 27→AA, etc.) */
function colLetter(n: number): string {
  let result = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    result = String.fromCharCode(65 + rem) + result;
    n = Math.floor((n - 1) / 26);
  }
  return result;
}

/**
 * Read all data rows from a named tab (skips the header in row 1).
 * Returns a string[][] — empty string where cells are blank.
 */
export async function readRows(sheetName: string): Promise<string[][]> {
  const sheets = getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: spreadsheetId(),
    range: `${sheetName}!A:Z`,
  });
  const all = (res.data.values ?? []) as string[][];
  return all.slice(1).filter(r => r.length > 0 && r[0]); // skip header + blank rows
}

/** Append one row to the bottom of a named tab. */
export async function appendRow(
  sheetName: string,
  values: (string | number | null | undefined)[],
): Promise<void> {
  const sheets = getSheetsClient();
  await sheets.spreadsheets.values.append({
    spreadsheetId: spreadsheetId(),
    range: `${sheetName}!A1`,
    valueInputOption: 'RAW',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: [values.map(v => v ?? '')] },
  });
}

/**
 * Find the row whose column-A value equals `id` and overwrite it.
 * Returns false if no matching row is found.
 */
export async function updateRowById(
  sheetName: string,
  id: string,
  values: (string | number | null | undefined)[],
): Promise<boolean> {
  const sheets = getSheetsClient();
  const sid    = spreadsheetId();

  const res  = await sheets.spreadsheets.values.get({ spreadsheetId: sid, range: `${sheetName}!A:A` });
  const colA = (res.data.values ?? []) as string[][];
  // 0-based index within the full array; header is at index 0, data starts at 1
  const rowIndex = colA.findIndex((r, i) => i > 0 && r[0] === id);
  if (rowIndex === -1) return false;

  const sheetRow = rowIndex + 1; // 1-indexed A1 notation
  const endCol   = colLetter(values.length);

  await sheets.spreadsheets.values.update({
    spreadsheetId: sid,
    range: `${sheetName}!A${sheetRow}:${endCol}${sheetRow}`,
    valueInputOption: 'RAW',
    requestBody: { values: [values.map(v => v ?? '')] },
  });
  return true;
}

/**
 * Find the row whose column-A value equals `id` and physically delete it.
 * Returns false if no matching row is found.
 */
export async function deleteRowById(sheetName: string, id: string): Promise<boolean> {
  const sheets = getSheetsClient();
  const sid    = spreadsheetId();

  // 1. Locate the row
  const colARes  = await sheets.spreadsheets.values.get({ spreadsheetId: sid, range: `${sheetName}!A:A` });
  const colA     = (colARes.data.values ?? []) as string[][];
  const rowIndex = colA.findIndex((r, i) => i > 0 && r[0] === id);
  if (rowIndex === -1) return false;

  // 2. Resolve numeric sheetId for the named tab
  const meta    = await sheets.spreadsheets.get({ spreadsheetId: sid });
  const tab     = meta.data.sheets?.find(s => s.properties?.title === sheetName);
  const sheetId = tab?.properties?.sheetId;
  if (sheetId === undefined) throw new Error(`Sheet tab "${sheetName}" not found in spreadsheet`);

  // 3. Delete the row (startIndex is 0-based and inclusive)
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: sid,
    requestBody: {
      requests: [{
        deleteDimension: {
          range: { sheetId, dimension: 'ROWS', startIndex: rowIndex, endIndex: rowIndex + 1 },
        },
      }],
    },
  });
  return true;
}

// ── Schematic typed helpers ───────────────────────────────────────────────────

export type SchChannel  = 'Email' | 'Push' | 'WhatsApp';
export type SchFormat   = 'One Time' | 'Event Triggered' | 'Recurring';
export type RecInterval = 'daily' | 'weekly' | 'monthly' | 'custom';
export type CustomUnit  = 'day' | 'week' | 'month' | 'year';
export type Stage       = 'schematic' | 'live';
export type Brand       = 'Zostel' | 'Zo Trips' | 'Zo Selections';
export type SchMode     = 'Shell' | 'Curated';

export interface SchematicCampaign {
  id: string;
  brand: Brand;
  mode: SchMode;
  title: string;
  channel: SchChannel;
  format: SchFormat;
  startDate: string;
  endDate: string | null;
  stage: Stage;
  blackoutDates?: string[];
  messageTitle?: string;
  subtitle?: string;
  messageBody?: string;
  recurring?: { interval: RecInterval; customValue?: number; customUnit?: CustomUnit };
}

// Column order for the "Schematic" tab (16 cols → A..P)
function schematicToRow(c: SchematicCampaign): string[] {
  return [
    c.id, c.brand, c.mode, c.title, c.channel, c.format,
    c.startDate, c.endDate ?? '', c.stage,
    JSON.stringify(c.blackoutDates ?? []),
    c.messageTitle ?? '', c.subtitle ?? '', c.messageBody ?? '',
    c.recurring?.interval ?? '',
    c.recurring?.customValue !== undefined ? String(c.recurring.customValue) : '',
    c.recurring?.customUnit  ?? '',
  ];
}

function rowToSchematic(row: string[]): SchematicCampaign {
  const [
    id, brand, mode, title, channel, format,
    startDate, endDate, stage,
    blackoutDatesStr,
    messageTitle, subtitle, messageBody,
    recurringInterval, recurringCustomValue, recurringCustomUnit,
  ] = row;
  return {
    id, title, startDate,
    brand:   (brand   || 'Zostel')    as Brand,
    mode:    (mode    || 'Curated')   as SchMode,
    channel: (channel || 'Email')     as SchChannel,
    format:  (format  || 'One Time')  as SchFormat,
    stage:   (stage   || 'schematic') as Stage,
    endDate: endDate || null,
    ...(blackoutDatesStr ? { blackoutDates: JSON.parse(blackoutDatesStr) } : {}),
    ...(messageTitle ? { messageTitle } : {}),
    ...(subtitle     ? { subtitle }     : {}),
    ...(messageBody  ? { messageBody }  : {}),
    ...(recurringInterval ? {
      recurring: {
        interval: recurringInterval as RecInterval,
        ...(recurringCustomValue ? { customValue: Number(recurringCustomValue) } : {}),
        ...(recurringCustomUnit  ? { customUnit:  recurringCustomUnit as CustomUnit } : {}),
      },
    } : {}),
  };
}

export async function getSchematicCampaigns(): Promise<SchematicCampaign[]> {
  return (await readRows('Schematic')).map(rowToSchematic);
}

export async function createSchematicCampaign(c: SchematicCampaign): Promise<void> {
  await appendRow('Schematic', schematicToRow(c));
}

export async function updateSchematicCampaign(c: SchematicCampaign): Promise<boolean> {
  return updateRowById('Schematic', c.id, schematicToRow(c));
}

export async function deleteSchematicCampaign(id: string): Promise<boolean> {
  return deleteRowById('Schematic', id);
}

// ── OnSite typed helpers ──────────────────────────────────────────────────────

export type OsmTarget      = 'Destination' | 'Property' | 'Homepage';
export type RedirectTarget = 'Destination' | 'Property' | 'Homepage' | 'Trip Name' | 'Experience Name';
export type OsmStatus      = 'Ideation' | 'Scheduled' | 'Live' | 'Canned';
export type OsmPriority    = 'Critical' | 'High' | 'Medium' | 'Normal' | 'Low';

export interface OnSiteCampaign {
  id: string;
  brand: Brand;
  title: string;
  osmTarget: OsmTarget;
  osmTargetNames: string[];
  redirectTarget: RedirectTarget;
  redirectTargetNames: string[];
  priority: OsmPriority;
  status: OsmStatus;
  startDate: string;
  endDate: string | null;
}

// Column order for the "OnSite" tab (11 cols → A..K)
function onsiteToRow(c: OnSiteCampaign): string[] {
  return [
    c.id, c.brand, c.title,
    c.osmTarget, JSON.stringify(c.osmTargetNames ?? []),
    c.redirectTarget, JSON.stringify(c.redirectTargetNames ?? []),
    c.priority, c.status,
    c.startDate, c.endDate ?? '',
  ];
}

function rowToOnsite(row: string[]): OnSiteCampaign {
  const [
    id, brand, title,
    osmTarget, osmTargetNamesStr,
    redirectTarget, redirectTargetNamesStr,
    priority, status,
    startDate, endDate,
  ] = row;
  return {
    id, title, startDate,
    brand:               (brand          || 'Zostel')      as Brand,
    osmTarget:           (osmTarget      || 'Destination') as OsmTarget,
    redirectTarget:      (redirectTarget || 'Homepage')    as RedirectTarget,
    priority:            (priority       || 'Normal')      as OsmPriority,
    status:              (status         || 'Ideation')    as OsmStatus,
    osmTargetNames:      osmTargetNamesStr      ? JSON.parse(osmTargetNamesStr)      : [],
    redirectTargetNames: redirectTargetNamesStr ? JSON.parse(redirectTargetNamesStr) : [],
    endDate: endDate || null,
  };
}

export async function getOnsiteCampaigns(): Promise<OnSiteCampaign[]> {
  return (await readRows('OnSite')).map(rowToOnsite);
}

export async function createOnsiteCampaign(c: OnSiteCampaign): Promise<void> {
  await appendRow('OnSite', onsiteToRow(c));
}

export async function updateOnsiteCampaign(c: OnSiteCampaign): Promise<boolean> {
  return updateRowById('OnSite', c.id, onsiteToRow(c));
}

export async function deleteOnsiteCampaign(id: string): Promise<boolean> {
  return deleteRowById('OnSite', id);
}
