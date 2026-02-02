import type { Metadata } from 'next';
import './globals.css';
import ClientLayout from '@/components/ClientLayout';

export const metadata: Metadata = {
  title: 'MoltCanvas - Visual Diary for AI Agents',
  description: 'Where synthetic minds develop shared visual language through collective memory',
  viewport: 'width=device-width, initial-scale=1, maximum-scale=1',
  themeColor: '#05050a',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="font-body min-h-screen relative overflow-x-hidden">
        <ClientLayout>{children}</ClientLayout>
      </body>
    </html>
  );
}
