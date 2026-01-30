'use client'

import { useState, useEffect } from 'react'
import newsData from '../content/news.json'

const ARTICLES_PER_PAGE = 15
const MAX_FRONT_PAGE_HOURS = 36

interface Article {
  title: string
  link: string
  source: string
  summary: string
  fullSummary?: string
  pubDate?: string
  sensationalismScore?: number
  isPaywalled?: boolean
}

interface ClickData {
  [key: string]: {
    clicks: number
    lastClick: string
    firstSeen: string
  }
}

interface NewsData {
  lastUpdated: string
  headline: Article
  articles: Article[]
}

async function trackClick(articleLink: string) {
  try {
    await fetch('/api/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ articleLink })
    })
  } catch {}
}

function getArticleScore(article: Article, clicks: ClickData): number {
  const now = new Date()
  const pubDate = article.pubDate ? new Date(article.pubDate) : now
  const hoursOld = (now.getTime() - pubDate.getTime()) / (1000 * 60 * 60)
  
  // Base score from sensationalism
  let score = article.sensationalismScore || 0
  
  // Add click bonus (each click adds points)
  const articleClicks = clicks[article.link]
  if (articleClicks) {
    score += articleClicks.clicks * 5
  }
  
  // If older than 36 hours, heavily penalize for page 1
  if (hoursOld > MAX_FRONT_PAGE_HOURS) {
    score -= 1000
  }
  
  // Recency bonus (decays over time)
  score += Math.max(0, 50 - hoursOld * 2)
  
  return score
}

