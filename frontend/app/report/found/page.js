"use client";

import RequireAuth from "@/components/RequireAuth";
import ReportForm from "@/components/ReportForm";

export default function ReportFoundPage() {
    return <RequireAuth><ReportForm type="FOUND" /></RequireAuth>;
}
