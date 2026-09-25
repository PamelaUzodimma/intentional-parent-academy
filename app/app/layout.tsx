import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Intentional Parent Academy — 7-in-1 Book Package",
  description: "Order the Academy's 7-in-1 book package and choose your preferred distributor.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
