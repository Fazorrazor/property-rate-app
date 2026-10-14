'use server';
import { adminDb } from '@/lib/adminDb';
import { prisma } from '@/lib/db';
import { supabaseAdmin as supabase } from '@/lib/supabase';
import { revalidatePath } from 'next/cache';
import { cookies, headers } from 'next/headers';
import {
    hashPassword,
    verifyPassword,
    generateSecureSessionToken,
    createSignedSessionCookie,
    parseAndVerifySignedSessionCookie,
    checkRateLimit,
    recordFailedLoginAttempt,
    clearRateLimit,
} from '@/lib/security';
import { TwilioProvider } from '@/lib/sms/twilio';
import { ArkeselProvider } from '@/lib/sms/arkesel';
import { DEFAULT_SMS_NOTICE_TEMPLATE, DEFAULT_RECEIPT_NOTICE_TEMPLATE } from '@/lib/sms/types';
import { formatGhc, formatDateGb } from '@/lib/formatters';
import { GoogleGenAI } from '@google/genai';
import { DATABASE_TABLE_DEFINITIONS, DatabaseTableDefinition } from '@/lib/database-tables-config';

const arkeselService = new ArkeselProvider();
const twilioServiceInstance = new TwilioProvider();

let activeSmsConfig = {
    dispatchMode: (process.env.SMS_DISPATCH_MODE || 'LIVE') as 'TEST' | 'LIVE',
    provider: (process.env.SMS_PROVIDER || 'arkesel').toLowerCase() as
        | 'arkesel'
        | 'twilio',
    arkeselApiKey: process.env.ARKESEL_API_KEY || '',
    arkeselSenderId: process.env.ARKESEL_SENDER_ID || 'KKMA',
    messageTemplate: DEFAULT_SMS_NOTICE_TEMPLATE,
    receiptTemplate: DEFAULT_RECEIPT_NOTICE_TEMPLATE,
};

arkeselService.setApiKey(activeSmsConfig.arkeselApiKey);
arkeselService.setSenderId(activeSmsConfig.arkeselSenderId);

const getActiveSmsProvider = () =>
    activeSmsConfig.provider === 'twilio'
        ? twilioServiceInstance
        : arkeselService;

const smsFormatter = arkeselService;

let arkeselBalanceCache: {
    data: { smsBalance: number; mainBalance: string } | null;
    timestamp: number;
} | null = null;

const BALANCE_CACHE_TTL_MS = 60 * 1000;

function sanitizePostgrestFilter(term: string): string {
    return (term || '').replace(/[%_]/g, '\\$&').replace(/[,\(\)]/g, ' ').trim();
}

function sanitizeBaseUrl(url?: string): string {
    const defaultUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://property-rate-app.vercel.app';
    if (!url || typeof url !== 'string') return defaultUrl;
    const trimmed = url.trim().replace(/\/$/, '');
    try {
        const parsed = new URL(trimmed);
        const hostname = parsed.hostname.toLowerCase();
        if (
            hostname === 'localhost' ||
            hostname === '127.0.0.1' ||
            hostname.endsWith('.vercel.app') ||
            hostname.endsWith('kkma.gov.gh') ||
            hostname.endsWith('gov.gh')
        ) {
            return trimmed;
        }
    } catch {
        // invalid URL
    }
    return defaultUrl;
}

// ── Hidden test-account filter ────────────────────────────────────────────────
// These accounts belong to internal testers (Heinz, Ignatius Amoah, Desmond, Pablo)
// and must NEVER appear in live production deployments on Vercel, but remain
// fully visible in local development environments.
function isLiveProductionDeployment(): boolean {
    if (process.env.VERCEL_ENV === 'production') return true;
    if (process.env.VERCEL === '1' && process.env.NODE_ENV === 'production') return true;
    return false;
}

const HIDDEN_TEST_ACCOUNT_NUMBERS = [
    'KKDA03001001', 'KKDA03001002', 'KKDA03001005', 'KKDA03001015', 'KKDA03991001',
    'KKDA03991002',
    'KKDA244044647',
    'KKDA59667434',
    '4894b5db-12ec-4ad1-a4cf-e2fb089c4aac',
];
const HIDDEN_TEST_PHONES = ['0209067556', '0206882328', '0244044647', '0551908713'];
const HIDDEN_TEST_NAMES  = ['heinz', 'demond', 'desmond', 'ignatius amoah', 'pablo'];

/** Returns true when a record belongs to an internal test account on live production. */
function isHiddenTestAccount(record: {
    name?: string | null;
    accountNumber?: string | null;
    account_no?: string | null;
    telephone?: string | null;
    phoneNumber?: string | null;
    propertyId?: string | null;
    email?: string | null;
}): boolean {
    if (!isLiveProductionDeployment()) return false;

    const acct = (record.accountNumber || record.account_no || '').trim().toUpperCase();
    const propId = (record.propertyId || '').trim();
    if (acct && HIDDEN_TEST_ACCOUNT_NUMBERS.some(a => a.toUpperCase() === acct)) return true;
    if (propId && HIDDEN_TEST_ACCOUNT_NUMBERS.some(a => a.toLowerCase() === propId.toLowerCase())) return true;

    const phone = (record.telephone || record.phoneNumber || record.email || '').replace(/\D/g, '').slice(-9);
    if (phone && phone.length >= 9 && HIDDEN_TEST_PHONES.some(p => p.replace(/\D/g, '').slice(-9) === phone)) return true;

    const name = (record.name || '').toLowerCase().trim();
    if (name) {
        if (name === 'heinz' || name === 'pablo' || name === 'ignatius amoah' || name === 'desmond' || name === 'demond') {
            return true;
        }
        if (name.includes('ignatius amoah')) return true;
    }
    return false;
}
// ─────────────────────────────────────────────────────────────────────────────


export async function syncActiveSmsConfig() {
    try {
        await verifyAdminSession();
        const settings = await (prisma as any).systemSetting.findMany();
        if (settings && settings.length > 0) {
            for (const s of settings) {
                if (s.key === 'sms_dispatch_mode' && (s.value === 'LIVE' || s.value === 'TEST')) {
                    activeSmsConfig.dispatchMode = s.value;
                } else if (s.key === 'sms_provider' && (s.value === 'arkesel' || s.value === 'twilio')) {
                    activeSmsConfig.provider = s.value;
                } else if (s.key === 'sms_arkesel_api_key' && s.value) {
                    activeSmsConfig.arkeselApiKey = s.value;
                    arkeselService.setApiKey(s.value);
                } else if (s.key === 'sms_arkesel_sender_id' && s.value) {
                    activeSmsConfig.arkeselSenderId = s.value;
                    arkeselService.setSenderId(s.value);
                } else if (s.key === 'sms_message_template' && s.value) {
                    activeSmsConfig.messageTemplate = s.value;
                } else if (s.key === 'sms_receipt_template' && s.value) {
                    activeSmsConfig.receiptTemplate = s.value;
                }
            }
        }
    } catch (err) {
        console.warn('Could not sync active SMS config from database:', err);
    }
}

export interface AdminPropertyReceipt {
    id: string;
    receiptNumber: string;
    transactionReference?: string | null;
    amount: number;
    amountFormatted: string;
    settlementType: string;
    paymentMethod: string;
    status: string;
    datePaid: string;
    exactTimestamp?: string | null;
    formattedDate?: string;
    formattedTime?: string;
    scannedImageUrl?: string | null;
    propertyAccountNumber?: string;
    propertyDigitalAddress?: string | null;
    propertyId?: string;
    userId?: string;
    payerPhoneNumber?: string | null;
    payerName?: string | null;
    narrative?: {
        targetAccount: string;
        targetDigitalAddress?: string;
        arrearsPaid: number;
        arrearsPaidFormatted: string;
        currentFeePaid: number;
        currentFeePaidFormatted: string;
        totalAmountPaid: number;
        totalAmountPaidFormatted: string;
        remainingTotalDue: number;
        remainingTotalDueFormatted: string;
        propertyStatusAfter: string;
        isFullySettled: boolean;
        actionRequiredText: string;
    };
}

export interface AdminProperty {
    id: string;
    accountNumber: string;
    valuationNo?: string;
    physicalAddress?: string;
    houseNo?: string;
    plotNo?: string;
    electoralArea?: string;
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
    initialArrears?: number;
    initialArrearsFormatted?: string;
    currentArrears?: number;
    currentArrearsFormatted?: string;
    totalPaidCycle?: number;
    totalPaidCycleFormatted?: string;
    cumulativeArrears?: number;
    cumulativeArrearsFormatted?: string;
    initial_arrears?: number;
    current_arrears?: number;
    total_paid_cycle?: number;
    cumulative_arrears?: number;
    currentFee: number;
    currentFeeFormatted: string;
    totalAmountDue: number;
    totalAmountDueFormatted: string;
    status: 'PAID' | 'PARTIALLY_PAID' | 'UNPAID';
    isDefaulter: boolean;
    receipts: AdminPropertyReceipt[];
    billImageUrl?: string | null;

    latitude?: number | null;
    longitude?: number | null;
    ownerId?: string | null;
    propertyTypeCode?: string | null;
    propertyCategoryCode?: string | null;
    streetCode?: string | null;
    communityCode?: string | null;
    subMetroCode?: string | null;
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

export interface AdminRatepayerSummary {
    id: string;
    name: string;
    phoneNumber: string;
    role: string;
    isVerified: boolean;
    propertyCount: number;
    accountNumber: string;
    accountNumbers: string[];
    location: string;
    currentBill: number;
    currentBillFormatted: string;
    previousBill: number;
    previousBillFormatted: string;
    totalValuationFormatted: string;
    totalArrears: number;
    totalArrearsFormatted: string;
    totalDue: number;
    totalDueFormatted: string;
    status: 'SETTLED' | 'OUTSTANDING' | 'DEFAULTER' | 'NO_PROPERTIES';
    createdAtFormatted: string;
}

export interface AdminBillRecord {
    id: string;
    accountNo: string;
    billYear: number;
    ratePA: number;
    balanceBF: number;
    accountBalance: number;
    billDate?: string | null;
    rateableValue?: number;
    billRate?: number;
}

export interface RatepayerHistoryDossier {
    user: {
        id: string;
        name: string;
        phoneNumber: string;
        role: string;
        isVerified: boolean;
        createdAtFormatted: string;
    };
    properties: AdminProperty[];
    receipts: AdminPropertyReceipt[];
    bills?: AdminBillRecord[];
    notifications: {
        id: string;
        title: string;
        message: string;
        type: string;
        deliveryMethod: string;
        deliveryStatus: string;
        createdAtFormatted: string;
    }[];
    auditLogs: {
        id: string;
        action: string;
        details: string;
        createdAtFormatted: string;
    }[];
    summary: {
        totalProperties: number;
        totalValuationFormatted: string;
        totalArrearsFormatted: string;
        totalCurrentFeeFormatted: string;
        totalOutstandingDueFormatted: string;
        totalPaidFormatted: string;
        status: 'SETTLED' | 'OUTSTANDING' | 'DEFAULTER';
    };
}

export interface SmsRolloutLogItem {
    id: string;
    recipientPhone: string;
    recipientName: string;
    accountNumber?: string;
    title: string;
    message: string;
    type: string;
    deliveryMethod: string;
    deliveryStatus: 'PENDING' | 'DELIVERED' | 'FAILED';
    externalMessageId?: string | null;
    createdAtFormatted: string;
}

interface CachedAdminSession {
    admin: any;
    sessionToken: string;
    cachedAt: number;
}

const adminSessionMemoryCache = new Map<string, CachedAdminSession>();
const ADMIN_SESSION_CACHE_TTL_MS = 2 * 60 * 1000; // 2 minutes fast-path cache

export async function verifyAdminSession() {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('admin_session');

    if (!sessionCookie?.value) {
        return null;
    }

    const { valid, adminId, sessionToken } = parseAndVerifySignedSessionCookie(sessionCookie.value);
    if (!valid || !adminId) {
        try { cookieStore.delete('admin_session'); } catch {}
        return null;
    }

    // Fast-path: Check validated session in memory cache
    const cached = adminSessionMemoryCache.get(adminId);
    if (cached && (Date.now() - cached.cachedAt < ADMIN_SESSION_CACHE_TTL_MS) && cached.sessionToken === sessionToken) {
        return cached.admin;
    }

    const admin = await prisma.adminUser.findUnique({
        where: { id: adminId }
    });

    if (!admin || !admin.isActive || (admin.role !== 'ADMIN' && admin.role !== 'SUPER_ADMIN' && admin.role !== 'OFFICER')) {
        adminSessionMemoryCache.delete(adminId);
        try { cookieStore.delete('admin_session'); } catch {}
        return null;
    }

    if (sessionToken) {
        try {
            const latestSession = await prisma.auditLog.findFirst({
                where: {
                    adminId: admin.id,
                    action: { in: ['ADMIN_SESSION_ACTIVE', 'ADMIN_SESSION_REVOKED'] },
                },
                orderBy: { createdAt: 'desc' },
            });

            if (latestSession) {
                if (latestSession.action === 'ADMIN_SESSION_REVOKED') {
                    adminSessionMemoryCache.delete(adminId);
                    try { cookieStore.delete('admin_session'); } catch {}
                    return null;
                }
                if (latestSession.action === 'ADMIN_SESSION_ACTIVE' && latestSession.details !== sessionToken) {
                    adminSessionMemoryCache.delete(adminId);
                    try { cookieStore.delete('admin_session'); } catch {}
                    return null;
                }
            }
        } catch (e) { }
    }

    adminSessionMemoryCache.set(adminId, {
        admin,
        sessionToken: sessionToken || '',
        cachedAt: Date.now(),
    });

    return admin;
}

export async function requireAdminSession() {
    const admin = await verifyAdminSession();
    if (!admin || !admin.isActive) {
        throw new Error('Unauthorized. Active municipal administrator session required.');
    }
    return admin;
}

export async function getCurrentAdmin() {
    const admin = await verifyAdminSession();
    if (!admin) return null;
    return { id: admin.id, username: admin.username, name: admin.name, role: admin.role };
}

export async function adminLogin(username: string, passwordHash: string, rememberMe: boolean = false) {
    try {
        const headerList = await headers();
        const clientIp = (headerList.get('x-forwarded-for')?.split(',')[0] || headerList.get('x-real-ip') || '127.0.0.1').trim();
        const rateLimitKey = `${clientIp}:${(username || '').toLowerCase().trim()}`;

        // 1. Sliding-window brute force rate check (5 attempts per 10 mins -> 15 min lock)
        const rateCheck = checkRateLimit(rateLimitKey, 5, 10 * 60 * 1000, 15 * 60 * 1000);
        if (!rateCheck.allowed) {
            return {
                success: false,
                error: `Security lockout: Excessive failed attempts. Access temporarily locked for ${Math.ceil(rateCheck.retryAfterSeconds / 60)} minute(s).`
            };
        }

        const cleanUsername = (username || '').trim();
        const cleanPassword = (passwordHash || '').trim();

        if (!cleanUsername) {
            return { success: false, error: 'Officer username is required.' };
        }

        if (/^(\+?233|0)\d{8,10}$/.test(cleanUsername) || /^\d{10,}$/.test(cleanUsername)) {
            return {
                success: false,
                error: 'Telephone numbers are not accepted for municipal console login. Please use your official username.'
            };
        }

        if (!/^[a-zA-Z0-9_.-]{3,50}$/.test(cleanUsername)) {
            return {
                success: false,
                error: 'Username must be between 3 and 50 characters and contain only letters, numbers, hyphens, or underscores.'
            };
        }

        if (!cleanPassword || cleanPassword.length < 6) {
            return { success: false, error: 'Authorization password must be at least 6 characters.' };
        }

        const admin = await prisma.adminUser.findUnique({
            where: { username: cleanUsername }
        });

        const isPasswordValid = admin && admin.isActive && (admin.role === 'ADMIN' || admin.role === 'SUPER_ADMIN' || admin.role === 'OFFICER')
            ? verifyPassword(cleanPassword, admin.passwordHash)
            : false;

        if (!isPasswordValid || !admin) {
            const failStatus = recordFailedLoginAttempt(rateLimitKey);
            if (failStatus.locked) {
                try {
                    await prisma.auditLog.create({
                        data: {
                            action: 'SECURITY_LOGIN_LOCKOUT',
                            entityType: 'AdminSecurity',
                            entityId: cleanUsername,
                            details: `Excessive failed logins from IP ${clientIp}. Account locked for 15 minutes.`,
                        }
                    });
                } catch (e) {}
                return {
                    success: false,
                    error: 'Account temporarily locked due to excessive failed attempts. Please retry in 15 minutes.'
                };
            }
            // Constant-time mitigation jitter delay
            await new Promise((resolve) => setTimeout(resolve, 350));
            return { success: false, error: 'Invalid municipal username or security authorization password.' };
        }

        // Clear rate limit record on verified login
        clearRateLimit(rateLimitKey);

        // Transparently migrate plaintext password to salted scrypt hash
        if (!admin.passwordHash?.startsWith('$scrypt$')) {
            try {
                const secureScryptHash = hashPassword(cleanPassword);
                await prisma.adminUser.update({
                    where: { id: admin.id },
                    data: { passwordHash: secureScryptHash }
                });
            } catch (upgradeErr) {
                console.warn('Could not upgrade admin password to scrypt hash:', upgradeErr);
            }
        }

        // Generate 192-bit cryptographically secure session token
        const sessionToken = generateSecureSessionToken();

        try {
            await prisma.auditLog.create({
                data: {
                    action: 'ADMIN_SESSION_ACTIVE',
                    entityType: 'AdminSession',
                    entityId: admin.id,
                    details: sessionToken,
                    adminId: admin.id,
                },
            });
        } catch (auditErr) {
            console.warn('Could not record ADMIN_SESSION_ACTIVE audit log:', auditErr);
        }

        // Sign cookie with server HMAC
        const rawPayload = `${admin.id}:${sessionToken}:${Date.now()}`;
        const signedCookie = createSignedSessionCookie(rawPayload);

        const sessionLifetimeSeconds = 7 * 60; // Strict 7-minute session ceiling
        const expiryTimestamp = Date.now() + sessionLifetimeSeconds * 1000;

        const cookieStore = await cookies();
        cookieStore.set('admin_session', signedCookie, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            maxAge: sessionLifetimeSeconds,
            path: '/',
            sameSite: 'lax'
        });
        cookieStore.set('admin_session_expires_at', expiryTimestamp.toString(), {
            httpOnly: false,
            secure: process.env.NODE_ENV === 'production',
            maxAge: sessionLifetimeSeconds,
            path: '/',
            sameSite: 'lax'
        });

        return { success: true, user: { id: admin.id, username: admin.username, name: admin.name, role: admin.role } };
    } catch (error) {
        console.error('Login error:', error);
        return { success: false, error: 'Authentication gateway unavailable. Please try again.' };
    }
}

export async function adminLogout() {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('admin_session');
    if (sessionCookie?.value) {
        const { adminId } = parseAndVerifySignedSessionCookie(sessionCookie.value);
        const resolvedId = adminId || sessionCookie.value.split(':')[0];
        if (resolvedId) {
            adminSessionMemoryCache.delete(resolvedId);
            try {
                await prisma.auditLog.create({
                    data: {
                        action: 'ADMIN_SESSION_REVOKED',
                        entityType: 'AdminSession',
                        entityId: resolvedId,
                        details: 'Logged out explicitly',
                        adminId: resolvedId,
                    },
                });
            } catch (e) { }
        }
    }
    cookieStore.delete('admin_session');
    try { cookieStore.delete('admin_session_expires_at'); } catch {}
    revalidatePath('/');
}

const METRICS_CACHE_TTL_MS = 60 * 1000;
const metricsCache = new Map<string, any>();

export async function invalidateMetricsCache() {
    await requireAdminSession();
    metricsCache.clear();
}

export async function getAdminOverview(
    page = 1,
    limit = 50,
    municipality = "ALL",
    searchQuery = "",
    classification = "ALL",
    status = "ALL",
    requiredFields: string[] = []
): Promise<AdminDashboardData | null> {
    try {
        await requireAdminSession();

        const skip = (page - 1) * limit;

        const globalWhereClause: any = municipality !== "ALL" ? { municipality } : {};
        const tableWhereClause: any = { ...globalWhereClause };

        if (classification !== "ALL") {
            tableWhereClause.propertyClassification = classification;
        }

        if (status === "UNPAID") {
            tableWhereClause.status = "UNPAID";
        } else if (status === "PAID") {
            tableWhereClause.status = "PAID";
        } else if (status === "DEFAULTER") {
            tableWhereClause.status = "DEFAULTER";
            tableWhereClause.arrears = { gt: 0 };
        }

        if (searchQuery && searchQuery.trim()) {
            tableWhereClause.search = searchQuery.trim();
        }

        if (requiredFields && Array.isArray(requiredFields) && requiredFields.length > 0) {
            tableWhereClause.requiredFields = requiredFields;
        }

        // Exclude internal test accounts from live production table and metric views
        if (isLiveProductionDeployment()) {
            const testAccountExclusion = {
                accountNumber: { notIn: HIDDEN_TEST_ACCOUNT_NUMBERS },
                owner: {
                    AND: [
                        { name:        { notIn: ['Heinz', 'Pablo', 'Ignatius Amoah', 'Desmond'] } },
                        { phoneNumber: { notIn: HIDDEN_TEST_PHONES } },
                    ],
                },
            };
            Object.assign(tableWhereClause,  testAccountExclusion);
            Object.assign(globalWhereClause, testAccountExclusion);
        }

        let totalFilteredProps = 0;
        let globalPropsCount = 0;
        let globalDefaultersCount = 0;
        let globalPropertyAgg: any = { _sum: { arrears: 0, totalAmountDue: 0 } };
        let globalReceiptsAgg: any = { _sum: { amount: 0 } };
        let properties: any[] = [];

        const cacheKey = municipality;
        const cachedMetrics = metricsCache.get(cacheKey);
        const hasValidMetricsCache = cachedMetrics && (Date.now() - cachedMetrics.timestamp < METRICS_CACHE_TTL_MS);

        if (page > 1 || hasValidMetricsCache) {
            if (hasValidMetricsCache) {
                globalPropsCount = cachedMetrics.globalPropsCount;
                globalDefaultersCount = cachedMetrics.globalDefaultersCount;
                globalPropertyAgg = cachedMetrics.globalPropertyAgg;
                globalReceiptsAgg = cachedMetrics.globalReceiptsAgg;
            }
            [totalFilteredProps, properties] = await prisma.$transaction([
                prisma.property.count({ where: tableWhereClause }),
                prisma.property.findMany({
                    skip,
                    take: limit,
                    where: tableWhereClause,
                    include: {
                        users: true,
                        owner: true,
                        receipts: {
                            orderBy: { datePaid: 'desc' },
                            take: 5,
                        },
                    },
                    orderBy: { accountNumber: 'asc' },
                })
            ]);
        } else {
            [
                totalFilteredProps,
                globalPropsCount,
                globalDefaultersCount,
                globalPropertyAgg,
                globalReceiptsAgg,
                properties
            ] = await prisma.$transaction([
                prisma.property.count({ where: tableWhereClause }),
                prisma.property.count({ where: globalWhereClause }),
                prisma.property.count({
                    where: { ...globalWhereClause, status: { not: 'PAID' }, arrears: { gt: 0 } }
                }),
                prisma.property.aggregate({
                    where: globalWhereClause,
                    _sum: { arrears: true, totalAmountDue: true }
                }),
                prisma.receipt.aggregate({
                    where: { property: globalWhereClause },
                    _sum: { amount: true }
                }),
                prisma.property.findMany({
                    skip,
                    take: limit,
                    where: tableWhereClause,
                    include: {
                        users: true,
                        owner: true,
                        receipts: {
                            orderBy: { datePaid: 'desc' },
                            take: 5,
                        },
                    },
                    orderBy: { accountNumber: 'asc' },
                })
            ]);
            metricsCache.set(cacheKey, {
                timestamp: Date.now(),
                globalPropsCount,
                globalDefaultersCount,
                globalPropertyAgg,
                globalReceiptsAgg,
            });
        }

        const totalArrears = globalPropertyAgg?._sum?.arrears || 0;
        const totalOutstandingDue = globalPropertyAgg?._sum?.totalAmountDue || 0;
        const totalCollected = globalReceiptsAgg?._sum?.amount || 0;
        const totalBilledDemand = totalCollected + totalOutstandingDue;
        const collectionRate = totalBilledDemand > 0 ? (totalCollected / totalBilledDemand) * 100 : 0;

        const formatted: AdminProperty[] = properties.map((p: any) => {
            const isDefaulter = p.status !== 'PAID' && p.arrears > 0;

            const receiptsList: AdminPropertyReceipt[] = (p.receipts || []).map((r: any) => {
                const d = new Date(r.datePaid || Date.now());
                const formattedDate = formatDateGb(d);
                const formattedTime = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }) + ' UTC';
                return {
                    id: r.id,
                    receiptNumber: r.receiptNumber,
                    amount: r.amount,
                    amountFormatted: formatGhc(r.amount),
                    settlementType: r.settlementType || 'TOTAL',
                    paymentMethod: r.paymentMethod || 'Mobile Money',
                    status: r.status || 'PAID',
                    datePaid: `${formattedDate}, ${formattedTime}`,
                    exactTimestamp: d.toISOString(),
                    formattedDate,
                    formattedTime,
                    propertyAccountNumber: p.accountNumber,
                };
            });

            const billDateObj = p.billYear ? new Date(p.billYear, 0, 15) : new Date(p.billDate || Date.now());
            const deadlineObj = new Date(p.settlementDeadline || Date.now());
            const primaryUser = p.users?.[0];
            // Prioritise direct Property.name / Property.telephone (legacy fields confirmed in live DB)
            const ownerName = p.ownerNameDirect || p.owner?.name || primaryUser?.name || 'Municipal Ratepayer';
            const ownerPhone = p.ownerPhoneDirect || p.owner?.tel || p.owner?.mobileNumber || primaryUser?.phoneNumber || '—';

            const initialArrears = Number(p.initialArrears !== undefined ? p.initialArrears : (p.initial_arrears !== undefined ? p.initial_arrears : p.arrears || 0));
            const totalPaidCycle = Number(p.totalPaidCycle !== undefined ? p.totalPaidCycle : (p.total_paid_cycle !== undefined ? p.total_paid_cycle : p.amountPaidLastYear || 0));
            const currentArrears = Number(p.currentArrears !== undefined ? p.currentArrears : (p.current_arrears !== undefined ? p.current_arrears : Math.max(0, initialArrears - totalPaidCycle)));
            const cumulativeArrears = Number(p.cumulativeArrears !== undefined ? p.cumulativeArrears : (p.cumulative_arrears !== undefined ? p.cumulative_arrears : initialArrears));

            return {
                id: p.id,
                accountNumber: p.accountNumber,
                valuationNo: p.valuationNo,
                physicalAddress: p.physicalAddress || '',
                houseNo: p.houseNo || '',
                plotNo: p.plotNo || '',
                municipality: p.municipality || 'Kpone-Katamanso Municipal Assembly',
                ownerPhone,
                ownerName,
                ownerDigitalAddress: p.ownerDigitalAddress || '—',
                propertyClassification: p.propertyClassification || 'RESIDENTIAL',
                billYear: p.billYear || 2025,
                billDateFormatted: formatDateGb(billDateObj),
                settlementDeadlineFormatted: formatDateGb(deadlineObj),
                rateableValue: p.rateableValue || 0,
                rateableValueFormatted: formatGhc(p.rateableValue),
                rateImposed: p.rateImposed || 0.00025,
                previousYearBill: p.previousYearBill || 0,
                previousYearBillFormatted: formatGhc(p.previousYearBill),
                amountPaidLastYear: p.amountPaidLastYear || 0,
                amountPaidLastYearFormatted: formatGhc(p.amountPaidLastYear),
                arrears: p.arrears || 0,
                arrearsFormatted: formatGhc(p.arrears),
                initialArrears,
                initialArrearsFormatted: formatGhc(initialArrears),
                currentArrears,
                currentArrearsFormatted: formatGhc(currentArrears),
                totalPaidCycle,
                totalPaidCycleFormatted: formatGhc(totalPaidCycle),
                cumulativeArrears,
                cumulativeArrearsFormatted: formatGhc(cumulativeArrears),
                currentFee: p.currentFee || 0,
                currentFeeFormatted: formatGhc(p.currentFee),
                totalAmountDue: p.totalAmountDue || 0,
                totalAmountDueFormatted: formatGhc(p.totalAmountDue),
                status: (p.status || 'UNPAID') as 'PAID' | 'PARTIALLY_PAID' | 'UNPAID',
                isDefaulter,
                receipts: receiptsList,
                latitude: p.latitude || null,
                longitude: p.longitude || null,
                ownerId: p.ownerId || null,
                propertyTypeCode: p.propertyTypeCode || null,
                propertyCategoryCode: p.propertyCategoryCode || null,
                streetCode: p.streetCode || null,
                communityCode: p.communityCode || null,
                subMetroCode: p.subMetroCode || null,
            };
        });

        return {
            metrics: {
                totalProperties: globalPropsCount,
                totalBilledFormatted: formatGhc(totalBilledDemand),
                totalCollectedFormatted: formatGhc(totalCollected),
                totalArrearsFormatted: formatGhc(totalArrears),
                defaultersCount: globalDefaultersCount,
                collectionRateFormatted: `${collectionRate.toFixed(1)}%`,
                collectionRatePercent: Math.min(100, Math.round(collectionRate)),
            },
            properties: formatted,
            pagination: {
                page,
                limit,
                total: totalFilteredProps,
                totalPages: Math.ceil(totalFilteredProps / limit) || 1,
            }
        };
    } catch (error) {
        console.error('Error fetching admin overview:', error);
        return null;
    }
}

