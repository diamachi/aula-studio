import { useEffect, useState } from 'react';
import { Moon } from 'lucide-react';
export type SleepSettings = { timeout: number; response: number; fnToggle: boolean; disableWin: boolean; disableAltF4: boolean; disableAltTab: boolean };
const defaults: SleepSettings = { timeout: 2, response: 1, fnToggle: false, disableWin: false, disableAltF4: false, disableAltTab: false };
const options = [{ label: 'Never', sub: 'Stay awake', value: 0 }, { label: '1 min', sub: 'Save more power', value: 1 }, { label: '5 min', sub: 'A little breathing room', value: 2 }, { label: '30 min', sub: 'Take your time', value: 3 }];
export function SleepPanel({ disabled, apply }: { disabled: boolean; apply: (settings: SleepSettings) => Promise<boolean> }) {
  const [settings, setSettings] = useState<SleepSettings>(() => {
    try { const s = JSON.parse(localStorage.getItem('aula.sleep.v1') || 'null'); if (s && [0,1,2,3].includes(s.timeout) && [1,2,3,4,5].includes(s.response) && ['fnToggle','disableWin','disableAltF4','disableAltTab'].every(k => typeof s[k] === 'boolean')) return s; } catch {}
    return defaults;
  });
  const [sent, setSent] = useState('');
  useEffect(() => { try { localStorage.setItem('aula.sleep.v1', JSON.stringify(settings)); } catch {} setSent(''); }, [settings]);
  return <section className="panel sleep-panel"><div className="sleep-heading"><div className="sleep-icon"><Moon size={23}/></div><div><h2>Rest a little</h2><p>Put the keyboard to sleep after inactivity.</p></div><span className="sleep-connection">2.4 GHz · Power saving</span></div><div className="sleep-main">
    <div className="sleep-options" role="group" aria-label="Keyboard sleep timeout">{options.map(o => <button key={o.value} aria-pressed={settings.timeout === o.value} disabled={disabled} onClick={() => setSettings(s => ({ ...s, timeout: o.value }))}><b>{o.label}</b><small>{o.sub}</small></button>)}</div>
    <div className="sleep-apply"><button className="apply-button" disabled={disabled} onClick={async () => { if (await apply(settings)) setSent(`Sleep setting sent: ${options.find(o => o.value === settings.timeout)?.label}.`); }}>Apply sleep timer</button><p className="sleep-status" role="status">{sent || 'Saved here; send when ready.'}</p></div></div>
    <details><summary>Keyboard behavior <span>Shortcut locks, Fn layer &amp; key response</span></summary><p>Sleep and these settings are applied together. Match them to your preferences; current keyboard settings cannot be read back.</p><div className="sleep-behavior-grid">
      {([{ key: 'disableWin', label: 'Disable Windows key' }, { key: 'disableAltF4', label: 'Disable Alt + F4' }, { key: 'disableAltTab', label: 'Disable Alt + Tab' }, { key: 'fnToggle', label: 'Toggle Fn layer instead of holding' }] as const).map(o => <label className="sleep-check" key={o.key}><input type="checkbox" checked={settings[o.key]} disabled={disabled} onChange={e => setSettings(s => ({ ...s, [o.key]: e.target.checked }))}/>{o.label}</label>)}
      <label className="sleep-response">Key response<select aria-label="Key response level" value={settings.response} disabled={disabled} onChange={e => setSettings(s => ({ ...s, response: +e.target.value }))}>{[1,2,3,4,5].map(n => <option key={n} value={n}>Level {n}{n === 1 ? ' · Fastest' : n === 5 ? ' · Most conservative' : ''}</option>)}</select></label>
    </div></details><p className="sleep-companion-note">The timer and your Keyboard behavior choices are applied together.</p>
  </section>;
}
