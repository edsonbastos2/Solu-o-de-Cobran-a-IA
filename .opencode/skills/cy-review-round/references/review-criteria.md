# Critérios de Revisão

## Níveis de Severidade

### critical
Falhas de segurança, crashes, perda de dados. Exemplos: bypass de autenticação, exposição de dados sensíveis, vazamento de memória, RLS bypass.

### high
Bugs de correção, gargalos de desempenho, anti-padrões que prejudicam confiabilidade. Exemplos: loop infinito de efeitos, cache SWR não invalidado, erro engolido em caminho crítico, validação de entrada faltando.

### medium
Code smells, lacunas de cobertura, padrões não idiomáticos. Exemplos: lógica duplicada, componente muito longo (>200 linhas), `any` usado onde tipo concreto é possível, prop drilling excessivo.

### low
Melhorias cosméticas, naming, organização. Não bloqueiam merge.

## Áreas de Avaliação

### Segurança
- Supabase RLS policies aplicadas corretamente?
- Multi-tenant: user_id nunca vaza entre tenants?
- Dados sensíveis expostos no client bundle?
- Input validation presente?
- Secrets em variáveis de ambiente (nunca hardcoded)?

### Correção
- Lógica de negócio implementada conforme especificação?
- Estados de borda tratados? (loading, empty, error, null, undefined)
- Server vs Client component boundaries corretos?
- SWR cache coerente após mutations?

### Concorrência/Estado
- Race conditions em mutations assíncronas?
- Estado compartilhado entre componentes sem conflitos?
- useEffect cleanups presentes?
- SWR revalidation timing correto?

### Desempenho
- Bundle size (dynamic imports quando relevante)?
- Re-renders desnecessários?
- useMemo/useCallback aplicados com critério?
- Imagens otimizadas (next/image)?

### Tratamento de Erros
- Erros de API capturados e exibidos ao usuário?
- Erros de SWR tratados (if (error) ...)?
- Try/catch em operações assíncronas?
- Fallbacks para falhas de carregamento?

### Qualidade de Código
- DRY, SOLID, Separation of Concerns?
- Nomes descritivos?
- Componentes com responsabilidade única?
- Hooks extraídos para lógica reutilizável?

### Testes
- Pipeline de verificação (`npm run lint && npm run build`) passa?
- Cobertura de casos de borda?
- Comportamento verificável?

### Arquitetura
- Next.js App Router patterns respeitados?
- Supabase client tiers corretos? (browser, server, admin)
- Multi-tenant isolation mantida?
- Path alias `@/*` usado consistentemente?
