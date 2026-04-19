import React, {
    RefObject,
    useEffect,
    useEffectEvent,
    useId,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import { createPortal } from "react-dom";
import { useLocale } from "../contexts/LocaleContext";

type Placement = "top" | "bottom" | "left" | "right";

interface SpotlightGuideProps {
    open: boolean;
    targetRef: RefObject<HTMLElement | null>;
    title: string;
    description: string;
    placement?: Placement;
    stepLabel?: string;
    actionLabel?: string;
    skipLabel?: string;
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

type Size = {
    width: number;
    height: number;
};

type Boundary = {
    top: number;
    left: number;
    width: number;
    height: number;
};

const VIEWPORT_MARGIN = 24;
const DEFAULT_BUBBLE_WIDTH = 360;
const DEFAULT_BUBBLE_HEIGHT = 220;
const BUBBLE_GAP = 120;
const HORIZONTAL_PLACEMENT_LIFT = 18;
const FOCUSABLE_SELECTOR = [
    "button:not([disabled])",
    "[href]",
    "input:not([disabled])",
    "select:not([disabled])",
    "textarea:not([disabled])",
    "[tabindex]:not([tabindex='-1'])",
].join(",");

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

const isSameSize = (current: Size | null, next: Size) =>
    !!current &&
    Math.abs(current.width - next.width) < 0.5 &&
    Math.abs(current.height - next.height) < 0.5;

const getFocusableElements = (container: HTMLElement) =>
    Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
        (element) =>
            element.getAttribute("aria-hidden") !== "true" &&
            !element.hasAttribute("disabled") &&
            element.getClientRects().length > 0,
    );

const SpotlightGuide: React.FC<SpotlightGuideProps> = ({
    open,
    targetRef,
    title,
    description,
    placement = "bottom",
    stepLabel,
    actionLabel,
    skipLabel,
    actionDisabled = false,
    onAction,
    onSkip,
    highlightPadding = 14,
}) => {
    const { isVietnamese } = useLocale();
    const bubbleRef = useRef<HTMLDivElement | null>(null);
    const primaryActionRef = useRef<HTMLButtonElement | null>(null);
    const previousFocusRef = useRef<HTMLElement | null>(null);
    const baseId = useId().replace(/:/g, "-");
    const [mounted, setMounted] = useState(false);
    const [entered, setEntered] = useState(false);
    const [rect, setRect] = useState<Rect | null>(null);
    const [bubbleSize, setBubbleSize] = useState<Size | null>(null);
    const [boundaryRect, setBoundaryRect] = useState<Boundary | null>(null);

    const titleId = `${baseId}-title`;
    const descriptionId = `${baseId}-description`;
    const arrowMarkerId = `${baseId}-arrow`;

    const resolvedStepLabel = stepLabel || (isVietnamese ? "Hướng dẫn" : "Guide");
    const resolvedActionLabel =
        actionLabel || (isVietnamese ? "Tiếp theo →" : "Next →");
    const resolvedSkipLabel = skipLabel || (isVietnamese ? "Bỏ qua" : "Skip");
    const skipAriaLabel = isVietnamese
        ? "Bỏ qua hướng dẫn này"
        : "Skip this onboarding guide";
    const actionAriaLabel = isVietnamese
        ? "Chuyển sang bước tiếp theo"
        : "Continue to the next step";

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        if (!open) {
            setEntered(false);
            return;
        }

        setEntered(false);
        const frameId = window.requestAnimationFrame(() => {
            setEntered(true);
        });

        return () => {
            window.cancelAnimationFrame(frameId);
        };
    }, [open]);

    const measureLayout = useEffectEvent(() => {
        const targetElement = targetRef.current;
        if (!targetElement) {
            setRect((currentRect) => (currentRect ? null : currentRect));
            setBoundaryRect((currentBoundary) =>
                currentBoundary ? null : currentBoundary,
            );
        } else {
            const nextRect = toRect(targetElement.getBoundingClientRect());
            setRect((currentRect) =>
                isSameRect(currentRect, nextRect) ? currentRect : nextRect,
            );

            const boundaryElement = targetElement.closest("[data-spotlight-boundary]");
            if (!boundaryElement) {
                setBoundaryRect((currentBoundary) =>
                    currentBoundary ? null : currentBoundary,
                );
            } else {
                const boundary = boundaryElement.getBoundingClientRect();
                const nextBoundary = {
                    top: boundary.top,
                    left: boundary.left,
                    width: boundary.width,
                    height: boundary.height,
                };

                setBoundaryRect((currentBoundary) =>
                    currentBoundary &&
                    Math.abs(currentBoundary.top - nextBoundary.top) < 0.5 &&
                    Math.abs(currentBoundary.left - nextBoundary.left) < 0.5 &&
                    Math.abs(currentBoundary.width - nextBoundary.width) < 0.5 &&
                    Math.abs(currentBoundary.height - nextBoundary.height) < 0.5
                        ? currentBoundary
                        : nextBoundary,
                );
            }
        }

        const bubbleElement = bubbleRef.current;
        if (!bubbleElement) {
            setBubbleSize((currentSize) => (currentSize ? null : currentSize));
            return;
        }

        const nextRect = bubbleElement.getBoundingClientRect();
        const nextSize = {
            width: nextRect.width,
            height: nextRect.height,
        };

        setBubbleSize((currentSize) =>
            isSameSize(currentSize, nextSize) ? currentSize : nextSize,
        );
    });

    useLayoutEffect(() => {
        if (!open) {
            setRect(null);
            setBubbleSize(null);
            setBoundaryRect(null);
            return;
        }

        let frameId = 0;
        const resizeObserver =
            typeof ResizeObserver !== "undefined"
                ? new ResizeObserver(() => scheduleMeasure())
                : null;
        const mutationObserver =
            typeof MutationObserver !== "undefined"
                ? new MutationObserver(() => scheduleMeasure())
                : null;

        function scheduleMeasure() {
            if (frameId) {
                window.cancelAnimationFrame(frameId);
            }

            frameId = window.requestAnimationFrame(() => {
                frameId = 0;
                measureLayout();
            });
        }

        scheduleMeasure();

        if (targetRef.current) {
            resizeObserver?.observe(targetRef.current);
        }

        if (bubbleRef.current) {
            resizeObserver?.observe(bubbleRef.current);
        }

        mutationObserver?.observe(document.body, {
            childList: true,
            subtree: true,
        });

        window.addEventListener("resize", scheduleMeasure);
        window.addEventListener("scroll", scheduleMeasure, true);

        return () => {
            if (frameId) {
                window.cancelAnimationFrame(frameId);
            }

            resizeObserver?.disconnect();
            mutationObserver?.disconnect();
            window.removeEventListener("resize", scheduleMeasure);
            window.removeEventListener("scroll", scheduleMeasure, true);
        };
    }, [
        actionDisabled,
        actionLabel,
        description,
        measureLayout,
        open,
        placement,
        stepLabel,
        targetRef,
        title,
    ]);

    useEffect(() => {
        if (!open || !bubbleRef.current) {
            return;
        }

        const bubbleElement = bubbleRef.current;
        previousFocusRef.current =
            document.activeElement instanceof HTMLElement ? document.activeElement : null;

        const focusInitialElement = () => {
            const preferredTarget =
                primaryActionRef.current && !primaryActionRef.current.disabled
                    ? primaryActionRef.current
                    : getFocusableElements(bubbleElement)[0] || bubbleElement;

            preferredTarget.focus({ preventScroll: true });
        };

        const frameId = window.requestAnimationFrame(focusInitialElement);

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key !== "Tab") {
                return;
            }

            const activeElement =
                document.activeElement instanceof HTMLElement ? document.activeElement : null;
            const focusableElements = getFocusableElements(bubbleElement);
            const firstElement = focusableElements[0] || bubbleElement;
            const lastElement =
                focusableElements[focusableElements.length - 1] || bubbleElement;

            if (!activeElement || !bubbleElement.contains(activeElement)) {
                event.preventDefault();
                firstElement.focus({ preventScroll: true });
                return;
            }

            if (event.shiftKey && (activeElement === firstElement || activeElement === bubbleElement)) {
                event.preventDefault();
                lastElement.focus({ preventScroll: true });
                return;
            }

            if (!event.shiftKey && activeElement === lastElement) {
                event.preventDefault();
                firstElement.focus({ preventScroll: true });
            }
        };

        document.addEventListener("keydown", handleKeyDown, true);

        return () => {
            window.cancelAnimationFrame(frameId);
            document.removeEventListener("keydown", handleKeyDown, true);

            if (previousFocusRef.current?.isConnected) {
                previousFocusRef.current.focus({ preventScroll: true });
            }
        };
    }, [open]);

    const highlightRect = useMemo(() => {
        if (!rect) {
            return null;
        }

        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        const left = clamp(rect.left - highlightPadding, 0, viewportWidth);
        const top = clamp(rect.top - highlightPadding, 0, viewportHeight);
        const right = clamp(
            rect.left + rect.width + highlightPadding,
            0,
            viewportWidth,
        );
        const bottom = clamp(
            rect.top + rect.height + highlightPadding,
            0,
            viewportHeight,
        );

        return {
            top,
            left,
            width: Math.max(right - left, 0),
            height: Math.max(bottom - top, 0),
        };
    }, [highlightPadding, rect]);

    const effectivePlacement = useMemo(() => {
        if (!highlightRect) {
            return placement;
        }

        if (placement === "left" || placement === "right") {
            return placement;
        }

        const targetCenterY = highlightRect.top + highlightRect.height / 2;
        const verticalBoundaryMidpoint = boundaryRect
            ? boundaryRect.top + boundaryRect.height / 2
            : window.innerHeight / 2;

        return targetCenterY <= verticalBoundaryMidpoint ? "bottom" : "top";
    }, [boundaryRect, highlightRect, placement]);

    const bubbleStyle = useMemo(() => {
        if (!highlightRect) {
            return null;
        }

        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        const bubbleWidth = bubbleSize?.width || DEFAULT_BUBBLE_WIDTH;
        const bubbleHeight = bubbleSize?.height || DEFAULT_BUBBLE_HEIGHT;
        const highlightCenterX = highlightRect.left + highlightRect.width / 2;
        const highlightCenterY = highlightRect.top + highlightRect.height / 2;
        const highlightRight = highlightRect.left + highlightRect.width;
        const highlightBottom = highlightRect.top + highlightRect.height;

        let top = highlightRect.top;
        let left = highlightRect.left;

        if (effectivePlacement === "top") {
            top = highlightRect.top - bubbleHeight - BUBBLE_GAP;
            left = highlightCenterX - bubbleWidth / 2;
        }

        if (effectivePlacement === "bottom") {
            top = highlightBottom + BUBBLE_GAP;
            left = highlightCenterX - bubbleWidth / 2;
        }

        if (effectivePlacement === "left") {
            top = highlightCenterY - bubbleHeight / 2 - HORIZONTAL_PLACEMENT_LIFT;
            left = highlightRect.left - bubbleWidth - BUBBLE_GAP;
        }

        if (effectivePlacement === "right") {
            top = highlightCenterY - bubbleHeight / 2 - HORIZONTAL_PLACEMENT_LIFT;
            left = highlightRight + BUBBLE_GAP;
        }

        return {
            top: clamp(top, VIEWPORT_MARGIN, viewportHeight - bubbleHeight - VIEWPORT_MARGIN),
            left: clamp(left, VIEWPORT_MARGIN, viewportWidth - bubbleWidth - VIEWPORT_MARGIN),
        };
    }, [bubbleSize, effectivePlacement, highlightRect]);

    const bubbleBounds = useMemo(() => {
        if (!bubbleStyle) {
            return null;
        }

        return {
            top: bubbleStyle.top,
            left: bubbleStyle.left,
            width: bubbleSize?.width || DEFAULT_BUBBLE_WIDTH,
            height: bubbleSize?.height || DEFAULT_BUBBLE_HEIGHT,
        };
    }, [bubbleSize, bubbleStyle]);

    const arrowPath = useMemo(() => {
        if (!bubbleStyle || !bubbleBounds || !highlightRect) {
            return null;
        }

        const outsideOffset = 20;
        const targetOutsideOffset = 14;

        let startX = bubbleStyle.left + bubbleBounds.width / 2;
        let startY = bubbleStyle.top + bubbleBounds.height / 2;

        let endX = highlightRect.left + highlightRect.width / 2;
        let endY = highlightRect.top + highlightRect.height / 2;
        let outwardX = 0;
        let outwardY = 0;

        if (effectivePlacement === "bottom") {
            startY = bubbleStyle.top - outsideOffset;
            endY =
                highlightRect.top +
                highlightRect.height +
                targetOutsideOffset;
            outwardY = -1;
        }

        if (effectivePlacement === "top") {
            startY = bubbleStyle.top + bubbleBounds.height + outsideOffset;
            endY = highlightRect.top - targetOutsideOffset;
            outwardY = 1;
        }

        if (effectivePlacement === "right") {
            startX = bubbleStyle.left - outsideOffset;
            endX =
                highlightRect.left +
                highlightRect.width +
                targetOutsideOffset;
            outwardX = -1;
        }

        if (effectivePlacement === "left") {
            startX = bubbleStyle.left + bubbleBounds.width + outsideOffset;
            endX = highlightRect.left - targetOutsideOffset;
            outwardX = 1;
        }

        const dx = endX - startX;
        const dy = endY - startY;
        const distance = Math.hypot(dx, dy) || 1;
        const mainX = dx / distance;
        const mainY = dy / distance;
        const normalX = -mainY;
        const normalY = mainX;
        const swayDirection =
            effectivePlacement === "top" || effectivePlacement === "bottom"
                ? dx >= 0
                    ? 1
                    : -1
                : dy >= 0
                  ? -1
                  : 1;
        const sway = clamp(distance * 0.1, 16, 34) * swayDirection;
        const handle = clamp(distance * 0.1, 16, 28);
        const exit = clamp(distance * 0.16, 18, 30);
        const approach = clamp(distance * 0.14, 16, 28);

        const firstTurnX = startX + dx * 0.28 + normalX * sway;
        const firstTurnY = startY + dy * 0.24 + normalY * sway;
        const secondTurnX = startX + dx * 0.72 - normalX * sway * 0.55;
        const secondTurnY = startY + dy * 0.76 - normalY * sway * 0.55;

        const c1x = startX + outwardX * exit + normalX * sway * 0.08;
        const c1y = startY + outwardY * exit + normalY * sway * 0.08;
        const c2x = firstTurnX - mainX * handle - normalX * sway * 0.12;
        const c2y = firstTurnY - mainY * handle - normalY * sway * 0.12;

        const c3x = firstTurnX + mainX * handle + normalX * sway * 0.12;
        const c3y = firstTurnY + mainY * handle + normalY * sway * 0.12;
        const c4x = secondTurnX - mainX * handle + normalX * sway * 0.1;
        const c4y = secondTurnY - mainY * handle + normalY * sway * 0.1;

        const c5x = secondTurnX + mainX * handle - normalX * sway * 0.05;
        const c5y = secondTurnY + mainY * handle - normalY * sway * 0.05;
        const c6x = endX - mainX * approach;
        const c6y = endY - mainY * approach;

        return `M ${startX.toFixed(2)} ${startY.toFixed(2)} C ${c1x.toFixed(
            2,
        )} ${c1y.toFixed(2)}, ${c2x.toFixed(2)} ${c2y.toFixed(2)}, ${firstTurnX.toFixed(
            2,
        )} ${firstTurnY.toFixed(2)} C ${c3x.toFixed(2)} ${c3y.toFixed(
            2,
        )}, ${c4x.toFixed(2)} ${c4y.toFixed(2)}, ${secondTurnX.toFixed(
            2,
        )} ${secondTurnY.toFixed(2)} C ${c5x.toFixed(2)} ${c5y.toFixed(
            2,
        )}, ${c6x.toFixed(2)} ${c6y.toFixed(2)}, ${endX.toFixed(2)} ${endY.toFixed(2)}`;
    }, [bubbleBounds, bubbleStyle, effectivePlacement, highlightRect]);

    if (!mounted || !open || !rect || !highlightRect || !bubbleStyle) {
        return null;
    }

    return createPortal(
        <div className="pointer-events-none fixed inset-0 z-[2000]">
            <div
                className="pointer-events-auto fixed left-0 right-0 top-0 bg-slate-950/80 transition-opacity duration-200 ease-out"
                style={{
                    height: highlightRect.top,
                    opacity: entered ? 1 : 0,
                }}
            />
            <div
                className="pointer-events-auto fixed left-0 bg-slate-950/80 transition-opacity duration-200 ease-out"
                style={{
                    top: highlightRect.top,
                    width: highlightRect.left,
                    height: highlightRect.height,
                    opacity: entered ? 1 : 0,
                }}
            />
            <div
                className="pointer-events-auto fixed bg-slate-950/80 transition-opacity duration-200 ease-out"
                style={{
                    top: highlightRect.top,
                    left: highlightRect.left + highlightRect.width,
                    right: 0,
                    height: highlightRect.height,
                    opacity: entered ? 1 : 0,
                }}
            />
            <div
                className="pointer-events-auto fixed bottom-0 left-0 right-0 bg-slate-950/80 transition-opacity duration-200 ease-out"
                style={{
                    top: highlightRect.top + highlightRect.height,
                    opacity: entered ? 1 : 0,
                }}
            />

            <div
                className="pointer-events-none fixed border-2 border-white/95 transition-all duration-200 ease-out"
                style={{
                    top: highlightRect.top,
                    left: highlightRect.left,
                    width: highlightRect.width,
                    height: highlightRect.height,
                    borderRadius: "calc(var(--app-radius-xl) + 6px)",
                    boxShadow:
                        "0 0 0 1px rgba(255,255,255,0.28), 0 0 24px rgba(255,255,255,0.26)",
                    opacity: entered ? 1 : 0,
                    transform: entered ? "scale(1)" : "scale(0.985)",
                }}
            />

            {arrowPath ? (
                <svg
                    aria-hidden="true"
                    className="pointer-events-none fixed inset-0 h-full w-full overflow-visible"
                    style={{ opacity: entered ? 1 : 0, transition: "opacity 200ms ease-out" }}
                >
                    <defs>
                        <marker
                            id={arrowMarkerId}
                            markerUnits="userSpaceOnUse"
                            markerWidth="8"
                            markerHeight="8"
                            refX="7"
                            refY="4"
                            orient="auto"
                        >
                            <path
                                d="M 0 0 L 8 4 L 0 8 z"
                                fill="rgba(255,255,255,0.95)"
                            />
                        </marker>
                    </defs>
                    <path
                        d={arrowPath}
                        fill="none"
                        markerEnd={`url(#${arrowMarkerId})`}
                        stroke="rgba(255,255,255,0.95)"
                        strokeDasharray="6 7"
                        strokeDashoffset="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="3.4"
                    />
                </svg>
            ) : null}

            <div
                ref={bubbleRef}
                aria-describedby={descriptionId}
                aria-labelledby={titleId}
                className="pointer-events-auto fixed w-[360px] max-w-[calc(100vw-48px)] rounded-[calc(var(--app-radius-xl)+10px)] border border-white/15 bg-slate-950/95 p-6 text-white shadow-[0_26px_70px_rgba(15,23,42,0.55)] backdrop-blur-xl transition-[opacity,transform] duration-200 ease-out"
                role="dialog"
                style={{
                    ...bubbleStyle,
                    opacity: entered ? 1 : 0,
                    transform: entered
                        ? "translate3d(0,0,0)"
                        : "translate3d(0,8px,0)",
                }}
                tabIndex={-1}
            >
                <div className="space-y-3">
                    <div className="text-[11px] font-black uppercase tracking-[0.24em] text-cyan-300">
                        {resolvedStepLabel}
                    </div>
                    <h3 className="text-xl font-bold leading-tight" id={titleId}>
                        {title}
                    </h3>
                    <p className="text-sm leading-6 text-slate-200" id={descriptionId}>
                        {description}
                    </p>
                </div>

                <div className="mt-6 flex flex-wrap items-center gap-3">
                    {onAction ? (
                        <button
                            aria-label={actionAriaLabel}
                            className="inline-flex h-11 items-center justify-center rounded-[var(--app-radius-md)] bg-white px-5 text-sm font-bold text-slate-950 transition-transform duration-150 hover:scale-[1.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80 disabled:cursor-not-allowed disabled:opacity-50"
                            disabled={actionDisabled}
                            onClick={onAction}
                            ref={primaryActionRef}
                            type="button"
                        >
                            {resolvedActionLabel}
                        </button>
                    ) : null}

                    <button
                        aria-label={skipAriaLabel}
                        className="inline-flex h-10 items-center justify-center rounded-[var(--app-radius-md)] border border-white/15 px-4 text-xs font-semibold uppercase tracking-[0.14em] text-slate-300 transition-colors duration-150 hover:border-white/30 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
                        onClick={onSkip}
                        type="button"
                    >
                        {resolvedSkipLabel}
                    </button>
                </div>
            </div>
        </div>,
        document.body,
    );
};

export default SpotlightGuide;
