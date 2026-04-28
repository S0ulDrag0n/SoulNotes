# Manual Test Plan - Phase 4 & Phase 5

This document provides step-by-step manual testing procedures for Phase 4 (Adaptive Learning) and Phase 5 (Anki Export, Pronunciation Practice, Backup/Restore, Settings) features.

---

## Phase 4: Adaptive Learning

### 4.1 Learning Profile Service

**Prerequisites:**
- Application running with a valid license
- At least one conversation completed

**Test Steps:**

1. **View Learning Profile**
   - Navigate to Dashboard (`/dashboard`)
   - Verify Learning Profile Card is displayed
   - Check that it shows:
     - Grammar weaknesses section
     - Vocabulary gaps section
     - Pronunciation issues section
   - Verify each section shows relevant data from conversations

2. **Grammar Weakness Tracking**
   - Start a conversation and intentionally make grammar mistakes
   - End the conversation
   - Navigate to Dashboard
   - Verify grammar mistakes appear in Learning Profile under Grammar Weaknesses
   - Check that category is correctly identified (verb-tense, articles, word-order, etc.)

3. **Vocabulary Gap Tracking**
   - During conversation, use "Mark as Unknown" on vocabulary words
   - End the conversation
   - Navigate to Dashboard
   - Verify vocabulary gaps are shown with priority levels

4. **Pronunciation Issue Tracking**
   - Complete pronunciation practice (see Phase 5 tests)
   - Navigate to Dashboard
   - Verify pronunciation issues are tracked

### 4.2 Practice Recommendations

**Test Steps:**

1. **View Recommendations**
   - Navigate to Dashboard
   - Locate Practice Recommendations component
   - Verify three tabs: Grammar, Vocabulary, Pronunciation

2. **Grammar Recommendations**
   - Click on Grammar tab
   - Verify each recommendation shows:
     - Category name
     - Error count
     - "Practice" button
   - Click "Practice" button
   - Verify it starts a practice session focused on that grammar area

3. **Vocabulary Recommendations**
   - Click on Vocabulary tab
   - Verify each recommendation shows:
     - Word
     - Translation
     - Priority level
     - "Practice" button
   - Click "Practice" button
   - Verify flashcard review starts with that word

4. **Pronunciation Recommendations**
   - Click on Pronunciation tab
   - Verify each recommendation shows:
     - Word/phrase
     - Issue type
     - "Practice" button
   - Click "Practice" button
   - Verify pronunciation practice starts

### 4.3 Weekly Progress Chart

**Test Steps:**

1. **View Weekly Progress**
   - Navigate to Dashboard
   - Locate Weekly Progress Chart
   - Verify it shows:
     - XP earned per day (bar chart)
     - Words learned per day
     - Conversations completed per day
   - Check that data is accurate for the current week

2. **Historical Data**
   - Complete activities across multiple days
   - Verify chart updates correctly
   - Check that hovering over bars shows detailed information

### 4.4 Adaptive Practice Hook

**Test Steps:**

1. **Start Practice Session**
   - Use `useAdaptivePractice` hook
   - Call `startPracticeSession(language, type)`
   - Verify session is created with correct type

2. **Get Recommendations**
   - Call `getRecommendations(language)`
   - Verify recommendations are returned based on learning profile

3. **End Practice Session**
   - Complete practice activities
   - Call `endPracticeSession()`
   - Verify session is properly closed and stats recorded

---

## Phase 5: Anki Export, Pronunciation, Backup, Settings

### 5.1 Anki Export

**Prerequisites:**
- Vocabulary deck with words added
- At least one language deck created

**Test Steps:**

1. **Export Deck to Anki**
   - Navigate to Flashcards page (`/flashcards`)
   - Select a deck to export
   - Click "Export to Anki" button (if implemented in UI)
   - Alternatively, use the `useAnkiExport` hook programmatically:
     ```typescript
     const { exportDeck } = useAnkiExport();
     const blob = await exportDeck(deckId, 'My Deck');
     ```
   - Verify .apkg file is downloaded
   - Open Anki desktop application
   - Import the .apkg file
   - Verify cards appear correctly with:
     - Front (word)
     - Back (translation)
     - Audio (if available)

2. **Verify Export Progress**
   - Check that progress indicator shows during export
   - Verify error handling for empty decks
   - Test with large decks (100+ cards)

### 5.2 Pronunciation Practice

**Test Steps:**

1. **Access Pronunciation Page**
   - Navigate to `/pronunciation`
   - Verify page loads with:
     - Language selector
     - Custom words input (optional)
     - "Start Practice" button

2. **Start Practice Session**
   - Select a language (e.g., English)
   - Click "Start Practice"
   - Verify practice session starts with sample words
   - Check that current word is displayed prominently

3. **Custom Words**
   - Enter custom words (comma-separated)
   - Click "Start Practice"
   - Verify session uses custom words instead of defaults

4. **Listen to Word**
   - Click "Listen" button
   - Verify TTS plays the word
   - Click "Slow" button
   - Verify word plays at slower speed

5. **Record Pronunciation**
   - Click "Record" button
   - Allow microphone access if prompted
   - Speak the word
   - Click "Stop Recording"
   - Verify recording is analyzed
   - Check that feedback is displayed:
     - Overall score
     - Accuracy, Fluency, Completeness percentages
     - Issues list (if any)
     - Suggestions (if any)

6. **Navigate Words**
   - Click "Next" button
   - Verify next word is shown
   - Click "Previous" button
   - Verify previous word is shown
   - Check that progress bar updates

7. **End Session**
   - Click "End Session"
   - Verify session summary shows:
     - Words mastered
     - Words attempted
     - Total attempts
     - Average score
   - Check that pronunciation issues are saved to learning profile

