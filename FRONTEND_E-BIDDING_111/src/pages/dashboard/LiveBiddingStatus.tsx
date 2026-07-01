import { useEffect, useState } from 'react';
import { Activity, Clock, Trophy, AlertCircle, Send } from 'lucide-react';
import { useDataStore, VehicleBid } from '@/store/dataStore';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { ActionRequestModal } from '@/components/fleet/ActionRequestModal';
import { BidFilterBar } from '@/components/bidding/BidFilterBar';
import { useBidFilters } from '@/hooks/useBidFilters';

export default function LiveBiddingStatus() {
  const { vehicleBids, currentUser, createActionRequest } = useDataStore();
  const [, setTick] = useState(0);
  const [selectedVehicle, setSelectedVehicle] = useState<VehicleBid | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

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

  // Fleet users can only send requests, not execute actions
  const isFleetUser = currentUser?.role === 'fleet';

  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  // Filter vehicle bids by status then apply depot/destination filters
  const allLiveBids = vehicleBids.filter(vb => vb.status === 'Live' || vb.status === 'Paused');
  const allClosedBids = vehicleBids.filter(vb => vb.status === 'Closed');
  
  const liveVehicleBids = filterBids(allLiveBids);
  const closedVehicleBids = filterBids(allClosedBids);

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

  const handleRequestAction = (vehicleBid: VehicleBid) => {
    setSelectedVehicle(vehicleBid);
    setIsModalOpen(true);
  };

  const handleSubmitRequest = (requestType: 'PAUSE' | 'CLOSE', remarks?: string) => {
    if (!selectedVehicle) return;
    
    createActionRequest(selectedVehicle.id, requestType, remarks);
    toast.success(`${requestType === 'PAUSE' ? 'Pause' : 'Close'} request sent to Vendor for approval`);
    setSelectedVehicle(null);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="bg-card rounded-xl p-6 border border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative p-3 bg-primary/10 rounded-lg">
              <Activity className="h-6 w-6 text-primary" />
              {liveVehicleBids.length > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 w-4">
                  <span className="animate-ping absolute h-full w-full rounded-full bg-success opacity-75"></span>
                  <span className="relative rounded-full h-4 w-4 bg-success"></span>
                </span>
              )}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Live E-Bidding Status</h1>
              <p className="text-muted-foreground text-sm">
                {liveVehicleBids.length > 0 
                  ? `${liveVehicleBids.length} active vehicle bid(s)` 
                  : 'No active vehicle bids'}
                {isFleetUser && ' • Fleet View (Request Only)'}
              </p>
            </div>
          </div>
          {liveVehicleBids.length > 0 && (
            <div className="flex items-center gap-2 text-success">
              <span className="animate-pulse">●</span>LIVE
            </div>
          )}
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

      {/* Fleet User Notice */}
      {isFleetUser && (
        <div className="bg-warning/10 border border-warning/30 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-warning flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-warning">Fleet User Access</p>
            <p className="text-sm text-muted-foreground mt-1">
              You can view live bids and send action requests. All pause/close actions require Vendor approval.
            </p>
          </div>
        </div>
      )}

      {/* Live Vehicle Bids Table */}
      {liveVehicleBids.length > 0 ? (
        <div className="bg-card rounded-xl border border-border overflow-hidden">
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
              {liveVehicleBids.map((vb) => (
                <TableRow 
                  key={vb.id} 
                  className={cn(
                    'hover:bg-muted/20',
                    vb.rank === 1 && vb.status === 'Live' && 'bg-warning/5',
                    vb.pendingRequest && 'animate-pulse bg-warning/10'
                  )}
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
                  
                  {/* Status Column - Per Vehicle */}
                  <TableCell className="text-center">
                    <div className="flex flex-col items-center gap-1">
                      <span className={cn(
                        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium",
                        vb.status === 'Live' 
                          ? "bg-success/20 text-success" 
                          : "bg-warning/20 text-warning"
                      )}>
                        <span className={vb.status === 'Live' ? "animate-pulse" : ""}>●</span>
                        {vb.status}
                      </span>
                      {vb.pendingRequest && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-warning/20 text-warning rounded-full font-medium animate-pulse">
                          {vb.pendingRequest.requestType === 'PAUSE' ? 'PAUSE' : 'CLOSE'} REQUEST PENDING
                        </span>
                      )}
                    </div>
                  </TableCell>
                  
                  {/* Rank Column - Per Vehicle */}
                  <TableCell className="text-center">
                    {vb.rank !== null ? (
                      vb.rank === 1 ? (
                        <span className={cn(
                          "inline-flex items-center gap-1 px-3 py-1 rounded-full bg-warning/20 text-warning font-bold",
                          vb.status === 'Live' && "animate-pulse"
                        )}>
                          <Trophy className="h-3 w-3" />1
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-3 py-1 rounded-full bg-muted text-muted-foreground font-medium">
                          {vb.rank}
                        </span>
                      )
                    ) : '—'}
                  </TableCell>
                  
                  {/* Time Column */}
                  <TableCell className="text-center font-mono">
                    <Clock className="h-3 w-3 inline mr-1" />
                    {formatTime(vb.time_remaining)}
                  </TableCell>
                  
                  {/* Action Column - Fleet can only request, not execute */}
                  <TableCell className="text-center">
                    {vb.pendingRequest ? (
                      <span className="text-xs text-muted-foreground px-2 py-1 bg-muted rounded">
                        Request Pending
                      </span>
                    ) : (
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="gap-1.5 border-primary/30 text-primary hover:bg-primary/10"
                        onClick={() => handleRequestAction(vb)}
                      >
                        <Send className="h-3.5 w-3.5" />
                        Send Request
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="bg-card rounded-xl border border-border p-12 text-center">
          <Activity className="h-16 w-16 text-muted-foreground/30 mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">
            {hasActiveFilters ? 'No Live Bids Found' : 'No Live Vehicle Bids'}
          </h3>
          <p className="text-muted-foreground">
            {hasActiveFilters 
              ? 'No records found for selected criteria. Try adjusting your filters.'
              : 'Start a new bid from the Control Panel. Each vehicle will be an independent bid.'}
          </p>
        </div>
      )}

      {/* Closed Vehicle Bids Section */}
      {closedVehicleBids.length > 0 && (
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="p-4 border-b border-border bg-muted/30">
            <h2 className="font-semibold">Closed Vehicle Bids</h2>
            <p className="text-xs text-muted-foreground mt-1">
              {closedVehicleBids.filter(vb => vb.rank === 1).length} won (Rank 1)
            </p>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Vehicle</TableHead>
                <TableHead>Plant</TableHead>
                <TableHead>Depot</TableHead>
                <TableHead>Destination</TableHead>
                <TableHead>Tonnage</TableHead>
                <TableHead className="text-center">Final Rank</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {closedVehicleBids.map((vb) => (
                <TableRow key={vb.id} className={cn(vb.rank === 1 && 'bg-success/5')}>
                  <TableCell className="font-medium">Vehicle – {vb.tonnage}T</TableCell>
                  <TableCell>{vb.plant_name}</TableCell>
                  <TableCell>{vb.depot_name}</TableCell>
                  <TableCell>{vb.destination || '—'}</TableCell>
                  <TableCell>
                    <span className="px-2 py-1 bg-accent/50 text-accent-foreground rounded-md text-sm font-medium">
                      {vb.tonnage}T
                    </span>
                  </TableCell>
                  <TableCell className="text-center">
                    {vb.rank === 1 ? (
                      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-success/20 text-success font-bold">
                        <Trophy className="h-3 w-3" />1 - Won
                      </span>
                    ) : (
                      <span className="text-muted-foreground font-medium">{vb.rank || '—'}</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Action Request Modal */}
      <ActionRequestModal
        open={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedVehicle(null);
        }}
        vehicleBid={selectedVehicle}
        onSubmit={handleSubmitRequest}
      />
    </div>
  );
}
