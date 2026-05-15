// LinkedIn Full Automation Suite
// This script handles all automated LinkedIn activities

// Wrap in IIFE to avoid variable conflicts with other content scripts
(function() {
  'use strict';

  console.log('🤖 LinkedIn Automation Suite loaded');

  // Configuration
  const AUTOMATION_CONFIG = {
  LIMITS: {
    autoComment: 20,    // per day
    autoReact: 50,      // per day
    autoReply: 30,      // per day
    autoConnect: 10,    // per day (LinkedIn limits connections)
    autoAccept: 100,    // per day
  },
  DELAYS: {
    min: 30000,  // 30 seconds
    max: 120000, // 2 minutes
  },
  CHECK_INTERVAL: 60000, // Check for new content every minute
};

// Automation state
let automationState = {
  isRunning: false,
  settings: {},
  todayStats: {},
  intervals: {},
};

// Initialize automation
async function initializeAutomation() {
  // Load settings
  await loadSettings();

  // Reset daily stats if new day
  await checkAndResetDailyStats();

  // Start automation intervals
  startAutomationIntervals();

  // Listen for settings changes
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'reloadAutomationSettings') {
      loadSettings();
    }
  });
}

// Load settings from storage
async function loadSettings() {
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
    'commentsPostedToday',
    'reactionsGivenToday',
    'repliesPostedToday',
    'connectRequestsToday',
    'connectsAcceptedToday',
    'lastAutomationDate',
  ]);

  automationState.settings = settings;
  automationState.todayStats = {
    comments: settings.commentsPostedToday || 0,
    reactions: settings.reactionsGivenToday || 0,
    replies: settings.repliesPostedToday || 0,
    connects: settings.connectRequestsToday || 0,
    accepts: settings.connectsAcceptedToday || 0,
  };
}

// Check and reset daily stats
async function checkAndResetDailyStats() {
  const { lastAutomationDate } = await chrome.storage.sync.get('lastAutomationDate');
  const today = new Date().toDateString();

  if (lastAutomationDate !== today) {
    // New day - reset all stats
    await chrome.storage.sync.set({
      commentsPostedToday: 0,
      reactionsGivenToday: 0,
      repliesPostedToday: 0,
      connectRequestsToday: 0,
      connectsAcceptedToday: 0,
      lastAutomationDate: today,
    });

    automationState.todayStats = {
      comments: 0,
      reactions: 0,
      replies: 0,
      connects: 0,
      accepts: 0,
    };
  }
}

// Start all automation intervals
function startAutomationIntervals() {
  // Auto-comment on posts
  if (automationState.settings.autoCommentEnabled) {
    automationState.intervals.comment = setInterval(
      autoCommentOnPosts,
      AUTOMATION_CONFIG.CHECK_INTERVAL
    );
  }

  // Auto-react to posts
  if (automationState.settings.autoReactEnabled) {
    automationState.intervals.react = setInterval(
      autoReactToPosts,
      AUTOMATION_CONFIG.CHECK_INTERVAL / 2 // More frequent
    );
  }

  // Auto-reply to comments
  if (automationState.settings.autoReplyEnabled) {
    automationState.intervals.reply = setInterval(
      autoReplyToComments,
      AUTOMATION_CONFIG.CHECK_INTERVAL
    );
  }

  // Auto-connect with people
  if (automationState.settings.autoConnectEnabled) {
    automationState.intervals.connect = setInterval(
      autoConnectWithPeople,
      AUTOMATION_CONFIG.CHECK_INTERVAL * 2 // Less frequent
    );
  }

  // Auto-accept connections
  if (automationState.settings.autoAcceptEnabled) {
    automationState.intervals.accept = setInterval(
      autoAcceptConnections,
      AUTOMATION_CONFIG.CHECK_INTERVAL
    );
  }
}

