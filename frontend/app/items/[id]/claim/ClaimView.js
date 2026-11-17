"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/format";
import RequireAuth from "@/components/RequireAuth";
import { Alert, Badge, Button, Card, ErrorAlert, Field, inputClass, PageHeader, Spinner } from "@/components/ui";

function Claim() {
    const { id } = useParams();
    const router = useRouter();
    const [report, setReport] = useState(null);
    const [loadError, setLoadError] = useState(null);
    const [remarks, setRemarks] = useState("");
    const [error, setError] = useState(null);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        api(`/api/reports/${id}`).then((data) => setReport(data.report)).catch(setLoadError);
    }, [id]);

    async function handleSubmit(event) {
        event.preventDefault();
        setSubmitting(true);
        setError(null);
        try {
            await api("/api/claims", { method: "POST", body: { reportId: Number(id), remarks } });
            router.push("/my-claims?submitted=1");
        } catch (err) {
            setError(err);
            setSubmitting(false);
        }
    }

    if (loadError) return <ErrorAlert error={loadError} />;
    if (!report) return <Spinner />;

    return (
        <div className="max-w-2xl">
            <Link href={`/items/${report.Report_ID}`} className="text-sm text-slate-500 hover:text-slate-800">← Back to item</Link>
            <div className="mt-4">
                <PageHeader title="Claim this item" subtitle="Tell the administrator why this item belongs to you." />
            </div>

            <Card className="mb-6">
                <div className="flex items-center gap-2"><Badge value={report.Report_Type} /><Badge value={report.Status} /></div>
                <p className="mt-2 font-semibold text-slate-900">{report.Item_Name}</p>
                <p className="text-sm text-slate-600">{report.Description}</p>
                <p className="mt-2 text-xs text-slate-500">📍 {report.Location} · 📅 {formatDate(report.Date_Reported)}</p>
            </Card>

            <Card>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <ErrorAlert error={error} />
                    <Field label="Proof of ownership"
                        hint="Mention something only the owner would know: contents, marks, serial number, where exactly you lost it.">
                        <textarea className={`${inputClass} min-h-32`} value={remarks} required minLength={10} maxLength={255}
                            onChange={(event) => setRemarks(event.target.value)}
                            placeholder="e.g. The wallet has my college ID and a metro card inside, and a small tear on the left corner." />
                    </Field>
                    <Alert type="info">An administrator will verify your claim. You will see the decision under “My claims”.</Alert>
                    <Button type="submit" variant="success" disabled={submitting}>
                        {submitting ? "Submitting…" : "Submit claim"}
                    </Button>
                </form>
            </Card>
        </div>
    );
}

export default function ClaimView() {
    return <RequireAuth><Claim /></RequireAuth>;
}
