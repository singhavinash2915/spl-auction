# Supabase Setup Guide for SPL Auction

This guide will help you set up real-time sync for the SPL Auction app using Supabase.

## Step 1: Create a Supabase Account

1. Go to [https://supabase.com](https://supabase.com)
2. Click "Start your project" and sign up (free tier is sufficient)
3. Create a new project (choose any name and a strong database password)
4. Wait for the project to be created (takes ~2 minutes)

## Step 2: Create Database Tables

Go to **SQL Editor** in your Supabase dashboard and run this SQL:

```sql
-- Create players table
CREATE TABLE players (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    "flatNo" TEXT,
    role TEXT,
    "battingStyle" TEXT,
    "bowlingStyle" TEXT,
    "basePrice" INTEGER DEFAULT 30000,
    status TEXT DEFAULT 'available',
    "soldTo" INTEGER,
    "soldPrice" INTEGER,
    photo TEXT,
    "cricHeroesUrl" TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create teams table
CREATE TABLE teams (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    "shortName" TEXT,
    color TEXT,
    logo TEXT,
    budget INTEGER DEFAULT 1000000,
    "maxPlayers" INTEGER DEFAULT 7,
    players JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security (RLS) but allow public access for this app
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;

-- Create policies to allow public read/write (for auction app)
CREATE POLICY "Allow public read access on players" ON players FOR SELECT USING (true);
CREATE POLICY "Allow public insert access on players" ON players FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access on players" ON players FOR UPDATE USING (true);
CREATE POLICY "Allow public delete access on players" ON players FOR DELETE USING (true);

CREATE POLICY "Allow public read access on teams" ON teams FOR SELECT USING (true);
CREATE POLICY "Allow public insert access on teams" ON teams FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access on teams" ON teams FOR UPDATE USING (true);
CREATE POLICY "Allow public delete access on teams" ON teams FOR DELETE USING (true);

-- Enable realtime for both tables
ALTER PUBLICATION supabase_realtime ADD TABLE players;
ALTER PUBLICATION supabase_realtime ADD TABLE teams;
```

## Step 3: Get Your API Credentials

1. Go to **Project Settings** > **API** in your Supabase dashboard
2. Copy the following values:
   - **Project URL** (looks like `https://xyzcompany.supabase.co`)
   - **anon/public key** (a long JWT token starting with `eyJ...`)

## Step 4: Configure the App

1. Open `js/supabase-config.js`
2. Replace the placeholder values:

```javascript
const SUPABASE_URL = 'https://YOUR_PROJECT_ID.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6...YOUR_KEY_HERE';
const SUPABASE_ENABLED = true;  // Change to true
```

3. Commit and push the changes to GitHub

## Step 5: Initialize Data

When you first load the app with Supabase enabled:
1. The app will detect empty Supabase tables
2. It will load data from local JSON files
3. It will automatically sync this data to Supabase
4. All users will now see the same data!

## How It Works

- **Real-time Sync**: When admin makes changes (sells player, adds player, etc.), all connected browsers update instantly
- **Fallback**: If Supabase is unavailable, the app falls back to localStorage
- **Status Indicator**: Look for the sync status in the top bar:
  - 🟢 **Live Sync** - Connected and syncing
  - 🟡 **Syncing...** - Saving changes
  - 🔴 **Sync Error** - Connection issue
  - ⚫ **Local Only** - Supabase not configured

## Troubleshooting

### Data not syncing?
1. Check browser console for errors (F12 > Console)
2. Verify your Supabase credentials are correct
3. Make sure `SUPABASE_ENABLED = true`

### Need to reset data?
1. Go to Supabase > Table Editor
2. Delete all rows from `players` and `teams` tables
3. Clear browser localStorage
4. Reload the app - it will re-sync from JSON files

## Free Tier Limits

Supabase free tier includes:
- 500 MB database storage
- 2 GB bandwidth
- 50,000 monthly active users
- Real-time subscriptions

This is more than enough for the SPL Auction!
