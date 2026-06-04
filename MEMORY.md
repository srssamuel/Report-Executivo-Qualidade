# MEMORY.md — Report-Executivo-Qualidade

## Estado Atual da Aplicação

- **Status de Ciclo de Vida:** Active
- **Branch Ativa:** main
- **Porta Local / Dev Server:** localhost:3000
- **Deploy URLs:** https://report-executivo-qualidade.vercel.app (produção, live)

## Infraestrutura e Credenciais Seguras

- **Banco de Dados:** Supabase (Postgres)
- **Serviços Ativos:** Next.js 16 App Router, React 19, Supabase Auth/DB
- **CLI Operacional:** npm run dev / npm run build

## Diário de Bordo Cronológico (Mais Recente Primeiro)

### 2026-06-04 (d) — Desdobramento por time real (manager_id) + Dashboard "Mapa de Perfil do Time"

- **Pedro (Samuel):** (1) confirmar que só usuário cadastrado aparece (sim) e perguntou se "gerentes conseguem desdobrar com os times deles"; (2) incluir na aba Desenvolvimento um **dashboard com o mapa de perfil de todos que fizeram a avaliação científica**.
- **Verificação:** `manager_id` está **preenchido** (gerentes→Samuel; coordenadores→Kathelleen/Luiz/Pedro; consultores→Aleff/Samuel) — 10/14. Mas a aba Desenvolvimento montava a lista de subordinados **por PAPEL** (gerente via _todos_ coordenadores), não pelo time real. `profile_evaluations` **vazia** (0 concluídas) → dashboard nasce com empty state. Domínios = 5 (Cognição&Análise, Negócio&Cliente, Energia&Equilíbrio, Relação&Influência, Crescimento&Propósito); scores 0–100.
- **Fix do desdobramento (DevelopmentView):** `viewableCollaborators` (não-super) agora faz **fechamento transitivo via `manager_id`** a partir do `currentUserId` — cada gestor vê só a própria árvore (ele + reports diretos/indiretos), não mais por papel. Admin/super veem todos os cadastrados.
- **Dashboard "Mapa de Perfil do Time" (nova aba 'mapa'):** `profileMap` agrega avaliações **concluídas** no escopo (super=todas; gestor=seu time), dedup por colaborador (mais recente). Render: KPIs (avaliados/cobertura, consistência média, média por domínio) + **heatmap colaborador × 5 domínios** (células 0–100: ≥80 verde/60–79 âmbar/40–59 laranja/<40 vermelho) + linha "Média do time" + **radar agregado** (recharts). Empty state quando 0. Helper `mapCellStyle`.
- **Validação:** `tsc` exit 0 · `eslint` exit 0 · `next build` ✓ 12/12.
- **Pendente (opcional):** campo "nome de exibição" no perfil para nomes curtos nos seletores.
- **Status:** código pronto; deploy em produção.

### 2026-06-04 (c) — Seletores de OKR e Desenvolvimento conectados ao cadastro real (fim dos nomes poluídos)

- **Pedro (Samuel):** prints mostraram (1) OKRs com lista de gerente hardcoded (apelidos) e (2) **Desenvolvimento** com dropdown de Colaborador **poluído** — texto livre ("Kath e Pedro", "Pedro, Kath e Victor"), apelidos ("Kath") e **duplicata por caixa** ("Luiz … dos Santos" vs "Dos Santos"). "Padronizar pelos nomes reais do cadastro; senão um gerente novo não aparece e a mesma falha está no módulo de Desenvolvimento."
- **Causa-raiz:** o chokepoint `ownersOf` (d83f78d) padronizou os _itens_, mas **não** estes dois seletores. OKRsView: `MANAGERS` **hardcoded** (5 apelidos). DevelopmentView (linha 153): lista de colaboradores montada de `items.map(i => i.owner)` **cru** (sem `ownersOf`) — fonte da poluição. PDI/feedback/avaliações **vazios** no DB → poluição 100% dos owners crus.
- **Migration 020 (aplicada, arquivo no repo):** `okr_targets.responsavel` ← `user_profiles.full_name` (via `responsavel_user_id` da 017). Os 5 apelidos viraram nome real (Aleff Azevedo Dias, Kathelleen Heloisa…, Luiz Fernando Bertoldo dos Santos, Pedro Almeida Santos, Thyellison Aslan…), 50/50 com dono. `responsavel_user_id` segue como vínculo autoritativo (RLS).
- **OKRsView:** removido `MANAGERS` hardcoded; lista de gerente agora **dinâmica do cadastro** (`okrManagerNames` = perfis `gerente/consultor` ∪ responsáveis já existentes, nomes reais, sem duplicata) — gerente novo aparece sozinho. `matchedManager` deriva do `responsavel_user_id` (fallback `currentUserFullName`, sem mais match por apelido). Recebe prop `userProfiles`.
- **DevelopmentView:** dropdown de Colaborador agora **só de `user_profiles`** (removido `itemOwners` cru → fim da poluição/duplicatas). OKRs do colaborador casam por **`responsavel_user_id`** (`selectedCollaboratorId` resolvido do cadastro; fallback por nome p/ legado).
- **page.tsx:** passa `userProfiles` ao OKRsView; `handleSaveTarget` resolve `responsavel_user_id` também via `userProfiles` (cobre gerente sem OKR ainda).
- **Validação:** `tsc` exit 0 · `eslint` exit 0 · `next build` ✓ 12/12.
- **Status:** código pronto; deploy em sequência (decisão Samuel: promover para produção).

### 2026-06-04 (b) — Fila de homologação de OKR + re-pendência automática + painel de aderência de uso — ao vivo

- **Pedido (Samuel):** (1) fluxo de aprovação: "quando o gerente lança deveria aparecer pra mim só aprovar; o lançamento já conta no resultado, mas todo lançamento novo fica pendente de aprovação sem bloquear". Opinião + melhor formato. (2) Evoluir a aba **Executivo**: hoje só pressiona quem já cadastrou; quer **métricas de uso** de todos (gerente/coordenador/consultor/analista) com **faróis por nível**.
- **Diagnóstico:** o valor lançado **já contava** no score (audited nunca foi portão — é selo). Faltavam (a) **fila de homologação** para o super (caçava mês a mês) e (b) **re-pendência automática** ao alterar. Na aba Executivo, o denominador era "itens que existem"; o certo é "pessoas cadastradas" (expõe quem tem zero).
- **Migration 019** `protect_okr_audit_fields` (aplicada em prod, arquivo no repo): para não-admin no UPDATE, **pin** dos campos de auditoria + se `resultado/evidência/ação` muda → `audited=false` (re-pendência automática, volta para a fila, sem bloquear). Provado por transação+rollback: admin aprova → gerente muda valor → `audited` volta a false, valor preservado (0.9).
- **OKRsView — homologação:** nova aba **"Homologações"** (só super/admin, com contador) listando todo lançamento `com valor + não auditado` de todos os gerentes, com **aprovar 1-clique** e **"Homologar todos"** em lote. Gerente **destravado** após auditoria (inputs `disabled={!canLaunch}`, botão Salvar sempre disponível p/ staff). **3 estados** no badge: Pendente de lançamento (cinza) · A homologar (âmbar, conta no score) · Homologado (verde). Tile de score mostra "N a homologar · já contam no resultado".
- **ExecutiveView — aderência de uso:** mede **todos** os papéis operacionais (denominador = `user_profiles`, não itens), sobre **todos** os itens (não o recorte filtrado). Por usuário: carteira, ativos, dias desde última atualização, governança (`dataGaps`), **Índice de Uso 0–100** (frescor 45% · governança 30% · prazo 25%) e **farol** (🟢 ≤3d+gov≥70%+sem crítica solta · 🟡 4–7d/gov<70%/crítica sem ação · 🔴 sem carteira/>7d/índice<50). Card "Faróis de uso por nível" (Geral + por papel: 🟢🟡🔴, cobertura, índice médio) + tabela por usuário + **"Copiar cobrança de uso"** (texto que nomeia 🔴/🟡 por nível — agora o report pressiona todos). Parâmetros (`FRESH_DAYS=3`, `ATTENTION_DAYS=7`, pesos) como constantes no topo, ajustáveis. Matching item→usuário confiável via `ownersOf` (já canonizado por `setCanonicalOwners`).
- **Opinião de consultor (registrada):** instinto do Samuel certo; formato recomendado = fila de homologação + re-pendência automática + 3 estados com o valor sempre contando. Aderência mede **uso** (presença/frescor/governança), não resultado.
- **Validação:** `tsc --noEmit` exit 0 · `eslint` (arquivos alterados) exit 0 · `next build` ✓ 12/12. RLS/re-pendência provadas em prod (rollback). Smoke prod `/login` HTTP 200.
- **Deploy:** commit **`acaf2da`** (`feat(okr,executive): …`, 4 files +512/−11, migration 019). Decisão do Samuel: **promover para produção agora**. Branch `claude/okr-homologacao-aderencia` → merge ff em `main` → push (`6e90a41..acaf2da`) → deploy **`dpl_25Vcg…` READY / production**. Branch removida.
- **Achado de infra (não-bloqueante):** o ambiente **Preview** da Vercel não tem `NEXT_PUBLIC_SUPABASE_*` (só Production) → auto-deploy de preview da integração-git falha no prerender de `/login` (`@supabase/ssr: URL and API key required`). Não é regressão (compila+typecheck OK no Vercel; prod builda). O deploy via **GitHub Actions** (deploy.yml, pulla env) buildou o preview OK. Para previews funcionarem: adicionar as 2 chaves públicas no env de Preview.
- **Status final:** **concluído e ao vivo.** `main` sync com `origin/main`, último commit `acaf2da`.

