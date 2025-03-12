'use client';

import { useState, useEffect } from 'react';
import { formatDistance } from 'date-fns';
import Link from 'next/link';

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

interface Comment {
    id: string;
    pollId: string;
    content: string;
    answer: boolean;
    createdAt: string;
    isYours?: boolean;
}

// Cache storage with timestamps
const pollCache = {
    data: null as Poll | null,
    timestamp: 0,
    cacheDuration: 30000, // 30 seconds in milliseconds (increased from 10 seconds)
    isValid: function () {
        return this.data && (Date.now() - this.timestamp < this.cacheDuration);
    }
};

// Helper functions for localStorage
const getUserVoteFromStorage = (pollId: string): boolean | null => {
    if (typeof window === 'undefined') return null;

    try {
        const votes = JSON.parse(localStorage.getItem('globalPollVotes') || '{}');
        return votes[pollId] !== undefined ? votes[pollId] : null;
    } catch (err) {
        console.error('Error reading from localStorage:', err);
        return null;
    }
};

const saveUserVoteToStorage = (pollId: string, vote: boolean): void => {
    if (typeof window === 'undefined') return;

    try {
        const votes = JSON.parse(localStorage.getItem('globalPollVotes') || '{}');
        votes[pollId] = vote;
        localStorage.setItem('globalPollVotes', JSON.stringify(votes));
    } catch (err) {
        console.error('Error saving to localStorage:', err);
    }
};

// Helper to store poll data in localStorage 
const savePollToLocalStorage = (pollData: Poll): void => {
    if (typeof window === 'undefined') return;

    try {
        localStorage.setItem('currentPollCache', JSON.stringify({
            data: pollData,
            timestamp: Date.now()
        }));
    } catch (err) {
        console.error('Error saving poll to localStorage:', err);
    }
};

// Helper to get poll data from localStorage
const getPollFromLocalStorage = (): { data: Poll | null, timestamp: number } => {
    if (typeof window === 'undefined') return { data: null, timestamp: 0 };

    try {
        const cachedData = localStorage.getItem('currentPollCache');
        if (cachedData) {
            return JSON.parse(cachedData);
        }
    } catch (err) {
        console.error('Error reading poll from localStorage:', err);
    }

    return { data: null, timestamp: 0 };
};

