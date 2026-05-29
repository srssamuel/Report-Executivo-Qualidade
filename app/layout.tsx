import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { SpeedInsights } from '@vercel/speed-insights/next'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
})

export const metadata: Metadata = {
  title: 'Report Executivo | QualiData',
  description: 'Superintendência Vivo e Nubank — Gestão de carteira e capacidade',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={inter.variable}>
      <body>
        {children}
        {/* Vercel Web Analytics (<Analytics/>) removido: não está habilitado no
            projeto, então /_vercel/insights/script.js retornava 404 e poluía o
            console. Para reativar: habilite "Web Analytics" no dashboard Vercel
            e re-adicione <Analytics /> de '@vercel/analytics/next'. */}
        <SpeedInsights />
      </body>
    </html>
  )
}
