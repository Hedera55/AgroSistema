export type UserRole = 'MASTER_ADMIN' | 'ADMIN' | 'CLIENT' | 'CONTRATISTA';

export interface UserProfile {
    id: string; // Supabase UID
    email: string;
    username?: string;
    role: UserRole;
    assigned_clients?: string[]; // IDs of clients for ADMIN/CONTRATISTA role
    cuit?: string;
}

export interface OrderInvestor {
    name: string;
    percentage: number;
}

// --- Location Entities ---

export interface Client {
    id: string; // UUID
    name: string;
    email?: string;
    phone?: string;
    cuit?: string; // Government ID
    investors?: { name: string; percentage: number }[]; // Legacy/To be removed
    partners?: { name: string; cuit?: string }[]; // List of available partner objects for expenditures
    defaultHarvestWarehouseId?: string;
    campaigns?: Campaign[]; // List of available campaigns
    synced?: boolean;
    enabledUnits?: string[];
    enabledSellers?: string[];
    warehouseOrder?: string[];
    createdAt?: string;
    updatedAt?: string;
    deleted?: boolean;
    deletedBy?: string;
    deletedAt?: string;
}

export interface Warehouse {
    id: string;
    clientId: string;
    name: string;
    createdAt?: string;
    updatedAt?: string;
    synced?: boolean;
    deleted?: boolean;
    deletedBy?: string;
    deletedAt?: string;
}

export interface Farm { // Campo
    id: string;
    clientId: string;
    name: string;
    address?: string;
    city?: string;
    province?: string;
    location?: { lat: number; lng: number }; // General centroid
    boundary?: GeoJSON.FeatureCollection | string;
    kmlData?: string; // Original KML file content for download
    createdBy?: string;
    lastUpdatedBy?: string;
    createdAt?: string;
    updatedAt?: string;
    synced?: boolean;
    deleted?: boolean;
    deletedAt?: string;
    deletedBy?: string;
}

export type LotStatus = 'EMPTY' | 'NOT_SOWED' | 'SOWED' | 'HARVESTED';

export interface Lot { // Lote
    id: string;
    clientId?: string; // Appended for global sync requirements
    farmId: string;
    farmName?: string; // Optional: field to store the resolved farm name for reports/PDFs
    name: string;
    hectares: number;
    cropSpecies?: string; // e.g., "SOJA", "MAIZ"
    yield?: number; // Expected yield
    observedYield?: number; // Actual yield after harvest
    status?: LotStatus;
    lastHarvestId?: string;
    currentSowingOrderId?: string; // Link to the active sowing order
    boundary?: GeoJSON.FeatureCollection | string; // KML content or GeoJSON
    kmlData?: string; // Original KML file content for download
    createdBy?: string;
    lastUpdatedBy?: string;
    createdAt?: string;
    updatedAt?: string;
    synced?: boolean;
    deleted?: boolean;
    deletedAt?: string;
    deletedBy?: string;
}

export interface Environment { // Ambiente (within a lot)
    id: string;
    lotId: string;
    name: string; // e.g., "Loma", "Bajo"
    hectares: number;
}

// --- Inventory ---

export type ProductType = 'HERBICIDE' | 'FERTILIZER' | 'SEED' | 'FUNGICIDE' | 'INSECTICIDE' | 'COADYUVANTE' | 'INOCULANTE' | 'GRAIN' | 'OTHER';
export type Unit = string;

export interface StandardPresentation {
    label: string;
    content: number;
}

export interface Product {
    id: string;
    clientId?: string; // Optional: if missing, it's global; if present, it's client-specific
    name: string;
    brandName?: string;
    type: ProductType;
    unit: Unit;
    activeIngredient?: string;
    commercialName?: string;
    concentration?: string; // e.g., "30%"
    standardPresentations?: StandardPresentation[];
    campaignId?: string;
    synced?: boolean;
    createdAt?: string;
    updatedAt?: string;
    deleted?: boolean;
    deletedBy?: string;
    deletedAt?: string;
}

// --- Campaigns ---

export type CampaignMode = 'MONEY' | 'GRAIN' | 'MIXED';

export interface Campaign {
    id: string;
    clientId: string;
    name: string; // e.g., "24/25"
    mode: CampaignMode;
    createdAt?: string;
    updatedAt?: string;
    synced?: boolean;
    deleted?: boolean;
}

