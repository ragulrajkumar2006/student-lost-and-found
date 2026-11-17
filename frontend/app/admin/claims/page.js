"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { formatDate, todayString } from "@/lib/format";
import RequireAuth from "@/components/RequireAuth";
import { Alert, Badge, Button, EmptyState, ErrorAlert, inputClass, PageHeader, Spinner } from "@/components/ui";

const FILTERS = ["PENDING", "APPROVED", "REJECTED", ""];

function ClaimRow({ claim, onDone }) {
    const [mode, setMode] = useState(null); // "reject" | "return" | null
    const [text, setText] = useState("");
    const [date, setDate] = useState(todayString());
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);

    async function run(request) {
        setBusy(true);
        setError(null);
        try {
            await request();
            setMode(null);
            setText("");
            onDone();
        } catch (err) {
            setError(err);
        } finally {
            setBusy(false);
        }
    }

    const approve = () => run(() => api(`/api/claims/${claim.Claim_ID}/approve`, {
        method: "PATCH", body: { remarks: text || undefined }
    }));
    const reject = () => run(() => api(`/api/claims/${claim.Claim_ID}/reject`, {
        method: "PATCH", body: { remarks: text }
    }));
    const recordReturn = () => run(() => api("/api/returns", {
        method: "POST", body: { claimId: claim.Claim_ID, returnedDate: date, remarks: text || undefined }
    }));

    return (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs text-slate-400">Claim #{claim.Claim_ID}</span>
                        <Badge value={claim.Claim_Status} />
                        {claim.Return_ID && <Badge value="CLOSED" />}
                    </div>
                    <p className="mt-2 text-slate-900">
                        <span className="font-semibold">{claim.Claimant_Name}</span>
                        <span className="text-slate-500"> claims </span>
                        <Link href={`/items/${claim.Report_ID}`} className="font-semibold text-indigo-700 hover:underline">{claim.Item_Name}</Link>
                        <span className="text-slate-500"> (found by {claim.Finder_Name} at {claim.Location})</span>
                    </p>
                    <p className="mt-1 rounded-lg bg-slate-50 p-3 text-sm text-slate-700">“{claim.Claim_Remarks}”</p>
                    <p className="mt-2 text-xs text-slate-500">
                        Claimed {formatDate(claim.Claim_Date)} · {claim.Claimant_Email}
                        {claim.Returned_Date && <span className="text-emerald-700"> · Returned {formatDate(claim.Returned_Date)}</span>}
                    </p>
                </div>

                <div className="flex flex-wrap gap-2 sm:flex-col">
                    {claim.Claim_Status === "PENDING" && !mode && (
                        <>
                            <Button variant="success" onClick={approve} disabled={busy}>Approve</Button>
                            <Button variant="secondary" onClick={() => setMode("reject")}>Reject…</Button>
                        </>
                    )}
                    {claim.Claim_Status === "APPROVED" && !claim.Return_ID && !mode && (
                        <Button onClick={() => setMode("return")}>Record return…</Button>
                    )}
                </div>
            </div>

            {mode && (
                <div className="mt-4 space-y-3 border-t border-slate-100 pt-4">
                    <ErrorAlert error={error} />
                    {mode === "return" && (
                        <input type="date" className={`${inputClass} sm:w-48`} value={date} max={todayString()}
                            onChange={(event) => setDate(event.target.value)} />
                    )}
                    <input className={inputClass} value={text} onChange={(event) => setText(event.target.value)}
                        placeholder={mode === "reject" ? "Reason for rejection (required)" : "Remarks, e.g. collected from admin office"} />
                    <div className="flex gap-2">
                        {mode === "reject"
                            ? <Button variant="danger" onClick={reject} disabled={busy || text.trim().length < 3}>Confirm rejection</Button>
                            : <Button variant="success" onClick={recordReturn} disabled={busy}>Confirm hand-over</Button>}
                        <Button variant="ghost" onClick={() => { setMode(null); setError(null); }}>Cancel</Button>
                    </div>
                </div>
            )}
            {!mode && <div className="mt-3"><ErrorAlert error={error} /></div>}
        </div>
    );
}

function ManageClaims() {
    const [filter, setFilter] = useState("PENDING");
    const [claims, setClaims] = useState(null);
    const [error, setError] = useState(null);

    const load = useCallback(() => {
        setError(null);
        api(`/api/claims${filter ? `?status=${filter}` : ""}`).then((data) => setClaims(data.claims)).catch(setError);
    }, [filter]);

    useEffect(() => { load(); }, [load]);

    return (
        <>
            <PageHeader title="Manage claims"
                subtitle="Approve genuine owners, reject others, and record the hand-over when the item is collected." />

            <div className="mb-4 inline-flex rounded-lg bg-slate-200/60 p-1">
                {FILTERS.map((value) => (
                    <button key={value || "ALL"} onClick={() => setFilter(value)}
                        className={`rounded-md px-3 py-1.5 text-sm font-medium ${filter === value ? "bg-white text-slate-900 shadow-sm" : "text-slate-600"}`}>
                        {value ? value[0] + value.slice(1).toLowerCase() : "All"}
                    </button>
                ))}
            </div>

            <div className="mb-4">
                <Alert type="info">
                    Approving a claim marks the item <strong>MATCHED</strong> and automatically rejects other pending claims for it
                    (stored procedure <code>ApproveClaim</code>). Recording the return marks it <strong>CLOSED</strong> (trigger).
                </Alert>
            </div>

            <ErrorAlert error={error} />
            {!claims && !error && <Spinner />}
            {claims && claims.length === 0 && <EmptyState title="Nothing here" message="No claims match this filter." />}
            <div className="space-y-4">
                {claims && claims.map((claim) => <ClaimRow key={claim.Claim_ID} claim={claim} onDone={load} />)}
            </div>
        </>
    );
}

export default function AdminClaimsPage() {
    return <RequireAuth role="ADMIN"><ManageClaims /></RequireAuth>;
}
