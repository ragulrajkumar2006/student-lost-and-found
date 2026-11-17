"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "./AuthProvider";
import { Spinner } from "./ui";

// Wrap a page's content to require login (and optionally a role).
// This only controls what the UI shows; the backend enforces the same
// rules on every API request, so hiding a page is never the only protection.
export default function RequireAuth({ role, children }) {
    const { user, ready } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (ready && !user) {
            router.replace("/login");
        }
    }, [ready, user, router]);

    if (!ready || !user) {
        return <Spinner label="Checking your session…" />;
    }

    if (role && user.Role !== role) {
        return (
            <div className="mx-auto max-w-md rounded-2xl border border-rose-200 bg-rose-50 p-8 text-center">
                <h2 className="text-lg font-semibold text-rose-800">Access denied</h2>
                <p className="mt-2 text-sm text-rose-700">This page is only available to administrators.</p>
                <Link href="/dashboard" className="mt-4 inline-block text-sm font-medium text-indigo-700 underline">
                    Back to dashboard
                </Link>
            </div>
        );
    }

    return children;
}
