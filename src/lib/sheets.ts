import { google } from "googleapis";
import { db } from "@/lib/db";

async function getAuthClient(userId: string) {
  const account = await db.account.findFirst({
    where: { userId, provider: "google" },
    select: { access_token: true, refresh_token: true, expires_at: true },
  });

  if (!account?.access_token) {
    throw new Error("No Google access token found. Please sign in again.");
  }

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );

  oauth2Client.setCredentials({
    access_token: account.access_token,
    refresh_token: account.refresh_token ?? undefined,
    expiry_date: account.expires_at ? account.expires_at * 1000 : undefined,
  });

  // Auto-refresh and persist new token
  oauth2Client.on("tokens", async (tokens) => {
    if (tokens.access_token) {
      await db.account.update({
        where: { provider_providerAccountId: { provider: "google", providerAccountId: userId } },
        data: {
          access_token: tokens.access_token,
          expires_at: tokens.expiry_date ? Math.floor(tokens.expiry_date / 1000) : undefined,
        },
      });
    }
  });

  return oauth2Client;
}

export function extractSheetId(url: string): string {
  const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (!match) throw new Error("Invalid Google Sheets URL");
  return match[1];
}

export async function getSheetTabs(userId: string, sheetId: string) {
  const auth = await getAuthClient(userId);
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
  userId: string,
  sheetId: string,
  tabName: string
): Promise<string[]> {
  const auth = await getAuthClient(userId);
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
  userId: string,
  sheetId: string,
  tabName: string,
  filterColIndex: number,
  filterValue: string,
  rowOffset = 0,
  rowLimit = 0
): Promise<{ rowIndex: number; rowData: string[] }[]> {
  const auth = await getAuthClient(userId);
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
  userId: string,
  sheetId: string,
  tabName: string,
  rowIndex: number,
  updates: { colIndex: number; value: string }[]
) {
  if (updates.length === 0) return;

  const auth = await getAuthClient(userId);
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

function columnIndexToLetter(index: number): string {
  let result = "";
  let n = index;
  while (n >= 0) {
    result = String.fromCharCode(65 + (n % 26)) + result;
    n = Math.floor(n / 26) - 1;
  }
  return result;
}
