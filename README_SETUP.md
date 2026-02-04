# Supabase Setup Instructions

This guide will help you set up Supabase for the checklist app with Google authentication and cloud storage.

## Step 1: Create a Supabase Project

1. Go to [https://supabase.com](https://supabase.com) and sign up/login
2. Click "New Project"
3. Fill in:
   - **Name**: Choose a project name (e.g., "checklist-app")
   - **Database Password**: Create a strong password (save it!)
   - **Region**: Choose the closest region to you
4. Click "Create new project" and wait for it to initialize (takes ~2 minutes)

## Step 2: Get Your API Credentials

1. In your Supabase project dashboard, go to **Settings** → **API**
2. Copy the following values:
   - **Project URL** (under "Project URL")
   - **anon/public key** (under "Project API keys" → "anon public")

3. Open `config.js` in this project and replace:
   - `YOUR_SUPABASE_URL` with your Project URL
   - `YOUR_SUPABASE_ANON_KEY` with your anon/public key

## Step 3: Create the Database Table

1. In your Supabase dashboard, go to **SQL Editor**
2. Click "New query"
3. Paste the following SQL and click "Run":

```sql
-- Create checklists table
CREATE TABLE checklists (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  content TEXT NOT NULL,
  last_modified TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, name)
);

-- Enable Row Level Security
ALTER TABLE checklists ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own checklists
CREATE POLICY "Users can view own checklists" ON checklists
  FOR SELECT USING (auth.uid() = user_id);

-- Policy: Users can insert their own checklists
CREATE POLICY "Users can insert own checklists" ON checklists
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own checklists
CREATE POLICY "Users can update own checklists" ON checklists
  FOR UPDATE USING (auth.uid() = user_id);

-- Policy: Users can delete their own checklists
CREATE POLICY "Users can delete own checklists" ON checklists
  FOR DELETE USING (auth.uid() = user_id);
```

## Step 4: Enable Google OAuth

1. In your Supabase dashboard, go to **Authentication** → **Providers**
2. Find **Google** in the list and click on it
3. Toggle "Enable Google provider" to ON
4. You'll need to create OAuth credentials in Google Cloud Console:
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project or select existing one
   - Enable Google+ API
   - Go to **Credentials** → **Create Credentials** → **OAuth client ID**
   - Application type: **Web application**
   - Authorized redirect URIs: Add your Supabase redirect URL
     - Format: `https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback`
     - You can find this in Supabase under Authentication → URL Configuration
   - Copy the **Client ID** and **Client Secret**
5. Back in Supabase, paste:
   - **Client ID (for OAuth)**: Your Google OAuth Client ID
   - **Client Secret (for OAuth)**: Your Google OAuth Client Secret
6. Click "Save"

## Step 5: Configure Redirect URLs

1. In Supabase dashboard, go to **Authentication** → **URL Configuration**
2. Under "Redirect URLs", add:
   - `http://localhost` (for local development)
   - Your production URL (e.g., `https://yourdomain.com`)
3. Click "Save"

## Step 6: Test the Setup

1. Open `index.html` in your browser
2. Click the hamburger menu (☰) in the top-left
3. Click "Sign in with Google"
4. Complete the Google sign-in flow
5. Your checklists should now sync to the cloud!

## Troubleshooting

- **"Invalid API key"**: Double-check your `config.js` file has the correct values
- **"OAuth error"**: Verify your Google OAuth credentials and redirect URLs match
- **"RLS policy violation"**: Make sure you ran all the SQL policies from Step 3
- **Checklists not syncing**: Check browser console for errors and verify you're signed in

## Security Notes

- The `anon` key is safe to use in client-side code (it's public)
- Row Level Security (RLS) ensures users can only access their own data
- Never commit your `config.js` with real credentials to public repositories
- Consider using environment variables for production deployments
