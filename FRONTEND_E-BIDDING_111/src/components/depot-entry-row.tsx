import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { TonnageSelector, TonnageOption } from '@/components/ui/tonnage-selector';
import { cn } from '@/lib/utils';

export interface DepotEntry {
  id: string;
  depotId: string;
  destination: string;
  tonnages: number[];
}

interface DepotOption {
  id: string;
  code: string;
  name: string;
}

interface DepotEntryRowProps {
  entry: DepotEntry;
  entryIndex: number;
  depotOptions: DepotOption[];
  tonnageOptions: TonnageOption[];
  onUpdate: (updatedEntry: DepotEntry) => void;
  onRemove: () => void;
  canRemove: boolean;
}

export function DepotEntryRow({
  entry,
  entryIndex,
  depotOptions,
  tonnageOptions,
  onUpdate,
  onRemove,
  canRemove,
}: DepotEntryRowProps) {
  const selectedDepot = depotOptions.find(d => d.id === entry.depotId);
  const vehicleCount = entry.tonnages.length;

  return (
    <div className="bg-muted/30 border border-border rounded-xl p-4 space-y-4 relative">
      {/* Entry Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold bg-primary/10 text-primary px-2 py-1 rounded-md">
            Entry {entryIndex + 1}
          </span>
          {selectedDepot && (
            <span className="text-sm font-medium text-foreground">
              {selectedDepot.name}
            </span>
          )}
          {vehicleCount > 0 && (
            <span className="text-xs bg-accent text-accent-foreground px-2 py-0.5 rounded-full">
              {vehicleCount} vehicle{vehicleCount !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        {canRemove && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onRemove}
            className="h-8 px-2 text-destructive hover:text-destructive hover:bg-destructive/10"
          >
            <Trash2 className="h-4 w-4 mr-1" />
            Remove
          </Button>
        )}
      </div>

      {/* Depot & Destination Row */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Depot Selector */}
        <div className="space-y-2">
          <Label className="text-foreground font-medium text-sm">Depot *</Label>
          <Select
            value={entry.depotId}
            onValueChange={(val) => onUpdate({ ...entry, depotId: val })}
          >
            <SelectTrigger className="bg-background border-border h-11">
              <SelectValue placeholder="Select depot" />
            </SelectTrigger>
            <SelectContent className="bg-popover border-border z-50">
              {depotOptions.map((depot) => (
                <SelectItem key={depot.id} value={depot.id}>
                  {depot.name} – {depot.code}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Destination (Optional) */}
        <div className="space-y-2">
          <Label className="text-foreground font-medium text-sm">
            Destination <span className="text-muted-foreground">(Optional)</span>
          </Label>
          <Input
            placeholder="Enter destination for this depot"
            value={entry.destination}
            onChange={(e) => onUpdate({ ...entry, destination: e.target.value })}
            className="bg-background border-border h-11"
          />
        </div>
      </div>

      {/* Tonnage Selector */}
      <div className="space-y-2">
        <Label className="text-foreground font-medium text-sm">
          Tonnage * <span className="text-muted-foreground">(Click to add vehicles)</span>
        </Label>
        <TonnageSelector
          options={tonnageOptions}
          selected={entry.tonnages}
          onChange={(tonnages) => onUpdate({ ...entry, tonnages })}
          placeholder="Click to add vehicles for this depot..."
        />
      </div>

      {/* Per-entry vehicle count */}
      {vehicleCount > 0 && (
        <div className="flex items-center justify-end pt-2 border-t border-border/50">
          <span className="text-sm text-muted-foreground">
            Vehicles for this entry:
          </span>
          <span className={cn(
            "ml-2 text-lg font-bold",
            vehicleCount > 0 ? 'text-primary' : 'text-muted-foreground'
          )}>
            {vehicleCount}
          </span>
        </div>
      )}
    </div>
  );
}
