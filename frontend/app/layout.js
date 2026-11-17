import { Geist } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/components/AuthProvider";
import Navbar from "@/components/Navbar";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata = {
  title: "Campus Lost & Found",
  description: "Student Lost and Found Item Tracking System — report, match and recover lost items on campus.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${geistSans.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-slate-50 text-slate-900">
        <AuthProvider>
          <Navbar />
          <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
          <footer className="border-t border-slate-200 bg-white py-4 text-center text-xs text-slate-500">
            Student Lost and Found Item Tracking System · DBMS Mini Project · Next.js · Express · MySQL · Qdrant
          </footer>
        </AuthProvider>
      </body>
    </html>
  );
}
