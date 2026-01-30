import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

export async function GET() {
  const newsPath = path.join(process.cwd(), 'content', 'news.json')
  
  let articles = []
  let lastUpdated = new Date().toISOString()
  
  try {
    const data = JSON.parse(fs.readFileSync(newsPath, 'utf-8'))
    articles = data.articles || []
    lastUpdated = data.lastUpdated || lastUpdated
  } catch (err) {
    console.error('Failed to load news.json:', err)
  }
  
  const rssItems = articles.slice(0, 20).map((article: any) => {
    const pubDate = article.pubDate 
      ? new Date(article.pubDate).toUTCString()
      : new Date().toUTCString()
    
    const description = article.fullSummary || article.summary || article.content || ''
    
    return `
    <item>
      <title><![CDATA[${article.title}]]></title>
      <link>${article.link}</link>
      <guid isPermaLink="false">${article.link}</guid>
      <pubDate>${pubDate}</pubDate>
      <source url="https://fearjustice.com">${article.source}</source>
      <description><![CDATA[${description}]]></description>
    </item>`
  }).join('\n')
  
  const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Fear Justice</title>
    <link>https://fearjustice.com</link>
    <description>The People's News • Unfiltered</description>
    <language>en-us</language>
    <lastBuildDate>${new Date(lastUpdated).toUTCString()}</lastBuildDate>
    <atom:link href="https://fearjustice.com/feed.xml" rel="self" type="application/rss+xml"/>
    <image>
      <url>https://fearjustice.com/x-profile.png</url>
      <title>Fear Justice</title>
      <link>https://fearjustice.com</link>
    </image>
    ${rssItems}
  </channel>
</rss>`

  return new NextResponse(rss, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  })
}
