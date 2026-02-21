import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'SQL Cleaner',
  description: 'Limpeza de dumps PostgreSQL com conversão segura de COPY para INSERT.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body suppressHydrationWarning className={`${inter.className} ${inter.variable}`}>
        {children}
      </body>
    </html>
  );
}
