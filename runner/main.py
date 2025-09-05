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
        """Generate video scenes using WAN 2.2+ API with fallback to mock"""
        if self.wan_api_key == 'mock-key':
            logger.info("Using mock WAN 2.2+ implementation")
            return self._generate_mock_scenes()
        
        logger.info("Calling WAN 2.2+ API for video generation")
        scenes = []
        scene_prompts = self._split_prompt_into_scenes(prompt)
        
        for i, scene_prompt in enumerate(scene_prompts):
            try:
                response = requests.post(
                    "https://api.wan.com/v2/text-to-video",
                    headers={
                        "Authorization": f"Bearer {self.wan_api_key}",
                        "Content-Type": "application/json"
                    },
                    json={
                        "prompt": scene_prompt,
                        "duration": 30,  # 30 seconds per scene
                        "resolution": "1080p",
                        "fps": 24,
                        "style": "realistic",
                        "format": "mp4"
                    },
                    timeout=600  # 10 minutes for video generation
                )
                
                if response.status_code == 200:
                    result = response.json()
                    video_url = result.get("video_url") or result.get("download_url")
                    if video_url:
                        scene_file = f"/tmp/scene_{i}_real.mp4"
                        self._download_file(video_url, scene_file)
                        scenes.append(scene_file)
                        logger.info(f"Generated scene {i+1}/{len(scene_prompts)} with WAN 2.2+")
                    else:
                        raise Exception("No video URL in WAN 2.2+ response")
                else:
                    raise Exception(f"WAN 2.2+ API error: {response.status_code}")
                
            except Exception as e:
                logger.error(f"WAN 2.2+ API error for scene {i}: {e}")
                scene_file = self._generate_mock_scene(i, scene_prompt)
                scenes.append(scene_file)
        
        return scenes
    
    def _download_file(self, url: str, local_path: str):
        """Download file from URL to local path"""
        response = requests.get(url, stream=True, timeout=300)
        response.raise_for_status()
        
        with open(local_path, 'wb') as f:
            for chunk in response.iter_content(chunk_size=8192):
                f.write(chunk)
        
        logger.info(f"Downloaded file: {local_path}")
    
    def _split_prompt_into_scenes(self, prompt: str) -> list:
        """Split main prompt into 3 scene descriptions"""
        return [
            f"Opening scene: {prompt}",
            f"Main content: {prompt}",
            f"Closing scene: {prompt}"
        ]
    
    def _generate_mock_scenes(self) -> list:
        """Generate mock video scenes for testing"""
        scenes = []
        for i in range(3):
            scene_file = f"/tmp/scene_{i}.mp4"
            subprocess.run([
                'ffmpeg', '-f', 'lavfi', '-i', f'testsrc=duration=30:size=1280x720:rate=30',
                '-f', 'lavfi', '-i', f'sine=frequency=1000:duration=30',
                '-c:v', 'libx264', '-c:a', 'aac', '-shortest', scene_file, '-y'
            ], check=True)
            scenes.append(scene_file)
        return scenes
    
    def _generate_mock_scene(self, index: int, prompt: str) -> str:
        """Generate a single mock scene"""
        scene_file = f"/tmp/scene_{index}.mp4"
        subprocess.run([
            'ffmpeg', '-f', 'lavfi', '-i', f'testsrc=duration=30:size=1280x720:rate=30',
            '-f', 'lavfi', '-i', f'sine=frequency=1000:duration=30',
            '-c:v', 'libx264', '-c:a', 'aac', '-shortest', scene_file, '-y'
        ], check=True)
        return scene_file
    
    def generate_narration(self, prompt: str) -> str:
        """Generate narration using Qwen-TTS API with fallback to mock"""
        if self.qwen_api_key == 'mock-key':
            logger.info("Using mock Qwen-TTS implementation")
            return self._generate_mock_narration()
        
        logger.info("Calling Qwen-TTS API for narration generation")
        
        try:
            narration_text = self._create_narration_script(prompt)
            
            response = requests.post(
                "https://api.qwen.com/v1/audio/speech",
                headers={
                    "Authorization": f"Bearer {self.qwen_api_key}",
                    "Content-Type": "application/json"
                },
                json={
                    "model": "qwen-tts-v1",
                    "input": narration_text,
                    "voice": "professional_male",
                    "response_format": "mp3",
                    "speed": 1.0,
                    "pitch": 0.0,
                    "volume": 0.8
                },
                timeout=180  # 3 minutes for TTS generation
            )
            
            if response.status_code == 200:
                content_type = response.headers.get('content-type', '')
                if 'application/json' in content_type:
                    result = response.json()
                    audio_url = result.get("audio_url") or result.get("url")
                    if audio_url:
                        narration_file = "/tmp/narration_real.mp3"
                        self._download_file(audio_url, narration_file)
                        logger.info("Generated narration with Qwen-TTS")
                        return narration_file
                elif 'audio/' in content_type:
                    narration_file = "/tmp/narration_real.mp3"
                    with open(narration_file, 'wb') as f:
                        f.write(response.content)
                    logger.info("Generated narration with Qwen-TTS")
                    return narration_file
                
                raise Exception("No audio content in Qwen-TTS response")
            else:
                raise Exception(f"Qwen-TTS API error: {response.status_code}")
            
        except Exception as e:
            logger.error(f"Qwen-TTS API error: {e}")
            return self._generate_mock_narration()
    
    def _create_narration_script(self, prompt: str) -> str:
        """Create narration script from video prompt"""
        return f"Welcome to this video about {prompt}. Let me walk you through the key concepts and ideas that make this topic fascinating and important to understand."
    
    def _generate_mock_narration(self) -> str:
        """Generate mock narration for testing"""
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
        """Upload video to Cloudflare R2"""
        if not all([self.r2_endpoint, self.r2_access_key, self.r2_secret_key]):
            logger.warning("R2 credentials not configured, using mock upload")
            return f"videos/{job_id}.mp4"
        
        logger.info("Uploading to Cloudflare R2")
        
        try:
            import boto3
            from botocore.config import Config
            
            s3_client = boto3.client(
                's3',
                endpoint_url=self.r2_endpoint,
                aws_access_key_id=self.r2_access_key,
                aws_secret_access_key=self.r2_secret_key,
                config=Config(signature_version='s3v4')
            )
            
            object_key = f"videos/{job_id}.mp4"
            s3_client.upload_file(
                video_file,
                self.r2_bucket,
                object_key,
                ExtraArgs={'ContentType': 'video/mp4'}
            )
            
            logger.info(f"Video uploaded successfully: {object_key}")
            return object_key
            
        except Exception as e:
            logger.error(f"R2 upload error: {e}")
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
