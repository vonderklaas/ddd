'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';

interface Poll {
  id: string;
  question: string;
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
  cacheDuration: 10000, // 10 seconds in milliseconds
  isValid: function() {
    return this.data && (Date.now() - this.timestamp < this.cacheDuration);
  }
};

export default function History() {
  const [polls, setPolls] = useState<Poll[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchHistoricalPolls = async () => {
      // Check if we have valid cached data
      if (historyCache.isValid()) {
        setPolls(historyCache.data || []);
        setLoading(false);
        return;
      }
      
      try {
        const response = await fetch('/api/polls/history');
        
        if (!response.ok) {
          throw new Error('Failed to fetch historical polls');
        }
        
        const data = await response.json();
        setPolls(data);
        
        // Update cache
        historyCache.data = data;
        historyCache.timestamp = Date.now();
      } catch {
        setError('Failed to load historical polls. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

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