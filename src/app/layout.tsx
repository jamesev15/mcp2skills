import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'mcp2skills',
  description: 'Register MCP servers and generate downloadable skill ZIPs for Claude Code',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-50 text-gray-900 antialiased">{children}</body>
    </html>
  );
}
