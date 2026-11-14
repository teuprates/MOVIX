import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import { CROSS } from "../config/timeline";

/** Entrada e saída suaves de cada cena. A saída ocupa os CROSS quadros extras da Sequence, cruzando com a cena seguinte. */
export const SceneShell: React.FC<{ duration: number; children: React.ReactNode; slide?: number; fadeIn?: boolean; fadeOut?: boolean }> = ({ duration, children, slide = 0, fadeIn = true, fadeOut = true }) => {
  const frame = useCurrentFrame();
  const ease = Easing.inOut(Easing.cubic);
  const enter = fadeIn ? interpolate(frame, [0, CROSS], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease }) : 1;
  const exit = fadeOut ? interpolate(frame, [duration, duration + CROSS], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease }) : 0;
  return (
    <AbsoluteFill style={{ opacity: enter * (1 - exit), transform: slide ? `translateX(${(1 - enter) * slide - exit * slide}px)` : undefined }}>
      {children}
    </AbsoluteFill>
  );
};
