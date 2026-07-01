import { useEffect, useRef } from 'react';
import { useDataStore } from '@/store/dataStore';

/**
 * Hook to monitor for new bid opportunities that match vendor's started specifications.
 * 
 * BEHAVIOR:
 * - Only active when bidding has been started from Control Panel
 * - Checks for new bids every 2 seconds
 * - Triggers notifications for NEW bids only (not existing ones)
 * - Auto-moves matching bids to Live Bidding
 * - Deduplicates notifications (never notifies twice for same bid)
 */
export function useBidDiscovery() {
  const { biddingContext, checkForNewBids } = useDataStore();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Only start monitoring if bidding has started
    if (!biddingContext.started) {
      // Clean up any existing interval
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    // Start periodic check for new bids
    intervalRef.current = setInterval(() => {
      checkForNewBids();
    }, 2000); // Check every 2 seconds

    // Cleanup on unmount or when bidding stops
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [biddingContext.started, checkForNewBids]);

  return {
    isMonitoring: biddingContext.started,
    knownBidCount: biddingContext.knownBidIds.length,
    notifiedBidCount: biddingContext.notifiedBidIds.length,
  };
}
