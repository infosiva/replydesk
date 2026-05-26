import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Script from "next/script";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL("https://switchboard-ai.vercel.app"),
  title: "ReplyDesk — AI Front Desk & Customer Support",
  description: "Your AI front desk answers calls, replies to emails, and handles customer support 24/7. Never sleeps, always professional.",
  keywords: ["AI customer support", "virtual receptionist", "automated helpdesk", "business automation"],
  openGraph: {
    title: "ReplyDesk — AI Front Desk & Customer Support",
    description: "24/7 AI-powered customer support and reception handling",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full dark">
      <head>
        <Script
          id="structured-data"
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "SoftwareApplication",
              "name": "ReplyDesk",
              "description": "AI-powered customer support and reception automation",
              "applicationCategory": "BusinessApplication",
              "offers": {
                "@type": "Offer",
                "price": "0",
                "priceCurrency": "USD"
              }
            })
          }}
        />
      </head>
      <body className={`${inter.className} bg-gray-950 text-gray-100 min-h-full`}>
        {children}
        <Script defer data-site="switchboard-ai.vercel.app" src="http://31.97.56.148:3098/t.js" strategy="afterInteractive" />
      </body>
    </html>
  );
}
