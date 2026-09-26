type Pose = Record<string, number | boolean>;
interface BotState { bot: Pose; dots: { x: number; y: number; r: number; visible: boolean }[] }
declare const motion: {
  getBot7State(time: number): BotState;
  SvgProjector: new(options: { viewportSize: number }) => {
    projectRoundedCube(pose: Pose): { bodyPath: string; eyes: { w: number; h: number; rx: number; ry: number; cx: number; cy: number; angle: number; opacity?: number }[] };
  };
};
export = motion;
