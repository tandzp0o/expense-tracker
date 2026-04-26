import React, {
    ReactNode,
    createContext,
    useContext,
    useEffect,
    useRef,
    useState,
} from "react";
import {
    User as FirebaseUser,
    deleteUser,
    onAuthStateChanged,
    signOut as firebaseSignOut,
} from "firebase/auth";
import {
    auth,
    registerWithEmailPassword,
    signInWithEmailPassword,
    signInWithGoogle,
} from "../firebase/config";
import { API_URL } from "../config/api";
import { authApi, clearApiCaches } from "../services/api";

interface AppUser {
    uid: string;
    email: string | null;
    username: string;
    displayName: string;
    newUser: boolean;
    hasPassword: boolean;
    authProviders: string[];
    avatar?: string | null;
    photoURL?: string | null;
}

type BackendAppUser = Partial<AppUser> & {
    uid?: string;
    email?: string | null;
    username?: string | null;
    displayName?: string | null;
    newUser?: boolean;
    hasPassword?: boolean;
    authProviders?: string[];
    avatar?: string | null;
    photoURL?: string | null;
};

type RegisterPayload = {
    email: string;
    password: string;
    username?: string;
    displayName?: string;
};

type AuthContextType = {
    currentUser: AppUser | null;
    loading: boolean;
    signInWithGoogle: () => Promise<void>;
    signInWithCredentials: (
        identifier: string,
        password: string,
    ) => Promise<void>;
    registerWithEmail: (payload: RegisterPayload) => Promise<void>;
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

const getDefaultUsername = (...values: Array<string | null | undefined>) =>
    getPreferredValue(...values)?.toLowerCase().replace(/[^a-z0-9._-]+/g, "") ||
    "user";

const clearWalletGuideSessionFlags = () => {
    if (typeof window === "undefined") {
        return;
    }

    for (let index = window.sessionStorage.length - 1; index >= 0; index -= 1) {
        const key = window.sessionStorage.key(index);
        if (key?.startsWith("fintrack-wallet-onboarding-session:")) {
            window.sessionStorage.removeItem(key);
        }
    }
};

const buildAppUser = (
    backendUser: BackendAppUser,
    firebaseUser: FirebaseUser,
): AppUser => {
    const email = backendUser.email ?? firebaseUser.email;
    const username = getDefaultUsername(
        backendUser.username,
        email?.split("@")[0],
        firebaseUser.email?.split("@")[0],
    );
    const displayName =
        getPreferredValue(backendUser.displayName, firebaseUser.displayName) ||
        username ||
        "User";
    const photoURL = getPreferredValue(
        backendUser.photoURL,
        firebaseUser.photoURL,
    );
    const avatar = getPreferredValue(backendUser.avatar, photoURL);

    return {
        uid: backendUser.uid || firebaseUser.uid,
        email,
        username,
        displayName,
        newUser: backendUser.newUser ?? false,
        hasPassword: backendUser.hasPassword ?? false,
        authProviders: backendUser.authProviders || [],
        avatar,
        photoURL,
    };
};

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
    const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
    const [loading, setLoading] = useState(true);
    const isAuthenticated = !!currentUser;
    const previousUserIdRef = useRef<string | null>(null);
    const registrationInProgressRef = useRef(false);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(
            auth,
            async (firebaseUser: FirebaseUser | null) => {
                if (firebaseUser && registrationInProgressRef.current) {
                    return;
                }

                setLoading(true);

                if (firebaseUser) {
                    const previousUserId = previousUserIdRef.current;
                    if (previousUserId && previousUserId !== firebaseUser.uid) {
                        clearApiCaches();
                    }

                    try {
                        const token = await firebaseUser.getIdToken(true);
                        const appUserData = await verifyTokenWithBackend(token);

                        previousUserIdRef.current = firebaseUser.uid;
                        setCurrentUser(buildAppUser(appUserData, firebaseUser));
                    } catch (error) {
                        console.error("User sync failed, signing out:", error);
                        previousUserIdRef.current = null;
                        clearApiCaches();
                        await firebaseSignOut(auth);
                        setCurrentUser(null);
                    }
                } else {
                    clearWalletGuideSessionFlags();
                    previousUserIdRef.current = null;
                    clearApiCaches();
                    setCurrentUser(null);
                }
                setLoading(false);
            },
        );

        return () => {
            unsubscribe();
        };
    }, []);

    const handleGoogleSignIn = async (): Promise<void> => {
        try {
            setLoading(true);
            await signInWithGoogle();
        } catch (error) {
            setLoading(false);
            throw error;
        }
    };

    const handleCredentialSignIn = async (
        identifier: string,
        password: string,
    ): Promise<void> => {
        try {
            setLoading(true);
            const resolvedAccount = await authApi.resolveLogin(identifier);

            if (resolvedAccount.hasPassword === false) {
                throw new Error(
                    "This account uses Google sign-in. Please continue with Google.",
                );
            }

            await signInWithEmailPassword(resolvedAccount.email, password);
        } catch (error) {
            setLoading(false);
            throw error;
        }
    };

    const handleRegisterWithEmail = async (
        payload: RegisterPayload,
    ): Promise<void> => {
        let createdUser: FirebaseUser | null = null;

        try {
            registrationInProgressRef.current = true;
            setLoading(true);

            const credential = await registerWithEmailPassword(
                payload.email,
                payload.password,
            );

            createdUser = credential.user;
            const token = await credential.user.getIdToken(true);
            const backendUser = await authApi.completeRegistration(
                {
                    username: payload.username,
                    displayName: payload.displayName,
                },
                token,
            );

            previousUserIdRef.current = credential.user.uid;
            setCurrentUser(buildAppUser(backendUser, credential.user));
            registrationInProgressRef.current = false;
            setLoading(false);
        } catch (error) {
            if (createdUser) {
                try {
                    const token = await createdUser.getIdToken(true);
                    await authApi.rollbackRegistration(token).catch(() => undefined);
                } catch (rollbackError) {
                    console.error(
                        "Failed to rollback Mongo registration draft:",
                        rollbackError,
                    );
                }

                try {
                    await deleteUser(createdUser);
                } catch (deleteError) {
                    console.error("Failed to rollback Firebase user:", deleteError);
                }
            }

            registrationInProgressRef.current = false;
            clearWalletGuideSessionFlags();
            clearApiCaches();
            previousUserIdRef.current = null;
            await firebaseSignOut(auth).catch(() => undefined);
            setCurrentUser(null);
            setLoading(false);
            throw error;
        }
    };

    const logout = async () => {
        try {
            clearWalletGuideSessionFlags();
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
        signInWithCredentials: handleCredentialSignIn,
        registerWithEmail: handleRegisterWithEmail,
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