### 5.3 Backup and Restore

**Test Steps:**

1. **Create Backup**
   - Navigate to Settings (`/settings`)
   - Scroll to "Data Management" section
   - Click "Download Backup"
   - Verify .zip file is downloaded
   - Extract zip and verify contents:
     - metadata.json
     - profiles.json
     - decks.json
     - items.json
     - flashcards.json
     - userProgress.json
     - achievements.json
     - settings.json

2. **Restore from Backup**
   - Make some changes to data (add vocabulary, etc.)
   - Go to Settings > Data Management
   - Click "Restore from Backup"
   - Select the backup .zip file
   - Verify restore result shows:
     - Profiles restored count
     - Decks restored count
     - Items restored count
     - Flashcards restored count
     - User progress restored status
     - Achievements restored count
     - Settings restored status
   - Check that data matches the backup

3. **Export Vocabulary CSV**
   - Go to Settings > Data Management
   - Click "Export to CSV"
   - Verify .csv file is downloaded
   - Open in spreadsheet application
   - Verify columns: word, translation, language, context, created_at

4. **Error Handling**
   - Try to restore an invalid file
   - Verify error message is shown
   - Try to restore corrupted zip
   - Verify appropriate error handling

### 5.4 Settings Page

**Test Steps:**

1. **Access Settings**
   - Navigate to `/settings`
   - Verify page loads with all sections:
     - Appearance
     - Language
     - Data Management
     - Preferences
     - About

2. **Theme Toggle**
   - Find "Dark Mode" toggle
   - Click to enable dark mode
   - Verify UI switches to dark theme
   - Click again to disable
   - Verify UI switches to light theme
   - Check that preference is persisted (refresh page)

3. **Language Settings**
   - Select different interface language
   - Verify selection is saved
   - Check that preference persists after refresh

4. **Preferences**
   - Toggle "Auto-save Transcripts"
   - Verify setting is saved
   - Toggle "Notifications"
   - Verify setting is saved

5. **About Section**
   - Verify version number is displayed
   - Check that app description is correct

---

## Integration Tests

### Phase 4 + Phase 5 Integration

**Test Steps:**

1. **Learning Profile to Pronunciation Practice**
   - Complete pronunciation practice with errors
   - Navigate to Dashboard
   - Verify pronunciation issues appear in Learning Profile
   - Click "Practice" on a pronunciation recommendation
   - Verify it navigates to pronunciation practice with that word

2. **Vocabulary to Anki Export**
   - Add vocabulary through conversation
   - Navigate to Flashcards
   - Verify words appear in deck
   - Export deck to Anki
   - Import in Anki and verify all words are present

3. **Backup Full Cycle**
   - Create vocabulary, complete conversations, earn achievements
   - Create backup
   - Clear browser data (IndexedDB, localStorage)
   - Restore from backup
   - Verify all data is restored:
     - Vocabulary decks and items
     - Learning profiles
     - Gamification progress
     - Settings

---

## Edge Cases

### Phase 4 Edge Cases

1. **Empty Learning Profile**
   - New user with no conversations
   - Verify Dashboard shows empty state
   - Verify Practice Recommendations show helpful message

2. **Large Data Volume**
   - User with 100+ grammar errors
   - Verify Learning Profile Card handles large lists
   - Check performance of recommendations

### Phase 5 Edge Cases

1. **Empty Deck Export**
   - Try to export deck with no cards
   - Verify appropriate error message

2. **No Microphone Access**
   - Deny microphone permission
   - Try to record pronunciation
   - Verify error message is shown

3. **Large Backup File**
   - Create backup with lots of data
   - Verify download completes
   - Test restore with large file

4. **Corrupted Backup**
   - Create invalid zip file
   - Try to restore
   - Verify error handling

---

## Browser Compatibility

Test all features in:
- [ ] Chrome
- [ ] Firefox
- [ ] Safari
- [ ] Edge

---

## Mobile Responsiveness

Test all pages on mobile viewport:
- [ ] Dashboard (Phase 4)
- [ ] Pronunciation Practice (Phase 5)
- [ ] Settings (Phase 5)

---

## Test Results Template

| Feature | Test Case | Status | Notes |
|---------|-----------|--------|-------|
| 4.1 Learning Profile | View Profile | ⬜ | |
| 4.1 Learning Profile | Grammar Tracking | ⬜ | |
| 4.1 Learning Profile | Vocabulary Gaps | ⬜ | |
| 4.2 Recommendations | Grammar Tab | ⬜ | |
| 4.2 Recommendations | Vocabulary Tab | ⬜ | |
| 4.2 Recommendations | Pronunciation Tab | ⬜ | |
| 4.3 Weekly Progress | Chart Display | ⬜ | |
| 5.1 Anki Export | Export Deck | ⬜ | |
| 5.1 Anki Export | Import in Anki | ⬜ | |
| 5.2 Pronunciation | Start Session | ⬜ | |
| 5.2 Pronunciation | Listen/Slow | ⬜ | |
| 5.2 Pronunciation | Record & Analyze | ⬜ | |
| 5.2 Pronunciation | Navigate Words | ⬜ | |
| 5.2 Pronunciation | End Session | ⬜ | |
| 5.3 Backup | Create Backup | ⬜ | |
| 5.3 Backup | Restore Backup | ⬜ | |
| 5.3 Backup | Export CSV | ⬜ | |
| 5.4 Settings | Theme Toggle | ⬜ | |
| 5.4 Settings | Language | ⬜ | |
| 5.4 Settings | Preferences | ⬜ | |