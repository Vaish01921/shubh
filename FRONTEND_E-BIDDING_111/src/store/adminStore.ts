import { create } from 'zustand';

export interface AdminUser {
  id: string;
  username: string;
  password: string;
}

export interface TruckAvailability {
  id: string;
  plant_id: string;
  depot_id: string;
  date: string;
  totalTrucks: number;
  activeTrucks: number;
  nonActiveTrucks: number;
  availableTrucks: number;
  updatedAt: string;
}

export interface TruckDetail {
  id: string;
  truckNumber: string;
  driverName: string;
  tonnage: string; // Now flexible string for manual entry (e.g., "18T", "25T")
  currentDepot: string;
  status: 'Available' | 'In Trip' | 'Non-Active';
  previousDepot?: string;
  destination?: string; // Optional destination for current depot
  availableSince?: string; // ISO timestamp when truck became available
  contractType?: string; // Contract type / Contract ID (stored as remarks)
}

interface AdminStore {
  // Auth
  adminUser: AdminUser | null;
  isAdminAuthenticated: boolean;
  
  // Admin users (demo)
  adminUsers: AdminUser[];
  
  // Availability data
  truckAvailability: TruckAvailability[];
  truckDetails: TruckDetail[];
  
  // Actions
  adminLogin: (username: string, password: string) => boolean;
  adminLogout: () => void;
  updateTruckAvailability: (data: Omit<TruckAvailability, 'id' | 'updatedAt'>) => void;
  addTruckDetail: (detail: Omit<TruckDetail, 'id'>) => void;
  updateTruckDetail: (id: string, detail: Partial<TruckDetail>) => void;
  deleteTruckDetail: (id: string) => void;
  getTruckAvailability: (plantId: string, depotId: string, date: string) => TruckAvailability | undefined;
}

// Demo admin users
const initialAdminUsers: AdminUser[] = [
  { id: '1', username: 'fleetadmin', password: 'fleet@123' },
  { id: '2', username: 'truckadmin', password: 'truck@123' },
];

export const useAdminStore = create<AdminStore>((set, get) => ({
  adminUser: null,
  isAdminAuthenticated: false,
  adminUsers: initialAdminUsers,
  truckAvailability: [],
  truckDetails: [],
  
  adminLogin: (username, password) => {
    const user = get().adminUsers.find(
      u => u.username === username && u.password === password
    );
    
    if (user) {
      set({ adminUser: user, isAdminAuthenticated: true });
      return true;
    }
    return false;
  },
  
  adminLogout: () => {
    set({ adminUser: null, isAdminAuthenticated: false });
  },
  
  updateTruckAvailability: (data) => {
    const existing = get().truckAvailability.find(
      ta => ta.plant_id === data.plant_id && 
            ta.depot_id === data.depot_id && 
            ta.date === data.date
    );
    
    if (existing) {
      set(state => ({
        truckAvailability: state.truckAvailability.map(ta =>
          ta.id === existing.id
            ? { ...ta, ...data, updatedAt: new Date().toISOString() }
            : ta
        )
      }));
    } else {
      const newEntry: TruckAvailability = {
        ...data,
        id: `TA-${Date.now()}`,
        updatedAt: new Date().toISOString(),
      };
      set(state => ({
        truckAvailability: [...state.truckAvailability, newEntry]
      }));
    }
  },
  
  addTruckDetail: (detail) => {
    const newDetail: TruckDetail = {
      ...detail,
      id: `TD-${Date.now()}`,
    };
    set(state => ({
      truckDetails: [...state.truckDetails, newDetail]
    }));
  },
  
  updateTruckDetail: (id, detail) => {
    set(state => ({
      truckDetails: state.truckDetails.map(td =>
        td.id === id ? { ...td, ...detail } : td
      )
    }));
  },
  
  deleteTruckDetail: (id) => {
    set(state => ({
      truckDetails: state.truckDetails.filter(td => td.id !== id)
    }));
  },
  
  getTruckAvailability: (plantId, depotId, date) => {
    return get().truckAvailability.find(
      ta => ta.plant_id === plantId && 
            ta.depot_id === depotId && 
            ta.date === date
    );
  },
}));
