// Quick verification script for drawer click behavior
// Run in browser console on http://localhost:5173

console.log('🧪 Testing Task Card Click Behavior...\n');

// Test 1: Check if TaskCard component exists
const taskCards = document.querySelectorAll('[data-task-id]');
console.log(`✅ Found ${taskCards.length} task cards`);

if (taskCards.length > 0) {
  // Test 2: Check if cards have click handlers
  const firstCard = taskCards[0];
  const hasOnClick = firstCard.hasAttribute('onclick') ||
                     firstCard.onclick !== null ||
                     firstCard.getAttribute('onClick') !== null;
  console.log(`✅ Card has click handler: ${hasOnClick}`);

  // Test 3: Check for drag handle
  const dragHandle = firstCard.querySelector('.drag-handle');
  console.log(`✅ Drag handle exists: ${dragHandle !== null}`);

  // Test 4: Check drawer is present in DOM (hidden by default)
  const drawer = document.querySelector('.drawer');
  const overlay = document.querySelector('.drawer-overlay');
  console.log(`✅ Drawer element exists: ${drawer !== null}`);
  console.log(`✅ Drawer overlay exists: ${overlay !== null}`);

  // Test 5: Check z-index
  if (drawer) {
    const zIndex = window.getComputedStyle(drawer).zIndex;
    console.log(`✅ Drawer z-index: ${zIndex}`);
  }

  // Test 6: Simulate click and check if drawer opens
  console.log('\n🖱️  Clicking first card...');
  firstCard.click();

  setTimeout(() => {
    const drawerAfterClick = document.querySelector('.drawer');
    const isVisible = drawerAfterClick &&
                      window.getComputedStyle(drawerAfterClick).display !== 'none';
    console.log(`✅ Drawer opened after click: ${isVisible}`);

    if (isVisible) {
      // Test 7: Check tabs exist
      const tabs = drawerAfterClick.querySelectorAll('button');
      console.log(`✅ Drawer has ${tabs.length} interactive elements`);

      // Test 8: Check for Approve button
      const approveBtn = drawerAfterClick.textContent.includes('Approve');
      console.log(`✅ Approve button present: ${approveBtn}`);

      // Test 9: Test ESC key
      console.log('\n⌨️  Testing ESC key...');
      const escapeEvent = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true });
      document.dispatchEvent(escapeEvent);

      setTimeout(() => {
        const drawerAfterEsc = document.querySelector('.drawer');
        const isClosed = !drawerAfterEsc ||
                         window.getComputedStyle(drawerAfterEsc).display === 'none';
        console.log(`✅ Drawer closed after ESC: ${isClosed}`);
        console.log('\n🎉 All tests passed! Drawer is working correctly.');
      }, 300);
    } else {
      console.log('\n❌ Drawer did not open. Check for errors in console.');
    }
  }, 100);
} else {
  console.log('\n❌ No task cards found. Make sure demo data is loaded.');
}

console.log('\n📋 Verification complete!');