// Auto-comment on posts in feed
async function autoCommentOnPosts() {
  // Check if premium
  if (automationState.settings.plan !== 'premium') return;

  // Check daily limit
  if (automationState.todayStats.comments >= AUTOMATION_CONFIG.LIMITS.autoComment) {
    console.log('⚠️ Auto-comment daily limit reached');
    return;
  }

  // Find posts in feed (that don't have our comment yet)
  const posts = document.querySelectorAll('.feed-shared-update-v2:not(.ai-commented)');

  if (posts.length === 0) return;

  // Pick a random post
  const post = posts[Math.floor(Math.random() * posts.length)];

  try {
    // Get post content
    const contentElement = post.querySelector('.feed-shared-text');
    if (!contentElement) return;

    const postContent = contentElement.textContent.trim();

    // Generate AI comment
    const comment = await generateAIComment(postContent);
    if (!comment) return;

    // Post the comment
    await postComment(post, comment);

    // Mark as commented
    post.classList.add('ai-commented');

    // Update stats
    automationState.todayStats.comments++;
    await chrome.storage.sync.set({
      commentsPostedToday: automationState.todayStats.comments
    });

    // Show notification
    if (automationState.settings.successNotifEnabled) {
      showNotification('✅ Auto-commented on a post', 'success');
    }

    // Wait before next action
    await randomDelay();

  } catch (error) {
    console.error('Error auto-commenting:', error);
  }
}

// Auto-react to posts in feed
async function autoReactToPosts() {
  // Check daily limit
  if (automationState.todayStats.reactions >= AUTOMATION_CONFIG.LIMITS.autoReact) {
    return;
  }

  // Find posts without our reaction
  const posts = document.querySelectorAll('.feed-shared-update-v2:not(.ai-reacted)');

  if (posts.length === 0) return;

  // Pick a random post
  const post = posts[Math.floor(Math.random() * posts.length)];

  try {
    // Find like button
    const likeButton = post.querySelector('button[aria-label*="React"]');
    if (!likeButton) return;

    // Click like button
    likeButton.click();

    // Mark as reacted
    post.classList.add('ai-reacted');

    // Update stats
    automationState.todayStats.reactions++;
    await chrome.storage.sync.set({
      reactionsGivenToday: automationState.todayStats.reactions
    });

    // Wait before next action
    await randomDelay(10000, 30000); // Shorter delay for reactions

  } catch (error) {
    console.error('Error auto-reacting:', error);
  }
}

// Auto-reply to comments on user's posts
async function autoReplyToComments() {
  // Check if premium
  if (automationState.settings.plan !== 'premium') return;

  // Check daily limit
  if (automationState.todayStats.replies >= AUTOMATION_CONFIG.LIMITS.autoReply) {
    return;
  }

  // This would need to check notifications or specific post URLs
  // For now, placeholder - would need user to navigate to their post

  console.log('Auto-reply: Feature requires user to be on their own post');
}

// Auto-connect with people
async function autoConnectWithPeople() {
  // Check if premium
  if (automationState.settings.plan !== 'premium') return;

  // Check daily limit
  if (automationState.todayStats.connects >= AUTOMATION_CONFIG.LIMITS.autoConnect) {
    return;
  }

  // Only works on "People you may know" or search results page
  const connectButtons = document.querySelectorAll('button[aria-label*="Invite"][aria-label*="to connect"]:not(.ai-connected)');

  if (connectButtons.length === 0) return;

  // Pick first button
  const button = connectButtons[0];

  try {
    // Click connect
    button.click();

    await sleep(1000);

    // Look for "Add a note" option and add personalized message
    const addNoteButton = document.querySelector('button[aria-label*="Add a note"]');
    if (addNoteButton) {
      addNoteButton.click();

      await sleep(1000);

      // Generate personalized message
      const name = button.getAttribute('aria-label').match(/Invite (.*?) to connect/)?.[1] || 'there';
      const message = await generateConnectionMessage(name);

      // Fill in message
      const messageBox = document.querySelector('textarea[name="message"]');
      if (messageBox && message) {
        messageBox.value = message;

        // Click send
        const sendButton = document.querySelector('button[aria-label*="Send"]');
        if (sendButton) {
          sendButton.click();
        }
      }
    } else {
      // Just send without note
      const sendButton = document.querySelector('button[aria-label*="Send now"]');
      if (sendButton) {
        sendButton.click();
      }
    }

    // Mark as connected
    button.classList.add('ai-connected');

    // Update stats
    automationState.todayStats.connects++;
    await chrome.storage.sync.set({
      connectRequestsToday: automationState.todayStats.connects
    });

    // Show notification
    if (automationState.settings.successNotifEnabled) {
      showNotification('✅ Sent connection request', 'success');
    }

    // Wait before next action
    await randomDelay();

  } catch (error) {
    console.error('Error auto-connecting:', error);
  }
}

