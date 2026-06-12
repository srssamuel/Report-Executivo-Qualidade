import { describe, it, expect, beforeEach } from 'vitest'
import {
  esc, clamp, normalizeStatus, defaultProgress, normalizeItem,
  riskOf, dataGaps, scoreOf, healthOf,
  filteredItems, sortItems, nextId, ownerLoad, itemTeamSize, itemRemainingEffort,
  countsBy, capacityTone, setCanonicalOwners, isoDate, addDays,
  type Item, type Filters,
} from './index'

function mk(over: Partial<Item> = {}): Item {
  return normalizeItem({ id: 'T-001', status: 'Em andamento', priority: 'Média', progress: 10, lastUpdate: new Date().toISOString(), ...over })
}

function mkFilters(over: Partial<Filters> = {}): Filters {
  return { query: '', product: '', project: '', owner: '', status: '', risk: '', sort: 'due', criticalOnly: false, gapsOnly: false, ...over }
}

beforeEach(() => setCanonicalOwners([]))

describe('esc', () => {
  it('escapa os 5 caracteres perigosos de HTML', () => {
    expect(esc(`<a & "b">'`)).toBe('&lt;a &amp; &quot;b&quot;&gt;&#39;')
    expect(esc(null)).toBe('')
  })
})

describe('clamp', () => {
  it('limita ao intervalo e trata NaN como 0', () => {
    expect(clamp(150, 0, 100)).toBe(100)
    expect(clamp(-5, 0, 100)).toBe(0)
    expect(clamp(NaN, 0, 100)).toBe(0)
  })
})

describe('normalizeStatus / defaultProgress', () => {
  it('corrige caixa para o status canônico e preserva desconhecidos', () => {
    expect(normalizeStatus('em ANDAMENTO')).toBe('Em andamento')
    expect(normalizeStatus('Custom')).toBe('Custom')
    expect(normalizeStatus('')).toBe('Sem status')
    expect(normalizeStatus(undefined)).toBe('Sem status')
  })

  it('progresso default acompanha o status', () => {
    expect(defaultProgress('Concluído')).toBe(100)
    expect(defaultProgress('Em validação')).toBe(50)
    expect(defaultProgress('A iniciar')).toBe(0)
  })
})

describe('normalizeItem', () => {
  it('gera id sequencial G6-NNN e defaults seguros', () => {
    const it1 = normalizeItem({}, 0)
    expect(it1.id).toBe('G6-001')
    expect(it1.status).toBe('Sem status')
    expect(it1.tags).toEqual([])
    expect(it1.archived).toBe(false)
  })

  it('clampa progresso fora da escala', () => {
    expect(normalizeItem({ progress: 250 }).progress).toBe(100)
  })
})

describe('riskOf — classificação categórica', () => {
  it('cobre as 8 categorias na ordem de precedência', () => {
    expect(riskOf(mk({ status: 'Concluído' }))).toBe('Concluído/Baixo risco')
    expect(riskOf(mk({ archived: true }))).toBe('Arquivado')
    expect(riskOf(mk({ status: 'Bloqueado' }))).toBe('Bloqueado')
    expect(riskOf(mk({ dueDate: '' }))).toBe('Sem prazo')
    expect(riskOf(mk({ dueDate: isoDate(addDays(new Date(), -2)) }))).toBe('Atrasado')
    expect(riskOf(mk({ dueDate: isoDate(new Date()) }))).toBe('Vence hoje')
    expect(riskOf(mk({ dueDate: isoDate(addDays(new Date(), 5)) }))).toBe('Atenção 7 dias')
    expect(riskOf(mk({ dueDate: isoDate(addDays(new Date(), 30)) }))).toBe('Em controle')
  })
})

describe('dataGaps / scoreOf / healthOf — governança', () => {
  const completo = mk({
    product: 'Vivo', dueDate: isoDate(addDays(new Date(), 10)), owner: 'Ana',
    definition: 'Definição clara', nextAction: 'Próximo passo', progress: 40,
  })

  it('item completo não tem lacunas e pontua 100', () => {
    expect(dataGaps(completo)).toEqual([])
    expect(scoreOf(completo)).toBe(100)
    expect(healthOf(completo)).toBe('Saudável')
  })

  it('item concluído não cobra próxima ação e pontua 100', () => {
    const done = mk({ status: 'Concluído', nextAction: '' })
    expect(dataGaps(done)).not.toContain('sem próxima ação')
    expect(scoreOf(done)).toBe(100)
    expect(healthOf(done)).toBe('Concluído')
  })

  it('item ativo sem governança acumula lacunas e fica Crítico', () => {
    const vazio: Item = { ...mk(), product: '', dueDate: '', owner: '', definition: '', nextAction: '' }
    expect(dataGaps(vazio)).toEqual(['sem produto', 'sem prazo', 'sem responsável', 'sem definição', 'sem próxima ação'])
    expect(healthOf(vazio)).toBe('Crítico')
  })
})

