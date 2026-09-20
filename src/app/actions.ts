'use server';

import { prisma, ratepayerDb } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { PaymentGateway } from '@/lib/payments/gateway';
import { NetworkProvider } from '@/lib/utils/network-detector';
import { SMSGateway } from '@/lib/sms/gateway';
import { TwilioProvider } from '@/lib/sms/twilio';
import { verifyGhanaMobileSubscriber } from '@/lib/hubtel/verification';

const twilioService = new TwilioProvider();

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

    if (process.env.NODE_ENV !== 'production') {
      const maskedPhone = user.phoneNumber.replace(/(\d{3})\d+(\d{3})/, '$1****$2');
      console.log(`[AUTH] Login OTP dispatched to ${maskedPhone} [Status: DELIVERED]`);
    }

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

    if (!user && phoneToVerify) {
      user = await prisma.user.create({
        data: {
          phoneNumber: phoneToVerify,
          name: 'Municipal Ratepayer',
          isVerified: true,
          role: 'RATEPAYER',
        },
      });
    }

    if (!user) {
      return { success: false, error: 'Taxpayer profile not found in database for this telephone number.' };
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
    cookieStore.delete('portal_access_only');

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

    if (process.env.NODE_ENV !== 'production') {
      const maskedPhone = phone.replace(/(\d{3})\d+(\d{3})/, '$1****$2');
      console.log(`[AUTH] Resent OTP to ${maskedPhone} [Status: DELIVERED]`);
    }

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
// SECURE ONE-TIME ACCESS LINK & DEVICE BINDING
// ----------------------------------------------------

export async function claimAccessGrant(token: string) {
  try {
    if (!token || typeof token !== 'string') {
      return { success: false, error: 'INVALID_TOKEN', message: 'Missing or malformed access token.' };
    }

    const cleanToken = token.trim();

    // Check if demo token in development/simulator
    if (cleanToken.startsWith('demo_')) {
      const dest = cleanToken.includes('_ckt_') ? 'checkout' : 'dashboard';
      const acc = cleanToken.replace(/^demo_(ast|ckt)_/, '');
      return {
        success: true,
        destination: dest,
        accountNumber: acc,
      };
    }

    const grant = await ratepayerDb.accessGrant.findUnique({
      where: { token: cleanToken },
    });

    if (!grant) {
      return { success: false, error: 'NOT_FOUND', message: 'This access link is invalid or has been revoked.' };
    }

    // Check expiration
    if (new Date() > new Date(grant.expiresAt)) {
      const maskedPhone = grant.phoneNumber ? grant.phoneNumber.replace(/(\d{3})\d+(\d{3})/, '$1****$2') : '';
      return {
        success: false,
        error: 'EXPIRED',
        phoneNumber: grant.phoneNumber,
        maskedPhoneNumber: maskedPhone,
        message: 'This access link has expired. For your security, please verify with your mobile number.',
      };
    }

    const cookieStore = await cookies();
    const existingSessionToken = cookieStore.get('auth_session')?.value;

    const isMulti = (grant.accountNumber || '').startsWith('ALL:');
    const cleanAcc = (grant.accountNumber || '').replace(/^ALL:/, '');

    // Check if grant is already claimed by another device/session
    if (grant.claimedSession) {
      let isSameDeviceOrUser = false;
      if (existingSessionToken) {
        const activeSession = await prisma.session.findUnique({
          where: { token: existingSessionToken },
          include: { user: true },
        });
        if (activeSession?.user) {
          const activeDigits = (activeSession.user.phoneNumber || '').replace(/\D/g, '');
          const grantDigits = (grant.phoneNumber || '').replace(/\D/g, '');
          const phoneMatches = Boolean(
            activeDigits &&
            grantDigits &&
            (activeDigits.endsWith(grantDigits.slice(-9)) || grantDigits.endsWith(activeDigits.slice(-9)))
          );

          if (existingSessionToken === grant.claimedSession && phoneMatches) {
            isSameDeviceOrUser = true;
          } else if (phoneMatches) {
            isSameDeviceOrUser = true;
            await ratepayerDb.accessGrant.update({
              where: { id: grant.id },
              data: { claimedSession: existingSessionToken },
            }).catch(() => {});
          }
        }
      }

      if (isSameDeviceOrUser) {
        return {
          success: true,
          destination: grant.destination || 'checkout',
          accountNumber: cleanAcc,
          isMulti,
        };
      }

      // Check if the claimed session was actually for this ratepayer's phone number
      const claimedSessionRecord = await prisma.session.findUnique({
        where: { token: grant.claimedSession },
        include: { user: true },
      }).catch(() => null);

      const claimedUserPhone = (claimedSessionRecord?.user?.phoneNumber || '').replace(/\D/g, '');
      const expectedGrantPhone = (grant.phoneNumber || '').replace(/\D/g, '');
      const claimedPhoneMatches = Boolean(
        claimedUserPhone &&
        expectedGrantPhone &&
        (claimedUserPhone.endsWith(expectedGrantPhone.slice(-9)) || expectedGrantPhone.endsWith(claimedUserPhone.slice(-9)))
      );

      if (!claimedPhoneMatches) {
        // Corrupt or cross-user claimedSession: reset so the authentic recipient can claim cleanly
        await ratepayerDb.accessGrant.update({
          where: { id: grant.id },
          data: { claimedSession: null, claimedAt: null },
        }).catch(() => {});
      } else {
        // Legitimate DEVICE MISMATCH: Token was claimed on another device/browser
        const maskedPhone = grant.phoneNumber ? grant.phoneNumber.replace(/(\d{3})\d+(\d{3})/, '$1****$2') : 'your registered number';
        return {
          success: false,
          error: 'DEVICE_MISMATCH',
          phoneNumber: grant.phoneNumber,
          maskedPhoneNumber: maskedPhone,
          accountNumber: cleanAcc,
          message: `This secure billing link was already activated on another device. To protect ratepayer privacy, please verify your mobile number (${maskedPhone}).`,
        };
      }
    }

    // FIRST-TIME ACTIVATION ON RECIPIENT'S DEVICE
    let cleanPhone = (grant.phoneNumber || '').replace(/\D/g, '');
    if (cleanPhone.startsWith('233') && cleanPhone.length === 12) {
      cleanPhone = `0${cleanPhone.substring(3)}`;
    } else if (cleanPhone.length === 9) {
      cleanPhone = `0${cleanPhone}`;
    }

    // Resolve or create ratepayer user
    let user: any = null;
    let sessionTokenToUse = existingSessionToken;
    let reuseSession = false;

    if (existingSessionToken) {
      const activeSession = await prisma.session.findUnique({
        where: { token: existingSessionToken },
        include: { user: true },
      });
      if (activeSession?.user) {
        const activeDigits = (activeSession.user.phoneNumber || '').replace(/\D/g, '');
        const grantDigits = cleanPhone.replace(/\D/g, '');
        if (activeDigits.endsWith(grantDigits.slice(-9)) || grantDigits.endsWith(activeDigits.slice(-9))) {
          user = activeSession.user;
          reuseSession = true;
        }
      }
    }

    if (!user) {
      user = await prisma.user.findFirst({
        where: {
          OR: [
            { phoneNumber: cleanPhone },
            { phoneNumber: grant.phoneNumber },
            { phoneNumber: `233${cleanPhone.replace(/^0/, '')}` },
          ],
        },
      });
    }

    if (!user && (cleanPhone || grant.phoneNumber)) {
      user = await prisma.user.findUnique({
        where: { phoneNumber: cleanPhone || grant.phoneNumber },
      });
    }

    if (!user) {
      user = await prisma.user.create({
        data: {
          phoneNumber: cleanPhone || grant.phoneNumber,
          name: 'Municipal Ratepayer',
          role: 'RATEPAYER',
          isVerified: true,
        },
      });
    }

    // Connect all properties matching this ratepayer's telephone to user in _PropertyToUser
    const matchedProps = await ratepayerDb.property.findMany({
      where: {
        OR: [
          { telephone: cleanPhone },
          { telephone: grant.phoneNumber },
          { telephone: `233${cleanPhone.replace(/^0/, '')}` },
        ],
      },
    }).catch(() => []);

    for (const p of matchedProps) {
      await prisma.property.update({
        where: { id: p.id },
        data: {
          users: {
            connect: { id: user.id },
          },
        },
      }).catch(() => {});
    }

    // Also associate target property if not already connected
    if (cleanAcc && !matchedProps.some((p: any) => p.accountNumber === cleanAcc || p.id === cleanAcc)) {
      const prop = await prisma.property.findFirst({
        where: {
          OR: [{ accountNumber: cleanAcc }, { id: cleanAcc }],
        },
      });
      if (prop) {
        await prisma.property.update({
          where: { id: prop.id },
          data: {
            users: {
              connect: { id: user.id },
            },
          },
        }).catch(() => {});
      }
    }

    if (!reuseSession || !sessionTokenToUse) {
      sessionTokenToUse = `dev_${Math.random().toString(36).substring(2, 15)}_${Math.random().toString(36).substring(2, 15)}`;
      await prisma.session.create({
        data: {
          token: sessionTokenToUse,
          userId: user.id,
        },
      });
    }

    // Set secure cookie on this device
    cookieStore.set('auth_session', sessionTokenToUse, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30, // 30 days
      path: '/',
    });

    // Mark grant as claimed and bound to this device session
    await ratepayerDb.accessGrant.update({
      where: { id: grant.id },
      data: {
        claimedAt: new Date().toISOString(),
        claimedSession: sessionTokenToUse,
      },
    });

    return {
      success: true,
      destination: grant.destination || 'checkout',
      accountNumber: cleanAcc,
      isMulti,
    };
  } catch (error) {
    console.error('Error claiming access grant:', error);
    return { success: false, error: 'SERVER_ERROR', message: 'An unexpected error occurred verifying your link.' };
  }
}

