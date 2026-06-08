import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as Print from 'expo-print';

export interface SheetDef {
  name: string;
  columns: Array<{ header: string; key: string; width?: number }>;
  rows: Record<string, string | number>[];
}

export interface SectionDef {
  title?: string;
  columns: string[];
  rows: (string | number)[][];
}

export async function exportToExcel(sheets: SheetDef[], filename: string): Promise<void> {
  // Build a simple CSV multi-sheet export (xlsx in RN is complex; share as CSV instead)
  let content = '';
  for (const sheet of sheets) {
    content += `\n=== ${sheet.name} ===\n`;
    content += sheet.columns.map(c => c.header).join(',') + '\n';
    for (const row of sheet.rows) {
      content += sheet.columns.map(c => String(row[c.key] ?? '')).join(',') + '\n';
    }
  }
  const uri = `${FileSystem.cacheDirectory}${filename}.csv`;
  await FileSystem.writeAsStringAsync(uri, content, { encoding: FileSystem.EncodingType.UTF8 });
  await Sharing.shareAsync(uri, { mimeType: 'text/csv', dialogTitle: 'Export Data' });
}

export async function exportToPDF(sections: SectionDef[], filename: string, title = 'Report', subtitle?: string): Promise<void> {
  const tableRows = (section: SectionDef) =>
    section.rows.map(row =>
      `<tr>${row.map(cell => `<td style="padding:6px 10px;border:1px solid #becabb;font-size:12px">${cell}</td>`).join('')}</tr>`
    ).join('');

  const html = `
    <html>
    <head><style>
      body { font-family: -apple-system, sans-serif; padding: 24px; color: #171d17; }
      h1 { font-size: 24px; margin-bottom: 4px; }
      h2 { font-size: 16px; margin: 20px 0 8px; color: #3f4a3e; }
      p { font-size: 13px; color: #6f7a6d; margin: 0; }
      table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
      th { background: #f0f5eb; padding: 8px 10px; text-align: left; font-size: 12px; border: 1px solid #becabb; }
    </style></head>
    <body>
      <h1>${title}</h1>
      ${subtitle ? `<p>${subtitle}</p>` : ''}
      ${sections.map(section => `
        ${section.title ? `<h2>${section.title}</h2>` : ''}
        <table>
          <thead><tr>${section.columns.map(c => `<th>${c}</th>`).join('')}</tr></thead>
          <tbody>${tableRows(section)}</tbody>
        </table>
      `).join('')}
    </body>
    </html>
  `;

  const { uri } = await Print.printToFileAsync({ html });
  const destUri = `${FileSystem.cacheDirectory}${filename}.pdf`;
  await FileSystem.copyAsync({ from: uri, to: destUri });
  await Sharing.shareAsync(destUri, { mimeType: 'application/pdf', dialogTitle: 'Export Report' });
}
