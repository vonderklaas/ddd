'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';

interface Poll {
  id: string;
  question: string;
  category: string;
  customCategory?: string;
  createdAt: string;
  expiresAt: string;
  statistics: {
    totalVotes: number;
    yesVotes: number;
    noVotes: number;
    yesPercentage: number;
    noPercentage: number;
  };
}

// Cache storage with timestamps
const historyCache = {
  data: null as Poll[] | null,
  timestamp: 0,
  cacheDuration: 60000, // 1 minute in milliseconds (reduced from 1 hour)
  isValid: function() {
    return this.data && (Date.now() - this.timestamp < this.cacheDuration);
  }
};

export default function History() {
  const [polls, setPolls] = useState<Poll[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchHistoricalPolls = async (bypassCache = false) => {
    if (bypassCache) {
      setRefreshing(true);
      setLoading(true);
    }
    
    // If explicitly bypassing cache, skip these checks
    if (!bypassCache) {
      // First check in-memory cache
      if (historyCache.isValid()) {
        setPolls(historyCache.data || []);
        setLoading(false);
        return;
      }
      
      // Then check localStorage cache
      try {
        const cachedHistory = localStorage.getItem('pollHistoryCache');
        if (cachedHistory && !bypassCache) {
          const { data, timestamp } = JSON.parse(cachedHistory);
          // Check if cache is still valid (within 1 minute)
          if (data && Date.now() - timestamp < 60000) {
            setPolls(data);
            setLoading(false);
            // Also update in-memory cache
            historyCache.data = data;
            historyCache.timestamp = timestamp;
            return;
          }
        }
      } catch (err) {
        console.error('Error reading from localStorage:', err);
      }
    }
    
    // If no valid cache exists or bypassing cache, fetch from API
    try {
      const response = await fetch('/api/polls/history');
      
      if (!response.ok) {
        throw new Error('Failed to fetch historical polls');
      }
      
      const data = await response.json();
      setPolls(data);
      
      // Update in-memory cache
      historyCache.data = data;
      historyCache.timestamp = Date.now();
      
      // Update localStorage cache
      try {
        localStorage.setItem('pollHistoryCache', JSON.stringify({
          data,
          timestamp: Date.now()
        }));
      } catch (err) {
        console.error('Error saving to localStorage:', err);
      }
    } catch {
      setError('Failed to load historical polls. Please try again later.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Clear cache and refresh data
  const refreshData = () => {
    // Clear in-memory cache
    historyCache.data = null;
    historyCache.timestamp = 0;
    
    // Clear localStorage cache
    try {
      localStorage.removeItem('pollHistoryCache');
    } catch (err) {
      console.error('Error clearing localStorage:', err);
    }
    
    // Fetch fresh data
    fetchHistoricalPolls(true);
  };

  useEffect(() => {
    fetchHistoricalPolls();
  }, []);

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), 'MMM d, yyyy');
  };

  return (
    <main className="flex min-h-screen flex-col items-center p-4 md:p-24">
      <div className="max-w-3xl w-full">
        <h1 className="text-3xl font-bold mb-2 text-center">Poll History</h1>
        
        <div className="text-center mb-8">
          <Link href="/" className="text-blue-500 hover:underline text-sm">
            Back to Current Poll
          </Link>
        </div>
        
        {loading && <p className="text-center">Loading historical polls...</p>}
        
        {error && <p className="text-center text-red-500">{error}</p>}
        
        {!loading && !error && polls.length === 0 && (
          <p className="text-center">No historical polls available yet.</p>
        )}
        
        {polls.length > 0 && (
          <div className="space-y-6">
            {polls.map((poll) => (
              <div 
                key={poll.id}
                className="bg-white shadow rounded-lg overflow-hidden"
              >
                <div className="p-6">
                  <div className="flex items-center mb-2">
                    <span className="inline-block px-3 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800 mr-2">
                      {poll.category === 'custom' 
                        ? poll.customCategory 
                        : (poll.category || 'general').charAt(0).toUpperCase() + (poll.category || 'general').slice(1)}
                    </span>
                  </div>
                  <h2 className="text-xl font-bold mb-4">{poll.question}</h2>
                  
                  <div className="mb-4">
                    <div className="h-6 bg-gray-200 rounded-full overflow-hidden mb-2">
                      {/* Yes percentage bar - shown only if there are yes votes */}
                      {poll.statistics.yesPercentage > 0 && (
                        <div 
                          className="h-full bg-green-500 flex items-center pl-2 text-xs font-bold text-white float-left"
                          style={{ width: `${poll.statistics.yesPercentage}%` }}
                        >
                          {poll.statistics.yesPercentage > 5 ? `${poll.statistics.yesPercentage}%` : ''}
                        </div>
                      )}
                      
                      {/* No percentage bar - shown only if there are No votes */}
                      {poll.statistics.noPercentage > 0 && (
                        <div 
                          className="h-full bg-red-500 flex items-center justify-end pr-2 text-xs font-bold text-white float-right"
                          style={{ width: `${poll.statistics.noPercentage}%` }}
                        >
                          {poll.statistics.noPercentage > 5 ? `${poll.statistics.noPercentage}%` : ''}
                        </div>
                      )}
                    </div>
                    
                    <div className="flex justify-between text-sm text-gray-600">
                      <div>Yes: {poll.statistics.yesVotes} votes ({poll.statistics.yesPercentage}%)</div>
                      <div>No: {poll.statistics.noVotes} votes ({poll.statistics.noPercentage}%)</div>
                    </div>
                  </div>
                  
                  <div className="text-sm text-gray-500 mt-4">
                    <p>Total votes: {poll.statistics.totalVotes}</p>
                    <p>Active on: {formatDate(poll.createdAt)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
} 