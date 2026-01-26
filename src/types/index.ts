export type UserRole = 'MASTER_ADMIN' | 'ADMIN' | 'CLIENT' | 'CONTRATISTA';

export interface UserProfile {
    id: string; // Supabase UID
    email: string;
    username?: string;
    role: UserRole;
    cuit?: string;
    assigned_clients?: string[]; // IDs of clients for ADMIN/CONTRATISTA role
}

// --- Location Entities ---

export interface Client {
    id: string; // UUID
    name: string;
    email?: string;
    phone?: string;
    cuit?: string; // Government ID
    synced?: boolean;
    createdAt?: string;
    updatedAt?: string;
}

export interface Warehouse {
    id: string;
    clientId: string;
    name: string;
    createdAt?: string;
    updatedAt?: string;
    synced?: boolean;
}

export interface Farm { // Campo
    id: string;
    clientId: string;
    name: string;
    location?: { lat: number; lng: number }; // General centroid
    boundary?: GeoJSON.FeatureCollection | string;
    createdBy?: string;
    lastUpdatedBy?: string;
    createdAt?: string;
    updatedAt?: string;
    synced?: boolean;
}

export interface Lot { // Lote
    id: string;
    farmId: string;
    name: string;
    hectares: number;
    boundary?: GeoJSON.FeatureCollection | string; // KML content or GeoJSON
    createdBy?: string;
    lastUpdatedBy?: string;
    createdAt?: string;
    updatedAt?: string;
    synced?: boolean;
}

export interface Environment { // Ambiente (within a lot)
    id: string;
    lotId: string;
    name: string; // e.g., "Loma", "Bajo"
    hectares: number;
}

// --- Inventory ---

export type ProductType = 'HERBICIDE' | 'FERTILIZER' | 'SEED' | 'FUNGICIDE' | 'INSECTICIDE' | 'OTHER';
export type Unit = 'L' | 'KG' | 'UNIT';

export interface Product {
    id: string;
    clientId?: string; // Optional: if missing, it's global; if present, it's client-specific
    name: string;
    brandName?: string;
    type: ProductType;
    unit: Unit;
    activeIngredient?: string;
    concentration?: string; // e.g., "30%"
    synced?: boolean;
    createdAt?: string;
}

// "Galpón Virtual" (Stock)
export interface ClientStock {
    id: string;
    clientId: string;
    warehouseId?: string; // For multi-galpón support
    productId: string;
    quantity: number; // Current balance
    lastUpdated: string; // ISO Date
    updatedAt?: string; // To align with other entities
    synced?: boolean;
}

// --- Orders ---

export type OrderType = 'SPRAYING' | 'SOWING';
export type OrderStatus = 'DRAFT' | 'PENDING' | 'CONFIRMED' | 'DONE';

export interface OrderItem {
    id: string;
    productId: string;
    productName: string; // Cached for offline display
    brandName?: string;  // Cached for PDF
    activeIngredient?: string; // P.A. cached for PDF
    dosage: number; // Amount per hectare
    unit: Unit;
    totalQuantity: number; // dosage * area
    loadingOrder?: number; // Order of tank loading (caldo)
}

export interface InventoryMovement {
    id: string;
    clientId: string;
    warehouseId?: string; // Origin/Destination warehouse
    productId: string;
    productName: string;
    type: 'IN' | 'OUT';
    quantity: number;
    unit: Unit;
    date: string; // ISO date-time string
    time?: string;
    referenceId: string; // ID of the Order or Purchase event
    notes?: string;
    facturaImageUrl?: string; // URL to uploaded invoice/receipt image
    createdBy?: string; // User ID/Name
    createdAt?: string;
    updatedAt?: string;
    synced?: boolean;
}

export interface Order {
    id: string;
    orderNumber?: number;
    type: OrderType;
    status: OrderStatus;
    date: string; // ISO Date of creating/planning
    time?: string; // Time of day (HH:mm)

    // Relations
    clientId: string;
    farmId: string;
    lotId: string;
    warehouseId?: string; // Origin warehouse

    // Details
    treatedArea: number; // Hectares
    items: OrderItem[];

    // Execution
    applicatorId?: string; // Link to profile id
    appliedAt?: string;
    appliedBy?: string; // Name for audit trail
    applicatorName?: string; // Legacy/Display name
    applicationStart?: string; // ISO Date for range
    applicationEnd?: string;   // ISO Date for range
    notes?: string;
    createdBy?: string;

    // Sync
    createdAt: string;
    updatedAt: string;
    updatedBy?: string;
    synced: boolean;
}

export interface OrderActivity {
    id: string;
    orderId: string;
    orderNumber?: number;
    clientId: string;
    action: 'CREATE' | 'STATUS_CHANGE' | 'DELETE';
    description: string;
    userName: string;
    timestamp: string;
    synced?: boolean;
}

export interface Observation {
    id: string;
    clientId: string;
    farmId: string;
    lotId?: string; // Optional: can be a general farm observation
    userName: string;
    date: string; // ISO Date
    comments: string;
    createdAt: string;
    synced?: boolean;
    deleted?: boolean;
    deletedBy?: string;
    deletedAt?: string;
}
