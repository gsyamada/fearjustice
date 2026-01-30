const { TwitterApi } = require('twitter-api-v2');
const fs = require('fs');
const path = require('path');

const TWEET_TEMPLATES = [
  { format: '🔥 {title}\n\n{link}', hashtags: '#News #Politics' },
  { format: '📰 {title}\n\nRead more: {link}', hashtags: '#BreakingNews' },
  { format: '⚡ {title}\n\n{link}', hashtags: '#News #Leftist' },
  { format: '{title}\n\n🔗 {link}', hashtags: '#Politics #Progressive' },
  { format: '🚨 {title}\n\n{link}', hashtags: '#News' },
  { format: '👀 {title}\n\nFull story: {link}', hashtags: '#CurrentEvents' },
  { format: '📢 {title}\n\n{link}', hashtags: '#News #Justice' },
  { format: '💥 {title}\n\n{link}', hashtags: '#BreakingNews #Politics' },
];

const POSTED_FILE = path.join(__dirname, '..', 'content', 'posted.json');
const NEWS_FILE = path.join(__dirname, '..', 'content', 'news.json');

function loadPosted() {
  try {
    if (fs.existsSync(POSTED_FILE)) {
      return JSON.parse(fs.readFileSync(POSTED_FILE, 'utf-8'));
    }
  } catch {}
  return { links: [], lastPosted: null };
}

function savePosted(data) {
  fs.writeFileSync(POSTED_FILE, JSON.stringify(data, null, 2));
}

function loadNews() {
  try {
    return JSON.parse(fs.readFileSync(NEWS_FILE, 'utf-8'));
  } catch (err) {
    console.error('Failed to load news.json:', err.message);
    return null;
  }
}

function getRandomTemplate() {
  return TWEET_TEMPLATES[Math.floor(Math.random() * TWEET_TEMPLATES.length)];
}

function buildTweet(article) {
  const template = getRandomTemplate();
  const title = article.title.slice(0, 180); // Leave room for link and hashtags
  
  let tweet = template.format
    .replace('{title}', title)
    .replace('{link}', article.link);
  
  // Add hashtags if there's room (280 char limit)
  if (tweet.length + template.hashtags.length + 2 <= 280) {
    tweet += '\n\n' + template.hashtags;
  }
  
  return tweet;
}

async function postTweet() {
  // Check for required env vars
  if (!process.env.TWITTER_API_KEY || 
      !process.env.TWITTER_API_SECRET ||
      !process.env.TWITTER_ACCESS_TOKEN ||
      !process.env.TWITTER_ACCESS_SECRET) {
    console.log('Twitter credentials not configured, skipping');
    return;
  }

  const client = new TwitterApi({
    appKey: process.env.TWITTER_API_KEY,
    appSecret: process.env.TWITTER_API_SECRET,
    accessToken: process.env.TWITTER_ACCESS_TOKEN,
    accessSecret: process.env.TWITTER_ACCESS_SECRET,
  });

  const news = loadNews();
  if (!news || !news.articles || news.articles.length === 0) {
    console.log('No articles available');
    return;
  }

  const posted = loadPosted();
  
  // Find an article we haven't posted yet (check last 50 posted)
  const recentlyPosted = new Set(posted.links.slice(-50));
  const unpostedArticle = news.articles.find(a => !recentlyPosted.has(a.link));
  
  if (!unpostedArticle) {
    console.log('All recent articles have been posted, picking oldest posted');
    // If all are posted, pick the one posted longest ago
    const article = news.articles[0];
    await sendTweet(client, article, posted);
    return;
  }

  await sendTweet(client, unpostedArticle, posted);
}

async function sendTweet(client, article, posted) {
  const tweet = buildTweet(article);
  
  console.log('Posting tweet:');
  console.log(tweet);
  console.log('---');
  
  try {
    const rwClient = client.readWrite;
    await rwClient.v2.tweet(tweet);
    
    // Track this post
    posted.links.push(article.link);
    // Keep only last 100 posted links
    if (posted.links.length > 100) {
      posted.links = posted.links.slice(-100);
    }
    posted.lastPosted = new Date().toISOString();
    savePosted(posted);
    
    console.log('✓ Tweet posted successfully!');
  } catch (err) {
    console.error('Failed to post tweet:', err.message);
    process.exit(1);
  }
}

// Add random delay (0-30 minutes) to avoid exact timing patterns
async function main() {
  const delayMinutes = Math.floor(Math.random() * 30);
  console.log(`Random delay: ${delayMinutes} minutes`);
  
  if (process.env.SKIP_DELAY !== 'true') {
    await new Promise(r => setTimeout(r, delayMinutes * 60 * 1000));
  }
  
  await postTweet();
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
