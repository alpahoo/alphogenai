import React from 'react';
import { CreateJobButton } from '@/components/jobs/CreateJobButton';
import { JobList } from '@/components/jobs/JobList';
import { T } from '@/components/ui/Typography';

export default function JobsPage() {
  return (
    <div className="container mx-auto py-6 space-y-8">
      <div className="flex justify-between items-center">
        <T.H1>AlphoGenAI Jobs</T.H1>
        <CreateJobButton />
      </div>

      <JobList />
    </div>
  );
}
