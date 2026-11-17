"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/components/AuthProvider";
import RequireAuth from "@/components/RequireAuth";
import ReportCard from "@/components/ReportCard";
import { ErrorAlert, PageHeader, Spinner, StatTile } from "@/components/ui";

function Dashboard() {
    const { user } = useAuth();
    const [data, setData] = useState(null);
    const [error, setError] = useState(null);

    useEffect(() => {
        Promise.all([
            api("/api/auth/me"),
            api("/api/reports/mine"),
            api("/api/claims/mine"),
            api("/api/reports?status=OPEN")
        ])
            .then(([me, reports, claims, open]) => setData({ me: me.user, reports: reports.reports, claims: claims.claims, open: open.reports }))
            .catch(setError);
    }, []);

    if (error) return <ErrorAlert error={error} />;
    if (!data) return <Spinner />;

    const pendingClaims = data.claims.filter((claim) => claim.Claim_Status === "PENDING").length;
    const openReports = data.reports.filter((report) => report.Status === "OPEN").length;
    const recent = data.open.filter((report) => report.Student_ID !== user.Student_ID).slice(0, 6);

    return (
        <>
            <PageHeader
                title={`Hi ${user.Name.split(" ")[0]} 👋`}
                subtitle="Here is what is happening with your lost and found items."
            />

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StatTile label="My reports" value={data.me.Report_Count} tone="indigo" />
                <StatTile label="Still open" value={openReports} tone="amber" />
                <StatTile label="My claims" value={data.claims.length} tone="violet" />
                <StatTile label="Claims pending" value={pendingClaims} tone="emerald" />
            </div>

            <div className="mt-8 grid gap-4 sm:grid-cols-2">
                <Link href="/report/lost"
                    className="rounded-2xl border border-amber-200 bg-amber-50 p-6 transition hover:shadow-md">
                    <p className="text-lg font-semibold text-amber-900">I lost something</p>
                    <p className="mt-1 text-sm text-amber-800">Report it and see similar found items immediately.</p>
                </Link>
                <Link href="/report/found"
                    className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 transition hover:shadow-md">
                    <p className="text-lg font-semibold text-emerald-900">I found something</p>
                    <p className="mt-1 text-sm text-emerald-800">Register it so the owner can find and claim it.</p>
                </Link>
            </div>

            <div className="mt-10 flex items-end justify-between">
                <h2 className="text-lg font-semibold text-slate-900">Recently reported on campus</h2>
                <Link href="/items" className="text-sm font-medium text-indigo-700 hover:underline">Browse all →</Link>
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {recent.map((report) => <ReportCard key={report.Report_ID} report={report} />)}
            </div>
        </>
    );
}

export default function DashboardPage() {
    return <RequireAuth><Dashboard /></RequireAuth>;
}
