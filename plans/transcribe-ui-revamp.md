# Transcribe Meeting UI Revamp Plan

**Status: ✅ COMPLETED**

## Problem Statement

The current transcribe meeting UI has two issues:
1. **Panels grow indefinitely** - TranscriptPanel and OutputPanel can grow long, making it hard to see content
2. **Transcript and Translation are not side-by-side** - They are in separate columns, making it hard to compare what was said vs. the translation

## Current Layout Structure

```
┌─────────────────────────────────────────────────────────────┐
│ Header + StatusBar                                          │
├────────────────────────────┬────────────────────────────────┤
│ CapturePanel               │                                │
├────────────────────────────┤     OutputPanel                │
│ TranscriptPanel            │   [Translation] [Summary]      │
�� (transcript messages)      │   (translation messages OR     │
│ max-h: 45vh/360px          │    summary content)            │
│                            │   max-h: 55vh/520px            │
└────────────────────────────┴────────────────────────────────┘
```

## Proposed New Layout

```
┌─────────────────────────────────────────────────────────────┐
│ Header + StatusBar                                          │
├─────────────────────────────────────────────────────────────┤
│ CapturePanel (full width)                                   │
├────────────────────────────┬────────────────────────────────┤
│ TranscriptPanel            │ TranslationPanel               │
│ [Clear] button             │ [Clear] button                 │
│ (transcript messages)      │ (translation messages)         │
│ max-h: 50vh                │ max-h: 50vh                    │
├────────────────────────────┴────────────────────────────────┤
│ SummaryPanel (collapsible or tab)                           │
│ (summary content)                                           │
└─────────────────────────────────────────────────────────────┘
```

## Key Changes

### 1. Layout Restructure in `page.tsx`

**Before:**
- Two-column grid: `[CapturePanel + TranscriptPanel] | [OutputPanel]`

**After:**
- CapturePanel on top (full width)
- Two-column grid below: `[TranscriptPanel] | [TranslationPanel]`
- SummaryPanel below (or as collapsible section)

### 2. Split OutputPanel into Two Components

Create two separate panel components:
- **TranslationPanel** - Shows translation messages with Clear button
- **SummaryPanel** - Shows summary content (can be collapsible or always visible)

### 3. Add Clear Functionality

Add a "Clear" button to both TranscriptPanel and TranslationPanel:
- Clears all messages
- Resets the state

### 4. State Management Updates

Need to add clear actions to the hooks/stores:
- `clearTranscript()` in `useRealtimeTranscription` hook
- `clearTranslation()` in `useTranslation` hook

## Implementation Steps

### Step 1: Add Clear Functions to Hooks

**File: `src/hooks/useRealtimeTranscription.ts`**
- Add `clearTranscript()` function to reset `transcript` and `transcriptMessages`

**File: `src/hooks/useTranslation.ts`**
- Add `clearTranslation()` function to reset `translation` and `translationMessages`

### Step 2: Update TranscriptPanel Component

**File: `src/components/TranscriptPanel.tsx`**
- Add Clear button next to Save button
- Accept `onClear` callback prop

### Step 3: Create TranslationPanel Component

**File: `src/components/TranslationPanel.tsx` (new file)**
- Extract translation display logic from OutputPanel
- Add Clear button
- Similar structure to TranscriptPanel

### Step 4: Create SummaryPanel Component

**File: `src/components/SummaryPanel.tsx` (new file)**
- Extract summary display logic from OutputPanel
- Can be collapsible or always visible below the transcript/translation row

### Step 5: Update page.tsx Layout

**File: `src/app/page.tsx`**
- Restructure the grid layout
- Place CapturePanel at top (full width)
- Place TranscriptPanel and TranslationPanel side-by-side
- Place SummaryPanel below (or make it collapsible)

### Step 6: Remove or Deprecate OutputPanel

**File: `src/components/OutputPanel.tsx`**
- Can be removed or kept for backward compatibility
- Logic moved to TranslationPanel and SummaryPanel

## Component Props Changes

### TranscriptPanel Props (updated)

```typescript
interface TranscriptPanelProps {
  readonly transcriptMessages: TranscriptMessage[];
  readonly isTranscribing: boolean;
  readonly onSave: () => void;
  readonly onClear: () => void;  // NEW
}
```

### TranslationPanel Props (new)

```typescript
interface TranslationPanelProps {
  readonly translationMessages: TranslationMessage[];
  readonly isTranslating: boolean;
  readonly targetLanguage: string;
  readonly onTargetLanguageChange: (lang: string) => void;
  readonly onSave: () => void;
  readonly onClear: () => void;
}
```

### SummaryPanel Props (new)

```typescript
interface SummaryPanelProps {
  readonly summary: string;
  readonly isSummarizing: boolean;
  readonly onSave: (content: string, filename: string) => void;
}
```

## Visual Design Considerations

1. **Consistent panel heights** - Both TranscriptPanel and TranslationPanel should have the same max-height (e.g., `max-h-[50vh]`)
2. **Synchronized scrolling** - Optional: could add synchronized scrolling between panels
3. **Clear button styling** - Should match existing button styles (rounded-lg, border, etc.)
4. **Responsive design** - On mobile, panels should stack vertically

## Files to Modify

1. `src/app/page.tsx` - Layout restructure
2. `src/components/TranscriptPanel.tsx` - Add Clear button
3. `src/components/OutputPanel.tsx` - Split into TranslationPanel and SummaryPanel (or remove)
4. `src/hooks/useRealtimeTranscription.ts` - Add clearTranscript function
5. `src/hooks/useTranslation.ts` - Add clearTranslation function

## Files to Create

1. `src/components/TranslationPanel.tsx` - New component
2. `src/components/SummaryPanel.tsx` - New component

## Migration Path

1. Add clear functions to hooks (non-breaking)
2. Create new panel components (non-breaking)
3. Update page.tsx to use new layout (breaking change to layout)
4. Remove OutputPanel if no longer needed (cleanup)

## Implementation Summary

All tasks completed successfully:

### Files Modified
- `src/hooks/useRealtimeTranscription.ts` - Added `clearTranscript()` function
- `src/hooks/useTranslation.ts` - Added `clearTranslation()` function
- `src/components/TranscriptPanel.tsx` - Added Clear button and `onClear` prop
- `src/app/page.tsx` - Restructured layout to side-by-side format

### Files Created
- `src/components/TranslationPanel.tsx` - New component with Clear button
- `src/components/SummaryPanel.tsx` - New component (no max-height, expands freely)

### Final Layout
```
┌─────────────────────────────────────────────────────────────┐
│ Header + StatusBar                                          │
├─────────────────────────────────────────────────────────────┤
│ CapturePanel (full width)                                   │
├────────────────────────────┬────────────────────────────────┤
│ TranscriptPanel            │ TranslationPanel               │
│ [🗑️ Clear] [💾 Save]       │ [🗑️ Clear] [💾 Save]          │
│ max-h: 45vh/360px          │ max-h: 45vh/360px              │
├────────────────────────────┴────────────────────────────────┤
│ SummaryPanel                                                │
│ [💾 Save]                                                   │
│ (no max-height - expands freely)                            │
└────────────���────────────────────────────────────────────────┘
```

### Key Decisions
- **OutputPanel retained** for backward compatibility (not removed)
- **SummaryPanel has no max-height** - it's the final step and can expand as needed
- **TranscriptPanel and TranslationPanel** have matching max-heights for visual consistency