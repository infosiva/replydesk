# Analytics Setup Guide

## Overview
Your LinkedIn AI Assistant extension now has comprehensive analytics tracking built-in. You can track:
- **Installs & Uninstalls** - How many people installed your extension
- **Daily Active Users (DAU)** - How many people use it each day
- **Feature Usage** - Which features are most popular
- **User Journey** - Profile completion, settings saved, etc.
- **Conversions** - Upgrade clicks, trial usage

## Setup Google Analytics 4 (Free)

### Step 1: Create a Google Analytics Account

1. Go to [Google Analytics](https://analytics.google.com/)
2. Click "Start measuring"
3. Create an account name (e.g., "LinkedIn AI Assistant")
4. Choose your data sharing settings
5. Click "Next"

### Step 2: Create a Property

1. Property name: "LinkedIn AI Assistant"
2. Reporting time zone: Select your timezone
3. Currency: Select your currency
4. Click "Next"

### Step 3: Set Up Data Stream

1. Choose platform: **Web** (even though it's an extension, we use web tracking)
2. Website URL: `https://chrome-extension` (placeholder, not important for extensions)
3. Stream name: "LinkedIn AI Extension"
4. Click "Create stream"

### Step 4: Get Your Measurement ID and API Secret

1. After creating the stream, you'll see your **Measurement ID** (format: `G-XXXXXXXXXX`)
2. Copy this ID
3. Scroll down and click "Measurement Protocol API secrets"
4. Click "Create"
5. Give it a nickname: "Extension Analytics"
6. Copy the **API Secret** value

### Step 5: Update Your Extension Code

1. Open `src/background/service-worker.js`
2. Replace the placeholder values:

```javascript
const MEASUREMENT_ID = 'G-XXXXXXXXXX'; // Your actual Measurement ID
const API_SECRET = 'YOUR_API_SECRET';  // Your actual API Secret
```

3. Save the file

### Step 6: (Optional) Update Analytics Library

If you want to use the analytics library in other files:

1. Open `src/lib/analytics.js`
2. Update the config:

```javascript
const ANALYTICS_CONFIG = {
  measurementId: 'G-XXXXXXXXXX', // Your actual Measurement ID
  apiSecret: 'YOUR_API_SECRET',  // Your actual API Secret
  enabled: true,
};
```

## Tracked Events

Your extension now tracks these events automatically:

### Installation & Updates
- `extension_installed` - When user installs the extension
- `extension_updated` - When extension is updated
- `extension_uninstalled` - When user uninstalls

### User Engagement
- `daily_active_user` - Tracked once per day when user opens extension
- `popup_opened` - When user clicks extension icon
- `automation_dashboard_opened` - When user opens automation dashboard

### Settings & Profile
- `api_key_set` - When user saves their OpenAI API key
- `settings_saved` - When user saves settings
- `profile_completed_first_time` - When user completes required profile fields

### Auto-Apply Feature
- `auto_apply_started` - When user clicks "Start Auto-Applying"
- `auto_apply_stopped` - When user stops auto-apply
- `job_applied` - Each time a job application is submitted (includes job title)

### Conversions
- `upgrade_clicked` - When user clicks upgrade button
- `upgraded` - When user upgrades to paid plan (future)

## View Your Analytics

1. Go to [Google Analytics](https://analytics.google.com/)
2. Select your property: "LinkedIn AI Assistant"
3. Navigate to **Reports** > **Real-time** to see live data
4. Navigate to **Reports** > **Engagement** > **Events** to see all events

## Key Metrics to Monitor

### Growth Metrics
- **Total Installs**: Go to Events > `extension_installed`
- **Daily Active Users**: Go to Events > `daily_active_user`
- **User Retention**: Look at DAU over time

### Feature Usage
- **Auto-Apply Usage**: Count of `auto_apply_started` events
- **Jobs Applied**: Count of `job_applied` events
- **Profile Completion Rate**: % of users who triggered `profile_completed_first_time`

### Conversion Funnel
1. `extension_installed` (top of funnel)
2. `popup_opened` (activated)
3. `profile_completed_first_time` (engaged)
4. `auto_apply_started` (using core feature)
5. `upgrade_clicked` (considering upgrade)

## Custom Dashboards

Create a custom dashboard in GA4:

1. Go to **Explore** in GA4
2. Create a new exploration
3. Add metrics:
   - Daily Active Users
   - Event count for `job_applied`
   - Event count for `auto_apply_started`
4. Add dimensions:
   - User plan (free vs pro)
   - Extension version

## Privacy Considerations

✅ **What We Track:**
- Anonymous user ID (randomly generated)
- Event names and parameters
- User plan type
- Extension version

❌ **What We DON'T Track:**
- Personal information (name, email, phone)
- LinkedIn credentials
- Job application details beyond job titles
- API keys
- User location (beyond what GA collects by default)

## Debugging Analytics

To test if analytics is working:

1. Load the extension in Chrome
2. Open Chrome DevTools console
3. Look for messages like: `📊 Analytics: extension_installed`
4. Go to GA4 Real-time view
5. You should see events appear within 30 seconds

## Alternative: Mixpanel (More Detailed)

If you want more advanced analytics:

1. Sign up at [Mixpanel](https://mixpanel.com/)
2. Get your project token
3. Replace GA4 calls with Mixpanel API
4. Benefits: Better user segmentation, funnels, retention analysis

## Alternative: PostHog (Open Source)

For privacy-focused analytics:

1. Sign up at [PostHog](https://posthog.com/)
2. Self-hostable option available
3. More control over data

## Cost

- **Google Analytics 4**: Free for up to 10M events/month
- **Mixpanel**: Free for up to 20M events/month
- **PostHog**: Free tier available

Your extension will likely stay within free tiers unless you have 100,000+ active users.

## Questions?

If you need help setting this up or want to track additional events, let me know!
