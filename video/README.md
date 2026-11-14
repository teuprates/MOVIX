# MOVIX — vídeo pitch (Remotion)

Vídeo comercial narrado do MOVIX: **1920×1080, 30 fps, ~80 s**, H.264 + AAC, com legendas em português.

| Entregável | Caminho |
|---|---|
| Vídeo final (1080p) | `out/movix-pitch.mp4` |
| Preview leve para validação (540p) | `out/movix-pitch-preview.mp4` |
| Versão sem narração (trilha + legendas) | `out/movix-pitch-sem-narracao.mp4` — `npm run render:sem-narracao` |
| Legendas | `out/movix-pitch.srt` |
| Capturas, marca, fontes, voz, trilha e efeitos | `public/` |

## Estrutura do vídeo

| Tempo | Cena | Arquivo |
|---|---|---|
| 0 – 19,9 s | Problema: informação espalhada | `src/scenes/Problem.tsx` |
| 19,9 – 30,4 s | Virada: revelação do MOVIX | `src/scenes/Reveal.tsx` |
| 30,4 – 66,9 s | Demonstração: visão geral, frota, contratos, financeiro, celular | `src/scenes/Demo.tsx`, `DemoMobile.tsx` |
| 66,9 – 79,9 s | Fechamento e CTA "Conheça o MOVIX" | `src/scenes/Closing.tsx` |

Os tempos não estão escritos no código: vêm de `src/data/timeline.json`, gerado a partir da narração real.
Trocar a voz ou o texto re-sincroniza cenas, destaques, legendas e trilha.

## Comandos

```bash
npm install
```

```bash
npm run studio          # pré-visualizar e editar no Remotion Studio
```

```bash
npm run render:preview  # out/movix-pitch-preview.mp4 (960×540, rápido)
```

```bash
npm run render          # out/movix-pitch.mp4 + out/movix-pitch.srt
```

```bash
npm run stills          # quadros de conferência em out/stills (um a cada 2 s)
```

`npm run render` normaliza o áudio em duas passagens para **−16 LUFS** (pico real ≤ −2 dBTP). Requer `ffmpeg`.
A composição `MovixPitchSemLegenda` rende o mesmo vídeo sem legendas embutidas (use com o `.srt`).

Se o Remotion não conseguir baixar o próprio Chrome, aponte para um `chrome-headless-shell`:

```bash
REMOTION_BROWSER_EXECUTABLE=/caminho/chrome-headless-shell npm run render
```

## Onde mexer

| O quê | Onde |
|---|---|
| Roteiro, legendas, pausas, voz | `src/config/script.json` |
| Cores e tipografia (tokens do produto) | `src/config/theme.ts` |
| Caminhos de capturas, áudio e fontes | `src/config/assets.ts` |
| Enquadramentos e destaques das telas | `src/scenes/Demo.tsx` |
| Volume da trilha sob a voz | `src/Video.tsx` (`MUSIC_UNDER`, `MUSIC_OPEN`) |

## Regerar os assets

```bash
pip install -r scripts/requirements.txt
```

```bash
npm run assets   # copia as capturas de ../docs/capturas (desktop ampliado 2x), marca e fontes
```

```bash
python3 scripts/narrate.py --provider auto   # narração + src/data/timeline.json
```

```bash
npm run music    # trilha e efeitos casados com a nova linha do tempo
```

### Narração

**A versão entregue usa a narração fornecida** (`narration/narracao-original.wav`), sem alterar velocidade nem
cortar a voz. `npm run align` (`scripts/align_narration.py`) mede as pausas reais da gravação e alinha cada fala,
corte de legenda e palavra-chave do roteiro ao áudio (DTW sobre MFCC, usando o Kokoro só como referência
acústica). A duração do vídeo é a do áudio mais 1,2 s para o fade final. Para trocar a gravação, substitua o
arquivo (ou `narrationFile` em `src/config/script.json`) e rode `npm run align`, `npm run music`, `npm run render`.

Para gerar a voz por TTS em vez de usar uma gravação:

`scripts/narrate.py` aceita dois provedores:

- **`voicestudio`** — backend local do VoiceStudio (`http://localhost:3900`, `/v1/audio/speech`). Ajuste `voice`
  em `src/config/script.json` para o ID de uma voz salva (`GET /v1/audio/voices`).
- **`kokoro`** — Kokoro-82M via `kokoro-onnx` (Apache-2.0), voz `pf_dora`. Coloque `kokoro-v1.0.onnx` e
  `voices-v1.0.bin` (releases de `thewh1teagle/kokoro-onnx`) em `video/.models/` ou defina `KOKORO_MODEL_DIR`.

`--provider auto` usa o VoiceStudio se ele responder em `/health`; senão, Kokoro.

As legendas são cortadas em frases curtas. Cortes em pontuação caem no meio da pausa real; os demais são
achados sintetizando o trecho inicial à parte e alinhando-o à fala completa (DTW).

### Capturas

Todas as telas são **capturas reais do produto**, feitas por `../scripts/capturas.mjs` com as contas sintéticas
do seed (`docs/capturas/depois` para desktop, `docs/capturas/pwa` para celular). Não há dados pessoais: nomes,
placas e valores são de demonstração, e os rótulos "(demo)", "pagamentos simulados" e "simulado" do próprio
produto foram mantidos. Nenhuma tela foi redesenhada; o vídeo só aplica zoom, recorte e destaques.

As capturas de desktop têm 1440 px e são do commit do redesign dos painéis; frota, contratos e financeiro
ganharam depois uma barra de filtros que não aparece nelas. Para atualizar, rode `scripts/capturas.mjs` com o
app e o Supabase configurados, depois `npm run assets` e `npm run render`.

## Licenças

- **Trilha e efeitos sonoros**: originais, sintetizados por `scripts/make_audio.py` (sem amostras de terceiros).
- **Voz**: Kokoro-82M, Apache-2.0.
- **Fontes**: Inter e Sora, SIL Open Font License. **Ícones**: Lucide, ISC (os mesmos do produto).
- **Remotion**: gratuito para pessoas e empresas de até 3 pessoas; empresas maiores precisam de licença
  comercial (remotion.dev/license).
