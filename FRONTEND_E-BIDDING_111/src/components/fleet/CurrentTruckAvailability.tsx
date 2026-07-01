import { useAdminStore, TruckDetail } from '@/store/adminStore';
import { useDataStore } from '@/store/dataStore';
import { getDepotDisplayName } from '@/constants/depots';
import { format } from 'date-fns';
import { Truck, MapPin, Clock, User, Package } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

/**
 * Current Truck Availability Section for Vendor Home Page
 * Shows only trucks with status = 'Available' from Fleet Admin
 * 
 * CRITICAL: Trucks are IMMEDIATELY removed when bidding starts
 * A truck cannot be both Available AND in Bidding - these states are mutually exclusive
 */
export default function CurrentTruckAvailability() {
  const { truckDetails } = useAdminStore();
  const { vehicleBids, biddingContext } = useDataStore();

  // Get all depot+tonnage combinations that are currently in ANY bidding state
  // This includes Live, Paused - anything that has entered the bidding flow
  const biddingKeys = new Set(
    vehicleBids
      .filter(vb => vb.status === 'Live' || vb.status === 'Paused')
      .map(vb => `${vb.depot_id}-${vb.tonnage}T`)
  );

  // Also check biddingContext - if vendor has started bidding for a depot+tonnage combo
  // those trucks are considered "entering bidding" even before vehicleBid is created
  if (biddingContext.started && biddingContext.specifications.length > 0) {
    biddingContext.specifications.forEach(spec => {
      spec.tonnages.forEach(tonnage => {
        biddingKeys.add(`${spec.depot_id}-${tonnage}T`);
      });
    });
  }

  // Filter ONLY trucks that are:
  // 1. Status = 'Available' (from Fleet Admin)
  // 2. NOT in any bidding flow (depot+tonnage not in biddingKeys)
  const availableTrucks = truckDetails.filter((truck) => {
    if (truck.status !== 'Available') return false;
    
    // Create key for this truck's depot+tonnage combination
    const truckKey = `${truck.currentDepot}-${truck.tonnage}`;
    
    // If this combination is in bidding, truck is NOT available
    return !biddingKeys.has(truckKey);
  });

  const getDepotName = (depotId: string) => {
    return getDepotDisplayName(depotId) || depotId;
  };

  const formatLastUpdated = (timestamp?: string) => {
    if (!timestamp) return 'N/A';
    try {
      return format(new Date(timestamp), 'h:mm a');
    } catch {
      return 'N/A';
    }
  };

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-border bg-muted/30 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Truck className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="font-semibold text-foreground">Current Truck Availability</h2>
            <p className="text-xs text-muted-foreground">
              Trucks ready for bidding • Data from Fleet Admin
            </p>
          </div>
        </div>
        <Badge variant="secondary" className="gap-1">
          <Truck className="h-3 w-3" />
          {availableTrucks.length} Available
        </Badge>
      </div>

      {/* Content */}
      {availableTrucks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 px-6">
          <div className="p-4 bg-muted rounded-full mb-4">
            <Truck className="h-10 w-10 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-2">No Trucks Available</h3>
          <p className="text-muted-foreground text-center max-w-sm text-sm">
            No trucks are currently available for bidding. Check back when Fleet Admin updates availability.
          </p>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/20 hover:bg-muted/20">
              <TableHead className="font-semibold">Truck Number</TableHead>
              <TableHead className="font-semibold">Tonnage</TableHead>
              <TableHead className="font-semibold">Current Depot</TableHead>
              <TableHead className="font-semibold">Destination</TableHead>
              <TableHead className="font-semibold">Driver Name</TableHead>
              <TableHead className="font-semibold text-center">Last Updated</TableHead>
              <TableHead className="font-semibold text-center">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {availableTrucks.map((truck) => (
              <TableRow key={truck.id} className="hover:bg-muted/20">
                <TableCell className="font-medium font-mono">
                  {truck.truckNumber}
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="font-semibold">
                    <Package className="h-3 w-3 mr-1" />
                    {truck.tonnage}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">{getDepotName(truck.currentDepot)}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <span className="text-sm text-muted-foreground">
                    {truck.destination || '—'}
                  </span>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">{truck.driverName}</span>
                  </div>
                </TableCell>
                <TableCell className="text-center">
                  <div className="flex items-center justify-center gap-1 text-sm text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {formatLastUpdated(truck.availableSince)}
                  </div>
                </TableCell>
                <TableCell className="text-center">
                  <Badge 
                    variant="outline" 
                    className="bg-success/20 text-success border-success/30"
                  >
                    Available
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
