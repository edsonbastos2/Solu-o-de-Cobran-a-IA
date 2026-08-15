# PRD: Gestão de Equipe do Tenant com Permissões Baseadas em Papéis

## Visão Geral

Hoje, todo cadastro no Supabase Auth cria automaticamente um novo tenant e torna aquele usuário o único `owner` dele. Não existe forma de um tenant adicionar colegas à própria conta — todo usuário fica isolado em um tenant de uma pessoa só. Isso impede que qualquer organização com mais de uma pessoa use o produto como equipe: ninguém consegue dividir a carga de trabalho de monitorar negociações, intervir para enviar uma mensagem a um devedor ou delegar tarefas administrativas como configurar provedores de IA.

Esta funcionalidade permite que o `owner` ou `admin` de um tenant convide usuários adicionais para dentro dele, atribua a cada um um papel que determina o que eles podem fazer (apenas monitorar e enviar mensagens, gestão completa de registros ou configuração de provedores de IA) e administre a equipe ao longo do tempo (visualizar, editar permissões, remover).

É para owners e admins de tenants que precisam escalar as operações de cobrança além de uma única pessoa, e para os membros convidados da equipe (gestores, operadores) que precisam da quantidade certa de acesso — o suficiente para fazer o trabalho deles, não o suficiente para causar dano fora da responsabilidade deles.

Valor: desbloqueia tenants com várias pessoas, o próximo passo natural para qualquer tenant cujo volume de cobrança supera um único operador, sem expor todo usuário convidado a ações destrutivas ou à configuração sensível de IA por padrão.

## Objetivos

- Permitir que o `owner`/`admin` de um tenant adicione um novo membro de equipe sem sair do produto (sem trabalho manual de banco de dados, sem chamado de suporte).
- Dar a todo membro convidado da equipe, independentemente do papel, a capacidade de monitorar negociações/casos e enviar mensagens a devedores desde o primeiro dia.
- Impedir que membros da equipe criem, editem ou excluam registros, ou que mexam na configuração de provedores de IA, a menos que o papel deles conceda isso explicitamente.
- Manter o modelo de papéis pequeno o suficiente para que um owner olhe para a lista da equipe e entenda exatamente o que cada pessoa pode fazer, sem precisar ler uma matriz de permissões densa.
- Marco: owners de tenant conseguem crescer a equipe de forma totalmente autônoma (convidar, atribuir papel, revogar acesso) com zero envolvimento de engenharia ou suporte.

## Histórias de Usuário

**Owner do Tenant**
- Como owner de tenant, quero convidar um novo usuário por e-mail e atribuir a ele um papel, para que eu possa crescer minha equipe sem compartilhar meu próprio login.
- Como owner de tenant, quero ver a lista completa dos membros da equipe do meu tenant e seus papéis, para que eu possa auditar quem tem acesso a quê.
- Como owner de tenant, quero alterar o papel de um membro da equipe ou revogar o acesso dele a qualquer momento, para que o acesso se mantenha atualizado conforme as responsabilidades mudam.
- Como owner de tenant, quero conceder ou revogar a permissão de "configurar provedores de IA" de forma independente do papel geral de um membro, para que eu possa delegar essa responsabilidade específica a alguém em quem confio sem dar a ele direitos completos de gestão de registros.
- Como owner de tenant, quero que minha própria conta seja imune a remoção ou rebaixamento por um admin, para que eu nunca possa ficar bloqueado fora do meu próprio tenant.

**Admin do Tenant**
- Como admin de tenant, quero convidar e administrar membros da equipe da mesma forma que um owner pode, para que o crescimento da equipe não fique limitado a uma única pessoa.
- Como admin de tenant, quero ser incapaz de remover ou rebaixar o owner, para que o controle do owner sobre o tenant seja protegido.

**Gestor convidado ("Gestor")**
- Como gestor, quero criar, editar e excluir casos, clientes, contratos e negociações, para que eu possa operar integralmente o fluxo de cobrança pelo qual sou responsável.
- Como gestor, quero ser incapaz de administrar membros da equipe ou as configurações de provedores de IA por padrão, para que minha conta carregue apenas o acesso que eu realmente preciso.

**Operador convidado ("Operador")**
- Como operador, quero visualizar negociações e casos em andamento e enviar mensagens a devedores, para que eu possa cobrir as conversas no dia a dia.
- Como operador, quero ser incapaz de criar, editar ou excluir registros, para que um erro meu não possa corromper os dados do tenant.
- Como operador que recebeu a confiança da configuração de IA, quero configurar provedores de IA mesmo que meu papel normalmente não permita alterações de registros, para que o owner possa delegar essa única responsabilidade sem exceder meu acesso.

**Usuário convidado, estado pendente**
- Como usuário convidado, quero receber um convite por e-mail e definir minha própria senha, para que eu nunca precise receber uma senha de outra pessoa.
- Como usuário convidado que ainda não aceitou, quero que o owner/admin veja meu convite como pendente e possa reenviá-lo ou revogá-lo, para que convites antigos não deixem um risco silencioso de concessão de acesso.

