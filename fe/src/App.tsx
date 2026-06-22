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
        return <Navigate replace to="/wallets" />;
    }

    return (
        <MainLayout key={currentUser.uid}>
            <Outlet />
        </MainLayout>
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
                                    <Route element={<DashboardPage />} path="/dashboard" />
                                    <Route
                                        element={<TransactionsPage />}
                                        path="/transactions"
                                    />
                                    <Route element={<BudgetsPage />} path="/budgets" />
                                    <Route element={<GoalsPage />} path="/goals" />
                                    <Route
                                        element={<AnalyticsPage />}
                                        path="/analytics"
                                    />
                                    <Route element={<WalletsPage />} path="/wallets" />
                                    <Route
                                        element={<DishSuggestionsPage />}
                                        path="/dishes"
                                    />
                                    <Route element={<ProfilePage />} path="/profile" />
                                    <Route
                                        element={<SettingsPage />}
                                        path="/settings"
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
