import { useState, useEffect } from 'react';
import { useDataStore, VehicleDocument } from '@/store/dataStore';
import { Truck, User, RotateCcw, Factory, MapPin, FileText, Upload, Eye, Download, Calendar, AlertTriangle, Shield, ShieldAlert, ShieldCheck, Clock, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, differenceInDays, parseISO, isBefore } from 'date-fns';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { toast } from 'sonner';

const statusColors = {
  'Active': 'bg-success/20 text-success',
  'Non-Active': 'bg-muted text-muted-foreground',
};

const documentTypes: VehicleDocument['type'][] = ['Insurance', 'RC', 'Driver License', 'Purchase Invoice', 'Other'];

// Helper function to calculate insurance expiry status
const getInsuranceExpiryStatus = (expiryDate: string): { status: 'valid' | 'expiring' | 'expired'; daysRemaining: number } => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiry = parseISO(expiryDate);
  expiry.setHours(0, 0, 0, 0);
  
  const daysRemaining = differenceInDays(expiry, today);
  
  if (daysRemaining < 0) {
    return { status: 'expired', daysRemaining };
  } else if (daysRemaining <= 30) {
    return { status: 'expiring', daysRemaining };
  }
  return { status: 'valid', daysRemaining };
};

// Get the worst insurance status for a truck
const getTruckInsuranceStatus = (documents: VehicleDocument[]): { status: 'valid' | 'expiring' | 'expired' | 'none'; worstDoc: VehicleDocument | null; daysRemaining: number } => {
  const insuranceDocs = documents.filter(d => d.type === 'Insurance' && d.expiryDate);
  
  if (insuranceDocs.length === 0) {
    return { status: 'none', worstDoc: null, daysRemaining: 0 };
  }

  let worstStatus: 'valid' | 'expiring' | 'expired' = 'valid';
  let worstDays = Infinity;
  let worstDoc: VehicleDocument | null = null;

  insuranceDocs.forEach(doc => {
    const { status, daysRemaining } = getInsuranceExpiryStatus(doc.expiryDate!);
    if (status === 'expired' && worstStatus !== 'expired') {
      worstStatus = 'expired';
      worstDays = daysRemaining;
      worstDoc = doc;
    } else if (status === 'expiring' && worstStatus === 'valid') {
      worstStatus = 'expiring';
      worstDays = daysRemaining;
      worstDoc = doc;
    } else if (daysRemaining < worstDays) {
      worstDays = daysRemaining;
      worstDoc = doc;
    }
  });

  return { status: worstStatus, worstDoc, daysRemaining: worstDays };
};

