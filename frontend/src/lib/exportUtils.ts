import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export interface ExportColumn {
  header: string;
  key: string;
  width?: number;
}

export function exportToExcel(
  sheets: { name: string; columns: ExportColumn[]; rows: Record<string, any>[] }[],
  filename: string
) {
  const wb = XLSX.utils.book_new();

  for (const sheet of sheets) {
    const data = [
      sheet.columns.map(c => c.header),
      ...sheet.rows.map(row => sheet.columns.map(c => row[c.key] ?? "")),
    ];
    const ws = XLSX.utils.aoa_to_sheet(data);

    // Column widths
    ws["!cols"] = sheet.columns.map(c => ({ wch: c.width ?? 18 }));

    // Header row style (bold)
    const range = XLSX.utils.decode_range(ws["!ref"] || "A1");
    for (let col = range.s.c; col <= range.e.c; col++) {
      const cellRef = XLSX.utils.encode_cell({ r: 0, c: col });
      if (ws[cellRef]) {
        ws[cellRef].s = { font: { bold: true }, fill: { fgColor: { rgb: "E2F5EE" } } };
      }
    }

    XLSX.utils.book_append_sheet(wb, ws, sheet.name);
  }

  XLSX.writeFile(wb, `${filename}.xlsx`);
}

export function exportToPDF(
  sections: {
    title?: string;
    columns: string[];
    rows: (string | number)[][];
  }[],
  filename: string,
  reportTitle: string,
  subtitle?: string
) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  // Title
  doc.setFontSize(18);
  doc.setTextColor(15, 118, 110); // emerald-700
  doc.text(reportTitle, 14, 18);

  if (subtitle) {
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139); // slate-500
    doc.text(subtitle, 14, 25);
  }

  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184); // slate-400
  doc.text(`Generated ${new Date().toLocaleDateString("en-AE", { dateStyle: "long" })}`, 14, subtitle ? 30 : 25);

  let y = subtitle ? 36 : 32;

  for (const section of sections) {
    if (section.title) {
      doc.setFontSize(11);
      doc.setTextColor(15, 23, 42); // slate-900
      doc.text(section.title, 14, y);
      y += 4;
    }

    autoTable(doc, {
      startY: y,
      head: [section.columns],
      body: section.rows,
      theme: "grid",
      headStyles: {
        fillColor: [16, 185, 129], // emerald-500
        textColor: 255,
        fontStyle: "bold",
        fontSize: 9,
      },
      bodyStyles: { fontSize: 8, textColor: [30, 41, 59] },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      margin: { left: 14, right: 14 },
    });

    y = (doc as any).lastAutoTable.finalY + 8;
  }

  doc.save(`${filename}.pdf`);
}

export function exportReportPDF(report: any, label: string) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  // Header
  doc.setFontSize(20);
  doc.setTextColor(15, 118, 110);
  doc.text("Expense Report", 14, 18);

  doc.setFontSize(11);
  doc.setTextColor(51, 65, 85);
  doc.text(label, 14, 26);

  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text(`Generated ${new Date().toLocaleDateString("en-AE", { dateStyle: "long" })}`, 14, 31);

  // Summary block
  const s = report.summary;
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text("Summary", 14, 40);

  autoTable(doc, {
    startY: 43,
    head: [["Metric", "Amount (AED)"]],
    body: [
      ["Total Spent", Number(s.total_debits).toFixed(2)],
      ["Total Income", Number(s.total_credits).toFixed(2)],
      ["Net", Number(s.net).toFixed(2)],
      ["Transactions", String(s.transaction_count)],
      ...(s.opening_balance != null ? [["Opening Balance", Number(s.opening_balance).toFixed(2)]] : []),
      ...(s.closing_balance != null ? [["Closing Balance", Number(s.closing_balance).toFixed(2)]] : []),
    ],
    theme: "grid",
    headStyles: { fillColor: [16, 185, 129], textColor: 255, fontStyle: "bold", fontSize: 9 },
    bodyStyles: { fontSize: 9, textColor: [30, 41, 59] },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: { left: 14, right: 14 },
    tableWidth: 90,
  });

  let y = (doc as any).lastAutoTable.finalY + 10;

  // Category breakdown
  if (report.category_breakdown?.length > 0) {
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text("Spending by Category", 14, y);
    y += 3;

    autoTable(doc, {
      startY: y,
      head: [["Category", "Amount (AED)", "% of Spend", "Transactions"]],
      body: report.category_breakdown.map((c: any) => [
        c.category_name,
        Number(c.total).toFixed(2),
        `${c.percentage?.toFixed(1)}%`,
        String(c.transaction_count),
      ]),
      theme: "grid",
      headStyles: { fillColor: [16, 185, 129], textColor: 255, fontStyle: "bold", fontSize: 9 },
      bodyStyles: { fontSize: 8, textColor: [30, 41, 59] },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      margin: { left: 14, right: 14 },
    });
    y = (doc as any).lastAutoTable.finalY + 10;
  }

  // Monthly overview
  if (report.monthly_overview?.length > 0) {
    if (y > 220) { doc.addPage(); y = 18; }
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text("Monthly Overview", 14, y);
    y += 3;

    autoTable(doc, {
      startY: y,
      head: [["Month", "Income (AED)", "Expenses (AED)", "Net (AED)", "Txns"]],
      body: report.monthly_overview.map((m: any) => [
        m.month_label,
        Number(m.total_credits).toFixed(2),
        Number(m.total_debits).toFixed(2),
        Number(m.net).toFixed(2),
        String(m.transaction_count),
      ]),
      theme: "grid",
      headStyles: { fillColor: [16, 185, 129], textColor: 255, fontStyle: "bold", fontSize: 9 },
      bodyStyles: { fontSize: 8, textColor: [30, 41, 59] },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      margin: { left: 14, right: 14 },
    });
    y = (doc as any).lastAutoTable.finalY + 10;
  }

  // Frequent places
  if (report.frequent_places?.length > 0) {
    if (y > 220) { doc.addPage(); y = 18; }
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text("Frequent Places", 14, y);
    y += 3;

    autoTable(doc, {
      startY: y,
      head: [["Merchant", "Visits", "Avg Spend (AED)", "Total (AED)"]],
      body: report.frequent_places.map((p: any) => [
        p.merchant_name,
        String(p.visit_count),
        Number(p.avg_spend).toFixed(2),
        Number(p.total_spent).toFixed(2),
      ]),
      theme: "grid",
      headStyles: { fillColor: [16, 185, 129], textColor: 255, fontStyle: "bold", fontSize: 9 },
      bodyStyles: { fontSize: 8, textColor: [30, 41, 59] },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      margin: { left: 14, right: 14 },
    });
  }

  doc.save(`expense_report_${label.replace(/\s/g, "_")}.pdf`);
}

