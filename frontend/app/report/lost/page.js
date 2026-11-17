"use client";

import RequireAuth from "@/components/RequireAuth";
import ReportForm from "@/components/ReportForm";

export default function ReportLostPage() {
    return <RequireAuth><ReportForm type="LOST" /></RequireAuth>;
}
