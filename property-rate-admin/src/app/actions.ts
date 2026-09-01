'use server';

import { prisma } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';

export interface AdminPropertyReceipt {
  id: string;
  receiptNumber: string;
  amount: number;
  amountFormatted: string;
  settlementType: string;
  paymentMethod: string;
  status: string;
  datePaid: string;
}

export interface AdminProperty {
  id: string;
  accountNumber: string;
  municipality: string;
  ownerPhone: string;
  ownerName: string;
  ownerDigitalAddress: string;
  propertyClassification: string;
  billYear: number;
  billDateFormatted: string;
  settlementDeadlineFormatted: string;
  rateableValue: number;
  rateableValueFormatted: string;
  rateImposed: number;
  previousYearBill: number;
  previousYearBillFormatted: string;
  amountPaidLastYear: number;
  amountPaidLastYearFormatted: string;
  arrears: number;
  arrearsFormatted: string;
  currentFee: number;
  currentFeeFormatted: string;
  totalAmountDue: number;
  totalAmountDueFormatted: string;
  status: 'PAID' | 'PARTIALLY_PAID' | 'UNPAID';
  isDefaulter: boolean;
  receipts: AdminPropertyReceipt[];
}

export interface AdminDashboardData {
  metrics: {
    totalProperties: number;
    totalBilledFormatted: string;
    totalCollectedFormatted: string;
    totalArrearsFormatted: string;
    defaultersCount: number;
    collectionRateFormatted: string;
    collectionRatePercent: number;
  };
  properties: AdminProperty[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export async function verifyAdminSession() {
  const cookieStore = await cookies();
  const session = cookieStore.get('admin_session');
  if (!session?.value) {
    throw new Error('Unauthorized');
  }
  
  const admin = await prisma.user.findUnique({
    where: { id: session.value }
  });

  if (!admin || (admin.role !== 'ADMIN' && admin.role !== 'SUPER_ADMIN')) {
    cookieStore.delete('admin_session');
    throw new Error('Unauthorized');
  }

  return admin;
}

export async function adminLogin(phoneNumber: string, passwordHash: string) {
  try {
    let admin = await prisma.user.findUnique({
      where: { phoneNumber }
    });

    // Auto-seed demo admin for testing purposes
    if (!admin && phoneNumber === '0000000000' && passwordHash === 'admin123') {
      admin = await prisma.user.create({
        data: {
          phoneNumber: '0000000000',
          name: 'Demo Admin',
          role: 'ADMIN',
          passwordHash: 'admin123',
          isVerified: true
        }
      });
    }

    if (!admin || admin.passwordHash !== passwordHash || (admin.role !== 'ADMIN' && admin.role !== 'SUPER_ADMIN')) {
      return { success: false, error: 'Invalid credentials or unauthorized role.' };
    }

    const cookieStore = await cookies();
    cookieStore.set('admin_session', admin.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24, // 1 day
      path: '/'
    });

    return { success: true };
  } catch (error) {
    console.error('Login error:', error);
    return { success: false, error: 'Authentication failed.' };
  }
}

export async function adminLogout() {
  const cookieStore = await cookies();
  cookieStore.delete('admin_session');
  revalidatePath('/');
}

export async function getAdminOverview(page = 1, limit = 50, municipality = "ALL"): Promise<AdminDashboardData | null> {
  try {
    await verifyAdminSession();

    const skip = (page - 1) * limit;

    const whereClause = municipality !== "ALL" ? { municipality } : {};

    const [
      totalProps,
      defaultersCount,
      propertyAgg,
      receiptsAgg,
      properties
    ] = await prisma.$transaction([
      prisma.property.count({ where: whereClause }),
      prisma.property.count({
        where: { ...whereClause, status: { not: 'PAID' }, arrears: { gt: 0 } }
      }),
      prisma.property.aggregate({
        where: whereClause,
        _sum: { arrears: true, totalAmountDue: true }
      }),
      prisma.receipt.aggregate({
        where: { property: whereClause },
        _sum: { amount: true }
      }),
      prisma.property.findMany({
        skip,
        take: limit,
        where: whereClause,
        include: {
          users: true,
          receipts: {
            orderBy: { datePaid: 'desc' },
          },
        },
        orderBy: { accountNumber: 'asc' },
      })
    ]);

    const totalArrears = propertyAgg._sum.arrears || 0;
    const totalOutstandingDue = propertyAgg._sum.totalAmountDue || 0; // note: actual outstanding might exclude PAID, but totalAmountDue for PAID is 0 anyway.
    const totalCollected = receiptsAgg._sum.amount || 0;

    const formatted: AdminProperty[] = properties.map((p) => {
      const isDefaulter = p.status !== 'PAID' && p.arrears > 0;
      const billDateObj = new Date(p.billDate);
      const deadlineObj = new Date(p.settlementDeadline);
      const primaryOwner = p.users?.[0];

      let municipality = 'Kpone-Katamanso (KKMA)';
      if (p.accountNumber.startsWith('TMA') || p.ownerDigitalAddress.startsWith('GT')) {
        municipality = 'Tema Metropolitan (TMA)';
      } else if (p.accountNumber.startsWith('AMA') || p.ownerDigitalAddress.startsWith('GA')) {
        municipality = 'Accra Metropolitan (AMA)';
      } else if (p.accountNumber.startsWith('ASHMA') || p.ownerDigitalAddress.startsWith('GB')) {
        municipality = 'Ashaiman Municipal (ASHMA)';
      } else if (p.accountNumber.startsWith('GEMA') || p.ownerDigitalAddress.startsWith('GE')) {
        municipality = 'Ga East Municipal (GEMA)';
      }

      const receiptsList: AdminPropertyReceipt[] = p.receipts.map((r: any) => ({
        id: r.id,
        receiptNumber: r.receiptNumber,
        amount: r.amount,
        amountFormatted: `GH₵ ${r.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        settlementType: r.settlementType,
        paymentMethod: r.paymentMethod,
        status: r.status,
        datePaid: new Date(r.datePaid).toLocaleDateString('en-GB', {
          day: '2-digit', month: 'short', year: 'numeric',
          hour: '2-digit', minute: '2-digit'
        }),
      }));

      return {
        id: p.id,
        accountNumber: p.accountNumber,
        municipality,
        ownerPhone: primaryOwner?.phoneNumber || 'N/A',
        ownerName: primaryOwner?.name || 'Municipal Ratepayer',
        ownerDigitalAddress: p.ownerDigitalAddress,
        propertyClassification: p.propertyClassification,
        billYear: p.billYear,
        billDateFormatted: billDateObj.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
        settlementDeadlineFormatted: deadlineObj.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
        rateableValue: p.rateableValue,
        rateableValueFormatted: `GH₵ ${p.rateableValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
        rateImposed: p.rateImposed,
        previousYearBill: p.previousYearBill,
        previousYearBillFormatted: `GH₵ ${p.previousYearBill.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        amountPaidLastYear: p.amountPaidLastYear,
        amountPaidLastYearFormatted: `GH₵ ${p.amountPaidLastYear.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        arrears: p.arrears,
        arrearsFormatted: `GH₵ ${p.arrears.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        currentFee: p.currentFee,
        currentFeeFormatted: `GH₵ ${p.currentFee.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        totalAmountDue: p.totalAmountDue,
        totalAmountDueFormatted: `GH₵ ${p.totalAmountDue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        status: p.status as 'PAID' | 'PARTIALLY_PAID' | 'UNPAID',
        isDefaulter,
        receipts: receiptsList,
      };
    });

    const totalBilledDemand = totalCollected + totalOutstandingDue;
    const collectionRate = totalBilledDemand > 0 ? (totalCollected / totalBilledDemand) * 100 : 0;

    return {
      metrics: {
        totalProperties: totalProps,
        totalBilledFormatted: `GH₵ ${totalBilledDemand.toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
        totalCollectedFormatted: `GH₵ ${totalCollected.toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
        totalArrearsFormatted: `GH₵ ${totalArrears.toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
        defaultersCount,
        collectionRateFormatted: `${collectionRate.toFixed(1)}%`,
        collectionRatePercent: Math.min(100, Math.round(collectionRate)),
      },
      properties: formatted,
      pagination: {
        page,
        limit,
        total: totalProps,
        totalPages: Math.ceil(totalProps / limit)
      }
    };
  } catch (error) {
    console.error('Error fetching admin overview:', error);
    return null;
  }
}

export async function simulateSmsNoticeDispatch(accountNumber: string) {
  try {
    await verifyAdminSession();

    const property = await prisma.property.findUnique({
      where: { accountNumber },
      include: { users: true },
    });

    const primaryOwner = property?.users?.[0];
    if (!property || !primaryOwner) {
      return { success: false, error: 'Property Account Head or linked taxpayer not found.' };
    }

    const recipientPhone = primaryOwner.phoneNumber;
    const citizenAppDeepLink = `http://localhost:3000/properties?accountNumber=${property.accountNumber}`;

    const messageText = `KKMA PROPERTY RATE DEMAND NOTICE: Account ${property.accountNumber} has total municipal assessment due of GH₵ ${property.totalAmountDue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (Arrears: GH₵ ${property.arrears.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}, 2025 Current Fee: GH₵ ${property.currentFee.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}). Statutory Due Date: 30-Jun-2025. Settle or view digital bill: ${citizenAppDeepLink}`;

    return {
      success: true,
      recipientPhone,
      recipientName: primaryOwner.name || 'Municipal Ratepayer',
      messageText,
      deepLinkUrl: citizenAppDeepLink,
      timestamp: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    };
  } catch (error) {
    console.error('Error dispatching SMS notice:', error);
    return { success: false, error: 'Failed to dispatch SMS' };
  }
}

export async function batchDispatchSms(accountNumbers: string[]) {
  try {
    await verifyAdminSession();

    const properties = await prisma.property.findMany({
      where: {
        accountNumber: { in: accountNumbers },
        status: { not: 'PAID' },
        totalAmountDue: { gt: 0 },
      },
      include: { users: true },
    });

    let count = 0;
    const notificationsToCreate = [];

    for (const p of properties) {
      const primaryOwner = p.users?.[0];
      if (primaryOwner) {
        count++;
        notificationsToCreate.push({
          title: 'Demand Notice',
          message: `KKMA PROPERTY RATE DEMAND NOTICE: Account ${p.accountNumber} has total municipal assessment due of GH₵ ${p.totalAmountDue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}. Statutory Due Date: 30-Jun-2025. Settle or view digital bill: http://localhost:3000/properties?accountNumber=${p.accountNumber}`,
          type: 'DEMAND_NOTICE',
          userId: primaryOwner.id,
          deliveryMethod: 'SMS',
          deliveryStatus: 'PENDING',
        });
      }
    }

    if (notificationsToCreate.length > 0) {
      await prisma.notification.createMany({
        data: notificationsToCreate
      });
    }

    if (count === 0) {
      return {
        success: false,
        error: 'No accounts with outstanding balances found in selection. Paid accounts were automatically skipped.',
        dispatchedCount: 0,
      };
    }

    return {
      success: true,
      dispatchedCount: count,
      timestamp: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    };
  } catch (error) {
    console.error('Error in batch SMS dispatch:', error);
    return { success: false, error: 'Batch dispatch failed.' };
  }
}

export async function recordManualCashPayment(accountNumber: string, amount: number, paymentMethod: string) {
  try {
    const admin = await verifyAdminSession();

    const property = await prisma.property.findUnique({
      where: { accountNumber },
      include: { users: true },
    });

    const primaryOwner = property?.users?.[0];
    if (!property || !primaryOwner) {
      return { success: false, error: 'Account or linked taxpayer not found.' };
    }

    let remainingPayment = amount;
    let newArrears = property.arrears;
    let newCurrentFee = property.currentFee;

    if (newArrears > 0) {
      const arrearsDeduction = Math.min(newArrears, remainingPayment);
      newArrears -= arrearsDeduction;
      remainingPayment -= arrearsDeduction;
    }

    if (remainingPayment > 0) {
      const feeDeduction = Math.min(newCurrentFee, remainingPayment);
      newCurrentFee -= feeDeduction;
    }

    const newTotal = newArrears + newCurrentFee;
    const newStatus = newTotal <= 0 ? 'PAID' : newTotal < property.totalAmountDue ? 'PARTIALLY_PAID' : 'UNPAID';

    const receiptNumber = `REC-KKMA-${Date.now().toString(36).toUpperCase()}`;

    await prisma.$transaction([
      prisma.property.update({
        where: { id: property.id },
        data: {
          arrears: newArrears,
          currentFee: newCurrentFee,
          totalAmountDue: newTotal,
          status: newStatus,
        },
      }),
      prisma.receipt.create({
        data: {
          userId: primaryOwner.id,
          propertyId: property.id,
          amount: amount,
          settlementType: 'TOTAL',
          paymentMethod: paymentMethod || 'Counter Cash Treasury',
          status: 'PAID',
          receiptNumber: receiptNumber,
        },
      }),
      prisma.auditLog.create({
        data: {
          action: 'RECORD_PAYMENT',
          entityType: 'Receipt',
          entityId: property.id,
          details: `Recorded cash payment of GH₵ ${amount} for ${accountNumber}`,
          adminId: admin.id
        }
      }),
    ]);

    // If owner has settled all property rates, clear unread rollout/demand notices
    const remainingUnpaid = await prisma.property.count({
      where: {
        users: {
          some: { id: primaryOwner.id }
        },
        status: { not: 'PAID' }
      }
    });

    if (remainingUnpaid === 0) {
      try {
        if ((prisma as any).notification) {
          await (prisma as any).notification.updateMany({
            where: {
              userId: primaryOwner.id,
              type: { in: ['BILLING_ROLLOUT', 'DEMAND_NOTICE'] },
              isRead: false,
            },
            data: { isRead: true },
          });
        }
      } catch (notifErr) {
        console.error('Error auto-resolving notifications for owner:', notifErr);
      }
    }

    revalidatePath('/');
    return { success: true, receiptNumber };
  } catch (error) {
    console.error('Error recording manual payment:', error);
    return { success: false, error: 'Failed to record payment.' };
  }
}

export async function runAnnualBillingBatch(params: {
  residentialRate: number;
  commercialRate: number;
  otherRate: number;
  dueDate: string;
  messageTemplate: string;
}) {
  try {
    const admin = await verifyAdminSession();

    const properties = await prisma.property.findMany({
      include: { users: true }
    });

    for (const prop of properties) {
      const newArrears = prop.arrears + (prop.status === 'PAID' ? 0 : prop.currentFee);
      
      let newRateImposed = params.otherRate;
      if (prop.propertyClassification === 'RESIDENTIAL') newRateImposed = params.residentialRate;
      if (prop.propertyClassification === 'COMMERCIAL') newRateImposed = params.commercialRate;
      
      const newCurrentFee = prop.rateableValue * newRateImposed;
      const newTotalAmountDue = newArrears + newCurrentFee;

      await prisma.property.update({
        where: { id: prop.id },
        data: {
          rateImposed: newRateImposed,
          billYear: prop.billYear + 1,
          previousYearBill: prop.currentFee,
          amountPaidLastYear: prop.status === 'PAID' ? prop.currentFee : 0,
          arrears: newArrears,
          currentFee: newCurrentFee,
          totalAmountDue: newTotalAmountDue,
          status: 'UNPAID',
        },
      });

      const primaryOwner = prop.users?.[0];
      if (primaryOwner) {
        try {
          if ((prisma as any).notification?.create) {
            const customizedMessage = params.messageTemplate
              .replace('{{accountNumber}}', prop.accountNumber)
              .replace('{{totalAmountDue}}', newTotalAmountDue.toFixed(2))
              .replace('{{dueDate}}', params.dueDate);

            await (prisma as any).notification.create({
              data: {
                userId: primaryOwner.id,
                title: `FY ${prop.billYear + 1} Annual Rate Assessment Issued`,
                message: customizedMessage,
                type: 'BILLING_ROLLOUT',
                isRead: false,
              }
            });
          }
        } catch (notifError) {
          console.error('Non-critical notification creation error:', notifError);
        }
      }
    }

    await prisma.auditLog.create({
      data: {
        action: 'BATCH_BILLING',
        entityType: 'Property',
        details: `Ran annual billing batch for ${properties.length} properties.`,
        adminId: admin.id
      }
    });

    revalidatePath('/');

    return { success: true, count: properties.length };
  } catch (error) {
    console.error('Error running batch billing:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Failed to execute batch billing rollout.' };
  }
}

export async function saveProperty(data: any) {
  try {
    const admin = await verifyAdminSession();

    const { id, accountNumber, ownerName, ownerPhone, ownerDigitalAddress, physicalAddress, municipality, propertyClassification, rateableValue, rateImposed } = data;
    const currentFee = rateableValue * rateImposed;

    let owner = await prisma.user.findUnique({ where: { phoneNumber: ownerPhone }});
    if (!owner) {
      owner = await prisma.user.create({
        data: { phoneNumber: ownerPhone, name: ownerName }
      });
    } else if (ownerName && owner.name !== ownerName) {
      await prisma.user.update({
        where: { id: owner.id },
        data: { name: ownerName }
      });
    }

    let property;
    if (id) {
      property = await prisma.property.update({
        where: { id },
        data: {
          accountNumber,
          ownerDigitalAddress,
          physicalAddress,
          municipality,
          propertyClassification,
          rateableValue,
          rateImposed,
          users: {
            set: [{ id: owner.id }]
          }
        }
      });
      
      await prisma.auditLog.create({
        data: {
          action: 'EDIT_PROPERTY',
          entityType: 'Property',
          entityId: property.id,
          details: `Updated property assessment for ${accountNumber}`,
          adminId: admin.id
        }
      });
    } else {
      property = await prisma.property.create({
        data: {
          accountNumber,
          ownerDigitalAddress,
          physicalAddress,
          municipality,
          propertyClassification,
          rateableValue,
          rateImposed,
          currentFee,
          totalAmountDue: currentFee,
          status: 'UNPAID',
          settlementDeadline: new Date(new Date().getFullYear(), 5, 30), // June 30 of current year
          users: {
            connect: [{ id: owner.id }]
          }
        }
      });

      await prisma.auditLog.create({
        data: {
          action: 'CREATE_PROPERTY',
          entityType: 'Property',
          entityId: property.id,
          details: `Registered new property ${accountNumber}`,
          adminId: admin.id
        }
      });
    }

    revalidatePath('/');
    return { success: true };
  } catch (error) {
    console.error('Error saving property:', error);
    return { success: false, error: 'Failed to save property.' };
  }
}
