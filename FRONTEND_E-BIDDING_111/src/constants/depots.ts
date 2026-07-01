// MASTER DEPOT LIST - Single source of truth
// This list must be used across all depot dropdowns in the application

export interface DepotMaster {
  id: string;
  code: string;
  name: string;
  displayName: string; // Format: "Name – Code"
}

export const DEPOT_MASTER_LIST: DepotMaster[] = [
  { id: '6601', code: '6601', name: 'Lucknow', displayName: 'Lucknow – 6601' },
  { id: '6602', code: '6602', name: 'Ayodhya', displayName: 'Ayodhya – 6602' },
  { id: '6605', code: '6605', name: 'Sitapur', displayName: 'Sitapur – 6605' },
  { id: '6606', code: '6606', name: 'Gonda', displayName: 'Gonda – 6606' },
  { id: '6608', code: '6608', name: 'Hardoi', displayName: 'Hardoi – 6608' },
  { id: '6622', code: '6622', name: 'Gorakhpur', displayName: 'Gorakhpur – 6622' },
  { id: '6623', code: '6623', name: 'Mau', displayName: 'Mau – 6623' },
  { id: '6624', code: '6624', name: 'Deoria', displayName: 'Deoria – 6624' },
  { id: '6637', code: '6637', name: 'Basti', displayName: 'Basti – 6637' },
];

// Helper function to get depot by ID
export const getDepotById = (id: string): DepotMaster | undefined => {
  return DEPOT_MASTER_LIST.find(depot => depot.id === id);
};

// Helper function to get depot display name by ID
export const getDepotDisplayName = (id: string): string => {
  const depot = getDepotById(id);
  return depot ? depot.displayName : id;
};

/**
 * Canonical depot token for SAP filter + backend exclusion keys (matches application.yaml).
 * UI uses Title Case `name`; API payloads should send UPPER for zero ambiguity.
 */
export function normalizeDepotForApi(name: string): string {
  return name.trim().toUpperCase();
}
