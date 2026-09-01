'use server';

import { prisma } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { PaymentGateway } from '@/lib/payments/gateway';
import { NetworkProvider } from '@/lib/utils/network-detector';
import { SMSGateway } from '@/lib/sms/gateway';

export interface DashboardProperty {
  id: string;
  accountNumber: string; // Master Account Head (e.g. KKDA03188007)
  ownerDigitalAddress: string; // GhanaPost GPS (e.g. GK-0010-9395)
  propertyClassification: string; // e.g. PRIVATE THIRD CLASS RESIDENTIAL
  billYear: number;
  billDate: string;
  billDateFormatted: string;
  settlementDeadline: string;
  settlementDeadlineFormatted: string;
  isOverdue: boolean;
  rateableValue: number;
  rateableValueFormatted: string;
  rateImposed: number;
  rateImposedFormatted: string;
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
}

export interface DashboardData {
  user: {
    id: string;
    name: string | null;
    phoneNumber: string;
    isVerified: boolean;
  };
  properties: DashboardProperty[];
  metrics: {
    totalValuation: number;
    totalValuationFormatted: string;
    totalOutstanding: number;
    totalOutstandingFormatted: string;
    totalProperties: number;
    paidCount: number;
    unpaidCount: number;
    complianceStatus: 'Compliant' | 'Action Required';
  };
}

// ----------------------------------------------------
// AUTHENTICATION & SESSION MANAGEMENT
// ----------------------------------------------------

export async function getAuthenticatedSession() {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('auth_session')?.value;

    let user = null;
    if (sessionToken) {
      const session = await prisma.session.findUnique({
        where: { token: sessionToken },
        include: {
          user: {
            include: {
              properties: {
                include: { receipts: true },
              },
            },
          }
        }
      });
      if (session) {
        user = session.user;
      }
    }

    // Fallback if session is missing or points to a non-existent user
    if (!user) {
      user = await prisma.user.findFirst({
        include: {
          properties: {
            include: { receipts: true },
          },
        },
      });

      if (user) {
        const token = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
        await prisma.session.create({
          data: { token, userId: user.id }
        });
        cookieStore.set('auth_session', token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: 60 * 60 * 24 * 365, // 1 year non-expiring session
          path: '/',
        });
      }
    }

    return user;
  } catch (error) {
    console.error('Error verifying auth session:', error);
    return null;
  }
}

export async function loginWithPhone(phoneNumberInput: string) {
  try {
    let cleanPhone = phoneNumberInput.replace(/\D/g, '');
    if (!cleanPhone || cleanPhone.length < 7) {
      return { success: false, error: 'Please enter a valid telephone number.' };
    }

    // Normalize Ghana phone numbers (e.g. 233551908713 or 551908713 -> 0551908713)
    if (cleanPhone.startsWith('233') && cleanPhone.length === 12) {
      cleanPhone = `0${cleanPhone.substring(3)}`;
    } else if (cleanPhone.length === 9) {
      cleanPhone = `0${cleanPhone}`;
    }

    // Lookup user in database
    let user = await prisma.user.findUnique({
      where: { phoneNumber: cleanPhone },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          phoneNumber: cleanPhone,
          name: 'Ratepayer',
          isVerified: false,
        },
      });
    }

    // Generate random 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    console.log('\n=============================================');
    console.log(`[AUTH] NEW LOGIN - OTP for ${user.phoneNumber}: ${otp}`);
    console.log('=============================================\n');

    // Send SMS
    const smsGateway = new SMSGateway();
    await smsGateway.getProvider().sendSMS(
      user.phoneNumber,
      `Your Property Rate Portal login code is: ${otp}. Do not share this code with anyone.`
    );

    const cookieStore = await cookies();
    cookieStore.set('pending_auth_phone', user.phoneNumber, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 10, // 10 minutes
      path: '/',
    });
    
    // Store OTP in an encrypted format ideally, but for now we'll just store it in an httpOnly cookie
    cookieStore.set('pending_auth_otp', otp, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 10, // 10 minutes
      path: '/',
    });

    return {
      success: true,
      phoneNumber: user.phoneNumber,
      userName: user.name,
    };
  } catch (error) {
    console.error('Login error:', error);
    return { success: false, error: 'An unexpected authentication error occurred.' };
  }
}

