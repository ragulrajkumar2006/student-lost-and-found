export function formatDate(value) {
    if (!value) return "—";
    // Dates arrive as 'YYYY-MM-DD'; parse as local date to avoid timezone shifts
    const [year, month, day] = String(value).slice(0, 10).split("-").map(Number);
    return new Date(year, month - 1, day).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric"
    });
}

export function todayString() {
    return new Date().toLocaleDateString("en-CA");
}

// Cosine similarity (0..1) shown as a whole-number percentage for display
export function similarityPercent(score) {
    return Math.round(Math.max(0, Math.min(1, score)) * 100);
}

export function similarityLabel(score) {
    if (score >= 0.7) return "Strong match";
    if (score >= 0.5) return "Good match";
    return "Possible match";
}
