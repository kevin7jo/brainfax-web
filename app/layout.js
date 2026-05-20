import './globals.css';
export const metadata = { title: 'Brainfax', description: 'Brainfax Dashboard' };

export default function RootLayout({ children }) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <body className="antialiased bg-slate-50 text-slate-800">{children}</body>
    </html>
  );
}
