"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/components/AuthProvider";

const STEPS = [
    { title: "Report", text: "Lost something? Found something? Submit a short report with a description, place and date." },
    { title: "Smart match", text: "Descriptions are converted into AI embeddings and compared by meaning — “charger” finds “power adapter”." },
    { title: "Claim", text: "Owners claim a found item with proof of ownership. An administrator verifies every claim." },
    { title: "Return", text: "The hand-over is recorded, the item is closed, and everyone can see the history." }
];

export default function LandingPage() {
    const { user, isAdmin } = useAuth();
    const [stats, setStats] = useState(null);

    useEffect(() => {
        api("/api/stats/public").then(setStats).catch(() => setStats(null));
    }, []);

    const home = isAdmin ? "/admin" : "/dashboard";

    return (
        <div className="space-y-16">
            <section className="grid items-center gap-10 lg:grid-cols-2">
                <div>
                    <span className="inline-block rounded-full bg-indigo-100 px-3 py-1 text-xs font-semibold text-indigo-700">
                        For students &amp; campus staff
                    </span>
                    <h1 className="mt-4 text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
                        Lost it on campus? <span className="text-indigo-600">Let’s get it back.</span>
                    </h1>
                    <p className="mt-4 max-w-xl text-lg text-slate-600">
                        One place to report lost and found belongings, discover likely matches automatically,
                        and claim your items safely.
                    </p>
                    <div className="mt-8 flex flex-wrap gap-3">
                        {user ? (
                            <Link href={home} className="rounded-lg bg-indigo-600 px-5 py-3 text-sm font-semibold text-white hover:bg-indigo-700">
                                Go to your dashboard
                            </Link>
                        ) : (
                            <>
                                <Link href="/register" className="rounded-lg bg-indigo-600 px-5 py-3 text-sm font-semibold text-white hover:bg-indigo-700">
                                    Create a student account
                                </Link>
                                <Link href="/login" className="rounded-lg border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                                    Log in
                                </Link>
                            </>
                        )}
                    </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                    {[
                        { label: "Items lost", value: stats?.lost, tone: "text-amber-600" },
                        { label: "Items found", value: stats?.found, tone: "text-emerald-600" },
                        { label: "Returned", value: stats?.returned, tone: "text-indigo-600" }
                    ].map((tile) => (
                        <div key={tile.label} className="rounded-2xl border border-slate-200 bg-white p-5 text-center shadow-sm">
                            <p className={`text-4xl font-bold tabular-nums ${tile.tone}`}>{tile.value ?? "–"}</p>
                            <p className="mt-1 text-sm text-slate-500">{tile.label}</p>
                        </div>
                    ))}
                </div>
            </section>

            <section>
                <h2 className="text-xl font-semibold text-slate-900">How it works</h2>
                <ol className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    {STEPS.map((step, index) => (
                        <li key={step.title} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-600 text-sm font-bold text-white">
                                {index + 1}
                            </span>
                            <h3 className="mt-3 font-semibold text-slate-900">{step.title}</h3>
                            <p className="mt-1 text-sm text-slate-600">{step.text}</p>
                        </li>
                    ))}
                </ol>
            </section>
        </div>
    );
}
