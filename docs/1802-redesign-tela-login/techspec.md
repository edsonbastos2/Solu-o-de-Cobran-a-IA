# Especificação Técnica: Redesign da Tela de Login

## Resumo Executivo

A implementação é uma reestruturação **single-file** de `app/login/page.tsx` (ADR-004), convertendo o card centralizado atual em um layout split-screen responsivo: coluna de branding (gradiente azul/roxo + glow esmeralda, logo, 3 benefícios com ícones lucide, composição ilustrativa CSS, avatares c/ nota de confiança) e coluna com o formulário de acesso completo. A lógica de autenticação (`signInWithPassword`, check de sessão e redirect) permanece intacta; "esqueci minha senha" e "lembrar de mim" são puramente visuais no MVP (ADR-003), e o rodapé legal usa links placeholder.

O principal trade-off: concentrar toda a tela em um único arquivo (~200 linhas) contra a criação de componentes separados. Aceito em favor do padrão inline do projeto e da ausência de reuso.

## Arquitetura do Sistema

### Visão dos Componentes

| Componente | Responsabilidade | Relação |
|---|---|---|
| `app/login/page.tsx` | Renderiza split-screen: branding + form; handle de login; check de sessão | Única página pública de auth; usa `lib/supabase.ts` |
| `lib/supabase.ts` | Cliente browser (padrão Supabase) | Inalterado — usado via `supabase.auth` |
| `middleware.ts` | Permite `/login` sem sessão; bloqueia o restante | Inalterado — sem novas rotas públicas |
| `motion/react` | Animação de entrada (fade/slide) | Reutiliza padrão atual da tela |

### Fluxo de dados

- **Render**: `page.tsx` monta o layout e os textos de branding (constantes no arquivo).
- **Auth**: `handleLogin` chama `supabase.auth.signInWithPassword(email, password)`; em erro exibe banner vermelho; em sucesso `router.push('/')`.
- **Sessão**: `useEffect` checa `getSession()`; se já logado, redireciona para `/`.
- **Visual**: toggle de senha apenas alterna `type` do input (sem nova auth); "lembrar" apenas alterna visual do checkbox; "esqueci senha" não navega.

## Design de Implementação

### Interfaces Centrais

Sem novas interfaces — o componente mantém o tipo do handler de evento padrão do React:

```tsx
type LoginState = {
  email: string;
  password: string;
  showPassword: boolean;
  remember: boolean;
  loading: boolean;
  error: string;
};
```

`handleLogin` já existente não muda de contrato: `(e: React.FormEvent) => Promise<void>`.

### Modelos de Dados

Nenhuma mudança de schema, banco ou RLS. A tela só usa tipagem do Supabase client existente (`lib/types.ts` não é tocado).

### Layout (responsividade)

- Desktop (`lg+`): grid `lg:grid-cols-2` — branding à esquerda, form à direita.
- Mobile (`<lg`): coluna única, branding condensada (parte não essencial com `hidden lg:flex`).

### Elementos da Coluna de Branding

- `Logo`: bloco emerald com ícone `Bot` (padrão atual) + nome "CobrançaIA".
- `Título/subtítulo`: apresentação do produto.
- `3 benefícios`: lista com ícones lucide (ex.: `Handshake` para negociação IA, `FolderKanban` para gestão, `MessageSquare` para WhatsApp) + texto fixo.
- `Ilustração`: composição CSS — `bg-gradient-to-br from-indigo-500 to-purple-500` decorativo, formas/blobs com opacidade controlada, glow `shadow-emerald-500/20`.
- `Social proof`: fila de avatares (círculos com iniciais ou gradientes), nota curta de confiança.

### Elementos do Formulário

- Inputs email/password com labels visíveis e receita dark existente.
- Toggle de senha: botão ícone `Eye`/`EyeOff` com `type="button"` e `aria-label`.
- Checkbox "Lembrar de mim" (somente visual).
- Link "Esqueci minha senha": `<span role="link" aria-disabled="true">` — sem navegação.
- Botão `Entrar`: `bg-emerald-500 hover:bg-emerald-400 text-black`; estado de loading "Entrando..." com `disabled`.
- Rodapé: "Termos de uso" e "Privacidade" como spans placeholder separados por `·`, + "© 2026 CobrançaIA".

## Pontos de Integração