// Generate a unique device ID for comment identification
const getDeviceId = (): string => {
    if (typeof window === 'undefined') return '';

    try {
        // Check if we already have a device ID stored
        let deviceId = localStorage.getItem('globalPollDeviceId');
        
        // If not, create a new one
        if (!deviceId) {
            // Create a random ID using timestamp and random numbers
            deviceId = `device_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
            localStorage.setItem('globalPollDeviceId', deviceId);
        }
        
        return deviceId;
    } catch (err) {
        console.error('Error with device ID:', err);
        // Fallback to a temporary random ID if localStorage fails
        return `temp_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
    }
};

export default function Home() {
    const [poll, setPoll] = useState<Poll | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [userVote, setUserVote] = useState<boolean | null>(null);
    const [voteSubmitting, setVoteSubmitting] = useState(false);
    const [showEmbedCode, setShowEmbedCode] = useState(false);
    const [embedCodeCopied, setEmbedCodeCopied] = useState(false);
    const [comment, setComment] = useState('');
    const [comments, setComments] = useState<Comment[]>([]);
    const [loadingComments, setLoadingComments] = useState(false);
    const [commentError, setCommentError] = useState<string | null>(null);
    const [animatingResults, setAnimatingResults] = useState(false);
    const [hasCommented, setHasCommented] = useState(false);
    const [selectedVote, setSelectedVote] = useState<boolean | null>(null);
    const [hasCheckedVoteStatus, setHasCheckedVoteStatus] = useState(false);

    // Fetch current poll with caching
    useEffect(() => {
        const fetchPoll = async () => {
            // Check if we have valid in-memory cached data
            if (pollCache.isValid()) {
                setPoll(pollCache.data);
                
                // Check localStorage for this poll's vote
                if (pollCache.data) {
                    const savedVote = getUserVoteFromStorage(pollCache.data.id);
                    setUserVote(savedVote);
                    
                    // Also check server-side vote status - this ensures even if localStorage is cleared, UI still reflects vote status
                    if (pollCache.data.id) {
                        await checkVoteStatus(pollCache.data.id);
                    }
                }
                
                setLoading(false);
                return;
            }

            // Check localStorage for cached poll data
            const { data: cachedPoll, timestamp } = getPollFromLocalStorage();

            // If localStorage cache is valid (less than 30 seconds old)
            if (cachedPoll && (Date.now() - timestamp < 30000)) {
                // Update in-memory cache
                pollCache.data = cachedPoll;
                pollCache.timestamp = timestamp;

                setPoll(cachedPoll);

                // Check localStorage for this poll's vote
                const savedVote = getUserVoteFromStorage(cachedPoll.id);
                setUserVote(savedVote);
                
                // Also check with the server
                if (cachedPoll.id) {
                    await checkVoteStatus(cachedPoll.id);
                }

                setLoading(false);
                return;
            }

            // If no valid cache, fetch from API
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

                // Update the in-memory cache
                pollCache.data = data;
                pollCache.timestamp = Date.now();

                // Update localStorage cache
                savePollToLocalStorage(data);

                // Check localStorage for this poll's vote
                const savedVote = getUserVoteFromStorage(data.id);
                setUserVote(savedVote);

                setPoll(data);
            } catch {
                setError('An error occurred. Please try again later.');
            } finally {
                setLoading(false);
            }
        };

        fetchPoll();

        // Refresh poll data every 60 seconds (increased from 30 seconds)
        const intervalId = setInterval(fetchPoll, 60000);
        return () => clearInterval(intervalId);
    }, []);

    // Fetch comments for the current poll
    useEffect(() => {
        if (poll) {
            fetchComments(poll.id);
        }
    }, [poll]);

    // Function to fetch comments for the current poll
    const fetchComments = async (pollId: string) => {
        if (!pollId) return;
        
        setLoadingComments(true);
        try {
            // Include the device ID when fetching comments
            const deviceId = getDeviceId();
            const response = await fetch(`/api/comments?pollId=${pollId}&deviceId=${encodeURIComponent(deviceId)}`);
            if (!response.ok) {
                throw new Error('Failed to fetch comments');
            }
            
            const commentsData = await response.json();
            
            // Use the isYours property directly from the API
            setComments(commentsData);
        } catch (error) {
            console.error('Error fetching comments:', error);
        } finally {
            setLoadingComments(false);
        }
    };

    // Submit vote
    const submitVote = async (answer: boolean) => {
        if (!poll) return;
        
        // If user has already voted, don't allow them to vote again
        if (userVote !== null) {
            setError('You have already voted on this poll.');
            return;
        }
        
        setVoteSubmitting(true);
        setError(null);
        
        try {
            // Make the API call first
            const response = await fetch('/api/votes', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    pollId: poll.id,
                    answer,
                    fingerprint: navigator.userAgent, // Simple fingerprint
                    deviceId: getDeviceId(), // Add device ID
                }),
            });
            
            // Check if the response indicates they've already voted
            if (response.status === 400) {
                const data = await response.json();
                if (data.message?.includes('already voted')) {
                    // If they've already voted, update the UI to reflect that
                    if (poll.id) {
                        await checkVoteStatus(poll.id);
                    }
                    setError('You have already voted on this poll.');
                    return;
                }
            }
            
            if (!response.ok) {
                throw new Error('Failed to submit vote');
            }
            
            await response.json();
            
            // Immediately update user's vote state to ensure UI is updated
            setUserVote(answer);
            
            // Save vote to localStorage
            saveUserVoteToStorage(poll.id, answer);
            
            // Trigger animation
            setAnimatingResults(true);
            
            // Reset other states
            setSelectedVote(null);
            setComment('');
            
            // Fetch the actual updated poll data immediately
            const pollResponse = await fetch('/api/polls');
            if (pollResponse.ok) {
                const pollData = await pollResponse.json();
                setPoll(pollData);
                
                // Update the in-memory cache
                pollCache.data = pollData;
                pollCache.timestamp = Date.now();
                
                // Update localStorage cache
                savePollToLocalStorage(pollData);
                
                // End animation after a short delay
                setTimeout(() => {
                    setAnimatingResults(false);
                }, 1000);
            } else {
                throw new Error('Failed to fetch updated poll data');
            }
        } catch (err) {
            console.error('Error submitting vote:', err);
            setError('Failed to submit your vote. Please try again.');
            setAnimatingResults(false);
            
            // If there was an error, check if the user might have already voted
            if (poll.id) {
                await checkVoteStatus(poll.id);
            }
        } finally {
            setVoteSubmitting(false);
        }
    };

    // Submit comment along with vote
    const submitComment = async () => {
        if (!poll || !comment.trim() || selectedVote === null) return;

        if (comment.length > 160) {
            setCommentError('Comment must be 160 characters or less');
            return;
        }

        // If user has already voted, don't allow them to vote again
        if (userVote !== null) {
            setCommentError('You have already voted on this poll.');
            return;
        }

        if (hasCommented) {
            setCommentError('You have already submitted a comment for this poll');
            return;
        }

        setVoteSubmitting(true);
        setCommentError(null);

        try {
            // First submit the vote
            const voteResponse = await fetch('/api/votes', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    pollId: poll.id,
                    answer: selectedVote,
                    fingerprint: navigator.userAgent,
                    deviceId: getDeviceId(), // Add device ID
                }),
            });

            // Check if the user has already voted
            if (voteResponse.status === 400) {
                const data = await voteResponse.json();
                if (data.message?.includes('already voted')) {
                    // If they've already voted, update the UI to reflect that
                    if (poll.id) {
                        await checkVoteStatus(poll.id);
                    }
                    setCommentError('You have already voted on this poll.');
                    return;
                }
            }

            if (!voteResponse.ok) {
                throw new Error('Failed to submit vote');
            }

            await voteResponse.json();

            // Then submit the comment
            const commentResponse = await fetch('/api/comments', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    pollId: poll.id,
                    content: comment.trim(),
                    answer: selectedVote,
                    fingerprint: navigator.userAgent,
                    deviceId: getDeviceId(), // Add device ID
                }),
            });

            if (!commentResponse.ok) {
                throw new Error('Failed to submit comment');
            }

            // Immediately update user's vote state to ensure UI is updated
            setUserVote(selectedVote);

            // Save vote to localStorage
            saveUserVoteToStorage(poll.id, selectedVote);

            // Clear comment and mark as commented
            setComment('');
            setHasCommented(true);
            setSelectedVote(null);

            // Refresh comments
            fetchComments(poll.id);

            // Trigger animation
            setAnimatingResults(true);

            // Fetch the actual updated poll data immediately
            const pollResponse = await fetch('/api/polls');
            if (pollResponse.ok) {
                const pollData = await pollResponse.json();
                setPoll(pollData);

                // Update the in-memory cache
                pollCache.data = pollData;
                pollCache.timestamp = Date.now();

                // Update localStorage cache
                savePollToLocalStorage(pollData);

                // End animation after a short delay
                setTimeout(() => {
                    setAnimatingResults(false);
                }, 1000);
            } else {
                throw new Error('Failed to fetch updated poll data');
            }
        } catch (err) {
            console.error('Error submitting vote and comment:', err);
            setError('Failed to submit your vote and comment. Please try again.');
            setAnimatingResults(false);
            
            // If there was an error, check if the user might have already voted
            if (poll.id) {
                await checkVoteStatus(poll.id);
            }
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

    // Generate embed code
    const getEmbedCode = () => {
        const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
        return `<iframe src="${baseUrl}/embed" width="100%" height="300" frameborder="0" scrolling="no" style="border: 1px solid #eee; border-radius: 8px;"></iframe>`;
    };

    // Copy embed code to clipboard
    const copyEmbedCode = () => {
        if (typeof navigator !== 'undefined') {
            navigator.clipboard.writeText(getEmbedCode())
                .then(() => {
                    setEmbedCodeCopied(true);
                    setTimeout(() => setEmbedCodeCopied(false), 2000);
                })
                .catch(err => {
                    console.error('Failed to copy embed code:', err);
                });
        }
    };

    // Check vote status from server
    const checkVoteStatus = async (pollId: string) => {
        try {
            const fingerprint = navigator.userAgent;
            const deviceId = getDeviceId();
            const response = await fetch(`/api/votes/check?pollId=${pollId}&fingerprint=${encodeURIComponent(fingerprint)}&deviceId=${encodeURIComponent(deviceId)}`);
            
            if (response.ok) {
                const data = await response.json();
                console.log('Vote status check response:', data);
                if (data.hasVoted) {
                    setUserVote(data.vote); // Set the user's vote
                    saveUserVoteToStorage(pollId, data.vote); // Update localStorage too
                    
                    // Make sure the UI reflects the vote status
                    setSelectedVote(null);
                    setHasCheckedVoteStatus(true);
                    
                    // Also fetch comments to check if user has commented
                    fetchComments(pollId);
                    return true;
                } else {
                    setHasCheckedVoteStatus(true);
                }
            }
            return false;
        } catch (err) {
            console.error('Error checking vote status:', err);
            setHasCheckedVoteStatus(true);
            return false;
        }
    };

    // Add a useEffect that runs once when the component mounts to check vote status
    useEffect(() => {
        // Check vote status immediately when poll is loaded
        if (poll && poll.id) {
            checkVoteStatus(poll.id);
        }
    }, [poll?.id]);

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
                            <div className="flex justify-center mb-2">
                                <span className="inline-block px-3 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                                    {poll.category === 'custom'
                                        ? poll.customCategory
                                        : (poll.category || 'general').charAt(0).toUpperCase() + (poll.category || 'general').slice(1)}
                                </span>
                            </div>
                            <h2 className="text-2xl font-bold mb-6 text-center">{poll.question}</h2>

                            <p className="text-center text-sm text-gray-500 mb-4">
                                Note: You can only vote once on this poll. Your vote cannot be changed after submission.
                            </p>

                            {/* Show a loading indicator while checking vote status */}
                            {!hasCheckedVoteStatus && (
                                <div className="text-center mb-6">
                                    <p className="text-sm text-gray-500">Checking your vote status...</p>
                                </div>
                            )}

                            {/* User has already voted - show confirmation message instead of voting UI */}
                            {hasCheckedVoteStatus && userVote !== null ? (
                                <div className="text-center text-green-600 font-semibold mb-8 py-4 bg-green-50 rounded-lg border border-green-200">
                                    You have voted {userVote ? 'YES' : 'NO'} on this poll.
                                </div>
                            ) : hasCheckedVoteStatus ? (
                                <>
                                    {/* Comment form for users who haven't commented yet - ONLY SHOW IF USER HASN'T VOTED */}
                                    {!hasCommented && (
                                        <div className="mb-4">
                                            {/* For users who haven't voted yet */}
                                            <>
                                                <textarea
                                                    placeholder="Add an optional comment with your vote (max 160 characters)"
                                                    value={comment}
                                                    onChange={(e) => setComment(e.target.value)}
                                                    maxLength={160}
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                                                    rows={2}
                                                    disabled={voteSubmitting || userVote !== null || !hasCheckedVoteStatus}
                                                />
                                                <div className="flex justify-between mt-1">
                                                    <p className="text-xs text-gray-500">
                                                        {selectedVote !== null ?
                                                            `Your vote: ${selectedVote ? 'YES' : 'NO'}` :
                                                            'Enter your comment (optional), then click YES or NO to vote'}
                                                    </p>
                                                    <p className="text-xs text-gray-500">
                                                        {comment.length}/160
                                                    </p>
                                                </div>
                                            </>

                                            {commentError && (
                                                <p className="mt-1 text-xs text-red-500">{commentError}</p>
                                            )}
                                        </div>
                                    )}

                                    <div className="flex flex-col sm:flex-row justify-center gap-4 mb-8 relative">                                        
                                        <button
                                            onClick={() => {
                                                if (userVote !== null || !hasCheckedVoteStatus) return;
                                                
                                                // If there's a comment, submit both vote and comment directly
                                                if (comment.trim()) {
                                                    setSelectedVote(true);
                                                    submitComment();
                                                } else {
                                                    // No comment, just submit the vote
                                                    submitVote(true);
                                                }
                                            }}
                                            disabled={voteSubmitting || userVote !== null || !hasCheckedVoteStatus}
                                            className={`py-3 px-8 rounded-full font-bold text-white ${
                                                selectedVote === true
                                                    ? 'bg-green-600'
                                                    : 'bg-green-500 hover:bg-green-600'
                                            } transition-all duration-200 shadow-md hover:shadow-lg disabled:opacity-50`}
                                        >
                                            {voteSubmitting ? 'Submitting...' : 'YES'}
                                        </button>

                                        <button
                                            onClick={() => {
                                                if (userVote !== null || !hasCheckedVoteStatus) return;
                                                
                                                // If there's a comment, submit both vote and comment directly
                                                if (comment.trim()) {
                                                    setSelectedVote(false);
                                                    submitComment();
                                                } else {
                                                    // No comment, just submit the vote
                                                    submitVote(false);
                                                }
                                            }}
                                            disabled={voteSubmitting || userVote !== null || !hasCheckedVoteStatus}
                                            className={`py-3 px-8 rounded-full font-bold text-white ${
                                                selectedVote === false
                                                    ? 'bg-red-600'
                                                    : 'bg-red-500 hover:bg-red-600'
                                            } transition-all duration-200 shadow-md hover:shadow-lg disabled:opacity-50`}
                                        >
                                            {voteSubmitting ? 'Submitting...' : 'NO'}
                                        </button>
                                    </div>
                                </>
                            ) : null /* Don't render anything while checking status */}

                            {/* Comments section - move it above results when user has voted */}
                            {userVote !== null && (
                                <div className="mb-6 border-t pt-4">
                                    <h3 className="text-lg font-semibold mb-4">Comments</h3>

                                    {loadingComments ? (
                                        <p className="text-center text-sm text-gray-500">Loading comments...</p>
                                    ) : comments.length > 0 ? (
                                        <div className="space-y-4">
                                            {comments.map((comment) => (
                                                <div 
                                                    key={comment.id} 
                                                    className={`p-3 rounded-lg ${comment.isYours ? 'bg-blue-50 border border-blue-100' : 'bg-gray-50'}`}
                                                >
                                                    <div className="flex items-start">
                                                        <span className={`inline-block px-2 py-1 text-xs font-semibold rounded-full mr-2 ${comment.answer ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                                            }`}>
                                                            {comment.answer ? 'YES' : 'NO'}
                                                        </span>
                                                        <p className="text-sm">
                                                            {comment.content}
                                                            {comment.isYours && (
                                                                <span className="ml-2 text-blue-600 font-medium">(yours)</span>
                                                            )}
                                                        </p>
                                                    </div>
                                                    <p className="text-xs text-gray-500 mt-1">
                                                        {new Date(comment.createdAt).toLocaleString()}
                                                    </p>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-center text-sm text-gray-500">No comments yet.</p>
                                    )}
                                </div>
                            )}

                            <div className="mb-4">
                                <h3 className="text-sm text-gray-500 mb-2 text-center">Current Results</h3>
                                
                                <div className="h-8 bg-gray-200 rounded-full overflow-hidden mb-2 relative">
                                    {/* Yes percentage bar - shown only if there are yes votes */}
                                    {poll.statistics.yesPercentage > 0 && (
                                        <div
                                            className={`h-full bg-green-500 flex items-center pl-3 text-xs font-bold text-white float-left ${animatingResults ? 'transition-all duration-1000 ease-out' : ''
                                                }`}
                                            style={{ width: `${poll.statistics.yesPercentage}%` }}
                                        >
                                            {poll.statistics.yesPercentage > 5 ? `${poll.statistics.yesPercentage}%` : ''}
                                        </div>
                                    )}

                                    {/* No percentage bar - shown only if there are No votes */}
                                    {poll.statistics.noPercentage > 0 && (
                                        <div
                                            className={`h-full bg-red-500 flex items-center justify-end pr-3 text-xs font-bold text-white float-right ${animatingResults ? 'transition-all duration-1000 ease-out' : ''
                                                }`}
                                            style={{ width: `${poll.statistics.noPercentage}%` }}
                                        >
                                            {poll.statistics.noPercentage > 5 ? `${poll.statistics.noPercentage}%` : ''}
                                        </div>
                                    )}

                                    {/* Pulsing animation when results are updating */}
                                    {animatingResults && (
                                        <div className="absolute inset-0 bg-white bg-opacity-20 animate-pulse"></div>
                                    )}
                                </div>

                                <div className="flex justify-between text-sm text-gray-600">
                                    <div className={animatingResults ? 'transition-all duration-500' : ''}>
                                        Yes: {poll.statistics.yesVotes} votes ({poll.statistics.yesPercentage}%)
                                    </div>
                                    <div className={animatingResults ? 'transition-all duration-500' : ''}>
                                        No: {poll.statistics.noVotes} votes ({poll.statistics.noPercentage}%)
                                    </div>
                                </div>
                            </div>

                            {/* Comments section - only show at bottom if user hasn't voted yet */}
                            {userVote === null && (
                                <div className="mt-8 border-t pt-4">
                                    <h3 className="text-lg font-semibold mb-4">Comments</h3>

                                    {loadingComments ? (
                                        <p className="text-center text-sm text-gray-500">Loading comments...</p>
                                    ) : comments.length > 0 ? (
                                        <div className="space-y-4">
                                            {comments.map((comment) => (
                                                <div 
                                                    key={comment.id} 
                                                    className={`p-3 rounded-lg ${comment.isYours ? 'bg-blue-50 border border-blue-100' : 'bg-gray-50'}`}
                                                >
                                                    <div className="flex items-start">
                                                        <span className={`inline-block px-2 py-1 text-xs font-semibold rounded-full mr-2 ${comment.answer ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                                            }`}>
                                                            {comment.answer ? 'YES' : 'NO'}
                                                        </span>
                                                        <p className="text-sm">
                                                            {comment.content}
                                                            {comment.isYours && (
                                                                <span className="ml-2 text-blue-600 font-medium">(yours)</span>
                                                            )}
                                                        </p>
                                                    </div>
                                                    <p className="text-xs text-gray-500 mt-1">
                                                        {new Date(comment.createdAt).toLocaleString()}
                                                    </p>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-center text-sm text-gray-500">No comments yet. Be the first to comment!</p>
                                    )}
                                </div>
                            )}

                            <div className="mt-6 text-center text-sm text-gray-500">
                                <p>Total votes: {poll.statistics.totalVotes}</p>
                                <p>Poll expires {getTimeRemaining(poll.expiresAt)}</p>
                            </div>

                            <div className="mt-6 border-t pt-4">
                                <button
                                    onClick={() => setShowEmbedCode(!showEmbedCode)}
                                    className="text-blue-500 hover:text-blue-700 text-sm flex items-center mx-auto"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                                    </svg>
                                    {showEmbedCode ? 'Hide Embed Code' : 'Embed This Poll'}
                                </button>

                                {showEmbedCode && (
                                    <div className="mt-3 p-3 bg-gray-50 rounded-md">
                                        <p className="text-xs text-gray-600 mb-2">Copy and paste this code to embed the poll on your website:</p>
                                        <div className="relative">
                                            <pre className="bg-gray-100 p-2 rounded text-xs overflow-x-auto">{getEmbedCode()}</pre>
                                            <button
                                                onClick={copyEmbedCode}
                                                className="absolute top-2 right-2 bg-blue-500 hover:bg-blue-600 text-white text-xs py-1 px-2 rounded"
                                            >
                                                {embedCodeCopied ? 'Copied!' : 'Copy'}
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </main>
    );
}
