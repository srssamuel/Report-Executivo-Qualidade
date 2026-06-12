# Proposta de Redesign — Report Executivo (consultoria agressiva)

> Diagnóstico do dono (2026-06-12): "as abas não me ajudam a decidir".
> Princípio desta proposta: **cada aba responde UMA pergunta de gestão em
> 10 segundos — o que não responde pergunta, morre.**

---

## 1. Dashboard — vira "Sala de Comando"

**Pergunta que responde:** _"Estou bem? Onde dói? O que eu faço AGORA?"_

| Faixa                | Conteúdo                                                                                                                                                                           | Por quê                                                        |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| **Pulso** (topo)     | Score executivo em anel + 4 KPIs com seta de tendência vs semana anterior (snapshots já existem)                                                                                   | 3 segundos para saber se piorou                                |
| **Onde dói**         | **NOVO: mapa de calor Produto × Status** (Vivo/Nubank × andamento/bloqueado/atrasado) + **NOVO: aging dos críticos** (há quantos dias cada crítico está crítico — top 5 em barras) | Crítico que envelhece é o que explode; hoje ninguém vê o tempo |
| **O que faço agora** | Fila de decisão enxuta (top 5 por risco, 1 clique abre) + **NOVO: radar de pessoas** (mais sobrecarregado ↔ mais ocioso, com nome)                                                 | Transforma dado em pauta de reunião                            |
| **Tendência**        | **NOVO: burn-up semanal** — criadas acumuladas × concluídas acumuladas (de `portfolio_snapshots`/`item_history`)                                                                   | A única curva que diz se o time está drenando ou afundando     |

**Morre:** donut de status (vira o heatmap), redundância "Por responsável (contagem)" × "Carga por responsável" (fica só a carga), seções que repetem a Carteira.

---

## 2. Carteira — padrão Monday

**Pergunta:** _"Qual o estado de cada frente — e edito sem fricção?"_

- **Grupos colapsáveis por produto** com subtotais (frentes, % no prazo, esforço) — o "visual de blocos" do Monday
- **Click-to-edit**: célula renderiza TEXTO limpo; vira input só ao clicar (hoje é um formulário gigante permanente — essa é a causa nº 1 da poluição visual)
- **Borda esquerda colorida** pela cor do risco em cada linha (leitura periférica)
- **Colunas redimensionáveis** (arrastar divisor, persistido) + **seletor de colunas** (esconder o que não usa) + colunas ID/Projeto **congeladas** no scroll horizontal
- **3 densidades de linha** (compacta / média / conforto) — hoje só 2
- Zebra striping + alinhamento vertical único (hoje cada célula tem altura própria — é isso que parece "desorganizado")

---

## 3. Board — kanban que funciona

**Pergunta:** _"O que está travado em cada etapa — e movo com 1 gesto?"_

- **Arrastar pelo card inteiro** (hoje só pelo grip minúsculo — essa é a dificuldade que você sente), com drop zone destacada + placeholder de posição + auto-scroll
- **Quick actions no card**: trocar responsável e prazo sem abrir modal
- **Dias na coluna** (contador no card — item parado fica evidente)
- **Limite WIP por coluna** (coluna estoura → cabeçalho fica âmbar)
- **Colapsar colunas** vazias/concluídas

---

## 4. Riscos — de lista para matriz de decisão

**Pergunta:** _"Quais 3 riscos eu ataco esta semana?"_

- **NOVO: matriz 2D Urgência × Exposição** (quadrantes): X = dias até o prazo, Y = score composto (já existe `riskScore` com 5 fatores explicáveis!), bolha = esforço restante, cor = produto. Quadrante superior-direito = "agir agora"
- **Tabela Top Riscos** com a decomposição dos 5 fatores que JÁ calculamos (prazo, status, progresso, atualização, dependência) + a razão principal em texto + botão **"virar próxima ação"** (escreve a ação recomendada no item)
- **Aging de criticidade**: desde quando está crítico (de `item_history`)
- **Morre:** a lista plana atual (vira o detalhe da matriz)

---

## 5. Timeline — de gantt decorativo para planejamento por pessoa

**Pergunta:** _"O que cada pessoa tem pela frente — e o que colide?"_

