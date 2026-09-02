import React, {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
} from "react";
import { useNavigate } from "react-router-dom";
import { Lock, WalletCards } from "lucide-react";
import { useAuth } from "./AuthContext";
import { useLocale } from "./LocaleContext";
import { Button } from "../components/ui/button";
import { Dialog, DialogFooter } from "../components/ui/dialog";

export const NAVIGATION_LOCK_REDIRECT_KEY = "tonfin-navigation-lock-redirect";

interface NavigationLockValue {
    navigationLocked: boolean;
    isItemLocked: (target: string) => boolean;
    notifyNavigationLocked: () => void;
}

const NavigationLockContext = createContext<NavigationLockValue>({
    navigationLocked: false,
    isItemLocked: () => false,
    notifyNavigationLocked: () => undefined,
});

export const useNavigationLock = () => useContext(NavigationLockContext);

export const NavigationLockProvider: React.FC<{
    children: React.ReactNode;
}> = ({ children }) => {
    const navigate = useNavigate();
    const { currentUser } = useAuth();
    const { isVietnamese } = useLocale();
    const [noticeOpen, setNoticeOpen] = useState(false);
    const navigationLocked = !!currentUser?.newUser;

    const isItemLocked = useCallback(
        (target: string) => navigationLocked && target !== "/wallets",
        [navigationLocked],
    );

    const notifyNavigationLocked = useCallback(() => {
        setNoticeOpen(true);
    }, []);

    // A blocked deep link (typed URL, bookmark, browser back) is redirected to
    // /wallets by the router, so surface the same explanation on arrival.
    useEffect(() => {
        if (!navigationLocked) {
            return;
        }

        if (
            window.sessionStorage.getItem(NAVIGATION_LOCK_REDIRECT_KEY) !== "1"
        ) {
            return;
        }

        window.sessionStorage.removeItem(NAVIGATION_LOCK_REDIRECT_KEY);
        setNoticeOpen(true);
    }, [navigationLocked]);

    const value = useMemo(
        () => ({
            navigationLocked,
            isItemLocked,
            notifyNavigationLocked,
        }),
        [isItemLocked, navigationLocked, notifyNavigationLocked],
    );

    return (
        <NavigationLockContext.Provider value={value}>
            {children}
            <Dialog
                className="max-w-lg"
                description={
                    isVietnamese
                        ? "Đây không phải lỗi của ứng dụng."
                        : "This is not an app error."
                }
                eyebrow={isVietnamese ? "Cần tạo ví trước" : "Wallet required"}
                icon={Lock}
                onClose={() => setNoticeOpen(false)}
                open={noticeOpen}
                title={
                    isVietnamese
                        ? "Bạn chưa tạo ví nào"
                        : "You have not created a wallet yet"
                }
                tone="warning"
            >
                <div className="space-y-3 p-4 sm:p-5">
                    <p className="text-sm leading-6 text-foreground/90">
                        {isVietnamese
                            ? "Bạn chưa tạo ví nên chưa thể truy cập các tính năng khác. Vui lòng tạo ví trước để mở khóa toàn bộ ứng dụng."
                            : "You have not created a wallet yet, so the other features are not available. Please create a wallet first to unlock the whole app."}
                    </p>
                    <p className="text-sm leading-6 text-muted-foreground">
                        {isVietnamese
                            ? "Mọi giao dịch, ngân sách và mục tiêu đều cần gắn với một ví, vì vậy ứng dụng cần ít nhất một ví trước khi bắt đầu. Chỉ mất chưa tới một phút."
                            : "Every transaction, budget and goal is attached to a wallet, so the app needs at least one before you start. It takes less than a minute."}
                    </p>
                </div>

                <DialogFooter>
                    <Button
                        className="w-full sm:w-auto"
                        onClick={() => setNoticeOpen(false)}
                        variant="outline"
                    >
                        {isVietnamese ? "Đã hiểu" : "Got it"}
                    </Button>
                    <Button
                        className="w-full sm:w-auto"
                        onClick={() => {
                            setNoticeOpen(false);
                            navigate("/wallets?create=1");
                        }}
                    >
                        <WalletCards className="h-4 w-4" />
                        {isVietnamese ? "Tạo ví ngay" : "Create a wallet"}
                    </Button>
                </DialogFooter>
            </Dialog>
        </NavigationLockContext.Provider>
    );
};

export default NavigationLockContext;
