// Popup script for LinkedIn AI Assistant

// Connect to background for analytics tracking
const port = chrome.runtime.connect({ name: 'popup' });

// Helper: Track analytics event
function trackEvent(eventName, eventParams = {}) {
  try {
    chrome.runtime.sendMessage({
      action: 'trackEvent',
      eventName: eventName,
      eventParams: eventParams
    }, (response) => {
      // Handle response or ignore runtime errors
      if (chrome.runtime.lastError) {
        // Silently ignore connection errors
        console.debug('Analytics tracking skipped:', chrome.runtime.lastError.message);
      }
    });
  } catch (error) {
    console.debug('Error tracking event:', error);
  }
}

// Load saved settings
document.addEventListener('DOMContentLoaded', async () => {
  const {
    groqApiKey,
    anthropicApiKey,
    usageCount = 0,
    plan = 'free',
    fullName,
    email,
    phone,
    location,
    yearsExperience
  } = await chrome.storage.sync.get([
    'groqApiKey',
    'anthropicApiKey',
    'usageCount',
    'plan',
    'fullName',
    'email',
    'phone',
    'location',
    'yearsExperience'
  ]);

  if (groqApiKey) {
    document.getElementById('groqApiKey').value = groqApiKey;
  }
  if (anthropicApiKey) {
    document.getElementById('anthropicApiKey').value = anthropicApiKey;
  }

  // Check profile completeness (required for auto-apply)
  const missingFields = [];
  if (!fullName) missingFields.push('Full Name');
  if (!email) missingFields.push('Email');
  if (!phone) missingFields.push('Phone');
  if (!location) missingFields.push('Location');
  if (!yearsExperience) missingFields.push('Years of Experience');

  // Optional fields for better job matching (not required for auto-apply)
  // - jobTitle
  // - skills

  const profileStatus = document.getElementById('profileStatus');
  const profileWarning = document.getElementById('profileWarning');
  const profileButton = document.getElementById('profileButton');

  if (missingFields.length > 0) {
    profileStatus.textContent = '⚠️ Incomplete';
    profileStatus.style.color = '#fbbf24'; // yellow
    profileWarning.classList.remove('hidden');
    document.getElementById('missingFieldsText').textContent =
      `Missing: ${missingFields.join(', ')}`;

    // Update button for incomplete profile
    profileButton.innerHTML = '⚠️ Complete Profile to Auto-Apply';
    profileButton.style.background = 'linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)';
  } else {
    profileStatus.textContent = '✅ Complete';
    profileStatus.style.color = '#4ade80'; // green
    profileWarning.classList.add('hidden');

    // Update button for complete profile
    profileButton.innerHTML = '✅ Profile Complete - View Settings';
    profileButton.style.background = 'linear-gradient(135deg, #10b981 0%, #059669 100%)';
  }

  // Update usage count
  const limit = plan === 'pro' ? '∞' : '10';
  document.getElementById('usageCount').textContent = `${usageCount} / ${limit}`;
  document.getElementById('planType').textContent = plan === 'pro' ? 'Pro' : 'Free';

  // Hide upgrade banner for pro users
  if (plan === 'pro') {
    document.getElementById('upgradeBanner').style.display = 'none';
  }
});

// Save settings
document.getElementById('saveBtn').addEventListener('click', async () => {
  const groqApiKey = document.getElementById('groqApiKey').value;
  const anthropicApiKey = document.getElementById('anthropicApiKey').value;

  await chrome.storage.sync.set({ groqApiKey, anthropicApiKey });

  // Track analytics
  if (groqApiKey) {
    trackEvent('api_key_set', { provider: 'groq' });
  }

  // Show success message
  const successMessage = document.getElementById('successMessage');
  successMessage.classList.remove('hidden');

  setTimeout(() => {
    successMessage.classList.add('hidden');
  }, 3000);
});

// Upgrade button (disabled for now - pricing page not yet available)
document.getElementById('upgradeBtn').addEventListener('click', () => {
  trackEvent('upgrade_clicked', { source: 'popup' });
  alert('Pricing page coming soon! For now, enjoy all features for free.');
  // chrome.tabs.create({ url: 'https://linkedin-ai-assistant.com/pricing' });
});

// Automation dashboard button
document.getElementById('automationBtn').addEventListener('click', () => {
  trackEvent('automation_dashboard_opened');
  chrome.windows.create({
    url: chrome.runtime.getURL('src/popup/automation-dashboard.html'),
    type: 'popup',
    width: 450,
    height: 650
  });
});

// How to use button (disabled for now)
document.getElementById('howToUseBtn').addEventListener('click', () => {
  alert('How-to guide coming soon! Check the extension settings to configure your profile.');
  // chrome.tabs.create({ url: 'https://linkedin-ai-assistant.com/how-to-use' });
});

// Reset usage count daily
const resetUsageDaily = async () => {
  const { lastReset } = await chrome.storage.sync.get('lastReset');
  const today = new Date().toDateString();

  if (lastReset !== today) {
    await chrome.storage.sync.set({
      usageCount: 0,
      lastReset: today
    });
  }
};

resetUsageDaily();
