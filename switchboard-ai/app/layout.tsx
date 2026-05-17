import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "ReplyDesk",
  description: "Your AI front desk — answers calls, replies to emails, never sleeps.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full dark">
      <body className={`${inter.className} bg-gray-950 text-gray-100 min-h-full`}>
        {children}
      </body>
    </html>
  );
}