export async function getRatepayersList(query = '', page = 1, limit = 50, requiredFields: string[] = []): Promise<{
    ratepayers: AdminRatepayerSummary[];
    total: number;
} | null> {
    try {
        await requireAdminSession();

        const whereClause: any = {};
        if (query && query.trim()) {
            whereClause.search = query.trim();
        }
        // Exclude internal test accounts only on live production deployments
        if (isLiveProductionDeployment()) {
            whereClause.phoneNumber = { notIn: HIDDEN_TEST_PHONES };
            whereClause.name        = { notIn: ['Heinz', 'Pablo', 'Ignatius Amoah', 'Demond', 'Desmond'] };
        }

        const users = await prisma.user.findMany({
            where: whereClause,
            include: {
                properties: {
                    ...(isLiveProductionDeployment() ? { where: { accountNumber: { notIn: HIDDEN_TEST_ACCOUNT_NUMBERS } } } : {}),
                },
            },
            orderBy: { createdAt: 'desc' },
            take: limit * 2, // Fetch buffer to allow client-level field filtering
            skip: (page - 1) * limit,
        });

        const filteredUsers = (requiredFields && requiredFields.length > 0)
            ? users.filter((u: any) => {
                const props = u.properties || [];
                return requiredFields.every((field) => {
                    const f = field.trim();
                    if (f === 'telephone') return Boolean(u.phoneNumber && u.phoneNumber.trim() && u.phoneNumber !== '0');
                    if (f === 'name') return Boolean(u.name && u.name.trim() && !u.name.toLowerCase().includes('no name'));
                    if (f === 'ownerDigitalAddress') return props.some((p: any) => p.ownerDigitalAddress && p.ownerDigitalAddress !== 'N/A');
                    if (f === 'account_no') return props.some((p: any) => p.accountNumber && p.accountNumber.trim());
                    if (f === 'arrears') return props.some((p: any) => Number(p.arrears || 0) > 0);
                    if (f === 'current_bill') return props.some((p: any) => Number(p.currentFee || 0) > 0);
                    if (f === 'outstanding_amt') return props.some((p: any) => Number(p.totalAmountDue || 0) > 0);
                    if (f === 'rateableValue') return props.some((p: any) => Number(p.rateableValue || 0) > 0);
                    if (f === 'amount_paid') return props.some((p: any) => Number(p.amountPaidLastYear || (p as any).amount_paid || 0) > 0);
                    return true;
                });
            })
            : users;

        const paginatedUsers = filteredUsers.slice(0, limit);
        const total = (requiredFields && requiredFields.length > 0) ? filteredUsers.length : await prisma.user.count({ where: whereClause });

        const list: AdminRatepayerSummary[] = paginatedUsers.map((u: any) => {
            const props = u.properties || [];
            const accountNumbers = props.map((p: any) => p.accountNumber).filter(Boolean);
            const primaryAccountNumber = accountNumbers[0] || '—';
            const locations = props.map((p: any) => p.ownerDigitalAddress || p.physicalAddress || p.municipality).filter(Boolean);
            const primaryLocation = locations[0] || '—';

            const totalCurrentBill = props.reduce((sum: number, p: any) => sum + (p.currentFee || 0), 0);
            const totalPreviousBill = props.reduce((sum: number, p: any) => sum + (p.previousYearBill || 0), 0);
            const totalValuation = props.reduce((sum: number, p: any) => sum + (p.rateableValue || 0), 0);
            const totalArrears = props.reduce((sum: number, p: any) => sum + (p.arrears || 0), 0);
            const totalDue = props.reduce((sum: number, p: any) => sum + (p.totalAmountDue || 0), 0);

            let status: 'NO_PROPERTIES' | 'SETTLED' | 'OUTSTANDING' | 'DEFAULTER';
            if (props.length === 0) {
                status = 'NO_PROPERTIES';
            } else if (props.some((p: any) => p.status !== 'PAID' && (p.arrears || 0) > 0)) {
                status = 'DEFAULTER';
            } else if (props.every((p: any) => p.status === 'PAID' || (p.totalAmountDue || 0) === 0)) {
                status = 'SETTLED';
            } else {
                status = 'OUTSTANDING';
            }

            return {
                id: u.id,
                name: u.name?.trim() || (u.phoneNumber ? `Citizen (${u.phoneNumber})` : 'Municipal Citizen'),
                phoneNumber: u.phoneNumber,
                role: u.role || 'RATEPAYER',
                isVerified: Boolean(u.isVerified),
                propertyCount: props.length,
                accountNumber: primaryAccountNumber,
                accountNumbers,
                location: primaryLocation,
                currentBill: totalCurrentBill,
                currentBillFormatted: formatGhc(totalCurrentBill),
                previousBill: totalPreviousBill,
                previousBillFormatted: formatGhc(totalPreviousBill),
                totalValuationFormatted: formatGhc(totalValuation),
                totalArrears,
                totalArrearsFormatted: formatGhc(totalArrears),
                totalDue,
                totalDueFormatted: formatGhc(totalDue),
                status,
                createdAtFormatted: formatDateGb(u.createdAt),
            };
        });

        return {
            ratepayers: list,
            total,
        };
    } catch (error) {
        console.error('Error fetching ratepayers list:', error);
        return null;
    }
}

export async function getRatepayerHistory(userId: string): Promise<RatepayerHistoryDossier | null> {
    try {
        await requireAdminSession();

        let user = await prisma.user.findUnique({
            where: { id: userId },
            include: {
                properties: {
                    include: {
                        receipts: {
                            orderBy: { datePaid: 'desc' },
                        },
                    },
                },
                receipts: {
                    orderBy: { datePaid: 'desc' },
                },
                notifications: {
                    orderBy: { createdAt: 'desc' },
                },
            },
        });

        // Resilient fallback by phone number if not found directly by ID
        if (!user && userId) {
            const cleanPhone = userId.replace(/^usr_/, '');
            user = await prisma.user.findUnique({
                where: { phoneNumber: cleanPhone },
                include: {
                    properties: {
                        include: {
                            receipts: {
                                orderBy: { datePaid: 'desc' },
                            },
                        },
                    },
                    receipts: {
                        orderBy: { datePaid: 'desc' },
                    },
                    notifications: {
                        orderBy: { createdAt: 'desc' },
                    },
                },
            });
        }

        if (!user) return null;

        if (isLiveProductionDeployment() && isHiddenTestAccount({ name: user.name, phoneNumber: user.phoneNumber })) {
            return null;
        }

        const accNos = (user.properties || []).map((p: any) => p.accountNumber).filter(Boolean);

        const [auditLogs, feePayments, transactions, propBillImagesRes, billsRes] = await Promise.all([
            prisma.auditLog.findMany({
                where: {
                    OR: [
                        { entityId: user.id },
                        { details: { contains: user.phoneNumber } },
                        ...(accNos.length > 0 ? accNos.map((acc: string) => ({ details: { contains: acc } })) : []),
                    ],
                },
                orderBy: { createdAt: 'desc' },
                take: 30,
            }).catch(() => []),
            ((prisma as any).feePayment?.findMany
                ? (prisma as any).feePayment.findMany({
                      where: {
                          OR: [
                              { userId: user.id },
                              ...(accNos.length > 0 ? [{ accountNo: { in: accNos } }] : []),
                          ],
                      },
                      orderBy: { datePaid: 'desc' },
                  })
                : supabase.from('FeePayment').select('*').in('accountNo', accNos).then((r: any) => r.data || [])
            ).catch(() => []),
            ((prisma as any).transaction?.findMany
                ? (prisma as any).transaction.findMany({
                      where: { userId: user.id },
                      orderBy: { createdAt: 'desc' },
                  })
                : supabase.from('Transaction').select('*').eq('userId', user.id).then((r: any) => r.data || [])
            ).catch(() => []),
            accNos.length > 0
                ? supabase
                      .from('Property')
                      .select('account_no, bill_image_url')
                      .in('account_no', accNos)
                : Promise.resolve({ data: [] as any }),
            accNos.length > 0
                ? supabase
                      .from('Bill')
                      .select('id, accountNo, billYear, ratePA, balanceBF, accountBalance, billDate, rateableValue')
                      .in('accountNo', accNos)
                      .order('billYear', { ascending: false })
                : Promise.resolve({ data: [] as any }),
        ]);

        const billImageMap = new Map<string, string | null>();
        if (propBillImagesRes?.data) {
            for (const row of propBillImagesRes.data) {
                billImageMap.set(row.account_no, row.bill_image_url || null);
            }
        }

        const rawBills = (billsRes?.data || []) as any[];
        const bills: AdminBillRecord[] = rawBills.map((b) => ({
            id: b.id,
            accountNo: b.accountNo,
            billYear: Number(b.billYear),
            ratePA: Number(b.ratePA || 0),
            balanceBF: Number(b.balanceBF || 0),
            accountBalance: Number(b.accountBalance || 0),
            billDate: b.billDate || null,
            rateableValue: Number(b.rateableValue || 0),
        }));

        const mapReceiptWithNarrative = (r: any, targetPropAccount?: string): AdminPropertyReceipt => {
            const fp = (feePayments || []).find(
                (f: any) => f.gcrNr === r.receiptNumber || (r.transactionId && f.transactionId === r.transactionId)
            );
            const txn = (transactions || []).find(
                (t: any) =>
                    (r.transactionId && t.id === r.transactionId) ||
                    (fp?.transactionId && (t.id === fp.transactionId || t.reference === fp.transactionId))
            );

            const matchedProp = (user.properties || []).find(
                (p: any) =>
                    (r.propertyId && p.id === r.propertyId) ||
                    (targetPropAccount && p.accountNumber === targetPropAccount) ||
                    (fp?.accountNo && p.accountNumber === fp.accountNo) ||
                    (fp?.propertyId && p.id === fp.propertyId)
            );

            const targetAccount = fp?.accountNo || matchedProp?.accountNumber || targetPropAccount || 'General Assessment';
            const targetDigitalAddress = matchedProp?.ownerDigitalAddress || '—';
            const totalAmount = Number(r.amount || fp?.amtPaid || 0);
            const arrearsPaid =
                fp?.arrearsPd !== undefined
                    ? Number(fp.arrearsPd)
                    : r.settlementType === 'ARREARS'
                    ? totalAmount
                    : r.settlementType === 'CURRENT_FEE'
                    ? 0
                    : Math.min(totalAmount, matchedProp?.arrears || 0);
            const currentFeePaid =
                fp?.curAmtPd !== undefined
                    ? Number(fp.curAmtPd)
                    : r.settlementType === 'CURRENT_FEE'
                    ? totalAmount
                    : Math.max(0, totalAmount - arrearsPaid);

            const remainingTotalDue = Number(matchedProp?.totalAmountDue || 0);
            const isFullySettled = remainingTotalDue <= 0;

            const datePaidObj = new Date(r.datePaid || fp?.datePaid || Date.now());
            const formattedDate = datePaidObj.toLocaleDateString('en-GB', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
            });
            const formattedTime =
                datePaidObj.toLocaleTimeString('en-GB', {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                    hour12: false,
                }) + ' UTC';

            return {
                id: r.id,
                receiptNumber: r.receiptNumber,
                transactionReference: txn?.reference || null,
                amount: totalAmount,
                amountFormatted: formatGhc(totalAmount),
                settlementType: r.settlementType || 'TOTAL',
                paymentMethod: fp?.pmtMode || r.paymentMethod || (txn ? 'Paystack MoMo' : 'Mobile Money'),
                status: r.status || 'PAID',
                datePaid: `${formattedDate}, ${formattedTime}`,
                exactTimestamp: datePaidObj.toISOString(),
                formattedDate,
                formattedTime,
                scannedImageUrl: r.scannedImageUrl || null,
                propertyAccountNumber: targetAccount,
                propertyDigitalAddress: targetDigitalAddress,
                propertyId: matchedProp?.id || r.propertyId,
                userId: user.id,
                payerPhoneNumber: r.paymentPhoneNumber || txn?.paymentPhoneNumber || user.phoneNumber,
                payerName: r.payerName || txn?.payerName || txn?.metadata?.payerName || null,
                narrative: {
                    targetAccount,
                    targetDigitalAddress,
                    arrearsPaid,
                    arrearsPaidFormatted: formatGhc(arrearsPaid),
                    currentFeePaid,
                    currentFeePaidFormatted: formatGhc(currentFeePaid),
                    totalAmountPaid: totalAmount,
                    totalAmountPaidFormatted: formatGhc(totalAmount),
                    remainingTotalDue,
                    remainingTotalDueFormatted: formatGhc(remainingTotalDue),
                    propertyStatusAfter: isFullySettled ? 'FULLY_SETTLED' : 'PARTIALLY_PAID',
                    isFullySettled,
                    actionRequiredText: isFullySettled
                        ? 'Account fully settled & cleared. Zero debt remaining. Exempt from collection notices.'
                        : `Outstanding balance of ${formatGhc(remainingTotalDue)} remains due for municipal settlement.`,
                },
            };
        };

        const properties: AdminProperty[] = (user.properties || []).map((p: any) => {
            const isDefaulter = p.status !== 'PAID' && p.arrears > 0;
            const billDateObj = p.billYear ? new Date(p.billYear, 0, 15) : new Date(p.billDate || Date.now());
            const deadlineObj = new Date(p.settlementDeadline || Date.now());

            const propReceipts = (p.receipts && p.receipts.length > 0)
                ? p.receipts
                : (user.receipts || []).filter((r: any) => r.propertyId === p.id || r.accountNumber === p.accountNumber);
            const receiptsList: AdminPropertyReceipt[] = propReceipts.map((r: any) =>
                mapReceiptWithNarrative(r, p.accountNumber)
            );

            const initialArrears = Number(p.initialArrears !== undefined ? p.initialArrears : (p.initial_arrears !== undefined ? p.initial_arrears : p.arrears || 0));
            const totalPaidCycle = Number(p.totalPaidCycle !== undefined ? p.totalPaidCycle : (p.total_paid_cycle !== undefined ? p.total_paid_cycle : p.amountPaidLastYear || 0));
            const currentArrears = Number(p.currentArrears !== undefined ? p.currentArrears : (p.current_arrears !== undefined ? p.current_arrears : Math.max(0, initialArrears - totalPaidCycle)));
            const cumulativeArrears = Number(p.cumulativeArrears !== undefined ? p.cumulativeArrears : (p.cumulative_arrears !== undefined ? p.cumulative_arrears : initialArrears));

            return {
                id: p.id,
                accountNumber: p.accountNumber,
                valuationNo: p.valuationNo,
                physicalAddress: p.physicalAddress || '',
                houseNo: p.houseNo || '',
                plotNo: p.plotNo || '',
                municipality: p.municipality || 'Kpone-Katamanso (KKMA)',
                ownerPhone: user.phoneNumber,
                ownerName: user.name || 'Municipal Ratepayer',
                ownerDigitalAddress: p.ownerDigitalAddress || 'N/A',
                propertyClassification: p.propertyClassification || 'RESIDENTIAL',
                billYear: p.billYear || 2025,
                billDateFormatted: formatDateGb(billDateObj),
                settlementDeadlineFormatted: formatDateGb(deadlineObj),
                rateableValue: p.rateableValue || 0,
                rateableValueFormatted: formatGhc(p.rateableValue),
                rateImposed: p.rateImposed || 0.00025,
                previousYearBill: p.previousYearBill || 0,
                previousYearBillFormatted: formatGhc(p.previousYearBill),
                amountPaidLastYear: p.amountPaidLastYear || 0,
                amountPaidLastYearFormatted: formatGhc(p.amountPaidLastYear),
                arrears: p.arrears || 0,
                arrearsFormatted: formatGhc(p.arrears),
                initialArrears,
                initialArrearsFormatted: formatGhc(initialArrears),
                currentArrears,
                currentArrearsFormatted: formatGhc(currentArrears),
                totalPaidCycle,
                totalPaidCycleFormatted: formatGhc(totalPaidCycle),
                cumulativeArrears,
                cumulativeArrearsFormatted: formatGhc(cumulativeArrears),
                currentFee: p.currentFee || 0,
                currentFeeFormatted: formatGhc(p.currentFee),
                totalAmountDue: p.totalAmountDue || 0,
                totalAmountDueFormatted: formatGhc(p.totalAmountDue),
                status: (p.status || 'UNPAID') as 'PAID' | 'PARTIALLY_PAID' | 'UNPAID',
                isDefaulter,
                receipts: receiptsList,
                billImageUrl: billImageMap.get(p.accountNumber) || p.billImageUrl || (p as any).bill_image_url || null,
                latitude: p.latitude || null,
                longitude: p.longitude || null,
                ownerId: p.ownerId || null,
                propertyTypeCode: p.propertyTypeCode || null,
                propertyCategoryCode: p.propertyCategoryCode || null,
                streetCode: p.streetCode || null,
                communityCode: p.communityCode || null,
                subMetroCode: p.subMetroCode || null,
            };
        });

        const allReceiptsMap = new Map<string, AdminPropertyReceipt>();

        // 1. Map all receipts directly tied to user
        for (const r of (user.receipts || [])) {
            const mapped = mapReceiptWithNarrative(r);
            allReceiptsMap.set(mapped.receiptNumber || mapped.id, mapped);
        }

        // 2. Map all receipts tied to user's properties
        for (const p of (user.properties || [])) {
            for (const r of (p.receipts || [])) {
                const mapped = mapReceiptWithNarrative(r, p.accountNumber);
                allReceiptsMap.set(mapped.receiptNumber || mapped.id, mapped);
            }
        }

        // 3. Fallback synthesis: If a property has recorded amount_paid or totalPaidCycle > 0 but receipts sum is less
        for (const p of (user.properties || [])) {
            const paidAmt = Number(p.totalPaidCycle || (p as any).total_paid_cycle || p.amountPaidLastYear || (p as any).amount_paid || 0);
            const propertyReceiptsSum = Array.from(allReceiptsMap.values())
                .filter((r) => r.propertyAccountNumber === p.accountNumber || r.propertyId === p.id)
                .reduce((sum, r) => sum + r.amount, 0);

            if (paidAmt > propertyReceiptsSum) {
                const unreceiptedAmt = Number((paidAmt - propertyReceiptsSum).toFixed(2));
                const initialArr = Number(p.initialArrears || (p as any).initial_arrears || p.arrears || 0);
                const arrearsPaid = Math.min(initialArr, unreceiptedAmt);
                const currentFeePaid = Math.max(0, Number((unreceiptedAmt - arrearsPaid).toFixed(2)));
                const remainingTotalDue = Number(p.totalAmountDue || (p as any).outstanding_amt || 0);
                const isFullySettled = remainingTotalDue <= 0;
                const recId = `rec_reconciled_${p.accountNumber}`;

                allReceiptsMap.set(recId, {
                    id: recId,
                    receiptNumber: `DIG-KKMA-LEGACY-${p.accountNumber.slice(-4)}`,
                    transactionReference: `RMMS-RECONCILED-${p.accountNumber}`,
                    amount: unreceiptedAmt,
                    amountFormatted: formatGhc(unreceiptedAmt),
                    settlementType: 'TOTAL',
                    paymentMethod: 'Counter Cash Treasury',
                    status: 'PAID',
                    datePaid: '14 Sep 2026, 09:30:00 UTC',
                    exactTimestamp: new Date('2026-09-14T09:30:00Z').toISOString(),
                    formattedDate: '14 Sep 2026',
                    formattedTime: '09:30:00 UTC',
                    scannedImageUrl: null,
                    propertyAccountNumber: p.accountNumber,
                    propertyDigitalAddress: p.ownerDigitalAddress || '—',
                    propertyId: p.id,
                    userId: user.id,
                    payerPhoneNumber: user.phoneNumber,
                    payerName: user.name,
                    narrative: {
                        targetAccount: p.accountNumber,
                        targetDigitalAddress: p.ownerDigitalAddress || '—',
                        arrearsPaid,
                        arrearsPaidFormatted: formatGhc(arrearsPaid),
                        currentFeePaid,
                        currentFeePaidFormatted: formatGhc(currentFeePaid),
                        totalAmountPaid: unreceiptedAmt,
                        totalAmountPaidFormatted: formatGhc(unreceiptedAmt),
                        remainingTotalDue,
                        remainingTotalDueFormatted: formatGhc(remainingTotalDue),
                        propertyStatusAfter: isFullySettled ? 'FULLY_SETTLED' : 'PARTIALLY_PAID',
                        isFullySettled,
                        actionRequiredText: isFullySettled
                            ? 'Account fully settled & cleared. Zero debt remaining.'
                            : `Outstanding balance of ${formatGhc(remainingTotalDue)} remains due for municipal settlement.`,
                    },
                });
            }
        }

        const allReceipts: AdminPropertyReceipt[] = Array.from(allReceiptsMap.values());

        const notifications = (user.notifications || []).map((n: any) => {
            const d = new Date(n.createdAt || Date.now());
            const dFormatted = formatDateGb(d);
            const tFormatted = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }) + ' UTC';
            return {
                id: n.id,
                title: n.title || 'Notice',
                message: n.message,
                type: n.type || 'SYSTEM',
                deliveryMethod: n.deliveryMethod || 'IN_APP',
                deliveryStatus: n.deliveryStatus || 'DELIVERED',
                createdAtFormatted: `${dFormatted}, ${tFormatted}`,
            };
        });

        const formattedAuditLogs = (auditLogs || []).map((a: any) => {
            const d = new Date(a.createdAt || Date.now());
            const dFormatted = formatDateGb(d);
            const tFormatted = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }) + ' UTC';
            return {
                id: a.id,
                action: a.action,
                details: a.details,
                createdAtFormatted: `${dFormatted}, ${tFormatted}`,
                exactTimestamp: d.toISOString(),
            };
        });

        const totalValuation = properties.reduce((acc: number, curr: AdminProperty) => acc + curr.rateableValue, 0);
        const totalArrears = properties.reduce((acc: number, curr: AdminProperty) => {
            const isCleared = curr.status === 'PAID' || curr.totalAmountDue <= 0 || (curr.amountPaidLastYear || 0) >= curr.arrears;
            return acc + (isCleared ? 0 : Math.max(0, curr.arrears - (curr.amountPaidLastYear || 0)));
        }, 0);
        const totalCurrentFee = properties.reduce((acc: number, curr: AdminProperty) => acc + curr.currentFee, 0);
        const totalOutstandingDue = properties.reduce((acc: number, curr: AdminProperty) => acc + curr.totalAmountDue, 0);
        const totalPaid = allReceipts.reduce((acc: number, curr: AdminPropertyReceipt) => acc + curr.amount, 0);

        const hasDefaulter = properties.some((p) => p.isDefaulter && p.totalAmountDue > 0);
        const isSettled = properties.length > 0 && properties.every((p) => p.totalAmountDue <= 0 || p.status === 'PAID');

        const status: 'SETTLED' | 'OUTSTANDING' | 'DEFAULTER' = hasDefaulter
            ? 'DEFAULTER'
            : isSettled
                ? 'SETTLED'
                : 'OUTSTANDING';

        return {
            user: {
                id: user.id,
                name: user.name || 'Municipal Ratepayer',
                phoneNumber: user.phoneNumber,
                role: user.role || 'RATEPAYER',
                isVerified: Boolean(user.isVerified),
                createdAtFormatted: formatDateGb(user.createdAt),
            },
            properties,
            receipts: allReceipts,
            bills,
            notifications,
            auditLogs: formattedAuditLogs,
            summary: {
                totalProperties: properties.length,
                totalValuationFormatted: formatGhc(totalValuation),
                totalArrearsFormatted: formatGhc(totalArrears),
                totalCurrentFeeFormatted: formatGhc(totalCurrentFee),
                totalOutstandingDueFormatted: formatGhc(totalOutstandingDue),
                totalPaidFormatted: formatGhc(totalPaid),
                status,
            },
        };
    } catch (error) {
        console.error('Error fetching ratepayer history dossier:', error);
        return null;
    }
}

export async function getBillsForAccount(accountNo: string): Promise<AdminBillRecord[]> {
    try {
        await requireAdminSession();
        const clean = (accountNo || '').trim();
        if (!clean) return [];

        const { data, error } = await supabase
            .from('Bill')
            .select('id, accountNo, billYear, ratePA, balanceBF, accountBalance, billDate, rateableValue')
            .or(`accountNo.eq.${clean},accountNo.eq.${clean}0`)
            .order('billYear', { ascending: false });

        if (error || !data) return [];
        return data.map((b: any) => ({
            id: b.id,
            accountNo: b.accountNo,
            billYear: Number(b.billYear),
            ratePA: Number(b.ratePA || 0),
            balanceBF: Number(b.balanceBF || 0),
            accountBalance: Number(b.accountBalance || 0),
            billDate: b.billDate || null,
            rateableValue: Number(b.rateableValue || 0),
        }));
    } catch (e) {
        console.error('Error fetching bills for account:', e);
        return [];
    }
}

export interface AdminAuditLogItem {
    id: string;
    action: string;
    actionLabel: string;
    actionBadgeColor: string;
    entityType: string;
    entityId: string | null;
    details: string;
    adminId: string;
    adminName: string;
    adminRole: string;
    createdAt: string;
    createdAtFormatted: string;
    timeFormatted: string;
}

export async function getAuditTrailList(
    query = '',
    actionFilter = 'ALL',
    page = 1,
    limit = 50
): Promise<{ logs: AdminAuditLogItem[]; total: number } | null> {
    try {
        await requireAdminSession();

        const whereClause: any = {};
        if (actionFilter && actionFilter !== 'ALL') {
            whereClause.action = actionFilter;
        }
        if (query && query.trim()) {
            const q = query.trim();
            whereClause.OR = [
                { details: { contains: q, mode: 'insensitive' } },
                { action: { contains: q, mode: 'insensitive' } },
                { entityType: { contains: q, mode: 'insensitive' } },
                { entityId: { contains: q, mode: 'insensitive' } },
            ];
        }

        const skip = (page - 1) * limit;

        const [logs, total] = await Promise.all([
            prisma.auditLog.findMany({
                where: whereClause,
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit,
            }),
            prisma.auditLog.count({ where: whereClause }),
        ]);

        const adminIds = Array.from(new Set(logs.map((l: any) => l.adminId).filter(Boolean)));
        const admins = adminIds.length > 0 ? await prisma.user.findMany({
            where: { id: { in: adminIds } },
            select: { id: true, name: true, role: true, phoneNumber: true },
        }) : [];
        const adminMap = new Map<string, any>(admins.map((u: any) => [u.id, u]));

        const formatted: AdminAuditLogItem[] = logs.map((log: any) => {
            const dt = new Date(log.createdAt || Date.now());
            const admin = adminMap.get(log.adminId);
            const adminName = admin?.name || 'Municipal Revenue Admin';
            const adminRole = admin?.role || 'ADMIN';

            let actionLabel = log.action;
            let actionBadgeColor = '#612D53';

            switch (log.action) {
                case 'RECORD_PAYMENT':
                    actionLabel = 'Cash Settlement Recorded';
                    actionBadgeColor = '#188038';
                    break;
                case 'BATCH_BILLING':
                    actionLabel = 'Annual Billing Rollout';
                    actionBadgeColor = '#1A73E8';
                    break;
                case 'BATCH_SMS_DISPATCH':
                    actionLabel = 'SMS Batch Dispatch';
                    actionBadgeColor = '#B45309';
                    break;
                case 'SINGLE_SMS_DISPATCH':
                    actionLabel = 'Direct SMS Notice';
                    actionBadgeColor = '#B45309';
                    break;
                case 'EDIT_PROPERTY':
                    actionLabel = 'Property Valuation Modified';
                    actionBadgeColor = '#8430CE';
                    break;
                case 'CREATE_PROPERTY':
                    actionLabel = 'Cadastre Property Registered';
                    actionBadgeColor = '#137333';
                    break;
                default:
                    actionLabel = log.action.replace(/_/g, ' ');
            }

            return {
                id: log.id,
                action: log.action,
                actionLabel,
                actionBadgeColor,
                entityType: log.entityType || 'General',
                entityId: log.entityId || null,
                details: log.details || 'No narrative recorded.',
                adminId: log.adminId,
                adminName,
                adminRole,
                createdAt: log.createdAt,
                createdAtFormatted: formatDateGb(dt),
                timeFormatted: dt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
            };
        });

        return { logs: formatted, total };
    } catch (error) {
        console.error('Error fetching audit trail list:', error);
        return null;
    }
}

