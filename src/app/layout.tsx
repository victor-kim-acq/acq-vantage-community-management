import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ACQ Vantage Community Manager",
  description: "Manage community engagement for the ACQ Vantage Skool group",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="bg-[#0f1117] text-white antialiased">
        {children}
      </body>
    </html>
  );
}
