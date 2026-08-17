import type { Metadata } from "next";
import "./globals.css";
import { Sidebar } from "@/components/sidebar";
import { DataProvider } from "@/lib/state";

export const metadata: Metadata = {
  title: "Intendrix · Team Backend",
  description:
    "Create and manage customized lesson trajectories for Intendrix clients.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-screen text-paper antialiased">
        <DataProvider>
          <div className="flex min-h-screen">
            <Sidebar />
            <main className="min-w-0 flex-1">
              <div className="mx-auto max-w-350 px-6 py-6 lg:px-8">
                {children}
              </div>
            </main>
          </div>
        </DataProvider>
      </body>
    </html>
  );
}
