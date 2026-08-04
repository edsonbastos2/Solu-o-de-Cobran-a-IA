# Bloco MODAL criar/editar — opcional

Modal de criação/edição usado pela tabela. Recebe o `{{entidade}}Id` opcional;
decide entre criar/editar por presença do id; valida, chama a API e emite `onClose`.

> Autocontido — copie daqui, não de modais do projeto.

## Componente

```tsx
'use client';

import { useState, useEffect } from 'react';
import useSWR from 'swr';
import { fetcher, fetchWithAuth } from '@/lib/api';
import { {{Tipo}} } from '@/lib/types';
import { X } from 'lucide-react';

interface Modal{{Entidade}}Props {
  {{entidade}}Id?: string;
  onClose: () => void;
}

const emptyForm = (): Partial<{{Tipo}}> => ({
  // Um campo por propriedade editável com valor default
  {{field}}: ''
});

export function Modal{{Entidade}}({ {{entidade}}Id, onClose }: Modal{{Entidade}}Props) {
  const isEdit = Boolean({{entidade}}Id);

  // Carregar dados existentes se editando
  const { data: existingData } = useSWR<{{Tipo}}>(
    {{entidade}}Id ? `{{endpoint}}/${ {{entidade}}Id }` : null,
    fetcher
  );

  const [formData, setFormData] = useState<Partial<{{Tipo}}>>(emptyForm());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (existingData) {
      setFormData(existingData);
    } else if (!isEdit) {
      setFormData(emptyForm());
    }
  }, [existingData, isEdit]);

  const isValid = (): boolean => {
    // Validar campos obrigatórios
    return Boolean(formData.{{field}});
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid()) {
      setError('Todos os campos obrigatórios devem ser preenchidos.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const res = await fetchWithAuth(
        isEdit ? `{{endpoint}}/${ {{entidade}}Id }` : '{{endpoint}}',
        {
          method: isEdit ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData)
        }
      );
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Erro ao salvar');
      onClose();
    } catch (err: any) {
      setError(err.message || 'Erro ao salvar');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setFormData(emptyForm());
    setError('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-[#111318] border border-white/10 rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <h2 className="text-lg font-bold text-white">
            {isEdit ? 'Editar {{Titulo}}' : 'Adicionar {{Titulo}}'}
          </h2>
          <button
            onClick={handleClose}
            className="p-1 text-slate-400 hover:text-white transition-colors rounded-lg hover:bg-white/5"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Um campo por propriedade editável */}
          <div className="flex flex-col">
            <label htmlFor="{{field}}" className="text-sm text-slate-400 mb-1">
              {{HeaderCampo}}
              <span className="text-red-400 ml-0.5">*</span>
            </label>
            <input
              id="{{field}}"
              type="text"
              value={formData.{{field}} || ''}
              onChange={(e) => setFormData(f => ({ ...f, {{field}}: e.target.value }))}
              disabled={submitting}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 disabled:opacity-50"
            />
          </div>

          {error && (
            <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
              {error}
            </div>
          )}

          {/* Footer */}
          <div className="flex justify-end gap-2 pt-4 border-t border-white/10">
            <button
              type="button"
              onClick={handleClose}
              disabled={submitting}
              className="rounded-lg border border-white/10 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-white/5 transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-black hover:bg-emerald-400 transition-colors disabled:opacity-50"
            >
              {submitting ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
```

## Notas

- O componente controla seu próprio estado de formulário (`useState`)
- `useSWR` com key `null` quando `{{entidade}}Id` é undefined evita fetch desnecessário ao criar
- Formulário usa `<input>` nativo com classes Tailwind (padrão do projeto)
- Validação simples no frontend (campos obrigatórios). A API route também valida com `validateFields`
- Inputs variam por tipo: `type="text"` → texto, `type="number"` → número, `<select>` → dropdown,
  `type="date"` → data
- Modal usa fundo escuro `bg-[#111318]`, overlay `bg-black/60`, bordas `border-white/10`
- Fecha ao clicar no X ou no botão Cancelar (não fecha no overlay click — seguro para formulários com dados preenchidos)
- A tabela integra assim (ver `table-base.md`):
  ```tsx
  const [editingId, setEditingId] = useState<string | undefined>();
  const [isModalOpen, setIsModalOpen] = useState(false);

  {isModalOpen && (
    <Modal{{Entidade}} {{entidade}}Id={editingId} onClose={handleModalClose} />
  )}
  ```