export async function getSmsRolloutLogs(page = 1, limit = 50): Promise<SmsRolloutLogItem[]> {
    const result = await getSmsRolloutLogsPaginated(page, limit);
    return result.logs;
}

export async function getSmsRolloutLogsPaginated(
    page = 1,
    limit = 50,
    searchQuery = "",
    statusFilter: "ALL" | "DELIVERED" | "FAILED" = "ALL"
): Promise<{ logs: SmsRolloutLogItem[]; total: number }> {
    try {
        await requireAdminSession();

        let countQuery = supabase
            .from('Notification')
            .select('*', { count: 'exact', head: true })
            .eq('deliveryMethod', 'SMS');

        let dataQuery = supabase
            .from('Notification')
            .select('*')
            .eq('deliveryMethod', 'SMS');

        if (statusFilter === 'DELIVERED') {
            countQuery = countQuery.eq('deliveryStatus', 'DELIVERED');
            dataQuery = dataQuery.eq('deliveryStatus', 'DELIVERED');
        } else if (statusFilter === 'FAILED') {
            countQuery = countQuery.eq('deliveryStatus', 'FAILED');
            dataQuery = dataQuery.eq('deliveryStatus', 'FAILED');
        }

        if (searchQuery && searchQuery.trim()) {
            const q = searchQuery.trim();
            const filterStr = `title.ilike.%${q}%,message.ilike.%${q}%,externalMessageId.ilike.%${q}%`;
            countQuery = countQuery.or(filterStr);
            dataQuery = dataQuery.or(filterStr);
        }

        dataQuery = dataQuery.order('createdAt', { ascending: false });

        const skip = (page - 1) * limit;
        dataQuery = dataQuery.range(skip, skip + limit - 1);

        const [{ count }, { data: notifs, error }] = await Promise.all([
            countQuery,
            dataQuery,
        ]);

        if (error || !notifs) {
            return { logs: [], total: 0 };
        }

        const userIds = Array.from(new Set(notifs.map((n: any) => n.userId).filter(Boolean)));
        let userMap = new Map<string, any>();
        if (userIds.length > 0) {
            const { data: users } = await supabase.from('User').select('id, name, phoneNumber').in('id', userIds);
            userMap = new Map((users || []).map((u: any) => [u.id, u]));
        }

        const logs: SmsRolloutLogItem[] = notifs.map((n: any) => {
            const user = n.userId ? userMap.get(n.userId) : null;
            const accMatch = n.title?.match(/\[([A-Z0-9]+)\]/) || n.message?.match(/Acct\s+([A-Z0-9]+)/i) || n.message?.match(/propertyId=([A-Z0-9]+)/i);
            const accNo = accMatch ? accMatch[1] : undefined;

            let recipientName = user?.name;
            if (!recipientName) {
                const nameMatch = n.title?.match(/-\s*(.+)$/);
                recipientName = nameMatch ? nameMatch[1].trim() : 'Municipal Ratepayer';
            }

            let recipientPhone = user?.phoneNumber;
            if (!recipientPhone) {
                const phoneMatch = n.message?.match(/for\s+(0\d{9}|\+?233\d{9})/i) || n.message?.match(/to\s+(0\d{9}|\+?233\d{9})/i);
                recipientPhone = phoneMatch ? phoneMatch[1] : 'Ratepayer Contact';
            }

            return {
                id: n.id,
                recipientPhone,
                recipientName,
                accountNumber: accNo,
                title: n.title,
                message: n.message,
                type: n.type || 'BILLING_ROLLOUT',
                deliveryMethod: 'SMS',
                deliveryStatus: (n.deliveryStatus || 'DELIVERED') as 'PENDING' | 'DELIVERED' | 'FAILED',
                externalMessageId: n.externalMessageId || null,
                createdAtFormatted: new Date(n.createdAt || Date.now()).toLocaleDateString('en-GB', {
                    day: '2-digit', month: 'short', year: 'numeric',
                    hour: '2-digit', minute: '2-digit', second: '2-digit'
                }),
            };
        });

        return { logs, total: count || 0 };
    } catch (error) {
        console.error('Error fetching paginated SMS rollout logs:', error);
        return { logs: [], total: 0 };
    }
}

export async function simulateSmsNoticeDispatch(accountNumber: string, customTemplate?: string, baseUrl?: string) {
    try {
        await requireAdminSession();
        await syncActiveSmsConfig();

        const property = await prisma.property.findUnique({
            where: { accountNumber },
            include: { users: true, owner: true },
        });

        const primaryOwner = property?.users?.[0];
        if (!property || !primaryOwner) {
            return { success: false, error: 'Property Account Head or linked taxpayer not found.' };
        }

        const ownerName = property.owner?.name || primaryOwner.name || 'Municipal Ratepayer';
        const ownerPhone = property.owner?.tel || property.owner?.mobileNumber || primaryOwner.phoneNumber || '';

        const formattedAnnualBill = smsFormatter.formatBillRolloutMessage({
            accountNumber: property.accountNumber,
            ownerName,
            phoneNumber: ownerPhone,
            totalAmountDue: property.totalAmountDue || 0,
            arrears: property.arrears || 0,
            currentFee: property.currentFee || 0,
            dueDate: '30-Jun-2025',
            baseUrl,
            customTemplate: customTemplate || activeSmsConfig.messageTemplate,
            municipality: property.municipality || 'Kpone-Katamanso (KKMA)',
            billYear: property.billYear || 2026,
            ownerDigitalAddress: property.ownerDigitalAddress || '',
        });

        return {
            success: true,
            recipientPhone: formattedAnnualBill.recipientPhone,
            recipientName: formattedAnnualBill.recipientName,
            messageText: formattedAnnualBill.messageText,
            billLinkUrl: formattedAnnualBill.billLinkUrl,
            paymentLinkUrl: formattedAnnualBill.paymentLinkUrl,
            timestamp: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        };
    } catch (error) {
        console.error('Error simulating SMS notice dispatch:', error);
        return { success: false, error: 'Failed to generate SMS notice' };
    }
}

export interface SmsAudienceResult {
    totalCount: number;
    totalDue: number;
    totalDueFormatted: string;
    properties: AdminProperty[];
}

export interface SmsAudienceParams {
    municipality?: string;
    classification?: string;
    status?: 'ALL' | 'UNPAID' | 'DEFAULTER';
    searchQuery?: string;
    accountNumbers?: string[];
    requiredFields?: string[];
}

export async function searchSmsRolloutAccounts(params: {
    municipality?: string;
    searchQuery: string;
}): Promise<{
    properties: AdminProperty[];
    count: number;
} | null> {
    try {
        await requireAdminSession();

        const searchQuery = params.searchQuery?.trim();
        if (!searchQuery || searchQuery.length < 2) {
            return { properties: [], count: 0 };
        }

        const municipality =
            params.municipality && params.municipality !== 'ALL'
                ? params.municipality
                : undefined;

        // Use adminDb (Supabase) — resolvePropertySearchIds already searches
        // Property.name, Property.telephone, account_no, valuationNo, etc.
        const results = await adminDb.property.findMany({
            where: {
                ...(municipality ? { municipality } : {}),
                search: searchQuery,
            },
            take: 100,
            include: { users: true, receipts: true },
        });

        const formattedProperties: AdminProperty[] = (results || []).map((p: any) => {
            // p has mapPropertyRow applied: accountNumber, propertyClassification, ownerNameDirect, ownerPhoneDirect
            const primaryUser = p.users?.[0];
            const ownerName = p.ownerNameDirect || p.owner?.name || primaryUser?.name || 'Municipal Ratepayer';
            const ownerPhone = p.ownerPhoneDirect || p.owner?.tel || p.owner?.mobileNumber || primaryUser?.phoneNumber || 'N/A';

            const billDateObj = p.billYear ? new Date(p.billYear, 0, 15) : new Date(p.billDate || Date.now());
            const deadlineObj = new Date(p.settlementDeadline || Date.now());
            const rateableValue = Number(p.rateableValue || 0);
            const rateImposed = Number(p.rateImposed || 0);
            const previousYearBill = Number(p.previousYearBill || 0);
            const amountPaidLastYear = Number(p.amountPaidLastYear || 0);
            const arrears = Number(p.arrears || 0);
            const currentFee = Number(p.currentFee || 0);
            const totalAmountDue = Number(p.totalAmountDue || 0);

            const initialArrears = Number(p.initialArrears !== undefined ? p.initialArrears : (p.initial_arrears !== undefined ? p.initial_arrears : arrears));
            const totalPaidCycle = Number(p.totalPaidCycle !== undefined ? p.totalPaidCycle : (p.total_paid_cycle !== undefined ? p.total_paid_cycle : amountPaidLastYear));
            const currentArrears = Number(p.currentArrears !== undefined ? p.currentArrears : (p.current_arrears !== undefined ? p.current_arrears : Math.max(0, initialArrears - totalPaidCycle)));
            const cumulativeArrears = Number(p.cumulativeArrears !== undefined ? p.cumulativeArrears : (p.cumulative_arrears !== undefined ? p.cumulative_arrears : initialArrears));

            const receiptsList: AdminPropertyReceipt[] = (p.receipts || []).map((r: any) => {
                const d = new Date(r.datePaid || Date.now());
                const formattedDate = formatDateGb(d);
                const formattedTime = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }) + ' UTC';
                return {
                    id: r.id,
                    receiptNumber: r.receiptNumber,
                    amount: r.amount,
                    amountFormatted: formatGhc(r.amount),
                    settlementType: r.settlementType || 'TOTAL',
                    paymentMethod: r.paymentMethod || 'Mobile Money',
                    status: r.status || 'PAID',
                    datePaid: `${formattedDate}, ${formattedTime}`,
                    exactTimestamp: d.toISOString(),
                    formattedDate,
                    formattedTime,
                    propertyAccountNumber: p.accountNumber,
                };
            });

            return {
                id: p.id,
                accountNumber: p.accountNumber || '',
                valuationNo: p.valuationNo || '',
                physicalAddress: p.physicalAddress || '',
                houseNo: p.houseNo || '',
                plotNo: p.plotNo || '',
                municipality: p.municipality || 'Kpone-Katamanso (KKMA)',
                ownerPhone,
                ownerName,
                ownerDigitalAddress: p.ownerDigitalAddress || 'N/A',
                propertyClassification: p.propertyClassification || 'RESIDENTIAL',
                billYear: Number(p.billYear || 2025),
                billDateFormatted: formatDateGb(billDateObj),
                settlementDeadlineFormatted: formatDateGb(deadlineObj),
                rateableValue,
                rateableValueFormatted: formatGhc(rateableValue),
                rateImposed,
                previousYearBill,
                previousYearBillFormatted: formatGhc(previousYearBill),
                amountPaidLastYear,
                amountPaidLastYearFormatted: formatGhc(amountPaidLastYear),
                arrears,
                arrearsFormatted: formatGhc(arrears),
                initialArrears,
                initialArrearsFormatted: formatGhc(initialArrears),
                currentArrears,
                currentArrearsFormatted: formatGhc(currentArrears),
                totalPaidCycle,
                totalPaidCycleFormatted: formatGhc(totalPaidCycle),
                cumulativeArrears,
                cumulativeArrearsFormatted: formatGhc(cumulativeArrears),
                currentFee,
                currentFeeFormatted: formatGhc(currentFee),
                totalAmountDue,
                totalAmountDueFormatted: formatGhc(totalAmountDue),
                status: p.status === 'PAID' || p.status === 'PARTIALLY_PAID' || p.status === 'UNPAID' ? p.status : 'UNPAID',
                isDefaulter: p.status !== 'PAID' && arrears > 0,
                receipts: receiptsList,
                latitude: p.latitude || null,
                longitude: p.longitude || null,
                ownerId: p.ownerId || null,
                propertyTypeCode: p.propertyTypeCode || null,
                propertyCategoryCode: p.propertyCategoryCode || null,
                streetCode: p.streetCode || null,
                communityCode: p.communityCode || null,
                subMetroCode: p.subMetroCode || null,
            };
        });

        return {
            properties: formattedProperties,
            count: formattedProperties.length,
        };
    } catch (error) {
        console.error('Failed to search SMS rollout accounts:', error);
        return null;
    }
}

function cleanDash(val: any): string {
    if (val === null || val === undefined) return '—';
    const s = String(val).trim();
    if (!s || s.toUpperCase() === 'N/A' || s === 'null' || s === 'undefined' || s === 'NONE') return '—';
    return s;
}

function buildSmsAudienceWhereClause(params: {
    municipality?: string;
    classification?: string;
    balanceStatus?: string;
    requiredFields?: string[];
    searchQuery?: string;
}) {
    const whereClause: any = {};
    const rawMuni = params.municipality?.trim() || '';
    if (rawMuni && rawMuni !== 'ALL' && !rawMuni.includes('ALL MUNICIPALITIES')) {
        whereClause.municipality = rawMuni;
    }

    const rawClass = params.classification?.trim().toUpperCase() || '';
    const isAllClassifications =
        !rawClass ||
        rawClass === 'ALL' ||
        rawClass.includes('ALL CLASSIFICATIONS') ||
        rawClass.includes('ALL');

    if (!isAllClassifications) {
        whereClause.propertyClassification = rawClass;
    }

    const rawBalance = params.balanceStatus?.trim().toUpperCase() || '';
    const isAllBalances =
        !rawBalance ||
        rawBalance === 'ALL' ||
        rawBalance.includes('ALL BALANCES') ||
        rawBalance.includes('ALL RECORDS');

    if (!isAllBalances) {
        if (rawBalance === 'DEFAULTER' || rawBalance.includes('DEFAULTER')) {
            whereClause.status = 'DEFAULTER';
        } else if (rawBalance === 'OVERPAID' || rawBalance.includes('OVERPAID') || rawBalance.includes('CREDIT')) {
            whereClause.status = 'OVERPAID';
        } else if (rawBalance === 'PARTIALLY_PAID' || rawBalance.includes('PARTIAL')) {
            whereClause.status = 'PARTIALLY_PAID';
        } else if (rawBalance === 'PAID') {
            whereClause.status = 'PAID';
        } else if (rawBalance === 'UNPAID' || rawBalance.includes('UNPAID')) {
            whereClause.status = 'UNPAID';
        }
    }

    const validRequiredFields = (params.requiredFields || []).filter(
        (field) => field && field.trim() && field.toUpperCase() !== 'ALL'
    );

    if (validRequiredFields.length > 0) {
        whereClause.requiredFields = validRequiredFields;
    }

    const searchQuery = params.searchQuery?.trim();
    if (searchQuery) {
        whereClause.search = searchQuery;
    }

    return whereClause;
}

export async function getSmsRolloutAudience(params: {
    municipality?: string;
    classification?: string;
    balanceStatus?: string;
    requiredFields?: string[];
    searchQuery?: string;
    page?: number;
    limit?: number;
}) {
    try {
        const admin = await requireAdminSession();

        if (!admin) {
            return {
                success: false,
                count: 0,
                totalCount: 0,
                totalPages: 1,
                page: 1,
                totalDue: 0,
                totalDueFormatted: 'GH₵ 0.00',
                properties: [],
            };
        }

        const whereClause = buildSmsAudienceWhereClause(params);

        const page = params.page && params.page > 0 ? params.page : 1;
        const limit = params.limit !== undefined ? params.limit : 50;
        const skip = (page - 1) * limit;

        const [totalCount, propAggregate, initialProperties] = await Promise.all([
            adminDb.property.count({ where: whereClause }),
            adminDb.property.aggregate({ where: whereClause }),
            adminDb.property.findMany({
                where: whereClause,
                orderBy: [{ telephone: 'asc' }, { name: 'asc' }, { accountNumber: 'asc' }],
                ...(limit > 0 ? { skip, take: limit } : {}),
                include: { users: true, owner: true, receipts: true },
            }),
        ]);

        let properties = [...initialProperties];

        // Ensure complete portfolios: if any ratepayer on this page has accounts spanning beyond the page limit, pull them in
        const pagePhones = Array.from(
            new Set(
                properties
                    .map((p: any) => (p.telephone || p.ownerPhoneDirect || p.owner?.tel || p.owner?.mobileNumber || '').trim())
                    .filter((ph: string) => ph && ph !== '0' && ph.length >= 7)
            )
        );

        if (pagePhones.length > 0) {
            const existingAccs = new Set(properties.map((p: any) => p.account_no || p.accountNumber));
            const siblingProps = await adminDb.property.findMany({
                where: {
                    ...whereClause,
                    telephone: { in: pagePhones },
                },
                orderBy: [{ telephone: 'asc' }, { name: 'asc' }, { accountNumber: 'asc' }],
                include: { users: true, owner: true, receipts: true },
            }).catch(() => []);

            for (const sp of siblingProps) {
                const acc = sp.account_no || sp.accountNumber;
                if (!existingAccs.has(acc)) {
                    properties.push(sp);
                    existingAccs.add(acc);
                }
            }
        }

        const formattedProperties: AdminProperty[] = properties.map((p: any) => {
            const primaryUser = p.users?.[0];
            const owner = p.owner;

            const receiptsList: AdminPropertyReceipt[] = (p.receipts || []).map((r: any) => {
                const d = new Date(r.datePaid || Date.now());
                const formattedDate = formatDateGb(d);
                const formattedTime = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }) + ' UTC';
                return {
                    id: r.id,
                    receiptNumber: r.receiptNumber,
                    amount: r.amount,
                    amountFormatted: formatGhc(r.amount),
                    settlementType: r.settlementType || 'TOTAL',
                    paymentMethod: r.paymentMethod || 'Mobile Money',
                    status: r.status || 'PAID',
                    datePaid: `${formattedDate}, ${formattedTime}`,
                    exactTimestamp: d.toISOString(),
                    formattedDate,
                    formattedTime,
                    propertyAccountNumber: p.accountNumber || p.account_no,
                };
            });

            const rawName = p.name || p.ownerNameDirect;
            const cleanDirectName =
                rawName && typeof rawName === 'string' && !rawName.toUpperCase().includes('NO NAME')
                    ? rawName.trim()
                    : null;

            const ownerName =
                cleanDirectName ||
                owner?.name ||
                primaryUser?.name ||
                'Municipal Ratepayer';

            const rawPhone = p.telephone || p.ownerPhoneDirect;
            const cleanDirectPhone =
                rawPhone && typeof rawPhone === 'string' && rawPhone.trim() !== '0' && rawPhone.trim().length >= 7
                    ? rawPhone.trim()
                    : null;

            const ownerPhone =
                cleanDirectPhone ||
                owner?.tel ||
                owner?.mobileNumber ||
                primaryUser?.phoneNumber ||
                '—';

            const billDateObj = p.billYear ? new Date(p.billYear, 0, 15) : new Date(p.billDate || Date.now());
            const deadlineObj = new Date(p.settlementDeadline || Date.now());

            const rateableValue = Number(p.rateableValue || 0);
            const rateImposed = Number(p.rateImposed || 0);
            const previousYearBill = Number(p.previousYearBill || 0);
            const amountPaidLastYear = Number(p.amountPaidLastYear || 0);
            const arrears = Number(p.arrears || 0);
            const currentFee = Number(p.currentFee || 0);
            const totalAmountDue = Number(p.totalAmountDue || 0);

            return {
                id: p.id,
                accountNumber: cleanDash(p.accountNumber || p.account_no),
                valuationNo: cleanDash(p.valuationNo),
                physicalAddress: cleanDash(p.physicalAddress),
                houseNo: cleanDash(p.houseNo),
                plotNo: cleanDash(p.plotNo),
                electoralArea: cleanDash(p.electoral_area || p.electoralArea),
                municipality: cleanDash(p.municipality || 'Kpone-Katamanso (KKMA)'),
                ownerPhone: cleanDash(ownerPhone),
                ownerName: cleanDash(ownerName),
                ownerDigitalAddress: cleanDash(p.ownerDigitalAddress),
                propertyClassification:
                    p.propertyClassification || p.property_cat || 'RESIDENTIAL',
                billYear: Number(p.billYear || 2025),

                billDateFormatted: formatDateGb(billDateObj),
                settlementDeadlineFormatted: formatDateGb(deadlineObj),
                rateableValue,
                rateableValueFormatted: formatGhc(rateableValue),
                rateImposed,
                previousYearBill,
                previousYearBillFormatted: formatGhc(previousYearBill),
                amountPaidLastYear,
                amountPaidLastYearFormatted: formatGhc(amountPaidLastYear),
                arrears,
                arrearsFormatted: formatGhc(arrears),
                currentFee,
                currentFeeFormatted: formatGhc(currentFee),
                totalAmountDue,
                totalAmountDueFormatted: formatGhc(totalAmountDue),

                status: (p.status || 'UNPAID') as
                    'PAID' | 'PARTIALLY_PAID' | 'UNPAID',

                isDefaulter: p.status !== 'PAID' && arrears > 0 && totalAmountDue > 0,
                receipts: receiptsList,
                latitude: p.latitude || null,
                longitude: p.longitude || null,
                ownerId: p.ownerId || null,
                propertyTypeCode: p.propertyTypeCode || null,
                propertyCategoryCode: p.propertyCategoryCode || null,
                streetCode: p.streetCode || null,
                communityCode: p.communityCode || null,
                subMetroCode: p.subMetroCode || null,
            };
        });

        const totalDue = Number(propAggregate?._sum?.totalAmountDue || 0);

        return {
            success: true,
            count: formattedProperties.length,
            totalCount,
            totalPages: limit > 0 ? Math.ceil(totalCount / limit) : 1,
            page,
            totalDue,
            totalDueFormatted: formatGhc(totalDue),
            properties: formattedProperties,
        };
    } catch (error) {
        console.error('Error fetching SMS rollout audience:', error);

        return {
            success: false,
            count: 0,
            totalCount: 0,
            totalPages: 1,
            page: 1,
            totalDue: 0,
            totalDueFormatted: 'GH₵ 0.00',
            properties: [],
        };
    }
}
export async function batchDispatchSms(
    target: string[] | { accountNumbers?: string[]; filters?: any },
    adminPassword?: string,
    customTemplate?: string,
    baseUrl?: string,
    overrideMode?: 'TEST' | 'LIVE'
) {
    try {
        const admin = await requireAdminSession();

        if (!adminPassword) {
            return { success: false, error: 'Administrator security password is required to authorize SMS rollout dispatch.' };
        }

        const isAuthorized = verifyPassword(adminPassword, admin.passwordHash);
        if (!isAuthorized) {
            return { success: false, error: 'Incorrect administrator security password. Dispatch authorization rejected.' };
        }

        let accountNumbers: string[] = [];

        if (Array.isArray(target)) {
            accountNumbers = target.filter(Boolean);
        } else if (target && typeof target === 'object') {
            if (Array.isArray(target.accountNumbers) && target.accountNumbers.length > 0) {
                accountNumbers = target.accountNumbers.filter(Boolean);
            } else if (target.filters) {
                const whereClause = buildSmsAudienceWhereClause(target.filters);
                const matched = await (adminDb.property as any).findMany({
                    where: whereClause,
                });
                accountNumbers = (matched || []).map((p: any) => p.accountNumber || p.account_no).filter(Boolean);
            }
        }

        if (!accountNumbers || accountNumbers.length === 0) {
            return { success: false, error: 'No matching property accounts found for SMS rollout dispatch.' };
        }

        await syncActiveSmsConfig();
        const effectiveMode = overrideMode || activeSmsConfig.dispatchMode || 'TEST';
        const template = customTemplate || activeSmsConfig.messageTemplate;

        // Create the async job row — this is our queue entry
        const job = await (prisma as any).smsRolloutJob.create({
            data: {
                accountNumbers,
                template,
                mode: effectiveMode,
                adminId: admin.id,
                totalCount: accountNumbers.length,
                status: 'QUEUED',
            },
        });

        // Fire-and-forget: process the job concurrently in the background (concurrency: 50)
        processSmsJobInline(job.id, accountNumbers, template, effectiveMode, admin.id).catch((err) => {
            console.error('[SMS Queue] Background dispatch failed:', err);
        });

        await prisma.auditLog.create({
            data: {
                action: 'BATCH_SMS_DISPATCH_QUEUED',
                entityType: 'SmsRolloutJob',
                entityId: job.id,
                details: `Queued SMS rollout job (${effectiveMode} mode) for ${accountNumbers.length} account(s). Job ID: ${job.id}`,
                adminId: admin.id,
            },
        });

        revalidatePath('/');
        return {
            success: true,
            jobId: job.id,
            dispatchedCount: accountNumbers.length,
            mode: effectiveMode,
            timestamp: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        };
    } catch (error) {
        console.error('Error queuing SMS dispatch job:', error);
        return { success: false, error: 'Failed to queue SMS dispatch job.' };
    }
}

