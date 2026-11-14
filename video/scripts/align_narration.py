#!/usr/bin/env python3
"""Sincroniza o vídeo com uma narração GRAVADA/FORNECIDA (não gera voz).

Entrada: o arquivo indicado em "narrationFile" de src/config/script.json (ou --audio).
A voz não é alterada: sem corte, sem mudança de velocidade — só reamostragem para 48 kHz e ganho.

Como os tempos são achados (nada é estimado pelo tamanho do texto):
  1. pausas reais da gravação (energia);
  2. cada fala do roteiro é sintetizada como referência (Kokoro) e alinhada à gravação por DTW sobre
     MFCC, em sequência; o fim de cada fala é encaixado na pausa real mais próxima;
  3. cortes de legenda e marcas de palavras ("marks") usam o mesmo alinhamento dentro da fala;
  4. cada legenda começa no início real da fala do trecho e termina quando a voz para.

Saídas: public/audio/narration.wav e src/data/timeline.json (mesmo formato de narrate.py).
"""
import argparse, json, os, sys
from pathlib import Path
import numpy as np
import soundfile as sf
from scipy.fft import dct
from scipy.signal import resample_poly

sys.path.insert(0, str(Path(__file__).resolve().parent))
from narrate import SR, logmel, tts_kokoro  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
HOP = 0.01
TAIL = 1.2  # respiro após a última palavra, para o fade final


def feats(audio):
    m = dct(logmel(audio), type=2, norm="ortho", axis=1)[:, 1:14]
    m = (m - m.mean(axis=0)) / (m.std(axis=0) + 1e-6)
    return m / (np.linalg.norm(m, axis=1, keepdims=True) + 1e-8)


def dtw_end(ref, target, lo_ratio=0.45, hi_ratio=2.2):
    """Quadro de `target` em que termina `ref`, que começa junto com `target` (fim livre)."""
    cost = 1 - ref @ target.T
    n, m = cost.shape
    acc = np.full((n, m), np.inf)
    acc[0] = np.cumsum(cost[0])
    for i in range(1, n):
        row, prev, c = acc[i], acc[i - 1], cost[i]
        row[0] = prev[0] + c[0]
        best = np.minimum(prev[1:], prev[:-1])
        for j in range(1, m):
            v = best[j - 1]
            if row[j - 1] < v:
                v = row[j - 1]
            row[j] = c[j] + v
    lo, hi = max(1, int(n * lo_ratio)), min(m, int(n * hi_ratio) + 1)
    js = np.arange(lo, hi)
    return int(js[np.argmin(acc[-1, lo:hi] / (js + n))])


def voiced_mask(audio):
    hop = int(HOP * SR)
    n = len(audio) // hop
    rms = np.sqrt(np.mean(audio[: n * hop].reshape(n, hop) ** 2, axis=1) + 1e-12)
    return 20 * np.log10(rms / np.percentile(rms, 95)) > -32


