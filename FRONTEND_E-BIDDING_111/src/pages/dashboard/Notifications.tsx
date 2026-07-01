import { Bell, Zap, Trophy, Search, XCircle, Info } from 'lucide-react';
import { useDataStore } from '@/store/dataStore';
import { cn } from '@/lib/utils';

export default function Notifications() {
  const { notifications } = useDataStore();

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
  };

  const getNotificationIcon = (title: string, type?: string) => {
    const titleLower = title.toLowerCase();
    if (titleLower.includes('rank 1') || titleLower.includes('won')) {
      return <Trophy className="h-5 w-5 text-warning" />;
    }
    if (titleLower.includes('started') || titleLower.includes('bid started')) {
      return <Zap className="h-5 w-5 text-success" />;
    }
    if (titleLower.includes('found') || titleLower.includes('matching')) {
      return <Search className="h-5 w-5 text-primary" />;
    }
    if (titleLower.includes('unsuccessful') || titleLower.includes('closed') || titleLower.includes('rejected')) {
      return <XCircle className="h-5 w-5 text-destructive" />;
    }
    if (type === 'request') {
      return <Bell className="h-5 w-5 text-warning" />;
    }
    return <Info className="h-5 w-5 text-muted-foreground" />;
  };

  const getNotificationType = (title: string) => {
    const titleLower = title.toLowerCase();
    if (titleLower.includes('rank 1') || titleLower.includes('won')) return 'Rank 1 Achieved';
    if (titleLower.includes('started') || titleLower.includes('bid started')) return 'Bid Started';
    if (titleLower.includes('found') || titleLower.includes('matching')) return 'Matching Bid Found';
    if (titleLower.includes('unsuccessful')) return 'Bid Unsuccessful';
    if (titleLower.includes('request')) return 'Action Request';
    if (titleLower.includes('closed')) return 'Bid Closed';
    return title;
  };

  const getTypeColor = (title: string, type?: string) => {
    const titleLower = title.toLowerCase();
    if (titleLower.includes('rank 1') || titleLower.includes('won')) {
      return 'bg-warning/10 border-warning/30 text-warning';
    }
    if (titleLower.includes('started') || titleLower.includes('bid started')) {
      return 'bg-success/10 border-success/30 text-success';
    }
    if (titleLower.includes('found') || titleLower.includes('matching')) {
      return 'bg-primary/10 border-primary/30 text-primary';
    }
    if (titleLower.includes('unsuccessful') || titleLower.includes('rejected')) {
      return 'bg-destructive/10 border-destructive/30 text-destructive';
    }
    if (type === 'request') {
      return 'bg-warning/10 border-warning/30 text-warning';
    }
    return 'bg-muted border-border text-muted-foreground';
  };

  // Extract structured data from notification message (fallback parsing)
  const extractData = (notification: typeof notifications[0]) => {
    const { message, depot, destination, tonnage, truckNumber, rank, reason } = notification;
    
    // Use structured data if available
    if (depot || tonnage || truckNumber) {
      return {
        depot: depot || '—',
        destination: destination || '—',
        tonnage: tonnage ? `${tonnage}T` : '—',
        truckNumber: truckNumber || 'Pending',
        rank: rank,
        reason: reason,
      };
    }

    // Fallback: Parse from message
    const depotMatch = message.match(/(?:at\s+|–\s*)([A-Za-z\s]+?)(?:\s+(?:closed|→|$))/i);
    const tonnageMatch = message.match(/(\d+)T/);
    const destMatch = message.match(/→\s*([A-Za-z\s]+)/);
    
    return {
      depot: depotMatch?.[1]?.trim() || '—',
      destination: destMatch?.[1]?.trim() || '—',
      tonnage: tonnageMatch ? `${tonnageMatch[1]}T` : '—',
      truckNumber: 'Pending',
      rank: undefined,
      reason: undefined,
    };
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="bg-card rounded-lg p-6 border border-border">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Bell className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-foreground">Notifications</h1>
            <p className="text-sm text-muted-foreground">
              {notifications.length} notification{notifications.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>

        {notifications.length === 0 ? (
          <div className="text-center py-12">
            <Bell className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
            <p className="text-muted-foreground">No notifications yet.</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {notifications.map((notification) => {
              const data = extractData(notification);
              const notifType = getNotificationType(notification.title);
              
              return (
                <div 
                  key={notification.id} 
                  className={cn(
                    "rounded-lg border-2 overflow-hidden transition-all hover:shadow-md",
                    getTypeColor(notification.title, notification.type)
                  )}
                >
                  {/* Notification Type Header */}
                  <div className={cn(
                    "flex items-center gap-2 px-4 py-2.5 border-b",
                    getTypeColor(notification.title, notification.type)
                  )}>
                    {getNotificationIcon(notification.title, notification.type)}
                    <span className="font-semibold text-sm">{notifType}</span>
                  </div>

                  {/* Vertical Parameter List */}
                  <div className="bg-card p-4 space-y-2.5">
                    {/* Depot */}
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-semibold text-foreground">Depot</span>
                      <span className="text-muted-foreground">{data.depot}</span>
                    </div>

                    {/* Destination */}
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-semibold text-foreground">Destination</span>
                      <span className="text-muted-foreground">{data.destination}</span>
                    </div>

                    {/* Tonnage */}
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-semibold text-foreground">Tonnage</span>
                      <span className="text-muted-foreground">{data.tonnage}</span>
                    </div>

                    {/* Truck Number */}
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-semibold text-foreground">Truck Number</span>
                      <span className="text-muted-foreground">{data.truckNumber}</span>
                    </div>

                    {/* Rank (only for rank-related notifications) */}
                    {data.rank !== undefined && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-semibold text-foreground">Rank</span>
                        <span className={cn(
                          "font-bold",
                          data.rank === 1 ? "text-warning" : "text-muted-foreground"
                        )}>
                          {data.rank}
                        </span>
                      </div>
                    )}

                    {/* Reason (only for unsuccessful bids) */}
                    {data.reason && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-semibold text-foreground">Reason</span>
                        <span className="text-muted-foreground">{data.reason}</span>
                      </div>
                    )}

                    {/* Separator */}
                    <div className="border-t border-border my-2" />

                    {/* Time */}
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-semibold text-foreground">Time</span>
                      <span className="text-muted-foreground">{formatTime(notification.created_at)}</span>
                    </div>

                    {/* Date */}
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-semibold text-foreground">Date</span>
                      <span className="text-muted-foreground">{formatDate(notification.created_at)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