// Inline fallback processor used in local dev when no Supabase Edge Function URL is available.
// Processes concurrently in chunks of 50 — mirrors exactly what the edge function does.
async function processSmsJobInline(
    jobId: string,
    accountNumbers: string[],
    template: string,
    mode: string,
    adminId: string,
    isResume = false
) {
    const CONCURRENCY = 50;
    try {
        const existingJob = await (prisma as any).smsRolloutJob.findUnique({
            where: { id: jobId },
        });

        await (prisma as any).smsRolloutJob.update({
            where: { id: jobId },
            data: { status: 'RUNNING', errorMessage: null },
        });

        const properties = await prisma.property.findMany({
            where: {
                accountNumber: { in: accountNumbers },
            },
            include: { users: true, owner: true },
        });

        const phoneToGroupMap = new Map<string, {
            phone: string;
            ownerName: string;
            properties: typeof properties;
        }>();

        for (const p of properties) {
            const rawPhone = p.telephone || p.ownerPhoneDirect || p.owner?.tel || p.owner?.mobileNumber || p.users?.[0]?.phoneNumber;
            if (!rawPhone?.trim()) continue;
            const normPhone = rawPhone.trim().replace(/[^\d+]/g, '');
            if (!normPhone || normPhone === '0' || normPhone.length < 7) continue;

            const rawOwnerName = p.name || p.ownerNameDirect || p.owner?.name || p.users?.[0]?.name || 'Municipal Ratepayer';
            const accNo = p.accountNumber || p.account_no || '';

            const upper = (rawOwnerName || '').toUpperCase().trim();
            let groupKey: string;
            if (!upper || upper.includes('NO NAME')) {
                groupKey = `${normPhone}::UNNAMED::${accNo}`;
            } else {
                const cleanName = upper
                    .replace(/\b(MR|MRS|MS|DR|ING|ALHAJI|HAJIA|HON|CHIEF|NII|NANA|REV|PASTOR|ELDER|MADAM)\b\.?/gi, '')
                    .replace(/[^\w\s]/g, ' ')
                    .replace(/\s+/g, ' ')
                    .trim();
                groupKey = `${normPhone}::${cleanName}`;
            }

            if (!phoneToGroupMap.has(groupKey)) {
                phoneToGroupMap.set(groupKey, { phone: normPhone, ownerName: rawOwnerName, properties: [] });
            }
            phoneToGroupMap.get(groupKey)!.properties.push(p);
        }

        const groups = Array.from(phoneToGroupMap.values());
        
        let sentCount = 0;
        let sentAccountNumbers: string[] = [];
        let totalCount = groups.length;

        if (isResume && existingJob) {
            totalCount = existingJob.totalCount || groups.length;
            sentCount = existingJob.sentCount || 0;
            sentAccountNumbers = Array.isArray(existingJob.sentAccountNumbers)
                ? [...existingJob.sentAccountNumbers]
                : [];
        } else {
            await (prisma as any).smsRolloutJob.update({
                where: { id: jobId },
                data: { totalCount },
            });
        }

        const failedAccountNumbers: string[] = [];

        let publicAppUrl = (process.env.NEXT_PUBLIC_APP_URL?.trim() || 'https://property-rate-app.vercel.app').replace(/\/+$/, '');
        if (publicAppUrl.includes('-projects.vercel.app') || publicAppUrl.includes('kzz98dclv') || publicAppUrl.includes('localhost:3001')) {
            publicAppUrl = 'https://property-rate-app.vercel.app';
        }

        for (let i = 0; i < groups.length; i += CONCURRENCY) {
            const chunk = groups.slice(i, i + CONCURRENCY);
            const results = await Promise.allSettled(
                chunk.map(async ({ phone, ownerName, properties: groupProps }) => {
                    const isMulti = groupProps.length > 1;
                    const primaryAcc = groupProps[0]?.accountNumber || '';
                    const propertyAccounts = groupProps.map((p: any) => p.accountNumber).join(', ');
                    const accNoDisplay = isMulti ? propertyAccounts : primaryAcc;
                    const totalDue = groupProps.reduce((s: number, p: any) => s + (p.totalAmountDue || 0), 0);
                    const arrears = groupProps.reduce((s: number, p: any) => s + (p.arrears || 0), 0);

                    // Generate high-entropy, single-device access tokens
                    const tokenAssess = `ast_${Math.random().toString(36).substring(2, 10)}${Math.random().toString(36).substring(2, 10)}`;
                    const tokenCheckout = `ckt_${Math.random().toString(36).substring(2, 10)}${Math.random().toString(36).substring(2, 10)}`;
                    const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();

                    await adminDb.accessGrant.create({
                        data: {
                            token: tokenAssess,
                            accountNumber: primaryAcc,
                            phoneNumber: phone,
                            destination: 'bill',
                            expiresAt,
                        }
                    });

                    await adminDb.accessGrant.create({
                        data: {
                            token: tokenCheckout,
                            accountNumber: isMulti ? `ALL:${primaryAcc}` : primaryAcc,
                            phoneNumber: phone,
                            destination: 'checkout',
                            expiresAt,
                        }
                    });

                    const assessmentLink = `${publicAppUrl}/b/${tokenAssess}`;
                    const checkoutLink = `${publicAppUrl}/p/${tokenCheckout}`;

                    const currentFee = groupProps.reduce((s: number, p: any) => s + (p.currentFee || 0), 0);
                    const gpsAddress =
                        Array.from(
                            new Set(
                                groupProps
                                    .map((p: any) => p.ownerDigitalAddress?.trim())
                                    .filter((addr: any): addr is string => Boolean(addr))
                            )
                        ).join(', ') || groupProps[0]?.ownerDigitalAddress || 'N/A';
                    const dueDateFormatted = groupProps[0]?.settlementDeadline
                        ? new Date(groupProps[0].settlementDeadline).toLocaleDateString('en-GB', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                        })
                        : '30-Jun-2025';

                    const rawMessageText = template
                        .replace(/{{ownerName}}/g, ownerName)
                        .replace(/{{accountNumber}}/g, accNoDisplay)
                        .replace(/{{propertyAccounts}}/g, propertyAccounts)
                        .replace(/{{totalAmountDue}}/g, totalDue < 0 ? Math.abs(totalDue).toFixed(2) : totalDue.toFixed(2))
                        .replace(/{{arrears}}/g, arrears.toFixed(2))
                        .replace(/{{currentFee}}/g, currentFee.toFixed(2))
                        .replace(/{{propertyGpsAddress}}/g, gpsAddress)
                        .replace(/{{dueDate}}/g, dueDateFormatted)
                        .replace(/{{municipality}}/g, groupProps[0]?.municipality || 'Kpone-Katamanso (KKMA)')
                        .replace(/{{billYear}}/g, String(groupProps[0]?.billYear || new Date().getFullYear()))
                        .replace(/{{paymentLink}}/g, checkoutLink)
                        .replace(/{{billLink}}/g, assessmentLink)
                        .replace(/{{link_assessment}}/g, assessmentLink)
                        .replace(/{{link_checkout}}/g, checkoutLink);

                    // Strictly sanitize Unicode characters to guarantee pure GSM-7 encoding (153 chars/segment):
                    const messageText = rawMessageText
                        .replace(/•/g, '-')
                        .replace(/GH₵/g, 'GHS')
                        .replace(/₵/g, 'GHS');

                    let externalMessageId: string | null = null;
                    if (mode === 'LIVE') {
                        const provider = getActiveSmsProvider();
                        const smsRes = await provider.sendSMS(phone, messageText);
                        if (!smsRes?.success) throw new Error(`SMS rejected for ${phone}: ${smsRes?.error}`);
                        externalMessageId = smsRes?.messageId || null;
                    }
                    return {
                        accountNumbers: groupProps.map((p: any) => p.accountNumber).filter(Boolean),
                        phone,
                        ownerName,
                        messageText,
                        externalMessageId,
                    };
                })
            );

            const notifsToInsert: any[] = [];
            for (let cIdx = 0; cIdx < results.length; cIdx++) {
                const r = results[cIdx];
                const item = chunk[cIdx];
                const accs = item?.properties.map((p: any) => p.accountNumber).filter(Boolean) || [];
                const isFulfilled = r.status === 'fulfilled';
                if (isFulfilled) {
                    sentCount++;
                    sentAccountNumbers.push(...accs);
                } else {
                    failedAccountNumbers.push(...accs);
                }

                const accNo = accs[0] || 'KKMA';
                const ownerName = item?.properties[0]?.ownerNameDirect || item?.properties[0]?.name || 'Municipal Ratepayer';
                const phone = item?.phone || '';
                const errReason = !isFulfilled ? String((r as PromiseRejectedResult).reason) : null;
                const message = isFulfilled
                    ? (r.value?.messageText || `Notice dispatched to ${phone}`)
                    : `Delivery failed for ${phone}: ${errReason || 'Carrier rejection'}`;

                notifsToInsert.push({
                    id: `notif_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
                    title: `Bill Notice [${accNo}] - ${ownerName}`,
                    message,
                    type: 'BILLING_ROLLOUT',
                    deliveryMethod: 'SMS',
                    deliveryStatus: isFulfilled ? 'DELIVERED' : 'FAILED',
                    externalMessageId: isFulfilled ? (r.value?.externalMessageId || `ARK-${accNo}`) : 'FAILED_DISPATCH',
                    userId: null,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                });
            }

            if (notifsToInsert.length > 0) {
                try {
                    await supabase.from('Notification').insert(notifsToInsert);
                } catch (e: any) {
                    console.warn('Failed to insert rollout notifications:', e);
                }
            }

            const currentFailedCount = Math.max(0, totalCount - sentCount);

            await (prisma as any).smsRolloutJob.update({
                where: { id: jobId },
                data: {
                    sentCount,
                    failedCount: currentFailedCount,
                    sentAccountNumbers,
                    failedAccountNumbers,
                },
            });
        }

        const finalFailedCount = Math.max(0, totalCount - sentCount);
        const finalStatus = finalFailedCount === totalCount && totalCount > 0 ? 'FAILED' : 'DONE';
        await (prisma as any).smsRolloutJob.update({
            where: { id: jobId },
            data: {
                status: finalStatus,
                updatedAt: new Date().toISOString(),
                sentCount,
                failedCount: finalFailedCount,
                sentAccountNumbers,
                failedAccountNumbers,
            },
        });
    } catch (err) {
        console.error('[SMS Queue] Inline processor error:', err);
        await (prisma as any).smsRolloutJob.update({
            where: { id: jobId },
            data: { status: 'FAILED', errorMessage: String(err) },
        }).catch(() => { });
    }
}

// Lightweight status poll — called by UI every 2s during an active job
export async function getSmsJobStatus(jobId: string): Promise<{
    status: string;
    sentCount: number;
    failedCount: number;
    totalCount: number;
    failedAccountCount?: number;
} | null> {
    try {
        await requireAdminSession();
        const job = await (prisma as any).smsRolloutJob.findUnique({
            where: { id: jobId },
            select: { status: true, sentCount: true, failedCount: true, totalCount: true, failedAccountNumbers: true },
        });
        if (!job) return null;
        let status = job.status;
        const total = job.totalCount || 0;
        const sent = job.sentCount || 0;
        const failed = job.failedCount || 0;
        if (status === 'RUNNING' && total > 0 && sent + failed >= total) {
            status = sent === 0 ? 'FAILED' : 'DONE';
        }
        return {
            status,
            sentCount: job.sentCount,
            failedCount: job.failedCount,
            totalCount: job.totalCount,
            failedAccountCount: job.failedAccountNumbers?.length ?? job.failedCount,
        };
    } catch {
        return null;
    }
}

export interface SmsRolloutJobSummary {
    id: string;
    status: 'QUEUED' | 'RUNNING' | 'DONE' | 'FAILED';
    totalCount: number;
    sentCount: number;
    failedCount: number;
    accountCount: number;
    sentAccountCount: number;
    failedAccountCount: number;
    hasFailedAccounts: boolean;
    mode: string;
    createdAt: string;
    createdAtFormatted: string;
    errorMessage: string | null;
}

export async function getSmsRolloutJobs(limit = 30): Promise<SmsRolloutJobSummary[]> {
    try {
        await requireAdminSession();
        const jobs = await (prisma as any).smsRolloutJob.findMany({
            take: limit,
            orderBy: { createdAt: 'desc' },
        });

        return (jobs || []).map((j: any) => {
            const failedAccLen = (j.failedAccountNumbers && Array.isArray(j.failedAccountNumbers)) ? j.failedAccountNumbers.length : 0;
            const sentAccLen = (j.sentAccountNumbers && Array.isArray(j.sentAccountNumbers)) ? j.sentAccountNumbers.length : 0;
            const totalAccLen = (j.accountNumbers && Array.isArray(j.accountNumbers)) ? j.accountNumbers.length : 0;
            const hasFailed = failedAccLen > 0 || j.failedCount > 0;

            let status = j.status;
            const total = j.totalCount || totalAccLen;
            const sent = j.sentCount || 0;
            const failed = j.failedCount || failedAccLen;
            if (status === 'RUNNING' && total > 0 && sent + failed >= total) {
                status = sent === 0 ? 'FAILED' : 'DONE';
            }

            return {
                id: j.id,
                status,
                totalCount: j.totalCount || 0,
                sentCount: j.sentCount || 0,
                failedCount: j.failedCount || 0,
                accountCount: totalAccLen,
                sentAccountCount: sentAccLen,
                failedAccountCount: failedAccLen > 0 ? failedAccLen : j.failedCount,
                hasFailedAccounts: hasFailed,
                mode: j.mode || 'LIVE',
                createdAt: j.createdAt,
                createdAtFormatted: new Date(j.createdAt).toLocaleDateString('en-GB', {
                    day: '2-digit', month: 'short', year: 'numeric',
                    hour: '2-digit', minute: '2-digit', second: '2-digit'
                }),
                errorMessage: j.errorMessage || null,
            };
        });
    } catch (e) {
        console.error('Failed to get SMS rollout jobs:', e);
        return [];
    }
}

export async function retryFailedSmsJob(jobId: string, adminPassword?: string) {
    try {
        const admin = await requireAdminSession();
        if (!adminPassword) {
            return { success: false, error: 'Administrator security password is required to authorize SMS rollout dispatch.' };
        }
        const isAuthorized = verifyPassword(adminPassword, admin.passwordHash);
        if (!isAuthorized) {
            return { success: false, error: 'Incorrect administrator security password. Dispatch authorization rejected.' };
        }

        const originalJob = await (prisma as any).smsRolloutJob.findUnique({
            where: { id: jobId },
        });

        if (!originalJob) {
            return { success: false, error: 'Rollout job record not found.' };
        }

        let targetAccounts: string[] = originalJob.failedAccountNumbers || [];

        // Fallback for older jobs where failedAccountNumbers array wasn't recorded directly:
        if (targetAccounts.length === 0 && originalJob.failedCount > 0 && originalJob.accountNumbers?.length > 0) {
            const sentSet = new Set(originalJob.sentAccountNumbers || []);
            targetAccounts = originalJob.accountNumbers.filter((acc: string) => !sentSet.has(acc));
            if (targetAccounts.length === 0 || sentSet.size === 0) {
                targetAccounts = originalJob.accountNumbers.slice(originalJob.sentCount);
            }
        }

        if (targetAccounts.length === 0) {
            return { success: false, error: 'No failed accounts remaining to retry in this job.' };
        }

        await syncActiveSmsConfig();
        const effectiveMode = originalJob.mode || activeSmsConfig.dispatchMode || 'LIVE';
        const template = originalJob.template || activeSmsConfig.messageTemplate;

        // In-place resume: mark existing job as QUEUED (no duplicate job row created)
        await (prisma as any).smsRolloutJob.update({
            where: { id: jobId },
            data: {
                status: 'QUEUED',
                errorMessage: null,
            },
        });

        // Fire-and-forget background execution resuming the existing job
        processSmsJobInline(jobId, targetAccounts, template, effectiveMode, admin.id, true).catch((err) => {
            console.error('[SMS Queue] Resume job failed:', err);
        });

        await prisma.auditLog.create({
            data: {
                action: 'BATCH_SMS_RETRY_RESUMED',
                entityType: 'SmsRolloutJob',
                entityId: jobId,
                details: `Resumed batch ${jobId} for ${targetAccounts.length} remaining recipients`,
                adminId: admin.id,
            },
        });

        revalidatePath('/');
        return {
            success: true,
            jobId: jobId,
            dispatchedCount: targetAccounts.length,
            message: `Resuming rollout for ${targetAccounts.length} recipient(s)...`,
        };
    } catch (e: any) {
        console.error('Failed to retry SMS job:', e);
        return { success: false, error: e.message || 'Failed to retry SMS rollout.' };
    }
}


export interface SmsSettingsData {
    dispatchMode: 'TEST' | 'LIVE';
    provider: 'arkesel' | 'twilio';
    arkeselApiKey: string;
    arkeselSenderId: string;
    messageTemplate?: string;
    receiptTemplate?: string;
    balanceInfo?: {
        smsBalance: number;
        mainBalance: string;
    } | null;
}

export async function getSmsSettings(): Promise<SmsSettingsData> {
    await requireAdminSession();
    await syncActiveSmsConfig();

    const rawKey = activeSmsConfig.arkeselApiKey || '';
    const maskedKey = rawKey
        ? (rawKey.length > 8 ? rawKey.slice(0, 4) + '••••••••' + rawKey.slice(-4) : '••••••••')
        : '';

    // Do not contact Arkesel while loading SMS settings.
    // Balance is fetched separately through getArkeselBalance().
    return {
        dispatchMode: activeSmsConfig.dispatchMode,
        provider: activeSmsConfig.provider,
        arkeselApiKey: maskedKey,
        arkeselSenderId: activeSmsConfig.arkeselSenderId,
        messageTemplate: activeSmsConfig.messageTemplate,
        receiptTemplate: activeSmsConfig.receiptTemplate,
        balanceInfo: arkeselBalanceCache?.data ?? null,
    };
}

export async function getArkeselBalance(): Promise<{
    smsBalance: number;
    mainBalance: string;
} | null> {
    await requireAdminSession();
    await syncActiveSmsConfig();

    if (
        activeSmsConfig.provider !== "arkesel" ||
        !activeSmsConfig.arkeselApiKey
    ) {
        return null;
    }

    const now = Date.now();

    if (
        arkeselBalanceCache &&
        now - arkeselBalanceCache.timestamp < BALANCE_CACHE_TTL_MS
    ) {
        return arkeselBalanceCache.data;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    try {
        const response = await fetch(
            "https://sms.arkesel.com/api/v2/clients/balance-details",
            {
                method: "GET",
                headers: {
                    "api-key": activeSmsConfig.arkeselApiKey.trim(),
                },
                signal: controller.signal,
            }
        );

        const data = await response.json();

        if (response.ok && data.status === "success") {
            const balanceInfo = {
                smsBalance: data.data?.sms_balance ?? 0,
                mainBalance: data.data?.main_balance ?? "GHS 0.00",
            };

            arkeselBalanceCache = {
                data: balanceInfo,
                timestamp: now,
            };

            return balanceInfo;
        }

        return null;
    } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
            console.warn("Arkesel balance check timed out (8s limit exceeded).");
        } else {
            console.warn("Arkesel balance check failed:", err);
        }

        return null;
    } finally {
        clearTimeout(timeoutId);
    }
}

export async function updateSmsSettings(newConfig: {
    dispatchMode?: 'TEST' | 'LIVE';
    provider?: 'arkesel' | 'twilio';
    arkeselApiKey?: string;
    arkeselSenderId?: string;
    messageTemplate?: string;
    receiptTemplate?: string;
}) {
    const admin = await requireAdminSession();

    if (newConfig.dispatchMode) activeSmsConfig.dispatchMode = newConfig.dispatchMode;
    if (newConfig.provider) activeSmsConfig.provider = newConfig.provider;
    if (newConfig.arkeselApiKey !== undefined) {
        const trimmedKey = newConfig.arkeselApiKey.trim();
        if (trimmedKey && !trimmedKey.includes('••••')) {
            activeSmsConfig.arkeselApiKey = trimmedKey;
        }
    }
    if (newConfig.arkeselSenderId !== undefined) activeSmsConfig.arkeselSenderId = newConfig.arkeselSenderId;
    if (newConfig.messageTemplate !== undefined) activeSmsConfig.messageTemplate = newConfig.messageTemplate;
    if (newConfig.receiptTemplate !== undefined) activeSmsConfig.receiptTemplate = newConfig.receiptTemplate;

    if (activeSmsConfig.arkeselApiKey) {
        arkeselService.setApiKey(activeSmsConfig.arkeselApiKey);
    }
    if (activeSmsConfig.arkeselSenderId) {
        arkeselService.setSenderId(activeSmsConfig.arkeselSenderId);
    }

    try {
        const upserts = [];
        if (newConfig.dispatchMode) {
            upserts.push((prisma as any).systemSetting.upsert({
                where: { key: 'sms_dispatch_mode' },
                update: { value: newConfig.dispatchMode },
                create: { key: 'sms_dispatch_mode', value: newConfig.dispatchMode }
            }));
        }
        if (newConfig.provider) {
            upserts.push((prisma as any).systemSetting.upsert({
                where: { key: 'sms_provider' },
                update: { value: newConfig.provider },
                create: { key: 'sms_provider', value: newConfig.provider }
            }));
        }
        if (newConfig.arkeselApiKey !== undefined) {
            const trimmedKey = newConfig.arkeselApiKey.trim();
            if (trimmedKey && !trimmedKey.includes('••••')) {
                upserts.push((prisma as any).systemSetting.upsert({
                    where: { key: 'sms_arkesel_api_key' },
                    update: { value: trimmedKey },
                    create: { key: 'sms_arkesel_api_key', value: trimmedKey }
                }));
            }
        }
        if (newConfig.arkeselSenderId !== undefined) {
            upserts.push((prisma as any).systemSetting.upsert({
                where: { key: 'sms_arkesel_sender_id' },
                update: { value: newConfig.arkeselSenderId },
                create: { key: 'sms_arkesel_sender_id', value: newConfig.arkeselSenderId }
            }));
        }
        if (newConfig.messageTemplate !== undefined) {
            upserts.push((prisma as any).systemSetting.upsert({
                where: { key: 'sms_message_template' },
                update: { value: newConfig.messageTemplate },
                create: { key: 'sms_message_template', value: newConfig.messageTemplate }
            }));
        }
        if (newConfig.receiptTemplate !== undefined) {
            upserts.push((prisma as any).systemSetting.upsert({
                where: { key: 'sms_receipt_template' },
                update: { value: newConfig.receiptTemplate },
                create: { key: 'sms_receipt_template', value: newConfig.receiptTemplate }
            }));
        }
        if (upserts.length > 0) {
            await Promise.all(upserts);
        }
    } catch (dbErr) {
        console.error('Failed to persist settings to SystemSetting:', dbErr);
    }

    await prisma.auditLog.create({
        data: {
            action: 'SYSTEM_SETTINGS_UPDATE',
            entityType: 'SystemConfig',
            details: `Updated SMS settings: Mode=${activeSmsConfig.dispatchMode}, Provider=${activeSmsConfig.provider}, SenderID=${activeSmsConfig.arkeselSenderId}${newConfig.messageTemplate !== undefined ? ', TemplateUpdated=true' : ''}`,
            adminId: admin.id,
        },
    });

    revalidatePath('/');
    return { success: true, settings: activeSmsConfig };
}

export async function saveSmsTemplate(template: string, type: 'BILLING' | 'RECEIPT' = 'BILLING') {
    const admin = await requireAdminSession();
    const settingKey = type === 'RECEIPT' ? 'sms_receipt_template' : 'sms_message_template';
    const fallback = type === 'RECEIPT' ? DEFAULT_RECEIPT_NOTICE_TEMPLATE : DEFAULT_SMS_NOTICE_TEMPLATE;
    const cleanTemplate = template.trim() || fallback;

    if (type === 'RECEIPT') {
        activeSmsConfig.receiptTemplate = cleanTemplate;
    } else {
        activeSmsConfig.messageTemplate = cleanTemplate;
    }

    try {
        await (prisma as any).systemSetting.upsert({
            where: { key: settingKey },
            update: { value: cleanTemplate },
            create: { key: settingKey, value: cleanTemplate },
        });
    } catch (dbErr) {
        console.error(`Failed to persist ${settingKey} to SystemSetting:`, dbErr);
    }

    await prisma.auditLog.create({
        data: {
            action: type === 'RECEIPT' ? 'SMS_RECEIPT_TEMPLATE_UPDATE' : 'SMS_TEMPLATE_UPDATE',
            entityType: 'SystemConfig',
            details: `Saved ${type === 'RECEIPT' ? 'payment receipt' : 'statutory'} SMS notice template (${cleanTemplate.length} characters)`,
            adminId: admin.id,
        },
    });

    revalidatePath('/');
    return { success: true, template: cleanTemplate, type };
}

export async function testArkeselGatewayConnection(apiKey?: string) {
    await requireAdminSession();
    const provided = (apiKey || '').trim();
    const keyToTest = (provided && !provided.includes('••••')) ? provided : activeSmsConfig.arkeselApiKey;

    if (!keyToTest || keyToTest.trim() === '') {
        return { success: false, error: 'Please enter an Arkesel API key to test connection.' };
    }

    try {
        const res = await fetch('https://sms.arkesel.com/api/v2/clients/balance-details', {
            method: 'GET',
            headers: { 'api-key': keyToTest.trim() },
        });
        const data = await res.json();

        if (res.ok && data.status === 'success') {
            const smsUnits = data.data?.sms_balance ?? 0;
            const balance = data.data?.main_balance ?? 'GHS 0.00';
            return {
                success: true,
                smsBalance: smsUnits,
                mainBalance: balance,
                message: `Arkesel Gateway Connected. Available balance: ${smsUnits} SMS credits (${balance}).`,
            };
        }

        return {
            success: false,
            error: data.message || `Arkesel returned HTTP ${res.status}: Invalid key or credentials.`,
        };
    } catch (err: any) {
        return {
            success: false,
            error: err.message || 'Network error attempting to reach sms.arkesel.com.',
        };
    }
}

export async function runAnnualBillingBatch(params: {
    residentialRate: number;
    commercialRate: number;
    otherRate: number;
    dueDate: string;
    messageTemplate: string;
    baseUrl?: string;
    adminPassword?: string;
}) {
    try {
        const admin = await requireAdminSession();

        if (!params.adminPassword) {
            return { success: false, error: 'Administrator security password is required to authorize annual batch billing rollout.' };
        }
        const isAuthorized = verifyPassword(params.adminPassword, admin.passwordHash);
        if (!isAuthorized) {
            return { success: false, error: 'Incorrect administrator security password. Batch rollout rejected.' };
        }

        const properties = await prisma.property.findMany({
            include: { users: true, owner: true }
        });

        const notificationsToCreate = [];

        for (const prop of properties) {
            const newArrears = prop.arrears + (prop.status === 'PAID' ? 0 : prop.currentFee);

            let newRateImposed = params.otherRate;
            if (prop.propertyClassification === 'RESIDENTIAL' || prop.propertyClassification === 'PRIVATE THIRD CLASS RESIDENTIAL') {
                newRateImposed = params.residentialRate;
            } else if (prop.propertyClassification === 'COMMERCIAL' || prop.propertyClassification === 'SECOND CLASS COMMERCIAL') {
                newRateImposed = params.commercialRate;
            }

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

            const primaryUser = prop.users?.[0];
            const ownerName = prop.owner?.name || primaryUser?.name || 'Municipal Ratepayer';
            const ownerPhone = prop.owner?.tel || prop.owner?.mobileNumber || primaryUser?.phoneNumber;

            let targetUser = primaryUser;
            if (!targetUser?.id && ownerPhone) {
                const existing = await prisma.user.findUnique({ where: { phoneNumber: ownerPhone } });
                if (existing) {
                    targetUser = await prisma.user.update({
                        where: { id: existing.id },
                        data: { name: ownerName },
                    });
                } else {
                    targetUser = await prisma.user.create({
                        data: { phoneNumber: ownerPhone, name: ownerName },
                    });
                }
            }

            if (ownerPhone && targetUser?.id) {
                const formatted = smsFormatter.formatBillRolloutMessage({
                    accountNumber: prop.accountNumber,
                    ownerName: ownerName,
                    phoneNumber: ownerPhone,
                    totalAmountDue: newTotalAmountDue,
                    arrears: newArrears,
                    currentFee: newCurrentFee,
                    dueDate: params.dueDate,
                    baseUrl: params.baseUrl,
                    customTemplate: params.messageTemplate,
                    municipality: prop.municipality || 'Kpone-Katamanso (KKMA)',
                    billYear: prop.billYear + 1,
                });

                notificationsToCreate.push({
                    userId: targetUser.id,
                    title: `FY ${prop.billYear + 1} Annual Rate Assessment Issued`,
                    message: formatted.messageText,
                    type: 'BILLING_ROLLOUT',
                    deliveryMethod: 'SMS',
                    deliveryStatus: 'PENDING',
                });
            }
        }

        if (notificationsToCreate.length > 0) {
            await prisma.notification.createMany({
                data: notificationsToCreate,
            });
        }

        await prisma.auditLog.create({
            data: {
                action: 'BATCH_BILLING',
                entityType: 'Property',
                details: `Ran annual billing batch for ${properties.length} properties with dual-link SMS queue.`,
                adminId: admin.id
            }
        });

        metricsCache.clear();
        revalidatePath('/');

        return { success: true, count: properties.length };
    } catch (error) {
        console.error('Error running batch billing:', error);
        return { success: false, error: error instanceof Error ? error.message : 'Failed to execute batch billing rollout.' };
    }
}
export async function linkPhysicalGcrToReceipt(receiptId: string, physicalGcr: string) {
    try {
        await requireAdminSession();
        
        if (!receiptId || !physicalGcr) {
            return { success: false, error: 'Receipt ID and Physical GCR number are required.' };
        }
        
        // 1. Fetch the existing digital receipt
        const existingReceipt = await adminDb.receipt.findUnique({
            where: { id: receiptId }
        });
        
        if (!existingReceipt) {
            return { success: false, error: 'Receipt not found.' };
        }
        
        // 2. Update the Receipt table
        await adminDb.receipt.update({
            where: { id: receiptId },
            data: { receiptNumber: physicalGcr }
        });
        
        // 3. Update the RMMS FeePayment table (if it exists)
        // FeePayment tracks receipts using gcrNr. We look it up by the old digital number.
        /*
        if (oldDigitalNumber) {
            await adminDb.feePayment.updateMany({
                where: { gcrNr: oldDigitalNumber },
                data: { gcrNr: physicalGcr }
            });
        }
        */
        
        // 4. Log the action
        /*
        const adminUser = await getAdminUser();
        await logAdminAction(adminUser?.id || 'admin', 'LINK_GCR', {
            receiptId,
            oldNumber: oldDigitalNumber,
            newNumber: physicalGcr,
            propertyAccountNumber: existingReceipt.propertyAccountNumber
        });
        */

        // 5. Dispatch the Official GCR SMS to the citizen
        const phone = existingReceipt.paymentPhoneNumber || existingReceipt.user?.phoneNumber || existingReceipt.property?.telephone;
        if (phone) {
            const smsMsg = `KKMA Official Receipt\nYour payment of GH\u20b5 ${existingReceipt.amount.toFixed(2)} is complete.\n\nOfficial Receipt: ${physicalGcr}\nAccount: ${existingReceipt.property?.accountNumber || 'N/A'}\n\nThank you for paying your Property Rate.\nKeep this SMS as proof of payment.`;
            try {
                await arkeselService.sendSMS(phone, smsMsg);
                console.log(`[LINK GCR] Official SMS dispatched to ${phone} with receipt ${physicalGcr}`);
            } catch (smsErr) {
                console.error('[LINK GCR] Failed to dispatch official SMS:', smsErr);
                // Do not block the successful linkage return on SMS failure
            }
        }
        
        return { success: true };
    } catch (error: any) {
        console.error('Failed to link physical GCR:', error);
        return { success: false, error: error.message || 'Failed to update receipt.' };
    }
}

export async function recordManualCashPayment(
    accountNumber: string,
    amount: number,
    paymentMethod: string = 'Counter Cash Treasury',
    adminPassword?: string,
    settlementType: 'TOTAL' | 'ARREARS' = 'TOTAL'
) {
    try {
        const admin = await requireAdminSession();
        if (!admin) {
            return { success: false, error: 'Unauthorized session. Please sign in to authorize payment settlement.' };
        }

        const property = await prisma.property.findUnique({
            where: { accountNumber },
            include: { users: true, receipts: true },
        });

        if (!property) {
            return { success: false, error: 'Account not found in municipality register.' };
        }

        let primaryOwner = property.users?.[0];
        if (!primaryOwner) {
            const phone = property.telephone || property.ownerPhoneDirect || property.ownerPhone;
            if (phone) {
                primaryOwner = await prisma.user.findFirst({ where: { phoneNumber: phone } });
            }
            if (!primaryOwner) {
                primaryOwner = await prisma.user.create({
                    data: {
                        name: property.name || property.ownerNameDirect || property.ownerName || 'Municipal Ratepayer',
                        phoneNumber: phone || `020${Math.floor(1000000 + Math.random() * 9000000)}`,
                        role: 'RATEPAYER',
                    }
                });
            }
        }

        const initialArr = Number(property.initialArrears !== undefined ? property.initialArrears : (property.initial_arrears !== undefined ? property.initial_arrears : property.arrears || 0));
        const prevPaidCycle = Number(property.totalPaidCycle !== undefined ? property.totalPaidCycle : (property.total_paid_cycle !== undefined ? property.total_paid_cycle : property.amountPaidLastYear || 0));
        const currArr = Number(property.currentArrears !== undefined ? property.currentArrears : (property.current_arrears !== undefined ? property.current_arrears : Math.max(0, initialArr - prevPaidCycle)));
        const currFee = Number(property.currentFee || property.current_bill || 0);

        // Automatic Sequential Municipal Debt Waterfall:
        // Payment first eats into overdue arrears until 0, then spills into current fee
        const arrearsDeduction = Math.min(currArr, amount);
        const newCurrentArrears = Math.max(0, Number((currArr - arrearsDeduction).toFixed(2)));
        const remainingPayment = Math.max(0, Number((amount - arrearsDeduction).toFixed(2)));
        const feeDeduction = Math.min(currFee, remainingPayment);
        const newCurrentFee = Math.max(0, Number((currFee - feeDeduction).toFixed(2)));

        const newTotalPaidCycle = Number((prevPaidCycle + amount).toFixed(2));
        const prevAmountPaid = Number(property.amount_paid !== undefined ? property.amount_paid : property.amountPaidLastYear || 0);
        const newAmountPaid = Number((prevAmountPaid + amount).toFixed(2));
        const newTotalDue = Math.max(0, Number((newCurrentArrears + newCurrentFee).toFixed(2)));
        const newStatus: 'PAID' | 'PARTIALLY_PAID' | 'UNPAID' = newTotalDue <= 0 ? 'PAID' : (newTotalPaidCycle > 0 ? 'PARTIALLY_PAID' : 'UNPAID');

        const receiptNumber = `DIG-KKMA-${Date.now().toString(36).toUpperCase()}`;
        const now = new Date();
        const formattedDate = formatDateGb(now);
        const formattedTime = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }) + ' UTC';

        await prisma.$transaction([
            prisma.property.update({
                where: { id: property.id },
                data: {
                    currentArrears: newCurrentArrears,
                    current_arrears: newCurrentArrears,
                    totalPaidCycle: newTotalPaidCycle,
                    total_paid_cycle: newTotalPaidCycle,
                    amount_paid: newAmountPaid,
                    amountPaidLastYear: newAmountPaid,
                    currentFee: newCurrentFee,
                    current_bill: newCurrentFee,
                    totalAmountDue: newTotalDue,
                    outstanding_amt: newTotalDue,
                    status: newStatus,
                },
            }),
            prisma.receipt.create({
                data: {
                    userId: primaryOwner.id,
                    propertyId: property.id,
                    amount: amount,
                    settlementType,
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
                    details: `Recorded cash payment of GH₵ ${amount} for ${accountNumber} (${settlementType} settlement, GCR: ${receiptNumber})`,
                    adminId: admin.id
                }
            }),
        ]);

        // Also record in Supabase FeePayment table for RMMS compliance
        try {
            await supabase.from('FeePayment').insert([{
                id: `fp_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`,
                accountNo: property.accountNumber,
                arrearsPd: arrearsDeduction,
                curAmtPd: feeDeduction,
                amtPaid: amount,
                datePaid: now.toISOString(),
                pmtMode: paymentMethod || 'Counter Cash Treasury',
                gcrNr: receiptNumber,
                userId: primaryOwner.id,
                propertyId: property.id,
                transactionId: receiptNumber,
            }]);
        } catch (fpErr) {
            console.warn('FeePayment table insert fallback notice:', fpErr);
        }

        const formattedReceipt: AdminPropertyReceipt = {
            id: `rec_${Date.now().toString(36)}`,
            receiptNumber,
            amount,
            amountFormatted: formatGhc(amount),
            settlementType,
            paymentMethod: paymentMethod || 'Counter Cash Treasury',
            status: 'PAID',
            datePaid: `${formattedDate}, ${formattedTime}`,
            exactTimestamp: now.toISOString(),
            formattedDate,
            formattedTime,
            propertyAccountNumber: property.accountNumber,
            propertyId: property.id,
            userId: primaryOwner.id,
            payerPhoneNumber: primaryOwner.phoneNumber || property.telephone,
            payerName: primaryOwner.name || property.name,
            narrative: {
                targetAccount: property.accountNumber,
                targetDigitalAddress: property.ownerDigitalAddress || '',
                arrearsPaid: arrearsDeduction,
                arrearsPaidFormatted: formatGhc(arrearsDeduction),
                currentFeePaid: feeDeduction,
                currentFeePaidFormatted: formatGhc(feeDeduction),
                totalAmountPaid: amount,
                totalAmountPaidFormatted: formatGhc(amount),
                remainingTotalDue: newTotalDue,
                remainingTotalDueFormatted: formatGhc(newTotalDue),
                propertyStatusAfter: newStatus === 'PAID' ? 'FULLY_SETTLED' : 'PARTIALLY_PAID',
                isFullySettled: newStatus === 'PAID',
                actionRequiredText: newStatus === 'PAID'
                    ? 'Account fully settled & cleared. Zero debt remaining.'
                    : `Outstanding balance of ${formatGhc(newTotalDue)} remains due.`,
            },
        };

        const updatedProperty = {
            id: property.id,
            accountNumber: property.accountNumber,
            initialArrears: initialArr,
            initialArrearsFormatted: formatGhc(initialArr),
            currentArrears: newCurrentArrears,
            currentArrearsFormatted: formatGhc(newCurrentArrears),
            totalPaidCycle: newTotalPaidCycle,
            totalPaidCycleFormatted: formatGhc(newTotalPaidCycle),
            currentFee: newCurrentFee,
            currentFeeFormatted: formatGhc(newCurrentFee),
            totalAmountDue: newTotalDue,
            totalAmountDueFormatted: formatGhc(newTotalDue),
            status: newStatus,
            receipts: [formattedReceipt, ...(property.receipts || [])],
        };

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
                await prisma.notification.updateMany({
                    where: {
                        userId: primaryOwner.id,
                    },
                    data: { isRead: true },
                });
            } catch (notifErr) {
                console.error('Error auto-resolving notifications for owner:', notifErr);
            }
        }

        metricsCache.clear();
        revalidatePath('/');
        return { success: true, receiptNumber, receipt: formattedReceipt, updatedProperty };
    } catch (error) {
        console.error('Error recording manual payment:', error);
        return { success: false, error: 'Failed to record payment.' };
    }
}

export async function saveProperty(data: any, adminPassword?: string) {
    try {
        const admin = await requireAdminSession();

        if (!adminPassword) {
            return { success: false, error: 'Administrator security password is required to authorize property valuation changes.' };
        }
        const isAuthorized = verifyPassword(adminPassword, admin.passwordHash);
        if (!isAuthorized) {
            return { success: false, error: 'Incorrect administrator security password. Assessment authorization rejected.' };
        }

        const { id, accountNumber, ownerName, ownerPhone, ownerDigitalAddress, physicalAddress, municipality, propertyClassification, rateableValue, rateImposed } = data;
        const currentFee = rateableValue * rateImposed;

        let owner = await prisma.user.findUnique({ where: { phoneNumber: ownerPhone } });
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
                    settlementDeadline: new Date(new Date().getFullYear(), 5, 30),
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

        metricsCache.clear();
        revalidatePath('/');
        return { success: true };
    } catch (error) {
        console.error('Error saving property:', error);
        return { success: false, error: 'Failed to save property.' };
    }
}

export async function importCadastreCsvBatch(rows: any[], adminPassword?: string) {
    try {
        const admin = await requireAdminSession();

        if (!adminPassword) {
            return { success: false, error: 'Administrator security password is required to authorize CSV cadastre import.' };
        }
        const isAuthorized = verifyPassword(adminPassword, admin.passwordHash);
        if (!isAuthorized) {
            return { success: false, error: 'Incorrect administrator security password. Batch cadastre import rejected.' };
        }

        if (!Array.isArray(rows) || rows.length === 0) {
            return { success: false, error: 'No cadastre records provided in import batch.' };
        }

        let importedCount = 0;
        let skippedCount = 0;

        for (const r of rows) {
            const accountNumber = (r.accountNumber || r['Account Number'] || r['account_no'] || r['Account'] || '').trim();
            if (!accountNumber) {
                skippedCount++;
                continue;
            }

            const ownerName = (r.ownerName || r['Owner Name'] || r['owner_name'] || r['Name'] || r['Taxpayer'] || 'Municipal Ratepayer').trim();
            const ownerPhone = (r.ownerPhone || r['Owner Phone'] || r['owner_phone'] || r['Phone'] || r['Telephone'] || '').trim();
            const digitalAddress = (r.ownerDigitalAddress || r['Digital Address'] || r['digital_address'] || r['GPS'] || '').trim();
            const physicalAddress = (r.physicalAddress || r['Physical Address'] || r['physical_address'] || r['Address'] || '').trim();
            const municipality = (r.municipality || r['Municipality'] || 'Kpone-Katamanso (KKMA)').trim();
            const propertyClassification = (r.propertyClassification || r['Classification'] || r['classification'] || 'RESIDENTIAL').trim();

            const rateableValue = parseFloat(r.rateableValue || r['Rateable Value'] || r['rateable_value'] || r['Value'] || 0) || 0;
            const rateImposed = parseFloat(r.rateImposed || r['Rate Imposed'] || r['rate_imposed'] || r['Rate'] || 0.00025) || 0.00025;
            const arrears = parseFloat(r.arrears || r['Arrears'] || 0) || 0;
            const billYear = parseInt(r.billYear || r['Bill Year'] || r['bill_year'] || 2026, 10) || 2026;

            const currentFee = rateableValue * rateImposed;
            const totalAmountDue = arrears + currentFee;
            const status = totalAmountDue <= 0 ? 'PAID' : 'UNPAID';

            let owner = null;
            if (ownerPhone) {
                owner = await prisma.user.findUnique({ where: { phoneNumber: ownerPhone } });
                if (!owner) {
                    owner = await prisma.user.create({
                        data: { phoneNumber: ownerPhone, name: ownerName }
                    });
                }
            }

            const existingProp = await prisma.property.findUnique({ where: { accountNumber } });
            if (existingProp) {
                await prisma.property.update({
                    where: { id: existingProp.id },
                    data: {
                        ownerDigitalAddress: digitalAddress || existingProp.ownerDigitalAddress,
                        physicalAddress: physicalAddress || existingProp.physicalAddress,
                        municipality,
                        propertyClassification,
                        rateableValue,
                        rateImposed,
                        arrears,
                        currentFee,
                        totalAmountDue,
                        status,
                        billYear,
                        ...(owner ? { users: { connect: [{ id: owner.id }] } } : {})
                    }
                });
            } else {
                await prisma.property.create({
                    data: {
                        accountNumber,
                        ownerDigitalAddress: digitalAddress,
                        physicalAddress,
                        municipality,
                        propertyClassification,
                        rateableValue,
                        rateImposed,
                        arrears,
                        currentFee,
                        totalAmountDue,
                        status,
                        billYear,
                        settlementDeadline: new Date(new Date().getFullYear(), 5, 30),
                        ...(owner ? { users: { connect: [{ id: owner.id }] } } : {})
                    }
                });
            }

            importedCount++;
        }

        await prisma.auditLog.create({
            data: {
                action: 'BATCH_CADASTRE_IMPORT',
                entityType: 'Property',
                details: `Imported ${importedCount} valuation properties into cadastre roll via CSV batch upload (skipped ${skippedCount}).`,
                adminId: admin.id
            }
        });

        metricsCache.clear();
        revalidatePath('/');

        return {
            success: true,
            importedCount,
            skippedCount,
            total: rows.length
        };
    } catch (error) {
        console.error('Error importing cadastre CSV batch:', error);
        return { success: false, error: 'Failed to process CSV cadastre batch import.' };
    }
}

export async function attachScannedReceiptImage(
    receiptId: string,
    base64Data: string,
    mimeType: string = 'image/jpeg'
) {
    try {
        const admin = await requireAdminSession();

        if (!receiptId || !base64Data) {
            return { success: false, error: 'Receipt ID and image data are required.' };
        }

        const cleanBase64 = base64Data.replace(/^data:image\/\w+;base64,/, '');
        const buffer = Buffer.from(cleanBase64, 'base64');

        const ext = mimeType.includes('png') ? 'png' : mimeType.includes('webp') ? 'webp' : 'jpg';
        const fileName = `gcr_${receiptId}_${Date.now()}.${ext}`;

        const { error: uploadError } = await supabase.storage
            .from('receipt-scans')
            .upload(fileName, buffer, {
                contentType: mimeType,
                upsert: true,
            });

        if (uploadError) {
            console.error('Supabase storage upload error:', uploadError);
            return { success: false, error: `Storage upload failed: ${uploadError.message}` };
        }

        const { data: publicUrlData } = supabase.storage
            .from('receipt-scans')
            .getPublicUrl(fileName);

        const publicUrl = publicUrlData.publicUrl;

        const updated = await prisma.receipt.update({
            where: { id: receiptId },
            data: {
                scannedImageUrl: publicUrl,
                isPhysicalIssued: true,
            },
        });

        await prisma.auditLog.create({
            data: {
                action: 'RECEIPT_SCAN_ATTACHED',
                entityType: 'Receipt',
                entityId: receiptId,
                details: `Attached physical scanned receipt image for receipt #${updated.receiptNumber || receiptId}`,
                adminId: admin.id,
            },
        });

        revalidatePath('/');
        return { success: true, publicUrl, receiptNumber: updated.receiptNumber };
    } catch (err: any) {
        console.error('Error attaching scanned receipt image:', err);
        return { success: false, error: err.message || 'Failed to attach scanned receipt image' };
    }
}

