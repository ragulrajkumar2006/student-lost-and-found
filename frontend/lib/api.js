// Small wrapper around fetch() for calling the Express backend.
// Adds the JWT from localStorage and turns API errors into thrown Errors.

export const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5001";

const TOKEN_KEY = "lf_token";
const USER_KEY = "lf_user";

export function getStoredSession() {
    try {
        const token = localStorage.getItem(TOKEN_KEY);
        const user = JSON.parse(localStorage.getItem(USER_KEY) || "null");
        return token && user ? { token, user } : null;
    } catch {
        return null;
    }
}

export function storeSession(token, user) {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearSession() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
}

export async function api(path, { method = "GET", body } = {}) {
    const session = typeof window !== "undefined" ? getStoredSession() : null;

    let response;
    try {
        response = await fetch(`${API_URL}${path}`, {
            method,
            headers: {
                "Content-Type": "application/json",
                ...(session && { Authorization: `Bearer ${session.token}` })
            },
            body: body ? JSON.stringify(body) : undefined
        });
    } catch {
        throw new Error("Cannot reach the server. Is the backend running on port 5001?");
    }

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
        // Token expired or invalid -> let the AuthProvider log the user out
        if (response.status === 401 && session) {
            window.dispatchEvent(new Event("auth:expired"));
        }
        const error = new Error(data.error || `Request failed (${response.status})`);
        error.status = response.status;
        error.details = data.details || [];
        throw error;
    }

    return data;
}