export async function verifyOtpAndLogin(otp: string, explicitPhone?: string) {
  try {
    const cookieStore = await cookies();
    const phoneToVerify =
      explicitPhone?.replace(/\D/g, '') || cookieStore.get('pending_auth_phone')?.value;
    const storedOtp = cookieStore.get('pending_auth_otp')?.value;

    if (otp !== storedOtp) {
      return { success: false, error: 'Invalid or expired OTP. Please try again.' };
    }

    let user = null;
    if (phoneToVerify) {
      user = await prisma.user.findUnique({
        where: { phoneNumber: phoneToVerify },
      });
    }

    if (!user) {
      user = await prisma.user.findFirst();
    }

    if (!user) {
      return { success: false, error: 'Taxpayer profile not found in database.' };
    }

    if (!user.isVerified) {
      await prisma.user.update({
        where: { id: user.id },
        data: { isVerified: true },
      });
    }

    const token = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    await prisma.session.create({
      data: { token, userId: user.id }
    });

    cookieStore.set('auth_session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 365, // 1 year non-expiring session
      path: '/',
    });

    cookieStore.delete('pending_auth_phone');
    cookieStore.delete('pending_auth_otp');

    revalidatePath('/dashboard');
    revalidatePath('/properties');
    revalidatePath('/receipts');
    revalidatePath('/profile');

    return {
      success: true,
      user: {
        id: user.id,
        name: user.name,
        phoneNumber: user.phoneNumber,
      },
    };
  } catch (error) {
    console.error('OTP verification error:', error);
    return { success: false, error: 'Failed to verify authentication code.' };
  }
}

export async function resendOtp() {
  try {
    const cookieStore = await cookies();
    const phone = cookieStore.get('pending_auth_phone')?.value;

    if (!phone) {
      return { success: false, error: 'No pending authentication session found.' };
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    console.log('\n=============================================');
    console.log(`[AUTH] Generating new OTP for ${phone}: ${otp}`);
    console.log('=============================================\n');

    const smsGateway = new SMSGateway();
    await smsGateway.getProvider().sendSMS(
      phone,
      `Your Property Rate Portal new login code is: ${otp}. Do not share this code with anyone.`
    );

    cookieStore.set('pending_auth_otp', otp, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 10,
      path: '/',
    });

    return { success: true };
  } catch (error) {
    console.error('Resend OTP error:', error);
    return { success: false, error: 'Failed to resend code.' };
  }
}

export async function logoutUser() {
  try {
    const cookieStore = await cookies();
    cookieStore.delete('auth_session');
    cookieStore.delete('pending_auth_phone');

    revalidatePath('/dashboard');
    revalidatePath('/properties');
    revalidatePath('/receipts');
    revalidatePath('/profile');

    return { success: true };
  } catch (error) {
    console.error('Logout error:', error);
    return { success: false };
  }
}

// ----------------------------------------------------
// TAXPAYER DASHBOARD & IN-APP BILL RESOLVER
// ----------------------------------------------------

export async function getDashboardData(): Promise<DashboardData | null> {
  try {
    const user = await getAuthenticatedSession();
    if (!user) return null;

    let totalValuation = 0;
    let totalOutstanding = 0;
    let paidCount = 0;
    let unpaidCount = 0;

    const formattedProperties: DashboardProperty[] = user.properties.map((p) => {
      totalValuation += p.rateableValue;
      totalOutstanding += p.status === 'PAID' ? 0 : p.totalAmountDue;

      if (p.status === 'PAID') {
        paidCount++;
      } else {
        unpaidCount++;
      }

      const billDateObj = new Date(p.billDate);
      const deadlineObj = new Date(p.settlementDeadline);

      return {
        id: p.id,
        accountNumber: p.accountNumber,
        ownerDigitalAddress: p.ownerDigitalAddress,
        propertyClassification: p.propertyClassification,
        billYear: p.billYear,
        billDate: billDateObj.toISOString(),
        billDateFormatted: billDateObj.toLocaleDateString('en-GB', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        }),
        settlementDeadline: deadlineObj.toISOString(),
        settlementDeadlineFormatted: deadlineObj.toLocaleDateString('en-GB', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        }),
        isOverdue: p.status !== 'PAID' && deadlineObj < new Date(),
        rateableValue: p.rateableValue,
        rateableValueFormatted: `GH₵ ${p.rateableValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
        rateImposed: p.rateImposed,
        rateImposedFormatted: `${p.rateImposed}`,
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
      };
    });

    // Non-settled / due properties on top, settled properties at the bottom
    formattedProperties.sort((a, b) => {
      const aPaid = a.status === 'PAID';
      const bPaid = b.status === 'PAID';
      if (aPaid && !bPaid) return 1;
      if (!aPaid && bPaid) return -1;
      return b.totalAmountDue - a.totalAmountDue;
    });

    return {
      user: {
        id: user.id,
        name: user.name,
        phoneNumber: user.phoneNumber,
        isVerified: user.isVerified,
      },
      properties: formattedProperties,
      metrics: {
        totalValuation,
        totalValuationFormatted: `GH₵ ${totalValuation.toLocaleString(undefined, { minimumFractionDigits: 0 })}`,
        totalOutstanding,
        totalOutstandingFormatted: `GH₵ ${totalOutstanding.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        totalProperties: formattedProperties.length,
        paidCount,
        unpaidCount,
        complianceStatus: unpaidCount === 0 ? 'Compliant' : 'Action Required',
      },
    };
  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    return null;
  }
}

