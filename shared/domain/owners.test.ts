import { describe, it, expect, beforeEach } from 'vitest'
import { setCanonicalOwners, getCanonicalOwners, splitOwners, canonicalizeOwner, ownersOf, extractMentions } from './index'

const CADASTRO = [
  'Pedro Almeida Santos',
  'Kathelleen Heloisa Silva',
  'Luiz Fernando Bertoldo dos Santos',
  'Aleff Azevedo Dias',
  'Diego Luna Pereira Peixoto',
]

beforeEach(() => setCanonicalOwners(CADASTRO))

describe('setCanonicalOwners / getCanonicalOwners', () => {
  it('descarta entradas vazias, nulas e espaços', () => {
    setCanonicalOwners(['  Ana Lima  ', '', null, undefined, '   '])
    expect(getCanonicalOwners()).toEqual(['Ana Lima'])
  })

  it('devolve uma cópia — mutar o retorno não afeta o registro', () => {
    const copy = getCanonicalOwners()
    copy.push('Intruso')
    expect(getCanonicalOwners()).toHaveLength(CADASTRO.length)
  })
})

describe('splitOwners', () => {
  it('quebra por vírgula, "e", "&" e "/"', () => {
    expect(splitOwners('Pedro e Kath')).toEqual(['Pedro', 'Kath'])
    expect(splitOwners('Aleff & Diego / Luiz')).toEqual(['Aleff', 'Diego', 'Luiz'])
    expect(splitOwners('Pedro, Kath')).toEqual(['Pedro', 'Kath'])
  })

  it('não quebra palavras que apenas contêm "e"', () => {
    expect(splitOwners('Pedro Almeida Santos')).toEqual(['Pedro Almeida Santos'])
  })

  it('entrada vazia ou ausente vira lista vazia', () => {
    expect(splitOwners('')).toEqual([])
    expect(splitOwners(undefined)).toEqual([])
    expect(splitOwners('  ,  ')).toEqual([])
  })
})

describe('canonicalizeOwner — tiers conservadores', () => {
  it('T1: igualdade normalizada corrige caixa, acento e espaço duplicado', () => {
    expect(canonicalizeOwner('pedro  almeida   santos')).toBe('Pedro Almeida Santos')
    setCanonicalOwners(['André Pedro Souza'])
    expect(canonicalizeOwner('Andre Pedro Souza')).toBe('André Pedro Souza')
  })

  it('T2: primeiro nome resolve para o nome completo', () => {
    expect(canonicalizeOwner('Pedro')).toBe('Pedro Almeida Santos')
  })

  it('T4: prefixo do primeiro nome resolve (apelido "Kath")', () => {
    expect(canonicalizeOwner('Kath')).toBe('Kathelleen Heloisa Silva')
  })

  it('T5: palavra interna única resolve ("Bertoldo")', () => {
    expect(canonicalizeOwner('Bertoldo')).toBe('Luiz Fernando Bertoldo dos Santos')
  })

  it('em ambiguidade preserva o token cru (nunca funde humanos distintos)', () => {
    setCanonicalOwners([...CADASTRO, 'Pedro Henrique Lima'])
    expect(canonicalizeOwner('Pedro')).toBe('Pedro')
  })

  it('sem match preserva o token cru', () => {
    expect(canonicalizeOwner('Carlos')).toBe('Carlos')
  })

  it('com registro vazio devolve o token como veio', () => {
    setCanonicalOwners([])
    expect(canonicalizeOwner('Pedro')).toBe('Pedro')
  })
})

describe('extractMentions — @menções resolvidas pelo cadastro', () => {
  it('resolve apelido/primeiro nome único para o nome canônico', () => {
    expect(extractMentions('@Pedro vamos revisar com a @Kath amanhã')).toEqual([
      'Pedro Almeida Santos',
      'Kathelleen Heloisa Silva',
    ])
  })

  it('ignora tokens ambíguos ou fora do cadastro', () => {
    expect(extractMentions('@Carlos pode ajudar? cc @Zeus')).toEqual([])
  })

  it('deduplica menções repetidas', () => {
    expect(extractMentions('@Pedro e de novo @pedro')).toEqual(['Pedro Almeida Santos'])
  })
})

describe('ownersOf — chokepoint de responsáveis', () => {
  it('quebra, canoniza e deduplica', () => {
    expect(ownersOf('Pedro e Kath')).toEqual(['Pedro Almeida Santos', 'Kathelleen Heloisa Silva'])
    expect(ownersOf('Pedro, pedro almeida santos')).toEqual(['Pedro Almeida Santos'])
  })

  it('vazio vira lista vazia', () => {
    expect(ownersOf('')).toEqual([])
    expect(ownersOf(undefined)).toEqual([])
  })
})