export default function TruckMaster() {
  const { trucks, addVehicleDocument, getVehicleDocuments } = useDataStore();
  
  // Modal states
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [isExpiryDetailOpen, setIsExpiryDetailOpen] = useState(false);
  const [selectedTruck, setSelectedTruck] = useState<string | null>(null);
  const [selectedExpiryDoc, setSelectedExpiryDoc] = useState<VehicleDocument | null>(null);
  
  // Upload form state
  const [docType, setDocType] = useState<VehicleDocument['type']>('Insurance');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [expiryDate, setExpiryDate] = useState<Date | undefined>(undefined);

  // Check for expiring/expired insurance on load
  useEffect(() => {
    const expiringCount = trucks.filter(t => {
      const { status } = getTruckInsuranceStatus(t.documents);
      return status === 'expiring';
    }).length;

    const expiredCount = trucks.filter(t => {
      const { status } = getTruckInsuranceStatus(t.documents);
      return status === 'expired';
    }).length;

    if (expiredCount > 0) {
      toast.error(`⚠️ ${expiredCount} vehicle(s) have expired insurance!`, {
        duration: 5000,
      });
    } else if (expiringCount > 0) {
      toast.warning(`⚠️ ${expiringCount} vehicle(s) have insurance expiring soon`, {
        duration: 5000,
      });
    }
  }, []);

  const handleOpenUpload = (truckId: string) => {
    setSelectedTruck(truckId);
    setDocType('Insurance');
    setSelectedFile(null);
    setExpiryDate(undefined);
    setIsUploadOpen(true);
  };

  const handleOpenView = (truckId: string) => {
    setSelectedTruck(truckId);
    setIsViewOpen(true);
  };

  const handleOpenExpiryDetail = (doc: VehicleDocument, truckId: string) => {
    setSelectedTruck(truckId);
    setSelectedExpiryDoc(doc);
    setIsExpiryDetailOpen(true);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleUpload = () => {
    if (!selectedTruck || !selectedFile) {
      toast.error('Please select a file to upload');
      return;
    }

    // Validate expiry date for Insurance
    if (docType === 'Insurance' && !expiryDate) {
      toast.error('Please select an expiry date for Insurance document');
      return;
    }

    // Create a blob URL for the file (mock storage)
    const fileUrl = URL.createObjectURL(selectedFile);
    
    addVehicleDocument(selectedTruck, {
      type: docType,
      fileName: selectedFile.name,
      fileUrl,
      expiryDate: docType === 'Insurance' && expiryDate ? expiryDate.toISOString() : undefined,
    });

    toast.success('Document uploaded successfully');
    setIsUploadOpen(false);
    setSelectedFile(null);
    setExpiryDate(undefined);
  };

  const handleViewDocument = (fileUrl: string) => {
    window.open(fileUrl, '_blank');
  };

  const handleDownload = (fileUrl: string, fileName: string) => {
    const link = document.createElement('a');
    link.href = fileUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const selectedTruckData = trucks.find(t => t.id === selectedTruck);
  const selectedTruckDocs = selectedTruck ? getVehicleDocuments(selectedTruck) : [];

  // Render expiry badge
  const renderExpiryBadge = (expiryDate: string) => {
    const { status, daysRemaining } = getInsuranceExpiryStatus(expiryDate);

    if (status === 'expired') {
      return (
        <Badge variant="destructive" className="gap-1">
          <ShieldAlert className="h-3 w-3" />
          Expired
        </Badge>
      );
    } else if (status === 'expiring') {
      return (
        <Badge variant="outline" className="gap-1 border-warning text-warning bg-warning/10">
          <AlertTriangle className="h-3 w-3" />
          Expiring in {daysRemaining} days
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="gap-1 border-success text-success bg-success/10">
        <ShieldCheck className="h-3 w-3" />
        Valid
      </Badge>
    );
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="bg-card rounded-xl p-6 border border-border">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-primary/10 rounded-lg">
            <Truck className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Truck Master</h1>
            <p className="text-muted-foreground text-sm">Static reference data for your fleet</p>
          </div>
        </div>
      </div>

      {/* Truck Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="p-4 border-b border-border bg-muted/30">
          <h2 className="font-semibold text-foreground">Fleet Details</h2>
        </div>
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/20">
              <TableHead className="font-semibold">Plant Name</TableHead>
              <TableHead className="font-semibold">Depot</TableHead>
              <TableHead className="font-semibold">Truck No.</TableHead>
              <TableHead className="font-semibold">Driver Name</TableHead>
              <TableHead className="font-semibold text-center">Status</TableHead>
              <TableHead className="font-semibold text-center">Insurance</TableHead>
              <TableHead className="font-semibold text-center">Rotation</TableHead>
              <TableHead className="font-semibold text-center">Documents</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {trucks.map((truck) => {
              const insuranceStatus = getTruckInsuranceStatus(truck.documents);
              
              return (
                <TableRow key={truck.id} className="hover:bg-muted/20">
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Factory className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">{truck.plant_name}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">{truck.depot_name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="font-medium font-mono">{truck.registrationNumber}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      {truck.driverName}
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <span className={cn(
                      'px-3 py-1 rounded-full text-xs font-semibold',
                      statusColors[truck.status]
                    )}>
                      {truck.status}
                    </span>
                  </TableCell>
                  <TableCell className="text-center">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="flex items-center justify-center">
                            {insuranceStatus.status === 'expired' && (
                              <div className="flex items-center gap-1 text-destructive">
                                <ShieldAlert className="h-5 w-5 animate-pulse" />
                                <span className="text-xs font-semibold">Expired</span>
                              </div>
                            )}
                            {insuranceStatus.status === 'expiring' && (
                              <div className="flex items-center gap-1 text-warning">
                                <AlertTriangle className="h-5 w-5 animate-pulse" />
                                <span className="text-xs font-semibold">{insuranceStatus.daysRemaining}d</span>
                              </div>
                            )}
                            {insuranceStatus.status === 'valid' && (
                              <div className="flex items-center gap-1 text-success">
                                <ShieldCheck className="h-5 w-5" />
                                <span className="text-xs font-semibold">Valid</span>
                              </div>
                            )}
                            {insuranceStatus.status === 'none' && (
                              <div className="flex items-center gap-1 text-muted-foreground">
                                <Shield className="h-5 w-5" />
                                <span className="text-xs">N/A</span>
                              </div>
                            )}
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          {insuranceStatus.status === 'expired' && (
                            <p>Insurance expired {Math.abs(insuranceStatus.daysRemaining)} days ago</p>
                          )}
                          {insuranceStatus.status === 'expiring' && (
                            <p>Insurance expiring in {insuranceStatus.daysRemaining} days</p>
                          )}
                          {insuranceStatus.status === 'valid' && (
                            <p>Insurance valid for {insuranceStatus.daysRemaining} days</p>
                          )}
                          {insuranceStatus.status === 'none' && (
                            <p>No insurance document uploaded</p>
                          )}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-1">
                      <RotateCcw className="h-3 w-3 text-muted-foreground" />
                      <span className="font-semibold">{truck.rotationCount}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenView(truck.id)}
                        className="gap-1"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        View
                        {truck.documents.length > 0 && (
                          <span className="ml-1 bg-primary/20 text-primary text-xs px-1.5 py-0.5 rounded-full">
                            {truck.documents.length}
                          </span>
                        )}
                      </Button>
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => handleOpenUpload(truck.id)}
                        className="gap-1"
                      >
                        <Upload className="h-3.5 w-3.5" />
                        Upload
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        {trucks.length === 0 && (
          <div className="p-12 text-center">
            <Truck className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground">No trucks registered</p>
          </div>
        )}
      </div>

      {/* Upload Document Modal */}
      <Dialog open={isUploadOpen} onOpenChange={setIsUploadOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5 text-primary" />
              Upload Document
            </DialogTitle>
            <DialogDescription>
              Upload a document for {selectedTruckData?.registrationNumber}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="doc-type">Document Type</Label>
              <Select value={docType} onValueChange={(v) => {
                setDocType(v as VehicleDocument['type']);
                if (v !== 'Insurance') {
                  setExpiryDate(undefined);
                }
              }}>
                <SelectTrigger id="doc-type">
                  <SelectValue placeholder="Select document type" />
                </SelectTrigger>
                <SelectContent>
                  {documentTypes.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Insurance Expiry Date - Only show for Insurance type */}
            {docType === 'Insurance' && (
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Insurance Expiry Date <span className="text-destructive">*</span>
                </Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !expiryDate && "text-muted-foreground"
                      )}
                    >
                      <Calendar className="mr-2 h-4 w-4" />
                      {expiryDate ? format(expiryDate, "PPP") : "Select expiry date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      mode="single"
                      selected={expiryDate}
                      onSelect={setExpiryDate}
                      initialFocus
                      className="p-3 pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
                <p className="text-xs text-muted-foreground">
                  Required for insurance documents
                </p>
              </div>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="file-upload">Select File (PDF / Image)</Label>
              <Input
                id="file-upload"
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.gif,.webp"
                onChange={handleFileChange}
                className="cursor-pointer"
              />
              {selectedFile && (
                <p className="text-sm text-muted-foreground">
                  Selected: {selectedFile.name}
                </p>
              )}
            </div>
          </div>
          
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsUploadOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleUpload} 
              disabled={!selectedFile || (docType === 'Insurance' && !expiryDate)}
            >
              <Upload className="h-4 w-4 mr-2" />
              Upload
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Documents Modal */}
      <Dialog open={isViewOpen} onOpenChange={setIsViewOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Vehicle Documents
            </DialogTitle>
            <DialogDescription>
              Documents for {selectedTruckData?.registrationNumber}
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            {selectedTruckDocs.length === 0 ? (
              <div className="text-center py-8">
                <FileText className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-muted-foreground">No documents uploaded for this vehicle</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4"
                  onClick={() => {
                    setIsViewOpen(false);
                    if (selectedTruck) handleOpenUpload(selectedTruck);
                  }}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Upload First Document
                </Button>
              </div>
            ) : (
              <div className="space-y-3 max-h-80 overflow-y-auto">
                {selectedTruckDocs.map((doc) => (
                  <div
                    key={doc.id}
                    className={cn(
                      "flex items-center justify-between p-3 rounded-lg border",
                      doc.type === 'Insurance' && doc.expiryDate && getInsuranceExpiryStatus(doc.expiryDate).status === 'expired'
                        ? "bg-destructive/10 border-destructive/30"
                        : doc.type === 'Insurance' && doc.expiryDate && getInsuranceExpiryStatus(doc.expiryDate).status === 'expiring'
                          ? "bg-warning/10 border-warning/30"
                          : "bg-muted/30 border-border"
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div className={cn(
                        "p-2 rounded-lg",
                        doc.type === 'Insurance' && doc.expiryDate && getInsuranceExpiryStatus(doc.expiryDate).status === 'expired'
                          ? "bg-destructive/20"
                          : doc.type === 'Insurance' && doc.expiryDate && getInsuranceExpiryStatus(doc.expiryDate).status === 'expiring'
                            ? "bg-warning/20"
                            : "bg-primary/10"
                      )}>
                        {doc.type === 'Insurance' ? (
                          <Shield className={cn(
                            "h-4 w-4",
                            doc.expiryDate && getInsuranceExpiryStatus(doc.expiryDate).status === 'expired'
                              ? "text-destructive"
                              : doc.expiryDate && getInsuranceExpiryStatus(doc.expiryDate).status === 'expiring'
                                ? "text-warning"
                                : "text-primary"
                          )} />
                        ) : (
                          <FileText className="h-4 w-4 text-primary" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{doc.fileName}</p>
                        <div className="flex flex-wrap items-center gap-2 mt-1">
                          <span className="text-xs bg-secondary text-secondary-foreground px-2 py-0.5 rounded">
                            {doc.type}
                          </span>
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {new Date(doc.uploadedAt).toLocaleDateString()}
                          </span>
                        </div>
                        {/* Insurance expiry info */}
                        {doc.type === 'Insurance' && doc.expiryDate && (
                          <div className="mt-2 space-y-1">
                            <div className="flex items-center gap-2 text-xs">
                              <Clock className="h-3 w-3 text-muted-foreground" />
                              <span className="text-muted-foreground">
                                Expires: {format(parseISO(doc.expiryDate), 'PPP')}
                              </span>
                            </div>
                            {renderExpiryBadge(doc.expiryDate)}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleViewDocument(doc.fileUrl)}
                          title="View Document"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDownload(doc.fileUrl, doc.fileName)}
                          title="Download Document"
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      </div>
                      {/* View Expiry button for insurance */}
                      {doc.type === 'Insurance' && doc.expiryDate && selectedTruck && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs h-7"
                          onClick={() => handleOpenExpiryDetail(doc, selectedTruck)}
                        >
                          View Expiry
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsViewOpen(false)}>
              Close
            </Button>
            <Button onClick={() => {
              setIsViewOpen(false);
              if (selectedTruck) handleOpenUpload(selectedTruck);
            }}>
              <Upload className="h-4 w-4 mr-2" />
              Upload More
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Insurance Expiry Detail Modal */}
      <Dialog open={isExpiryDetailOpen} onOpenChange={setIsExpiryDetailOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              Insurance Expiry Details
            </DialogTitle>
          </DialogHeader>
          
          {selectedExpiryDoc && selectedExpiryDoc.expiryDate && (
            <div className="py-4 space-y-4">
              {(() => {
                const { status, daysRemaining } = getInsuranceExpiryStatus(selectedExpiryDoc.expiryDate);
                const truckData = trucks.find(t => t.id === selectedTruck);
                
                return (
                  <>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                        <span className="text-sm text-muted-foreground">Vehicle Number</span>
                        <span className="font-mono font-semibold">{truckData?.registrationNumber}</span>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                        <span className="text-sm text-muted-foreground">Expiry Date</span>
                        <span className="font-semibold">{format(parseISO(selectedExpiryDoc.expiryDate), 'PPP')}</span>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                        <span className="text-sm text-muted-foreground">Days Remaining</span>
                        <span className={cn(
                          "font-semibold",
                          status === 'expired' ? "text-destructive" :
                          status === 'expiring' ? "text-warning" : "text-success"
                        )}>
                          {status === 'expired' 
                            ? `${Math.abs(daysRemaining)} days ago`
                            : `${daysRemaining} days`
                          }
                        </span>
                      </div>
                    </div>
                    
                    <div className={cn(
                      "p-4 rounded-lg text-center",
                      status === 'expired' ? "bg-destructive/10" :
                      status === 'expiring' ? "bg-warning/10" : "bg-success/10"
                    )}>
                      {status === 'expired' && (
                        <>
                          <ShieldAlert className="h-10 w-10 text-destructive mx-auto mb-2" />
                          <p className="font-semibold text-destructive">Insurance Expired</p>
                          <p className="text-sm text-muted-foreground mt-1">
                            Please renew immediately to ensure compliance
                          </p>
                        </>
                      )}
                      {status === 'expiring' && (
                        <>
                          <AlertTriangle className="h-10 w-10 text-warning mx-auto mb-2" />
                          <p className="font-semibold text-warning">Expiring Soon</p>
                          <p className="text-sm text-muted-foreground mt-1">
                            Consider renewing before expiry
                          </p>
                        </>
                      )}
                      {status === 'valid' && (
                        <>
                          <ShieldCheck className="h-10 w-10 text-success mx-auto mb-2" />
                          <p className="font-semibold text-success">Insurance Valid</p>
                          <p className="text-sm text-muted-foreground mt-1">
                            No action required at this time
                          </p>
                        </>
                      )}
                    </div>
                  </>
                );
              })()}
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsExpiryDetailOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
