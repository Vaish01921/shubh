import { Factory, Truck, Gavel, Trophy, RefreshCw } from 'lucide-react';
import { useDataStore } from '@/store/dataStore';
import { useFleetAvailability } from '@/hooks/useFleetAvailability';
import { useBidDiscovery } from '@/hooks/useBidDiscovery';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import CurrentTruckAvailability from '@/components/fleet/CurrentTruckAvailability';
import { useToast } from '@/hooks/use-toast';

interface DashboardCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  onClick: () => void;
  isHighlighted?: boolean;
  iconColorClass?: string;
}

function DashboardCard({ title, value, icon, onClick, isHighlighted, iconColorClass = 'text-primary' }: DashboardCardProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'group relative bg-card border border-border rounded-xl p-6 text-left w-full',
        'hover:border-muted-foreground/30 hover:shadow-md',
        'transition-all duration-200 ease-out cursor-pointer',
        'focus:outline-none focus:ring-2 focus:ring-primary/30 focus:ring-offset-2',
        'shadow-sm'
      )}
    >
      {/* Subtle highlight indicator */}
      {isHighlighted && (
        <span className="absolute top-3 right-3 flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-60"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-success"></span>
        </span>
      )}
      
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-muted-foreground mb-1">{title}</p>
          <p className="text-3xl font-semibold text-foreground tracking-tight">
            {value}
          </p>
        </div>
        <div className={cn(
          'p-3 rounded-lg bg-muted/50 transition-colors duration-200 group-hover:bg-muted',
          iconColorClass
        )}>
          {icon}
        </div>
      </div>
    </button>
  );
}

