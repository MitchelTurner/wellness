# ClinTrack

Privacy-first PWA for tracking mood, somatic symptoms and functional impact, and producing a one-page clinical summary for your doctor. Sign-in is required. The first visit creates the only account. Check-ins, episodes, screeners, and the name on the summary are stored in IndexedDB and in `data/clintrack.sqlite` for that account. Charts and the summary use only the entries you save.

```
npm install
npm run dev     # development
npm run build && npm start   # production (enables offline service worker)
```

Pages: Check-In, Episodes (acute event logger), Screeners (PHQ-9 / GAD-7), Trends, Summary (print / Save as PDF), Settings (password, patient name, medications, daily reminder, sleep from phone activity, JSON export/import).

Sleep guesses stay on this phone. They come from the screen locking, the phone sitting still, or a long stretch with no activity in ClinTrack, and nothing is uploaded until you save the hours on a check-in. The daily reminder sends a notification at the time you choose if you have not checked in yet. Allowing notifications stores a push address for this browser so the note can arrive while the app is closed. The note only says it is time to check in.