// ----------------------------------------------------
// TAXPAYER DASHBOARD & IN-APP BILL RESOLVER
// ----------------------------------------------------

export async function getDashboardData(accountNumberOverride?: string): Promise<DashboardData | null> {
  try {
    const user = await getAuthenticatedSession();
    if (!user) {
      return null;
    }

    let totalValuation = 0;
    let totalOutstanding = 0;
    let paidCount = 0;
    let unpaidCount = 0;

    let userProps: any[] = user.properties || [];

    // Ensure all properties matching user's phone number are retrieved and merged
    if (user.phoneNumber) {
      const cleanDigits = user.phoneNumber.replace(/\D/g, '');
      const normalized10 = cleanDigits.length === 12 && cleanDigits.startsWith('233') ? '0' + cleanDigits.substring(3) : cleanDigits;
      const matched = await ratepayerDb.property.findMany({
        where: {
          OR: [
            { telephone: user.phoneNumber },
            { telephone: cleanDigits },
            { telephone: normalized10 },
          ],
        },
      }).catch(() => []);

      const existingIds = new Set(userProps.map((p: any) => p.id));
      for (const m of matched) {
        if (!existingIds.has(m.id)) {
          userProps.push(m);
          existingIds.add(m.id);
        }
      }
    }

    // If accountNumberOverride provided and not in userProps, fetch and include it
    const cleanOverride = accountNumberOverride?.trim().replace(/^ALL:/, '');
    if (cleanOverride && !userProps.some((p: any) => p.accountNumber === cleanOverride || p.id === cleanOverride)) {
      const specificProp = await prisma.property.findFirst({
        where: {
          OR: [{ accountNumber: cleanOverride }, { id: cleanOverride }],
        },
      }).catch(() => null);
      if (specificProp) {
        userProps.unshift(specificProp);
      }
    }

    const formattedProperties: DashboardProperty[] = userProps.map((p: any) => {
      totalValuation += p.rateableValue;
      const isPaid = p.status === 'PAID' || p.totalAmountDue <= 0;
      if (!isPaid) {
        totalOutstanding += p.totalAmountDue;
        unpaidCount++;
      } else {
        paidCount++;
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
        isOverdue: !isPaid && deadlineObj < new Date(),
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
        status: (isPaid ? 'PAID' : (p.status as any)) as 'PAID' | 'PARTIALLY_PAID' | 'UNPAID',
      };
    });

    // Non-settled / due properties on top, settled properties at the bottom
    formattedProperties.sort((a, b) => {
      if (cleanOverride) {
        if (a.accountNumber === cleanOverride || a.id === cleanOverride) return -1;
        if (b.accountNumber === cleanOverride || b.id === cleanOverride) return 1;
      }
      const aPaid = a.status === 'PAID' || a.totalAmountDue <= 0;
      const bPaid = b.status === 'PAID' || b.totalAmountDue <= 0;
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
        scannedImageUrl: (r as any).scannedImageUrl || null,
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

/**
 * Deterministically resolves or associates the user for a specific property.
 * Strictly adheres to the payment context (Property -> Assigned User or Owner).
 * NEVER falls back to arbitrary prisma.user.findFirst().
 */
export async function resolvePropertyUser(propertyId: string, authenticatedUser: any = null) {
  if (propertyId === 'ALL') {
    return authenticatedUser || null;
  }

  const prop = await prisma.property.findUnique({
    where: propertyId.startsWith('prop_') ? { id: propertyId } : { accountNumber: propertyId },
    include: { users: true, owner: true },
  });

  if (!prop) {
    if (authenticatedUser?.properties) {
      const matched = authenticatedUser.properties.find(
        (p: any) => p.id === propertyId || p.accountNumber === propertyId
      );
      if (matched) return authenticatedUser;
    }
    return authenticatedUser || null;
  }

  // 1. Return the property's directly assigned user if present
  if (prop.users && prop.users.length > 0) {
    return prop.users[0];
  }

  // 2. If property has an owner with phone number, resolve or create linked ratepayer user
  const rawProp = prop as any;
  const ownerPhone = prop.owner?.mobileNumber || prop.owner?.tel || rawProp.telephone || rawProp.ownerPhoneDirect;
  if (ownerPhone) {
    const cleanDigits = ownerPhone.replace(/\D/g, '');
    const formatted10 = cleanDigits.length === 12 && cleanDigits.startsWith('233') ? '0' + cleanDigits.substring(3) : cleanDigits;

    let matchedUser = await prisma.user.findFirst({
      where: {
        OR: [
          { phoneNumber: ownerPhone },
          { phoneNumber: cleanDigits },
          { phoneNumber: formatted10 },
        ],
      },
    });

    if (!matchedUser) {
      matchedUser = await prisma.user.create({
        data: {
          phoneNumber: formatted10 || cleanDigits || ownerPhone,
          name: prop.owner?.name || rawProp.name || rawProp.ownerNameDirect || 'Municipal Ratepayer',
          role: 'RATEPAYER',
          properties: { connect: { id: prop.id } },
        },
      });
    } else {
      // Ensure property is linked
      try {
        await prisma.property.update({
          where: { id: prop.id },
          data: { users: { connect: { id: matchedUser.id } } },
        });
      } catch {
        // Safe ignore if relation already exists
      }
    }
    return matchedUser;
  }

  // 3. Fall back to current session if present
  if (authenticatedUser) {
    return authenticatedUser;
  }

  return null;
}

export async function verifySubscriberAction(phoneNumber: string) {
  try {
    const result = await verifyGhanaMobileSubscriber(phoneNumber);
    return {
      success: result.success,
      subscriberName: result.subscriberName,
      network: result.network,
      isHubtelVerified: result.isHubtelVerified,
      error: result.error,
    };
  } catch (error) {
    console.error('Error in verifySubscriberAction:', error);
    return {
      success: false,
      subscriberName: null,
      network: null,
      isHubtelVerified: false,
      error: 'Subscriber verification unavailable',
    };
  }
}

export async function getCheckoutData(
  propertyId: string,
  settlementType: SettlementType = 'TOTAL',
  customAmount?: number,
  accountNumberOverride?: string
) {
  try {
    let cleanPropertyId = propertyId;
    let cleanOverride = accountNumberOverride?.trim();
    if (cleanPropertyId && cleanPropertyId.startsWith('ALL:')) {
      cleanOverride = cleanOverride || cleanPropertyId.substring(4);
      cleanPropertyId = 'ALL';
    }

    let user = await getAuthenticatedSession();

    // Ensure all properties matching user's phone number are retrieved and merged
    if (user && user.phoneNumber) {
      const cleanDigits = user.phoneNumber.replace(/\D/g, '');
      const normalized10 = cleanDigits.length === 12 && cleanDigits.startsWith('233') ? '0' + cleanDigits.substring(3) : cleanDigits;
      const matched = await ratepayerDb.property.findMany({
        where: {
          OR: [
            { telephone: user.phoneNumber },
            { telephone: cleanDigits },
            { telephone: normalized10 },
          ],
        },
      }).catch(() => []);

      const userProps = user.properties || [];
      const existingIds = new Set(userProps.map((p: any) => p.id));
      for (const m of matched) {
        if (!existingIds.has(m.id)) {
          userProps.push(m);
          existingIds.add(m.id);
        }
      }
      user.properties = userProps;
    }

    let totalAmount = 0;
    let actualBill = 0;
    let title = '';
    let subtitle = '';
    let fiscalYear = 2026;
    let targetProp: any = null;
    let accountNumber = '';
    let ownerName = '';
    let arrears = 0;
    let annualRate = 0;
    let portfolioProperties: Array<{
      id: string;
      accountNumber: string;
      ownerDigitalAddress: string;
      propertyClassification: string;
      arrears: number;
      currentFee: number;
      totalAmountDue: number;
      status: string;
    }> = [];

    // If cleanPropertyId === 'ALL' and we have an accountNumberOverride, resolve all properties under that owner/number
    if (cleanPropertyId === 'ALL' && !user && cleanOverride) {
      const cleanAcc = cleanOverride.replace(/^ALL:/, '').trim();
      const seedProp = await prisma.property.findFirst({
        where: { OR: [{ accountNumber: cleanAcc }, { id: cleanAcc }] },
        include: { users: { include: { properties: true } }, owner: true },
      });

      if (seedProp) {
        const rawSeed = seedProp as any;
        const ownerPhone = rawSeed.owner?.mobileNumber || rawSeed.owner?.tel || rawSeed.users?.[0]?.phoneNumber || rawSeed.ownerPhoneDirect || rawSeed.telephone;
        let allOwnerProps: any[] = [];
        if (ownerPhone) {
          const cleanDigits = ownerPhone.replace(/\D/g, '');
          const normalized10 = cleanDigits.length === 12 && cleanDigits.startsWith('233') ? '0' + cleanDigits.substring(3) : cleanDigits;
          const propsByPhone = await ratepayerDb.property.findMany({
            where: {
              OR: [
                { telephone: ownerPhone },
                { telephone: cleanDigits },
                { telephone: normalized10 },
              ]
            }
          }).catch(() => []);

          allOwnerProps = propsByPhone || [];
        }

        if (allOwnerProps.length === 0) {
          allOwnerProps = [rawSeed];
        } else if (!allOwnerProps.some((p: any) => p.id === rawSeed.id || p.accountNumber === rawSeed.accountNumber)) {
          allOwnerProps.unshift(rawSeed);
        }

        user = {
          id: rawSeed.users?.[0]?.id || 'usr_direct',
          name: rawSeed.owner?.name || rawSeed.ownerNameDirect || rawSeed.name || 'Municipal Ratepayer',
          phoneNumber: ownerPhone || '0243756235',
          isVerified: true,
          properties: allOwnerProps,
        } as any;
      }
    }

    if (cleanPropertyId === 'ALL') {
      if (!user) return null;
      // Filter strictly to UNPAID properties with an outstanding balance
      const unpaidProps = (user.properties || []).filter((p: any) => p.status !== 'PAID' && p.totalAmountDue > 0);
      actualBill = unpaidProps.reduce((sum: number, p: any) => sum + p.totalAmountDue, 0);
      totalAmount = actualBill;
      title = 'All Municipal Property Rates';
      subtitle = `${unpaidProps.length} Outstanding Account Head${unpaidProps.length === 1 ? '' : 's'} assessed under KKMA`;
      accountNumber = unpaidProps.map((p: any) => p.accountNumber).join(', ');
      ownerName = user.name || 'Municipal Ratepayer';
      arrears = unpaidProps.reduce((sum: number, p: any) => sum + (p.arrears || 0), 0);
      annualRate = unpaidProps.reduce((sum: number, p: any) => sum + (p.currentFee || 0), 0);
      portfolioProperties = unpaidProps.map((p: any) => ({
        id: p.id,
        accountNumber: p.accountNumber,
        ownerDigitalAddress: p.ownerDigitalAddress || 'KKMA',
        propertyClassification: p.propertyClassification || 'RESIDENTIAL',
        arrears: p.arrears || 0,
        currentFee: p.currentFee || 0,
        totalAmountDue: p.totalAmountDue || 0,
        status: p.status || 'UNPAID',
      }));
    } else {
      targetProp = await prisma.property.findUnique({
        where: cleanPropertyId.startsWith('prop_') ? { id: cleanPropertyId } : { accountNumber: cleanPropertyId },
        include: { users: true, owner: true }
      });
      if (!targetProp && user?.properties) {
        const found = user.properties.find((p: any) => p.id === cleanPropertyId || p.accountNumber === cleanPropertyId);
        if (found) {
          targetProp = await prisma.property.findUnique({
            where: { id: found.id },
            include: { users: true, owner: true }
          });
        }
      }
      if (!targetProp) return null;

      fiscalYear = targetProp.billYear || 2026;
      actualBill = targetProp.totalAmountDue;
      accountNumber = targetProp.accountNumber;
      ownerName = targetProp.owner?.name || targetProp.users?.[0]?.name || user?.name || 'Ratepayer';
      arrears = targetProp.arrears || 0;
      annualRate = targetProp.currentFee || 0;

      if (settlementType === 'ARREARS') {
        actualBill = targetProp.arrears;
        totalAmount = targetProp.arrears;
        title = `Arrears Clearance: ${targetProp.accountNumber}`;
        subtitle = `Carried arrears debt for ${targetProp.ownerDigitalAddress}`;
      } else if (settlementType === 'CURRENT_FEE') {
        actualBill = targetProp.currentFee;
        totalAmount = targetProp.currentFee;
        title = `${fiscalYear} Rate Assessment: ${targetProp.accountNumber}`;
        subtitle = `Current municipal rate fee for ${targetProp.ownerDigitalAddress}`;
      } else if (settlementType === 'PARTIAL' && customAmount) {
        const minAllowed = Number((actualBill * 0.20).toFixed(2));
        const maxAllowed = actualBill;
        const clampedAmount = Math.min(Math.max(customAmount, minAllowed), maxAllowed);
        totalAmount = clampedAmount;
        title = `Partial Payment: ${targetProp.accountNumber}`;
        subtitle = `Custom installment towards ${targetProp.ownerDigitalAddress}`;
      } else {
        totalAmount = targetProp.totalAmountDue;
        title = `Full Rate Settlement: ${targetProp.accountNumber}`;
        subtitle = `Full outstanding rate assessment (${targetProp.propertyClassification})`;
      }
    }

    const minPartialAmount = Number((actualBill * 0.40).toFixed(2));
    const maxPartialAmount = actualBill;
    const subtotal = totalAmount;
    // Pass a 2% fee to the customer so that the treasury receives exactly the subtotal
    // Round UP to the nearest whole Cedi to avoid decimal payments
    const rawTotal = subtotal / 0.98;
    const totalPayable = Math.ceil(rawTotal);
    const processingFee = Number((totalPayable - subtotal).toFixed(2));

    // Deterministically resolve user for this property/account (no arbitrary findFirst)
    let deterministicUser: any = null;
    if (cleanPropertyId === 'ALL') {
      deterministicUser = user;
    } else if (targetProp) {
      deterministicUser = await resolvePropertyUser(cleanPropertyId, user);
    }

    const resolvedUserPhone = deterministicUser?.phoneNumber || targetProp?.owner?.mobileNumber || targetProp?.owner?.tel || '';
    const resolvedUserName = deterministicUser?.name || targetProp?.owner?.name || user?.name || ownerName || '';

    // Verify subscriber name via Hubtel
    let verifiedSubscriberName: string | null = null;
    let isHubtelVerified = false;

    if (resolvedUserPhone) {
      try {
        const hubtelRes = await verifyGhanaMobileSubscriber(resolvedUserPhone);
        if (hubtelRes.success && hubtelRes.subscriberName) {
          verifiedSubscriberName = hubtelRes.subscriberName;
          isHubtelVerified = true;
        }
      } catch (err) {
        console.warn('Hubtel subscriber verification failed gracefully:', err);
      }
    }

    const preferredDisplayName = verifiedSubscriberName || resolvedUserName || 'Municipal Ratepayer';

    return {
      title,
      subtitle,
      accountNumber,
      ownerName,
      arrears,
      arrearsFormatted: `GH₵ ${arrears.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      annualRate,
      annualRateFormatted: `GH₵ ${annualRate.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      settlementType,
      settlementLabel:
        settlementType === 'ARREARS'
          ? 'Settling Carried Arrears'
          : settlementType === 'CURRENT_FEE'
          ? `Settling ${fiscalYear} Fee`
          : settlementType === 'PARTIAL'
          ? 'Custom Installment Payment'
          : 'Settling Full Balance',
      fiscalYear,
      actualAmountDue: actualBill,
      actualAmountDueFormatted: `GH₵ ${actualBill.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      minPartialAmount,
      maxPartialAmount,
      subtotal,
      subtotalFormatted: `GH₵ ${subtotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      processingFee,
      processingFeeFormatted: `GH₵ ${processingFee.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      totalAmount: totalPayable,
      totalAmountFormatted: `GH₵ ${totalPayable.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      verifiedSubscriberName,
      isHubtelVerified,
      preferredDisplayName,
      portfolioProperties,
      user: {
        id: deterministicUser?.id || targetProp?.users?.[0]?.id || 'usr_direct',
        name: preferredDisplayName,
        phoneNumber: resolvedUserPhone,
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
  channel?: 'CARD' | 'BANK';
  callbackUrl?: string;
  metadata?: Record<string, any>;
}) {
  try {
    let user = await getAuthenticatedSession();
    if (!user && data.propertyId !== 'ALL') {
      user = (await resolvePropertyUser(data.propertyId, null)) as any;
    }
    if (!user) return { success: false, error: 'User session or property record not found' };

    // Fraud/Risk layer: velocity check
    const recentPending = await prisma.transaction.count({
      where: {
        userId: user.id,
        status: 'PENDING',
        createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) }
      }
    });

    if (recentPending >= 5) {
      return { success: false, error: 'Too many pending transactions. Please wait before trying again.' };
    }

    const reference = `TX-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    let primaryPropertyId = '';
    let propertyIds = '';
    let matchedProp: any = null;

    if (data.propertyId === 'ALL') {
      const unpaidProps = user.properties.filter((p: any) => p.status !== 'PAID');
      primaryPropertyId = unpaidProps[0]?.id;
      propertyIds = unpaidProps.map((p: any) => p.id).join(',');
    } else {
      matchedProp = user.properties.find((p: any) => p.id === data.propertyId || p.accountNumber === data.propertyId);
      if (!matchedProp) {
        matchedProp = await prisma.property.findUnique({
          where: data.propertyId.startsWith('prop_') ? { id: data.propertyId } : { accountNumber: data.propertyId }
        });
      }
      primaryPropertyId = matchedProp?.id || data.propertyId;
      propertyIds = primaryPropertyId;
    }

    if (!primaryPropertyId) return { success: false, error: 'No properties to settle.' };

    const { amount, settlementType } = data;

    if (settlementType === 'PARTIAL') {
      const fullBill = matchedProp
        ? matchedProp.totalAmountDue
        : (user.properties ? user.properties.filter((p: any) => p.status !== 'PAID').reduce((sum: number, p: any) => sum + p.totalAmountDue, 0) : 0);

      if (fullBill > 0) {
        const minAllowed = Number((fullBill * 0.20).toFixed(2));
        const maxAllowed = fullBill;
        if (amount < minAllowed - 0.01) {
          return { success: false, error: `Partial payment cannot be less than 20% (GH₵ ${minAllowed.toFixed(2)}) of the bill.` };
        }
        if (amount > maxAllowed + 0.01) {
          return { success: false, error: `Partial payment cannot exceed the total bill of GH₵ ${maxAllowed.toFixed(2)}.` };
        }
      }
    }

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
    const callbackTarget = data.callbackUrl
      ? (data.callbackUrl.includes('?') ? `${data.callbackUrl}&reference=${reference}` : `${data.callbackUrl}?reference=${reference}`)
      : `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/checkout/verify?reference=${reference}`;

    const response = await gateway.getProvider().initializeTransaction({
      email: `${user.phoneNumber}@propertyrate.kkma.gov.gh`,
      amount,
      reference,
      channels: data.channel === 'CARD' ? ['card'] : undefined,
      callbackUrl: callbackTarget,
      metadata: {
        userId: user.id,
        propertyIds: primaryPropertyId,
        settlementType,
        paymentChannel: data.channel || 'CARD',
        isSubscription: false,
        oneTimePayment: true,
        ...(data.metadata || {})
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

export async function recordBankTransferAction(data: {
  propertyId: string;
  settlementType: SettlementType;
  amount: number;
  bankName: string;
  treasuryAccount: string;
  depositorName: string;
  payerAccountNumber?: string;
}) {
  try {
    let user = await getAuthenticatedSession();
    if (!user && data.propertyId !== 'ALL') {
      user = (await resolvePropertyUser(data.propertyId, null)) as any;
    }
    if (!user) return { success: false, error: 'User session or property record not found' };

    let primaryPropertyId = '';
    let matchedProp: any = null;

    if (data.propertyId === 'ALL') {
      const unpaidProps = user.properties.filter((p: any) => p.status !== 'PAID');
      primaryPropertyId = unpaidProps[0]?.id;
    } else {
      matchedProp = user.properties?.find((p: any) => p.id === data.propertyId || p.accountNumber === data.propertyId);
      if (!matchedProp) {
        matchedProp = await prisma.property.findUnique({
          where: data.propertyId.startsWith('prop_') ? { id: data.propertyId } : { accountNumber: data.propertyId }
        });
      }
      primaryPropertyId = matchedProp?.id || data.propertyId;
    }

    if (!primaryPropertyId) return { success: false, error: 'No properties to settle.' };

    const reference = `TXN-WIRE-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

    await prisma.transaction.create({
      data: {
        userId: user.id,
        propertyId: primaryPropertyId,
        amount: data.amount,
        reference,
        status: 'PENDING',
        settlementType: data.settlementType,
        provider: 'BANK_WIRE',
        paymentPhoneNumber: data.payerAccountNumber || null,
      }
    });

    return {
      success: true,
      reference,
      status: 'PENDING',
      bankName: data.bankName,
      treasuryAccount: data.treasuryAccount,
      payerAccountNumber: data.payerAccountNumber,
      depositorName: data.depositorName,
    };
  } catch (error: any) {
    console.error('Bank transfer record error:', error);
    return { success: false, error: 'Failed to record bank transfer order.' };
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
  targetPropertyIds?: string[];
  accountNumberOverride?: string;
}) {
  try {
    let user = await getAuthenticatedSession();
    if (!user) {
      const lookupAcc = params.accountNumberOverride || (params.propertyId !== 'ALL' ? params.propertyId : null);
      if (lookupAcc) {
        user = (await resolvePropertyUser(lookupAcc, null)) as any;
      }
    }
    if (!user) return { success: false, error: 'User session or property record not found' };

    let propertyIds: string[] = [];
    let matchedProp: any = null;

    if (params.targetPropertyIds && params.targetPropertyIds.length > 0) {
      propertyIds = params.targetPropertyIds;
    } else if (params.propertyId === 'ALL') {
      propertyIds = (user.properties || []).filter((p: any) => p.status !== 'PAID').map((p: any) => p.id);
    } else {
      matchedProp = user.properties?.find((p: any) => p.id === params.propertyId || p.accountNumber === params.propertyId);
      if (!matchedProp) {
        matchedProp = await prisma.property.findUnique({
          where: params.propertyId.startsWith('prop_') ? { id: params.propertyId } : { accountNumber: params.propertyId }
        });
      }
      const resolvedId = matchedProp?.id || params.propertyId;
      propertyIds = [resolvedId];
    }

    if (propertyIds.length === 0 || !propertyIds[0]) {
      return { success: false, error: 'No unpaid properties found.' };
    }

    if (params.settlementType === 'PARTIAL') {
      const fullBill = matchedProp
        ? matchedProp.totalAmountDue
        : (user.properties ? user.properties.filter((p: any) => p.status !== 'PAID').reduce((sum: number, p: any) => sum + p.totalAmountDue, 0) : 0);

      if (fullBill > 0) {
        const minAllowed = Number((fullBill * 0.20).toFixed(2));
        const maxAllowed = fullBill;
        if (params.subtotal < minAllowed - 0.01) {
          return {
            success: false,
            error: `Partial payment cannot be less than 20% (GH₵ ${minAllowed.toFixed(2)}) of the total bill.`
          };
        }
        if (params.subtotal > maxAllowed + 0.01) {
          return {
            success: false,
            error: `Partial payment cannot exceed the total bill of GH₵ ${maxAllowed.toFixed(2)}.`
          };
        }
      }
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
  } catch (error: any) {
    console.error('Mobile Money charge error:', error);
    return { success: false, error: error?.message || 'Payment service unavailable.' };
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
    let user = await getAuthenticatedSession();
    if (!user && data.propertyId && data.propertyId !== 'ALL') {
      user = (await resolvePropertyUser(data.propertyId, null)) as any;
    }
    if (!user) return { success: false, error: 'User session or property record not found' };

    const settlementType = data.settlementType || 'TOTAL';
    let targetPropertyIds: string[] = [];

    if (!data.propertyId || data.propertyId === 'ALL') {
      targetPropertyIds = user.properties
        .filter((p) => p.status !== 'PAID')
        .map((p) => p.id);
    } else {
      let matchedProp: any = user.properties.find((p) => p.id === data.propertyId || p.accountNumber === data.propertyId);
      if (!matchedProp) {
        matchedProp = await prisma.property.findUnique({
          where: data.propertyId.startsWith('prop_') ? { id: data.propertyId } : { accountNumber: data.propertyId }
        });
      }
      targetPropertyIds = [matchedProp?.id || data.propertyId];
    }

    if (targetPropertyIds.length === 0) {
      return { success: false, error: 'No unpaid properties selected' };
    }

    let generatedReceiptNumber = '';
    let generatedReceiptId = '';

    let remainingPaymentPool = data.amount;

    for (const propId of targetPropertyIds) {
      if (remainingPaymentPool <= 0) break;

      let prop: any = user.properties.find((p: any) => p.id === propId || p.accountNumber === propId);
      if (!prop) {
        prop = await prisma.property.findUnique({
          where: propId.startsWith('prop_') ? { id: propId } : { accountNumber: propId }
        });
      }
      if (!prop) continue;

      let paymentAmount = 0;
      let newArrears = prop.arrears;
      let newCurrentFee = prop.currentFee;
      let newStatus: 'PAID' | 'PARTIALLY_PAID' | 'UNPAID' = 'PAID';

      if (settlementType === 'ARREARS') {
        paymentAmount = Math.min(remainingPaymentPool, prop.arrears);
        newArrears = Math.max(0, prop.arrears - paymentAmount);
        newStatus = newArrears === 0 && newCurrentFee === 0 ? 'PAID' : 'PARTIALLY_PAID';
        remainingPaymentPool -= paymentAmount;
      } else if (settlementType === 'CURRENT_FEE') {
        paymentAmount = Math.min(remainingPaymentPool, prop.currentFee);
        newCurrentFee = Math.max(0, prop.currentFee - paymentAmount);
        newStatus = newArrears === 0 && newCurrentFee === 0 ? 'PAID' : 'PARTIALLY_PAID';
        remainingPaymentPool -= paymentAmount;
      } else {
        // TOTAL or Partial with priority allocation (Arrears First)
        if (remainingPaymentPool >= prop.totalAmountDue) {
          paymentAmount = prop.totalAmountDue;
          newArrears = 0;
          newCurrentFee = 0;
          newStatus = 'PAID';
          remainingPaymentPool -= paymentAmount;
        } else {
          paymentAmount = remainingPaymentPool;
          remainingPaymentPool = 0;
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

    const formattedSms = twilioService.formatBillRolloutMessage({
      accountNumber: property.accountNumber,
      ownerName: property.users[0].name || 'Municipal Ratepayer',
      phoneNumber: property.users[0].phoneNumber,
      totalAmountDue: property.totalAmountDue,
      arrears: property.arrears,
      currentFee: property.currentFee,
      dueDate: '30-Jun-2025',
      municipality: property.municipality || 'Kpone-Katamanso (KKMA)',
      billYear: property.billYear || 2026,
    });

    return {
      success: true,
      recipientPhone: formattedSms.recipientPhone,
      recipientName: formattedSms.recipientName,
      messageText: formattedSms.messageText,
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

export interface PublicReceiptVerificationData {
  isValid: boolean;
  receiptNumber: string;
  amount: number;
  amountFormatted: string;
  settlementType: string;
  settlementScopeFormatted: string;
  paymentMethod: string;
  status: string;
  datePaidFormatted: string;
  timestamp: string;
  ratepayerName: string;
  propertyAccountNumber: string;
  propertyClassification: string;
  digitalAddress: string;
  municipality: string;
  fiscalYear: number;
  antiFraudCode: string;
  scannedImageUrl?: string | null;
}

export async function getPublicReceiptVerification(receiptNumber: string): Promise<PublicReceiptVerificationData | null> {
  try {
    if (!receiptNumber || !receiptNumber.trim()) return null;

    const receipt = await prisma.receipt.findUnique({
      where: { receiptNumber: receiptNumber.trim() },
      include: {
        property: true,
        user: true,
      },
    });

    if (!receipt) return null;

    const dt = new Date(receipt.datePaid || Date.now());
    const property = receipt.property;
    const user = receipt.user;

    const settlementScopeFormatted = receipt.settlementType === 'TOTAL'
      ? 'Full Annual Rate Assessment Settlement'
      : receipt.settlementType === 'ARREARS'
      ? 'Arrears Balance Settlement'
      : 'Current Fiscal Year Fee Settlement';

    const antiFraudCode = `KKMA-AUTH-${receipt.id.slice(0, 8).toUpperCase()}-${dt.getFullYear()}`;

    return {
      isValid: receipt.status?.toUpperCase() === 'PAID',
      receiptNumber: receipt.receiptNumber,
      amount: receipt.amount,
      amountFormatted: `GH₵ ${receipt.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      settlementType: receipt.settlementType,
      settlementScopeFormatted,
      paymentMethod: receipt.paymentMethod,
      status: receipt.status,
      datePaidFormatted: dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
      timestamp: dt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      ratepayerName: user?.name || 'Registered Municipal Ratepayer',
      propertyAccountNumber: property?.accountNumber || 'N/A',
      propertyClassification: property?.propertyClassification || 'RESIDENTIAL',
      digitalAddress: property?.ownerDigitalAddress || 'N/A',
      municipality: property?.municipality || 'Kpone-Katamanso Municipal Assembly (KKMA)',
      fiscalYear: property?.billYear || dt.getFullYear(),
      antiFraudCode,
      scannedImageUrl: (receipt as any).scannedImageUrl || null,
    };
  } catch (error) {
    console.error('Error verifying public receipt:', error);
    return null;
  }
}

