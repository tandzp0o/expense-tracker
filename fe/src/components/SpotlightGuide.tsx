import React, {
    RefObject,
    useEffect,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import { createPortal } from "react-dom";

type Placement = "top" | "bottom" | "left" | "right";

interface SpotlightGuideProps {
    open: boolean;
    targetRef: RefObject<HTMLElement | null>;
    title: string;
    description: string;
    placement?: Placement;
    stepLabel?: string;
    actionLabel?: string;
    actionDisabled?: boolean;
    onAction?: () => void;
    onSkip: () => void;
    highlightPadding?: number;
}

type Rect = {
    top: number;
    left: number;
    width: number;
    height: number;
};

const clamp = (value: number, min: number, max: number) =>
    Math.min(Math.max(value, min), max);

const SpotlightGuide: React.FC<SpotlightGuideProps> = ({
    open,
    targetRef,
    title,
    description,
    placement = "bottom",
    stepLabel,
    actionLabel,
    actionDisabled = false,
    onAction,
    onSkip,
    highlightPadding = 14,
}) => {
    const bubbleRef = useRef<HTMLDivElement | null>(null);
    const [mounted, setMounted] = useState(false);
    const [rect, setRect] = useState<Rect | null>(null);
    const [bubbleRect, setBubbleRect] = useState<Rect | null>(null);

    useEffect(() => {
        setMounted(true);
    }, []);

    useLayoutEffect(() => {
        if (!open) {
            setRect(null);
            return;
        }

        const updateRect = () => {
            const element = targetRef.current;
            if (!element) {
                setRect(null);
                return;
            }

            const nextRect = element.getBoundingClientRect();
            setRect({
                top: nextRect.top,
                left: nextRect.left,
                width: nextRect.width,
                height: nextRect.height,
            });
        };

        updateRect();
        window.addEventListener("resize", updateRect);
        window.addEventListener("scroll", updateRect, true);

        return () => {
            window.removeEventListener("resize", updateRect);
            window.removeEventListener("scroll", updateRect, true);
        };
    }, [open, targetRef]);

    useLayoutEffect(() => {
        if (!open || !bubbleRef.current) {
            setBubbleRect(null);
            return;
        }

        const nextRect = bubbleRef.current.getBoundingClientRect();
        setBubbleRect({
            top: nextRect.top,
            left: nextRect.left,
            width: nextRect.width,
            height: nextRect.height,
        });
    }, [open, rect, title, description, stepLabel, actionLabel]);

    const bubbleStyle = useMemo(() => {
        if (!rect) {
            return null;
        }

        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        const bubbleWidth = bubbleRect?.width || 320;
        const bubbleHeight = bubbleRect?.height || 190;
        const gap = 28;

        let top = rect.top;
        let left = rect.left;

        if (placement === "top") {
            top = rect.top - bubbleHeight - gap;
            left = rect.left + rect.width / 2 - bubbleWidth / 2;
        }

        if (placement === "bottom") {
            top = rect.top + rect.height + gap;
            left = rect.left + rect.width / 2 - bubbleWidth / 2;
        }

        if (placement === "left") {
            top = rect.top + rect.height / 2 - bubbleHeight / 2;
            left = rect.left - bubbleWidth - gap;
        }

        if (placement === "right") {
            top = rect.top + rect.height / 2 - bubbleHeight / 2;
            left = rect.left + rect.width + gap;
        }

        return {
            top: clamp(top, 24, viewportHeight - bubbleHeight - 24),
            left: clamp(left, 24, viewportWidth - bubbleWidth - 24),
        };
    }, [bubbleRect?.height, bubbleRect?.width, placement, rect]);

    const arrowPath = useMemo(() => {
        if (!rect || !bubbleStyle || !bubbleRect) {
            return null;
        }

        const endX = rect.left + rect.width / 2;
        const endY = rect.top + rect.height / 2;

        let startX = bubbleStyle.left + bubbleRect.width / 2;
        let startY = bubbleStyle.top + bubbleRect.height / 2;

        if (placement === "top") {
            startY = bubbleStyle.top + bubbleRect.height;
        }

        if (placement === "bottom") {
            startY = bubbleStyle.top;
        }

        if (placement === "left") {
            startX = bubbleStyle.left + bubbleRect.width;
        }

        if (placement === "right") {
            startX = bubbleStyle.left;
        }

        const curveX = placement === "left" || placement === "right" ? 80 : 0;
        const curveY = placement === "top" || placement === "bottom" ? 80 : 0;

        return `M ${startX} ${startY} C ${startX + curveX} ${startY + curveY}, ${endX - curveX} ${endY - curveY}, ${endX} ${endY}`;
    }, [bubbleRect, bubbleStyle, placement, rect]);

    if (!mounted || !open || !rect || !bubbleStyle) {
        return null;
    }

    const top = Math.max(rect.top - highlightPadding, 0);
    const left = Math.max(rect.left - highlightPadding, 0);
    const width = rect.width + highlightPadding * 2;
    const height = rect.height + highlightPadding * 2;

    return createPortal(
        <div className="fixed inset-0 z-[2000]">
            <div
                className="fixed left-0 right-0 top-0 bg-slate-950/80"
                style={{ height: top }}
            />
            <div
                className="fixed left-0 bg-slate-950/80"
                style={{ top, width: left, height }}
            />
            <div
                className="fixed bg-slate-950/80"
                style={{
                    top,
                    left: left + width,
                    right: 0,
                    height,
                }}
            />
            <div
                className="fixed left-0 right-0 bg-slate-950/80"
                style={{ top: top + height, bottom: 0 }}
            />

            <div
                className="fixed rounded-[28px] border-2 border-white/90 shadow-[0_0_0_9999px_rgba(15,23,42,0.12),0_0_40px_rgba(255,255,255,0.35)] pointer-events-none"
                style={{
                    top,
                    left,
                    width,
                    height,
                }}
            />

            {arrowPath ? (
                <svg className="pointer-events-none fixed inset-0 h-full w-full">
                    <path
                        d={arrowPath}
                        fill="none"
                        stroke="rgba(255,255,255,0.95)"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeDasharray="8 10"
                    />
                </svg>
            ) : null}

            <div
                ref={bubbleRef}
                className="fixed w-[320px] rounded-[28px] border border-white/15 bg-slate-950/95 p-5 text-white shadow-2xl backdrop-blur-md"
                style={bubbleStyle}
            >
                <div className="mb-3 flex items-center justify-between gap-3">
                    <div className="text-[11px] font-black uppercase tracking-[0.2em] text-cyan-300">
                        {stepLabel || "Huong dan"}
                    </div>
                    <button
                        className="rounded-full border border-white/15 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-slate-300 transition-colors hover:text-white"
                        onClick={onSkip}
                        type="button"
                    >
                        Skip
                    </button>
                </div>

                <div className="space-y-2">
                    <h3 className="text-lg font-bold leading-tight">{title}</h3>
                    <p className="text-sm leading-6 text-slate-200">
                        {description}
                    </p>
                </div>

                {onAction ? (
                    <button
                        className="mt-5 inline-flex h-11 items-center justify-center rounded-2xl bg-white px-5 text-sm font-bold text-slate-900 transition-transform hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-40"
                        disabled={actionDisabled}
                        onClick={onAction}
                        type="button"
                    >
                        {actionLabel || "Tiep tuc"}
                    </button>
                ) : null}
            </div>
        </div>,
        document.body,
    );
};

export default SpotlightGuide;
