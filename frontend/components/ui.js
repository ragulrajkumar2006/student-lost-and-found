// Small presentational building blocks shared by every page.

export function PageHeader({ title, subtitle, action }) {
    return (
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
                <h1 className="text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
                {subtitle && <p className="mt-1 text-sm text-slate-600">{subtitle}</p>}
            </div>
            {action}
        </div>
    );
}

export function Card({ className = "", children }) {
    return (
        <div className={`rounded-2xl border border-slate-200 bg-white p-5 shadow-sm ${className}`}>
            {children}
        </div>
    );
}

const BUTTON_STYLES = {
    primary: "bg-indigo-600 text-white hover:bg-indigo-700 disabled:bg-indigo-300",
    secondary: "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:text-slate-400",
    success: "bg-emerald-600 text-white hover:bg-emerald-700 disabled:bg-emerald-300",
    danger: "bg-rose-600 text-white hover:bg-rose-700 disabled:bg-rose-300",
    ghost: "text-slate-600 hover:bg-slate-100"
};

export function Button({ variant = "primary", className = "", ...props }) {
    return (
        <button
            className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed ${BUTTON_STYLES[variant]} ${className}`}
            {...props}
        />
    );
}

export function Field({ label, hint, children }) {
    return (
        <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>
            {children}
            {hint && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
        </label>
    );
}

export const inputClass =
    "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100";

export function Alert({ type = "error", children }) {
    if (!children) return null;
    const styles = {
        error: "border-rose-200 bg-rose-50 text-rose-800",
        success: "border-emerald-200 bg-emerald-50 text-emerald-800",
        info: "border-indigo-200 bg-indigo-50 text-indigo-800"
    };
    return <div className={`rounded-lg border px-4 py-3 text-sm ${styles[type]}`}>{children}</div>;
}

// Shows an API error, including the list of validation problems if present
export function ErrorAlert({ error }) {
    if (!error) return null;
    return (
        <Alert type="error">
            <p className="font-medium">{error.message}</p>
            {error.details?.length > 0 && (
                <ul className="mt-1 list-inside list-disc">
                    {error.details.map((detail) => <li key={detail}>{detail}</li>)}
                </ul>
            )}
        </Alert>
    );
}

export function Spinner({ label = "Loading…" }) {
    return (
        <div className="flex items-center justify-center gap-3 py-16 text-sm text-slate-500">
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-indigo-600" />
            {label}
        </div>
    );
}

export function EmptyState({ title, message, action }) {
    return (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
            <p className="font-medium text-slate-800">{title}</p>
            {message && <p className="mt-1 text-sm text-slate-500">{message}</p>}
            {action && <div className="mt-4">{action}</div>}
        </div>
    );
}

const BADGE_STYLES = {
    LOST: "bg-amber-100 text-amber-800 ring-amber-200",
    FOUND: "bg-emerald-100 text-emerald-800 ring-emerald-200",
    OPEN: "bg-sky-100 text-sky-800 ring-sky-200",
    MATCHED: "bg-violet-100 text-violet-800 ring-violet-200",
    CLOSED: "bg-slate-200 text-slate-700 ring-slate-300",
    PENDING: "bg-amber-100 text-amber-800 ring-amber-200",
    APPROVED: "bg-emerald-100 text-emerald-800 ring-emerald-200",
    REJECTED: "bg-rose-100 text-rose-800 ring-rose-200",
    ADMIN: "bg-indigo-100 text-indigo-800 ring-indigo-200",
    STUDENT: "bg-slate-100 text-slate-700 ring-slate-200"
};

export function Badge({ value }) {
    return (
        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${BADGE_STYLES[value] || BADGE_STYLES.STUDENT}`}>
            {value}
        </span>
    );
}

export function StatTile({ label, value, tone = "slate" }) {
    const tones = {
        slate: "text-slate-900",
        amber: "text-amber-700",
        emerald: "text-emerald-700",
        indigo: "text-indigo-700",
        violet: "text-violet-700"
    };
    return (
        <Card>
            <p className="text-sm text-slate-500">{label}</p>
            <p className={`mt-1 text-3xl font-bold tabular-nums ${tones[tone]}`}>{value ?? "—"}</p>
        </Card>
    );
}
