#!/usr/bin/env python3
"""Trilha e efeitos sonoros ORIGINAIS do vídeo, sintetizados aqui (numpy/scipy).

Nenhuma amostra, loop ou gravação de terceiros é usada: tudo é gerado por código deste repositório,
portanto não há restrição de licença para uso comercial.

Lê src/data/timeline.json para casar a música com as cenas (virada no início de um compasso).
Saídas: public/audio/music.mp3, public/audio/sfx/{whoosh,pop,tick}.wav
"""
import json
from pathlib import Path
import numpy as np
import soundfile as sf
from scipy.signal import butter, sosfilt, fftconvolve

ROOT = Path(__file__).resolve().parent.parent
SR = 48000
rng = np.random.default_rng(7)
tl = json.loads((ROOT / "src/data/timeline.json").read_text(encoding="utf-8"))
scene = {s["id"]: s for s in tl["scenes"]}
TOTAL = tl["durationInSeconds"]
REVEAL = scene["virada"]["start"] + 0.9          # impacto do logo (mesmo marcador usado na cena)
DEMO = scene["painel"]["start"]
CLOSE = scene["fechamento"]["start"]
BARS_TO_REVEAL = round(REVEAL / 2.4)
BAR = REVEAL / BARS_TO_REVEAL                    # o impacto cai exatamente num início de compasso
BEAT = BAR / 4
N = int((TOTAL + 0.5) * SR)
t = np.arange(N) / SR
print(f"BPM {60 / BEAT:.1f} · compasso {BAR:.3f}s · virada {REVEAL:.2f}s · demo {DEMO:.2f}s · fechamento {CLOSE:.2f}s")


def hz(note):  # MIDI → Hz
    return 440.0 * 2 ** ((note - 69) / 12)


def filt(x, cutoff, kind="low", order=2):
    return sosfilt(butter(order, cutoff, kind, fs=SR, output="sos"), x, axis=0)


def saw(freq, n, phase=0.0):
    ph = (np.arange(n) * freq / SR + phase) % 1.0
    return 2 * ph - 1


def place(buf, sig, at, gain=1.0):
    i = int(at * SR)
    if i >= len(buf) or i + len(sig) <= 0:
        return
    sig = sig[: len(buf) - i]
    buf[i: i + len(sig)] += sig * gain


def env_adsr(n, a, r):
    e = np.ones(n)
    a, r = int(a * SR), int(r * SR)
    e[:a] = np.linspace(0, 1, a) ** 1.5
    e[-r:] *= np.linspace(1, 0, r) ** 1.5
    return e


# Harmonia: ré menor na dor; fá maior (Bbmaj7–F–C–Dm7) a partir da virada.
DARK = [[38, 50, 57, 62, 65, 69, 76], [34, 46, 53, 58, 62, 65, 69]]            # Dm(add9), Bbmaj7
BRIGHT = [[34, 46, 58, 62, 65, 69], [41, 53, 60, 65, 69, 72], [36, 48, 60, 64, 67, 72], [38, 50, 60, 65, 69, 72]]


