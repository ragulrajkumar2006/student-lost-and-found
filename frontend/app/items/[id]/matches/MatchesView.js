"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import RequireAuth from "@/components/RequireAuth";
import MatchList from "@/components/MatchList";
import { Alert, Badge, Card, ErrorAlert, PageHeader, Spinner } from "@/components/ui";

function Matches() {
    const { id } = useParams();
    const [data, setData] = useState(null);
    const [error, setError] = useState(null);

    useEffect(() => {
        api(`/api/reports/${id}/matches`).then(setData).catch(setError);
    }, [id]);

    if (error) return <ErrorAlert error={error} />;
    if (!data) return <Spinner label="Comparing with every report…" />;

    const { report, matches, threshold } = data;
    const opposite = report.Report_Type === "LOST" ? "FOUND" : "LOST";

    return (
        <>
            <Link href={`/items/${report.Report_ID}`} className="text-sm text-slate-500 hover:text-slate-800">
                ← Back to report
            </Link>
            <div className="mt-4">
                <PageHeader title="Matching suggestions"
                    subtitle={`${opposite} reports whose descriptions are closest in meaning to this ${report.Report_Type.toLowerCase()} report.`} />
            </div>

            <Card className="mb-6">
                <div className="flex items-center gap-2">
                    <Badge value={report.Report_Type} />
                    <Badge value={report.Status} />
                </div>
                <p className="mt-2 font-semibold text-slate-900">{report.Item_Name}</p>
                <p className="text-sm text-slate-600">{report.Description}</p>
            </Card>

            <div className="mb-4">
                <Alert type="info">
                    Only <strong>OPEN {opposite}</strong> reports from other students are compared. The similarity score
                    (0 – 1) is the cosine similarity between the two description embeddings; results below {threshold} are hidden.
                    It measures closeness of meaning — it is not a probability.
                </Alert>
            </div>

            <MatchList matches={matches} reportType={report.Report_Type} />
        </>
    );
}

export default function MatchesView() {
    return <RequireAuth><Matches /></RequireAuth>;
}
