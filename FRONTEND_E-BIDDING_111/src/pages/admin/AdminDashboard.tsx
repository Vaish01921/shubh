import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdminStore, TruckDetail } from '@/store/adminStore';
import { DEPOT_MASTER_LIST, getDepotDisplayName } from '@/constants/depots';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Shield, LogOut, Truck, Calendar, Plus, Trash2, Save, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';

// Interface for daily truck availability entry
interface DailyTruckEntry {
  id: string;
  truckNumber: string;
  tonnage: '18T' | '25T' | '32T' | '40T' | '42T';
  driverName: string;
  previousDepot: string;
  currentDepot: string;
  destination: string;
  status: 'Available' | 'In Trip' | 'Non-Active';
  lastUpdated: string;
  remarks: string;
}

const AdminDashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const { adminUser, isAdminAuthenticated, adminLogout, truckDetails, addTruckDetail, updateTruckDetail, deleteTruckDetail } = useAdminStore();

  // Redirect if not authenticated
  useEffect(() => {
    if (!isAdminAuthenticated) {
      navigate('/admin/login');
    }
  }, [isAdminAuthenticated, navigate]);

  // Date state - defaults to today, only current day is editable
  const today = format(new Date(), 'yyyy-MM-dd');
  const [selectedDate, setSelectedDate] = useState(today);
  const isToday = selectedDate === today;

  // New entry form state
  const [showAddEntry, setShowAddEntry] = useState(false);
  const [newEntry, setNewEntry] = useState<Partial<DailyTruckEntry>>({
    truckNumber: '',
    tonnage: '18T',
    driverName: '',
    previousDepot: '',
    currentDepot: '',
    destination: '',
    status: 'Available',
    remarks: '',
  });

  // Summary counts for display
  const summaryCounts = useMemo(() => {
    const available = truckDetails.filter(t => t.status === 'Available').length;
    const inTrip = truckDetails.filter(t => t.status === 'In Trip').length;
    const nonActive = truckDetails.filter(t => t.status === 'Non-Active').length;
    return { available, inTrip, nonActive, total: truckDetails.length };
  }, [truckDetails]);

  const handleLogout = () => {
    adminLogout();
    navigate('/admin/login');
  };

  // Add new truck availability entry
  const handleAddEntry = () => {
    if (!newEntry.truckNumber || !newEntry.currentDepot || !newEntry.status || !newEntry.tonnage) {
      toast({
        title: 'Missing Information',
        description: 'Please enter truck number, tonnage, current depot, and status',
        variant: 'destructive',
      });
      return;
    }

    // Check for duplicate entry (same truck number for today)
    const existingEntry = truckDetails.find(td => td.truckNumber === newEntry.truckNumber);
    if (existingEntry) {
      toast({
        title: 'Duplicate Entry',
        description: 'This truck already has an availability entry for today',
        variant: 'destructive',
      });
      return;
    }

    addTruckDetail({
      truckNumber: newEntry.truckNumber,
      tonnage: newEntry.tonnage as '18T' | '25T' | '32T' | '40T' | '42T',
      driverName: newEntry.driverName || '',
      previousDepot: newEntry.previousDepot || '',
      currentDepot: newEntry.currentDepot,
      destination: newEntry.destination || '',
      status: newEntry.status as 'Available' | 'In Trip' | 'Non-Active',
      availableSince: newEntry.status === 'Available' ? new Date().toISOString() : undefined,
      contractType: newEntry.remarks || undefined,
    });

    setNewEntry({
      truckNumber: '',
      tonnage: '18T',
      driverName: '',
      previousDepot: '',
      currentDepot: '',
      destination: '',
      status: 'Available',
      remarks: '',
    });
    setShowAddEntry(false);

    toast({
      title: 'Availability Updated',
      description: `Truck ${newEntry.truckNumber} added to today's availability`,
    });
  };

  // Update existing entry
  const handleUpdateStatus = (id: string, newStatus: 'Available' | 'In Trip' | 'Non-Active') => {
    updateTruckDetail(id, { 
      status: newStatus,
      availableSince: newStatus === 'Available' ? new Date().toISOString() : undefined,
    });
    toast({
      title: 'Status Updated',
      description: `Truck status changed to ${newStatus}`,
    });
  };

  // Update depot
  const handleUpdateDepot = (id: string, depot: string) => {
    const entry = truckDetails.find(t => t.id === id);
    updateTruckDetail(id, { 
      previousDepot: entry?.currentDepot || '',
      currentDepot: depot,
    });
  };

  // Remove entry
  const handleRemoveEntry = (id: string) => {
    deleteTruckDetail(id);
    toast({
      title: 'Entry Removed',
      description: 'Truck availability entry removed',
    });
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
              <div className="p-2 bg-primary/10 rounded-lg">
                <Shield className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h1 className="text-lg font-semibold text-foreground">Fleet Admin</h1>
                <p className="text-xs text-muted-foreground">Daily Control Room</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <Button variant="outline" size="sm" onClick={() => navigate('/admin/live-bidding')}>
                <Truck className="h-4 w-4 mr-2" />
                Live Bidding Control
              </Button>
              <span className="text-sm text-muted-foreground">
                Welcome, <span className="font-medium text-foreground">{adminUser?.username}</span>
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
          {/* Daily Truck Availability Entry - SINGLE SECTION */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Calendar className="h-5 w-5" />
                    Daily Truck Availability Entry
                  </CardTitle>
                  <CardDescription>
                    Update today's truck availability, depot assignments, and status. This is the single source of truth for daily operations.
                  </CardDescription>
                </div>
                <div className="flex items-center gap-3">
                  {/* Date Display */}
                  <div className="flex items-center gap-2 px-3 py-2 bg-muted rounded-lg border border-border">
                    <Calendar className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium">{format(new Date(selectedDate), 'dd MMM yyyy')}</span>
                    {isToday && (
                      <Badge variant="default" className="text-xs">Today</Badge>
                    )}
                  </div>
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-6">
              {/* Summary Cards */}
              <div className="grid grid-cols-4 gap-4">
                <div className="p-4 bg-muted/30 rounded-lg border border-border">
                  <p className="text-sm text-muted-foreground">Total Entries</p>
                  <p className="text-2xl font-bold text-foreground">{summaryCounts.total}</p>
                </div>
                <div className="p-4 bg-success/10 rounded-lg border border-success/20">
                  <p className="text-sm text-success">Available</p>
                  <p className="text-2xl font-bold text-success">{summaryCounts.available}</p>
                </div>
                <div className="p-4 bg-blue-500/10 rounded-lg border border-blue-500/20">
                  <p className="text-sm text-blue-500">In Trip</p>
                  <p className="text-2xl font-bold text-blue-500">{summaryCounts.inTrip}</p>
                </div>
                <div className="p-4 bg-destructive/10 rounded-lg border border-destructive/20">
                  <p className="text-sm text-destructive">Non-Active</p>
                  <p className="text-2xl font-bold text-destructive">{summaryCounts.nonActive}</p>
                </div>
              </div>

              {/* Add Entry Button */}
              {isToday && (
                <div className="flex justify-between items-center">
                  <p className="text-sm text-muted-foreground">
                    <RefreshCw className="h-4 w-4 inline mr-1" />
                    Changes sync immediately to Vendor Dashboard
                  </p>
                  <Button
                    variant={showAddEntry ? "outline" : "default"}
                    onClick={() => setShowAddEntry(!showAddEntry)}
                  >
                    {showAddEntry ? 'Cancel' : (
                      <>
                        <Plus className="h-4 w-4 mr-2" />
                        Add / Update Truck Availability
                      </>
                    )}
                  </Button>
                </div>
              )}

              {/* Add Entry Form */}
              {showAddEntry && isToday && (
                <div className="p-6 border border-border rounded-lg bg-card shadow-sm">
                  {/* Form Header */}
                  <div className="mb-6">
                    <h4 className="text-base font-semibold text-foreground">Add Truck to Today's Availability</h4>
                    <p className="text-sm text-muted-foreground mt-1">Changes sync immediately to Vendor Dashboard</p>
                  </div>

                  {/* ROW 1 — CORE TRUCK IDENTITY */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-foreground">Truck Number <span className="text-destructive">*</span></Label>
                      <Input
                        className="h-10"
                        placeholder="e.g., UP32-CD-5678"
                        value={newEntry.truckNumber}
                        onChange={(e) => setNewEntry({ ...newEntry, truckNumber: e.target.value.toUpperCase() })}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-foreground">Tonnage <span className="text-destructive">*</span></Label>
                      <Input
                        className="h-10"
                        placeholder="e.g., 18, 25, 32"
                        value={newEntry.tonnage?.replace('T', '') || ''}
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, '');
                          setNewEntry({ ...newEntry, tonnage: val ? `${val}T` as any : '' });
                        }}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-foreground">Driver Name</Label>
                      <Input
                        className="h-10"
                        placeholder="e.g., Suresh Singh"
                        value={newEntry.driverName || ''}
                        onChange={(e) => setNewEntry({ ...newEntry, driverName: e.target.value })}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-foreground">Status <span className="text-destructive">*</span></Label>
                      <Select
                        value={newEntry.status}
                        onValueChange={(value: 'Available' | 'In Trip' | 'Non-Active') => 
                          setNewEntry({ ...newEntry, status: value })
                        }
                      >
                        <SelectTrigger className="h-10">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-popover border-border z-50">
                          <SelectItem value="Available">Available</SelectItem>
                          <SelectItem value="In Trip">In Trip</SelectItem>
                          <SelectItem value="Non-Active">Non-Active</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* ROW 2 — LOCATION DETAILS */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-muted-foreground">Previous Depot</Label>
                      <Input
                        className="h-10 bg-muted/30"
                        placeholder="Optional"
                        value={newEntry.previousDepot || ''}
                        onChange={(e) => setNewEntry({ ...newEntry, previousDepot: e.target.value })}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-foreground">Current Depot <span className="text-destructive">*</span></Label>
                      <Select
                        value={newEntry.currentDepot}
                        onValueChange={(value) => setNewEntry({ ...newEntry, currentDepot: value })}
                      >
                        <SelectTrigger className="h-10">
                          <SelectValue placeholder="Select depot" />
                        </SelectTrigger>
                        <SelectContent className="bg-popover border-border z-50">
                          {DEPOT_MASTER_LIST.map((depot) => (
                            <SelectItem key={depot.id} value={depot.name}>
                              {depot.displayName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-muted-foreground">
                        Destination <span className="text-xs">(Optional)</span>
                      </Label>
                      <Input
                        className="h-10"
                        placeholder="e.g., Rudali"
                        value={newEntry.destination || ''}
                        onChange={(e) => setNewEntry({ ...newEntry, destination: e.target.value })}
                        disabled={!newEntry.currentDepot}
                      />
                    </div>
                  </div>

                  {/* ROW 3 — REMARKS + ACTION */}
                  <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 items-end">
                    <div className="lg:col-span-3 space-y-2">
                      <Label className="text-sm font-medium text-muted-foreground">Remarks</Label>
                      <Input
                        className="h-10"
                        placeholder="Optional notes..."
                        value={newEntry.remarks}
                        onChange={(e) => setNewEntry({ ...newEntry, remarks: e.target.value })}
                      />
                    </div>

                    <div className="lg:col-span-1">
                      <Button 
                        className="w-full h-10"
                        onClick={handleAddEntry}
                        disabled={!newEntry.truckNumber || !newEntry.tonnage || !newEntry.currentDepot || !newEntry.status}
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Add Entry
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* Availability Table */}
              <div className="border border-border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="w-[140px]">Truck Number</TableHead>
                      <TableHead className="w-[80px]">Tonnage</TableHead>
                      <TableHead className="w-[120px]">Driver Name</TableHead>
                      <TableHead className="w-[120px]">Previous Depot</TableHead>
                      <TableHead className="w-[140px]">Current Depot</TableHead>
                      <TableHead className="w-[120px]">Status</TableHead>
                      <TableHead className="w-[120px]">Last Updated</TableHead>
                      <TableHead className="w-[150px]">Remarks</TableHead>
                      {isToday && <TableHead className="w-[80px]">Action</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {truckDetails.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={isToday ? 9 : 8} className="text-center py-12 text-muted-foreground">
                          <Truck className="h-8 w-8 mx-auto mb-2 opacity-50" />
                          <p>No truck availability entries for today</p>
                          <p className="text-sm">Click "Add / Update Truck Availability" to add entries</p>
                        </TableCell>
                      </TableRow>
                    ) : (
                      truckDetails.map((entry) => (
                        <TableRow key={entry.id}>
                          {/* Truck Number */}
                          <TableCell className="font-medium">{entry.truckNumber}</TableCell>
                          
                          {/* Tonnage */}
                          <TableCell>
                            <Badge variant="outline" className="font-medium">
                              {entry.tonnage}
                            </Badge>
                          </TableCell>
                          
                          {/* Driver Name */}
                          <TableCell className="text-muted-foreground">{entry.driverName}</TableCell>
                          
                          {/* Previous Depot */}
                          <TableCell className="text-muted-foreground">
                            {entry.previousDepot || '—'}
                          </TableCell>
                          
                          {/* Current Depot - Editable if today */}
                          <TableCell>
                            {isToday ? (
                              <Select
                                value={entry.currentDepot}
                                onValueChange={(value) => handleUpdateDepot(entry.id, value)}
                              >
                                <SelectTrigger className="h-8 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="bg-popover border-border z-50">
                                  {DEPOT_MASTER_LIST.map((depot) => (
                                    <SelectItem key={depot.id} value={depot.name}>
                                      {depot.displayName}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : (
                              entry.currentDepot
                            )}
                          </TableCell>
                          
                          {/* Status - Editable if today */}
                          <TableCell>
                            {isToday ? (
                              <Select
                                value={entry.status}
                                onValueChange={(value: 'Available' | 'In Trip' | 'Non-Active') => 
                                  handleUpdateStatus(entry.id, value)
                                }
                              >
                                <SelectTrigger className={`h-8 text-xs ${
                                  entry.status === 'Available' 
                                    ? 'bg-success/10 text-success border-success/30' 
                                    : entry.status === 'In Trip'
                                    ? 'bg-blue-500/10 text-blue-500 border-blue-500/30'
                                    : 'bg-destructive/10 text-destructive border-destructive/30'
                                }`}>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="bg-popover border-border z-50">
                                  <SelectItem value="Available">Available</SelectItem>
                                  <SelectItem value="In Trip">In Trip</SelectItem>
                                  <SelectItem value="Non-Active">Non-Active</SelectItem>
                                </SelectContent>
                              </Select>
                            ) : (
                              <Badge className={
                                entry.status === 'Available' 
                                  ? 'bg-success/10 text-success' 
                                  : entry.status === 'In Trip'
                                  ? 'bg-blue-500/10 text-blue-500'
                                  : 'bg-destructive/10 text-destructive'
                              }>
                                {entry.status}
                              </Badge>
                            )}
                          </TableCell>
                          
                          {/* Last Updated */}
                          <TableCell className="text-xs text-muted-foreground">
                            {entry.availableSince 
                              ? format(new Date(entry.availableSince), 'HH:mm')
                              : format(new Date(), 'HH:mm')
                            }
                          </TableCell>
                          
                          {/* Remarks */}
                          <TableCell className="text-xs text-muted-foreground max-w-[150px] truncate">
                            {entry.contractType || '—'}
                          </TableCell>
                          
                          {/* Action */}
                          {isToday && (
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleRemoveEntry(entry.id)}
                                className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          )}
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Info Note */}
              <div className="text-xs text-muted-foreground bg-muted/30 p-3 rounded-lg">
                <p><strong>Note:</strong> This data is valid for {format(new Date(selectedDate), 'dd MMM yyyy')} only. 
                Changes here immediately update Vendor Dashboard availability cards and bidding eligibility. 
                Truck master data (permanent records) is managed separately in Truck Master.</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default AdminDashboard;