export interface CampaignSnapshot {
    id: string;
    clientId: string;
    campaignId: string;
    createdAt: string;
    stockSnapshot: ClientStock[]; // The state of ClientStock at the time of closing
    synced?: boolean;
}

// "Galpón Virtual" (Stock)
export interface ClientStock {
    id: string;
    clientId: string;
    warehouseId?: string; // For multi-galpón support
    productId: string;
    productBrand?: string;
    quantity: number; // Current balance
    lastUpdated: string; // ISO Date
    updatedAt?: string; // To align with other entities
    synced?: boolean;
    presentation?: string; // Standard observation
    presentationLabel?: string;   // e.g., "Bidones", "Bolsas"
    presentationContent?: number; // e.g., 20
    presentationAmount?: number;  // e.g., 5
    campaignId?: string; // Link to Campaign
    source?: 'HARVEST' | 'PURCHASE';
    productCommercialName?: string;
}

// --- Orders ---

export type OrderType = 'SOWING' | 'APPLICATION' | 'HARVEST';
export type OrderStatus = 'DRAFT' | 'PENDING' | 'CONFIRMED' | 'DONE';

export interface OrderItem {
    id: string;
    productId: string;
    productName: string; // Cached for offline display
    brandName?: string;  // Cached for PDF
    commercialName?: string; // Cached for PDF
    activeIngredient?: string; // P.A. cached for PDF
    dosage: number; // Amount per hectare
    unit: Unit;
    totalQuantity: number; // dosage * area
    loadingOrder?: number; // Order of tank loading (caldo)
    plantingDensity?: number;
    plantingDensityUnit?: 'PLANTS_HA' | 'KG_HA';
    plantingSpacing?: number;
    expectedYield?: number;
    warehouseId?: string; // Origin warehouse for this specific item
    warehouseName?: string; // Cached name
    productType?: ProductType;
    presentationLabel?: string;
    presentationContent?: number;
    stockId?: string; // ID of the ClientStock entry this item was allocated from
    multiplier?: number;
    groupId?: string;
    isVirtualDéficit?: boolean;
    fertilizerPlacement?: 'LINE' | 'SIDE';
}

export interface MovementItem {
    id: string;
    productId: string;
    productName: string;
    productBrand?: string;
    productCommercialName?: string;
    quantity: number;
    unit: Unit;
    price?: number;
    sellerName?: string;
    presentation?: string;
    presentationLabel?: string;
    presentationContent?: number;
    presentationAmount?: number;
    source?: 'HARVEST' | 'PURCHASE';
}

export interface TransportSheet {
    id: string;
    dischargeNumber?: string;
    originAddress?: string;
    primarySaleCuit?: string;
    transportCompany?: string;
    truckPlate?: string;
    trailerPlate?: string;
    driverName?: string;
    humidity?: number;
    hectoliterWeight?: number;
    grossWeight?: number;
    tareWeight?: number;
    destinationCompany?: string;
    destinationAddress?: string;
    departureDateTime?: string;
    distanceKm?: number;
    freightTariff?: number;
    distributionId?: string; // Links to a specific distribution from Step 2
    profileName?: string; // Which profile this sheet was created from
    partnermark?: string;
    grossWeightPlant?: number;
    tareWeightPlant?: number;
    foreignMatter?: number;
    earthPercentage?: number;
    greenPercentage?: number;
    lotId?: string; // Links to a specific lot
}

