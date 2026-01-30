import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

const CLICKS_FILE = path.join(process.cwd(), 'content', 'clicks.json')

interface ClickData {
  [articleLink: string]: {
    clicks: number
    lastClick: string
    firstSeen: string
  }
}

function loadClicks(): ClickData {
  try {
    if (fs.existsSync(CLICKS_FILE)) {
      return JSON.parse(fs.readFileSync(CLICKS_FILE, 'utf-8'))
    }
  } catch {}
  return {}
}

function saveClicks(data: ClickData) {
  fs.writeFileSync(CLICKS_FILE, JSON.stringify(data, null, 2))
}

export async function POST(request: NextRequest) {
  try {
    const { articleLink } = await request.json()
    
    if (!articleLink) {
      return NextResponse.json({ error: 'Missing articleLink' }, { status: 400 })
    }
    
    const clicks = loadClicks()
    const now = new Date().toISOString()
    
    if (clicks[articleLink]) {
      clicks[articleLink].clicks += 1
      clicks[articleLink].lastClick = now
    } else {
      clicks[articleLink] = {
        clicks: 1,
        lastClick: now,
        firstSeen: now
      }
    }
    
    saveClicks(clicks)
    
    return NextResponse.json({ success: true, clicks: clicks[articleLink].clicks })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to track click' }, { status: 500 })
  }
}

export async function GET() {
  const clicks = loadClicks()
  return NextResponse.json(clicks)
}
