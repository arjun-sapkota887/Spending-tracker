import type { Metadata } from "next";
import { Providers } from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "Statement Summary",
  description: "Upload your monthly card statements and see where your money went.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="light">
      <body className="min-h-screen bg-default-50 text-foreground antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
