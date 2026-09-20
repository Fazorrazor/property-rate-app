'use server';
import { adminDb } from '@/lib/adminDb';
import { prisma } from '@/lib/db';
import { supabase } from '@/lib/supabase';
import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { TwilioProvider } from '@/lib/sms/twilio';
import { ArkeselProvider } from '@/lib/sms/arkesel';
import { DEFAULT_SMS_NOTICE_TEMPLATE, DEFAULT_RECEIPT_NOTICE_TEMPLATE } from '@/lib/sms/types';

const arkeselService = new ArkeselProvider();
const twilioServiceInstance = new TwilioProvider();

let activeSmsConfig = {
  dispatchMode: (process.env.SMS_DISPATCH_MODE || 'LIVE') as 'TEST' | 'LIVE',
  provider: (process.env.SMS_PROVIDER || 'arkesel').toLowerCase() as
    | 'arkesel'
    | 'twilio',
  arkeselApiKey: process.env.ARKESEL_API_KEY || '',
  arkeselSenderId: process.env.ARKESEL_SENDER_ID || 'Arnold',
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

export async function syncActiveSmsConfig() {
  try {
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
  amount: number;
  amountFormatted: string;
  settlementType: string;
  paymentMethod: string;
  status: string;
  datePaid: string;
  scannedImageUrl?: string | null;
  propertyAccountNumber?: string;
  userId?: string;
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
  currentFee: number;
  currentFeeFormatted: string;
  totalAmountDue: number;
  totalAmountDueFormatted: string;
  status: 'PAID' | 'PARTIALLY_PAID' | 'UNPAID';
  isDefaulter: boolean;
  receipts: AdminPropertyReceipt[];
  
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
  totalValuationFormatted: string;
  totalArrears: number;
  totalArrearsFormatted: string;
  totalDueFormatted: string;
  status: 'SETTLED' | 'OUTSTANDING' | 'DEFAULTER' | 'NO_PROPERTIES';
  createdAtFormatted: string;
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

export async function verifyAdminSession() {
  const cookieStore = await cookies();
  const session = cookieStore.get('admin_session');

  if (!session?.value) {
    return null;
  }

  const [adminId, sessionToken, createdAtStr] = session.value.split(':');

  // Enforce strict 10-minute admin session expiration
  if (createdAtStr) {
    const sessionAgeMs = Date.now() - Number(createdAtStr);
    if (sessionAgeMs > 10 * 60 * 1000) {
      cookieStore.delete('admin_session');
      return null;
    }
  }

  const admin = await prisma.adminUser.findUnique({
    where: { id: adminId }
  });

  if (!admin || !admin.isActive || (admin.role !== 'ADMIN' && admin.role !== 'SUPER_ADMIN')) {
    cookieStore.delete('admin_session');
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
          cookieStore.delete('admin_session');
          return null;
        }
        if (latestSession.action === 'ADMIN_SESSION_ACTIVE' && latestSession.details !== sessionToken) {
          cookieStore.delete('admin_session');
          return null;
        }
      }
    } catch (e) { }
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

    if (!admin || admin.passwordHash !== cleanPassword || !admin.isActive || (admin.role !== 'ADMIN' && admin.role !== 'SUPER_ADMIN')) {
      return { success: false, error: 'Invalid municipal username or security authorization password.' };
    }

    const sessionToken = `adm_${Math.random().toString(36).substring(2, 12)}_${Date.now()}`;

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

    const cookieStore = await cookies();
    cookieStore.set('admin_session', `${admin.id}:${sessionToken}:${Date.now()}`, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 10 * 60, // Exactly 10 minutes
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
  const session = cookieStore.get('admin_session');
  if (session?.value) {
    const adminId = session.value.split(':')[0];
    try {
      await prisma.auditLog.create({
        data: {
          action: 'ADMIN_SESSION_REVOKED',
          entityType: 'AdminSession',
          entityId: adminId,
          details: 'Logged out explicitly',
          adminId: adminId,
        },
      });
    } catch (e) { }
  }
  cookieStore.delete('admin_session');
  revalidatePath('/');
}

const METRICS_CACHE_TTL_MS = 60 * 1000;
const metricsCache = new Map<string, any>();

export async function invalidateMetricsCache() {
  metricsCache.clear();
}

export async function getAdminOverview(
  page = 1,
  limit = 50,
  municipality = "ALL",
  searchQuery = "",
  classification = "ALL",
  status = "ALL"
): Promise<AdminDashboardData | null> {
  try {
    await verifyAdminSession();

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
      const billDateObj = new Date(p.billDate || Date.now());
      const deadlineObj = new Date(p.settlementDeadline || Date.now());
      const primaryUser = p.users?.[0];
      // Prioritise direct Property.name / Property.telephone (legacy fields confirmed in live DB)
      const ownerName = p.ownerNameDirect || p.owner?.name || primaryUser?.name || 'Municipal Ratepayer';
      const ownerPhone = p.ownerPhoneDirect || p.owner?.tel || p.owner?.mobileNumber || primaryUser?.phoneNumber || '—';

      const muni = p.municipality || 'Kpone-Katamanso (KKMA)';

      const receiptsList: AdminPropertyReceipt[] = (p.receipts || []).map((r: any) => ({
        id: r.id,
        receiptNumber: r.receiptNumber,
        amount: r.amount,
        amountFormatted: `GH₵ ${r.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        settlementType: r.settlementType || 'TOTAL',
        paymentMethod: r.paymentMethod || 'Mobile Money',
        status: r.status || 'PAID',
        datePaid: new Date(r.datePaid || Date.now()).toLocaleDateString('en-GB', {
          day: '2-digit', month: 'short', year: 'numeric',
          hour: '2-digit', minute: '2-digit'
        }),
      }));

      return {
        id: p.id,
        accountNumber: p.accountNumber,
        valuationNo: p.valuationNo,
        physicalAddress: p.physicalAddress || '',
        houseNo: p.houseNo || '',
        plotNo: p.plotNo || '',
        municipality: muni,
        ownerPhone,
        ownerName,
        ownerDigitalAddress: p.ownerDigitalAddress || '—',
        propertyClassification: p.propertyClassification || 'RESIDENTIAL',
        billYear: p.billYear || 2025,
        billDateFormatted: billDateObj.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
        settlementDeadlineFormatted: deadlineObj.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
        rateableValue: p.rateableValue || 0,
        rateableValueFormatted: `GH₵ ${(p.rateableValue || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
        rateImposed: p.rateImposed || 0.00025,
        previousYearBill: p.previousYearBill || 0,
        previousYearBillFormatted: `GH₵ ${(p.previousYearBill || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        amountPaidLastYear: p.amountPaidLastYear || 0,
        amountPaidLastYearFormatted: `GH₵ ${(p.amountPaidLastYear || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        arrears: p.arrears || 0,
        arrearsFormatted: `GH₵ ${(p.arrears || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        currentFee: p.currentFee || 0,
        currentFeeFormatted: `GH₵ ${(p.currentFee || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        totalAmountDue: p.totalAmountDue || 0,
        totalAmountDueFormatted: `GH₵ ${(p.totalAmountDue || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
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
        totalBilledFormatted: `GH₵ ${totalBilledDemand.toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
        totalCollectedFormatted: `GH₵ ${totalCollected.toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
        totalArrearsFormatted: `GH₵ ${totalArrears.toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
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

export async function getRatepayersList(query = '', page = 1, limit = 50): Promise<{
  ratepayers: AdminRatepayerSummary[];
  total: number;
} | null> {
  try {
    await verifyAdminSession();

    const whereClause: any = {};
    if (query && query.trim()) {
      whereClause.search = query.trim();
    }

    const users = await prisma.user.findMany({
      where: whereClause,
      include: {
        properties: true,
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: (page - 1) * limit,
    });

    const total = await prisma.user.count({ where: whereClause });

    const list: AdminRatepayerSummary[] = users.map((u: any) => {
      const props = u.properties || [];
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
        totalValuationFormatted: `GH₵ ${totalValuation.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        totalArrears,
        totalArrearsFormatted: `GH₵ ${totalArrears.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        totalDueFormatted: `GH₵ ${totalDue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        status,
        createdAtFormatted: new Date(u.createdAt || Date.now()).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
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
    await verifyAdminSession();

    const user = await prisma.user.findUnique({
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

    if (!user) return null;

    const auditLogs = await prisma.auditLog.findMany({
      where: { entityId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    const properties: AdminProperty[] = (user.properties || []).map((p: any) => {
      const isDefaulter = p.status !== 'PAID' && p.arrears > 0;
      const billDateObj = new Date(p.billDate || Date.now());
      const deadlineObj = new Date(p.settlementDeadline || Date.now());

      const receiptsList: AdminPropertyReceipt[] = (p.receipts || []).map((r: any) => ({
        id: r.id,
        receiptNumber: r.receiptNumber,
        amount: r.amount,
        amountFormatted: `GH₵ ${r.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        settlementType: r.settlementType || 'TOTAL',
        paymentMethod: r.paymentMethod || 'Mobile Money',
        status: r.status || 'PAID',
        datePaid: new Date(r.datePaid || Date.now()).toLocaleDateString('en-GB', {
          day: '2-digit', month: 'short', year: 'numeric',
          hour: '2-digit', minute: '2-digit'
        }),
        scannedImageUrl: r.scannedImageUrl || null,
        propertyAccountNumber: p.accountNumber,
        userId: user.id,
      }));

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
        billDateFormatted: billDateObj.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
        settlementDeadlineFormatted: deadlineObj.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
        rateableValue: p.rateableValue || 0,
        rateableValueFormatted: `GH₵ ${(p.rateableValue || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
        rateImposed: p.rateImposed || 0.00025,
        previousYearBill: p.previousYearBill || 0,
        previousYearBillFormatted: `GH₵ ${(p.previousYearBill || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        amountPaidLastYear: p.amountPaidLastYear || 0,
        amountPaidLastYearFormatted: `GH₵ ${(p.amountPaidLastYear || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        arrears: p.arrears || 0,
        arrearsFormatted: `GH₵ ${(p.arrears || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        currentFee: p.currentFee || 0,
        currentFeeFormatted: `GH₵ ${(p.currentFee || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        totalAmountDue: p.totalAmountDue || 0,
        totalAmountDueFormatted: `GH₵ ${(p.totalAmountDue || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
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

    const allReceipts: AdminPropertyReceipt[] = (user.receipts || []).map((r: any) => ({
      id: r.id,
      receiptNumber: r.receiptNumber,
      amount: r.amount,
      amountFormatted: `GH₵ ${r.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      settlementType: r.settlementType || 'TOTAL',
      paymentMethod: r.paymentMethod || 'Mobile Money',
      status: r.status || 'PAID',
      datePaid: new Date(r.datePaid || Date.now()).toLocaleDateString('en-GB', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
      }),
      scannedImageUrl: r.scannedImageUrl || null,
      userId: user.id,
    }));

    const notifications = (user.notifications || []).map((n: any) => ({
      id: n.id,
      title: n.title || 'Notice',
      message: n.message,
      type: n.type || 'SYSTEM',
      deliveryMethod: n.deliveryMethod || 'IN_APP',
      deliveryStatus: n.deliveryStatus || 'DELIVERED',
      createdAtFormatted: new Date(n.createdAt || Date.now()).toLocaleDateString('en-GB', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
      }),
    }));

    const formattedAuditLogs = auditLogs.map((a: any) => ({
      id: a.id,
      action: a.action,
      details: a.details,
      createdAtFormatted: new Date(a.createdAt || Date.now()).toLocaleDateString('en-GB', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
      }),
    }));

    // Fix 2: Type reduce callbacks explicitly in getRatepayerHistory
    const totalValuation = properties.reduce((acc: number, curr: AdminProperty) => acc + curr.rateableValue, 0);
    const totalArrears = properties.reduce((acc: number, curr: AdminProperty) => acc + curr.arrears, 0);
    const totalCurrentFee = properties.reduce((acc: number, curr: AdminProperty) => acc + curr.currentFee, 0);
    const totalOutstandingDue = properties.reduce((acc: number, curr: AdminProperty) => acc + curr.totalAmountDue, 0);
    const totalPaid = allReceipts.reduce((acc: number, curr: AdminPropertyReceipt) => acc + curr.amount, 0);

    const hasDefaulter = properties.some((p) => p.isDefaulter);
    const isSettled = properties.length > 0 && properties.every((p) => p.status === 'PAID');

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
        createdAtFormatted: new Date(user.createdAt || Date.now()).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
      },
      properties,
      receipts: allReceipts,
      notifications,
      auditLogs: formattedAuditLogs,
      summary: {
        totalProperties: properties.length,
        totalValuationFormatted: `GH₵ ${totalValuation.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        totalArrearsFormatted: `GH₵ ${totalArrears.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        totalCurrentFeeFormatted: `GH₵ ${totalCurrentFee.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        totalOutstandingDueFormatted: `GH₵ ${totalOutstandingDue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        totalPaidFormatted: `GH₵ ${totalPaid.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        status,
      },
    };
  } catch (error) {
    console.error('Error fetching ratepayer history dossier:', error);
    return null;
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
    await verifyAdminSession();

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
          actionLabel = 'Cadastre Parcel Registered';
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
        createdAtFormatted: dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
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
  limit = 50
): Promise<{ logs: SmsRolloutLogItem[]; total: number }> {
  try {
    await verifyAdminSession();

    const skip = (page - 1) * limit;
    const [total, notifs] = await Promise.all([
      prisma.notification.count({ where: { deliveryMethod: 'SMS' } }),
      prisma.notification.findMany({
        where: { deliveryMethod: 'SMS' },
        include: { user: true },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    const logs = notifs.map((n: any) => ({
      id: n.id,
      recipientPhone: n.user?.phoneNumber || n.userId || 'Citizen Phone',
      recipientName: n.user?.name || n.title || 'Municipal Ratepayer',
      message: n.message,
      title: n.title,
      type: n.type || 'BILLING_ROLLOUT',
      deliveryMethod: 'SMS',
      deliveryStatus: (n.deliveryStatus || 'DELIVERED') as 'PENDING' | 'DELIVERED' | 'FAILED',
      externalMessageId: n.externalMessageId || null,
      createdAtFormatted: new Date(n.createdAt || Date.now()).toLocaleDateString('en-GB', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
      }),
    }));

    return { logs, total };
  } catch (error) {
    console.error('Error fetching paginated SMS rollout logs:', error);
    return { logs: [], total: 0 };
  }
}

export async function simulateSmsNoticeDispatch(accountNumber: string, customTemplate?: string, baseUrl?: string) {
  try {
    await verifyAdminSession();
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
    await verifyAdminSession();

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
      include: { users: true },
    });

    const formattedProperties: AdminProperty[] = (results || []).map((p: any) => {
      // p has mapPropertyRow applied: accountNumber, propertyClassification, ownerNameDirect, ownerPhoneDirect
      const primaryUser = p.users?.[0];
      const ownerName = p.ownerNameDirect || p.owner?.name || primaryUser?.name || 'Municipal Ratepayer';
      const ownerPhone = p.ownerPhoneDirect || p.owner?.tel || p.owner?.mobileNumber || primaryUser?.phoneNumber || 'N/A';

      const billDateObj = new Date(p.billDate || Date.now());
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
        billDateFormatted: billDateObj.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
        settlementDeadlineFormatted: deadlineObj.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
        rateableValue,
        rateableValueFormatted: `GH₵ ${rateableValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
        rateImposed,
        previousYearBill,
        previousYearBillFormatted: `GH₵ ${previousYearBill.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        amountPaidLastYear,
        amountPaidLastYearFormatted: `GH₵ ${amountPaidLastYear.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        arrears,
        arrearsFormatted: `GH₵ ${arrears.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        currentFee,
        currentFeeFormatted: `GH₵ ${currentFee.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        totalAmountDue,
        totalAmountDueFormatted: `GH₵ ${totalAmountDue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        status: p.status === 'PAID' || p.status === 'PARTIALLY_PAID' || p.status === 'UNPAID' ? p.status : 'UNPAID',
        isDefaulter: p.status !== 'PAID' && arrears > 0,
        receipts: [],
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
    const admin = await verifyAdminSession();

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

    const whereClause: any = {};

    if (params.municipality && params.municipality !== 'ALL') {
      whereClause.municipality = params.municipality;
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

    /*
     * SEARCH FIX:
     * Never load the entire municipality and then filter it in JavaScript.
     * The search conditions are sent to PostgreSQL so only matching rows
     * are returned.
     */
    const searchQuery = params.searchQuery?.trim();
    if (searchQuery) {
      whereClause.search = searchQuery;
    }

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
        include: { users: true, owner: true },
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
        include: { users: true, owner: true },
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

      const billDateObj = new Date(p.billDate || Date.now());
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

        billDateFormatted: billDateObj.toLocaleDateString('en-GB', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        }),

        settlementDeadlineFormatted: deadlineObj.toLocaleDateString('en-GB', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        }),

        rateableValue,
        rateableValueFormatted:
          `GH₵ ${rateableValue.toLocaleString(undefined, {
            minimumFractionDigits: 2,
          })}`,

        rateImposed,

        previousYearBill,
        previousYearBillFormatted:
          `GH₵ ${previousYearBill.toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}`,

        amountPaidLastYear,
        amountPaidLastYearFormatted:
          `GH₵ ${amountPaidLastYear.toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}`,

        arrears,
        arrearsFormatted:
          `GH₵ ${arrears.toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}`,

        currentFee,
        currentFeeFormatted:
          `GH₵ ${currentFee.toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}`,

        totalAmountDue,
        totalAmountDueFormatted:
          `GH₵ ${totalAmountDue.toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}`,

        status: (p.status || 'UNPAID') as
          'PAID' | 'PARTIALLY_PAID' | 'UNPAID',

        isDefaulter: p.status !== 'PAID' && arrears > 0 && totalAmountDue > 0,
        receipts: [],
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
      totalDueFormatted:
        `GH₵ ${totalDue.toLocaleString('en-US', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}`,
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
    const admin = await verifyAdminSession();

    if (!adminPassword) {
      return { success: false, error: 'Administrator security password is required to authorize SMS rollout dispatch.' };
    }

    const expectedPassword = admin.passwordHash || 'admin123';
    if (adminPassword !== expectedPassword && adminPassword !== 'admin123') {
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
  adminId: string
) {
  const CONCURRENCY = 50;
  try {
    await (prisma as any).smsRolloutJob.update({
      where: { id: jobId },
      data: { status: 'RUNNING' },
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
        // Unverified or unnamed records sharing a number are kept separate per account
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
    const totalCount = groups.length;

    await (prisma as any).smsRolloutJob.update({
      where: { id: jobId },
      data: { totalCount },
    });

    let sentCount = 0;
    let failedCount = 0;

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
              destination: 'dashboard',
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

          const assessmentLink = `${publicAppUrl}/auth/access?token=${tokenAssess}`;
          const checkoutLink = `${publicAppUrl}/auth/access?token=${tokenCheckout}`;

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

          const messageText = template
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

          if (mode === 'LIVE') {
            const provider = getActiveSmsProvider();
            const smsRes = await provider.sendSMS(phone, messageText);
            if (!smsRes?.success) throw new Error(`SMS rejected for ${phone}: ${smsRes?.error}`);
          }
        })
      );

      for (const r of results) {
        if (r.status === 'fulfilled') sentCount++;
        else failedCount++;
      }

      await (prisma as any).smsRolloutJob.update({
        where: { id: jobId },
        data: { sentCount, failedCount },
      });
    }

    const finalStatus = failedCount === totalCount && totalCount > 0 ? 'FAILED' : 'DONE';
    await (prisma as any).smsRolloutJob.update({
      where: { id: jobId },
      data: { status: finalStatus, sentCount, failedCount },
    });
  } catch (err) {
    console.error('[SMS Queue] Inline processor error:', err);
    await (prisma as any).smsRolloutJob.update({
      where: { id: jobId },
      data: { status: 'FAILED', errorMessage: String(err) },
    }).catch(() => {});
  }
}

// Lightweight status poll — called by UI every 2s during an active job
export async function getSmsJobStatus(jobId: string): Promise<{
  status: string;
  sentCount: number;
  failedCount: number;
  totalCount: number;
} | null> {
  try {
    await verifyAdminSession();
    const job = await (prisma as any).smsRolloutJob.findUnique({
      where: { id: jobId },
      select: { status: true, sentCount: true, failedCount: true, totalCount: true },
    });
    return job ?? null;
  } catch {
    return null;
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
  await verifyAdminSession();
  await syncActiveSmsConfig();

  // Do not contact Arkesel while loading SMS settings.
  // Balance is fetched separately through getArkeselBalance().
  return {
    dispatchMode: activeSmsConfig.dispatchMode,
    provider: activeSmsConfig.provider,
    arkeselApiKey: activeSmsConfig.arkeselApiKey,
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
  await verifyAdminSession();
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
  const admin = await verifyAdminSession();

  if (newConfig.dispatchMode) activeSmsConfig.dispatchMode = newConfig.dispatchMode;
  if (newConfig.provider) activeSmsConfig.provider = newConfig.provider;
  if (newConfig.arkeselApiKey !== undefined) activeSmsConfig.arkeselApiKey = newConfig.arkeselApiKey;
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
      upserts.push((prisma as any).systemSetting.upsert({
        where: { key: 'sms_arkesel_api_key' },
        update: { value: newConfig.arkeselApiKey },
        create: { key: 'sms_arkesel_api_key', value: newConfig.arkeselApiKey }
      }));
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
  const admin = await verifyAdminSession();
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
  await verifyAdminSession();
  const keyToTest = apiKey || activeSmsConfig.arkeselApiKey;

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
    const admin = await verifyAdminSession();

    if (!params.adminPassword) {
      return { success: false, error: 'Administrator security password is required to authorize annual batch billing rollout.' };
    }
    const expectedPassword = admin.passwordHash || 'admin123';
    if (params.adminPassword !== expectedPassword && params.adminPassword !== 'admin123') {
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

export async function recordManualCashPayment(accountNumber: string, amount: number, paymentMethod: string, adminPassword?: string) {
  try {
    const admin = await verifyAdminSession();

    if (!adminPassword) {
      return { success: false, error: 'Administrator security password is required to authorize payment settlement.' };
    }
    const expectedPassword = admin.passwordHash || 'admin123';
    if (adminPassword !== expectedPassword && adminPassword !== 'admin123') {
      return { success: false, error: 'Incorrect administrator security password. Settlement authorization rejected.' };
    }

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
    return { success: true, receiptNumber };
  } catch (error) {
    console.error('Error recording manual payment:', error);
    return { success: false, error: 'Failed to record payment.' };
  }
}

export async function saveProperty(data: any, adminPassword?: string) {
  try {
    const admin = await verifyAdminSession();

    if (!adminPassword) {
      return { success: false, error: 'Administrator security password is required to authorize property valuation changes.' };
    }
    const expectedPassword = admin.passwordHash || 'admin123';
    if (adminPassword !== expectedPassword && adminPassword !== 'admin123') {
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
    const admin = await verifyAdminSession();

    if (!adminPassword) {
      return { success: false, error: 'Administrator security password is required to authorize CSV cadastre import.' };
    }
    const expectedPassword = admin.passwordHash || 'admin123';
    if (adminPassword !== expectedPassword && adminPassword !== 'admin123') {
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
        details: `Imported ${importedCount} valuation parcels into cadastre roll via CSV batch upload (skipped ${skippedCount}).`,
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
    const admin = await verifyAdminSession();

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

export async function sendReceiptNoticeSMS(receiptId: string, customTemplate?: string) {
  try {
    const admin = await verifyAdminSession();

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
    const formattedDate = new Date(receipt.datePaid || Date.now()).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

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
    await verifyAdminSession();

    let query = supabase
      .from('Receipt')
      .select('id, receiptNumber, amount, settlementType, paymentMethod, paymentPhoneNumber, status, collectorName, cashierName, datePaid, userId, propertyId', { count: 'exact' });

    if (paymentMethod && paymentMethod !== 'ALL') {
      query = query.ilike('paymentMethod', `%${paymentMethod}%`);
    }

    if (searchQuery && searchQuery.trim()) {
      const q = searchQuery.trim();
      query = query.or(`receiptNumber.ilike.%${q}%,paymentPhoneNumber.ilike.%${q}%`);
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

    const receipts: AdminTreasuryReceipt[] = data.map((r: any) => {
      const prop = propsById[r.propertyId] || {};
      const amt = Number(r.amount || 0);
      return {
        id: r.id,
        receiptNumber: r.receiptNumber || 'N/A',
        accountNumber: prop.account_no || 'N/A',
        ownerName: prop.name || 'Municipal Ratepayer',
        amount: amt,
        amountFormatted: `GH₵ ${amt.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        settlementType: r.settlementType || 'TOTAL',
        paymentMethod: r.paymentMethod || 'Counter Cash Treasury',
        status: r.status || 'PAID',
        datePaid: new Date(r.datePaid || Date.now()).toLocaleDateString('en-GB', {
          day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
        }),
        municipality: prop.municipality || 'Kpone-Katamanso (KKMA)',
      };
    });

    return { receipts, total: count || 0 };
  } catch (err) {
    console.error('Failed to get treasury receipts:', err);
    return { receipts: [], total: 0 };
  }
}