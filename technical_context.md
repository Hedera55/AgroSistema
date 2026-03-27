## 🏗️ Modularization Strategy (Route Splitting)
To maintain fast compilation (HMR) and readable code, large pages are split "surgically":
- **Pattern**: `src/app/clients/[id]/[page]/components/` contains local modules.
- **Goal**: Keep `page.tsx` under 800-1000 lines as an "orchestrator" of state and handlers.
- **Shared Components**: Move to `src/components/` only when used by 2+ distinct routes.
- **Inline Multistep Wizards**: Complex creation flows (like "New Order" or "New Harvest") must be implemented as inline, conditionally rendered components (e.g., `OrderWizard` or `HarvestWizard`) at the bottom of the main list view (`page.tsx`). Avoid routing to a separate `/new/page.tsx` to maintain context and speed up the user flow.
    - **Smooth Scrolling**: When an inline wizard or detail view is opened, the system should ideally only auto-scroll if it's a creation flow. Detailed views (like `OrderDetailView`) should avoid forced scrolls to prevent user disorientation during row browsing.

## 🎨 Global UI Standard
- **Typography**: Headers must use `slate-900` (Black) and `font-semibold`. Avoid `slate-800` for titles to maintain consistency.
- **Aesthetic Constraints**: **STRICTLY NO RANDOM SHADOWS**. Use `shadow-lg` or `shadow-xl` only on main containers/cards as defined. Headers and inline elements should remain "clean" and text-only.
- **Report Mode Buttons**: Deselected buttons should have a "carved-in" (inset) relief effect using `shadow-inner` and `bg-slate-100` to distinguish them from the active states.
- **Table Footer Patterns**: Pagination controls (e.g., "Cargar 10 más") must be full-width clickable bars (`flex-1`) with a solid `bg-slate-50`. Horizontal scrollbars must appear **above** these footer controls to keep the buttons accessible and fixed.
    - **Implementation Pattern**: For data-heavy lists, use an incremental, state-driven client-side slice:
        1. Initialize a `limit` state (e.g., `const [limit, setLimit] = useState(10)`).
        2. Apply `.slice(0, limit)` to the data array before mapping to JSX.
        3. The "Cargar 10 más" button increments the state (`setLimit(prev => prev + 10)`).
        4. "Ver menos" resets the state to 10 (conditionally shown if `limit > 10`).
- **Inline Details**: When clicking a table row for an item linked to an Order, the `OrderDetailView` should render inline **below** the relevant section (e.g., below the table) rather than in a modal, providing a smoother experience.
- **Segmented Date Inputs**: For high-speed data entry, use a custom joined-box component for dates (DD-MM-YY). 
    - **Logic**: Each segment is physically limited to 2 digits. Typing the 2nd digit triggers an automatic focus jump to the next segment.
    - **Visuals**: Dashes should be used as separators. The container must look like a single standard cohesive input.
- **Campaign UI (Floating Text)**: Campaign rows in lists/management should not use cards. 
    - **Aesthetics**: Clean "floating text" with `border-slate-200` dividers that extend **edge-to-edge**.
    - **Content**: Campaign name (Left) and "Repartición de..." (Right). All text color should be `slate-900` (Black) and font weight `font-medium`.
    - **Interactivity**: Icons (Pencil/X) should only appear in "Gestionar campañas" mode.
- **Border/Shadow**: Prohibited (border-0, shadow-none).
- **Selector Styling Standard**: All `<select>` elements must follow the "Flat/Thin" layout.
    - **Classes**: `w-full px-2 py-0.5 text-sm rounded-lg border border-slate-200 bg-white focus:ring-1 focus:ring-blue-500 outline-none`.
    - **Prohibited**: **STRICTLY NO SHADOWS** or `py-1.5` padding. The height must remain thin (`py-0.5`). No emojis in options. Aria-labels or bold font on selectors should be avoided unless necessary for accessibility.
    - **Label Formatting**: 
        - **Seeds/Grains**: `Active Ingredient (Commercial Name) (Brand)`.
        - **Others**: `Commercial Name (Active Ingredient) (Brand)`.
    - **Form Element Fonts**: Prevent default browser fonts (like Times New Roman) from overriding form elements by enforcing `font-family: inherit !important;` in `globals.css` and setting the CSS variable `--font-sans` in `layout.tsx`.
