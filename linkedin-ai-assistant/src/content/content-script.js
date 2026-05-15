// Content script for LinkedIn AI Assistant
// This script runs on LinkedIn pages and adds AI buttons

// Wrap in IIFE to avoid variable conflicts with other content scripts
(function() {
  'use strict';

  console.log('🤖 LinkedIn AI Assistant loaded');

  // Configuration
  const CONFIG = {
  FREE_DAILY_LIMIT: 10,
  GROQ_ENDPOINT: 'https://api.groq.com/openai/v1/chat/completions',
  GROQ_MODEL: 'llama-3.3-70b-versatile',
  ANTHROPIC_ENDPOINT: 'https://api.anthropic.com/v1/messages',
  ANTHROPIC_MODEL: 'claude-haiku-4-5-20251001',
};

// Initialize AI buttons on LinkedIn posts
function initializeAIButtons() {
  try {
    // Safety check
    if (!document.body) {
      console.debug('Body not ready, skipping AI buttons initialization');
      return;
    }

    // Find all LinkedIn posts
    const posts = document.querySelectorAll('.feed-shared-update-v2');

    posts.forEach((post) => {
      try {
        // Skip if already processed
        if (post.querySelector('.linkedin-ai-button')) {
          return;
        }

        // Get post content
        const content = post.querySelector('.feed-shared-text')?.textContent || '';

        // Create AI button container
        const buttonContainer = document.createElement('div');
        buttonContainer.className = 'linkedin-ai-button-container';
        buttonContainer.style.cssText = `
          display: flex;
          gap: 8px;
          margin-top: 8px;
          padding: 8px;
          background: linear-gradient(135deg, #667eea15 0%, #764ba215 100%);
          border-radius: 8px;
        `;

        // Generate Comment button
        const commentButton = createAIButton('💬 AI Comment', async () => {
          await handleGenerateComment(post, content);
        });

        // Summarize button (only for long posts)
        if (content.length > 200) {
          const summarizeButton = createAIButton('📝 Summarize', async () => {
            await handleSummarize(post, content);
          });
          buttonContainer.appendChild(summarizeButton);
        }

        buttonContainer.appendChild(commentButton);

        // Insert buttons after post actions
        const socialActions = post.querySelector('.feed-shared-social-action-bar');
        if (socialActions && socialActions.parentNode) {
          socialActions.parentNode.insertBefore(buttonContainer, socialActions.nextSibling);
        }
      } catch (error) {
        // Silently skip this post if there's an error
        console.debug('Error adding AI buttons to post:', error);
      }
    });
  } catch (error) {
    console.debug('Error initializing AI buttons:', error);
  }
}

// Create AI button
function createAIButton(text, onClick) {
  const button = document.createElement('button');
  button.className = 'linkedin-ai-button';
  button.textContent = text;
  button.style.cssText = `
    padding: 8px 16px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    border: none;
    border-radius: 6px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  `;

  button.addEventListener('mouseenter', () => {
    button.style.transform = 'translateY(-2px)';
    button.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.4)';
  });

  button.addEventListener('mouseleave', () => {
    button.style.transform = 'translateY(0)';
    button.style.boxShadow = 'none';
  });

  button.addEventListener('click', onClick);

  return button;
}

// Handle generate comment
async function handleGenerateComment(post, postContent) {
  try {
    // Check usage limit
    const canUse = await checkUsageLimit();
    if (!canUse) {
      showUpgradeModal();
      return;
    }

    // Show loading
    const loadingElement = showLoading(post);

    // Generate comment
    const comment = await generateComment(postContent);

    // Remove loading
    loadingElement.remove();

    // Insert comment into comment box
    insertComment(post, comment);

    // Increment usage
    await incrementUsage();

    // Show success notification
    showNotification('✅ Comment generated! Edit and post it.', 'success');

  } catch (error) {
    console.error('Error generating comment:', error);
    showNotification('❌ Failed to generate comment. Add a Groq API key in settings (free).', 'error');
  }
}

// Handle summarize
async function handleSummarize(post, postContent) {
  try {
    // Check usage limit
    const canUse = await checkUsageLimit();
    if (!canUse) {
      showUpgradeModal();
      return;
    }

    // Show loading
    const loadingElement = showLoading(post);

    // Generate summary
    const summary = await generateSummary(postContent);

    // Remove loading
    loadingElement.remove();

    // Show summary modal
    showSummaryModal(summary);

    // Increment usage
    await incrementUsage();

  } catch (error) {
    console.error('Error generating summary:', error);
    showNotification('❌ Failed to generate summary. Add a Groq API key in settings (free).', 'error');
  }
}

// Call AI with Groq → Anthropic fallback
async function callAI(systemPrompt, userPrompt, maxTokens) {
  const { groqApiKey, anthropicApiKey } = await chrome.storage.sync.get(['groqApiKey', 'anthropicApiKey']);

  // Try Groq first (free tier)
  if (groqApiKey) {
    try {
      const response = await fetch(CONFIG.GROQ_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${groqApiKey}`,
        },
        body: JSON.stringify({
          model: CONFIG.GROQ_MODEL,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          max_tokens: maxTokens,
        }),
      });
      if (response.ok) {
        const data = await response.json();
        return data.choices[0].message.content.trim();
      }
    } catch (e) {
      console.debug('Groq failed, trying Anthropic:', e.message);
    }
  }

  // Fallback to Anthropic
  if (anthropicApiKey) {
    const response = await fetch(CONFIG.ANTHROPIC_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicApiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: CONFIG.ANTHROPIC_MODEL,
        max_tokens: maxTokens,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    });
    if (response.ok) {
      const data = await response.json();
      return data.content[0].text.trim();
    }
  }

  throw new Error('No API key configured. Please add a Groq API key (free) in extension settings.');
}

// Generate comment using Groq → Anthropic fallback
async function generateComment(postContent) {
  return callAI(
    'You are a professional LinkedIn user who writes engaging, thoughtful comments.',
    `Write a thoughtful, professional LinkedIn comment for this post. Keep it engaging but concise (2-3 sentences). Be authentic and add value to the conversation.\n\nPost: "${postContent.substring(0, 500)}"\n\nComment:`,
    150
  );
}

// Generate summary using Groq → Anthropic fallback
async function generateSummary(postContent) {
  return callAI(
    'You are a helpful assistant that summarizes content clearly.',
    `Summarize this LinkedIn post in 2-3 bullet points. Focus on key insights and main takeaways.\n\nPost: "${postContent}"\n\nSummary:`,
    200
  );
}

// Insert comment into LinkedIn comment box
function insertComment(post, comment) {
  try {
    // Click comment button to open comment box
    const commentButton = post.querySelector('button[aria-label*="Comment"]');
    if (commentButton) {
      commentButton.click();
    }

    // Wait a bit for comment box to appear
    setTimeout(() => {
      try {
        const commentBox = post.querySelector('.ql-editor[contenteditable="true"]');
        if (commentBox) {
          commentBox.focus();
          commentBox.textContent = comment;

          // Trigger input event
          const event = new Event('input', { bubbles: true });
          commentBox.dispatchEvent(event);
        }
      } catch (error) {
        console.debug('Error inserting comment:', error);
      }
    }, 500);
  } catch (error) {
    console.debug('Error in insertComment:', error);
  }
}

// Show loading indicator
function showLoading(post) {
  try {
    const loading = document.createElement('div');
    loading.style.cssText = `
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: rgba(255, 255, 255, 0.95);
      padding: 20px;
      border-radius: 12px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
      z-index: 1000;
      text-align: center;
    `;
    loading.innerHTML = `
      <div style="font-size: 24px; margin-bottom: 8px;">🤖</div>
      <div style="font-weight: 600; color: #667eea;">AI is thinking...</div>
    `;

    post.style.position = 'relative';
    if (post && post.appendChild) {
      post.appendChild(loading);
    }

    return loading;
  } catch (error) {
    console.debug('Error showing loading:', error);
    return { remove: () => {} }; // Return dummy object
  }
}

// Show notification
function showNotification(message, type = 'info') {
  try {
    if (!document.body) return;

    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: ${type === 'success' ? '#4ade80' : type === 'error' ? '#ef4444' : '#667eea'};
      color: white;
      padding: 16px 24px;
      border-radius: 8px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
      z-index: 10000;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      font-weight: 600;
      animation: slideIn 0.3s ease-out;
    `;
    notification.textContent = message;

    document.body.appendChild(notification);

    setTimeout(() => {
      notification.style.animation = 'slideOut 0.3s ease-out';
      setTimeout(() => notification.remove(), 300);
    }, 3000);
  } catch (error) {
    console.debug('Error showing notification:', error);
  }
}

// Show summary modal
function showSummaryModal(summary) {
  try {
    if (!document.body) return;

    const modal = document.createElement('div');
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
    `;

    modal.innerHTML = `
      <div style="
        background: white;
        padding: 32px;
        border-radius: 16px;
        max-width: 600px;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      ">
        <h2 style="
          margin: 0 0 16px 0;
          font-size: 24px;
          font-weight: 700;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        ">📝 AI Summary</h2>
        <div style="
          font-size: 15px;
          line-height: 1.6;
          color: #333;
          margin-bottom: 24px;
        ">${summary}</div>
        <button id="closeSummaryBtn" style="
          padding: 12px 24px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          border: none;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
        ">Close</button>
      </div>
    `;

    document.body.appendChild(modal);

    modal.addEventListener('click', (e) => {
      if (e.target === modal || e.target.id === 'closeSummaryBtn') {
        modal.remove();
      }
    });
  } catch (error) {
    console.debug('Error showing summary modal:', error);
  }
}

// Show upgrade modal
function showUpgradeModal() {
  try {
    if (!document.body) return;

    const modal = document.createElement('div');
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
    `;

    modal.innerHTML = `
      <div style="
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        padding: 40px;
        border-radius: 20px;
        max-width: 500px;
        text-align: center;
        color: white;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      ">
        <div style="font-size: 48px; margin-bottom: 16px;">🚀</div>
        <h2 style="
          margin: 0 0 12px 0;
          font-size: 28px;
          font-weight: 700;
        ">Upgrade to Pro</h2>
        <p style="
          font-size: 16px;
          opacity: 0.9;
          margin-bottom: 24px;
        ">You've reached your daily limit of 10 AI actions. Upgrade to Pro for unlimited access!</p>
        <div style="
          background: rgba(255, 255, 255, 0.2);
          padding: 20px;
          border-radius: 12px;
          margin-bottom: 24px;
        ">
          <div style="font-size: 32px; font-weight: 700; margin-bottom: 4px;">$9/month</div>
          <div style="font-size: 14px; opacity: 0.9;">Unlimited AI comments & summaries</div>
        </div>
        <button id="upgradeNowBtn" style="
          width: 100%;
          padding: 16px;
          background: white;
          color: #667eea;
          border: none;
          border-radius: 12px;
          font-size: 16px;
          font-weight: 700;
          cursor: pointer;
          margin-bottom: 12px;
        ">Upgrade Now</button>
        <button id="closeUpgradeBtn" style="
          width: 100%;
          padding: 16px;
          background: rgba(255, 255, 255, 0.2);
          color: white;
          border: none;
          border-radius: 12px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
        ">Maybe Later</button>
      </div>
    `;

    document.body.appendChild(modal);

    const upgradeBtn = document.getElementById('upgradeNowBtn');
    const closeBtn = document.getElementById('closeUpgradeBtn');

    if (upgradeBtn) {
      upgradeBtn.addEventListener('click', () => {
        alert('Pricing page coming soon! For now, enjoy all features for free.');
        // window.open('https://linkedin-ai-assistant.com/pricing', '_blank');
        modal.remove();
      });
    }

    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        modal.remove();
      });
    }
  } catch (error) {
    console.debug('Error showing upgrade modal:', error);
  }
}