export function exportReportExcel(report: any, label: string) {
  const sheets = [];
  const s = report.summary;

  // Summary sheet
  sheets.push({
    name: "Summary",
    columns: [
      { header: "Metric", key: "metric", width: 24 },
      { header: "Value (AED)", key: "value", width: 18 },
    ],
    rows: [
      { metric: "Period", value: label },
      { metric: "Total Spent", value: Number(s.total_debits).toFixed(2) },
      { metric: "Total Income", value: Number(s.total_credits).toFixed(2) },
      { metric: "Net", value: Number(s.net).toFixed(2) },
      { metric: "Transactions", value: String(s.transaction_count) },
      ...(s.opening_balance != null ? [{ metric: "Opening Balance", value: Number(s.opening_balance).toFixed(2) }] : []),
      ...(s.closing_balance != null ? [{ metric: "Closing Balance", value: Number(s.closing_balance).toFixed(2) }] : []),
      ...(s.biggest_expense ? [{ metric: "Biggest Expense", value: `${s.biggest_expense.description} — AED ${Number(s.biggest_expense.amount).toFixed(2)}` }] : []),
    ],
  });

  // By Category
  if (report.category_breakdown?.length > 0) {
    sheets.push({
      name: "By Category",
      columns: [
        { header: "Category", key: "category_name", width: 24 },
        { header: "Total (AED)", key: "total", width: 16 },
        { header: "% of Spend", key: "percentage", width: 14 },
        { header: "Transactions", key: "transaction_count", width: 14 },
      ],
      rows: report.category_breakdown.map((c: any) => ({
        category_name: c.category_name,
        total: Number(c.total).toFixed(2),
        percentage: `${c.percentage?.toFixed(1)}%`,
        transaction_count: c.transaction_count,
      })),
    });
  }

  // Monthly
  if (report.monthly_overview?.length > 0) {
    sheets.push({
      name: "Monthly",
      columns: [
        { header: "Month", key: "month_label", width: 16 },
        { header: "Income (AED)", key: "total_credits", width: 16 },
        { header: "Expenses (AED)", key: "total_debits", width: 16 },
        { header: "Net (AED)", key: "net", width: 14 },
        { header: "Transactions", key: "transaction_count", width: 14 },
      ],
      rows: report.monthly_overview.map((m: any) => ({
        month_label: m.month_label,
        total_credits: Number(m.total_credits).toFixed(2),
        total_debits: Number(m.total_debits).toFixed(2),
        net: Number(m.net).toFixed(2),
        transaction_count: m.transaction_count,
      })),
    });
  }

  // Frequent Places
  if (report.frequent_places?.length > 0) {
    sheets.push({
      name: "Frequent Places",
      columns: [
        { header: "Merchant", key: "merchant_name", width: 28 },
        { header: "Visits", key: "visit_count", width: 10 },
        { header: "Avg Spend (AED)", key: "avg_spend", width: 18 },
        { header: "Total Spent (AED)", key: "total_spent", width: 18 },
      ],
      rows: report.frequent_places.map((p: any) => ({
        merchant_name: p.merchant_name,
        visit_count: p.visit_count,
        avg_spend: Number(p.avg_spend).toFixed(2),
        total_spent: Number(p.total_spent).toFixed(2),
      })),
    });
  }

  exportToExcel(sheets, `expense_report_${label.replace(/\s/g, "_")}`);
}