describe('filteredItems', () => {
  it('exclui arquivados sempre', () => {
    const list = [mk({ archived: true }), mk({ id: 'T-002' })]
    expect(filteredItems(list, mkFilters()).map(i => i.id)).toEqual(['T-002'])
  })

  it('filtro de responsável casa pelo nome canonizado', () => {
    setCanonicalOwners(['Pedro Almeida Santos'])
    const list = [mk({ id: 'A', owner: 'Pedro e Kath' }), mk({ id: 'B', owner: 'Carlos' })]
    const out = filteredItems(list, mkFilters({ owner: 'Pedro Almeida Santos' }))
    expect(out.map(i => i.id)).toEqual(['A'])
  })

  it('busca textual varre projeto/demanda/definição/produto', () => {
    const list = [mk({ id: 'A', demand: 'Migração Nubank' }), mk({ id: 'B', demand: 'Outra coisa' })]
    expect(filteredItems(list, mkFilters({ query: 'nubank' })).map(i => i.id)).toEqual(['A'])
  })

  it('gapsOnly mantém só itens ativos com lacunas de governança', () => {
    const completo = mk({
      id: 'OK', product: 'Vivo', dueDate: isoDate(addDays(new Date(), 10)), owner: 'Ana',
      definition: 'Definição', nextAction: 'Ação', progress: 40,
    })
    const comLacuna = mk({ id: 'GAP', owner: '', dueDate: '' })
    const concluido = mk({ id: 'DONE', status: 'Concluído', owner: '', dueDate: '' })
    const out = filteredItems([completo, comLacuna, concluido], mkFilters({ gapsOnly: true }))
    expect(out.map(i => i.id)).toEqual(['GAP'])
  })

  it('foco crítico mantém só Bloqueado/Atrasado/Vence hoje', () => {
    const list = [
      mk({ id: 'A', status: 'Bloqueado' }),
      mk({ id: 'B', dueDate: isoDate(addDays(new Date(), 30)) }),
    ]
    expect(filteredItems(list, mkFilters({ criticalOnly: true })).map(i => i.id)).toEqual(['A'])
  })
})

describe('sortItems', () => {
  it('ordenação por risco põe Bloqueado antes de Em controle', () => {
    const list = [mk({ id: 'OK', dueDate: isoDate(addDays(new Date(), 30)) }), mk({ id: 'BLK', status: 'Bloqueado' })]
    expect(sortItems(list, 'risk').map(i => i.id)).toEqual(['BLK', 'OK'])
  })
})

describe('nextId', () => {
  it('continua a sequência G6 e ignora ids fora do padrão', () => {
    expect(nextId([])).toBe('G6-001')
    expect(nextId([mk({ id: 'G6-031' }), mk({ id: 'X-99' })])).toBe('G6-032')
  })
})

describe('capacidade — ownerLoad / itemTeamSize / itemRemainingEffort', () => {
  it('esforço remanescente desconta o progresso', () => {
    expect(itemRemainingEffort(mk({ effortHours: 40, progress: 50 }))).toBe(20)
  })

  it('divide a carga entre os responsáveis e exclui concluídos', () => {
    const list = [
      mk({ owner: 'Ana e Bia', effortHours: 40, progress: 50 }),
      mk({ id: 'T-002', owner: 'Ana', status: 'Concluído', effortHours: 99 }),
    ]
    const load = ownerLoad(list)
    expect(load['Ana']).toBe(10)
    expect(load['Bia']).toBe(10)
  })

  it('sem responsável cai no balde "Sem responsável"', () => {
    const load = ownerLoad([mk({ owner: '', effortHours: 10, progress: 0 })])
    expect(load['Sem responsável']).toBe(10)
  })

  it('tamanho de equipe usa teamSize explícito ou conta os responsáveis', () => {
    expect(itemTeamSize(mk({ teamSize: 3 }))).toBe(3)
    expect(itemTeamSize(mk({ owner: 'Ana e Bia' }))).toBe(2)
    expect(itemTeamSize(mk({ owner: '' }))).toBe(1)
  })
})

describe('countsBy / capacityTone', () => {
  it('agrupa por chave e rotula vazio como Não informado', () => {
    const counts = countsBy([mk({ product: 'Vivo' }), mk({ product: 'Vivo' }), mk({ product: '' })], i => i.product ?? '')
    expect(counts['Vivo']).toBe(2)
    expect(counts['Não informado']).toBe(1)
  })

  it('tons de capacidade: warn ≥85%, danger ≥115%', () => {
    expect(capacityTone(84)).toBe('')
    expect(capacityTone(85)).toBe('warn')
    expect(capacityTone(115)).toBe('danger')
  })
})