- **Horizontal Scrolling Standard**: All large tables MUST use the `useHorizontalScroll` React hook attached to their container. 
    - **Behavior**: This ensures that horizontal scrolling with the mouse wheel is correctly captured without causing undesired vertical page jumping (scroll leakage).
    - **Implementation**: The container should have `overflow-x-auto` and the `ref` from the hook.
- **Table Cell Alignment**: 
    - **Centered**: Numerical columns (Labor Cost, USD totals), counts, and Status badges must be centered (`text-center`) for visual balance.
    - **Right-Aligned**: Only weights (Kg/Tons) should remain right-aligned for digit alignment.
- **Aesthetic Refinement (The "Sunk-in" Look)**: When a "sunken" or recessed effect is requested for inputs, use a centered inset shadow (e.g., `!shadow-[inset_0_0_6px_rgba(0,0,0,0.25)]`) and a transparent border (`!border-transparent`).
- **Override Note**: Many times, default component styles (like `shadow-sm` or `border-slate-200`) in the base `Input.tsx` are very "sticky". You MUST use the `!` modifier (e.g., `!shadow-...`) for custom formatting to take effect.

### Layout & Width Standards
- **Standard Width**: Most pages MUST follow a `max-w-7xl mx-auto` constraint to maintain a clean, centered reading column and consistent alignment.
- **Extended Width (Data-Heavy Tables)**: For pages with high horizontal data density (e.g., Stock History), the preferred pattern is to bypass the `7xl` constraint to prevent row overcrowding.
    - **Implementation**: In `Layout.tsx`, use a conditional check on `pathname` to apply `w-full` instead of the standard `max-w-7xl mx-auto`.
    - **Rule**: This "surgical expansion" should only be applied to routes that explicitly require it, ensuring that the general navigation experience remains stable and predictable.

- **Numerical Notation (Spanish/Argentine)**:
    - **Entry**: All numeric inputs MUST support comma (`,`) as the decimal separator and dot (`.`) as thousands separator.
    - **Implementation**: 
        - Use `type="text"` combined with `inputMode="decimal"`.
        - **Standard Utility**: Use `normalizeNumber` from `@/lib/numbers.ts`. Avoid ad-hoc `.replace(',', '.')` calls to ensure thousands separators are also correctly handled.
    - **Display**: All numeric values displayed in the UI should be formatted using `.toLocaleString('es-AR')` or similar to respect local formatting.

- **Stock History Subrows (Expandable Rows)**: 
    - **Trigger**: Clicking a row in the Stock History table toggles its expanded state.
    - **Visuals**: The expanded area must use a slightly grayer background (e.g., `bg-slate-100/60`) and include bold, uppercase subtitle rows: `PRODUCTOS` and `PAGADO POR`. 
    - **Content**: Displays detailed `MovementItem` lists and the breakdown of participating partners.

- **Action Buttons (Movement/Sale)**: All primary floating panel confirmation buttons (e.g., "Confirmar Venta", "Confirmar Retiro") must use `size="sm"` for a compact, professional look. 
    - **Vender**: Emerald theme (`bg-emerald-600`).
    - **Mover**: Orange theme (`bg-orange-600`).

### Movement & Harvest Details UI
- **Grid Layout**: Uses a 3-row grid for better data hierarchy:
  - Row 1: `Fecha de cosecha/movimiento` | `Campaña`
  - Row 2: `Insumo - Nombre Comercial` | `Rinde total / Cantidad`
  - Row 3: `Contratista / Chofer` | `Costo Labor / Flete` | `Pagado por`
