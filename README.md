# The Snail

A location-based multiplayer game where players send snails to each other's home bases. Snails travel in real-time across Singapore, and players can intercept or receive snails from other players.

## Overview

The Snail is a geolocation-based strategy game built with React, Vite, and Supabase. Players set up a home base within Singapore, deploy snails to travel to other players' locations, and manage their salt currency and snail inventory.

**Key Architecture**: Snail movement is calculated entirely on the client-side using timestamps and paths. No backend servers needed for movement updates - the database only stores the route, start time, and end time.

### Core Concepts

- **Home Base**: A 1km radius location in Singapore where your snails start and end their journeys
- **Snails**: Virtual creatures that travel between players' home bases along pre-calculated paths
- **Fixed Journey Duration**: Every deployment lasts exactly 48 hours, so players weigh risk vs. reward by deciding where to drop a snail rather than how fast it travels
- **Salt**: In-game currency earned from successful snail deliveries
- **Journey Status**: Snails can be moving, intercepted, or arrived
- **Client-Side Rendering**: Snail positions calculated in real-time by the client using stored path and timestamp data

## Tech Stack

### Frontend
- **React 19** - UI framework
- **TypeScript** - Type-safe development
- **Vite** - Fast build tool and dev server
- **Wouter** - Lightweight routing
- **Tailwind CSS** - Utility-first styling
- **Mapbox GL JS** - Interactive maps
- **Radix UI** - Accessible component primitives
- **Sonner** - Toast notifications

### Backend
- **Supabase** - Backend-as-a-Service
  - PostgreSQL database with PostGIS extension
  - Authentication
  - Row Level Security
  - Real-time subscriptions

## File Structure

```
The-Snail/
├── client/                          # Frontend application
│   ├── public/                      # Static assets
│   │   ├── avatar.png
│   │   └── manifest.json
│   ├── src/
│   │   ├── _core/                   # Core utilities
│   │   │   └── hooks/
│   │   │       └── useAuth.ts       # Authentication hook
│   │   ├── components/              # React components
│   │   │   ├── ui/                  # Reusable UI components (buttons, inputs, etc.)
│   │   │   ├── BottomNav.tsx        # Mobile navigation bar
│   │   │   ├── ErrorBoundary.tsx    # Error handling wrapper
│   │   │   ├── GameWidget.tsx       # Game UI elements
│   │   │   ├── MapboxMap.tsx        # Map component wrapper
│   │   │   └── ...
│   │   ├── contexts/
│   │   │   └── ThemeContext.tsx     # Theme management
│   │   ├── hooks/                   # Custom React hooks
│   │   │   ├── useProfile.ts        # User profile management
│   │   │   ├── useSnails.ts         # Snail data management
│   │   │   └── ...
│   │   ├── lib/                     # Library code
│   │   │   ├── database.types.ts    # TypeScript types for Supabase
│   │   │   ├── supabase.ts          # Supabase client configuration
│   │   │   └── utils.ts             # Utility functions
│   │   ├── pages/                   # Page components
│   │   │   ├── Login.tsx            # Login/signup page
│   │   │   ├── MapTab.tsx           # Main map view
│   │   │   ├── DeployTab.tsx        # Deploy snails interface
│   │   │   ├── ProfileTab.tsx       # User profile page
│   │   │   └── NotFound.tsx         # 404 page
│   │   ├── App.tsx                  # Root component with routing
│   │   ├── main.tsx                 # Application entry point
│   │   └── index.css                # Global styles
│   └── index.html                   # HTML template
├── shared/                          # Shared code between client/server
│   ├── _core/
│   │   └── errors.ts                # Error definitions
│   ├── const.ts                     # Constants
│   ├── ghostMovement.ts             # Snail movement logic
│   └── types.ts                     # Shared TypeScript types
├── patches/                         # npm package patches
├── package.json                     # Dependencies and scripts
├── vite.config.ts                   # Vite configuration
├── tsconfig.json                    # TypeScript configuration
└── components.json                  # Shadcn UI configuration
```

## How It Works

### 1. Authentication Flow

```
User visits app → Login page → Sign up/Sign in → Profile created → Home base setup → Dashboard
```

- Authentication handled by Supabase Auth
- On signup, a profile is automatically created in the `profiles` table
- Users must set a home base location before accessing the main app

### 2. Database Schema

