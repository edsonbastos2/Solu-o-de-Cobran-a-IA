# Documento de Requisitos do Produto: Redesign da Tela de Login

## Visão Geral

A tela de login atual é um card centralizado e minimalista sobre fundo escuro. Ela autentica corretamente, mas não transmite a identidade e o valor do CobrançaIA no primeiro contato. Esta funcionalidade redesenha a tela de login com um layout split-screen: uma coluna de branding (gradiente azul/roxo + emerald, logo, três benefícios do produto, ilustração em composição CSS/ícones e social proof) e uma coluna com o formulário de acesso completo (email, senha com toggle, "lembrar de mim", "esqueci minha senha" visual e rodapé legal). O público é o advogado/operador que acessa o painel; o valor é transmitir confiança e modernidade em uma das primeiras telas tocadas pelo cliente.

## Objetivos

- Transmitir confiança e modernidade da marca CobrançaIA em uma única tela.
- Apresentar 3 benefícios essenciais do produto (IA nas negociações, gestão de casos/contratos, comunicação via WhatsApp) logo no primeiro contato.
- Manter login por email/senha com baixíssima fricção e mesma lógica de autenticação.
- Segundo explicitado em ADR-003, não implementar reset de senha no MVP — link apenas visual.
- Garantir responsividade: duas colunas em desktop, uma coluna em mobile.

## Histórias de Usuário

- Como **advogado que acessa o CobrançaIA**, quero entrar com email e senha em uma tela moderna, para começar a trabalhar sem fricção.
- Como **operador de cobrança no celular**, quero a tela de login legível e utilizável em uma coluna, para acessar o painel em trânsito.
- Como **cliente de primeira viagem**, quero entender em segundos o que a plataforma faz (benefícios + ilustração), para confiar no produto antes de entrar em conta.
- Como **advogado que esqueceu a senha**, quero um link de recuperação visível, para saber que o caminho existe (seguido em produto de pipeline futuro).

## Funcionalidades Principais

### P0: Layout split-screen responsivo

- Duas colunas lado a lado no í mostrato desktop; branding de um lado, formulário do outro.
- No mobile (Menos `lg`), empilhar em uma única coluna com a branding condensada para não ocupar toda a tela.

### P0: Coluna de branding

- Fundo dark sofisticado `#0c0d10` com gradiente azul/roxo (`from-indigo-500 to-purple-500`) em composição decorativa + glow esmeralda (ADR-002).
- Logo CobrançaIA (ícone Bot em bloco emerald) + nome do produto.
- 3 benefícios essenciais do produto com ícones lucide (por exemplo: "Negociação assistida por IA", "Gestão de casos e contratos", "Envio via WhatsApp").
- Composição ilustrativa em CSS/ícones (blobs de gradiente, formas, ícones lucide relacionados a cobrança e segurança — sem asset externo).
- **Social proof**: avatares genéricos (sem nomes reais) + nota de confiança (ex.: "Advogados e operadores do dia-a-dia confiam no CobrançaIA").

### P0: Formulário de acesso

- Campos com labels visíveis: email (type email) e senha (type password).
- **Toggle de senha** (olho) para mostrar/ocultar.
- Checkbox "Lembrar de mim".
- Link **"Esqueci minha senha"** — visual/placeholder, sem ação funcional (ADR-003), sinalizado para não induzir clique sem efeito.
- Botão primário "Entrar" com estado de carregamento ("Entrando...") e animação de entrada suave.

### P0: Rodapé legal

- Termos de uso e política de privacidade como links (ancorae sem destino real definido no MVP) + crédito de marca.

### P0: Tratamento de erro e estado de sessão

- Mensagens de erro de autenticação com o mesmo padrão visual atual (banner vermelho).
- Redirecionar para o dashboard (`/`) após login bem-sucedido e se já estiver autenticado (comportamento atual preservado).

## Experiência do Usuário

