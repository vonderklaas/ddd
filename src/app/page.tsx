'use client';

import { useState, useEffect } from 'react';
import { formatDistance } from 'date-fns';
import Link from 'next/link';

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
const pollCache = {
  data: null as Poll | null,
  timestamp: 0,
  cacheDuration: 10000, // 10 seconds in milliseconds
  isValid: function() {
    return this.data && (Date.now() - this.timestamp < this.cacheDuration);
  }
};

export default function Home() {
  const [poll, setPoll] = useState<Poll | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userVote, setUserVote] = useState<boolean | null>(null);
  const [voteSubmitting, setVoteSubmitting] = useState(false);

  // Fetch current poll with caching
  useEffect(() => {
    const fetchPoll = async () => {
      // Check if we have valid cached data
      if (pollCache.isValid()) {
        setPoll(pollCache.data);
        setLoading(false);
        return;
      }
      
      try {
        const response = await fetch('/api/polls');
        
        if (!response.ok) {
          if (response.status === 404) {
            setError('No active poll available.');
          } else {
            setError('Failed to fetch poll. Please try again later.');
          }
          setLoading(false);
          return;
        }
        
        const data = await response.json();
        
        // Update the cache
        pollCache.data = data;
        pollCache.timestamp = Date.now();
        
        setPoll(data);
      } catch {
        setError('An error occurred. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    fetchPoll();
    
    // Refresh poll data every 30 seconds
    const intervalId = setInterval(fetchPoll, 30000);
    return () => clearInterval(intervalId);
  }, []);

  // Submit vote with optimistic updates
  const submitVote = async (answer: boolean) => {
    if (!poll) return;
    
    setVoteSubmitting(true);
    setUserVote(answer);
    
    // Create an optimistic copy of the poll with updated statistics
    const originalPoll = { ...poll };
    const optimisticPoll = { ...poll };
    
    // If the user already voted, adjust the previous vote count
    if (userVote !== null) {
      if (userVote === true) {
        optimisticPoll.statistics.yesVotes -= 1;
      } else {
        optimisticPoll.statistics.noVotes -= 1;
      }
    }
    
    // Add the new vote
    if (answer) {
      optimisticPoll.statistics.yesVotes += 1;
    } else {
      optimisticPoll.statistics.noVotes += 1;
    }
    
    // Recalculate percentages
    const totalVotes = optimisticPoll.statistics.yesVotes + optimisticPoll.statistics.noVotes;
    optimisticPoll.statistics.totalVotes = totalVotes;
    optimisticPoll.statistics.yesPercentage = totalVotes > 0 
      ? Math.round((optimisticPoll.statistics.yesVotes / totalVotes) * 100) 
      : 0;
    optimisticPoll.statistics.noPercentage = totalVotes > 0 
      ? Math.round((optimisticPoll.statistics.noVotes / totalVotes) * 100) 
      : 0;
    
    // Update UI immediately with optimistic result
    setPoll(optimisticPoll);
    
    // Now make the actual API call
    try {
      const response = await fetch('/api/votes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          pollId: poll.id,
          answer,
          fingerprint: navigator.userAgent, // Simple fingerprint
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to submit vote');
      }
      
      await response.json();
      
      // Fetch the actual updated poll data (but not immediately to avoid UI flicker)
      setTimeout(async () => {
        const pollResponse = await fetch('/api/polls');
        if (pollResponse.ok) {
          const pollData = await pollResponse.json();
          setPoll(pollData);
          
          // Update the cache
          pollCache.data = pollData;
          pollCache.timestamp = Date.now();
        }
      }, 2000);
    } catch (err) {
      console.error('Error submitting vote:', err);
      setError('Failed to submit your vote. Please try again.');
      
      // Revert to original poll data
      setPoll(originalPoll);
      setUserVote(userVote);
    } finally {
      setVoteSubmitting(false);
    }
  };

  // Calculate time remaining
  const getTimeRemaining = (expiresAt: string) => {
    const now = new Date();
    const expiry = new Date(expiresAt);
    return formatDistance(expiry, now, { addSuffix: true });
  };

  if (loading) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-4 md:p-24">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Global Poll</h1>
          <p>Loading the latest poll...</p>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-4 md:p-24">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Global Poll</h1>
          <p className="text-red-500 mb-4">{error}</p>
          <Link href="/history" className="text-blue-500 hover:underline">
            View Past Polls
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 md:p-24">
      <div className="max-w-2xl w-full">
        <h1 className="text-3xl font-bold mb-2 text-center">Global Poll</h1>
        
        <div className="text-center mb-8">
          <Link href="/history" className="text-blue-500 hover:underline text-sm">
            View Poll History
          </Link>
          {' • '}
          <Link href="/admin" className="text-blue-500 hover:underline text-sm">
            Admin
          </Link>
        </div>
        
        {poll && (
          <div className="bg-white shadow-xl rounded-lg overflow-hidden w-full">
            <div className="p-6">
              <h2 className="text-2xl font-bold mb-6 text-center">{poll.question}</h2>
              
              <div className="flex flex-col sm:flex-row justify-center gap-4 mb-8">
                <button
                  onClick={() => submitVote(true)}
                  disabled={voteSubmitting}
                  className={`py-3 px-8 rounded-full font-bold text-white ${
                    userVote === true
                      ? 'bg-green-600'
                      : 'bg-green-500 hover:bg-green-600'
                  } transition-all duration-200 shadow-md hover:shadow-lg disabled:opacity-50`}
                >
                  YES
                </button>
                
                <button
                  onClick={() => submitVote(false)}
                  disabled={voteSubmitting}
                  className={`py-3 px-8 rounded-full font-bold text-white ${
                    userVote === false
                      ? 'bg-red-600'
                      : 'bg-red-500 hover:bg-red-600'
                  } transition-all duration-200 shadow-md hover:shadow-lg disabled:opacity-50`}
                >
                  NO
                </button>
              </div>
              
              <div className="mb-4">
                <h3 className="text-sm text-gray-500 mb-2 text-center">Current Results</h3>
                
                <div className="h-8 bg-gray-200 rounded-full overflow-hidden mb-2">
                  {/* Yes percentage bar - shown only if there are yes votes */}
                  {poll.statistics.yesPercentage > 0 && (
                    <div 
                      className="h-full bg-green-500 flex items-center pl-3 text-xs font-bold text-white float-left"
                      style={{ width: `${poll.statistics.yesPercentage}%` }}
                    >
                      {poll.statistics.yesPercentage > 5 ? `${poll.statistics.yesPercentage}%` : ''}
                    </div>
                  )}
                  
                  {/* No percentage bar - shown only if there are No votes */}
                  {poll.statistics.noPercentage > 0 && (
                    <div 
                      className="h-full bg-red-500 flex items-center justify-end pr-3 text-xs font-bold text-white float-right"
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
              
              <div className="mt-6 text-center text-sm text-gray-500">
                <p>Total votes: {poll.statistics.totalVotes}</p>
                <p>Poll expires {getTimeRemaining(poll.expiresAt)}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
