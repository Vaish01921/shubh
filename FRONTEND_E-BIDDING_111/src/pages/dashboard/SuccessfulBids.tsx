import { useDataStore } from "@/store/dataStore";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CheckCircle, Clock, Trophy, Award } from "lucide-react";
import { BidFilterBar } from '@/components/bidding/BidFilterBar';
import { useBidFilters } from '@/hooks/useBidFilters';

export default function SuccessfulBids() {
  const { vehicleBids } = useDataStore();
  
  // Filter hook
  const {
    pendingFilters,
    appliedFilters,
    setPendingDepot,
    setPendingDestination,
    applyFilters,
    clearFilters,
    filterBids,
    availableDestinations,
    hasActiveFilters,
    canApplyFilters,
    isSearching,
  } = useBidFilters(vehicleBids);
  
  // ONLY show successful bids: status = 'Closed' AND rank = 1
  // These are the bids that were WON by the vendor
  const allSuccessfulBids = vehicleBids.filter(
    vb => vb.status === 'Closed' && vb.rank === 1
  );
  
  // Apply depot/destination filters
  const successfulVehicleBids = filterBids(allSuccessfulBids);

  const formatDateTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return {
      date: date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
      time: date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
    };
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header Section */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-success/20 rounded-lg">
            <Award className="h-6 w-6 text-success" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Successful Bids</h1>
            <p className="text-sm text-muted-foreground">
              Bids you have won - Your achievement history
            </p>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <BidFilterBar
        pendingFilters={pendingFilters}
        appliedFilters={appliedFilters}
        onDepotChange={setPendingDepot}
        onDestinationChange={setPendingDestination}
        onApplyFilters={applyFilters}
        onClearFilters={clearFilters}
        availableDestinations={availableDestinations}
        hasActiveFilters={hasActiveFilters}
        canApplyFilters={canApplyFilters}
        isSearching={isSearching}
      />

      {/* Summary Card */}
      <div className="bg-success/10 border border-success/30 rounded-xl p-4">
        <div className="flex items-center gap-4">
          <Trophy className="h-8 w-8 text-success" />
          <div>
            <p className="text-2xl font-bold text-success">{successfulVehicleBids.length}</p>
            <p className="text-sm text-muted-foreground">
              {hasActiveFilters ? 'Filtered Successful Bids' : 'Total Successful Bids (Rank 1 Wins)'}
            </p>
          </div>
        </div>
      </div>

      {/* Successful Bids Table - ONLY Rank 1 Bids */}
      {successfulVehicleBids.length > 0 ? (
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="p-4 border-b border-border bg-muted/30">
            <h2 className="font-semibold text-foreground">Your Winning Bids</h2>
            <p className="text-xs text-muted-foreground mt-1">
              These are the bids you have WON - Permanent success archive
            </p>
          </div>
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead>Vehicle</TableHead>
                <TableHead>Plant</TableHead>
                <TableHead>Depot</TableHead>
                <TableHead>Destination</TableHead>
                <TableHead>Tonnage</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="text-center">Rank</TableHead>
                <TableHead className="text-center">Time</TableHead>
                <TableHead className="text-center">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {successfulVehicleBids.map((vb) => {
                const { date, time } = formatDateTime(vb.created_at);
                return (
                  <TableRow 
                    key={vb.id} 
                    className="hover:bg-muted/20 bg-success/5"
                  >
                    {/* Vehicle Column */}
                    <TableCell className="font-medium">
                      Vehicle – {vb.tonnage}T
                    </TableCell>
                    
                    {/* Plant Column */}
                    <TableCell>{vb.plant_name}</TableCell>
                    
                    {/* Depot Column */}
                    <TableCell>{vb.depot_name}</TableCell>
                    
                    {/* Destination Column */}
                    <TableCell>{vb.destination || '—'}</TableCell>
                    
                    {/* Tonnage Column */}
                    <TableCell>
                      <span className="px-2 py-1 bg-accent/50 text-accent-foreground rounded-md text-sm font-medium">
                        {vb.tonnage}T
                      </span>
                    </TableCell>
                    
                    {/* Status Column - Successful Only */}
                    <TableCell className="text-center">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-success/20 text-success">
                        <CheckCircle className="h-3 w-3" />
                        Successful
                      </span>
                    </TableCell>
                    
                    {/* Rank Column - Always 1 */}
                    <TableCell className="text-center">
                      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-warning/20 text-warning font-bold">
                        <Trophy className="h-3 w-3" />1
                      </span>
                    </TableCell>
                    
                    {/* Time Column - Completion Time */}
                    <TableCell className="text-center font-mono text-sm">
                      <div className="flex flex-col items-center">
                        <Clock className="h-3 w-3 inline mb-0.5 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">{date}</span>
                        <span className="text-xs">{time}</span>
                      </div>
                    </TableCell>
                    
                    {/* Action Column - Read-only */}
                    <TableCell className="text-center">
                      <span className="inline-flex items-center px-3 py-1.5 rounded-md bg-muted text-muted-foreground text-xs font-medium">
                        Completed
                      </span>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="bg-card rounded-xl border border-border p-12 text-center">
          <div className="flex flex-col items-center gap-4">
            <div className="p-4 bg-muted rounded-full">
              <Trophy className="h-8 w-8 text-muted-foreground" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground mb-2">
                {hasActiveFilters ? 'No Successful Bids Found' : 'No Successful Bids Yet'}
              </h3>
              <p className="text-sm text-muted-foreground max-w-md">
                {hasActiveFilters 
                  ? 'No records found for selected criteria. Try adjusting your filters.'
                  : "You haven't won any bids yet. Successful bids (Rank 1 wins) will appear here permanently once you win them."}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