- **Label Colors**: Labels use `text-slate-400` while values use `text-slate-700` and `font-bold` for high contrast.
- **Backgrounds**: Avoid full-section gray backgrounds (`bg-slate-50`) inside detail drawers to keep them integrated with the white floating panel look.
- **Harvest Branding Convention**: For harvests marked as "Propia" (own seed/grain), the **Brand** (Marca) field MUST be set to the **Campaign Name** (e.g., "24 25"). This ensures that physical stock from different campaigns is correctly segregated and accounted for in the inventory without requiring separate product IDs.

### Stock Vender Box (`StockTable.tsx` / `StockSalePanel.tsx`)
- **Square Buttons**: Fixed action buttons to `h-10 w-10` square format.
- **Note Input Flow**: The note `textarea` is now rendered *after* the action row in the JSX to ensure it appears below the "Agregar Nota" button.
- **Input Height Standard**: Note input boxes (e.g., in `StockSalePanel.tsx`) should be compact to save vertical space.
    - **Standard**: `rows={2}` and `min-h-[60px]` (or `h-12` for single-line expandable inputs).

### Reusable Investor Selector (`InvestorSelector.tsx`)
- **Purpose**: A unified component for selecting multiple partners and assigning percentage shares.
- **Location**: `src/components/InvestorSelector.tsx`.
- **Validation**: Includes a real-time warning if the total percentage deviates from 100%.
- **Layout**: In complex forms (like New Order), it should be placed in its own **full-width row** to prevent UI congestion.

### Stock Entry Form Logic
- **Auto-Calculation**: The form must automatically update the `Total Quantity` based on the formula: `Presentation Content` × `Physical Amount`.
- **Filtering**: `availableProducts` in the stock entry form must be filtered by the current `clientId` to prevent cross-client data selection.
- **Autocomplete (Presentations)**: The "Presentación" field must provide an autocomplete dropdown suggesting `standardPresentations` from the product catalog. Selecting an option automatically populates both the label and content fields.

## Navigation & Order Logic

### 🛡️ Exact ID Persistence (Editing Reliability)
- **Problem**: Previously, editing an order used "Property-based Reverse Matching" (`productId`, `warehouseId`, `presentation`). This was ambiguous if multiple batches existed or if a quantity was zero, leading to "phantom duplicates" or missing values in the edit flow.
- **Solution**: Transitioned to **Deterministic ID Tracking**:
    - **Implementation**: The `OrderItem` type now includes a `stockId`. 
    - **Creation**: When an item is added to an order, it is stamped with the unique `stockId` from the original stock record.
    - **Editing**: The system uses `st.id === i.stockId` as the **primary lookup** to reload multipliers.
    - **Fallback**: Property-based matching is only used as a fallback for historical orders (backward compatibility).

### Stock History Navigation
- **Direct Jump**: Clicking on **E-SIEMBRA** or **E-APLICACIÓN** rows MUST directly open the `OrderDetailView`.
- **Movement Hierarchy**: `MovementDetailsView` is reserved for transfers, withdrawals, or sub-movements that do not constitute a primary work event.
- **Redundancy**: The "Ver Orden Vinculada" button is prohibited in `MovementDetailsView` to ensure a direct, single-modal interaction flow.
- **Dropdown Fallback Pattern**: When a saved field (e.g., Campaign, Investor, Partner) contains a value not found in the current fetched list (due to archiving or deletion), the system MUST implement a "Fallback Option" pattern.
    - **Logic**: Use a `useMemo` to check if the `selectedId` exists in the `fetchedData`. If not, temporarily inject an object `{ id: selectedId, name: selectedName || selectedId }` into the options array for the component.
    - **Benefit**: Ensures the UI remains consistent and the "Selected" state is visible even for historical data.

## 📊 Financial Reporting & Accounting Rules

