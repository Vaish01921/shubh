import { useAdminStore } from '@/store/adminStore';
import { useDataStore } from '@/store/dataStore';

export interface FleetAvailabilityCounts {
  totalTrucks: number;
  availableTrucks: number;
  activeTrucks: number;
  nonActiveTrucks: number;
  inTripTrucks: number;
  biddingTrucks: number; // Trucks currently in bidding flow
}

/**
 * Hook to get fleet availability counts from Fleet Admin data
 * This is the single source of truth for all availability-related metrics
 * Data comes from Fleet Admin updates (adminStore.truckDetails)
 * 
 * CRITICAL: Availability and Bidding are mutually exclusive states
 * A truck in bidding is NOT counted as available
 */
export function useFleetAvailability(): FleetAvailabilityCounts {
  const { truckDetails } = useAdminStore();
  const { trucks, vehicleBids, biddingContext } = useDataStore();
  
  // Total trucks comes from permanent Truck Master data (never changes daily)
  const totalTrucks = trucks.length;
  
  // Build set of depot+tonnage combinations that are in bidding
  const biddingKeys = new Set<string>();
  
  // Add from active vehicleBids (Live or Paused)
  vehicleBids
    .filter(vb => vb.status === 'Live' || vb.status === 'Paused')
    .forEach(vb => biddingKeys.add(`${vb.depot_id}-${vb.tonnage}T`));
  
  // Add from biddingContext (vendor has started bidding)
  if (biddingContext.started && biddingContext.specifications.length > 0) {
    biddingContext.specifications.forEach(spec => {
      spec.tonnages.forEach(tonnage => {
        biddingKeys.add(`${spec.depot_id}-${tonnage}T`);
      });
    });
  }
  
  // Count trucks by status, excluding those in bidding from "available"
  let availableCount = 0;
  let biddingCount = 0;
  
  truckDetails.forEach(truck => {
    if (truck.status === 'Available') {
      const truckKey = `${truck.currentDepot}-${truck.tonnage}`;
      if (biddingKeys.has(truckKey)) {
        biddingCount++;
      } else {
        availableCount++;
      }
    }
  });
  
  // Active = Available (not in bidding) OR In Trip (participating in operations)
  const inTripTrucks = truckDetails.filter(t => t.status === 'In Trip').length;
  const activeTrucks = availableCount + inTripTrucks + biddingCount;
  
  // Non-Active = Breakdown, maintenance, manually set non-active
  const nonActiveTrucks = truckDetails.filter(t => t.status === 'Non-Active').length;
  
  return {
    totalTrucks,
    availableTrucks: availableCount, // Only truly available trucks (not in bidding)
    activeTrucks,
    nonActiveTrucks,
    inTripTrucks,
    biddingTrucks: biddingCount,
  };
}
