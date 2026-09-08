export type ChartValue = number | null | undefined;
export interface ChartPoint { index: number; value: number; }

export function finiteChartSegments(values: ChartValue[]): ChartPoint[][] {
  const segments: ChartPoint[][] = [];
  let current: ChartPoint[] = [];
  values.forEach((value, index) => {
    if (Number.isFinite(value)) current.push({ index, value: value as number });
    else if (current.length) { segments.push(current); current = []; }
  });
  if (current.length) segments.push(current);
  return segments;
}

export function chartDataIntegrity(values: ChartValue[]) {
  const finiteInputPoints = values.filter((value) => Number.isFinite(value)).length;
  const plottedPoints = finiteChartSegments(values).reduce((sum, segment) => sum + segment.length, 0);
  return { finiteInputPoints, plottedPoints, droppedValidPoints: finiteInputPoints - plottedPoints };
}