### Direct Monetary Expenses (Empresa)
- **Definition**: The "Empresa" (Company) level accounting strictly reflects **external monetary transactions**. 
- **Inclusions**: Direct Purchases (`PURCHASE`) and Hired Services (`SERVICE`) where cash or debt is exchanged with a third party.
- **Exclusions**: Internal Stock Consumption (Cost) used in `Orders` is **EXCLUDED** from the main accounting summary to avoid inflating total expenditure with internal movements.
- **Valuation (Stock/Harvests)**: Uses **Weighted Average Sale Price (WASP)** of the *Product* (Active Ingredient) across all brands.
- **Consumption (Internal Orders)**: Uses **Weighted Average Purchase Price (PPP)** of the *Product* across all brands.

### Investor Split Handling (Splits)
- **Core Requirement**: All financial summaries and stock deductions must process the `investors` array within movements and orders to distribute amounts proportionally.
- **Logic**: If an item has multiple investors (e.g., 95% Pichetto / 5% Tornado), the total amount must be multiplied by each percentage before being attributed to the partner's balance.
- **UI Representation**: 
    - **"MÚLTIPLES"**: Use this label in table columns when more than one investor/item is involved. 
    - **Styling**: Same font size as normal text, dark slate color (`text-slate-600`), and centered if within a numerical column.
    - **Sub-rows**: Provide an expandable sub-row to show individual distributions (Names + Percentages).
- **Fallback**: If the `investors` array is missing or empty, the system must fallback to the legacy single `investorName` field (Defaulting to 100% share).

### "Sin Asignar" (Unassigned) Logic
- **Expenditure Only**: The "Sin Asignar" category is restricted to only bearing direct expenses. 
- **Profit Exclusion**: It is explicitly forbidden from participating in "Participación saldo de la empresa" (Sale profit distribution). Sales revenue is only distributed among defined partners.
- **Normalization**: Partner names must be normalized via helper functions to handle JSON-encoded names and consolidate case-insensitive "Sin Asignar" or "Sin_Asignar" strings.

### Filtering Consistency
- **Detailed Ledger Summary**: When filtering the detailed ledger by a specific partner, the summary boxes at the top (Expenditure/Income) MUST calculate based on that partner's **proportional stake** of the filtered rows, not the full row totals.

### Campaign Modes & Accounting
- **Three Campaign Modes**: Each campaign has a `mode` field: `MONEY`, `GRAIN`, or `MIXED`.
  - **`MONEY` (Saldo Monetario)**: Pure monetary balance. Expenses are subtracted, sale revenue is added, and the resulting balance is split among partners by their participation percentage.
  - **`GRAIN` (Granos)**: Physical grain participation. Harvested quantities are assigned to partners by their percentage stake. Withdrawals (`OUT` movements) deduct from the partner's assigned grain balance.
  - **`MIXED` (Mixta — Granos + Saldo)**: From the total harvest, a portion is sold. The sale revenue becomes monetary balance. Whatever grain is **not** sold is partitioned physically among the investors by their participation percentage. Partners receive both a monetary split (from sales) and a physical grain split (from unsold stock).
- **UI Label**: The campaign list displays "Repartición de Saldo Monetario", "Repartición de Granos", or "Repartición de Mixta" depending on the mode.
- **Consolidated View**: When viewing "Todas las Campañas", the table displays:
  - **Main Rows**: Aggregated monetary investment and "Saldo Monetario" (from `MONEY` campaigns).
  - **Detailed Rows (per Crop)**: Physical totals of "Cosecha Asignada" and "Cosecha Retirada" (from `GRAIN` campaigns).
- **Proportional Assignment**: In `GRAIN` mode, physical grain quantities are assigned to partners based on their **percentage stake in that specific campaign's investment**, not their global percentage.
- **Withdrawals (Retiros)**: Physical withdrawals (`OUT` movements) are deducted from the partner's assigned grain balance for the specific crop and campaign.
- **Revenue Attribution**: Sales revenue from grain is attributed to campaigns by matching the `campaignId` of the stock being sold.

