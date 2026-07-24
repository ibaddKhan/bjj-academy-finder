import { google } from "googleapis";
import { db } from "@/lib/db";
import { decrypt } from "@/lib/encrypt";

interface ServiceAccountKey {
  client_email: string;
  private_key: string;
}

async function getAuthClient(teamId: string) {
  const row = await db.teamSettings.findUnique({
    where: { teamId_key: { teamId, key: "googleServiceAccount" } },
  });

  if (!row) {
    throw new Error(
      "Google service account not configured for this team. Please upload a service account JSON key in Settings."
    );
  }

  const serviceAccount = JSON.parse(decrypt(row.value)) as ServiceAccountKey;

  return new google.auth.JWT({
    email: serviceAccount.client_email,
    key: serviceAccount.private_key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
}

export function extractSheetId(url: string): string {
  const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (!match) throw new Error("Invalid Google Sheets URL");
  return match[1];
}

export async function getServiceAccountEmail(teamId: string): Promise<string | null> {
  const row = await db.teamSettings.findUnique({
    where: { teamId_key: { teamId, key: "googleServiceAccount" } },
  });
  if (!row) return null;
  try {
    const sa = JSON.parse(decrypt(row.value)) as ServiceAccountKey;
    return sa.client_email;
  } catch {
    return null;
  }
}

export async function getSheetTabs(teamId: string, sheetId: string) {
  const auth = await getAuthClient(teamId);
  const sheets = google.sheets({ version: "v4", auth });

  const response = await sheets.spreadsheets.get({
    spreadsheetId: sheetId,
    fields: "sheets.properties",
  });

  return (response.data.sheets ?? []).map((s) => ({
    id: String(s.properties?.sheetId),
    title: s.properties?.title ?? "",
  }));
}

export async function getSheetHeaders(
  teamId: string,
  sheetId: string,
  tabName: string
): Promise<string[]> {
  const auth = await getAuthClient(teamId);
  const sheets = google.sheets({ version: "v4", auth });

  const range = `'${tabName}'!1:1`;
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range,
  });

  const values = response.data.values?.[0] ?? [];
  return values.map(String);
}

export async function getUnprocessedRows(
  teamId: string,
  sheetId: string,
  tabName: string,
  filterColIndex: number,
  filterValue: string,
  rowOffset = 0,
  rowLimit = 0
): Promise<{ rowIndex: number; rowData: string[] }[]> {
  const auth = await getAuthClient(teamId);
  const sheets = google.sheets({ version: "v4", auth });

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: `'${tabName}'`,
    valueRenderOption: "UNFORMATTED_VALUE",
  });

  const allRows = response.data.values ?? [];
  const matched: { rowIndex: number; rowData: string[] }[] = [];

  // Skip header row (index 0), process data rows
  for (let i = 1; i < allRows.length; i++) {
    const row = allRows[i].map(String);
    const cellValue = row[filterColIndex] ?? "";
    if (cellValue.toLowerCase() === filterValue.toLowerCase()) {
      matched.push({ rowIndex: i + 1, rowData: row }); // rowIndex is 1-based sheet row
    }
  }

  // Apply offset and limit
  const sliced = rowOffset > 0 ? matched.slice(rowOffset) : matched;
  return rowLimit > 0 ? sliced.slice(0, rowLimit) : sliced;
}

export async function writeRowResult(
  teamId: string,
  sheetId: string,
  tabName: string,
  rowIndex: number,
  updates: { colIndex: number; value: string }[]
) {
  if (updates.length === 0) return;

  const auth = await getAuthClient(teamId);
  const sheets = google.sheets({ version: "v4", auth });

  const data = updates.map(({ colIndex, value }) => {
    const colLetter = columnIndexToLetter(colIndex);
    return {
      range: `'${tabName}'!${colLetter}${rowIndex}`,
      values: [[value]],
    };
  });

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: sheetId,
    requestBody: {
      valueInputOption: "USER_ENTERED",
      data,
    },
  });
}

export async function appendRow(
  teamId: string,
  sheetId: string,
  tabName: string,
  values: string[]
) {
  const auth = await getAuthClient(teamId);
  const sheets = google.sheets({ version: "v4", auth });

  await sheets.spreadsheets.values.append({
    spreadsheetId: sheetId,
    range: `'${tabName}'`,
    valueInputOption: "USER_ENTERED",
    insertDataOption: "INSERT_ROWS",
    requestBody: {
      values: [values],
    },
  });
}

function columnIndexToLetter(index: number): string {
  let result = "";
  let n = index;
  while (n >= 0) {
    result = String.fromCharCode(65 + (n % 26)) + result;
    n = Math.floor(n / 26) - 1;
  }
  return result;
}
