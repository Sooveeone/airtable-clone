import "~/styles/globals.css"; // Import global styles

import { ClerkProvider } from "@clerk/nextjs"; // Auth provider
import { type Metadata } from "next";
import { Geist } from "next/font/google"; // Modern, clean font
import { TRPCReactProvider } from "~/trpc/react"; // Type-safe API client provider
import { SyncUserProvider } from "./_components/SyncUserProvider"; // User sync mechanism

// Define metadata for SEO and browser tab display
export const metadata: Metadata = {
  title: "Airtable Clone",
  description: "An Airtable clone with real-time editing, virtualized tables, and advanced filtering",
  applicationName: "Airtable Clone",
  authors: [{ name: "Vitto" }],
  generator: "Next.js",
  keywords: ["airtable", "clone", "database", "tables", "spreadsheet", "react", "nextjs", "t3-stack"],
  creator: "Vitto",
  publisher: "Vitto",
  robots: "index, follow",
  
  // Open Graph / Facebook
  openGraph: {
    type: "website",
    title: "Airtable Clone - Built with T3 Stack",
    description: "A full-featured Airtable clone with real-time editing and advanced data management",
    siteName: "Airtable Clone",
  },
  
  // Twitter
  twitter: {
    card: "summary_large_image",
    title: "Airtable Clone - Built with T3 Stack",
    description: "A full-featured Airtable clone with real-time editing and advanced data management",
  },
  
  // Favicon
  icons: [{ rel: "icon", url: "/favicon.ico" }],
};

// Load and configure the Geist font
// This uses Next.js font optimization for better performance
const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans", // CSS variable for font access
});

// Root layout component that wraps the entire application
// This is the top-level component rendered for every page
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    // Authentication provider - manages user sessions and auth state across the app
    // afterSignOutUrl redirects users after logging out
    <ClerkProvider afterSignOutUrl="/sign-in">
      <html lang="en" className={`${geist.variable} font-sans`}>
        <body className="antialiased">
          {/* Type-safe API provider - enables tRPC communication with backend */}
          <TRPCReactProvider>
            {/* Syncs Clerk auth user with our database user */}
            {/* Runs once after login to ensure user exists in our database */}
            <SyncUserProvider />
            
            {/* Page content injected here */}
            {children}
          </TRPCReactProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
