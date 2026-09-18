import React from "react";
import {
    BrowserRouter as Router,
    Navigate,
    Outlet,
    Route,
    Routes,
    useLocation,
} from "react-router-dom";
import MainLayout from "./layouts/MainLayout";
import {
    NAVIGATION_LOCK_REDIRECT_KEY,
    NavigationLockProvider,
} from "./contexts/NavigationLockContext";
import { QuestProvider } from "./contexts/QuestContext";
import { LoginPage, RegisterPage } from "./features/auth";
import { DashboardPage } from "./features/dashboard";
import { TransactionsPage } from "./features/transactions";
import { BudgetsPage } from "./features/budgets";
import { GoalsPage } from "./features/goals";
import { AnalyticsPage } from "./features/analytics";
import { WalletsPage } from "./features/wallets";
import { DishSuggestionsPage } from "./features/dishes";
import { ProfilePage } from "./features/profile";
import { SettingsPage } from "./features/settings";
import { AIModelPage } from "./features/ai";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import { ToastProvider } from "./contexts/ToastContext";
import { LocaleProvider, useLocale } from "./contexts/LocaleContext";
import { Spinner } from "./components/ui/spinner";
import { Versioned, useIsLedger } from "./v2/Versioned";
import { isLedgerPreview } from "./v2/preview";

// v2 is loaded only by people who switch to it, so v1 users do not download it.
const LedgerLayout = React.lazy(() =>
    import("./v2/layout/LedgerLayout").then((module) => ({
        default: module.LedgerLayout,
    })),
);
const LedgerDashboard = React.lazy(() => import("./v2/pages/DashboardPage"));
const LedgerTransactions = React.lazy(() => import("./v2/pages/TransactionsPage"));
const LedgerBudgets = React.lazy(() => import("./v2/pages/BudgetsPage"));
const LedgerWallets = React.lazy(() => import("./v2/pages/WalletsPage"));
const LedgerGoals = React.lazy(() => import("./v2/pages/GoalsPage"));
const LedgerAnalytics = React.lazy(() => import("./v2/pages/AnalyticsPage"));
const LedgerSettings = React.lazy(() => import("./v2/pages/SettingsPage"));
const LedgerMore = React.lazy(() => import("./v2/pages/MorePage"));
const LedgerDishes = React.lazy(() => import("./v2/pages/DishesPage"));
const LedgerProfile = React.lazy(() => import("./v2/pages/ProfilePage"));

const FullscreenLoader = ({ label }: { label: string }) => (
    <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="glass-panel flex items-center gap-3 rounded-[var(--app-radius-lg)] border border-border px-5 py-4 shadow-soft">
            <Spinner />
            <span className="text-sm text-muted-foreground">{label}</span>
        </div>
    </div>
);

const ProtectedRoute = () => {
    const { currentUser, loading } = useAuth();
    const location = useLocation();
    const { isVietnamese } = useLocale();
    const isLedger = useIsLedger();

    // Development screenshots only; see v2/preview.ts.
    if (isLedgerPreview()) {
        return (
            <React.Suspense fallback={<FullscreenLoader label="Ledger" />}>
                <LedgerLayout>
                    <Outlet />
                </LedgerLayout>
            </React.Suspense>
        );
    }

    if (loading) {
        return (
            <FullscreenLoader
                label={
                    isVietnamese
                        ? "Đang tải phiên đăng nhập..."
                        : "Loading your session..."
                }
            />
        );
    }

    if (!currentUser) {
        return <Navigate replace state={{ from: location }} to="/login" />;
    }

    if (currentUser.newUser && location.pathname !== "/wallets") {
        window.sessionStorage.setItem(NAVIGATION_LOCK_REDIRECT_KEY, "1");
        return <Navigate replace to="/wallets" />;
    }

    return (
        <QuestProvider isVietnamese={isVietnamese}>
            <NavigationLockProvider>
                {/* v2 is a separate shell and component tree, not a skin over
                    v1, so the whole layout switches with the setting. */}
                {isLedger ? (
                    <React.Suspense
                        fallback={
                            <FullscreenLoader
                                label={
                                    isVietnamese
                                        ? "Đang tải giao diện..."
                                        : "Loading the interface..."
                                }
                            />
                        }
                    >
                        <LedgerLayout key={currentUser.uid}>
                            <Outlet />
                        </LedgerLayout>
                    </React.Suspense>
                ) : (
                    <MainLayout key={currentUser.uid}>
                        <Outlet />
                    </MainLayout>
                )}
            </NavigationLockProvider>
        </QuestProvider>
    );
};

