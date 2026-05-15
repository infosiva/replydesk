// LinkedIn Job Auto-Apply Feature
// This feature automatically applies to jobs with "Easy Apply" button

// Wrap in IIFE to avoid variable conflicts with other content scripts
(function() {
  'use strict';

  console.log('🤖 LinkedIn Auto-Apply feature loaded');

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
          // Silently ignore connection errors (background script may not be ready)
          console.debug('Analytics tracking skipped:', chrome.runtime.lastError.message);
        }
      });
    } catch (error) {
      console.debug('Error tracking event:', error);
    }
  }

  // Configuration
  const JOB_CONFIG = {
  MAX_APPLICATIONS_PER_DAY: {
    free: 5,      // Free users get 5 free auto-applies to try it! (TRIAL)
    pro: 10,      // Pro users get 10/day
    premium: 50,  // Premium users can auto-apply to 50 jobs/day
  },
  TRIAL_APPLICATIONS_TOTAL: 5, // Total free trial applications (lifetime)
  MIN_DELAY_BETWEEN_APPLICATIONS: 60000, // 1 minute (to avoid detection)
  MAX_DELAY_BETWEEN_APPLICATIONS: 180000, // 3 minutes (random delays)
  SAFETY_ENABLED: true,
};

// Application state
let isAutoApplying = false;
let applicationsToday = 0;
let lastApplicationTime = 0;
let confirmBeforeApply = true; // Beta: Ask before each application

// Initialize auto-apply UI
function initializeAutoApply() {
  try {
    // Only show on job-related pages
    const currentUrl = window.location.href;
    console.log('🔍 Current URL:', currentUrl);

    const isJobsPage = currentUrl.includes('/jobs/') ||
                       currentUrl.includes('/jobs/search') ||
                       currentUrl.includes('/jobs/collections') ||
                       currentUrl.match(/linkedin\.com\/jobs(\?|$)/);

    if (!isJobsPage) {
      console.log('⏭️ Not on jobs page, skipping auto-apply panel');
      return;
    }

    console.log('✅ On jobs page! Initializing auto-apply panel...');

    // Check if panel already exists
    if (document.getElementById('linkedin-ai-auto-apply-panel')) {
      console.log('📋 Panel already exists, skipping creation');
      return;
    }

    // Wait for body to be ready
    if (!document.body) {
      console.log('⏳ Body not ready, waiting...');
      setTimeout(initializeAutoApply, 500);
      return;
    }

    // Create auto-apply control panel
    console.log('🎨 Creating auto-apply panel...');
    const controlPanel = createAutoApplyPanel();

    if (controlPanel && document.body) {
      document.body.appendChild(controlPanel);
      console.log('✨ Panel added to DOM successfully!');
    } else {
      console.error('❌ Could not add panel - controlPanel or body is null');
    }

    // Find Easy Apply jobs
    setTimeout(() => {
      highlightEasyApplyJobs();
      // Listen for job list updates (infinite scroll)
      observeJobList();
    }, 1000);

  } catch (error) {
    console.error('❌ Error initializing auto-apply:', error);
    console.error('Stack trace:', error.stack);
  }
}

