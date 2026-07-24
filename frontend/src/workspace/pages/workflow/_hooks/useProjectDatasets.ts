import { useCallback, useState, type Dispatch, type SetStateAction } from 'react';
import type { Node } from '@xyflow/react';
import type { Dataset } from '../../../../shared/_types';
import { projectsApi } from '../../../../projects/_service/projectsApi';

export function useProjectDatasets({
  projectId,
  setNodes,
  setMessage,
}: {
  projectId: number;
  setNodes: Dispatch<SetStateAction<Node[]>>;
  setMessage: (message: string) => void;
}) {
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [datasetId, setDatasetId] = useState<number | null>(null);

  const refreshDatasets = useCallback(async () => {
    const next = await projectsApi.datasets(projectId);
    setDatasets(next);
    return next;
  }, [projectId]);

  const uploadDataset = useCallback(async (file: File) => {
    setMessage('در حال آپلود دیتاست...');
    try {
      const dataset = await projectsApi.uploadDataset(file, projectId);
      await refreshDatasets();
      setDatasetId(dataset.id);
      setMessage(`دیتاست ${dataset.name} آپلود شد`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'آپلود ناموفق بود');
    }
  }, [projectId, refreshDatasets, setMessage]);

  const deleteDataset = useCallback(async (id: number) => {
    setMessage('در حال حذف دیتاست...');
    try {
      await projectsApi.deleteDataset(id);
      const next = await refreshDatasets();
      setDatasetId((current) => current === id ? (next[0]?.id ?? null) : current);
      setNodes((items) => items.map((node) => {
        const params = (node.data.params || {}) as Record<string, unknown>;
        if (
          String(node.data.registryId || '') === 'DI-002'
          && Number(params.dataset_id || 0) === id
        ) {
          return { ...node, data: { ...node.data, params: { ...params, dataset_id: null } } };
        }
        return node;
      }));
      setMessage('دیتاست حذف شد');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'حذف دیتاست ناموفق بود');
    }
  }, [refreshDatasets, setMessage, setNodes]);

  return {
    datasets,
    datasetId,
    setDatasetId,
    refreshDatasets,
    uploadDataset,
    deleteDataset,
  };
}
