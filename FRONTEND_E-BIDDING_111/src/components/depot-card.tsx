import { useState } from 'react';
import { Plus, Trash2, Truck, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { TonnageSelector, TonnageOption } from '@/components/ui/tonnage-selector';
import { cn } from '@/lib/utils';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export interface DepotSpecification {
  id: string;
  destination: string;
  tonnages: number[];
}

export interface DepotCardData {
  depotId: string;
  depotName: string;
  depotCode: string;
  specifications: DepotSpecification[];
}

interface DepotCardProps {
  data: DepotCardData;
  tonnageOptions: TonnageOption[];
  onUpdate: (data: DepotCardData) => void;
  onRemove: () => void;
}

const generateSpecId = () => `spec-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

export function DepotCard({
  data,
  tonnageOptions,
  onUpdate,
  onRemove,
}: DepotCardProps) {
  const [newDestination, setNewDestination] = useState('');
  const [newTonnages, setNewTonnages] = useState<number[]>([]);

  // Calculate total vehicles for this depot
  const totalVehicles = data.specifications.reduce((sum, spec) => sum + spec.tonnages.length, 0);

  // Add new specification
  const handleAddSpecification = () => {
    if (newTonnages.length === 0) return;
    
    const newSpec: DepotSpecification = {
      id: generateSpecId(),
      destination: newDestination.trim(),
      tonnages: [...newTonnages],
    };
    
    onUpdate({
      ...data,
      specifications: [...data.specifications, newSpec],
    });
    
    // Reset form
    setNewDestination('');
    setNewTonnages([]);
  };

  // Remove a specification
  const handleRemoveSpec = (specId: string) => {
    onUpdate({
      ...data,
      specifications: data.specifications.filter(s => s.id !== specId),
    });
  };

  // Update a specification's tonnages
  const handleUpdateSpecTonnages = (specId: string, tonnages: number[]) => {
    onUpdate({
      ...data,
      specifications: data.specifications.map(s => 
        s.id === specId ? { ...s, tonnages } : s
      ),
    });
  };

  // Group tonnages for display
  const formatTonnages = (tonnages: number[]) => {
    const grouped = new Map<number, number>();
    tonnages.forEach(t => grouped.set(t, (grouped.get(t) || 0) + 1));
    return Array.from(grouped.entries())
      .map(([t, count]) => count > 1 ? `${t}T ×${count}` : `${t}T`)
      .join(', ');
  };

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      {/* Card Header */}
      <div className="bg-muted/50 border-b border-border p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <MapPin className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-foreground">
                {data.depotName} – {data.depotCode}
              </h3>
              <p className="text-sm text-muted-foreground">
                {data.specifications.length} specification(s) • {totalVehicles} vehicle(s)
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onRemove}
            className="text-destructive hover:text-destructive hover:bg-destructive/10"
          >
            <Trash2 className="h-4 w-4 mr-1" />
            Remove Depot
          </Button>
        </div>
      </div>

      {/* Specifications Table */}
      {data.specifications.length > 0 && (
        <div className="border-b border-border">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30 hover:bg-muted/30">
                <TableHead className="w-[200px]">Destination</TableHead>
                <TableHead>Tonnage</TableHead>
                <TableHead className="text-center w-[120px]">Trucks Required</TableHead>
                <TableHead className="text-center w-[100px]">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.specifications.map((spec) => (
                <TableRow key={spec.id} className="hover:bg-muted/20">
                  <TableCell className="font-medium">
                    {spec.destination || (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {Array.from(
                        spec.tonnages.reduce((map, t) => {
                          map.set(t, (map.get(t) || 0) + 1);
                          return map;
                        }, new Map<number, number>())
                      ).map(([tonnage, count]) => (
                        <span
                          key={tonnage}
                          className="inline-flex items-center px-2 py-0.5 bg-accent/50 text-accent-foreground rounded text-xs font-medium"
                        >
                          {tonnage}T {count > 1 && <span className="ml-1 opacity-70">×{count}</span>}
                        </span>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <span className="inline-flex items-center justify-center w-8 h-8 bg-primary/10 text-primary rounded-full font-bold">
                      {spec.tonnages.length}
                    </span>
                  </TableCell>
                  <TableCell className="text-center">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveSpec(spec.id)}
                      className="h-8 px-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Add New Specification Form */}
      <div className="p-4 bg-muted/20">
        <div className="flex items-center gap-2 mb-3">
          <Plus className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">Add Specification</span>
        </div>
        
        <div className="grid gap-4 md:grid-cols-2">
          {/* Destination */}
          <div className="space-y-2">
            <Label className="text-sm text-foreground">
              Destination <span className="text-muted-foreground">(Optional)</span>
            </Label>
            <Input
              placeholder="Enter destination (or leave empty)"
              value={newDestination}
              onChange={(e) => setNewDestination(e.target.value)}
              className="bg-background border-border h-10"
            />
          </div>

          {/* Tonnage */}
          <div className="space-y-2">
            <Label className="text-sm text-foreground">
              Tonnage *
            </Label>
            <TonnageSelector
              options={tonnageOptions}
              selected={newTonnages}
              onChange={setNewTonnages}
              placeholder="Click to add vehicles..."
            />
          </div>
        </div>

        {/* Add Button */}
        <div className="mt-4 flex justify-end">
          <Button
            onClick={handleAddSpecification}
            disabled={newTonnages.length === 0}
            size="sm"
            className="bg-primary hover:bg-primary/90"
          >
            <Plus className="h-4 w-4 mr-1" />
            Add to {data.depotName}
          </Button>
        </div>
      </div>

      {/* Depot Summary Footer */}
      {totalVehicles > 0 && (
        <div className="bg-primary/5 border-t border-primary/20 px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Truck className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium text-foreground">
                Total for {data.depotName}:
              </span>
            </div>
            <span className="text-lg font-bold text-primary">
              {totalVehicles} vehicle{totalVehicles !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
