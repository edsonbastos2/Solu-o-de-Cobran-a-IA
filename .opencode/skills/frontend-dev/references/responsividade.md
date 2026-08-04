# Responsiveness Reference — Next.js / React / Tailwind CSS

## Tailwind Breakpoints

| Prefix | Min Width | Typical Device |
|---|---|---|
| _(none)_ | 0px | Mobile (base) |
| `sm:` | 640px | Large mobile / landscape |
| `md:` | 768px | Tablet |
| `lg:` | 1024px | Small desktop |
| `xl:` | 1280px | Desktop |
| `2xl:` | 1536px | Large desktop |

**Golden rule:** Write styles without a prefix for mobile. Add `md:` and `lg:` to expand the layout for larger screens.

## Form Grid

Project pattern: `grid grid-cols-12` with responsive `col-span-*`.

```tsx
<div className="grid grid-cols-12 gap-4">
  <div className="flex flex-col col-span-12 md:col-span-6 lg:col-span-4">
    <label className="text-sm text-slate-400 mb-1">Descrição</label>
    <input className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white" />
  </div>
  <div className="flex flex-col col-span-12 md:col-span-4 lg:col-span-3">
    <label className="text-sm text-slate-400 mb-1">Tipo</label>
    <select className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white" />
  </div>
  <div className="flex flex-col col-span-6 md:col-span-3 lg:col-span-2">
    <label className="text-sm text-slate-400 mb-1">Código</label>
    <input className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white" />
  </div>
</div>
```

### col-span Map by Field Type

| Field Type | Mobile | Tablet | Desktop |
|---|---|---|---|
| Long text / description | `col-span-12` | `md:col-span-6` | `lg:col-span-4` |
| Select / dropdown | `col-span-12` | `md:col-span-4` | `lg:col-span-3` |
| Date / period | `col-span-12` | `md:col-span-3` | `lg:col-span-3` |
| Short code / number | `col-span-6` | `md:col-span-3` | `lg:col-span-2` |
| Checkbox / toggle | `col-span-6` | `md:col-span-2` | `lg:col-span-2` |

## Section Headers

```tsx
<div className="flex flex-row flex-wrap justify-between items-center mb-4">
  <h2 className="text-lg font-bold text-white">Título</h2>
  <button className="rounded-lg border border-white/10 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-white/5">
    Adicionar
  </button>
</div>
```

## Responsive Tables

**Required:** container with `overflow-x-auto` for horizontal scroll on mobile. Table must have `min-w-[Npx]`.

```tsx
<div className="overflow-x-auto rounded-lg border border-white/10">
  <table className="w-full min-w-[600px]">
    <thead>
      <tr className="border-b border-white/10 bg-white/5">
        <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Nome</th>
        <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase hidden md:table-cell">Email</th>
        <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase hidden lg:table-cell">Empresa</th>
        <th className="px-4 py-3 text-right text-xs font-medium text-slate-400 uppercase w-24">Ações</th>
      </tr>
    </thead>
  </table>
</div>
```

### Column Strategy

| Priority | Strategy | Example |
|---|---|---|
| Essential | Always visible | Name, Actions (`w-24`) |
| Secondary | Hidden on mobile | `hidden md:table-cell` |
| Tertiary | Hidden on tablet | `hidden lg:table-cell` |

## Modals

Project uses `useState` + conditional render. Always responsive `max-w-*` and `w-full`:

```tsx
{isOpen && (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
    <div className="bg-[#111318] border border-white/10 rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
      <div className="flex items-center justify-between p-4 border-b border-white/10">
        <h2 className="text-lg font-bold text-white">Título</h2>
        <button onClick={onClose} className="p-1 text-slate-400 hover:text-white">
          <X className="w-5 h-5" />
        </button>
      </div>
      <div className="p-4">{children}</div>
      <div className="flex justify-end gap-2 p-4 border-t border-white/10">
        <button onClick={onClose} className="rounded-lg border border-white/10 px-4 py-2 text-sm">Cancelar</button>
        <button className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-black">Salvar</button>
      </div>
    </div>
  </div>
)}
```

## Directional Flex Layouts

```tsx
<div className="flex flex-col md:flex-row gap-4">
  <div className="w-full md:w-1/2">Col A</div>
  <div className="w-full md:w-1/2">Col B</div>
</div>
```

## Visibility Control

```tsx
<div className="hidden md:block">Desktop only</div>
<div className="md:hidden">Mobile only</div>
<div className="hidden lg:flex">Desktop+ only</div>
```

## Anti-patterns

- ❌ `w-[350px]` — fixed width breaks responsiveness → ✅ `w-full max-w-md`
- ❌ `overflow-hidden` truncating content on mobile → ✅ `overflow-x-auto`
- ❌ `text-xs` for all text on mobile → ✅ responsive typography
- ❌ `break-all` or `break-words` without consideration → ✅ `truncate` or `line-clamp-*`

## Responsiveness Checklist

- [ ] Mobile-first: base classes for mobile, `md:`/`lg:` for larger
- [ ] Tables have `overflow-x-auto` wrapper and `min-w-[Npx]`
- [ ] Modals use `w-full max-w-*` (never fixed px width)
- [ ] Flex layouts stack on mobile: `flex-col md:flex-row`
- [ ] Grid adapts: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`
- [ ] Touch targets >= 44px on mobile: `min-h-[44px] min-w-[44px]`
- [ ] No horizontal scroll on mobile except in tables
- [ ] Typography scales responsively: `text-sm md:text-base`
