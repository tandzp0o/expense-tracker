import React, {
    RefObject,
    useEffect,
    useId,
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

const toRect = (source: DOMRect | Rect): Rect => ({
    top: source.top,
    left: source.left,
    width: source.width,
    height: source.height,
});

const isSameRect = (current: Rect | null, next: Rect) =>
    !!current &&
    Math.abs(current.top - next.top) < 0.5 &&
    Math.abs(current.left - next.left) < 0.5 &&
    Math.abs(current.width - next.width) < 0.5 &&
    Math.abs(current.height - next.height) < 0.5;

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
    const arrowMarkerId = useId().replace(/:/g, "-");
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

        let frameId = 0;

        const updateRect = () => {
            const element = targetRef.current;
            if (!element) {
                setRect((currentRect) => (currentRect ? null : currentRect));
                return;
            }

            const nextRect = toRect(element.getBoundingClientRect());
            setRect((currentRect) =>
                isSameRect(currentRect, nextRect) ? currentRect : nextRect,
            );
        };

        const syncRect = () => {
            updateRect();
            frameId = window.requestAnimationFrame(syncRect);
        };

        updateRect();
        frameId = window.requestAnimationFrame(syncRect);
        window.addEventListener("resize", updateRect);
        window.addEventListener("scroll", updateRect, true);

        return () => {
            window.cancelAnimationFrame(frameId);
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

    const highlightRect = useMemo(() => {
        if (!rect) {
            return null;
        }

        return {
            top: Math.max(rect.top - highlightPadding, 0),
            left: Math.max(rect.left - highlightPadding, 0),
            width: rect.width + highlightPadding * 2,
            height: rect.height + highlightPadding * 2,
        };
    }, [highlightPadding, rect]);

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
        if (!bubbleStyle || !bubbleRect || !highlightRect) {
            return null;
        }

        const arrowInset = 10;
        let endX = highlightRect.left + highlightRect.width / 2;
        let endY = highlightRect.top + highlightRect.height / 2;

        let startX = bubbleStyle.left + bubbleRect.width / 2;
        let startY = bubbleStyle.top + bubbleRect.height / 2;

        if (placement === "top") {
            startY = bubbleStyle.top + bubbleRect.height;
            endY = highlightRect.top + arrowInset;
        }

        if (placement === "bottom") {
            startY = bubbleStyle.top;
            endY = highlightRect.top + highlightRect.height - arrowInset;
        }

        if (placement === "left") {
            startX = bubbleStyle.left + bubbleRect.width;
            endX = highlightRect.left + arrowInset;
        }

        if (placement === "right") {
            startX = bubbleStyle.left;
            endX = highlightRect.left + highlightRect.width - arrowInset;
        }

        const midX = (startX + endX) / 2;
        const midY = (startY + endY) / 2;

        const control1X =
            placement === "left"
                ? startX + 110
                : placement === "right"
                  ? startX - 110
                  : midX;
        const control1Y =
            placement === "top"
                ? startY + 70
                : placement === "bottom"
                  ? startY - 70
                  : startY;

        const control2X =
            placement === "left"
                ? endX - 50
                : placement === "right"
                  ? endX + 50
                  : midX;
        const control2Y =
            placement === "top"
                ? endY - 30
                : placement === "bottom"
                  ? endY + 30
                  : midY;

        return `M ${startX} ${startY} C ${control1X} ${control1Y}, ${control2X} ${control2Y}, ${endX} ${endY}`;
    }, [bubbleRect, bubbleStyle, highlightRect, placement]);

    if (!mounted || !open || !rect || !bubbleStyle) {
        return null;
    }

    return createPortal(
        <div className="pointer-events-none fixed inset-0 z-[2000]">
            <div
                className="pointer-events-auto fixed left-0 right-0 top-0 bg-slate-950/80"
                style={{ height: highlightRect?.top || 0 }}
            />
            <div
                className="pointer-events-auto fixed left-0 bg-slate-950/80"
                style={{
                    top: highlightRect?.top || 0,
                    width: highlightRect?.left || 0,
                    height: highlightRect?.height || 0,
                }}
            />
            <div
                className="pointer-events-auto fixed bg-slate-950/80"
                style={{
                    top: highlightRect?.top || 0,
                    left:
                        (highlightRect?.left || 0) +
                        (highlightRect?.width || 0),
                    right: 0,
                    height: highlightRect?.height || 0,
                }}
            />
            <div
                className="pointer-events-auto fixed left-0 right-0 bg-slate-950/80"
                style={{
                    top:
                        (highlightRect?.top || 0) +
                        (highlightRect?.height || 0),
                    bottom: 0,
                }}
            />

            <div
                className="fixed rounded-[28px] border-2 border-white/90 shadow-[0_0_0_9999px_rgba(15,23,42,0.12),0_0_40px_rgba(255,255,255,0.35)] pointer-events-none"
                style={{
                    top: highlightRect?.top || 0,
                    left: highlightRect?.left || 0,
                    width: highlightRect?.width || 0,
                    height: highlightRect?.height || 0,
                }}
            />

            {arrowPath ? (
                <svg className="pointer-events-none fixed inset-0 h-full w-full">
                    <defs>
                        <marker
                            id={arrowMarkerId}
                            markerWidth="12"
                            markerHeight="12"
                            refX="10"
                            refY="6"
                            orient="auto"
                        >
                            <path
                                d="M 0 0 L 12 6 L 0 12 z"
                                fill="rgba(255,255,255,0.95)"
                            />
                        </marker>
                    </defs>
                    <path
                        d={arrowPath}
                        fill="none"
                        markerEnd={`url(#${arrowMarkerId})`}
                        stroke="rgba(255,255,255,0.95)"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeDasharray="8 10"
                    />
                </svg>
            ) : null}

            <div
                ref={bubbleRef}
                className="pointer-events-auto fixed w-[320px] rounded-[28px] border border-white/15 bg-slate-950/95 p-5 text-white shadow-2xl backdrop-blur-md"
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
