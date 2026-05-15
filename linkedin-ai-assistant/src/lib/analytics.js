// Analytics tracking for LinkedIn AI Assistant
// Using Google Analytics 4 Measurement Protocol

const ANALYTICS_CONFIG = {
  // Replace with your actual GA4 Measurement ID (format: G-XXXXXXXXXX)
  measurementId: 'G-XXXXXXXXXX', // TODO: Get from Google Analytics
  apiSecret: 'YOUR_API_SECRET',  // TODO: Get from GA4 admin
  enabled: true, // Set to false to disable analytics
};

// Generate a unique client ID for this user
async function getClientId() {
  let { clientId } = await chrome.storage.local.get('clientId');

  if (!clientId) {
    // Generate new client ID
    clientId = `${Date.now()}.${Math.random().toString(36).substring(2)}`;
    await chrome.storage.local.set({ clientId });
  }

  return clientId;
}

// Send event to Google Analytics
async function trackEvent(eventName, eventParams = {}) {
  if (!ANALYTICS_CONFIG.enabled) return;

  try {
    const clientId = await getClientId();

    // Get user info
    const { plan = 'free', installDate } = await chrome.storage.sync.get([
      'plan',
      'installDate'
    ]);

    // Prepare event data
    const payload = {
      client_id: clientId,
      events: [{
        name: eventName,
        params: {
          ...eventParams,
          user_plan: plan,
          extension_version: chrome.runtime.getManifest().version,
          install_date: installDate,
        }
      }]
    };

    // Send to GA4
    await fetch(
      `https://www.google-analytics.com/mp/collect?measurement_id=${ANALYTICS_CONFIG.measurementId}&api_secret=${ANALYTICS_CONFIG.apiSecret}`,
      {
        method: 'POST',
        body: JSON.stringify(payload)
      }
    );

    console.log('📊 Analytics event tracked:', eventName);

  } catch (error) {
    console.error('Analytics error:', error);
    // Don't let analytics errors break the extension
  }
}

// Track page views
function trackPageView(pageName) {
  return trackEvent('page_view', {
    page_title: pageName,
    page_location: window.location.href
  });
}

// Common events
const Analytics = {
  // Installation & Setup
  trackInstall: () => trackEvent('extension_installed'),
  trackUninstall: () => trackEvent('extension_uninstalled'),

  // Feature Usage
  trackAutoApplyStarted: () => trackEvent('auto_apply_started'),
  trackAutoApplyStopped: () => trackEvent('auto_apply_stopped'),
  trackJobApplication: (jobTitle) => trackEvent('job_applied', { job_title: jobTitle }),

  trackAICommentGenerated: () => trackEvent('ai_comment_generated'),
  trackAISummaryGenerated: () => trackEvent('ai_summary_generated'),

  // Settings
  trackProfileCompleted: () => trackEvent('profile_completed'),
  trackAPIKeySet: () => trackEvent('api_key_set'),

  // Engagement
  trackDailyActive: () => trackEvent('daily_active_user'),
  trackPopupOpened: () => trackEvent('popup_opened'),

  // Upgrade/Conversion
  trackUpgradeClicked: () => trackEvent('upgrade_clicked'),
  trackUpgraded: (plan) => trackEvent('upgraded', { plan }),

  // Errors
  trackError: (errorType, errorMessage) => trackEvent('error', {
    error_type: errorType,
    error_message: errorMessage
  }),

  // Custom events
  track: trackEvent,
  trackPage: trackPageView,
};

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Analytics;
}