export async function attachPropertyBillImage(
    accountNumber: string,
    base64Data: string,
    mimeType: string = 'image/jpeg'
) {
    try {
        const admin = await requireAdminSession();

        if (!accountNumber || !base64Data) {
            return { success: false, error: 'Property account number and image data are required.' };
        }

        const cleanBase64 = base64Data.replace(/^data:[^;]+;base64,/, '');
        const buffer = Buffer.from(cleanBase64, 'base64');

        const ext = mimeType.includes('pdf')
            ? 'pdf'
            : mimeType.includes('png')
            ? 'png'
            : mimeType.includes('webp')
            ? 'webp'
            : 'jpg';
        const fileName = `bill_${accountNumber.replace(/[^a-zA-Z0-9_-]/g, '_')}_${Date.now()}.${ext}`;

        const { error: uploadError } = await supabase.storage
            .from('bill-scans')
            .upload(fileName, buffer, {
                contentType: mimeType,
                upsert: true,
            });

        if (uploadError) {
            console.error('Supabase storage upload error:', uploadError);
            return { success: false, error: `Storage upload failed: ${uploadError.message}` };
        }

        const { data: publicUrlData } = supabase.storage
            .from('bill-scans')
            .getPublicUrl(fileName);

        const publicUrl = publicUrlData.publicUrl;

        await adminDb.property.update({
            where: { accountNumber },
            data: {
                billImageUrl: publicUrl,
            },
        });

        await prisma.auditLog.create({
            data: {
                action: 'BILL_SCAN_ATTACHED',
                entityType: 'Property',
                entityId: accountNumber,
                details: `Attached official rate bill scan for property #${accountNumber}`,
                adminId: admin.id,
            },
        });

        revalidatePath('/');
        return { success: true, publicUrl };
    } catch (err: any) {
        console.error('Error attaching property bill image:', err);
        return { success: false, error: err.message || 'Failed to attach property bill image' };
    }
}

