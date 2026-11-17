"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { formatDate, todayString } from "@/lib/format";
import { useAuth } from "@/components/AuthProvider";
import RequireAuth from "@/components/RequireAuth";
import MatchList from "@/components/MatchList";
import { Alert, Badge, Button, Card, ErrorAlert, Field, inputClass, Spinner } from "@/components/ui";

function EditForm({ report, onSaved, onCancel }) {
    const [form, setForm] = useState({
        itemName: report.Item_Name,
        description: report.Description,
        location: report.Location,
        dateReported: report.Date_Reported
    });
    const [error, setError] = useState(null);
    const [saving, setSaving] = useState(false);
    const update = (field) => (event) => setForm({ ...form, [field]: event.target.value });

    async function save(event) {
        event.preventDefault();
        setSaving(true);
        setError(null);
        try {
            await api(`/api/reports/${report.Report_ID}`, { method: "PUT", body: form });
            onSaved();
        } catch (err) {
            setError(err);
            setSaving(false);
        }
    }

    return (
        <form onSubmit={save} className="space-y-4">
            <ErrorAlert error={error} />
            <Field label="Item name"><input className={inputClass} value={form.itemName} onChange={update("itemName")} required /></Field>
            <Field label="Description"><textarea className={`${inputClass} min-h-24`} value={form.description} onChange={update("description")} required /></Field>
            <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Location"><input className={inputClass} value={form.location} onChange={update("location")} required /></Field>
                <Field label="Date"><input type="date" className={inputClass} value={form.dateReported} max={todayString()} onChange={update("dateReported")} required /></Field>
            </div>
            <div className="flex gap-2">
                <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save changes"}</Button>
                <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>
            </div>
            <p className="text-xs text-slate-500">Changing the name or description re-generates its AI embedding in Qdrant.</p>
        </form>
    );
}

