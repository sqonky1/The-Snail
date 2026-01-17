# The Snail - Project TODO

## Phase 1: Project Setup
- [x] Initialize GitHub repository
- [x] Configure project dependencies (Mapbox GL JS, polyline decoder, Supabase client)
- [x] Set up color palette and design tokens in Tailwind config

## Phase 2: Backend & Database
- [x] Create Supabase database schema (profiles, snails tables)
- [x] Set up tRPC procedures for user profile management
- [x] Set up tRPC procedures for snail deployment
- [x] Set up tRPC procedures for snail capture
- [x] Set up tRPC procedures for friend management
- [ ] Implement home zone initialization logic

## Phase 3: Core Map Integration
- [x] Install and configure Mapbox GL JS
- [x] Implement monochromatic tactical map styling
- [x] Set up real-time GPS tracking with geolocation API
- [x] Render user position as red dot
- [x] Render home zone as blue circle (1km radius)
- [x] Implement Haversine distance calculation utility

## Phase 4: Ghost Movement System
- [x] Install Google Polyline decoder library
- [x] Implement ghost interpolation logic (progress calculation)
- [x] Render solid trails for past snail movement
- [x] Render dotted trails for future snail projections
- [ ] Color-code trails (orange for incoming, blue for outgoing)
- [ ] Render friend bases as purple circles

## Phase 5: UI Components & Navigation
- [x] Create bottom navigation bar with three tabs
- [x] Configure Lucide icons (Home, Snail, User)
- [x] Apply Inter font and color palette
- [x] Create widget component with 10px radius and drop shadow

## Phase 6: Map Tab
- [x] Full-screen map view with all elements
- [x] Real-time GPS position updates
- [x] Capture detection (<15m from snail)
- [x] Floating "SALT IT" button when in range
- [ ] Long-press deployment trigger (>4km from home)
- [ ] Deployment modal with target selection

## Phase 7: Deploy Tab
- [x] Friends list section with avatars
- [x] Add friend button (+)
- [x] Your Snails section
- [x] Active snail progress bars (% of 48h)
- [x] Snail destination display

## Phase 8: Base/Profile Tab
- [x] User profile header with avatar and name
- [x] Salt Balance widget
- [x] Snails inventory widget
- [x] Home zone map preview
- [x] Edit home zone button

## Phase 9: Game Mechanics
- [ ] Deployment validation (>4km from home)
- [ ] Capture validation (user GPS <15m from snail)
- [ ] Breach detection (currentTime > startTime + 48h)
- [ ] Salt reward system
- [ ] Snail status updates

## Phase 10: PWA Configuration
- [x] Create PWA manifest.json
- [ ] Configure service worker for offline capability
- [x] Add app icons and splash screens
- [ ] Test PWA installation on mobile

## Phase 11: Testing & Deployment
- [x] Write vitest tests for backend procedures
- [ ] Test GPS tracking accuracy
- [ ] Test ghost movement interpolation
- [ ] Test capture and breach mechanics
- [x] Create deployment checkpoint

## Bug Fixes
- [x] Fix Mapbox color format (convert OKLCH to hex/rgba)
- [x] Fix geolocation error handling and permissions
