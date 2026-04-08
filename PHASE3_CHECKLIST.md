# Phase 3 Checklist

## Priority 1: End-to-End Learning Loop

- [x] Fetch live tree data from SQLite for the selected profile
- [x] Create/select local profiles from the frontend
- [x] Trigger lesson generation from the UI
- [x] Replace blocking lesson jobs with streamed lesson rendering
- [x] Show a warmup game only while waiting for the first lesson token
- [x] Save and display generated lesson content in the frontend
- [x] Refresh tree progress after lesson completion
- [x] Load recent saved lessons per profile

## Priority 2: Child-Facing Experience

- [x] Add a profile switcher UI with large touch-friendly targets
- [x] Add a recent lessons panel
- [x] Add vocabulary chips with tap-to-speak behavior
- [x] Add a dedicated full lesson reading view instead of only the side panel
- [x] Add stronger keyboard and switch-access support for leaf navigation

## Priority 3: AI and Curriculum Expansion

- [x] Generate new leaves dynamically from the local Ollama lesson engine and persist them
- [x] Add layout generation for newly created leaves and branches
- [x] Replace multi-agent lesson generation with a single-model streaming Ollama pipeline
- [x] Add timeout and offline-health handling around Ollama
- [ ] Add stronger retry and recovery handling for interrupted lesson streams

## Priority 4: Tree World and Progression

- [ ] Extend the tree toward a true infinite canopy instead of a finite seeded layout
- [ ] Add branch/grade expansion as mastery increases
- [ ] Add animations for leaf color transitions and lesson completion

## Priority 5: Quality and Operations

- [ ] Add backend API tests
- [ ] Add frontend component and interaction tests
- [ ] Add migration tooling for SQLite schema changes
- [ ] Add one-command local setup and run scripts
