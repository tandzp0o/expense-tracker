import { useEffect } from "react";

let activeLocks = 0;
let lockedScrollX = 0;
let lockedScrollY = 0;

let previousBodyStyles: {
    overflow: string;
    position: string;
    top: string;
    left: string;
    right: string;
    width: string;
    touchAction: string;
    overscrollBehavior: string;
    paddingRight: string;
} | null = null;

let previousDocumentStyles: {
    overflow: string;
    overscrollBehavior: string;
} | null = null;

export const useLockBodyScroll = (locked: boolean) => {
    useEffect(() => {
        if (!locked || typeof document === "undefined" || typeof window === "undefined") {
            return;
        }

        const body = document.body;
        const documentElement = document.documentElement;

        activeLocks += 1;

        if (activeLocks === 1) {
            lockedScrollX = window.scrollX;
            lockedScrollY = window.scrollY;

            previousBodyStyles = {
                overflow: body.style.overflow,
                position: body.style.position,
                top: body.style.top,
                left: body.style.left,
                right: body.style.right,
                width: body.style.width,
                touchAction: body.style.touchAction,
                overscrollBehavior: body.style.overscrollBehavior,
                paddingRight: body.style.paddingRight,
            };

            previousDocumentStyles = {
                overflow: documentElement.style.overflow,
                overscrollBehavior: documentElement.style.overscrollBehavior,
            };

            const scrollbarWidth = Math.max(window.innerWidth - documentElement.clientWidth, 0);

            documentElement.style.overflow = "hidden";
            documentElement.style.overscrollBehavior = "none";

            body.style.overflow = "hidden";
            body.style.position = "fixed";
            body.style.top = `-${lockedScrollY}px`;
            body.style.left = `-${lockedScrollX}px`;
            body.style.right = "0";
            body.style.width = "100%";
            body.style.touchAction = "none";
            body.style.overscrollBehavior = "none";
            body.style.paddingRight = scrollbarWidth > 0 ? `${scrollbarWidth}px` : "";
        }

        return () => {
            activeLocks = Math.max(activeLocks - 1, 0);

            if (activeLocks > 0) {
                return;
            }

            if (previousDocumentStyles) {
                documentElement.style.overflow = previousDocumentStyles.overflow;
                documentElement.style.overscrollBehavior =
                    previousDocumentStyles.overscrollBehavior;
            }

            if (previousBodyStyles) {
                body.style.overflow = previousBodyStyles.overflow;
                body.style.position = previousBodyStyles.position;
                body.style.top = previousBodyStyles.top;
                body.style.left = previousBodyStyles.left;
                body.style.right = previousBodyStyles.right;
                body.style.width = previousBodyStyles.width;
                body.style.touchAction = previousBodyStyles.touchAction;
                body.style.overscrollBehavior = previousBodyStyles.overscrollBehavior;
                body.style.paddingRight = previousBodyStyles.paddingRight;
            }

            window.scrollTo(lockedScrollX, lockedScrollY);
        };
    }, [locked]);
};
