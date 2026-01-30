import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'FEAR JUSTICE - Leftist News Dashboard',
  description: 'Your daily dose of hard-hitting progressive news, summarized for the people.',
  openGraph: {
    title: 'FEAR JUSTICE',
    description: 'Leftist news that hits different.',
    siteName: 'Fear Justice',
  },
  twitter: {
    card: 'summary_large_image',
    site: '@fearjustice',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
