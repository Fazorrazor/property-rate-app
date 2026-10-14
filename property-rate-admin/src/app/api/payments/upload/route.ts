import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { requireAdminSession, importPaymentRecordsBatch } from "@/app/actions";

export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdminSession();
    if (!admin) {
      return NextResponse.json(
        { success: false, error: "Unauthorized. Please sign in to access payment upload." },
        { status: 401 }
      );
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const confirm = formData.get("confirm") === "true";
    const adminPassword = (formData.get("adminPassword") as string) || undefined;

    if (!file) {
      return NextResponse.json(
        { success: false, error: "No file provided. Please upload an Excel document." },
        { status: 400 }
      );
    }

    // 1. Strict Excel format validation
    const fileName = file.name.toLowerCase();
    const isExcelExtension = fileName.endsWith(".xlsx") || fileName.endsWith(".xls");
    const validMimeTypes = [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel",
      "application/msexcel",
      "application/x-msexcel",
      "application/x-ms-excel",
      "application/x-excel",
      "application/x-dos_ms_excel",
      "application/xls",
      "application/x-xls",
    ];

    const isExcelMime = file.type ? validMimeTypes.includes(file.type) : true;

    if (!isExcelExtension || !isExcelMime) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid file format. Only Excel spreadsheets (.xlsx, .xls) are accepted.",
        },
        { status: 400 }
      );
    }

    // 2. Read array buffer and parse with XLSX
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });

    if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
      return NextResponse.json(
        { success: false, error: "The Excel workbook does not contain any sheets." },
        { status: 400 }
      );
    }

    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    const rawRows: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" });

    if (!rawRows || rawRows.length < 2) {
      return NextResponse.json(
        {
          success: false,
          error: "The Excel spreadsheet must contain a header row and at least one data row.",
        },
        { status: 400 }
      );
    }

    // 3. Find header indices
    const headerRow = rawRows[0].map((h: any) => String(h || "").toLowerCase().trim());
    const accIdx = headerRow.findIndex(
      (h: string) =>
        h.includes("account") ||
        h.includes("property") ||
        h.includes("acc_no") ||
        h.includes("acc no") ||
        h === "acc"
    );
    const amtIdx = headerRow.findIndex(
      (h: string) =>
        h.includes("amount") ||
        h.includes("paid") ||
        h.includes("amt") ||
        h.includes("net")
    );
    const receiptIdx = headerRow.findIndex(
      (h: string) =>
        h.includes("receipt") ||
        h.includes("gcr") ||
        h.includes("ref") ||
        h.includes("cheque") ||
        h.includes("voucher")
    );
    const nameIdx = headerRow.findIndex(
      (h: string) =>
        h.includes("name") ||
        h.includes("payer") ||
        h.includes("ratepayer") ||
        h.includes("owner")
    );
    const methodIdx = headerRow.findIndex(
      (h: string) =>
        h.includes("method") ||
        h.includes("mode") ||
        h.includes("channel") ||
        h.includes("type")
    );
    const dateIdx = headerRow.findIndex(
      (h: string) =>
        h.includes("date") ||
        h.includes("time") ||
        h.includes("paid_at") ||
        h.includes("timestamp")
    );

    if (accIdx === -1 || amtIdx === -1) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Missing required columns. The Excel sheet must include 'Account Number' and 'Amount'.",
        },
        { status: 400 }
      );
    }

    // 4. Parse rows & build overview
    const validRows: any[] = [];
    let skippedCount = 0;
    let totalAmount = 0;
    const uniqueAccountsSet = new Set<string>();

    for (let i = 1; i < rawRows.length; i++) {
      const row = rawRows[i];
      if (!row || row.length === 0) continue;

      const accNo = String(row[accIdx] || "").trim();
      const rawAmt = row[amtIdx];
      const cleanAmtStr = String(rawAmt ?? "").replace(/[^0-9.]/g, "");
      const cleanAmt = parseFloat(cleanAmtStr);

      if (!accNo || isNaN(cleanAmt) || cleanAmt <= 0) {
        skippedCount++;
        continue;
      }

      const receiptNo = receiptIdx !== -1 ? String(row[receiptIdx] || "").trim() : "";
      const payerName = nameIdx !== -1 ? String(row[nameIdx] || "").trim() : "";
      const method = methodIdx !== -1 ? String(row[methodIdx] || "").trim() || "Excel Batch Import" : "Excel Batch Import";

      let paymentDate = "";
      if (dateIdx !== -1) {
        const rawDate = row[dateIdx];
        if (rawDate instanceof Date) {
          paymentDate = rawDate.toISOString();
        } else if (rawDate) {
          paymentDate = String(rawDate).trim();
        }
      }

      validRows.push({
        accountNumber: accNo,
        amount: cleanAmt,
        receiptNumber: receiptNo,
        payerName: payerName,
        paymentMethod: method,
        paymentDate: paymentDate || new Date().toISOString(),
      });

      uniqueAccountsSet.add(accNo);
      totalAmount += cleanAmt;
    }

    if (validRows.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error:
            "No valid payment records found in Excel spreadsheet. Check that Account Numbers and positive Amounts are specified.",
        },
        { status: 400 }
      );
    }

    // 5. If confirm flag is set, execute the reconciliation
    if (confirm) {
      const result = await importPaymentRecordsBatch(validRows, adminPassword);
      return NextResponse.json({
        success: result.success,
        confirmed: true,
        importedCount: result.importedCount,
        skippedCount: result.skippedCount,
        totalAmount: result.totalAmount,
        error: result.error,
      });
    }

    // 6. Return overview & preview for inspection before user confirmation
    return NextResponse.json({
      success: true,
      preview: true,
      fileName: file.name,
      totalIdentified: validRows.length,
      skippedCount,
      uniqueAccountsCount: uniqueAccountsSet.size,
      totalAmount: Number(totalAmount.toFixed(2)),
      previewRows: validRows.slice(0, 100),
      allRows: validRows,
    });
  } catch (err: any) {
    console.error("[POST /api/payments/upload] Error:", err);
    return NextResponse.json(
      {
        success: false,
        error: err.message || "An error occurred while processing the Excel upload.",
      },
      { status: 500 }
    );
  }
}
