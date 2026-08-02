import { lazy, Suspense } from 'react';
import type { Output } from '../../../workspace/_model/output';

const AmChartsOutput = lazy(() => import('../../../workspace/_components/charts/AmChartsOutput'));
const DendrogramOutput = lazy(() => import('../../../workspace/_components/charts/DendrogramOutput'));

function ChartLoadingPlaceholder() {
  return <div className="amchart-loading" aria-live="polite"><span/><span/><span/></div>;
}

export function ChartOutput({ output, collectionMode = false, fillContainer = false }: { output: Output; collectionMode?: boolean; fillContainer?: boolean }) {
  return (
    <Suspense fallback={<ChartLoadingPlaceholder />}>
      {String(output.kind || 'plot') === 'dendrogram'
        ? <DendrogramOutput output={output} collectionMode={collectionMode} />
        : <AmChartsOutput output={output} collectionMode={collectionMode} fillContainer={fillContainer} />}
    </Suspense>
  );
}
