import type { Metadata } from "next";
import "./globals.css";
import { Sidebar } from "@/components/sidebar";
import { DataProvider } from "@/lib/state";

export const metadata: Metadata = {
  title: "Intendrix · Team Backend",
  description:
    "Create and manage customized lesson trajectories for Intendrix clients.",
};

/** Applies the saved theme + typeface before first paint (no flash). */
const bootScript = `try{
if(localStorage.getItem('intendrix-theme')==='light')document.documentElement.classList.add('light');
var f=localStorage.getItem('intendrix-font-stack');
if(f)document.documentElement.style.setProperty('--app-font',f);
}catch(e){}`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Nunito:wght@400;600;700;800&family=Poppins:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen text-paper antialiased">
        <script dangerouslySetInnerHTML={{ __html: bootScript }} />
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