Nenhuma integração externa nova. Os únicos pontos dey são os já existentes: Supabase Auth (browser client) e o redirect interno após login.

## Análise de Impacto

| Componente | Tipo de Impacto | Descrição e Risco | Ação Necessária |
|---|---|---|---|
| `app/login/page.tsx` | modified | Substituição do JSX/unidades; lógica de auth preservada (risco: baixo se preservar handlers) | Reescrever arquivo mantendo `handleLogin` e `useEffect` |
| `lib/supabase.ts` | none | Sem mudança | — |
| `middleware.ts` | none | Sem mudança de rotas públicas | — |
| `components/` | none | Nenhum componente novo | — |
| `globals.css` | none | Sem novas classes utilitárias globais | — |

## Estratégia de Teste

### Testes Unitários

Não há suite de testes no projeto. A validação é a compiladação e lint:
- `npx tsc --noEmit` — tipagem estrita.
- `npm run lint` — ESLint (next/core-web-vitals + next/typescript).
- `npm run build` — typecheck + build de produção.

### Testes de Integração

Checagem manuais:
- Login válido redireciona para `/`.
- Credenciais erradas exibem banner de erro.
- Já autenticado redireciona de `/login` para `/`.
- Colapsa corretamente em < `lg` (1 coluna, branding condensada).
- Toggle de senha alterna texto/máscara; acessibilidade do toggle e do link placeholder.

## Sequenciamento de Desenvolvimento

### Ordem de Construção

1. **Reescrever `app/login/page.tsx`** — nenhuma dependência. Convertar em split-screen, adicionar branding e seções do form.
2. **Validar compilação/lint** — depende de 1. Rodar `npx tsc --noEmit`, `npm run lint`, `npm run build`.
3. **Ajustes de responsividade/a11y** — depende de 1 e 2. Refinar breakpoints, garantir `aria-disabled` e `aria-label`.

### Dependências Técnicas

- Nenhum serviço externo novo.
- Nenhuma dependência nova de package (usa `motion`, `lucide-react`, `@/lib/supabase` já presentes).
- Supabase client deve existir em runtime (demo mode gerencia `null` — manter guarda atual).

## Monitoramento e Observabilidade

- Sem métricas instrumentadas novas.
- Logs: não acrescentar logging; error handling atual do `signInWithPassword` segue a UI (banner).
- Sem alertas novos.

## Considerações Técnicas

### Decisões Principais

| Decisão | Racional | Trade-off | Alternativas rejeitadas |
|---|---|---|---|
| Arquivo único `page.tsx` (ADR-004) | Padrão do projeto; YAGNI; auth não é reutilizado | page.grow (~200 linhas) | Componentes separados |
| "Esqueci senha" e "lembrar" visuais (ADR-003, decisão MVP) | Escopo enxuto; sem rotas novas | Sem funcional de recuperação/persistência | Fluxo real de reset; persistência real |
| Gradiente azul/roxo decorativo (ADR-002) | Coerência de marca; accent esmeralda preservado em ações | Duas famílias de cor em uma tela | Gradiente em botões/foco |
| Textos de branding como constantes no arquivo | Leitura simples; sem prostra der | Nada | Fonte externa/config |

### Riscos Conhecidos

- **Regressão de auth**: preservar `handleLogin`, o `useEffect` de sessão e o guard no `supabase`. Mitigação: revisão do diff e teste de login manual.
- **Acessibilidade**: contrastes e foco. Mitigação: manter emerald sobre dark (já passa), `aria-label` no toggle, `aria-disabled` no placeholder.
- **Tamanho do arquivo**: alto linha única concentrada. Mitigação: comentários de seção no JSX (leitura) — aceito no ADR-004.

## Arquitetura Decision Records

- [ADR-001: Layout split-screen para a tela de login](adrs/adr-001.md) — duas colunas (branding + form), condensa em 1 coluna no mobile.
- [ADR-002: Identidade visual da tela de login](adrs/adr-002.md) — esmeraldas como accent; gradiente azul/roxo apenas decorativo.
- [ADR-003: "Esqueci minha senha" apenas visual placeholder — link sem fluxo real; backlog futuro.
- [ADR-004: Implementação single-file do redesign de login — página inteira em `app/login/page.tsx`, zero dependências novas; lógica de auth preservada.