### Pricing Logic & Fallbacks
- **Actual Transactions**: Sales and Purchases use their specific confirmed invoice prices.
- **Robust Fallbacks (Propia)**: To handle items with unique IDs but no history (e.g. "Soja Propia"), the system aggregates pricing by **Product Name / Crop** as well.
    - *Priority*: Specific ID Price -> Generic Name Price -> Manual Reference.
- **True PPP per Presentation**: Stock valuation uses a **Weighted Average Purchase Price (PPP)** computed per specific presentation (`presentationLabel` + `presentationContent`). 
    - **Normalization**: All PPP values are calculated and stored as **USD per Unit (Kg/L)**. This ensures that a 1KG bag's overhead/price doesn't disproportionately affect the valuation of bulk stock.
    - **Valuation Rule**: Purchases dictate PPP. Only own harvest (Propia brand grains/seeds) use Sales averages (WASP).
- **Global Terminology**: **"Producto"** is deprecated and replaced by **"Insumo"** in all user-facing labels and component documentation to better reflect agricultural data usage.
- **Obsolescence**: "Catalog Price" (`product.price`) is deprecated and removed.

## 📦 Campaign Snapshots & Integrity
### Campaign Snapshots
- **Definition**: A "frozen" cache of all stock levels and partner balances at the moment of closing a campaign.
- **Purpose**: Prevents expensive "beginning-of-time" recalculations by providing a verified starting point for the following campaign.
- **Schema**: Stored in `campaign_snapshots` table, indexed by `campaignId` and `clientId`.

### Deep Recalculation ("Recalcular Fuerte")
- **Logic**: Implements an **Event Sourcing** pattern for data recovery.
- **Process**:
    1. Wipes the current `stock` tables for a client.
    2. Restores the state from the last valid `CampaignSnapshot` (unless "Desde cero" is selected).
    3. Re-processes every historical `Movement` chronologically.
- **Granularity Rules**: During replay, items MUST be matched using: `productId` + `warehouseId` + `productBrand` + `campaignId` + `presentationLabel` + `presentationContent`. Ignoring brand or campaign during aggregation leads to stock corruption.
- **"Desde cero" (Start from Zero)**: Allows rebuilding the cache from the very first movement, ignoring all snapshots. This is the ultimate "fix-all" for state inconsistencies.

## 🛡️ Distributed Entity Initialization
- **Problem**: When multiple users/tabs initialize the same company (e.g., during first login), race conditions can lead to duplicate "Default" entities (like Warehouses or Folders) if random UUIDs are used.
- **Solution (Deterministic IDs)**: Initialization logic MUST use deterministic IDs derived from the parent entity (e.g., `wh-harvest-${clientId}`).
- **Upsert Pattern**: By using a predictable ID, concurrent initialization attempts will result in a database **UPSERT** rather than a duplication, ensuring that only one set of default records exists across all synced clients.
- **Auto-Cleanup**: When detecting existing duplicates (from legacy random IDs), implement a "Safe Deduplication" routine that marks empty records (no stock, no movements) as deleted.

## 🛠️ Infrastructure & Sync
- **Invalid UUIDs**: The sync service (`sync.ts`) automatically cleans up legacy local IDs (e.g., "grain-soja") to prevent Supabase type errors.
- **Registration Schema Integrity**: The database schema MUST align with the fields used in registration triggers and frontend forms.
- **Timestamp Normalization & Sorting**: 
    - **Standard**: All dates must be normalized to `YYYY-MM-DD` and all times to `24h` format (`HH:mm`) before sorting. This ensures robust string comparison (`date + 'T' + time`).
- **Orphan Handling & RLS**: 
    - **Sync Strategy**: When local records reference IDs that no longer exist (e.g., a Lot deleted on the server), the sync service must catch the `fkey` violation error, log a warning, and skip the specific invalid record instead of stopping the entire sync process.
    - **Self-Healing**: Ideally, the system should flag these orphans for review or mark them as "Archived" rather than allowing hard crashes in the React state lifecycle.

