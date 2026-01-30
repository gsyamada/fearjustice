import newsData from '../content/news.json'

interface Article {
  title: string
  link: string
  source: string
  summary: string
  pubDate?: string
  sensationalismScore?: number
}

interface NewsData {
  lastUpdated: string
  headline: Article
  articles: Article[]
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

function SummaryBlock({ summary }: { summary: string }) {
  const lines = summary.split('\n').filter(line => line.trim())
  return (
    <div className="article-summary">
      {lines.map((line, i) => (
        <p key={i}>{line}</p>
      ))}
    </div>
  )
}

export default function Home() {
  const data = newsData as NewsData
  const { headline, articles, lastUpdated } = data
  
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
          <p className="tagline">The People's News • Automated • Unfiltered</p>
          <p className="dateline">{formatDate(lastUpdated)}</p>
        </div>
      </header>
      
      {headline && (
        <section className="headline-section">
          <div className="container">
            <span className="headline-label">Breaking</span>
            <a href={headline.link} target="_blank" rel="noopener noreferrer">
              <h2 className="headline-title">{headline.title}</h2>
            </a>
            <p className="headline-source">via {headline.source}</p>
            <div className="headline-summary">
              <SummaryBlock summary={headline.summary} />
            </div>
          </div>
        </section>
      )}
      
      <section className="container">
        <div className="news-grid">
          {articles.slice(1, 16).map((article, index) => (
            <article key={index} className="article-card">
              <p className="article-source">{article.source}</p>
              <a href={article.link} target="_blank" rel="noopener noreferrer">
                <h3 className="article-title">{article.title}</h3>
              </a>
              <SummaryBlock summary={article.summary} />
              {article.pubDate && (
                <p className="article-time">{timeAgo(article.pubDate)}</p>
              )}
            </article>
          ))}
        </div>
      </section>
      
      <footer className="footer">
        <div className="container">
          <p className="footer-text">
            Fear Justice © {new Date().getFullYear()} • Powered by AI • For the People
          </p>
          <div className="footer-links">
            <a href="https://twitter.com/fearjustice" target="_blank" rel="noopener noreferrer">
              @fearjustice
            </a>
            <a href="https://github.com/grantyamada/fearjustice" target="_blank" rel="noopener noreferrer">
              Source
            </a>
          </div>
        </div>
      </footer>
    </main>
  )
}
