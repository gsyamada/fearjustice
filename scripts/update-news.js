const Parser = require('rss-parser');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { TwitterApi } = require('twitter-api-v2');
const fs = require('fs');
const path = require('path');

const RSS_FEEDS = [
  // Core leftist news
  { name: 'Democracy Now!', url: 'https://www.democracynow.org/democracynow.rss' },
  { name: 'The Intercept', url: 'https://theintercept.com/feed/?rss' },
  { name: 'Jacobin', url: 'https://jacobin.com/feed' },
  { name: 'Common Dreams', url: 'https://www.commondreams.org/feeds/news.rss' },
  { name: 'Truthout', url: 'https://truthout.org/feed/' },
  // Labor & unions
  { name: 'Labor Notes', url: 'https://labornotes.org/rss.xml' },
  { name: 'In These Times', url: 'https://inthesetimes.com/feed' },
  // Investigative & progressive
  { name: 'The Nation', url: 'https://www.thenation.com/feed/' },
  { name: 'Mother Jones', url: 'https://www.motherjones.com/feed/' },
  { name: 'ProPublica', url: 'https://www.propublica.org/feeds/propublica/main' },
  // International & anti-war
  { name: 'Mondoweiss', url: 'https://mondoweiss.net/feed/' },
  { name: 'The Grayzone', url: 'https://thegrayzone.com/feed/' },
  // Socialist/Marxist
  { name: 'Current Affairs', url: 'https://www.currentaffairs.org/feed' },
  { name: 'Left Voice', url: 'https://www.leftvoice.org/feed/' },
];

// Known paywalled domains
const PAYWALLED_DOMAINS = [
  'nytimes.com',
  'washingtonpost.com',
  'wsj.com',
  'economist.com',
  'ft.com',
  'bloomberg.com',
  'theatlantic.com',
  'newyorker.com',
  'thenation.com',
  'currentaffairs.org',
  'jacobin.com', // soft paywall
];

// Paywall indicators in HTML
const PAYWALL_INDICATORS = [
  'paywall',
  'subscribe to read',
  'subscribe to continue',
  'subscription required',
  'members only',
  'premium content',
  'register to read',
  'sign in to read',
  'unlock this article',
  'for subscribers',
  'paid subscribers',
];

const parser = new Parser({
  timeout: 10000,
  headers: { 'User-Agent': 'FearJustice News Bot/1.0' }
});

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const twitterClient = process.env.TWITTER_API_KEY ? new TwitterApi({
  appKey: process.env.TWITTER_API_KEY,
  appSecret: process.env.TWITTER_API_SECRET,
  accessToken: process.env.TWITTER_ACCESS_TOKEN,
  accessSecret: process.env.TWITTER_ACCESS_SECRET,
}) : null;

function checkDomainPaywall(url) {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return PAYWALLED_DOMAINS.some(domain => hostname.includes(domain));
  } catch {
    return false;
  }
}

async function checkArticlePaywall(url) {
  // First check if domain is known paywalled
  if (checkDomainPaywall(url)) {
    return { isPaywalled: true, method: 'domain' };
  }
  
  // Try fetching the page to check for paywall indicators
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    
    const response = await fetch(url, {
      headers: { 
        'User-Agent': 'Mozilla/5.0 (compatible; FearJustice/1.0)',
        'Accept': 'text/html'
      },
      signal: controller.signal,
      redirect: 'follow'
    });
    
    clearTimeout(timeout);
    
    if (!response.ok) {
      return { isPaywalled: false, method: 'none' };
    }
    
    const html = await response.text();
    const lowerHtml = html.toLowerCase();
    
    for (const indicator of PAYWALL_INDICATORS) {
      if (lowerHtml.includes(indicator)) {
        return { isPaywalled: true, method: 'content' };
      }
    }
    
    return { isPaywalled: false, method: 'none' };
  } catch (err) {
    // If we can't fetch, assume not paywalled
    return { isPaywalled: false, method: 'error' };
  }
}

async function fetchAllFeeds() {
  const allArticles = [];
  
  for (const feed of RSS_FEEDS) {
    try {
      console.log(`Fetching ${feed.name}...`);
      const parsed = await parser.parseURL(feed.url);
      const articles = parsed.items.slice(0, 5).map(item => ({
        title: item.title,
        link: item.link,
        content: item.contentSnippet || item.content || item.summary || '',
        pubDate: item.pubDate || item.isoDate,
        source: feed.name,
      }));
      allArticles.push(...articles);
    } catch (err) {
      console.error(`Failed to fetch ${feed.name}:`, err.message);
    }
  }
  
  return allArticles.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));
}

