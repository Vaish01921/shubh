import { MapPin, Navigation, X, Search, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { BidFilters } from '@/hooks/useBidFilters';
import { DEPOT_MASTER_LIST } from '@/constants/depots';

interface BidFilterBarProps {
  pendingFilters: BidFilters;
  appliedFilters: BidFilters;
  onDepotChange: (depotId: string | null) => void;
  onDestinationChange: (destination: string | null) => void;
  onApplyFilters: () => void;
  onClearFilters: () => void;
  availableDestinations: string[];
  hasActiveFilters: boolean;
  canApplyFilters: boolean;
  isSearching: boolean;
}

export function BidFilterBar({
  pendingFilters,
  appliedFilters,
  onDepotChange,
  onDestinationChange,
  onApplyFilters,
  onClearFilters,
  availableDestinations,
  hasActiveFilters,
  canApplyFilters,
  isSearching,
}: BidFilterBarProps) {
  const selectedAppliedDepot = DEPOT_MASTER_LIST.find(d => d.id === appliedFilters.depotId);

  return (
    <div className="sticky top-0 z-10 bg-card border border-border rounded-xl p-4 mb-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-4">
        {/* Depot Selector */}
        <div className="flex items-center gap-2 min-w-[220px]">
          <MapPin className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          <Select
            value={pendingFilters.depotId || ""}
            onValueChange={(value) => onDepotChange(value || null)}
          >
            <SelectTrigger className="h-9 bg-background border-border">
              <SelectValue placeholder="Select Depot" />
            </SelectTrigger>
            <SelectContent className="bg-popover border-border z-50">
              {DEPOT_MASTER_LIST.map((depot) => (
                <SelectItem key={depot.id} value={depot.id}>
                  {depot.displayName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Destination Selector - Only enabled when depot is selected */}
        <div className="flex items-center gap-2 min-w-[220px]">
          <Navigation className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          <Select
            value={pendingFilters.destination || ""}
            onValueChange={(value) => onDestinationChange(value || null)}
            disabled={!pendingFilters.depotId || availableDestinations.length === 0}
          >
            <SelectTrigger 
              className={`h-9 bg-background border-border ${
                !pendingFilters.depotId ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              <SelectValue 
                placeholder={
                  !pendingFilters.depotId 
                    ? "Select depot first" 
                    : availableDestinations.length === 0 
                    ? "No destinations available"
                    : "Select Destination (Optional)"
                } 
              />
            </SelectTrigger>
            <SelectContent className="bg-popover border-border z-50">
              {availableDestinations.map((dest) => (
                <SelectItem key={dest} value={dest}>
                  {dest}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Apply Filters Button */}
        <Button
          onClick={onApplyFilters}
          disabled={!canApplyFilters || isSearching}
          className="h-9 px-4"
        >
          {isSearching ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Searching...
            </>
          ) : (
            <>
              <Search className="h-4 w-4 mr-2" />
              Apply Filters
            </>
          )}
        </Button>

        {/* Clear Filters Button */}
        {(hasActiveFilters || pendingFilters.depotId) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearFilters}
            className="h-9 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4 mr-1" />
            Clear Filters
          </Button>
        )}

        {/* Active Filter Chips - Show applied filters */}
        {hasActiveFilters && (
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-xs text-muted-foreground">Active:</span>
            {selectedAppliedDepot && (
              <Badge 
                variant="secondary" 
                className="flex items-center gap-1 px-2 py-1"
              >
                <MapPin className="h-3 w-3" />
                {selectedAppliedDepot.name}
              </Badge>
            )}
            {appliedFilters.destination && (
              <Badge 
                variant="secondary" 
                className="flex items-center gap-1 px-2 py-1"
              >
                <Navigation className="h-3 w-3" />
                {appliedFilters.destination}
              </Badge>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
