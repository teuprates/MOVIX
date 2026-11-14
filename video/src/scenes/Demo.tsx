import React from "react";
import { DESKTOP } from "../config/assets";
import { C } from "../config/theme";
import { cueAt, lineAt, sceneRange } from "../config/timeline";
import { SceneShell } from "../components/SceneShell";
import { Screen } from "../components/Screen";
import { DemoLayout, STAGE } from "./DemoLayout";

const size = { width: STAGE.width, height: STAGE.height };
const Hl: React.FC<{ children: React.ReactNode }> = ({ children }) => <span style={{ color: C.blueX }}>{children}</span>;

/** 3a · Visão geral: "pulso da frota" e o painel "Precisa de atenção". */
export const DemoPainel: React.FC = () => {
  const { duration } = sceneRange("painel");
  const d1 = lineAt("painel", "d1");
  const d1b = cueAt("painel", "d1", 1);
  const d2 = lineAt("painel", "d2");
  return (
    <SceneShell duration={duration} slide={50}>
      <DemoLayout step={0} title={<>A frota como está <Hl>agora.</Hl></>}>
        <Screen
          shot={DESKTOP.painel}
          {...size}
          keyframes={[
            { at: 0, x: 0, y: 0, w: 1440 },
            { at: d1 + 30, x: 228, y: 148, w: 900 },
            { at: d2 - 10, x: 540, y: 148, w: 900 },
          ]}
          highlights={[
            { from: d1 + 52, to: d1b - 2, x: 288, y: 177, w: 740, h: 274 },
            { from: d1b, to: d2 - 12, x: 300, y: 342, w: 716, h: 98 },
            { from: d2 + 12, to: duration + 20, x: 1048, y: 177, w: 360, h: 438 },
          ]}
        />
      </DemoLayout>
    </SceneShell>
  );
};

/** 3b · Frota: status, saúde estimada e diária em cada cartão. */
export const DemoFrota: React.FC = () => {
  const { duration } = sceneRange("frota");
  const f1 = lineAt("frota", "f1");
  const c0 = cueAt("frota", "f1", 0);
  const c1 = cueAt("frota", "f1", 1);
  return (
    <SceneShell duration={duration} slide={50}>
      <DemoLayout step={1} title={<>Cada veículo <Hl>à mão.</Hl></>}>
        <Screen
          shot={DESKTOP.frota}
          {...size}
          keyframes={[
            { at: 0, x: 0, y: 0, w: 1440 },
            { at: f1 + 4, x: 262, y: 212, w: 1000 },
          ]}
          highlights={[{ from: f1 + 24, to: duration + 20, x: 667, y: 237, w: 362, h: 312 }]}
          pings={[
            { at: Math.round(c0 + (c1 - c0) * 0.5), x: 713, y: 263 },
            { at: Math.round(c0 + (c1 - c0) * 0.74), x: 993, y: 263 },
            { at: c1 + 14, x: 965, y: 522 },
          ]}
        />
      </DemoLayout>
    </SceneShell>
  );
};

/** 3c · Contratos: período, valor e situação; aceite eletrônico. */
export const DemoContratos: React.FC = () => {
  const { duration } = sceneRange("contratos");
  const c1 = lineAt("contratos", "c1");
  const k0 = cueAt("contratos", "c1", 0);
  const k1 = cueAt("contratos", "c1", 1);
  return (
    <SceneShell duration={duration} slide={50}>
      <DemoLayout step={2} title={<>Do período ao <Hl>aceite.</Hl></>}>
        <Screen
          shot={DESKTOP.contratos}
          {...size}
          keyframes={[
            { at: 0, x: 0, y: 0, w: 1440 },
            { at: c1 + 4, x: 276, y: 214, w: 1150 },
          ]}
          highlights={[
            { from: c1 + 24, to: k1 - 2, x: 289, y: 386, w: 1118, h: 61 },
            { from: k1, to: duration + 20, x: 1232, y: 338, w: 148, h: 36 },
          ]}
          pings={[
            { at: Math.round(k0 + (k1 - k0) * 0.48), x: 882, y: 416 },
            { at: Math.round(k0 + (k1 - k0) * 0.64), x: 1176, y: 416 },
            { at: Math.round(k0 + (k1 - k0) * 0.8), x: 1265, y: 416 },
          ]}
        />
      </DemoLayout>
    </SceneShell>
  );
};

/** 3d · Financeiro: indicadores e lucro estimado por veículo. */
export const DemoFinanceiro: React.FC = () => {
  const { duration } = sceneRange("financeiro");
  const n1 = lineAt("financeiro", "n1");
  const k1 = cueAt("financeiro", "n1", 1);
  return (
    <SceneShell duration={duration} slide={50}>
      <DemoLayout step={3} title={<>Receita, despesa e <Hl>lucro.</Hl></>}>
        <Screen
          shot={DESKTOP.financeiro}
          {...size}
          keyframes={[
            { at: 0, x: 0, y: 243, w: 1440 },
            { at: n1 + 4, x: 262, y: 243, w: 1178 },
            { at: k1 - 12, x: 262, y: 812, w: 1178 },
          ]}
          highlights={[
            { from: n1 + 22, to: k1 - 14, x: 288, y: 259, w: 1120, h: 116 },
            { from: k1 + 14, to: duration + 20, x: 288, y: 837, w: 1120, h: 342 },
          ]}
        />
      </DemoLayout>
    </SceneShell>
  );
};
