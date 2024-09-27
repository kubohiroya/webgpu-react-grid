export enum SchellingSegregationModes {
  'CPU' = 'CPU',
  'GPU' = 'GPU',
}

export type SchellingSegregationShellProps = {
  id: string;

  mode: SchellingSegregationModes;
  canvasSize: {
    width: number;
    height: number;
  };
  headerOffset: {
    top: number;
    left: number;
  };
  iterations?: number;
  parallel?: boolean;
};
