# Mission Control - Drawer & Controls Fix

## Executive Summary

✅ **Drawer is now working!** The main issue was a missing `useRef` import in `TaskCard.tsx` that caused the component to crash when clicked.

## What Was Fixed

### 1. 🔧 TaskCard.tsx - Missing Import (Critical Bug)
**Problem:** Component crashed on click due to missing `useRef` import
**Fix:** Added `useRef` to the imports
```tsx
// Before (broken):
import { useState } from 'react';

// After (fixed):
import { useState, useRef } from 'react';
```

**Impact:** Without this fix, clicking any task card would throw `ReferenceError: useRef is not defined`, preventing the drawer from opening.

### 2. 🖱️ TaskCard.tsx - Double-Click Backup
**Enhancement:** Added double-click as backup click method
```tsx
onClick={(e) => {
  // Double-click to open drawer
  if (e.detail === 2) {
    e.stopPropagation();
    onClick();
  }
:** Provides}}
```

**Why alternative way to open drawer if single-click detection fails.

### 3. 🗑️ App.tsx - Clear Demo Data Button
**New Feature:** Added "Clear Demo Data" button to header
- Visible only when tasks exist
- Shows confirmation dialog
- Calls API endpoint to delete all tasks
- Refreshes the board after clearing

### 4. 🔌 API Client - clearDemoData Method
**New Method:** Added to `api/client.ts`
```typescript
async clearDemoData(): Promise<{ deleted: number }> {
  return fetchJson(`${API_BASE}/tasks/clear-demo`, {
    method: 'DELETE'
  });
}
```

## What Was Already Working (No Changes Needed)

### ✅ Task Drawer
- Right-side panel (480px wide, z-index 41)
- Slide-in animation
- ESC to close
- Click-outside to close
- Visible above board (correct z-index)

### ✅ Drawer Tabs
- Overview/Details
- Plan
- Runs
- Activity

### ✅ Control Buttons
- **Approve** - Sets needsApproval=false, logs audit event
- **Pause** - Sets executionState to 'waiting'
- **Resume** - Sets executionState to 'running'
- **Retry** - Creates new BotRun entry
- **Cancel** - Sets executionState to 'failed'

### ✅ Task Card Features
- Drag handle (only handle area is draggable)
- Click detection (distinguishes drag vs click with 5px threshold)
- Execution state indicators (icons + colors)
- "Needs Approval" pill
- Idle warning with tooltip
- Debug indicator showing selected task ID

### ✅ Seed Data Logic
Already correct in `prisma/seed.ts`:
- Checks if DB is empty before seeding
- Respects `SEED_DEMO` environment variable
- Updates existing tasks with executionState if needed

### ✅ API Endpoints
All required endpoints already exist:
- `DELETE /api/v1/tasks/clear-demo` - Clear all demo tasks
- `PUT /api/v1/tasks/:id/execution` - Update execution state
- `POST /api/v1/tasks/:id/runs` - Create bot run

## How to Test

### Quick Test (30 seconds)
1. Open http://localhost:5173
2. Click a task card (not the drag handle) → Drawer should open
3. Press ESC → Drawer should close
4. Click outside drawer → Drawer should close
5. Click "Clear Demo Data" → Confirm → Tasks should disappear

### Manual Verification Steps

#### Drawer Opening
1. Click on task title or description (not drag handle) ✅
2. Double-click anywhere on card ✅
3. Drawer appears with slide-in animation ✅
4. Drawer is above board (z-index 41) ✅

#### Drawer Controls
1. Click "Approve" on a task needing approval ✅
2. Click "Retry" on a failed task ✅
3. Click "Pause/Resume" to change state ✅
4. Changes reflect on card immediately ✅

#### Demo Data Management
1. Click "Clear Demo Data" button ✅
2. Confirm deletion ✅
3. Board refreshes (empty) ✅
4. Click "+ New Task" ✅
5. Create real task ✅

## Files Modified

1. `apps/web/src/components/TaskCard.tsx` - Added useRef, double-click handler
2. `apps/web/src/App.tsx` - Added Clear Demo Data button
3. `apps/web/src/api/client.ts` - Added clearDemoData method
4. `CHANGES.md` - Created (this document)

## Build Status

✅ Web app builds successfully
⚠️  API has pre-existing TypeScript errors (not affecting web app)

## Environment Variables

```bash
# In apps/api/.env
SEED_DEMO=true  # Set to seed demo data on first run
```

## Known Issues (Pre-existing)

- Duplicate route definition in API (`/api/v1/tasks/:id/execution` defined twice)
- TypeScript errors in shared package
- Some audit event type mismatches

These don't affect the drawer functionality and are separate issues.
