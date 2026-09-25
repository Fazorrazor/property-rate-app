import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/db';
import { SMSGateway } from '@/lib/sms/gateway';

export async function POST(req: Request) {
  try {
    const secret = process.env.PAYSTACK_SECRET_KEY || '';
    const bodyText = await req.text();
    const signature = req.headers.get('x-paystack-signature');

    if (!signature) {
      return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
    }

    // Verify event signature
    const hash = crypto.createHmac('sha512', secret).update(bodyText).digest('hex');
    if (hash !== signature) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }

    const event = JSON.parse(bodyText);

    if (event.event === 'charge.success') {
      const data = event.data;
      const reference = data.reference;
      const amountPaid = data.amount / 100; // Convert from kobo to GHS
      // Guard: metadata may be null if Paystack sends no custom metadata
      const metadata = data.metadata || {};

      // Ensure idempotency — find existing transaction
      const transaction = await prisma.transaction.findUnique({
        where: { reference },
        include: { receipt: true, user: true },
      });

      if (!transaction) {
        // Not our transaction — return 200 so Paystack doesn't retry
        console.warn(`[Webhook] Transaction not found for reference: ${reference}`);
        return NextResponse.json({ status: 'Transaction not found' }, { status: 200 });
      }

      if (transaction.status === 'SUCCESS') {
        // Idempotency: already processed
        return NextResponse.json({ status: 'Already processed' }, { status: 200 });
      }

      // 1. Mark transaction as SUCCESS immediately (prevents double-processing on retry)
      await prisma.transaction.update({
        where: { id: transaction.id },
        data: { status: 'SUCCESS' },
      });

      // 2. Resolve property IDs from metadata, fallback to transaction.propertyId
      const rawPropertyIds: string = metadata.propertyIds || '';
      const propertyIds: string[] = rawPropertyIds
        ? rawPropertyIds.split(',').map((s: string) => s.trim()).filter(Boolean)
        : [transaction.propertyId];

      // Net amount after deducting processing fee passed in metadata
      const processingFee = metadata.processingFee ? Number(metadata.processingFee) : 0;
      let remainingAmount = amountPaid - processingFee;

      const properties = await prisma.property.findMany({
        where: { id: { in: propertyIds } },
        include: { users: true },
      });

      if (properties.length === 0) {
        console.error(`[Webhook] No properties found for IDs: ${propertyIds.join(', ')}`);
        // Still return 200 — transaction is marked SUCCESS, don't let Paystack retry endlessly
        return NextResponse.json({ status: 'Processed (no properties matched)' }, { status: 200 });
      }

      // 3. Resolve the paying user's phone — prefer paymentPhoneNumber on transaction
      const targetPhone = transaction.paymentPhoneNumber || transaction.user?.phoneNumber;
      let targetUser = transaction.user;
      if (targetPhone && !targetUser) {
        targetUser = await prisma.user.upsert({
          where: { phoneNumber: targetPhone },
          update: {},
          create: { phoneNumber: targetPhone, name: 'Guest Payer', isVerified: false, role: 'RATEPAYER' },
        });
      }

      const createdReceiptNumbers: string[] = [];

      for (const prop of properties) {
        if (remainingAmount <= 0) break;

        const propPaymentAmount = Math.min(remainingAmount, prop.totalAmountDue);
        if (propPaymentAmount <= 0) continue; // Already fully paid

        remainingAmount -= propPaymentAmount;

        let newArrears = prop.arrears;
        let newCurrentFee = prop.currentFee;
        let newStatus: 'PAID' | 'PARTIALLY_PAID' | 'UNPAID' = 'PAID';

        if (transaction.settlementType === 'ARREARS') {
          const allocateToArrears = Math.min(propPaymentAmount, prop.arrears);
          newArrears = Math.max(0, prop.arrears - allocateToArrears);
          newStatus = newArrears === 0 && newCurrentFee === 0 ? 'PAID' : 'PARTIALLY_PAID';
        } else if (transaction.settlementType === 'CURRENT_FEE') {
          const allocateToCurrent = Math.min(propPaymentAmount, prop.currentFee);
          newCurrentFee = Math.max(0, prop.currentFee - allocateToCurrent);
          newStatus = newArrears === 0 && newCurrentFee === 0 ? 'PAID' : 'PARTIALLY_PAID';
        } else {
          // TOTAL or PARTIAL — clear arrears first, then current fee
          if (propPaymentAmount >= prop.totalAmountDue) {
            newArrears = 0;
            newCurrentFee = 0;
          } else {
            const afterArrears = propPaymentAmount - prop.arrears;
            newArrears = afterArrears < 0 ? Math.abs(afterArrears) : 0;
            newCurrentFee = afterArrears >= 0 ? Math.max(0, prop.currentFee - afterArrears) : prop.currentFee;
          }
          newStatus = newArrears + newCurrentFee <= 0 ? 'PAID' : 'PARTIALLY_PAID';
        }

        const newTotalAmountDue = newArrears + newCurrentFee;

        // Link property to the paying user if not already linked and slots available
        const isLinked = targetUser ? prop.users.some((u: any) => u.id === targetUser!.id) : true;
        const shouldLink = targetUser && !isLinked && prop.users.length < 3;

        await prisma.property.update({
          where: { id: prop.id },
          data: {
            arrears: newArrears,
            currentFee: newCurrentFee,
            totalAmountDue: newTotalAmountDue,
            status: newStatus,
            ...(shouldLink && targetUser ? { users: { connect: { id: targetUser.id } } } : {}),
          },
        });

        // 4. Claim next available GCR receipt number from municipal Value Book stock pool
        const gcrRecord = await prisma.tGCRNr.findFirst({
          where: { isUsed: false, isDamaged: false },
          orderBy: { gcrNo: 'asc' },
        });

        const uniqueSuffix = Math.floor(1000 + Math.random() * 9000);
        const receiptNumber: string = gcrRecord?.gcrNo || `GCR-KKMA-${new Date().getFullYear()}-${uniqueSuffix}`;
        createdReceiptNumbers.push(receiptNumber);

        if (gcrRecord) {
          await prisma.tGCRNr.update({
            where: { id: gcrRecord.id },
            data: { isUsed: true, allocatedAt: new Date() },
          });
        }

        // 5. Create official FeePayment record stamped with APP_PAYMENT
        await prisma.feePayment.create({
          data: {
            accountNo: prop.accountNumber,
            arrearsPd: prop.arrears - newArrears,
            curAmtPd: prop.currentFee - newCurrentFee,
            amtPaid: propPaymentAmount,
            pmtMode: 'Online App (Paystack)',
            gcrNr: receiptNumber,
            collectorsCollectorId: 'APP_PAYMENT',
            cashiersCashierId: 'APP_PAYMENT',
            userId: transaction.userId,
            propertyId: prop.id,
            transactionId: transaction.id,
          },
        });

        // 6. Create digital Receipt record
        await prisma.receipt.create({
          data: {
            userId: transaction.userId,
            propertyId: prop.id,
            amount: propPaymentAmount,
            settlementType: transaction.settlementType,
            paymentMethod: data.channel || 'Paystack MoMo',
            status: 'paid',
            collectorName: 'APP_PAYMENT',
            cashierName: 'APP_PAYMENT',
            isPhysicalIssued: false,
            receiptNumber: receiptNumber,
            transactionId: transaction.id,
          },
        });
      }

      // 7. Mark billing/demand notifications as read if all properties now paid
      try {
        const remainingUnpaid = await prisma.property.count({
          where: { users: { some: { id: transaction.userId } }, status: { not: 'PAID' } },
        });

        if (remainingUnpaid === 0) {
          await prisma.notification.updateMany({
            where: {
              userId: transaction.userId,
              type: { in: ['BILLING_ROLLOUT', 'DEMAND_NOTICE'] },
              isRead: false,
            },
            data: { isRead: true },
          });
        }
      } catch (notifErr) {
        // Non-critical — don't fail the webhook over notification update errors
        console.warn('[Webhook] Notification update skipped:', notifErr);
      }

      // 8. Send SMS confirmation to payer
      const smsPhone = transaction.user?.phoneNumber || targetPhone;
      if (smsPhone) {
        const host = (process.env.NEXT_PUBLIC_APP_URL || 'https://property-rate-app.vercel.app').replace(/\/$/, '');
        const primaryReceipt = createdReceiptNumbers[0] || `GCR-KKMA-${new Date().getFullYear()}-${transaction.reference.substring(0, 4).toUpperCase()}`;
        const dashboardUrl = `${host}/dashboard`;

        const smsGateway = new SMSGateway();
        smsGateway.getProvider().sendSMS(
          smsPhone,
          `KKMA Rate Payment Confirmed\nGH\u20b5 ${amountPaid.toFixed(2)} received.\n\nGCR Receipt #${primaryReceipt} issued.\n\nView your updated bill:\n${dashboardUrl}\n\nKeep this SMS as proof of payment.`
        ).catch((smsErr: any) => {
          console.error('[Webhook] SMS dispatch failed:', smsErr);
        });
      }

      console.log(`[Webhook] charge.success processed — ref: ${reference}, receipts: ${createdReceiptNumbers.join(', ')}`);

    } else if (event.event === 'charge.failed') {
      const data = event.data;
      const reference = data.reference;

      const transaction = await prisma.transaction.findUnique({ where: { reference } });

      if (transaction && transaction.status === 'PENDING') {
        await prisma.transaction.update({
          where: { id: transaction.id },
          data: { status: 'FAILED' },
        });
      }
    }

    return NextResponse.json({ status: 'Webhook processed' }, { status: 200 });
  } catch (error) {
    console.error('[Webhook] Unhandled error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
