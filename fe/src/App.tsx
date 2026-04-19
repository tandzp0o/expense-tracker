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
import Dashboard from "./pages/Dashboard";
import Wallets from "./pages/Wallets";
import Budgets from "./pages/Budgets";
import Goals from "./pages/Goals";
import Transactions from "./pages/Transactions";
import DishSuggestions from "./pages/DishSuggestions";
import Profile from "./pages/Profile";
import Analytics from "./pages/Analytics";
import Settings from "./pages/Settings";
import { Login } from "./components";
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

const LoginRoute = () => {
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
        return <Navigate replace to="/dashboard" />;
    }

    return <Login />;
};

function App() {
    return (
        <Router>
            <LocaleProvider>
                <ThemeProvider>
                    <ToastProvider>
                        <AuthProvider>
                            <Routes>
                                <Route element={<LoginRoute />} path="/login" />
                                <Route
                                    element={<Navigate replace to="/dashboard" />}
                                    path="/"
                                />

                                <Route element={<ProtectedRoute />}>
                                    <Route element={<Dashboard />} path="/dashboard" />
                                    <Route
                                        element={<Transactions />}
                                        path="/transactions"
                                    />
                                    <Route element={<Budgets />} path="/budgets" />
                                    <Route element={<Goals />} path="/goals" />
                                    <Route
                                        element={<Analytics />}
                                        path="/analytics"
                                    />
                                    <Route element={<Wallets />} path="/wallets" />
                                    <Route
                                        element={<DishSuggestions />}
                                        path="/dishes"
                                    />
                                    <Route element={<Profile />} path="/profile" />
                                    <Route
                                        element={<Settings />}
                                        path="/settings"
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
