// Mirror client-safe de tipos/constantes de papéis de equipe (ticket 1805).
//
// `import type` para TenantRole: puramente apagado em tempo de compilação —
// não cria uma aresta de bundling em runtime para hooks/useAuth.ts. NÃO
// importe TenantRole de `lib/api-auth.ts` / `lib/team-invite.ts` aqui: esses
// módulos puxam código server-only e não podem ser bundlados no client.
import type { TenantRole } from '@/hooks/useAuth';

export type { TenantRole };

export type InvitableRole = 'admin' | 'gestor' | 'operador';

export interface TeamMember {
  id: string;
  userId: string;
  email: string | null;
  name: string | null;
  role: TenantRole;
  canConfigureAI: boolean;
  status: 'active' | 'pending';
  createdAt: string;
}

export const INVITABLE_ROLES: InvitableRole[] = ['admin', 'gestor', 'operador'];

export const ROLE_LABELS: Record<TenantRole, string> = {
  owner: 'Owner',
  admin: 'Admin',
  gestor: 'Gestor',
  operador: 'Operador',
};

// Descrições em linguagem simples — exibidas inline no convite e na edição
// (ver ADR-001 e PRD "Acessibilidade": evitar papéis com nomes parecidos e
// indistinguíveis para quem concede o acesso).
export const ROLE_DESCRIPTIONS: Record<TenantRole, string> = {
  owner: 'Acesso total ao tenant, incluindo gestão de equipe e configuração de IA. Não pode ser removido nem rebaixado.',
  admin: 'Acesso total: gerencia a equipe, a configuração de provedores de IA e todos os registros de negócio.',
  gestor: 'Cria, edita e exclui casos, clientes, contratos e negociações. Não administra a equipe nem a configuração de IA por padrão.',
  operador: 'Visualiza negociações/casos em andamento e envia mensagens a devedores. Não pode criar, editar ou excluir registros.',
};
