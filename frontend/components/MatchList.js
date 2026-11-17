import ReportCard from "./ReportCard";
import { EmptyState } from "./ui";

// Suggested LOST <-> FOUND matches returned by the backend (Qdrant similarity).
export default function MatchList({ matches, reportType }) {
    const opposite = reportType === "LOST" ? "found" : "lost";

    if (!matches || matches.length === 0) {
        return (
            <EmptyState
                title={`No similar ${opposite} items yet`}
                message={`We compare descriptions by meaning, not just keywords. As soon as a similar ${opposite} item is reported it will appear here.`}
            />
        );
    }

    return (
        <div className="grid gap-4 sm:grid-cols-2">
            {matches.map((match) => <ReportCard key={match.Report_ID} report={match} />)}
        </div>
    );
}
