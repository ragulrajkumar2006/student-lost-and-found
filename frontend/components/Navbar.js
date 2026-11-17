"use client";

import Link from "next/link";
import { useState } from "react";
import { useAuth } from "./AuthProvider";

const STUDENT_LINKS = [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/items", label: "Browse items" },
    { href: "/report/lost", label: "Report lost" },
    { href: "/report/found", label: "Report found" },
    { href: "/my-reports", label: "My reports" },
    { href: "/my-claims", label: "My claims" }
];

const ADMIN_LINKS = [
    { href: "/admin", label: "Admin" },
    { href: "/admin/claims", label: "Manage claims" },
    { href: "/admin/returns", label: "Returns" },
    { href: "/items", label: "Browse items" }
];

export default function Navbar() {
    const { user, ready, logout, isAdmin } = useAuth();
    const [open, setOpen] = useState(false);
    const links = user ? (isAdmin ? ADMIN_LINKS : STUDENT_LINKS) : [];

    return (
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
            <nav className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
                <Link href={user ? (isAdmin ? "/admin" : "/dashboard") : "/"} className="flex items-center gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-sm font-bold text-white">
                        LF
                    </span>
                    <span className="font-semibold text-slate-900">Campus Lost &amp; Found</span>
                </Link>

                <div className="hidden items-center gap-1 lg:flex">
                    {links.map((link) => (
                        <Link key={link.href} href={link.href}
                            className="rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 hover:text-slate-900">
                            {link.label}
                        </Link>
                    ))}
                </div>

                <div className="flex items-center gap-2">
                    {ready && !user && (
                        <>
                            <Link href="/login" className="rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">
                                Log in
                            </Link>
                            <Link href="/register" className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700">
                                Register
                            </Link>
                        </>
                    )}
                    {user && (
                        <>
                            <span className="hidden text-right text-xs leading-tight text-slate-500 sm:block">
                                <span className="block font-medium text-slate-800">{user.Name}</span>
                                {user.Role}
                            </span>
                            <button onClick={logout}
                                className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
                                Log out
                            </button>
                            <button onClick={() => setOpen(!open)} aria-label="Menu"
                                className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 lg:hidden">
                                ☰
                            </button>
                        </>
                    )}
                </div>
            </nav>

            {open && user && (
                <div className="border-t border-slate-200 bg-white px-4 py-2 lg:hidden">
                    {links.map((link) => (
                        <Link key={link.href} href={link.href} onClick={() => setOpen(false)}
                            className="block rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-100">
                            {link.label}
                        </Link>
                    ))}
                </div>
            )}
        </header>
    );
}