def pauses(mask, min_len=0.22):
    out, start = [], None
    for i, v in enumerate(list(mask) + [True]):
        if not v and start is None:
            start = i
        if v and start is not None:
            if (i - start) * HOP >= min_len:
                out.append((start * HOP, i * HOP))
            start = None
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--audio")
    ap.add_argument("--model-dir", default=os.environ.get("KOKORO_MODEL_DIR", str(ROOT / ".models")))
    args = ap.parse_args()
    script = json.loads((ROOT / "src/config/script.json").read_text(encoding="utf-8"))
    fps = script["meta"]["fps"]
    src = Path(args.audio) if args.audio else ROOT / script["narrationFile"]
    if not src.exists():
        sys.exit(f"Narração não encontrada: {src}")
    audio, sr = sf.read(src, dtype="float32")
    if audio.ndim > 1:
        audio = audio.mean(axis=1)
    if sr != SR:
        g = np.gcd(SR, sr)
        audio = resample_poly(audio, SR // g, sr // g).astype("float32")
    audio = audio * (10 ** (-21 / 20) / np.sqrt(np.mean(audio[np.abs(audio) > 1e-3] ** 2)))
    audio = (audio / max(1.0, np.max(np.abs(audio)) / 0.89)).astype("float32")
    dur = len(audio) / SR
    mask = voiced_mask(audio)
    gaps = pauses(mask)
    F = feats(audio)
    kcfg = script["voice"]["kokoro"]

    def ref(text):
        a, r = tts_kokoro(kcfg, text, args.model_dir)
        g = np.gcd(SR, r)
        a = resample_poly(a, SR // g, r // g).astype("float32")
        loud = np.where(np.abs(a) > np.max(np.abs(a)) * 10 ** (-38 / 20))[0]
        return feats(a[loud[0]: loud[-1]])

    def onset(t):  # primeira voz a partir de t
        i = int(round(t / HOP))
        while i < len(mask) - 6 and not mask[i: i + 6].all():  # ignora estalos e respiros curtos
            i += 1
        return i * HOP

    def offset(t):  # última voz antes de t
        i = min(len(mask) - 1, int(round(t / HOP)))
        while i > 0 and not mask[i]:
            i -= 1
        return (i + 1) * HOP

    def locate(text, start, limit, punct):
        """Fim de `text` (que começa em `start`) na gravação; com pontuação, encaixa na pausa real."""
        r = ref(text)
        a, b = int(start / HOP), int(min(limit, start + len(r) * HOP * 2.4 + 1.5) / HOP)
        t = start + dtw_end(r, F[a:b]) * HOP
        win = 0.6 if punct else 0.2
        if True:
            near = [g for g in gaps if g[0] > start + 0.25 and g[0] - win <= t <= g[1] + win]
            if near:
                g = min(near, key=lambda g: min(abs(g[0] - t), abs(g[1] - t)))
                return g[0], g[1], True
        return t, t, False

    pos = 0.0
    lines, captions, scenes = [], [], []
    all_lines = [(sc, ln) for sc in script["scenes"] for ln in sc["lines"]]
    for idx, (sc, ln) in enumerate(all_lines):
        start = onset(pos)
        last = idx == len(all_lines) - 1
        if last:
            end, nxt = offset(dur), dur
        else:
            end, nxt, ok = locate(ln["text"], start, dur, True)
            if not ok:
                print(f"  ! {ln['id']}: fim sem pausa clara; usando DTW ({end:.2f}s)")
        # cortes internos de legenda
        cuts = []
        for k in range(1, len(ln["captions"])):
            head = " ".join(ln["captions"][:k])
            a, b, _ = locate(head.rstrip(" ,;:"), start, end, head.rstrip()[-1] in ",.?!:;")
            a, b = min(a, end - 0.2), min(b, end - 0.15)
            cuts.append((max(a, start + 0.2), max(b, start + 0.2)))
        edges_start = [start] + [onset(b) if b > a else b for a, b in cuts]
        edges_end = [offset(a) if b > a else a for a, b in cuts] + [end]
        cues = []
        for text, s, e in zip(ln["captions"], edges_start, edges_end):
            cue = {"line": ln["id"], "text": text, "start": round(max(0, s - 0.04), 3), "end": round(e + 0.12, 3)}
            cues.append(cue)
            captions.append(cue)
        marks = {}
        for name, head in ln.get("marks", {}).items():
            a, b, _ = locate(head.rstrip(" ,;:"), start, end, head.rstrip()[-1] in ",.?!:;")
            marks[name] = round(onset(b) if b > a else b, 3)
        lines.append({"id": ln["id"], "scene": sc["id"], "text": ln["text"], "start": round(start, 3), "end": round(end, 3), "cues": [c["start"] for c in cues], "marks": marks})
        print(f"  {ln['id']:>3} {start:6.2f} → {end:6.2f}  cortes {[round(c['start'], 2) for c in cues[1:]]} {marks or ''}")
        pos = nxt

    for c, n in zip(captions, captions[1:]):
        c["end"] = round(min(c["end"], n["start"] - 0.02), 3)

    total = round((dur + TAIL) * fps) / fps
    first = {}
    for l in lines:
        first.setdefault(l["scene"], l)
    ids = [sc["id"] for sc in script["scenes"]]
    starts = []
    for i, sid in enumerate(ids):
        if i == 0:
            starts.append(0.0)
            continue
        prev_end = [l for l in lines if l["scene"] == ids[i - 1]][-1]["end"]
        want = prev_end + 0.05 if sid == "virada" else first[sid]["start"] - 0.45
        starts.append(round(max(prev_end + 0.05, want) * fps) / fps)
    for sid, s, e in zip(ids, starts, starts[1:] + [total]):
        scenes.append({"id": sid, "start": round(s, 3), "end": round(e, 3)})
        print(f"[{sid}] {s:.2f} → {e:.2f}")

    out = np.concatenate([audio, np.zeros(int(total * SR) - len(audio), dtype="float32")]) if total * SR > len(audio) else audio
    sf.write(ROOT / "public/audio/narration.wav", out, SR, subtype="PCM_16")
    timeline = {"fps": fps, "durationInSeconds": total, "durationInFrames": int(round(total * fps)), "provider": "arquivo", "voice": src.name, "scenes": scenes, "lines": lines, "captions": captions}
    (ROOT / "src/data/timeline.json").write_text(json.dumps(timeline, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Narração: {dur:.2f}s · vídeo: {total:.2f}s ({timeline['durationInFrames']} quadros)")


if __name__ == "__main__":
    main()
