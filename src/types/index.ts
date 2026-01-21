export type UserRole = 'MASTER_ADMIN' | 'ADMIN' | 'CLIENT';

export interface UserProfile {
    id: string; // Supabase UID
    email: string;
    username?: string;
    role: UserRole;
    assigned_clients?: string[]; // IDs of clients for ADMIN role
}

// --- Location Entities ---

export interface Client {
    id: string; // UUID
    name: string;
    email?: string;
    phone?: string;
    synced?: boolean;
    createdAt?: string;
    updatedAt?: string;
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
    dosage: number; // Amount per hectare
    unit: Unit;
    totalQuantity: number; // dosage * area
    loadingOrder?: number; // Order of tank loading (caldo)
}

export interface InventoryMovement {
    id: string;
    clientId: string;
    productId: string;
    productName: string;
    type: 'IN' | 'OUT';
    quantity: number;
    unit: Unit;
    date: string; // ISO date-time string
    time?: string;
    referenceId: string; // ID of the Order or Purchase event
    notes?: string;
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

    // Details
    treatedArea: number; // Hectares
    items: OrderItem[];

    // Execution
    applicatorName?: string; // Contratista
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
