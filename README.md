# ClinTrack

Privacy-first PWA for tracking mood, somatic symptoms and functional impact, and producing a one-page clinical summary for your doctor. Screeners and settings stay on-device in IndexedDB (Dexie). Check-ins and episodes are stored there and in a SQLite database at `data/clintrack.sqlite`. Thirty days of mock data are seeded on first launch.

```
npm install
npm run dev     # development
npm run build && npm start   # production (enables offline service worker)
```

Pages: Check-In, Episodes (acute event logger), Screeners (PHQ-9 / GAD-7), Trends, Summary (print / Save as PDF), Settings (patient name, JSON export/import).
