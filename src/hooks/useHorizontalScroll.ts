import { useRef, useCallback } from "react";

export function useHorizontalScroll() {
    const cleanupRef = useRef<(() => void) | null>(null);

    const ref = useCallback((node: HTMLDivElement | null) => {
        // Cleanup previous listener if exists
        if (cleanupRef.current) {
            cleanupRef.current();
            cleanupRef.current = null;
        }

        if (node) {
            const onWheel = (e: WheelEvent) => {
                if (e.deltaY === 0) return;
                e.preventDefault();
                node.scrollTo({
                    left: node.scrollLeft + e.deltaY,
                    behavior: "auto"
                });
            };

            node.addEventListener("wheel", onWheel, { passive: false });

            // Store cleanup for next time
            cleanupRef.current = () => {
                node.removeEventListener("wheel", onWheel);
            };
        }
    }, []);

    return ref;
}