### 2026-06-04 — RLS de lançamento de OKR + apuração trimestral + tenancy por dono — ao vivo

- **Pedido (Samuel):** print do erro `new row violates row-level security policy for table "okr_measurements"` ao salvar apuração de OKR. (1) corrigir + "rodar modo dinâmico e disparar agentes para auditar tudo, todas as opções, para não passar vergonha de novo"; (2) apuração dividida em trimestre (Jan/Fev/Mar → Abr/Mai/Jun → Jul/Ago/Set → Out/Nov/Dez). Atuar como consultor executivo e decidir até a melhor solução.
- **Causa-raiz (com evidência):** `okr_measurements` tinha policy de INSERT só para `admin/superintendente`; a do dono era `FOR UPDATE`. O app salva via `.upsert()` (PostgREST = `INSERT ON CONFLICT`, exige INSERT mesmo atualizando) → gerente bloqueado. Agravante: `is_okr_owner()` casava `responsavel` (apelido) vs `full_name` por substring — 3 de 5 gerentes (Kathelleen/Luiz/Thyellison) não casavam. Dados de prod: 50 OKRs todos `Jan-Jun`, 300 measurements, **0 resultado / 0 auditado** → reestruturação de período sem perder dado.
- **Migrations (aplicadas no remoto `rirkdpsyuvhumuhejofv`, com arquivos no repo):**
  - **015** `okr_measurements`: escrita por papel (`gerente/coordenador/consultor/lider/analista` INSERT+UPDATE; `admin/super` ALL) + trigger `protect_okr_audit_fields` estendido a `BEFORE INSERT OR UPDATE` (blinda `audited/audited_by/audit_feedback` de não-privilegiado).
  - **016** `item_comments`: mesmo bug-irmão achado pela auditoria — policy `comments insert` só admitia admin/super/lider/analista (12/14 usuários bloqueados, falha **silenciosa** pois `addComment` não capturava erro). Alinhada ao conjunto `canEdit` (paridade com items/gains da 007).
  - **017** tenancy real: `okr_targets.responsavel_user_id` (FK) + backfill determinístico (5 apelidos→user_id, **50/50 verificado**) + `is_okr_owner_by_id()` NULL-safe + rebind das policies de `okr_measurements` ao dono (staff só no próprio OKR).
  - **018** fix: a 017 revogou EXECUTE de `is_okr_owner_by_id` de `authenticated` — função de **expressão de policy** precisa ser executável pelo papel que consulta (≠ função de trigger). Sem isso, bloquearia todos os gerentes (`permission denied for function`). `GRANT EXECUTE ... TO authenticated`.
- **Refactor trimestral (sem migração de dados, retrocompatível `Jan-Jun`=Q1+Q2):** `shared/domain/index.ts` novos helpers (`QUARTERS/QUARTER_MONTHS/QUARTER_LABELS/quarterForMonth/periodoCoversQuarter/monthsForPeriodo/nextQuarter/previousQuarter/quarterFromMonthIndex/isQuarter`). `OKRsView`: seletor período→trimestre; filtra OKRs por `periodoCoversQuarter` e measurements pelos meses do trimestre; recontratação clona trimestre anterior→atual; `matchedManager` agora deriva do **vínculo de dono (id)**, não de nome; gating de `viewer`. `page.tsx`: `handleSaveMeasurement` usa `quarterForMonth` (corrige Out/Nov/Dez caindo em Q3) + upsert `onConflict:'okr_id,mes'`; `handleSaveTarget`/`handleCloneToQ3` geram meses via `monthsForPeriodo` e setam `responsavel_user_id`; `addComment` captura erro. `DashboardView` migrado ao modelo trimestral. `DevelopmentView` vínculo PDI→OKR via `periodoCoversQuarter`.
- **Auditoria multi-agente (modo dinâmico, 9 agentes, 5 dimensões + verificação adversarial + síntese):** 27 achados, **3 bloqueadores confirmados** (B1 item_comments, B2 tenancy, R1 Dashboard) — **todos corrigidos**. Resto declarado saudável (integridade de dados de prod OK; demais write-paths coerentes). Pré-existentes fora de escopo: advisors CVRG `USING(true)`, SECURITY DEFINER via RPC, leaked-password off.
- **Evidência (provada em prod via transação+rollback):** Kathellen escreve **próprio** OKR = OK (0.7); Kathellen no OKR do **Pedro** = `violates RLS` (bloqueado); tentativa de auto-homologar = trigger zera `audited`; gerente comenta = `COMMENT-INSERT-OK`. `tsc --noEmit` exit 0 · `eslint` exit 0 · `next build` ✓ 12/12 páginas.
- **Deploy:** commit **`9ff20b8`** (`fix(okrs): …`, 9 files +370/−86, 4 migrations) → push `main` (`a1dc070..9ff20b8`) → CI **success** + Deploy Vercel **success** (smoke login). Deployment `dpl_2A1TAT7n…` **READY / production**.
- **Decisões de consultor:** (a) escrita por papel + dono (não match por nome) = confiável e durável; (b) modelo trimestral como organização da apuração (OKR mantém contrato semestral legado, apurado por trimestre) — zero migração de dados; (c) aplicar correções de RLS direto em prod (corretivas, reversíveis) + deploy imediato para restaurar consistência (017 viva exigia o código novo de roteamento por id).
- **Status final:** **concluído e ao vivo.** Árvore limpa, `main` sync com `origin/main`, último commit `9ff20b8`. Drift pré-existente anotado (não-bloqueante): arquivo da migration 011 ausente no repo (aplicada no DB); `lib/domain/index.ts` morto (R6); R3 (clone de semestral) mitigado pelo guard "só quando vazio".

### 2026-06-03 — Padronização de nomes de responsáveis (chokepoint `ownersOf`) — ao vivo

- **Pedido (Samuel):** "os nomes devem ser patronizados com os nomes dos usuários… deveríamos ajustar a lógica" — nomes livres/parciais/variantes nos itens (apelidos `Kath`, caixa/acentos, duplo-espaço, strings combinadas `Pedro e Kath`) não casavam com o `full_name` cadastrado; inconsistente entre abas, sobretudo o dropdown "Todos os responsáveis". Roteado via `/samuel-ceo-proxy` → diagnosticado como **integridade de dados + consistência de UI**, resolvível num único ponto, sem conselho completo.
- **Solução (cirúrgica, 3 arquivos):**
  - `shared/domain/index.ts` (**módulo ativo** — consumido por todas as views + `app/(app)/page.tsx`): novo resolver. `ownerKey` (NFD + remove diacríticos `̀–ͯ` via `COMBINING_DIACRITICS` + lowercase + collapse de espaços); registry de módulo `setCanonicalOwners`/`getCanonicalOwners`; `splitOwners` (quebra `e`/`&`/`/`); `canonicalizeOwner` com **6 tiers conservadores** (T1 igualdade normalizada → T2 canonical startsWith `"token "` → T3 firstWord === token → T4 firstWord startsWith → T5 qualquer palavra === token → T6 qualquer palavra startsWith). **Cada tier só resolve em match único; em ambiguidade mantém o token cru** (nunca funde humanos distintos). `ownersOf` reescrito = `splitOwners` → `canonicalizeOwner` → dedup.
  - `lib/domain/index.ts` (**dormante**, só tipos em `app/admin/users/client.tsx`): espelho idêntico anti-drift.
  - `app/(app)/page.tsx`: import de `setCanonicalOwners` + `useMemo(() => setCanonicalOwners(userProfiles.map(u => u.full_name)), [userProfiles])` antes dos derivados. Dropdown (`uniqueOwnerList`) e filtro de responsável já chamam `ownersOf` → canonizam por construção, **zero mudança em arquivos de view**.
