// Mock data store - will be replaced with Lovable Cloud database
import { create } from 'zustand';
import { DEPOT_MASTER_LIST } from '@/constants/depots';

export interface User {
  id: string;
  username: string;
  password: string;
  role: 'admin' | 'operator' | 'fleet' | 'vendor';
}

export interface Plant {
  id: string;
  name: string;
  isActive?: boolean;
}

export interface Zone {
  id: string;
  zone_name: string;
}

export interface Depot {
  id: string;
  code: string;
  name: string;
  plant_id: string;
}

export interface TonnageOption {
  id: string;
  value: number;
  label: string;
}

// NEW: Bid Opportunity - Incoming bid from organization (not vehicle-specific)
export interface BidOpportunity {
  id: string;
  plant_id: string;
  plant_name: string;
  depot_id: string;
  depot_name: string;
  destination?: string;
  tonnage: number;
  availableBids: number; // How many bids available for this requirement
  status: 'Open' | 'Closed';
  created_at: string;
}

// NEW: Bidding Context - Tracks vendor's active bidding specifications
export interface BiddingContextSpec {
  depot_id: string;
  depot_name: string;
  destination?: string;
  tonnages: number[];
}

export interface BiddingContext {
  started: boolean;
  plant_id: string | null;
  specifications: BiddingContextSpec[];
  // Track bid IDs that existed when bidding started (for new bid detection)
  knownBidIds: string[];
  // Track bid IDs that have already triggered notifications (deduplication)
  notifiedBidIds: string[];
}

// Each vehicle is an independent bid (Live E-Bidding)
export interface VehicleBid {
  id: string;
  plant_id: string;
  plant_name: string;
  depot_id: string;
  depot_name: string;
  destination?: string;
  tonnage: number;
  status: 'Live' | 'Paused' | 'Closed';
  rank: number | null; // null when live, number when determined
  created_at: string;
  time_remaining: number; // seconds
  pendingRequest?: ActionRequest | null; // Track pending request for this vehicle
}

// NEW: Action Request interface for Fleet -> Vendor workflow
export interface ActionRequest {
  id: string;
  requestType: 'PAUSE' | 'CLOSE';
  bidId: string;
  vehicleId: string;
  plantName: string;
  depotName: string;
  destination?: string;
  tonnage: number;
  requestedBy: string;
  requestedAt: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  remarks?: string;
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  created_at: string;
  type?: 'info' | 'request' | 'success' | 'warning';
  requestId?: string; // Link to action request if applicable
  // Structured data for vertical card display
  depot?: string;
  destination?: string;
  tonnage?: number;
  truckNumber?: string;
  rank?: number;
  reason?: string;
}

export interface VehicleDocument {
  id: string;
  type: 'Insurance' | 'RC' | 'Driver License' | 'Purchase Invoice' | 'Other';
  fileName: string;
  fileUrl: string;
  uploadedAt: string;
  expiryDate?: string; // ISO date, required only for Insurance documents
}

export interface Truck {
  id: string;
  registrationNumber: string;
  driverName: string;
  tonnage: '18T' | '25T' | '32T' | '40T' | '42T';
  plant_id: string;
  plant_name: string;
  depot_id: string;
  depot_name: string;
  status: 'Active' | 'Non-Active';
  rotationCount: number;
  documents: VehicleDocument[];
}

interface DataStore {
  // Auth
  currentUser: User | null;
  currentPlant: Plant | null;
  isAuthenticated: boolean;
  
  // Data
  users: User[];
  plants: Plant[];
  zones: Zone[];
  depots: Depot[];
  tonnageOptions: TonnageOption[];
  bidOpportunities: BidOpportunity[]; // Incoming bid opportunities from organization
  vehicleBids: VehicleBid[]; // Live E-Bidding (vehicle-level)
  notifications: Notification[];
  trucks: Truck[];
  actionRequests: ActionRequest[]; // Action requests from Fleet
  biddingContext: BiddingContext; // Vendor's active bidding context
  
