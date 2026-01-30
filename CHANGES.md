# Mission Control - Fixes Summary

## Changes Made (Jan 30, 2026)

### 1. TaskCard.tsx - Fixed Missing Import & Improved Click Handling
**File:** `apps/web/src/components/TaskCard.tsx`

**Changes:**
- ✅ Added missing `useRef` import (was causing runtime ReferenceError)
- ✅ Added double-click handler as backup: `onClick={(e) => { if (e.detail === 2) onClick(); }}`
- ✅ Cleaned up code structure for better readability

**Issue Fixed:** The card had click handling logic (`handlePointerDown`/`handlePointerUp`) but was missing the `useRef` import, causing the component to crash when clicked.

### 2. App.tsx - Added Clear Demo Data Button
**File:** `apps/web/src/App.tsx`

**Changes:**
- ✅ Added `handleClearDemoData()` function with confirmation dialog
- ✅ Added "Clear Demo Data" button to header (visible when tasks exist)
- ✅ Added `clearingDemo` state for button loading state

**Feature:** Users can now clear all demo tasks with a single click.

### 3. API Client - Added clearDemoData Method
**File:** `apps/web/src/api/client.ts`

**Changes:**
- ✅ Added `clearDemoData(): Promise<{ deleted: number }>` method
- ✅ Calls `DELETE /api/v1/tasks/clear-demo`

**Note:** The API endpoint already existed in `apps/api/src/routes/tasks.ts`

### 4. Seed Data - Already Implemented Correctly
**File:** `apps/api/prisma/seed.ts`

**Already Working:**
- ✅ Checks if DB is empty before seeding (`if (existingCount > 0)`)
- ✅ Respects `SEED_DEMO` environment variable
- ✅ Updates existing tasks with executionState if needed

### 5. Task Drawer - Already Implemented
**File:** `apps/web/src/components/TaskDrawer.tsx`

**Already Working:**
- ✅ Right-side drawer (480px width, z-index 41)
- ✅ Tabs: Overview, Plan, Runs, Activity
- ✅ Control buttons: Approve, Pause, Resume, Retry, Cancel
- ✅ ESC close, click-outside close
- ✅ Optimistic updates with rollback on error
- ✅ Audit event logging
- ✅ Debug indicator for selected task

### 6. Task Card Features - Already Implemented
**File:** `apps/web/src/components/TaskCard.tsx`

**Already Working:**
- ✅ Drag handle for drag-and-drop (only handle area is draggable)
- ✅ Click detection (distinguishes drag vs click with 5px threshold)
- ✅ Execution state indicators (icons and colors)
- ✅ "Needs Approval" pill
- ✅ Idle warning with tooltip
- ✅ Debug indicator showing selected task ID

## How to Test

### Quick Sanity Check (30 seconds)

1. **Start the app:**
   ```bash
   cd mission-control
   npm run dev
   ```

2. **Test drawer opening:**
   - Click on a task card (not the drag handle) → Drawer should open
   - Double-click anywhere on card → Drawer should open
   - Press ESC → Drawer should close
   - Click outside drawer → Drawer should close

3. **Test controls:**
   - Click a task with "Needs Approval" → Approve button should work
   - Click "Retry" on a failed task → Should create new BotRun
   - Click "Pause/Resume" → Should update execution state

4. **Test demo data:**
   - Click "Clear Demo Data" button in header
   - Confirm → All tasks should be removed
   - Click "New Task" → Create a real task

5. **Verify CSS:**
   - Drawer should appear above the board (not clipped)
   - Drawer should have smooth slide-in animation
   - Selected task should have blue border

## Acceptance Checklist

- [ ] Click card → Drawer opens (with transition)
- [ ] Drawer shows tabs: Overview / Plan / Runs / Activity
- [ ] Approve action changes needsApproval=false
- [ ] Retry creates a BotRun entry
- [ ] Changing executionState writes audit + updates card indicator
- [ ] "Clear demo data" removes sample tasks permanently
- [ ] "New Task" creates real persisted tasks
- [ ] Drag handle works for moving cards
- [ ] Click (not drag) opens drawer
- [ ] ESC closes drawer
- [ ] Click outside closes drawer

## Known Issues (Pre-existing)

- TypeScript errors in API and shared packages (not affecting web app)
- Some audit/event types need refinement

## Environment Variables

- `SEED_DEMO=true` - Enable demo data seeding (default: false)
