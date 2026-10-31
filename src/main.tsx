import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { invoke, isTauri } from '@tauri-apps/api/core';
import { Activity, ArrowDownRight, ArrowRight, Battery, Check, ChevronDown, ChevronRight, CircleHelp, Command, Keyboard, Lightbulb, LoaderCircle, Palette, Radio, RefreshCw, Save, SlidersHorizontal, Sparkles, Sun, Waves, X, Zap } from 'lucide-react';
import './style.css';
import './refinements.css';
import './pastel.css';
import { EffectSelect } from './EffectSelect';
import { PerKeyEditor, loadKeyColors, keyLayout, type KeyColors } from './PerKeyEditor';
import { Moon, SunMoon } from 'lucide-react';
import { DisplayPanel } from './DisplayPanel';
import { SleepPanel, type SleepSettings } from './SleepPanel';
import './responsive.css';
import './atmosphere.css';

type Receiver = { id: string; name: string; interface: number; usage: number };
type Settings = { mode: number; color: string; brightness: number; speed: number; colorful: boolean; direction: number };
const modes = ['Off', 'Static', 'Single on', 'Single off', 'Glitter', 'Falling', 'Colorful', 'Breathing', 'Spectrum', 'Outward', 'Scrolling', 'Rolling', 'Rotating', 'Explode', 'Launch', 'Ripple', 'Flowing', 'Pulsating', 'Tilt', 'Shuttle'];
const featured = [{ id: 1, name: 'Static', sub: 'One color. All you.', icon: Sun }, { id: 7, name: 'Breathing', sub: 'A moment of calm.', icon: Waves }, { id: 8, name: 'Spectrum', sub: 'Every shade in motion.', icon: Sparkles }, { id: 15, name: 'Ripple', sub: 'Make some waves.', icon: Activity }, { id: 16, name: 'Flowing', sub: 'Go with the flow.', icon: ArrowDownRight }, { id: 0, name: 'Lights off', sub: 'Keep it understated.', icon: Lightbulb }];
const swatches = ['F36B43', 'F2B64D', 'A8C692', '76BFC0', '9CA8ED', 'D99CB9', 'EDEAE4'];
const defaults: Settings = { mode: 1, color: 'F36B43', brightness: 4, speed: 3, colorful: false, direction: 0 };