## Funcionalidades Principais

### 1. Convite de membro da equipe
O owner/admin informa um e-mail e escolhe um papel; o sistema envia um convite por e-mail. A pessoa convidada define a própria senha no primeiro acesso. Os convites ficam em estado pendente até serem aceitos; o owner/admin pode reenviar ou revogar um convite pendente.

### 2. Papéis fixos com permissões predefinidas
Quatro papéis: `Owner`, `Admin`, `Gestor`, `Operador`.
- `Owner` e `Admin`: acesso total a tudo, incluindo gestão de equipe e configuração de IA. O `Owner` não pode ser removido ou rebaixado por ninguém, incluindo o `Admin`.
- `Gestor`: pode criar, editar e excluir registros de negócio do tenant (casos, clientes, contratos, negociações etc.). Não pode administrar membros da equipe nem a configuração de IA por padrão.
- `Operador`: pode visualizar/monitorar negociações e casos e enviar mensagens a devedores. Não pode criar, editar ou excluir registros.
- As permissões se aplicam globalmente por ação (criar/editar/excluir), não por módulo individual — uma única concessão de "pode editar" cobre todas as entidades de negócio de forma uniforme.

### 3. Acesso base mínimo para todo papel
Todo membro da equipe, independentemente do papel, pode visualizar negociações/casos em andamento e enviar mensagens a devedores. Isso não é configurável nem removível — é o mínimo necessário para que qualquer pessoa adicionada a um tenant seja útil.

### 4. Permissão independente de "configurar provedores de IA"
Um único interruptor (toggle), separado do papel base, que concede ou revoga a capacidade de configurar as configurações de provedores de IA (ver `docs/1804-config-provedores-modelos-tenant/`). `Owner` e `Admin` sempre o têm e ele não pode ser revogado deles. Pode ser ativado para um `Gestor` ou `Operador` que de outra forma não teria esse acesso, e desativado novamente a qualquer momento.

### 5. Tela de gestão de equipe
Uma lista de todos os membros da equipe do tenant, mostrando nome/e-mail, papel, permissão de configuração de IA e status do convite (pendente/ativo). A partir desta tela, o `owner`/`admin` pode convidar um novo membro, alterar o papel ou a permissão de configuração de IA de um membro existente, reenviar/revogar um convite pendente e remover um membro ativo.

## Experiência do Usuário

**Fluxo principal — convidar um membro da equipe**
1. O owner ou admin abre a aba "Equipe" em Configurações.
2. Clica em "Convidar membro", informa um e-mail, seleciona um papel entre as quatro opções fixas (com uma descrição curta do que cada papel pode fazer) e, opcionalmente, ativa "pode configurar provedores de IA".
3. O sistema envia o e-mail de convite e mostra o novo membro na lista com o status "Pendente".
4. A pessoa convidada abre o e-mail, define uma senha e entra no tenant com o papel atribuído já ativo.

**Fluxo principal — alterar acesso**
1. O owner ou admin abre a aba Equipe e encontra o membro na lista.
2. Altera o papel e/ou o interruptor de configuração de IA, ou o remove por completo.
3. A alteração tem efeito imediato; a próxima ação do membro no produto respeita as novas permissões.

**Casos de borda**
- Um admin tenta remover ou rebaixar o owner: a ação é bloqueada com uma explicação clara, não um no-op silencioso.
- Um convite é enviado para um e-mail que já é membro ativo do tenant: o sistema informa o convidante em vez de criar uma duplicata.
- Um convite pendente fica sem resposta: o owner/admin pode reenviá-lo ou revogá-lo a partir da mesma lista, sem precisar de um fluxo separado.
- As permissões de um membro mudam enquanto ele está usando ativamente o produto: a próxima ação dele reflete a nova permissão (ele não é desconectado implicitamente, mas ações bloqueadas mostram a mesma mensagem de "permissão insuficiente" que um novo usuário restrito veria).

**Descoberta**: a aba Equipe fica em Configurações, ao lado de Perfil, Modelos de IA e Configuração do Tenant — onde os controles administrativos do tenant já ficam, então os owners a encontram onde esperariam encontrar outras configurações da conta.

**Acessibilidade**: as descrições dos papéis devem ser em linguagem simples (não apenas os nomes dos papéis) diretamente na interface de convite/edição, para que um owner nunca precise adivinhar o que "Gestor" ou "Operador" realmente concede — abordando o modo de falha comum em que papéis com nomes semelhantes são indistinguíveis para a pessoa que concede o acesso.

## Restrições Técnicas de Alto Nível

- Deve integrar-se ao modelo de tenant/membros existente (tenants aos quais um usuário pode pertencer) em vez de introduzir um sistema de identidade paralelo.
- A entrega de convites exige e-mail transacional disponível; se o ambiente não tiver um provedor de e-mail configurado, o fluxo de convite deve falhar com uma mensagem clara em vez de um no-op silencioso.
- Todas as ações de gestão de equipe devem estar restritas ao tenant do usuário que está agindo — nenhuma ação pode afetar a associação de outro tenant.
- Remover ou rebaixar o acesso de um usuário deve ter efeito na próxima requisição dele, não no próximo login.
- Toda ação de gestão de equipe (convite, mudança de papel, mudança de permissão de IA, remoção) deve ser atribuível ao usuário que agiu para fins de auditoria.