// ----------------------------------------------------
// OFFICIAL DIGITAL RECEIPTS
// ----------------------------------------------------

export async function getUserReceipts() {
  try {
    const user = await getAuthenticatedSession();
    if (!user) return [];

    const receipts = await prisma.receipt.findMany({
      where: {
        userId: user.id,
      },
      include: {
        property: true,
      },
      orderBy: {
        datePaid: 'desc',
      },
    });

    return receipts.map((r) => {
      const d = new Date(r.datePaid);
      return {
        id: r.id,
        receiptNumber: r.receiptNumber,
        amount: r.amount,
        amountFormatted: `GH₵ ${r.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        settlementType: r.settlementType,
        paymentMethod: r.paymentMethod,
        status: r.status,
        datePaid: r.datePaid.toISOString(),
        formattedDate: d.toLocaleDateString('en-GB', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        }),
        propertyName: `Acct: ${r.property.accountNumber}`,
        digitalAddress: r.property.ownerDigitalAddress,
        propertyClassification: r.property.propertyClassification,
        fiscalYear: r.property.billYear,
        taxpayerName: user.name || 'Property Owner',
      };
    });
  } catch (error) {
    console.error('Error fetching receipts:', error);
    return [];
  }
}

// ----------------------------------------------------
// CHECKOUT & PAYMENT PROCESSING
// ----------------------------------------------------

export type SettlementType = 'TOTAL' | 'ARREARS' | 'CURRENT_FEE' | 'PARTIAL';

export async function getCheckoutData(propertyId: string, settlementType: SettlementType = 'TOTAL', customAmount?: number) {
  try {
    const user = await getAuthenticatedSession();
    if (!user) return null;

    let totalAmount = 0;
    let title = '';
    let subtitle = '';
    let fiscalYear = 2025;

    if (propertyId === 'ALL') {
      const unpaidProps = user.properties.filter((p) => p.status !== 'PAID');
      totalAmount = unpaidProps.reduce((sum, p) => sum + p.totalAmountDue, 0);
      title = 'All Municipal Property Rates';
      subtitle = `${unpaidProps.length} Account Head${unpaidProps.length === 1 ? '' : 's'} assessed under KKMA`;
    } else {
      const prop = user.properties.find((p) => p.id === propertyId);
      if (!prop) return null;

      fiscalYear = prop.billYear;
      if (settlementType === 'ARREARS') {
        totalAmount = prop.arrears;
        title = `Arrears Clearance: ${prop.accountNumber}`;
        subtitle = `Carried arrears debt for ${prop.ownerDigitalAddress}`;
      } else if (settlementType === 'CURRENT_FEE') {
        totalAmount = prop.currentFee;
        title = `2025 Rate Assessment: ${prop.accountNumber}`;
        subtitle = `Current municipal rate fee for ${prop.ownerDigitalAddress}`;
      } else if (settlementType === 'PARTIAL' && customAmount) {
        totalAmount = customAmount;
        title = `Partial Payment: ${prop.accountNumber}`;
        subtitle = `Custom installment towards ${prop.ownerDigitalAddress}`;
      } else {
        totalAmount = prop.totalAmountDue;
        title = `Full Rate Settlement: ${prop.accountNumber}`;
        subtitle = `Full outstanding rate assessment (${prop.propertyClassification})`;
      }
    }

    const subtotal = totalAmount;
    // Pass a 2% fee to the customer so that the treasury receives exactly the subtotal
    // Round UP to the nearest whole Cedi to avoid decimal payments
    const rawTotal = subtotal / 0.98;
    const totalPayable = Math.ceil(rawTotal);
    const processingFee = Number((totalPayable - subtotal).toFixed(2));

    return {
      title,
      subtitle,
      settlementType,
      settlementLabel:
        settlementType === 'ARREARS'
          ? 'Settling Carried Arrears'
          : settlementType === 'CURRENT_FEE'
          ? 'Settling 2025 Fee'
          : settlementType === 'PARTIAL'
          ? 'Custom Installment Payment'
          : 'Settling Full Balance',
      fiscalYear,
      subtotal,
      subtotalFormatted: `GH₵ ${subtotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      processingFee,
      processingFeeFormatted: `GH₵ ${processingFee.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      totalAmount: totalPayable,
      totalAmountFormatted: `GH₵ ${totalPayable.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      user: {
        id: user.id,
        name: user.name,
        phoneNumber: user.phoneNumber,
      },
    };
  } catch (error) {
    console.error('Error fetching checkout data:', error);
    return null;
  }
}

export async function initializePayment(data: {
  propertyId: string;
  settlementType: SettlementType;
  amount: number;
}) {
  try {
    const user = await getAuthenticatedSession();
    if (!user) return { success: false, error: 'User session not found' };

    // Fraud/Risk layer: velocity check
    const recentPending = await prisma.transaction.count({
      where: {
        userId: user.id,
        status: 'PENDING',
        createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) }
      }
    });

    if (recentPending >= 3) {
      return { success: false, error: 'Too many pending transactions. Please wait before trying again.' };
    }

    const reference = `TX-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const propertyIds = data.propertyId === 'ALL' 
      ? user.properties.filter((p: any) => p.status !== 'PAID').map((p: any) => p.id).join(',') 
      : data.propertyId;
    const primaryPropertyId = data.propertyId === 'ALL' 
      ? user.properties.filter((p: any) => p.status !== 'PAID')[0]?.id 
      : data.propertyId;

    if (!primaryPropertyId) return { success: false, error: 'No properties to settle.' };

    const { amount, settlementType } = data;

    const transaction = await prisma.transaction.create({
      data: {
        userId: user.id,
        propertyId: primaryPropertyId,
        amount: amount,
        reference,
        status: 'PENDING',
        settlementType,
        provider: 'PAYSTACK',
      }
    });

    const gateway = new PaymentGateway('PAYSTACK');
    const response = await gateway.getProvider().initializeTransaction({
      email: `${user.phoneNumber}@propertyrate.kkma.gov.gh`,
      amount,
      reference,
      callbackUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/checkout/verify?reference=${reference}`,
      metadata: {
        userId: user.id,
        propertyIds: primaryPropertyId,
        settlementType,
      }
    });

    if (!response.success) {
      await prisma.transaction.update({
        where: { id: transaction.id },
        data: { status: 'FAILED' }
      });
      return { success: false, error: response.error };
    }

    return { 
      success: true, 
      authorizationUrl: response.authorizationUrl, 
      reference: response.reference 
    };
  } catch (error) {
    console.error('Payment initialization error:', error);
    return { success: false, error: 'Payment service unavailable.' };
  }
}