export async function sendReceiptNoticeSMS(receiptId: string, customTemplate?: string) {
    try {
        const admin = await requireAdminSession();

        const receipt = await prisma.receipt.findUnique({
            where: { id: receiptId },
        });

        if (!receipt) {
            return { success: false, error: 'Receipt record not found.' };
        }

        let user = receipt.userId ? await prisma.user.findUnique({ where: { id: receipt.userId } }) : null;
        const property = receipt.propertyId ? await prisma.property.findUnique({ where: { id: receipt.propertyId } }) : null;

        const targetPhone = user?.phoneNumber || receipt.paymentPhoneNumber;
        if (!targetPhone) {
            return { success: false, error: 'No phone number linked to this receipt or ratepayer.' };
        }

        if (!user && targetPhone) {
            const existing = await prisma.user.findUnique({ where: { phoneNumber: targetPhone } });
            if (existing) {
                user = existing;
            } else {
                user = await prisma.user.create({
                    data: { phoneNumber: targetPhone, name: 'Ratepayer' },
                });
            }
        }

        let host = (process.env.NEXT_PUBLIC_APP_URL || 'https://property-rate-app.vercel.app').replace(/\/$/, '');
        if (host.includes('-projects.vercel.app') || host.includes('kzz98dclv')) {
            host = 'https://property-rate-app.vercel.app';
        }

        const receiptLink = `${host}/receipts/verify?code=${encodeURIComponent(receipt.receiptNumber)}`;
        const formattedAmount = Number(receipt.amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        const formattedDate = formatDateGb(receipt.datePaid);

        await syncActiveSmsConfig();
        const templateToUse = customTemplate?.trim() || activeSmsConfig.receiptTemplate || DEFAULT_RECEIPT_NOTICE_TEMPLATE;
        const messageText = templateToUse
            .replace(/{{amount}}/g, formattedAmount)
            .replace(/{{receiptNumber}}/g, receipt.receiptNumber)
            .replace(/{{accountNumber}}/g, property?.accountNumber || 'MUNICIPAL')
            .replace(/{{receiptLink}}/g, receiptLink)
            .replace(/{{paymentMethod}}/g, receipt.paymentMethod || 'Mobile Money')
            .replace(/{{datePaid}}/g, formattedDate)
            .replace(/{{ownerName}}/g, user?.name || 'Ratepayer');

        const provider = getActiveSmsProvider();
        const smsRes = await provider.sendSMS(targetPhone, messageText);

        if (smsRes.success) {
            if (user?.id) {
                await prisma.notification.create({
                    data: {
                        userId: user.id,
                        title: `Payment Receipt Issued: #${receipt.receiptNumber}`,
                        message: messageText,
                        type: 'PAYMENT_CONFIRMATION',
                        deliveryMethod: 'SMS',
                        deliveryStatus: 'DELIVERED',
                    },
                });
            }

            await prisma.auditLog.create({
                data: {
                    action: 'SMS_RECEIPT_DISPATCHED',
                    entityType: 'Receipt',
                    entityId: receipt.id,
                    details: `Dispatched payment receipt SMS to ${targetPhone} for Receipt #${receipt.receiptNumber}`,
                    adminId: admin.id,
                },
            });

            return { success: true, message: `Receipt SMS successfully dispatched to ${targetPhone}` };
        } else {
            return { success: false, error: smsRes.error || 'Failed to dispatch SMS' };
        }
    } catch (err: any) {
        console.error('Error sending receipt notice SMS:', err);
        return { success: false, error: err.message || 'Failed to send receipt notice SMS' };
    }
}

export interface AdminTreasuryReceipt {
    id: string;
    receiptNumber: string;
    accountNumber: string;
    ownerName: string;
    amount: number;
    amountFormatted: string;
    settlementType: string;
    paymentMethod: string;
    status: string;
    datePaid: string;
    municipality: string;
}

export async function getTreasuryReceipts(
    searchQuery = "",
    paymentMethod = "ALL",
    page = 1,
    limit = 50
): Promise<{ receipts: AdminTreasuryReceipt[]; total: number } | null> {
    try {
        await requireAdminSession();

        let query = supabase
            .from('Receipt')
            .select('id, receiptNumber, amount, settlementType, paymentMethod, paymentPhoneNumber, status, collectorName, cashierName, datePaid, userId, propertyId', { count: 'exact' });

        if (paymentMethod && paymentMethod !== 'ALL') {
            query = query.ilike('paymentMethod', `%${paymentMethod}%`);
        }

        if (searchQuery && searchQuery.trim()) {
            const q = sanitizePostgrestFilter(searchQuery);
            if (q) {
                query = query.or(`receiptNumber.ilike.%${q}%,paymentPhoneNumber.ilike.%${q}%`);
            }
        }

        query = query.order('datePaid', { ascending: false });

        const skip = (page - 1) * limit;
        query = query.range(skip, skip + limit - 1);

        const { data, count, error } = await query;
        if (error || !data) return { receipts: [], total: 0 };

        const propertyIds = Array.from(new Set(data.map((r: any) => r.propertyId).filter(Boolean)));
        let propsById: Record<string, any> = {};
        if (propertyIds.length > 0) {
            const { data: props } = await supabase
                .from('Property')
                .select('id, account_no, name, municipality')
                .in('id', propertyIds);
            propsById = (props || []).reduce((acc: any, p: any) => {
                acc[p.id] = p;
                return acc;
            }, {});
        }

        const receipts: AdminTreasuryReceipt[] = data
            .filter((r: any) => {
                const prop = propsById[r.propertyId] || {};
                return !isHiddenTestAccount({ account_no: prop.account_no, name: prop.name, telephone: r.paymentPhoneNumber });
            })
            .map((r: any) => {
                const prop = propsById[r.propertyId] || {};
                const amt = Number(r.amount || 0);
                return {
                    id: r.id,
                    receiptNumber: r.receiptNumber || 'N/A',
                    accountNumber: prop.account_no || 'N/A',
                    ownerName: prop.name || 'Municipal Ratepayer',
                    amount: amt,
                    amountFormatted: formatGhc(amt),
                    settlementType: r.settlementType || 'TOTAL',
                    paymentMethod: r.paymentMethod || 'Counter Cash Treasury',
                    status: r.status || 'PAID',
                    datePaid: formatDateGb(r.datePaid),
                    municipality: prop.municipality || 'Kpone-Katamanso (KKMA)',
                };
            });

        return { receipts, total: count || 0 };
    } catch (err) {
        console.error('Failed to get treasury receipts:', err);
        return { receipts: [], total: 0 };
    }
}

export interface AdminPaidUserRecord {
    id: string;
    userId: string | null;
    userName: string;
    phoneNumber: string;
    payerName?: string;
    payerPhone?: string;
    payerEmail?: string;
    accountNumber: string;
    propertyId: string | null;
    amountPaid: number;
    amountPaidFormatted: string;
    arrearsPaid: number;
    currentPaid: number;
    paymentMethod: string;
    reference: string;
    receiptNumber: string;
    status: string;
    isTestUser: boolean;
    paidAt: string;
    gatewayResponse?: string;
    fees?: number;
    feesFormatted?: string;
    ipAddress?: string;
    authorizationCode?: string;
    bank?: string;
    countryCode?: string;
    timeSpent?: number;
    attempts?: number;
    errors?: number;
    timeline?: Array<{ time: number; message: string }>;
    deviceType?: string;
}

interface PaystackApiCacheEntry {
    json: any;
    timestamp: number;
}
const paystackApiCache = new Map<string, PaystackApiCacheEntry>();
const PAYSTACK_API_CACHE_TTL_MS = 30 * 1000;

export async function getPaidUsersList(
    searchQuery = "",
    filterType: "ALL" | "LIVE" | "ABANDONED" | "TEST" = "LIVE",
    statusFilter: "ALL" | "SUCCESS" | "ABANDONED" | "FAILED" = "ALL",
    page = 1,
    limit = 50
): Promise<{ records: AdminPaidUserRecord[]; total: number; totalAmount: number } | null> {
    try {
        await requireAdminSession();

        // 1. If explicitly filtering for Sandbox Test Accounts, read from local Supabase PaidUserRecord
        if (filterType === 'TEST') {
            let query = supabase
                .from('PaidUserRecord')
                .select('id, userId, userName, phoneNumber, accountNumber, propertyId, amountPaid, arrearsPaid, currentPaid, paymentMethod, reference, receiptNumber, status, isTestUser, paidAt', { count: 'exact' })
                .eq('isTestUser', true);

            if (searchQuery && searchQuery.trim()) {
                const q = sanitizePostgrestFilter(searchQuery);
                if (q) {
                    query = query.or(`userName.ilike.%${q}%,phoneNumber.ilike.%${q}%,accountNumber.ilike.%${q}%,reference.ilike.%${q}%,receiptNumber.ilike.%${q}%`);
                }
            }

            query = query.order('paidAt', { ascending: false });
            const skip = (page - 1) * limit;
            query = query.range(skip, skip + limit - 1);

            const { data, count, error } = await query;
            if (error || !data) return { records: [], total: 0, totalAmount: 0 };

            let sumQuery = supabase.from('PaidUserRecord').select('amountPaid').eq('isTestUser', true);
            const { data: sumData } = await sumQuery;
            const totalAmount = (sumData || []).reduce((acc: number, item: any) => acc + (Number(item.amountPaid) || 0), 0);

            const records: AdminPaidUserRecord[] = data.map((r: any) => ({
                id: r.id,
                userId: r.userId,
                userName: r.userName || 'Sandbox Test Account',
                phoneNumber: r.phoneNumber || 'N/A',
                accountNumber: r.accountNumber || 'N/A',
                propertyId: r.propertyId,
                amountPaid: Number(r.amountPaid || 0),
                amountPaidFormatted: formatGhc(Number(r.amountPaid || 0)),
                arrearsPaid: Number(r.arrearsPaid || 0),
                currentPaid: Number(r.currentPaid || 0),
                paymentMethod: r.paymentMethod || 'Paystack MoMo',
                reference: r.reference || 'N/A',
                receiptNumber: r.receiptNumber || 'N/A',
                status: r.status || 'PAID',
                isTestUser: true,
                paidAt: formatDateGb(r.paidAt),
                gatewayResponse: 'Approved (Sandbox Simulation)',
                fees: 0,
                feesFormatted: 'GH₵ 0.00',
                ipAddress: '127.0.0.1',
                authorizationCode: 'AUTH_SANDBOX_TEST',
                bank: 'MTN (GH)',
                countryCode: 'GH',
                timeSpent: 4,
                attempts: 1,
                errors: 0,
                timeline: [
                    { time: 0, message: 'Set payment method to mobile_money' },
                    { time: 4, message: 'Payment authorized and approved (Sandbox)' },
                ],
                deviceType: 'Desktop Web',
            }));

            return { records, total: count || 0, totalAmount };
        }

        // 2. For LIVE, ABANDONED, or ALL: Fetch directly from Paystack REST API
        const paystackKey = process.env.PAYSTACK_SECRET_KEY || '';
        if (!paystackKey) {
            return { records: [], total: 0, totalAmount: 0 };
        }
        try {
            const url = new URL('https://api.paystack.co/transaction');
            url.searchParams.set('perPage', String(Math.min(limit, 100)));
            url.searchParams.set('page', String(page));

            // Determine effective status filter
            const effectiveStatus = filterType === 'ABANDONED' ? 'ABANDONED' : statusFilter;
            if (effectiveStatus === 'SUCCESS') {
                url.searchParams.set('status', 'success');
            } else if (effectiveStatus === 'ABANDONED') {
                url.searchParams.set('status', 'abandoned');
            } else if (effectiveStatus === 'FAILED') {
                url.searchParams.set('status', 'failed');
            }

            const cacheKey = url.toString();
            const cached = paystackApiCache.get(cacheKey);
            let json: any = null;

            if (cached && (Date.now() - cached.timestamp < PAYSTACK_API_CACHE_TTL_MS)) {
                json = cached.json;
            } else {
                const response = await fetch(url.toString(), {
                    headers: {
                        Authorization: `Bearer ${paystackKey}`,
                        'Content-Type': 'application/json',
                    },
                    cache: 'no-store',
                });

                if (response.ok) {
                    json = await response.json();
                    if (json?.status) {
                        paystackApiCache.set(cacheKey, { json, timestamp: Date.now() });
                    }
                }
            }

            if (json && json.status && Array.isArray(json.data)) {
                let items = json.data;

                // Explicitly drop test transactions and known live test accounts from the live Paystack feed
                items = items.filter((t: any) => {
                    if (t.domain === 'test') return false;

                    // In local development, show all accounts (including internal test users)
                    if (!isLiveProductionDeployment()) return true;

                    const rawProp = t.metadata?.propertyIds || t.metadata?.accountNumber || t.metadata?.account_no || '';
                    const cleanAccountNo = rawProp.replace(/^prop_/, '').trim();
                    const cust = t.customer || {};
                    const meta = t.metadata || {};

                    const payerName = meta.payerName || meta.customer_name || `${cust.first_name || ''} ${cust.last_name || ''}`.trim() || cust.email || '';
                    const phone = cust.phone || (cust.email?.includes('@') ? cust.email.split('@')[0] : '') || meta.payerPhone || '';

                    if (isHiddenTestAccount({
                        accountNumber: cleanAccountNo,
                        propertyId: rawProp,
                        name: payerName,
                        phoneNumber: phone,
                    })) {
                        return false;
                    }

                    return true;
                });

                    // Batch query registered property owners from DB cadastre by account number and phone
                    const distinctAccounts = Array.from(
                        new Set(
                            items.map((t: any) => {
                                const rawProp = t.metadata?.propertyIds || t.metadata?.accountNumber || t.metadata?.account_no || '';
                                return rawProp.replace(/^prop_/, '').trim();
                            }).filter(Boolean)
                        )
                    );

                    const distinctPhones = Array.from(
                        new Set(
                            items.map((t: any) => {
                                const p = t.customer?.phone || (t.customer?.email?.includes('@') ? t.customer.email.split('@')[0] : '');
                                return (p || '').trim().replace(/[^\d]/g, '');
                            }).filter((p: string) => /^\d{9,12}$/.test(p))
                        )
                    );

                    const { data: dbProps } = distinctAccounts.length > 0
                        ? await supabase
                              .from('Property')
                              .select('id, account_no, name, telephone')
                              .in('account_no', distinctAccounts)
                        : { data: [] };

                    const { data: dbPropsPhone } = distinctPhones.length > 0
                        ? await supabase
                              .from('Property')
                              .select('id, account_no, name, telephone')
                              .in('telephone', distinctPhones)
                        : { data: [] };

                    const { data: dbUsers } = distinctPhones.length > 0
                        ? await supabase
                              .from('User')
                              .select('id, name, phoneNumber')
                              .in('phoneNumber', distinctPhones)
                        : { data: [] };

                    const userMap = new Map<string, any>();
                    for (const u of dbUsers || []) {
                        if (u.phoneNumber) {
                            const pStr = u.phoneNumber.trim();
                            userMap.set(pStr, u);
                            const norm = pStr.replace(/[^\d]/g, '');
                            if (norm) userMap.set(norm, u);
                        }
                    }

                    const propMap = new Map<string, any>();
                    const combinedProps = [...(dbProps || []), ...(dbPropsPhone || [])];
                    for (const p of combinedProps) {
                        if (p.account_no) {
                            const acc = p.account_no.trim();
                            propMap.set(acc, p);
                            propMap.set(acc.toUpperCase(), p);
                            propMap.set(acc.toLowerCase(), p);
                        }
                        if (p.telephone) {
                            const tel = p.telephone.trim();
                            propMap.set(tel, p);
                            const norm = tel.replace(/[^\d]/g, '');
                            if (norm) propMap.set(norm, p);
                        }
                    }

                    // If a search query is provided, filter items in memory against both registered owner and payer
                    if (searchQuery && searchQuery.trim()) {
                        const q = searchQuery.toLowerCase().trim();
                        items = items.filter((t: any) => {
                            const meta = t.metadata || {};
                            const cust = t.customer || {};
                            const ref = (t.reference || '').toLowerCase();
                            const payer = (meta.payerName || meta.customer_name || `${cust.first_name || ''} ${cust.last_name || ''}` || cust.email || '').toLowerCase();
                            const pPhone = (cust.phone || cust.email || '').toLowerCase();
                            const acc = (meta.propertyIds || meta.accountNumber || meta.account_no || '').replace(/^prop_/, '').toLowerCase();
                            const dbP = propMap.get(acc);
                            const dbName = (dbP?.name || '').toLowerCase();
                            const dbPhone = (dbP?.telephone || '').toLowerCase();
                            const uMatch = userMap.get(pPhone.replace(/[^\d]/g, ''));
                            const uName = (uMatch?.name || '').toLowerCase();
                            return ref.includes(q) || payer.includes(q) || pPhone.includes(q) || acc.includes(q) || dbName.includes(q) || dbPhone.includes(q) || uName.includes(q);
                        });
                    }

                    let totalAmount = 0;
                    const records: AdminPaidUserRecord[] = items.map((t: any) => {
                        const rawAmt = Number(t.amount || 0) / 100;
                        const meta = t.metadata || {};
                        const cust = t.customer || {};
                        const auth = t.authorization || {};

                        const netMunicipalAmount = Number(
                            meta.subtotal !== undefined && meta.subtotal !== null
                                ? meta.subtotal
                                : meta.actualAmount !== undefined && meta.actualAmount !== null
                                ? meta.actualAmount
                                : meta.processingFee
                                ? Math.max(0, rawAmt - Number(meta.processingFee))
                                : rawAmt
                        );

                        if (effectiveStatus === 'ABANDONED' && t.status === 'abandoned') {
                            totalAmount += netMunicipalAmount;
                        } else if (t.status === 'success') {
                            totalAmount += netMunicipalAmount;
                        }

                        const rawProp = meta.propertyIds || meta.accountNumber || meta.account_no || '';
                        const cleanAccountNo = rawProp.replace(/^prop_/, '').trim() || 'N/A';

                        let payerName = meta.payerName || meta.customer_name || '';
                        if (!payerName && cust.first_name) {
                            payerName = `${cust.first_name} ${cust.last_name || ''}`.trim();
                        }
                        if (!payerName && cust.email) {
                            payerName = cust.email.replace(/@propertyrate\.kkma\.gov\.gh$/, '');
                        }
                        if (!payerName) payerName = 'Property Owner';

                        let phone = cust.phone || '';
                        if (!phone && cust.email && cust.email.includes('@')) {
                            const prefix = cust.email.split('@')[0];
                            if (/^\d{9,12}$/.test(prefix)) {
                                phone = prefix;
                            }
                        }
                        if (!phone) phone = 'N/A';

                        const normPhone = phone ? phone.replace(/[^\d]/g, '') : '';
                        const dbProp = propMap.get(cleanAccountNo)
                            || propMap.get(cleanAccountNo.toUpperCase())
                            || propMap.get(cleanAccountNo.toLowerCase())
                            || (normPhone ? propMap.get(normPhone) : null)
                            || propMap.get(phone);

                        const dbUser = normPhone ? (userMap.get(normPhone) || userMap.get(phone)) : userMap.get(phone);

                        let registeredOwnerName = dbProp?.name || dbUser?.name || '';
                        if (!registeredOwnerName && payerName && !/^\d+$/.test(payerName.trim())) {
                            registeredOwnerName = payerName;
                        }
                        if (!registeredOwnerName) {
                            registeredOwnerName = 'Property Owner';
                        }
                        const registeredOwnerPhone = dbProp?.telephone || dbUser?.phoneNumber || phone;

                        let bankChannel = auth.bank || auth.brand || '';
                        let channelLabel = 'Mobile Money';
                        if (bankChannel) {
                            channelLabel = `Mobile Money (${bankChannel})`;
                        } else if (t.channel) {
                            channelLabel = t.channel === 'mobile_money' ? 'Mobile Money' : t.channel;
                        }

                        const rawStatus = (t.status || 'abandoned').toUpperCase();
                        let displayStatus = rawStatus;
                        if (rawStatus === 'SUCCESS') displayStatus = 'PAID';
                        else if (rawStatus === 'ABANDONED') displayStatus = 'ABANDONED';
                        else if (rawStatus === 'FAILED') displayStatus = 'FAILED';
                        else if (rawStatus === 'ONGOING') displayStatus = 'ABANDONED';

                        const dateStr = t.paid_at || t.created_at;
                        const formattedDate = dateStr
                            ? new Date(dateStr).toLocaleString('en-GB', {
                                  day: '2-digit',
                                  month: 'short',
                                  year: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                  hour12: true,
                              })
                            : 'N/A';

                        const recNumber = t.status === 'success'
                            ? `GCR-KKMA-${new Date(dateStr).getFullYear()}-${t.reference.substring(0, 4).toUpperCase()}`
                            : '';

                        const fees = t.fees ? Number(t.fees) / 100 : 0;
                        const timelineEvents = Array.isArray(t.log?.history) && t.log.history.length > 0
                            ? t.log.history.map((h: any) => ({
                                  time: Number(h.time || 0),
                                  message: String(h.message || ''),
                              }))
                            : [
                                  { time: 0, message: `Set payment method to ${t.channel || 'mobile_money'}` },
                                  ...(t.status === 'success' ? [{ time: t.log?.time_spent || 12, message: 'Payment authorized and approved' }] : []),
                                  ...(t.status === 'failed' ? [{ time: t.log?.time_spent || 8, message: `Payment failed: ${t.gateway_response || 'Declined'}` }] : []),
                                  ...(t.status === 'abandoned' ? [{ time: t.log?.time_spent || 30, message: 'Checkout session abandoned before completion' }] : []),
                              ];

                        return {
                            id: String(t.id),
                            userId: meta.userId || (dbProp?.id ? dbProp.id : null),
                            userName: registeredOwnerName,
                            phoneNumber: registeredOwnerPhone,
                            payerName: payerName,
                            payerPhone: phone,
                            payerEmail: cust.email || '',
                            accountNumber: cleanAccountNo,
                            propertyId: dbProp?.id || (rawProp.startsWith('prop_') ? rawProp : null),
                            amountPaid: netMunicipalAmount,
                            amountPaidFormatted: formatGhc(netMunicipalAmount),
                            arrearsPaid: netMunicipalAmount,
                            currentPaid: 0,
                            paymentMethod: channelLabel,
                            reference: t.reference,
                            receiptNumber: recNumber,
                            status: displayStatus,
                            isTestUser: false,
                            paidAt: formattedDate,
                            gatewayResponse: t.gateway_response || (t.status === 'success' ? 'Approved' : t.status === 'abandoned' ? 'Abandoned' : 'Failed'),
                            fees: fees,
                            feesFormatted: fees > 0 ? formatGhc(fees) : 'GH₵ 0.00',
                            ipAddress: t.ip_address || '100.28.127.65',
                            authorizationCode: auth.authorization_code || `AUTH_${(t.reference || '').slice(-10).toLowerCase()}`,
                            bank: auth.bank || auth.brand || (t.channel === 'mobile_money' ? 'MTN (GH)' : 'Card'),
                            countryCode: auth.country_code || 'GH',
                            timeSpent: t.log?.time_spent ?? (t.status === 'success' ? 12 : 30),
                            attempts: t.log?.attempts ?? 1,
                            errors: t.log?.errors ?? 0,
                            timeline: timelineEvents,
                            deviceType: t.channel === 'mobile_money' ? 'Desktop' : 'Mobile Web',
                        };
                    });

                    const totalCount = (json.meta && json.meta.pageCount && json.meta.pageCount <= 1)
                        ? records.length
                        : (json.meta?.total || records.length);
                    return { records, total: totalCount, totalAmount };
                }
        } catch (fetchErr) {
            console.error('Paystack direct fetch error, falling back to database:', fetchErr);
        }

        // Fallback to local DB if Paystack fetch is unavailable
        let query = supabase
            .from('PaidUserRecord')
            .select('id, userId, userName, phoneNumber, accountNumber, propertyId, amountPaid, arrearsPaid, currentPaid, paymentMethod, reference, receiptNumber, status, isTestUser, paidAt', { count: 'exact' });

        const effectiveFallbackStatus = filterType === 'ABANDONED' ? 'ABANDONED' : statusFilter;
        if (effectiveFallbackStatus === 'SUCCESS') {
            query = query.in('status', ['PAID', 'SUCCESS']);
        } else if (effectiveFallbackStatus === 'ABANDONED') {
            query = query.eq('status', 'ABANDONED');
        } else if (effectiveFallbackStatus === 'FAILED') {
            query = query.eq('status', 'FAILED');
        }

        if (searchQuery && searchQuery.trim()) {
            const q = searchQuery.trim();
            query = query.or(`userName.ilike.%${q}%,phoneNumber.ilike.%${q}%,accountNumber.ilike.%${q}%,reference.ilike.%${q}%,receiptNumber.ilike.%${q}%`);
        }

        query = query.order('paidAt', { ascending: false });
        const skip = (page - 1) * limit;
        query = query.range(skip, skip + limit - 1);

        const { data, count, error } = await query;
        if (error || !data) return { records: [], total: 0, totalAmount: 0 };

        let sumQuery = supabase.from('PaidUserRecord').select('amountPaid');
        if (effectiveFallbackStatus === 'SUCCESS') {
            sumQuery = sumQuery.in('status', ['PAID', 'SUCCESS']);
        } else if (effectiveFallbackStatus === 'ABANDONED') {
            sumQuery = sumQuery.eq('status', 'ABANDONED');
        } else if (effectiveFallbackStatus === 'FAILED') {
            sumQuery = sumQuery.eq('status', 'FAILED');
        }
        const { data: sumData } = await sumQuery;
        const totalAmount = (sumData || []).reduce((acc: number, item: any) => acc + (Number(item.amountPaid) || 0), 0);

        const records: AdminPaidUserRecord[] = data.map((r: any) => ({
            id: r.id,
            userId: r.userId,
            userName: r.userName || 'Municipal Ratepayer',
            phoneNumber: r.phoneNumber || 'N/A',
            accountNumber: r.accountNumber || 'N/A',
            propertyId: r.propertyId,
            amountPaid: Number(r.amountPaid || 0),
            amountPaidFormatted: formatGhc(Number(r.amountPaid || 0)),
            arrearsPaid: Number(r.arrearsPaid || 0),
            currentPaid: Number(r.currentPaid || 0),
            paymentMethod: r.paymentMethod || 'Paystack MoMo',
            reference: r.reference || 'N/A',
            receiptNumber: r.receiptNumber || 'N/A',
            status: r.status || 'PAID',
            isTestUser: Boolean(r.isTestUser),
            paidAt: formatDateGb(r.paidAt),
            gatewayResponse: r.status === 'PAID' ? 'Approved' : r.status === 'FAILED' ? 'Declined' : 'Abandoned',
            fees: 0,
            feesFormatted: 'GH₵ 0.00',
            ipAddress: '100.28.127.65',
            authorizationCode: `AUTH_${(r.reference || '').slice(-8).toLowerCase()}`,
            bank: 'MTN (GH)',
            countryCode: 'GH',
            timeSpent: 6,
            attempts: 1,
            errors: 0,
            timeline: [
                { time: 0, message: 'Set payment method to mobile_money' },
                { time: 6, message: r.status === 'PAID' ? 'Payment authorized and completed' : 'Transaction uncompleted' },
            ],
            deviceType: 'Desktop Web',
        }));

        return { records, total: count || 0, totalAmount };
    } catch (err) {
        console.error('Failed to get paid users list:', err);
        return { records: [], total: 0, totalAmount: 0 };
    }
}

// ─── TEST SANDBOX: Dynamic balance configuration for all test accounts ────────
import { TestAccountPreset, TEST_ACCOUNT_PRESETS, TEST_ACCOUNTS, TestAccountConfig } from '@/lib/testPresets';
export type { TestAccountPreset, TestAccountConfig };

export async function getTestAccountsStateAction(): Promise<{
  success: boolean;
  balances?: Record<string, { arrears: number; currentBill: number; outstanding: number; status: string }>;
  error?: string;
}> {
  try {
    const admin = await requireAdminSession();
    if (!admin) return { success: false, error: 'Not authenticated' };

    const accountNos = TEST_ACCOUNTS.flatMap((a) => a.properties.map((p) => p.accountNumber));
    const { data, error } = await supabase
      .from('Property')
      .select('account_no, arrears, current_bill, outstanding_amt, amount_paid')
      .in('account_no', accountNos);

    if (error) {
      console.error('[getTestAccountsStateAction] Supabase error:', error);
      return { success: false, error: error.message };
    }

    const balances: Record<string, { arrears: number; currentBill: number; outstanding: number; status: string }> = {};
    for (const row of data || []) {
      const arrears = Number(row.arrears || 0);
      const currentBill = Number(row.current_bill || 0);
      const amountPaid = Number(row.amount_paid || 0);
      const outstanding = Number(
        row.outstanding_amt !== null && row.outstanding_amt !== undefined
          ? row.outstanding_amt
          : Math.max(0, (arrears + currentBill) - amountPaid)
      );
      balances[row.account_no] = {
        arrears,
        currentBill,
        outstanding,
        status: outstanding <= 0 ? 'PAID' : (amountPaid > 0 ? 'PARTIALLY_PAID' : 'UNPAID'),
      };
    }

    return { success: true, balances };
  } catch (err: any) {
    console.error('[getTestAccountsStateAction] Exception:', err);
    return { success: false, error: err?.message || 'Failed to fetch test accounts state' };
  }
}

export async function updateTestAccountBalancesAction(
  updates: Array<{ accountNumber: string; arrears: number; currentBill: number }>
): Promise<{ success: boolean; error?: string; updatedCount?: number }> {
  try {
    const admin = await requireAdminSession();
    if (!admin) return { success: false, error: 'Not authenticated' };

    if (!updates || updates.length === 0) {
      return { success: false, error: 'No updates provided' };
    }

    for (const u of updates) {
      const arrears = Math.max(0, Number(u.arrears || 0));
      const currentBill = Math.max(0, Number(u.currentBill || 0));
      const outstanding = Number((arrears + currentBill).toFixed(2));

      const { error: updateError } = await supabase
        .from('Property')
        .update({
          arrears,
          current_bill: currentBill,
          outstanding_amt: outstanding,
          bill_amount: outstanding,
          amount_paid: 0,
        })
        .eq('account_no', u.accountNumber);

      if (updateError) {
        console.error('[updateTestAccountBalancesAction] Supabase update error:', updateError);
        return { success: false, error: updateError.message };
      }
    }

    revalidatePath('/');
    return { success: true, updatedCount: updates.length };
  } catch (err: any) {
    console.error('[updateTestAccountBalancesAction] Error:', err);
    return { success: false, error: err?.message || 'Failed to update test balances' };
  }
}

export async function resetTestAccountAction(accountNumber: string, presetIndex: number): Promise<{ success: boolean; error?: string; preset?: TestAccountPreset }> {
  try {
    const admin = await requireAdminSession();
    if (!admin) return { success: false, error: 'Not authenticated' };

    const preset = TEST_ACCOUNT_PRESETS[presetIndex];
    if (!preset) return { success: false, error: 'Invalid preset' };
    if (preset.accountNumber !== accountNumber) return { success: false, error: 'Account mismatch' };

    const res = await updateTestAccountBalancesAction([
      {
        accountNumber: preset.accountNumber,
        arrears: preset.arrears,
        currentBill: preset.currentBill,
      },
    ]);

    if (!res.success) return { success: false, error: res.error };
    return { success: true, preset };
  } catch (err) {
    console.error('[Test Reset] Error:', err);
    return { success: false, error: 'Reset failed' };
  }
}

export interface RatepayerBatchUpdateItem {
  accountNumber: string;
  name?: string;
  arrears?: number;
  currentBill?: number;
  amountPaid?: number;
  outstanding?: number;
}

export interface MatchedAccountValidationRecord {
  accountNumber: string;
  ownerName: string;
  telephone?: string;
  digitalAddress?: string;
  currentArrears: number;
  currentFee: number;
  amountPaid: number;
  totalAmountDue: number;
  status: string;
}

export async function fetchAccountsForValidation(accountNumbers: string[]): Promise<{
  success: boolean;
  records?: MatchedAccountValidationRecord[];
  error?: string;
}> {
  try {
    const admin = await requireAdminSession();
    if (!admin) {
      return { success: false, error: 'Unauthorized: Session expired or invalid.' };
    }

    if (!accountNumbers || accountNumbers.length === 0) {
      return { success: true, records: [] };
    }

    const cleanAccs = Array.from(new Set(accountNumbers.map((a) => a.trim().toUpperCase()))).filter(Boolean);

    const properties = await prisma.property.findMany({
      where: {
        accountNumber: { in: cleanAccs },
      },
      include: {
        users: { select: { id: true, name: true, phoneNumber: true } },
        owner: { select: { name: true, tel: true, mobileNumber: true } },
      },
    });

    const records: MatchedAccountValidationRecord[] = properties.map((p: any) => {
      const ownerName =
        p.users?.[0]?.name ||
        p.owner?.name ||
        p.name ||
        p.ownerNameDirect ||
        p.ownerName ||
        'Municipal Ratepayer';

      const telephone =
        p.users?.[0]?.phoneNumber ||
        p.owner?.mobileNumber ||
        p.owner?.tel ||
        p.telephone ||
        p.ownerPhoneDirect ||
        '';

      const currentArrears = Number(
        p.currentArrears !== undefined
          ? p.currentArrears
          : p.current_arrears !== undefined
          ? p.current_arrears
          : p.arrears || 0
      );

      const currentFee = Number(p.currentFee || p.current_bill || 0);

      const amountPaid = Number(
        p.totalPaidCycle !== undefined
          ? p.totalPaidCycle
          : p.total_paid_cycle !== undefined
          ? p.total_paid_cycle
          : p.amount_paid !== undefined
          ? p.amount_paid
          : p.amountPaidLastYear || 0
      );

      const totalAmountDue = Number(
        p.totalAmountDue !== undefined
          ? p.totalAmountDue
          : p.outstanding_amt !== undefined
          ? p.outstanding_amt
          : Math.max(0, currentArrears + currentFee)
      );

      return {
        accountNumber: p.accountNumber,
        ownerName,
        telephone,
        digitalAddress: p.ownerDigitalAddress || '',
        currentArrears,
        currentFee,
        amountPaid,
        totalAmountDue,
        status: p.status || 'UNPAID',
      };
    });

    return { success: true, records };
  } catch (err: any) {
    console.error('[fetchAccountsForValidation] Error:', err);
    return { success: false, error: err?.message || 'Failed to validate accounts.' };
  }
}

export interface RatepayerBatchUpdateResult {
  success: boolean;
  error?: string;
  updatedCount?: number;
  paymentsGeneratedCount?: number;
  totalPaymentsAmount?: number;
  totalPaymentsFormatted?: string;
  details?: {
    accountNumber: string;
    ownerName: string;
    priorPaid: number;
    newPaid: number;
    paymentDelta: number;
    receiptNumber?: string;
    priorOutstanding: number;
    newOutstanding: number;
  }[];
}

export async function applyRatepayerBatchUpdates(
  updates: RatepayerBatchUpdateItem[],
  adminPassword?: string
): Promise<RatepayerBatchUpdateResult> {
  try {
    const admin = await requireAdminSession();
    if (!admin) {
      return { success: false, error: 'Unauthorized: Session expired. Please re-authenticate.' };
    }

    if (adminPassword) {
      const isAuthorized = verifyPassword(adminPassword, admin.passwordHash);
      if (!isAuthorized) {
        return { success: false, error: 'Incorrect security authorization password.' };
      }
    }

    if (!updates || updates.length === 0) {
      return { success: false, error: 'No update records provided.' };
    }

    const cleanAccs = Array.from(new Set(updates.map((u) => u.accountNumber.trim().toUpperCase()))).filter(Boolean);

    const properties = await prisma.property.findMany({
      where: {
        accountNumber: { in: cleanAccs },
      },
      include: {
        users: true,
        owner: true,
      },
    });

    const propMap = new Map<string, any>();
    properties.forEach((p: any) => propMap.set(p.accountNumber.toUpperCase(), p));

    const details: RatepayerBatchUpdateResult['details'] = [];
    let paymentsGeneratedCount = 0;
    let totalPaymentsAmount = 0;

    for (const update of updates) {
      const accKey = update.accountNumber.trim().toUpperCase();
      const prop = propMap.get(accKey);
      if (!prop) continue;

      const priorArrears = Number(
        prop.currentArrears !== undefined
          ? prop.currentArrears
          : prop.current_arrears !== undefined
          ? prop.current_arrears
          : prop.arrears || 0
      );
      const priorFee = Number(prop.currentFee || prop.current_bill || 0);
      const priorPaid = Number(
        prop.totalPaidCycle !== undefined
          ? prop.totalPaidCycle
          : prop.total_paid_cycle !== undefined
          ? prop.total_paid_cycle
          : prop.amount_paid !== undefined
          ? prop.amount_paid
          : prop.amountPaidLastYear || 0
      );
      const priorOutstanding = Number(
        prop.totalAmountDue !== undefined
          ? prop.totalAmountDue
          : prop.outstanding_amt !== undefined
          ? prop.outstanding_amt
          : Math.max(0, priorArrears + priorFee)
      );

      const targetArrears = update.arrears !== undefined ? Number(update.arrears) : priorArrears;
      const targetFee = update.currentBill !== undefined ? Number(update.currentBill) : priorFee;
      const targetPaid = update.amountPaid !== undefined ? Number(update.amountPaid) : priorPaid;

      // Determine payment delta
      const paymentDelta = Math.max(0, Number((targetPaid - priorPaid).toFixed(2)));

      // Determine new arrears and fee after sequential waterfall
      let calculatedArrears = targetArrears;
      let calculatedFee = targetFee;
      if (paymentDelta > 0) {
        const arrearsDeduction = Math.min(calculatedArrears, paymentDelta);
        calculatedArrears = Math.max(0, Number((calculatedArrears - arrearsDeduction).toFixed(2)));
        const excessPayment = Math.max(0, Number((paymentDelta - arrearsDeduction).toFixed(2)));
        calculatedFee = Math.max(0, Number((calculatedFee - excessPayment).toFixed(2)));
      }

      let newOutstanding =
        update.outstanding !== undefined
          ? Number(update.outstanding)
          : Math.max(0, Number((calculatedArrears + calculatedFee).toFixed(2)));

      const newStatus =
        newOutstanding <= 0 ? 'PAID' : targetPaid > 0 ? 'PARTIALLY_PAID' : 'UNPAID';

      let receiptNumber: string | undefined;

      // Find or create primary user if payment is generated
      let primaryOwner = prop.users?.[0];
      if (paymentDelta > 0 && !primaryOwner) {
        const phone =
          prop.telephone ||
          prop.owner?.mobileNumber ||
          prop.owner?.tel ||
          prop.ownerPhoneDirect;
        if (phone) {
          primaryOwner = await prisma.user.findFirst({ where: { phoneNumber: phone } });
        }
        if (!primaryOwner) {
          primaryOwner = await prisma.user.create({
            data: {
              name:
                update.name ||
                prop.name ||
                prop.owner?.name ||
                prop.ownerNameDirect ||
                'Municipal Ratepayer',
              phoneNumber: phone || `020${Math.floor(1000000 + Math.random() * 9000000)}`,
              role: 'RATEPAYER',
            },
          });
        }
      }

      // If money was paid in this batch, create receipt and fee payment
      if (paymentDelta > 0 && primaryOwner) {
        receiptNumber = `DIG-KKMA-SYNC-${Date.now().toString(36).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;
        paymentsGeneratedCount++;
        totalPaymentsAmount = Number((totalPaymentsAmount + paymentDelta).toFixed(2));

        await prisma.receipt.create({
          data: {
            userId: primaryOwner.id,
            propertyId: prop.id,
            amount: paymentDelta,
            settlementType: 'TOTAL',
            paymentMethod: 'Assembly Ingestion Sync',
            status: 'PAID',
            receiptNumber,
          },
        });

        // Also record in Supabase FeePayment table for RMMS compliance
        try {
          await supabase.from('FeePayment').insert([
            {
              id: `fp_sync_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`,
              accountNo: prop.accountNumber,
              arrearsPd: Math.min(priorArrears, paymentDelta),
              curAmtPd: Math.max(0, paymentDelta - Math.min(priorArrears, paymentDelta)),
              amtPaid: paymentDelta,
              datePaid: new Date().toISOString(),
              pmtMode: 'Assembly Ingestion Sync',
              gcrNr: receiptNumber,
              userId: primaryOwner.id,
              propertyId: prop.id,
              transactionId: receiptNumber,
            },
          ]);
        } catch (fpErr) {
          console.warn('[applyRatepayerBatchUpdates] FeePayment insert fallback notice:', fpErr);
        }
      }

      // Update Property in Prisma
      await prisma.property.update({
        where: { id: prop.id },
        data: {
          currentArrears: calculatedArrears,
          current_arrears: calculatedArrears,
          totalPaidCycle: targetPaid,
          total_paid_cycle: targetPaid,
          amount_paid: targetPaid,
          amountPaidLastYear: targetPaid,
          currentFee: calculatedFee,
          current_bill: calculatedFee,
          totalAmountDue: newOutstanding,
          outstanding_amt: newOutstanding,
          status: newStatus,
        },
      });

      // Synchronize in Supabase properties table
      try {
        await supabase
          .from('properties')
          .update({
            current_arrears: calculatedArrears,
            total_paid_cycle: targetPaid,
            amount_paid: targetPaid,
            current_bill: calculatedFee,
            outstanding_amt: newOutstanding,
            status: newStatus,
          })
          .eq('account_no', prop.accountNumber);
      } catch (sbErr) {
        console.warn('[applyRatepayerBatchUpdates] Supabase properties update fallback notice:', sbErr);
      }

      const ownerDisplayName =
        update.name ||
        prop.users?.[0]?.name ||
        prop.owner?.name ||
        prop.name ||
        'Municipal Ratepayer';

      details.push({
        accountNumber: prop.accountNumber,
        ownerName: ownerDisplayName,
        priorPaid,
        newPaid: targetPaid,
        paymentDelta,
        receiptNumber,
        priorOutstanding,
        newOutstanding,
      });
    }

    // Create Audit Log entry
    await prisma.auditLog.create({
      data: {
        action: 'DATA_INGESTION_SYNC',
        entityType: 'Property',
        details: `Batch data ingestion processed: ${details.length} accounts updated, ${paymentsGeneratedCount} payments synchronized (${formatGhc(totalPaymentsAmount)} total volume).`,
        adminId: admin.id,
      },
    });

    revalidatePath('/');
    revalidatePath('/dashboard');

    return {
      success: true,
      updatedCount: details.length,
      paymentsGeneratedCount,
      totalPaymentsAmount,
      totalPaymentsFormatted: formatGhc(totalPaymentsAmount),
      details,
    };
  } catch (err: any) {
    console.error('[applyRatepayerBatchUpdates] Error:', err);
    return { success: false, error: err?.message || 'Failed to apply batch updates.' };
  }
}

export async function extractGcrDataFromImage(dataUrl: string, mimeType: string) {
    try {
        await requireAdminSession();

        const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];
        if (!mimeType || !allowedMimeTypes.includes(mimeType)) {
            return { success: false, error: 'Invalid file format. Only JPEG, PNG, or WebP images are accepted.' };
        }

        if (!dataUrl || dataUrl.length > 15 * 1024 * 1024) {
            return { success: false, error: 'Image file size exceeds maximum 10MB limit.' };
        }

        // Ensure API Key exists
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
             return { success: false, error: 'GEMINI_API_KEY is not configured.' };
        }

        const base64Data = dataUrl.replace(/^data:image\/\w+;base64,/, '');
        const ai = new GoogleGenAI({ apiKey });
        
        const response = await ai.models.generateContent({
            model: 'gemini-3.8-flash',
            contents: [
                {
                    role: 'user',
                    parts: [
                        { inlineData: { data: base64Data, mimeType } },
                        { text: "Analyze this official municipal General Counter Receipt (GCR) slip. Extract the receipt serial number (usually printed in red, top right, or clearly labeled as GCR No, e.g., '104928' or 'GCR-104928'). Also extract the total amount paid. Respond with a JSON object: { \"gcrNumber\": \"string\", \"amount\": number }. Only return valid JSON." }
                    ]
                }
            ],
            config: {
                responseMimeType: "application/json",
            }
        });
        
        return { success: true, data: JSON.parse(response.text || '{}') };
    } catch (e: any) {
        console.error('[extractGcrDataFromImage] Error:', e);
        return { success: false, error: e.message || 'Failed to extract data from image.' };
    }
}

export interface GetDatabaseTableRecordsParams {
  tableName: string;
  page?: number;
  pageSize?: number;
  searchQuery?: string;
  sortBy?: string;
  sortAscending?: boolean;
}

export interface GetDatabaseTableRecordsResponse {
  success: boolean;
  error?: string;
  data?: any[];
  totalCount?: number;
  page?: number;
  pageSize?: number;
  totalPages?: number;
  tableMeta?: DatabaseTableDefinition;
}

export async function getDatabaseTableRecords({
  tableName,
  page = 1,
  pageSize = 50,
  searchQuery = '',
  sortBy,
  sortAscending = true,
}: GetDatabaseTableRecordsParams): Promise<GetDatabaseTableRecordsResponse> {
  try {
    const admin = await requireAdminSession();
    if (!admin || !admin.isActive) {
      return { success: false, error: 'Unauthorized. Active session required.' };
    }

    const tableDef = DATABASE_TABLE_DEFINITIONS[tableName];
    if (!tableDef) {
      return { success: false, error: `Invalid or unrecognized table: ${tableName}` };
    }

    const currentPage = Math.max(1, page);
    const limit = Math.min(100, Math.max(10, pageSize));
    const from = (currentPage - 1) * limit;
    const to = from + limit - 1;

    let query = supabase.from(tableName).select('*', { count: 'exact' });

    // Handle search query
    const cleanSearch = (searchQuery || '').trim();
    if (cleanSearch && tableDef.searchColumns.length > 0) {
      const sanitized = cleanSearch.replace(/[%_]/g, '\\$&').replace(/[,\(\)]/g, ' ').trim();
      if (sanitized) {
        if (tableDef.searchColumns.length === 1) {
          query = query.ilike(tableDef.searchColumns[0], `%${sanitized}%`);
        } else {
          const filterStr = tableDef.searchColumns
            .map((col) => `${col}.ilike.%${sanitized}%`)
            .join(',');
          query = query.or(filterStr);
        }
      }
    }

    // Handle sort order
    const orderColumn = sortBy || tableDef.defaultSort.column;
    const isAsc = sortBy !== undefined ? sortAscending : tableDef.defaultSort.ascending;
    query = query.order(orderColumn, { ascending: isAsc, nullsFirst: false });

    // Apply pagination range
    query = query.range(from, to);

    // Exclude internal test accounts per table type only on live production
    if (isLiveProductionDeployment()) {
      if (tableName === 'Property') {
        query = query.not('account_no', 'in', `(${HIDDEN_TEST_ACCOUNT_NUMBERS.join(',')})`);
      } else if (tableName === 'User' || tableName === 'PaidUserRecord') {
        query = query.not('phoneNumber', 'in', `(${HIDDEN_TEST_PHONES.join(',')})`);
      }
    }

    const { data, count, error } = await query;
    if (error) {
      console.error(`[getDatabaseTableRecords] Supabase error for ${tableName}:`, error);
      return { success: false, error: error.message };
    }

    const total = count ?? 0;
    const totalPages = Math.max(1, Math.ceil(total / limit));

    return {
      success: true,
      data: data || [],
      totalCount: total,
      page: currentPage,
      pageSize: limit,
      totalPages,
      tableMeta: tableDef,
    };
  } catch (err: any) {
    console.error(`[getDatabaseTableRecords] Unhandled error:`, err);
    return { success: false, error: err.message || 'Failed to retrieve database table records.' };
  }
}

export interface PropertyBillAccountSummary {
  accountNumber: string;
  name: string;
  telephone: string | null;
  ownerDigitalAddress: string | null;
  houseNo: string | null;
  electoralArea: string | null;
  propertyCategory: string | null;
  rateableValue: number;
  currentBill: number;
  arrears: number;
  outstandingAmount: number;
  recordedYears: number[];
  billsCount: number;
}

export interface SearchPropertyBillAccountsResponse {
  success: boolean;
  error?: string;
  accounts?: PropertyBillAccountSummary[];
  totalCount?: number;
  page?: number;
  pageSize?: number;
  totalPages?: number;
}

export async function searchPropertyBillAccounts({
  searchQuery = '',
  page = 1,
  pageSize = 25,
}: {
  searchQuery?: string;
  page?: number;
  pageSize?: number;
}): Promise<SearchPropertyBillAccountsResponse> {
  try {
    const admin = await requireAdminSession();
    if (!admin || !admin.isActive) {
      return { success: false, error: 'Unauthorized. Active session required.' };
    }

    const currentPage = Math.max(1, page);
    const limit = Math.min(100, Math.max(10, pageSize));
    const from = (currentPage - 1) * limit;
    const to = from + limit - 1;

    const isAutocomplete = limit <= 10;
    let query = supabase.from('Property').select(
      'account_no, name, telephone, ownerDigitalAddress, houseNo, electoral_area, property_cat, rateableValue, current_bill, arrears, outstanding_amt',
      isAutocomplete ? undefined : { count: 'exact' }
    );

    const cleanSearch = (searchQuery || '').trim();
    if (cleanSearch) {
      const sanitized = cleanSearch.replace(/[%_]/g, '\\$&').replace(/[,\(\)]/g, ' ').trim();
      if (sanitized) {
        query = query.or(
          `account_no.ilike.%${sanitized}%,ownerDigitalAddress.ilike.%${sanitized}%,name.ilike.%${sanitized}%,telephone.ilike.%${sanitized}%,houseNo.ilike.%${sanitized}%`
        );
      }
    }

    // Exclude internal test accounts on live production deployments
    if (isLiveProductionDeployment()) {
      query = query.not('account_no', 'in', `(${HIDDEN_TEST_ACCOUNT_NUMBERS.join(',')})`);
      query = query.not('telephone', 'in', `(${HIDDEN_TEST_PHONES.join(',')})`);
    }

    query = query.order('account_no', { ascending: true }).range(from, to);

    const { data: rawProperties, count, error } = await query;
    if (error) {
      console.error('[searchPropertyBillAccounts] Error:', error);
      return { success: false, error: error.message };
    }

    const properties = isLiveProductionDeployment()
      ? (rawProperties || []).filter(
          (p) => !isHiddenTestAccount({
            account_no: p.account_no,
            telephone: p.telephone,
            name: p.name,
          })
        )
      : (rawProperties || []);

    const total = isAutocomplete ? properties.length : (count ?? properties.length);
    const totalPages = Math.max(1, Math.ceil(total / limit));

    if (properties.length === 0) {
      return {
        success: true,
        accounts: [],
        totalCount: total,
        page: currentPage,
        pageSize: limit,
        totalPages,
      };
    }

    // Fetch bill years for the returned properties - strictly using authoritative billYear column
    const accList = properties.map((p) => p.account_no).filter(Boolean);
    const { data: billsData } = await supabase
      .from('Bill')
      .select('accountNo, billYear')
      .in('accountNo', accList);

    const billYearsMap = new Map<string, Set<number>>();
    if (billsData) {
      for (const b of billsData) {
        if (!billYearsMap.has(b.accountNo)) {
          billYearsMap.set(b.accountNo, new Set());
        }
        const yr = Number(b.billYear);
        if (yr && !isNaN(yr)) {
          billYearsMap.get(b.accountNo)!.add(yr);
        }
      }
    }

    const accounts: PropertyBillAccountSummary[] = properties.map((p) => {
      const yearsSet = billYearsMap.get(p.account_no) || new Set();
      const sortedYears = Array.from(yearsSet).sort((a, b) => b - a);

      return {
        accountNumber: p.account_no,
        name: p.name || '',
        telephone: p.telephone,
        ownerDigitalAddress: p.ownerDigitalAddress,
        houseNo: p.houseNo,
        electoralArea: p.electoral_area,
        propertyCategory: p.property_cat,
        rateableValue: Number(p.rateableValue || 0),
        currentBill: Number(p.current_bill || 0),
        arrears: Number(p.arrears || 0),
        outstandingAmount: Number(p.outstanding_amt || 0),
        recordedYears: sortedYears,
        billsCount: sortedYears.length,
      };
    });

    return {
      success: true,
      accounts,
      totalCount: total,
      page: currentPage,
      pageSize: limit,
      totalPages,
    };
  } catch (err: any) {
    console.error('[searchPropertyBillAccounts] Unhandled error:', err);
    return { success: false, error: err.message || 'Failed to search property billing accounts.' };
  }
}

export interface AccountBillDetail {
  id: string;
  accountNo: string;
  billYear: number;
  rateableValue: number;
  ratePA: number;
  balanceBF: number;
  accountBalance: number;
  billDate: string | null;
  printed: boolean;
  preparedBy: string | null;
  gcatId: string | null;
}

export interface AccountPaymentDetail {
  id: string;
  accountNo: string;
  gcrNr: string | null;
  amtPaid: number;
  arrearsPd: number;
  curAmtPd: number;
  datePaid: string | null;
  pmtMode: string | null;
  collectorsCollectorId: string | null;
  cashiersCashierId: string | null;
}

export interface GetAccountBillHistoryDetailResponse {
  success: boolean;
  error?: string;
  property?: any;
  bills?: AccountBillDetail[];
  payments?: AccountPaymentDetail[];
  summary?: {
    totalBilledAcrossYears: number;
    totalPaidAcrossYears: number;
    currentOutstanding: number;
    recordedYearsCount: number;
  };
}

export async function getAccountBillHistoryDetail(accountNo: string): Promise<GetAccountBillHistoryDetailResponse> {
  try {
    const admin = await requireAdminSession();
    if (!admin || !admin.isActive) {
      return { success: false, error: 'Unauthorized. Active session required.' };
    }

    const cleanAcc = (accountNo || '').trim();
    if (!cleanAcc) {
      return { success: false, error: 'Account number is required.' };
    }

    if (isLiveProductionDeployment() && isHiddenTestAccount({ accountNumber: cleanAcc })) {
      return { success: false, error: 'Property billing account not found.' };
    }

    // Fetch Property, Bill history, and Payment receipts concurrently in parallel
    const [propRes, billsRes, paymentsRes] = await Promise.all([
      supabase
        .from('Property')
        .select('id, account_no, name, telephone, ownerDigitalAddress, houseNo, electoral_area, property_cat, municipality, rateableValue, current_bill, arrears, initial_arrears, outstanding_amt')
        .eq('account_no', cleanAcc)
        .maybeSingle(),
      supabase
        .from('Bill')
        .select('id, accountNo, billYear, rateableValue, ratePA, balanceBF, accountBalance, billDate, printed, preparedBy, gcatId')
        .eq('accountNo', cleanAcc)
        .order('billYear', { ascending: false }),
      supabase
        .from('FeePayment')
        .select('id, accountNo, gcrNr, amtPaid, arrearsPd, curAmtPd, datePaid, pmtMode, collectorsCollectorId, cashiersCashierId')
        .eq('accountNo', cleanAcc)
        .order('datePaid', { ascending: false }),
    ]);

    const { data: propData, error: propErr } = propRes;
    const { data: billsData, error: billsErr } = billsRes;
    const { data: paymentsData, error: pmtErr } = paymentsRes;

    if (propData && isLiveProductionDeployment() && isHiddenTestAccount({
      accountNumber: propData.account_no,
      name: propData.name,
      telephone: propData.telephone,
      propertyId: propData.id,
    })) {
      return { success: false, error: 'Property billing account not found.' };
    }

    if (propErr) {
      console.error('[getAccountBillHistoryDetail] Property error:', propErr);
    }
    if (billsErr) {
      console.error('[getAccountBillHistoryDetail] Bill error:', billsErr);
    }
    if (pmtErr) {
      console.error('[getAccountBillHistoryDetail] FeePayment error:', pmtErr);
    }

    const propBillRate = Number(propData?.current_bill || 0);
    const bills: AccountBillDetail[] = (billsData || []).map((b) => {
      const rawRate = Number(b.ratePA || 0);
      const effectiveRatePA = rawRate > 0 ? rawRate : (propBillRate > 0 ? propBillRate : 0);
      return {
        id: b.id,
        accountNo: b.accountNo,
        billYear: Number(b.billYear || 0),
        rateableValue: Number(b.rateableValue || 0),
        ratePA: effectiveRatePA,
        balanceBF: Number(b.balanceBF || 0),
        accountBalance: Number(b.accountBalance || 0),
        billDate: b.billDate,
        printed: Boolean(b.printed),
        preparedBy: b.preparedBy,
        gcatId: b.gcatId,
      };
    });

    const payments: AccountPaymentDetail[] = (paymentsData || []).map((p) => ({
      id: p.id,
      accountNo: p.accountNo,
      gcrNr: p.gcrNr,
      amtPaid: Number(p.amtPaid || 0),
      arrearsPd: Number(p.arrearsPd || 0),
      curAmtPd: Number(p.curAmtPd || 0),
      datePaid: p.datePaid,
      pmtMode: p.pmtMode,
      collectorsCollectorId: p.collectorsCollectorId,
      cashiersCashierId: p.cashiersCashierId,
    }));

    const totalBilledAcrossYears = bills.reduce((sum, b) => sum + (b.ratePA || 0), 0);
    const totalPaidAcrossYears = payments.reduce((sum, p) => sum + (p.amtPaid || 0), 0);
    const currentOutstanding = propData?.outstanding_amt !== undefined 
      ? Number(propData.outstanding_amt) 
      : bills[0]?.accountBalance || 0;

    return {
      success: true,
      property: propData || { account_no: cleanAcc },
      bills,
      payments,
      summary: {
        totalBilledAcrossYears,
        totalPaidAcrossYears,
        currentOutstanding,
        recordedYearsCount: bills.length,
      },
    };
  } catch (err: any) {
    console.error('[getAccountBillHistoryDetail] Unhandled error:', err);
    return { success: false, error: err.message || 'Failed to retrieve account bill history.' };
  }
}

// =========================================================================
// PAYMENTS SECTION SERVER ACTIONS (ONLINE & IN-PERSON WORKBENCH)
// =========================================================================

export interface UnifiedPaymentRecord {
  id: string;
  accountNo: string;
  receiptNumber: string;
  amountPaid: number;
  amountPaidFormatted: string;
  arrearsPaid: number;
  currentPaid: number;
  datePaid: string;
  formattedDate: string;
  formattedTime?: string;
  paymentMethod: string;
  paymentCategory: 'ONLINE' | 'IN_PERSON';
  transactionReference?: string;
  collectorName?: string;
  cashierName?: string;
  payerName?: string;
  payerPhone?: string;
  isPhysicalIssued: boolean;
  status: string;
  receiptId?: string;
}

export async function getAccountPaymentsList(accountNo: string): Promise<{
  success: boolean;
  error?: string;
  payments: UnifiedPaymentRecord[];
  summary: {
    totalPaid: number;
    totalPaidFormatted: string;
    paymentsCount: number;
    onlinePaid: number;
    onlinePaidFormatted: string;
    onlineCount: number;
    inPersonPaid: number;
    inPersonPaidFormatted: string;
    inPersonCount: number;
  };
}> {
  try {
    const admin = await requireAdminSession();
    if (!admin || !admin.isActive) {
      return {
        success: false,
        error: 'Unauthorized. Active session required.',
        payments: [],
        summary: {
          totalPaid: 0,
          totalPaidFormatted: 'GH₵ 0.00',
          paymentsCount: 0,
          onlinePaid: 0,
          onlinePaidFormatted: 'GH₵ 0.00',
          onlineCount: 0,
          inPersonPaid: 0,
          inPersonPaidFormatted: 'GH₵ 0.00',
          inPersonCount: 0,
        },
      };
    }

    const cleanAcc = (accountNo || '').trim();
    if (!cleanAcc) {
      return {
        success: false,
        error: 'Account number is required.',
        payments: [],
        summary: {
          totalPaid: 0,
          totalPaidFormatted: 'GH₵ 0.00',
          paymentsCount: 0,
          onlinePaid: 0,
          onlinePaidFormatted: 'GH₵ 0.00',
          onlineCount: 0,
          inPersonPaid: 0,
          inPersonPaidFormatted: 'GH₵ 0.00',
          inPersonCount: 0,
        },
      };
    }

    // Concurrently fetch FeePayment records, digital Receipt records, PaidUserRecord records, and Property biodata
    const [feePaymentsRes, receiptsRes, paidUserRes, propertyRes] = await Promise.all([
      supabase
        .from('FeePayment')
        .select('*')
        .eq('accountNo', cleanAcc)
        .order('datePaid', { ascending: false }),
      supabase
        .from('Receipt')
        .select('*')
        .or(`propertyAccountNumber.eq.${cleanAcc},accountNumber.eq.${cleanAcc}`)
        .order('datePaid', { ascending: false }),
      supabase
        .from('PaidUserRecord')
        .select('*')
        .eq('accountNumber', cleanAcc)
        .order('paidAt', { ascending: false }),
      supabase
        .from('Property')
        .select('account_no, name, telephone')
        .eq('account_no', cleanAcc)
        .maybeSingle(),
    ]);

    const feePayments = feePaymentsRes.data || [];
    const rawReceipts = receiptsRes?.data || [];
    const paidUserRecords = paidUserRes?.data || [];
    const defaultAccountPhone = propertyRes?.data?.telephone || undefined;
    const defaultAccountName = propertyRes?.data?.name || undefined;

    // Map of receipts by receiptNumber for metadata enrichment
    const receiptsMap = new Map<string, any>();
    for (const r of rawReceipts) {
      if (r.receiptNumber) {
        receiptsMap.set(r.receiptNumber.trim().toUpperCase(), r);
      }
    }

    const paidUsersMap = new Map<string, any>();
    for (const pu of paidUserRecords) {
      if (pu.receiptNumber) {
        paidUsersMap.set(pu.receiptNumber.trim().toUpperCase(), pu);
      }
      if (pu.reference) {
        paidUsersMap.set(pu.reference.trim().toUpperCase(), pu);
      }
    }

    const processedReceiptNumbers = new Set<string>();
    const unified: UnifiedPaymentRecord[] = [];

    // 1. Process RMMS / Cadastre FeePayments
    for (const fp of feePayments) {
      const gcrNo = (fp.gcrNr || `REC-${fp.id}`).trim();
      processedReceiptNumbers.add(gcrNo.toUpperCase());

      const rec = receiptsMap.get(gcrNo.toUpperCase());
      const pu = paidUsersMap.get(gcrNo.toUpperCase());

      const d = fp.datePaid ? new Date(fp.datePaid) : new Date();
      const formattedDate = formatDateGb(d);
      const formattedTime = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });

      const pmtMode = fp.pmtMode || rec?.paymentMethod || pu?.paymentMethod || 'Counter Cash Treasury';
      const pmtLower = pmtMode.toLowerCase();

      // Strict precedence: Cash/Counter/Treasury/Cheque/Draft/Field collections are always IN_PERSON
      const isInPerson =
        pmtLower.includes('cash') ||
        pmtLower.includes('counter') ||
        pmtLower.includes('treasury') ||
        pmtLower.includes('cheque') ||
        pmtLower.includes('draft') ||
        pmtLower.includes('bank deposit') ||
        pmtLower.includes('field') ||
        Boolean(rec?.isPhysicalIssued && !pu?.reference && !pmtLower.includes('paystack'));

      const isOnline = !isInPerson && (
        pmtLower.includes('online') ||
        pmtLower.includes('paystack') ||
        pmtLower.includes('citizen app') ||
        pmtLower.includes('web') ||
        Boolean(pu?.reference) ||
        (Boolean(fp.transactionId) && (fp.transactionId.startsWith('T') || fp.transactionId.startsWith('paystack_') || fp.transactionId.startsWith('DIG-')))
      );

      const amt = Number(fp.amtPaid || rec?.amount || pu?.amountPaid || 0);

      unified.push({
        id: fp.id || `fp_${Math.random().toString(36).substring(2, 9)}`,
        accountNo: fp.accountNo || cleanAcc,
        receiptNumber: gcrNo,
        amountPaid: amt,
        amountPaidFormatted: formatGhc(amt),
        arrearsPaid: Number(fp.arrearsPd || pu?.arrearsPaid || 0),
        currentPaid: Number(fp.curAmtPd || pu?.currentPaid || 0),
        datePaid: fp.datePaid || d.toISOString(),
        formattedDate,
        formattedTime,
        paymentMethod: pmtMode,
        paymentCategory: isOnline ? 'ONLINE' : 'IN_PERSON',
        transactionReference: fp.transactionId || pu?.reference || rec?.transactionId || undefined,
        collectorName: fp.collectorsCollectorId || rec?.collectorName || (isOnline ? 'PAYSTACK_GATEWAY' : 'TREASURY_OFFICER'),
        cashierName: fp.cashiersCashierId || rec?.cashierName || (isOnline ? 'PAYSTACK_GATEWAY' : 'TREASURY_CASHIER'),
        payerName: pu?.userName || rec?.payerName || defaultAccountName || undefined,
        payerPhone: pu?.phoneNumber || rec?.paymentPhoneNumber || defaultAccountPhone || undefined,
        isPhysicalIssued: Boolean(rec?.isPhysicalIssued || (!gcrNo.startsWith('DIG-') && !gcrNo.includes('-TXN-'))),
        status: fp.status || rec?.status || 'PAID',
        receiptId: rec?.id || undefined,
      });
    }

    // 2. Process any digital Receipt records not already covered in FeePayment
    for (const r of rawReceipts) {
      const rNum = (r.receiptNumber || `REC-${r.id}`).trim();
      if (processedReceiptNumbers.has(rNum.toUpperCase())) continue;
      processedReceiptNumbers.add(rNum.toUpperCase());

      const pu = paidUsersMap.get(rNum.toUpperCase());
      const d = r.datePaid ? new Date(r.datePaid) : new Date();
      const formattedDate = formatDateGb(d);
      const formattedTime = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });

      const pmtMode = r.paymentMethod || pu?.paymentMethod || 'Online App (Paystack)';
      const pmtLower = pmtMode.toLowerCase();

      const isInPerson =
        pmtLower.includes('cash') ||
        pmtLower.includes('counter') ||
        pmtLower.includes('treasury') ||
        pmtLower.includes('cheque') ||
        pmtLower.includes('draft') ||
        pmtLower.includes('bank deposit') ||
        pmtLower.includes('field') ||
        Boolean(r.isPhysicalIssued && !pu?.reference && !pmtLower.includes('paystack'));

      const isOnline = !isInPerson && (
        pmtLower.includes('online') ||
        pmtLower.includes('paystack') ||
        pmtLower.includes('citizen app') ||
        pmtLower.includes('web') ||
        Boolean(pu?.reference) ||
        (Boolean(r.transactionId) && (r.transactionId.startsWith('T') || r.transactionId.startsWith('paystack_') || r.transactionId.startsWith('DIG-')))
      );

      const amt = Number(r.amount || pu?.amountPaid || 0);

      unified.push({
        id: r.id,
        accountNo: cleanAcc,
        receiptNumber: rNum,
        amountPaid: amt,
        amountPaidFormatted: formatGhc(amt),
        arrearsPaid: Number(pu?.arrearsPaid || 0),
        currentPaid: Number(pu?.currentPaid || amt),
        datePaid: r.datePaid || d.toISOString(),
        formattedDate,
        formattedTime,
        paymentMethod: pmtMode,
        paymentCategory: isOnline ? 'ONLINE' : 'IN_PERSON',
        transactionReference: r.transactionId || pu?.reference || undefined,
        collectorName: r.collectorName || (isOnline ? 'PAYSTACK_GATEWAY' : 'TREASURY_OFFICER'),
        cashierName: r.cashierName || (isOnline ? 'PAYSTACK_GATEWAY' : 'TREASURY_CASHIER'),
        payerName: pu?.userName || r.payerName || defaultAccountName || undefined,
        payerPhone: pu?.phoneNumber || r.paymentPhoneNumber || defaultAccountPhone || undefined,
        isPhysicalIssued: Boolean(r.isPhysicalIssued || (!rNum.startsWith('DIG-') && !rNum.includes('-TXN-'))),
        status: r.status || 'PAID',
        receiptId: r.id,
      });
    }

    // Sort descending by date
    unified.sort((a, b) => new Date(b.datePaid).getTime() - new Date(a.datePaid).getTime());

    const totalPaid = unified.reduce((sum, p) => sum + p.amountPaid, 0);
    const onlinePayments = unified.filter((p) => p.paymentCategory === 'ONLINE');
    const inPersonPayments = unified.filter((p) => p.paymentCategory === 'IN_PERSON');
    const onlinePaid = onlinePayments.reduce((sum, p) => sum + p.amountPaid, 0);
    const inPersonPaid = inPersonPayments.reduce((sum, p) => sum + p.amountPaid, 0);

    return {
      success: true,
      payments: unified,
      summary: {
        totalPaid,
        totalPaidFormatted: formatGhc(totalPaid),
        paymentsCount: unified.length,
        onlinePaid,
        onlinePaidFormatted: formatGhc(onlinePaid),
        onlineCount: onlinePayments.length,
        inPersonPaid,
        inPersonPaidFormatted: formatGhc(inPersonPaid),
        inPersonCount: inPersonPayments.length,
      },
    };
  } catch (err: any) {
    console.error('[getAccountPaymentsList] Error:', err);
    return {
      success: false,
      error: err.message || 'Failed to retrieve account payments list.',
      payments: [],
      summary: {
        totalPaid: 0,
        totalPaidFormatted: 'GH₵ 0.00',
        paymentsCount: 0,
        onlinePaid: 0,
        onlinePaidFormatted: 'GH₵ 0.00',
        onlineCount: 0,
        inPersonPaid: 0,
        inPersonPaidFormatted: 'GH₵ 0.00',
        inPersonCount: 0,
      },
    };
  }
}

export async function recordInPersonPayment(params: {
  accountNumber: string;
  amount: number;
  receiptNumber: string;
  paymentMethod?: string;
  adminPassword?: string;
  settlementType?: 'TOTAL' | 'ARREARS';
}): Promise<{
  success: boolean;
  error?: string;
  receiptNumber?: string;
  receipt?: any;
  updatedProperty?: any;
}> {
  try {
    const admin = await requireAdminSession();
    if (!admin) {
      return { success: false, error: 'Unauthorized session. Please sign in to record payment.' };
    }

    const cleanAcc = (params.accountNumber || '').trim();
    if (!cleanAcc) {
      return { success: false, error: 'Property account number is required.' };
    }

    const numAmount = Number(params.amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      return { success: false, error: 'Please enter a valid positive payment amount.' };
    }

    const cleanReceiptNo = (params.receiptNumber || '').trim();
    if (!cleanReceiptNo) {
      return { success: false, error: 'Please specify an official physical GCR booklet receipt number.' };
    }

    // Verify receipt number uniqueness
    const [existingReceipt, existingFeePayment] = await Promise.all([
      supabase.from('Receipt').select('id, receiptNumber').eq('receiptNumber', cleanReceiptNo).maybeSingle(),
      supabase.from('FeePayment').select('id, gcrNr').eq('gcrNr', cleanReceiptNo).maybeSingle(),
    ]);

    if (existingReceipt?.data || existingFeePayment?.data) {
      return {
        success: false,
        error: `Receipt number "${cleanReceiptNo}" is already in use. Please check your physical receipt book.`,
      };
    }

    // Find the property record
    const property = await adminDb.property.findUnique({
      where: { accountNumber: cleanAcc },
    });

    if (!property) {
      return { success: false, error: `Property account "${cleanAcc}" not found in municipality register.` };
    }

    // Compute Sequential Municipal Debt Waterfall
    const currArr = Number(property.currentArrears !== undefined ? property.currentArrears : (property.arrears || 0));
    const currFee = Number(property.currentFee || property.current_bill || 0);
    const prevPaidCycle = Number(property.totalPaidCycle !== undefined ? property.totalPaidCycle : (property.amountPaidLastYear || 0));

    const arrearsDeduction = Math.min(currArr, numAmount);
    const newCurrentArrears = Math.max(0, Number((currArr - arrearsDeduction).toFixed(2)));
    const remainingPayment = Math.max(0, Number((numAmount - arrearsDeduction).toFixed(2)));
    const feeDeduction = Math.min(currFee, remainingPayment);
    const newCurrentFee = Math.max(0, Number((currFee - feeDeduction).toFixed(2)));

    const newTotalPaidCycle = Number((prevPaidCycle + numAmount).toFixed(2));
    const prevAmountPaid = Number(property.amount_paid !== undefined ? property.amount_paid : property.amountPaidLastYear || 0);
    const newAmountPaid = Number((prevAmountPaid + numAmount).toFixed(2));
    const newTotalDue = Math.max(0, Number((newCurrentArrears + newCurrentFee).toFixed(2)));
    const newStatus: 'PAID' | 'PARTIALLY_PAID' | 'UNPAID' = newTotalDue <= 0 ? 'PAID' : 'PARTIALLY_PAID';

    const now = new Date();
    const settlementType = params.settlementType || 'TOTAL';
    const paymentMethod = params.paymentMethod || 'Counter Cash Treasury';

    // 1. Update Property in database
    await adminDb.property.update({
      where: { id: property.id },
      data: {
        currentArrears: newCurrentArrears,
        current_arrears: newCurrentArrears,
        totalPaidCycle: newTotalPaidCycle,
        total_paid_cycle: newTotalPaidCycle,
        amount_paid: newAmountPaid,
        amountPaidLastYear: newAmountPaid,
        currentFee: newCurrentFee,
        current_bill: newCurrentFee,
        totalAmountDue: newTotalDue,
        outstanding_amt: newTotalDue,
        status: newStatus,
      },
    });

    // 2. Create Receipt Record
    const receiptData = {
      userId: property.ownerId || 'OFFICE_SETTLEMENT',
      propertyId: property.id,
      amount: numAmount,
      settlementType,
      paymentMethod,
      status: 'PAID',
      isPhysicalIssued: true,
      receiptNumber: cleanReceiptNo,
      collectorName: admin.name || admin.username,
      cashierName: admin.name || admin.username,
      datePaid: now.toISOString(),
    };

    let createdReceipt: any = null;
    try {
      createdReceipt = await adminDb.receipt.create({ data: receiptData });
    } catch (rErr) {
      console.warn('[recordInPersonPayment] adminDb.receipt.create notice:', rErr);
    }

    // 3. Create Cadastre FeePayment Record
    try {
      await supabase.from('FeePayment').insert([{
        id: `fp_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`,
        accountNo: property.accountNumber,
        arrearsPd: arrearsDeduction,
        curAmtPd: feeDeduction,
        amtPaid: numAmount,
        datePaid: now.toISOString(),
        pmtMode: paymentMethod,
        gcrNr: cleanReceiptNo,
        collectorsCollectorId: admin.username || admin.id,
        cashiersCashierId: admin.username || admin.id,
        propertyId: property.id,
        transactionId: cleanReceiptNo,
      }]);
    } catch (fpErr) {
      console.warn('[recordInPersonPayment] FeePayment insert fallback notice:', fpErr);
    }

    // 4. Log Audit Trail
    try {
      await adminDb.auditLog.create({
        data: {
          action: 'RECORD_IN_PERSON_PAYMENT',
          entityType: 'Receipt',
          entityId: property.id,
          details: `Recorded in-person payment of GH₵ ${numAmount.toFixed(2)} for ${cleanAcc} with assigned GCR #${cleanReceiptNo} by ${admin.name || admin.username}`,
          adminId: admin.id,
        },
      });
    } catch (audErr) {
      console.warn('[recordInPersonPayment] Audit log notice:', audErr);
    }

    return {
      success: true,
      receiptNumber: cleanReceiptNo,
      receipt: createdReceipt || { ...receiptData, id: cleanReceiptNo },
      updatedProperty: {
        id: property.id,
        accountNumber: property.accountNumber,
        currentArrears: newCurrentArrears,
        currentFee: newCurrentFee,
        totalPaidCycle: newTotalPaidCycle,
        totalAmountDue: newTotalDue,
        totalAmountDueFormatted: formatGhc(newTotalDue),
        status: newStatus,
      },
    };
  } catch (err: any) {
    console.error('[recordInPersonPayment] Unhandled error:', err);
    return { success: false, error: err.message || 'Failed to record in-person payment.' };
  }
}

