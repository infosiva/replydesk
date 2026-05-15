// Automation Dashboard Script

// Load all settings and stats
document.addEventListener('DOMContentLoaded', async () => {
  const settings = await chrome.storage.sync.get([
    'plan',
    'autoApplyEnabled',
    'smartFilterEnabled',
    'autoCommentEnabled',
    'autoReactEnabled',
    'autoReplyEnabled',
    'autoConnectEnabled',
    'autoAcceptEnabled',
    'dailyReportEnabled',
    'successNotifEnabled',
    'humanDelaysEnabled',
    'dailyLimitsEnabled',
    // Today's stats
    'jobsAppliedToday',
    'commentsPostedToday',
    'reactionsGivenToday',
    'connectRequestsToday',
  ]);

  const plan = settings.plan || 'free';

  // Load toggle states
  document.getElementById('autoApplyToggle').checked = settings.autoApplyEnabled || false;
  document.getElementById('smartFilterToggle').checked = settings.smartFilterEnabled !== false;
  document.getElementById('autoCommentToggle').checked = settings.autoCommentEnabled || false;
  document.getElementById('autoReactToggle').checked = settings.autoReactEnabled || false;
  document.getElementById('autoReplyToggle').checked = settings.autoReplyEnabled || false;
  document.getElementById('autoConnectToggle').checked = settings.autoConnectEnabled || false;
  document.getElementById('autoAcceptToggle').checked = settings.autoAcceptEnabled || false;
  document.getElementById('dailyReportToggle').checked = settings.dailyReportEnabled !== false;
  document.getElementById('successNotifToggle').checked = settings.successNotifEnabled !== false;
  document.getElementById('humanDelaysToggle').checked = settings.humanDelaysEnabled !== false;
  document.getElementById('dailyLimitsToggle').checked = settings.dailyLimitsEnabled !== false;

  // Load today's stats
  document.getElementById('jobsApplied').textContent = settings.jobsAppliedToday || 0;
  document.getElementById('commentsPosted').textContent = settings.commentsPostedToday || 0;
  document.getElementById('reactionsGiven').textContent = settings.reactionsGivenToday || 0;
  document.getElementById('connectRequests').textContent = settings.connectRequestsToday || 0;

  // Handle premium features
  if (plan !== 'premium') {
    // Show upgrade banner
    document.getElementById('upgradeBanner').style.display = 'block';

    // Disable premium toggles
    const premiumToggles = [
      'autoApplyToggle',
      'autoCommentToggle',
      'autoReplyToggle',
      'autoConnectToggle'
    ];

    premiumToggles.forEach(id => {
      const toggle = document.getElementById(id);
      toggle.disabled = true;
      toggle.checked = false;
    });

    // Update limits for free tier
    document.getElementById('autoApplyLimit').textContent = '0 (Premium only)';
    document.getElementById('autoCommentLimit').textContent = '0 (Premium only)';
    document.getElementById('autoReplyLimit').textContent = '0 (Premium only)';
    document.getElementById('autoConnectLimit').textContent = '0 (Premium only)';

    // Hide premium badges for free features
    const autoApplyBadge = document.getElementById('autoApplyBadge');
    if (autoApplyBadge) autoApplyBadge.style.display = 'none';
  } else {
    // Premium user - hide upgrade banner, remove premium badges
    document.getElementById('upgradeBanner').style.display = 'none';

    const premiumBadges = document.querySelectorAll('.premium-badge');
    premiumBadges.forEach(badge => badge.style.display = 'none');
  }
});

// Save all settings
document.getElementById('saveSettingsBtn').addEventListener('click', async () => {
  const settings = {
    autoApplyEnabled: document.getElementById('autoApplyToggle').checked,
    smartFilterEnabled: document.getElementById('smartFilterToggle').checked,
    autoCommentEnabled: document.getElementById('autoCommentToggle').checked,
    autoReactEnabled: document.getElementById('autoReactToggle').checked,
    autoReplyEnabled: document.getElementById('autoReplyToggle').checked,
    autoConnectEnabled: document.getElementById('autoConnectToggle').checked,
    autoAcceptEnabled: document.getElementById('autoAcceptToggle').checked,
    dailyReportEnabled: document.getElementById('dailyReportToggle').checked,
    successNotifEnabled: document.getElementById('successNotifToggle').checked,
    humanDelaysEnabled: document.getElementById('humanDelaysToggle').checked,
    dailyLimitsEnabled: document.getElementById('dailyLimitsToggle').checked,
  };

  await chrome.storage.sync.set(settings);

  // Show success message
  const successMessage = document.getElementById('successMessage');
  successMessage.style.display = 'block';

  setTimeout(() => {
    successMessage.style.display = 'none';
  }, 3000);

  // Notify content scripts to reload settings
  chrome.tabs.query({ url: 'https://*.linkedin.com/*' }, (tabs) => {
    tabs.forEach(tab => {
      chrome.tabs.sendMessage(tab.id, { action: 'reloadAutomationSettings' });
    });
  });
});

// Pause all automation
document.getElementById('pauseAllBtn').addEventListener('click', async () => {
  const toggles = [
    'autoApplyToggle',
    'autoCommentToggle',
    'autoReactToggle',
    'autoReplyToggle',
    'autoConnectToggle',
    'autoAcceptToggle'
  ];

  toggles.forEach(id => {
    const toggle = document.getElementById(id);
    if (!toggle.disabled) {
      toggle.checked = false;
    }
  });

  // Save all as disabled
  await chrome.storage.sync.set({
    autoApplyEnabled: false,
    autoCommentEnabled: false,
    autoReactEnabled: false,
    autoReplyEnabled: false,
    autoConnectEnabled: false,
    autoAcceptEnabled: false,
  });

  alert('✅ All automation paused');
});

// Upgrade button (disabled for now - pricing page not yet available)
document.getElementById('upgradeBtn')?.addEventListener('click', () => {
  alert('Pricing page coming soon! For now, enjoy all features for free.');
  // chrome.tabs.create({ url: 'https://linkedin-ai-assistant.com/pricing' });
});

// Help link (disabled for now)
document.getElementById('helpLink')?.addEventListener('click', (e) => {
  e.preventDefault();
  alert('Help guide coming soon! Check Settings to configure your profile for auto-apply.');
  // chrome.tabs.create({ url: 'https://linkedin-ai-assistant.com/help' });
});
