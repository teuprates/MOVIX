#!/usr/bin/env python3
"""Gera a narração do vídeo a partir de src/config/script.json.

Provedores:
  voicestudio  backend local do VoiceStudio (API compatível com OpenAI em /v1/audio/speech)
  kokoro       Kokoro-82M via kokoro-onnx (Apache-2.0), 100% local
  auto         usa o VoiceStudio se /health responder; senão, Kokoro

Saídas:
  public/audio/narration.wav   narração completa já posicionada na linha do tempo (48 kHz mono)
  src/data/timeline.json       cenas, falas e legendas com tempos (fonte única de sincronismo)
"""
import argparse, io, json, os, sys, urllib.request
from pathlib import Path
import numpy as np
import soundfile as sf
from scipy.signal import resample_poly, stft

ROOT = Path(__file__).resolve().parent.parent
SR = 48000


def tts_voicestudio(cfg, text):
    body = json.dumps({"model": cfg["model"], "voice": cfg["voice"], "input": text, "response_format": "wav"}).encode()
    req = urllib.request.Request(cfg["baseUrl"].rstrip("/") + "/v1/audio/speech", data=body, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=300) as r:
        if r.status != 200:
            raise RuntimeError(f"VoiceStudio respondeu HTTP {r.status}")
        data = r.read()
    audio, sr = sf.read(io.BytesIO(data), dtype="float32")  # falha se o corpo não for áudio
    return audio, sr


def voicestudio_alive(cfg):
    try:
        with urllib.request.urlopen(cfg["baseUrl"].rstrip("/") + "/health", timeout=3) as r:
            return r.status == 200
    except Exception:
        return False


_kokoro = None


def tts_kokoro(cfg, text, model_dir):
    global _kokoro
    if _kokoro is None:
        from kokoro_onnx import Kokoro
        model, voices = Path(model_dir) / "kokoro-v1.0.onnx", Path(model_dir) / "voices-v1.0.bin"
        if not model.exists() or not voices.exists():
            sys.exit(f"Modelos do Kokoro não encontrados em {model_dir} (veja o README: kokoro-v1.0.onnx e voices-v1.0.bin).")
        _kokoro = Kokoro(str(model), str(voices))
    audio, sr = _kokoro.create(text, voice=cfg["voice"], speed=cfg.get("speed", 1.0), lang=cfg.get("lang", "pt-br"))
    return np.asarray(audio, dtype="float32"), sr


