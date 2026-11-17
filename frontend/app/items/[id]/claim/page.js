import { Suspense } from "react";
import { Spinner } from "@/components/ui";
import ClaimView from "./ClaimView";

export default function ClaimPage() {
    return (
        <Suspense fallback={<Spinner />}>
            <ClaimView />
        </Suspense>
    );
}
