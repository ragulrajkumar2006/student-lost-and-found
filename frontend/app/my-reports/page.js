"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/format";
import RequireAuth from "@/components/RequireAuth";
import { Badge, Button, EmptyState, ErrorAlert, PageHeader, Spinner } from "@/components/ui";

function MyReports() {
    const [reports, setReports] = useState(null);
    const [error, setError] = useState(null);

    useEffect(() => {
        api("/api/reports/mine").then((data) => setReports(data.reports)).catch(setError);
    }, []);

    if (error) return <ErrorAlert error={error} />;
    if (!reports) return <Spinner />;

    return (
        <>
            <PageHeader title="My reports" subtitle="Items you reported as lost or found."
                action={
                    <div className="flex gap-2">
                        <Link href="/report/lost"><Button>Report lost</Button></Link>
                        <Link href="/report/found"><Button variant="success">Report found</Button></Link>
                    </div>
                } />

            {reports.length === 0 ? (
                <EmptyState title="You have not reported anything yet" />
            ) : (
                <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                            <tr>
                                <th className="px-4 py-3">Item</th>
                                <th className="px-4 py-3">Type</th>
                                <th className="px-4 py-3">Location</th>
                                <th className="px-4 py-3">Date</th>
                                <th className="px-4 py-3">Status</th>
                                <th className="px-4 py-3">Claims</th>
                                <th className="px-4 py-3"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {reports.map((report) => (
                                <tr key={report.Report_ID} className="hover:bg-slate-50">
                                    <td className="px-4 py-3 font-medium text-slate-900">{report.Item_Name}</td>
                                    <td className="px-4 py-3"><Badge value={report.Report_Type} /></td>
                                    <td className="px-4 py-3 text-slate-600">{report.Location}</td>
                                    <td className="whitespace-nowrap px-4 py-3 text-slate-600">{formatDate(report.Date_Reported)}</td>
                                    <td className="px-4 py-3"><Badge value={report.Status} /></td>
                                    <td className="px-4 py-3 text-slate-600">
                                        {report.Total_Claims}
                                        {report.Pending_Claims > 0 && <span className="ml-1 text-amber-700">({report.Pending_Claims} pending)</span>}
                                    </td>
                                    <td className="whitespace-nowrap px-4 py-3 text-right">
                                        <Link href={`/items/${report.Report_ID}/matches`} className="mr-3 text-indigo-700 hover:underline">Matches</Link>
                                        <Link href={`/items/${report.Report_ID}`} className="text-indigo-700 hover:underline">Open</Link>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </>
    );
}

export default function MyReportsPage() {
    return <RequireAuth><MyReports /></RequireAuth>;
}
