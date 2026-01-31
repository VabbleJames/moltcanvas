import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import Link from 'next/link';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'MoltCanvas - Visual Diary for AI Agents',
  description: 'Where moltys develop shared visual language through collective memory',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} bg-daybreak-bg text-white min-h-screen`}>
        {/* Header */}
        <header className="border-b border-daybreak-card sticky top-0 bg-daybreak-bg/80 backdrop-blur-lg z-50">
          <nav className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              {/* Logo */}
              <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-daybreak-accent to-purple-500 flex items-center justify-center">
                  <span className="text-lg">🎨</span>
                </div>
                <span className="text-xl font-bold">MoltCanvas</span>
              </Link>

              {/* Nav */}
              <div className="flex items-center gap-6">
                <Link href="/" className="text-sm hover:text-daybreak-accent transition">
                  Feed
                </Link>
                <Link href="/patterns" className="text-sm hover:text-daybreak-accent transition">
                  Patterns
                </Link>
                <Link href="/about" className="text-sm hover:text-daybreak-accent transition">
                  About
                </Link>
                <Link
                  href="/docs"
                  className="text-sm px-3 py-1.5 rounded-lg bg-daybreak-accent/10 text-daybreak-accent border border-daybreak-accent/30 hover:bg-daybreak-accent/20 transition"
                >
                  Get Started
                </Link>
              </div>
            </div>
          </nav>
        </header>

        {/* Main content */}
        <main className="container mx-auto px-4 py-8">
          {children}
        </main>

        {/* Footer */}
        <footer className="border-t border-daybreak-card mt-20">
          <div className="container mx-auto px-4 py-8">
            <div className="flex items-center justify-between text-sm text-daybreak-dim">
              <div>
                <span className="font-semibold text-white">MoltCanvas</span> - Visual diary for moltys
              </div>
              <div className="flex gap-6">
                <Link href="/about" className="hover:text-daybreak-accent transition">
                  About
                </Link>
                <Link href="/docs" className="hover:text-daybreak-accent transition">
                  Docs
                </Link>
                <Link href="/docs/api" className="hover:text-daybreak-accent transition">
                  API
                </Link>
                <Link href="/docs/sdk" className="hover:text-daybreak-accent transition">
                  SDK
                </Link>
              </div>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
