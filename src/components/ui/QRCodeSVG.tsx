"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

interface QRCodeSVGProps {
  value: string;
  size?: number;
  className?: string;
  darkColor?: string;
  lightColor?: string;
}

export function QRCodeSVG({
  value,
  size = 120,
  className = "",
  darkColor = "#2C2C2C",
  lightColor = "#FFFFFF",
}: QRCodeSVGProps) {
  const [svgMarkup, setSvgMarkup] = useState<string>("");

  useEffect(() => {
    let isMounted = true;
    QRCode.toString(value, {
      type: "svg",
      width: size,
      margin: 1,
      color: {
        dark: darkColor,
        light: lightColor,
      },
    })
      .then((svg) => {
        if (isMounted) setSvgMarkup(svg);
      })
      .catch((err) => {
        console.error("Error generating QR code:", err);
      });

    return () => {
      isMounted = false;
    };
  }, [value, size, darkColor, lightColor]);

  if (!svgMarkup) {
    return (
      <div
        className={`flex items-center justify-center bg-[#F8F9FA] rounded border border-border-light text-[10px] text-on-surface-muted ${className}`}
        style={{ width: size, height: size }}
      >
        Generating QR...
      </div>
    );
  }

  return (
    <div
      className={`inline-block ${className}`}
      style={{ width: size, height: size }}
      dangerouslySetInnerHTML={{ __html: svgMarkup }}
    />
  );
}
