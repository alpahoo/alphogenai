# AlphoGenAI - AI Video Generation SaaS

AlphoGenAI is a complete SaaS platform for generating stunning 90-second videos from text prompts using cutting-edge AI technology. The platform combines WAN 2.2+ for text-to-video generation, Qwen-TTS for narration, and FFmpeg for professional video composition.

## 🏗️ Architecture

### Frontend (Next.js)
- **Technology**: Next.js 14 with TypeScript and Tailwind CSS
- **Deployment**: Cloudflare Pages
- **Features**: Dark mode UI, responsive design, real-time job status updates
- **Pages**: Landing, Login, Signup, Dashboard, Create, Job Detail

### Backend API (Cloudflare Workers)
- **Technology**: TypeScript with Cloudflare Workers
- **Authentication**: JWT-based auth with bcrypt password hashing
- **Database**: Supabase PostgreSQL for users and jobs
- **Storage**: Cloudflare R2 for video assets
- **Features**: CORS-enabled, RESTful API, webhook support

### Video Generation Runner (Python)
- **Technology**: Python with FastAPI
- **Deployment**: Runpod GPU instances
- **AI Models**: WAN 2.2+ (text-to-video), Qwen-TTS (text-to-speech)
- **Processing**: FFmpeg for video composition and effects
- **Features**: Job polling, progress updates, error handling

## 🚀 Quick Start

### Prerequisites
- Node.js 20+
- Python 3.11+
- Cloudflare account
- Supabase account
- Runpod account (optional)

### Local Development

1. **Clone the repository**
   ```bash
   git clone https://github.com/alpahoo/alphogenai.git
   cd alphogenai
   ```

2. **Setup Frontend**
   ```bash
   cd app
   npm install
   cp .env.example .env.local
   # Edit .env.local with your configuration
   npm run dev
   ```

3. **Setup Workers API**
   ```bash
   cd workers
   npm install
   cp .dev.vars.example .dev.vars
   # Edit .dev.vars with your secrets
   npm run dev
   ```

4. **Setup Python Runner**
   ```bash
   cd runner
   pip install -r requirements.txt
   cp .env.example .env
   # Edit .env with your configuration
   python main.py
   ```

## 📡 API Endpoints

### Authentication
- `POST /api/auth/signup` - Create new user account
- `POST /api/auth/login` - Authenticate user

### Jobs
- `POST /api/jobs` - Create new video generation job
- `GET /api/jobs` - List user's jobs
- `GET /api/jobs/:id` - Get specific job details

### Assets
- `GET /api/assets/:id` - Download video file

### Webhooks
- `POST /api/webhooks/runpod` - Receive job updates from runner

## 🗄️ Database Schema

### Users Table
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR UNIQUE NOT NULL,
  password_hash VARCHAR NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### Jobs Table
```sql
CREATE TABLE jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  prompt TEXT NOT NULL,
  status VARCHAR CHECK (status IN ('queued', 'processing', 'completed', 'failed')),
  result_url VARCHAR,
  error_message TEXT,
  runpod_job_id VARCHAR,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

## 🔧 Environment Variables

### Frontend (.env.local)
```env
NEXT_PUBLIC_API_BASE=https://api.alphogen.com
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### Workers (.dev.vars)
```env
JWT_SECRET=your_jwt_secret
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE=your_supabase_service_role_key
RUNPOD_API_KEY=your_runpod_api_key
RUNPOD_ENDPOINT_ID=your_runpod_endpoint_id
```

### Runner (.env)
```env
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE=your_supabase_service_role_key
WAN_API_KEY=your_wan_api_key
QWEN_API_KEY=your_qwen_api_key
R2_ENDPOINT=your_r2_endpoint
R2_ACCESS_KEY=your_r2_access_key
R2_SECRET_KEY=your_r2_secret_key
R2_BUCKET=alphogenai-assets
```

## 🚀 Deployment

### Cloudflare Workers
```bash
cd workers
wrangler deploy --env prod
```

### Cloudflare Pages
```bash
cd app
npm run build
npx wrangler pages deploy ./out --project-name alphogenai-app
```

### Runpod Runner
```bash
cd runner
# Build and deploy Docker container to Runpod
docker build -t alphogenai-runner .
# Deploy to Runpod using their CLI or dashboard
```

## 🔄 Video Generation Pipeline

1. **User Input**: User submits text prompt via frontend
2. **Job Creation**: API creates job record in database with 'queued' status
3. **Runner Processing**: Python runner polls for queued jobs
4. **Scene Generation**: WAN 2.2+ generates video scenes from prompt
5. **Narration**: Qwen-TTS creates voice narration
6. **Composition**: FFmpeg combines video, audio, and subtitles
7. **Upload**: Final video uploaded to Cloudflare R2
8. **Notification**: Webhook updates job status to 'completed'
9. **Download**: User can download video from dashboard

## 🧪 Testing

### API Testing
```bash
# Health check
curl https://api.alphogen.com/health

# Create account
curl -X POST https://api.alphogen.com/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'

# Create job
curl -X POST https://api.alphogen.com/api/jobs \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"prompt":"A beautiful sunset over mountains"}'
```

### Frontend Testing
1. Visit https://alphogenai-app.pages.dev
2. Create account and login
3. Navigate to Create page
4. Submit video prompt
5. Monitor job progress in Dashboard
6. Download completed video

## 🛠️ Development

### Code Structure
```
alphogenai/
├── app/                 # Next.js frontend
│   ├── src/
│   │   ├── components/  # React components
│   │   ├── lib/         # API client and utilities
│   │   ├── pages/       # Next.js pages
│   │   └── styles/      # CSS styles
├── workers/             # Cloudflare Workers API
│   └── src/
│       └── index.ts     # Main worker code
├── runner/              # Python video generation
│   ├── main.py          # Main runner application
│   ├── requirements.txt # Python dependencies
│   └── Dockerfile       # Container configuration
└── .github/workflows/   # CI/CD pipelines
```

### Contributing
1. Fork the repository
2. Create feature branch
3. Make changes with tests
4. Submit pull request

## 📄 License

MIT License - see LICENSE file for details.

## 🆘 Support

For issues and questions:
- GitHub Issues: https://github.com/alpahoo/alphogenai/issues
- Documentation: See README sections above
- API Status: https://api.alphogen.com/health
# Trigger migrations for new Supabase project abpbvhycqgvgpjvficff
