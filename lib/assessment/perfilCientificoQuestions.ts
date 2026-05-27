/**
 * Avaliação de Perfil Científico — taxonomia de competências + banco de itens.
 *
 * Fonte da verdade do CONTEÚDO da avaliação paga (R$ 99,90). As tabelas Drizzle
 * `perfil_cientifico_*` armazenam respostas e resultados; este arquivo define a
 * estrutura e o texto canônico dos itens.
 *
 * Modelo (PRD §3.2): 5 domínios → 18 competências → ~54 sub-competências.
 *
 * Formato dos itens (v2.0 — Situational Judgment Test): em vez de uma escala
 * Likert "concordo/discordo" (que mede autoconceito e sofre de aquiescência e
 * desejabilidade social), todo item fechado apresenta uma SITUAÇÃO concreta e
 * 5 alternativas que descrevem comportamentos reais, graduadas por nível de
 * competência (score 1-5). O respondente escolhe a alternativa mais próxima de
 * como age, pensa ou se sente — a direção da competência fica embutida na
 * alternativa, sem reverse-coding.
 *
 * - `scenario`   — cenário de trabalho + ações possíveis (Cognição, Negócio,
 *                  Relação, Crescimento). A ordem das alternativas é embaralhada
 *                  ao servir, para não revelar a opção de maior pontuação.
 * - `behavioral` — padrão/estado recorrente + descrições de como a pessoa tem
 *                  se sentido (Energia & Equilíbrio Emocional). As alternativas
 *                  formam uma escala natural de intensidade.
 *
 * Questionário (PRD §3.3): 108 itens fechados, 5 perguntas abertas, 14 pares
 * espelhados (dois itens da mesma competência por situações distintas) para o
 * índice de consistência.
 *
 * Independente do Radar Vértice e do módulo IRT genérico. Não importa nem é
 * importado por nenhum deles — aditivo puro.
 */

// ============ TIPOS ============

export type DomainSlug = "cognicao" | "negocio" | "energia" | "relacao" | "crescimento";

/**
 * `scenario`   — cenário situacional; alternativas embaralhadas ao servir.
 * `behavioral` — padrão/estado recorrente; alternativas em escala natural.
 */
export type ItemType = "scenario" | "behavioral";

/** Alternativa de um item, com o score (1-5) embutido. */
export interface SituationalOption {
  readonly value: string;
  readonly label: string;
  /** Grau de competência demonstrado pela alternativa — 1 (menos) a 5 (mais). */
  readonly score: number;
}

export interface SubCompetency {
  readonly slug: string;
  readonly name: string;
}

export interface Competency {
  readonly slug: string;
  readonly name: string;
  readonly domain: DomainSlug;
  readonly description: string;
  readonly subCompetencies: readonly SubCompetency[];
}

export interface Domain {
  readonly slug: DomainSlug;
  readonly code: "A" | "B" | "C" | "D" | "E";
  readonly name: string;
  readonly description: string;
}

/** Item fechado pontuável — sempre situacional, com 5 alternativas. */
export interface ClosedQuestion {
  /** Código estável — ex.: "PA-01". Unique em todo o banco. */
  readonly code: string;
  readonly domain: DomainSlug;
  readonly competency: string;
  readonly subCompetency: string;
  readonly type: ItemType;
  /** Enunciado: a situação ou o padrão sobre o qual o respondente decide. */
  readonly prompt: string;
  /** 5 alternativas, cada uma com score 1-5 (um de cada). */
  readonly options: readonly SituationalOption[];
  /**
   * Código do item gêmeo no par espelhado — outro item da mesma competência
   * que mede o construto por uma situação distinta. Os dois itens do par
   * carregam o código um do outro. `null` quando o item não pertence a um par.
   */
  readonly mirrorPairCode: string | null;
  readonly weight: number;
}

/** Pergunta aberta dissertativa — não pontuada, alimenta o laudo da IA. */
export interface OpenQuestion {
  readonly code: string;
  readonly prompt: string;
  readonly helper: string;
}

// ============ DOMÍNIOS (5) ============

export const DOMAINS: readonly Domain[] = [
  {
    slug: "cognicao",
    code: "A",
    name: "Cognição & Análise",
    description:
      "Como o profissional pensa: lê dados, raciocina, usa IA, conecta sistemas e resolve problemas.",
  },
  {
    slug: "negocio",
    code: "B",
    name: "Negócio & Cliente",
    description:
      "Como o profissional gera valor: entende o cliente, entrega resultado e lê o negócio.",
  },
  {
    slug: "energia",
    code: "C",
    name: "Energia & Equilíbrio Emocional",
    description:
      "A base vital e emocional: inteligência emocional, vitalidade, resiliência e autogestão.",
  },
  {
    slug: "relacao",
    code: "D",
    name: "Relação & Influência",
    description:
      "Como o profissional opera com pessoas: vínculo, comunicação, liderança e negociação.",
  },
  {
    slug: "crescimento",
    code: "E",
    name: "Crescimento & Propósito",
    description:
      "O motor de evolução: aprendizado contínuo, adaptabilidade/inovação e clareza de direção.",
  },
] as const;

// ============ COMPETÊNCIAS (18) + SUB-COMPETÊNCIAS (~54) ============

export const COMPETENCIES: readonly Competency[] = [
  // ─── Domínio A — Cognição & Análise ───
  {
    slug: "pensamento_analitico",
    name: "Pensamento Analítico",
    domain: "cognicao",
    description: "Capacidade de ler dados, raciocinar de forma crítica e formular hipóteses.",
    subCompetencies: [
      { slug: "leitura_de_dados", name: "Leitura de dados" },
      { slug: "raciocinio_critico", name: "Raciocínio crítico" },
      { slug: "formulacao_de_hipoteses", name: "Formulação de hipóteses" },
    ],
  },
  {
    slug: "fluencia_ia_aplicada",
    name: "Fluência em IA Aplicada",
    domain: "cognicao",
    description: "Repertório de IA, julgamento sobre os outputs e pensamento de prompt.",
    subCompetencies: [
      { slug: "repertorio_de_ia", name: "Repertório de IA" },
      { slug: "julgamento_de_outputs", name: "Julgamento de outputs" },
      { slug: "pensamento_de_prompt", name: "Pensamento de prompt" },
    ],
  },
  {
    slug: "visao_sistemica",
    name: "Visão Sistêmica",
    domain: "cognicao",
    description: "Conexão entre áreas, pensamento de segunda ordem e capacidade de síntese.",
    subCompetencies: [
      { slug: "conexao_entre_areas", name: "Conexão entre áreas" },
      { slug: "pensamento_de_segunda_ordem", name: "Pensamento de 2ª ordem" },
      { slug: "sintese", name: "Síntese" },
    ],
  },
  {
    slug: "resolucao_de_problemas",
    name: "Resolução de Problemas",
    domain: "cognicao",
    description: "Decomposição, priorização e criatividade aplicada à solução.",
    subCompetencies: [
      { slug: "decomposicao", name: "Decomposição" },
      { slug: "priorizacao", name: "Priorização" },
      { slug: "criatividade_aplicada", name: "Criatividade aplicada" },
    ],
  },

  // ─── Domínio B — Negócio & Cliente ───
  {
    slug: "experiencia_do_cliente",
    name: "Experiência do Cliente",
    domain: "negocio",
    description: "Empatia de jornada, leitura de fricção e construção de valor percebido.",
    subCompetencies: [
      { slug: "empatia_de_jornada", name: "Empatia de jornada" },
      { slug: "leitura_de_friccao", name: "Leitura de fricção" },
      { slug: "valor_percebido", name: "Valor percebido" },
    ],
  },
  {
    slug: "orientacao_a_resultado",
    name: "Orientação a Resultado",
    domain: "negocio",
    description: "Foco em impacto, disciplina de entrega e accountability.",
    subCompetencies: [
      { slug: "foco_em_impacto", name: "Foco em impacto" },
      { slug: "disciplina_de_entrega", name: "Disciplina de entrega" },
      { slug: "accountability", name: "Accountability" },
    ],
  },
  {
    slug: "visao_de_negocio",
    name: "Visão de Negócio",
    domain: "negocio",
    description: "Noção de receita e custo, leitura de mercado e pensamento estratégico.",
    subCompetencies: [
      { slug: "noção_receita_custo", name: "Noção de receita e custo" },
      { slug: "leitura_de_mercado", name: "Leitura de mercado" },
      { slug: "pensamento_estrategico", name: "Pensamento estratégico" },
    ],
  },

  // ─── Domínio C — Energia & Equilíbrio Emocional ───
  {
    slug: "inteligencia_emocional",
    name: "Inteligência Emocional",
    domain: "energia",
    description: "Autoconsciência, autorregulação e empatia.",
    subCompetencies: [
      { slug: "autoconsciencia", name: "Autoconsciência" },
      { slug: "autorregulacao", name: "Autorregulação" },
      { slug: "empatia", name: "Empatia" },
    ],
  },
  {
    slug: "tonus_vital",
    name: "Tônus Vital",
    domain: "energia",
    description: "Vitalidade, gestão de energia e presença.",
    subCompetencies: [
      { slug: "vitalidade", name: "Vitalidade" },
      { slug: "gestao_de_energia", name: "Gestão de energia" },
      { slug: "presenca", name: "Presença" },
    ],
  },
  {
    slug: "resiliencia",
    name: "Resiliência",
    domain: "energia",
    description: "Recuperação à adversidade, tolerância à ambiguidade e estabilidade sob pressão.",
    subCompetencies: [
      { slug: "recuperacao_a_adversidade", name: "Recuperação à adversidade" },
      { slug: "tolerancia_a_ambiguidade", name: "Tolerância à ambiguidade" },
      { slug: "estabilidade_sob_pressao", name: "Estabilidade sob pressão" },
    ],
  },
  {
    slug: "autogestao_e_foco",
    name: "Autogestão & Foco",
    domain: "energia",
    description: "Disciplina, gestão de atenção e autonomia.",
    subCompetencies: [
      { slug: "disciplina", name: "Disciplina" },
      { slug: "gestao_de_atencao", name: "Gestão de atenção" },
      { slug: "autonomia", name: "Autonomia" },
    ],
  },

  // ─── Domínio D — Relação & Influência ───
  {
    slug: "relacionamento",
    name: "Relacionamento",
    domain: "relacao",
    description: "Construção de vínculo, colaboração e rede de contatos.",
    subCompetencies: [
      { slug: "construcao_de_vinculo", name: "Construção de vínculo" },
      { slug: "colaboracao", name: "Colaboração" },
      { slug: "rede_de_contatos", name: "Rede de contatos" },
    ],
  },
  {
    slug: "comunicacao_e_influencia",
    name: "Comunicação & Influência",
    domain: "relacao",
    description: "Clareza, narrativa e escuta ativa.",
    subCompetencies: [
      { slug: "clareza", name: "Clareza" },
      { slug: "narrativa", name: "Narrativa" },
      { slug: "escuta_ativa", name: "Escuta ativa" },
    ],
  },
  {
    slug: "lideranca_e_desenvolvimento",
    name: "Liderança & Desenvolvimento",
    domain: "relacao",
    description: "Inspirar, delegar e dar feedback.",
    subCompetencies: [
      { slug: "inspirar", name: "Inspirar" },
      { slug: "delegar", name: "Delegar" },
      { slug: "dar_feedback", name: "Dar feedback" },
    ],
  },
  {
    slug: "negociacao_e_conflito",
    name: "Negociação & Gestão de Conflito",
    domain: "relacao",
    description: "Assertividade, mediação e busca de ganha-ganha.",
    subCompetencies: [
      { slug: "assertividade", name: "Assertividade" },
      { slug: "mediacao", name: "Mediação" },
      { slug: "ganha_ganha", name: "Busca de ganha-ganha" },
    ],
  },

  // ─── Domínio E — Crescimento & Propósito ───
  {
    slug: "aprendizado_continuo",
    name: "Aprendizado Contínuo",
    domain: "crescimento",
    description: "Autodesenvolvimento, curiosidade e capacidade de desaprender.",
    subCompetencies: [
      { slug: "autodesenvolvimento", name: "Autodesenvolvimento" },
      { slug: "curiosidade", name: "Curiosidade" },
      { slug: "capacidade_de_desaprender", name: "Capacidade de desaprender" },
    ],
  },
  {
    slug: "adaptabilidade_e_inovacao",
    name: "Adaptabilidade & Inovação",
    domain: "crescimento",
    description: "Abertura à mudança, experimentação e iniciativa.",
    subCompetencies: [
      { slug: "abertura_a_mudanca", name: "Abertura à mudança" },
      { slug: "experimentacao", name: "Experimentação" },
      { slug: "iniciativa", name: "Iniciativa" },
    ],
  },
  {
    slug: "proposito_e_direcao",
    name: "Propósito & Direção",
    domain: "crescimento",
    description: "Clareza de objetivo, intencionalidade e alinhamento valor-trabalho.",
    subCompetencies: [
      { slug: "clareza_de_objetivo", name: "Clareza de objetivo" },
      { slug: "intencionalidade", name: "Intencionalidade" },
      { slug: "alinhamento_valor_trabalho", name: "Alinhamento valor-trabalho" },
    ],
  },
] as const;

// ============ BANCO DE ITENS FECHADOS (108) ============

/**
 * 6 itens por competência (2 por sub-competência). Itens com `mirrorPairCode`
 * formam pares espelhados — ver MIRROR_PAIRS abaixo. As alternativas são
 * sempre escritas em ordem crescente de score (1→5); o embaralhamento dos
 * itens `scenario` acontece no router, ao servir.
 */
