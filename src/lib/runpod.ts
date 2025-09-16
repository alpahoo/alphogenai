import { ENV_SERVER } from './env-server';

export async function createRunpodJob(prompt: string, jobId: string) {
  if (!ENV_SERVER.RUNPOD_API_KEY || !ENV_SERVER.RUNPOD_ENDPOINT_ID) {
    return null;
  }

  try {
    const response = await fetch(
      `https://api.runpod.ai/v2/${ENV_SERVER.RUNPOD_ENDPOINT_ID}/run`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${ENV_SERVER.RUNPOD_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          input: {
            prompt,
            job_id: jobId,
          },
        }),
      }
    );

    if (!response.ok) {
      console.error('Runpod API error:', response.status, response.statusText);
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error('Error calling Runpod API:', error);
    return null;
  }
}

export async function getRunpodJobStatus(runpodJobId: string) {
  if (!ENV_SERVER.RUNPOD_API_KEY || !ENV_SERVER.RUNPOD_ENDPOINT_ID) {
    return null;
  }

  try {
    const response = await fetch(
      `https://api.runpod.ai/v2/${ENV_SERVER.RUNPOD_ENDPOINT_ID}/status/${runpodJobId}`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${ENV_SERVER.RUNPOD_API_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      console.error(
        'Runpod status API error:',
        response.status,
        response.statusText
      );
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error('Error getting Runpod job status:', error);
    return null;
  }
}
