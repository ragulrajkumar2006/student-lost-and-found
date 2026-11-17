"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useAuth } from "@/components/AuthProvider";
import { Button, Card, ErrorAlert, Field, inputClass } from "@/components/ui";

export default function RegisterPage() {
    const router = useRouter();
    const { login } = useAuth();
    const [form, setForm] = useState({ name: "", email: "", phone: "", password: "", confirm: "" });
    const [error, setError] = useState(null);
    const [submitting, setSubmitting] = useState(false);

    const update = (field) => (event) => setForm({ ...form, [field]: event.target.value });

    async function handleSubmit(event) {
        event.preventDefault();
        if (form.password !== form.confirm) {
            setError(new Error("Passwords do not match"));
            return;
        }
        setSubmitting(true);
        setError(null);
        try {
            const { confirm, ...body } = form;
            const data = await api("/api/auth/register", { method: "POST", body });
            login(data.token, data.user);
            router.push("/dashboard");
        } catch (err) {
            setError(err);
            setSubmitting(false);
        }
    }

    return (
        <div className="mx-auto max-w-md">
            <Card className="p-8">
                <h1 className="text-2xl font-bold text-slate-900">Create your account</h1>
                <p className="mt-1 text-sm text-slate-600">Students can report items and claim belongings.</p>

                <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                    <ErrorAlert error={error} />
                    <Field label="Full name">
                        <input className={inputClass} value={form.name} onChange={update("name")} autoComplete="name" required />
                    </Field>
                    <Field label="College email">
                        <input type="email" className={inputClass} value={form.email} onChange={update("email")} autoComplete="email" required />
                    </Field>
                    <Field label="Phone (optional)" hint="10 digits">
                        <input className={inputClass} value={form.phone} onChange={update("phone")} inputMode="numeric" maxLength={10} />
                    </Field>
                    <Field label="Password" hint="At least 8 characters with a letter and a number">
                        <input type="password" className={inputClass} value={form.password} onChange={update("password")}
                            autoComplete="new-password" required minLength={8} />
                    </Field>
                    <Field label="Confirm password">
                        <input type="password" className={inputClass} value={form.confirm} onChange={update("confirm")}
                            autoComplete="new-password" required />
                    </Field>
                    <Button type="submit" disabled={submitting} className="w-full">
                        {submitting ? "Creating account…" : "Register"}
                    </Button>
                </form>

                <p className="mt-6 text-center text-sm text-slate-600">
                    Already registered?{" "}
                    <Link href="/login" className="font-medium text-indigo-700 hover:underline">Log in</Link>
                </p>
            </Card>
        </div>
    );
}
