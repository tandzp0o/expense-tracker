import React, {
    createContext,
    useContext,
    useState,
    useEffect,
    ReactNode,
} from "react";
import { auth, signInWithGoogle } from "../firebase/config";
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
}

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

const verifyTokenWithBackend = async (token: string): Promise<AppUser> => {
    const baseUrl = process.env.REACT_APP_API_URL || "http://localhost:1810";

    console.log("Verifying token with backend at:", `${baseUrl}/api/auth/verify`);
    const response = await fetch(`${baseUrl}/api/auth/verify`, {
        method: "GET",
        headers: {
            Authorization: `Bearer ${token}`,
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

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
    const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
    const [loading, setLoading] = useState(true);
    const isAuthenticated = !!currentUser;

    useEffect(() => {
        console.log("AuthContext - Setting up auth state listener...");

        const unsubscribe = onAuthStateChanged(
            auth,
            async (firebaseUser: FirebaseUser | null) => {
                console.log(
                    "AuthContext - Auth state changed:",
                    firebaseUser?.email || "null",
                );

                if (firebaseUser) {
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

                        setCurrentUser(appUserData);
                    } catch (error) {
                        console.error(
                            "AuthContext - User sync failed, signing out:",
                            error,
                        );
                        await firebaseSignOut(auth);
                        setCurrentUser(null);
                    }
                } else {
                    console.log(
                        "AuthContext - No firebase user, setting currentUser to null",
                    );
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
            await firebaseSignOut(auth);
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