export interface InventoryMovement {
    id: string;
    clientId: string;
    warehouseId?: string; // Origin/Destination warehouse
    productId: string;
    productName: string;
    productBrand?: string;
    productCommercialName?: string;
    presentationLabel?: string;
    presentationContent?: number;
    presentationAmount?: number;
    type: 'IN' | 'OUT' | 'SALE' | 'HARVEST' | 'PURCHASE' | 'SERVICE';
    quantity: number;
    unit: Unit;
    amount?: number; // Total monetary amount
    date: string; // ISO date-time string
    time?: string;
    salePrice?: number; // Price at which it was sold (for SALE type)
    purchasePrice?: number; // Price paid at which it was bought (for IN type)
    source?: 'HARVEST' | 'PURCHASE';
    referenceId: string; // ID of the Order, Purchase, or Sale event
    notes?: string;
    facturaDate?: string; // Fecha de emisión
    dueDate?: string; // Fecha de vencimiento
    facturaImageUrl?: string; // URL to uploaded invoice/receipt image
    remitoImageUrl?: string; // URL to uploaded remito image
    investorName?: string; // Who paid for this
    sellerName?: string; // Where this was purchased from
    createdBy?: string; // User ID/Name
    createdAt?: string;
    updatedAt?: string;
    synced?: boolean;
    harvestLaborCost?: number; // Total cost of harvest labor
    harvestLaborPricePerHa?: number; // Price per hectare
    contractorName?: string; // Name of the contractor
    truckDriver?: string; // Name of the truck driver (for Carta de Porte)
    plateNumber?: string; // Truck plate number
    deliveryLocation?: string; // Destination location (for Sales)
    receiverName?: string; // Name of person receiving/withdrawing (for Remito)
    // Sale Metadata Extension
    originAddress?: string;
    primarySaleCuit?: string;
    destinationCompany?: string;
    destinationAddress?: string;
    departureDateTime?: string;
    distanceKm?: number;
    freightTariff?: number;
    trailerPlate?: string;
    humidity?: number;
    dischargeNumber?: string;
    transportCompany?: string;
    hectoliterWeight?: number;
    grossWeight?: number;
    tareWeight?: number;
    deleted?: boolean;
    deletedAt?: string;
    deletedBy?: string;
    items?: MovementItem[]; // For consolidated entries
    investors?: { name: string; percentage: number }[]; // Multi-investor support
    campaignId?: string; // Link to Campaign
    farmId?: string; // Farm ID for harvest/sowing context
    lotId?: string; // Lot ID for harvest/sowing context
    isTransfer?: boolean;
    originName?: string;
    destName?: string;
    partnerId?: string;
    harvestBatchId?: string;
    transportName?: string;
    transportCuit?: string;
    driverName?: string;
    driverCuit?: string;
    truckPlate?: string;
    warehouseName?: string;
    transportSheets?: TransportSheet[];
    technicalResponsible?: string;
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
    lotId?: string; // Legacy: For single lot compatibility if needed
    lotIds?: string[]; // New: Supports multiple lots per order
    lotHectares?: Record<string, number>; // New: Area per lot (supports partial sowing)
    lotObservations?: Record<string, string>; // Observations per lotId
    warehouseId?: string; // Origin warehouse

    // Details
    treatedArea: number; // Total Hectares
    items: OrderItem[];
    contractorName?: string; // For Harvest Orders made as Orders

    // Execution
    applicatorId?: string; // Link to profile id
    appliedAt?: string;
    appliedBy?: string; // Name for audit trail
    applicatorName?: string; // Legacy/Display name
    applicationDate?: string; // New: For single specific date
    applicationStart?: string; // ISO Date for range
    applicationEnd?: string;   // ISO Date for range
    isDateRange?: boolean;     // New: Toggle between range and single date
    plantingDensity?: number;
    plantingDensityUnit?: 'PLANTS_HA' | 'KG_HA';
    plantingSpacing?: number;
    servicePrice?: number;
    expectedYield?: number; // For sowing orders
    notes?: string;
    facturaImageUrl?: string;
    remitoImageUrl?: string;
    technicalResponsible?: string;
    createdBy?: string;

    // Sync
    createdAt: string;
    updatedAt: string;
    updatedBy?: string;
    synced: boolean;
    deleted?: boolean;
    deletedAt?: string;
    deletedBy?: string;
    sowingOrderId?: string;
    investorName?: string; // Who is responsible for the service cost
    investors?: { name: string; percentage: number }[]; // Multi-investor support
    campaignId?: string; // Link to Campaign
    harvestBatchId?: string;
    boundary?: any; // New: Section KML GeoJSON
    kmlData?: string; // New: Original KML content
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
    campaignId?: string; // Optional: can be a campaign-level observation
    farmId?: string;     // Optional: can be a general farm observation
    lotId?: string;      // Optional: can be a lot-specific observation
    userName: string;
    date: string; // ISO Date
    comments: string;
    createdAt: string;
    synced?: boolean;
    deleted?: boolean;
    deletedBy?: string;
    deletedAt?: string;
}