def chord_at(bar):
    return DARK[(bar // 2) % 2] if bar < BARS_TO_REVEAL else BRIGHT[(bar - BARS_TO_REVEAL) % 4]


n_bars = int(np.ceil(N / SR / BAR))
pad = np.zeros((N, 2))
bass = np.zeros(N)
pluck = np.zeros((N, 2))
drums = np.zeros((N, 2))
fx = np.zeros((N, 2))

# --- Pad: serras desafinadas, uma por nota, com ataque/soltura lentos -----------------------------
for b in range(n_bars):
    notes = chord_at(b)
    hold = 2 if b < BARS_TO_REVEAL else 1
    if b < BARS_TO_REVEAL and b % 2 == 1:
        continue
    n = int((BAR * hold + 0.9) * SR)
    voice = np.zeros((n, 2))
    for note in notes[1:]:
        for det, pan in ((-0.07, 0.25), (0.0, 0.5), (0.08, 0.75)):
            s = saw(hz(note + det), n, rng.random())
            voice[:, 0] += s * (1 - pan)
            voice[:, 1] += s * pan
    voice *= env_adsr(n, 0.5, 0.9)[:, None] / (len(notes) * 3)
    place(pad, voice, b * BAR)
# filtro que abre na virada e respira nas cenas seguintes
cut = np.interp(t, [0, REVEAL - 2.5, REVEAL, REVEAL + 3, DEMO, CLOSE, CLOSE + 4, TOTAL], [420, 520, 2600, 1900, 1300, 1500, 2300, 1500])
chunks = []
step = int(0.05 * SR)
zi = None
from scipy.signal import sosfilt_zi
for i in range(0, N, step):
    sos = butter(2, cut[i], "low", fs=SR, output="sos")
    if zi is None:
        zi = np.zeros((sos.shape[0], 2, 2))
    y, zi = sosfilt(sos, pad[i: i + step], axis=0, zi=zi)
    chunks.append(y)
pad = np.concatenate(chunks)

# --- Baixo: seno + leve serra; pulsa em colcheias na demonstração --------------------------------
for b in range(n_bars):
    root = chord_at(b)[0]
    if b < BARS_TO_REVEAL:
        if b % 2 == 0:
            n = int(BAR * 2 * SR)
            place(bass, np.sin(2 * np.pi * hz(root) * np.arange(n) / SR) * env_adsr(n, 0.8, 1.2), b * BAR, 0.32)
        continue
    for e in range(8):
        at = b * BAR + e * BEAT / 2
        if at < DEMO - 1e-6 and e % 4:      # logo após a virada: só notas longas
            continue
        dur = BEAT * 1.9 if at < DEMO - 1e-6 else BEAT * 0.46
        n = int(dur * SR)
        ph = 2 * np.pi * hz(root) * np.arange(n) / SR
        note = (np.sin(ph) + 0.25 * np.sin(2 * ph)) * np.exp(-np.arange(n) / SR / (dur * 0.7))
        note[: int(0.004 * SR)] *= np.linspace(0, 1, int(0.004 * SR))
        place(bass, note, at, 0.34 if e % 2 == 0 else 0.24)

# --- Pluck/arpejo ---------------------------------------------------------------------------------
def pluck_note(note, dur=0.5, bright=1.0):
    n = int(dur * SR)
    x = saw(hz(note), n) * 0.6 + np.sin(2 * np.pi * hz(note) * np.arange(n) / SR)
    x = filt(x, min(9000, 1400 * bright + hz(note) * 2), "low")
    return x * np.exp(-np.arange(n) / SR / (dur * 0.22))


ARP = [0, 2, 1, 3, 2, 4, 3, 2]
for b in range(n_bars):
    notes = chord_at(b)[2:]
    start = b * BAR
    if b < BARS_TO_REVEAL:
        # dor: uma nota alta, isolada, com eco — mais um "tique" de relógio
        if b % 2 == 0:
            s = pluck_note(notes[-1] + 12, 0.9, 0.7)
            place(pluck, np.stack([s * 0.5, s * 0.8], 1), start + BEAT * 2, 0.20)
        continue
    if start < DEMO - 1e-6:
        continue
    level = 0.17 if start < CLOSE else 0.21
    for e in range(8):
        at = start + e * BEAT / 2
        if at > TOTAL - 5.2:
            break
        note = notes[ARP[e] % len(notes)] + 12
        s = pluck_note(note, 0.42, 1.0 + 0.5 * (start >= CLOSE))
        pan = 0.35 + 0.3 * (e % 2)
        place(pluck, np.stack([s * (1 - pan), s * pan], 1), at, level * (1.0 if e % 2 == 0 else 0.7))
# eco em colcheia pontuada, alternando os lados
d = int(BEAT * 0.75 * SR)
echo = np.zeros_like(pluck)
echo[d:, 0] += pluck[:-d, 1] * 0.38
echo[d:, 1] += pluck[:-d, 0] * 0.38
echo[2 * d:, :] += pluck[:-2 * d, :] * 0.16
pluck += echo

# --- Percussão ------------------------------------------------------------------------------------
def kick():
    n = int(0.32 * SR)
    f = 46 + 90 * np.exp(-np.arange(n) / SR / 0.035)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-np.arange(n) / SR / 0.13)


def hat(dur=0.05):
    n = int(dur * SR)
    return filt(rng.standard_normal(n), 7500, "high") * np.exp(-np.arange(n) / SR / (dur * 0.3))


def tick():
    n = int(0.03 * SR)
    return filt(rng.standard_normal(n), [1800, 4200], "band") * np.exp(-np.arange(n) / SR / 0.006)


K = kick()
kick_times = []
for b in range(n_bars):
    start = b * BAR
    if b < BARS_TO_REVEAL:
        for e in range(8):                     # tique-taque discreto: o tempo passando
            s = tick()
            place(drums, np.stack([s, s], 1), start + e * BEAT / 2, 0.05 if e % 2 else 0.09)
        continue
    if start < DEMO - 1e-6 or start > TOTAL - 5.5:
        continue
    for beat in (0, 2) if start < CLOSE else (0, 1, 2, 3):
        place(drums, np.stack([K, K], 1), start + beat * BEAT, 0.5 if start < CLOSE else 0.42)
        kick_times.append(start + beat * BEAT)
    for e in range(8):
        h = hat(0.06 if e % 2 else 0.035)
        place(drums, np.stack([h * 0.7, h], 1), start + e * BEAT / 2, 0.035 if e % 2 else 0.02)

# --- Virada: subida + impacto ---------------------------------------------------------------------
rise = 2.4
n = int(rise * SR)
x = np.linspace(0, 1, n)
noise = rng.standard_normal(n)
sweep = np.zeros(n)
zi = None
for i in range(0, n, step):
    sos = butter(2, [300 + 3000 * x[i] ** 2, 900 + 9000 * x[i] ** 2], "band", fs=SR, output="sos")
    if zi is None:
        zi = np.zeros((sos.shape[0], 2))
    y, zi = sosfilt(sos, noise[i: i + step], zi=zi)
    sweep[i: i + step] = y
tone = np.sin(2 * np.pi * np.cumsum(hz(50) * 2 ** (x * 2)) / SR) * 0.25
riser = (sweep * 0.6 + tone) * x ** 2.2
place(fx, np.stack([riser, riser], 1), REVEAL - rise, 0.30)
n = int(2.6 * SR)
boom = np.sin(2 * np.pi * np.cumsum(34 + 40 * np.exp(-np.arange(n) / SR / 0.12)) / SR) * np.exp(-np.arange(n) / SR / 0.7)
shine = filt(rng.standard_normal(n), 5000, "high") * np.exp(-np.arange(n) / SR / 0.55) * 0.12
place(fx, np.stack([boom + shine, boom + shine * 0.8], 1), REVEAL, 0.62)
stab = sum(pluck_note(nn + 12, 2.4, 2.0) for nn in BRIGHT[0][2:])
place(pluck, np.stack([stab, stab], 1), REVEAL, 0.10)

# --- Reverb (convolução com resposta sintética) e "sidechain" ------------------------------------
n_ir = int(2.6 * SR)
decay = np.exp(-np.arange(n_ir) / SR / 0.75)
ir = np.stack([filt(rng.standard_normal(n_ir), 5200, "low") * decay, filt(rng.standard_normal(n_ir), 5200, "low") * decay], 1)
ir /= np.sqrt((ir ** 2).sum(axis=0))
wet_src = pad * 0.5 + pluck * 0.9 + fx * 0.5
wet = np.stack([fftconvolve(wet_src[:, c], ir[:, c])[:N] for c in range(2)], 1)

duck = np.ones(N)
for kt in kick_times:
    i = int(kt * SR)
    n = min(int(0.3 * SR), N - i)
    duck[i: i + n] = np.minimum(duck[i: i + n], 1 - 0.38 * np.exp(-np.arange(n) / SR / 0.11))

pad_gain = np.interp(t, [0, 1.5, REVEAL - 0.3, REVEAL, DEMO, CLOSE, TOTAL], [0, 0.55, 0.7, 1.0, 0.8, 1.0, 1.0])
mix = pad * (pad_gain * duck)[:, None] * 0.85 + (bass * duck)[:, None] * 0.95 + pluck + drums + fx + wet * 0.30
mix = filt(mix, 32, "high")

# final: último acorde sustenta e some antes do fim
fade = np.interp(t, [0, 0.6, TOTAL - 3.2, TOTAL - 0.25, TOTAL + 1], [0, 1, 1, 0, 0]) ** 1.6
mix *= fade[:, None]
mix = np.tanh(mix * 1.5) / 1.5
mix = mix / np.max(np.abs(mix)) * 0.8
mix = mix[: int(TOTAL * SR)]
out = ROOT / "public/audio"
(out / "sfx").mkdir(parents=True, exist_ok=True)
import subprocess, tempfile
with tempfile.TemporaryDirectory() as tmp:
    wav = Path(tmp) / "music.wav"
    sf.write(wav, mix, SR, subtype="PCM_16")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(wav), "-codec:a", "libmp3lame", "-b:a", "256k", str(out / "music.mp3")], check=True)