  // Actions
  login: (username: string, password: string) => boolean;
  logout: () => void;
  startBidding: (plantId: string, specifications: BiddingContextSpec[]) => void;
  stopBidding: () => void;
  // NEW: Add a bid opportunity (simulates new bids appearing from organization)
  addBidOpportunity: (opportunity: Omit<BidOpportunity, 'id' | 'created_at'>) => void;
  // NEW: Check for new matching bids and trigger notifications + auto go-live
  checkForNewBids: () => void;
  createVehicleBids: (plantId: string, depotId: string, destination: string | undefined, tonnages: number[]) => void;
  getActiveBidOpportunities: () => BidOpportunity[];
  refreshBidOpportunities: () => Promise<{ count: number; opportunities: BidOpportunity[] }>;
  updateVehicleBidStatus: (vehicleBidId: string, status: 'Live' | 'Paused' | 'Closed') => void;
  closeVehicleBid: (vehicleBidId: string) => void;
  addNotification: (title: string, message: string, type?: 'info' | 'request' | 'success' | 'warning', requestId?: string, structuredData?: { depot?: string; destination?: string; tonnage?: number; truckNumber?: string; rank?: number; reason?: string }) => void;
  updateTruckStatus: (truckId: string, status: Truck['status']) => void;
  getDepotsByPlant: (plantId: string) => Depot[];
  getAvailableTrucks: () => Truck[];
  getAvailableTrucksByDepot: () => { depot: string; count: number }[];
  
  // NEW: Fleet Request Actions
  createActionRequest: (vehicleBidId: string, requestType: 'PAUSE' | 'CLOSE', remarks?: string) => void;
  approveActionRequest: (requestId: string) => void;
  rejectActionRequest: (requestId: string) => void;
  getPendingRequests: () => ActionRequest[];
  
  // Vehicle Document Actions
  addVehicleDocument: (truckId: string, document: Omit<VehicleDocument, 'id' | 'uploadedAt'> & { expiryDate?: string }) => void;
  getVehicleDocuments: (truckId: string) => VehicleDocument[];
}

// Initial mock data
const initialPlants: Plant[] = [
  { id: '1', name: 'Tanda Cement Plant', isActive: true },
];

const initialUsers: User[] = [
  { id: '1', username: 'admin', password: 'admin123', role: 'admin' },
  { id: '2', username: 'operator', password: 'operator123', role: 'operator' },
  { id: '3', username: 'fleet', password: 'fleet123', role: 'fleet' },
  { id: '4', username: 'vendor', password: 'vendor123', role: 'vendor' },
];

// Depots for Tanda Cement Plant - Using centralized master list
const initialDepots: Depot[] = DEPOT_MASTER_LIST.map(depot => ({
  id: depot.id,
  code: depot.code,
  name: depot.name,
  plant_id: '1', // All depots belong to Tanda Cement Plant
}));

const initialZones: Zone[] = [
  { id: '1', zone_name: 'North Zone' },
  { id: '2', zone_name: 'South Zone' },
  { id: '3', zone_name: 'East Zone' },
  { id: '4', zone_name: 'West Zone' },
];

const initialTonnageOptions: TonnageOption[] = [
  { id: '1', value: 18, label: '18T' },
  { id: '2', value: 25, label: '25T' },
  { id: '3', value: 30, label: '30T' },
  { id: '4', value: 32, label: '32T' },
  { id: '5', value: 40, label: '40T' },
  { id: '6', value: 42, label: '42T' },
];

const initialTrucks: Truck[] = [
  { id: '1', registrationNumber: 'UP32-AB-1234', driverName: 'Rajesh Kumar', tonnage: '32T', plant_id: '1', plant_name: 'Tanda Cement Plant', depot_id: '6601', depot_name: 'LUCKNOW', status: 'Active', rotationCount: 5, documents: [] },
  { id: '2', registrationNumber: 'UP32-CD-5678', driverName: 'Suresh Singh', tonnage: '25T', plant_id: '1', plant_name: 'Tanda Cement Plant', depot_id: '6601', depot_name: 'LUCKNOW', status: 'Active', rotationCount: 3, documents: [] },
  { id: '3', registrationNumber: 'UP32-EF-9012', driverName: 'Mohan Verma', tonnage: '40T', plant_id: '1', plant_name: 'Tanda Cement Plant', depot_id: '6602', depot_name: 'AYODHYA', status: 'Non-Active', rotationCount: 8, documents: [] },
  { id: '4', registrationNumber: 'UP32-OP-5566', driverName: 'Sanjay Mishra', tonnage: '18T', plant_id: '1', plant_name: 'Tanda Cement Plant', depot_id: '6605', depot_name: 'SITAPUR', status: 'Active', rotationCount: 9, documents: [] },
];