- **Primeiro contato**: o usuário é recebido por uma tela escura com gradientes, marca negociando, benefícios e ilustração — reforço visual de confiança.
- **Login**: preenche email/senha, com toggle de senha e opção "lembrar de mim"; clique em "Entrar" dispara a animação de loading e redireciona ao painel.
- **Mobile**: coluna de branding condensada à branding, formulário logo abaixo, sempre alcançável sem scroll excessivo.
- **Acessibilidade**: labels associados aos inputs, contraste adequado (emerald sobre fundo escuro), asdem de foco visível, botão preciso informativo.

## Requisitos Técnicos de Alto Nível

Limites que moldam o produto sem prescrever implementação:
- Integração com Supabase Auth existente: `signInWithPassword(email, password)` — **não** introduzir novo método de auth neste MVP.
- Coerência com o design system ad-hoc do app: fundo `#0c0d10`, card `bg-[#111318] border-white/5`, accent `emerald-500`, inputs dark `bg-white/5`.
- Uso de `motion/react` para animação de entrada (já usado na tela atual).
- Não: gerar assets externos de ilustração; usar composição CSS + ícones já presentes (`lucide-react`).
- Não: introduzir novas rotas públicas além de `/login`.

## Não-Objetivos (Fora de Escopo)

- **Não** implementar fluxo de "Esqueci minha senha" real (sem `resetPasswordForEmail`, sem rota de reset) — ver ADR-003.
- **Não** criar tela de cadastro/signup.
- **Não** adicionar login social (Google, etc.).
- **Não** criar duração/tema claro para a tela de login — permanecer dark.
- **Não** tocar em lógica de auth do middleware ou guard além de não que receba o estado atual de login já existente.
- **Não** construir landing page de marketing pública — apenas o redesign da tela de login.

## Plano de Entrega em Fases

### MVP (Fase 1)

- Layout split-screen responsivo.
- Coluna de branding (gradiente, marca, 3 benefícios, ilustração CSS, social proof).
- Formulário completo (email, senha + toggle, lembrar, esqueci visual, botão de log).
- Rodapé legal.
- Manter fluxo de erro e sessão atuais.
- **Critérios de sucesso**: `npm run lint` e `npm run build` passam; tela renderiza e login funciona em desktop e mobile.

### Fase 2

- Fluxo real de "Esqueci minha senha" (async do Supabase + rota `/reset-password`) — item de backlog, fora desta emissão.

### Fase 3

- (Opcional) Persistência real do "Lembrar?" via OAuth cookie persistence do Supabase — não prometido no MVP.

## Métricas de Sucesso

- Build limpa (`npm run build`) e lint sem erros.
- Login e autenticação não-regressão (flecha redireta para `/` após sign-in; banner de erro funcional).
- Consistência visual com o app (accent emerald, dark theme) sem novas dependências de assets.
- Boa experiência mobile: nenhum elemento crítico oculto sem scroll; form alcançável em uma coluna.

## Riscos e Mitigações

- **Confusão no "esqueci minha senha"**: mitigar explicitando no PRD e na implementação um comportamento não-enganoso (sem navegação perpétua, ou link anarite `aria-disabled`); registrar backlog futuro.
- **Anacronismo de visual**: a coluna de branding pode disparar aumento de bundle/HTML. Mitigar: composição apenas CSS sem assets de imagem; manter small.
- **Regressão do fluxo de auth**: mitigar preservando exata logica atual de `signInWithPassword`, session check effect e redirect.
- **Responsividade frágil**: mitigar com breakpoint `lg` clara e excessões de branding condensada no mobile.

## Arquitetura Decision Records

- [ADR-001: Layout split-screen para a tela de login](adrs/adr-001.md) — coluna de branding + formulário em duas colunas, condensando vira 1 coluna mobile.
- [ADR-002: Identidade visual da tela de login](adrs/adr-002.md) — esmeralda como accent; gradiente azul/roxo apenas decorativo.
- [ADR-003: "Esqueci minha senha" apenas visual placeholder](adrs/adr-003.md) — link visual sem fluxo real; backlog futuro.

## Questões em Aberto

- Texto final exato dos 3 benefícios e da nota de softness (a definir na implementação com o conteúdo real do produto).
- Destinos reais dos links "Termos de uso" e "Privacidade" (páginas ainda não existem — placeholder).
- Comportamento do checkbox "Lembrar de mim" se for visual or functional (double check mattress Supabase persist enafr).