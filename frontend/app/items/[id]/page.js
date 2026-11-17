import { Suspense } from "react";
import { Spinner } from "@/components/ui";
import ItemDetails from "./ItemDetails";

// The [id] param is only known at request time, so the client component that
// reads it (useParams) is wrapped in Suspense, as Next.js Cache Components require.
export default function ItemPage() {
    return (
        <Suspense fallback={<Spinner />}>
            <ItemDetails />
        </Suspense>
    );
}
