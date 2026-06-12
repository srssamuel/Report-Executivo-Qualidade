import { describe, it, expect } from 'vitest'
import { normalizeDashboardLayout } from './index'

const KNOWN = ['decisao', 'heatmap', 'aging', 'capacidade', 'evolucao', 'okrs', 'ganhos'] as const

describe('normalizeDashboardLayout — layout salvo sobrevive a versões', () => {
  it('sem layout salvo devolve a ordem padrão e nada escondido', () => {
    expect(normalizeDashboardLayout(null, KNOWN)).toEqual({ order: [...KNOWN], hidden: [] })
    expect(normalizeDashboardLayout(undefined, KNOWN)).toEqual({ order: [...KNOWN], hidden: [] })
    expect(normalizeDashboardLayout({}, KNOWN)).toEqual({ order: [...KNOWN], hidden: [] })
  })

  it('preserva a ordem customizada do usuário', () => {
    const saved = { order: ['okrs', 'decisao', 'heatmap', 'aging', 'capacidade', 'evolucao', 'ganhos'], hidden: [] }
    expect(normalizeDashboardLayout(saved, KNOWN).order[0]).toBe('okrs')
  })

  it('seção removida do produto some do layout salvo', () => {
    const saved = { order: ['extinta', 'decisao'], hidden: ['extinta'] }
    const out = normalizeDashboardLayout(saved, KNOWN)
    expect(out.order).not.toContain('extinta')
    expect(out.hidden).not.toContain('extinta')
  })

  it('seção nova do produto entra no fim, na ordem padrão', () => {
    const saved = { order: ['ganhos', 'decisao'], hidden: [] }
    const out = normalizeDashboardLayout(saved, KNOWN)
    expect(out.order.slice(0, 2)).toEqual(['ganhos', 'decisao'])
    expect(out.order).toEqual(['ganhos', 'decisao', 'heatmap', 'aging', 'capacidade', 'evolucao', 'okrs'])
  })

  it('hidden só aceita ids conhecidos e deduplica', () => {
    const saved = { order: [], hidden: ['okrs', 'okrs', 'fantasma'] }
    expect(normalizeDashboardLayout(saved, KNOWN).hidden).toEqual(['okrs'])
  })

  it('tolera payload corrompido (tipos errados) sem quebrar', () => {
    const saved = { order: [42, null, 'decisao'], hidden: 'nope' } as unknown as { order: string[]; hidden: string[] }
    const out = normalizeDashboardLayout(saved, KNOWN)
    expect(out.order[0]).toBe('decisao')
    expect(out.order).toHaveLength(KNOWN.length)
    expect(out.hidden).toEqual([])
  })
})
