import { useMemo, useRef, useState } from 'react';

type Segment = { label: string; color: string; textColor: string };

const SEGMENT_COLORS = ['#b91c1c', '#111111', '#f4f4f5', '#52525b', '#ef4444', '#d4d4d8'];
const WIN_HISTORY_LIMIT = 8;

const easeOutCubic = (t: number): number => 1 - Math.pow(1 - t, 3);

const hashStringToUint32 = (seed: string): number => {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

const mulberry32 = (seed: number): (() => number) => {
  let t = seed;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), t | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
};

const cryptoRandomInt = (maxExclusive: number): number => {
  if (!window.crypto?.getRandomValues) {
    return Math.floor(Math.random() * maxExclusive);
  }

  const maxUint = 0xffffffff;
  const range = maxExclusive;
  const threshold = maxUint - (maxUint % range);
  const buffer = new Uint32Array(1);

  while (true) {
    window.crypto.getRandomValues(buffer);
    if (buffer[0] < threshold) {
      return buffer[0] % range;
    }
  }
};

const parseNames = (rawInput: string, dedupe: boolean): string[] => {
  const split = rawInput
    .split(/[\n,]/g)
    .map((name) => name.trim())
    .filter(Boolean);

  if (!dedupe) {
    return split;
  }

  const seen = new Set<string>();
  return split.filter((name) => {
    const normalized = name.toLocaleLowerCase();
    if (seen.has(normalized)) {
      return false;
    }
    seen.add(normalized);
    return true;
  });
};