export async function chargeMobileMoneyAction(params: {
  propertyId: string;
  settlementType: string;
  amount: number;
  subtotal: number;
  processingFee: number;
  phone: string;
  network: NetworkProvider;
}) {
  try {
    const user = await getAuthenticatedSession();
    if (!user) return { success: false, error: 'Authentication required' };

    let propertyIds: string[] = [];
    if (params.propertyId === 'ALL') {
      propertyIds = user.properties.filter(p => p.status !== 'PAID').map(p => p.id);
    } else {
      propertyIds = [params.propertyId];
    }

    if (propertyIds.length === 0) {
      return { success: false, error: 'No unpaid properties found.' };
    }

    const uniqueSuffix = Math.floor(1000 + Math.random() * 9000);
    const reference = `TXN-KKMA-${new Date().getTime()}-${uniqueSuffix}`;

    // Map network to Paystack provider codes
    let providerCode: 'mtn' | 'vod' | 'tgo' = 'mtn';
    if (params.network === 'TELECEL') providerCode = 'vod';
    if (params.network === 'AIRTELTIGO') providerCode = 'tgo';

    const transaction = await prisma.transaction.create({
      data: {
        userId: user.id,
        propertyId: propertyIds[0],
        amount: params.amount,
        reference,
        status: 'PENDING',
        settlementType: params.settlementType,
        provider: 'PAYSTACK',
        paymentPhoneNumber: params.phone,
      }
    });

    const gateway = new PaymentGateway('PAYSTACK');
    const response = await gateway.getProvider().chargeMobileMoney({
      email: `${user.phoneNumber}@propertyrate.kkma.gov.gh`,
      amount: params.amount,
      reference,
      mobile_money: {
        phone: params.phone,
        provider: providerCode
      },
      metadata: {
        userId: user.id,
        propertyIds: propertyIds.join(','),
        settlementType: params.settlementType,
        subtotal: params.subtotal,
        processingFee: params.processingFee
      }
    });

    if (!response.success) {
      await prisma.transaction.update({
        where: { id: transaction.id },
        data: { status: 'FAILED' }
      });
      return { success: false, error: response.error };
    }

    return { 
      success: true, 
      status: response.status, 
      reference: response.reference,
      displayText: response.displayText
    };
  } catch (error) {
    console.error('Mobile Money charge error:', error);
    return { success: false, error: 'Payment service unavailable.' };
  }
}

