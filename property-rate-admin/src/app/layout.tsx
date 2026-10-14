import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "HEINZ INTEGRATED SYSTEMS LIMITED",
  description: "HEINZ INTEGRATED SYSTEMS LIMITED Administration Portal",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full max-h-[100dvh] overflow-hidden">
      <head>
        <link rel="preconnect" href="https://jzezuitkenrfkzrkphiz.supabase.co" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://jzezuitkenrfkzrkphiz.supabase.co" />
      </head>
      <body className="h-[100dvh] max-h-[100dvh] w-full overflow-hidden bg-[#F2F2F7] text-[#1C1C1E] antialiased font-sans flex flex-col">
        {children}
      </body>
    </html>
  );
}
