INSERT INTO public.users (id, email, password_hash, created_at, updated_at) VALUES
    ('550e8400-e29b-41d4-a716-446655440000', 'test@example.com', '$2a$10$N9qo8uLOickgx2ZMRZoMye.IjPeGvGzjYwSxp6BwL6Dh9kqd9S.mO', NOW(), NOW())
ON CONFLICT (email) DO NOTHING;

INSERT INTO public.jobs (id, user_id, prompt, status, created_at, updated_at) VALUES
    ('550e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440000', 'Create a video about AI technology', 'queued', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;
