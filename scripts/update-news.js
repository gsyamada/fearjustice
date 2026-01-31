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

async function fetchArticleContent(url) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    
    const response = await fetch(url, {
      headers: { 
        'User-Agent': 'Mozilla/5.0 (compatible; FearJustice/1.0)',
        'Accept': 'text/html'
      },
      signal: controller.signal,
      redirect: 'follow'
    });
    
    clearTimeout(timeout);
    
    if (!response.ok) return null;
    
    const html = await response.text();
    
    // Extract article text - look for common article containers
    const articleMatch = html.match(/<article[^>]*>([\s\S]*?)<\/article>/i) ||
                         html.match(/<div[^>]*class="[^"]*article[^"]*"[^>]*>([\s\S]*?)<\/div>/i) ||
                         html.match(/<div[^>]*class="[^"]*post-content[^"]*"[^>]*>([\s\S]*?)<\/div>/i) ||
                         html.match(/<div[^>]*class="[^"]*entry-content[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
    
    if (articleMatch) {
      // Strip HTML tags and clean up
      let text = articleMatch[1]
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      return text.slice(0, 6000);
    }
    
    // Fallback: get all paragraph text
    const paragraphs = html.match(/<p[^>]*>([^<]+)<\/p>/gi);
    if (paragraphs) {
      const text = paragraphs
        .map(p => p.replace(/<[^>]+>/g, ''))
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
      return text.slice(0, 6000);
    }
    
    return null;
  } catch (err) {
    return null;
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
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    
    // Try to fetch full article content if RSS snippet is short
    let fullContent = article.content;
    if (article.content.length < 500) {
      console.log(`  Fetching full content for: ${article.title.slice(0, 40)}...`);
      const fetched = await fetchArticleContent(article.link);
      if (fetched && fetched.length > article.content.length) {
        fullContent = fetched;
      }
    }
    
    const prompt = `You are a hard-hitting leftist news editor writing for a Gen Z audience. Analyze this news story and provide:

1. TEASER: A 1-2 sentence hook (max 120 characters) that grabs attention

2. BULLETS: 5-7 bullet points summarizing the key facts of the article. Each bullet should be 1-2 sentences. Focus on the most important details, names, numbers, and developments.

3. THE_FEAR: In 2-3 sentences, summarize what in this article leftists or liberal individuals should be afraid of. What threat does this represent to progressive values, marginalized communities, democracy, or justice?

4. THE_JUSTICE: In 2-3 sentences, analyze the presence or (more likely) lack of justice described in this article from a leftist perspective. How does this policy, action, or event support or undermine economic, legislative, racial, or social justice? Be specific about who benefits and who is harmed.

Write with conviction. Use strong verbs. Name names. No hedging or "both sides" framing.

Title: ${article.title}
Content: ${fullContent.slice(0, 8000)}

Format your response EXACTLY like this:
TEASER: [your teaser here]
BULLETS:
• [bullet 1]
• [bullet 2]
• [bullet 3]
• [bullet 4]
• [bullet 5]
• [bullet 6 if needed]
• [bullet 7 if needed]
THE_FEAR: [2-3 sentences on what leftists should fear]
THE_JUSTICE: [2-3 sentences on justice analysis]`;

    const result = await model.generateContent(prompt);
    const rawSummary = result.response.text();
    
    // Parse all sections
    const teaserMatch = rawSummary.match(/TEASER:\s*(.+?)(?=BULLETS:|$)/s);
    const bulletsMatch = rawSummary.match(/BULLETS:\s*([\s\S]+?)(?=THE_FEAR:|$)/);
    const fearMatch = rawSummary.match(/THE_FEAR:\s*(.+?)(?=THE_JUSTICE:|$)/s);
    const justiceMatch = rawSummary.match(/THE_JUSTICE:\s*(.+)/s);
    
    const teaser = teaserMatch ? teaserMatch[1].trim() : rawSummary.slice(0, 120);
    
    // Parse bullets into array
    let bullets = [];
    if (bulletsMatch) {
      bullets = bulletsMatch[1]
        .split(/\n/)
        .map(line => line.replace(/^[•\-\*]\s*/, '').trim())
        .filter(line => line.length > 0);
    }
    
    const theFear = fearMatch ? fearMatch[1].trim() : '';
    const theJustice = justiceMatch ? justiceMatch[1].trim() : '';
    
    // Create fullSummary from bullets for article pages
    const fullSummary = bullets.length > 0 ? bullets.join('\n\n') : teaser;
    
    return {
      ...article,
      summary: teaser,
      fullSummary: fullSummary,
      bullets: bullets,
      theFear: theFear,
      theJustice: theJustice,
      summarizedAt: new Date().toISOString(),
    };
  } catch (err) {
    console.error(`Failed to summarize "${article.title}":`, err.message);
    return {
      ...article,
      summary: article.content.slice(0, 120) + '...',
      fullSummary: article.content,
      bullets: [],
      theFear: '',
      theJustice: '',
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
  console.log('(Rate limited: 5 second delay between API calls)\n');
  const summarized = [];
  for (const article of articles.slice(0, 12)) {
    const result = await summarizeArticle(article);
    
    // Check paywall status
    console.log(`  Checking paywall: ${article.title.slice(0, 50)}...`);
    const paywallStatus = await checkArticlePaywall(article.link);
    result.isPaywalled = paywallStatus.isPaywalled;
    
    summarized.push(result);
    // 5 second delay to respect Gemini rate limits (free tier: ~15 requests/min)
    await new Promise(r => setTimeout(r, 5000));
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
  
  // Twitter posting is now handled by separate scheduled workflow
  // See: .github/workflows/tweet-schedule.yml
  
  console.log('\n=== Update Complete ===');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