export const CLOSED_QUESTIONS: readonly ClosedQuestion[] = [
  // ═══════════ DOMÍNIO A — COGNIÇÃO & ANÁLISE ═══════════

  // ═══ pensamento_analitico ═══
  {
    code: "PA-01", domain: "cognicao", competency: "pensamento_analitico",
    subCompetency: "leitura_de_dados", type: "scenario",
    prompt: "Você recebe um relatório mensal e uma das métricas saltou bem acima do esperado. O time já comemora o resultado. O que está mais próximo de você?",
    options: [
      { value: "a", label: "Comemoro junto — se o número subiu, é sinal de que o trabalho está dando certo.", score: 1 },
      { value: "b", label: "Acho ótimo, mas guardo uma leve dúvida em silêncio para não esfriar o clima do time.", score: 2 },
      { value: "c", label: "Aceito o número, mas comento que seria bom alguém conferir aquilo depois, sem prazo definido.", score: 3 },
      { value: "d", label: "Abro o relatório e verifico de onde veio aquele valor antes de tratá-lo como conquista.", score: 4 },
      { value: "e", label: "Investigo a origem do dado, descarto erro de medição ou efeito pontual e só então confirmo se é resultado real.", score: 5 },
    ],
    mirrorPairCode: null, weight: 1,
  },
  {
    code: "PA-02", domain: "cognicao", competency: "pensamento_analitico",
    subCompetency: "leitura_de_dados", type: "scenario",
    prompt: "Um indicador-chave do seu painel apareceu hoje com um valor estranho, fora do padrão das últimas semanas. Como você costuma agir?",
    options: [
      { value: "a", label: "Sigo o trabalho normalmente — um número esquisito num dia não muda nada do que eu já planejei.", score: 1 },
      { value: "b", label: "Anoto mentalmente a estranheza e espero o relatório do dia seguinte para ver se ela some sozinha.", score: 2 },
      { value: "c", label: "Pergunto a um colega se ele também notou aquilo, mas não chego a checar a fonte do dado.", score: 3 },
      { value: "d", label: "Rastreio de onde veio o número e confirmo se houve erro de coleta antes de usá-lo em qualquer decisão.", score: 4 },
      { value: "e", label: "Reconstruo o caminho do dado até a origem, identifico a causa do desvio e ajusto a leitura antes de seguir.", score: 5 },
    ],
    mirrorPairCode: null, weight: 1,
  },
  {
    code: "PA-03", domain: "cognicao", competency: "pensamento_analitico",
    subCompetency: "raciocinio_critico", type: "scenario",
    prompt: "Em uma reunião, um colega apresenta uma proposta com bastante segurança e boa retórica, mas sustentada por poucos exemplos concretos. O que está mais próximo de você?",
    options: [
      { value: "a", label: "Apoio a proposta — quem fala com tanta convicção normalmente sabe do que está dizendo.", score: 1 },
      { value: "b", label: "Fico com o pé atrás, mas não digo nada para não bancar o chato da reunião.", score: 2 },
      { value: "c", label: "Acompanho a maioria, mas registro que gostaria de ver isso melhor fundamentado em algum momento.", score: 3 },
      { value: "d", label: "Pergunto, ali mesmo, qual é a evidência por trás do argumento antes de me posicionar.", score: 4 },
      { value: "e", label: "Separo a qualidade da apresentação da força do argumento e peço os dados que sustentariam a conclusão.", score: 5 },
    ],
    mirrorPairCode: null, weight: 1,
  },
  {
    code: "PA-04", domain: "cognicao", competency: "pensamento_analitico",
    subCompetency: "raciocinio_critico", type: "scenario",
    prompt: "As vendas cresceram no mesmo mês em que vocês trocaram a embalagem do produto. O time conclui que a embalagem foi a responsável. Como você costuma agir?",
    options: [
      { value: "a", label: "Concordo com a conclusão — as duas coisas aconteceram juntas, então uma explica a outra.", score: 1 },
      { value: "b", label: "Aceito a explicação porque ela é simples e o time parece confortável com ela.", score: 2 },
      { value: "c", label: "Acho a relação possível, mas confesso que não saberia dizer ao certo se foi mesmo a causa.", score: 3 },
      { value: "d", label: "Levanto outros fatores do período — sazonalidade, promoção, campanha — antes de atribuir o ganho à embalagem.", score: 4 },
      { value: "e", label: "Comparo o período com um momento sem a mudança e isolo as variáveis até distinguir causa real de coincidência.", score: 5 },
    ],
    mirrorPairCode: null, weight: 1,
  },
  {
    code: "PA-05", domain: "cognicao", competency: "pensamento_analitico",
    subCompetency: "formulacao_de_hipoteses", type: "scenario",
    prompt: "Um processo que funcionava bem começou a falhar sem motivo aparente, e ninguém sabe explicar o porquê. O que está mais próximo de você?",
    options: [
      { value: "a", label: "Vou testando ajustes aleatórios até alguma coisa funcionar, sem teoria por trás.", score: 1 },
      { value: "b", label: "Pego o palpite mais comentado no time e tento corrigir por ali, sem considerar outras causas.", score: 2 },
      { value: "c", label: "Penso em uma explicação provável e parto direto para a correção sem checar se ela se sustenta.", score: 3 },
      { value: "d", label: "Levanto algumas hipóteses possíveis para a falha antes de escolher por onde começar a investigar.", score: 4 },
      { value: "e", label: "Formulo hipóteses claras, ordeno-as pela probabilidade e testo cada uma de forma a confirmar ou descartar.", score: 5 },
    ],
    mirrorPairCode: null, weight: 1,
  },
  {
    code: "PA-06", domain: "cognicao", competency: "pensamento_analitico",
    subCompetency: "leitura_de_dados", type: "scenario",
    prompt: "Você precisa decidir hoje se mantém um fornecedor. Sua experiência diz uma coisa; os dados de desempenho dele estão num relatório que você ainda não abriu. Como você costuma agir?",
    options: [
      { value: "a", label: "Decido pela intuição — já lido com fornecedores há tempo e confio no meu faro para isso.", score: 1 },
      { value: "b", label: "Sigo a minha impressão e deixo o relatório para uma eventual consulta futura, se sobrar tempo.", score: 2 },
      { value: "c", label: "Dou uma olhada rápida no relatório, mas a decisão acaba pesando mais para o que eu já sentia.", score: 3 },
      { value: "d", label: "Abro o relatório e confronto os números com a minha percepção antes de fechar a decisão.", score: 4 },
      { value: "e", label: "Analiso os dados de desempenho a fundo e uso a minha experiência para interpretá-los, não para substituí-los.", score: 5 },
    ],
    mirrorPairCode: null, weight: 1,
  },

  // ═══ fluencia_ia_aplicada ═══
  {
    code: "IA-01", domain: "cognicao", competency: "fluencia_ia_aplicada",
    subCompetency: "repertorio_de_ia", type: "scenario",
    prompt: "Surge uma tarefa nova na sua semana — resumir documentos longos, gerar imagens, analisar planilhas — e há várias ferramentas de IA disponíveis. Como você costuma agir?",
    options: [
      { value: "a", label: "Faço tudo no braço como sempre fiz; mexer com ferramenta de IA me parece mais trabalho do que ajuda.", score: 1 },
      { value: "b", label: "Uso a única ferramenta de IA que conheço para tudo, mesmo quando ela não é a mais adequada.", score: 2 },
      { value: "c", label: "Conheço algumas opções, mas na pressa acabo escolhendo a primeira que vem à cabeça.", score: 3 },
      { value: "d", label: "Penso em qual ferramenta se encaixa melhor naquele tipo de tarefa antes de começar.", score: 4 },
      { value: "e", label: "Escolho a ferramenta certa para cada tipo de tarefa e combino mais de uma quando isso entrega um resultado melhor.", score: 5 },
    ],
    mirrorPairCode: null, weight: 1,
  },
  {
    code: "IA-02", domain: "cognicao", competency: "fluencia_ia_aplicada",
    subCompetency: "repertorio_de_ia", type: "scenario",
    prompt: "Parte da sua rotina envolve atividades repetitivas que tomam horas — triagem, rascunhos, organização de dados. O que está mais próximo de você?",
    options: [
      { value: "a", label: "Continuo fazendo tudo manualmente; é assim que sempre funcionou e prefiro não mudar.", score: 1 },
      { value: "b", label: "Já pensei em usar IA para isso, mas nunca cheguei a parar para experimentar de verdade.", score: 2 },
      { value: "c", label: "Uso IA em uma ou outra tarefa pontual, sem ter mapeado onde ela renderia mais.", score: 3 },
      { value: "d", label: "Identifico as atividades repetitivas e aplico IA nelas para liberar tempo para o que exige julgamento.", score: 4 },
      { value: "e", label: "Reviso minha rotina com frequência, automatizo o repetitível com IA e realoco o tempo ganho para o trabalho de maior valor.", score: 5 },
    ],
    mirrorPairCode: null, weight: 1,
  },
  {
    code: "IA-03", domain: "cognicao", competency: "fluencia_ia_aplicada",
    subCompetency: "julgamento_de_outputs", type: "scenario",
    prompt: "Você pediu a uma IA um texto que será enviado a um cliente importante. O resultado veio bem escrito e convincente. Como você costuma agir?",
    options: [
      { value: "a", label: "Envio direto — está bem escrito e a IA dificilmente erraria algo assim.", score: 1 },
      { value: "b", label: "Dou uma lida rápida só para ver se o tom ficou agradável e mando em seguida.", score: 2 },
      { value: "c", label: "Releio o texto inteiro, corrijo o que me incomoda, mas não confiro os fatos que ele afirma.", score: 3 },
      { value: "d", label: "Reviso o conteúdo, checo se os dados e afirmações estão corretos e ajusto antes de enviar.", score: 4 },
      { value: "e", label: "Avalio o texto criticamente, verifico fatos, tom e adequação ao cliente, e o trato como rascunho até validá-lo por completo.", score: 5 },
    ],
    mirrorPairCode: "IA-06", weight: 1,
  },
  {
    code: "IA-04", domain: "cognicao", competency: "fluencia_ia_aplicada",
    subCompetency: "pensamento_de_prompt", type: "scenario",
    prompt: "Você pede algo a uma IA e o primeiro resultado vem genérico, longe do que você precisava. O que está mais próximo de você?",
    options: [
      { value: "a", label: "Desisto da ferramenta para essa tarefa — concluo que a IA não serve para o que eu queria.", score: 1 },
      { value: "b", label: "Repito o mesmo pedido quase igual, esperando que dessa vez saia diferente.", score: 2 },
      { value: "c", label: "Faço um pequeno ajuste na frase e aceito o que vier, mesmo que ainda não esteja bom.", score: 3 },
      { value: "d", label: "Reescrevo o pedido apontando o que faltou e detalhando melhor o que eu espero de retorno.", score: 4 },
      { value: "e", label: "Diagnostico por que o resultado falhou, reformulo o pedido com contexto e critérios claros e refino em rodadas até acertar.", score: 5 },
    ],
    mirrorPairCode: null, weight: 1,
  },
  {
    code: "IA-05", domain: "cognicao", competency: "fluencia_ia_aplicada",
    subCompetency: "pensamento_de_prompt", type: "scenario",
    prompt: "Você vai usar uma IA para produzir um material de trabalho e tem alguns minutos para montar o pedido. Como você costuma agir?",
    options: [
      { value: "a", label: "Escrevo uma frase curta e genérica e aceito o que a ferramenta devolver.", score: 1 },
      { value: "b", label: "Faço um pedido direto, sem contexto, e vou corrigindo só depois se o resultado não servir.", score: 2 },
      { value: "c", label: "Dou alguma instrução, mas deixo de fora o contexto e os exemplos que ajudariam a IA a acertar.", score: 3 },
      { value: "d", label: "Explico o objetivo, dou contexto e incluo um exemplo do tipo de resultado que espero.", score: 4 },
      { value: "e", label: "Estruturo o pedido com objetivo, contexto, exemplos e critérios de qualidade, antecipando onde a IA poderia se perder.", score: 5 },
    ],
    mirrorPairCode: null, weight: 1,
  },
  {
    code: "IA-06", domain: "cognicao", competency: "fluencia_ia_aplicada",
    subCompetency: "julgamento_de_outputs", type: "scenario",
    prompt: "No meio de um prazo apertado, uma IA entrega rapidamente uma análise pronta para você incluir num relatório interno. O que está mais próximo de você?",
    options: [
      { value: "a", label: "Aproveito direto — a IA poupou tempo e o prazo não permite ficar revisando.", score: 1 },
      { value: "b", label: "Confio que está certo e só dou uma olhada na formatação antes de colar no relatório.", score: 2 },
      { value: "c", label: "Leio por cima para sentir se faz sentido, mas não confiro os números nem as conclusões.", score: 3 },
      { value: "d", label: "Mesmo com pressa, checo os pontos críticos da análise antes de assumi-la como minha.", score: 4 },
      { value: "e", label: "Trato a entrega como rascunho, verifico dados e raciocínio e só incorporo o que eu mesmo consigo sustentar.", score: 5 },
    ],
    mirrorPairCode: "IA-03", weight: 1,
  },

  // ═══ visao_sistemica ═══
  {
    code: "VS-01", domain: "cognicao", competency: "visao_sistemica",
    subCompetency: "conexao_entre_areas", type: "scenario",
    prompt: "Você vai implantar uma melhoria que torna o trabalho da sua área mais rápido. A mudança altera a forma como você entrega informação para outros setores. Como você costuma agir?",
    options: [
      { value: "a", label: "Implanto a melhoria — o que importa é a minha área ganhar agilidade, o resto se ajeita.", score: 1 },
      { value: "b", label: "Sigo com a mudança e aviso as outras áreas só depois, quando elas perceberem a diferença.", score: 2 },
      { value: "c", label: "Comento informalmente com um colega de outro setor, mas não chego a mapear o impacto real.", score: 3 },
      { value: "d", label: "Antes de implantar, levanto quais áreas dependem da minha entrega e converso com elas sobre o efeito.", score: 4 },
      { value: "e", label: "Mapeio a cadeia de impacto entre as áreas, alinho a mudança com quem é afetado e ajusto o desenho para que o ganho seja do conjunto.", score: 5 },
    ],
    mirrorPairCode: "VS-06", weight: 1,
  },
  {
    code: "VS-02", domain: "cognicao", competency: "visao_sistemica",
    subCompetency: "conexao_entre_areas", type: "scenario",
    prompt: "Você quer propor uma mudança em um processo que a sua equipe controla. Antes de levar a ideia adiante, o que está mais próximo de você?",
    options: [
      { value: "a", label: "Levo a proposta direto — é um processo da minha equipe e a decisão cabe a nós.", score: 1 },
      { value: "b", label: "Penso só nos efeitos sobre o meu time e deixo as demais áreas descobrirem depois.", score: 2 },
      { value: "c", label: "Lembro vagamente que outras áreas usam esse processo, mas não chego a consultá-las.", score: 3 },
      { value: "d", label: "Mapeio quem mais será impactado pela mudança e ouço essas áreas antes de propor.", score: 4 },
      { value: "e", label: "Identifico todos os afetados, recolho a visão de cada um e incorporo isso à proposta antes de apresentá-la.", score: 5 },
    ],
    mirrorPairCode: null, weight: 1,
  },
  {
    code: "VS-03", domain: "cognicao", competency: "visao_sistemica",
    subCompetency: "pensamento_de_segunda_ordem", type: "scenario",
    prompt: "Para bater a meta do trimestre, o time propõe oferecer um desconto agressivo a todos os clientes. A decisão precisa sair hoje. O que está mais próximo de você?",
    options: [
      { value: "a", label: "Apoio na hora — resolve a meta deste trimestre, e é isso que está em jogo agora.", score: 1 },
      { value: "b", label: "Concordo, mas comento de passagem que talvez traga algum efeito ruim depois.", score: 2 },
      { value: "c", label: "Aceito a ideia e penso que os efeitos seguintes serão tratados quando aparecerem.", score: 3 },
      { value: "d", label: "Aponto o que o desconto pode causar adiante — margem, expectativa do cliente — antes de o time decidir.", score: 4 },
      { value: "e", label: "Mostro a cadeia de efeitos de segunda ordem e proponho um desenho que bata a meta sem comprometer os trimestres seguintes.", score: 5 },
    ],
    mirrorPairCode: null, weight: 1,
  },
  {
    code: "VS-04", domain: "cognicao", competency: "visao_sistemica",
    subCompetency: "sintese", type: "scenario",
    prompt: "Você sai de uma reunião longa, com muitos dados, opiniões e ramificações, e precisa repassar o essencial à liderança em poucos minutos. Como você costuma agir?",
    options: [
      { value: "a", label: "Repasso tudo o que foi dito, na ordem em que surgiu, e deixo a liderança filtrar o que importa.", score: 1 },
      { value: "b", label: "Conto os pontos de que eu lembro, sem muita preocupação com o que é central ou secundário.", score: 2 },
      { value: "c", label: "Resumo alguns trechos, mas acabo deixando de fora pontos importantes ou misturando-os com detalhes.", score: 3 },
      { value: "d", label: "Organizo o que ouvi e apresento as poucas ideias centrais que a liderança precisa para decidir.", score: 4 },
      { value: "e", label: "Destilo o cenário em poucas ideias centrais com a conclusão e a recomendação claras, sem perder o essencial.", score: 5 },
    ],
    mirrorPairCode: null, weight: 1,
  },
  {
    code: "VS-05", domain: "cognicao", competency: "visao_sistemica",
    subCompetency: "sintese", type: "scenario",
    prompt: "Ao longo do ano você lida com problemas que parecem isolados — um atraso aqui, uma reclamação ali, um retrabalho em outro setor. O que está mais próximo de você?",
    options: [
      { value: "a", label: "Trato cada caso como um evento à parte e resolvo um de cada vez, sem relacioná-los.", score: 1 },
      { value: "b", label: "Resolvo os problemas conforme surgem e raramente paro para compará-los entre si.", score: 2 },
      { value: "c", label: "Às vezes percebo alguma semelhança entre os casos, mas não chego a investigar o que liga eles.", score: 3 },
      { value: "d", label: "Comparo os episódios e identifico padrões que se repetem por trás de problemas aparentemente diferentes.", score: 4 },
      { value: "e", label: "Reconheço o padrão comum, busco a causa de raiz que conecta os casos e atuo nela em vez de tratar sintoma por sintoma.", score: 5 },
    ],
    mirrorPairCode: null, weight: 1,
  },
  {
    code: "VS-06", domain: "cognicao", competency: "visao_sistemica",
    subCompetency: "conexao_entre_areas", type: "scenario",
    prompt: "Um problema aparece numa zona cinzenta entre a sua área e outra. Resolvê-lo daria trabalho extra e iria além do seu escopo formal. O que está mais próximo de você?",
    options: [
      { value: "a", label: "Sigo no meu escopo — não é minha responsabilidade e quem cuida da outra parte que resolva.", score: 1 },
      { value: "b", label: "Faço a minha parte e deixo o ponto pendente para a outra área notar e tratar por conta própria.", score: 2 },
      { value: "c", label: "Aviso a outra área que existe esse problema, mas não me envolvo na solução.", score: 3 },
      { value: "d", label: "Procuro a outra área e ajudo a desenhar uma solução conjunta, mesmo que dê trabalho extra.", score: 4 },
      { value: "e", label: "Assumo a articulação entre as áreas, conecto as partes envolvidas e conduzo a resolução pensando na operação como um todo.", score: 5 },
    ],
    mirrorPairCode: "VS-01", weight: 1,
  },

  // ═══ resolucao_de_problemas ═══
  {
    code: "RP-01", domain: "cognicao", competency: "resolucao_de_problemas",
    subCompetency: "decomposicao", type: "scenario",
    prompt: "Você recebe um projeto grande e mal definido, com várias frentes em aberto e um prazo que assusta. Como você costuma agir?",
    options: [
      { value: "a", label: "Mergulho de cabeça e vou fazendo o que aparece pela frente, sem desenhar um plano antes.", score: 1 },
      { value: "b", label: "Olho o todo, sinto que é grande demais e adio o início esperando o cenário ficar mais claro.", score: 2 },
      { value: "c", label: "Separo o projeto em duas ou três partes amplas, mas começo antes de detalhar o que cada uma exige.", score: 3 },
      { value: "d", label: "Quebro o projeto em partes menores e tratáveis e defino por onde começar antes de executar.", score: 4 },
      { value: "e", label: "Decomponho o projeto em etapas claras, mapeio as dependências entre elas e sequencio o trabalho de forma realista.", score: 5 },
    ],
    mirrorPairCode: null, weight: 1,
  },
  {
    code: "RP-02", domain: "cognicao", competency: "resolucao_de_problemas",
    subCompetency: "decomposicao", type: "scenario",
    prompt: "Um projeto em andamento travou e não avança, mas não está óbvio qual etapa é a responsável pelo bloqueio. O que está mais próximo de você?",
    options: [
      { value: "a", label: "Cobro o time de forma geral por mais empenho, sem investigar onde exatamente está o nó.", score: 1 },
      { value: "b", label: "Espero o bloqueio se resolver sozinho ou alguém apontar o problema por mim.", score: 2 },
      { value: "c", label: "Aposto na etapa que me parece mais provável e tento destravá-la sem confirmar se é ali.", score: 3 },
      { value: "d", label: "Reviso o fluxo etapa por etapa e isolo qual delas está, de fato, causando o bloqueio.", score: 4 },
      { value: "e", label: "Percorro o fluxo, isolo a etapa crítica, identifico a causa do travamento e atuo nela com um plano claro de saída.", score: 5 },
    ],
    mirrorPairCode: null, weight: 1,
  },
  {
    code: "RP-03", domain: "cognicao", competency: "resolucao_de_problemas",
    subCompetency: "priorizacao", type: "scenario",
    prompt: "Sua manhã começa com vários pedidos chegando ao mesmo tempo: alguns barulhentos e urgentes, outros silenciosos mas importantes. Como você costuma agir?",
    options: [
      { value: "a", label: "Atendo primeiro quem grita mais alto; o pedido mais barulhento costuma ditar a minha ordem.", score: 1 },
      { value: "b", label: "Faço na ordem em que os pedidos chegaram, sem distinguir o que é urgente do que é importante.", score: 2 },
      { value: "c", label: "Percebo que há prioridades diferentes, mas, na correria, acabo tocando tudo de forma misturada.", score: 3 },
      { value: "d", label: "Separo o que é urgente do que é importante e organizo a sequência do dia a partir dessa distinção.", score: 4 },
      { value: "e", label: "Classifico cada pedido por urgência e impacto, negocio prazos do que pode esperar e protejo tempo para o que é importante.", score: 5 },
    ],
    mirrorPairCode: "RP-06", weight: 1,
  },
  {
    code: "RP-04", domain: "cognicao", competency: "resolucao_de_problemas",
    subCompetency: "priorizacao", type: "scenario",
    prompt: "Você tem uma lista longa de tarefas para a semana e tempo claramente insuficiente para fazer tudo bem-feito. O que está mais próximo de você?",
    options: [
      { value: "a", label: "Tento dar conta de tudo no mesmo nível e acabo entregando muita coisa pela metade.", score: 1 },
      { value: "b", label: "Começo pelas tarefas mais fáceis e rápidas, para a lista parecer menor antes de tudo.", score: 2 },
      { value: "c", label: "Distribuo o esforço de forma parecida entre os itens, sem avaliar quais rendem mais resultado.", score: 3 },
      { value: "d", label: "Concentro o esforço nos poucos itens que geram a maior parte do resultado da semana.", score: 4 },
      { value: "e", label: "Identifico os itens de maior impacto, concentro neles a minha melhor energia e renegocio ou simplifico o resto.", score: 5 },
    ],
    mirrorPairCode: null, weight: 1,
  },
  {
    code: "RP-05", domain: "cognicao", competency: "resolucao_de_problemas",
    subCompetency: "criatividade_aplicada", type: "scenario",
    prompt: "A solução habitual para um problema recorrente deixou de funcionar, e repeti-la só vem gerando frustração. Como você costuma agir?",
    options: [
      { value: "a", label: "Insisto no caminho de sempre, com mais força, esperando que dessa vez funcione.", score: 1 },
      { value: "b", label: "Considero o problema sem solução por ora e sigo convivendo com ele do jeito que está.", score: 2 },
      { value: "c", label: "Faço pequenos ajustes na abordagem conhecida, sem cogitar um caminho realmente diferente.", score: 3 },
      { value: "d", label: "Busco soluções alternativas, mesmo pouco convencionais, quando o caminho óbvio não resolve.", score: 4 },
      { value: "e", label: "Reformulo o próprio problema, exploro ângulos novos e testo uma solução fora do padrão de forma controlada.", score: 5 },
    ],
    mirrorPairCode: null, weight: 1,
  },
  {
    code: "RP-06", domain: "cognicao", competency: "resolucao_de_problemas",
    subCompetency: "priorizacao", type: "scenario",
    prompt: "É segunda de manhã, a semana está cheia e demandas novas continuam pingando ao longo do dia. O que está mais próximo de você?",
    options: [
      { value: "a", label: "Vou atacando cada tarefa conforme ela aparece, sem parar para definir o que vem primeiro.", score: 1 },
      { value: "b", label: "Sigo a ordem das demandas que chegam, ajustando tudo de forma reativa o dia inteiro.", score: 2 },
      { value: "c", label: "Faço uma lista no início, mas a abandono assim que surge a primeira demanda inesperada.", score: 3 },
      { value: "d", label: "Defino as prioridades da semana no começo e reavalio a lista quando algo novo realmente exige.", score: 4 },
      { value: "e", label: "Estabeleço prioridades claras, filtro o que entra à medida que chega e replanejo de forma deliberada, não reativa.", score: 5 },
    ],
    mirrorPairCode: "RP-03", weight: 1,
  },

  // ═══════════ DOMÍNIO B — NEGÓCIO & CLIENTE ═══════════

  // ═══ experiencia_do_cliente ═══
  {
    code: "EC-01", domain: "negocio", competency: "experiencia_do_cliente",
    subCompetency: "empatia_de_jornada", type: "scenario",
    prompt: "Sua equipe vai redesenhar o fluxo de atendimento. Você precisa decidir por onde começar a discussão. Como costuma conduzir isso?",
    options: [
      { value: "a", label: "Parto do que é mais simples para a operação executar e adapto o cliente ao novo fluxo.", score: 1 },
      { value: "b", label: "Sigo o desenho que outras áreas pedem, sem questionar como o cliente vai vivê-lo.", score: 2 },
      { value: "c", label: "Considero o cliente, mas só depois de fechar o que é viável internamente.", score: 3 },
      { value: "d", label: "Começo descrevendo cada etapa pela ótica de quem está sendo atendido.", score: 4 },
      { value: "e", label: "Reconstruo o fluxo a partir da experiência do cliente passo a passo e só então ajusto a operação ao redor disso.", score: 5 },
    ],
    mirrorPairCode: "EC-06", weight: 1,
  },
  {
    code: "EC-02", domain: "negocio", competency: "experiencia_do_cliente",
    subCompetency: "empatia_de_jornada", type: "scenario",
    prompt: "Você vai aprovar uma mudança em um processo que afeta clientes. Antes de decidir, como você avalia o impacto?",
    options: [
      { value: "a", label: "Aprovo se a mudança facilita o trabalho interno; o efeito no cliente eu vejo depois.", score: 1 },
      { value: "b", label: "Pergunto rapidamente à equipe se alguém prevê reclamação e sigo em frente.", score: 2 },
      { value: "c", label: "Penso no cliente de forma geral, sem detalhar como ele vai sentir cada etapa.", score: 3 },
      { value: "d", label: "Imagino concretamente como o cliente vai viver a mudança antes de aprovar.", score: 4 },
      { value: "e", label: "Percorro a mudança como se eu fosse o cliente, identifico onde ela incomoda e ajusto antes de aprovar.", score: 5 },
    ],
    mirrorPairCode: null, weight: 1,
  },
  {
    code: "EC-03", domain: "negocio", competency: "experiencia_do_cliente",
    subCompetency: "leitura_de_friccao", type: "scenario",
    prompt: "Você observa um cliente concluindo uma tarefa no seu serviço e percebe que ele hesita em alguns momentos. O que você faz?",
    options: [
      { value: "a", label: "Concluo que o cliente está pouco familiarizado e não dou importância à hesitação.", score: 1 },
      { value: "b", label: "Noto a hesitação, mas penso que faz parte e que ele vai se acostumar.", score: 2 },
      { value: "c", label: "Registro os pontos de dúvida, sem confirmar se eles atrasam de fato o cliente.", score: 3 },
      { value: "d", label: "Marco onde o cliente trava e investigo o que torna aquela etapa confusa.", score: 4 },
      { value: "e", label: "Mapeio cada ponto de hesitação, meço quanto tempo ele custa e proponho simplificar a etapa.", score: 5 },
    ],
    mirrorPairCode: null, weight: 1,
  },
  {
    code: "EC-04", domain: "negocio", competency: "experiencia_do_cliente",
    subCompetency: "leitura_de_friccao", type: "scenario",
    prompt: "Um cliente envia uma reclamação detalhada sobre algo que o incomodou no serviço. Como você costuma tratar essa mensagem?",
    options: [
      { value: "a", label: "Encaro como um cliente difícil e arquivo a mensagem sem maior análise.", score: 1 },
      { value: "b", label: "Respondo educadamente para encerrar o contato e não levo o conteúdo adiante.", score: 2 },
      { value: "c", label: "Repasso a reclamação à área responsável, mas não acompanho o que será feito.", score: 3 },
      { value: "d", label: "Trato a reclamação como um sinal e investigo o que ela aponta de melhoria.", score: 4 },
      { value: "e", label: "Uso a reclamação como pista, verifico se outros clientes vivem o mesmo e levo o ajuste à frente.", score: 5 },
    ],
    mirrorPairCode: null, weight: 1,
  },
  {
    code: "EC-05", domain: "negocio", competency: "experiencia_do_cliente",
    subCompetency: "valor_percebido", type: "scenario",
    prompt: "Sua equipe entregou um bom resultado para um cliente, mas ele parece não ter percebido o tamanho do que recebeu. Como você age?",
    options: [
      { value: "a", label: "Considero que o resultado fala por si e não faço nada a respeito.", score: 1 },
      { value: "b", label: "Comento de passagem que o trabalho foi grande, sem mostrar o que isso representa.", score: 2 },
      { value: "c", label: "Envio um resumo do que foi feito, sem traduzir em ganho concreto para o cliente.", score: 3 },
      { value: "d", label: "Mostro ao cliente, de forma clara, o ganho prático que aquela entrega trouxe.", score: 4 },
      { value: "e", label: "Conecto a entrega aos objetivos do cliente e mostro, com números, o valor que ele passou a ter.", score: 5 },
    ],
    mirrorPairCode: null, weight: 1,
  },
  {
    code: "EC-06", domain: "negocio", competency: "experiencia_do_cliente",
    subCompetency: "empatia_de_jornada", type: "scenario",
    prompt: "Você está com a agenda cheia e surge uma decisão rápida: priorizar o que desafoga a operação ou o que melhora a experiência do cliente. Como decide?",
    options: [
      { value: "a", label: "Escolho sempre o que alivia a operação; o cliente se ajusta ao que conseguimos entregar.", score: 1 },
      { value: "b", label: "Tendo a priorizar o lado interno, e penso no cliente apenas se sobrar tempo.", score: 2 },
      { value: "c", label: "Alterno conforme a pressão do dia, sem um critério claro entre os dois lados.", score: 3 },
      { value: "d", label: "Avalio o impacto na experiência do cliente antes de decidir o que vem primeiro.", score: 4 },
      { value: "e", label: "Peso os dois lados pela perspectiva do cliente e busco a solução que resolve a operação sem piorar a jornada dele.", score: 5 },
    ],
    mirrorPairCode: "EC-01", weight: 1,
  },

  // ═══ orientacao_a_resultado ═══
  {
    code: "OR-01", domain: "negocio", competency: "orientacao_a_resultado",
    subCompetency: "foco_em_impacto", type: "scenario",
    prompt: "No fim de uma semana intensa, você precisa relatar o que entregou. Como costuma avaliar o próprio trabalho?",
    options: [
      { value: "a", label: "Destaco o quanto me dediquei e as horas que investi, mesmo sem resultado claro.", score: 1 },
      { value: "b", label: "Listo as tarefas que concluí, sem distinguir quais geraram efeito real.", score: 2 },
      { value: "c", label: "Falo do esforço e do resultado juntos, sem separar um do outro.", score: 3 },
      { value: "d", label: "Foco no resultado concreto que cada entrega gerou para a área.", score: 4 },
      { value: "e", label: "Avalio cada entrega pelo impacto que produziu e ajusto onde o esforço rendeu pouco.", score: 5 },
    ],
    mirrorPairCode: null, weight: 1,
  },
  {
    code: "OR-02", domain: "negocio", competency: "orientacao_a_resultado",
    subCompetency: "foco_em_impacto", type: "scenario",
    prompt: "Sua equipe vai iniciar uma nova iniciativa e há entusiasmo em começar logo. Antes de avançar, o que você costuma fazer?",
    options: [
      { value: "a", label: "Embarco na empolgação e começo a executar sem definir o que se espera ao final.", score: 1 },
      { value: "b", label: "Aceito o objetivo vago que foi dado e sigo, confiando que ele vai se esclarecer.", score: 2 },
      { value: "c", label: "Tenho uma noção geral do alvo, mas não a transformo em algo mensurável.", score: 3 },
      { value: "d", label: "Defino qual resultado concreto a iniciativa precisa entregar antes de começar.", score: 4 },
      { value: "e", label: "Nomeio o resultado esperado, como ele será medido e o reviso com a equipe antes de avançar.", score: 5 },
    ],
    mirrorPairCode: null, weight: 1,
  },
  {
    code: "OR-03", domain: "negocio", competency: "orientacao_a_resultado",
    subCompetency: "disciplina_de_entrega", type: "scenario",
    prompt: "Você assumiu um prazo e, no meio do caminho, o contexto fica mais difícil do que o previsto. Como costuma reagir?",
    options: [
      { value: "a", label: "Deixo o prazo passar e justifico depois com a dificuldade que apareceu.", score: 1 },
      { value: "b", label: "Espero que alguém perceba o atraso e renegocie o prazo por mim.", score: 2 },
      { value: "c", label: "Tento entregar, mas aviso só na véspera que talvez não consiga.", score: 3 },
      { value: "d", label: "Reorganizo o trabalho assim que vejo o risco e busco cumprir o que assumi.", score: 4 },
      { value: "e", label: "Sinalizo o risco cedo, replanejo o que for preciso e protejo o prazo ou negocio um novo de forma transparente.", score: 5 },
    ],
    mirrorPairCode: null, weight: 1,
  },
  {
    code: "OR-04", domain: "negocio", competency: "orientacao_a_resultado",
    subCompetency: "disciplina_de_entrega", type: "scenario",
    prompt: "Você está concluindo uma tarefa e percebe que ela funciona, mas ainda restam detalhes inacabados. O que você costuma fazer?",
    options: [
      { value: "a", label: "Considero pronta assim que funciona e passo direto para a próxima.", score: 1 },
      { value: "b", label: "Entrego com as pontas soltas e penso em voltar a elas se houver tempo.", score: 2 },
      { value: "c", label: "Anoto os detalhes pendentes, mas raramente retorno para resolvê-los.", score: 3 },
      { value: "d", label: "Termino os detalhes antes de considerar a tarefa realmente concluída.", score: 4 },
      { value: "e", label: "Reviso a entrega ponta a ponta, fecho cada detalhe e confirmo que ela está completa antes de encerrar.", score: 5 },
    ],
    mirrorPairCode: "OR-06", weight: 1,
  },
  {
    code: "OR-05", domain: "negocio", competency: "orientacao_a_resultado",
    subCompetency: "accountability", type: "scenario",
    prompt: "Algo sob a sua responsabilidade falhou e o erro ficou visível para outras pessoas da empresa. Como você reage?",
    options: [
      { value: "a", label: "Aponto as circunstâncias e as outras pessoas que contribuíram para a falha.", score: 1 },
      { value: "b", label: "Minimizo o problema e espero que ele passe sem maior atenção.", score: 2 },
      { value: "c", label: "Reconheço a falha de forma genérica, sem me comprometer com a correção.", score: 3 },
      { value: "d", label: "Assumo o erro e me coloco à frente para corrigi-lo.", score: 4 },
      { value: "e", label: "Assumo a falha abertamente, corrijo o efeito e ajusto o que permitiu que ela acontecesse.", score: 5 },
    ],
    mirrorPairCode: null, weight: 1,
  },
  {
    code: "OR-06", domain: "negocio", competency: "orientacao_a_resultado",
    subCompetency: "disciplina_de_entrega", type: "scenario",
    prompt: "Você está tocando uma tarefa que perdeu o brilho inicial e surge outra mais interessante para fazer. Como você lida com isso?",
    options: [
      { value: "a", label: "Largo a tarefa atual e migro para a nova, deixando a primeira parada.", score: 1 },
      { value: "b", label: "Vou empurrando a tarefa sem graça e dedico minha energia à mais atraente.", score: 2 },
      { value: "c", label: "Alterno entre as duas conforme a vontade do momento, sem fechar nenhuma.", score: 3 },
      { value: "d", label: "Concluo a tarefa atual antes de me permitir começar a nova.", score: 4 },
      { value: "e", label: "Mantenho o compromisso com a tarefa atual, levo-a até o fim e só então abro espaço para a nova.", score: 5 },
    ],
    mirrorPairCode: "OR-04", weight: 1,
  },

  // ═══ visao_de_negocio ═══
  {
    code: "VN-01", domain: "negocio", competency: "visao_de_negocio",
    subCompetency: "noção_receita_custo", type: "scenario",
    prompt: "Em uma reunião, alguém pergunta como a sua função contribui para os resultados financeiros da empresa. Como você responde?",
    options: [
      { value: "a", label: "Digo que faço a minha parte e que números são assunto de outra área.", score: 1 },
      { value: "b", label: "Descrevo minhas tarefas, sem conseguir ligá-las a receita ou custo.", score: 2 },
      { value: "c", label: "Tenho uma ideia vaga da ligação, mas não sei explicá-la com clareza.", score: 3 },
      { value: "d", label: "Explico como o meu trabalho influencia a receita ou o custo da empresa.", score: 4 },
      { value: "e", label: "Mostro com exemplos concretos como minhas entregas geram receita ou reduzem custo na cadeia.", score: 5 },
    ],
    mirrorPairCode: "VN-06", weight: 1,
  },
  {
    code: "VN-02", domain: "negocio", competency: "visao_de_negocio",
    subCompetency: "noção_receita_custo", type: "scenario",
    prompt: "Surge a oportunidade de tocar uma nova iniciativa que parece promissora. Antes de aceitar, o que você considera?",
    options: [
      { value: "a", label: "Aceito porque a ideia é interessante, sem pensar no retorno que ela traz.", score: 1 },
      { value: "b", label: "Avalio só o esforço que vai exigir, não o que ela pode gerar de volta.", score: 2 },
      { value: "c", label: "Penso no retorno de forma superficial, sem comparar com o custo envolvido.", score: 3 },
      { value: "d", label: "Comparo o retorno esperado com o custo antes de decidir se vale a pena.", score: 4 },
      { value: "e", label: "Estimo retorno, custo e risco, comparo com outras prioridades e só então decido tocar a iniciativa.", score: 5 },
    ],
    mirrorPairCode: null, weight: 1,
  },
  {
    code: "VN-03", domain: "negocio", competency: "visao_de_negocio",
    subCompetency: "leitura_de_mercado", type: "scenario",
    prompt: "Um concorrente lança algo que repercute no seu setor. Como você costuma se posicionar diante de movimentos como esse?",
    options: [
      { value: "a", label: "Não acompanho concorrentes; foco apenas na rotina interna da minha área.", score: 1 },
      { value: "b", label: "Fico sabendo por acaso, quando o assunto chega até mim pelos colegas.", score: 2 },
      { value: "c", label: "Tomo conhecimento do movimento, mas não avalio o que ele significa para nós.", score: 3 },
      { value: "d", label: "Acompanho o movimento e analiso como ele pode afetar o nosso negócio.", score: 4 },
      { value: "e", label: "Monitoro o mercado de forma habitual, interpreto o que cada movimento sinaliza e levo isso ao planejamento.", score: 5 },
    ],
    mirrorPairCode: null, weight: 1,
  },
  {
    code: "VN-04", domain: "negocio", competency: "visao_de_negocio",
    subCompetency: "pensamento_estrategico", type: "scenario",
    prompt: "Você precisa decidir entre duas opções de trabalho: uma resolve um problema imediato, outra prepara a empresa para os próximos anos. Como decide?",
    options: [
      { value: "a", label: "Escolho sempre o que resolve o agora, sem considerar o horizonte mais longo.", score: 1 },
      { value: "b", label: "Decido pela urgência do dia e adio qualquer pensamento sobre o futuro.", score: 2 },
      { value: "c", label: "Pondero os dois lados, mas costumo pender para o que pressiona no momento.", score: 3 },
      { value: "d", label: "Avalio onde a empresa precisa estar adiante e peso isso na decisão.", score: 4 },
      { value: "e", label: "Equilibro a urgência e a direção de longo prazo, e escolho a opção que atende o agora sem comprometer o futuro.", score: 5 },
    ],
    mirrorPairCode: null, weight: 1,
  },
  {
    code: "VN-05", domain: "negocio", competency: "visao_de_negocio",
    subCompetency: "pensamento_estrategico", type: "scenario",
    prompt: "Sua lista de tarefas mistura atividades de rotina e iniciativas que movem o negócio adiante. Como você organiza esse conjunto?",
    options: [
      { value: "a", label: "Trato tudo como igual e executo na ordem em que as tarefas aparecem.", score: 1 },
      { value: "b", label: "Priorizo o que é rotineiro, por ser mais fácil de concluir e tirar da frente.", score: 2 },
      { value: "c", label: "Percebo que há tarefas mais estratégicas, mas não as separo de forma deliberada.", score: 3 },
      { value: "d", label: "Distingo o que move o negócio do que só mantém a rotina e priorizo de acordo.", score: 4 },
      { value: "e", label: "Separo rotina de estratégia, protejo tempo para o que faz o negócio avançar e mantenho a operação girando.", score: 5 },
    ],
    mirrorPairCode: null, weight: 1,
  },
  {
    code: "VN-06", domain: "negocio", competency: "visao_de_negocio",
    subCompetency: "noção_receita_custo", type: "scenario",
    prompt: "Durante uma conversa de equipe, o tema migra para custos, margem e impacto financeiro das decisões. Como você costuma participar?",
    options: [
      { value: "a", label: "Me retiro mentalmente da conversa, por entender que esse tema não me cabe.", score: 1 },
      { value: "b", label: "Fico calado e espero o assunto voltar para a parte operacional que domino.", score: 2 },
      { value: "c", label: "Acompanho de longe, sem relacionar os números ao meu próprio trabalho.", score: 3 },
      { value: "d", label: "Participo da discussão e ligo os números às decisões da minha área.", score: 4 },
      { value: "e", label: "Entro na conversa com dados da minha área e ajudo a equipe a enxergar o efeito financeiro das escolhas.", score: 5 },
    ],
    mirrorPairCode: "VN-01", weight: 1,
  },

  // ═══════════ DOMÍNIO C — ENERGIA & EQUILÍBRIO EMOCIONAL ═══════════

  // ═══ inteligencia_emocional ═══
  {
    code: "IE-01", domain: "energia", competency: "inteligencia_emocional",
    subCompetency: "autoconsciencia", type: "behavioral",
    prompt: "Pense em como você tem percebido as próprias emoções nas últimas semanas — alegria, irritação, ansiedade, cansaço. O que está mais próximo da sua realidade?",
    options: [
      { value: "a", label: "Costumo só notar o que sinto bem depois, quando a emoção já influenciou meu comportamento.", score: 1 },
      { value: "b", label: "Percebo que algo me afeta, mas raramente consigo nomear com clareza qual é a emoção.", score: 2 },
      { value: "c", label: "Identifico minhas emoções em alguns momentos, em outros elas me pegam de surpresa.", score: 3 },
      { value: "d", label: "Na maioria das vezes reconheço o que estou sentindo enquanto a emoção ainda está acontecendo.", score: 4 },
      { value: "e", label: "Percebo com nitidez o que sinto no instante em que surge e consigo dar nome àquilo.", score: 5 },
    ],
    mirrorPairCode: null, weight: 1,
  },
  {
    code: "IE-02", domain: "energia", competency: "inteligencia_emocional",
    subCompetency: "autoconsciencia", type: "behavioral",
    prompt: "Lembre das decisões que você tomou ultimamente em dias bons e em dias ruins. Quanto você consegue enxergar o efeito do seu humor sobre essas escolhas?",
    options: [
      { value: "a", label: "Não costumo associar minhas decisões ao meu estado de humor — para mim, são coisas separadas.", score: 1 },
      { value: "b", label: "Só percebo que o humor pesou na decisão depois, quando reflito sobre o resultado.", score: 2 },
      { value: "c", label: "Às vezes noto que estou decidindo influenciado pela emoção, mas nem sempre.", score: 3 },
      { value: "d", label: "Costumo reconhecer quando meu estado emocional está pesando antes de decidir algo importante.", score: 4 },
      { value: "e", label: "Tenho clareza de como o que sinto molda meu julgamento e levo isso em conta ao decidir.", score: 5 },
    ],
    mirrorPairCode: null, weight: 1,
  },
  {
    code: "IE-03", domain: "energia", competency: "inteligencia_emocional",
    subCompetency: "autorregulacao", type: "behavioral",
    prompt: "Pense nas conversas tensas ou nos atritos que você viveu nos últimos meses. Como você costuma reagir quando o clima esquenta?",
    options: [
      { value: "a", label: "Quase sempre perco a compostura — falo mais alto ou me fecho, e a conversa descarrila.", score: 1 },
      { value: "b", label: "Tento me segurar, mas a tensão geralmente vaza no meu tom e nas minhas palavras.", score: 2 },
      { value: "c", label: "Mantenho a calma em parte das vezes; depende do dia e de quanto o assunto me toca.", score: 3 },
      { value: "d", label: "Na maioria das vezes consigo respirar, baixar a tensão e responder de forma equilibrada.", score: 4 },
      { value: "e", label: "Mesmo no auge da tensão eu me mantenho firme e centrado, e respondo sem perder o equilíbrio.", score: 5 },
    ],
    mirrorPairCode: null, weight: 1,
  },
  {
    code: "IE-04", domain: "energia", competency: "inteligencia_emocional",
    subCompetency: "autorregulacao", type: "behavioral",
    prompt: "Pense nos momentos recentes em que algo te irritou de verdade. O que costuma acontecer entre sentir a irritação e a sua reação?",
    options: [
      { value: "a", label: "Reajo na hora, no impulso, e quase sempre me arrependo do que falei ou fiz logo depois.", score: 1 },
      { value: "b", label: "Costumo responder rápido demais e só percebo o exagero quando o momento já passou.", score: 2 },
      { value: "c", label: "Em parte das vezes seguro a reação, em outras a irritação fala mais alto do que eu queria.", score: 3 },
      { value: "d", label: "Na maioria das vezes consigo dar uma pausa antes de responder, mesmo irritado.", score: 4 },
      { value: "e", label: "Sinto a irritação, mas escolho como responder com calma — o impulso raramente decide por mim.", score: 5 },
    ],
    mirrorPairCode: "IE-06", weight: 1,
  },
  {
    code: "IE-05", domain: "energia", competency: "inteligencia_emocional",
    subCompetency: "empatia", type: "behavioral",
    prompt: "Pense na sua convivência recente com colegas e equipe. Quanto você costuma perceber o estado emocional das pessoas ao seu redor?",
    options: [
      { value: "a", label: "Raramente noto como os outros estão — só percebo quando alguém fala abertamente.", score: 1 },
      { value: "b", label: "Percebo algo só quando o desconforto da pessoa fica muito evidente.", score: 2 },
      { value: "c", label: "Às vezes capto que alguém não está bem, mas costuma me escapar com frequência.", score: 3 },
      { value: "d", label: "Na maioria das vezes sinto quando alguém está abalado, mesmo sem a pessoa dizer.", score: 4 },
      { value: "e", label: "Costumo captar com nitidez o estado emocional das pessoas pelos sinais sutis que elas dão.", score: 5 },
    ],
    mirrorPairCode: null, weight: 1,
  },
  {
    code: "IE-06", domain: "energia", competency: "inteligencia_emocional",
    subCompetency: "autorregulacao", type: "behavioral",
    prompt: "Pense nos períodos de pressão que você atravessou nos últimos meses — prazos, cobranças, conflitos. Como você tem lidado com as próprias reações nesses momentos?",
    options: [
      { value: "a", label: "Sob pressão eu desando: a tensão toma conta e minhas reações saem do meu controle.", score: 1 },
      { value: "b", label: "A pressão me deixa reativo — respondo de forma mais brusca do que gostaria.", score: 2 },
      { value: "c", label: "Consigo me controlar parte do tempo, mas a pressão acumulada acaba me desestabilizando.", score: 3 },
      { value: "d", label: "Na maioria das vezes mantenho o controle das minhas reações mesmo sob pressão.", score: 4 },
      { value: "e", label: "Mesmo pressionado, mantenho o domínio das minhas reações e penso com clareza antes de responder.", score: 5 },
    ],
    mirrorPairCode: "IE-04", weight: 1,
  },

  // ═══ tonus_vital ═══
  {
    code: "TV-01", domain: "energia", competency: "tonus_vital",
    subCompetency: "vitalidade", type: "behavioral",
    prompt: "Pense em como tem sido a sua energia ao começar o dia de trabalho nas últimas semanas. O que está mais próximo da sua realidade?",
    options: [
      { value: "a", label: "Começo a maioria dos dias já esgotado, como se o dia tivesse pesado antes de iniciar.", score: 1 },
      { value: "b", label: "Quase sempre preciso me arrastar para engrenar — a energia custa a aparecer.", score: 2 },
      { value: "c", label: "Varia bastante: alguns dias com energia, outros sem, sem um padrão claro.", score: 3 },
      { value: "d", label: "Na maioria dos dias chego com energia suficiente para o que preciso fazer.", score: 4 },
      { value: "e", label: "Chego com energia firme quase todos os dias e a sustento bem ao longo da manhã.", score: 5 },
    ],
    mirrorPairCode: null, weight: 1,
  },
  {
    code: "TV-02", domain: "energia", competency: "tonus_vital",
    subCompetency: "vitalidade", type: "behavioral",
    prompt: "Olhando para as últimas semanas como um todo, como tem sido a sua disposição física e mental para sustentar o ritmo da semana inteira?",
    options: [
      { value: "a", label: "Chego ao fim da semana arrasado; o corpo e a cabeça não acompanham o que preciso entregar.", score: 1 },
      { value: "b", label: "Geralmente desando na metade da semana e empurro o resto no esforço.", score: 2 },
      { value: "c", label: "A disposição oscila — algumas semanas rendo bem, outras me sinto sem combustível.", score: 3 },
      { value: "d", label: "Na maioria das semanas tenho disposição para acompanhar o meu ritmo de ponta a ponta.", score: 4 },
      { value: "e", label: "Sinto-me firme física e mentalmente, com fôlego para sustentar a semana sem me esgotar.", score: 5 },
    ],
    mirrorPairCode: null, weight: 1,
  },
  {
    code: "TV-03", domain: "energia", competency: "tonus_vital",
    subCompetency: "gestao_de_energia", type: "behavioral",
    prompt: "Pense em como você tem organizado o seu dia ultimamente. Quanto você leva em conta os horários em que rende mais e os em que rende menos?",
    options: [
      { value: "a", label: "Encaixo as tarefas como dá, sem considerar quando estou mais ou menos disposto.", score: 1 },
      { value: "b", label: "Sei mais ou menos meus horários bons, mas raramente organizo o dia em torno disso.", score: 2 },
      { value: "c", label: "Às vezes reservo as tarefas pesadas para os meus melhores horários, às vezes não.", score: 3 },
      { value: "d", label: "Na maioria dos dias coloco o trabalho mais exigente nas janelas em que rendo mais.", score: 4 },
      { value: "e", label: "Organizo o dia de forma deliberada em torno dos meus picos e vales de energia.", score: 5 },
    ],
    mirrorPairCode: null, weight: 1,
  },
  {
    code: "TV-04", domain: "energia", competency: "tonus_vital",
    subCompetency: "gestao_de_energia", type: "behavioral",
    prompt: "Pense no seu ritmo das últimas semanas. Como você tem lidado com pausas e momentos de recuperação ao longo do dia de trabalho?",
    options: [
      { value: "a", label: "Praticamente não paro; sigo até o limite e só me recupero quando o corpo cobra.", score: 1 },
      { value: "b", label: "Faço pausas raras e curtas, geralmente quando já estou esgotado demais para continuar.", score: 2 },
      { value: "c", label: "Às vezes faço pausas reais, mas com frequência elas ficam para depois e não acontecem.", score: 3 },
      { value: "d", label: "Na maioria dos dias consigo parar de verdade para recuperar a energia antes de esvaziar.", score: 4 },
      { value: "e", label: "Faço pausas reais e regulares como parte da rotina, e isso mantém minha energia estável.", score: 5 },
    ],
    mirrorPairCode: null, weight: 1,
  },
  {
    code: "TV-05", domain: "energia", competency: "tonus_vital",
    subCompetency: "presenca", type: "behavioral",
    prompt: "Pense nas reuniões e conversas das últimas semanas. Quando está nelas, quanto da sua atenção está realmente ali, e não dispersa em outras coisas?",
    options: [
      { value: "a", label: "Quase sempre minha cabeça está em outro lugar — participo de corpo presente, mente ausente.", score: 1 },
      { value: "b", label: "Costumo me distrair com facilidade e perco partes do que está sendo dito.", score: 2 },
      { value: "c", label: "Em parte das conversas estou inteiro; em outras me pego pensando em pendências.", score: 3 },
      { value: "d", label: "Na maioria das vezes estou presente e acompanho a conversa com atenção.", score: 4 },
      { value: "e", label: "Quando estou em uma conversa, estou inteiramente nela — atento ao que se passa ali.", score: 5 },
    ],
    mirrorPairCode: null, weight: 1,
  },
  {
    code: "TV-06", domain: "energia", competency: "tonus_vital",
    subCompetency: "vitalidade", type: "behavioral",
    prompt: "Pense em como você tem chegado ao fim do dia nas últimas semanas. Quanta energia costuma sobrar para a sua vida fora do trabalho?",
    options: [
      { value: "a", label: "Termino o dia exausto, sem nada de energia para qualquer outra coisa além de desligar.", score: 1 },
      { value: "b", label: "Quase sempre chego em casa esvaziado e mal consigo aproveitar o resto do dia.", score: 2 },
      { value: "c", label: "Depende do dia: em alguns ainda tenho gás, em outros chego completamente sem fôlego.", score: 3 },
      { value: "d", label: "Na maioria dos dias chego ao fim com energia para a vida fora do trabalho.", score: 4 },
      { value: "e", label: "Termino a maior parte dos dias com fôlego de sobra para o que importa fora do trabalho.", score: 5 },
    ],
    mirrorPairCode: null, weight: 1,
  },

  // ═══ resiliencia ═══
  {
    code: "RS-01", domain: "energia", competency: "resiliencia",
    subCompetency: "recuperacao_a_adversidade", type: "behavioral",
    prompt: "Lembre de algum revés ou frustração que você viveu no trabalho nos últimos meses. Como costuma ser o seu processo de retomar o ritmo depois?",
    options: [
      { value: "a", label: "Um revés me derruba por bastante tempo; demoro a conseguir voltar a funcionar bem.", score: 1 },
      { value: "b", label: "Levo vários dias para me reerguer e o baque ainda pesa no meu trabalho nesse período.", score: 2 },
      { value: "c", label: "Me recupero, mas o tempo varia muito conforme o tamanho e o tipo do revés.", score: 3 },
      { value: "d", label: "Na maioria das vezes me reorganizo e retomo o ritmo em pouco tempo após um tropeço.", score: 4 },
      { value: "e", label: "Absorvo o golpe, me reorganizo rápido e volto ao ritmo sem deixar a queda me parar.", score: 5 },
    ],
    mirrorPairCode: "RS-06", weight: 1,
  },
  {
    code: "RS-02", domain: "energia", competency: "resiliencia",
    subCompetency: "recuperacao_a_adversidade", type: "behavioral",
    prompt: "Pense em erros que você cometeu recentemente. Como você costuma encarar o que aconteceu nos dias seguintes?",
    options: [
      { value: "a", label: "Levo o erro como prova de que não sou capaz, e isso abala minha confiança por muito tempo.", score: 1 },
      { value: "b", label: "Fico me cobrando pelo erro bem mais do que ele merecia, e isso me trava.", score: 2 },
      { value: "c", label: "Às vezes tiro um aprendizado, às vezes o erro fica martelando como um peso.", score: 3 },
      { value: "d", label: "Na maioria das vezes consigo enxergar o erro como aprendizado e seguir em frente.", score: 4 },
      { value: "e", label: "Encaro o erro como informação útil sobre o que ajustar — ele não define a minha capacidade.", score: 5 },
    ],
    mirrorPairCode: null, weight: 1,
  },
  {
    code: "RS-03", domain: "energia", competency: "resiliencia",
    subCompetency: "tolerancia_a_ambiguidade", type: "behavioral",
    prompt: "Pense nos momentos recentes em que você precisou trabalhar sem ter o cenário totalmente definido. Como você costuma se sentir e agir nessas situações?",
    options: [
      { value: "a", label: "A falta de definição me paralisa; tenho dificuldade de produzir enquanto tudo está incerto.", score: 1 },
      { value: "b", label: "A incerteza me deixa ansioso e meu trabalho perde qualidade enquanto o cenário não fecha.", score: 2 },
      { value: "c", label: "Consigo tocar as coisas no meio da incerteza, mas isso custa esforço e me incomoda.", score: 3 },
      { value: "d", label: "Na maioria das vezes sigo trabalhando bem mesmo sem todas as respostas definidas.", score: 4 },
      { value: "e", label: "Lido com naturalidade com o cenário em aberto e mantenho meu trabalho fluindo apesar da incerteza.", score: 5 },
    ],
    mirrorPairCode: null, weight: 1,
  },
  {
    code: "RS-04", domain: "energia", competency: "resiliencia",
    subCompetency: "estabilidade_sob_pressao", type: "behavioral",
    prompt: "Pense nos períodos de maior pressão que você atravessou nos últimos meses. O que costuma acontecer com a qualidade e a clareza do seu trabalho nessas fases?",
    options: [
      { value: "a", label: "Sob pressão a qualidade do que entrego despenca e perco a clareza do que estou fazendo.", score: 1 },
      { value: "b", label: "A pressão costuma me atropelar — começo a cometer erros e a me confundir no processo.", score: 2 },
      { value: "c", label: "Em parte das vezes seguro a qualidade; em outras a pressão acaba comprometendo o trabalho.", score: 3 },
      { value: "d", label: "Na maioria das vezes mantenho a qualidade e a clareza mesmo quando a pressão sobe.", score: 4 },
      { value: "e", label: "Mesmo nos picos de pressão sustento a qualidade e a clareza do que faço sem ceder.", score: 5 },
    ],
    mirrorPairCode: null, weight: 1,
  },
  {
    code: "RS-05", domain: "energia", competency: "resiliencia",
    subCompetency: "estabilidade_sob_pressao", type: "behavioral",
    prompt: "Pense em como tem sido a sua cabeça nos momentos de estresse recentes. O que costuma acontecer com a sua organização mental quando a tensão aperta?",
    options: [
      { value: "a", label: "O estresse me dispersa por completo; perco o fio e não sei mais por onde começar.", score: 1 },
      { value: "b", label: "Sob estresse minha cabeça fica confusa e custo a colocar as ideias em ordem.", score: 2 },
      { value: "c", label: "Às vezes mantenho a cabeça organizada, às vezes o estresse me dispersa bastante.", score: 3 },
      { value: "d", label: "Na maioria das vezes mantenho as ideias em ordem mesmo sob estresse.", score: 4 },
      { value: "e", label: "Sob estresse mantenho a cabeça clara e organizada, e sigo enxergando o que precisa ser feito.", score: 5 },
    ],
    mirrorPairCode: null, weight: 1,
  },
  {
    code: "RS-06", domain: "energia", competency: "resiliencia",
    subCompetency: "recuperacao_a_adversidade", type: "behavioral",
    prompt: "Pense nas vezes em que algo deu errado para você no trabalho recentemente. O que costuma acontecer na sua cabeça nos dias seguintes ao ocorrido?",
    options: [
      { value: "a", label: "Fico remoendo o ocorrido por muito tempo; ele ocupa minha mente e não me larga.", score: 1 },
      { value: "b", label: "Volto ao episódio repetidas vezes na cabeça, e isso me consome por dias.", score: 2 },
      { value: "c", label: "Penso no ocorrido mais do que deveria, mas em algum momento consigo virar a página.", score: 3 },
      { value: "d", label: "Na maioria das vezes processo o que deu errado e sigo em frente sem ficar preso a ele.", score: 4 },
      { value: "e", label: "Aprendo o que precisava do episódio e o deixo para trás, sem ficar remoendo o que passou.", score: 5 },
    ],
    mirrorPairCode: "RS-01", weight: 1,
  },

  // ═══ autogestao_e_foco ═══
  {
    code: "AF-01", domain: "energia", competency: "autogestao_e_foco",
    subCompetency: "disciplina", type: "behavioral",
    prompt: "Pense no que você planejou para os seus dias nas últimas semanas. Quanto desse plano você costuma realmente cumprir, sem ninguém cobrando?",
    options: [
      { value: "a", label: "Raramente cumpro o que planejei; sem cobrança externa o plano quase sempre fica pelo caminho.", score: 1 },
      { value: "b", label: "Faço uma parte do que planejei, mas a maior parte acaba escorregando para depois.", score: 2 },
      { value: "c", label: "Cumpro o plano em parte dos dias; depende da minha disposição naquele momento.", score: 3 },
      { value: "d", label: "Na maioria dos dias entrego o que tinha planejado, mesmo sem ninguém me cobrar.", score: 4 },
      { value: "e", label: "Cumpro o que planejo de forma consistente; a cobrança vem de mim mesmo, não de fora.", score: 5 },
    ],
    mirrorPairCode: null, weight: 1,
  },
  {
    code: "AF-02", domain: "energia", competency: "autogestao_e_foco",
    subCompetency: "disciplina", type: "behavioral",
    prompt: "Olhando para os últimos meses, quanto os seus hábitos de trabalho — rotinas, métodos, organização — têm se mantido constantes?",
    options: [
      { value: "a", label: "Meus hábitos de trabalho mudam o tempo todo; não consigo sustentar uma rotina por muito tempo.", score: 1 },
      { value: "b", label: "Começo rotinas com vontade, mas elas se desfazem em poucas semanas.", score: 2 },
      { value: "c", label: "Mantenho alguns hábitos com constância, outros vão e voltam sem regularidade.", score: 3 },
      { value: "d", label: "Na maior parte do tempo sustento meus hábitos de trabalho com boa constância.", score: 4 },
      { value: "e", label: "Mantenho meus hábitos e métodos de trabalho firmes e constantes ao longo dos meses.", score: 5 },
    ],
    mirrorPairCode: null, weight: 1,
  },
  {
    code: "AF-03", domain: "energia", competency: "autogestao_e_foco",
    subCompetency: "gestao_de_atencao", type: "behavioral",
    prompt: "Pense em como tem sido a sua atenção ao trabalhar nas últimas semanas. Com que facilidade você se distrai e perde o fio do que estava fazendo?",
    options: [
      { value: "a", label: "Me distraio à toa o tempo todo; perco o fio constantemente e custo a retomar de onde parei.", score: 1 },
      { value: "b", label: "Qualquer estímulo me tira do foco e percebo que reinicio a mesma tarefa várias vezes.", score: 2 },
      { value: "c", label: "Em parte do tempo me mantenho no foco; em outra me disperso e perco o fio.", score: 3 },
      { value: "d", label: "Na maioria das vezes sustento a atenção e raramente perco por completo o fio do trabalho.", score: 4 },
      { value: "e", label: "Mantenho a atenção firme no que estou fazendo e dificilmente perco o fio por distração.", score: 5 },
    ],
    mirrorPairCode: "AF-06", weight: 1,
  },
  {
    code: "AF-04", domain: "energia", competency: "autogestao_e_foco",
    subCompetency: "gestao_de_atencao", type: "behavioral",
    prompt: "Pense na sua rotina recente. Quanto você tem conseguido reservar e proteger blocos de tempo para trabalho concentrado, sem interrupções?",
    options: [
      { value: "a", label: "Meu dia é todo fragmentado; praticamente não existe um bloco protegido para concentração.", score: 1 },
      { value: "b", label: "Até tento reservar um tempo concentrado, mas as interrupções quase sempre o desfazem.", score: 2 },
      { value: "c", label: "Em alguns dias consigo proteger um bloco de foco, em outros ele simplesmente não acontece.", score: 3 },
      { value: "d", label: "Na maioria dos dias garanto pelo menos um bloco real de trabalho concentrado.", score: 4 },
      { value: "e", label: "Reservo e protejo blocos de foco profundo como parte fixa da minha rotina.", score: 5 },
    ],
    mirrorPairCode: null, weight: 1,
  },
  {
    code: "AF-05", domain: "energia", competency: "autogestao_e_foco",
    subCompetency: "autonomia", type: "behavioral",
    prompt: "Pense em como você tem tocado as suas responsabilidades ultimamente. Quanto você depende de supervisão ou de alguém acompanhando para fazer andar?",
    options: [
      { value: "a", label: "Sem alguém acompanhando de perto, minhas entregas travam ou ficam para trás.", score: 1 },
      { value: "b", label: "Preciso de cobrança frequente para manter as coisas em movimento.", score: 2 },
      { value: "c", label: "Toco boa parte sozinho, mas em alguns pontos ainda dependo de alguém me puxando.", score: 3 },
      { value: "d", label: "Na maioria das vezes conduzo minhas responsabilidades sem precisar de supervisão.", score: 4 },
      { value: "e", label: "Conduzo o que é meu de ponta a ponta com autonomia, sem precisar de acompanhamento constante.", score: 5 },
    ],
    mirrorPairCode: null, weight: 1,
  },
  {
    code: "AF-06", domain: "energia", competency: "autogestao_e_foco",
    subCompetency: "gestao_de_atencao", type: "behavioral",
    prompt: "Pense nas tarefas que exigiram concentração nos últimos meses. Quanto você consegue manter o foco em uma delas até concluí-la, mesmo com estímulos por perto?",
    options: [
      { value: "a", label: "Quase nunca termino uma tarefa de uma vez; pulo de uma para outra e deixo várias pela metade.", score: 1 },
      { value: "b", label: "Custo a sustentar o foco até o fim; qualquer estímulo me leva para outra coisa.", score: 2 },
      { value: "c", label: "Levo algumas tarefas até o fim sem interrupção, em outras me perco no meio do caminho.", score: 3 },
      { value: "d", label: "Na maioria das vezes sigo concentrado em uma tarefa até concluí-la, mesmo com estímulos ao redor.", score: 4 },
      { value: "e", label: "Sustento o foco em uma tarefa do início ao fim, sem me deixar levar pelos estímulos por perto.", score: 5 },
    ],
    mirrorPairCode: "AF-03", weight: 1,
  },

  // ═══════════ DOMÍNIO D — RELAÇÃO & INFLUÊNCIA ═══════════

  // ═══ relacionamento ═══
  {
    code: "RL-01", domain: "relacao", competency: "relacionamento",
    subCompetency: "construcao_de_vinculo", type: "scenario",
    prompt: "Você entrou há duas semanas em uma equipe nova e ainda não conhece bem ninguém. No primeiro projeto conjunto, como você costuma agir?",
    options: [
      { value: "a", label: "Foco apenas em entregar a minha parte; me aproximar das pessoas é algo que acontece com o tempo, sem eu forçar.", score: 1 },
      { value: "b", label: "Sou cordial nas trocas necessárias do projeto, mas mantenho a interação restrita ao que o trabalho exige.", score: 2 },
      { value: "c", label: "Converso quando surge a oportunidade e respondo bem quando me procuram, embora raramente eu tome a iniciativa.", score: 3 },
      { value: "d", label: "Procuro cada colega para entender o que faz e como prefere trabalhar, criando contato além das demandas imediatas.", score: 4 },
      { value: "e", label: "Busco ativamente conhecer cada pessoa, ofereço ajuda concreta logo cedo e cumpro pequenos compromissos para construir confiança desde o início.", score: 5 },
    ],
    mirrorPairCode: null, weight: 1,
  },
  {
    code: "RL-02", domain: "relacao", competency: "relacionamento",
    subCompetency: "construcao_de_vinculo", type: "scenario",
    prompt: "Um colega cometeu um erro relevante e parece hesitar em contar a você, mesmo sendo algo que afeta o seu trabalho. O que isso costuma revelar sobre a relação que você constrói?",
    options: [
      { value: "a", label: "É esperado: as pessoas evitam me trazer más notícias porque sabem que eu reajo mal a erros.", score: 1 },
      { value: "b", label: "Acontece com frequência; costumo descobrir os problemas tarde, quando já estão maiores.", score: 2 },
      { value: "c", label: "Depende da pessoa — algumas se abrem comigo, outras preferem resolver por conta antes de me avisar.", score: 3 },
      { value: "d", label: "É raro; em geral as pessoas me procuram cedo porque sabem que vou tratar o assunto com seriedade e sem hostilidade.", score: 4 },
      { value: "e", label: "Praticamente não ocorre: cultivei a confiança ao reagir a erros com foco na solução, então as pessoas me trazem problemas assim que surgem.", score: 5 },
    ],
    mirrorPairCode: null, weight: 1,
  },
  {
    code: "RL-03", domain: "relacao", competency: "relacionamento",
    subCompetency: "colaboracao", type: "scenario",
    prompt: "Um projeto que você conduziu junto com a equipe deu certo e a liderança elogia o resultado em uma reunião. Como você costuma se posicionar nesse momento?",
    options: [
      { value: "a", label: "Aceito o reconhecimento por mim mesmo; fui eu quem puxou o trabalho, então o crédito é justo.", score: 1 },
      { value: "b", label: "Recebo o elogio e menciono a equipe de forma vaga, sem detalhar a contribuição de cada um.", score: 2 },
      { value: "c", label: "Agradeço e digo que foi um esforço coletivo, embora nem sempre eu nomeie quem fez o quê.", score: 3 },
      { value: "d", label: "Reconheço a equipe explicitamente e cito as contribuições concretas das pessoas que mais somaram.", score: 4 },
      { value: "e", label: "Dou crédito nominal a quem contribuiu, descrevo o que cada um entregou e deixo claro que o mérito é coletivo.", score: 5 },
    ],
    mirrorPairCode: null, weight: 1,
  },
  {
    code: "RL-04", domain: "relacao", competency: "relacionamento",
    subCompetency: "colaboracao", type: "scenario",
    prompt: "Você recebeu uma tarefa complexa com prazo apertado. Outra área tem a expertise que falta a você, mas envolvê-la exigiria alinhar agendas e dividir a condução. O que você costuma fazer?",
    options: [
      { value: "a", label: "Faço sozinho do meu jeito; depender de outra área só atrasa e complica o controle do que é meu.", score: 1 },
      { value: "b", label: "Tento resolver por conta própria e só recorro à outra área se eu realmente travar.", score: 2 },
      { value: "c", label: "Avalio caso a caso — se a coordenação parecer trabalhosa, prefiro tocar sozinho mesmo perdendo qualidade.", score: 3 },
      { value: "d", label: "Procuro a outra área porque a expertise dela melhora o resultado, mesmo que isso exija mais alinhamento.", score: 4 },
      { value: "e", label: "Envolvo a outra área desde o início, combino papéis e agenda e conduzo em conjunto, porque o resultado coletivo compensa o esforço de coordenação.", score: 5 },
    ],
    mirrorPairCode: "RL-06", weight: 1,
  },
  {
    code: "RL-05", domain: "relacao", competency: "relacionamento",
    subCompetency: "rede_de_contatos", type: "scenario",
    prompt: "Um antigo colega com quem você não fala há meses te procura pedindo uma indicação. Pensando na sua rede profissional como um todo, o que essa situação costuma mostrar?",
    options: [
      { value: "a", label: "Quase não tenho contato com ex-colegas; encerrado o trabalho em comum, as relações simplesmente se perdem.", score: 1 },
      { value: "b", label: "Mantenho pouquíssimos contatos e só falo com alguém quando preciso de algo específico.", score: 2 },
      { value: "c", label: "Tenho uma rede razoável, mas a mantenho de forma passiva — respondo quando me procuram, raramente inicio.", score: 3 },
      { value: "d", label: "Mantenho contato periódico com pessoas-chave da minha rede e ajudo quando posso, mesmo sem retorno imediato.", score: 4 },
      { value: "e", label: "Cultivo a rede de forma deliberada: acompanho a trajetória das pessoas, ofereço ajuda antes de precisar e mantenho as relações vivas ao longo do tempo.", score: 5 },
    ],
    mirrorPairCode: null, weight: 1,
  },
  {
    code: "RL-06", domain: "relacao", competency: "relacionamento",
    subCompetency: "colaboracao", type: "scenario",
    prompt: "Sua equipe vai distribuir as frentes de uma entrega importante. Você poderia assumir tudo o que domina e trabalhar isolado, ou integrar o seu trabalho ao dos colegas. Como você se posiciona?",
    options: [
      { value: "a", label: "Pego para mim tudo o que sei fazer e executo de forma independente; entrosamento com os outros é perda de tempo.", score: 1 },
      { value: "b", label: "Assumo a maior fatia possível e interajo com os colegas só nos pontos em que não há como evitar.", score: 2 },
      { value: "c", label: "Aceito trabalhar em conjunto quando o formato da entrega exige, mas, se puder, prefiro tocar a minha parte sozinho.", score: 3 },
      { value: "d", label: "Opto por integrar o meu trabalho ao da equipe, porque sei que a combinação de visões gera um resultado melhor.", score: 4 },
      { value: "e", label: "Proponho ativamente conectar as frentes, alinho interfaces com cada colega e conduzo de forma colaborativa, confiando que o resultado coletivo é mais forte.", score: 5 },
    ],
    mirrorPairCode: "RL-04", weight: 1,
  },

  // ═══ comunicacao_e_influencia ═══
  {
    code: "CI-01", domain: "relacao", competency: "comunicacao_e_influencia",
    subCompetency: "clareza", type: "scenario",
    prompt: "Você precisa explicar um assunto técnico complexo para um grupo de pessoas que não é da sua área. Como você costuma preparar e conduzir essa explicação?",
    options: [
      { value: "a", label: "Exponho o assunto com o vocabulário técnico que uso normalmente; quem não acompanhar pode perguntar depois.", score: 1 },
      { value: "b", label: "Tento simplificar na hora, mas acabo me apoiando em termos técnicos e detalhes que confundem a audiência.", score: 2 },
      { value: "c", label: "Simplifico a linguagem, embora nem sempre eu organize a explicação em uma sequência fácil de seguir.", score: 3 },
      { value: "d", label: "Adapto a linguagem ao público, começo pela ideia central e uso analogias para tornar o conteúdo acessível.", score: 4 },
      { value: "e", label: "Parto do que importa para aquele público, traduzo os termos em exemplos concretos, checo se entenderam e ajusto a explicação conforme as reações.", score: 5 },
    ],
    mirrorPairCode: "CI-06", weight: 1,
  },
  {
    code: "CI-02", domain: "relacao", competency: "comunicacao_e_influencia",
    subCompetency: "clareza", type: "scenario",
    prompt: "Ao final de uma reunião em que você distribuiu tarefas, você quer ter certeza de que cada pessoa saiu sabendo o que precisa fazer. Como você encerra a conversa?",
    options: [
      { value: "a", label: "Encerro assim que termino de falar; se houver dúvida, espero que cada um procure depois.", score: 1 },
      { value: "b", label: "Pergunto genericamente se ficou alguma dúvida e, no silêncio, considero que está tudo entendido.", score: 2 },
      { value: "c", label: "Recapitulo os pontos principais, mas nem sempre confirmo a responsabilidade de cada pessoa individualmente.", score: 3 },
      { value: "d", label: "Reviso as decisões, nomeio quem ficou com cada tarefa e o prazo, e abro espaço para alinhar dúvidas.", score: 4 },
      { value: "e", label: "Recapitulo as próximas ações com responsável e prazo, peço a cada um que confirme o que entendeu e registro o combinado por escrito.", score: 5 },
    ],
    mirrorPairCode: null, weight: 1,
  },
  {
    code: "CI-03", domain: "relacao", competency: "comunicacao_e_influencia",
    subCompetency: "narrativa", type: "scenario",
    prompt: "Você vai apresentar à liderança uma proposta sustentada por dados, buscando aprovação. Como você costuma estruturar essa apresentação?",
    options: [
      { value: "a", label: "Mostro todos os números e gráficos que reuni e deixo que a liderança tire as próprias conclusões.", score: 1 },
      { value: "b", label: "Apresento os dados em sequência e, ao final, digo o que eu recomendo, sem amarrar uma coisa à outra.", score: 2 },
      { value: "c", label: "Seleciono os dados mais fortes e explico a recomendação, embora nem sempre eu conecte isso ao que importa para quem decide.", score: 3 },
      { value: "d", label: "Organizo a apresentação em torno de uma mensagem central e uso os dados para sustentar cada passo do argumento.", score: 4 },
      { value: "e", label: "Construo uma narrativa que parte do problema do negócio, conduz pelos dados até a recomendação e mostra o impacto concreto da decisão para quem ouve.", score: 5 },
    ],
    mirrorPairCode: null, weight: 1,
  },
  {
    code: "CI-04", domain: "relacao", competency: "comunicacao_e_influencia",
    subCompetency: "escuta_ativa", type: "scenario",
    prompt: "Durante uma reunião, um colega expõe uma ideia da qual você discorda e que você acha que tem uma falha óbvia. Como você costuma reagir?",
    options: [
      { value: "a", label: "Interrompo assim que percebo a falha e aponto o problema; assim ninguém perde tempo com uma ideia furada.", score: 1 },
      { value: "b", label: "Espero uma brecha e emendo a minha objeção antes que ele termine de desenvolver o raciocínio.", score: 2 },
      { value: "c", label: "Deixo ele concluir, mas passo a maior parte do tempo montando mentalmente a minha contestação.", score: 3 },
      { value: "d", label: "Escuto a ideia inteira e só depois apresento a minha discordância, com base no que ele de fato disse.", score: 4 },
      { value: "e", label: "Escuto até o fim, faço perguntas para confirmar que entendi a proposta e só então exponho a minha divergência sobre o ponto certo.", score: 5 },
    ],
    mirrorPairCode: null, weight: 1,
  },
  {
    code: "CI-05", domain: "relacao", competency: "comunicacao_e_influencia",
    subCompetency: "escuta_ativa", type: "scenario",
    prompt: "Um colega chega contrariado dizendo que um processo seu atrapalhou o trabalho dele. A reclamação parece confusa e exagerada. O que você costuma fazer?",
    options: [
      { value: "a", label: "Defendo o meu processo de imediato e explico por que a reclamação não procede.", score: 1 },
      { value: "b", label: "Ouço pela metade e já respondo com a justificativa, presumindo que entendi a queixa.", score: 2 },
      { value: "c", label: "Deixo ele falar e respondo ao que captei, sem checar se compreendi o problema real.", score: 3 },
      { value: "d", label: "Ouço com atenção e faço algumas perguntas para entender exatamente onde o processo o atrapalhou.", score: 4 },
      { value: "e", label: "Pergunto para entender a fundo, reformulo o problema com as minhas palavras para confirmar que captei e só então respondo ao ponto concreto.", score: 5 },
    ],
    mirrorPairCode: null, weight: 1,
  },
  {
    code: "CI-06", domain: "relacao", competency: "comunicacao_e_influencia",
    subCompetency: "clareza", type: "scenario",
    prompt: "Você enviou instruções por escrito sobre uma entrega e, dias depois, percebe que duas pessoas as interpretaram de formas diferentes. Como você costuma lidar com situações assim?",
    options: [
      { value: "a", label: "Considero que o problema foi delas — as instruções estavam dadas e bastava lê-las com atenção.", score: 1 },
      { value: "b", label: "Repito a mesma mensagem de forma mais enfática, sem rever se o texto era claro o suficiente.", score: 2 },
      { value: "c", label: "Esclareço a dúvida pontual com cada um, mas raramente reviso o meu jeito de comunicar para evitar a repetição.", score: 3 },
      { value: "d", label: "Reescrevo a instrução de forma mais objetiva e confirmo com as pessoas que agora ficou alinhado.", score: 4 },
      { value: "e", label: "Reconheço a ambiguidade, reescrevo a mensagem de maneira inequívoca, confirmo o entendimento de cada um e ajusto o meu modo de comunicar dali em diante.", score: 5 },
    ],
    mirrorPairCode: "CI-01", weight: 1,
  },

  // ═══ lideranca_e_desenvolvimento ═══
  {
    code: "LD-01", domain: "relacao", competency: "lideranca_e_desenvolvimento",
    subCompetency: "inspirar", type: "scenario",
    prompt: "A sua equipe precisa abraçar uma meta ambiciosa para o próximo trimestre, mas as pessoas estão cansadas e céticas. Como você costuma conduzir esse momento?",
    options: [
      { value: "a", label: "Comunico a meta como uma determinação e cobro o cumprimento; engajamento é responsabilidade de cada um.", score: 1 },
      { value: "b", label: "Explico o que precisa ser feito e o prazo, sem dedicar atenção ao ânimo da equipe.", score: 2 },
      { value: "c", label: "Apresento a meta com algum entusiasmo, embora nem sempre eu conecte o esforço a um sentido maior.", score: 3 },
      { value: "d", label: "Explico o porquê da meta, mostro como ela se liga ao trabalho de cada um e reconheço o esforço que vai exigir.", score: 4 },
      { value: "e", label: "Dou sentido à meta ligando-a a um objetivo que importa para a equipe, escuto as preocupações, envolvo as pessoas na construção do caminho e celebro avanços ao longo do trajeto.", score: 5 },
    ],
    mirrorPairCode: null, weight: 1,
  },
  {
    code: "LD-02", domain: "relacao", competency: "lideranca_e_desenvolvimento",
    subCompetency: "inspirar", type: "scenario",
    prompt: "Um membro da equipe está desmotivado e rendendo abaixo do que costuma. Você abre uma conversa individual com ele. Como você costuma conduzi-la?",
    options: [
      { value: "a", label: "Aponto a queda de desempenho e exijo que ele retome o ritmo, sem entrar no que está por trás.", score: 1 },
      { value: "b", label: "Faço uma cobrança amena e ofereço uma motivação genérica do tipo 'conto com você'.", score: 2 },
      { value: "c", label: "Pergunto como ele está e tento animá-lo, embora nem sempre eu chegue à causa real do desânimo.", score: 3 },
      { value: "d", label: "Procuro entender o que está acontecendo, escuto com atenção e ajudo a pessoa a enxergar um caminho à frente.", score: 4 },
      { value: "e", label: "Escuto para entender a raiz do desânimo, reconheço o que a pessoa traz, ligo o trabalho dela ao que a motiva e combino com ela passos concretos de retomada.", score: 5 },
    ],
    mirrorPairCode: null, weight: 1,
  },
  {
    code: "LD-03", domain: "relacao", competency: "lideranca_e_desenvolvimento",
    subCompetency: "delegar", type: "scenario",
    prompt: "Surge uma tarefa importante que você dominaria com facilidade, mas que poderia ser entregue a alguém da equipe ainda em desenvolvimento. O que você costuma fazer?",
    options: [
      { value: "a", label: "Faço eu mesmo; é mais seguro e rápido do que arriscar um resultado abaixo do esperado.", score: 1 },
      { value: "b", label: "Repasso só as partes triviais e mantenho comigo tudo o que for sensível ou mais visível.", score: 2 },
      { value: "c", label: "Delego dependendo do prazo e do humor do dia, mas costumo refazer boa parte do que volta.", score: 3 },
      { value: "d", label: "Entrego a tarefa à pessoa com o contexto necessário e acompanho de longe, intervindo só se preciso.", score: 4 },
      { value: "e", label: "Delego como oportunidade de desenvolvimento: alinho expectativas e pontos de checagem, dou autonomia real para executar e ofereço suporte sem assumir a tarefa de volta.", score: 5 },
    ],
    mirrorPairCode: "LD-06", weight: 1,
  },
  {
    code: "LD-04", domain: "relacao", competency: "lideranca_e_desenvolvimento",
    subCompetency: "delegar", type: "scenario",
    prompt: "Você delegou uma frente de trabalho a um colega. No meio do caminho, percebe que ele está conduzindo de um jeito diferente do que você faria, embora ainda dentro do prazo. Como você reage?",
    options: [
      { value: "a", label: "Assumo a frente de volta; do meu jeito eu tenho certeza de que sai certo.", score: 1 },
      { value: "b", label: "Passo a microgerenciar cada passo e exijo que ele siga exatamente o meu método.", score: 2 },
      { value: "c", label: "Deixo seguir, mas fico ansioso e acabo intervindo em vários detalhes ao longo do caminho.", score: 3 },
      { value: "d", label: "Respeito o caminho dele desde que o resultado esteja garantido, e me coloco à disposição para apoiar.", score: 4 },
      { value: "e", label: "Confirmo que o objetivo e os pontos críticos estão claros, respeito a abordagem dele como espaço legítimo de execução e ofereço apoio sem retomar o controle.", score: 5 },
    ],
    mirrorPairCode: null, weight: 1,
  },
  {
    code: "LD-05", domain: "relacao", competency: "lideranca_e_desenvolvimento",
    subCompetency: "dar_feedback", type: "scenario",
    prompt: "Um colega de quem você gosta entregou um trabalho com problemas reais que precisam ser corrigidos. Você precisa dar o retorno. Como você costuma fazer?",
    options: [
      { value: "a", label: "Evito o assunto para não desgastar a relação e acabo corrigindo os problemas por conta própria.", score: 1 },
      { value: "b", label: "Faço comentários vagos e suavizo tanto que a pessoa não percebe que há algo a melhorar.", score: 2 },
      { value: "c", label: "Dou o retorno, mas adio o momento e acabo entregando a crítica de forma apressada ou indireta.", score: 3 },
      { value: "d", label: "Aponto os problemas de forma direta e respeitosa, com exemplos concretos do que precisa mudar.", score: 4 },
      { value: "e", label: "Trago o retorno cedo, descrevo os problemas com fatos específicos, escuto a perspectiva da pessoa e combino com ela como corrigir, preservando a relação.", score: 5 },
    ],
    mirrorPairCode: null, weight: 1,
  },
  {
    code: "LD-06", domain: "relacao", competency: "lideranca_e_desenvolvimento",
    subCompetency: "delegar", type: "scenario",
    prompt: "Você está sobrecarregado e a equipe tem capacidade ociosa. Distribuir parte do trabalho aliviaria você, mas significaria abrir mão do controle direto sobre as entregas. Como você age?",
    options: [
      { value: "a", label: "Continuo segurando tudo; prefiro o excesso de trabalho à incerteza de depender da entrega dos outros.", score: 1 },
      { value: "b", label: "Repasso apenas tarefas pequenas e de baixo risco, e sigo carregando o que de fato pesa na minha agenda.", score: 2 },
      { value: "c", label: "Distribuo parte do trabalho, mas fico conferindo cada detalhe e acabo retomando o que não me agrada.", score: 3 },
      { value: "d", label: "Distribuo o trabalho conforme a capacidade da equipe e acompanho os pontos-chave, sem reassumir as tarefas.", score: 4 },
      { value: "e", label: "Distribuo o trabalho com tranquilidade, alinho o resultado esperado, confio que a equipe dá conta e uso o meu tempo no que só eu posso fazer.", score: 5 },
    ],
    mirrorPairCode: "LD-03", weight: 1,
  },

  // ═══ negociacao_e_conflito ═══
  {
    code: "NC-01", domain: "relacao", competency: "negociacao_e_conflito",
    subCompetency: "assertividade", type: "scenario",
    prompt: "Em uma reunião, a maioria caminha para uma decisão que você considera equivocada por motivos consistentes. Como você costuma se posicionar?",
    options: [
      { value: "a", label: "Imponho a minha posição com aspereza e descarto os argumentos contrários para encerrar logo o assunto.", score: 1 },
      { value: "b", label: "Fico calado para não criar atrito, mesmo achando que a decisão está errada.", score: 2 },
      { value: "c", label: "Insinuo o meu desconforto de forma indireta, mas não chego a colocar o meu ponto com clareza.", score: 3 },
      { value: "d", label: "Exponho a minha discordância com firmeza e apresento os motivos, respeitando a posição dos demais.", score: 4 },
      { value: "e", label: "Defendo o meu ponto de vista com firmeza e fundamentação, ouço as objeções com abertura e proponho avaliar a decisão à luz dos argumentos.", score: 5 },
    ],
    mirrorPairCode: "NC-06", weight: 1,
  },
  {
    code: "NC-02", domain: "relacao", competency: "negociacao_e_conflito",
    subCompetency: "assertividade", type: "scenario",
    prompt: "Um colega de outra área pede a sua ajuda em uma demanda que, se você aceitar, vai comprometer prazos seus que já estão apertados. O que você costuma fazer?",
    options: [
      { value: "a", label: "Recuso de forma ríspida ou dou uma desculpa qualquer, sem me preocupar com o efeito na relação.", score: 1 },
      { value: "b", label: "Aceito mesmo sabendo que não dá, e depois lido com o atraso nas minhas próprias entregas.", score: 2 },
      { value: "c", label: "Enrolo a resposta ou aceito parcialmente sem deixar claro o meu limite, evitando a conversa direta.", score: 3 },
      { value: "d", label: "Digo não com clareza, explico o motivo dos meus prazos e mantenho a cordialidade na conversa.", score: 4 },
      { value: "e", label: "Digo não de forma transparente, explico a minha prioridade atual e ofereço uma alternativa viável, como outro prazo ou um caminho diferente para a demanda dele.", score: 5 },
    ],
    mirrorPairCode: null, weight: 1,
  },
  {
    code: "NC-03", domain: "relacao", competency: "negociacao_e_conflito",
    subCompetency: "mediacao", type: "scenario",
    prompt: "Dois colegas da sua equipe estão em conflito aberto, e a tensão entre eles começa a contaminar o clima do grupo. Como você costuma agir?",
    options: [
      { value: "a", label: "Não me meto; conflito entre os dois é problema deles, e cabe a cada um resolver.", score: 1 },
      { value: "b", label: "Tomo o partido de quem eu acho que tem razão e deixo claro de que lado estou.", score: 2 },
      { value: "c", label: "Converso informalmente com cada um para apaziguar, mas não promovo um entendimento real entre eles.", score: 3 },
      { value: "d", label: "Reúno os dois, ajudo cada um a expor o seu ponto e conduzo a conversa em direção a um acordo.", score: 4 },
      { value: "e", label: "Crio um espaço neutro para os dois, faço cada um ouvir o ponto do outro, identifico o interesse comum e ajudo a equipe a chegar a um acordo que ambos sustentem.", score: 5 },
    ],
    mirrorPairCode: null, weight: 1,
  },
  {
    code: "NC-04", domain: "relacao", competency: "negociacao_e_conflito",
    subCompetency: "mediacao", type: "scenario",
    prompt: "Você percebe que um desacordo está se formando entre você e um colega sobre como conduzir um projeto. Como você costuma encarar esse desacordo?",
    options: [
      { value: "a", label: "Evito tocar no assunto e torço para que a divergência se dissolva sozinha com o tempo.", score: 1 },
      { value: "b", label: "Adio a conversa o máximo que consigo, porque encarar o desacordo me parece arriscado.", score: 2 },
      { value: "c", label: "Trago o tema à tona, mas com receio, tratando o desacordo como algo desconfortável a ser contornado.", score: 3 },
      { value: "d", label: "Abordo o desacordo abertamente, como uma questão a resolver, e busco alinhar o entendimento com o colega.", score: 4 },
      { value: "e", label: "Trato o desacordo como algo natural e útil, levanto o ponto cedo e o uso para confrontar ideias e chegar a uma solução melhor com o colega.", score: 5 },
    ],
    mirrorPairCode: null, weight: 1,
  },
  {
    code: "NC-05", domain: "relacao", competency: "negociacao_e_conflito",
    subCompetency: "ganha_ganha", type: "scenario",
    prompt: "Você está negociando a divisão de recursos limitados com outra área e cada lado defende uma fatia maior. Como você costuma conduzir essa negociação?",
    options: [
      { value: "a", label: "Pressiono ao máximo para garantir o que quero; numa negociação, quem cede mais é quem perde.", score: 1 },
      { value: "b", label: "Cedo o necessário para encerrar logo a discussão, mesmo que eu saia em desvantagem.", score: 2 },
      { value: "c", label: "Tento dividir a diferença pela metade, sem investigar se há uma solução melhor para os dois lados.", score: 3 },
      { value: "d", label: "Procuro entender a necessidade da outra área e busco uma divisão que atenda razoavelmente os dois.", score: 4 },
      { value: "e", label: "Investigo o interesse real por trás da posição de cada lado e busco uma saída que amplie o resultado para ambos, em vez de apenas repartir o que está na mesa.", score: 5 },
    ],
    mirrorPairCode: null, weight: 1,
  },
  {
    code: "NC-06", domain: "relacao", competency: "negociacao_e_conflito",
    subCompetency: "assertividade", type: "scenario",
    prompt: "Em uma discussão de equipe, alguém propõe um caminho com o qual você discorda, mas sustentar a sua posição geraria um atrito desconfortável. O que você costuma fazer?",
    options: [
      { value: "a", label: "Cedo logo e concordo com a proposta, porque evitar o atrito vale mais do que defender o meu ponto.", score: 1 },
      { value: "b", label: "Fico em silêncio e deixo passar, guardando a discordância para mim.", score: 2 },
      { value: "c", label: "Registro uma ressalva tímida e recuo assim que percebo qualquer resistência.", score: 3 },
      { value: "d", label: "Coloco a minha discordância com clareza e sustento o argumento, mesmo que isso gere algum desconforto.", score: 4 },
      { value: "e", label: "Exponho a minha posição com firmeza e os motivos por trás dela, encaro o desconforto como parte do processo e busco com o grupo a melhor decisão.", score: 5 },
    ],
    mirrorPairCode: "NC-01", weight: 1,
  },

  // ═══════════ DOMÍNIO E — CRESCIMENTO & PROPÓSITO ═══════════

  // ═══ aprendizado_continuo ═══
  {
    code: "AC-01", domain: "crescimento", competency: "aprendizado_continuo",
    subCompetency: "autodesenvolvimento", type: "scenario",
    prompt: "Sua rotina está intensa este mês. Há um curso relevante para sua função que você vinha querendo fazer. Como você lida com isso?",
    options: [
      { value: "a", label: "Adio indefinidamente — quando a rotina aliviar eu penso nisso, e por enquanto não consigo me dedicar a estudar.", score: 1 },
      { value: "b", label: "Salvo o link e digo que faço depois, mas na prática quase nunca volto a esse tipo de plano.", score: 2 },
      { value: "c", label: "Encaixo o curso quando sobra alguma janela, sem um compromisso fixo de horário.", score: 3 },
      { value: "d", label: "Reservo um horário fixo na semana e protejo esse bloco para avançar no curso.", score: 4 },
      { value: "e", label: "Trato o desenvolvimento como prioridade: agendo blocos recorrentes, defino uma meta de conclusão e acompanho meu progresso.", score: 5 },
    ],
    mirrorPairCode: null, weight: 1,
  },
  {
    code: "AC-02", domain: "crescimento", competency: "aprendizado_continuo",
    subCompetency: "autodesenvolvimento", type: "scenario",
    prompt: "Você terminou um projeto importante e percebe que alguns pontos poderiam ter saído melhor. O que você costuma fazer em seguida?",
    options: [
      { value: "a", label: "Sigo para o próximo trabalho — olhar para trás só serve para me cobrar do que já passou.", score: 1 },
      { value: "b", label: "Faço uma reflexão rápida sozinho, mas não chego a ouvir a opinião de mais ninguém.", score: 2 },
      { value: "c", label: "Se alguém me dá um retorno espontâneo, eu escuto; não costumo procurar feedback por conta própria.", score: 3 },
      { value: "d", label: "Pergunto a uma ou duas pessoas envolvidas o que poderia ter sido melhor e considero o que ouço.", score: 4 },
      { value: "e", label: "Busco ativamente feedback de quem viu o trabalho de perto, registro os pontos e transformo isso em ações concretas de melhoria.", score: 5 },
    ],
    mirrorPairCode: null, weight: 1,
  },
  {
    code: "AC-03", domain: "crescimento", competency: "aprendizado_continuo",
    subCompetency: "curiosidade", type: "scenario",
    prompt: "Em uma conversa de corredor, um colega de outra área menciona um tema técnico totalmente fora do seu domínio. Como você reage?",
    options: [
      { value: "a", label: "Mudo de assunto — se não é da minha área, não vejo razão para gastar atenção com aquilo.", score: 1 },
      { value: "b", label: "Escuto por educação, mas esqueço o assunto assim que a conversa termina.", score: 2 },
      { value: "c", label: "Acho interessante no momento e, se o tema reaparecer mais vezes, talvez eu pesquise.", score: 3 },
      { value: "d", label: "Faço algumas perguntas para entender melhor e guardo o tema para olhar com calma depois.", score: 4 },
      { value: "e", label: "Aprofundo a conversa com perguntas, depois pesquiso por conta própria e conecto o que aprendi ao meu trabalho.", score: 5 },
    ],
    mirrorPairCode: "AC-06", weight: 1,
  },
  {
    code: "AC-04", domain: "crescimento", competency: "aprendizado_continuo",
    subCompetency: "curiosidade", type: "scenario",
    prompt: "Ao ler um relatório, você encontra um termo ou um conceito que não compreende e que não é essencial para concluir a tarefa imediata. O que você faz?",
    options: [
      { value: "a", label: "Ignoro — se não trava a entrega, não vale o esforço de parar para entender.", score: 1 },
      { value: "b", label: "Deduzo o sentido pelo contexto e sigo, sem confirmar se entendi corretamente.", score: 2 },
      { value: "c", label: "Anoto o termo com a intenção de pesquisar depois, mas nem sempre volto a ele.", score: 3 },
      { value: "d", label: "Faço uma busca rápida ali mesmo para esclarecer o conceito antes de continuar.", score: 4 },
      { value: "e", label: "Investigo o conceito a fundo, confirmo com uma fonte confiável e registro o aprendizado para uso futuro.", score: 5 },
    ],
    mirrorPairCode: null, weight: 1,
  },
  {
    code: "AC-05", domain: "crescimento", competency: "aprendizado_continuo",
    subCompetency: "capacidade_de_desaprender", type: "scenario",
    prompt: "Você defendeu uma abordagem em uma reunião. Dias depois, surgem dados consistentes que contrariam o que você sustentou. Como você responde?",
    options: [
      { value: "a", label: "Mantenho minha posição e questiono os dados — recuar publicamente enfraqueceria meu argumento.", score: 1 },
      { value: "b", label: "Reconheço a dúvida só para mim, mas evito admitir abertamente que estava errado.", score: 2 },
      { value: "c", label: "Aceito os dados se a pressão do grupo for grande, ainda com alguma resistência interna.", score: 3 },
      { value: "d", label: "Reavalio minha posição à luz da nova evidência e ajusto o que defendo.", score: 4 },
      { value: "e", label: "Reconheço abertamente a mudança, explico o que a evidência mostrou e reviso a decisão com o time.", score: 5 },
    ],
    mirrorPairCode: null, weight: 1,
  },
  {
    code: "AC-06", domain: "crescimento", competency: "aprendizado_continuo",
    subCompetency: "curiosidade", type: "scenario",
    prompt: "Sua empresa abre inscrições para um projeto que exigiria aprender uma área nova, fora daquilo que você já domina. Qual é a sua inclinação?",
    options: [
      { value: "a", label: "Passo a vez — prefiro me dedicar ao que já faço bem e entrego com segurança.", score: 1 },
      { value: "b", label: "Considero, mas acabo recuando pelo receio de render menos enquanto aprendo.", score: 2 },
      { value: "c", label: "Topo se houver bastante apoio e tempo; sozinho, eu hesitaria em entrar.", score: 3 },
      { value: "d", label: "Me candidato porque vejo valor em ampliar meu repertório, mesmo com a curva de aprendizado.", score: 4 },
      { value: "e", label: "Busco o projeto justamente pelo desafio: planejo como aprender rápido e encaro a área nova como oportunidade de crescer.", score: 5 },
    ],
    mirrorPairCode: "AC-03", weight: 1,
  },

  // ═══ adaptabilidade_e_inovacao ═══
  {
    code: "AI2-01", domain: "crescimento", competency: "adaptabilidade_e_inovacao",
    subCompetency: "abertura_a_mudanca", type: "scenario",
    prompt: "A liderança comunica que o seu setor vai adotar um novo sistema, substituindo a ferramenta que você usa há anos. Qual é a sua leitura inicial?",
    options: [
      { value: "a", label: "Vejo como um problema — a ferramenta antiga funcionava e a mudança só vai gerar retrabalho.", score: 1 },
      { value: "b", label: "Aceito a contragosto e torço para que voltem atrás antes da troca acontecer.", score: 2 },
      { value: "c", label: "Fico neutro: pode ser bom ou ruim, espero a implementação para formar opinião.", score: 3 },
      { value: "d", label: "Procuro entender o que o novo sistema melhora e me preparo para usá-lo bem.", score: 4 },
      { value: "e", label: "Encaro como oportunidade: estudo os ganhos da mudança e me ofereço para apoiar a transição do time.", score: 5 },
    ],
    mirrorPairCode: null, weight: 1,
  },
  {
    code: "AI2-02", domain: "crescimento", competency: "adaptabilidade_e_inovacao",
    subCompetency: "abertura_a_mudanca", type: "scenario",
    prompt: "No meio de uma entrega, uma prioridade muda e parte do que você planejou para a semana deixa de fazer sentido. Como você se reorganiza?",
    options: [
      { value: "a", label: "Resisto e sigo o plano original o máximo possível, mesmo sabendo que ele perdeu validade.", score: 1 },
      { value: "b", label: "Demoro a aceitar e só ajusto a rota quando a cobrança fica inevitável.", score: 2 },
      { value: "c", label: "Mudo o que é estritamente necessário e mantenho o resto do plano como estava.", score: 3 },
      { value: "d", label: "Revejo as prioridades e reorganizo minhas tarefas para responder ao novo cenário.", score: 4 },
      { value: "e", label: "Reorganizo rapidamente o plano, alinho as novas prioridades com quem depende de mim e retomo o ritmo sem perder qualidade.", score: 5 },
    ],
    mirrorPairCode: null, weight: 1,
  },
  {
    code: "AI2-03", domain: "crescimento", competency: "adaptabilidade_e_inovacao",
    subCompetency: "experimentacao", type: "scenario",
    prompt: "Você teve uma ideia que pode melhorar um processo, mas há incerteza sobre se ela vai funcionar de fato. Como você prossegue?",
    options: [
      { value: "a", label: "Abandono a ideia — sem garantia de que dá certo, não vale arriscar.", score: 1 },
      { value: "b", label: "Guardo a ideia para quando houver certeza total, o que raramente acontece.", score: 2 },
      { value: "c", label: "Aposto direto na versão completa se eu acreditar bastante nela.", score: 3 },
      { value: "d", label: "Faço um teste pequeno e controlado para verificar o resultado antes de ampliar.", score: 4 },
      { value: "e", label: "Estruturo um piloto com critérios claros de sucesso, mensuro o resultado e só escalo a ideia se a evidência confirmar.", score: 5 },
    ],
    mirrorPairCode: null, weight: 1,
  },
  {
    code: "AI2-04", domain: "crescimento", competency: "adaptabilidade_e_inovacao",
    subCompetency: "experimentacao", type: "scenario",
    prompt: "Uma tarefa rotineira da sua área é feita do mesmo jeito há muito tempo e funciona razoavelmente bem. Qual é a sua postura diante dela?",
    options: [
      { value: "a", label: "Mantenho como está — funciona, e mexer no que funciona costuma dar mais trabalho do que resultado.", score: 1 },
      { value: "b", label: "Sigo o processo conhecido e só pensaria em mudar se ele começasse a falhar.", score: 2 },
      { value: "c", label: "Percebo que daria para melhorar, mas raramente saio da intenção para a ação.", score: 3 },
      { value: "d", label: "Proponho um ajuste no processo quando enxergo uma forma mais eficiente de fazê-lo.", score: 4 },
      { value: "e", label: "Reviso o processo de tempos em tempos, testo formas novas de executá-lo e implemento o que prova trazer ganho real.", score: 5 },
    ],
    mirrorPairCode: null, weight: 1,
  },
  {
    code: "AI2-05", domain: "crescimento", competency: "adaptabilidade_e_inovacao",
    subCompetency: "iniciativa", type: "scenario",
    prompt: "No dia a dia, você nota uma falha recorrente que prejudica a equipe, mas que não está formalmente sob a sua responsabilidade. O que você faz?",
    options: [
      { value: "a", label: "Não me envolvo — não é minha função, então não cabe a mim resolver.", score: 1 },
      { value: "b", label: "Espero que alguém perceba e tome a frente, sem comentar nada.", score: 2 },
      { value: "c", label: "Menciono a falha se o assunto surgir naturalmente em alguma conversa.", score: 3 },
      { value: "d", label: "Levo o problema a quem é responsável e ofereço ajuda para resolvê-lo.", score: 4 },
      { value: "e", label: "Tomo a iniciativa: aponto a falha, proponho uma solução e me mobilizo para que ela seja corrigida.", score: 5 },
    ],
    mirrorPairCode: null, weight: 1,
  },
  {
    code: "AI2-06", domain: "crescimento", competency: "adaptabilidade_e_inovacao",
    subCompetency: "abertura_a_mudanca", type: "scenario",
    prompt: "Sua equipe passou por várias mudanças nos últimos meses e agora surge mais uma proposta de alteração na forma de trabalhar. Como você recebe?",
    options: [
      { value: "a", label: "Reajo contra — já foram mudanças demais, e o que eu quero é estabilidade para trabalhar em paz.", score: 1 },
      { value: "b", label: "Demonstro cansaço e participo com pouca disposição, esperando que essa seja a última.", score: 2 },
      { value: "c", label: "Acompanho sem entusiasmo, fazendo o mínimo necessário para a mudança seguir.", score: 3 },
      { value: "d", label: "Avalio a proposta pelo mérito dela, independentemente das mudanças anteriores, e me adapto.", score: 4 },
      { value: "e", label: "Examino o ganho real da proposta, contribuo para implementá-la bem e ajudo a equipe a lidar com o desgaste das mudanças.", score: 5 },
    ],
    mirrorPairCode: null, weight: 1,
  },

  // ═══ proposito_e_direcao ═══
  {
    code: "PD-01", domain: "crescimento", competency: "proposito_e_direcao",
    subCompetency: "clareza_de_objetivo", type: "scenario",
    prompt: "Em um almoço, alguém pergunta de forma direta onde você pretende chegar na sua carreira nos próximos anos. O que você consegue responder?",
    options: [
      { value: "a", label: "Respondo que não sei — nunca parei para pensar nisso e vou levando como vier.", score: 1 },
      { value: "b", label: "Dou uma resposta vaga, do tipo crescer e ganhar mais, sem conseguir detalhar.", score: 2 },
      { value: "c", label: "Tenho uma direção geral em mente, mas hesito ao tentar torná-la concreta.", score: 3 },
      { value: "d", label: "Descrevo com clareza o ponto que quero alcançar e o tipo de trabalho que busco.", score: 4 },
      { value: "e", label: "Articulo com nitidez o destino que persigo, por que ele importa para mim e quais passos já estou dando para chegar lá.", score: 5 },
    ],
    mirrorPairCode: "PD-06", weight: 1,
  },
  {
    code: "PD-02", domain: "crescimento", competency: "proposito_e_direcao",
    subCompetency: "clareza_de_objetivo", type: "scenario",
    prompt: "Sua empresa pede que cada profissional defina um objetivo profissional para os próximos dois anos. Como você encara essa tarefa?",
    options: [
      { value: "a", label: "Acho difícil e acabo escrevendo qualquer coisa só para cumprir o que foi pedido.", score: 1 },
      { value: "b", label: "Repito uma meta genérica de anos anteriores, sem refletir muito sobre ela.", score: 2 },
      { value: "c", label: "Defino um objetivo razoável, embora eu não tenha total convicção de que é o certo.", score: 3 },
      { value: "d", label: "Formulo um objetivo específico, que reflete onde eu realmente quero estar.", score: 4 },
      { value: "e", label: "Defino um objetivo específico e mensurável, conectado ao meu propósito de longo prazo, e o desdobro em marcos concretos.", score: 5 },
    ],
    mirrorPairCode: null, weight: 1,
  },
  {
    code: "PD-03", domain: "crescimento", competency: "proposito_e_direcao",
    subCompetency: "intencionalidade", type: "scenario",
    prompt: "Olhando para como você decidiu suas tarefas e prioridades na última semana, qual descrição mais se aproxima da realidade?",
    options: [
      { value: "a", label: "Reagi ao que apareceu — atendi demandas conforme chegavam, sem relação com um objetivo maior.", score: 1 },
      { value: "b", label: "Segui mais o hábito e a urgência do que qualquer intenção definida.", score: 2 },
      { value: "c", label: "Algumas escolhas tiveram propósito, mas boa parte foi no improviso.", score: 3 },
      { value: "d", label: "A maioria das minhas escolhas esteve ligada a um objetivo que eu tinha em mente.", score: 4 },
      { value: "e", label: "Conduzi a semana de forma deliberada: cada prioridade foi escolhida por contribuir para um objetivo maior que eu acompanho.", score: 5 },
    ],
    mirrorPairCode: null, weight: 1,
  },
  {
    code: "PD-04", domain: "crescimento", competency: "proposito_e_direcao",
    subCompetency: "intencionalidade", type: "scenario",
    prompt: "Surge uma oportunidade profissional atraente — bom salário e visibilidade —, mas que não tem relação com a direção que você vinha traçando. Como você decide?",
    options: [
      { value: "a", label: "Aceito na hora — uma boa oferta é uma boa oferta, e direção é algo que se acerta depois.", score: 1 },
      { value: "b", label: "Aceito por receio de perder a chance, mesmo sentindo que ela me desvia do caminho.", score: 2 },
      { value: "c", label: "Fico dividido e provavelmente decido pelo retorno imediato, sem muita análise.", score: 3 },
      { value: "d", label: "Avalio se a oportunidade aproxima ou afasta do meu objetivo antes de responder.", score: 4 },
      { value: "e", label: "Confronto a oferta com a direção que escolhi, peso o que ela soma ao meu projeto de longo prazo e decido de forma deliberada.", score: 5 },
    ],
    mirrorPairCode: null, weight: 1,
  },
  {
    code: "PD-05", domain: "crescimento", competency: "proposito_e_direcao",
    subCompetency: "alinhamento_valor_trabalho", type: "scenario",
    prompt: "Ao refletir sobre o seu trabalho atual e aquilo que você considera importante na vida, que relação você percebe entre os dois?",
    options: [
      { value: "a", label: "Vejo pouca relação — trabalho é só meio de pagar as contas e não toca o que valorizo.", score: 1 },
      { value: "b", label: "Sinto um descompasso frequente entre o que faço e o que de fato me importa.", score: 2 },
      { value: "c", label: "Há algum alinhamento em parte do trabalho, mas convivo com trechos que não fazem sentido para mim.", score: 3 },
      { value: "d", label: "Percebo o meu trabalho em boa medida alinhado com aquilo que valorizo.", score: 4 },
      { value: "e", label: "Vejo coerência clara entre o que faço e o que valorizo, e ajusto ativamente minhas escolhas para manter esse alinhamento.", score: 5 },
    ],
    mirrorPairCode: null, weight: 1,
  },
  {
    code: "PD-06", domain: "crescimento", competency: "proposito_e_direcao",
    subCompetency: "clareza_de_objetivo", type: "scenario",
    prompt: "Ao fechar mais um ano de carreira, você olha para trás e avalia como chegou até o ponto em que está. Qual avaliação é mais sincera?",
    options: [
      { value: "a", label: "Cheguei aqui no piloto automático — fui levado pelas circunstâncias, sem um rumo que eu tenha escolhido.", score: 1 },
      { value: "b", label: "A maior parte do caminho foi acaso; raramente decidi para onde estava indo.", score: 2 },
      { value: "c", label: "Tive momentos de escolha consciente, mas também muitos trechos sem direção clara.", score: 3 },
      { value: "d", label: "Reconheço escolhas deliberadas que me trouxeram até aqui, dentro de um rumo que eu definira.", score: 4 },
      { value: "e", label: "Vejo um percurso conduzido com intenção: as decisões importantes seguiram um rumo que escolhi e revisito com frequência.", score: 5 },
    ],
    mirrorPairCode: "PD-01", weight: 1,
  },
] as const;

