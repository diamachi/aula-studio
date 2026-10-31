import { useEffect, useRef, useState } from 'react';
import { Channel, invoke, isTauri } from '@tauri-apps/api/core';
import { Clock, ImagePlus, Monitor, RefreshCw, Upload } from 'lucide-react';
import './display.css';

type Status = { connected: boolean; displayAvailable: boolean; message: string };
type Preview = { id: string; frames: number; chunks: number; durationMs: number; pixels: number[] };
export function DisplayPanel({ onBusy }: { onBusy: (value: boolean) => void }) {
  const [status, setStatus] = useState<Status>({ connected: false, displayAvailable: false, message: 'Checking wired connection…' });
  const [file, setFile] = useState<File | null>(null);
  const [fit, setFit] = useState('fill');
  const [preview, setPreview] = useState<Preview | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState(false);
  const [progress, setProgress] = useState(0);
  const active = useRef(false), scanning = useRef(false);
  const canvas = useRef<HTMLCanvasElement>(null);
  async function scan() {
    if (active.current || scanning.current) return;
    if (!isTauri()) { setStatus({ connected: false, displayAvailable: false, message: 'Open the desktop app to connect by USB.' }); return; }
    scanning.current = true;
    try { setStatus(await invoke<Status>('scan_display')); }
    catch (e) { setStatus({ connected: false, displayAvailable: false, message: String(e) }); }
    finally { scanning.current = false; }
  }
  useEffect(() => { void scan(); const timer = setInterval(() => void scan(), 5000); return () => clearInterval(timer); }, []);
  useEffect(() => {
    let cancelled = false;
    setPreview(null); setNotice(''); setPreparing(!!file);
    if (!file) return;
    void (async () => {
      try {
        if (file.size > 16 * 1024 * 1024) throw new Error('Choose an image up to 16 MB.');
        const result = await invoke<Preview>('prepare_display', { bytes: Array.from(new Uint8Array(await file.arrayBuffer())), fit });
        if (!cancelled) { setPreview(result); setError(false); }
      } catch (e) { if (!cancelled) { setError(true); setNotice(String(e)); } }
      finally { if (!cancelled) setPreparing(false); }
    })();
    return () => { cancelled = true; };
  }, [file, fit]);
  useEffect(() => {
    if (!preview || !canvas.current) return;
    const context = canvas.current.getContext('2d');
    if (context) { const image = context.createImageData(128, 128); image.data.set(preview.pixels); context.putImageData(image, 0, 0); }
  }, [preview]);
  async function run(upload: boolean) {
    if (active.current) return;
    active.current = true; setBusy(true); onBusy(true); setError(false); setProgress(0);
    setNotice(upload ? 'Uploading to the display. Keep the USB cable connected…' : 'Syncing your computer’s local time…');
    try {
      if (upload) {
        if (!preview) throw new Error('Choose an image first.');
        const channel = new Channel<{ sent: number; total: number }>();
        channel.onmessage = value => setProgress(Math.round(value.sent / value.total * 100));
        await invoke('upload_display', { id: preview.id, onProgress: channel });
        setNotice('Upload complete. Select the custom image screen on your keyboard.');
      } else {
        const d = new Date();
        await invoke('sync_display_clock', { time: { year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate(), hour: d.getHours(), minute: d.getMinutes(), second: d.getSeconds(), weekday: d.getDay() } });
        setNotice('Clock synced to your computer’s local time.');
      }
    } catch (e) { setError(true); setNotice(String(e)); }
    finally { active.current = false; setBusy(false); onBusy(false); }
  }
  return <section className="display-studio">
    <div className="page-heading"><div><div className="eyebrow">A LITTLE WINDOW INTO YOUR WORLD</div><h1 className="hero-title">Small screen. <em>Big personality.</em></h1><p>Your favorite image, a looping GIF, or simply the right time.</p></div><Monitor size={28}/></div>
    <div className="display-connection panel"><span className={`display-dot ${status.displayAvailable ? 'ready' : ''}`}/><div><b>{status.message}</b><p>USB data cable · keyboard switched to wired mode · official driver closed</p></div><button className="icon-button" aria-label="Check wired connection" disabled={busy} onClick={() => void scan()}><RefreshCw size={18}/></button></div>
    <div className="display-grid">
      <section className="panel display-preview"><div className="section-title"><h2><Monitor size={18}/> Screen preview</h2><span>128 × 128</span></div><div className="tft-frame">{preview ? <canvas ref={canvas} width={128} height={128} aria-label="Display image preview"/> : <div className="tft-placeholder"><ImagePlus size={36}/><span>Your little canvas</span></div>}</div><p>{preparing ? 'Preparing every frame…' : preview ? `${preview.frames === 1 ? 'Still image' : `${preview.frames} frames · ${(preview.durationMs / 1000).toFixed(1)}s loop`} · ${preview.chunks} transfer blocks` : 'Choose something that makes you smile.'}</p>{preview && preview.frames > 1 && <small>Preview shows the first frame. All frames are uploaded.</small>}</section>
      <div className="display-controls"><section className="panel"><div className="section-title"><h2><ImagePlus size={18}/> Make it yours</h2></div><label className={`display-file ${busy ? 'disabled' : ''}`}><ImagePlus size={26}/><b>{file?.name || 'Choose an image or GIF'}</b><span>PNG, JPEG or GIF · up to 16 MB · 255 frames</span><input aria-label="Choose display image" type="file" accept="image/png,image/jpeg,image/gif,.png,.jpg,.jpeg,.gif" disabled={busy} onChange={e => { setFile(e.target.files?.[0] || null); e.target.value = ''; }}/></label><div className="display-fit" role="group" aria-label="Image fit">{[{ id: 'fit', name: 'Fit', desc: 'Keep it all. Black borders.' }, { id: 'fill', name: 'Fill', desc: 'Fill the screen. Crop edges.' }, { id: 'stretch', name: 'Stretch', desc: 'Resize to a perfect square.' }].map(mode => <button key={mode.id} aria-pressed={fit === mode.id} disabled={busy} onClick={() => setFit(mode.id)}><b>{mode.name}</b><small>{mode.desc}</small></button>)}</div><p className="display-detail">Transparency becomes black. GIF frame delays are limited to 2–510 ms by the display format. Upload replaces the custom image in slot 1.</p><button className="apply-button" disabled={!preview || preparing || busy || !status.displayAvailable} onClick={() => void run(true)}><Upload size={17}/>{busy ? 'Working…' : 'Upload to keyboard'}</button></section>
      <section className="panel display-clock"><div><h2><Clock size={18}/> Always on time</h2><p>Set the keyboard clock to this computer’s local time.</p></div><button className="apply-button" disabled={busy || !status.connected} onClick={() => void run(false)}>Sync clock</button></section></div>
    </div>
    {busy && <progress aria-label="Display upload progress" max={100} value={progress}/>}
    <p className={`display-notice ${error ? 'error' : ''}`} role="status">{notice || 'Display uploads use USB. Your saved lighting stays in the keyboard studio.'}</p>
  </section>;
}
