"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import RequireAuth from "@/components/RequireAuth";
import { Alert, Badge, Button, Card, ErrorAlert, PageHeader, Spinner, StatTile } from "@/components/ui";

function AdminDashboard() {
    const [stats, setStats] = useState(null);
    const [students, setStudents] = useState(null);
    const [vector, setVector] = useState(null);
    const [error, setError] = useState(null);
    const [reindexing, setReindexing] = useState(false);
    const [reindexResult, setReindexResult] = useState(null);

    const load = useCallback(() => {
        api("/api/admin/stats").then(setStats).catch(setError);
        api("/api/admin/students").then((data) => setStudents(data.students)).catch(setError);
        api("/api/admin/vector-status").then(setVector).catch(() => setVector({ unavailable: true }));
    }, []);

    useEffect(() => { load(); }, [load]);

    async function reindex() {
        setReindexing(true);
        setReindexResult(null);
        try {
            const result = await api("/api/admin/reindex", { method: "POST" });
            setReindexResult(`Re-indexed ${result.indexed} reports, removed ${result.removedStale} stale vector(s).`);
            load();
        } catch (err) {
            setError(err);
        } finally {
            setReindexing(false);
        }
    }

    if (error) return <ErrorAlert error={error} />;
    if (!stats) return <Spinner />;

    return (
        <>
            <PageHeader title="Admin dashboard" subtitle="Overview of every report, claim and return."
                action={<Link href="/admin/claims"><Button>Review claims ({stats.totals.Pending_Claims})</Button></Link>} />

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StatTile label="Registered students" value={stats.totals.Students} />
                <StatTile label="Total reports" value={stats.totals.Reports} tone="indigo" />
                <StatTile label="Pending claims" value={stats.totals.Pending_Claims} tone="amber" />
                <StatTile label="Items returned" value={stats.totals.Returns} tone="emerald" />
            </div>

            <div className="mt-6 grid gap-6 lg:grid-cols-3">
                <Card>
                    <h2 className="font-semibold text-slate-900">Reports by type &amp; status</h2>
                    <table className="mt-3 w-full text-sm">
                        <tbody className="divide-y divide-slate-100">
                            {stats.byTypeAndStatus.map((row) => (
                                <tr key={`${row.Report_Type}-${row.Status}`}>
                                    <td className="py-2"><Badge value={row.Report_Type} /></td>
                                    <td className="py-2"><Badge value={row.Status} /></td>
                                    <td className="py-2 text-right font-semibold tabular-nums">{row.Total}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </Card>

                <Card>
                    <h2 className="font-semibold text-slate-900">Claims by status</h2>
                    <table className="mt-3 w-full text-sm">
                        <tbody className="divide-y divide-slate-100">
                            {stats.claimsByStatus.map((row) => (
                                <tr key={row.Claim_Status}>
                                    <td className="py-2"><Badge value={row.Claim_Status} /></td>
                                    <td className="py-2 text-right font-semibold tabular-nums">{row.Total}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    <h2 className="mt-6 font-semibold text-slate-900">Busiest locations</h2>
                    <ul className="mt-2 space-y-1 text-sm">
                        {stats.topLocations.map((row) => (
                            <li key={row.Location} className="flex justify-between">
                                <span className="text-slate-700">{row.Location}</span>
                                <span className="font-semibold tabular-nums">{row.Total}</span>
                            </li>
                        ))}
                    </ul>
                </Card>

                <Card>
                    <h2 className="font-semibold text-slate-900">Vector database (Qdrant)</h2>
                    {!vector && <Spinner label="Checking…" />}
                    {vector?.unavailable && <Alert type="error">Qdrant is not reachable.</Alert>}
                    {vector && !vector.unavailable && (
                        <dl className="mt-3 space-y-2 text-sm">
                            <div className="flex justify-between"><dt className="text-slate-500">Collection</dt><dd className="font-mono text-xs">{vector.collection}</dd></div>
                            <div className="flex justify-between"><dt className="text-slate-500">Vector size / metric</dt><dd>{vector.vectorSize} · {vector.distance}</dd></div>
                            <div className="flex justify-between"><dt className="text-slate-500">Vectors in Qdrant</dt><dd className="font-semibold">{vector.qdrantPoints}</dd></div>
                            <div className="flex justify-between"><dt className="text-slate-500">Reports in MySQL</dt><dd className="font-semibold">{vector.mysqlReports}</dd></div>
                            <div className="flex justify-between"><dt className="text-slate-500">Synchronised</dt>
                                <dd className={vector.inSync ? "font-semibold text-emerald-700" : "font-semibold text-rose-700"}>{vector.inSync ? "Yes" : "No"}</dd></div>
                        </dl>
                    )}
                    <Button variant="secondary" className="mt-4 w-full" onClick={reindex} disabled={reindexing}>
                        {reindexing ? "Rebuilding…" : "Rebuild index from MySQL"}
                    </Button>
                    {reindexResult && <p className="mt-2 text-xs text-emerald-700">{reindexResult}</p>}
                </Card>
            </div>

            <Card className="mt-6 overflow-x-auto">
                <h2 className="font-semibold text-slate-900">Users</h2>
                <table className="mt-3 w-full text-left text-sm">
                    <thead className="text-xs uppercase tracking-wide text-slate-500">
                        <tr><th className="py-2">ID</th><th className="py-2">Name</th><th className="py-2">Email</th><th className="py-2">Role</th><th className="py-2 text-right">Reports</th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {(students || []).map((student) => (
                            <tr key={student.Student_ID}>
                                <td className="py-2 text-slate-500">{student.Student_ID}</td>
                                <td className="py-2 font-medium text-slate-900">{student.Name}</td>
                                <td className="py-2 text-slate-600">{student.Email}</td>
                                <td className="py-2"><Badge value={student.Role} /></td>
                                <td className="py-2 text-right tabular-nums">{student.Report_Count}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </Card>
        </>
    );
}

export default function AdminPage() {
    return <RequireAuth role="ADMIN"><AdminDashboard /></RequireAuth>;
}
