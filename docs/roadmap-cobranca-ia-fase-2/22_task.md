---
status: pending
title: Storage de PDFs de contrato (Supabase Storage)
type: backend
complexity: medium
dependencies: []
---

# Storage de PDFs de contrato (Supabase Storage)

## Visão Geral

`contract_documents.storage_path` é modelado mas `extract-contract` só lê o arquivo in-memory; nada persiste o PDF original. Implementar upload para Supabase Storage e referência em `contract_documents`, permitindo re-download e auditoria do documento original.

<critical>
- Leia o PRD e a TechSpec antes de implementar.
- Referencie as seções relevantes da TechSpec.
- Bucket DEVE ter RLS (acesso apenas ao tenant do contrato).
- Tamanho máximo de upload configurável (default 10MB).
- Tipos permitidos: PDF, JPEG, PNG, GIF, WEBP.
- Execute `npm run lint && npm run build`.
</critical>

<requirements>
1. Criar bucket `contract-documents` no Supabase Storage com RLS.
2. `POST /api/contracts/[id]/documents` faz upload e cria registro em `contract_documents`.
3. `GET /api/contracts/[id]/documents` lista documentos com URL assinada (expira em 1h).
4. `extract-contract` salva o PDF original no bucket após extração.
5. UI no detalhe do contrato: lista de documentos + download.
6. Respeita isolamento por tenant via RLS do bucket.
</requirements>

## Subtarefas

- [ ] Criar bucket `contract-documents` + RLS (migration ou SQL).
- [ ] Criar `app/api/contracts/[id]/documents/route.ts` (GET, POST).
- [ ] Modificar `app/api/extract-contract/route.ts` para salvar PDF.
- [ ] UI no detalhe do contrato: lista + download.
- [ ] Validação de tipo e tamanho.

## Detalhes de Implementação

### Arquivos a Criar

- `app/api/contracts/[id]/documents/route.ts`
- Migration SQL (bucket + RLS).

### Arquivos a Modificar

- `app/api/extract-contract/route.ts` — salvar PDF.
- `app/contracts/[id]/page.tsx` — UI de documentos.
- `lib/types.ts` — tipo `ContractDocument`.

### Arquivos Relevantes

- `supabase_tenant_model.sql` — schema `contract_documents`.
- `lib/supabase-admin.ts` — service role para upload.

## Testes

### Testes de Integração

- [ ] Upload de PDF cria registro e arquivo no bucket.
- [ ] Download via URL assinada funciona.
- [ ] Tenant A não acessa documento do tenant B.
- [ ] Upload de tipo não permitido é rejeitado.

## Critérios de Sucesso

- [ ] PDFs persistidos e re-downloadáveis.
- [ ] RLS do bucket funcional.
- [ ] `npm run lint && npm run build` sem erros.