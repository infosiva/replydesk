// Settings page script

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
  const settings = await chrome.storage.sync.get([
    'apiKey',
    'fullName',
    'email',
    'phone',
    'location',
    'jobTitle',
    'skills',
    'yearsExperience',
    'onlyEasyApply',
    'skipCoverLetter',
    'skipAssessments',
    'maxApplicationsPerDay',
  ]);

  // Populate form
  document.getElementById('apiKey').value = settings.apiKey || '';
  document.getElementById('fullName').value = settings.fullName || '';
  document.getElementById('email').value = settings.email || '';
  document.getElementById('phone').value = settings.phone || '';
  document.getElementById('location').value = settings.location || '';
  document.getElementById('jobTitle').value = settings.jobTitle || '';
  document.getElementById('skills').value = settings.skills || '';
  document.getElementById('yearsExperience').value = settings.yearsExperience || '';
  document.getElementById('onlyEasyApply').checked = settings.onlyEasyApply !== false;
  document.getElementById('skipCoverLetter').checked = settings.skipCoverLetter !== false;
  document.getElementById('skipAssessments').checked = settings.skipAssessments || false;
  document.getElementById('maxApplicationsPerDay').value = settings.maxApplicationsPerDay || 50;
});

// Save settings
document.getElementById('saveSettingsBtn').addEventListener('click', async () => {
  const settings = {
    apiKey: document.getElementById('apiKey').value,
    fullName: document.getElementById('fullName').value,
    email: document.getElementById('email').value,
    phone: document.getElementById('phone').value,
    location: document.getElementById('location').value,
    jobTitle: document.getElementById('jobTitle').value,
    skills: document.getElementById('skills').value,
    yearsExperience: parseInt(document.getElementById('yearsExperience').value) || 0,
    onlyEasyApply: document.getElementById('onlyEasyApply').checked,
    skipCoverLetter: document.getElementById('skipCoverLetter').checked,
    skipAssessments: document.getElementById('skipAssessments').checked,
    maxApplicationsPerDay: parseInt(document.getElementById('maxApplicationsPerDay').value) || 50,
  };

  await chrome.storage.sync.set(settings);

  // Check if profile is now complete (all required fields filled)
  const isProfileComplete = settings.fullName && settings.email &&
                           settings.phone && settings.location &&
                           settings.yearsExperience > 0;

  // Track analytics
  trackEvent('settings_saved', {
    profile_complete: isProfileComplete,
    has_api_key: !!settings.apiKey,
    has_expertise: !!(settings.jobTitle && settings.skills)
  });

  if (isProfileComplete) {
    // Check if this is the first time profile is completed
    const { profileCompletedDate } = await chrome.storage.local.get('profileCompletedDate');
    if (!profileCompletedDate) {
      trackEvent('profile_completed_first_time');
      await chrome.storage.local.set({
        profileCompletedDate: new Date().toISOString()
      });
    }
  }

  // Show success message
  const successMessage = document.getElementById('successMessage');
  successMessage.style.display = 'block';

  setTimeout(() => {
    successMessage.style.display = 'none';
  }, 3000);
});