function formatDate(dateStr: string) {
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function formatTime(dateStr: string) {
  const date = new Date(dateStr)
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

function timeAgo(dateStr: string) {
  const now = new Date()
  const date = new Date(dateStr)
  const diffMs = now.getTime() - date.getTime()
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  
  if (diffHours < 1) return 'Just now'
  if (diffHours === 1) return '1 hour ago'
  if (diffHours < 24) return `${diffHours} hours ago`
  
  const diffDays = Math.floor(diffHours / 24)
  if (diffDays === 1) return '1 day ago'
  return `${diffDays} days ago`
}

function getDomain(url: string): string {
  try {
    return new URL(url).hostname.replace('www.', '')
  } catch {
    return 'source'
  }
}

function ArticleCard({ article, onTrack }: { article: Article, onTrack: (link: string) => void }) {
  const [expanded, setExpanded] = useState(false)
  
  const handleExpand = () => {
    setExpanded(true)
    onTrack(article.link)
  }
  
  const handleLinkClick = () => {
    onTrack(article.link)
  }
  
  return (
    <article className="article-card">
      <p className="article-source">{article.source}</p>
      <a href={article.link} target="_blank" rel="noopener noreferrer" onClick={handleLinkClick}>
        <h3 className="article-title">
          {article.title}
          {article.isPaywalled && <span className="paywall-badge" title="Paywalled">$</span>}
        </h3>
      </a>
      
      {!expanded ? (
        <>
          <p className="article-summary">{article.summary}</p>
          <button className="expand-btn" onClick={handleExpand}>
            EXPAND
          </button>
        </>
      ) : (
        <div className="article-expanded">
          <p className="article-full-summary">{article.fullSummary || article.summary}</p>
          <a 
            href={article.link} 
            target="_blank" 
            rel="noopener noreferrer"
            className="read-article-link"
          >
            Read article at {getDomain(article.link)}
          </a>
          <button className="collapse-btn" onClick={() => setExpanded(false)}>
            COLLAPSE
          </button>
        </div>
      )}
      
      {article.pubDate && (
        <p className="article-time">{timeAgo(article.pubDate)}</p>
      )}
    </article>
  )
}

export default function Home() {
  const data = newsData as NewsData
  const { headline, articles, lastUpdated } = data
  const [showPaywalled, setShowPaywalled] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)
  const [clicks, setClicks] = useState<ClickData>({})
  
  useEffect(() => {
    fetch('/api/track')
      .then(res => res.json())
      .then(data => setClicks(data))
      .catch(() => {})
  }, [])
  
  const handleTrack = (articleLink: string) => {
    trackClick(articleLink)
    setClicks(prev => ({
      ...prev,
      [articleLink]: {
        clicks: (prev[articleLink]?.clicks || 0) + 1,
        lastClick: new Date().toISOString(),
        firstSeen: prev[articleLink]?.firstSeen || new Date().toISOString()
      }
    }))
  }
  
  // Filter by paywall preference
  const filteredArticles = showPaywalled 
    ? articles 
    : articles.filter(a => !a.isPaywalled)
  
  // Sort by engagement score
  const rankedArticles = [...filteredArticles].sort((a, b) => 
    getArticleScore(b, clicks) - getArticleScore(a, clicks)
  )
  
  // Pagination
  const totalPages = Math.ceil(rankedArticles.length / ARTICLES_PER_PAGE)
  const startIdx = (currentPage - 1) * ARTICLES_PER_PAGE
  const pageArticles = rankedArticles.slice(startIdx, startIdx + ARTICLES_PER_PAGE)
  
  // Headline is top article on page 1
  const displayHeadline = currentPage === 1 ? pageArticles[0] : null
  const gridArticles = currentPage === 1 ? pageArticles.slice(1) : pageArticles
  
  return (
    <main>
      <div className="ticker">
        <span className="ticker-dot" />
        LAST UPDATED: {formatTime(lastUpdated)} — AUTO-REFRESHES EVERY 6 HOURS
      </div>
      
      <header className="header">
        <div className="container">
          <h1 className="masthead">
            <span className="fear">FEAR</span> JUSTICE
          </h1>
          <p className="tagline">The People's News • Unfiltered</p>
          <p className="dateline">{formatDate(lastUpdated)}</p>
          <div className="paywall-toggle">
            <button 
              className={`toggle-slider ${showPaywalled ? 'toggle-on' : 'toggle-off'}`}
              onClick={() => setShowPaywalled(!showPaywalled)}
              aria-pressed={showPaywalled}
            >
              <span className="toggle-knob">$</span>
            </button>
            <span className={`toggle-label ${showPaywalled ? 'label-on' : ''}`}>
              Paywalled Articles Visible
            </span>
          </div>
        </div>
      </header>
      
      {displayHeadline && (
        <section className="headline-section">
          <div className="container">
            <span className="headline-label">Breaking</span>
            <a href={displayHeadline.link} target="_blank" rel="noopener noreferrer" onClick={() => handleTrack(displayHeadline.link)}>
              <h2 className="headline-title">
                {displayHeadline.title}
                {displayHeadline.isPaywalled && <span className="paywall-badge" title="Paywalled">$</span>}
              </h2>
            </a>
            <p className="headline-source">via {displayHeadline.source}</p>
            <p className="headline-summary">{displayHeadline.fullSummary || displayHeadline.summary}</p>
            <a 
              href={displayHeadline.link} 
              target="_blank" 
              rel="noopener noreferrer"
              className="headline-read-link"
              onClick={() => handleTrack(displayHeadline.link)}
            >
              Read full article at {getDomain(displayHeadline.link)} →
            </a>
          </div>
        </section>
      )}
      
      <section className="container">
        <div className="news-grid">
          {gridArticles.map((article, index) => (
            <ArticleCard key={article.link} article={article} onTrack={handleTrack} />
          ))}
        </div>
        
        {totalPages > 1 && (
          <nav className="pagination">
            <button 
              className="page-btn"
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              ← PREV
            </button>
            <span className="page-info">
              PAGE {currentPage} OF {totalPages}
            </span>
            <button 
              className="page-btn"
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >
              NEXT →
            </button>
          </nav>
        )}
      </section>
      
      <section className="support-section">
        <div className="container">
          <div className="support-grid">
            <div className="support-card">
              <h3 className="support-title">SUPPORT THE CAUSE</h3>
              <p className="support-text">Independent news needs independent funding.</p>
              <a 
                href="https://ko-fi.com/fearjustice" 
                target="_blank" 
                rel="noopener noreferrer"
                className="kofi-button"
              >
                ☕ Buy us a coffee
              </a>
            </div>
            <div className="support-card">
              <h3 className="support-title">STAY INFORMED</h3>
              <p className="support-text">Get the headlines in your inbox. No spam.</p>
              <form 
                action="https://buttondown.com/api/emails/embed-subscribe/fearjustice"
                method="post"
                target="_blank"
                className="newsletter-form"
              >
                <input 
                  type="email" 
                  name="email" 
                  placeholder="your@email.com"
                  required
                  className="newsletter-input"
                />
                <button type="submit" className="newsletter-button">SUBSCRIBE</button>
              </form>
            </div>
          </div>
        </div>
      </section>

      <footer className="footer">
        <div className="container">
          <p className="footer-text">
            Fear Justice © {new Date().getFullYear()} • For the People
          </p>
          <div className="footer-links">
            <a href="https://twitter.com/fearjustice" target="_blank" rel="noopener noreferrer">
              @fearjustice
            </a>
            <a href="https://ko-fi.com/fearjustice" target="_blank" rel="noopener noreferrer">
              Support
            </a>
          </div>
        </div>
      </footer>
    </main>
  )
}
