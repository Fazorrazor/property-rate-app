export type NetworkProvider = "MTN" | "TELECEL" | "AIRTELTIGO" | null;

export function identifyNetworkCarrier(phoneNumber: string): NetworkProvider {
  // Strip spaces, dashes, etc
  const cleanPhone = phoneNumber.replace(/\D/g, "");
  
  if (cleanPhone.length < 3) return null;
  
  // Handle optional +233 prefix
  let prefix = "";
  if (cleanPhone.length >= 10 && cleanPhone.startsWith("0")) {
    prefix = cleanPhone.substring(0, 3);
  } else if (cleanPhone.length >= 12 && cleanPhone.startsWith("233")) {
    prefix = "0" + cleanPhone.substring(3, 5);
  } else {
    // If user is just typing 3 digits: e.g. "024"
    if (cleanPhone.startsWith("0") && cleanPhone.length === 3) {
      prefix = cleanPhone;
    } else {
      return null;
    }
  }

  // Network mapping
  switch (prefix) {
    case "024":
    case "025":
    case "053":
    case "054":
    case "055":
    case "059":
      return "MTN";
      
    case "020":
    case "050":
      return "TELECEL";
      
    case "027":
    case "026":
    case "057":
    case "056":
      return "AIRTELTIGO";
      
    default:
      return null;
  }
}
