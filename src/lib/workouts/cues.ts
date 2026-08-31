// Rest-over cues. WebAudio, so no asset, no plugin and no permission.
//
// ⚠️ THE ONE RULE: primeAudio() must be called SYNCHRONOUSLY inside a real
// user-gesture handler (the Start tap, every Set-done tap) — before any await,
// any state update, any re-render. An AudioContext created outside a gesture
// starts suspended on Android WebView and then stays SILENT forever, with no
// error anywhere. Calling it from a useEffect that runs just after the click is
// the classic version of this bug, and it fails quietly.
//
// Caveat worth knowing: WebAudio plays on the media stream. If media volume is
// at zero the cue is inaudible and nothing can detect that, which is why
// vibration is an independent channel rather than a nicety.

type Ctor = typeof AudioContext;
let ctx: AudioContext | null = null;
let warmed = false;

function audioCtor(): Ctor | null {
  const w = window as unknown as { AudioContext?: Ctor; webkitAudioContext?: Ctor };
  return w.AudioContext ?? w.webkitAudioContext ?? null;
}

/** Idempotent and cheap. Call from every gesture that precedes a cue. */
export function primeAudio(): void {
  try {
    if (!ctx) {
      const C = audioCtor();
      if (!C) return;
      ctx = new C();
    }
    if (ctx.state === "suspended") void ctx.resume();
    if (!warmed) {
      warmed = true;
      // silent blip so the graph is warm and the first real cue isn't swallowed
      tone(440, 0, 0.01, 0.0001);
    }
  } catch {
    ctx = null;
  }
}

/** Legal without a gesture once the context has been unlocked at least once,
 *  which is what makes this safe to call on app resume. */
export function resumeAudio(): void {
  if (ctx?.state === "suspended") void ctx.resume();
}

function tone(freq: number, atSec: number, durSec: number, peak: number): void {
  const c = ctx;
  if (!c) return;
  const t0 = c.currentTime + atSec;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = "sine"; // a square wave at this level through a phone speaker hurts
  osc.frequency.value = freq;
  // ramped envelope: a hard gain edge produces an audible click
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(peak, t0 + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + durSec);
  osc.connect(gain).connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + durSec + 0.02);
  osc.onended = () => {
    osc.disconnect();
    gain.disconnect();
  };
}

export type Cue = "restOver" | "tick" | "holdTarget" | "holdOver" | "sessionDone";

export function cue(kind: Cue): void {
  if (!ctx) return;
  resumeAudio();
  switch (kind) {
    case "restOver":
      // a rising pair, twice: one flat beep is easy to miss across a room,
      // "up, go" is not
      tone(880, 0, 0.12, 0.25);
      tone(1320, 0.18, 0.2, 0.25);
      tone(880, 0.6, 0.12, 0.25);
      tone(1320, 0.78, 0.2, 0.25);
      break;
    case "tick":
      tone(660, 0, 0.06, 0.12);
      break;
    case "holdTarget":
      tone(990, 0, 0.09, 0.16);
      break;
    case "holdOver":
      tone(990, 0, 0.09, 0.16);
      tone(990, 0.16, 0.09, 0.16);
      break;
    case "sessionDone":
      tone(660, 0, 0.14, 0.22);
      tone(880, 0.18, 0.14, 0.22);
      tone(1175, 0.36, 0.2, 0.22);
      break;
  }
}