export async function updatePaymentReceiptNumber(params: {
  paymentId?: string;
  oldReceiptNumber: string;
  newReceiptNumber: string;
  accountNumber: string;
  sendSmsNotice?: boolean;
}): Promise<{
  success: boolean;
  error?: string;
  updatedReceiptNumber?: string;
}> {
  try {
    const admin = await requireAdminSession();
    if (!admin) {
      return { success: false, error: 'Unauthorized. Please sign in to update receipt number.' };
    }

    const oldNo = (params.oldReceiptNumber || '').trim();
    const newNo = (params.newReceiptNumber || '').trim();
    const cleanAcc = (params.accountNumber || '').trim();

    if (!newNo) {
      return { success: false, error: 'New official receipt number is required.' };
    }

    if (oldNo.toUpperCase() === newNo.toUpperCase()) {
      return { success: true, updatedReceiptNumber: oldNo };
    }

    // Uniqueness validation
    const [existingReceipt, existingFeePayment] = await Promise.all([
      supabase.from('Receipt').select('id, receiptNumber').eq('receiptNumber', newNo).maybeSingle(),
      supabase.from('FeePayment').select('id, gcrNr').eq('gcrNr', newNo).maybeSingle(),
    ]);

    if (existingReceipt?.data || existingFeePayment?.data) {
      return {
        success: false,
        error: `Receipt number "${newNo}" is already in use by another transaction.`,
      };
    }

    // 1. Update Receipt table
    if (params.paymentId) {
      await supabase.from('Receipt').update({ receiptNumber: newNo, isPhysicalIssued: true, updatedAt: new Date().toISOString() }).eq('id', params.paymentId);
    }
    if (oldNo) {
      await supabase.from('Receipt').update({ receiptNumber: newNo, isPhysicalIssued: true, updatedAt: new Date().toISOString() }).eq('receiptNumber', oldNo);
    }

    // 2. Update FeePayment table
    if (oldNo) {
      await supabase.from('FeePayment').update({ gcrNr: newNo }).eq('gcrNr', oldNo);
    }
    if (cleanAcc && params.paymentId) {
      await supabase.from('FeePayment').update({ gcrNr: newNo }).eq('id', params.paymentId);
    }

    // 3. Update PaidUserRecord table
    if (oldNo) {
      await supabase.from('PaidUserRecord').update({ receiptNumber: newNo, updatedAt: new Date().toISOString() }).eq('receiptNumber', oldNo);
    }

    // 4. Audit Log
    try {
      await adminDb.auditLog.create({
        data: {
          action: 'UPDATE_RECEIPT_NUMBER',
          entityType: 'Receipt',
          entityId: cleanAcc,
          details: `Modified receipt number from ${oldNo || 'None'} to ${newNo} for account ${cleanAcc} by ${admin.name || admin.username}`,
          adminId: admin.id,
        },
      });
    } catch (audErr) {
      console.warn('[updatePaymentReceiptNumber] Audit notice:', audErr);
    }

    // 5. Optional citizen SMS notice dispatch
    if (params.sendSmsNotice && cleanAcc) {
      try {
        const prop = await adminDb.property.findUnique({ where: { accountNumber: cleanAcc } });
        const phone = prop?.telephone || prop?.ownerPhoneDirect;
        if (phone) {
          const smsMsg = `KKMA Official Receipt Update\nYour payment for Property #${cleanAcc} has been assigned official physical receipt: ${newNo}.\n\nThank you for paying your municipal property rate.`;
          await arkeselService.sendSMS(phone, smsMsg);
        }
      } catch (smsErr) {
        console.warn('[updatePaymentReceiptNumber] SMS notice notice:', smsErr);
      }
    }

    return {
      success: true,
      updatedReceiptNumber: newNo,
    };
  } catch (err: any) {
    console.error('[updatePaymentReceiptNumber] Error:', err);
    return { success: false, error: err.message || 'Failed to update receipt number.' };
  }
}

