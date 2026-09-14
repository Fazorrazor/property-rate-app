import { identifyNetworkCarrier, NetworkProvider } from "@/lib/utils/network-detector";

export interface HubtelVerificationResult {
  success: boolean;
  subscriberName: string | null;
  phoneNumber: string;
  network: NetworkProvider;
  isHubtelVerified: boolean;
  error?: string;
}

// In-memory cache to avoid redundant billable queries (15-minute TTL)
const verificationCache = new Map<string, { name: string; timestamp: number }>();
const CACHE_TTL_MS = 15 * 60 * 1000;

/**
 * Normalizes Ghanaian phone numbers into standard formats:
 * - National: 024XXXXXXX (10 digits)
 * - International: 23324XXXXXXX (12 digits)
 */
export function normalizeGhanaPhoneNumber(rawPhone: string): { national: string; international: string } | null {
  const digits = rawPhone.replace(/\D/g, "");

  if (digits.length === 10 && digits.startsWith("0")) {
    return {
      national: digits,
      international: `233${digits.substring(1)}`,
    };
  }

  if (digits.length === 12 && digits.startsWith("233")) {
    return {
      national: `0${digits.substring(3)}`,
      international: digits,
    };
  }

  if (digits.length === 9) {
    return {
      national: `0${digits}`,
      international: `233${digits}`,
    };
  }

  return null;
}

/**
 * Maps our NetworkProvider to Hubtel's channel identifiers.
 */
function getHubtelChannel(network: NetworkProvider): string {
  switch (network) {
    case "MTN":
      return "mtn-gh";
    case "TELECEL":
      return "vodafone-gh"; // Hubtel legacy channel ID for Telecel Ghana
    case "AIRTELTIGO":
      return "tigo-gh";
    default:
      return "mtn-gh";
  }
}

/**
 * Sanitizes phone number for secure logging (masks middle digits).
 */
function maskPhoneForLog(phone: string): string {
  if (phone.length <= 4) return "****";
  return phone.slice(0, 3) + "***" + phone.slice(-3);
}

/**
 * Verifies a Ghanaian mobile number with Hubtel Mobile Verification API.
 * Returns verified subscriber name if successful, or null with error details.
 * Never throws — always returns a safe fallback result.
 */
export async function verifyGhanaMobileSubscriber(phoneNumber: string): Promise<HubtelVerificationResult> {
  const normalized = normalizeGhanaPhoneNumber(phoneNumber);
  const detectedNetwork = identifyNetworkCarrier(phoneNumber);

  if (!normalized) {
    return {
      success: false,
      subscriberName: null,
      phoneNumber,
      network: detectedNetwork,
      isHubtelVerified: false,
      error: "Invalid Ghanaian phone number format",
    };
  }

  // Check cache first to avoid unnecessary billable queries
  const cached = verificationCache.get(normalized.national);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return {
      success: true,
      subscriberName: cached.name,
      phoneNumber: normalized.national,
      network: detectedNetwork,
      isHubtelVerified: true,
    };
  }

  const clientId = process.env.HUBTEL_CLIENT_ID;
  const clientSecret = process.env.HUBTEL_CLIENT_SECRET;
  const merchantAccount = process.env.HUBTEL_MERCHANT_ACCOUNT_NUMBER;

  if (!clientId || !clientSecret) {
    // Hubtel credentials are not configured in this environment
    return {
      success: false,
      subscriberName: null,
      phoneNumber: normalized.national,
      network: detectedNetwork,
      isHubtelVerified: false,
      error: "Hubtel credentials not configured",
    };
  }

  const channel = getHubtelChannel(detectedNetwork);
  const authHeader = `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`;

  // Build Hubtel Verification URL
  let endpoint = process.env.HUBTEL_VERIFICATION_URL;
  if (!endpoint) {
    if (merchantAccount) {
      endpoint = `https://api.hubtel.com/v1/merchantaccount/merchants/${merchantAccount}/mobilemoney/verification?channel=${channel}&phoneNumber=${normalized.international}`;
    } else {
      endpoint = `https://api.hubtel.com/v1/merchantaccount/mobilemoney/verification?channel=${channel}&phoneNumber=${normalized.international}`;
    }
  } else {
    // If custom URL is provided, append query params if not present
    const separator = endpoint.includes("?") ? "&" : "?";
    if (!endpoint.includes("phoneNumber=")) {
      endpoint = `${endpoint}${separator}channel=${channel}&phoneNumber=${normalized.international}`;
    }
  }

  const startTime = Date.now();
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000); // 6s timeout

    const response = await fetch(endpoint, {
      method: "GET",
      headers: {
        Authorization: authHeader,
        Accept: "application/json",
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    const duration = Date.now() - startTime;

    if (!response.ok) {
      console.warn(`[Hubtel Verification] Failed for ${maskPhoneForLog(normalized.national)}: HTTP ${response.status} (${duration}ms)`);
      return {
        success: false,
        subscriberName: null,
        phoneNumber: normalized.national,
        network: detectedNetwork,
        isHubtelVerified: false,
        error: `Hubtel verification returned HTTP ${response.status}`,
      };
    }

    const payload = await response.json();
    
    // Extract name from various Hubtel response formats
    const subscriberName =
      payload?.data?.name ||
      payload?.data?.accountName ||
      payload?.data?.customerName ||
      payload?.Data?.Name ||
      payload?.Data?.AccountName ||
      payload?.accountName ||
      payload?.name ||
      null;

    if (subscriberName && typeof subscriberName === "string" && subscriberName.trim().length > 0) {
      const cleanName = subscriberName.trim();
      // Cache the result
      verificationCache.set(normalized.national, {
        name: cleanName,
        timestamp: Date.now(),
      });

      return {
        success: true,
        subscriberName: cleanName,
        phoneNumber: normalized.national,
        network: detectedNetwork,
        isHubtelVerified: true,
      };
    }

    return {
      success: false,
      subscriberName: null,
      phoneNumber: normalized.national,
      network: detectedNetwork,
      isHubtelVerified: false,
      error: payload?.message || payload?.ResponseCode || "No subscriber name returned",
    };
  } catch (err: any) {
    const duration = Date.now() - startTime;
    const isTimeout = err.name === "AbortError";
    console.warn(`[Hubtel Verification] ${isTimeout ? "Timeout" : "Error"} for ${maskPhoneForLog(normalized.national)} (${duration}ms)`);

    return {
      success: false,
      subscriberName: null,
      phoneNumber: normalized.national,
      network: detectedNetwork,
      isHubtelVerified: false,
      error: isTimeout ? "Verification request timed out" : "Network error during verification",
    };
  }
}
