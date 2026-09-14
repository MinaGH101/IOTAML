import { useMemo } from 'react';
import type { Edge, Node } from '@xyflow/react';
import type { Dataset } from '../../../../shared/types';
import { createColumnContextResolver } from '../../../_model/columnContext';
import type { Output } from '../../../_model/output';
import { outputsForIncomingEdge, rowsFromOutputs, } from '../../../_model/runtimeContext';
export function useNodeColumnContext({ nodes, edges, nodesById, datasets, datasetId, aliases, selectedNodeId, modalNodeId, outputs, }: {
    nodes: Node[];
    edges: Edge[];
    nodesById: Map<string, Node>;
    datasets: Dataset[];
    datasetId: number | null;
    aliases: Record<string, string>;
    selectedNodeId: string | null;
    modalNodeId: string | null;
    outputs: Output[];
}) {
    const editorNodeId = modalNodeId || selectedNodeId;
    const incomingEdges = useMemo(() => editorNodeId ? edges.filter((edge) => edge.target === editorNodeId) : [], [edges, editorNodeId]);
    const inputOutputs = useMemo(() => incomingEdges.flatMap((edge) => outputsForIncomingEdge(outputs, edge, nodesById)), [incomingEdges, nodesById, outputs]);
    const resolver = useMemo(() => createColumnContextResolver(nodes, edges, datasets, datasetId, aliases, outputs), [aliases, datasetId, datasets, edges, nodes, outputs]);
    const context = useMemo(() => resolver.inputContext(editorNodeId), [editorNodeId, resolver]);
    const availableRows = useMemo(() => rowsFromOutputs(inputOutputs), [inputOutputs]);
    return {
        availableColumns: context.activeColumns,
        availableIdColumns: context.sourceColumns,
        inheritedIdColumn: context.idColumn,
        availableRows,
    };
}
