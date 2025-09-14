'use client';

import { useEffect, useState } from 'react';

import { useAuth } from '@/hooks/useAuth';
import { createSupabaseBrowser } from '@/libs/supabase-browser';

type Job = {
  id: string;
  prompt: string;
  status: 'queued' | 'running' | 'done' | 'error';
  progress: number;
  result_r2_key?: string;
  created_at: string;
  updated_at: string;
};

export const JobsList = () => {
  const { user } = useAuth();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newPrompt, setNewPrompt] = useState('');

  const fetchJobs = async () => {
    try {
      const { data: { session } } = await createSupabaseBrowser().auth.getSession();
      const response = await fetch('/api/jobs', {
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setJobs(data.jobs || []);
      }
    } catch (err) {
      console.error('Failed to fetch jobs:', err);
    } finally {
      setLoading(false);
    }
  };

  const createJob = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPrompt.trim()) {
      return;
    }

    setCreating(true);
    try {
      const { data: { session } } = await createSupabaseBrowser().auth.getSession();
      const response = await fetch('/api/jobs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ prompt: newPrompt.trim() }),
      });

      if (response.ok) {
        setNewPrompt('');
        fetchJobs();
      } else {
        const error = await response.json();
        console.error(`Failed to create job: ${error.error}`);
      }
    } catch (error) {
      console.error('Failed to create job:', error);
      console.error('Failed to create job');
    } finally {
      setCreating(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchJobs();
    }
  }, [user]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'queued': return 'bg-yellow-100 text-yellow-800';
      case 'running': return 'bg-blue-100 text-blue-800';
      case 'done': return 'bg-green-100 text-green-800';
      case 'error': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">Loading jobs...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border bg-white p-6 shadow-sm">
        <h3 className="mb-4 text-lg font-medium text-gray-900">Create New Job</h3>

        <form onSubmit={createJob} className="space-y-4">
          <div>
            <label htmlFor="prompt" className="block text-sm font-medium text-gray-700">
              Video Prompt
            </label>
            <textarea
              id="prompt"
              value={newPrompt}
              onChange={e => setNewPrompt(e.target.value)}
              rows={3}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              placeholder="Describe the video you want to generate..."
              required
            />
          </div>

          <button
            type="submit"
            disabled={creating || !newPrompt.trim()}
            className="inline-flex justify-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50"
          >
            {creating ? 'Creating...' : 'Create Job'}
          </button>
        </form>
      </div>

      <div className="rounded-lg border bg-white shadow-sm">
        <div className="border-b border-gray-200 px-6 py-4">
          <h3 className="text-lg font-medium text-gray-900">Your Jobs</h3>
        </div>

        {jobs.length === 0
          ? (
              <div className="p-6 text-center text-gray-500">
                No jobs yet. Create your first video generation job above!
              </div>
            )
          : (
              <div className="divide-y divide-gray-200">
                {jobs.map(job => (
                  <div key={job.id} className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="mb-2 text-sm font-medium text-gray-900">
                          {job.prompt}
                        </p>
                        <div className="flex items-center space-x-4 text-sm text-gray-500">
                          <span>
                            Created:
                            {new Date(job.created_at).toLocaleDateString()}
                          </span>
                          <span>•</span>
                          <span>
                            Progress:
                            {job.progress}
                            %
                          </span>
                        </div>
                      </div>
                      <div className="ml-4 flex items-center space-x-2">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${getStatusColor(job.status)}`}>
                          {job.status}
                        </span>
                      </div>
                    </div>

                    {job.status === 'done' && job.result_r2_key && (
                      <div className="mt-4">
                        <a
                          href={`/api/assets/${job.result_r2_key}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center rounded-md border border-transparent bg-indigo-100 px-3 py-2 text-sm font-medium leading-4 text-indigo-700 hover:bg-indigo-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                        >
                          View Video
                        </a>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
      </div>
    </div>
  );
};
