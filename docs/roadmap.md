# Roadmap de Evolução — Report Executivo Qualidade

> Triagem do brief de evolução (2026-06-12) contra o estado real do produto.
> Princípio: cada item só entra se gera valor para os ~14 usuários reais
> (gestores de qualidade CX) — sem overengineering de plataforma enterprise.

## Estado de partida (o que o brief pediu e JÁ existe)

- **Design system** unificado com tokens exportáveis, modo claro/escuro,
  **zero violações WCAG critical/serious** verificado por axe-core a cada PR
- **Login** com labels acessíveis, recuperação de senha, proteção HIBP, reset por admin
- **Painéis executivos "10 segundos"**: KPI strip com tendência vs snapshot,
  score executivo, faróis de aderência por nível com texto de cobrança
- **Gantt** (Timeline) e **mapa de ocupação** (Capacidade, individual por pessoa)
- **OKRs**: tenancy por dono (FK), fila de homologação, re-pendência automática,
  apuração trimestral, 1:1 Hub
- **Auditoria de dados**: `item_history` field-level + trigger anti-tamper de OKR
- **Métricas de uso**: `daily_access`, painel de aderência, Speed Insights
- **Qualidade de engenharia do produto**: CI (lint/types/73 testes/build) +
  E2E autenticado nas 10 views com a11y gate + deploy com smoke test

## Onda 1 — execução autônoma (alto impacto, sem dependências externas)

| #   | Item                                                                                                                                      | Valor                                    | Status      |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- | ----------- |
| 1.1 | **Drill-down nos KPIs**: clicar em KPI do Dashboard/Executivo abre o recorte filtrado correspondente (e histórico quando houver snapshot) | Decisão em 1 clique a partir do número   | ✅ Entregue |
| 1.2 | **Nível de confiança no OKR** (dono marca 🟢/🟡/🔴 por KR) + realce de KR sem lançamento no mês corrente                                  | Antecipa risco antes do fim do trimestre | ✅ Entregue |
| 1.3 | **Audit log de ações administrativas** (criar/editar/excluir usuário, reset de senha) em tabela própria com RLS admin-only                | Rastreabilidade/conformidade             | ✅ Entregue |
| 1.4 | **Dashboard personalizável leve**: mostrar/ocultar/reordenar seções, persistido por usuário                                               | Cada papel vê primeiro o que lhe importa | ⏳ Pendente |

> Redesign agressivo (Sprints A–D de `redesign-proposal.md`) **entregue em 2026-06-12**:
> Sala de Comando, matriz de riscos, Carteira click-to-edit, Board DnD, Capacidade
> demandantes, Timeline por pessoa, Executivo boletim, @menções in-app e OKRs em cards.

## Onda 2 — viável, aguardando decisão/credencial do dono

| Item                                                      | Dependência                                                                 |
| --------------------------------------------------------- | --------------------------------------------------------------------------- |
| SSO Google/Microsoft (Supabase Auth)                      | Criar OAuth app no Google/Azure e colar client id/secret no painel Supabase |
| MFA (TOTP)                                                | Decisão de obrigatoriedade por papel                                        |
| Alertas externos (KR sem lançamento, item crítico parado) | Definir canal: e-mail, Slack ou Teams (webhook)                             |
| Vincular itens da carteira a KRs específicos              | Decisão de modelagem (item→KR é N:N?)                                       |

## Adiado/descartado — com justificativa

- **Gamificação de OKR** (placares/badges): para um grupo pequeno de gestores
  executivos, tende a ruído; a cobrança por faróis nomeados já cumpre o papel.
- **Métricas de engenharia de software** (lead time, MTTR, falha de build):
  o módulo "Desenvolvimento" deste portal é de _pessoas_ (Vértice/1:1/PDI);
  os usuários não gerenciam pipelines de código.
- **Integrações ERP/CRM/JIRA, custo e ROI**: não há dados de custo no modelo
  nem acessos corporativos provisionados; reavaliar quando a AeC liberar fontes.
- **Pesquisa de satisfação in-app**: redundante com o ritual semanal + painel de
  aderência neste tamanho de organização.

## Métricas de sucesso (revisar mensalmente no painel de aderência)

- **Adoção**: % de usuários ativos na semana (meta: ≥80% dos 14)
- **Frescor**: % de itens atualizados ≤3 dias (meta: ≥70%)
- **Governança**: % de itens sem lacunas (meta: ≥85%)
- **OKR**: % de KRs com lançamento no mês corrente (meta: 100% até o dia 25)
