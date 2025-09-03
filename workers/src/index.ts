PS C:\Users\AI Computer> $BASE  = 'https://api.alphogen.com'
PS C:\Users\AI Computer> $ADMIN = 'mBbpd@QJ4a2MN@Op'
PS C:\Users\AI Computer>
PS C:\Users\AI Computer> # 1) POST /jobs
PS C:\Users\AI Computer> $resp = curl.exe -s -X POST "$BASE/jobs" `
>>   -H "Authorization: Bearer $ADMIN" `
>>   -H "Content-Type: application/json" `
>>   --data '{ "prompt": "ping" }'
PS C:\Users\AI Computer> $job = $resp | ConvertFrom-Json
PS C:\Users\AI Computer> $id  = $job.provider_job_id
PS C:\Users\AI Computer> $job


ok              : True
job_id          :
status          : submitted
provider        : runpod
provider_job_id : 5b51e576-08a6-44cf-ba42-f962215058c6-e2
result          : @{id=5b51e576-08a6-44cf-ba42-f962215058c6-e2; status=IN_QUEUE}



PS C:\Users\AI Computer>
PS C:\Users\AI Computer> # 2) GET /jobs/:id  -> doit répondre RunPod (plus aucun "supabase_not_configured")
PS C:\Users\AI Computer> curl.exe -s "$BASE/jobs/$id" -H "Authorization: Bearer $ADMIN"
{"ok":false,"error":"supabase_not_configured"}
PS C:\Users\AI Computer>
