import { useState } from 'react';
import { AlertTriangle, Send } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { VehicleBid } from '@/store/dataStore';

interface ActionRequestModalProps {
  open: boolean;
  onClose: () => void;
  vehicleBid: VehicleBid | null;
  onSubmit: (requestType: 'PAUSE' | 'CLOSE', remarks?: string) => void;
}

export function ActionRequestModal({ open, onClose, vehicleBid, onSubmit }: ActionRequestModalProps) {
  const [requestType, setRequestType] = useState<'PAUSE' | 'CLOSE'>('PAUSE');
  const [remarks, setRemarks] = useState('');

  const handleSubmit = () => {
    onSubmit(requestType, remarks.trim() || undefined);
    setRequestType('PAUSE');
    setRemarks('');
    onClose();
  };

  if (!vehicleBid) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-warning" />
            Send Request to Vendor
          </DialogTitle>
          <DialogDescription>
            Fleet users cannot directly pause or close bids. Submit a request for Vendor approval.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Request Type */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Request Type</Label>
            <RadioGroup 
              value={requestType} 
              onValueChange={(value) => setRequestType(value as 'PAUSE' | 'CLOSE')}
              className="space-y-2"
            >
              <div className="flex items-center space-x-3 p-3 rounded-lg border border-border hover:bg-muted/50 cursor-pointer">
                <RadioGroupItem value="PAUSE" id="pause" />
                <Label htmlFor="pause" className="flex-1 cursor-pointer">
                  <span className="font-medium text-warning">Pause Vehicle</span>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Temporarily pause bidding for this vehicle
                  </p>
                </Label>
              </div>
              <div className="flex items-center space-x-3 p-3 rounded-lg border border-border hover:bg-muted/50 cursor-pointer">
                <RadioGroupItem value="CLOSE" id="close" />
                <Label htmlFor="close" className="flex-1 cursor-pointer">
                  <span className="font-medium text-destructive">Close Vehicle Bid</span>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Permanently close bidding for this vehicle
                  </p>
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Vehicle Details (Read-only) */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Vehicle Details</Label>
            <div className="p-3 rounded-lg bg-muted/50 border border-border space-y-1.5">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Vehicle ID:</span>
                <span className="font-medium font-mono text-xs">{vehicleBid.id}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Plant:</span>
                <span className="font-medium">{vehicleBid.plant_name}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Depot:</span>
                <span className="font-medium">{vehicleBid.depot_name}</span>
              </div>
              {vehicleBid.destination && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Destination:</span>
                  <span className="font-medium">{vehicleBid.destination}</span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Tonnage:</span>
                <span className="font-medium">{vehicleBid.tonnage}T</span>
              </div>
            </div>
          </div>

          {/* Remarks */}
          <div className="space-y-2">
            <Label htmlFor="remarks" className="text-sm font-medium">
              Remarks <span className="text-muted-foreground">(Optional)</span>
            </Label>
            <Textarea
              id="remarks"
              placeholder="Enter reason for this request (e.g., vehicle unavailable, driver issue, mechanical problem)"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              className="resize-none"
              rows={3}
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} className="gap-2">
            <Send className="h-4 w-4" />
            Send Request to Vendor
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