# --- Efeitos avulsos (posicionados pelo Remotion) ------------------------------------------------
n = int(0.7 * SR)
x = np.linspace(0, 1, n)
noise = rng.standard_normal(n)
w = np.zeros(n)
zi = None
for i in range(0, n, step):
    c = 500 + 5200 * np.sin(np.pi * x[i]) ** 2
    sos = butter(2, [c * 0.6, c * 1.5], "band", fs=SR, output="sos")
    if zi is None:
        zi = np.zeros((sos.shape[0], 2))
    y, zi = sosfilt(sos, noise[i: i + step], zi=zi)
    w[i: i + step] = y
w *= np.sin(np.pi * x) ** 2
whoosh = np.stack([w * (1 - x * 0.7), w * (0.3 + x * 0.7)], 1)
sf.write(out / "sfx/whoosh.wav", whoosh / np.max(np.abs(whoosh)) * 0.5, SR, subtype="PCM_16")

n = int(0.16 * SR)
ph = 2 * np.pi * np.cumsum(np.linspace(820, 1240, n)) / SR
p = (np.sin(ph) + 0.3 * np.sin(2 * ph)) * np.exp(-np.arange(n) / SR / 0.035)
p[: int(0.003 * SR)] *= np.linspace(0, 1, int(0.003 * SR))
sf.write(out / "sfx/pop.wav", np.stack([p, p], 1) / np.max(np.abs(p)) * 0.45, SR, subtype="PCM_16")

n = int(0.09 * SR)
k = filt(rng.standard_normal(n), [1500, 5000], "band") * np.exp(-np.arange(n) / SR / 0.012)
sf.write(out / "sfx/tick.wav", np.stack([k, k], 1) / np.max(np.abs(k)) * 0.4, SR, subtype="PCM_16")
print(f"music.mp3 {len(mix) / SR:.2f}s · sfx: whoosh, pop, tick")
