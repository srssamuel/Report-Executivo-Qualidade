import { describe, it, expect } from 'vitest'
import { calculateOkrAtingimento, resolveOkrStatus, formatOkrValue } from './index'

describe('calculateOkrAtingimento', () => {
  it('Maior é melhor: razão resultado/meta', () => {
    expect(calculateOkrAtingimento(80, 100, 'Maior é melhor')).toBeCloseTo(0.8)
    expect(calculateOkrAtingimento(100, 100, 'Maior é melhor')).toBe(1)
  })

  it('cap em 1.2 (120%) para não distorcer o score', () => {
    expect(calculateOkrAtingimento(300, 100, 'Maior é melhor')).toBe(1.2)
    expect(calculateOkrAtingimento(10, 100, 'Menor é melhor')).toBe(1.2)
  })

  it('Menor é melhor: razão meta/resultado', () => {
    expect(calculateOkrAtingimento(200, 100, 'Menor é melhor')).toBeCloseTo(0.5)
    expect(calculateOkrAtingimento(0, 100, 'Menor é melhor')).toBe(0)
  })

  it('Igual/meta exata: tudo ou nada', () => {
    expect(calculateOkrAtingimento(7, 7, 'Igual/meta exata')).toBe(1)
    expect(calculateOkrAtingimento(6, 7, 'Igual/meta exata')).toBe(0)
  })

  it('meta zero em Maior é melhor não divide por zero', () => {
    expect(calculateOkrAtingimento(50, 0, 'Maior é melhor')).toBe(0)
  })

  it('sem resultado apurado devolve null (Pendente, não zero)', () => {
    expect(calculateOkrAtingimento(null, 100, 'Maior é melhor')).toBeNull()
    expect(calculateOkrAtingimento(undefined, 100, 'Maior é melhor')).toBeNull()
    expect(calculateOkrAtingimento(NaN, 100, 'Maior é melhor')).toBeNull()
  })
})

describe('resolveOkrStatus', () => {
  it('faixas: ≥100% Atingido, ≥70% Parcial, <70% Crítico, null Pendente', () => {
    expect(resolveOkrStatus(null)).toBe('Pendente')
    expect(resolveOkrStatus(undefined)).toBe('Pendente')
    expect(resolveOkrStatus(1.2)).toBe('Atingido')
    expect(resolveOkrStatus(1.0)).toBe('Atingido')
    expect(resolveOkrStatus(0.7)).toBe('Parcial')
    expect(resolveOkrStatus(0.69)).toBe('Crítico')
    expect(resolveOkrStatus(0)).toBe('Crítico')
  })
})

describe('formatOkrValue', () => {
  it('sem valor exibe traço', () => {
    expect(formatOkrValue(null, '%')).toBe('-')
    expect(formatOkrValue(undefined, 'R$')).toBe('-')
  })

  it('unidade monetária formata como BRL', () => {
    expect(formatOkrValue(1500, 'R$')).toMatch(/R\$/)
    expect(formatOkrValue(1500, 'R$')).toMatch(/1\.500/)
  })

  it('percentual em fração (0.9) vira 90%', () => {
    expect(formatOkrValue(0.9, '%')).toBe('90%')
    expect(formatOkrValue(1.05, '%')).toBe('105%')
  })

  it('percentual já em escala 0–100 (>1.2) não multiplica de novo', () => {
    expect(formatOkrValue(90, '%')).toBe('90%')
  })

  it('número simples usa locale pt-BR', () => {
    expect(formatOkrValue(1234, 'unidades')).toBe('1.234')
  })
})
