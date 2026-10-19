import QRCode from 'qrcode';
import jsQR from 'jsqr';

interface InviteSettings {
  create(includeKey: boolean): string;
  import(value: string): void;
}

export function setupNetworkInvites(document: Document): void {
  const settings = (window as unknown as { PPSSPPNetworkInvites: InviteSettings }).PPSSPPNetworkInvites;
  const node = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
  const status = node('networkInviteStatus');
  const link = node<HTMLTextAreaElement>('networkInviteLink');
  const qr = node<HTMLCanvasElement>('networkInviteQr');
  const video = node<HTMLVideoElement>('networkInviteVideo');
  const stopButton = node<HTMLButtonElement>('networkInviteStopBtn');
  const scanButton = node<HTMLButtonElement>('networkInviteScanBtn');
  let stream: MediaStream | undefined;
  let scanning = false;
  let generation = 0;
  let frame = 0;
  const capture = document.createElement('canvas');
  const context = capture.getContext('2d', { willReadFrequently: true })!;
  const report = (error: unknown) => { status.textContent = error instanceof Error ? error.message : String(error); };
  const stop = () => {
    generation++;
    scanning = false;
    cancelAnimationFrame(frame);
    stream?.getTracks().forEach(track => track.stop());
    stream = undefined;
    video.srcObject = null;
    video.hidden = stopButton.hidden = true;
    scanButton.disabled = false;
  };
  const accept = (value: string) => {
    settings.import(value);
    node<HTMLInputElement>('networkInviteImportInput').value = '';
    stop();
    link.value = '';
    qr.hidden = link.hidden = node('networkInviteCopyBtn').hidden = true;
    status.textContent = "Invitation imported. Networking enabled. Restart PPSSPP if already running, then join through the game's multiplayer menu.";
  };
  const decode = (source: CanvasImageSource, width: number, height: number) => {
    if (!width || !height) return null;
    const scale = Math.min(1, 1280 / Math.max(width, height));
    capture.width = Math.max(1, Math.round(width * scale));
    capture.height = Math.max(1, Math.round(height * scale));
    context.drawImage(source, 0, 0, capture.width, capture.height);
    const pixels = context.getImageData(0, 0, capture.width, capture.height);
    return jsQR(pixels.data, pixels.width, pixels.height)?.data;
  };
  node('networkInviteCreateBtn').addEventListener('click', async () => {
    try {
      const includeKey = node<HTMLInputElement>('networkInviteIncludeKey').checked;
      const value = settings.create(includeKey);
      await QRCode.toCanvas(qr, value, { width: 320, margin: 4, errorCorrectionLevel: 'M' });
      link.value = value;
      qr.hidden = link.hidden = node('networkInviteCopyBtn').hidden = false;
      status.textContent = includeKey ? 'Invitation ready. This link includes your session key.' : 'Invitation ready. Friends on a protected relay need their own session key.';
    } catch (error) { report(error); }
  });
  node('networkInviteCopyBtn').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(link.value); status.textContent = 'Invitation copied.'; }
    catch { link.focus(); link.select(); status.textContent = 'Copy the selected invitation link.'; }
  });
  node('networkInviteImportBtn').addEventListener('click', () => {
    try { accept(node<HTMLInputElement>('networkInviteImportInput').value); }
    catch (error) { report(error); }
  });
  node<HTMLInputElement>('networkInviteImageInput').addEventListener('change', async event => {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    let bitmap: ImageBitmap | undefined;
    try {
      bitmap = await createImageBitmap(file);
      const value = decode(bitmap, bitmap.width, bitmap.height);
      if (!value) throw new Error('No QR found. Choose a clear image of the invitation QR.');
      accept(value);
    } catch (error) { report(error); }
    finally { bitmap?.close(); input.value = ''; }
  });
  scanButton.addEventListener('click', async () => {
    stop();
    const current = generation;
    scanButton.disabled = true;
    stopButton.hidden = false;
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('Camera unavailable. Use HTTPS, scan an image or paste the invitation.');
      const acquired = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
      if (current !== generation) { acquired.getTracks().forEach(track => track.stop()); return; }
      stream = acquired;
      video.srcObject = stream;
      video.hidden = false;
      await video.play();
      if (current !== generation) return;
      scanning = true;
      status.textContent = 'Point the camera at a multiplayer invitation QR.';
      let previous = 0;
      const tick = (time: number) => {
        if (!scanning) return;
        try {
          if (time - previous > 200 && video.readyState >= 2) {
            previous = time;
            const value = decode(video, video.videoWidth, video.videoHeight);
            if (value) { accept(value); return; }
          }
          frame = requestAnimationFrame(tick);
        } catch (error) { stop(); report(error); }
      };
      frame = requestAnimationFrame(tick);
    } catch (error) { if (current === generation) { stop(); report(error); } }
  });
  stopButton.addEventListener('click', () => { stop(); status.textContent = 'Camera stopped.'; });
  node('networkInvitePanel').addEventListener('toggle', () => {
    if (!node<HTMLDetailsElement>('networkInvitePanel').open) stop();
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); });
  window.addEventListener('pagehide', stop);
}
