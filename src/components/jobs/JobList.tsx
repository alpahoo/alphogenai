'use client';

import { RefreshCw } from 'lucide-react';
import React, { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { createSupabaseBrowser } from '@/libs/supabase-browser';

type Job = {
  id: string;
  prompt: string;
  status: string;
  progress: number;
  runpod_job_id?: string;
  created_at: string;
  updated_at: string;
};

type JobListProps = {
  refreshTrigger?: number;
};

export function JobList({ refreshTrigger }: JobListProps) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchJobs = async () => {
    try {
      const supabase = createSupabaseBrowser();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        setError('You must be logged in to view jobs');
        return;
      }

      const response = await fetch('/api/jobs', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch jobs');
      }

      const data = await response.json();
      setJobs(data.jobs || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();
  }, [refreshTrigger]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'running':
        return 'bg-blue-100 text-blue-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array(3)
          .fill(0)
          .map((_, i) => (
            <div key={i} className="rounded-lg border bg-white shadow-sm">
              <div className="p-6 pb-4">
                <div className="mb-2 h-6 w-3/4 animate-pulse rounded bg-gray-200"></div>
                <div className="h-4 w-1/2 animate-pulse rounded bg-gray-200"></div>
              </div>
              <div className="px-6 pb-6">
                <div className="mb-2 h-4 w-full animate-pulse rounded bg-gray-200"></div>
                <div className="h-2 w-full animate-pulse rounded bg-gray-200"></div>
              </div>
            </div>
          ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border bg-white shadow-sm">
        <div className="p-6">
          <div className="text-center text-red-600">
            <p>{error}</p>
            <Button variant="outline" onClick={fetchJobs} className="mt-2">
              <RefreshCw className="mr-2 size-4" />
              Retry
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (jobs.length === 0) {
    return (
      <div className="rounded-lg border bg-white shadow-sm">
        <div className="p-6">
          <div className="text-center text-gray-500">
            <p>No jobs found. Create your first job to get started!</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Your Jobs</h3>
        <Button variant="outline" size="sm" onClick={fetchJobs}>
          <RefreshCw className="mr-2 size-4" />
          Refresh
        </Button>
      </div>

      {jobs.map(job => (
        <div key={job.id} className="rounded-lg border bg-white shadow-sm">
          <div className="p-6 pb-4">
            <div className="flex items-start justify-between">
              <h4 className="text-base font-semibold">
                Job
                {' '}
                {job.id.slice(0, 8)}
                ...
              </h4>
              <span className={`rounded-full px-2 py-1 text-xs font-medium ${getStatusColor(job.status)}`}>
                {job.status}
              </span>
            </div>
            <p className="text-sm text-gray-600">
              Created:
              {' '}
              {formatDate(job.created_at)}
            </p>
          </div>
          <div className="px-6 pb-6">
            <div className="space-y-3">
              <div>
                <p className="mb-1 text-sm font-medium">Prompt:</p>
                <p className="rounded bg-gray-50 p-2 text-sm text-gray-700">
                  {job.prompt}
                </p>
              </div>

              <div>
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-sm font-medium">Progress:</span>
                  <span className="text-sm text-gray-600">
                    {job.progress}
                    %
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-gray-200">
                  <div
                    className="h-2 rounded-full bg-blue-600 transition-all duration-300"
                    style={{ width: `${job.progress}%` }}
                  >
                  </div>
                </div>
              </div>

              {job.runpod_job_id && (
                <div>
                  <p className="mb-1 text-sm font-medium">Runpod Job ID:</p>
                  <p className="font-mono text-xs text-gray-500">
                    {job.runpod_job_id}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
