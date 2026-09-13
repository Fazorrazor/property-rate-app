import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { PaymentGateway } from '@/lib/payments/gateway';

interface UssdPayload {
  sessionID?: string;
  sessionId?: string;
  SessionId?: string;
  userID?: string;
  userId?: string;
  msisdn?: string;
  phoneNumber?: string;
  phone?: string;
  newSession?: boolean | string;
  userData?: string;
  message?: string;
  text?: string;
  userInput?: string;
  network?: string;
  operator?: string;
}

interface UssdSessionState {
  step: 'AWAITING_ACCOUNT' | 'AWAITING_PAYMENT_CONFIRMATION';
  accountNumber?: string;
  propertyId?: string;
  amountDue?: number;
  ownerName?: string;
  lastUpdated: number;
}

// In-memory session cache with 120s TTL (matching standard USSD session timeout)
const sessionStore = new Map<string, UssdSessionState>();
const SESSION_TTL_MS = 120 * 1000;

function cleanupExpiredSessions() {
  const now = Date.now();
  for (const [id, state] of sessionStore.entries()) {
    if (now - state.lastUpdated > SESSION_TTL_MS) {
      sessionStore.delete(id);
    }
  }
}

function normalizeGhanaPhone(phone: string): string {
  let cleaned = phone.replace(/[^0-9]/g, '');
  if (cleaned.startsWith('233') && cleaned.length === 12) {
    cleaned = '0' + cleaned.substring(3);
  }
  return cleaned;
}

function mapNetworkToPaystack(network?: string): 'mtn' | 'vod' | 'tgo' {
  if (!network) return 'mtn';
  const net = network.toUpperCase();
  if (net.includes('VOD') || net.includes('TELE') || net.includes('CASH')) return 'vod';
  if (net.includes('AIRTEL') || net.includes('TIGO') || net.includes('AT')) return 'tgo';
  return 'mtn';
}

function formatUssdResponse(sessionID: string, userID: string, message: string, continueSession: boolean) {
  return NextResponse.json({
    sessionID,
    userID,
    continueSession,
    message: message.trim(),
  });
}

export async function GET() {
  return NextResponse.json({
    status: 'ACTIVE',
    service: 'Municipal Property Rate USSD Gateway',
    shortCode: process.env.NEXT_PUBLIC_USSD_CODE || process.env.USSD_SHORT_CODE || '*227*4362#',
  });
}

