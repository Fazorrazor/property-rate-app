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
      const amountPaid = data.amount / 100; // Convert back to GHS
      const metadata = data.metadata;

      // Ensure idempotency
      const transaction = await prisma.transaction.findUnique({
        where: { reference },
        include: { receipt: true, user: true },
      });

      if (!transaction) {
        return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
      }

      if (transaction.status === 'SUCCESS') {
        // Already processed
        return NextResponse.json({ status: 'Already processed' }, { status: 200 });
      }

      // 1. Update Transaction
      await prisma.transaction.update({
        where: { id: transaction.id },
        data: { status: 'SUCCESS' },
      });

      // 2. Process properties in metadata
      const propertyIds = metadata.propertyIds ? metadata.propertyIds.split(',') : [transaction.propertyId];
      // Calculate net amount strictly for property reconciliation
      const processingFee = metadata.processingFee ? Number(metadata.processingFee) : 0;
      let remainingAmount = amountPaid - processingFee;
      
      const properties = await prisma.property.findMany({
        where: { id: { in: propertyIds } },
        include: { users: true }
      });

      const targetPhone = transaction.paymentPhoneNumber || transaction.user?.phoneNumber;
      let targetUser = null;
      if (targetPhone) {
        targetUser = await prisma.user.upsert({
          where: { phoneNumber: targetPhone },
          update: {},
          create: { phoneNumber: targetPhone, name: 'Guest Payer', isVerified: false, role: 'RATEPAYER' }
        });
      }

      for (const prop of properties) {
        if (remainingAmount <= 0) break;

        let propPaymentAmount = Math.min(remainingAmount, prop.totalAmountDue);
        if (propPaymentAmount <= 0) continue; // Property already fully paid

        remainingAmount -= propPaymentAmount;

        let newArrears = prop.arrears;
        let newCurrentFee = prop.currentFee;
        let newStatus: 'PAID' | 'PARTIALLY_PAID' | 'UNPAID' = 'PAID';

        if (transaction.settlementType === 'ARREARS') {
          let allocateToArrears = Math.min(propPaymentAmount, prop.arrears);
          newArrears = Math.max(0, prop.arrears - allocateToArrears);
          newStatus = newArrears === 0 && newCurrentFee === 0 ? 'PAID' : 'PARTIALLY_PAID';
        } else if (transaction.settlementType === 'CURRENT_FEE') {
          let allocateToCurrent = Math.min(propPaymentAmount, prop.currentFee);
          newCurrentFee = Math.max(0, prop.currentFee - allocateToCurrent);
          newStatus = newArrears === 0 && newCurrentFee === 0 ? 'PAID' : 'PARTIALLY_PAID';
        } else {
          if (propPaymentAmount >= prop.totalAmountDue) {
            newArrears = 0;
            newCurrentFee = 0;
            newStatus = 'PAID';
          } else {
            if (propPaymentAmount <= prop.arrears) {
              newArrears = prop.arrears - propPaymentAmount;
            } else {
              const remainder = propPaymentAmount - prop.arrears;
              newArrears = 0;
              newCurrentFee = Math.max(0, prop.currentFee - remainder);
            }
            newStatus = newArrears + newCurrentFee <= 0 ? 'PAID' : 'PARTIALLY_PAID';
          }
        }

        const newTotalAmountDue = newArrears + newCurrentFee;

        const isLinked = targetUser ? prop.users.some((u: any) => u.id === targetUser.id) : true;
        const shouldLink = targetUser && !isLinked && prop.users.length < 3;

        await prisma.property.update({
          where: { id: prop.id },
          data: {
            arrears: newArrears,
            currentFee: newCurrentFee,
            totalAmountDue: newTotalAmountDue,
            status: newStatus,
            ...(shouldLink && targetUser ? { users: { connect: { id: targetUser.id } } } : {})
          },
        });

        // Generate Receipt for this property
        const uniqueSuffix = Math.floor(1000 + Math.random() * 9000);
        const receiptNumber = `REC-KKMA-${new Date().getFullYear()}-${uniqueSuffix}`;

        await prisma.receipt.create({
          data: {
            userId: transaction.userId,
            propertyId: prop.id,
            amount: propPaymentAmount,
            settlementType: transaction.settlementType,
            paymentMethod: data.channel || 'Paystack',
            status: 'PAID',
            receiptNumber: receiptNumber,
            transactionId: transaction.id,
          },
        });
      }

      // Check for notifications
      const remainingUnpaid = await prisma.property.count({
        where: { users: { some: { id: transaction.userId } }, status: { not: 'PAID' } }
      });
  
      if (remainingUnpaid === 0) {
        try {
          if ((prisma as any).notification) {
            await (prisma as any).notification.updateMany({
              where: {
                userId: transaction.userId,
                type: { in: ['BILLING_ROLLOUT', 'DEMAND_NOTICE'] },
                isRead: false,
              },
              data: { isRead: true },
            });
          }
        } catch (err) {}
      }

      // Send SMS Receipt (Fire and forget to keep webhook fast - Rule 3)
      if (transaction.user && transaction.user.phoneNumber) {
        const smsGateway = new SMSGateway();
        smsGateway.getProvider().sendSMS(
          transaction.user.phoneNumber,
          `Receipt from KKMA: We have successfully received your property rate payment of GHS ${amountPaid}. Thank you!`
        ).catch(smsErr => {
          console.error('Failed to send SMS receipt in background:', smsErr);
        });
      }

    } else if (event.event === 'charge.failed') {
      const data = event.data;
      const reference = data.reference;

      const transaction = await prisma.transaction.findUnique({
        where: { reference },
      });

      if (transaction && transaction.status === 'PENDING') {
        await prisma.transaction.update({
          where: { id: transaction.id },
          data: { status: 'FAILED' },
        });
      }
    }

    return NextResponse.json({ status: 'Webhook processed' }, { status: 200 });
  } catch (error) {
    console.error('Webhook processing error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
