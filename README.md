# ClinTrack

Privacy-first PWA for tracking mood, somatic symptoms and functional impact, and producing a one-page clinical summary for your doctor. Sign-in is required. The first visit creates the only account. Check-ins, episodes, screeners, and the name on the summary are stored in IndexedDB and in `data/clintrack.sqlite` for that account. Charts and the summary use only the entries you save.

```
npm install
npm run dev     # development
npm run build && npm start   # production (enables offline service worker)
```

Pages: Check-In, Episodes (acute event logger), Screeners (PHQ-9 / GAD-7), Trends, Summary (print / Save as PDF), Settings (password, patient name, medications, daily reminder, JSON export/import).
