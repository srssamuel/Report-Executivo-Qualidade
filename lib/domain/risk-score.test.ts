import { describe, it, expect } from 'vitest'
import { riskScore, normalizeItem, isoDate, addDays } from './index'

function mk(over: Partial<Parameters<typeof normalizeItem>[0]> = {}) {
  return normalizeItem({ id: 'T-001', status: 'Em andamento', priority: 'Média', progress: 0, lastUpdate: new Date().toISOString(), ...over })
}

describe('riskScore', () => {
  it('retorna null para item concluído ou arquivado', () => {
    expect(riskScore(mk({ status: 'Concluído' }), [])).toBeNull()
    expect(riskScore(mk({ archived: true }), [])).toBeNull()
  })

  it('item bloqueado e atrasado fica na faixa Crítico (>=70)', () => {
    const it = mk({ status: 'Bloqueado', dueDate: isoDate(addDays(new Date(), -3)) })
    const r = riskScore(it, [])!
    expect(r.score).toBeGreaterThanOrEqual(70)
    expect(r.band).toBe('Crítico')
  })

  it('item em andamento com prazo folgado e atualizado recentemente é Baixo (<30)', () => {
    const it = mk({ status: 'Em andamento', dueDate: isoDate(addDays(new Date(), 30)), progress: 50 })
    const r = riskScore(it, [])!
    expect(r.band).toBe('Baixo')
  })

  it('staleness >= 14 dias puxa o fator de atualização para 100', () => {
    const old = new Date(); old.setDate(old.getDate() - 20)
    const it = mk({ lastUpdate: old.toISOString(), dueDate: isoDate(addDays(new Date(), 30)) })
    const r = riskScore(it, [])!
    const f = r.factors.find(f => f.key === 'staleness')!
    expect(f.raw).toBe(100)
  })

  it('sem prazo => fator prazo neutro 50', () => {
    const r = riskScore(mk({ dueDate: '' }), [])!
    expect(r.factors.find(f => f.key === 'prazo')!.raw).toBe(50)
  })

  it('predecessor bloqueado => fator dependência 100; inexistente => 60; nota => 40', () => {
    const pred = mk({ id: 'T-000', status: 'Bloqueado' })
    expect(riskScore(mk({ predecessorId: 'T-000' }), [pred])!.factors.find(f => f.key === 'dependencia')!.raw).toBe(100)
    expect(riskScore(mk({ predecessorId: 'T-999' }), [])!.factors.find(f => f.key === 'dependencia')!.raw).toBe(60)
    expect(riskScore(mk({ dependencyNote: 'aguarda TI' }), [])!.factors.find(f => f.key === 'dependencia')!.raw).toBe(40)
  })

  it('progresso muito abaixo do tempo decorrido eleva o fator progresso', () => {
    const it = mk({
      startDate: isoDate(addDays(new Date(), -90)),
      dueDate: isoDate(addDays(new Date(), 10)),
      progress: 10,
    })
    const r = riskScore(it, [])!
    expect(r.factors.find(f => f.key === 'progresso')!.raw).toBeGreaterThan(60)
  })

  it('score é a soma ponderada arredondada e mainReason vem de riskOf', () => {
    const it = mk({ status: 'Bloqueado', dueDate: isoDate(addDays(new Date(), -1)) })
    const r = riskScore(it, [])!
    const manual = Math.round(r.factors.reduce((s, f) => s + f.contribution, 0))
    expect(r.score).toBe(manual)
    expect(r.mainReason).toBe('Bloqueado')
  })
})

describe('riskBand', () => {
  it('faixas: >=70 Crítico, >=50 Alto, >=30 Médio, senão Baixo', () => {
    const probe = (due: string, status: string) => riskScore(mk({ dueDate: due, status }), [])!
    expect(probe(isoDate(addDays(new Date(), -2)), 'Bloqueado').band).toBe('Crítico')
    expect(probe(isoDate(addDays(new Date(), 3)), 'Pausado').band).toBe('Alto')
  })
})
