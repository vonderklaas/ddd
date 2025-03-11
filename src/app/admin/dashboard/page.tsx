'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { format } from 'date-fns';

interface Poll {
  id: string;
  question: string;
  createdAt: string;
  expiresAt: string;
  isActive: boolean;
  _count: {
    votes: number;
  };
}

export default function AdminDashboard() {
  const [polls, setPolls] = useState<Poll[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newQuestion, setNewQuestion] = useState('');
  const [createLoading, setCreateLoading] = useState(false);
  const router = useRouter();

  // Check if user is logged in
  useEffect(() => {
    const isLoggedIn = localStorage.getItem('isAdminLoggedIn');
    if (!isLoggedIn) {
      router.push('/admin');
    } else {
      fetchPolls();
    }
  }, [router]);

  // Fetch all polls
  const fetchPolls = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/polls');
      
      if (!response.ok) {
        throw new Error('Failed to fetch polls');
      }
      
      const data = await response.json();
      setPolls(data);
    } catch {
      setError('Failed to load polls. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Create a new poll
  const handleCreatePoll = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newQuestion.trim()) {
      setError('Poll question is required');
      return;
    }
    
    setCreateLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/admin/polls', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ question: newQuestion.trim() }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to create poll');
      }
      
      setNewQuestion('');
      fetchPolls();
    } catch {
      setError('Failed to create poll. Please try again.');
    } finally {
      setCreateLoading(false);
    }
  };

  // Activate/deactivate a poll
  const togglePollStatus = async (poll: Poll) => {
    try {
      const response = await fetch(`/api/admin/polls/${poll.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ isActive: !poll.isActive }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to update poll status');
      }
      
      fetchPolls();
    } catch {
      setError('Failed to update poll status. Please try again.');
    }
  };

  // Delete a poll
  const deletePoll = async (pollId: string) => {
    if (!confirm('Are you sure you want to delete this poll? This action cannot be undone.')) {
      return;
    }
    
    try {
      const response = await fetch(`/api/admin/polls/${pollId}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete poll');
      }
      
      fetchPolls();
    } catch {
      setError('Failed to delete poll. Please try again.');
    }
  };

  // Handle logout
  const handleLogout = () => {
    localStorage.removeItem('isAdminLoggedIn');
    router.push('/admin');
  };

  // Format date
  const formatDate = (dateString: string) => {
    return format(new Date(dateString), 'MMM d, yyyy HH:mm');
  };

  return (
    <main className="flex min-h-screen flex-col p-4 md:p-8">
      <div className="max-w-6xl w-full mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Admin Dashboard</h1>
          
          <div className="flex items-center gap-4">
            <Link href="/" className="text-blue-500 hover:underline text-sm">
              View Site
            </Link>
            <button
              onClick={handleLogout}
              className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-4 py-2 rounded text-sm"
            >
              Logout
            </button>
          </div>
        </div>
        
        {error && (
          <div className="mb-6 p-3 bg-red-50 border border-red-200 text-red-600 rounded">
            {error}
          </div>
        )}
        
        <div className="bg-white shadow-md rounded-lg overflow-hidden mb-8">
          <div className="p-6">
            <h2 className="text-xl font-bold mb-4">Create New Poll</h2>
            
            <form onSubmit={handleCreatePoll}>
              <div className="mb-4">
                <label htmlFor="question" className="block text-gray-700 font-medium mb-2">
                  Poll Question
                </label>
                <input
                  type="text"
                  id="question"
                  value={newQuestion}
                  onChange={(e) => setNewQuestion(e.target.value)}
                  placeholder="Enter your yes/no question here..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={createLoading}
                />
              </div>
              
              <button
                type="submit"
                disabled={createLoading}
                className="bg-gradient-to-r from-blue-500 to-purple-600 text-white py-2 px-6 rounded-md hover:from-blue-600 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
              >
                {createLoading ? 'Creating...' : 'Create Poll'}
              </button>
              <p className="mt-2 text-xs text-gray-500">
                Creating a new active poll will automatically archive any currently active poll.
              </p>
            </form>
          </div>
        </div>
        
        <div className="bg-white shadow-md rounded-lg overflow-hidden">
          <div className="p-6">
            <h2 className="text-xl font-bold mb-4">Manage Polls</h2>
            
            {loading && <p>Loading polls...</p>}
            
            {!loading && polls.length === 0 && (
              <p>No polls available. Create your first poll above.</p>
            )}
            
            {polls.length > 0 && (
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead>
                    <tr className="bg-gray-50 border-b">
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Question</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Expires</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Votes</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {polls.map((poll) => (
                      <tr key={poll.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          {poll.question}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {formatDate(poll.createdAt)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {formatDate(poll.expiresAt)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {poll._count.votes}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            poll.isActive 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-gray-100 text-gray-800'
                          }`}>
                            {poll.isActive ? 'Active' : 'Archived'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <button
                            onClick={() => togglePollStatus(poll)}
                            className={`mr-3 ${
                              poll.isActive 
                                ? 'text-amber-600 hover:text-amber-900' 
                                : 'text-green-600 hover:text-green-900'
                            }`}
                          >
                            {poll.isActive ? 'Archive' : 'Activate'}
                          </button>
                          <button
                            onClick={() => deletePoll(poll.id)}
                            className="text-red-600 hover:text-red-900"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
} 