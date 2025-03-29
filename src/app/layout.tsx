import "~/styles/globals.css";

import { ClerkProvider } from "@clerk/nextjs";
import { type Metadata } from "next";
import { Geist } from "next/font/google";
import { TRPCReactProvider } from "~/trpc/react";
import { SyncUserProvider } from "./_components/SyncUserProvider"; //  adjust path if needed

export const metadata: Metadata = {
  title: "Airtable Clone",
  description: "A simple clone of Airtable built with T3 Stack",
  icons: [{ rel: "icon", url: "/favicon.ico" }],
};

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
});

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <ClerkProvider afterSignOutUrl="/sign-in">
      <html lang="en" className={`${geist.variable} font-sans`}>
        <body className="antialiased">
          <TRPCReactProvider>
            <SyncUserProvider /> {/* Syncs the Clerk user */}
            {children}
          </TRPCReactProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
