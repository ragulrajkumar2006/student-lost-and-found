"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/format";
import RequireAuth from "@/components/RequireAuth";
import { EmptyState, ErrorAlert, PageHeader, Spinner } from "@/components/ui";

function ReturnHistory() {
    const [returns, setReturns] = useState(null);
    const [error, setError] = useState(null);

    useEffect(() => {
        api("/api/returns").then((data) => setReturns(data.returns)).catch(setError);
    }, []);

    if (error) return <ErrorAlert error={error} />;
    if (!returns) return <Spinner />;

    return (
        <>
            <PageHeader title="Return history" subtitle="Every item that has been handed back to its owner." />
            {returns.length === 0 ? (
                <EmptyState title="No returns recorded yet" />
            ) : (
                <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                            <tr>
                                <th className="px-4 py-3">Return</th>
                                <th className="px-4 py-3">Item</th>
                                <th className="px-4 py-3">Returned to</th>
                                <th className="px-4 py-3">Found by</th>
                                <th className="px-4 py-3">Claimed</th>
                                <th className="px-4 py-3">Returned</th>
                                <th className="px-4 py-3">Remarks</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {returns.map((row) => (
                                <tr key={row.Return_ID} className="hover:bg-slate-50">
                                    <td className="px-4 py-3 text-slate-500">#{row.Return_ID}</td>
                                    <td className="px-4 py-3">
                                        <Link href={`/items/${row.Report_ID}`} className="font-medium text-indigo-700 hover:underline">{row.Item_Name}</Link>
                                        <span className="block text-xs text-slate-500">{row.Location}</span>
                                    </td>
                                    <td className="px-4 py-3 text-slate-900">{row.Claimant_Name}</td>
                                    <td className="px-4 py-3 text-slate-600">{row.Finder_Name}</td>
                                    <td className="whitespace-nowrap px-4 py-3 text-slate-600">{formatDate(row.Claim_Date)}</td>
                                    <td className="whitespace-nowrap px-4 py-3 font-medium text-emerald-700">{formatDate(row.Returned_Date)}</td>
                                    <td className="px-4 py-3 text-slate-600">{row.Return_Remarks || "—"}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </>
    );
}

export default function ReturnsPage() {
    return <RequireAuth role="ADMIN"><ReturnHistory /></RequireAuth>;
}