const shuffleArray = <T,>(items: T[]): T[] => {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = cryptoRandomInt(i + 1);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

function App() {
  const [rawNames, setRawNames] = useState('Alex\nJordan\nSam\nPriya\nMorgan');
  const [names, setNames] = useState<string[]>(['Alex', 'Jordan', 'Sam', 'Priya', 'Morgan']);
  const [dedupe, setDedupe] = useState(true);
  const [removeAfterSpin, setRemoveAfterSpin] = useState(false);
  const [seed, setSeed] = useState('');
  const [rotation, setRotation] = useState(0);
  const [isSpinning, setIsSpinning] = useState(false);
  const [winner, setWinner] = useState<string | null>(null);
  const [history, setHistory] = useState<string[]>([]);
  const [error, setError] = useState<string>('');
  const [muted, setMuted] = useState(true);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showWatermark, setShowWatermark] = useState(true);
  const [confettiBurst, setConfettiBurst] = useState(0);
  const audioCtxRef = useRef<AudioContext | null>(null);

  const segments: Segment[] = useMemo(
    () =>
      names.map((label, idx) => {
        const color = SEGMENT_COLORS[idx % SEGMENT_COLORS.length];
        const textColor = color === '#f4f4f5' || color === '#d4d4d8' ? '#111111' : '#fafafa';
        return { label, color, textColor };
      }),
    [names],
  );

  const playTone = (frequency: number, durationMs: number, type: OscillatorType) => {
    if (muted) return;
    const AudioCtx = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    if (!audioCtxRef.current) {
      audioCtxRef.current = new AudioCtx();
    }

    const ctx = audioCtxRef.current;
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = type;
    oscillator.frequency.value = frequency;
    gain.gain.value = 0.05;
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.start();
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + durationMs / 1000);
    oscillator.stop(ctx.currentTime + durationMs / 1000);
  };

  const drawWinner = (count: number): number => {
    if (seed.trim()) {
      const random = mulberry32(hashStringToUint32(seed.trim()));
      return Math.floor(random() * count);
    }
    return cryptoRandomInt(count);
  };

  const handleLoadNames = () => {
    const parsed = parseNames(rawNames, dedupe);
    if (parsed.length < 2) {
      setError('Please provide at least 2 unique names to spin the wheel.');
      return;
    }
    setError('');
    setNames(parsed);
    setWinner(null);
  };

  const handleClear = () => {
    if (isSpinning) return;
    setRawNames('');
    setNames([]);
    setWinner(null);
    setHistory([]);
    setError('Names cleared. Paste at least two names and click “Load Names”.');
  };

  const handleShuffle = () => {
    if (isSpinning || names.length < 2) return;
    setNames((prev) => shuffleArray(prev));
    setWinner(null);
  };

  const spin = () => {
    if (isSpinning || names.length < 2) {
      setError('Add at least 2 names before spinning.');
      return;
    }

    setError('');
    setIsSpinning(true);
    playTone(180, 140, 'triangle');

    const targetIndex = drawWinner(names.length);
    const slice = 360 / names.length;
    const minTurns = 4 + cryptoRandomInt(5);
    const centerAngle = targetIndex * slice + slice / 2;
    const landingRotation = 360 - centerAngle;
    const finalRotation = rotation + minTurns * 360 + ((landingRotation - (rotation % 360) + 360) % 360);

    const duration = 4200;
    const start = performance.now();
    const initialRotation = rotation;

    const tick = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(1, elapsed / duration);
      const eased = easeOutCubic(progress);
      const current = initialRotation + (finalRotation - initialRotation) * eased;
      setRotation(current);

      if (progress < 1) {
        requestAnimationFrame(tick);
      } else {
        const winnerName = names[targetIndex];
        setWinner(winnerName);
        setHistory((prev) => [winnerName, ...prev].slice(0, WIN_HISTORY_LIMIT));
        playTone(620, 300, 'sine');
        setConfettiBurst((c) => c + 1);
        setIsSpinning(false);
      }
    };

    requestAnimationFrame(tick);
  };

  const removeWinnerNow = () => {
    if (!winner) return;
    setNames((prev) => prev.filter((name) => name !== winner));
    setWinner(null);
  };

  const spinAgain = () => {
    if (removeAfterSpin && winner) {
      setNames((prev) => prev.filter((name) => name !== winner));
      setWinner(null);
      return;
    }
    spin();
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100">
      <header className="border-b border-neutral-800 bg-neutral-900/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-4 sm:px-6">
          <img src="/logo.svg" alt="Quiz Wheel logo" className="h-12 w-auto" />
          <div>
            <h1 className="text-2xl font-black tracking-wide text-white">Quiz Wheel</h1>
            <p className="text-sm text-neutral-400">Wheel-of-Fortune style selector for quiz runners</p>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-7xl gap-6 p-4 sm:p-6 lg:grid-cols-[360px_1fr]">
        <section className="rounded-2xl border border-neutral-800 bg-neutral-900 p-5 shadow-xl shadow-black/40">
          <label className="mb-2 block text-sm font-semibold text-neutral-200" htmlFor="names-input">
            Names (one per line or comma-separated)
          </label>
          <textarea
            id="names-input"
            className="h-40 w-full rounded-xl border border-neutral-700 bg-neutral-950 p-3 text-sm outline-none ring-red-500 transition focus:ring-2"
            value={rawNames}
            onChange={(event) => setRawNames(event.target.value)}
            disabled={isSpinning}
          />

          <div className="mt-4 space-y-2 text-sm">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={dedupe} onChange={() => setDedupe((value) => !value)} disabled={isSpinning} />
              De-duplicate names (default on)
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={removeAfterSpin}
                onChange={() => setRemoveAfterSpin((value) => !value)}
                disabled={isSpinning}
              />
              Remove winner after spin
            </label>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button className="btn-red" onClick={handleLoadNames} disabled={isSpinning}>
              Load Names
            </button>
            <button className="btn-dark" onClick={handleShuffle} disabled={isSpinning || names.length < 2}>
              Shuffle Order
            </button>
            <button className="btn-dark" onClick={handleClear} disabled={isSpinning}>
              Clear
            </button>
          </div>

          <div className="mt-4">
            <button className="text-sm text-neutral-300 underline" onClick={() => setShowAdvanced((v) => !v)}>
              {showAdvanced ? 'Hide' : 'Show'} advanced randomness settings
            </button>
            {showAdvanced && (
              <div className="mt-2 rounded-lg border border-neutral-700 bg-neutral-950 p-3">
                <label className="mb-1 block text-sm text-neutral-200" htmlFor="seed-input">
                  Optional seed (deterministic, reproducible spins)
                </label>
                <input
                  id="seed-input"
                  className="w-full rounded border border-neutral-700 bg-neutral-900 p-2 text-sm"
                  value={seed}
                  onChange={(event) => setSeed(event.target.value)}
                  placeholder="e.g. team-quiz-2026"
                  disabled={isSpinning}
                />
                <p className="mt-2 text-xs text-neutral-400">
                  Seeded mode uses Mulberry32 PRNG; empty seed uses crypto-safe randomness.
                </p>
              </div>
            )}
          </div>

          <div className="mt-4 flex items-center justify-between rounded-lg border border-neutral-700 bg-neutral-950 p-3">
            <span className="text-sm">Sound</span>
            <button className="btn-dark !px-3 !py-1" onClick={() => setMuted((v) => !v)}>
              {muted ? 'Muted' : 'On'}
            </button>
          </div>

          {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
        </section>

        <section className="relative rounded-2xl border border-neutral-800 bg-neutral-900 p-4 sm:p-6">
          {showWatermark && (
            <img
              src="/logo.svg"
              alt=""
              aria-hidden="true"
              onError={() => setShowWatermark(false)}
              className="pointer-events-none absolute left-1/2 top-1/2 z-0 w-3/4 -translate-x-1/2 -translate-y-1/2 opacity-10"
            />
          )}

          <div className="relative z-10 mx-auto max-w-[560px]">
            <div className="mx-auto mb-3 h-0 w-0 border-l-[16px] border-r-[16px] border-t-[28px] border-l-transparent border-r-transparent border-t-red-500 drop-shadow-[0_4px_6px_rgba(0,0,0,0.7)]" />
            <div
              className="wheel-shell"
              role="img"
              aria-label={`Spinning wheel with ${names.length} segments`}
              style={{ transform: `rotate(${rotation}deg)` }}
            >
              <svg viewBox="0 0 100 100" className="h-full w-full">
                {segments.map((segment, index) => {
                  const segmentAngle = 360 / segments.length;
                  const start = ((index * segmentAngle - 90) * Math.PI) / 180;
                  const end = (((index + 1) * segmentAngle - 90) * Math.PI) / 180;
                  const x1 = 50 + 49 * Math.cos(start);
                  const y1 = 50 + 49 * Math.sin(start);
                  const x2 = 50 + 49 * Math.cos(end);
                  const y2 = 50 + 49 * Math.sin(end);
                  const largeArcFlag = segmentAngle > 180 ? 1 : 0;
                  const pathData = `M50,50 L${x1},${y1} A49,49 0 ${largeArcFlag},1 ${x2},${y2} Z`;
                  const textAngle = index * segmentAngle + segmentAngle / 2;
                  const textX = 50 + 30 * Math.cos(((textAngle - 90) * Math.PI) / 180);
                  const textY = 50 + 30 * Math.sin(((textAngle - 90) * Math.PI) / 180);
                  return (
                    <g key={`${segment.label}-${index}`}>
                      <path d={pathData} fill={segment.color} stroke="#111" strokeWidth="0.35" />
                      <text
                        x={textX}
                        y={textY}
                        fill={segment.textColor}
                        fontSize="3.8"
                        textAnchor="middle"
                        dominantBaseline="middle"
                        transform={`rotate(${textAngle > 180 ? textAngle + 180 : textAngle}, ${textX}, ${textY})`}
                        className="font-semibold"
                      >
                        {segment.label.slice(0, 12)}
                      </text>
                    </g>
                  );
                })}
                <circle cx="50" cy="50" r="7.5" fill="#111" stroke="#ef4444" strokeWidth="1.2" />
              </svg>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                className="btn-red px-8 py-3 text-lg shadow-glow disabled:cursor-not-allowed disabled:opacity-60"
                onClick={spin}
                disabled={isSpinning || names.length < 2}
                aria-label="Spin wheel"
              >
                {isSpinning ? 'Spinning...' : 'SPIN'}
              </button>
              {winner && (
                <button className="btn-dark" onClick={spinAgain} disabled={isSpinning || names.length < 2}>
                  {removeAfterSpin ? 'Remove Winner' : 'Spin Again'}
                </button>
              )}
              {winner && !removeAfterSpin && (
                <button className="btn-dark" onClick={removeWinnerNow} disabled={isSpinning}>
                  Remove Winner
                </button>
              )}
            </div>

            <article className="mt-4 rounded-xl border border-neutral-700 bg-neutral-950 p-4" aria-live="polite">
              <h2 className="text-sm uppercase tracking-wide text-neutral-400">Winner</h2>
              <p className="mt-2 text-3xl font-black text-red-400">{winner ?? '—'}</p>
              <p className="text-xs text-neutral-500">Pointer is fixed at top; wheel rotates beneath it.</p>
            </article>

            <article className="mt-4 rounded-xl border border-neutral-700 bg-neutral-950 p-4">
              <h3 className="text-sm uppercase tracking-wide text-neutral-400">Recent winners</h3>
              <ul className="mt-2 space-y-1 text-sm text-neutral-200">
                {history.length === 0 ? <li>No spins yet.</li> : history.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}
              </ul>
            </article>
          </div>

          <div key={confettiBurst} className="pointer-events-none absolute inset-0 z-20 overflow-hidden" aria-hidden="true">
            {winner &&
              Array.from({ length: 28 }).map((_, index) => (
                <span
                  key={index}
                  className="confetti"
                  style={{
                    left: `${(index / 28) * 100}%`,
                    animationDelay: `${(index % 7) * 80}ms`,
                    backgroundColor: SEGMENT_COLORS[index % SEGMENT_COLORS.length],
                  }}
                />
              ))}
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;
