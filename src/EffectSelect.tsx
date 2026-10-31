import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, Sparkles } from 'lucide-react';
import { effectDescriptions } from './effects';

export function EffectSelect({ names, value, onChange }: { names: string[]; value: number; onChange: (value: number) => void }) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(value);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const outside = (e: PointerEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [open]);
  useEffect(() => { if (open) root.current?.querySelector(`#effect-option-${active}`)?.scrollIntoView({ block: 'nearest' }); }, [active, open]);
  function choose(index: number) { onChange(index); setOpen(false); trigger.current?.focus(); }
  return <div className="effect-select" ref={root} onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setOpen(false); }}>
    <button ref={trigger} className="effect-select-trigger" aria-label="Explore all effects" aria-haspopup="listbox" aria-expanded={open} aria-controls="effect-options" onClick={() => { setActive(value); setOpen(!open); }} onKeyDown={e => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); setOpen(true); setActive(a => Math.max(0, Math.min(names.length - 1, open ? a + (e.key === 'ArrowDown' ? 1 : -1) : value))); }
      if (e.key === 'Escape') { e.preventDefault(); setOpen(false); }
      if (open && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); choose(active); }
      if (open && e.key === 'Home') { e.preventDefault(); setActive(0); }
      if (open && e.key === 'End') { e.preventDefault(); setActive(names.length - 1); }
    }} aria-activedescendant={open ? `effect-option-${active}` : undefined}>
      <span className="effect-select-icon"><Sparkles size={18}/></span><span className="effect-select-copy"><b>{names[value]}</b><small>{effectDescriptions[value]}</small></span><ChevronDown size={16} className={open ? 'rotated' : ''}/>
    </button>
    {open && <div className="effect-select-menu"><div className="effect-menu-heading"><span>FIND YOUR ATMOSPHERE</span><small>20 effects</small></div><div id="effect-options" role="listbox" aria-label="Lighting effects" className="effect-options">{names.map((name, index) => <div key={name} id={`effect-option-${index}`} role="option" aria-selected={value === index} className={`effect-option ${value === index ? 'is-selected' : ''} ${active === index ? 'is-active' : ''}`} onPointerMove={() => setActive(index)} onMouseDown={e => e.preventDefault()} onClick={() => choose(index)}><span className="effect-number">{String(index + 1).padStart(2, '0')}</span><span><b>{name}</b><small>{effectDescriptions[index]}</small></span>{value === index && <Check size={16}/>}</div>)}</div></div>}
  </div>;
}