function Details() {
    const { id } = useParams();
    const router = useRouter();
    const { user, isAdmin } = useAuth();
    const [data, setData] = useState(null);
    const [matches, setMatches] = useState(null);
    const [error, setError] = useState(null);
    const [actionError, setActionError] = useState(null);
    const [editing, setEditing] = useState(false);
    const [notice, setNotice] = useState(null);

    const load = useCallback(() => {
        api(`/api/reports/${id}`).then(setData).catch(setError);
        api(`/api/reports/${id}/matches`).then((res) => setMatches(res.matches)).catch(() => setMatches([]));
    }, [id]);

    useEffect(() => { load(); }, [load]);

    if (error) return <ErrorAlert error={error} />;
    if (!data) return <Spinner />;

    const { report, claims, myClaim } = data;
    const isOwner = report.Student_ID === user.Student_ID;
    const canClaim = report.Report_Type === "FOUND" && !isOwner && !isAdmin && report.Status !== "CLOSED" && !myClaim;
    const canEdit = (isOwner && report.Status === "OPEN") || isAdmin;

    async function closeReport() {
        setActionError(null);
        try {
            await api(`/api/reports/${report.Report_ID}`, { method: "PUT", body: { status: "CLOSED" } });
            setNotice("Report marked as closed.");
            load();
        } catch (err) {
            setActionError(err);
        }
    }

    async function deleteReport() {
        if (!window.confirm("Delete this report permanently? This also removes it from smart search.")) return;
        setActionError(null);
        try {
            await api(`/api/reports/${report.Report_ID}`, { method: "DELETE" });
            router.push(isAdmin ? "/items" : "/my-reports");
        } catch (err) {
            setActionError(err);
        }
    }

    return (
        <div className="space-y-8">
            <Link href="/items" className="text-sm text-slate-500 hover:text-slate-800">← Back to all items</Link>

            <Card className="p-6">
                <div className="flex flex-wrap items-center gap-2">
                    <Badge value={report.Report_Type} />
                    <Badge value={report.Status} />
                    <span className="ml-auto text-sm text-slate-400">Report #{report.Report_ID}</span>
                </div>

                {editing ? (
                    <div className="mt-4">
                        <EditForm report={report} onCancel={() => setEditing(false)}
                            onSaved={() => { setEditing(false); setNotice("Report updated."); load(); }} />
                    </div>
                ) : (
                    <>
                        <h1 className="mt-4 text-2xl font-bold text-slate-900">{report.Item_Name}</h1>
                        <p className="mt-2 whitespace-pre-line text-slate-700">{report.Description}</p>
                        <dl className="mt-6 grid gap-4 text-sm sm:grid-cols-3">
                            <div><dt className="text-slate-500">Location</dt><dd className="font-medium text-slate-900">{report.Location}</dd></div>
                            <div><dt className="text-slate-500">Date</dt><dd className="font-medium text-slate-900">{formatDate(report.Date_Reported)}</dd></div>
                            <div><dt className="text-slate-500">Reported by</dt><dd className="font-medium text-slate-900">{isOwner ? "You" : report.Reported_By}</dd></div>
                        </dl>
                    </>
                )}

                <div className="mt-6 space-y-3">
                    {notice && <Alert type="success">{notice}</Alert>}
                    <ErrorAlert error={actionError} />

                    {myClaim && (
                        <Alert type="info">
                            You claimed this item on {formatDate(myClaim.Claim_Date)} — status: <strong>{myClaim.Claim_Status}</strong>.
                        </Alert>
                    )}

                    {!editing && (
                        <div className="flex flex-wrap gap-2">
                            {canClaim && (
                                <Link href={`/items/${report.Report_ID}/claim`}><Button variant="success">This is mine — claim it</Button></Link>
                            )}
                            <Link href={`/items/${report.Report_ID}/matches`}><Button variant="secondary">View matching suggestions</Button></Link>
                            {canEdit && <Button variant="secondary" onClick={() => setEditing(true)}>Edit</Button>}
                            {isOwner && report.Status !== "CLOSED" && (
                                <Button variant="secondary" onClick={closeReport}>
                                    {report.Report_Type === "LOST" ? "I got it back — close" : "Mark as closed"}
                                </Button>
                            )}
                            {(isOwner || isAdmin) && <Button variant="danger" onClick={deleteReport}>Delete</Button>}
                        </div>
                    )}
                </div>
            </Card>

            {claims && (
                <section>
                    <h2 className="text-lg font-semibold text-slate-900">Claims on this item</h2>
                    {claims.length === 0 ? (
                        <p className="mt-2 text-sm text-slate-500">Nobody has claimed this item yet.</p>
                    ) : (
                        <ul className="mt-3 divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white">
                            {claims.map((claim) => (
                                <li key={claim.Claim_ID} className="flex flex-col gap-1 p-4 sm:flex-row sm:items-center sm:gap-4">
                                    <div className="flex-1">
                                        <p className="font-medium text-slate-900">{claim.Claimant_Name}</p>
                                        <p className="text-sm text-slate-600">{claim.Remarks}</p>
                                    </div>
                                    <span className="text-xs text-slate-500">{formatDate(claim.Claim_Date)}</span>
                                    <Badge value={claim.Claim_Status} />
                                </li>
                            ))}
                        </ul>
                    )}
                </section>
            )}

            {report.Status !== "CLOSED" && (
                <section>
                    <div className="flex items-end justify-between">
                        <div>
                            <h2 className="text-lg font-semibold text-slate-900">
                                Similar {report.Report_Type === "LOST" ? "found" : "lost"} items
                            </h2>
                            <p className="text-sm text-slate-600">Found by comparing description meaning with AI embeddings.</p>
                        </div>
                    </div>
                    <div className="mt-4">
                        {matches === null ? <Spinner label="Finding matches…" /> : <MatchList matches={matches.slice(0, 4)} reportType={report.Report_Type} />}
                    </div>
                </section>
            )}
        </div>
    );
}

export default function ItemDetails() {
    return <RequireAuth><Details /></RequireAuth>;
}
