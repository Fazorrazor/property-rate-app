import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "KKMA Revenue Directorate — Municipal Administration Portal",
  description: "Kpone-Katamanso Municipal Assembly Property Rate Digital Administration & Revenue Monitoring Portal",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[#F6ECF2] text-[#2C2C2C] antialiased font-sans">
        {children}
      </body>
    </html>
  );
}
