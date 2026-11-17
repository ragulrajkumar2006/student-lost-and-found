import Link from "next/link";
import { Badge } from "./ui";
import { formatDate, similarityLabel, similarityPercent } from "@/lib/format";

// One item report as a clickable card. If `report.Similarity` is present
// (semantic search / matching), a similarity bar is shown as well.
export default function ReportCard({ report }) {
    const hasScore = typeof report.Similarity === "number";

    return (
        <Link href={`/items/${report.Report_ID}`}
            className="group flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-indigo-300 hover:shadow-md">
            <div className="flex items-center gap-2">
                <Badge value={report.Report_Type} />
                <Badge value={report.Status} />
                <span className="ml-auto text-xs text-slate-400">#{report.Report_ID}</span>
            </div>

            <h3 className="mt-3 font-semibold text-slate-900 group-hover:text-indigo-700">{report.Item_Name}</h3>
            <p className="mt-1 line-clamp-2 text-sm text-slate-600">{report.Description}</p>

            <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                <span>📍 {report.Location}</span>
                <span>📅 {formatDate(report.Date_Reported)}</span>
                {report.Reported_By && <span>👤 {report.Reported_By}</span>}
            </div>

            {hasScore && (
                <div className="mt-4">
                    <div className="flex justify-between text-xs">
                        <span className="font-medium text-indigo-700">{similarityLabel(report.Similarity)}</span>
                        <span className="tabular-nums text-slate-500">similarity {report.Similarity.toFixed(2)}</span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
                        <div className="h-full rounded-full bg-indigo-500"
                            style={{ width: `${similarityPercent(report.Similarity)}%` }} />
                    </div>
                </div>
            )}
        </Link>
    );
}
