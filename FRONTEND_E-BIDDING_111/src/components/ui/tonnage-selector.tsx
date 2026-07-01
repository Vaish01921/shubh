import * as React from "react";
import { X, Plus, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export interface TonnageOption {
  value: number;
  label: string;
}

interface TonnageSelectorProps {
  options: TonnageOption[];
  selected: number[];
  onChange: (selected: number[]) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

// Group tonnages by value and count occurrences
function groupTonnages(tonnages: number[]): Map<number, number> {
  const grouped = new Map<number, number>();
  tonnages.forEach((t) => {
    grouped.set(t, (grouped.get(t) || 0) + 1);
  });
  return grouped;
}

export function TonnageSelector({
  options,
  selected,
  onChange,
  placeholder = "Add vehicles by tonnage...",
  disabled = false,
  className,
}: TonnageSelectorProps) {
  const [open, setOpen] = React.useState(false);

  // Group selected tonnages for display
  const groupedTonnages = groupTonnages(selected);

  // Add a tonnage (allows duplicates)
  const handleAdd = (value: number) => {
    onChange([...selected, value]);
  };

  // Remove one instance of a tonnage
  const handleRemoveOne = (value: number) => {
    const index = selected.indexOf(value);
    if (index > -1) {
      const newSelected = [...selected];
      newSelected.splice(index, 1);
      onChange(newSelected);
    }
  };

  // Remove all instances of a tonnage
  const handleRemoveAll = (value: number) => {
    onChange(selected.filter((t) => t !== value));
  };

  // Clear all selections
  const handleClearAll = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange([]);
  };

  // Get label for a tonnage value
  const getLabel = (value: number) => {
    const option = options.find((opt) => opt.value === value);
    return option?.label || `${value}T`;
  };

  return (
    <div className={cn("space-y-3", className)}>
      {/* Tonnage Options Grid */}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild disabled={disabled}>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn(
              "w-full justify-between h-12 px-4 bg-background border-border hover:bg-background",
              disabled && "opacity-50 cursor-not-allowed"
            )}
          >
            <span className="text-muted-foreground font-normal">
              {selected.length === 0 
                ? placeholder 
                : `${selected.length} vehicle(s) selected - Click to add more`
              }
            </span>
            <Plus className="h-4 w-4 text-muted-foreground shrink-0" />
          </Button>
        </PopoverTrigger>
        <PopoverContent 
          className="w-[--radix-popover-trigger-width] p-3 bg-popover border-border z-50" 
          align="start"
        >
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground font-medium mb-2">
              Click to add a vehicle (can add same tonnage multiple times)
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {options.map((option) => {
                const count = groupedTonnages.get(option.value) || 0;
                return (
                  <Button
                    key={option.value}
                    variant="outline"
                    size="sm"
                    onClick={() => handleAdd(option.value)}
                    className="h-10 justify-between border-border hover:bg-primary/10 hover:border-primary/50"
                  >
                    <span className="font-medium">{option.label}</span>
                    {count > 0 && (
                      <span className="ml-2 px-1.5 py-0.5 bg-primary/20 text-primary text-xs rounded-full font-semibold">
                        {count}
                      </span>
                    )}
                  </Button>
                );
              })}
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {/* Selected Tonnages Display */}
      {selected.length > 0 && (
        <div className="bg-muted/30 border border-border rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-muted-foreground">
              Selected Vehicles ({selected.length} total)
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearAll}
              className="h-6 px-2 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
            >
              Clear All
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {Array.from(groupedTonnages.entries()).map(([value, count]) => (
              <div
                key={value}
                className="flex items-center gap-1 bg-primary/10 border border-primary/20 rounded-lg px-2 py-1.5"
              >
                <span className="text-sm font-medium text-primary">
                  {getLabel(value)}
                </span>
                <span className="text-xs text-primary/80 mx-1">×</span>
                <span className="text-sm font-bold text-primary">{count}</span>
                
                {/* Increment/Decrement Controls */}
                <div className="flex items-center ml-2 gap-0.5">
                  <button
                    type="button"
                    onClick={() => handleRemoveOne(value)}
                    className="p-0.5 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-colors"
                    title="Remove one"
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAdd(value)}
                    className="p-0.5 rounded hover:bg-primary/20 text-muted-foreground hover:text-primary transition-colors"
                    title="Add one more"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRemoveAll(value)}
                    className="p-0.5 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-colors ml-1"
                    title="Remove all"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