#### Profiles Table
```sql
CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  salt_balance INT DEFAULT 500,
  snail_inventory INT DEFAULT 3,
  home_location GEOGRAPHY(POINT),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

#### Snails Table
```sql
CREATE TABLE public.snails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID REFERENCES public.profiles(id) NOT NULL,
  target_id UUID REFERENCES public.profiles(id) NOT NULL,
  path_json JSONB NOT NULL,           -- Array of [lng, lat] coordinates
  start_time TIMESTAMPTZ DEFAULT now(),
  arrival_time TIMESTAMPTZ NOT NULL,
  status TEXT DEFAULT 'moving' NOT NULL  -- 'moving', 'intercepted', 'arrived'
);
```

### 3. App Flow

#### Route Protection
`App.tsx` implements protected routes:
- Unauthenticated users → redirected to `/login`
- Authenticated users without home base → redirected to `/setup-home-base`
- Authenticated users with home base → access to all features

#### Main Tabs
1. **Map Tab** (`/`) - View snails on map, see other players
2. **Deploy Tab** (`/deploy`) - Send snails to other players
3. **Profile Tab** (`/profile`) - View stats and settings

### 4. Key Features

#### Snail Deployment & Movement
- Players select a friend and then click on the map to choose a drop site at least 5km from that friend's 1km-radius home base
- Walking routes are fetched from the free OSRM foot router (OpenStreetMap) so snails hug sidewalks and other pedestrian paths
- Travel time is always 48 hours; distance only affects the rendered route and interception opportunities
- Snail data stored in database with:
  - `path_json`: Array of [lng, lat] coordinates
  - `start_time`: When the journey began
  - `arrival_time`: When the journey will complete
  - `status`: Current state (moving, intercepted, arrived)

#### Client-Side Movement Rendering
**No backend server needed for snail movement!** The client handles all movement calculations:

1. **Fetch snails**: Client fetches all snails related to the user (sent or received)
2. **Calculate position**: Using `start_time`, `arrival_time`, and `path_json`, the client calculates current position in real-time
3. **Check arrival**: Client checks if current time >= `arrival_time` for both own snails and incoming snails
4. **Update status**: When arrived, client updates the database status from 'moving' to 'arrived'

This approach eliminates the need for:
- Background jobs or cron tasks
- Server-side position updates
- Complex real-time tracking infrastructure

The movement is purely mathematical - given the start time, end time, and path, the client can determine exactly where a snail should be at any moment.

#### Lazy Checking System (Optional)
A PostgreSQL function can sync snail statuses on user login as a backup:
```sql
CREATE OR REPLACE FUNCTION check_and_sync_snails()
RETURNS void AS $$
BEGIN
  UPDATE public.snails
  SET status = 'arrived'
  WHERE status = 'moving'
  AND now() >= arrival_time;
END;
$$ LANGUAGE plpgsql;
```

#### Geographic Features
- Uses PostGIS extension for geographic calculations
- Home locations stored as GEOGRAPHY(POINT) type
- 1km radius zones for home bases
- Singapore boundary validation

### 5. State Management

#### Custom Hooks Pattern
- `useAuth()` - Manages authentication state
- `useProfile()` - Handles user profile CRUD operations
- `useSnails()` - Manages snail data and real-time updates

#### Real-time Updates
Supabase real-time subscriptions for:
- New snails deployed to you (instant notifications)
- Snail status changes (interceptions, manual updates)
- Profile updates (salt balance, inventory changes)

Note: Snail movement itself doesn't use real-time subscriptions - it's calculated client-side based on timestamps and path data.

## Setup Instructions

### Prerequisites
- Node.js 18+ 
- npm or pnpm
- Supabase account
- Mapbox account

### 1. Clone and Install
```bash
git clone <repository-url>
cd The-Snail
npm install
```

### 2. Environment Variables
Create a `.env` file in the root directory:
```env
VITE_MAPBOX_TOKEN=your_mapbox_token
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 3. Database Setup

Run this SQL in your Supabase SQL Editor:

```sql
-- Enable PostGIS
CREATE EXTENSION IF NOT EXISTS postgis;

-- Create Profiles Table
CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  salt_balance INT DEFAULT 500,
  snail_inventory INT DEFAULT 3,
  home_location GEOGRAPHY(POINT),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create Snails Table
CREATE TABLE public.snails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID REFERENCES public.profiles(id) NOT NULL,
  target_id UUID REFERENCES public.profiles(id) NOT NULL,
  path_json JSONB NOT NULL,
  start_time TIMESTAMPTZ DEFAULT now(),
  arrival_time TIMESTAMPTZ NOT NULL,
  status TEXT DEFAULT 'moving' NOT NULL,
  CONSTRAINT valid_timing CHECK (arrival_time > start_time)
);

-- Enable Realtime
ALTER TABLE public.snails REPLICA IDENTITY FULL;

-- Create Lazy Check Function
CREATE OR REPLACE FUNCTION check_and_sync_snails()
RETURNS void AS $$
BEGIN
  UPDATE public.snails
  SET status = 'arrived'
  WHERE status = 'moving'
  AND now() >= arrival_time;
END;
$$ LANGUAGE plpgsql;

-- Row Level Security for Snails
ALTER TABLE public.snails ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own involved snails" 
ON public.snails FOR SELECT 
USING (auth.uid() = sender_id OR auth.uid() = target_id);

-- Row Level Security for Profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own profile" 
ON public.profiles FOR SELECT 
USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile" 
ON public.profiles FOR INSERT 
WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile" 
ON public.profiles FOR UPDATE 
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);
```

### 4. Supabase Auth Configuration

In your Supabase Dashboard:
1. Go to **Authentication → Providers → Email**
2. Disable "Confirm email" if you don't want email verification
3. Set redirect URLs if needed

### 5. Run Development Server
```bash
npm run dev
```

Visit `http://localhost:5173`

## Development

### Available Scripts
- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run check` - Type check without emitting files
- `npm run format` - Format code with Prettier

### Adding UI Components
This project uses Shadcn UI. To add new components:
```bash
npx shadcn-ui@latest add <component-name>
```

## Architecture Decisions

### Why Wouter over React Router?
- Lightweight (1.5KB vs 10KB+)
- Simple API perfect for this app's routing needs
- Hook-based API matches React patterns

### Why Supabase?
- Built-in authentication
- PostgreSQL with PostGIS for geographic queries
- Real-time subscriptions for new snail notifications
- Row Level Security for data access control
- No need for separate backend server - database handles everything

### Why Mapbox?
- Superior cartography and styling
- Excellent performance with vector tiles
- Built-in support for geographic calculations

## Future Enhancements

- [ ] Snail interception mechanics
- [ ] Salt rewards system implementation
- [ ] Leaderboards
- [ ] Push notifications for snail arrivals
- [ ] Snail customization
- [ ] Multiple snail types with different speeds
- [ ] Achievement system

## Contributing

Please read the project rules in `CLAUDE.md` before contributing.

## License

MIT