export async function POST(req: NextRequest) {
  cleanupExpiredSessions();

  try {
    const body: UssdPayload = await req.json().catch(() => ({}));

    const sessionID = body.sessionID || body.sessionId || body.SessionId || `SESSION-${Date.now()}`;
    const rawPhone = body.userID || body.userId || body.msisdn || body.phoneNumber || body.phone || '';
    const rawInput = (body.userData ?? body.message ?? body.text ?? body.userInput ?? '').trim();
    const rawNetwork = body.network || body.operator || 'MTN';
    const isNewSession = body.newSession === true || body.newSession === 'true' || !sessionStore.has(sessionID);

    const payerPhone = normalizeGhanaPhone(rawPhone);

    // =========================================================================
    // HOP 1: NEW SESSION
    // =========================================================================
    if (isNewSession) {
      // Look up if this phone number is automatically linked to any property
      let linkedProperty = null;
      if (payerPhone.length >= 9) {
        const last9 = payerPhone.slice(-9);
        linkedProperty = await prisma.property.findFirst({
          where: {
            OR: [
              { owner: { mobileNumber: { contains: last9 } } },
              { owner: { tel: { contains: last9 } } },
              { users: { some: { phoneNumber: { contains: last9 } } } }
            ]
          },
          include: { owner: true }
        });
      }

      if (linkedProperty) {
        sessionStore.set(sessionID, {
          step: 'AWAITING_PAYMENT_CONFIRMATION',
          accountNumber: linkedProperty.accountNumber,
          propertyId: linkedProperty.id,
          amountDue: linkedProperty.totalAmountDue,
          ownerName: linkedProperty.owner?.name || 'Ratepayer',
          lastUpdated: Date.now()
        });

        const formattedDue = linkedProperty.totalAmountDue.toLocaleString('en-US', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        });

        const menuMsg = [
          `Welcome to KKMA Rates.`,
          `Account: ${linkedProperty.accountNumber}`,
          `Owner: ${linkedProperty.owner?.name || 'Ratepayer'}`,
          `Amount Due: GH₵ ${formattedDue}`,
          ``,
          `1. Pay Full (GH₵ ${formattedDue})`,
          `2. Enter Other Account No.`,
          `0. Exit`
        ].join('\n');

        return formatUssdResponse(sessionID, rawPhone, menuMsg, true);
      }

      // If no linked property, prompt for Account Number
      sessionStore.set(sessionID, {
        step: 'AWAITING_ACCOUNT',
        lastUpdated: Date.now()
      });

      const welcomeMsg = [
        `Welcome to KKMA Property Rate.`,
        ``,
        `Please enter your Valuation / Account Number:`,
        `(e.g. KKDA03188007 or 1002)`
      ].join('\n');

      return formatUssdResponse(sessionID, rawPhone, welcomeMsg, true);
    }

    // =========================================================================
    // SUBSEQUENT HOPS: RETRIEVE EXISTING SESSION
    // =========================================================================
    const session = sessionStore.get(sessionID);
    if (!session) {
      return formatUssdResponse(
        sessionID,
        rawPhone,
        'Session expired or invalid. Please dial the shortcode again to start.',
        false
      );
    }

    session.lastUpdated = Date.now();

    // =========================================================================
    // HOP 2: HANDLING ACCOUNT NUMBER ENTRY
    // =========================================================================
    if (session.step === 'AWAITING_ACCOUNT') {
      if (rawInput === '0' || rawInput.toLowerCase() === 'exit') {
        sessionStore.delete(sessionID);
        return formatUssdResponse(sessionID, rawPhone, 'Thank you for contacting KKMA Revenue.', false);
      }

      const property = await prisma.property.findFirst({
        where: {
          accountNumber: {
            equals: rawInput,
            mode: 'insensitive'
          }
        },
        include: { owner: true }
      });

      if (!property) {
        sessionStore.delete(sessionID);
        return formatUssdResponse(
          sessionID,
          rawPhone,
          `Account '${rawInput}' not found.\nPlease check your bill notice and dial again.\nEnquiries: 0256039385`,
          false
        );
      }

      session.step = 'AWAITING_PAYMENT_CONFIRMATION';
      session.accountNumber = property.accountNumber;
      session.propertyId = property.id;
      session.amountDue = property.totalAmountDue;
      session.ownerName = property.owner?.name || 'Ratepayer';
      sessionStore.set(sessionID, session);

      const formattedDue = property.totalAmountDue.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      });

      const billMsg = [
        `KKMA Property Bill`,
        `Account: ${property.accountNumber}`,
        `Owner: ${session.ownerName}`,
        `Outstanding: GH₵ ${formattedDue}`,
        ``,
        `1. Pay Full (GH₵ ${formattedDue})`,
        `0. Cancel`
      ].join('\n');

      return formatUssdResponse(sessionID, rawPhone, billMsg, true);
    }

    // =========================================================================
    // HOP 3: HANDLING PAYMENT CONFIRMATION
    // =========================================================================
    if (session.step === 'AWAITING_PAYMENT_CONFIRMATION') {
      if (rawInput === '0' || rawInput.toLowerCase() === 'cancel') {
        sessionStore.delete(sessionID);
        return formatUssdResponse(sessionID, rawPhone, 'Payment cancelled. Thank you.', false);
      }

      if (rawInput === '2') {
        // Switch back to manual account entry
        session.step = 'AWAITING_ACCOUNT';
        session.accountNumber = undefined;
        session.propertyId = undefined;
        session.amountDue = undefined;
        sessionStore.set(sessionID, session);

        return formatUssdResponse(
          sessionID,
          rawPhone,
          'Please enter your Valuation / Account Number:\n(e.g. KKDA03188007)',
          true
        );
      }

      if (rawInput === '1') {
        const amount = session.amountDue ?? 0;
        if (amount <= 0) {
          sessionStore.delete(sessionID);
          return formatUssdResponse(
            sessionID,
            rawPhone,
            `Account ${session.accountNumber} has zero outstanding balance (GH₵ 0.00). Thank you!`,
            false
          );
        }

        // 1. Ensure a User record exists for this payer phone number
        let user = await prisma.user.findFirst({
          where: {
            OR: [
              { phoneNumber: payerPhone },
              { phoneNumber: `+233${payerPhone.replace(/^0/, '')}` },
              { phoneNumber: payerPhone.replace(/^\+233/, '0') }
            ]
          }
        });

        if (!user) {
          user = await prisma.user.create({
            data: {
              phoneNumber: payerPhone,
              name: session.ownerName || 'USSD Ratepayer',
              role: 'RATEPAYER'
            }
          });
        }

        // 2. Create pending Transaction in database
        const uniqueSuffix = Math.floor(1000 + Math.random() * 9000);
        const reference = `TXN-USSD-${Date.now()}-${uniqueSuffix}`;

        await prisma.transaction.create({
          data: {
            userId: user.id,
            propertyId: session.propertyId!,
            amount,
            reference,
            status: 'PENDING',
            settlementType: 'TOTAL',
            provider: 'PAYSTACK',
            paymentPhoneNumber: payerPhone
          }
        });

        // 3. Dispatch Paystack Mobile Money Charge (prompt push to phone)
        const providerCode = mapNetworkToPaystack(rawNetwork);
        const gateway = new PaymentGateway('PAYSTACK');

        const chargeResponse = await gateway.getProvider().chargeMobileMoney({
          email: `${payerPhone}@propertyrate.kkma.gov.gh`,
          amount,
          reference,
          mobile_money: {
            phone: payerPhone,
            provider: providerCode
          },
          metadata: {
            userId: user.id,
            propertyIds: session.propertyId!,
            settlementType: 'TOTAL',
            channel: 'USSD',
            accountNumber: session.accountNumber
          }
        });

        sessionStore.delete(sessionID);

        const formattedDue = amount.toLocaleString('en-US', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        });

        if (!chargeResponse.success) {
          console.error('[USSD Paystack Error]', chargeResponse.error);
          return formatUssdResponse(
            sessionID,
            rawPhone,
            `Payment prompt failed: ${chargeResponse.error || 'Network busy'}.\nPlease try again later.`,
            false
          );
        }

        const successMsg = [
          `Payment prompt for GH₵ ${formattedDue} has been sent to your phone.`,
          ``,
          `Please enter your Mobile Money PIN on the popup prompt to authorize payment.`,
          `Ref: ${reference}`
        ].join('\n');

        return formatUssdResponse(sessionID, rawPhone, successMsg, false);
      }

      // Invalid selection
      return formatUssdResponse(
        sessionID,
        rawPhone,
        'Invalid option.\n1. Pay Full\n0. Cancel',
        true
      );
    }

    sessionStore.delete(sessionID);
    return formatUssdResponse(sessionID, rawPhone, 'Session ended.', false);
  } catch (error: any) {
    console.error('[USSD Route Error]', error);
    return NextResponse.json(
      {
        sessionID: 'ERROR',
        userID: '',
        continueSession: false,
        message: 'An unexpected system error occurred. Please try dialing again later.'
      },
      { status: 500 }
    );
  }
}
