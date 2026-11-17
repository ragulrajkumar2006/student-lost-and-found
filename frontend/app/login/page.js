"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useAuth } from "@/components/AuthProvider";
import { Button, Card, ErrorAlert, Field, inputClass } from "@/components/ui";

export default function LoginPage() {
    const router = useRouter();
    const { login } = useAuth();
    const [form, setForm] = useState({ email: "", password: "" });
    const [error, setError] = useState(null);
    const [submitting, setSubmitting] = useState(false);

    async function handleSubmit(event) {
        event.preventDefault();
        setSubmitting(true);
        setError(null);
        try {
            const data = await api("/api/auth/login", { method: "POST", body: form });
            login(data.token, data.user);
            router.push(data.user.Role === "ADMIN" ? "/admin" : "/dashboard");
        } catch (err) {
            setError(err);
            setSubmitting(false);
        }
    }

    return (
        <div className="mx-auto max-w-md">
            <Card className="p-8">
                <h1 className="text-2xl font-bold text-slate-900">Welcome back</h1>
                <p className="mt-1 text-sm text-slate-600">Log in with your college email.</p>

                <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                    <ErrorAlert error={error} />
                    <Field label="Email">
                        <input type="email" className={inputClass} value={form.email} autoComplete="email" required
                            onChange={(event) => setForm({ ...form, email: event.target.value })} />
                    </Field>
                    <Field label="Password">
                        <input type="password" className={inputClass} value={form.password} autoComplete="current-password" required
                            onChange={(event) => setForm({ ...form, password: event.target.value })} />
                    </Field>
                    <Button type="submit" disabled={submitting} className="w-full">
                        {submitting ? "Logging in…" : "Log in"}
                    </Button>
                </form>

                <p className="mt-6 text-center text-sm text-slate-600">
                    New here?{" "}
                    <Link href="/register" className="font-medium text-indigo-700 hover:underline">Create an account</Link>
                </p>
            </Card>

            <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4 text-xs text-slate-500">
                <p className="font-semibold text-slate-700">Demo accounts</p>
                <p className="mt-1">Student: arun@gmail.com / Student@123</p>
                <p>Admin: admin@college.edu / Admin@123</p>
            </div>
        </div>
    );
}