def prepare(audio, sr):
    """Mono, 48 kHz, sem silêncio nas pontas, nível consistente."""
    if audio.ndim > 1:
        audio = audio.mean(axis=1)
    if sr != SR:
        g = np.gcd(SR, sr)
        audio = resample_poly(audio, SR // g, sr // g).astype("float32")
    peak = np.max(np.abs(audio)) or 1.0
    loud = np.where(np.abs(audio) > peak * 10 ** (-38 / 20))[0]
    pad = int(0.03 * SR)
    audio = audio[max(0, loud[0] - pad): min(len(audio), loud[-1] + pad)]
    rms = np.sqrt(np.mean(audio ** 2))
    audio = audio * (10 ** (-21 / 20) / max(rms, 1e-6))
    audio = audio / max(1.0, np.max(np.abs(audio)) / 0.89)
    fade = int(0.008 * SR)
    audio[:fade] *= np.linspace(0, 1, fade)
    audio[-fade:] *= np.linspace(1, 0, fade)
    return audio.astype("float32")


def silences(audio, min_len=0.06):
    """Intervalos (início, fim) em segundos em que a fala fica em silêncio."""
    hop = int(0.01 * SR)
    n = len(audio) // hop
    rms = np.sqrt(np.mean(audio[: n * hop].reshape(n, hop) ** 2, axis=1) + 1e-12)
    quiet = 20 * np.log10(rms / np.percentile(rms, 95)) < -30
    out, start = [], None
    for i, q in enumerate(quiet):
        if q and start is None:
            start = i
        if not q and start is not None:
            if (i - start) * 0.01 >= min_len:
                out.append((start * 0.01, i * 0.01))
            start = None
    return out


def logmel(audio, bands=40):
    """Espectrograma log-mel (janela 25 ms, passo 10 ms) com média removida — base do alinhamento."""
    _, _, z = stft(audio, fs=SR, nperseg=int(0.025 * SR), noverlap=int(0.015 * SR), nfft=2048)
    power = np.abs(z) ** 2
    freqs = np.linspace(0, SR / 2, power.shape[0])
    edges = 700 * (10 ** (np.linspace(0, 2595 * np.log10(1 + 7600 / 700), bands + 2) / 2595) - 1)
    fb = np.zeros((bands, len(freqs)))
    for b in range(bands):
        lo, mid, hi = edges[b: b + 3]
        fb[b] = np.clip(np.minimum((freqs - lo) / (mid - lo), (hi - freqs) / (hi - mid)), 0, None)
    m = np.log(fb @ power + 1e-8).T
    return m - m.mean(axis=0)


def prefix_end(full, prefix):
    """Onde termina, na fala completa, o trecho inicial sintetizado à parte (DTW de subsequência)."""
    a, b = logmel(prefix), logmel(full)
    a = a / (np.linalg.norm(a, axis=1, keepdims=True) + 1e-8)
    b = b / (np.linalg.norm(b, axis=1, keepdims=True) + 1e-8)
    cost = 1 - a @ b.T
    n, m = cost.shape
    acc = np.full((n, m), np.inf)
    acc[0] = np.cumsum(cost[0])
    for i in range(1, n):
        acc[i, 0] = acc[i - 1, 0] + cost[i, 0]
        for j in range(1, m):
            acc[i, j] = cost[i, j] + min(acc[i - 1, j - 1], acc[i - 1, j], acc[i, j - 1])
    lo, hi = int(n * 0.6), min(m, int(n * 1.5) + 1)
    j = lo + int(np.argmin(acc[-1, lo:hi] / (np.arange(lo, hi) + n)))
    return j * 0.01


def cue_bounds(audio, captions, synth):
    """Divide a fala em trechos de legenda.

    Corte em pontuação → meio da pausa real mais próxima. Corte sem pausa → o trecho inicial é sintetizado
    à parte e alinhado à fala completa por DTW, para achar o instante exato em que ele termina.
    """
    dur = len(audio) / SR
    if len(captions) == 1:
        return [(0.0, dur)]
    gaps = silences(audio)
    cuts, prev = [], 0.0
    for k in range(1, len(captions)):
        head = " ".join(captions[:k]).rstrip(" ,;:")
        est = prefix_end(audio, prepare(*synth(head)))
        cut, how = est + 0.03, "dtw"
        if captions[k - 1].rstrip()[-1] in ",.?!:;":
            near = [g for g in gaps if g[0] - 0.25 <= est <= g[1] + 0.25 and g[0] > prev + 0.25]
            if near:
                g = min(near, key=lambda g: abs((g[0] + g[1]) / 2 - est))
                cut, how = (g[0] + g[1]) / 2, "pausa"
        cut = min(max(cut, prev + 0.3), dur - 0.2)
        print(f"        corte {k}: {cut:5.2f}s ({how}; dtw {est:5.2f}s)")
        cuts.append(cut)
        prev = cut
    edges = [0.0] + cuts + [dur]
    return list(zip(edges[:-1], edges[1:]))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--provider", choices=["auto", "voicestudio", "kokoro"], default="auto")
    ap.add_argument("--model-dir", default=os.environ.get("KOKORO_MODEL_DIR", str(ROOT / ".models")))
    ap.add_argument("--voice", help="sobrepõe a voz definida em script.json")
    args = ap.parse_args()

    script = json.loads((ROOT / "src/config/script.json").read_text(encoding="utf-8"))
    fps = script["meta"]["fps"]
    provider = args.provider
    if provider == "auto":
        provider = "voicestudio" if voicestudio_alive(script["voice"]["voicestudio"]) else "kokoro"
    cfg = dict(script["voice"][provider])
    if args.voice:
        cfg["voice"] = args.voice
    print(f"Provedor de voz: {provider} · voz: {cfg['voice']}")

    def synth(text):
        return tts_voicestudio(cfg, text) if provider == "voicestudio" else tts_kokoro(cfg, text, args.model_dir)

    t = 0.0
    track = np.zeros(0, dtype="float32")
    scenes, lines, captions = [], [], []
    for sc in script["scenes"]:
        scene_start = t
        t += sc["lead"]
        for ln in sc["lines"]:
            audio = prepare(*synth(ln["text"]))
            dur = len(audio) / SR
            start = round(t * fps) / fps  # alinhado ao quadro
            s0 = int(round(start * SR))
            if len(track) < s0 + len(audio):
                track = np.concatenate([track, np.zeros(s0 + len(audio) - len(track), dtype="float32")])
            track[s0: s0 + len(audio)] += audio
            cues = []
            for text, (a, b) in zip(ln["captions"], cue_bounds(audio, ln["captions"], synth)):
                cue = {"line": ln["id"], "text": text, "start": round(start + a, 3), "end": round(start + b, 3)}
                cues.append(cue)
                captions.append(cue)
            lines.append({"id": ln["id"], "scene": sc["id"], "text": ln["text"], "start": round(start, 3), "end": round(start + dur, 3), "cues": [c["start"] for c in cues], "marks": {}})
            print(f"  {ln['id']:>3}  {start:6.2f} → {start + dur:6.2f}  ({dur:4.2f}s)  {ln['text']}")
            t = start + dur + ln.get("gap", 0)
        t += sc["tail"]
        t = round(t * fps) / fps
        scenes.append({"id": sc["id"], "start": round(scene_start, 3), "end": round(t, 3)})
        print(f"[{sc['id']}] {scene_start:.2f} → {t:.2f}")

    # legendas ficam na tela até a próxima (ou até 0,25 s depois do fim da fala)
    for i, c in enumerate(captions):
        nxt = captions[i + 1]["start"] if i + 1 < len(captions) else None
        c["end"] = round(min(c["end"] + 0.25, nxt) if nxt is not None and nxt - c["end"] < 0.6 else c["end"] + 0.25, 3)

    total = scenes[-1]["end"]
    track = np.concatenate([track, np.zeros(max(0, int(total * SR) - len(track)), dtype="float32")])
    out_audio = ROOT / "public/audio/narration.wav"
    out_audio.parent.mkdir(parents=True, exist_ok=True)
    sf.write(out_audio, track, SR, subtype="PCM_16")
    timeline = {
        "fps": fps,
        "durationInSeconds": total,
        "durationInFrames": int(round(total * fps)),
        "provider": provider,
        "voice": cfg["voice"],
        "scenes": scenes,
        "lines": lines,
        "captions": captions,
    }
    (ROOT / "src/data").mkdir(parents=True, exist_ok=True)
    (ROOT / "src/data/timeline.json").write_text(json.dumps(timeline, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Duração total: {total:.2f}s ({timeline['durationInFrames']} quadros) → {out_audio.relative_to(ROOT)}, src/data/timeline.json")


if __name__ == "__main__":
    main()