## 📦 Stock & Inventory System (Fast Cache Table)
- **Fast Cache Role**: The `stock` table acts as a denormalized **"Fast Cache"** (technically a **Materialized View** or **Read-Model**) of all current inventory totals. It is optimized for instant reading in the Galpón UI.
- **ID-Based Deduction**: Movements now target specific stock records (presentations) instead of using a generic product-level FIFO.
- **Unit Multipliers**: Input fields in the movement panel act as multipliers for presentation contents (e.g., 2 units of a 100L tank = 200L).
- **Reactive Deletion**: Deleting a record from the history (`movements`) automatically performs an incremental mathematical adjustment on the `stock` table (Inverse Logic). 
    - *Example*: Deleting a 100L Sale adds 100L back to the cache; deleting a 50kg Purchase subtracts 50kg.
- **Negative Stock Support**: Stock balances can now go negative to track usage before purchase records are uploaded.
- **Deduction Logic**: When deducting stock for Orders, the system **MUST** use the `warehouseId` defined at the **item level** (if present) rather than the Order's general warehouse ID.

### Metadata Enrichment Pattern (Display-Time Consistency)
- **Problem**: Movement records often lack `productCommercialName` and sometimes `productBrand` because the harvest/purchase flows don't always persist these fields. The `stock` table does store them, but the `movements` table is the source for the History view.
- **Solution**: All views that display movements (History, Admin Tables) must **enrich at display time** using the Product Catalog as the source of truth.
- **Enrichment Rules**:
  1. **Harvest items** (`type === 'HARVEST'`, `source === 'HARVEST'`, or product type `GRAIN`/`SEED`):
     - **Brand** → stored value, fallback to **Campaign Name** (`campaigns.find(c => c.id === m.campaignId)?.name`).
     - **Commercial Name** → stored value, fallback to **"Propia"**.
  2. **Purchased items**: 
     - **Brand** → stored value, fallback to catalog's `brandName`.
     - **Commercial Name** → stored value, fallback to catalog's `commercialName`.
- **Affected Files**: `stock/history/page.tsx` (main rows + expanded sub-items), `admin/tables/page.tsx` (stock view enrichment in `loadData`).
- **Key Principle**: The `productId` is the chain of consistency. All metadata (brand, commercial name) is derived from associating that ID with the Product Catalog. Views should never rely solely on what the movement record stored.
## 🌾 Harvest Data Integrity & Persistence
- **State Shadowing**: Avoid creating "lite" versions of the Harvest Wizard (e.g., side-panel forms). Always use the full `HarvestWizard` component to ensure all metadata (transport sheets, contractors) is correctly managed and aggregated.
- **Aggregation Pattern**: When editing an event composed of multiple movements (like a multi-destination harvest), ALWAYS aggregate all sub-items (e.g., `transportSheets`) before populating the edit wizard. Failure to do so leads to data loss for all but the first movement.
- **Save Priority (The Spread Rule)**: When updating historical movements that contain a `logistics` object, always spread the legacy logistics **FIRST**, and then apply updated metadata (Contractor, Price, Sheets). Spreading logistics last will clobber any fresh user input with stale data.
- **Locale-Aware Parsing**: All agricultural labor prices MUST be parsed using a utility that handles both `.` and `,` as decimal separators to support the Spanish/Argentine standard. Prefer `val.replace(/\./g, '').replace(',', '.')` before calling `parseFloat`.
- **Sync Parity**: Every harvest-related field added to the database must have a corresponding mapping in *both* directions within `sync.ts` (forward and reverse mappers) to prevent "flickering" or data loss upon page reload.
- **Harvest Deletion & Lot State Reversion**:
    - **IDs**: Each harvest event generates a unique `harvestBatchId` (stored in `InventoryMovement` and `Order`) and updates the lot's `lastHarvestId`.
    - **Current Harvest**: If the deleted movement's `harvestBatchId` matches the lot's `lastHarvestId`, the system performs a **full reversion**:
        - Reverts stock for all items in the batch.
        - Soft-deletes all associated movements and the unique harvest `Order`.
        - Reverts the lot status to `SOWED` (Sembrado) and clears `observedYield` and `lastHarvestId`.
    - **Historicals**: Deleting a historical harvest (that no longer matches `lastHarvestId`) is **blocked** to prevent state corruption.
    - **User Alert**: "No se puede. Opción: Editar el rinde total a 0". This preserves history while allowing for correction.