// ============ PERGUNTAS ABERTAS (5) ============

export const OPEN_QUESTIONS: readonly OpenQuestion[] = [
  {
    code: "OPEN-CONTEXT",
    prompt: "Descreva, em poucas linhas, o seu momento profissional atual.",
    helper: "Cargo, área, tamanho da equipe e principais responsabilidades hoje.",
  },
  {
    code: "OPEN-PAINS",
    prompt: "Qual é hoje o maior desafio ou desconforto na sua vida profissional?",
    helper: "O que mais tira o seu sono ou trava o seu avanço neste momento.",
  },
  {
    code: "OPEN-OBJECTIVE",
    prompt: "Onde você quer estar profissionalmente daqui a dois anos?",
    helper: "O resultado concreto que você gostaria de ter alcançado.",
  },
  {
    code: "OPEN-MOMENT",
    prompt: "O que mudou na sua carreira nos últimos doze meses?",
    helper: "Transições, conquistas, frustrações ou aprendizados recentes.",
  },
  {
    code: "OPEN-EXPECTATION",
    prompt: "O que você espera que esta avaliação revele sobre você?",
    helper: "A pergunta que você gostaria que o laudo respondesse.",
  },
] as const;

// ============ PARES ESPELHADOS / ÍNDICE DE CONSISTÊNCIA ============

