// Background service worker for LinkedIn AI Assistant

console.log('🤖 LinkedIn AI Assistant background service worker loaded');

// Analytics configuration
const ANALYTICS_ENDPOINT = 'https://www.google-analytics.com/mp/collect';
const MEASUREMENT_ID = 'G-XXXXXXXXXX'; // TODO: Replace with your GA4 Measurement ID
const API_SECRET = 'YOUR_API_SECRET';   // TODO: Replace with your GA4 API Secret

// Helper: Send analytics event
async function sendAnalytics(eventName, eventParams = {}) {
  try {
    // Get or create client ID
    let { clientId } = await chrome.storage.local.get('clientId');
    if (!clientId) {
      clientId = `${Date.now()}.${Math.random().toString(36).substring(2)}`;
      await chrome.storage.local.set({ clientId });
    }

    const { plan = 'free' } = await chrome.storage.sync.get('plan');

    const payload = {
      client_id: clientId,
      events: [{
        name: eventName,
        params: {
          ...eventParams,
          user_plan: plan,
          extension_version: chrome.runtime.getManifest().version,
        }
      }]
    };

    await fetch(`${ANALYTICS_ENDPOINT}?measurement_id=${MEASUREMENT_ID}&api_secret=${API_SECRET}`, {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    console.log('📊 Analytics:', eventName);
  } catch (error) {
    console.error('Analytics error:', error);
  }
}

// Listen for extension installation
chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install') {
    // First time installation
    const installDate = new Date().toISOString();

    await chrome.storage.sync.set({
      usageCount: 0,
      plan: 'free',
      lastReset: new Date().toDateString(),
      installDate: installDate,
    });

    // Track installation
    await sendAnalytics('extension_installed', {
      install_date: installDate
    });

    // Open welcome page (optional - can be enabled later when website is live)
    // chrome.tabs.create({ url: 'https://linkedin-ai-assistant.com/welcome' });
    console.log('✅ LinkedIn AI Assistant installed! Configure your API key in settings.');

  } else if (details.reason === 'update') {
    // Extension updated
    const version = chrome.runtime.getManifest().version;

    await sendAnalytics('extension_updated', {
      version: version,
      previous_version: details.previousVersion
    });

    console.log('🔄 Extension updated to version:', version);
  }
});

// Reset usage count daily at midnight
chrome.alarms.create('resetUsage', {
  when: getNextMidnight(),
  periodInMinutes: 24 * 60, // 24 hours
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'resetUsage') {
    await chrome.storage.sync.set({
      usageCount: 0,
      lastReset: new Date().toDateString(),
    });
    console.log('Usage count reset for new day');
  }
});

// Helper function to get next midnight timestamp
function getNextMidnight() {
  const now = new Date();
  const midnight = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 1,
    0, 0, 0
  );
  return midnight.getTime();
}

// Track daily active users
async function trackDailyActive() {
  const { lastActiveDate } = await chrome.storage.local.get('lastActiveDate');
  const today = new Date().toDateString();

  if (lastActiveDate !== today) {
    // New day - track as daily active user
    await chrome.storage.local.set({ lastActiveDate: today });
    await sendAnalytics('daily_active_user', {
      date: today
    });
  }
}

// Track DAU when extension is opened
chrome.action.onClicked.addListener(() => {
  trackDailyActive();
});

// Listen for messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getUsage') {
    chrome.storage.sync.get(['usageCount', 'plan'], (data) => {
      sendResponse(data);
    });
    return true; // Keep channel open for async response
  }

  // Track analytics events from content scripts
  if (request.action === 'trackEvent') {
    sendAnalytics(request.eventName, request.eventParams || {});
    sendResponse({ success: true });
    return true;
  }

  // Track feature usage
  if (request.action === 'trackFeature') {
    trackDailyActive(); // User is active
    sendAnalytics(request.feature, request.data || {});
    sendResponse({ success: true });
    return true;
  }
});

// Track when popup is opened (DAU tracking)
chrome.runtime.onConnect.addListener((port) => {
  if (port.name === 'popup') {
    trackDailyActive();
    sendAnalytics('popup_opened');
  }
});
