"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/format";
import RequireAuth from "@/components/RequireAuth";
import { Alert, Badge, Button, EmptyState, ErrorAlert, PageHeader, Spinner } from "@/components/ui";

function MyClaims() {
    const [claims, setClaims] = useState(null);
    const [error, setError] = useState(null);
    const [justSubmitted, setJustSubmitted] = useState(false);

    const load = useCallback(() => {
        api("/api/claims/mine").then((data) => setClaims(data.claims)).catch(setError);
    }, []);

    useEffect(() => {
        load();
        // Read the flag from the URL in the browser (avoids a Suspense boundary for useSearchParams)
        setJustSubmitted(new URLSearchParams(window.location.search).has("submitted"));
    }, [load]);

    async function withdraw(claimId) {
        if (!window.confirm("Withdraw this claim?")) return;
        try {
            await api(`/api/claims/${claimId}`, { method: "DELETE" });
            load();
        } catch (err) {
            setError(err);
        }
    }

    if (!claims && !error) return <Spinner />;

    return (
        <>
            <PageHeader title="My claims" subtitle="Items you said belong to you, and what the administrator decided." />
            <div className="space-y-4">
                {justSubmitted && <Alert type="success">Your claim was submitted and is waiting for an administrator.</Alert>}
                <ErrorAlert error={error} />

                {claims && claims.length === 0 && (
                    <EmptyState title="No claims yet" message="When you find your item under Browse, open it and press “This is mine”."
                        action={<Link href="/items"><Button>Browse found items</Button></Link>} />
                )}

                {claims && claims.map((claim) => (
                    <div key={claim.Claim_ID} className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center">
                        <div className="flex-1">
                            <div className="flex items-center gap-2">
                                <Link href={`/items/${claim.Report_ID}`} className="font-semibold text-slate-900 hover:text-indigo-700">
                                    {claim.Item_Name}
                                </Link>
                                <Badge value={claim.Claim_Status} />
                            </div>
                            <p className="mt-1 text-sm text-slate-600">{claim.Remarks}</p>
                            <p className="mt-1 text-xs text-slate-500">
                                Claimed {formatDate(claim.Claim_Date)} · 📍 {claim.Location}
                                {claim.Returned_Date && <span className="font-medium text-emerald-700"> · Returned to you on {formatDate(claim.Returned_Date)}</span>}
                            </p>
                        </div>
                        {claim.Claim_Status === "APPROVED" && !claim.Returned_Date && (
                            <span className="text-sm text-emerald-700">Approved — collect it from the admin office</span>
                        )}
                        {claim.Claim_Status === "PENDING" && (
                            <Button variant="secondary" onClick={() => withdraw(claim.Claim_ID)}>Withdraw</Button>
                        )}
                    </div>
                ))}
            </div>
        </>
    );
}

export default function MyClaimsPage() {
    return <RequireAuth><MyClaims /></RequireAuth>;
}
