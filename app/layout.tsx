import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

const geist = localFont({
  src: [
    {
      path: "./fonts/geist/Geist-Regular.ttf",
      weight: "400",
      style: "normal",
    },
    {
      path: "./fonts/geist/Geist-Medium.ttf",
      weight: "500",
      style: "normal",
    },
    {
      path: "./fonts/geist/Geist-SemiBold.ttf",
      weight: "600",
      style: "normal",
    },
    {
      path: "./fonts/geist/Geist-Bold.ttf",
      weight: "700",
      style: "normal",
    },
  ],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "YellowMetal LeadDesk",
  description: "Lead-generation platform for YellowMetal partner organizations.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={geist.variable}>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
