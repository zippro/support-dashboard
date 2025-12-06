import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/Sidebar";
import { AuthProvider } from "@/lib/auth";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Narcade Support",
  description: "Internal support ticket system",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <body className={`${inter.className} h-full flex`}>
        <AuthProvider>
          <Sidebar />
          <main className="flex-1 overflow-y-auto bg-white dark:bg-gray-950">
            {children}
          </main>
        </AuthProvider>
      </body>
    </html>
  );
}
