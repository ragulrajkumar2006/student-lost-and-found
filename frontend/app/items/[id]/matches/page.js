import { Suspense } from "react";
import { Spinner } from "@/components/ui";
import MatchesView from "./MatchesView";

export default function MatchesPage() {
    return (
        <Suspense fallback={<Spinner />}>
            <MatchesView />
        </Suspense>
    );
}