const initialVehicleBids: VehicleBid[] = [];

// Mock bid opportunities - incoming bids from organization
// NOTE: Tonnages MUST match values in tonnageOptions (18, 25, 30, 32, 40, 42)
const initialBidOpportunities: BidOpportunity[] = [
  // Ayodhya opportunities (depot_id: 6602)
  { id: 'BO-1', plant_id: '1', plant_name: 'Tanda Cement Plant', depot_id: '6602', depot_name: 'Ayodhya', destination: 'Rudoli', tonnage: 18, availableBids: 6, status: 'Open', created_at: new Date().toISOString() },
  { id: 'BO-2', plant_id: '1', plant_name: 'Tanda Cement Plant', depot_id: '6602', depot_name: 'Ayodhya', destination: 'Rudoli', tonnage: 25, availableBids: 4, status: 'Open', created_at: new Date().toISOString() },
  { id: 'BO-3', plant_id: '1', plant_name: 'Tanda Cement Plant', depot_id: '6602', depot_name: 'Ayodhya', tonnage: 32, availableBids: 3, status: 'Open', created_at: new Date().toISOString() },
  // Lucknow opportunities (depot_id: 6601)
  { id: 'BO-4', plant_id: '1', plant_name: 'Tanda Cement Plant', depot_id: '6601', depot_name: 'Lucknow', destination: 'Kanpur', tonnage: 32, availableBids: 4, status: 'Open', created_at: new Date().toISOString() },
  { id: 'BO-5', plant_id: '1', plant_name: 'Tanda Cement Plant', depot_id: '6601', depot_name: 'Lucknow', tonnage: 25, availableBids: 3, status: 'Open', created_at: new Date().toISOString() },
  // Sitapur opportunities (depot_id: 6605)
  { id: 'BO-6', plant_id: '1', plant_name: 'Tanda Cement Plant', depot_id: '6605', depot_name: 'Sitapur', tonnage: 18, availableBids: 5, status: 'Open', created_at: new Date().toISOString() },
  { id: 'BO-7', plant_id: '1', plant_name: 'Tanda Cement Plant', depot_id: '6605', depot_name: 'Sitapur', destination: 'Hardoi', tonnage: 42, availableBids: 2, status: 'Open', created_at: new Date().toISOString() },
  // Gonda opportunities (depot_id: 6606)
  { id: 'BO-8', plant_id: '1', plant_name: 'Tanda Cement Plant', depot_id: '6606', depot_name: 'Gonda', tonnage: 30, availableBids: 3, status: 'Open', created_at: new Date().toISOString() },
  // Gorakhpur opportunities (depot_id: 6622)
  { id: 'BO-9', plant_id: '1', plant_name: 'Tanda Cement Plant', depot_id: '6622', depot_name: 'Gorakhpur', destination: 'Deoria', tonnage: 40, availableBids: 4, status: 'Open', created_at: new Date().toISOString() },
];

const initialNotifications: Notification[] = [
  { id: '1', title: 'Welcome', message: 'System set up and ready', created_at: new Date().toISOString(), type: 'info' },
];

const initialActionRequests: ActionRequest[] = [];

// Initial bidding context - no bidding started by default
const initialBiddingContext: BiddingContext = {
  started: false,
  plant_id: null,
  specifications: [],
  knownBidIds: [],
  notifiedBidIds: [],
};

