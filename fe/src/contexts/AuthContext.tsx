import React, {
    createContext,
    useContext,
    useState,
    useEffect,
    useRef,
    ReactNode,
} from "react";
import { auth, signInWithGoogle } from "../firebase/config";
import { API_URL } from "../config/api";
import { clearApiCaches } from "../services/api";
import {
    User as FirebaseUser,
    onAuthStateChanged,
    signOut as firebaseSignOut,
} from "firebase/auth";

interface AppUser {
    uid: string;
    email: string | null;
    displayName: string;
    newUser: boolean;
    avatar?: string | null;
    photoURL?: string | null;
}

type BackendAppUser = Partial<AppUser> & {
    uid?: string;
    email?: string | null;
    displayName?: string | null;
    newUser?: boolean;
    avatar?: string | null;
    photoURL?: string | null;
};

type AuthContextType = {
    currentUser: AppUser | null;
    loading: boolean;
    signInWithGoogle: () => Promise<void>;
    logout: () => Promise<void>;
    isAuthenticated: boolean;
    updateUserStatus: (isNew: boolean) => void;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error("useAuth must be used within an AuthProvider");
    }
    return context;
}

type AuthProviderProps = {
    children: ReactNode;
};

const verifyTokenWithBackend = async (token: string): Promise<BackendAppUser> => {
    console.log("Verifying token with backend at:", `${API_URL}/api/auth/verify`);
    const response = await fetch(`${API_URL}/api/auth/verify`, {
        cache: "no-store",
        method: "GET",
        headers: {
            Authorization: `Bearer ${token}`,
            "Cache-Control": "no-store",
            "Content-Type": "application/json",
        },
    });

    if (!response.ok) {
        try {
            const errorData = await response.json();
            throw new Error(
                errorData.message || `Server responded with ${response.status}`,
            );
        } catch {
            throw new Error(`Server error on verification: ${response.status}`);
        }
    }

    return response.json();
};

const getPreferredValue = (...values: Array<string | null | undefined>) =>
    values.find((value) => typeof value === "string" && value.trim().length > 0) || null;

const buildAppUser = (
    backendUser: BackendAppUser,
    firebaseUser: FirebaseUser,
): AppUser => {
    const email = backendUser.email ?? firebaseUser.email;
    const displayName =
        getPreferredValue(backendUser.displayName, firebaseUser.displayName) ||
        (email ? email.split("@")[0] : "User");
    const photoURL = getPreferredValue(
        backendUser.photoURL,
        firebaseUser.photoURL,
    );
    const avatar = getPreferredValue(backendUser.avatar, photoURL);

    return {
        uid: backendUser.uid || firebaseUser.uid,
        email,
        displayName,
        newUser: backendUser.newUser ?? false,
        avatar,
        photoURL,
    };
};

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
    const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
    const [loading, setLoading] = useState(true);
    const isAuthenticated = !!currentUser;
    const previousUserIdRef = useRef<string | null>(null);

    useEffect(() => {
        console.log("AuthContext - Setting up auth state listener...");

        const unsubscribe = onAuthStateChanged(
            auth,
            async (firebaseUser: FirebaseUser | null) => {
                setLoading(true);
                console.log(
                    "AuthContext - Auth state changed:",
                    firebaseUser?.email || "null",
                );

                if (firebaseUser) {
                    const previousUserId = previousUserIdRef.current;
                    if (previousUserId && previousUserId !== firebaseUser.uid) {
                        clearApiCaches();
                    }

                    try {
                        console.log("AuthContext - Getting ID token...");
                        const token = await firebaseUser.getIdToken(true);
                        console.log(
                            "AuthContext - Token received, verifying with backend...",
                        );

                        const appUserData = await verifyTokenWithBackend(token);
                        console.log(
                            "AuthContext - Backend verification successful:",
                            appUserData,
                        );

                        previousUserIdRef.current = firebaseUser.uid;
                        setCurrentUser(buildAppUser(appUserData, firebaseUser));
                    } catch (error) {
                        console.error(
                            "AuthContext - User sync failed, signing out:",
                            error,
                        );
                        previousUserIdRef.current = null;
                        clearApiCaches();
                        await firebaseSignOut(auth);
                        setCurrentUser(null);
                    }
                } else {
                    console.log(
                        "AuthContext - No firebase user, setting currentUser to null",
                    );
                    previousUserIdRef.current = null;
                    clearApiCaches();
                    setCurrentUser(null);
                }
                setLoading(false);
            },
        );

        return () => {
            console.log("AuthContext - Cleaning up auth state listener...");
            unsubscribe();
        };
    }, []);

    const handleGoogleSignIn = async (): Promise<void> => {
        try {
            setLoading(true);
            await signInWithGoogle();
        } catch (error) {
            console.error("Google popup sign-in failed:", error);
            setLoading(false);
            throw error;
        }
    };

    const logout = async () => {
        try {
            clearApiCaches();
            await firebaseSignOut(auth);
            previousUserIdRef.current = null;
            setCurrentUser(null);
        } catch (error) {
            console.error("Logout failed:", error);
            throw error;
        }
    };

    const updateUserStatus = (isNew: boolean) => {
        if (currentUser) {
            setCurrentUser({ ...currentUser, newUser: isNew });
        }
    };

    const value = {
        currentUser,
        loading,
        signInWithGoogle: handleGoogleSignIn,
        logout,
        isAuthenticated,
        updateUserStatus,
    };

    return (
        <AuthContext.Provider value={value}>
            {loading ? (
                <div
                    style={{
                        display: "flex",
                        justifyContent: "center",
                        alignItems: "center",
                        height: "100vh",
                    }}
                >
                    Loading...
                </div>
            ) : (
                children
            )}
        </AuthContext.Provider>
    );
};