async function summarizeArticle(article) {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    
    const prompt = `You are a hard-hitting leftist news editor. Summarize this news story in exactly 2 short, punchy bullet points for a Gen Z audience. Each bullet must be under 80 characters. Be direct, emphasize systemic issues. No fluff.

Title: ${article.title}
Content: ${article.content.slice(0, 2000)}

Format: exactly 2 bullet points, each on its own line starting with •. Keep each bullet under 80 characters.`;

    const result = await model.generateContent(prompt);
    const summary = result.response.text();
    
    return {
      ...article,
      summary: summary.trim(),
      summarizedAt: new Date().toISOString(),
    };
  } catch (err) {
    console.error(`Failed to summarize "${article.title}":`, err.message);
    return {
      ...article,
      summary: `• ${article.content.slice(0, 200)}...`,
      summarizedAt: new Date().toISOString(),
    };
  }
}

function rankBySensationalism(articles) {
  const hotKeywords = [
    'breaking', 'urgent', 'crisis', 'scandal', 'exposed', 'billionaire',
    'strike', 'protest', 'revolt', 'uprising', 'war', 'genocide', 'death',
    'corruption', 'leaked', 'secret', 'police', 'shooting', 'racist',
    'climate', 'disaster', 'collapse', 'fascist', 'coup', 'riot'
  ];
  
  return articles.map(article => {
    const text = (article.title + ' ' + article.summary).toLowerCase();
    let score = 0;
    hotKeywords.forEach(keyword => {
      if (text.includes(keyword)) score += 10;
    });
    if (article.title.includes('!')) score += 5;
    if (article.title === article.title.toUpperCase()) score += 15;
    const hoursOld = (Date.now() - new Date(article.pubDate)) / (1000 * 60 * 60);
    score += Math.max(0, 50 - hoursOld);
    return { ...article, sensationalismScore: score };
  }).sort((a, b) => b.sensationalismScore - a.sensationalismScore);
}

async function postToTwitter(article) {
  if (!twitterClient) {
    console.log('Twitter not configured, skipping post');
    return;
  }
  
  try {
    const rwClient = twitterClient.readWrite;
    const headline = article.title.slice(0, 200);
    const tweet = `🔥 ${headline}\n\n${article.link}\n\n#News #Politics`;
    
    await rwClient.v2.tweet(tweet);
    console.log(`Posted to Twitter: ${headline}`);
  } catch (err) {
    console.error('Failed to post to Twitter:', err.message);
  }
}

async function main() {
  console.log('=== Fear Justice News Update ===');
  console.log(`Time: ${new Date().toISOString()}\n`);
  
  const articles = await fetchAllFeeds();
  console.log(`\nFetched ${articles.length} articles total\n`);
  
  if (articles.length === 0) {
    console.error('No articles fetched, exiting');
    process.exit(1);
  }
  
  console.log('Summarizing articles and checking paywalls...\n');
  const summarized = [];
  for (const article of articles.slice(0, 20)) {
    const result = await summarizeArticle(article);
    
    // Check paywall status
    console.log(`  Checking paywall: ${article.title.slice(0, 50)}...`);
    const paywallStatus = await checkArticlePaywall(article.link);
    result.isPaywalled = paywallStatus.isPaywalled;
    
    summarized.push(result);
    await new Promise(r => setTimeout(r, 800));
  }
  
  const ranked = rankBySensationalism(summarized);
  
  const contentDir = path.join(__dirname, '..', 'content');
  if (!fs.existsSync(contentDir)) {
    fs.mkdirSync(contentDir, { recursive: true });
  }
  
  const newsData = {
    lastUpdated: new Date().toISOString(),
    headline: ranked[0],
    articles: ranked,
  };
  
  fs.writeFileSync(
    path.join(contentDir, 'news.json'),
    JSON.stringify(newsData, null, 2)
  );
  console.log('\nSaved to content/news.json');
  
  if (ranked[0] && process.env.POST_TO_TWITTER === 'true') {
    await postToTwitter(ranked[0]);
  }
  
  console.log('\n=== Update Complete ===');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
