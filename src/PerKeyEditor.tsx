import { useEffect, useRef, useState } from 'react';
import { Check, MousePointer2, Paintbrush, RotateCcw } from 'lucide-react';
import layout from './key-layout.json';
import './per-key.css';

export type KeyColors = Record<string, string>;
export const keyLayout = layout;
export function loadKeyColors(baseColor: string): KeyColors {
  let saved: KeyColors = {};
  try { saved = JSON.parse(localStorage.getItem('aula.perkey.v1') || '{}') || {}; } catch { /* use initial canvas */ }
  return Object.fromEntries(layout.map(k => [k.index, typeof saved[k.index] === 'string' && /^[0-9A-Fa-f]{6}$/.test(saved[k.index]) ? saved[k.index] : baseColor]));
}
const groups = [
  { name: 'All keys', test: () => true },
  { name: 'WASD', test: (k: typeof layout[number]) => [26, 4, 22, 7].includes(k.code) },
  { name: 'Arrows', test: (k: typeof layout[number]) => k.code >= 79 && k.code <= 82 },
  { name: 'Function', test: (k: typeof layout[number]) => k.code >= 58 && k.code <= 69 },
  { name: 'Numbers', test: (k: typeof layout[number]) => k.code >= 30 && k.code <= 39 },
  { name: 'Letters', test: (k: typeof layout[number]) => k.code >= 4 && k.code <= 29 },
  { name: 'Modifiers', test: (k: typeof layout[number]) => k.code >= 224 || k.name === 'Fn' },
];
function label(name: string) {
  const labels: Record<string, string> = { Backspace: '⌫', CapsLock: 'caps', Shift_L: 'shift', Shift_R: 'shift', Ctrl_L: 'ctrl', Win_L: 'win', Alt_L: 'alt', Alt_R: 'alt', Space: 'space', 'page up': 'pgup', 'page down': 'pgdn', delete: 'del', '}}': ']' };
  return labels[name] || name.toLowerCase();
}
export function PerKeyEditor({ colors, color, onChange }: { colors: KeyColors; color: string; onChange: (colors: KeyColors) => void }) {
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [previous, setPrevious] = useState<KeyColors | null>(null);
  const lastColor = useRef(color);
  useEffect(() => {
    if (color === lastColor.current) return;
    lastColor.current = color;
    if (!selected.size) return;
    setPrevious({ ...colors });
    const next = { ...colors };
    selected.forEach(index => { next[index] = color; });
    onChange(next);
  }, [color, colors, selected, onChange]);
  const [rectangle, setRectangle] = useState<{left:number;top:number;width:number;height:number}|null>(null);
  const gesture = useRef<{x:number;y:number;additive:boolean;before:Set<number>;dragged:boolean;key:number|null}|null>(null);
  function dragStart(e: React.PointerEvent<HTMLDivElement>) {
    if (e.button !== 0) return;
    const bounds=e.currentTarget.getBoundingClientRect();
    const button=(e.target as HTMLElement).closest<HTMLButtonElement>('[data-key-index]');
    gesture.current={x:e.clientX-bounds.left,y:e.clientY-bounds.top,additive:e.shiftKey||e.ctrlKey||e.metaKey,before:new Set(selected),dragged:false,key:button ? Number(button.dataset.keyIndex) : null};
    e.currentTarget.setPointerCapture(e.pointerId);
    e.preventDefault();
  }
  function dragMove(e: React.PointerEvent<HTMLDivElement>) {
    const start=gesture.current;if(!start)return;
    const b=e.currentTarget.getBoundingClientRect();
    const x=Math.max(0,Math.min(b.width,e.clientX-b.left));
    const y=Math.max(0,Math.min(b.height,e.clientY-b.top));
    if(!start.dragged && Math.hypot(x-start.x,y-start.y)<4)return;
    start.dragged=true;
    const left=Math.min(x,start.x),top=Math.min(y,start.y),right=Math.max(x,start.x),bottom=Math.max(y,start.y);
    setRectangle({left:left/b.width*100,top:top/b.height*100,width:(right-left)/b.width*100,height:(bottom-top)/b.height*100});
    const next=start.additive ? new Set(start.before) : new Set<number>();
    layout.forEach(k=>{const kx=(k.x-90)/617*b.width,ky=(k.y-28)/239*b.height;if(kx<=right && kx+k.width/617*b.width>=left && ky<=bottom && ky+k.height/239*b.height>=top)next.add(k.index);});
    setSelected(next);
  }
  function dragEnd(e: React.PointerEvent<HTMLDivElement>) {
    const start=gesture.current;if(!start)return;
    if(!start.dragged && start.key!==null){const next=new Set(start.before);if(next.has(start.key))next.delete(start.key);else next.add(start.key);setSelected(next);}
    gesture.current=null;setRectangle(null);
    if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);
  }
  function paint(value: string) {
    setPrevious({ ...colors });
    const next = { ...colors };
    selected.forEach(index => { next[index] = value; });
    onChange(next);
  }
  return <section className="per-key-editor">
    <div className="section-title"><h2><MousePointer2 size={17}/> Your custom canvas</h2><span>{selected.size} selected / {layout.length} keys</span></div>
    <p className="key-editor-hint">Drag a box to select keys. Shift-drag adds to your selection. Click a key to toggle it.</p>
    <div className="per-key-board" aria-label="Select keyboard keys" onPointerDown={dragStart} onPointerMove={dragMove} onPointerUp={dragEnd} onPointerCancel={()=>{if(gesture.current)setSelected(gesture.current.before);gesture.current=null;setRectangle(null);}}>
      {layout.map(key => <button key={key.index} data-key-index={key.index} className={`editable-key ${selected.has(key.index) ? 'key-selected' : ''}`} style={{ left: `${(key.x - 90) / 617 * 100}%`, top: `${(key.y - 28) / 239 * 100}%`, width: `${key.width / 617 * 100}%`, height: `${key.height / 239 * 100}%`, '--individual-color': `#${colors[key.index]}` } as React.CSSProperties} aria-label={`${key.name}, color ${colors[key.index]}`} aria-pressed={selected.has(key.index)} title={`${key.name} · #${colors[key.index]}`} onClick={event => { if(event.detail!==0)return;setSelected(old => { const next = new Set(old); if (next.has(key.index)) next.delete(key.index); else next.add(key.index); return next; }); }}><span>{label(key.name)}</span><i/>{selected.has(key.index) && <Check size={9}/>}</button>)}
      <div className="canvas-badge">F75 <span>MAX</span></div>
      {rectangle && <div className="key-selection-box" style={{left:`${rectangle.left}%`,top:`${rectangle.top}%`,width:`${rectangle.width}%`,height:`${rectangle.height}%`}}/>}
    </div>
    <div className="key-groups" aria-label="Key group shortcuts">{groups.map(group => <button key={group.name} onClick={() => setSelected(new Set(layout.filter(group.test).map(k => k.index)))}>{group.name}</button>)}<button className="clear-key-selection" disabled={!selected.size} onClick={() => setSelected(new Set())}>Deselect</button></div>
    <div className="paint-actions"><button className="paint-selected" disabled={!selected.size} onClick={() => paint(color)}><Paintbrush size={15}/><span className="paint-chip" style={{ background: `#${color}` }}/>{selected.size ? `Color ${selected.size} selected ${selected.size === 1 ? 'key' : 'keys'}` : 'Select keys to color'}</button><button disabled={!selected.size} onClick={() => paint('000000')}>Turn off</button><button disabled={!previous} aria-label="Undo last key color edit" onClick={() => { if (previous) { onChange(previous); setPrevious(null); } }}><RotateCcw size={14}/> Undo</button></div>
    <p className="custom-mode-note">Select keys, then change the color on the right to paint them. Apply lighting sends the layout to your keyboard. Custom lighting replaces the current effect.</p>
    <details className="per-key-experimental"><summary>2.4 GHz custom lighting · capture-based protocol</summary><p>The official capture's WASD-green sequence has been physically confirmed. This editor uses the same key map and packet format. Saved colors are local; existing device colors cannot be read. If a key differs on your batch, report which key lit up. Switch back to Effects and Apply to restore a built-in effect.</p></details>
  </section>;
}
