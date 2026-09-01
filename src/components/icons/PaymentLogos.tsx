import React from "react";

// MTN MoMo Brand Logo
export function MtnMomoLogo({ className = "w-8 h-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <rect width="48" height="48" rx="14" fill="#FFCC00" />
      <ellipse cx="24" cy="24" rx="19" ry="12" fill="#000000" />
      <text
        x="50%"
        y="54%"
        textAnchor="middle"
        dominantBaseline="middle"
        fill="#FFCC00"
        fontFamily="system-ui, -apple-system, sans-serif"
        fontWeight="900"
        fontSize="10"
        letterSpacing="0.5"
      >
        MoMo
      </text>
    </svg>
  );
}

// Telecel Cash Brand Logo
export function TelecelLogo({ className = "w-8 h-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <rect width="48" height="48" rx="14" fill="#E60000" />
      <circle cx="24" cy="24" r="14" fill="#FFFFFF" />
      <text
        x="50%"
        y="56%"
        textAnchor="middle"
        dominantBaseline="middle"
        fill="#E60000"
        fontFamily="system-ui, -apple-system, sans-serif"
        fontWeight="900"
        fontSize="15"
      >
        t.
      </text>
    </svg>
  );
}

// AirtelTigo / AT Cash Logo
export function AirtelTigoLogo({ className = "w-8 h-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <rect width="48" height="48" rx="14" fill="#0055A5" />
      <circle cx="19" cy="24" r="10" fill="#E60000" />
      <circle cx="29" cy="24" r="10" fill="#FFFFFF" fillOpacity="0.9" />
      <text
        x="50%"
        y="55%"
        textAnchor="middle"
        dominantBaseline="middle"
        fill="#0055A5"
        fontFamily="system-ui, -apple-system, sans-serif"
        fontWeight="900"
        fontSize="11"
        letterSpacing="0.5"
      >
        AT
      </text>
    </svg>
  );
}

// Official Visa Card Logo
export function VisaLogo({ className = "w-10 h-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 40" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <rect width="64" height="40" rx="8" fill="#FFFFFF" stroke="#E2E8F0" strokeWidth="1" />
      <path
        d="M26.2 26.5L28.8 13.5H32.8L30.2 26.5H26.2ZM43.3 13.8C42.5 13.5 41.3 13.2 39.8 13.2C35.8 13.2 33 15.3 33 18.3C33 20.5 35 21.8 36.5 22.5C38 23.2 38.6 23.7 38.6 24.4C38.6 25.4 37.3 25.9 36.1 25.9C34.3 25.9 33.3 25.6 32.2 25.1L31.6 24.8L31 28C32 28.5 33.8 28.9 35.7 28.9C40 28.9 42.8 26.8 42.8 23.5C42.8 21.6 41.5 20.1 39 18.9C37.6 18.2 36.7 17.7 36.7 16.9C36.7 16.2 37.5 15.5 39.2 15.5C40.6 15.5 41.7 15.8 42.4 16.2L42.8 16.4L43.3 13.8ZM53.6 26.5H57.2L54 13.5H50.6C49.8 13.5 49.2 13.9 48.9 14.6L41.8 26.5H46L46.8 24.3H52.1L52.6 26.5H53.6ZM48 21.1L50.2 15.1L51.5 21.1H48ZM22.5 13.5L18.7 22.5L18.3 20.5C17.6 18.2 15.4 15.6 12.8 14.3L16.2 26.5H20.4L26.7 13.5H22.5Z"
        fill="#1434CB"
      />
    </svg>
  );
}

// Official Mastercard Logo
export function MastercardLogo({ className = "w-10 h-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 40" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <rect width="64" height="40" rx="8" fill="#1A1F2C" />
      <circle cx="26" cy="20" r="11" fill="#EB001B" />
      <circle cx="38" cy="20" r="11" fill="#F79E1B" fillOpacity="0.9" />
    </svg>
  );
}

// Bank / GovPay Direct Treasury Logo
export function BankTreasuryLogo({ className = "w-8 h-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <rect width="48" height="48" rx="14" fill="#0F172A" />
      <path
        d="M24 12L13 18V20H35V18L24 12ZM15 22V30H18V22H15ZM22.5 22V30H25.5V22H22.5ZM30 22V30H33V22H30ZM12 32V34H36V32H12ZM10 36V38H38V36H10Z"
        fill="#38BDF8"
      />
    </svg>
  );
}