- **Agrupar por responsável** (uma raia por pessoa) — vira instrumento de conversa de prazo com o time
- **Linha "hoje"** vertical destacada + **setas de dependência** (o `predecessorId` já existe e não é desenhado!)
- **Zoom** semana / mês / trimestre
- Colisões da mesma pessoa (barras sobrepostas) realçadas em âmbar

---

## 6. Capacidade — a foto do time

**Pergunta:** _"Quem está sendo consumido, por quem, e quem pode receber demanda nova?"_

- **NOVO: matriz Pessoa × Demandante** (produto/cliente) — esforço de cada pessoa quebrado por quem demanda; revela os "principais demandantes" que você pediu
- **NOVO: composição por tipo de atividade** usando as **tags** dos itens como tipo de rotina (projeto/rotina/incidente — taxonomia que definimos juntos)
- **Semáforo de disponibilidade** por pessoa: 🟢 pode receber / 🟡 no limite / 🔴 acima — com as horas livres na semana
- Tendência de carga por pessoa (sparkline das últimas semanas via snapshots)

---

## 7. Executivo — boletim de 1 tela

**Pergunta:** _"Nota geral da minha operação — em 10 segundos, sem rolar."_

- **Topo: NOTA A–E** (composta: carteira 40% · OKRs 30% · pessoas/uso 20% · riscos 10%) com variação vs semana anterior
- **4 cartões-boletim** (Carteira, OKRs, Pessoas, Riscos): farol + 1 frase gerada + delta
- **"3 decisões da semana"**: lista gerada (maior risco, maior lacuna, maior sobrecarga)
- Todo o analítico atual desce para baixo da dobra; o imprimível/copiar-WhatsApp permanece

---

## 8. OKRs — de tabela densa para cards de objetivo

- **Card por Objetivo** com anel de progresso do trimestre; KRs como linhas internas com barra + confiança 🟢🟡🔴 (entregue ontem) + farol de lançamento do mês
- **Homologação como inbox** (lista de pendências com aprovar em massa — já existe, ganha hierarquia visual)
- Lançamento em **painel lateral** (drawer) em vez de expandir a linha na tabela

## 9. Desenvolvimento — estabilizar antes de embelezar

- **Auditoria funcional dirigida**: PRECISO da sua lista do que "não funciona" (tela + ação + esperado). Em paralelo, estendo o E2E para clicar nas abas internas (Vértice/1:1/PDI/Mapa) e capturar erros que hoje só aparecem em interação
- Navegação interna: de 4 abas para **fluxo por colaborador** (seleciona a pessoa → vê Vértice, 1:1, PDI e OKRs numa página só)

---

## 10. @Menções + alertas (WhatsApp/Email) — NOVO módulo

- **Fase A (autônoma):** `@Nome` em comentários com autocomplete do cadastro; tabela `notifications` (RLS por dono) + **sino no topo** com não-lidas; menção também ao atribuir responsável
- **Fase B (precisa de credencial sua):**
  - **E-mail**: Resend/SMTP — precisa de API key (15 min de setup seu)
  - **WhatsApp**: Meta Cloud API ou Twilio — precisa de conta business + número (custo por mensagem)
  - Digest por Edge Function (imediato para menção; resumo diário para pendências)

---

## Ordem de ataque (cada sprint = 1–2 PRs, E2E garante regressão zero)

| Sprint | Entrega                                                          | Por quê primeiro           |
| ------ | ---------------------------------------------------------------- | -------------------------- |
| **A**  | Dashboard Sala de Comando + Riscos matriz                        | É onde o gestor decide     |
| **B**  | Carteira Monday-like + Board DnD                                 | Maior dor de uso diário    |
| **C**  | Capacidade demandantes + Timeline por pessoa + Executivo boletim | A foto do time             |
| **D**  | Menções in-app (Fase A) + OKRs cards                             | Colaboração                |
| —      | Alertas externos (Fase B)                                        | Quando a credencial chegar |

**Decisões que preciso de você:** (1) canal de alerta prioritário — WhatsApp ou E-mail? (2) lista do que está quebrado no Desenvolvimento. (3) veto/ajuste em qualquer "morre" acima.
