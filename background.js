// Set side panel behavior to open on action click
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error('Error setting panel behavior:', error));

// Optional: Handle keyboard shortcuts if defined in manifest (not currently in manifest)
/*
chrome.commands.onCommand.addListener((command) => {
  if (command === "_execute_action") {
    // Standard action click handler usually suffices with setPanelBehavior
  }
});
*/