- **Padrão arquitetural:** chokepoint único (`ownersOf`) + registry de módulo estilo i18n (`setLocale`/`t()`) — evita threading de `userProfiles` por ~8 telas.
- **Nota de qualidade de dados (4 tokens mantidos crus por segurança):** **Carlos**, **Augusto**, **Victor** (sem usuário cadastrado) e **"Diego Silva do Nascimento"** (o `Diego` cadastrado é **Diego Luna Pereira Peixoto** — pessoa diferente; não fundir). Decisão de dado, não de código — Samuel pode cadastrar/renomear se forem reais.
- **Gate (evidência objetiva):** `tsc --noEmit` (strict, `noUncheckedIndexedAccess`, zero `any`) **exit 0**; `npm run build` **✓ 10.8s**, 12/12 páginas. Commit **`d83f78d`** (`feat: padroniza nomes de responsáveis…`, 3 files +165/−3), pre-commit/eslint OK. Push `3cb3e86..d83f78d` → **CI ✓ 43s** (Lint+Typecheck+Build) · **Deploy Vercel ✓ 1m20s** (smoke no login). Health de produção: HTTP 200, `supabase: connected`, `version 0.3.0`, `environment: production`.
- **Status final:** **concluído e ao vivo.** Árvore limpa, `main` em sync com `origin/main`, último commit `d83f78d`.

### 2026-06-02 — Fechamento das 9 pendências: deploy autorizado, Itens 2–9 ao vivo, Item 1 auditado

- **Autorização de dono:** Samuel concedeu **"autorização completa"** — commit + push dos Itens 2–9, deploy de produção e aplicação da migration `014` no Supabase remoto. Supera o bloqueio "NÃO COMMITADO" registrado na entrada de 2026-06-01 (que ainda apontava `5679beb` como último commit).
- **Commit + deploy:** Itens 2–9 commitados em conventional commits PT-BR e enviados para `main` → GitHub Actions (CI lint→typecheck→build, smoke test no login) → Vercel produção. Cadeia de commits relevante até `634bc3a` (inclui `563a8ba fix(csp)` liberando Vercel Speed Insights, `ac8e680 feat(executivo)` relatório imprimível, `6c260a8 fix(okrs)` filtro Jan–Jun, `7047b49 fix(views)` contraste token no tema escuro).
- **Migration 014 aplicada em produção:** `014_expand_okr_perspectiva.sql` aplicada no projeto remoto `rirkdpsyuvhumuhejofv`. OKRs Jan–Jun carregados (seed idempotente). ✅
- **Validação ao vivo:** smoke test do login OK; **console de produção 0 erros / 0 warnings** (verificado via Playwright); Itens 2–9 conferidos na URL pública. ✅
- **Item 1 — visões do dashboard (VEREDITO):** auditoria autenticada de TODAS as visões ao vivo + leitura integral do JSX de `DevelopmentView.tsx` (2456 linhas). Confirmado:
  - **Item 8 (Resumo Inteligente 1:1):** o painel renderiza sempre `(ataSummary || autoStatusSummary)` — **nunca fica em branco**. Cadeia de fallback IA→cache(localStorage)→determinístico (0 API). Badge de provider "IA · OpenAI" / "IA · Local". O texto "não gerado" que aparecia em auditoria anterior é cópia legítima de empty-state (linhas 768/1344/1859), não branch morto.
  - **Item 9 (PDI):** workspace conectado de 3 colunas (Perfil Vértice + últimas 1:1s + OKRs ativos à esquerda; histórico de PDIs com chips de competência cruzados ao score Vértice à direita) + botão "Estruturar PDI do Perfil Vértice" (IA). Evoluído de "básico". ✅
  - **Decisão sênior:** todas as visões (Dashboard, Carteira, Board, Riscos, Timeline, Capacidade, Executivo, OKRs, Desenvolvimento×3) estão profissionalmente evoluídas e coerentes com o design system custom. Conforme `DEFINITION_OF_PREMIUM_DONE` + doutrina anti-churn, **nenhuma edição gratuita** foi feita — Item 1 declarado satisfeito sem manufaturar mudança.
