import { useState, useMemo, useCallback } from 'react';
import { DEPOT_MASTER_LIST } from '@/constants/depots';
import { VehicleBid } from '@/store/dataStore';

export interface BidFilters {
  depotId: string | null;
  destination: string | null;
}

export interface UseBidFiltersResult {
  // Pending filters (user selections, not yet applied)
  pendingFilters: BidFilters;
  // Applied filters (what's actually filtering the data)
  appliedFilters: BidFilters;
  setPendingDepot: (depotId: string | null) => void;
  setPendingDestination: (destination: string | null) => void;
  applyFilters: () => void;
  clearFilters: () => void;
  filterBids: (bids: VehicleBid[]) => VehicleBid[];
  availableDestinations: string[];
  depotOptions: typeof DEPOT_MASTER_LIST;
  hasActiveFilters: boolean;
  canApplyFilters: boolean;
  isSearching: boolean;
}

export function useBidFilters(vehicleBids: VehicleBid[]): UseBidFiltersResult {
  // Pending filters - user selections before clicking Apply
  const [pendingFilters, setPendingFilters] = useState<BidFilters>({
    depotId: null,
    destination: null,
  });

  // Applied filters - what's actually filtering data
  const [appliedFilters, setAppliedFilters] = useState<BidFilters>({
    depotId: null,
    destination: null,
  });

  // Loading state for UX feedback
  const [isSearching, setIsSearching] = useState(false);

  // Get unique destinations for selected depot (based on pending selection)
  const availableDestinations = useMemo(() => {
    if (!pendingFilters.depotId) return [];
    
    const destinations = vehicleBids
      .filter(vb => vb.depot_id === pendingFilters.depotId && vb.destination)
      .map(vb => vb.destination!)
      .filter((value, index, self) => self.indexOf(value) === index)
      .sort();
    
    return destinations;
  }, [vehicleBids, pendingFilters.depotId]);

  const setPendingDepot = useCallback((depotId: string | null) => {
    setPendingFilters(prev => ({
      depotId,
      destination: null, // Reset destination when depot changes
    }));
  }, []);

  const setPendingDestination = useCallback((destination: string | null) => {
    setPendingFilters(prev => ({
      ...prev,
      destination,
    }));
  }, []);

  const applyFilters = useCallback(() => {
    setIsSearching(true);
    // Simulate brief loading for UX feedback
    setTimeout(() => {
      setAppliedFilters({ ...pendingFilters });
      setIsSearching(false);
    }, 150);
  }, [pendingFilters]);

  const clearFilters = useCallback(() => {
    setPendingFilters({ depotId: null, destination: null });
    setAppliedFilters({ depotId: null, destination: null });
  }, []);

  const filterBids = useCallback((bids: VehicleBid[]): VehicleBid[] => {
    return bids.filter(vb => {
      // Case 1: No filters - show all
      if (!appliedFilters.depotId) return true;
      
      // Case 2: Depot filter only - show all for that depot
      if (appliedFilters.depotId && !appliedFilters.destination) {
        return vb.depot_id === appliedFilters.depotId;
      }
      
      // Case 3: Depot + Destination - show matching both
      return vb.depot_id === appliedFilters.depotId && vb.destination === appliedFilters.destination;
    });
  }, [appliedFilters]);

  // Has active applied filters
  const hasActiveFilters = appliedFilters.depotId !== null;
  
  // Can apply filters - depot must be selected in pending
  const canApplyFilters = pendingFilters.depotId !== null;

  return {
    pendingFilters,
    appliedFilters,
    setPendingDepot,
    setPendingDestination,
    applyFilters,
    clearFilters,
    filterBids,
    availableDestinations,
    depotOptions: DEPOT_MASTER_LIST,
    hasActiveFilters,
    canApplyFilters,
    isSearching,
  };
}
