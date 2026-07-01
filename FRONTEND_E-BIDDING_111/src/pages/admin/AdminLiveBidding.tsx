import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Activity, Clock, Trophy, Shield, LogOut, ArrowLeft, Pause, Play, X, ChevronDown, Send, AlertCircle, Bell, Check, AlertTriangle } from 'lucide-react';
import { useAdminStore } from '@/store/adminStore';
import { useDataStore, VehicleBid } from '@/store/dataStore';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { ActionRequestModal } from '@/components/fleet/ActionRequestModal';
import { toast as sonnerToast } from 'sonner';

export default function AdminLiveBidding() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { adminUser, isAdminAuthenticated, adminLogout } = useAdminStore();
  const { 
    vehicleBids, 
    updateVehicleBidStatus, 
    closeVehicleBid,
    createActionRequest,
    getPendingRequests,
    approveActionRequest,
    rejectActionRequest
  } = useDataStore();
  const [, setTick] = useState(0);
  const [selectedVehicle, setSelectedVehicle] = useState<VehicleBid | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Determine if this is a Fleet Admin (can only send requests) or Truck/Vendor Admin (can approve/control)
  const isFleetAdmin = adminUser?.username?.toLowerCase().includes('fleet');
  const isVendorAdmin = !isFleetAdmin; // truckadmin and others have full control

  useEffect(() => {
    if (!isAdminAuthenticated) {
      navigate('/admin/login');
    }
  }, [isAdminAuthenticated, navigate]);

  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  // Filter vehicle bids by status
  const liveVehicleBids = vehicleBids.filter(vb => vb.status === 'Live' || vb.status === 'Paused');
  const closedVehicleBids = vehicleBids.filter(vb => vb.status === 'Closed');
  const pendingRequests = getPendingRequests();

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

  const handleLogout = () => {
    adminLogout();
    navigate('/admin/login');
  };

  // Vendor Admin: Direct control actions
  const handlePauseResume = (vehicleBidId: string, currentStatus: string) => {
    if (!isVendorAdmin) return;
    const newStatus = currentStatus === 'Live' ? 'Paused' : 'Live';
    updateVehicleBidStatus(vehicleBidId, newStatus);
    toast({
      title: newStatus === 'Paused' ? 'Vehicle Paused' : 'Vehicle Resumed',
      description: `Bidding ${newStatus === 'Paused' ? 'paused' : 'resumed'} for this vehicle.`,
    });
  };

  const handleClose = (vehicleBidId: string) => {
    if (!isVendorAdmin) return;
    closeVehicleBid(vehicleBidId);
    toast({
      title: 'Vehicle Bid Closed',
      description: `Bidding closed for this vehicle.`,
    });
  };

  // Vendor Admin: Approve/Reject requests
  const handleApproveRequest = (requestId: string) => {
    approveActionRequest(requestId);
    sonnerToast.success('Request approved and action executed');
  };

  const handleRejectRequest = (requestId: string) => {
    rejectActionRequest(requestId);
    sonnerToast.info('Request rejected');
  };

  // Fleet Admin: Request actions only
  const handleRequestAction = (vehicleBid: VehicleBid) => {
    setSelectedVehicle(vehicleBid);
    setIsModalOpen(true);
  };

  const handleSubmitRequest = (requestType: 'PAUSE' | 'CLOSE', remarks?: string) => {
    if (!selectedVehicle) return;
    
    createActionRequest(selectedVehicle.id, requestType, remarks);
    sonnerToast.success(`${requestType === 'PAUSE' ? 'Pause' : 'Close'} request sent to Vendor for approval`);
    setSelectedVehicle(null);
  };

  if (!isAdminAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="sm" onClick={() => navigate('/admin/dashboard')}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              <div className="h-6 w-px bg-border" />
              <div className="p-2 bg-primary/10 rounded-lg">
                <Shield className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h1 className="text-lg font-semibold text-foreground">
                  Live E-Bidding Status – {isFleetAdmin ? 'Fleet Admin View' : 'Admin Control'}
                </h1>
                <p className="text-xs text-muted-foreground">
                  {isFleetAdmin ? 'Send requests to Vendor for approval' : 'Manage per-vehicle bidding'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              {isVendorAdmin && pendingRequests.length > 0 && (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-warning/20 text-warning rounded-full animate-pulse">
                  <Bell className="h-4 w-4" />
                  <span className="font-medium text-sm">{pendingRequests.length} Pending</span>
                </div>
              )}
              {liveVehicleBids.length > 0 && (
                <div className="flex items-center gap-2 text-success text-sm">
                  <span className="animate-pulse">●</span>
                  <span className="font-medium">{liveVehicleBids.length} LIVE</span>
                </div>
              )}
              <span className="text-sm text-muted-foreground">
                Admin: <span className="font-medium text-foreground">{adminUser?.username}</span>
              </span>
              <Button variant="outline" size="sm" onClick={handleLogout}>
                <LogOut className="h-4 w-4 mr-2" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-6">
          {/* Fleet Admin Notice */}
          {isFleetAdmin && (
            <div className="bg-warning/10 border border-warning/30 rounded-lg p-4 flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-warning flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-warning">Fleet Admin Access</p>
                <p className="text-sm text-muted-foreground mt-1">
                  You can view live bids and send action requests. All pause/close actions require Vendor Admin approval.
                </p>
              </div>
            </div>
          )}

          {/* Pending Requests Section - Vendor Admin Only */}
          {isVendorAdmin && pendingRequests.length > 0 && (
            <div className="bg-warning/5 rounded-xl border-2 border-warning/30 overflow-hidden">
              <div className="p-4 border-b border-warning/30 bg-warning/10 flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-warning" />
                <h2 className="font-semibold text-warning">Fleet Action Requests</h2>
                <Badge variant="outline" className="ml-auto border-warning text-warning">
                  {pendingRequests.length} Pending
                </Badge>
              </div>
              <div className="p-4 space-y-3">
                {pendingRequests.map((request) => (
                  <div 
                    key={request.id} 
                    className="flex items-center justify-between p-4 bg-card rounded-lg border border-border animate-pulse"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={cn(
                          "px-2 py-0.5 rounded text-xs font-medium",
                          request.requestType === 'PAUSE' 
                            ? "bg-warning/20 text-warning" 
                            : "bg-destructive/20 text-destructive"
                        )}>
                          {request.requestType} REQUEST
                        </span>
                        <span className="text-xs text-muted-foreground">
                          from {request.requestedBy}
                        </span>
                      </div>
                      <p className="font-medium">
                        Vehicle – {request.tonnage}T • {request.depotName}
                        {request.destination && ` → ${request.destination}`}
                      </p>
                      {request.remarks && (
                        <p className="text-sm text-muted-foreground mt-1">
                          Remarks: {request.remarks}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-destructive hover:bg-destructive/10 border-destructive/30"
                        onClick={() => handleRejectRequest(request.id)}
                      >
                        <X className="h-4 w-4 mr-1" />
                        Reject
                      </Button>
                      <Button
                        size="sm"
                        className="bg-success hover:bg-success/90 text-success-foreground"
                        onClick={() => handleApproveRequest(request.id)}
                      >
                        <Check className="h-4 w-4 mr-1" />
                        Approve
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Status Header */}
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
                  <h2 className="text-2xl font-bold text-foreground">Live Vehicle Bids {isFleetAdmin ? 'Status' : 'Control'}</h2>
                  <p className="text-muted-foreground text-sm">
                    {liveVehicleBids.length > 0 
                      ? `${liveVehicleBids.length} active vehicle bid(s) • Each vehicle is an independent bid` 
                      : 'No active vehicle bids'}
                    {isFleetAdmin && ' • Request Only'}
                  </p>
                </div>
              </div>
            </div>
          </div>

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
                        vb.pendingRequest && 'animate-pulse bg-warning/10 border-l-4 border-l-warning'
                      )}
                    >
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
                      <TableCell className="text-center font-mono">
                        <Clock className="h-3 w-3 inline mr-1" />
                        {formatTime(vb.time_remaining)}
                      </TableCell>
                      <TableCell className="text-center">
                        {/* FLEET ADMIN: Send Request only */}
                        {isFleetAdmin && (
                          vb.pendingRequest ? (
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
                          )
                        )}

                        {/* VENDOR ADMIN: Direct Action controls */}
                        {isVendorAdmin && (
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button size="sm" variant="outline" className="gap-1">
                                Action <ChevronDown className="h-3 w-3" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-48 p-2 bg-popover border border-border" align="end">
                              <div className="space-y-1">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handlePauseResume(vb.id, vb.status)}
                                  className={cn(
                                    "w-full justify-start h-8 px-2 text-sm",
                                    vb.status === 'Live'
                                      ? "text-warning hover:bg-warning/10"
                                      : "text-success hover:bg-success/10"
                                  )}
                                >
                                  {vb.status === 'Live' ? (
                                    <><Pause className="h-4 w-4 mr-2" />Pause Bidding</>
                                  ) : (
                                    <><Play className="h-4 w-4 mr-2" />Resume Bidding</>
                                  )}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleClose(vb.id)}
                                  className="w-full justify-start h-8 px-2 text-sm text-destructive hover:bg-destructive/10"
                                >
                                  <X className="h-4 w-4 mr-2" />Close Bid
                                </Button>
                              </div>
                            </PopoverContent>
                          </Popover>
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
              <h3 className="text-lg font-semibold mb-2">No Live Vehicle Bids</h3>
              <p className="text-muted-foreground">Vehicle bids created by vendors will appear here.</p>
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
        </div>
      </main>

      {/* Action Request Modal - Fleet Admin only */}
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