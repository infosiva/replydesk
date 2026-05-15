# LinkedIn AI Assistant

> AI-powered Chrome extension for LinkedIn - Generate comments, summarize posts, and boost your LinkedIn presence

## Features

- **💬 AI Comments**: Generate thoughtful, professional comments on any LinkedIn post
- **📝 Summarize Posts**: Get instant summaries of long LinkedIn posts
- **✍️ Connection Messages**: Write personalized connection request messages
- **🚀 Post Ideas**: Generate engaging post ideas from any topic

## Installation

### From Chrome Web Store (Coming Soon)
1. Visit [Chrome Web Store](#)
2. Click "Add to Chrome"
3. Start using on LinkedIn!

### Manual Installation (Development)
1. Clone this repository
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode" (top right)
4. Click "Load unpacked"
5. Select the `linkedin-ai-assistant` directory
6. Navigate to LinkedIn and start using!

## Setup

### Option 1: Use Your Own OpenAI API Key (Recommended)

1. Get your API key from [OpenAI Platform](https://platform.openai.com/api-keys)
2. Click the extension icon
3. Enter your API key in settings
4. Save and start using!

**Cost**: ~$0.001 per AI action (very cheap!)

### Option 2: Use Built-in API (Pro Users)

Upgrade to Pro ($9/month) and use our managed API - no setup needed!

## Usage

### Generate AI Comments

1. Open any LinkedIn post
2. Click the **💬 AI Comment** button that appears below the post
3. Review and edit the generated comment
4. Post it!

### Summarize Long Posts

1. Find a long LinkedIn post
2. Click the **📝 Summarize** button
3. Read the instant summary
4. Save time!

## Pricing

### Free Plan
- 10 AI actions per day
- All features included
- Bring your own OpenAI API key

### Pro Plan - $9/month
- Unlimited AI actions
- No API key needed
- Priority support
- Early access to new features

[Upgrade to Pro →](https://linkedin-ai-assistant.com/pricing)

## Privacy & Security

- ✅ No data collection
- ✅ Your API key is stored locally (never sent to our servers)
- ✅ Open-source code (you can review it)
- ✅ Works entirely client-side

## Development

### Tech Stack

- Vanilla JavaScript (no frameworks)
- Chrome Extension Manifest V3
- OpenAI GPT-4 API

### Project Structure

```
linkedin-ai-assistant/
├── manifest.json              # Extension manifest
├── src/
│   ├── background/
│   │   └── service-worker.js  # Background service worker
│   ├── content/
│   │   ├── content-script.js  # Main content script
│   │   └── content-styles.css # Styles
│   ├── popup/
│   │   ├── popup.html         # Extension popup
│   │   └── popup.js           # Popup logic
│   └── lib/
│       └── utils.js           # Utility functions
└── public/
    └── icons/                 # Extension icons
```

### Building

No build step required! Just load the extension in Chrome.

### Testing

1. Load extension in Chrome
2. Navigate to LinkedIn
3. Test features on posts

## Contributing

We welcome contributions! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## Support

- 📧 Email: support@linkedin-ai-assistant.com
- 💬 Discord: [Join our community](#)
- 📝 Docs: [linkedin-ai-assistant.com/docs](#)

## Roadmap

- [ ] Support for other languages
- [ ] Custom AI prompts
- [ ] Post scheduling
- [ ] Analytics dashboard
- [ ] Team collaboration features

## License

MIT License - see LICENSE file

## Domain

Suggested domain: **linkedin-ai-assistant.com**

Alternative: **linkedinai.tools** or **aiforlinkedin.com**

---

Made with ❤️ for LinkedIn power users
