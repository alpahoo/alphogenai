import { ENV_SERVER } from './env-server';

export async function createRunpodJob(prompt: string, jobId: string) {
  if (!ENV_SERVER.RUNPOD_API_KEY || !ENV_SERVER.RUNPOD_ENDPOINT_ID) {
    return null;
  }

  const response = await fetch(`https://api.runpod.ai/v2/${ENV_SERVER.RUNPOD_ENDPOINT_ID}/run`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${ENV_SERVER.RUNPOD_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      input: { prompt, job_id: jobId },
    }),
  });

  return response.ok ? await response.json() : null;
}