// Create floating control panel
function createAutoApplyPanel() {
  let panel = null;

  try {
    console.log('🎨 Creating panel element...');
    panel = document.createElement('div');

    if (!panel) {
      console.error('❌ Failed to create div element');
      return null;
    }

    panel.id = 'linkedin-ai-auto-apply-panel';
    panel.style.cssText = `
      position: fixed !important;
      bottom: 20px !important;
      right: 20px !important;
      width: 350px !important;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%) !important;
      color: white !important;
      padding: 20px !important;
      border-radius: 16px !important;
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3) !important;
      z-index: 999999 !important;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
      display: block !important;
      visibility: visible !important;
      opacity: 1 !important;
    `;
    console.log('✅ Panel styling applied');

    panel.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
        <h3 style="margin: 0; font-size: 18px; font-weight: 700;">🤖 Auto-Apply Jobs</h3>
        <button id="closeAutoApplyPanel" style="
          background: rgba(255, 255, 255, 0.2);
          border: none;
          color: white;
          width: 24px;
          height: 24px;
          border-radius: 50%;
          cursor: pointer;
          font-size: 16px;
        ">×</button>
      </div>

      <div style="
        background: rgba(255, 255, 255, 0.15);
        padding: 12px;
        border-radius: 8px;
        margin-bottom: 16px;
      ">
        <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
          <span style="font-size: 13px; opacity: 0.9;">Applications Today</span>
          <span id="applicationsCount" style="font-weight: 700; font-size: 16px;">0 / 50</span>
        </div>
        <div style="display: flex; justify-content: space-between;">
          <span style="font-size: 13px; opacity: 0.9;">Easy Apply Jobs Found</span>
          <span id="easyApplyCount" style="font-weight: 700; font-size: 16px;">0</span>
        </div>
      </div>

      <div id="autoApplyStatus" style="
        padding: 12px;
        background: rgba(255, 255, 255, 0.15);
        border-radius: 8px;
        margin-bottom: 16px;
        font-size: 14px;
        text-align: center;
      ">
        Ready to start applying
      </div>

      <div id="autoApplyControls">
        <button id="refreshJobsBtn" style="
          width: 100%;
          padding: 10px;
          background: rgba(255, 255, 255, 0.15);
          color: white;
          border: none;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          margin-bottom: 8px;
        ">
          🔄 Scan for Easy Apply Jobs
        </button>

        <button id="startAutoApply" style="
          width: 100%;
          padding: 14px;
          background: white;
          color: #667eea;
          border: none;
          border-radius: 8px;
          font-size: 15px;
          font-weight: 700;
          cursor: pointer;
          margin-bottom: 8px;
          transition: all 0.2s;
        ">
          ▶️ Start Auto-Applying
        </button>

        <button id="stopAutoApply" style="
          width: 100%;
          padding: 14px;
          background: rgba(255, 255, 255, 0.2);
          color: white;
          border: none;
          border-radius: 8px;
          font-size: 15px;
          font-weight: 700;
          cursor: pointer;
          display: none;
        ">
          ⏸ Stop Auto-Apply
        </button>
      </div>

      <div id="premiumUpgrade" style="
        margin-top: 12px;
        padding: 12px;
        background: rgba(255, 255, 255, 0.1);
        border-radius: 8px;
        text-align: center;
        font-size: 13px;
        display: none;
      ">
        <p style="margin: 0 0 8px 0; opacity: 0.9;">Upgrade to Premium for auto-apply</p>
        <button id="upgradeToPremium" style="
          width: 100%;
          padding: 10px;
          background: white;
          color: #667eea;
          border: none;
          border-radius: 6px;
          font-weight: 600;
          cursor: pointer;
        ">
          Upgrade to Premium - $29/mo
        </button>
      </div>

      <div style="
        margin-top: 12px;
        padding: 12px;
        background: rgba(255, 255, 255, 0.1);
        border-radius: 8px;
      ">
        <label style="
          display: flex;
          align-items: center;
          gap: 8px;
          cursor: pointer;
          font-size: 13px;
        ">
          <input
            type="checkbox"
            id="confirmModeToggle"
            checked
            style="
              width: 18px;
              height: 18px;
              cursor: pointer;
            "
          >
          <span>
            <strong>🧪 Beta Testing Mode</strong><br>
            <small style="opacity: 0.8;">Ask before each application (recommended for testing)</small>
          </span>
        </label>
      </div>

      <div style="
        margin-top: 8px;
        font-size: 11px;
        opacity: 0.7;
        text-align: center;
      ">
        ⚠️ Uses human-like delays to stay safe
      </div>
    `;

    // Event listeners
    console.log('🔗 Attaching event listeners...');

    panel.querySelector('#closeAutoApplyPanel').addEventListener('click', () => {
      panel.style.display = 'none';
    });

    // Refresh jobs button
    const refreshBtn = panel.querySelector('#refreshJobsBtn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => {
        console.log('🔄 Manually scanning for jobs...');
        showNotification('🔄 Scanning for Easy Apply jobs...', 'info');
        highlightEasyApplyJobs();
        observeJobList();
      });
    }

    panel.querySelector('#startAutoApply').addEventListener('click', startAutoApply);
    panel.querySelector('#stopAutoApply').addEventListener('click', stopAutoApply);

    // Beta testing mode toggle
    const confirmToggle = panel.querySelector('#confirmModeToggle');
    if (confirmToggle) {
      confirmToggle.addEventListener('change', (e) => {
        confirmBeforeApply = e.target.checked;
        console.log('🧪 Confirm mode:', confirmBeforeApply ? 'ON' : 'OFF');
        showNotification(
          confirmBeforeApply ? '🧪 Testing mode ON - will ask before applying' : '⚡ Auto mode ON - will apply automatically',
          'info'
        );
      });
    }

    const upgradeBtn = panel.querySelector('#upgradeToPremium');
    if (upgradeBtn) {
      upgradeBtn.addEventListener('click', () => {
        alert('Pricing page coming soon! For now, enjoy all features for free.');
        // window.open('https://linkedin-ai-assistant.com/pricing', '_blank');
      });
    }

    console.log('✅ Event listeners attached');

    // Check if user has premium access
    checkPremiumAccess(panel);

    console.log('✨ Panel created successfully!');
    return panel;

  } catch (error) {
    console.error('❌ Error setting up panel:', error);
    console.error('Error details:', error.message, error.stack);
    return null;
  }
}

// Check if user has premium access
async function checkPremiumAccess(panel) {
  try {
    console.log('🔍 Checking premium access...');

    const {
      plan = 'free',
      trialApplicationsUsed = 0,
      jobApplicationsToday = 0,
      lastJobApplicationDate
    } = await chrome.storage.sync.get([
      'plan',
      'trialApplicationsUsed',
      'jobApplicationsToday',
      'lastJobApplicationDate'
    ]);

    console.log('📊 User plan:', plan, '| Trial used:', trialApplicationsUsed);

    // Calculate limits based on plan
    const dailyLimit = JOB_CONFIG.MAX_APPLICATIONS_PER_DAY[plan];
    const trialRemaining = JOB_CONFIG.TRIAL_APPLICATIONS_TOTAL - trialApplicationsUsed;

    // Reset daily count if new day
    const today = new Date().toDateString();
    if (lastJobApplicationDate !== today) {
      applicationsToday = 0;
      await chrome.storage.sync.set({
        jobApplicationsToday: 0,
        lastJobApplicationDate: today
      });
    } else {
      applicationsToday = jobApplicationsToday;
    }

    updateApplicationCount();

    // Show trial message for free users
    if (plan === 'free') {
      if (trialRemaining > 0) {
        panel.querySelector('#autoApplyStatus').innerHTML =
          `🎁 <strong>FREE TRIAL:</strong> ${trialRemaining} free auto-applies remaining!<br><span style="font-size: 12px; opacity: 0.8;">Try it risk-free, upgrade anytime</span>`;
        panel.querySelector('#premiumUpgrade').innerHTML = `
          <p style="margin: 0 0 8px 0; opacity: 0.9;">Love it? Upgrade for 50 applications/day</p>
          <button id="upgradeToPremium" style="
            width: 100%;
            padding: 10px;
            background: white;
            color: #667eea;
            border: none;
            border-radius: 6px;
            font-weight: 600;
            cursor: pointer;
          ">
            Upgrade to Premium - $29/mo
          </button>
        `;
        // Still show controls for trial
        panel.querySelector('#autoApplyControls').style.display = 'block';
      } else {
        // Trial expired, show upgrade
        panel.querySelector('#autoApplyControls').style.display = 'none';
        panel.querySelector('#premiumUpgrade').style.display = 'block';
        panel.querySelector('#premiumUpgrade').innerHTML = `
          <p style="margin: 0 0 8px 0; font-weight: 600;">🎯 Free trial complete!</p>
          <p style="margin: 0 0 12px 0; opacity: 0.9; font-size: 12px;">You tried it, loved it? Unlock 50 applications/day!</p>
          <button id="upgradeToPremium" style="
            width: 100%;
            padding: 12px;
            background: white;
            color: #667eea;
            border: none;
            border-radius: 6px;
            font-weight: 700;
            cursor: pointer;
          ">
            Upgrade to Premium - $29/mo
          </button>
        `;
        panel.querySelector('#autoApplyStatus').textContent = '✋ Free trial used. Upgrade to continue auto-applying!';
      }

      // Add upgrade button listener
      panel.querySelector('#upgradeToPremium')?.addEventListener('click', () => {
        alert('Pricing page coming soon! For now, enjoy all features for free.');
        // window.open('https://linkedin-ai-assistant.com/pricing', '_blank');
      });
    }

  } catch (error) {
    console.error('❌ Error checking premium access:', error);
  }
}

// Highlight Easy Apply jobs
function highlightEasyApplyJobs() {
  try {
    console.log('🔍 Looking for Easy Apply jobs...');

    // Try multiple selectors for job cards (LinkedIn changes these)
    let jobCards = document.querySelectorAll('.jobs-search-results__list-item');

    if (jobCards.length === 0) {
      jobCards = document.querySelectorAll('.scaffold-layout__list-item');
    }

    if (jobCards.length === 0) {
      jobCards = document.querySelectorAll('[data-job-id]');
    }

    console.log('📋 Found', jobCards.length, 'job cards');

    let easyApplyCount = 0;

    jobCards.forEach(card => {
      try {
        // Check if job has Easy Apply button - try multiple selectors
        let easyApplyButton = card.querySelector('[aria-label*="Easy Apply"]');

        if (!easyApplyButton) {
          easyApplyButton = card.querySelector('.jobs-apply-button--top-card');
        }

        if (!easyApplyButton) {
          // Check if the text "Easy Apply" exists anywhere in the card
          const cardText = card.textContent || '';
          if (cardText.includes('Easy Apply')) {
            easyApplyButton = card; // Mark as Easy Apply
          }
        }

        if (easyApplyButton) {
          easyApplyCount++;
          console.log('✅ Found Easy Apply job:', card.querySelector('.job-card-list__title, .job-card-container__link')?.textContent?.trim());

          // Add visual indicator
          if (!card.querySelector('.ai-easy-apply-badge')) {
            const badge = document.createElement('div');
            badge.className = 'ai-easy-apply-badge';
            badge.style.cssText = `
              position: absolute;
              top: 10px;
              right: 10px;
              background: linear-gradient(135deg, #4ade80 0%, #22c55e 100%);
              color: white;
              padding: 4px 12px;
              border-radius: 12px;
              font-size: 11px;
              font-weight: 700;
              z-index: 100;
            `;
            badge.textContent = '⚡ Easy Apply';

            card.style.position = 'relative';

            if (card && card.appendChild) {
              card.appendChild(badge);
            }
          }
        }
      } catch (cardError) {
        console.debug('Error processing card:', cardError);
      }
    });

    console.log('✅ Found', easyApplyCount, 'Easy Apply jobs');

    // Update count
    const countElement = document.getElementById('easyApplyCount');
    if (countElement) {
      countElement.textContent = easyApplyCount;
    }

    // Show message if no jobs found
    if (easyApplyCount === 0 && jobCards.length > 0) {
      console.warn('⚠️ Found job cards but no Easy Apply jobs. Try scrolling down to load more jobs.');
      const statusElement = document.getElementById('autoApplyStatus');
      if (statusElement && !isAutoApplying) {
        statusElement.innerHTML = `
          ⚠️ No Easy Apply jobs found<br>
          <small style="font-size: 11px; opacity: 0.8;">Try scrolling down or searching for jobs</small>
        `;
      }
    } else if (jobCards.length === 0) {
      console.warn('⚠️ No job cards found on page. Make sure you\'re on the jobs search page.');
      const statusElement = document.getElementById('autoApplyStatus');
      if (statusElement && !isAutoApplying) {
        statusElement.innerHTML = `
          ❌ No jobs found on page<br>
          <small style="font-size: 11px; opacity: 0.8;">Are you on linkedin.com/jobs/search?</small>
        `;
      }
    }

  } catch (error) {
    console.error('❌ Error highlighting Easy Apply jobs:', error);
  }
}

// Start auto-apply process
async function startAutoApply() {
  // First, check if profile is complete
  const {
    fullName,
    email,
    phone,
    location,
    yearsExperience,
    plan = 'free',
    trialApplicationsUsed = 0
  } = await chrome.storage.sync.get([
    'fullName',
    'email',
    'phone',
    'location',
    'yearsExperience',
    'plan',
    'trialApplicationsUsed'
  ]);

  // Validate required profile fields
  const missingFields = [];
  if (!fullName) missingFields.push('Full Name');
  if (!email) missingFields.push('Email');
  if (!phone) missingFields.push('Phone Number');
  if (!location) missingFields.push('Location');
  if (!yearsExperience) missingFields.push('Years of Experience');

  // Note: jobTitle and skills are optional for auto-apply
  // They're used for job matching in the AI Jobs Portal

  if (missingFields.length > 0) {
    const message = `⚠️ Please complete your profile first!\n\nMissing: ${missingFields.join(', ')}\n\nClick the extension icon → Settings to fill in your profile.`;
    showNotification(message, 'error');

    // Update status in panel
    document.getElementById('autoApplyStatus').innerHTML = `
      ❌ Profile Incomplete<br>
      <small style="font-size: 11px; opacity: 0.9;">Go to Settings to complete your profile</small>
    `;
    return;
  }

  const dailyLimit = JOB_CONFIG.MAX_APPLICATIONS_PER_DAY[plan];
  const trialRemaining = JOB_CONFIG.TRIAL_APPLICATIONS_TOTAL - trialApplicationsUsed;

  // Check if user can use auto-apply
  if (plan === 'free' && trialRemaining <= 0) {
    showNotification('⚠️ Free trial used! Upgrade to Premium for 50 applications/day', 'warning');
    return;
  }

  if (applicationsToday >= dailyLimit) {
    const message = plan === 'free'
      ? `✋ Daily limit reached (${dailyLimit} applications). Upgrade to Premium for 50/day!`
      : `✋ Daily limit reached (${dailyLimit} applications). Try again tomorrow!`;
    showNotification(message, 'warning');
    return;
  }

  isAutoApplying = true;

  // Track analytics
  trackEvent('auto_apply_started', {
    plan: plan,
    trial_remaining: plan === 'free' ? trialRemaining : null
  });

  // Update UI
  document.getElementById('startAutoApply').style.display = 'none';
  document.getElementById('stopAutoApply').style.display = 'block';
  document.getElementById('autoApplyStatus').textContent = '🚀 Auto-applying to jobs...';

  showNotification('🤖 Auto-apply started! Sit back and relax...', 'success');

  // Start applying to jobs
  await applyToJobs();
}

// Stop auto-apply process
function stopAutoApply() {
  isAutoApplying = false;

  // Track analytics
  trackEvent('auto_apply_stopped', {
    applications_completed: applicationsToday
  });

  // Update UI
  document.getElementById('startAutoApply').style.display = 'block';
  document.getElementById('stopAutoApply').style.display = 'none';
  document.getElementById('autoApplyStatus').textContent = '⏸ Auto-apply paused';

  showNotification('⏸ Auto-apply stopped', 'info');
}

// Apply to jobs sequentially
async function applyToJobs() {
  console.log('🚀 Starting to apply to jobs...');

  // Use the same selectors as highlightEasyApplyJobs
  let jobCards = document.querySelectorAll('.jobs-search-results__list-item');

  if (jobCards.length === 0) {
    console.log('⚠️ No .jobs-search-results__list-item found, trying .scaffold-layout__list-item');
    jobCards = document.querySelectorAll('.scaffold-layout__list-item');
  }

  if (jobCards.length === 0) {
    console.log('⚠️ No .scaffold-layout__list-item found, trying [data-job-id]');
    jobCards = document.querySelectorAll('[data-job-id]');
  }

  console.log(`📋 Found ${jobCards.length} job cards to process`);

  if (jobCards.length === 0) {
    showNotification('❌ No job cards found on page', 'error');
    stopAutoApply();
    return;
  }

  const jobCardsArray = Array.from(jobCards);

  for (const jobCard of jobCardsArray) {
    if (!isAutoApplying) break;

    if (applicationsToday >= JOB_CONFIG.MAX_APPLICATIONS_PER_DAY.premium) {
      showNotification('✅ Daily limit reached! Applied to 50 jobs today.', 'success');
      stopAutoApply();
      break;
    }

    // Check if job has Easy Apply - try multiple selectors
    let easyApplyButton = jobCard.querySelector('[aria-label*="Easy Apply"]');

    if (!easyApplyButton) {
      // Check if "Easy Apply" text exists in the card
      const cardText = jobCard.textContent || '';
      if (cardText.includes('Easy Apply')) {
        easyApplyButton = jobCard; // Mark as Easy Apply job
        console.log('✅ Found Easy Apply job (by text)');
      }
    }

    if (easyApplyButton && !jobCard.classList.contains('ai-applied')) {
      console.log('🎯 Processing Easy Apply job...');
      // Respect rate limits
      const timeSinceLastApplication = Date.now() - lastApplicationTime;
      if (timeSinceLastApplication < JOB_CONFIG.MIN_DELAY_BETWEEN_APPLICATIONS) {
        const delay = JOB_CONFIG.MIN_DELAY_BETWEEN_APPLICATIONS - timeSinceLastApplication;
        await sleep(delay);
      }

      // Apply to job
      const success = await applyToJob(jobCard, easyApplyButton);

      if (success) {
        applicationsToday++;
        lastApplicationTime = Date.now();

        // Update trial count for free users
        const { plan = 'free', trialApplicationsUsed = 0 } =
          await chrome.storage.sync.get(['plan', 'trialApplicationsUsed']);

        const updateData = {
          jobApplicationsToday: applicationsToday,
          lastJobApplicationDate: new Date().toDateString()
        };

        if (plan === 'free') {
          updateData.trialApplicationsUsed = trialApplicationsUsed + 1;
        }

        await chrome.storage.sync.set(updateData);
        updateApplicationCount();

        // Mark as applied
        jobCard.classList.add('ai-applied');

        // Add "Applied" badge
        const badge = jobCard.querySelector('.ai-easy-apply-badge');
        if (badge) {
          badge.textContent = '✓ Applied';
          badge.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
        }
      }

      // Random delay between applications (human-like behavior)
      const randomDelay = Math.random() *
        (JOB_CONFIG.MAX_DELAY_BETWEEN_APPLICATIONS - JOB_CONFIG.MIN_DELAY_BETWEEN_APPLICATIONS) +
        JOB_CONFIG.MIN_DELAY_BETWEEN_APPLICATIONS;

      await sleep(randomDelay);
    }
  }

  console.log('✅ Finished processing all job cards');

  if (isAutoApplying) {
    document.getElementById('autoApplyStatus').textContent =
      `✅ Finished! Applied to ${applicationsToday} jobs today.`;
    stopAutoApply();
  }
}

// Apply to a single job
async function applyToJob(jobCard, easyApplyButton) {
  try {
    // Get job title - try multiple selectors
    let jobTitle = jobCard.querySelector('.job-card-list__title')?.textContent.trim();
    if (!jobTitle) {
      jobTitle = jobCard.querySelector('.job-card-container__link')?.textContent.trim();
    }
    if (!jobTitle) {
      jobTitle = jobCard.querySelector('a[data-control-name="job_card_title"]')?.textContent.trim();
    }
    if (!jobTitle) {
      jobTitle = jobCard.querySelector('.artdeco-entity-lockup__title')?.textContent.trim();
    }
    if (!jobTitle) {
      jobTitle = 'Unknown Job';
    }

    // Get company name - try multiple selectors
    let companyName = jobCard.querySelector('.job-card-container__primary-description')?.textContent.trim();
    if (!companyName) {
      companyName = jobCard.querySelector('.artdeco-entity-lockup__subtitle')?.textContent.trim();
    }
    if (!companyName) {
      companyName = jobCard.querySelector('.job-card-container__company-name')?.textContent.trim();
    }
    if (!companyName) {
      companyName = 'Unknown Company';
    }

    console.log('📝 Job details:', jobTitle, '|', companyName);

    // Update status
    document.getElementById('autoApplyStatus').textContent =
      `📝 Reviewing: ${jobTitle.substring(0, 30)}...`;

    // Click job card to load details
    jobCard.click();
    await sleep(2000); // Wait for job details to load

    // ASK FOR CONFIRMATION IF BETA MODE IS ENABLED
    if (confirmBeforeApply) {
      const shouldApply = confirm(
        `🧪 BETA TESTING MODE\n\n` +
        `Job: ${jobTitle}\n` +
        `Company: ${companyName}\n\n` +
        `Do you want to apply to this job?\n\n` +
        `✅ Click OK to apply\n` +
        `❌ Click Cancel to skip\n\n` +
        `(You can disable this in the panel)`
      );

      if (!shouldApply) {
        console.log('⏭️ User skipped:', jobTitle);
        showNotification(`⏭️ Skipped: ${jobTitle}`, 'info');
        return false;
      }
    } else {
      console.log('⚡ Auto-applying to:', jobTitle);
    }

    // Click Easy Apply button
    const easyApplyBtn = document.querySelector('.jobs-apply-button');
    if (easyApplyBtn) {
      easyApplyBtn.click();
      await sleep(1500);

      // Handle multi-step application
      const success = await fillApplicationForm();

      if (success) {
        // Track successful application
        trackEvent('job_applied', {
          job_title: jobTitle,
          application_method: 'auto_apply'
        });

        showNotification(`✅ Applied to: ${jobTitle}`, 'success');
        return true;
      }
    }

    return false;
  } catch (error) {
    console.error('Error applying to job:', error);
    return false;
  }
}

// Fill application form (handles multi-step forms)
async function fillApplicationForm() {
  let attempts = 0;
  const maxAttempts = 10; // Max steps in application

  while (attempts < maxAttempts) {
    attempts++;

    // Look for "Next" or "Submit" button
    const nextButton = document.querySelector('[aria-label*="Continue"], [aria-label*="Review"], [aria-label*="Submit"]');

    if (!nextButton) {
      // Check if application is complete
      const successMessage = document.querySelector('[data-test-modal-id="application-success-modal"]');
      if (successMessage) {
        // Close success modal
        const closeButton = document.querySelector('[data-test-modal-close-btn]');
        if (closeButton) closeButton.click();
        return true;
      }
      break;
    }

    // Fill any visible required fields
    await fillRequiredFields();

    // Click next/submit
    nextButton.click();
    await sleep(1500);

    // Check for errors
    const errorMessage = document.querySelector('.artdeco-inline-feedback--error');
    if (errorMessage) {
      // Close modal and skip this job
      const closeButton = document.querySelector('[data-test-modal-close-btn]');
      if (closeButton) {
        closeButton.click();
        await sleep(500);
      }
      return false;
    }
  }

  return false;
}

// Fill required fields in application form
async function fillRequiredFields() {
  // Get user profile data from storage
  const {
    userProfile = {},
    resumeUploaded = false
  } = await chrome.storage.sync.get(['userProfile', 'resumeUploaded']);

  // Fill text inputs
  const textInputs = document.querySelectorAll('input[type="text"][required], input[type="email"][required], input[type="tel"][required]');
  textInputs.forEach(input => {
    if (!input.value) {
      // Try to fill from profile
      const label = input.getAttribute('aria-label') || '';
      if (label.includes('phone') && userProfile.phone) {
        input.value = userProfile.phone;
      } else if (label.includes('email') && userProfile.email) {
        input.value = userProfile.email;
      }
    }
  });

  // Check required radio buttons/checkboxes
  const radioGroups = document.querySelectorAll('fieldset[required]');
  radioGroups.forEach(group => {
    const radios = group.querySelectorAll('input[type="radio"]');
    if (radios.length > 0 && !Array.from(radios).some(r => r.checked)) {
      // Select first option by default
      radios[0].click();
    }
  });
}

// Update application count display
function updateApplicationCount() {
  const countElement = document.getElementById('applicationsCount');
  if (countElement) {
    const limit = JOB_CONFIG.MAX_APPLICATIONS_PER_DAY.premium;
    countElement.textContent = `${applicationsToday} / ${limit}`;
  }
}

// Observe job list for updates (infinite scroll)
function observeJobList() {
  try {
    console.log('👀 Setting up job list observer...');
    const jobList = document.querySelector('.jobs-search-results__list');

    if (!jobList) {
      console.log('⚠️ Job list not found, will try again later');
      return;
    }

    console.log('✅ Job list found, observing changes...');

    const observer = new MutationObserver(() => {
      highlightEasyApplyJobs();
    });

    observer.observe(jobList, {
      childList: true,
      subtree: true,
    });

  } catch (error) {
    console.error('❌ Error observing job list:', error);
  }
}

// Show notification
function showNotification(message, type = 'info') {
  try {
    if (!document.body) {
      console.debug('Body not ready, skipping notification');
      return;
    }

    const notification = document.createElement('div');
    const bgColor = type === 'success' ? '#4ade80' : type === 'error' ? '#ef4444' : type === 'warning' ? '#f59e0b' : '#667eea';

    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: ${bgColor};
      color: white;
      padding: 16px 24px;
      border-radius: 8px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
      z-index: 10001;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      font-weight: 600;
      max-width: 350px;
    `;
    notification.textContent = message;

    document.body.appendChild(notification);

    setTimeout(() => {
      try {
        notification.style.transition = 'opacity 0.3s';
        notification.style.opacity = '0';
        setTimeout(() => {
          try {
            notification.remove();
          } catch (e) {
            console.debug('Error removing notification:', e);
          }
        }, 300);
      } catch (error) {
        console.debug('Error animating notification:', error);
      }
    }, 4000);

  } catch (error) {
    console.debug('Error showing notification:', error);
  }
}

// Helper: Sleep function
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Initialize when page loads
console.log('🚀 Job auto-apply script initializing...');
console.log('📍 Document ready state:', document.readyState);

// Wait for DOM to be ready
function init() {
  console.log('🎬 Running initialization...');
  if (document.readyState === 'loading') {
    console.log('⏳ DOM still loading, waiting for DOMContentLoaded...');
    document.addEventListener('DOMContentLoaded', () => {
      console.log('✅ DOM loaded, initializing...');
      setTimeout(initializeAutoApply, 1000);
    });
  } else {
    console.log('✅ DOM already loaded, initializing immediately...');
    setTimeout(initializeAutoApply, 500);
  }
}

init();

// Re-initialize when navigating (SPA)
let lastUrl = location.href;
console.log('👀 Setting up URL change observer...');

new MutationObserver(() => {
  const url = location.href;
  if (url !== lastUrl) {
    console.log('🔄 URL changed from', lastUrl, 'to', url);
    lastUrl = url;

    // Remove old panel if it exists
    const oldPanel = document.getElementById('linkedin-ai-auto-apply-panel');
    if (oldPanel) {
      console.log('🗑️ Removing old panel...');
      oldPanel.remove();
    }

    // Re-initialize after navigation
    setTimeout(initializeAutoApply, 1500);
  }
}).observe(document, { subtree: true, childList: true });

})(); // End of IIFE