## Não-Objetivos (Fora de Escopo)

- Granularidade de permissão por módulo ou por entidade (por exemplo, "pode editar contratos, mas não clientes"). As permissões nesta fase são globais por ação apenas.
- Papéis personalizados definidos pelo tenant ou um construtor de catálogo de permissões (ver ADR-001, Alternativa 2) — adiado para uma possível fase futura.
- Criação de usuário por senha direta pelo owner/admin (nenhuma senha é definida ou vista pelo convidante) — o convite é apenas por e-mail.
- Limites de assentos, cobrança por usuário ou qualquer precificação ligada ao tamanho da equipe.
- Single Sign-On (SSO), provisionamento SCIM ou entrada automática por domínio de e-mail.
- Papéis entre tenants ou um usuário pertencente a mais de um tenant simultaneamente.
- Interface de log de atividades/auditoria para ações de gestão de equipe (as ações devem ser registradas para auditoria conforme as restrições técnicas acima, mas construir uma tela dedicada de visualização de auditoria está fora do escopo desta funcionalidade).

## Plano de Lançamento em Fases

### MVP (Fase 1)
- Fluxo de convite por e-mail com os quatro papéis fixos e o interruptor independente de configuração de IA.
- Tela de gestão de equipe (listar, convidar, editar papel/permissão, reenviar/revogar convite, remover membro).
- Acesso base (visualizar negociações/casos, enviar mensagens) aplicado para todos os papéis.
- Aplicação (enforcement) conectada à tela/endpoints de configuração de provedores de IA e às ações de criar/editar/excluir nas entidades de negócio existentes.
- Critérios de sucesso para avançar: um owner consegue convidar um gestor e um operador, cada um vê apenas o que o papel dele permite, e o acesso à configuração de IA pode ser delegado independentemente do papel.

### Fase 2 (futura, não comprometida)
- Granularidade de permissão por módulo, se o uso mostrar que o modelo global é grosso demais.
- Papéis personalizados definidos pelo tenant (ADR-001, Alternativa 2).

## Métricas de Sucesso

- Percentual de tenants ativos com mais de um membro de equipe (adoção da capacidade multiusuário).
- Tempo de "convite enviado" até "convite aceito" (fricção do fluxo de convite).
- Número de chamados de suporte relacionados à configuração manual de usuário/tenant, com expectativa de cair para perto de zero após o lançamento.
- Zero incidentes de um usuário com papel restrito executando uma ação fora das permissões concedidas a ele (correção da aplicação).

## Riscos e Mitigações

- **Risco de adoção**: os owners podem não descobrir a aba Equipe se não olharem em Configurações. Mitigação: o ponto de entrada em Configurações é consistente com onde as outras configurações do tenant já ficam (configuração de IA, configurações do tenant), que os owners já visitam.
- **Risco de concessão excessiva**: os owners podem definir todo convite como `Admin` para evitar pensar em papéis, anulando o propósito do acesso granular. Mitigação: descrições dos papéis mostradas inline no momento do convite, com `Operador`/`Gestor` apresentados como o padrão esperado para membros da equipe não administrativos.
- **Risco de confiança por fronteiras de permissão pouco claras**: se um membro da equipe for surpreendido por uma ação bloqueada, ele pode perceber o produto como quebrado em vez de corretamente restrito. Mitigação: ações bloqueadas devem mostrar uma mensagem clara e específica sobre qual permissão falta, não um erro genérico.
- **Risco de dependência**: o fluxo de convite depende de e-mail transacional configurado de forma confiável; se a entrega de e-mail for instável, os usuários convidados ficam presos em "pendente" indefinidamente. Mitigação: convites pendentes podem ser reenviados/revogados a partir da mesma tela, dando ao owner/admin um caminho manual de recuperação.

## Registros de Decisões de Arquitetura

- [ADR-001: Papéis fixos de equipe com um interruptor independente de permissão de configuração de IA](adrs/adr-001.md) — Adiciona os papéis `Gestor` e `Operador` ao lado dos `owner`/`admin` existentes, com um interruptor de override separado para a configuração de provedores de IA, em vez de permissões por módulo ou um construtor completo de papéis personalizados.

## Perguntas em Aberto

- Texto/redação exata das quatro descrições de papel mostradas na interface de convite — a ser finalizada durante o design, não bloqueante para a TechSpec.
- Se as ações históricas de um membro removido da equipe (mensagens enviadas, negociações tocadas) devem permanecer atribuídas a ele após a remoção, ou ser anonimizadas — recomenda-se manter a atribuição completa para continuidade da auditoria, mas sinalizando para confirmação explícita durante a TechSpec.
- Número máximo de membros de equipe por tenant, se houver — nenhum limite assumido para o MVP; sinalizar se um futuro modelo de cobrança exigir um.