// Check usage limit
async function checkUsageLimit() {
  const { usageCount = 0, plan = 'free' } = await chrome.storage.sync.get(['usageCount', 'plan']);

  if (plan === 'pro') {
    return true;
  }

  return usageCount < CONFIG.FREE_DAILY_LIMIT;
}

// Increment usage count
async function incrementUsage() {
  const { usageCount = 0 } = await chrome.storage.sync.get('usageCount');
  await chrome.storage.sync.set({ usageCount: usageCount + 1 });
}

// Initialize on page load
function init() {
  // Wait for body to be available
  if (!document.body) {
    setTimeout(init, 100);
    return;
  }

  initializeAIButtons();

  // Re-initialize when new posts are loaded (infinite scroll)
  const observer = new MutationObserver(() => {
    initializeAIButtons();
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });
}

// Start initialization
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// Add required CSS animations
function addStyles() {
    try {
      if (!document.head) {
        setTimeout(addStyles, 100);
        return;
      }

      const style = document.createElement('style');
      style.textContent = `
        @keyframes slideIn {
          from {
            transform: translateX(400px);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }

        @keyframes slideOut {
          from {
            transform: translateX(0);
            opacity: 1;
          }
          to {
            transform: translateX(400px);
            opacity: 0;
          }
        }
      `;
      document.head.appendChild(style);
    } catch (error) {
      console.debug('Error adding styles:', error);
    }
  }

  addStyles();

})(); // End of IIFE