export async function processPayment(data: {
  propertyId?: string;
  settlementType?: SettlementType;
  amount: number;
  paymentMethod: string;
  paymentPhoneNumber?: string;
}) {
  try {
    const user = await getAuthenticatedSession();
    if (!user) return { success: false, error: 'User session not found' };

    const settlementType = data.settlementType || 'TOTAL';
    let targetPropertyIds: string[] = [];

    if (!data.propertyId || data.propertyId === 'ALL') {
      targetPropertyIds = user.properties
        .filter((p) => p.status !== 'PAID')
        .map((p) => p.id);
    } else {
      targetPropertyIds = [data.propertyId];
    }

    if (targetPropertyIds.length === 0) {
      return { success: false, error: 'No unpaid properties selected' };
    }

    let generatedReceiptNumber = '';
    let generatedReceiptId = '';

    for (const propId of targetPropertyIds) {
      const prop = user.properties.find((p) => p.id === propId);
      if (!prop) continue;

      let paymentAmount = data.amount;
      let newArrears = prop.arrears;
      let newCurrentFee = prop.currentFee;
      let newStatus: 'PAID' | 'PARTIALLY_PAID' | 'UNPAID' = 'PAID';

      if (settlementType === 'ARREARS') {
        paymentAmount = Math.min(data.amount, prop.arrears);
        newArrears = Math.max(0, prop.arrears - paymentAmount);
        newStatus = newArrears === 0 && newCurrentFee === 0 ? 'PAID' : 'PARTIALLY_PAID';
      } else if (settlementType === 'CURRENT_FEE') {
        paymentAmount = Math.min(data.amount, prop.currentFee);
        newCurrentFee = Math.max(0, prop.currentFee - paymentAmount);
        newStatus = newArrears === 0 && newCurrentFee === 0 ? 'PAID' : 'PARTIALLY_PAID';
      } else {
        // TOTAL or Partial with priority allocation (Arrears First)
        if (paymentAmount >= prop.totalAmountDue) {
          newArrears = 0;
          newCurrentFee = 0;
          newStatus = 'PAID';
        } else {
          // Liquidate arrears first
          if (paymentAmount <= prop.arrears) {
            newArrears = prop.arrears - paymentAmount;
          } else {
            const remainder = paymentAmount - prop.arrears;
            newArrears = 0;
            newCurrentFee = Math.max(0, prop.currentFee - remainder);
          }
          newStatus = newArrears + newCurrentFee <= 0 ? 'PAID' : 'PARTIALLY_PAID';
        }
      }

      const newTotalAmountDue = newArrears + newCurrentFee;

      await prisma.property.update({
        where: { id: prop.id },
        data: {
          arrears: newArrears,
          currentFee: newCurrentFee,
          totalAmountDue: newTotalAmountDue,
          status: newStatus,
        },
      });

      // 1. Claim next available GCR receipt number from municipal Value Book stock pool
      const gcrRecord = await prisma.tGCRNr.findFirst({
        where: { isUsed: false, isDamaged: false },
        orderBy: { gcrNo: 'asc' },
      });

      const uniqueSuffix = Math.floor(1000 + Math.random() * 9000);
      const receiptNumber: string = gcrRecord?.gcrNo || `GCR-KKMA-${new Date().getFullYear()}-${uniqueSuffix}`;
      if (gcrRecord) {
        await prisma.tGCRNr.update({
          where: { id: gcrRecord.id },
          data: {
            isUsed: true,
            allocatedAt: new Date(),
          },
        });
      }

      // 2. Create official FeePayment record (ARNOLD.BAK) stamped with APP_PAYMENT
      await prisma.feePayment.create({
        data: {
          accountNo: prop.accountNumber,
          arrearsPd: prop.arrears - newArrears,
          curAmtPd: prop.currentFee - newCurrentFee,
          amtPaid: paymentAmount,
          pmtMode: data.paymentMethod || 'Mobile Money',
          gcrNr: receiptNumber,
          collectorsCollectorId: 'APP_PAYMENT',
          cashiersCashierId: 'APP_PAYMENT',
          userId: user.id,
          propertyId: prop.id,
        },
      });

      // 3. Create digital portal Receipt record
      const receipt = await prisma.receipt.create({
        data: {
          userId: user.id,
          propertyId: prop.id,
          amount: paymentAmount,
          settlementType: settlementType,
          paymentMethod: data.paymentMethod,
          paymentPhoneNumber: data.paymentPhoneNumber,
          status: 'paid',
          collectorName: 'APP_PAYMENT',
          cashierName: 'APP_PAYMENT',
          isPhysicalIssued: false,
          receiptNumber: receiptNumber,
        },
      });

      generatedReceiptNumber = receiptNumber;
      generatedReceiptId = receipt.id;
    }

    // Check if user has cleared all property rates
    const remainingUnpaid = await prisma.property.count({
      where: { users: { some: { id: user.id } }, status: { not: 'PAID' } }
    });

    if (remainingUnpaid === 0) {
      try {
        if ((prisma as any).notification) {
          await (prisma as any).notification.updateMany({
            where: {
              userId: user.id,
              type: { in: ['BILLING_ROLLOUT', 'DEMAND_NOTICE'] },
              isRead: false,
            },
            data: { isRead: true },
          });
        }
      } catch (err) {
        console.error('Error resolving notifications on settlement:', err);
      }
    }

    revalidatePath('/dashboard');
    revalidatePath('/properties');
    revalidatePath('/receipts');
    revalidatePath('/profile');
    revalidatePath('/notifications');

    return {
      success: true,
      receiptNumber: generatedReceiptNumber,
      receiptId: generatedReceiptId,
      amountFormatted: `GH₵ ${data.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    };
  } catch (error) {
    console.error('Error processing payment:', error);
    return { success: false, error: 'Payment settlement failed' };
  }
}

// ----------------------------------------------------
// MUNICIPAL REVENUE ADMINISTRATION (MODULE B)
// ----------------------------------------------------

export async function getAdminOverview() {
  try {
    const properties = await prisma.property.findMany({
      include: {
        users: true,
        receipts: true,
      },
      orderBy: {
        accountNumber: 'asc',
      },
    });

    let totalBilled = 0;
    let totalCollected = 0;
    let totalArrears = 0;
    let defaultersCount = 0;

    const formatted = properties.map((p) => {
      totalBilled += p.currentFee + p.previousYearBill;
      totalArrears += p.arrears;

      const propCollected = p.receipts.reduce((sum: number, r: { amount: number }) => sum + r.amount, 0);
      totalCollected += propCollected;

      const isDefaulter = p.status !== 'PAID' && p.arrears > 0;
      if (isDefaulter) defaultersCount++;

      return {
        id: p.id,
        accountNumber: p.accountNumber,
        ownerPhone: p.users && p.users.length > 0 ? p.users[0].phoneNumber : 'N/A',
        ownerName: p.users && p.users.length > 0 && p.users[0].name ? p.users[0].name : 'Municipal Ratepayer',
        ownerDigitalAddress: p.ownerDigitalAddress,
        propertyClassification: p.propertyClassification,
        billYear: p.billYear,
        rateableValue: p.rateableValue,
        rateImposed: p.rateImposed,
        arrears: p.arrears,
        currentFee: p.currentFee,
        totalAmountDue: p.totalAmountDue,
        status: p.status,
        isDefaulter,
      };
    });

    return {
      metrics: {
        totalProperties: properties.length,
        totalBilledFormatted: `GH₵ ${totalBilled.toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
        totalCollectedFormatted: `GH₵ ${totalCollected.toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
        totalArrearsFormatted: `GH₵ ${totalArrears.toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
        defaultersCount,
      },
      properties: formatted,
    };
  } catch (error) {
    console.error('Error fetching admin overview:', error);
    return null;
  }
}

export async function simulateSmsNoticeDispatch(accountNumber: string) {
  try {
    const property = await prisma.property.findUnique({
      where: { accountNumber },
      include: { users: true },
    });

    if (!property || !property.users || property.users.length === 0) {
      return { success: false, error: 'Property Account No. or linked taxpayer not found' };
    }

    const recipientPhone = property.users[0].phoneNumber;
    const deepLinkUrl = `https://kkma.gov.gh/properties?accountNumber=${property.accountNumber}`;

    const messageText = `KKMA PROPERTY RATE NOTICE: Account ${property.accountNumber} has total rate assessment due of GH₵ ${property.totalAmountDue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (Arrears: GH₵ ${property.arrears.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}, 2025 Fee: GH₵ ${property.currentFee.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}). Due Date: 30-Jun-2025. Settle or view digital bill: ${deepLinkUrl}`;

    return {
      success: true,
      recipientPhone,
      recipientName: property.users[0].name,
      messageText,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.error('Error dispatching SMS notice:', error);
    return { success: false, error: 'Failed to dispatch SMS' };
  }
}

export async function runAnnualBillingBatch() {
  try {
    const properties = await prisma.property.findMany({
      include: { users: true }
    });

    for (const prop of properties) {
      const newArrears = prop.arrears + (prop.status === 'PAID' ? 0 : prop.currentFee);
      const newCurrentFee = prop.rateableValue * prop.rateImposed;
      const newTotalAmountDue = newArrears + newCurrentFee;

      await prisma.property.update({
        where: { id: prop.id },
        data: {
          billYear: prop.billYear + 1,
          previousYearBill: prop.currentFee,
          amountPaidLastYear: prop.status === 'PAID' ? prop.currentFee : 0,
          arrears: newArrears,
          currentFee: newCurrentFee,
          totalAmountDue: newTotalAmountDue,
          status: 'UNPAID',
        },
      });

      if (prop.users && prop.users.length > 0) {
        try {
          if ((prisma as any).notification?.create) {
            await (prisma as any).notification.create({
              data: {
                userId: prop.users[0].id,
                title: `FY ${prop.billYear + 1} Annual Rate Assessment Issued`,
                message: `New rate assessment for account ${prop.accountNumber} has been billed: GH₵ ${newTotalAmountDue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}. Statutory payment due by June 30 under Act 936.`,
                type: 'BILLING_ROLLOUT',
                isRead: false,
              }
            });
          }
        } catch (notifErr) {
          console.error('Non-critical notification error:', notifErr);
        }
      }
    }

    revalidatePath('/dashboard');
    revalidatePath('/properties');
    revalidatePath('/notifications');

    return { success: true, count: properties.length };
  } catch (error) {
    console.error('Error running batch billing:', error);
    return { success: false, error: 'Failed to execute batch billing rollout' };
  }
}

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  type: string;
  isRead: boolean;
  createdAt: string;
  timeAgo: string;
}

export async function getUserNotifications(): Promise<{
  notifications: AppNotification[];
  unreadCount: number;
  latestRollout: AppNotification | null;
}> {
  try {
    const user = await getAuthenticatedSession();
    if (!user) {
      return { notifications: [], unreadCount: 0, latestRollout: null };
    }

    let notifications = await prisma.notification.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
    });

    if (notifications.length === 0) {
      const initialNotice = await prisma.notification.create({
        data: {
          userId: user.id,
          title: "2025 Municipal Billing Rollout",
          message: "The 2025 Property Rate Annual Valuation & Assessment roll has been officially gazetted by KKMA under Act 936. Review your assessment heads.",
          type: "BILLING_ROLLOUT",
          isRead: false,
        }
      });
      notifications = [initialNotice];
    }

    const isAllSettled = user.properties.length > 0 && user.properties.every((p) => p.status === 'PAID');

    if (isAllSettled) {
      const unreadRollouts = notifications.filter(
        (n) => !n.isRead && (n.type === 'BILLING_ROLLOUT' || n.type === 'DEMAND_NOTICE')
      );
      if (unreadRollouts.length > 0) {
        try {
          if ((prisma as any).notification) {
            await (prisma as any).notification.updateMany({
              where: {
                userId: user.id,
                type: { in: ['BILLING_ROLLOUT', 'DEMAND_NOTICE'] },
                isRead: false,
              },
              data: { isRead: true },
            });
            notifications = notifications.map((n) =>
              n.type === 'BILLING_ROLLOUT' || n.type === 'DEMAND_NOTICE' ? { ...n, isRead: true } : n
            );
          }
        } catch (notifErr) {
          console.error('Error auto-resolving notifications for settled user:', notifErr);
        }
      }
    }

    const now = new Date();
    const formatted: AppNotification[] = notifications.map((n) => {
      const diffMs = now.getTime() - new Date(n.createdAt).getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMins / 60);
      const diffDays = Math.floor(diffHours / 24);

      let timeAgo = "Just now";
      if (diffDays > 0) timeAgo = `${diffDays}d ago`;
      else if (diffHours > 0) timeAgo = `${diffHours}h ago`;
      else if (diffMins > 0) timeAgo = `${diffMins}m ago`;

      return {
        id: n.id,
        title: n.title,
        message: n.message,
        type: n.type,
        isRead: n.isRead,
        createdAt: new Date(n.createdAt).toLocaleDateString('en-GB', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        }),
        timeAgo,
      };
    });

    const unreadCount = formatted.filter((n) => !n.isRead).length;
    const latestRollout = isAllSettled
      ? null
      : formatted.find((n) => n.type === 'BILLING_ROLLOUT' && !n.isRead) || null;

    return {
      notifications: formatted,
      unreadCount,
      latestRollout,
    };
  } catch (error) {
    console.error('Error fetching notifications:', error);
    return { notifications: [], unreadCount: 0, latestRollout: null };
  }
}