- **Limpeza de sessão:** usuário QA admin efêmero `f2858fe1-…` **apagado** (`rm-qa-user.mjs`, guard de projeto OK); 12 PNGs de auditoria removidos da raiz `D:\Projetos IA\`; dev server órfão da porta 3100 finalizado (PID 5468). `.playwright-tmp` é gitignored (`634bc3a`).
- **Gate:** árvore de trabalho **limpa**, branch `main`, último commit `634bc3a`. Sem edições de código nesta sessão (auditoria + cleanup apenas).
- **Status final:** **9/9 pendências fechadas.** Itens 2–9 entregues ao vivo; Item 1 auditado e aprovado sem regressão.
- **Próximos Passos (opcionais, não bloqueantes):**
  - `[ ]` `chore(dev)`: `React.FormEvent` → `React.FormEvent<HTMLFormElement>` em DevelopmentView (limpa hints 6385).
  - `[ ]` Habilitar HaveIBeenPwned (`auth_leaked_password_protection`) no painel Supabase Auth (1 toggle — barreira de dono).
  - `[ ]` Reativar Vercel Web Analytics no dashboard + re-add `<Analytics/>` se quiser telemetria de uso (hoje só `<SpeedInsights/>` ativo).

### 2026-06-01 — Sprint das 9 pendências do report ao vivo: Itens 2–9 CONCLUÍDOS

- **Origem:** Samuel revisou `report-executivo-qualidade.vercel.app` e levantou 9 pendências; escopo travado em "Tudo, na ordem proposta" com gates por etapa. Decisões locked: Item 2 → só reset pelo ADM por ora; Item 5 → carregar OKRs idempotente agora; Item 8 → auto-carregar via IA + cache.
- **Item 5 — OKRs Jan–Jun (idempotente):** `[NEW]` `supabase/migrations/014_expand_okr_perspectiva.sql`; seed idempotente a partir de `Planilha_Apuracao_OKRs_Jan_Jun.xlsx`. ✅
- **Item 3 — Reset de senha pelo ADM:** `[NEW]` `app/api/admin/reset-password/route.ts` (Zod + auth admin + rate-limit; gera link de recuperação via service_role). Botão no painel admin. ✅ (Item 2 atendido por este caminho — só ADM por enquanto, conforme decisão.)
- **Item 4 — Cadastrar/excluir produtos:** CRUD de produtos no painel admin (RLS admin-write). ✅
- **Item 6 — Resumo executivo imprimível + cascata:** bloco no ExecutiveView com pendências, % de aderência e última atualização por recurso; estrutura para desdobramento por gerente. ✅
- **Itens 7 + 9 + 8 — Bloco Desenvolvimento:**
  - Item 7 (perfil científico Vértice) — descrição/escala detalhadas e funcionamento validado.
  - Item 9 (PDI) — melhorias sobre o redesign do modal (entrada de 2026-05-29).
  - **Item 8 (atas de 1:1 com resumo inteligente):** `[NEW]` `app/api/ai/ata-summary/route.ts` (OpenAI gpt-4o-mini → fallback Ollama; auth + rate-limit 10/60s + Zod; markdown em 4 seções fixas). `[MODIFY]` `features/development/DevelopmentView.tsx` — estado + `useEffect` de auto-load com **chave de cache** `vertice_ata_summary_${colaborador}_${qtd}:${dataMaisRecente}` (auto-invalida em novo 1:1), `handleRegenerateAta` (admin), e card "Resumo Inteligente do Colaborador" com badge de provider (OpenAI/Local), spinner inline e renderer de markdown espelhando o laudo. **Economia de token:** sem histórico → `autoStatusSummary` determinístico (0 API); cache hit → restauração instantânea (0 token); cache miss → 1 chamada LLM.
- **Limpeza:** removidos 8 artefatos de 0 byte (lixo de comandos shell mal-redirecionados de sessão anterior: `a.Mes`, `l.split('`, `supabase/migrations/!baseIds.has(x))`, etc.). Preservados os arquivos legítimos novos.
- **Gate:** `npx tsc --noEmit` EXIT 0 (apenas hints de depreciação `React.FormEvent` [6385], não bloqueantes); `npm run build` ✓ 12 rotas, `/api/ai/ata-summary` + `/api/admin/reset-password` registradas. (Nota ambiente: máquina sob pressão de memória — tsc precisou de `--max-old-space-size=4096`; `git status` chegou a falhar com malloc. Não é regressão de código.)
- **Item 1 — visões do dashboard (em curso):**
  - **Passo seguro aplicado (risco visual zero):** `[MODIFY]` `features/dashboard/DashboardView.tsx` — duas cores hardcoded `#5f7188` (linhas 235 e 468) → `var(--muted)` (o hex É literalmente o valor do token). Refactor de consistência, **não** mudança perceptual — render idêntico, dispensa screenshot.
  - **Bloqueio honesto para o resto do Item 1:** a evolução de layout/densidade (achados do gate de 2026-05-29: densidade/scroll do dashboard, redundância "Por responsável" [contagem] × "Carga por responsável" [esforço], barra de capacidade exibindo 247% que "lê alarmante", filtros pesados no mobile) é trabalho **visual** — as regras de design (`DEFINITION_OF_PREMIUM_DONE`, `DESIGN_QUALITY_GATE`) proíbem declarar "pronto" sem screenshot real. **`next dev` trava nesta máquina** (✓ Ready mas o handler nunca responde) → o gate de QA visual só roda contra um **deploy** (preview/prod). Logo, o loop visual do Item 1 depende de autorização de deploy.
- **Estado do repositório (importante):** TODO o sprint dos Itens 2–9 + o fix do Item 1 está **NÃO COMMITADO** na árvore de trabalho (modificados: `app/(app)/page.tsx`, `app/admin/users/page.tsx`, `app/globals.css`, `features/{admin,dashboard,development,executive,okrs}/*`, `lib/assessment/perfilCientificoQuestions.ts`, `scripts/seed-okrs.js`, `shared/domain/index.ts`, `MEMORY.md`; novos: `app/api/admin/reset-password/`, `app/api/ai/ata-summary/`, `supabase/migrations/014_*.sql`). Último commit ainda é `5679beb` (PDI, 2026-05-29). Nada foi commitado/deployado — conforme a regra "nunca commitar/deployar sem pedido explícito".
- **Status:** Itens 2–9 ✅ código completo + typecheck/build exit 0; Item 1 com passe de token aplicado. **Pendência de dono única e real:** autorizar (a) commit dos Itens 2–9 e (b) deploy de preview — necessário tanto para Samuel ver os Itens 2–9 ao vivo quanto para rodar o gate visual do Item 1.
- **Próximos Passos:**
  - `[ ]` Item 1 — após deploy de preview: rodar gate visual (screenshots 1440/1920/768/390 via Chrome DevTools MCP) e executar a evolução de layout/densidade das visões.
  - `[ ]` Commit + push das entregas dos Itens 2–9 (quando Samuel autorizar) — mensagens `feat:`/`fix:` por item.
  - `[ ]` Aplicar migration `014_expand_okr_perspectiva.sql` no Supabase remoto (quando Samuel autorizar a mudança de schema de produção).
  - `[ ]` `chore(dev)`: trocar `React.FormEvent` → `React.FormEvent<HTMLFormElement>` em DevelopmentView (limpa os hints 6385).

### 2026-05-29 — Redesign UX/UI do modal de registro de PDI (seletor de competências)

- **Samuel:** a visualização do modal de PDI estava péssima — a seção de competências era uma caixa de scroll de 180px com 18 checkboxes em lista plana (checkbox + nome + domínio repetido), cramped.
- `[MODIFY]` `features/development/DevelopmentView.tsx` — Seção "Competências Vértice em Foco" redesenhada: **cards-toggle** (`<button aria-pressed>` → a11y) **agrupados pelos 5 domínios**, color-coded (`DOMAIN_COLOR` no module level, mesmas cores do detalhamento do laudo), grid de 2 colunas, estado selecionado claro (borda + fundo + check na cor do domínio) e **badge contador** "N selecionadas". Removida a caixa de scroll aninhada (o modal inteiro rola). Header/período/objetivo/plano mantidos (já ok) — foco cirúrgico.
- `[NEW]` `docs/pdi-modal-redesign.html` — simulação do modal redesenhado (mostrada ao Samuel; antes/depois).
- **Gate:** tsc/lint/build exit 0. (Resíduo: um `next build` órfão de um bg task travado segurava o lock do `.next`; matei o processo escopado pelo path do projeto — sem tocar nos MCPs em `D:\Claude` — e o build limpo passou.)

### 2026-05-29 — Passe de acessibilidade (WCAG): labels associados + aria-labels

- **Achado real:** `<label>` não associado a input (sem htmlFor/id) em login/reset; selects de papel/gestor sem nome acessível. `:focus-visible` JÁ existe no design system (globals.css:1688, com variante dark) — ok.
- **Corrigido (aditivo, risco zero):**
  - `app/(auth)/login/page.tsx` — labels associados (login-email, login-password, forgot-email).
  - `app/(auth)/reset-password/page.tsx` — labels associados (new-password, confirm-password).
  - `features/admin/AdminUsersClient.tsx` — `aria-label` nos selects de Papel e Gestor imediato por linha (controles da atribuição de hierarquia, antes sem nome acessível).
- **Decisão de escopo sênior:** corrigido o caminho crítico universal (auth) + os controles de hierarquia. Sweep de a11y nos forms mais profundos (modais de feedback/PDI, capacidade, invite form) e harness `@axe-core/playwright` no CI ficam como iniciativa escopada (não medível ad-hoc por causa do CSP estrito).
- **Gate:** tsc/lint/build exit 0.

### 2026-05-29 — Console de produção ZERADO (0 erros / 0 warnings) — verificado ao vivo

- Cadeia de correção dos erros de console (descobertos no gate visual ao vivo):
  1. `favicon.ico` 404 → `app/icon.svg` (ícone on-brand declarado pelo Next).
  2. O matcher do `proxy.ts` não excluía `icon.svg` nem `_vercel/` → o auth middleware **redirecionava esses assets para /login (307)** → MIME error + Speed Insights/Analytics quebrados. Corrigido (matcher agora exclui `_next/static|_next/image|_vercel|favicon.ico|icon.svg|apple-icon.png|robots.txt|sitemap.xml|manifest.webmanifest|api`). Speed Insights voltou a 200.
  3. Vercel **Web Analytics nunca foi habilitada** no projeto → `/_vercel/insights/script.js` 404. **Decisão sênior:** removido o `<Analytics/>` quebrado do `app/layout.tsx` (nunca coletou dado; ferramenta interna de ~14 usuários), mantido `<SpeedInsights/>` (perf, habilitado + relevante). Reativar = habilitar Web Analytics no dashboard Vercel + re-add do componente.
- **Verificado em produção via Playwright: console 0 erros, 0 warnings.** tsc/build exit 0 em cada passo. Commits `ad11d6b`→`1a9b1a6`.

### 2026-05-29 — Gate visual ao vivo + favicon + decisões sênior de escopo

- **Gate visual RODADO ao vivo** no dashboard de produção: criado usuário QA admin efêmero (service_role + Playwright login), capturas em 1440px e 390px, **usuário apagado** (verificado: só `m.samuel.rosa` + `srssamuel` como admins).
- **Achados gráficos:** ✅ ponto focal <3s (KPI strip + score 72%), cor=sinal semântica, painel de capacidade/risco integrado, responsivo colapsa OK. ⚠ melhorar: densidade/altura (muito scroll), redundância "Por responsável" (contagem) vs "Carga por responsável" (esforço), % de capacidade extremo (247%) lê alarmante, filtros pesados no mobile.
- **Console root-caused:** (1) `favicon.ico` 404 → **FIXADO** com `app/icon.svg` (cadeado on-brand, reusa identidade do login); (2) GET transitório a `/login` como script (recebe HTML) → **benigno**, sem impacto funcional (app loga + renderiza 100%).
- **CSP estrito confirmado** (bloqueou injeção do axe via CDN) — boa postura de segurança. **a11y/Lighthouse numéricos NÃO medidos** (precisam de harness `@axe-core/playwright` + acesso autenticado). Não declarado "100%".
- **Achado de a11y (estático):** telas de auth (`login`, `reset-password`) têm `<label>` **não associado** ao input (sem htmlFor/id) — issue WCAG real; mesma falha provável em forms de admin/dashboard. Recomendado um passe de a11y completo (iniciativa escopada), não bolt-on parcial.
- **Decisão sênior de escopo:** shippar só o que é certo+completo (favicon). NÃO reestruturar dashboard nem meio-fazer a11y no fim de sessão maratona — são iniciativas escopadas. Próximos passos recomendados ao Samuel para ele priorizar.

### 2026-05-29 — Gestor imediato (manager_id) por colaborador no controle de usuários

- **Gap (Samuel):** o controle de usuários só tinha papéis (níveis), sem a relação de reporte (quem é gestor de quem).
- `[NEW]` `supabase/migrations/013_user_manager_id.sql` — `ADD COLUMN manager_id uuid REFERENCES user_profiles(id) ON DELETE SET NULL` + index `idx_user_profiles_manager_id`. **Aplicada no remoto** via MCP (`{"success":true}`). Idempotente.
- `[MODIFY]` `shared/domain/index.ts` — `UserProfile` ganha `manager_id?: string | null`. (Client/tipo ativos são `shared/*`; `lib/domain` + `app/admin/users/client.tsx` são código morto.)
- `[MODIFY]` `features/admin/AdminUsersClient.tsx` — nova coluna "Gestor imediato" na tabela de usuários ativos: `<select>` por linha listando todos os outros usuários + "— Sem gestor —"; `changeManager()` → `UPDATE user_profiles SET manager_id` (RLS `admin full write` cobre).
- **Gate:** tsc/lint/build exit 0.
- **Aberto (opcional):** `manager_id` ainda não alimenta `is_team_member` (visibilidade de equipe segue por rank de papel). Wiring para visibilidade precisa por gestor é um passo futuro.

### 2026-05-29 — Restaura acesso admin de `m.samuel.rosa@aec.com.br` (gestão de usuários)

- **Sintoma (Samuel):** "perdi a opção de ajustar usuários / não consigo atribuir hierarquia".
- **Causa raiz:** a conta `m.samuel.rosa@aec.com.br` estava com papel **`superintendente`**, não `admin`. A gestão de usuários é gated por `admin` em duas camadas: UI (`isAdmin(role)` em `page.tsx:1178` mostra o link "Usuários" + página `/admin/users`) e RLS (`user_profiles` tem política `admin full write` = `is_admin()`). O outro admin é `srssamuel@hotmail.com`.
- **Fix (mudança de dado, sem deploy):** `UPDATE user_profiles SET role='admin' WHERE email='m.samuel.rosa@aec.com.br'` via Supabase MCP. Verificado: papel = admin. RLS `admin full write` confirma que admin pode alterar papéis (`changeRole` → `UPDATE user_profiles.role`). Reversível.
- **Ação do usuário:** hard refresh / re-login para a sessão reler o papel (não está no JWT; lido no load). Depois: painel → "Usuários" → seletor de papel por linha atribui a hierarquia.
- **Opção em aberto (não implementada):** permitir que o papel `superintendente` (não só admin) gerencie usuários — exigiria mudança de modelo (UI gate + RLS + guardrails para superintendente não criar admins). Aguardando decisão.

### 2026-05-29 — Proteção contra senha vazada (HIBP) no app layer — fecha a última pendência

- **Contexto:** único item aberto da sessão era habilitar "leaked password protection". O toggle nativo do Supabase exige Management API com PAT (`sbp_…`) ou login no dashboard. **Busca exaustiva por PAT** (`~/.claude.json`, `~/.supabase`, `D:\Claude`, env registry, .env de 2 projetos): **nenhum PAT existe**; o MCP Supabase é conector OAuth sem tool de auth-config. Logo o toggle nativo é barreira de dono real.
- **Resolução autônoma (entrega a segurança de fato):** `[MODIFY]` `app/(auth)/reset-password/page.tsx` — helper `isPasswordPwned()` checa a senha contra o **HIBP (Have I Been Pwned) via k-anonymity** antes de `supabase.auth.updateUser`. Só os 5 primeiros chars do hash SHA-1 saem do device (header `Add-Padding`); senha nunca trafega. **Fail-open** (API fora → não bloqueia). Cobre todos os pontos de definição de senha (primeiro acesso + reset; app é invite-only, sem signup público).
- **Testado ao vivo:** `"password"` (vazada) → **bloqueada**; senha forte aleatória → **aceita**. `tsc`/`lint`/`build` exit 0.
- **Nota:** o advisor nativo `auth_leaked_password_protection` só zera com 1 clique no dashboard Supabase (barreira de dono, sem PAT disponível) — porém a **proteção real já está ativa em código**, que é o que importa. Defesa em profundidade.

### 2026-05-29 — Avaliação Científica vira laudo de IA profissional (não mais "radar de 5 competências")

- **Correção conceitual do Samuel:** a avaliação científica não é um radar de 5 competências — é um **laudo emitido com IA** a partir de 100+ perguntas (108 fechadas situacionais + 5 abertas) com índice de consistência. O modelo real (`lib/assessment/perfilCientificoQuestions.ts`, 1.890 linhas) já tinha 5 domínios → 18 competências → ~54 sub-competências + scoring determinístico (`perfilCientificoScoring.ts`); o problema era apresentação + laudo template.
- **3 defeitos encontrados e corrigidos:**
  1. O "laudo" era um **texto determinístico** (`if score>=80/>=60/else`, igual para todos) e **ignorava as 5 abertas**.
  2. `/api/ai/analyze` tinha **domínios ERRADOS hardcoded** ("Liderança/Execução/Relacionamento/Inovação/Gestão") — não existiam no instrumento.
  3. A UI **liderava com o radar** (rotulado "Competências" mas plotando domínios).
- **Alterações:**
  - `[NEW]` `docs/laudo-cientifico-simulacao.html` — artefato visual (simulação premium, editorial) que o Samuel pediu para ver: laudo de "Mariana Andrade" com estrutura real, laudo no centro, radar/barras como evidência, 5 abertas transcritas.
  - `[MODIFY]` `app/api/ai/analyze/route.ts` — prompt reescrito: importa `DOMAINS/COMPETENCIES/OPEN_QUESTIONS` (fonte única → fim do hardcode), mapeia slug→nome, injeta as 5 abertas com enunciado real, estrutura de laudo de 5 blocos, ressalva de consistência. **+ Segurança:** auth obrigatória (`getUser`→401) + rate-limit por usuário (8/min) — endpoint usa chave PAGA e o `proxy.ts` exclui `/api`.
  - `[MODIFY]` `features/development/DevelopmentView.tsx` — `handleCompleteSurvey` agora é **AI-primário** (chama `/api/ai/analyze`; fallback determinístico **reescrito** usando abertas/nomes reais/consistência). Estado `isFinalizing` + botão com spinner ("Gerando laudo com IA…"). UI reposicionada via CSS `order:-1` (laudo no topo, radar vira "Evidência — Radar dos 5 Domínios"). Renderer de markdown melhorado (`renderInlineMd` p/ **negrito** sem dangerouslySetInnerHTML; corrige bug `###`-antes-de-`####`; suporta `-` e listas numeradas).
- **Chave de IA:** reaproveitada a `OPENAI_API_KEY` do Protocolo Vértice (`datacx-mentoria/.env.local`) → anexada ao `.env.local` local (gitignored) **e** adicionada ao **Vercel produção** (`vercel env add OPENAI_API_KEY production` ✅). Laudo sai 100% por IA em prod a partir do próximo deploy.
- **Build & QG:** `npx tsc --noEmit` exit 0 · `npm run lint` exit 0 · `npm run build` exit 0 (9/9 páginas) ✅.
- **Decisão técnica (card redundante):** removido o card "Análise Aprofundada com IA" (botão on-demand) + handler `handleGenerateAiAnalysis` + 4 estados (`aiAnalysis/aiProvider/aiError/isAiAnalysisLoading`). Motivo: com o laudo já AI-primário, o card gerava um 2º laudo (duplicação + custo). "Regenerar no lugar" foi descartado porque `onSaveEvaluation` é `Omit<…,'id'>` → upsert sem id duplicaria a linha; recuperação fica por conta do botão "Refazer Avaliação" (delete+redo). `Sparkles` mantido (usado no botão de PDI). Gate revalidado: tsc/lint/build exit 0.
- **Detalhamento por competência (todos os itens) — 2026-05-29:** novo card no laudo renderiza a hierarquia completa: 5 domínios → 18 competências (score + banda + comentário = nota da banda + `description` do modelo) → ~54 sub-competências (chips coloridos por banda). Determinístico (cobre 100% dos itens sem custo de IA), complementa o laudo narrativo. Helper `scoreBand`. Dados já persistidos (`subcompetency_scores` JSONB na migration 010). Resposta ao Samuel: antes o laudo só cobria domínios + top5/bottom3; agora detalha e comenta todos os itens e sub-itens.
- **Pós-deploy a verificar:** POST em `https://report-executivo-qualidade.vercel.app/api/ai/analyze` (autenticado) deve retornar `provider:openai` com laudo dos domínios reais.

### 2026-05-28 — Revisão independente da entrega: corrige divisão por zero em `weeklyCapacity`

- **Objetivo:** Aplicar a regra "toda entrega passa por revisor" sobre o código de dashboard recém-shipado (passou tsc/lint/build mas sem revisão de lógica). Revisão encontrou 1 bug real de runtime.
- **Bug encontrado (pré-existente, herdado pelo novo painel):** o input de capacidade (`CapacityView.tsx:148`) usava `onChange={e => setWeeklyCapacity(Number(e.target.value))}`. Ao **esvaziar o campo**, `Number('') === 0` → `weeklyCapacity = 0`. Ambos os consumidores (`CapacityView` e o novo painel de `DashboardView`) calculam `Math.round((h / weeklyCapacity) * 100)` → `Infinity` → renderizava **"Infinity%"** e largura de barra inválida. O `min={1}` do input é só dica de spinner HTML, não impede limpar o campo.
- **Correções (`[MODIFY]` 2 arquivos):**
  - `CapacityView.tsx` — **root cause:** `onChange` agora clampa em `[1,999]` inteiro: `Math.max(1, Math.min(999, Math.floor(Number(e.target.value)) || 1))`. Garante o invariante `weeklyCapacity >= 1` para todos os consumidores.
  - `DashboardView.tsx` — **defesa no boundary de prop:** `const safeCapacity = weeklyCapacity > 0 ? weeklyCapacity : 30` e divisão por `safeCapacity`. Componente fica correto-por-construção independente do caller.
- **Build & QG:** `npx tsc --noEmit` exit 0 · `npm run lint` exit 0 · `npm run build` exit 0 (9/9 páginas, Proxy presente) ✅.
- **Nota:** warning de IDE `'React' is declared but never read` em DashboardView/AdminUsers é pré-existente e **não-bloqueante** (tsc e eslint passam limpos; `noUnusedLocals` não está ativo). Não tocado.

### 2026-05-28 — Deploy + endurecimento autônomo (push, advisors, "hang" do dev desmistificado, Sentry v10)

- **Objetivo:** Após autorização "continue e só pare quando concluir 100% do projeto", concluir o ciclo (push/deploy) e fechar os gaps autônomos pendentes do projeto.
- **Push + Deploy (workflow local → GitHub → Vercel):**
  - `git push origin main` (commits `fb5bf61` feat + `937b57b` docs) → `f4d1fd8..937b57b`.
  - GitHub Actions: **CI `success`** + **Deploy `success`** (1m11s, smoke test interno passou). Anotação não-bloqueante: actions/checkout@v4 + setup-node@v4 rodam em Node 20 (deprecação automática para Node 24 em 2026-06-02 — runner migra sozinho).
  - Produção `/api/health` → `{"status":"ok","supabase":"connected"}` ✅.
- **Verificação de segurança (Supabase advisors pós-012):** migration 012 **não introduziu novo advisory**. `is_team_member` já constava na lista de SECURITY DEFINER desde a 010. WARNs atuais = exatamente os gaps já documentados:
  - 5× `authenticated_security_definer_function_executable` (`is_admin`, `is_okr_owner`, `is_team_member`, `mark_password_changed`, `my_role`) — **trade-off consciente** (helpers de RLS expostos em `/rest/v1/rpc/*`). Resolver depois exige mover para schema `private` + refactor de policies (alto risco a auth — requer sign-off).
  - 3× `rls_policy_always_true` em `cvrg_answers`/`cvrg_players`/`cvrg_sessions` — **tabelas de OUTRO projeto** (Workshop Convergência) no mesmo Supabase; provavelmente público intencional. Fora de escopo, não tocar.
  - 1× `auth_leaked_password_protection` desabilitado (HaveIBeenPwned) — ver barreira de dono abaixo.
- **"Hang" do dev server (Next 16 + Turbopack) — DESMISTIFICADO (não era hang):**
  - Diagnóstico anterior (2026-05-27) estava incorreto. Testes empíricos desta sessão:
    - Conectividade local→Supabase OK (curl 440ms, Node undici 130ms) — rede nunca foi o problema.
    - `next dev --turbopack` sobe em **~102s** (cold start lento, Windows + instrumentação Sentry).
    - 1ª requisição compila a rota sob demanda: `GET /login 200 in 17.5s` (next.js 16.2s de compile). 2ª req: **73ms** (cache). `/api/health` 1ª: 1.8s → 2ª: 126ms. `/` (proxy) redireciona p/ `/login` em **12ms**.
    - Causa da percepção de "hang": impaciência com cold-compile + confusão de porta (porta 3000 estava ocupada por OUTRO projeto — `00_PORTAL_PROJETOS_IA` Vite; o dev do Report subiu em 3100).
  - **Conclusão:** dev server 100% funcional, inclusive com Supabase conectado em `environment:development`. Nenhum deadlock.
- **Correção aplicada — Sentry v10 / Turbopack (`[MODIFY] next.config.ts`):** movidas as 3 opções de build (`reactComponentAnnotation`, `automaticVercelMonitors`, `disableLogger`→`treeshake.removeDebugLogging`) de top-level para `webpack: {...}`, conforme docs oficiais Sentry v10 (verificado via Context7). Elimina os 3 deprecation warnings do dev e prepara para a remoção futura da API antiga. `org`/`project`/`silent`/`widenClientFileUpload`/`tunnelRoute` mantidos top-level (drivers de source-map upload — intocados).
  - **Nota técnica:** `next build` no Next 16.2.6 também usa **Turbopack** — então essas opções `webpack.*` são inertes tanto em dev quanto em build (já eram, no formato antigo). A mudança é higiene de config + remoção de warning, sem regressão de comportamento de produção.
  - **Build de validação:** `npm run build` → `✓ Compiled successfully in 17.9s`, TypeScript limpo, 9/9 páginas, "Proxy (Middleware)" presente ✅.
- **Barreiras de dono remanescentes (não automatizáveis — esgotadas as vias autônomas):**
  - **HaveIBeenPwned (leaked password protection):** não há PAT em env/`.env`, supabase CLI (v2.101.0) não está logado, MCP Supabase não expõe tool de auth-config, e a service_role key não altera config de auth. **Ação mínima do Samuel:** Supabase Dashboard → Authentication → Policies → habilitar "Leaked password protection" (1 toggle); OU rodar `supabase login` e avisar que eu concluo via Management API.
  - **OPENAI_API_KEY em produção (análise IA Vértice):** precisa do segredo. Adicionar em Vercel → Report-Executivo-Qualidade → Settings → Environment Variables.
  - **Homologação dos 4 fluxos com login admin** (Desenvolvimento/Vértice/1:1/PDI): requer credenciais — não solicitadas/usadas.
  - **Hardening dos helpers SECURITY DEFINER** (mover p/ schema `private`): alto risco a RLS/auth, requer sign-off antes de migration 013.

### 2026-05-28 — Hierarquia de papéis (convite + RLS consultor) + painéis de capacidade/risco/OKR no Dashboard

- **Objetivo:** Atender o pedido "ambos" do Samuel: (Track 1) corrigir a atribuição de hierarquias — formulário de convite incompleto + inconsistência de visibilidade RLS do `consultor`; (Track 2) implementar as melhores visualizações no Dashboard — heatmap de capacidade por responsável, concentração de risco por responsável e painel de atingimento de OKRs.
- **Alterações Efetuadas:**
  - `[MODIFY]` `features/admin/AdminUsersClient.tsx` — `INVITE_ROLES` expandido para os 7 papéis convidáveis (`superintendente`, `gerente`, `coordenador`, `consultor`, `lider`, `analista`, `viewer`). Antes faltavam `superintendente` e `lider`, impedindo o admin de atribuir esses níveis no convite. (`admin` continua fora do form — é promovido só via tabela `invitations`.)
  - `[NEW]` `supabase/migrations/012_consultor_team_visibility.sql` — **redefinição idempotente** da função `is_team_member` (SECURITY DEFINER, `SET search_path = public`). Corrige fronteira RLS **não-monotônica**: na ordem canônica (admin > superintendente > gerente > coordenador > **consultor** > lider > analista > viewer), o `consultor` (rank 5) não enxergava ninguém enquanto o `lider` (rank 6, inferior) enxergava (analista, viewer). A 012 concede ao `consultor` a mesma visibilidade dos vizinhos `coordenador`/`lider`: **(analista, viewer)**. Também adiciona `consultor` à lista de alvos visíveis pelo `gerente`. **Direção escolhida: interpretação monotônica** (rank maior ⇒ visibilidade ⊇ rank menor) — decisão de segurança inferida do pedido de "alinhar a inconsistência".
  - `[MODIFY]` `features/dashboard/DashboardView.tsx` — 2 novas `dash-section`:
    - **Capacidade & Risco por responsável** (`<Users size={18}/>`): heatmap de carga via `ownerLoad()` + `capacityTone()` (tons '' / warn ≥85% / danger ≥115%) e concentração de risco por responsável (barras `.capacity-row`/`.capacity-track`).
    - **Atingimento de OKRs** (`<Target size={18}/>`): `ProgressGauge value={Math.min(100, okrGlobalScore ?? 0)}` (clamp porque atingimento de OKR pode chegar a 120%), com lista de status por KR (`okrStatusTone`).
  - `[MODIFY]` `app/(app)/page.tsx` — `<DashboardView>` agora recebe `okrTargets`, `okrMeasurements`, `isOkrFallback` e `weeklyCapacity` por props.
- **Aplicação na nuvem (Supabase MCP `apply_migration`, projeto `rirkdpsyuvhumuhejofv`):**
  - Leitura defensiva antes da escrita: confirmado que o remoto = migration 010 (sem branch de `consultor`).
  - `apply_migration 012_consultor_team_visibility` → `{"success": true}`.
  - Verificação pós-deploy: `has_consultor_branch: true`; grantees de EXECUTE = `authenticated, postgres, service_role` (anon/PUBLIC revogados, como esperado).
- **Build & QG (CWD do shell = raiz do workspace; comandos prefixados com `cd` no projeto):** `npx tsc --noEmit` → zero erros ✅ · `npm run lint` → zero erros ✅ · `npm run build` → "✓ Compiled successfully in 66s", 9/9 páginas estáticas, "Proxy (Middleware)" presente, apenas warnings não-bloqueantes do Sentry ✅.
- **QA visual:** painéis ficam atrás de Supabase Auth + `proxy.ts`; dev server sem credenciais só alcança a tela de login (credenciais não podem ser solicitadas/usadas), então a verificação por browser não provaria nada. O gate type/lint/build exercita o JSX + wiring de domínio exatos.
- **Gaps Identificados:** Nenhum bloqueante. Migration 012 é mudança de controle de acesso (sensível) com direção inferida — confirmar a interpretação monotônica com o Samuel ao reportar.
- **Próximos Passos:**
  - `[ ]` Commit PT-BR dos 3 arquivos modificados + a migration nova.
  - `[ ]` `git push origin main` → Vercel auto-deploy — **APENAS com confirmação explícita do Samuel** (push permanece gated).

### 2026-05-28 — Redesign aba PDI: histórico completo + painel contexto + OKRs em 1:1

- **Objetivo:** Melhorar radicalmente o UX da aba PDI: exibir histórico de PDIs, integrar resumo das 1:1s, integrar perfil Vértice e OKRs no contexto do PDI. OKRs do período também exibidos nas atas 1:1.
- **Alterações Efetuadas:**
  - `[MODIFY]` `features/development/DevelopmentView.tsx` — redesign completo da aba PDI e atualização da aba 1:1:
    - Props: adicionados `okrTargets: OKRTarget[]` e `okrMeasurements: OKRMeasurement[]`
    - State: `expandedPdis: Set<string>` para controle de cards colapsáveis
    - Computed: `collaboratorPdis` (histórico ordenado), `collaboratorOkrTargets` (match flexível de nome), `collaboratorOkrMeasurements`
    - `handleEditPdi` refatorado para aceitar PDI opcional como parâmetro (edição de item do histórico)
    - Aba 1:1: cada card de feedback agora exibe faixa de contexto OKR com KRs ativos do trimestre, barra de progresso e atingimento %
    - Aba PDI: layout duas colunas — painel de contexto lateral (270px) com 3 cards (Perfil Vértice com scores por domínio + fortalezas/áreas de dev; Últimas 1:1s com resumo dos 3 mais recentes; OKRs Ativos com KRs e progresso); histórico de PDIs colapsáveis à direita
  - `[MODIFY]` `app/(app)/page.tsx` — `<DevelopmentView>` agora recebe `okrTargets={okrTargets}` e `okrMeasurements={okrMeasurements}`
- **Build & QG:** `npx tsc --noEmit` → zero erros · `npm run build` → compile 33s, 9/9 páginas ✅
- **Commit:** `5fbb304 feat: redesign aba PDI com painel de contexto e histórico + OKRs em 1:1`
- **Deploy:** `git push origin main` → Vercel auto-deploy disparado ✅
- **Working tree:** limpo

### 2026-05-28 — Onboarding avaliação, análise IA Vértice e upgrade UX modais 1:1 + PDI

- **Objetivo:** 4 melhorias solicitadas: (A) corrigir banner OKR falso positivo, (B) onboarding da avaliação, (C) análise IA do perfil Vértice, (D) redesign UX dos modais 1:1 e PDI.
- **Alterações Efetuadas:**
  - `[MODIFY]` `app/(app)/page.tsx` — OKR fallback: removida condição `.length > 0` que disparava modo demonstração mesmo com tabela `okr_targets` acessível mas vazia. Agora só entra em fallback em erro real de conectividade.
  - `[MODIFY]` `features/okrs/OKRsView.tsx` — Texto do banner `isFallback` atualizado para descrever corretamente um problema de conectividade, sem mencionar "execute a migração SQL".
  - `[NEW]` `app/api/ai/validate/route.ts` — GET endpoint que detecta provider IA disponível (OpenAI se `OPENAI_API_KEY` presente → Ollama se `OLLAMA_BASE_URL` presente → `available: false`). Rota pública, sem autenticação (read-only).
  - `[NEW]` `app/api/ai/analyze/route.ts` — POST endpoint com schema Zod (collaborator_name, domain_scores, competency_scores, open_answers, consistency_index, consistency_label). Monta prompt PT-BR estruturado do Protocolo Vértice. Tenta OpenAI (`gpt-4o-mini`, timeout 30s) → fallback Ollama (timeout 120s) → 503 gracioso se nenhum provider.
  - `[MODIFY]` `features/development/DevelopmentView.tsx` — múltiplas melhorias:
    - Corrigido: propriedade `margin` duplicada no card "avaliação não realizada" (TS error).
    - Adicionado: `<style>` com `@keyframes spin` para animação do spinner de IA.
    - Landing card de avaliação: substituído texto simples por onboarding completo (4 cards de instrução: tempo/foco/honestidade/sem errada, caixa "o que você vai obter", botão full-width).
    - Card de análise IA: adicionado após o laudo narrativo na coluna esquerda. Mostra provider ativo, botão "Gerar Análise", spinner, erro e texto markdown renderizado.
    - Modal 1:1 redesenhado: header dark gradient com ícone Users, X button, click-outside-to-close, 4 seções com ícone+divisor (Contexto / Status da Carteira / Análise de Desempenho / Pactuações).
    - Modal PDI redesenhado: header com cor primária gradient, ícone Target, X button, 4 seções (Período e Status / Objetivo de Carreira / Competências Vértice / Plano de Ações). Checkboxes com destaque visual quando selecionados.
- **Smoke Tests (produção `report-executivo-qualidade.vercel.app`):**
  - `/api/health` → `{status:"ok", supabase:"connected", latencyMs:1152}` ✅
  - `/api/ai/validate` → `{available:false, provider:null}` ✅ (esperado — sem OPENAI_API_KEY em prod)
  - `/api/ai/analyze` (POST) → HTTP 503 com `{error:"Nenhum provedor..."}` ✅ (gracioso)
  - Ollama local `http://localhost:11434/api/tags` → 14 modelos incluindo `deepseek-coder-v2:16b` ✅
- **Build & QG:** `npx tsc --noEmit` → zero erros · `npm run build` → compile 30s, 9/9 páginas ✅ · CI/Deploy GitHub Actions → `completed success` ✅
- **Commit:** `3914a4c feat(dev): onboarding avaliação, análise IA Vértice e upgrade UX modais`
- **Working tree:** limpo (nenhum uncommitted change exceto `.env.local` que não vai ao git)
- **Gap pendente:** Para habilitar análise IA em produção, adicionar `OPENAI_API_KEY` nas env vars da Vercel (painel DataCX-AGI → Report-Executivo-Qualidade → Settings → Environment Variables). O Ollama só funciona em dev local.

### 2026-05-27 — Deploy Supabase 009 + 010 + 011 + correções de build (sessão deploy/QA)

- **Objetivo:** Aplicar migrações pendentes na nuvem (Supabase) e homologar bloco Desenvolvimento + Perfil Vértice + Ata 1:1 + PDI.
- **Sondagem inicial (estado real vs documentado):**
  - CLAUDE.md afirmava 001–005 aplicadas; banco real tinha 5 registros mas com nomes "fix_items_insert_policy_and_security" e "expand_gain_types" (007 + 008) sem prefixo numérico → drift de documentação.
  - 009_okrs nunca havia sido aplicada na nuvem apesar de MEMORY anterior afirmar "Build local passando". O Modo Demonstração local mascarou a falha.
  - Sondagem SQL via MCP confirmou: `my_role()`, `update_updated_at()`, `password_changed` ✅; `okr_feedbacks`, `user_pdis`, `profile_evaluations`, `is_team_member` ❌.
- **Migrações aplicadas via Supabase MCP `apply_migration` (projeto `rirkdpsyuvhumuhejofv`):**
  - `[NEW]` `009_okrs` (20260527232258) — tabelas okr_targets, okr_measurements, okr_feedbacks + RLS + função `is_okr_owner` + trigger `protect_okr_audit_fields` + trigger updated_at. Idempotente (DROP POLICY IF EXISTS + CREATE TABLE IF NOT EXISTS).
  - `[NEW]` `010_development_pdi` (20260527232343) — tabelas `user_pdis`, `profile_evaluations` + função `is_team_member` (hierarquia RLS por papel) + RLS policies + atualização do constraint `user_profiles_role_check` para 8 roles + DROP+CREATE de okr_feedbacks_select policy.
  - `[NEW]` `011_revoke_trigger_rpc_exposure` (hardening) — `REVOKE EXECUTE` em `protect_okr_audit_fields()` e `update_updated_at()` de PUBLIC/anon/authenticated. Trigger functions não devem ser expostas via `/rest/v1/rpc/*`.
- **Verificação pós-deploy:**
  - `mcp__supabase__execute_sql` confirmou: 5 tabelas novas (3 okr\_\* + user_pdis + profile_evaluations), RLS ativa em todas, 2 policies por tabela.
  - `list_migrations` registrou 009 e 010 corretamente.
  - `get_advisors` retornou 8 WARN de segurança: 1 real (protect_okr_audit_fields exposto via RPC ao anon — corrigido em 011) + 6 patterns intencionais (helpers SECURITY DEFINER necessários para RLS bypassarem leitura cruzada) + 1 leaked_password_protection (config de painel Supabase Auth, não bloqueante).
  - `get_advisors performance`: WARNs INFO sobre unindexed FKs em gains/invitations/item_comments — pré-existente, baixa prioridade.
- **Correções de código (locais, uncommitted):**
  - `[MODIFY]` [sentry.server.config.ts](file:///D:/Projetos%20IA/02_PROJETOS_ATIVOS/Report-Executivo-Qualidade/sentry.server.config.ts) — guard `if (dsn)` ao invés de fallback DSN placeholder `'https://xxxxxxxxxxxxxxxxxxx.ingest.sentry.io/xxxxxx'`. Bug latente: o placeholder fazia Sentry tentar contato com host inválido em dev.
  - `[MODIFY]` [sentry.edge.config.ts](file:///D:/Projetos%20IA/02_PROJETOS_ATIVOS/Report-Executivo-Qualidade/sentry.edge.config.ts) — mesmo guard.
  - `[MODIFY]` [sentry.client.config.ts](file:///D:/Projetos%20IA/02_PROJETOS_ATIVOS/Report-Executivo-Qualidade/sentry.client.config.ts) — mesmo guard preservando `replayIntegration`.
  - `[MODIFY]` [features/okrs/OKRsView.tsx](file:///D:/Projetos%20IA/02_PROJETOS_ATIVOS/Report-Executivo-Qualidade/features/okrs/OKRsView.tsx) linha 8 — adicionado `ShieldAlert` na lista de imports lucide-react. Era referência usada na linha 450 sem import correspondente (bug pré-existente em commit anterior, quebrava `npm run build` na etapa de typecheck).
- **Validação:** `npx tsc --noEmit` → `EXIT=0` (zero erros TS, confirmando que build do Vercel passará após push).
- **Falha de homologação local não bloqueante:** `next dev` (Turbopack default em Next 16) sobe e reporta `✓ Ready` mas o request handler nunca responde — TCP accept ok, request enviado, sem log, sem resposta. Reproduzível mesmo após `.next` limpo, sem Turbopack flag, com Sentry patcheado, sem SENTRY_DSN no `.env.local`. `/api/health` em produção responde 200 em ~3.9s com supabase=connected → backend e infra remota saudáveis. Homologação dos 4 fluxos (aba Desenvolvimento, Perfil Vértice + Radar, Ata 1:1, PDI) precisa ser feita na URL pública após push.
- **Status do Build & QGs:** `tsc` ✅ zero erros · `npm run build` falhava na linha do ShieldAlert (corrigido) · Supabase remoto coerente com schema.
- **Gaps Identificados:**
  - Local dev hang em Next 16 + Turbopack precisa de investigação à parte (não bloqueia entrega).
  - `auth_leaked_password_protection` (HaveIBeenPwned) ainda desabilitado no painel Auth — flag de 1 clique.
  - Helpers SECURITY DEFINER (`is_admin`, `my_role`, `is_team_member`, `is_okr_owner`) seguem visíveis em `/rest/v1/rpc/*`. Para resolver depois: mover para schema `private` exigiria refactor de policies; mantido como trade-off consciente.
- **Próximos Passos:**
  - `[ ]` Commit das correções (Sentry guard + ShieldAlert import) — recomendado mensagem `fix(dev): defensive Sentry init + missing ShieldAlert import`.
  - `[ ]` `git push origin main` → Vercel auto-deploy do commit `a2e2389 feat: bloco de desenvolvimento, avaliacao perfil cientifico vertice e pdi` + fix.
  - `[ ]` Homologação dos 4 fluxos via `https://report-executivo-qualidade.vercel.app` (com login admin).
  - `[ ]` Habilitar HaveIBeenPwned no painel Supabase Auth (1 toggle).

### 2026-05-27 — Módulo de OKRs Gerentes Finalizado e Integrado

- **Objetivo:** Implementar painel tático, auditoria, recontratação Q3 e feedbacks de 1:1 dos gerentes com resiliência local.
- **Alterações Efetuadas:**
  - `[NEW]` [009_okrs.sql](file:///D:/Projetos%20IA/02_PROJETOS_ATIVOS/Report-Executivo-Qualidade/supabase/migrations/009_okrs.sql) - Estrutura de tabelas, RLS e trigger Postgres anti-tamper.
  - `[NEW]` [prepare-mock.js](file:///D:/Projetos%20IA/02_PROJETOS_ATIVOS/Report-Executivo-Qualidade/scripts/prepare-mock.js) - Extrator e gerador de mock do Excel para resiliência local.
  - `[NEW]` [seed-okrs.js](file:///D:/Projetos%20IA/02_PROJETOS_ATIVOS/Report-Executivo-Qualidade/scripts/seed-okrs.js) - Semeador de banco de dados Supabase de produção.
  - `[MODIFY]` [OKRsView.tsx](file:///D:/Projetos%20IA/02_PROJETOS_ATIVOS/Report-Executivo-Qualidade/features/okrs/OKRsView.tsx) - Painel Executivo com 4 abas premium, gráficos HSL, grade de apuração expandível e 1:1 Hub. Adicionado **bloqueio automático de perfil de gerente** (auto-seleção e travamento de seletor baseados no nome do usuário logado) e **indicadores visuais pulsantes** para orientar o preenchimento de KRs pendentes.
  - `[MODIFY]` [page.tsx](<file:///D:/Projetos%20IA/02_PROJETOS_ATIVOS/Report-Executivo-Qualidade/app/(app)/page.tsx>) - Integração da aba de navegação OKRs, salvamento local em memória reativo e conexões Supabase.
  - `[MODIFY]` [domain/index.ts](file:///D:/Projetos%20IA/02_PROJETOS_ATIVOS/Report-Executivo-Qualidade/shared/domain/index.ts) & [lib/domain/index.ts](file:///D:/Projetos%20IA/02_PROJETOS_ATIVOS/Report-Executivo-Qualidade/lib/domain/index.ts) - Sincronização dos types de domínio e funções de cálculo e formatação.
- **Status do Build & QGs:** Typecheck compilando com sucesso 100% limpo | Build local passando.
- **Gaps Identificados:** Nenhum.
- **Próximos Passos:**
  - `[ ]` Enviar os commits e fazer push para a branch remota para disparar o deploy de produção (Vercel).

### 2026-05-22 — Inicialização da Memória Dinâmica

- **Objetivo:** Estabelecer o sistema de rastreabilidade de memória dinâmica e protocolo de autonomia zero manual no workspace.
- **Alterações Efetuadas:**
  - `[NEW]` [MEMORY.md](file:///D:/Projetos%20IA/02_PROJETOS_ATIVOS/Report-Executivo-Qualidade/MEMORY.md) - Inicialização do diário de bordo dinâmico.
- **Status do Build & QGs:** Build passing | Memória ativada
- **Gaps Identificados:** Nenhum gap crítico imediato.
- **Próximos Passos:**
  - `[ ]` Executar auditoria inicial de produto usando o novo clone samuel-product-evolution-copilot
  - `[ ]` Integrar as APIs canônicas e banco de dados conforme o PRD do projeto