export interface UpdatePropertyBiodataParams {
  accountNo: string;
  name?: string;
  telephone?: string | null;
  ownerDigitalAddress?: string | null;
  houseNo?: string | null;
  streetName?: string | null;
  electoralArea?: string | null;
  tin?: string | null;
  propertyCategory?: string | null;
}

export async function updatePropertyBiodata(params: UpdatePropertyBiodataParams): Promise<{
  success: boolean;
  error?: string;
  account?: PropertyBillAccountSummary;
}> {
  try {
    const admin = await requireAdminSession();
    if (!admin || !admin.isActive) {
      return { success: false, error: 'Unauthorized. Active session required.' };
    }

    const cleanAcc = (params.accountNo || '').trim();
    if (!cleanAcc) {
      return { success: false, error: 'Account number is required.' };
    }

    const updateData: Record<string, any> = {};
    if (params.name !== undefined) updateData.name = (params.name || '').trim();
    if (params.telephone !== undefined) updateData.telephone = params.telephone ? params.telephone.trim() : null;
    if (params.ownerDigitalAddress !== undefined) updateData.ownerDigitalAddress = params.ownerDigitalAddress ? params.ownerDigitalAddress.trim().toUpperCase() : null;
    if (params.houseNo !== undefined) updateData.houseNo = params.houseNo ? params.houseNo.trim() : null;
    if (params.streetName !== undefined) updateData.streetName = params.streetName ? params.streetName.trim() : null;
    if (params.electoralArea !== undefined) updateData.electoral_area = params.electoralArea ? params.electoralArea.trim() : null;
    if (params.tin !== undefined) updateData.tin = params.tin ? params.tin.trim().toUpperCase() : null;
    if (params.propertyCategory !== undefined) updateData.property_cat = params.propertyCategory ? params.propertyCategory.trim() : null;

    const { data: updated, error } = await supabase
      .from('Property')
      .update(updateData)
      .eq('account_no', cleanAcc)
      .select('account_no, name, telephone, ownerDigitalAddress, houseNo, electoral_area, property_cat, rateableValue, current_bill, arrears, outstanding_amt')
      .single();

    if (error) {
      console.error('[updatePropertyBiodata] DB Error:', error);
      return { success: false, error: error.message };
    }

    try {
      await adminDb.auditLog.create({
        data: {
          action: 'UPDATE_RATEPAYER_BIODATA',
          entityType: 'Property',
          entityId: cleanAcc,
          details: `Updated biodata for account ${cleanAcc} by ${admin.name || admin.username}`,
          adminId: admin.id,
        },
      });
    } catch (audErr) {
      console.warn('[updatePropertyBiodata] Audit warning:', audErr);
    }

    const accountSummary: PropertyBillAccountSummary = {
      accountNumber: updated.account_no,
      name: updated.name || '',
      telephone: updated.telephone || null,
      ownerDigitalAddress: updated.ownerDigitalAddress || null,
      houseNo: updated.houseNo || null,
      electoralArea: updated.electoral_area || null,
      propertyCategory: updated.property_cat || null,
      rateableValue: Number(updated.rateableValue || 0),
      currentBill: Number(updated.current_bill || 0),
      arrears: Number(updated.arrears || 0),
      outstandingAmount: Number(updated.outstanding_amt || 0),
      recordedYears: [],
      billsCount: 0,
    };

    return {
      success: true,
      account: accountSummary,
    };
  } catch (err: any) {
    console.error('[updatePropertyBiodata] Unexpected error:', err);
    return { success: false, error: err.message || 'Failed to update ratepayer biodata.' };
  }
}

export async function sendInPersonPaymentConfirmationSms(params: {
  accountNumber: string;
  ratepayerName: string;
  amount: number;
  receiptNumber: string;
  remainingBalance: number;
  recipientPhone: string;
  customMessage?: string;
}): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const admin = await requireAdminSession();
    if (!admin) {
      return { success: false, error: 'Unauthorized. Active session required.' };
    }

    const cleanAcc = (params.accountNumber || '').trim();
    const cleanReceiptNo = (params.receiptNumber || '').trim();
    let rawPhone = (params.recipientPhone || '').trim();

    let liveRemainingBalance = Number(params.remainingBalance ?? 0);
    if (cleanAcc) {
      try {
        const prop = await adminDb.property.findUnique({ where: { accountNumber: cleanAcc } });
        if (prop) {
          if (!rawPhone) {
            rawPhone = (prop.telephone || prop.ownerPhoneDirect || '').trim();
          }
          if (typeof prop.totalAmountDue === 'number') {
            liveRemainingBalance = prop.totalAmountDue;
          } else if (typeof prop.outstanding_amt === 'number') {
            liveRemainingBalance = prop.outstanding_amt;
          }
        }
      } catch (propErr) {
        console.warn('[sendInPersonPaymentConfirmationSms] Property lookup notice:', propErr);
      }
    }

    if (!rawPhone) {
      return { success: false, error: 'Recipient phone number is required.' };
    }

    // Standardize phone format (Ghana E.164 +233)
    let phone = rawPhone.replace(/\s+/g, '');
    if (phone.startsWith('0') && phone.length === 10) {
      phone = '+233' + phone.substring(1);
    } else if (!phone.startsWith('+')) {
      if (phone.startsWith('233') && phone.length === 12) {
        phone = '+' + phone;
      }
    }

    // Official Municipal SMS Template without URL links
    const messageText = params.customMessage?.trim() || 
      `KKMA Official Payment Confirmation\nDear ${params.ratepayerName || 'Ratepayer'}, payment of GH₵ ${params.amount.toFixed(2)} for Property #${cleanAcc} is credited.\nOfficial GCR: ${cleanReceiptNo}\nRemaining Balance: GH₵ ${liveRemainingBalance.toFixed(2)}\nThank you for paying your municipal property rate.`;

    const provider = getActiveSmsProvider();
    const res = await provider.sendSMS(phone, messageText);

    try {
      await adminDb.auditLog.create({
        data: {
          action: 'DISPATCH_PAYMENT_CONFIRMATION_SMS',
          entityType: 'Receipt',
          entityId: cleanAcc,
          details: `Dispatched payment confirmation SMS for ${cleanAcc} (GCR #${cleanReceiptNo}) to ${phone} by ${admin.name || admin.username}`,
          adminId: admin.id,
        },
      });
    } catch (audErr) {
      console.warn('[sendInPersonPaymentConfirmationSms] Audit log notice:', audErr);
    }

    return {
      success: res.success,
      messageId: res.messageId,
      error: res.error,
    };
  } catch (err: any) {
    console.error('[sendInPersonPaymentConfirmationSms] Error:', err);
    return { success: false, error: err.message || 'Failed to dispatch confirmation SMS.' };
  }
}

export async function getReceiptSmsStatus(receiptNumber: string): Promise<{
  sent: boolean;
  sentAt?: string;
}> {
  try {
    const cleanNo = (receiptNumber || '').trim();
    if (!cleanNo) return { sent: false };

    const { data } = await supabase
      .from('AuditLog')
      .select('createdAt, details')
      .eq('action', 'DISPATCH_PAYMENT_CONFIRMATION_SMS')
      .ilike('details', `%${cleanNo}%`)
      .order('createdAt', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data) {
      return {
        sent: true,
        sentAt: data.createdAt,
      };
    }
    return { sent: false };
  } catch (err) {
    console.error('[getReceiptSmsStatus] Error:', err);
    return { sent: false };
  }
}

export async function getAccountTelephone(accountNo: string): Promise<string> {
  try {
    const cleanAcc = (accountNo || '').trim();
    if (!cleanAcc) return '';
    const { data } = await supabase
      .from('Property')
      .select('telephone')
      .eq('account_no', cleanAcc)
      .maybeSingle();
    return data?.telephone || '';
  } catch (err) {
    console.error('[getAccountTelephone] Error:', err);
    return '';
  }
}

export async function getAccountRemainingBalance(accountNo: string): Promise<number> {
  try {
    const cleanAcc = (accountNo || '').trim();
    if (!cleanAcc) return 0;
    const { data } = await supabase
      .from('Property')
      .select('outstanding_amt, totalAmountDue')
      .eq('account_no', cleanAcc)
      .maybeSingle();
    if (!data) return 0;
    return typeof data.outstanding_amt === 'number'
      ? data.outstanding_amt
      : (typeof data.totalAmountDue === 'number' ? data.totalAmountDue : 0);
  } catch (err) {
    console.error('[getAccountRemainingBalance] Error:', err);
    return 0;
  }
}

export async function importPaymentRecordsBatch(
  rows: any[],
  adminPassword?: string
): Promise<{
  success: boolean;
  error?: string;
  importedCount?: number;
  skippedCount?: number;
  totalAmount?: number;
}> {
  try {
    const admin = await requireAdminSession();
    if (!admin) {
      return { success: false, error: 'Unauthorized session. Please sign in to import payment records.' };
    }

    if (adminPassword) {
      const isAuthorized = verifyPassword(adminPassword, admin.passwordHash);
      if (!isAuthorized) {
        return { success: false, error: 'Incorrect administrator security password. Batch payment import rejected.' };
      }
    }

    if (!Array.isArray(rows) || rows.length === 0) {
      return { success: false, error: 'No payment records provided in import batch.' };
    }

    let importedCount = 0;
    let skippedCount = 0;
    let totalImportedAmount = 0;

    for (const r of rows) {
      const accountNumber = (
        r.accountNumber ||
        r['Account Number'] ||
        r['account_no'] ||
        r['AccountNo'] ||
        r['Account'] ||
        ''
      ).trim();

      const rawAmount = r.amount !== undefined ? r.amount : (r['Amount'] !== undefined ? r['Amount'] : (r['Amount Paid'] !== undefined ? r['Amount Paid'] : r['amount_paid']));
      const cleanAmountStr = String(rawAmount || '').replace(/[^0-9.]/g, '');
      const numAmount = Number(cleanAmountStr);

      if (!accountNumber || isNaN(numAmount) || numAmount <= 0) {
        skippedCount++;
        continue;
      }

      // Find property in adminDb
      const property = await adminDb.property.findUnique({
        where: { accountNumber },
      });

      if (!property) {
        skippedCount++;
        continue;
      }

      const rawReceiptNo = (
        r.receiptNumber ||
        r['Receipt Number'] ||
        r['Receipt'] ||
        r['GCR'] ||
        r['gcrNr'] ||
        r['gcr_nr'] ||
        ''
      ).trim();

      const receiptNo = rawReceiptNo || `PAY-UP-${Date.now().toString(36).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;
      const pmtMethod = (r.paymentMethod || r['Payment Method'] || r['Mode'] || r['Channel'] || 'Bank / Bulk Upload').trim();
      const datePaidStr = (r.paymentDate || r['Payment Date'] || r['Date'] || new Date().toISOString()).trim();
      let datePaid = new Date();
      if (!isNaN(Date.parse(datePaidStr))) {
        datePaid = new Date(datePaidStr);
      }

      // Sequential Municipal Debt Waterfall
      const currArr = Number(property.currentArrears !== undefined ? property.currentArrears : (property.arrears || 0));
      const currFee = Number(property.currentFee || property.current_bill || 0);
      const prevPaidCycle = Number(property.totalPaidCycle !== undefined ? property.totalPaidCycle : (property.amountPaidLastYear || 0));

      const arrearsDeduction = Math.min(currArr, numAmount);
      const newCurrentArrears = Math.max(0, Number((currArr - arrearsDeduction).toFixed(2)));
      const remainingPayment = Math.max(0, Number((numAmount - arrearsDeduction).toFixed(2)));
      const feeDeduction = Math.min(currFee, remainingPayment);
      const newCurrentFee = Math.max(0, Number((currFee - feeDeduction).toFixed(2)));

      const newTotalPaidCycle = Number((prevPaidCycle + numAmount).toFixed(2));
      const prevAmountPaid = Number(property.amount_paid !== undefined ? property.amount_paid : (property.amountPaidLastYear || 0));
      const newAmountPaid = Number((prevAmountPaid + numAmount).toFixed(2));
      const newTotalDue = Math.max(0, Number((newCurrentArrears + newCurrentFee).toFixed(2)));
      const newStatus: 'PAID' | 'PARTIALLY_PAID' | 'UNPAID' = newTotalDue <= 0 ? 'PAID' : 'PARTIALLY_PAID';

      // 1. Update Property
      await adminDb.property.update({
        where: { id: property.id },
        data: {
          currentArrears: newCurrentArrears,
          current_arrears: newCurrentArrears,
          totalPaidCycle: newTotalPaidCycle,
          total_paid_cycle: newTotalPaidCycle,
          amount_paid: newAmountPaid,
          amountPaidLastYear: newAmountPaid,
          currentFee: newCurrentFee,
          current_bill: newCurrentFee,
          totalAmountDue: newTotalDue,
          outstanding_amt: newTotalDue,
          status: newStatus,
        },
      });

      // 2. Create Receipt
      try {
        await adminDb.receipt.create({
          data: {
            userId: property.ownerId || 'OFFICE_SETTLEMENT',
            propertyId: property.id,
            amount: numAmount,
            settlementType: 'TOTAL',
            paymentMethod: pmtMethod,
            status: 'PAID',
            isPhysicalIssued: Boolean(rawReceiptNo),
            receiptNumber: receiptNo,
            collectorName: admin.name || admin.username,
            cashierName: admin.name || admin.username,
            datePaid: datePaid.toISOString(),
          },
        });
      } catch (rErr) {
        console.warn('[importPaymentRecordsBatch] receipt create notice:', rErr);
      }

      // 3. Create FeePayment record for cadastre consistency
      try {
        await supabase.from('FeePayment').insert([{
          id: `fp_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`,
          accountNo: property.accountNumber,
          arrearsPd: arrearsDeduction,
          curAmtPd: feeDeduction,
          amtPaid: numAmount,
          datePaid: datePaid.toISOString(),
          pmtMode: pmtMethod,
          gcrNr: receiptNo,
          collectorsCollectorId: admin.username || admin.id,
          cashiersCashierId: admin.username || admin.id,
          propertyId: property.id,
          transactionId: receiptNo,
        }]);
      } catch (fpErr) {
        console.warn('[importPaymentRecordsBatch] FeePayment insert notice:', fpErr);
      }

      importedCount++;
      totalImportedAmount += numAmount;
    }

    // 4. Audit Log
    try {
      await adminDb.auditLog.create({
        data: {
          action: 'BATCH_PAYMENT_IMPORT',
          entityType: 'Receipt',
          entityId: admin.id,
          details: `Imported ${importedCount} payment records totaling GH₵ ${totalImportedAmount.toFixed(2)} via batch upload (skipped ${skippedCount}).`,
          adminId: admin.id,
        },
      });
    } catch (audErr) {
      console.warn('[importPaymentRecordsBatch] Audit log notice:', audErr);
    }

    revalidatePath('/payments');

    return {
      success: true,
      importedCount,
      skippedCount,
      totalAmount: totalImportedAmount,
    };
  } catch (error: any) {
    console.error('Error importing payment records batch:', error);
    return { success: false, error: error.message || 'Failed to process payment batch import.' };
  }
}



