# FEAR JUSTICE 🗞️

A fully automated leftist news dashboard. Brutalist. Dark mode. For the people.

**Live at:** [fearjustice.com](https://fearjustice.com)

## Features

- 📰 Aggregates news from Democracy Now!, The Intercept, Jacobin, Common Dreams, and Truthout
- 🤖 AI-powered summaries via Google Gemini (3 bullet points, Gen Z style)
- 🔥 Automatic "sensationalism ranking" puts the hottest stories first
- 🐦 Auto-posts headlines to [@fearjustice](https://twitter.com/fearjustice)
- ⏰ Updates every 6 hours via GitHub Actions
- 🚀 Deployed on Vercel (free tier compatible)

## Setup

### 1. Clone and install

```bash
git clone https://github.com/grantyamada/fearjustice.git
cd fearjustice
npm install
```

### 2. Get API Keys

**Google Gemini (required):**
1. Go to [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Create an API key
3. Add to GitHub Secrets as `GEMINI_API_KEY`

**Twitter/X (optional, for auto-posting):**
1. Go to [Twitter Developer Portal](https://developer.twitter.com/en/portal/dashboard)
2. Create a project with Free tier
3. Generate API keys and access tokens
4. Add to GitHub Secrets:
   - `TWITTER_API_KEY`
   - `TWITTER_API_SECRET`
   - `TWITTER_ACCESS_TOKEN`
   - `TWITTER_ACCESS_SECRET`

### 3. Deploy to Vercel

```bash
npm i -g vercel
vercel
```

Or connect your GitHub repo at [vercel.com](https://vercel.com).

### 4. Configure GitHub Secrets

Go to your repo → Settings → Secrets and variables → Actions → New repository secret

Add:
- `GEMINI_API_KEY` (required)
- `TWITTER_API_KEY` (optional)
- `TWITTER_API_SECRET` (optional)
- `TWITTER_ACCESS_TOKEN` (optional)
- `TWITTER_ACCESS_SECRET` (optional)

### 5. Enable GitHub Actions

The workflow runs automatically every 6 hours. To trigger manually:
1. Go to Actions tab
2. Select "Update News Feed"
3. Click "Run workflow"

## Local Development

```bash
# Copy env file
cp .env.example .env.local
# Edit with your keys

# Run news update locally
npm run update-news

# Start dev server
npm run dev
```

## Project Structure

```
fearjustice/
├── app/
│   ├── layout.tsx      # Root layout
│   ├── page.tsx        # Main dashboard
│   └── globals.css     # Brutalist dark theme
├── content/
│   └── news.json       # Generated news data
├── scripts/
│   └── update-news.js  # News fetching + AI summarization
├── .github/
│   └── workflows/
│       └── daily-update.yml  # GitHub Actions automation
└── package.json
```

## Revenue Ideas

- Minimal ads via [Carbon Ads](https://www.carbonads.net/) (developer-focused, non-intrusive)
- Newsletter signup with [Buttondown](https://buttondown.email/) (free tier)
- Donation button via [Ko-fi](https://ko-fi.com/) or [Buy Me a Coffee](https://www.buymeacoffee.com/)
- Premium "no ads" tier via [GitHub Sponsors](https://github.com/sponsors)

## License

MIT — Fork it, remix it, spread the word.