// Auto-accept connection requests
async function autoAcceptConnections() {
  // Check daily limit
  if (automationState.todayStats.accepts >= AUTOMATION_CONFIG.LIMITS.autoAccept) {
    return;
  }

  // Only works on notifications page
  if (!window.location.href.includes('/notifications')) return;

  // Find "Accept" buttons
  const acceptButtons = document.querySelectorAll('button[aria-label*="Accept"]:not(.ai-accepted)');

  if (acceptButtons.length === 0) return;

  // Accept first request
  const button = acceptButtons[0];

  try {
    button.click();

    // Mark as accepted
    button.classList.add('ai-accepted');

    // Update stats
    automationState.todayStats.accepts++;
    await chrome.storage.sync.set({
      connectsAcceptedToday: automationState.todayStats.accepts
    });

    // Wait before next
    await randomDelay(5000, 15000); // Shorter delay for accepts

  } catch (error) {
    console.error('Error auto-accepting:', error);
  }
}

// Generate AI comment
async function generateAIComment(postContent) {
  const { apiKey } = await chrome.storage.sync.get('apiKey');
  if (!apiKey) return null;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a professional LinkedIn user. Write brief, thoughtful comments (1-2 sentences).'
          },
          {
            role: 'user',
            content: `Write a professional LinkedIn comment for this post: "${postContent.substring(0, 500)}"`
          }
        ],
        temperature: 0.8,
        max_tokens: 100,
      }),
    });

    const data = await response.json();
    return data.choices[0].message.content.trim();
  } catch (error) {
    console.error('Error generating comment:', error);
    return null;
  }
}

// Generate connection message
async function generateConnectionMessage(name) {
  const { apiKey, fullName } = await chrome.storage.sync.get(['apiKey', 'fullName']);
  if (!apiKey) return null;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'Write brief, professional LinkedIn connection messages (2-3 sentences max).'
          },
          {
            role: 'user',
            content: `Write a connection request message to ${name}. Keep it professional and brief.`
          }
        ],
        temperature: 0.7,
        max_tokens: 80,
      }),
    });

    const data = await response.json();
    return data.choices[0].message.content.trim();
  } catch (error) {
    console.error('Error generating message:', error);
    return `Hi ${name}, I'd like to connect with you on LinkedIn!`;
  }
}

// Post a comment
async function postComment(post, commentText) {
  try {
    // Click comment button
    const commentButton = post.querySelector('button[aria-label*="Comment"]');
    if (commentButton) {
      commentButton.click();
    }

    await sleep(1000);

    // Find comment box
    const commentBox = post.querySelector('.ql-editor[contenteditable="true"]');
    if (!commentBox) return;

    // Set comment text
    commentBox.focus();
    commentBox.textContent = commentText;

    // Trigger input event
    const event = new Event('input', { bubbles: true });
    commentBox.dispatchEvent(event);

    await sleep(500);

    // Click post button
    const postButton = post.querySelector('button[class*="comment-button"]');
    if (postButton && !postButton.disabled) {
      postButton.click();
    }
  } catch (error) {
    console.debug('Error posting comment:', error);
  }
}

// Random delay (human-like)
async function randomDelay(min, max) {
  min = min || AUTOMATION_CONFIG.DELAYS.min;
  max = max || AUTOMATION_CONFIG.DELAYS.max;

  const delay = Math.random() * (max - min) + min;
  await sleep(delay);
}

// Show notification
function showNotification(message, type = 'info') {
  try {
    if (!document.body) return;

    const notification = document.createElement('div');
    const bgColor = type === 'success' ? '#4ade80' : type === 'error' ? '#ef4444' : '#667eea';

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
      notification.style.transition = 'opacity 0.3s';
      notification.style.opacity = '0';
      setTimeout(() => notification.remove(), 300);
    }, 4000);
  } catch (error) {
    console.debug('Error showing notification:', error);
  }
}

// Helper: Sleep
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Initialize when ready
function init() {
  // Wait for body to be available
  if (!document.body) {
    setTimeout(init, 100);
    return;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeAutomation);
  } else {
    initializeAutomation();
  }

  // Re-initialize on navigation
  let lastUrl = location.href;
  new MutationObserver(() => {
    const url = location.href;
    if (url !== lastUrl) {
      lastUrl = url;
      setTimeout(initializeAutomation, 2000);
    }
  }).observe(document.body, { subtree: true, childList: true });
}

init();

})(); // End of IIFE
