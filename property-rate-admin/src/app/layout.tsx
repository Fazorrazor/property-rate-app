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
      <head>
        <link rel="preconnect" href="https://jzezuitkenrfkzrkphiz.supabase.co" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://jzezuitkenrfkzrkphiz.supabase.co" />
      </head>
      <body className="min-h-screen w-full bg-[#F2F2F7] text-[#1C1C1E] antialiased font-sans flex flex-col">
        {children}
      </body>
    </html>
  );
}
