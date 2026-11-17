"use client";

import { useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { todayString } from "@/lib/format";
import { Alert, Button, Card, ErrorAlert, Field, inputClass, PageHeader } from "./ui";
import MatchList from "./MatchList";

const COPY = {
    LOST: {
        title: "Report a lost item",
        subtitle: "Describe what you lost. We will instantly look for similar items that others have found.",
        namePlaceholder: "e.g. Black leather wallet",
        descriptionPlaceholder: "Colour, brand, size, anything inside it, stickers or marks…",
        locationLabel: "Where did you lose it?",
        dateLabel: "When did you lose it?"
    },
    FOUND: {
        title: "Report a found item",
        subtitle: "Thank you for helping! Describe what you found and we will look for students who reported losing it.",
        namePlaceholder: "e.g. Blue water bottle",
        descriptionPlaceholder: "Describe it without revealing every detail, so the owner can prove it is theirs.",
        locationLabel: "Where did you find it?",
        dateLabel: "When did you find it?"
    }
};

const LOCATIONS = [
    "Library", "Canteen", "Classroom", "Computer Lab 3", "Exam Hall B",
    "Auditorium", "Main Gate", "Hostel", "Sports Ground", "Parking Lot"
];

export default function ReportForm({ type }) {
    const copy = COPY[type];
    const [form, setForm] = useState({
        itemName: "",
        description: "",
        location: "",
        dateReported: todayString()
    });
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState(null);
    const [result, setResult] = useState(null);

    const update = (field) => (event) => setForm({ ...form, [field]: event.target.value });

    async function handleSubmit(event) {
        event.preventDefault();
        setSubmitting(true);
        setError(null);
        try {
            const data = await api("/api/reports", { method: "POST", body: { ...form, reportType: type } });
            setResult(data);
        } catch (err) {
            setError(err);
        } finally {
            setSubmitting(false);
        }
    }

    if (result) {
        const opposite = type === "LOST" ? "found" : "lost";
        return (
            <div className="space-y-6">
                <Alert type="success">
                    <p className="font-medium">
                        Your {type.toLowerCase()} report “{result.report.Item_Name}” was saved (Report #{result.report.Report_ID}).
                    </p>
                    {result.vectorSync !== "synced" && (
                        <p className="mt-1">Smart matching is temporarily unavailable; your report is safe and will be matched later.</p>
                    )}
                </Alert>

                <div>
                    <h2 className="text-lg font-semibold text-slate-900">Possible matches</h2>
                    <p className="mb-4 text-sm text-slate-600">
                        {opposite[0].toUpperCase() + opposite.slice(1)} items whose descriptions are closest in meaning to yours.
                    </p>
                    <MatchList matches={result.matches} reportType={type} />
                </div>

                <div className="flex flex-wrap gap-3">
                    <Link href={`/items/${result.report.Report_ID}`}><Button>View my report</Button></Link>
                    <Link href="/my-reports"><Button variant="secondary">All my reports</Button></Link>
                    <Button variant="ghost" onClick={() => {
                        setResult(null);
                        setForm({ itemName: "", description: "", location: "", dateReported: todayString() });
                    }}>
                        Report another item
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <>
            <PageHeader title={copy.title} subtitle={copy.subtitle} />
            <Card className="max-w-2xl">
                <form onSubmit={handleSubmit} className="space-y-5">
                    <ErrorAlert error={error} />

                    <Field label="Item name">
                        <input className={inputClass} value={form.itemName} onChange={update("itemName")}
                            placeholder={copy.namePlaceholder} maxLength={100} required />
                    </Field>

                    <Field label="Description" hint="The more detail you give, the better the automatic matching works.">
                        <textarea className={`${inputClass} min-h-28`} value={form.description} onChange={update("description")}
                            placeholder={copy.descriptionPlaceholder} maxLength={1000} required />
                    </Field>

                    <div className="grid gap-5 sm:grid-cols-2">
                        <Field label={copy.locationLabel}>
                            <input className={inputClass} value={form.location} onChange={update("location")}
                                list="campus-locations" placeholder="e.g. Library" maxLength={150} required />
                            <datalist id="campus-locations">
                                {LOCATIONS.map((location) => <option key={location} value={location} />)}
                            </datalist>
                        </Field>

                        <Field label={copy.dateLabel}>
                            <input type="date" className={inputClass} value={form.dateReported}
                                onChange={update("dateReported")} max={todayString()} required />
                        </Field>
                    </div>

                    <Button type="submit" disabled={submitting} className="w-full sm:w-auto"
                        variant={type === "FOUND" ? "success" : "primary"}>
                        {submitting ? "Saving and finding matches…" : `Submit ${type.toLowerCase()} report`}
                    </Button>
                </form>
            </Card>
        </>
    );
}
