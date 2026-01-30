# Galpones Selection Fix Documentation

## Incident Description
The "Galpones" (Warehouse) selection logic was malfunctioning. Specifically:
1.  The requirement was to allow selecting a warehouse, but also "deselect" it (close the edit view) when clicking outside the warehouse list.
2.  After editing the page, the user could not select a warehouse.
3.  Clicking "Abrir" or "Editar" would trigger an immediate deselect or selection glitch.

## Root Cause
The initial implementation of "Click Outside" logic relied on:
1.  A `useEffect` listening to `click` on `document`.
2.  `e.stopPropagation()` on the warehouse card's `onClick`.

This failed because:
-   **Propagation Handling**: React's `onClick` is synthetic. Stopping propagation in React logic doesn't always prevent the native `document` listener from firing, especially if the listeners are attached differently.
-   **Event Conflict**: We had both `mousedown` and `click` listeners attached at one point, causing race conditions or "detach" issues where the clicked element was removed from the DOM (re-render) before the `contains` check could verify it was "inside" the container.

## The Solution

We implemented a robust pattern using `useRef` and `mousedown`.

### 1. Add a Ref to the Container
We attached a `ref` to the parent container of the warehouse list. This gives us a stable reference to the "safe zone" where clicks are allowed.

```typescript
// In ClientStockPage component
const warehouseContainerRef = useRef<HTMLDivElement>(null);

// In JSX
<div className="space-y-3" ref={warehouseContainerRef}>
    {warehouses.map(w => ( ... ))}
</div>
```

### 2. Use `mousedown` for Outside Detection
We switched from `click` to `mousedown` for the document listener. `mousedown` fires **before** `click` and before state changes might unmount/remount components. This ensures the `event.target` is still in the DOM when we check `contains`.

```typescript
// Clear selection on click outside
useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
        // Check if the ref exists AND if the click target is NOT inside the container
        if (warehouseContainerRef.current && !warehouseContainerRef.current.contains(event.target as Node)) {
            setSelectedInManagerId(null); // Deselect Logic
        }
    };

    // Use mousedown to capture the event before click logic might detach DOM elements
    document.addEventListener('mousedown', handleClickOutside);
    
    // cleanup
    return () => document.removeEventListener('mousedown', handleClickOutside);
}, []);
```

### 3. Remove `stopPropagation`
We removed `e.stopPropagation()` from component `onClick` handlers. It is no longer needed because the `handleClickOutside` logic explicitly checks `ref.contains(target)`. If the target is inside the ref, the "outside" logic simply returns false and does nothing, allowing the inner `onClick` to proceed naturally.

This pattern is cleaner, closer to native DOM behavior, and resilient to React re-renders.
