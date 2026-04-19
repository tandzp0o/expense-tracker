import React, {
    ReactNode,
    createContext,
    useCallback,
    useContext,
    useMemo,
    useState,
} from "react";
import { createPortal } from "react-dom";
import { CheckCircle2, CircleAlert, Info, X } from "lucide-react";
import { cn } from "../lib/utils";

type ToastVariant = "default" | "success" | "destructive";

interface ToastInput {
    title: string;
    description?: string;
    variant?: ToastVariant;
}

interface ToastItem extends ToastInput {
    id: number;
}

interface ToastContextValue {
    toast: (input: ToastInput) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

const variantMap: Record<
    ToastVariant,
    { icon: React.ReactNode; className: string }
> = {
    default: {
        icon: <Info className="h-4 w-4" />,
        className:
            "border-border/80 bg-card/95 text-card-foreground backdrop-blur",
    },
    success: {
        icon: <CheckCircle2 className="h-4 w-4 text-emerald-500" />,
        className:
            "border-emerald-200 bg-emerald-50/95 text-emerald-950 backdrop-blur dark:border-emerald-900 dark:bg-emerald-950/90 dark:text-emerald-50",
    },
    destructive: {
        icon: <CircleAlert className="h-4 w-4 text-rose-500" />,
        className:
            "border-rose-200 bg-rose-50/95 text-rose-950 backdrop-blur dark:border-rose-950 dark:bg-rose-950/90 dark:text-rose-50",
    },
};

export const ToastProvider: React.FC<{ children: ReactNode }> = ({
    children,
}) => {
    const [toasts, setToasts] = useState<ToastItem[]>([]);

    const dismiss = useCallback((id: number) => {
        setToasts((current) => current.filter((toast) => toast.id !== id));
    }, []);

    const toast = useCallback((input: ToastInput) => {
        const id = Date.now() + Math.floor(Math.random() * 1000);
        setToasts((current) => [...current, { id, ...input }]);
        window.setTimeout(() => dismiss(id), 3600);
    }, [dismiss]);

    const value = useMemo(() => ({ toast }), [toast]);

    return (
        <ToastContext.Provider value={value}>
            {children}
            {typeof document !== "undefined"
                ? createPortal(
                      <div className="pointer-events-none fixed bottom-4 right-4 z-[2000] flex w-[min(420px,calc(100vw-2rem))] flex-col gap-3">
                          {toasts.map((item) => {
                              const variant = variantMap[item.variant || "default"];
                              return (
                                  <div
                                      key={item.id}
                                      className={cn(
                                          "pointer-events-auto flex items-start gap-3 rounded-[var(--app-radius-lg)] border px-4 py-3 shadow-lg shadow-black/5",
                                          variant.className,
                                      )}
                                  >
                                      <div className="mt-0.5">{variant.icon}</div>
                                      <div className="min-w-0 flex-1">
                                          <p className="text-sm font-semibold">
                                              {item.title}
                                          </p>
                                          {item.description ? (
                                              <p className="mt-1 text-sm opacity-80">
                                                  {item.description}
                                              </p>
                                          ) : null}
                                      </div>
                                      <button
                                          className="rounded-full p-1 text-muted-foreground transition-colors hover:bg-black/5 hover:text-foreground dark:hover:bg-white/10"
                                          onClick={() => dismiss(item.id)}
                                          type="button"
                                      >
                                          <X className="h-4 w-4" />
                                      </button>
                                  </div>
                              );
                          })}
                      </div>,
                      document.body,
                  )
                : null}
        </ToastContext.Provider>
    );
};

export const useToast = () => {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error("useToast must be used within ToastProvider");
    }
    return context;
};
