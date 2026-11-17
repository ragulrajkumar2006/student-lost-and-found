"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import RequireAuth from "@/components/RequireAuth";
import ReportCard from "@/components/ReportCard";
import { Alert, Button, EmptyState, ErrorAlert, inputClass, PageHeader, Spinner } from "@/components/ui";

const TYPE_TABS = [
    { value: "", label: "All" },
    { value: "LOST", label: "Lost" },
    { value: "FOUND", label: "Found" }
];

// Browse + search page.
//  - Keyword mode: SQL LIKE search in MySQL (exact words)
//  - Smart mode: semantic vector search in Qdrant (similar meaning)
function BrowseItems() {
    const [type, setType] = useState("");
    const [status, setStatus] = useState("");
    const [query, setQuery] = useState("");
    const [mode, setMode] = useState("keyword");
    const [results, setResults] = useState(null);
    const [searchedFor, setSearchedFor] = useState(null);
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(false);

    const runSearch = useCallback(async (searchText) => {
        setLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams();
            if (type) params.set("type", type);
            const text = searchText.trim();

            let data;
            if (mode === "semantic" && text) {
                params.set("q", text);
                data = await api(`/api/search/semantic?${params}`);
                setResults(data.results);
            } else {
                if (status) params.set("status", status);
                if (text) params.set("q", text);
                data = await api(`/api/reports?${params}`);
                setResults(data.reports);
            }
            setSearchedFor(text ? { text, mode: mode === "semantic" ? "semantic" : "keyword" } : null);
        } catch (err) {
            setError(err);
        } finally {
            setLoading(false);
        }
    }, [type, status, mode]);

    // Reload whenever a filter changes (the text box is applied on submit)
    useEffect(() => {
        runSearch(query);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [type, status, mode]);

    return (
        <>
            <PageHeader title="Browse items" subtitle="Everything reported as lost or found on campus." />

            <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <form onSubmit={(event) => { event.preventDefault(); runSearch(query); }}
                    className="flex flex-col gap-3 sm:flex-row">
                    <input className={inputClass} value={query} onChange={(event) => setQuery(event.target.value)}
                        placeholder={mode === "semantic"
                            ? "Describe the item in your own words, e.g. “dark purse near the reading area”"
                            : "Search by keyword, e.g. wallet, library"} />
                    <Button type="submit" className="sm:w-32">Search</Button>
                </form>

                <div className="flex flex-wrap items-center gap-3">
                    <div className="inline-flex rounded-lg bg-slate-100 p-1">
                        {TYPE_TABS.map((tab) => (
                            <button key={tab.value} onClick={() => setType(tab.value)}
                                className={`rounded-md px-3 py-1.5 text-sm font-medium ${type === tab.value ? "bg-white text-slate-900 shadow-sm" : "text-slate-600"}`}>
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    <div className="inline-flex rounded-lg bg-slate-100 p-1">
                        {[{ value: "keyword", label: "Keyword" }, { value: "semantic", label: "✨ Smart (AI)" }].map((option) => (
                            <button key={option.value} onClick={() => setMode(option.value)}
                                className={`rounded-md px-3 py-1.5 text-sm font-medium ${mode === option.value ? "bg-white text-indigo-700 shadow-sm" : "text-slate-600"}`}>
                                {option.label}
                            </button>
                        ))}
                    </div>

                    {mode === "keyword" && (
                        <select value={status} onChange={(event) => setStatus(event.target.value)}
                            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700">
                            <option value="">Any status</option>
                            <option value="OPEN">Open</option>
                            <option value="MATCHED">Matched</option>
                            <option value="CLOSED">Closed</option>
                        </select>
                    )}
                </div>

                {mode === "semantic" && (
                    <Alert type="info">
                        Smart search compares the <em>meaning</em> of your text with every report using AI embeddings,
                        so “charger” also finds “power adapter”. Returned items are hidden.
                    </Alert>
                )}
            </div>

            <div className="mt-6">
                <ErrorAlert error={error} />
                {loading && <Spinner label={mode === "semantic" ? "Comparing meanings…" : "Loading…"} />}
                {!loading && results && (
                    <>
                        <p className="mb-3 text-sm text-slate-500">
                            {results.length} result{results.length === 1 ? "" : "s"}
                            {searchedFor && <> for “{searchedFor.text}” ({searchedFor.mode} search)</>}
                        </p>
                        {results.length === 0 ? (
                            <EmptyState title="No items found"
                                message={mode === "keyword" ? "Try Smart (AI) search — it understands similar words." : "Try describing the item differently."} />
                        ) : (
                            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                                {results.map((report) => <ReportCard key={report.Report_ID} report={report} />)}
                            </div>
                        )}
                    </>
                )}
            </div>
        </>
    );
}

export default function ItemsPage() {
    return <RequireAuth><BrowseItems /></RequireAuth>;
}