function loadSettings(): Settings {
  try {
    const s = JSON.parse(localStorage.getItem('aula.settings.v2') || 'null');
    if (s && Number.isInteger(s.mode) && s.mode >= 0 && s.mode <= 19 && /^[0-9A-Fa-f]{6}$/.test(s.color) && [s.brightness, s.speed].every(n => Number.isInteger(n) && n >= 1 && n <= 5) && typeof s.colorful === 'boolean' && Number.isInteger(s.direction) && s.direction >= 0 && s.direction <= 3) return s;
  } catch { /* Storage is optional. */ }
  return defaults;
}
function hsvToHex(h: number, s: number, v: number) {
  const f = (n: number) => { const k = (n + h / 60) % 6; return Math.round((v - v * s * Math.max(0, Math.min(k, 4 - k, 1))) * 255).toString(16).padStart(2, '0'); };
  return (f(5) + f(3) + f(1)).toUpperCase();
}
function hexToHsv(hex: string): [number, number, number] {
  const [r, g, b] = [0, 2, 4].map(i => parseInt(hex.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  let h = d === 0 ? 0 : max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h = (h * 60 + 360) % 360;
  return [h, max === 0 ? 0 : d / max, max];
}

function ColorPicker({ color, onChange }: { color: string; onChange: (hex: string) => void }) {
  const [palette, setPalette] = useState<string[]>(() => {
    try { const saved=JSON.parse(localStorage.getItem('aula.palette.v1') || 'null'); if(Array.isArray(saved) && saved.length===7 && saved.every(c=>typeof c==='string' && /^[0-9a-f]{6}$/i.test(c)))return saved; } catch {}
    return swatches;
  });
  const [savingPreset, setSavingPreset] = useState(false);
  useEffect(()=>{try{localStorage.setItem('aula.palette.v1',JSON.stringify(palette));}catch{}},[palette]);
  const [hsv, setHsv] = useState<[number, number, number]>(hexToHsv(color));
  const [hex, setHex] = useState(color);
  const emitted = useRef(color);
  useEffect(() => {
    setHex(color);
    if (color !== emitted.current) setHsv(hexToHsv(color));
  }, [color]);
  function change(next: [number, number, number]) {
    setHsv(next);
    const hex = hsvToHex(...next);
    emitted.current = hex;
    onChange(hex);
  }
  function pointer(e: React.PointerEvent<HTMLDivElement>) {
    if (e.type === 'pointermove' && !e.currentTarget.hasPointerCapture(e.pointerId)) return;
    if (e.type === 'pointerdown') e.currentTarget.setPointerCapture(e.pointerId);
    const r = e.currentTarget.getBoundingClientRect();
    change([hsv[0], Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)), 1 - Math.max(0, Math.min(1, (e.clientY - r.top) / r.height))]);
  }
  return <div className="color-picker">
    <div className="sv-square" style={{ backgroundColor: `hsl(${hsv[0]},100%,50%)` }} onPointerDown={pointer} onPointerMove={pointer} role="group" aria-label="Saturation and brightness color area">
      <span className="color-cursor" style={{ left: `${hsv[1] * 100}%`, top: `${(1 - hsv[2]) * 100}%`, backgroundColor: `#${color}` }} />
    </div>
    <input className="hue-slider" aria-label="Color hue" type="range" min="0" max="359" value={Math.round(hsv[0])} onChange={e => change([+e.target.value, hsv[1], hsv[2]])} />
    <div className="hex-row">
      <label className="native-color" title="Open system color picker" style={{ backgroundColor: `#${color}` }}><input aria-label="Open system color picker" type="color" value={`#${color}`} onChange={e => onChange(e.target.value.slice(1).toUpperCase())} /></label>
      <label className="hex-input"><span>#</span><input aria-label="Hex color" maxLength={6} value={hex} spellCheck={false} onBlur={() => setHex(color)} onChange={e => { const value = e.target.value.replace(/[^0-9a-f]/gi, '').toUpperCase(); setHex(value); if (value.length === 6) onChange(value); }} /><span>HEX</span></label>
    </div>
    <div className="palette-heading"><span>Your palette</span><button className={savingPreset ? 'saving-preset' : ''} onClick={()=>setSavingPreset(!savingPreset)} aria-pressed={savingPreset}><Save size={12}/>{savingPreset ? 'Cancel' : 'Save color'}</button></div>
    <div className={`swatches ${savingPreset ? 'choose-preset-slot' : ''}`}>{palette.map((c,index) => <button key={index} aria-label={savingPreset ? `Save color ${color} to preset ${index+1}` : `Preset ${index+1}, color ${c}`} title={savingPreset ? `Save #${color} here` : `Preset ${index+1}: #${c}`} style={{ backgroundColor: `#${c}` }} onClick={() => {if(savingPreset){setPalette(old=>old.map((value,i)=>i===index ? color : value));setSavingPreset(false);}else onChange(c);}} className={color === c ? 'chosen' : ''}>{savingPreset ? <span className="preset-number">{index+1}</span> : color === c && <Check size={12} />}</button>)}</div>
    <p className="palette-hint" aria-live="polite">{savingPreset ? `Choose a slot to save #${color}.` : 'Seven colors, saved on this computer.'}</p>
  </div>;
}

const rows: Array<Array<string | [string, number]>> = [
  ['esc', 'F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12', 'del'],
  ['~', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '−', '=', ['⌫', 1.65]],
  [['tab', 1.3], 'Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P', '[', ']', ['\\', 1.35]],
  [['caps', 1.65], 'A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', ';', "'", ['enter', 2]],
  [['shift', 2], 'Z', 'X', 'C', 'V', 'B', 'N', 'M', ',', '.', '/', ['shift', 1.65], '↑'],
  [['ctrl', 1.2], ['⊞', 1.2], ['alt', 1.2], [' ', 6.3], 'alt', 'fn', '←', '↓', '→'],
];
function KeyboardPreview({ settings }: { settings: Settings }) {
  return <div className={`keyboard-render ${settings.mode === 0 ? 'unlit' : ''} ${settings.colorful || settings.mode === 8 ? 'rainbow' : ''} ${settings.mode === 7 ? 'breathing' : ''}`} style={{ '--key-color': `#${settings.color}`, '--glow-opacity': settings.brightness / 5, '--motion-speed': `${6 - settings.speed}s` } as React.CSSProperties}>
    <div className="keyboard-body"><div className="key-matrix">{rows.map((row, ri) => <div className="key-row" key={ri}>{row.map((item, ci) => { const [label, width] = Array.isArray(item) ? item : [item, 1]; return <span key={ci} className={`key ${ri === 0 && ci === 0 ? 'accent-key' : ''} ${label === 'enter' ? 'enter-key' : ''}`} style={{ flex: width, '--key-index': ci } as React.CSSProperties}><i>{label}</i></span>; })}</div>)}</div><div className="keyboard-extra"><div className="dial"/><div className="mini-screen"><span>AULA</span><b>F75</b><small>MAX</small></div><span className="side-key">home</span><span className="side-key">pgup</span><span className="side-key">pgdn</span><span className="side-key">end</span></div></div>
  </div>;
}

