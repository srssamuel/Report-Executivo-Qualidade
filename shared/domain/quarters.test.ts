import { describe, it, expect } from 'vitest'
import {
  QUARTERS, QUARTER_MONTHS, ALL_OKR_MONTHS,
  isQuarter, quarterForMonth, nextQuarter, previousQuarter, quarterFromMonthIndex,
  periodoCoversQuarter, monthsForPeriodo,
} from './index'

describe('quarterForMonth', () => {
  it('mapeia os 12 meses para o trimestre correto', () => {
    for (const q of QUARTERS) {
      for (const mes of QUARTER_MONTHS[q]) {
        expect(quarterForMonth(mes)).toBe(q)
      }
    }
  })

  it('entrada inválida cai em Q1 (default documentado)', () => {
    expect(quarterForMonth('Xyz')).toBe('Q1')
    expect(quarterForMonth('')).toBe('Q1')
  })
})

describe('nextQuarter / previousQuarter', () => {
  it('avança em sequência cíclica (Q4 → Q1)', () => {
    expect(nextQuarter('Q1')).toBe('Q2')
    expect(nextQuarter('Q3')).toBe('Q4')
    expect(nextQuarter('Q4')).toBe('Q1')
  })

  it('retrocede e devolve null antes de Q1', () => {
    expect(previousQuarter('Q4')).toBe('Q3')
    expect(previousQuarter('Q2')).toBe('Q1')
    expect(previousQuarter('Q1')).toBeNull()
  })
})

describe('quarterFromMonthIndex', () => {
  it('converte índice 0–11 e clampa fora do intervalo', () => {
    expect(quarterFromMonthIndex(0)).toBe('Q1')
    expect(quarterFromMonthIndex(5)).toBe('Q2')
    expect(quarterFromMonthIndex(11)).toBe('Q4')
    expect(quarterFromMonthIndex(-2)).toBe('Q1')
    expect(quarterFromMonthIndex(15)).toBe('Q4')
  })
})

describe('isQuarter', () => {
  it('aceita apenas Q1–Q4 exatos', () => {
    expect(isQuarter('Q2')).toBe(true)
    expect(isQuarter('q2')).toBe(false)
    expect(isQuarter('Q5')).toBe(false)
    expect(isQuarter('')).toBe(false)
    expect(isQuarter(null)).toBe(false)
  })
})

describe('periodoCoversQuarter — compatibilidade legado/anual/trimestre', () => {
  it('trimestre explícito casa apenas com o próprio', () => {
    expect(periodoCoversQuarter('Q2', 'Q2')).toBe(true)
    expect(periodoCoversQuarter('Q2', 'Q3')).toBe(false)
  })

  it('semestre legado Jan-Jun cobre Q1 e Q2, não Q3/Q4', () => {
    for (const p of ['Jan-Jun', 'jan/jun', 'Jan-Jun 2025', '1º Sem']) {
      expect(periodoCoversQuarter(p, 'Q1')).toBe(true)
      expect(periodoCoversQuarter(p, 'Q2')).toBe(true)
      expect(periodoCoversQuarter(p, 'Q3')).toBe(false)
    }
  })

  it('semestre Jul-Dez cobre Q3 e Q4', () => {
    expect(periodoCoversQuarter('Jul-Dez', 'Q3')).toBe(true)
    expect(periodoCoversQuarter('Jul-Dez', 'Q4')).toBe(true)
    expect(periodoCoversQuarter('2º Sem', 'Q1')).toBe(false)
  })

  it('contrato anual cobre os 4 trimestres', () => {
    for (const q of QUARTERS) {
      expect(periodoCoversQuarter('Anual', q)).toBe(true)
      expect(periodoCoversQuarter('2026', q)).toBe(true)
    }
  })

  it('vazio ou irreconhecível não cobre nada', () => {
    expect(periodoCoversQuarter('', 'Q1')).toBe(false)
    expect(periodoCoversQuarter(null, 'Q1')).toBe(false)
    expect(periodoCoversQuarter('Bimestral', 'Q1')).toBe(false)
  })
})

describe('monthsForPeriodo — geração de measurements pendentes', () => {
  it('trimestre gera os 3 meses do bloco', () => {
    expect(monthsForPeriodo('Q3')).toEqual(['Jul', 'Ago', 'Set'])
  })

  it('semestre legado gera 6 meses na ordem', () => {
    expect(monthsForPeriodo('Jan-Jun')).toEqual(['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun'])
    expect(monthsForPeriodo('Jul-Dez')).toEqual(['Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'])
  })

  it('anual gera os 12 meses', () => {
    expect(monthsForPeriodo('Anual')).toEqual([...ALL_OKR_MONTHS])
  })

  it('período irreconhecível gera lista vazia (não inventa apuração)', () => {
    expect(monthsForPeriodo('')).toEqual([])
    expect(monthsForPeriodo('Bimestral')).toEqual([])
  })
})
