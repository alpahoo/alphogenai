import os
import time
import json
import requests
import subprocess
from typing import Optional, Dict, Any
from dataclasses import dataclass
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@dataclass
class JobConfig:
    job_id: str
    prompt: str
    webhook_url: str

class VideoGenerator:
    def __init__(self):
        self.supabase_url = os.getenv('SUPABASE_URL')
        self.supabase_key = os.getenv('SUPABASE_SERVICE_ROLE')
        self.wan_api_key = os.getenv('WAN_API_KEY', 'mock-key')
        self.qwen_api_key = os.getenv('QWEN_API_KEY', 'mock-key')
        self.r2_endpoint = os.getenv('R2_ENDPOINT')
        self.r2_access_key = os.getenv('R2_ACCESS_KEY')
        self.r2_secret_key = os.getenv('R2_SECRET_KEY')
        self.r2_bucket = os.getenv('R2_BUCKET', 'alphogenai-assets')
        
    def poll_jobs(self):
        """Poll for queued jobs from Supabase"""
        while True:
            try:
                jobs = self.get_queued_jobs()
                for job in jobs:
                    logger.info(f"Processing job {job['id']}")
                    self.process_job(job)
                    
                time.sleep(10)  # Poll every 10 seconds
            except Exception as e:
                logger.error(f"Error polling jobs: {e}")
                time.sleep(30)
    
    def get_queued_jobs(self) -> list:
        """Fetch queued jobs from Supabase"""
        if not self.supabase_url or not self.supabase_key:
            logger.warning("Supabase not configured, using mock jobs")
            return []
            
        headers = {
            'apikey': self.supabase_key,
            'Authorization': f'Bearer {self.supabase_key}',
            'Content-Type': 'application/json'
        }
        
        response = requests.get(
            f"{self.supabase_url}/rest/v1/jobs?status=eq.queued&order=created_at.asc&limit=5",
            headers=headers
        )
        
        if response.status_code == 200:
            return response.json()
        else:
            logger.error(f"Failed to fetch jobs: {response.status_code}")
            return []
    
    def process_job(self, job: Dict[str, Any]):
        """Process a single video generation job"""
        job_config = JobConfig(
            job_id=job['id'],
            prompt=job['prompt'],
            webhook_url='https://api.alphogen.com/api/webhooks/runpod'
        )
        
        try:
            self.update_job_status(job_config.job_id, 'processing')
            
            logger.info(f"Generating video scenes for: {job_config.prompt}")
            video_scenes = self.generate_video_scenes(job_config.prompt)
            
            logger.info("Generating narration")
            narration_file = self.generate_narration(job_config.prompt)
            
            logger.info("Combining video and audio")
            final_video = self.combine_media(video_scenes, narration_file)
            
            logger.info("Uploading to R2")
            video_url = self.upload_to_r2(final_video, job_config.job_id)
            
            self.update_job_status(job_config.job_id, 'completed', video_url)
            
            self.send_webhook(job_config.webhook_url, {
                'job_id': job_config.job_id,
                'status': 'completed',
                'result_url': video_url
            })
            
            logger.info(f"Job {job_config.job_id} completed successfully")
            
        except Exception as e:
            logger.error(f"Job {job_config.job_id} failed: {e}")
            self.update_job_status(job_config.job_id, 'failed', error_message=str(e))
            self.send_webhook(job_config.webhook_url, {
                'job_id': job_config.job_id,
                'status': 'failed',
                'error_message': str(e)
            })
    
    def generate_video_scenes(self, prompt: str) -> list:
        """Generate video scenes using WAN 2.2+ (mock implementation)"""
        logger.info("Calling WAN 2.2+ API (mock)")
        
        scenes = []
        for i in range(3):  # Generate 3 scenes
            scene_file = f"/tmp/scene_{i}.mp4"
            subprocess.run([
                'ffmpeg', '-f', 'lavfi', '-i', f'testsrc=duration=30:size=1280x720:rate=30',
                '-f', 'lavfi', '-i', f'sine=frequency=1000:duration=30',
                '-c:v', 'libx264', '-c:a', 'aac', '-shortest', scene_file, '-y'
            ], check=True)
            scenes.append(scene_file)
        
        return scenes
    
    def generate_narration(self, prompt: str) -> str:
        """Generate narration using Qwen-TTS (mock implementation)"""
        logger.info("Calling Qwen-TTS API (mock)")
        
        narration_file = "/tmp/narration.wav"
        subprocess.run([
            'ffmpeg', '-f', 'lavfi', '-i', 'sine=frequency=800:duration=90',
            '-c:a', 'pcm_s16le', narration_file, '-y'
        ], check=True)
        
        return narration_file
    
    def combine_media(self, video_scenes: list, narration_file: str) -> str:
        """Combine video scenes and narration using FFmpeg"""
        logger.info("Combining media with FFmpeg")
        
        concat_file = "/tmp/concat_list.txt"
        with open(concat_file, 'w') as f:
            for scene in video_scenes:
                f.write(f"file '{scene}'\n")
        
        combined_video = "/tmp/combined_video.mp4"
        subprocess.run([
            'ffmpeg', '-f', 'concat', '-safe', '0', '-i', concat_file,
            '-c', 'copy', combined_video, '-y'
        ], check=True)
        
        final_video = "/tmp/final_video.mp4"
        subprocess.run([
            'ffmpeg', '-i', combined_video, '-i', narration_file,
            '-c:v', 'copy', '-c:a', 'aac', '-map', '0:v:0', '-map', '1:a:0',
            '-shortest', final_video, '-y'
        ], check=True)
        
        return final_video
    
    def upload_to_r2(self, video_file: str, job_id: str) -> str:
        """Upload video to Cloudflare R2 (mock implementation)"""
        logger.info("Uploading to Cloudflare R2 (mock)")
        
        return f"videos/{job_id}.mp4"
    
    def update_job_status(self, job_id: str, status: str, result_url: str = None, error_message: str = None):
        """Update job status in Supabase"""
        if not self.supabase_url or not self.supabase_key:
            logger.warning("Supabase not configured, skipping status update")
            return
            
        headers = {
            'apikey': self.supabase_key,
            'Authorization': f'Bearer {self.supabase_key}',
            'Content-Type': 'application/json'
        }
        
        data = {
            'status': status,
            'updated_at': time.strftime('%Y-%m-%dT%H:%M:%S.%fZ')
        }
        
        if result_url:
            data['result_url'] = result_url
        if error_message:
            data['error_message'] = error_message
        
        response = requests.patch(
            f"{self.supabase_url}/rest/v1/jobs?id=eq.{job_id}",
            headers=headers,
            json=data
        )
        
        if response.status_code != 200:
            logger.error(f"Failed to update job status: {response.status_code}")
    
    def send_webhook(self, webhook_url: str, payload: Dict[str, Any]):
        """Send webhook notification"""
        try:
            response = requests.post(webhook_url, json=payload, timeout=30)
            if response.status_code == 200:
                logger.info("Webhook sent successfully")
            else:
                logger.error(f"Webhook failed: {response.status_code}")
        except Exception as e:
            logger.error(f"Webhook error: {e}")

if __name__ == "__main__":
    generator = VideoGenerator()
    logger.info("Starting video generation runner...")
    generator.poll_jobs()