export const useDataStore = create<DataStore>((set, get) => ({
  currentUser: null,
  currentPlant: null,
  isAuthenticated: false,
  
  users: initialUsers,
  plants: initialPlants,
  zones: initialZones,
  depots: initialDepots,
  tonnageOptions: initialTonnageOptions,
  bidOpportunities: initialBidOpportunities,
  vehicleBids: initialVehicleBids,
  notifications: initialNotifications,
  trucks: initialTrucks,
  actionRequests: initialActionRequests,
  biddingContext: initialBiddingContext,
  
  login: (username, password) => {
    const user = get().users.find(u => u.username === username && u.password === password);
    const plants = get().plants;
    
    if (user) {
      // Set default plant (first available) after successful authentication
      const defaultPlant = plants[0] || null;
      set({ currentUser: user, currentPlant: defaultPlant, isAuthenticated: true });
      return true;
    }
    return false;
  },
  
  logout: () => {
    set({ 
      currentUser: null, 
      currentPlant: null, 
      isAuthenticated: false,
      biddingContext: initialBiddingContext, // Reset bidding context on logout
    });
  },

  // Start bidding - saves vendor's selected specifications
  // Also captures current bid IDs to detect NEW bids later
  startBidding: (plantId, specifications) => {
    const { bidOpportunities } = get();
    // Capture IDs of all current matching bids at the moment bidding starts
    const currentBidIds = bidOpportunities.map(bo => bo.id);
    
    set({
      biddingContext: {
        started: true,
        plant_id: plantId,
        specifications,
        knownBidIds: currentBidIds, // Remember what existed when we started
        notifiedBidIds: [], // Reset notification tracking
      }
    });
  },

  // Stop bidding - resets context
  stopBidding: () => {
    set({ biddingContext: initialBiddingContext });
  },

  // NEW: Add a bid opportunity (simulates organization publishing new bids)
  addBidOpportunity: (opportunity) => {
    const newBid: BidOpportunity = {
      ...opportunity,
      id: `BO-${Date.now()}`,
      created_at: new Date().toISOString(),
    };
    set(state => ({ bidOpportunities: [...state.bidOpportunities, newBid] }));
  },

  // NEW: Check for newly appeared bids that match vendor's specifications
  // This implements the real-time bid discovery notification system
  checkForNewBids: () => {
    const { biddingContext, bidOpportunities, plants, depots } = get();
    
    // RULE: No notifications if bidding not started
    if (!biddingContext.started || !biddingContext.plant_id) {
      return;
    }
    
    // RULE: No notifications if no specifications
    if (biddingContext.specifications.length === 0) {
      return;
    }

    // Find NEW bids: bids that didn't exist when bidding started AND haven't been notified
    const newMatchingBids = bidOpportunities.filter(bo => {
      // Must be a NEW bid (not in knownBidIds from when bidding started)
      if (biddingContext.knownBidIds.includes(bo.id)) return false;
      
      // Must not have already been notified
      if (biddingContext.notifiedBidIds.includes(bo.id)) return false;
      
      // Must be Open
      if (bo.status !== 'Open') return false;
      
      // Must match plant
      if (bo.plant_id !== biddingContext.plant_id) return false;

      // Must match at least one vendor specification
      return biddingContext.specifications.some(spec => {
        // Must match depot exactly
        if (bo.depot_id !== spec.depot_id) return false;

        // Destination matching
        if (spec.destination) {
          if (bo.destination && bo.destination !== spec.destination) return false;
        }

        // Must match at least one tonnage
        return spec.tonnages.includes(bo.tonnage);
      });
    });

    // Process each new matching bid
    newMatchingBids.forEach(bo => {
      const plant = plants.find(p => p.id === bo.plant_id);
      const depot = depots.find(d => d.id === bo.depot_id);
      
      // Trigger notification
      get().addNotification(
        'Matching Bid Found',
        `Matching bid found for ${bo.depot_name}. Going live.`,
        'success',
        undefined,
        {
          depot: bo.depot_name,
          destination: bo.destination,
          tonnage: bo.tonnage,
          truckNumber: 'Pending',
        }
      );

      // Auto go-live: Create a vehicle bid for this new opportunity
      if (plant && depot) {
        const timestamp = Date.now();
        const newVehicleBid: VehicleBid = {
          id: `VB-AUTO-${timestamp}-${bo.id}`,
          plant_id: bo.plant_id,
          plant_name: bo.plant_name,
          depot_id: bo.depot_id,
          depot_name: bo.depot_name,
          destination: bo.destination,
          tonnage: bo.tonnage,
          status: 'Live',
          rank: Math.floor(Math.random() * 5) + 1, // Initial rank
          created_at: new Date().toISOString(),
          time_remaining: 300,
          pendingRequest: null,
        };
        
        set(state => ({ vehicleBids: [...state.vehicleBids, newVehicleBid] }));
      }

      // Mark as notified (deduplication)
      set(state => ({
        biddingContext: {
          ...state.biddingContext,
          notifiedBidIds: [...state.biddingContext.notifiedBidIds, bo.id],
        }
      }));
    });
  },

  // Get active bid opportunities filtered by vendor's bidding context
  // CRITICAL: Returns ONLY opportunities matching vendor's started specifications
  getActiveBidOpportunities: () => {
    const { biddingContext, bidOpportunities } = get();
    
    // RULE: If bidding not started, return EMPTY - no bids shown before Start Bidding
    if (!biddingContext.started || !biddingContext.plant_id) {
      return [];
    }

    // RULE: If no specifications defined, return EMPTY
    if (biddingContext.specifications.length === 0) {
      return [];
    }

    // Filter bid opportunities based on vendor's specifications
    const openOpportunities = bidOpportunities.filter(bo => bo.status === 'Open');
    
    return openOpportunities.filter(bo => {
      // Must match plant
      if (bo.plant_id !== biddingContext.plant_id) return false;

      // Check if any specification matches this opportunity
      return biddingContext.specifications.some(spec => {
        // Must match depot exactly
        if (bo.depot_id !== spec.depot_id) return false;

        // Destination matching logic:
        // Case 1: Vendor specified a destination
        //   - Match opportunities with SAME destination
        //   - Also match opportunities with NO destination (they apply to all destinations)
        // Case 2: Vendor did NOT specify destination
        //   - Match ALL opportunities for that depot (any destination or no destination)
        if (spec.destination) {
          // Vendor specified destination - match exact OR opportunities with no destination
          if (bo.destination && bo.destination !== spec.destination) {
            return false;
          }
        }
        // If vendor didn't specify destination, match all for that depot (no filtering needed)

        // Must match at least one of vendor's selected tonnages
        return spec.tonnages.includes(bo.tonnage);
      });
    });
  },

  // Refresh bid opportunities - re-fetches based on active requirements only
  // Returns a promise to support loading states in UI
  refreshBidOpportunities: async () => {
    const { biddingContext, bidOpportunities } = get();
    
    // RULE: If bidding not started, return empty
    if (!biddingContext.started || !biddingContext.plant_id) {
      return { count: 0, opportunities: [] };
    }

    // RULE: If no specifications defined, return empty
    if (biddingContext.specifications.length === 0) {
      return { count: 0, opportunities: [] };
    }

    // Simulate network fetch delay
    await new Promise(resolve => setTimeout(resolve, 800));

    // Filter bid opportunities based on vendor's specifications
    const openOpportunities = bidOpportunities.filter(bo => bo.status === 'Open');
    
    const matchingOpportunities = openOpportunities.filter(bo => {
      // Must match plant
      if (bo.plant_id !== biddingContext.plant_id) return false;

      // Check if any specification matches this opportunity
      return biddingContext.specifications.some(spec => {
        // Must match depot exactly
        if (bo.depot_id !== spec.depot_id) return false;

        // Destination matching logic
        if (spec.destination) {
          if (bo.destination && bo.destination !== spec.destination) {
            return false;
          }
        }

        // Must match at least one tonnage
        return spec.tonnages.includes(bo.tonnage);
      });
    });

    const totalCount = matchingOpportunities.reduce((sum, bo) => sum + bo.availableBids, 0);
    
    return { count: totalCount, opportunities: matchingOpportunities };
  },

  getDepotsByPlant: (plantId: string) => {
    return get().depots.filter(d => d.plant_id === plantId);
  },

  getAvailableTrucks: () => {
    return get().trucks.filter(t => t.status === 'Active');
  },

  getAvailableTrucksByDepot: () => {
    const trucks = get().trucks.filter(t => t.status === 'Active');
    const depotCounts: { [key: string]: number } = {};
    
    trucks.forEach(truck => {
      if (depotCounts[truck.depot_name]) {
        depotCounts[truck.depot_name]++;
      } else {
        depotCounts[truck.depot_name] = 1;
      }
    });

    return Object.entries(depotCounts).map(([depot, count]) => ({
      depot,
      count
    }));
  },
  
  // Create individual vehicle bids - each vehicle is an independent bid
  createVehicleBids: (plantId, depotId, destination, tonnages) => {
    const plant = get().plants.find(p => p.id === plantId);
    const depot = get().depots.find(d => d.id === depotId);
    
    if (!plant || !depot) return;

    const timestamp = Date.now();
    const newVehicleBids: VehicleBid[] = tonnages.map((tonnage, index) => ({
      id: `VB-${timestamp}-${index}`,
      plant_id: plantId,
      plant_name: plant.name,
      depot_id: depotId,
      depot_name: depot.name,
      destination: destination || undefined,
      tonnage,
      status: 'Live' as const,
      rank: Math.random() > 0.5 ? 1 : Math.floor(Math.random() * 5) + 1, // Each vehicle gets its own rank
      created_at: new Date().toISOString(),
      time_remaining: 300, // 5 minutes
      pendingRequest: null,
    }));

    set(state => ({ vehicleBids: [...state.vehicleBids, ...newVehicleBids] }));
    // Notification for each tonnage
    tonnages.forEach((t) => {
      get().addNotification(
        'Bid Started', 
        `Vehicle bid started for ${depot.name}`,
        'info',
        undefined,
        {
          depot: depot.name,
          destination: undefined,
          tonnage: t,
          truckNumber: 'Pending',
        }
      );
    });
  },
  
  // Update status for a single vehicle bid
  updateVehicleBidStatus: (vehicleBidId, status) => {
    set(state => ({
      vehicleBids: state.vehicleBids.map(vb => 
        vb.id === vehicleBidId ? { ...vb, status, pendingRequest: null } : vb
      )
    }));
    
    const vehicleBid = get().vehicleBids.find(vb => vb.id === vehicleBidId);
    if (vehicleBid) {
      const statusText = status === 'Live' ? 'resumed' : status === 'Paused' ? 'paused' : 'closed';
      get().addNotification(
        `Vehicle ${statusText}`,
        `Vehicle status changed to ${statusText}`,
        'success',
        undefined,
        {
          depot: vehicleBid.depot_name,
          destination: vehicleBid.destination,
          tonnage: vehicleBid.tonnage,
          truckNumber: `Vehicle-${vehicleBid.tonnage}T`,
        }
      );
    }
  },

  // Close a specific vehicle bid
  closeVehicleBid: (vehicleBidId) => {
    set(state => ({
      vehicleBids: state.vehicleBids.map(vb => 
        vb.id === vehicleBidId ? { ...vb, status: 'Closed' as const, pendingRequest: null } : vb
      )
    }));
    
    const vehicleBid = get().vehicleBids.find(vb => vb.id === vehicleBidId);
    if (vehicleBid) {
      const isWon = vehicleBid.rank === 1;
      get().addNotification(
        isWon ? 'Rank 1 Achieved' : 'Bid Closed',
        isWon ? 'Congratulations! Your bid achieved Rank 1.' : 'Vehicle bid has been closed.',
        'success',
        undefined,
        {
          depot: vehicleBid.depot_name,
          destination: vehicleBid.destination,
          tonnage: vehicleBid.tonnage,
          truckNumber: `Vehicle-${vehicleBid.tonnage}T`,
          rank: vehicleBid.rank || undefined,
        }
      );
    }
  },
  
  addNotification: (title, message, type = 'info', requestId, structuredData) => {
    const newNotif: Notification = {
      id: Date.now().toString(),
      title,
      message,
      created_at: new Date().toISOString(),
      type,
      requestId,
      depot: structuredData?.depot,
      destination: structuredData?.destination,
      tonnage: structuredData?.tonnage,
      truckNumber: structuredData?.truckNumber,
      rank: structuredData?.rank,
      reason: structuredData?.reason,
    };
    set(state => ({ notifications: [newNotif, ...state.notifications].slice(0, 10) }));
  },

  updateTruckStatus: (truckId, status) => {
    set(state => ({
      trucks: state.trucks.map(t => t.id === truckId ? { ...t, status } : t)
    }));
  },

  // NEW: Create action request from Fleet user
  createActionRequest: (vehicleBidId, requestType, remarks) => {
    const vehicleBid = get().vehicleBids.find(vb => vb.id === vehicleBidId);
    const currentUser = get().currentUser;
    
    if (!vehicleBid || !currentUser) return;

    const newRequest: ActionRequest = {
      id: `REQ-${Date.now()}`,
      requestType,
      bidId: vehicleBidId,
      vehicleId: vehicleBidId,
      plantName: vehicleBid.plant_name,
      depotName: vehicleBid.depot_name,
      destination: vehicleBid.destination,
      tonnage: vehicleBid.tonnage,
      requestedBy: currentUser.username,
      requestedAt: new Date().toISOString(),
      status: 'Pending',
      remarks,
    };

    // Add request to list
    set(state => ({ 
      actionRequests: [...state.actionRequests, newRequest],
      vehicleBids: state.vehicleBids.map(vb => 
        vb.id === vehicleBidId ? { ...vb, pendingRequest: newRequest } : vb
      )
    }));

    // Notify vendor
    const actionText = requestType === 'PAUSE' ? 'Pause' : 'Close';
    get().addNotification(
      `${actionText} Request Received`,
      `Fleet has requested to ${actionText.toLowerCase()} this bid.`,
      'request',
      newRequest.id,
      {
        depot: vehicleBid.depot_name,
        destination: vehicleBid.destination,
        tonnage: vehicleBid.tonnage,
        truckNumber: `Vehicle-${vehicleBid.tonnage}T`,
      }
    );
  },

  // NEW: Approve action request (Vendor only)
  approveActionRequest: (requestId) => {
    const request = get().actionRequests.find(r => r.id === requestId);
    if (!request) return;

    // Update request status
    set(state => ({
      actionRequests: state.actionRequests.map(r => 
        r.id === requestId ? { ...r, status: 'Approved' as const } : r
      )
    }));

    // Execute the action
    if (request.requestType === 'PAUSE') {
      get().updateVehicleBidStatus(request.vehicleId, 'Paused');
    } else if (request.requestType === 'CLOSE') {
      get().closeVehicleBid(request.vehicleId);
    }

    // Notify fleet user
    const actionText = request.requestType === 'PAUSE' ? 'Pause' : 'Close';
    get().addNotification(
      `${actionText} Request Approved`,
      `Your ${actionText.toLowerCase()} request has been approved.`,
      'success',
      requestId,
      {
        depot: request.depotName,
        destination: request.destination,
        tonnage: request.tonnage,
        truckNumber: `Vehicle-${request.tonnage}T`,
      }
    );
  },

  // NEW: Reject action request (Vendor only)
  rejectActionRequest: (requestId) => {
    const request = get().actionRequests.find(r => r.id === requestId);
    if (!request) return;

    // Update request status and clear pending request from vehicle
    set(state => ({
      actionRequests: state.actionRequests.map(r => 
        r.id === requestId ? { ...r, status: 'Rejected' as const } : r
      ),
      vehicleBids: state.vehicleBids.map(vb => 
        vb.id === request.vehicleId ? { ...vb, pendingRequest: null } : vb
      )
    }));

    // Notify fleet user
    const actionText = request.requestType === 'PAUSE' ? 'Pause' : 'Close';
    get().addNotification(
      `${actionText} Request Rejected`,
      `Your ${actionText.toLowerCase()} request has been rejected.`,
      'warning',
      requestId,
      {
        depot: request.depotName,
        destination: request.destination,
        tonnage: request.tonnage,
        truckNumber: `Vehicle-${request.tonnage}T`,
      }
    );
  },

  // NEW: Get all pending requests
  getPendingRequests: () => {
    return get().actionRequests.filter(r => r.status === 'Pending');
  },

  // Vehicle Document Management
  addVehicleDocument: (truckId, document) => {
    const newDoc: VehicleDocument = {
      id: `DOC-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      ...document,
      uploadedAt: new Date().toISOString(),
    };

    set(state => ({
      trucks: state.trucks.map(truck =>
        truck.id === truckId
          ? { ...truck, documents: [...truck.documents, newDoc] }
          : truck
      )
    }));
  },

  getVehicleDocuments: (truckId) => {
    const truck = get().trucks.find(t => t.id === truckId);
    return truck?.documents || [];
  },
}));