/**
 * Cada par espelhado é formado por dois itens da MESMA competência que medem
 * o mesmo construto por SITUAÇÕES distintas. Como cada alternativa carrega o
 * próprio score, um respondente coerente escolhe alternativas de nível
 * semelhante nos dois itens; a divergência entre eles alimenta o índice de
 * consistência (PRD §3.3) e sinaliza inconsistência ou desejabilidade social.
 *
 * São 14 pares, cobrindo 14 das 18 competências e distribuídos pelos 5
 * domínios. Os dois itens de cada par recebem códigos distintos (ex.: IA-03 /
 * IA-06) e ficam separados no banco; a aplicação embaralha a ordem das
 * alternativas para que o respondente não perceba a relação.
 */
export interface MirrorPair {
  readonly competency: string;
  readonly codeA: string;
  readonly codeB: string;
}

export const MIRROR_PAIRS: readonly MirrorPair[] = [
  { competency: "fluencia_ia_aplicada", codeA: "IA-03", codeB: "IA-06" },
  { competency: "visao_sistemica", codeA: "VS-01", codeB: "VS-06" },
  { competency: "resolucao_de_problemas", codeA: "RP-03", codeB: "RP-06" },
  { competency: "experiencia_do_cliente", codeA: "EC-01", codeB: "EC-06" },
  { competency: "orientacao_a_resultado", codeA: "OR-04", codeB: "OR-06" },
  { competency: "visao_de_negocio", codeA: "VN-01", codeB: "VN-06" },
  { competency: "inteligencia_emocional", codeA: "IE-06", codeB: "IE-04" },
  { competency: "resiliencia", codeA: "RS-01", codeB: "RS-06" },
  { competency: "autogestao_e_foco", codeA: "AF-06", codeB: "AF-03" },
  { competency: "relacionamento", codeA: "RL-06", codeB: "RL-04" },
  { competency: "comunicacao_e_influencia", codeA: "CI-01", codeB: "CI-06" },
  { competency: "lideranca_e_desenvolvimento", codeA: "LD-06", codeB: "LD-03" },
  { competency: "negociacao_e_conflito", codeA: "NC-01", codeB: "NC-06" },
  { competency: "proposito_e_direcao", codeA: "PD-01", codeB: "PD-06" },
] as const;

// ============ CONSTANTES DERIVADAS ============

export const PERFIL_CIENTIFICO_VERSION = "2.0" as const;

/** Total de itens fechados pontuáveis. */
export const TOTAL_CLOSED_QUESTIONS = CLOSED_QUESTIONS.length;

/** Total de perguntas abertas. */
export const TOTAL_OPEN_QUESTIONS = OPEN_QUESTIONS.length;

/** Total de pares espelhados. */
export const TOTAL_MIRROR_PAIRS = MIRROR_PAIRS.length;
