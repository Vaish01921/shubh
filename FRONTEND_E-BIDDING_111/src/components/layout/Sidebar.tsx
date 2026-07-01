import { NavLink, useLocation } from 'react-router-dom';
import { Home, Settings, Activity, CheckCircle, Truck, Bell, FileText, LogOut, Users } from 'lucide-react';
import { useDataStore } from '@/store/dataStore';
import { cn } from '@/lib/utils';

// Navigation items with role-based access
const getNavigation = (userRole: string | undefined) => {
  const isFleet = userRole === 'fleet';
  const isVendor = userRole === 'vendor' || userRole === 'admin' || userRole === 'operator';

  return [
    { 
      section: 'MAIN',
      items: [
        { name: 'Home', href: '/dashboard/home', icon: Home },
      ]
    },
    {
      section: 'BIDDING',
      items: [
        // Control Panel - Vendor/Admin only (they create bids)
        ...(isVendor ? [{ name: 'Control Panel', href: '/dashboard/control-panel', icon: Settings }] : []),
        // Fleet: Live E-Bidding Status (request only)
        ...(isFleet ? [{ name: 'Live E-Bidding Status', href: '/dashboard/live-status', icon: Activity }] : []),
        // Vendor: Live Bidding with approval powers
        ...(isVendor ? [{ name: 'Live E-Bidding Status', href: '/dashboard/vendor-live-status', icon: Activity }] : []),
        { name: 'Successful Bids', href: '/dashboard/successful-bids', icon: CheckCircle },
      ]
    },
    {
      section: 'FLEET',
      items: [
        { name: 'Truck Master', href: '/dashboard/truck-master', icon: Truck },
      ]
    },
    {
      section: 'REPORTS',
      items: [
        { name: 'Notifications', href: '/dashboard/notifications', icon: Bell },
        { name: 'Reports & Analytics', href: '/dashboard/reports', icon: FileText },
      ]
    },
  ];
};

export function Sidebar() {
  const location = useLocation();
  const { logout, vehicleBids, currentUser, getPendingRequests } = useDataStore();

  // Check if there are live vehicle bids for indicator
  const hasLiveBids = vehicleBids.filter(vb => vb.status === 'Live').length > 0;
  const pendingRequests = getPendingRequests();
  const hasPendingRequests = pendingRequests.length > 0;

  const navigation = getNavigation(currentUser?.role);
  const isFleet = currentUser?.role === 'fleet';
  const isVendor = currentUser?.role === 'vendor' || currentUser?.role === 'admin' || currentUser?.role === 'operator';

  return (
    <aside className="w-64 bg-sidebar flex flex-col h-full">
      {/* Logo */}
      <div className="p-6">
        <h1 className="text-2xl font-bold text-primary italic">LogiBid</h1>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 space-y-6">
        {navigation.map((group) => (
          <div key={group.section}>
            <p className="px-4 text-xs font-semibold text-sidebar-foreground/50 uppercase tracking-wider mb-2">
              {group.section}
            </p>
            <div className="space-y-1">
              {group.items.map((item) => {
                const isActive = location.pathname === item.href;
                const showLiveIndicator = (item.name === 'Live E-Bidding Status' || item.name === 'Vendor Live Bidding') && hasLiveBids;
                const showRequestIndicator = item.name === 'Vendor Live Bidding' && hasPendingRequests && isVendor;
                
                return (
                  <NavLink
                    key={item.name}
                    to={item.href}
                    className={cn(
                      'sidebar-item relative',
                      isActive && 'sidebar-item-active'
                    )}
                  >
                    <item.icon className="h-5 w-5" />
                    <span className="text-sm font-medium">{item.name}</span>
                    {showLiveIndicator && (
                      <span className="absolute right-3 flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-success"></span>
                      </span>
                    )}
                    {showRequestIndicator && (
                      <span className="absolute right-8 flex items-center justify-center h-4 w-4 text-[10px] font-bold bg-warning text-warning-foreground rounded-full animate-pulse">
                        {pendingRequests.length}
                      </span>
                    )}
                  </NavLink>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Logout */}
      <div className="p-4 border-t border-sidebar-border">
        <p className="px-4 text-xs font-semibold text-sidebar-foreground/50 uppercase tracking-wider mb-2">
          SYSTEM
        </p>
        <button
          onClick={logout}
          className="sidebar-item w-full text-left"
        >
          <LogOut className="h-5 w-5" />
          <span className="text-sm font-medium">Logout</span>
        </button>
      </div>
    </aside>
  );
}
