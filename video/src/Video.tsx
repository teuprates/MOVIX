import React from "react";
import { AbsoluteFill, Audio, Sequence } from "remotion";
import { AUDIO } from "./config/assets";
import { CROSS, FPS, LINES, REVEAL_OFFSET, sceneRange, type SceneId } from "./config/timeline";
import { Backdrop } from "./components/Backdrop";
import { Captions } from "./components/Captions";
import { Problem } from "./scenes/Problem";
import { Reveal } from "./scenes/Reveal";
import { DemoFinanceiro, DemoContratos, DemoFrota, DemoPainel } from "./scenes/Demo";
import { DemoMobile } from "./scenes/DemoMobile";
import { Closing } from "./scenes/Closing";

const SCENES: { id: SceneId; Component: React.FC }[] = [
  { id: "problema", Component: Problem },
  { id: "virada", Component: Reveal },
  { id: "painel", Component: DemoPainel },
  { id: "frota", Component: DemoFrota },
  { id: "contratos", Component: DemoContratos },
  { id: "financeiro", Component: DemoFinanceiro },
  { id: "mobile", Component: DemoMobile },
  { id: "fechamento", Component: Closing },
];

/** Trilha sempre abaixo da voz: 0,11 durante as falas; sobe nas pausas longas (virada e encerramento). */
const MUSIC_UNDER = 0.11;
const MUSIC_OPEN = 0.32;
function musicVolume(frame: number) {
  const t = frame / FPS;
  let gap = Infinity;
  for (const l of LINES) {
    if (t >= l.start && t <= l.end) return MUSIC_UNDER;
    gap = Math.min(gap, Math.abs(t - l.start), Math.abs(t - l.end));
  }
  const k = Math.min(1, Math.max(0, (gap - 0.2) / 0.8));
  return MUSIC_UNDER + (MUSIC_OPEN - MUSIC_UNDER) * k * k * (3 - 2 * k);
}

const WHOOSH_AT: SceneId[] = ["painel", "frota", "contratos", "financeiro", "mobile", "fechamento"];

export const MovixPitch: React.FC<{ captions?: boolean }> = ({ captions = true }) => {
  const reveal = sceneRange("virada").from + REVEAL_OFFSET;
  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <Backdrop />
      {SCENES.map(({ id, Component }, i) => {
        const { from, duration } = sceneRange(id);
        const last = i === SCENES.length - 1;
        return (
          <Sequence key={id} name={id} from={from} durationInFrames={duration + (last ? 0 : CROSS)}>
            <Component />
          </Sequence>
        );
      })}
      {captions && <Captions />}

      <Audio src={AUDIO.narration} volume={1} />
      <Audio src={AUDIO.music} volume={musicVolume} />
      {WHOOSH_AT.map((id) => (
        <Sequence key={id} name={`whoosh-${id}`} from={sceneRange(id).from - 4} durationInFrames={30}>
          <Audio src={AUDIO.whoosh} volume={0.2} />
        </Sequence>
      ))}
      <Sequence name="pop-logo" from={reveal + 10} durationInFrames={10}>
        <Audio src={AUDIO.pop} volume={0.12} />
      </Sequence>
    </AbsoluteFill>
  );
};