function App() {
  const [view, setView] = useState<'lighting' | 'display'>('lighting');
  const [uiSize, setUiSize] = useState(() => { try { const saved=localStorage.getItem('aula.ui-size'); if(saved && ['auto','100','125','150'].includes(saved))return saved; } catch {} return 'auto'; });
  useEffect(()=>{document.documentElement.dataset.uiSize=uiSize;try{localStorage.setItem('aula.ui-size',uiSize);}catch{}},[uiSize]);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => { try { const saved = localStorage.getItem('aula.theme'); if (saved === 'light' || saved === 'dark') return saved; } catch {} return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'; });
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem('aula.theme', theme); } catch {}
    if (isTauri()) void invoke('set_app_theme', { theme }).catch(e => console.warn('Native title bar theme:', e));
  }, [theme]);
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const [lightingTab, setLightingTab] = useState<'effects' | 'keys'>('effects');
  const [keyColors, setKeyColors] = useState<KeyColors>(() => loadKeyColors(settings.color));
  useEffect(() => { try { localStorage.setItem('aula.perkey.v1', JSON.stringify(keyColors)); } catch {} }, [keyColors]);
  const [devices, setDevices] = useState<Receiver[]>([]);
  const [id, setId] = useState('');
  const [receiverState, setReceiverState] = useState<'checking' | 'connected' | 'disconnected'>('checking');
  const [busy, setBusy] = useState(false);
  const [battery, setBattery] = useState<number | null>(null);
  const [batteryState, setBatteryState] = useState('Not checked');
  const [batteryAt, setBatteryAt] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState(false);
  const [help, setHelp] = useState(false);
  const [applied, setApplied] = useState<string | null>(null);
  const lock = useRef(false);
  const selected = useRef(id);
  selected.current = id;
  const native = isTauri();
  const serial = JSON.stringify(lightingTab === 'keys' ? { keyColors, brightness: settings.brightness } : settings);
  const dirty = serial !== applied;
  function update(patch: Partial<Settings>) { setSettings(s => ({ ...s, ...patch })); }
  useEffect(() => { try { localStorage.setItem('aula.settings.v2', JSON.stringify(settings)); } catch { /* optional */ } }, [settings]);

  const scan = useCallback(async (quiet = false) => {
    if (lock.current) return;
    if (!native) { if (!quiet) setNotice('Design preview · open the desktop app to connect your keyboard.'); setReceiverState('disconnected'); return; }
    lock.current = true; if (!quiet) { setBusy(true); setError(false); setReceiverState('checking'); }
    try {
      const result = await invoke<Receiver[]>('scan_receivers');
      setDevices(result);
      const next = result.some(d => d.id === selected.current) ? selected.current : result[0]?.id || '';
      setId(next);
      setReceiverState(next ? 'connected' : 'disconnected');
      if (!next) { setBattery(null); setBatteryAt(''); setApplied(null); }
      if (!quiet) setNotice(result.length ? 'Receiver found. Your workspace is ready.' : 'No receiver found. Connect the USB dongle and select 2.4G on your keyboard.');
    } catch (e) { setReceiverState('disconnected'); setId(''); setBattery(null); if (!quiet) { setError(true); setNotice(String(e)); } }
    finally { lock.current = false; if (!quiet) setBusy(false); }
  }, [native]);
  const refreshBattery = useCallback(async (receiver: string) => {
    if (!receiver || lock.current || !native) return;
    lock.current = true; setBusy(true); setBatteryState('Checking');
    try {
      const value = await invoke<number | null>('read_battery', { id: receiver });
      if (selected.current !== receiver) return;
      setBattery(value); setBatteryState(value === null ? 'Unavailable' : 'Updated');
      setBatteryAt(value === null ? '' : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    } catch (e) {
      if (selected.current !== receiver) return;
      setBattery(null); setBatteryState('Unavailable'); setError(true); setNotice(String(e));
    } finally { lock.current = false; setBusy(false); }
  }, [native]);
  useEffect(() => { void scan(); const timer=setInterval(()=>void scan(true),5000); return ()=>clearInterval(timer); }, [scan]);
  useEffect(() => {
    setBattery(null); setBatteryAt(''); setBatteryState('Not checked'); setApplied(null);
    const timer = setTimeout(() => void refreshBattery(id), 200);
    const interval = setInterval(() => { if (!document.hidden) void refreshBattery(id); }, 30000);
    return () => { clearTimeout(timer); clearInterval(interval); };
  }, [id, refreshBattery]);
  async function applySleep(settings: SleepSettings) {
    if (!id || lock.current || !native) return false;
    lock.current = true; setBusy(true); setError(false); setNotice('Sending keyboard sleep settings…');
    try { await invoke('apply_sleep', { id, settings }); setNotice('Sleep settings acknowledged by the receiver.'); return true; }
    catch (e) { setError(true); setNotice(String(e)); return false; }
    finally { lock.current = false; setBusy(false); }
  }
  async function apply() {
    if (!id || lock.current) return;
    lock.current = true; setBusy(true); setError(false); setNotice('Sending your lighting to the keyboard…');
    const sent = serial;
    try {
      if (lightingTab === 'keys') {
        await invoke('apply_per_key', { id, colors: keyLayout.map(key => ({ index: key.index, color: keyColors[key.index] })), brightness: settings.brightness, restore: settings });
      } else { await invoke('apply_lighting', { id, settings }); }
      setApplied(sent); setNotice(lightingTab === 'keys' ? 'Custom lighting applied to the keyboard.' : 'Lighting sent. A little more you.');
    } catch (e) { setError(true); setNotice(String(e)); }
    finally { lock.current = false; setBusy(false); }
  }
  return <div className={`app-shell ${lightingTab === 'keys' ? 'per-key-mode' : ''}`}>
    <aside className="sidebar">
      <div className="brand"><span className="brand-symbol"><Command size={20}/></span><strong>aula<span>studio</span></strong></div>
      <div className="sidebar-label">YOUR WORKSPACE</div>
      <button className={`nav-active ${view === 'lighting' ? '' : 'nav-idle'}`} disabled={busy} onClick={() => setView('lighting')}><SlidersHorizontal size={17}/> Keyboard studio {view === 'lighting' && <span className="tiny-dot"/>}</button>
      <button className={`nav-active ${view === 'display' ? '' : 'nav-idle'}`} disabled={busy} onClick={() => setView('display')}><Keyboard size={17}/> Mini display {view === 'display' && <span className="tiny-dot"/>}</button>
      <div className="device-card"><div className="device-icon"><Keyboard size={28}/><span/></div><b>F75 Max</b><small>75% · Mechanical keyboard</small><div className="device-tag"><Radio size={12}/> 2.4 GHz wireless</div></div>
      <div className="sidebar-bottom"><div className="local-note"><span className="local-dot"/> Made for your desk.</div><p>No accounts. No cloud.<br/>Just you and your keyboard.</p><button onClick={() => setHelp(true)}><CircleHelp size={16}/> Connection guide <ChevronRight size={14}/></button><div className="version">AULA STUDIO <span>v1.1.1</span></div></div>
    </aside>
    <main>
      <header className="topbar"><span>Workspace <ChevronRight size={12}/> <b>F75 Max</b></span><div className="topbar-actions"><label className="ui-size-control"><span>UI size</span><select aria-label="Interface size" value={uiSize} onChange={e=>setUiSize(e.target.value)}><option value="auto">Auto</option><option value="100">100%</option><option value="125">125%</option><option value="150">150%</option></select></label><button className="theme-button" aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'} onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>{theme === 'dark' ? <SunMoon size={16}/> : <Moon size={16}/>}<span>{theme === 'dark' ? 'Light mode' : 'Dark mode'}</span></button><div className={`connection-pill ${receiverState === 'connected' && id ? 'connected' : ''}`}><span/>{!native ? 'Design preview' : receiverState === 'connected' && id ? 'Receiver connected' : receiverState === 'checking' ? 'Checking receiver…' : 'Receiver disconnected'}</div></div></header>
      <div className="workspace">{view === 'display' ? <DisplayPanel onBusy={value => { lock.current = value; setBusy(value); }}/> : <>
        <section className="page-heading"><div><div className="eyebrow">A LITTLE PERSONALITY GOES A LONG WAY</div><h1 className="hero-title">Your keys. <em>Your atmosphere.</em></h1><p>Find the light that feels like you.</p></div><button className="icon-button" onClick={() => setHelp(true)} aria-label="Open connection guide"><CircleHelp size={19}/></button></section>
        <section className="device-strip"><div className="receiver-block"><div className="receiver-icon"><Radio size={19}/></div><div><small>YOUR CONNECTION</small><div className="receiver-select"><select aria-label="Receiver interface" value={id} onChange={e => setId(e.target.value)} disabled={!devices.length || busy}>{!devices.length && <option value="">{native ? 'Connect your receiver' : 'Desktop app required'}</option>}{devices.map(d => <option key={d.id} value={d.id}>2.4 GHz receiver · Interface {d.interface}</option>)}</select><ChevronDown size={12}/></div></div><button className="icon-button" title="Scan receivers" aria-label="Scan receivers" disabled={busy} onClick={() => void scan()}><RefreshCw size={15} className={busy ? 'spin' : ''}/></button></div><div className="battery-block"><Battery size={21}/><div><div className="battery-heading"><b>{battery === null ? '—' : `${battery}%`}</b><span>Battery</span></div><div className="battery-track"><span style={{ width: `${battery ?? 0}%`, background: battery !== null && battery <= 20 ? '#E47B52' : '#83A48B' }}/></div><small>{batteryState === 'Updated' ? `Updated ${batteryAt}` : batteryState === 'Unavailable' ? 'Unavailable · wake keyboard & retry' : batteryState === 'Checking' ? 'Checking…' : 'Waiting for receiver'}</small></div><button className="icon-button" aria-label="Refresh battery" title="Refresh battery" disabled={!id || receiverState !== 'connected' || busy} onClick={() => void refreshBattery(id)}><RefreshCw size={14}/></button></div></section>
        <div className="lighting-tabs" role="group" aria-label="Lighting editor"><button className={lightingTab === 'effects' ? 'active' : ''} aria-pressed={lightingTab === 'effects'} disabled={busy} onClick={() => setLightingTab('effects')}>Effects</button><button className={lightingTab === 'keys' ? 'active' : ''} aria-pressed={lightingTab === 'keys'} disabled={busy} onClick={() => setLightingTab('keys')}>Per-key colors</button></div><div className="layout">
          <div className="primary-column">
            {lightingTab === 'keys' ? <PerKeyEditor colors={keyColors} color={settings.color} onChange={setKeyColors}/> : <><section className="preview-panel"><div className="panel-top"><span className="preview-label"><span/> LIVE COLOR PREVIEW</span><span className="model-badge">F75 MAX <ArrowDownRight size={13}/></span></div><KeyboardPreview settings={settings}/><div className="preview-bottom"><span><span className="color-dot" style={{ background: settings.mode === 0 ? '#666' : `#${settings.color}` }}/>{modes[settings.mode]} <i> / </i>{settings.colorful ? 'Multicolor' : `#${settings.color}`}</span><small>Preview is illustrative</small></div></section>
            <section className="effects-section"><div className="section-title"><h2><Sparkles size={17}/> Set the mood</h2><span>20 built-in effects</span></div><div className="effect-grid">{featured.map(effect => <button key={effect.id} className={`effect-card ${settings.mode === effect.id ? 'selected' : ''}`} onClick={() => update({ mode: effect.id })} aria-pressed={settings.mode === effect.id}><div className={`effect-illustration illustration-${effect.id}`}><effect.icon size={24}/><span/><span/><span/></div><div><b>{effect.name}</b><small>{effect.sub}</small></div>{settings.mode === effect.id && <span className="selected-check"><Check size={10}/></span>}</button>)}</div><div className="all-effects"><span>Explore all effects</span><EffectSelect names={modes} value={settings.mode} onChange={mode => update({ mode })}/></div></section></>}
          </div>
          <div className="control-column">
            <section className="panel color-panel"><div className="section-title"><h2><Palette size={17}/> Color story</h2><span className="mini-label">RGB</span></div><ColorPicker color={settings.color} onChange={color => update({ color })}/><div className="toggle-row" style={lightingTab === 'keys' ? {display: 'none'} : undefined}><div><b>Go multicolor</b><small>Let the whole spectrum in.</small></div><button className={`toggle ${settings.colorful ? 'on' : ''}`} aria-label="Multicolor effect" role="switch" aria-checked={settings.colorful} onClick={() => update({ colorful: !settings.colorful })}><span/></button></div></section>
            <section className="panel tuning-panel"><div className="section-title"><h2><SlidersHorizontal size={17}/> Fine-tune</h2></div>{([{ key: 'brightness', label: 'Brightness', icon: Sun, end: 'Bright' }, { key: 'speed', label: 'Motion speed', icon: Zap, end: 'Fast' }] as const).filter(control => lightingTab === 'effects' || control.key === 'brightness').map(control => <div className="slider-control" key={control.key}><label htmlFor={control.key}><span><control.icon size={14}/>{control.label}</span><b>{settings[control.key]}<i> / 5</i></b></label><input id={control.key} type="range" min="1" max="5" value={settings[control.key]} style={{ '--range-fill': `${(settings[control.key] - 1) * 25}%` } as React.CSSProperties} onChange={e => update({ [control.key]: +e.target.value })}/><div className="range-labels"><span>{control.key === 'brightness' ? 'Subtle' : 'Slow'}</span><span>{control.end}</span></div></div>)}<label className="direction-row">Direction<div className="select-wrap"><select aria-label="Effect direction" value={settings.direction} onChange={e => update({ direction: +e.target.value })}><option value={0}>Right →</option><option value={1}>Down ↓</option><option value={2}>Left ←</option><option value={3}>Up ↑</option></select><ChevronDown size={12}/></div></label></section>
          </div>
        </div>

        <SleepPanel disabled={!id || receiverState !== 'connected' || busy} apply={applySleep}/>

        <footer className="apply-footer"><div className={`feedback ${error ? 'error' : ''}`} role="status" aria-live="polite">{error ? <CircleHelp size={15}/> : applied === serial ? <Check size={15}/> : <span className="status-dot"/>}<span>{notice || (dirty ? 'Make a few changes. Make it your own.' : 'Your lighting is up to date.')}</span></div><button className="apply-button" onClick={() => void apply()} disabled={!id || receiverState !== 'connected' || busy}>{busy ? <LoaderCircle size={16} className="spin"/> : !dirty ? <Check size={16}/> : <Zap size={16}/>} {busy ? 'Working…' : !dirty ? 'Lighting applied' : 'Apply lighting'}<ArrowRight size={16}/></button></footer>
        <div className="footnote"><span>DESIGNED FOR YOUR EVERYDAY.</span><span>Changes apply when you’re ready.</span></div></>}
      </div>
    </main>
    {help && <div className="modal-backdrop" onClick={() => setHelp(false)}><section className="help-modal" role="dialog" aria-modal="true" aria-labelledby="help-title" onClick={e => e.stopPropagation()}><button className="close-modal icon-button" onClick={() => setHelp(false)} aria-label="Close guide"><X size={20}/></button><Radio className="help-symbol" size={30}/><div className="eyebrow">A SIMPLE CONNECTION</div><h2 id="help-title">Meet your receiver.</h2><p>Plug in the F75 Max USB dongle, switch your keyboard to <b>2.4G</b>, and press a key to wake it.</p><ol><li>Close the official driver so the receiver is free.</li><li>Click Scan, then choose a receiver interface.</li><li>Pick a color and effect. Click Apply lighting.</li></ol><p>The app selects the compatible 32-byte receiver interface. Receiver presence is checked every five seconds. Battery checks run every 30 seconds while the window is visible.</p><div className="help-note">If access fails on macOS, check Input Monitoring permission and reopen the app. Open Mini display for image/GIF uploads and clock sync over a USB data cable in wired mode.</div><button className="apply-button" onClick={() => setHelp(false)}>Got it <Check size={15}/></button></section></div>}
  </div>;
}

createRoot(document.getElementById('root')!).render(<App/>);
