# Métricas de Negócio & KPIs Executivos — Superintendência de Qualidade

Este documento estabelece as métricas centrais de sucesso (KPIs), acordos de nível de serviço (SLAs), limites operacionais e frequências de revisão técnica para a plataforma **Report Executivo Qualidade**.

---

## 1. KPIs de Sucesso do Produto

O Report Executivo tem o objetivo principal de fornecer **clareza decisória e transparência com evidências**, eliminando planilhas fragmentadas e otimizando a tomada de decisão rápida.

### KPI 1: Taxa de Adoção e Frequência de Acesso (WAU/MAU)

- **Descrição:** Percentual de líderes (Superintendente, Gerentes, Coordenadores) que utilizam a plataforma ativamente para acompanhamento tático.
- **Métrica:** Usuários Ativos Semanais (WAU) / Usuários Ativos Mensais (MAU).
- **Baseline:** 40% de adoção nas primeiras 2 semanas.
- **Meta (Target):** >= 90% de engajamento contínuo dos líderes nas reuniões de status.
- **Frequência de Revisão:** Quinzenal.

### KPI 2: Maturidade de Dados da Carteira (Completeness & Health Score)

- **Descrição:** Avaliação automatizada sobre a qualidade do preenchimento das iniciativas da carteira de projetos.
- **Métrica:** Média do "Score de Saúde" calculado no painel do Dashboard. Este score avalia lacunas críticas de dados (Data Gaps), datas de entrega ausentes ou atrasadas e falta de comentários executivos atualizados.
- **Frequência de Revisão:** Semanal, gerando alertas para os donos de iniciativas com score inferior a 70/100.
- **Baseline:** 65/100.
- **Meta (Target):** >= 85/100 para todas as frentes de trabalho.

### KPI 3: Cobertura de Capacidade Operacional (Capacity Under-allocation/Overload)

- **Descrição:** Equilíbrio de alocação de esforço entre frentes e donos de iniciativas técnicas.
- **Métrica:** Percentual de profissionais com sobrecarga técnica (> 100% de ocupação ou > 30h semanais estimadas) e frentes com subalocação crítica.
- **Baseline:** 25% de profissionais em zona de sobrecarga sem visibilidade.
- **Meta (Target):** < 5% de sobrecarga oculta. Redistribuição proativa baseada no simulador de urgência.
- **Frequência de Revisão:** Mensal.

### KPI 4: Eficiência de Resolução e Remoção de Impedimentos

- **Descrição:** Tempo médio necessário para desobstruir iniciativas bloqueadas ou com risco alto de prazo.
- **Métrica:** SLA de Resolução de Riscos (Lead Time para remoção de impedimentos documentados na visão de Riscos).
- **Baseline:** 12 dias úteis.
- **Meta (Target):** <= 5 dias úteis para impedimentos de prioridade crítica.

---

## 2. SLAs de Desempenho do Sistema

Para garantir que a experiência dos líderes e executivos seja premium, estabelecemos as seguintes métricas técnicas:

| Métrica                               | Limite Aceitável (SLA) | Meta de Excelência | Método de Medição                         |
| :------------------------------------ | :--------------------- | :----------------- | :---------------------------------------- |
| **Latência de API (P95)**             | < 350ms                | < 150ms            | Monitoramento de rotas Sentry / Vercel    |
| **Latência do Health Endpoint**       | < 200ms                | < 80ms             | `/api/health` Smoke Tests                 |
| **Disponibilidade (Uptime)**          | 99.5%                  | 99.9%              | Monitoramento proativo / Vercel Analytics |
| **Apoptose de Erros JS (Crash Rate)** | < 0.5%                 | < 0.1%             | Capture Rate Sentry Client                |

---

## 3. Rituais e Governança de Negócio

Para que a plataforma atue como a **única fonte da verdade** da superintendência, a governança operacional deve seguir:

1. **Revisão Executiva Semanal (Ritual de Status):**
   - **Quando:** Toda segunda-feira às 09:00.
   - **Participantes:** Superintendente, Gerentes de Frentes e Product Managers.
   - **Fluxo:** Leitura visual direta na visão **Executivo** e exportação consolidada. Atualização imediata do campo de "Próxima Ação" e "Comentário Executivo" no Board.
2. **Atualização Descentralizada (Gerência de Projetos):**
   - **Quando:** Até sexta-feira às 17:00.
   - **Participantes:** Coordenadores e Engenheiros donos de frentes.
   - **Fluxo:** Garantir que o preenchimento de dependências, estimativas de esforço e status da iniciativa estejam perfeitamente sincronizados no Supabase.
