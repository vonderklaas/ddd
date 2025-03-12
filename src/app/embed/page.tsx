'use client';

import { useState, useEffect } from 'react';

interface Poll {
  id: string;
  question: string;
  category: string;
  customCategory?: string;
  statistics: {
    totalVotes: number;
    yesVotes: number;
    noVotes: number;
    yesPercentage: number;
    noPercentage: number;
  };
}

export default function EmbedPoll() {
  const [poll, setPoll] = useState<Poll | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userVote, setUserVote] = useState<boolean | null>(null);
  const [voteSubmitting, setVoteSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // Fetch current poll
  useEffect(() => {
    const fetchPoll = async () => {
      try {
        const response = await fetch('/api/embed');
        
        if (!response.ok) {
          if (response.status === 404) {
            setError('No active poll available.');
          } else {
            setError('Failed to fetch poll.');
          }
          setLoading(false);
          return;
        }
        
        const data = await response.json();
        setPoll(data);
        
        // Check localStorage for this poll's vote if available
        if (typeof window !== 'undefined') {
          try {
            const votes = JSON.parse(localStorage.getItem('globalPollVotes') || '{}');
            if (votes[data.id] !== undefined) {
              setUserVote(votes[data.id]);
            }
          } catch (err) {
            console.error('Error reading from localStorage:', err);
          }
        }
      } catch {
        setError('An error occurred.');
      } finally {
        setLoading(false);
      }
    };

    fetchPoll();
  }, []);

  // Submit vote
  const submitVote = async (answer: boolean) => {
    if (!poll) return;
    
    // If user has already voted with this answer, don't submit again
    if (userVote === answer) return;
    
    setVoteSubmitting(true);
    setError(null);
    
    try {
      // Make the API call
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
      
      // Update user's vote state
      setUserVote(answer);
      setMessage('Your vote has been recorded!');
      
      // Save vote to localStorage if available
      if (typeof window !== 'undefined') {
        try {
          const votes = JSON.parse(localStorage.getItem('globalPollVotes') || '{}');
          votes[poll.id] = answer;
          localStorage.setItem('globalPollVotes', JSON.stringify(votes));
        } catch (err) {
          console.error('Error saving to localStorage:', err);
        }
      }
      
      // Fetch the updated poll data
      const pollResponse = await fetch('/api/embed');
      if (pollResponse.ok) {
        const pollData = await pollResponse.json();
        setPoll(pollData);
      }
    } catch (err) {
      console.error('Error submitting vote:', err);
      setError('Failed to submit your vote.');
    } finally {
      setVoteSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-4 h-full min-h-[200px] bg-white">
        <p className="text-gray-500">Loading poll...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center p-4 h-full min-h-[200px] bg-white">
        <p className="text-red-500">{error}</p>
      </div>
    );
  }

  return (
    <div className="p-4 bg-white rounded-lg shadow-sm max-w-full overflow-hidden">
      {poll && (
        <>
          <div className="mb-2">
            <span className="inline-block px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
              {poll.category === 'custom' 
                ? poll.customCategory 
                : (poll.category || 'general').charAt(0).toUpperCase() + (poll.category || 'general').slice(1)}
            </span>
          </div>
          
          <h2 className="text-lg font-bold mb-4">{poll.question}</h2>
          
          {message && !error && (
            <div className="mb-3 p-2 bg-green-50 border border-green-200 text-green-700 text-sm rounded">
              {message}
            </div>
          )}
          
          {error && (
            <div className="mb-3 p-2 bg-red-50 border border-red-200 text-red-600 text-sm rounded">
              {error}
            </div>
          )}
          
          <div className="flex flex-col sm:flex-row justify-center gap-2 mb-4">
            <button
              onClick={() => submitVote(true)}
              disabled={voteSubmitting || userVote === true}
              className={`py-2 px-4 rounded-full text-sm font-bold text-white ${
                userVote === true
                  ? 'bg-green-600 cursor-not-allowed'
                  : 'bg-green-500 hover:bg-green-600'
              } transition-all duration-200 shadow-sm disabled:opacity-50`}
            >
              {voteSubmitting ? 'Submitting...' : userVote === true ? 'Voted YES' : 'YES'}
            </button>
            
            <button
              onClick={() => submitVote(false)}
              disabled={voteSubmitting || userVote === false}
              className={`py-2 px-4 rounded-full text-sm font-bold text-white ${
                userVote === false
                  ? 'bg-red-600 cursor-not-allowed'
                  : 'bg-red-500 hover:bg-red-600'
              } transition-all duration-200 shadow-sm disabled:opacity-50`}
            >
              {voteSubmitting ? 'Submitting...' : userVote === false ? 'Voted NO' : 'NO'}
            </button>
          </div>
          
          <div className="mb-3">
            <div className="h-6 bg-gray-200 rounded-full overflow-hidden mb-1">
              {poll.statistics.yesPercentage > 0 && (
                <div 
                  className="h-full bg-green-500 flex items-center pl-2 text-xs font-bold text-white float-left"
                  style={{ width: `${poll.statistics.yesPercentage}%` }}
                >
                  {poll.statistics.yesPercentage > 5 ? `${poll.statistics.yesPercentage}%` : ''}
                </div>
              )}
              
              {poll.statistics.noPercentage > 0 && (
                <div 
                  className="h-full bg-red-500 flex items-center justify-end pr-2 text-xs font-bold text-white float-right"
                  style={{ width: `${poll.statistics.noPercentage}%` }}
                >
                  {poll.statistics.noPercentage > 5 ? `${poll.statistics.noPercentage}%` : ''}
                </div>
              )}
            </div>
            
            <div className="flex justify-between text-xs text-gray-600">
              <div>Yes: {poll.statistics.yesVotes}</div>
              <div>No: {poll.statistics.noVotes}</div>
            </div>
          </div>
          
          <div className="text-center text-xs text-gray-500">
            <p>Total votes: {poll.statistics.totalVotes}</p>
            <a 
              href="https://globalpoll.com" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-blue-500 hover:underline"
            >
              Global Poll
            </a>
          </div>
        </>
      )}
    </div>
  );
} 