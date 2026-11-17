"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { clearSession, getStoredSession, storeSession } from "@/lib/api";

// Holds the logged-in user for the whole app.
// The JWT itself is kept in localStorage and sent by lib/api.js.
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const router = useRouter();
    const [user, setUser] = useState(null);
    const [ready, setReady] = useState(false);

    // localStorage only exists in the browser, so read it after mounting
    useEffect(() => {
        const session = getStoredSession();
        setUser(session ? session.user : null);
        setReady(true);
    }, []);

    const login = useCallback((token, newUser) => {
        storeSession(token, newUser);
        setUser(newUser);
    }, []);

    const logout = useCallback(() => {
        clearSession();
        setUser(null);
        router.push("/login");
    }, [router]);

    // lib/api.js fires this when the backend answers 401 (expired token)
    useEffect(() => {
        const onExpired = () => logout();
        window.addEventListener("auth:expired", onExpired);
        return () => window.removeEventListener("auth:expired", onExpired);
    }, [logout]);

    return (
        <AuthContext.Provider value={{ user, ready, login, logout, isAdmin: user?.Role === "ADMIN" }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    return useContext(AuthContext);
}
