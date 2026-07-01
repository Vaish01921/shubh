import { useState, useMemo } from 'react';
import { FileText, TrendingUp, Activity, CheckCircle, Trophy, Factory, Truck, Calendar, Filter, RotateCcw, AlertTriangle, TrendingDown, Target, AlertCircle, ChevronDown, Download } from 'lucide-react';
import { useDataStore } from '@/store/dataStore';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import * as XLSX from 'xlsx';
import { toast } from '@/hooks/use-toast';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from '@/components/ui/chart';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  ResponsiveContainer,
} from 'recharts';

export default function Reports() {
  const { vehicleBids, trucks, plants, depots, tonnageOptions } = useDataStore();
  
  // Date filter state
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const [isFiltered, setIsFiltered] = useState(false);
  
  // Unsuccessful bids filters
  const [selectedPlant, setSelectedPlant] = useState<string>('all');
  const [selectedDepot, setSelectedDepot] = useState<string>('all');
  const [selectedTonnage, setSelectedTonnage] = useState<string>('all');

  // Filter vehicle bids based on date range
  const filteredVehicleBids = useMemo(() => {
    let filtered = vehicleBids;
    
    if (isFiltered && (startDate || endDate)) {
      filtered = filtered.filter(vb => {
        const bidDate = new Date(vb.created_at);
        if (startDate && bidDate < startDate) return false;
        if (endDate) {
          const endOfDay = new Date(endDate);
          endOfDay.setHours(23, 59, 59, 999);
          if (bidDate > endOfDay) return false;
        }
        return true;
      });
    }
    
    return filtered;
  }, [vehicleBids, startDate, endDate, isFiltered]);

  // Unsuccessful bids - rank ≠ 1 AND status = Closed
  const unsuccessfulBids = useMemo(() => {
    let bids = filteredVehicleBids.filter(vb => vb.status === 'Closed' && vb.rank !== 1);
    
    if (selectedPlant !== 'all') {
      bids = bids.filter(vb => vb.plant_id === selectedPlant);
    }
    if (selectedDepot !== 'all') {
      bids = bids.filter(vb => vb.depot_id === selectedDepot);
    }
    if (selectedTonnage !== 'all') {
      bids = bids.filter(vb => vb.tonnage === parseInt(selectedTonnage));
    }
    
    return bids;
  }, [filteredVehicleBids, selectedPlant, selectedDepot, selectedTonnage]);

  // KPI Calculations - per vehicle now
  const totalVehicleBids = filteredVehicleBids.length;
  const liveVehicleBids = filteredVehicleBids.filter(vb => vb.status === 'Live' || vb.status === 'Paused').length;
  const closedVehicleBids = filteredVehicleBids.filter(vb => vb.status === 'Closed').length;
  const successfulVehicleBids = filteredVehicleBids.filter(vb => vb.rank === 1 && vb.status === 'Closed').length;
  const unsuccessfulCount = unsuccessfulBids.length;
  const successRate = closedVehicleBids > 0 ? Math.round((successfulVehicleBids / closedVehicleBids) * 100) : 0;
  const lossRate = closedVehicleBids > 0 ? Math.round((unsuccessfulCount / closedVehicleBids) * 100) : 0;
  const activeTrucks = trucks.filter(t => t.status === 'Active').length;
  const totalTrips = trucks.reduce((acc, t) => acc + t.rotationCount, 0);

  // === UNSUCCESSFUL BIDS ANALYTICS ===

  // 1. Unsuccessful Bids Over Time (Line Chart)
  const unsuccessfulOverTimeData = useMemo(() => {
    const dailyStats: Record<string, number> = {};
    unsuccessfulBids.forEach(vb => {
      const dateKey = format(new Date(vb.created_at), 'MMM dd');
      dailyStats[dateKey] = (dailyStats[dateKey] || 0) + 1;
    });
    return Object.entries(dailyStats).map(([date, losses]) => ({
      date,
      losses,
    }));
  }, [unsuccessfulBids]);

  // 2. Plant-wise Unsuccessful Bids (Bar Chart)
  const plantWiseUnsuccessfulData = useMemo(() => {
    const plantStats: Record<string, number> = {};
    unsuccessfulBids.forEach(vb => {
      plantStats[vb.plant_name] = (plantStats[vb.plant_name] || 0) + 1;
    });
    return Object.entries(plantStats).map(([name, losses]) => ({
      name,
      losses,
    }));
  }, [unsuccessfulBids]);

  // 3. Depot-wise Unsuccessful Bids (Horizontal Bar)
  const depotWiseUnsuccessfulData = useMemo(() => {
    const depotStats: Record<string, number> = {};
    unsuccessfulBids.forEach(vb => {
      depotStats[vb.depot_name] = (depotStats[vb.depot_name] || 0) + 1;
    });
    return Object.entries(depotStats)
      .map(([name, losses]) => ({ name, losses }))
      .sort((a, b) => b.losses - a.losses);
  }, [unsuccessfulBids]);

  // 4. Rank Distribution of Unsuccessful Bids (Pie/Donut Chart)
  const rankDistributionData = useMemo(() => {
    const rankStats: Record<string, number> = {};
    unsuccessfulBids.forEach(vb => {
      if (vb.rank) {
        const rankLabel = vb.rank >= 4 ? 'Rank 4+' : `Rank ${vb.rank}`;
        rankStats[rankLabel] = (rankStats[rankLabel] || 0) + 1;
      }
    });
    const colors = {
      'Rank 2': 'hsl(var(--warning))',
      'Rank 3': 'hsl(var(--destructive))',
      'Rank 4+': 'hsl(var(--muted-foreground))',
    };
    return Object.entries(rankStats).map(([name, value]) => ({
      name,
      value,
      fill: colors[name as keyof typeof colors] || 'hsl(var(--muted))',
    }));
  }, [unsuccessfulBids]);

  // 5. Tonnage-wise Loss Analysis (Stacked Bar Chart)
  const tonnageWiseLossData = useMemo(() => {
    const tonnageStats: Record<number, { total: number; rank2: number; rank3: number; rank4plus: number }> = {};
    unsuccessfulBids.forEach(vb => {
      if (!tonnageStats[vb.tonnage]) {
        tonnageStats[vb.tonnage] = { total: 0, rank2: 0, rank3: 0, rank4plus: 0 };
      }
      tonnageStats[vb.tonnage].total++;
      if (vb.rank === 2) tonnageStats[vb.tonnage].rank2++;
      else if (vb.rank === 3) tonnageStats[vb.tonnage].rank3++;
      else if (vb.rank && vb.rank >= 4) tonnageStats[vb.tonnage].rank4plus++;
    });
    return Object.entries(tonnageStats)
      .map(([tonnage, stats]) => ({
        name: `${tonnage}T`,
        rank2: stats.rank2,
        rank3: stats.rank3,
        rank4plus: stats.rank4plus,
        total: stats.total,
      }))
      .sort((a, b) => parseInt(a.name) - parseInt(b.name));
  }, [unsuccessfulBids]);

  // Auto-generated insights
  const insights = useMemo(() => {
    const insightsList: string[] = [];
    
    if (unsuccessfulBids.length === 0) {
      return ['No unsuccessful bids to analyze. Keep up the great work!'];
    }

    // Insight 1: Rank 2 analysis
    const rank2Count = unsuccessfulBids.filter(vb => vb.rank === 2).length;
    const rank2Percentage = Math.round((rank2Count / unsuccessfulBids.length) * 100);
    if (rank2Percentage >= 50) {
      insightsList.push(`${rank2Percentage}% of losses are Rank 2 → Small improvement in pricing or capacity can convert these to wins.`);
    }

    // Insight 2: Worst performing depot
    const depotLosses = depotWiseUnsuccessfulData[0];
    if (depotLosses && depotLosses.losses > 2) {
      insightsList.push(`Highest losses at ${depotLosses.name} depot (${depotLosses.losses} unsuccessful bids) → Review bidding strategy for this location.`);
    }

    // Insight 3: Worst performing tonnage
    const worstTonnage = tonnageWiseLossData.reduce((max, curr) => curr.total > max.total ? curr : max, { name: '', total: 0 });
    if (worstTonnage.total > 2) {
      insightsList.push(`${worstTonnage.name} vehicles have the most losses (${worstTonnage.total} bids) → Consider capacity or pricing adjustments.`);
    }

    // Insight 4: Overall loss trend
    if (lossRate > 50) {
      insightsList.push(`Loss rate is ${lossRate}% → Focus on improving bid competitiveness to increase win rate.`);
    } else if (lossRate > 0 && lossRate <= 30) {
      insightsList.push(`Loss rate is only ${lossRate}% → Your bidding strategy is performing well overall.`);
    }

    // Insight 5: Plant-specific analysis
    if (plantWiseUnsuccessfulData.length > 1) {
      const sorted = [...plantWiseUnsuccessfulData].sort((a, b) => b.losses - a.losses);
      if (sorted[0].losses > sorted[1].losses * 2) {
        insightsList.push(`Most losses concentrated at ${sorted[0].name} → Consider plant-specific strategy improvements.`);
      }
    }

    return insightsList.length > 0 ? insightsList : ['Analyzing bidding patterns to provide insights...'];
  }, [unsuccessfulBids, depotWiseUnsuccessfulData, tonnageWiseLossData, plantWiseUnsuccessfulData, lossRate]);

  // Chart Data for Success Section
  const biddingPerformanceData = [
    { name: 'Total', value: totalVehicleBids, fill: 'hsl(var(--primary))' },
    { name: 'Rank 1', value: successfulVehicleBids, fill: 'hsl(var(--success))' },
    { name: 'Other Ranks', value: unsuccessfulCount, fill: 'hsl(var(--destructive))' },
    { name: 'Live', value: liveVehicleBids, fill: 'hsl(var(--warning))' },
    { name: 'Closed', value: closedVehicleBids, fill: 'hsl(var(--muted-foreground))' },
  ];

  const rankPerformanceData = [
    { name: 'Rank 1 Wins', value: successfulVehicleBids, fill: 'hsl(var(--warning))' },
    { name: 'Other Ranks', value: unsuccessfulCount, fill: 'hsl(var(--muted))' },
  ];

  const plantWiseData = useMemo(() => {
    const plantStats: Record<string, { bids: number; wins: number }> = {};
    filteredVehicleBids.forEach(vb => {
      if (!plantStats[vb.plant_name]) {
        plantStats[vb.plant_name] = { bids: 0, wins: 0 };
      }
      plantStats[vb.plant_name].bids++;
      if (vb.rank === 1) plantStats[vb.plant_name].wins++;
    });
    return Object.entries(plantStats).map(([name, stats]) => ({
      name,
      bids: stats.bids,
      wins: stats.wins,
      successRate: stats.bids > 0 ? Math.round((stats.wins / stats.bids) * 100) : 0,
    }));
  }, [filteredVehicleBids]);

  const truckAnalyticsData = useMemo(() => {
    return trucks.slice(0, 6).map(truck => ({
      name: truck.registrationNumber.split('-').slice(-1)[0],
      trips: truck.rotationCount,
      status: truck.status === 'Active' ? 1 : 0,
    }));
  }, [trucks]);

  const timelineTrendData = useMemo(() => {
    const dailyStats: Record<string, { bids: number; wins: number }> = {};
    filteredVehicleBids.forEach(vb => {
      const dateKey = format(new Date(vb.created_at), 'MMM dd');
      if (!dailyStats[dateKey]) {
        dailyStats[dateKey] = { bids: 0, wins: 0 };
      }
      dailyStats[dateKey].bids++;
      if (vb.rank === 1) dailyStats[dateKey].wins++;
    });
    return Object.entries(dailyStats).map(([date, stats]) => ({
      date,
      bids: stats.bids,
      wins: stats.wins,
    }));
  }, [filteredVehicleBids]);

  const chartConfig = {
    bids: { label: 'Vehicle Bids', color: 'hsl(var(--primary))' },
    wins: { label: 'Rank 1 Wins', color: 'hsl(var(--success))' },
    losses: { label: 'Losses', color: 'hsl(var(--destructive))' },
    trips: { label: 'Trips', color: 'hsl(var(--primary))' },
    value: { label: 'Count', color: 'hsl(var(--primary))' },
    rank2: { label: 'Rank 2', color: 'hsl(var(--warning))' },
    rank3: { label: 'Rank 3', color: 'hsl(var(--destructive))' },
    rank4plus: { label: 'Rank 4+', color: 'hsl(var(--muted-foreground))' },
  };

  const handleApplyFilter = () => {
    setIsFiltered(true);
  };

  const handleResetFilter = () => {
    setStartDate(undefined);
    setEndDate(undefined);
    setIsFiltered(false);
  };

  const handleResetUnsuccessfulFilters = () => {
    setSelectedPlant('all');
    setSelectedDepot('all');
    setSelectedTonnage('all');
  };

  // Export to Excel function
  const handleExportToExcel = () => {
    const workbook = XLSX.utils.book_new();

    // Sheet 1: KPI Summary
    const kpiData = [
      { Metric: 'Total Vehicle Bids', Value: totalVehicleBids },
      { Metric: 'Active/Live Bids', Value: liveVehicleBids },
      { Metric: 'Closed Bids', Value: closedVehicleBids },
      { Metric: 'Successful Bids (Rank 1)', Value: successfulVehicleBids },
      { Metric: 'Unsuccessful Bids', Value: unsuccessfulCount },
      { Metric: 'Success Rate (%)', Value: successRate },
      { Metric: 'Loss Rate (%)', Value: lossRate },
      { Metric: 'Active Trucks', Value: activeTrucks },
      { Metric: 'Total Trips', Value: totalTrips },
    ];
    const kpiSheet = XLSX.utils.json_to_sheet(kpiData);
    XLSX.utils.book_append_sheet(workbook, kpiSheet, 'KPI Summary');

    // Sheet 2: All Vehicle Bids
    const allBidsData = filteredVehicleBids.map(vb => ({
      'Bid ID': vb.id,
      'Plant': vb.plant_name,
      'Depot': vb.depot_name,
      'Destination': vb.destination || 'N/A',
      'Tonnage': `${vb.tonnage}T`,
      'Rank': vb.rank || 'N/A',
      'Status': vb.status,
      'Created At': format(new Date(vb.created_at), 'dd MMM yyyy HH:mm'),
    }));
    const allBidsSheet = XLSX.utils.json_to_sheet(allBidsData);
    XLSX.utils.book_append_sheet(workbook, allBidsSheet, 'All Vehicle Bids');

    // Sheet 3: Successful Bids (Rank 1)
    const successfulBidsData = filteredVehicleBids
      .filter(vb => vb.rank === 1 && vb.status === 'Closed')
      .map(vb => ({
        'Bid ID': vb.id,
        'Plant': vb.plant_name,
        'Depot': vb.depot_name,
        'Destination': vb.destination || 'N/A',
        'Tonnage': `${vb.tonnage}T`,
        'Created At': format(new Date(vb.created_at), 'dd MMM yyyy HH:mm'),
      }));
    const successfulSheet = XLSX.utils.json_to_sheet(successfulBidsData);
    XLSX.utils.book_append_sheet(workbook, successfulSheet, 'Successful Bids');

    // Sheet 4: Unsuccessful Bids
    const unsuccessfulBidsData = unsuccessfulBids.map(vb => ({
      'Bid ID': vb.id,
      'Plant': vb.plant_name,
      'Depot': vb.depot_name,
      'Destination': vb.destination || 'N/A',
      'Tonnage': `${vb.tonnage}T`,
      'Final Rank': vb.rank || 'N/A',
      'Created At': format(new Date(vb.created_at), 'dd MMM yyyy HH:mm'),
    }));
    const unsuccessfulSheet = XLSX.utils.json_to_sheet(unsuccessfulBidsData);
    XLSX.utils.book_append_sheet(workbook, unsuccessfulSheet, 'Unsuccessful Bids');

    // Sheet 5: Plant-wise Performance
    const plantPerformanceData = plantWiseData.map(p => ({
      'Plant Name': p.name,
      'Total Bids': p.bids,
      'Rank 1 Wins': p.wins,
      'Success Rate (%)': p.successRate,
    }));
    const plantSheet = XLSX.utils.json_to_sheet(plantPerformanceData);
    XLSX.utils.book_append_sheet(workbook, plantSheet, 'Plant Performance');

    // Sheet 6: Truck Analytics
    const truckData = trucks.map(t => ({
      'Registration Number': t.registrationNumber,
      'Driver Name': t.driverName,
      'Plant': t.plant_name,
      'Depot': t.depot_name,
      'Status': t.status,
      'Total Trips': t.rotationCount,
    }));
    const truckSheet = XLSX.utils.json_to_sheet(truckData);
    XLSX.utils.book_append_sheet(workbook, truckSheet, 'Truck Analytics');

    // Sheet 7: Timeline Trend Data
    const trendData = timelineTrendData.map(t => ({
      'Date': t.date,
      'Total Bids': t.bids,
      'Rank 1 Wins': t.wins,
    }));
    const trendSheet = XLSX.utils.json_to_sheet(trendData);
    XLSX.utils.book_append_sheet(workbook, trendSheet, 'Timeline Trend');

    // Generate filename with current date
    const fileName = `LogiBid_Reports_${format(new Date(), 'yyyy-MM-dd_HH-mm')}.xlsx`;
    
    // Write and download
    XLSX.writeFile(workbook, fileName);
    
    toast({
      title: "Export Successful",
      description: `Data exported to ${fileName}`,
    });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="bg-card rounded-xl p-6 border border-border">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-primary/10 rounded-lg">
              <FileText className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Reports & Analytics</h1>
              <p className="text-muted-foreground text-sm">Per-vehicle bidding history, performance metrics, and loss analysis</p>
            </div>
          </div>
          <Button 
            onClick={handleExportToExcel} 
            className="gap-2 bg-success hover:bg-success/90 text-success-foreground"
          >
            <Download className="h-4 w-4" />
            Export to Excel
          </Button>
        </div>
      </div>

      {/* Date Filter Panel */}
      <div className="bg-card rounded-xl p-4 border border-border">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">Date Filter:</span>
          </div>
          
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn("w-[160px] justify-start text-left font-normal", !startDate && "text-muted-foreground")}>
                <Calendar className="mr-2 h-4 w-4" />
                {startDate ? format(startDate, "PPP") : "Start Date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <CalendarComponent
                mode="single"
                selected={startDate}
                onSelect={setStartDate}
                initialFocus
                className="p-3 pointer-events-auto"
              />
            </PopoverContent>
          </Popover>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn("w-[160px] justify-start text-left font-normal", !endDate && "text-muted-foreground")}>
                <Calendar className="mr-2 h-4 w-4" />
                {endDate ? format(endDate, "PPP") : "End Date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <CalendarComponent
                mode="single"
                selected={endDate}
                onSelect={setEndDate}
                initialFocus
                className="p-3 pointer-events-auto"
              />
            </PopoverContent>
          </Popover>

          <Button onClick={handleApplyFilter} className="bg-primary text-primary-foreground hover:bg-primary/90">
            Apply Filter
          </Button>
          <Button onClick={handleResetFilter} variant="outline" className="gap-2">
            <RotateCcw className="h-4 w-4" />
            Reset
          </Button>
          
          {isFiltered && (
            <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
              Filtered: {startDate ? format(startDate, "MMM dd, yyyy") : "All"} - {endDate ? format(endDate, "MMM dd, yyyy") : "All"}
            </span>
          )}
        </div>
      </div>

      {/* Tabbed Analytics */}
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 lg:w-[400px]">
          <TabsTrigger value="overview" className="gap-2">
            <TrendingUp className="h-4 w-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="unsuccessful" className="gap-2">
            <TrendingDown className="h-4 w-4" />
            Unsuccessful Analysis
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          {/* KPI Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <div className="bg-card rounded-xl p-4 border border-border">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Vehicle Bids</p>
                  <p className="text-2xl font-bold text-foreground mt-1">{totalVehicleBids}</p>
                </div>
                <div className="p-2 bg-primary/10 rounded-lg">
                  <TrendingUp className="h-4 w-4 text-primary" />
                </div>
              </div>
            </div>
            
            <div className="bg-card rounded-xl p-4 border border-border">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Active</p>
                  <p className="text-2xl font-bold text-warning mt-1">{liveVehicleBids}</p>
                </div>
                <div className="p-2 bg-warning/10 rounded-lg">
                  <Activity className="h-4 w-4 text-warning" />
                </div>
              </div>
            </div>
            
            <div className="bg-card rounded-xl p-4 border border-border">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Rank 1</p>
                  <p className="text-2xl font-bold text-success mt-1">{successfulVehicleBids}</p>
                </div>
                <div className="p-2 bg-success/10 rounded-lg">
                  <Trophy className="h-4 w-4 text-success" />
                </div>
              </div>
            </div>
            
            <div className="bg-card rounded-xl p-4 border border-border">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Success %</p>
                  <p className="text-2xl font-bold text-primary mt-1">{successRate}%</p>
                </div>
                <div className="p-2 bg-primary/10 rounded-lg">
                  <CheckCircle className="h-4 w-4 text-primary" />
                </div>
              </div>
            </div>
            
            <div className="bg-card rounded-xl p-4 border border-border">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Total Trips</p>
                  <p className="text-2xl font-bold text-foreground mt-1">{totalTrips}</p>
                </div>
                <div className="p-2 bg-muted rounded-lg">
                  <Factory className="h-4 w-4 text-muted-foreground" />
                </div>
              </div>
            </div>
            
            <div className="bg-card rounded-xl p-4 border border-border">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Active Trucks</p>
                  <p className="text-2xl font-bold text-success mt-1">{activeTrucks}</p>
                </div>
                <div className="p-2 bg-success/10 rounded-lg">
                  <Truck className="h-4 w-4 text-success" />
                </div>
              </div>
            </div>
          </div>

          {/* Charts Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Bidding Performance Overview */}
            <div className="bg-card rounded-xl border border-border overflow-hidden">
              <div className="p-4 border-b border-border bg-muted/30">
                <h2 className="font-semibold text-foreground">Vehicle Bidding Performance</h2>
                <p className="text-xs text-muted-foreground">Per-vehicle bid distribution</p>
              </div>
              <div className="p-4">
                {totalVehicleBids === 0 ? (
                  <div className="h-[250px] flex items-center justify-center">
                    <div className="text-center">
                      <TrendingUp className="h-12 w-12 text-muted-foreground/30 mx-auto mb-2" />
                      <p className="text-muted-foreground text-sm">No vehicle bid data available</p>
                    </div>
                  </div>
                ) : (
                  <ChartContainer config={chartConfig} className="h-[250px] w-full">
                    <BarChart data={biddingPerformanceData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                      <XAxis type="number" />
                      <YAxis dataKey="name" type="category" width={80} tick={{ fontSize: 12 }} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="value" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ChartContainer>
                )}
              </div>
            </div>

            {/* Rank Performance */}
            <div className="bg-card rounded-xl border border-border overflow-hidden">
              <div className="p-4 border-b border-border bg-muted/30">
                <h2 className="font-semibold text-foreground">Per-Vehicle Rank Performance</h2>
                <p className="text-xs text-muted-foreground">Rank 1 wins vs other ranks (per vehicle)</p>
              </div>
              <div className="p-4">
                {totalVehicleBids === 0 ? (
                  <div className="h-[250px] flex items-center justify-center">
                    <div className="text-center">
                      <Trophy className="h-12 w-12 text-muted-foreground/30 mx-auto mb-2" />
                      <p className="text-muted-foreground text-sm">No rank data available</p>
                    </div>
                  </div>
                ) : (
                  <ChartContainer config={chartConfig} className="h-[250px] w-full">
                    <PieChart>
                      <Pie
                        data={rankPerformanceData}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                        label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                        labelLine={false}
                      >
                        {rankPerformanceData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                      </Pie>
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <ChartLegend content={<ChartLegendContent />} />
                    </PieChart>
                  </ChartContainer>
                )}
              </div>
            </div>

            {/* Plant-wise Performance */}
            <div className="bg-card rounded-xl border border-border overflow-hidden">
              <div className="p-4 border-b border-border bg-muted/30">
                <h2 className="font-semibold text-foreground">Plant-wise Vehicle Performance</h2>
                <p className="text-xs text-muted-foreground">Vehicle bids and Rank 1 wins per plant</p>
              </div>
              <div className="p-4">
                {plantWiseData.length === 0 ? (
                  <div className="h-[250px] flex items-center justify-center">
                    <div className="text-center">
                      <Factory className="h-12 w-12 text-muted-foreground/30 mx-auto mb-2" />
                      <p className="text-muted-foreground text-sm">No plant data available</p>
                    </div>
                  </div>
                ) : (
                  <ChartContainer config={chartConfig} className="h-[250px] w-full">
                    <BarChart data={plantWiseData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                      <YAxis />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <ChartLegend content={<ChartLegendContent />} />
                      <Bar dataKey="bids" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Vehicle Bids" />
                      <Bar dataKey="wins" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} name="Rank 1 Wins" />
                    </BarChart>
                  </ChartContainer>
                )}
              </div>
            </div>

            {/* Truck & Trip Analytics */}
            <div className="bg-card rounded-xl border border-border overflow-hidden">
              <div className="p-4 border-b border-border bg-muted/30">
                <h2 className="font-semibold text-foreground">Truck & Trip Analytics</h2>
                <p className="text-xs text-muted-foreground">Rotation count per truck</p>
              </div>
              <div className="p-4">
                {truckAnalyticsData.length === 0 ? (
                  <div className="h-[250px] flex items-center justify-center">
                    <div className="text-center">
                      <Truck className="h-12 w-12 text-muted-foreground/30 mx-auto mb-2" />
                      <p className="text-muted-foreground text-sm">No truck data available</p>
                    </div>
                  </div>
                ) : (
                  <ChartContainer config={chartConfig} className="h-[250px] w-full">
                    <BarChart data={truckAnalyticsData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="trips" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Trips" />
                    </BarChart>
                  </ChartContainer>
                )}
              </div>
            </div>
          </div>

          {/* Timeline Trend - Full Width */}
          <div className="bg-card rounded-xl border border-border overflow-hidden">
            <div className="p-4 border-b border-border bg-muted/30">
              <h2 className="font-semibold text-foreground">Timeline / Trend Analysis</h2>
              <p className="text-xs text-muted-foreground">Daily vehicle bidding activity and Rank 1 wins</p>
            </div>
            <div className="p-4">
              {timelineTrendData.length === 0 ? (
                <div className="h-[200px] flex items-center justify-center">
                  <div className="text-center">
                    <Activity className="h-12 w-12 text-muted-foreground/30 mx-auto mb-2" />
                    <p className="text-muted-foreground text-sm">No trend data available</p>
                  </div>
                </div>
              ) : (
                <ChartContainer config={chartConfig} className="h-[200px] w-full">
                  <LineChart data={timelineTrendData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <ChartLegend content={<ChartLegendContent />} />
                    <Line 
                      type="monotone" 
                      dataKey="bids" 
                      stroke="hsl(var(--primary))" 
                      strokeWidth={2}
                      dot={{ fill: 'hsl(var(--primary))' }}
                      name="Vehicle Bids"
                    />
                    <Line 
                      type="monotone" 
                      dataKey="wins" 
                      stroke="hsl(var(--success))" 
                      strokeWidth={2}
                      dot={{ fill: 'hsl(var(--success))' }}
                      name="Rank 1 Wins"
                    />
                  </LineChart>
                </ChartContainer>
              )}
            </div>
          </div>
        </TabsContent>

        {/* Unsuccessful Analysis Tab */}
        <TabsContent value="unsuccessful" className="space-y-6">
          {/* Unsuccessful Bids Header */}
          <div className="bg-card rounded-xl p-4 border border-destructive/30 bg-destructive/5">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-destructive/10 rounded-lg">
                <AlertTriangle className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <h2 className="font-semibold text-foreground">Unsuccessful Bids Analysis</h2>
                <p className="text-xs text-muted-foreground">Analyze loss patterns to improve future bidding strategy</p>
              </div>
            </div>
          </div>

          {/* Unsuccessful Bids Filters */}
          <div className="bg-card rounded-xl p-4 border border-border">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium text-foreground">Filters:</span>
              </div>
              
              <Select value={selectedPlant} onValueChange={setSelectedPlant}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="All Plants" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Plants</SelectItem>
                  {plants.map(plant => (
                    <SelectItem key={plant.id} value={plant.id}>{plant.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={selectedDepot} onValueChange={setSelectedDepot}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="All Depots" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Depots</SelectItem>
                  {depots.map(depot => (
                    <SelectItem key={depot.id} value={depot.id}>{depot.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={selectedTonnage} onValueChange={setSelectedTonnage}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="All Tonnages" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Tonnages</SelectItem>
                  {tonnageOptions.map(t => (
                    <SelectItem key={t.id} value={t.value.toString()}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button onClick={handleResetUnsuccessfulFilters} variant="outline" size="sm" className="gap-2">
                <RotateCcw className="h-4 w-4" />
                Reset Filters
              </Button>
            </div>
          </div>

          {/* Unsuccessful KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-card rounded-xl p-4 border border-destructive/20">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Unsuccessful Bids</p>
                  <p className="text-2xl font-bold text-destructive mt-1">{unsuccessfulCount}</p>
                </div>
                <div className="p-2 bg-destructive/10 rounded-lg">
                  <TrendingDown className="h-4 w-4 text-destructive" />
                </div>
              </div>
            </div>
            
            <div className="bg-card rounded-xl p-4 border border-warning/20">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Loss Rate</p>
                  <p className="text-2xl font-bold text-warning mt-1">{lossRate}%</p>
                </div>
                <div className="p-2 bg-warning/10 rounded-lg">
                  <Target className="h-4 w-4 text-warning" />
                </div>
              </div>
            </div>
            
            <div className="bg-card rounded-xl p-4 border border-border">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Rank 2 (Close)</p>
                  <p className="text-2xl font-bold text-foreground mt-1">
                    {unsuccessfulBids.filter(vb => vb.rank === 2).length}
                  </p>
                </div>
                <div className="p-2 bg-warning/10 rounded-lg">
                  <AlertCircle className="h-4 w-4 text-warning" />
                </div>
              </div>
            </div>
            
            <div className="bg-card rounded-xl p-4 border border-border">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Rank 3+</p>
                  <p className="text-2xl font-bold text-muted-foreground mt-1">
                    {unsuccessfulBids.filter(vb => vb.rank && vb.rank >= 3).length}
                  </p>
                </div>
                <div className="p-2 bg-muted rounded-lg">
                  <TrendingDown className="h-4 w-4 text-muted-foreground" />
                </div>
              </div>
            </div>
          </div>

          {/* Insights Panel */}
          <div className="bg-card rounded-xl border border-warning/30 overflow-hidden">
            <div className="p-4 border-b border-border bg-warning/10">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-warning" />
                <h2 className="font-semibold text-foreground">Auto-Generated Insights</h2>
              </div>
              <p className="text-xs text-muted-foreground mt-1">Actionable insights based on your loss patterns</p>
            </div>
            <div className="p-4 space-y-3">
              {insights.map((insight, index) => (
                <div key={index} className="flex items-start gap-3 p-3 bg-muted/30 rounded-lg">
                  <div className="p-1 bg-warning/20 rounded">
                    <Target className="h-4 w-4 text-warning" />
                  </div>
                  <p className="text-sm text-foreground">{insight}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Unsuccessful Charts Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Unsuccessful Bids Over Time */}
            <div className="bg-card rounded-xl border border-border overflow-hidden">
              <div className="p-4 border-b border-border bg-muted/30">
                <h2 className="font-semibold text-foreground">Unsuccessful Bids Over Time</h2>
                <p className="text-xs text-muted-foreground">Identify loss trends by date</p>
              </div>
              <div className="p-4">
                {unsuccessfulOverTimeData.length === 0 ? (
                  <div className="h-[250px] flex items-center justify-center">
                    <div className="text-center">
                      <TrendingDown className="h-12 w-12 text-muted-foreground/30 mx-auto mb-2" />
                      <p className="text-muted-foreground text-sm">No unsuccessful bid data available</p>
                    </div>
                  </div>
                ) : (
                  <ChartContainer config={chartConfig} className="h-[250px] w-full">
                    <LineChart data={unsuccessfulOverTimeData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                      <YAxis />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Line 
                        type="monotone" 
                        dataKey="losses" 
                        stroke="hsl(var(--destructive))" 
                        strokeWidth={2}
                        dot={{ fill: 'hsl(var(--destructive))' }}
                        name="Losses"
                      />
                    </LineChart>
                  </ChartContainer>
                )}
              </div>
            </div>

            {/* Plant-wise Unsuccessful Bids */}
            <div className="bg-card rounded-xl border border-border overflow-hidden">
              <div className="p-4 border-b border-border bg-muted/30">
                <h2 className="font-semibold text-foreground">Plant-wise Unsuccessful Bids</h2>
                <p className="text-xs text-muted-foreground">Find weak-performing plants</p>
              </div>
              <div className="p-4">
                {plantWiseUnsuccessfulData.length === 0 ? (
                  <div className="h-[250px] flex items-center justify-center">
                    <div className="text-center">
                      <Factory className="h-12 w-12 text-muted-foreground/30 mx-auto mb-2" />
                      <p className="text-muted-foreground text-sm">No plant data available</p>
                    </div>
                  </div>
                ) : (
                  <ChartContainer config={chartConfig} className="h-[250px] w-full">
                    <BarChart data={plantWiseUnsuccessfulData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                      <YAxis />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="losses" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} name="Losses" />
                    </BarChart>
                  </ChartContainer>
                )}
              </div>
            </div>

            {/* Depot-wise Unsuccessful Bids */}
            <div className="bg-card rounded-xl border border-border overflow-hidden">
              <div className="p-4 border-b border-border bg-muted/30">
                <h2 className="font-semibold text-foreground">Depot-wise Unsuccessful Bids</h2>
                <p className="text-xs text-muted-foreground">Identify problematic depots</p>
              </div>
              <div className="p-4">
                {depotWiseUnsuccessfulData.length === 0 ? (
                  <div className="h-[250px] flex items-center justify-center">
                    <div className="text-center">
                      <Factory className="h-12 w-12 text-muted-foreground/30 mx-auto mb-2" />
                      <p className="text-muted-foreground text-sm">No depot data available</p>
                    </div>
                  </div>
                ) : (
                  <ChartContainer config={chartConfig} className="h-[250px] w-full">
                    <BarChart data={depotWiseUnsuccessfulData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                      <XAxis type="number" />
                      <YAxis dataKey="name" type="category" width={80} tick={{ fontSize: 12 }} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="losses" fill="hsl(var(--destructive))" radius={[0, 4, 4, 0]} name="Losses" />
                    </BarChart>
                  </ChartContainer>
                )}
              </div>
            </div>

            {/* Rank Distribution */}
            <div className="bg-card rounded-xl border border-border overflow-hidden">
              <div className="p-4 border-b border-border bg-muted/30">
                <h2 className="font-semibold text-foreground">Rank Distribution of Losses</h2>
                <p className="text-xs text-muted-foreground">Understand how close losses were</p>
              </div>
              <div className="p-4">
                {rankDistributionData.length === 0 ? (
                  <div className="h-[250px] flex items-center justify-center">
                    <div className="text-center">
                      <Target className="h-12 w-12 text-muted-foreground/30 mx-auto mb-2" />
                      <p className="text-muted-foreground text-sm">No rank data available</p>
                    </div>
                  </div>
                ) : (
                  <ChartContainer config={chartConfig} className="h-[250px] w-full">
                    <PieChart>
                      <Pie
                        data={rankDistributionData}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                        label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                        labelLine={false}
                      >
                        {rankDistributionData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                      </Pie>
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <ChartLegend content={<ChartLegendContent />} />
                    </PieChart>
                  </ChartContainer>
                )}
              </div>
            </div>
          </div>

          {/* Tonnage-wise Loss Analysis - Full Width */}
          <div className="bg-card rounded-xl border border-border overflow-hidden">
            <div className="p-4 border-b border-border bg-muted/30">
              <h2 className="font-semibold text-foreground">Vehicle / Tonnage-wise Loss Analysis</h2>
              <p className="text-xs text-muted-foreground">Find tonnage types that lose most frequently</p>
            </div>
            <div className="p-4">
              {tonnageWiseLossData.length === 0 ? (
                <div className="h-[200px] flex items-center justify-center">
                  <div className="text-center">
                    <Truck className="h-12 w-12 text-muted-foreground/30 mx-auto mb-2" />
                    <p className="text-muted-foreground text-sm">No tonnage data available</p>
                  </div>
                </div>
              ) : (
                <ChartContainer config={chartConfig} className="h-[200px] w-full">
                  <BarChart data={tonnageWiseLossData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <ChartLegend content={<ChartLegendContent />} />
                    <Bar dataKey="rank2" stackId="a" fill="hsl(var(--warning))" name="Rank 2" />
                    <Bar dataKey="rank3" stackId="a" fill="hsl(var(--destructive))" name="Rank 3" />
                    <Bar dataKey="rank4plus" stackId="a" fill="hsl(var(--muted-foreground))" radius={[4, 4, 0, 0]} name="Rank 4+" />
                  </BarChart>
                </ChartContainer>
              )}
            </div>
          </div>

          {/* Detailed Unsuccessful Bids Table */}
          <div className="bg-card rounded-xl border border-border overflow-hidden">
            <div className="p-4 border-b border-border bg-muted/30">
              <h2 className="font-semibold text-foreground">Detailed Unsuccessful Bids</h2>
              <p className="text-xs text-muted-foreground">Complete list of all unsuccessful bids matching current filters</p>
            </div>
            <div className="overflow-x-auto">
              {unsuccessfulBids.length === 0 ? (
                <div className="p-8 text-center">
                  <CheckCircle className="h-12 w-12 text-success/30 mx-auto mb-2" />
                  <p className="text-muted-foreground">No unsuccessful bids found. Great performance!</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Bid ID</TableHead>
                      <TableHead>Plant</TableHead>
                      <TableHead>Depot</TableHead>
                      <TableHead>Vehicle</TableHead>
                      <TableHead>Final Rank</TableHead>
                      <TableHead>Date & Time</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {unsuccessfulBids.slice(0, 20).map((bid) => (
                      <TableRow key={bid.id}>
                        <TableCell className="font-mono text-xs">{bid.id}</TableCell>
                        <TableCell>{bid.plant_name}</TableCell>
                        <TableCell>{bid.depot_name}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="bg-muted/50">
                            Vehicle – {bid.tonnage}T
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="destructive" className="font-semibold">
                            Rank {bid.rank}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {format(new Date(bid.created_at), 'MMM dd, yyyy HH:mm')}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="bg-destructive/10 text-destructive border-destructive/20">
                            Unsuccessful
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
              {unsuccessfulBids.length > 20 && (
                <div className="p-4 text-center border-t border-border">
                  <p className="text-sm text-muted-foreground">
                    Showing 20 of {unsuccessfulBids.length} unsuccessful bids
                  </p>
                </div>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
