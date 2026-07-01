import { useState, useEffect } from 'react';
import { Settings, Rocket, Plus, MapPin } from 'lucide-react';
import { useDataStore } from '@/store/dataStore';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DepotCard, DepotCardData } from '@/components/depot-card';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import { normalizeDepotForApi } from '@/constants/depots';

const API_BASE = 'http://127.0.0.1:8000';

/** Poll GET /api/bid-job/{id} until the job finishes (async legacy or multiprocess). */
async function pollBidJob(jobId: string): Promise<Record<string, unknown>> {
  const deadline = Date.now() + 3_600_000;
  while (Date.now() < deadline) {
    const r = await fetch(`${API_BASE}/api/bid-job/${jobId}`);
    const j = (await r.json()) as Record<string, unknown>;
    if (!r.ok) {
      throw new Error(
        (typeof j.detail === 'string' ? j.detail : null) || `HTTP ${r.status}`,
      );
    }
    const st = String(j.status ?? '');
    if (st === 'completed' || st === 'failed' || st === 'partial_failed') {
      return j;
    }
    await new Promise((res) => setTimeout(res, 2000));
  }
  throw new Error('Job polling timed out');
}

export default function ControlPanel() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { 
    zones, 
    plants, 
    tonnageOptions, 
    getDepotsByPlant,
    currentUser
  } = useDataStore();

  const [selectedZone, setSelectedZone] = useState('');
  const [selectedPlant, setSelectedPlant] = useState('');
  const [depotCards, setDepotCards] = useState<DepotCardData[]>([]);
  const [selectedDepotToAdd, setSelectedDepotToAdd] = useState('');
  const [loading, setLoading] = useState(false);
  const [apiResults, setApiResults] = useState<Record<string, unknown> | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);

  // Determine user role - Fleet users should NOT access Control Panel
  const isFleetUser = currentUser?.role === 'fleet';
  const isVendorOrAdmin = currentUser?.role === 'vendor' || currentUser?.role === 'admin' || currentUser?.role === 'operator';

  // Redirect Fleet users to their dedicated page
  useEffect(() => {
    if (isFleetUser) {
      navigate('/dashboard/live-status');
    }
  }, [isFleetUser, navigate]);

  // Don't render anything for Fleet users (they're being redirected)
  if (isFleetUser) {
    return null;
  }

  // Get plants (in a real app, this would be filtered by zone)
  const availablePlants = plants.filter(p => p.isActive);

  // Get depots filtered by selected plant
  const availableDepots = selectedPlant ? getDepotsByPlant(selectedPlant) : [];

  // Filter out already added depots
  const remainingDepots = availableDepots.filter(
    depot => !depotCards.some(card => card.depotId === depot.id)
  );

  // Convert tonnage options to expected format
  const tonnageOptionsFormatted = tonnageOptions.map(t => ({
    value: t.value,
    label: t.label,
  }));

  // Calculate total vehicles across ALL depot cards
  const totalVehicles = depotCards.reduce((sum, card) => 
    sum + card.specifications.reduce((specSum, spec) => specSum + spec.tonnages.length, 0), 
  0);

  // Count cards with valid specifications
  const validCards = depotCards.filter(card => card.specifications.length > 0);

  // Validation checks
  const isFormValid = selectedZone && selectedPlant && validCards.length > 0;

  

  // Add a new depot card
  const handleAddDepot = () => {
    if (!selectedDepotToAdd) return;
    
    const depot = availableDepots.find(d => d.id === selectedDepotToAdd);
    if (!depot) return;

    // Check if depot already exists
    if (depotCards.some(card => card.depotId === depot.id)) {
      toast({
        title: 'Depot Already Added',
        description: `${depot.name} is already in your bid configuration.`,
        variant: 'destructive',
      });
      return;
    }

    const newCard: DepotCardData = {
      depotId: depot.id,
      depotName: depot.name,
      depotCode: depot.code,
      specifications: [],
    };

    setDepotCards([...depotCards, newCard]);
    setSelectedDepotToAdd('');
  };

  // Update a depot card
  const handleUpdateCard = (depotId: string, updatedCard: DepotCardData) => {
    setDepotCards(cards => 
      cards.map(c => c.depotId === depotId ? updatedCard : c)
    );
  };

  // Remove a depot card
  const handleRemoveCard = (depotId: string) => {
    setDepotCards(cards => cards.filter(c => c.depotId !== depotId));
  };

  const handleStartBidding = () => {
    if (!isFormValid) {
      toast({
        title: 'Validation Error',
        description: 'Please add at least one depot with tonnage specifications',
        variant: 'destructive',
      });
      return;
    }

    const depots = depotCards.map(card => normalizeDepotForApi(card.depotName));
    const desiredBids: Array<{ quantity: number; depot: string; destination: string }> = [];
    depotCards.forEach((card) => {
      const depotToken = normalizeDepotForApi(card.depotName);
      card.specifications.forEach((spec) => {
        spec.tonnages.forEach((t) => {
          const qty = Number(t);
          if (!Number.isFinite(qty) || qty <= 0) return;
          const destination = spec.destination || '';
          desiredBids.push({
            quantity: qty,
            depot: depotToken,
            destination,
          });
        });
      });
    });
    if (desiredBids.length === 0) {
      alert('Please select at least one tonnage');
      return;
    }

    const payload = {
      depots,
      desired_bids: desiredBids,
    };
    console.log('🚀 Sending payload:', payload);

    setLoading(true);
    setApiError(null);
    setApiResults(null);

    fetch(`${API_BASE}/api/start-bid`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data?.detail || data?.error || `HTTP ${res.status}`);
        }
        console.log('API response', data);
        const mode = data?.execution_mode as string | undefined;
        const jid = data?.job_id as string | undefined;
        if (
          jid &&
          (mode === 'legacy_async' || mode === 'multiprocess')
        ) {
          toast({
            title: 'Job queued',
            description: 'Waiting for automation to finish…',
          });
          const job = await pollBidJob(jid);
          const results = job?.results as Record<string, unknown> | undefined;
          setApiResults(results ?? (job as Record<string, unknown>));
          toast({
            title: 'Automation finished',
            description: `Job status: ${String(job?.status ?? 'unknown')}`,
          });
        } else {
          setApiResults((data?.results ?? null) as Record<string, unknown> | null);
          toast({
            title: 'API Triggered',
            description: 'Parallel bidding request sent successfully.',
          });
        }
      })
      .catch((err) => {
        console.error('API error', err);
        setApiError(String(err?.message || err));
        toast({
          title: 'API Error',
          description: String(err?.message || err),
          variant: 'destructive',
        });
      })
      .finally(() => {
        setLoading(false);
      });
  };

  // Reset depot cards when plant changes
  const handlePlantChange = (val: string) => {
    setSelectedPlant(val);
    setDepotCards([]);
    setSelectedDepotToAdd('');
  };

  // Reset plant and depot cards when zone changes
  const handleZoneChange = (val: string) => {
    setSelectedZone(val);
    setSelectedPlant('');
    setDepotCards([]);
    setSelectedDepotToAdd('');
  };


  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="bg-card rounded-xl p-6 border border-border">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-primary/10 rounded-lg">
            <Settings className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Control Panel</h1>
            <p className="text-muted-foreground text-sm">
              Create vehicle bids and manage active bidding
            </p>
          </div>
        </div>
      </div>

      {/* Create Bids Form - Vendor/Admin Only */}
      {isVendorOrAdmin && (
        <div className="bg-card rounded-xl border border-border p-6">
          {/* Zone & Plant Selection */}
          <div className="grid gap-6 md:grid-cols-2 mb-6">
            {/* Zone Selection */}
            <div className="space-y-2">
              <Label className="text-foreground font-medium">Zone *</Label>
              <Select value={selectedZone} onValueChange={handleZoneChange}>
                <SelectTrigger className="bg-background border-border h-12">
                  <SelectValue placeholder="Select zone" />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border z-50">
                  {zones.map((zone) => (
                    <SelectItem key={zone.id} value={zone.id}>
                      {zone.zone_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Plant Selection */}
            <div className="space-y-2">
              <Label className="text-foreground font-medium">Plant *</Label>
              <Select 
                value={selectedPlant} 
                onValueChange={handlePlantChange}
                disabled={!selectedZone}
              >
                <SelectTrigger className="bg-background border-border h-12">
                  <SelectValue placeholder="Select plant" />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border z-50">
                  {availablePlants.map((plant) => (
                    <SelectItem key={plant.id} value={plant.id}>
                      {plant.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Depot Cards Section */}
          {selectedPlant && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-foreground font-medium text-lg">Depot Configuration</Label>
                  <p className="text-xs text-muted-foreground mt-1">
                    Add depots and configure tonnage + destination specifications for each
                  </p>
                </div>
              </div>

              {/* Add Depot Selector */}
              <div className="flex items-end gap-3 p-4 bg-muted/30 border border-border rounded-lg">
                <div className="flex-1 space-y-2">
                  <Label className="text-sm text-foreground">Select Depot to Add</Label>
                  <Select 
                    value={selectedDepotToAdd} 
                    onValueChange={setSelectedDepotToAdd}
                    disabled={remainingDepots.length === 0}
                  >
                    <SelectTrigger className="bg-background border-border h-10">
                      <SelectValue placeholder={
                        remainingDepots.length === 0 
                          ? "All depots added" 
                          : "Choose a depot..."
                      } />
                    </SelectTrigger>
                    <SelectContent className="bg-popover border-border z-50">
                      {remainingDepots.map((depot) => (
                        <SelectItem key={depot.id} value={depot.id}>
                          <div className="flex items-center gap-2">
                            <MapPin className="h-4 w-4 text-muted-foreground" />
                            {depot.name} – {depot.code}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  onClick={handleAddDepot}
                  disabled={!selectedDepotToAdd}
                  className="h-10"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add Depot
                </Button>
              </div>

              {/* Depot Cards List */}
              {depotCards.length > 0 ? (
                <div className="space-y-4">
                  {depotCards.map((card) => (
                    <DepotCard
                      key={card.depotId}
                      data={card}
                      tonnageOptions={tonnageOptionsFormatted}
                      onUpdate={(updated) => handleUpdateCard(card.depotId, updated)}
                      onRemove={() => handleRemoveCard(card.depotId)}
                    />
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 border border-dashed border-border rounded-lg bg-muted/20">
                  <MapPin className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground text-sm">
                    No depots added yet. Select a depot above to start configuring.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Summary Section */}
          <div className="mt-6 space-y-4">
            {/* Total Vehicles Summary */}
            <div className="bg-muted/50 border border-border rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-sm font-medium text-foreground">Total Vehicle Bids</span>
                  <div className="text-xs text-muted-foreground mt-1">
                    Each vehicle = 1 independent bid (own rank, status, actions)
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-muted-foreground">Vehicles</div>
                  <span className={cn(
                    'text-3xl font-bold',
                    totalVehicles > 0 ? 'text-primary' : 'text-muted-foreground'
                  )}>
                    {totalVehicles}
                  </span>
                </div>
              </div>

              {/* Per-depot breakdown */}
              {validCards.length > 0 && (
                <div className="mt-4 pt-4 border-t border-border/50">
                  <div className="text-xs font-medium text-muted-foreground mb-2">Breakdown by Depot:</div>
                  <div className="space-y-2">
                    {validCards.map((card) => {
                      const depotVehicles = card.specifications.reduce(
                        (sum, spec) => sum + spec.tonnages.length, 0
                      );
                      return (
                        <div key={card.depotId} className="bg-background/50 rounded-lg p-3">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium text-foreground">
                              {card.depotName} – {card.depotCode}
                            </span>
                            <span className="font-bold text-primary">
                              {depotVehicles} vehicle(s)
                            </span>
                          </div>
                          <div className="space-y-1">
                            {card.specifications.map((spec, idx) => (
                              <div key={spec.id} className="flex items-center justify-between text-xs text-muted-foreground pl-2">
                                <span>
                                  {spec.destination || '(No destination)'}: {' '}
                                  {Array.from(
                                    spec.tonnages.reduce((map, t) => {
                                      map.set(t, (map.get(t) || 0) + 1);
                                      return map;
                                    }, new Map<number, number>())
                                  ).map(([t, c]) => c > 1 ? `${t}T×${c}` : `${t}T`).join(', ')}
                                </span>
                                <span>{spec.tonnages.length} truck(s)</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Start Bidding Button */}
            <Button 
              onClick={handleStartBidding}
              className="w-full h-14 text-lg font-semibold bg-primary hover:bg-primary/90"
              disabled={!isFormValid}
            >
              <Rocket className="h-5 w-5 mr-2" />
              Start Bidding ({totalVehicles} Vehicle{totalVehicles !== 1 ? 's' : ''})
            </Button>
            {!isFormValid && (
              <p className="text-center text-xs text-muted-foreground">
                {!selectedZone || !selectedPlant 
                  ? 'Please select Zone and Plant first'
                  : 'Please add at least one depot with tonnage specifications'
                }
              </p>
            )}

            {loading && (
              <p className="text-center text-sm text-muted-foreground">Processing bids...</p>
            )}

            {apiError && (
              <p className="text-center text-sm text-destructive">{apiError}</p>
            )}

            {apiResults && (
              <pre className="text-xs bg-muted/30 border border-border rounded-md p-3 overflow-auto max-h-64">
                {JSON.stringify(apiResults, null, 2)}
              </pre>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