## 👥 User Roles & Permissions
- **CONTRATISTA**: Can only see orders where `applicatorId` matches their internal `profileId`.
    - **Sidebar "Green List"**: Displays a list of assigned companies directly in the sidebar for quick navigation to filtered orders.
    - **Display Name Fallbacks**: When displaying contractor names, the system follows this priority: `username` -> `email` -> `ID (truncated)`. This ensures that even users with incomplete profiles (missing username) are distinguishable in dropdowns and lists.
- **CLIENT**: Read-only access to most management features. Supplements: suppresses all CREATE/UPDATE/DELETE.
- **MASTER_ADMIN**: Full access to all clients and settings.

## 🗺️ Map & Geo-Data Architecture

### Public vs. Internal Map Logic
- **Internal Map**: Powered by **IndexedDB** local cache (via `SyncService`). 
    - **Reasoning**: Field work often occurs in areas with poor connectivity. Using a local IndexedDB store ensures **instant rendering** and extreme speed when handling large GeoJSON boundaries for multiple farms and lots, eliminating network latency during navigation.
- **Public Map**: Powered by **Direct Supabase Fetches**.
    - **Reasoning**: Designed for lightweight, one-off guest access (QR codes). Because external users do not have a synchronized local database, the system fetches data on-the-fly directly from Supabase, balancing simplicity for the guest with consistency for the owner.

### Hydration & Public Route Verification
- **Problem**: Next.js hydration errors can occur if the server and client render different initial HTML (e.g., a global loading spinner shown on the client but not the server).
- **Rule**: The root `Layout.tsx` MUST prioritize public route checks (`/login`, `/kml`, `/public/map/`) before rendering the global `loading` state.
- **Implementation**:
    - Identify public routes using `pathname.startsWith` or `pathname.includes`.
    - Return `children` immediately for these routes to ensure consistent SSR/CSR output.
- **Benefit**: Prevents "Hydration failed" crashes in private windows and ensures immediate access to public-facing reports and login screens.

## 📍 QR & KML System
- **QR Target**: Scans point to the Public Map page `${window.location.origin}/public/map/[clientId]?orderId=...` (or the direct KML download route if legacy).
- **Server Route (Direct Download)**: `src/app/kml/[lotId]/route.ts` — a Next.js API Route (not a page).
    - Uses a **service-role Supabase client** (`SUPABASE_SERVICE_KEY` in `.env.local`) to bypass RLS.
    - Returns the KML file directly with `Content-Disposition: attachment`.
    - **Note**: Supabase columns are snake_case (`kml_data`), not camelCase.

### PDF & Report Generation Standards
- **Header Labels**: 
    - **Order PDF**: Use "FECHA PLANEADA:" instead of "FECHA DE APLICACIÓN:".
    - **Document ID**: Include the Order/Remito ID in the document title at the top right.
- **Table Layouts**: 
    - **Consolidated Locations**: Use a two-column "Lotes" layout where the left column specifies the label and the right column contains a merged string of all lots (e.g., "Lot A, Lot B") to save vertical space.
    - ** Agricultural Responsibility**: Merge the location info and technical responsibility into a single, cohesive layout block to improve whitespace management.
- **Currency Standard**: Use **"USD"** consistently across all reports and UI labels instead of the generic "$" symbol to avoid region-specific confusion.

## 📖 Documentation
- **Technical Context**: Located in `.gemini/antigravity/brain/` (this file).
- **Knowledge Base**: `knowledge.md` is located in the **apps main folder**.
