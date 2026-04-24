-- LogicHub Database Schema

-- apps
CREATE TABLE IF NOT EXISTS apps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    tagline TEXT,
    description TEXT,
    download_url TEXT,
    thumbnail_url TEXT,
    zayvora BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- stats
CREATE TABLE IF NOT EXISTS stats (
    app_id UUID REFERENCES apps(id) ON DELETE CASCADE,
    downloads INT DEFAULT 0,
    downloads_24h INT DEFAULT 0,
    trend_score FLOAT DEFAULT 0.0,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ai_content
CREATE TABLE IF NOT EXISTS ai_content (
    app_id UUID REFERENCES apps(id) ON DELETE CASCADE,
    repo_url TEXT,
    summary TEXT,
    features JSONB,
    share_text TEXT
);

-- Create index for trending
CREATE INDEX IF NOT EXISTS idx_trend_score ON stats(trend_score DESC);
