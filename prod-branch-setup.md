# Production Branch Setup

This file documents the creation of the prod branch for production deployments.

The prod branch will trigger ci-prod.yml workflow for production deployments to:
- Stack: prod
- API URL: https://api.alphogen.com
- Pages Project: alphogenai-app

## Branch Creation
```bash
git checkout main
git checkout -b prod
git push origin prod
```

This ensures proper separation between staging (main branch) and production (prod branch) environments.