const PublicOnlyRoute = ({ children }: { children: React.ReactElement }) => {
    const { currentUser, loading } = useAuth();
    const { isVietnamese } = useLocale();

    if (loading) {
        return (
            <FullscreenLoader
                label={
                    isVietnamese
                        ? "Đang kiểm tra tài khoản..."
                        : "Checking your account..."
                }
            />
        );
    }

    if (currentUser) {
        return <Navigate replace to={currentUser.newUser ? "/wallets" : "/dashboard"} />;
    }

    return children;
};

function App() {
    return (
        <Router>
            <LocaleProvider>
                <ThemeProvider>
                    <ToastProvider>
                        <AuthProvider>
                            <Routes>
                                <Route
                                    element={
                                        <PublicOnlyRoute>
                                            <LoginPage />
                                        </PublicOnlyRoute>
                                    }
                                    path="/login"
                                />
                                <Route
                                    element={
                                        <PublicOnlyRoute>
                                            <RegisterPage />
                                        </PublicOnlyRoute>
                                    }
                                    path="/register"
                                />
                                <Route
                                    element={<Navigate replace to="/dashboard" />}
                                    path="/"
                                />

                                <Route element={<ProtectedRoute />}>
                                    <Route
                                        element={
                                            <Versioned
                                                v1={<DashboardPage />}
                                                v2={<LedgerDashboard />}
                                            />
                                        }
                                        path="/dashboard"
                                    />
                                    <Route
                                        element={
                                            <Versioned
                                                v1={<TransactionsPage />}
                                                v2={<LedgerTransactions />}
                                            />
                                        }
                                        path="/transactions"
                                    />
                                    <Route
                                        element={
                                            <Versioned
                                                v1={<BudgetsPage />}
                                                v2={<LedgerBudgets />}
                                            />
                                        }
                                        path="/budgets"
                                    />
                                    <Route
                                        element={
                                            <Versioned
                                                v1={<GoalsPage />}
                                                v2={<LedgerGoals />}
                                            />
                                        }
                                        path="/goals"
                                    />
                                    <Route
                                        element={
                                            <Versioned
                                                v1={<AnalyticsPage />}
                                                v2={<LedgerAnalytics />}
                                            />
                                        }
                                        path="/analytics"
                                    />
                                    <Route
                                        element={
                                            <Versioned
                                                v1={<WalletsPage />}
                                                v2={<LedgerWallets />}
                                            />
                                        }
                                        path="/wallets"
                                    />
                                    <Route
                                        element={
                                            <Versioned
                                                v1={<DishSuggestionsPage />}
                                                v2={<LedgerDishes />}
                                            />
                                        }
                                        path="/dishes"
                                    />
                                    <Route
                                        element={
                                            <Versioned
                                                v1={<ProfilePage />}
                                                v2={<LedgerProfile />}
                                            />
                                        }
                                        path="/profile"
                                    />
                                    <Route
                                        element={
                                            <Versioned
                                                v1={<SettingsPage />}
                                                v2={<LedgerSettings />}
                                            />
                                        }
                                        path="/settings"
                                    />
                                    <Route
                                        element={
                                            <Versioned
                                                v1={<Navigate replace to="/dashboard" />}
                                                v2={<LedgerMore />}
                                            />
                                        }
                                        path="/more"
                                    />
                                    <Route
                                        element={<AIModelPage />}
                                        path="/ai-model"
                                    />
                                </Route>
                            </Routes>
                        </AuthProvider>
                    </ToastProvider>
                </ThemeProvider>
            </LocaleProvider>
        </Router>
    );
}

export default App;