export default function Home() {
  const { plants, vehicleBids, biddingContext, getActiveBidOpportunities, refreshBidOpportunities } = useDataStore();
  const { toast } = useToast();
  
  // Fleet availability from Fleet Admin (single source of truth)
  const { totalTrucks, availableTrucks, activeTrucks, nonActiveTrucks, inTripTrucks } = useFleetAvailability();

  // Enable bid discovery monitoring (checks for new bids when bidding is active)
  const { isMonitoring } = useBidDiscovery();

  // Dialog states
  const [plantsDialogOpen, setPlantsDialogOpen] = useState(false);
  const [trucksDialogOpen, setTrucksDialogOpen] = useState(false);
  const [bidsDialogOpen, setBidsDialogOpen] = useState(false);
  const [rankDialogOpen, setRankDialogOpen] = useState(false);
  
  // Refresh state
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefreshTime, setLastRefreshTime] = useState<Date | null>(null);

  // Handle manual refresh of active bids
  const handleRefreshBids = async (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card click
    
    if (!biddingContext.started) {
      toast({
        title: "Bidding not started",
        description: "Start bidding from Control Panel first",
        variant: "destructive",
      });
      return;
    }
    
    setIsRefreshing(true);
    try {
      const result = await refreshBidOpportunities();
      setLastRefreshTime(new Date());
      toast({
        title: "Bids Refreshed",
        description: `Found ${result.count} active vehicle bid${result.count !== 1 ? 's' : ''} matching your requirements`,
      });
    } catch (error) {
      toast({
        title: "Refresh failed",
        description: "Unable to refresh bids. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsRefreshing(false);
    }
  };


  // Calculate metrics
  const activePlants = plants.filter(p => p.isActive !== false);
  const activePlantsCount = activePlants.length;

  // Active Bid Opportunities - ONLY shown after vendor starts bidding
  // Filtered by vendor's selected specifications (depot, destination, tonnage)
  const activeBidOpportunities = getActiveBidOpportunities();
  const totalActiveBids = activeBidOpportunities.reduce((sum, bo) => sum + bo.availableBids, 0);
  const biddingStarted = biddingContext.started;

  // Live E-Bidding calculations - vehicle-level competition (for Rank 1 only)
  const rank1VehicleBids = vehicleBids.filter(vb => vb.rank === 1 && vb.status === 'Live');
  const hasRank1 = rank1VehicleBids.length > 0;
  const rank1Count = rank1VehicleBids.length;

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground mt-1">Quick overview of your bidding activity</p>
      </div>

      {/* Active Bidding Indicator */}
      {isMonitoring && (
        <div className="bg-success/10 border border-success/30 rounded-lg p-3 flex items-center gap-3">
          <span className="flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-success opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-success"></span>
          </span>
          <span className="text-sm text-success font-medium">
            Bid discovery active — Monitoring for new matching opportunities
          </span>
        </div>
      )}

      {/* Dashboard Cards - 2x2 Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Active Plants */}
        <DashboardCard
          title="Active Plants"
          value={activePlantsCount}
          icon={<Factory className="h-5 w-5" />}
          onClick={() => setPlantsDialogOpen(true)}
          iconColorClass="text-primary"
        />

        {/* Trucks */}
        <DashboardCard
          title="Trucks"
          value={`${availableTrucks} / ${totalTrucks}`}
          icon={<Truck className="h-5 w-5" />}
          onClick={() => setTrucksDialogOpen(true)}
          iconColorClass="text-blue-600"
        />

        {/* Active Vehicle Bids - Incoming Opportunities (only after bidding starts) */}
        <div className="relative">
          <DashboardCard
            title="Active Vehicle Bids"
            value={totalActiveBids}
            icon={<Gavel className="h-5 w-5" />}
            onClick={() => setBidsDialogOpen(true)}
            isHighlighted={biddingStarted && totalActiveBids > 0}
            iconColorClass="text-amber-600"
          />
          {/* Refresh Button - Only visible when bidding is started */}
          {biddingStarted && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRefreshBids}
              disabled={isRefreshing}
              className="absolute top-2 right-2 z-10 h-8 px-2 text-xs text-muted-foreground hover:text-foreground"
            >
              <RefreshCw className={cn("h-3.5 w-3.5 mr-1", isRefreshing && "animate-spin")} />
              {isRefreshing ? "..." : "Refresh"}
            </Button>
          )}
        </div>

        {/* Rank 1 Vehicles */}
        <DashboardCard
          title="Rank 1 Vehicles"
          value={rank1Count}
          icon={<Trophy className="h-5 w-5" />}
          onClick={() => setRankDialogOpen(true)}
          isHighlighted={hasRank1}
          iconColorClass="text-emerald-600"
        />
      </div>

      {/* Active Plants Dialog */}
      <Dialog open={plantsDialogOpen} onOpenChange={setPlantsDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Factory className="h-5 w-5 text-primary" />
              Active Tie-Up Plants
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-4">
            {activePlants.map((plant) => (
              <div 
                key={plant.id} 
                className="p-4 bg-muted/50 rounded-lg border border-border"
              >
                <p className="font-medium text-foreground">{plant.name}</p>
                <p className="text-sm text-muted-foreground">Plant ID: {plant.id}</p>
              </div>
            ))}
            {activePlants.length === 0 && (
              <p className="text-muted-foreground text-center py-4">No active plants</p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Trucks Dialog */}
      <Dialog open={trucksDialogOpen} onOpenChange={setTrucksDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Truck className="h-5 w-5 text-blue-500" />
              Truck Summary
            </DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 mt-4">
            <div className="p-4 bg-muted/50 rounded-lg border border-border text-center">
              <p className="text-3xl font-bold text-foreground">{totalTrucks}</p>
              <p className="text-sm text-muted-foreground">Total Trucks</p>
            </div>
            <div className="p-4 bg-success/10 rounded-lg border border-success/20 text-center">
              <p className="text-3xl font-bold text-success">{activeTrucks}</p>
              <p className="text-sm text-muted-foreground">Active Trucks</p>
            </div>
            <div className="p-4 bg-destructive/10 rounded-lg border border-destructive/20 text-center">
              <p className="text-3xl font-bold text-destructive">{nonActiveTrucks}</p>
              <p className="text-sm text-muted-foreground">Non-Active Trucks</p>
            </div>
            <div className="p-4 bg-primary/10 rounded-lg border border-primary/20 text-center">
              <p className="text-3xl font-bold text-primary">{availableTrucks}</p>
              <p className="text-sm text-muted-foreground">Available Trucks</p>
            </div>
            <div className="col-span-2 p-4 bg-warning/10 rounded-lg border border-warning/20 text-center">
              <p className="text-3xl font-bold text-warning">{inTripTrucks}</p>
              <p className="text-sm text-muted-foreground">In-Trip Trucks</p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-4 text-center">
            Data synced from Fleet Admin updates
          </p>
        </DialogContent>
      </Dialog>

      {/* Active Vehicle Bids Dialog - Shows Bid Opportunities (ONLY after bidding starts) */}
      <Dialog open={bidsDialogOpen} onOpenChange={setBidsDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Gavel className="h-5 w-5 text-warning" />
              Active Vehicle Bids ({totalActiveBids})
            </DialogTitle>
          </DialogHeader>
          
          {biddingStarted ? (
            <>
              <p className="text-sm text-muted-foreground">
                Incoming bid opportunities matching your specifications
              </p>
              <div className="space-y-3 mt-4 max-h-[400px] overflow-y-auto">
                {activeBidOpportunities.map((bo) => (
                  <div 
                    key={bo.id} 
                    className="p-4 bg-muted/50 rounded-lg border border-border"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <p className="font-medium text-foreground">
                        {bo.depot_name} {bo.destination ? `→ ${bo.destination}` : ''}
                      </p>
                      <span className="px-2 py-0.5 bg-success/20 text-success text-xs font-medium rounded-full">
                        Open for Bidding
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Tonnage: {bo.tonnage}T</span>
                      <span className="font-medium text-warning">
                        {bo.availableBids} bid{bo.availableBids !== 1 ? 's' : ''} available
                      </span>
                    </div>
                    {!bo.destination && (
                      <p className="text-xs text-muted-foreground mt-1 italic">No destination specified</p>
                    )}
                  </div>
                ))}
                {activeBidOpportunities.length === 0 && (
                  <div className="text-center py-8">
                    <Gavel className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                    <p className="text-muted-foreground">No matching bid opportunities</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      No bids match your selected specifications
                    </p>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="text-center py-8">
              <Gavel className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground font-medium">No active bids</p>
              <p className="text-sm text-muted-foreground mt-2">
                Start bidding from the <span className="text-primary font-medium">Control Panel</span> to see available bids
              </p>
              <p className="text-xs text-muted-foreground mt-4">
                Select your depots, destinations, and tonnage specifications to view matching opportunities
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Rank Dialog */}
      <Dialog open={rankDialogOpen} onOpenChange={setRankDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-success" />
              Rank 1 Vehicles ({rank1VehicleBids.length})
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-4">
            {rank1VehicleBids.length > 0 ? (
              rank1VehicleBids.map((vb) => (
                <div 
                  key={vb.id} 
                  className="p-4 bg-success/10 rounded-lg border border-success/20"
                >
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-medium text-foreground">Vehicle – {vb.tonnage}T</p>
                    <span className="px-2 py-1 bg-success/20 text-success text-xs font-bold rounded-full animate-pulse">
                      Rank 1
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">{vb.plant_name} – {vb.depot_name}</p>
                  {vb.destination && (
                    <p className="text-sm text-muted-foreground">→ {vb.destination}</p>
                  )}
                </div>
              ))
            ) : (
              <div className="text-center py-8">
                <Trophy className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-muted-foreground">No Rank 1 vehicles yet</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Each vehicle competes independently for Rank 1
                </p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Current Truck Availability Section - Live operational data from Fleet Admin */}
      <CurrentTruckAvailability />
    </div>
  );
}
