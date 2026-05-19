import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Report Executivo | QualiData',
  description: 'Superintendência Vivo e Nubank — Gestão de carteira e capacidade',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  )
}
