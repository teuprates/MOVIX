import React from "react";
import { Composition, continueRender, delayRender } from "remotion";
import { loadFont } from "@remotion/fonts";
import { FONTS } from "./config/assets";
import { VIDEO } from "./config/theme";
import { TOTAL_FRAMES } from "./config/timeline";
import { MovixPitch } from "./Video";

const handle = delayRender("Carregando fontes Inter e Sora");
Promise.all(FONTS.map((f) => loadFont({ family: f.family, url: f.url, weight: f.weight })))
  .then(() => continueRender(handle))
  .catch((err) => {
    console.error("Falha ao carregar fontes", err);
    continueRender(handle);
  });

export const Root: React.FC = () => (
  <>
    <Composition id="MovixPitch" component={MovixPitch} durationInFrames={TOTAL_FRAMES} fps={VIDEO.fps} width={VIDEO.width} height={VIDEO.height} defaultProps={{ captions: true }} />
    <Composition id="MovixPitchSemLegenda" component={MovixPitch} durationInFrames={TOTAL_FRAMES} fps={VIDEO.fps} width={VIDEO.width} height={VIDEO.height} defaultProps={{ captions: false }} />
  </>
);