export async function markNotificationAsRead(id: string) {
  try {
    await prisma.notification.update({
      where: { id },
      data: { isRead: true },
    });
    revalidatePath('/dashboard');
    revalidatePath('/notifications');
    return { success: true };
  } catch (error) {
    console.error('Error marking notification as read:', error);
    return { success: false };
  }
}

export async function markAllNotificationsAsRead() {
  try {
    const user = await getAuthenticatedSession();
    if (!user) return { success: false };

    await prisma.notification.updateMany({
      where: { userId: user.id, isRead: false },
      data: { isRead: true },
    });

    revalidatePath('/dashboard');
    revalidatePath('/notifications');
    return { success: true };
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    return { success: false };
  }
}

export async function verifyPaymentTransaction(reference: string) {
  try {
    const user = await getAuthenticatedSession();
    if (!user) return { success: false, error: 'User session not found' };

    // 1. Check local DB first to see if webhook already processed a failure or success
    const transaction = await prisma.transaction.findUnique({
      where: { reference },
      include: { receipt: true }
    });

    if (transaction) {
      if (transaction.status === 'FAILED') {
        return { success: true, status: 'FAILED', amount: transaction.amount };
      }
      if (transaction.status === 'SUCCESS' && transaction.receipt) {
        return {
          success: true,
          status: 'SUCCESS',
          amount: transaction.amount,
          receipt: {
            receiptNumber: transaction.receipt.receiptNumber,
            receiptId: transaction.receipt.id
          }
        };
      }
    }

    // 2. If PENDING in our DB, check Paystack's API
    const gateway = new PaymentGateway('PAYSTACK');
    const response = await gateway.getProvider().verifyTransaction(reference);

    if (!response.success) {
      return { success: false, error: response.error };
    }

    return {
      success: true,
      status: response.status,
      amount: response.amount,
      receipt: transaction?.receipt ? {
        receiptNumber: transaction.receipt.receiptNumber,
        receiptId: transaction.receipt.id
      } : null
    };
  } catch (error) {
    console.error('Error verifying payment:', error);
    return { success: false, error: 'Payment verification failed' };
  }
}

export async function linkPropertyAccount(accountNumber: string) {
  try {
    const user = await getAuthenticatedSession();
    if (!user) return { success: false, error: 'Not authenticated' };

    const property = await prisma.property.findUnique({
      where: { accountNumber },
      include: { users: true }
    });

    if (!property) return { success: false, error: 'Property account not found.' };

    if (property.users.some((u: any) => u.id === user.id)) {
      return { success: false, error: 'This property is already linked to your phone number.' };
    }

    if (property.users.length >= 3) {
      return { success: false, error: 'This property has reached the maximum number of linked phone numbers (3).' };
    }

    await prisma.property.update({
      where: { id: property.id },
      data: { users: { connect: { id: user.id } } }
    });

    revalidatePath('/dashboard');
    revalidatePath('/properties');
    revalidatePath('/settings');
    revalidatePath('/profile');
    
    return { success: true };
  } catch (err) {
    console.error('Error linking property:', err);
    return { success: false, error: 'An unexpected error occurred while linking.' };
  }
}
