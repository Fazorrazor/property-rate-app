'use server';

import { requireAdminSession } from './actions';
import { adminDb } from '@/lib/adminDb';

export interface ShiftReport {
  adminName: string;
  totalCollected: number;
  transactionCount: number;
  shiftStart: string;
  transactions: {
    receiptNumber: string;
    amount: number;
    time: string;
    accountNumber: string;
    settlementType: string;
  }[];
}

export async function getShiftReport(): Promise<{ success: boolean; data?: ShiftReport; error?: string }> {
  try {
    const admin = await requireAdminSession();

    // Shift window: from 12:00 AM today to now
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const logs = await adminDb.auditLog.findMany({
      where: {
        adminId: admin.id,
        action: 'RECORD_PAYMENT',
        createdAt: {
          gte: startOfDay,
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    let totalCollected = 0;
    const transactions = [];

    for (const log of logs || []) {
      // log.details format: "Recorded cash payment of GH₵ 500 for KKMA-001 (TOTAL settlement, GCR: REC-KKMA-XXXX)"
      const match = log.details.match(/cash payment of GH₵ (\d+(\.\d+)?) for ([\w-]+) \(([\w]+) settlement, GCR: ([\w-]+)\)/);
      let amount = 0;
      let accountNo = 'Unknown';
      let settlement = 'Unknown';
      let gcr = 'Unknown';

      if (match) {
        amount = Number(match[1]);
        accountNo = match[3];
        settlement = match[4];
        gcr = match[5];
      } else {
        // Fallback simple parsing
        const amountMatch = log.details.match(/GH₵ (\d+(\.\d+)?)/);
        if (amountMatch) amount = Number(amountMatch[1]);
        
        const accMatch = log.details.match(/for ([\w-]+) \(/);
        if (accMatch) accountNo = accMatch[1];
      }

      totalCollected += amount;

      transactions.push({
        receiptNumber: gcr,
        amount,
        time: new Date(log.createdAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
        accountNumber: accountNo,
        settlementType: settlement,
      });
    }

    return {
      success: true,
      data: {
        adminName: admin.name || admin.username,
        totalCollected,
        transactionCount: transactions.length,
        shiftStart: startOfDay.toISOString(),
        transactions,
      },
    };
  } catch (err: any) {
    console.error('Error fetching shift report:', err);
    return { success: false, error: 'Failed to fetch shift report' };
  }
}
