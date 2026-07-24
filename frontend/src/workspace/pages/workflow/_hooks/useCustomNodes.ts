import { useCallback, useState } from 'react';
import type { CustomNodeDefinition, CustomNodePayload, RegistryNode } from '../../../../shared/_types';
import { workspaceApi } from '../../../_service/workspaceApi';

export function useCustomNodes({
  refreshRegistry,
  setMessage,
}: {
  refreshRegistry: () => Promise<void>;
  setMessage: (message: string) => void;
}) {
  const [definition, setDefinition] = useState<CustomNodeDefinition | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const openBuilder = useCallback(() => {
    setDefinition(null);
    setOpen(true);
  }, []);

  const closeBuilder = useCallback(() => {
    if (busy) return;
    setOpen(false);
    setDefinition(null);
  }, [busy]);

  const editNode = useCallback(async (node: RegistryNode) => {
    if (!node.isCustom) return;
    setBusy(true);
    try {
      setDefinition(await workspaceApi.customNode(node.id));
      setOpen(true);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'بارگذاری نود سفارشی ناموفق بود');
    } finally {
      setBusy(false);
    }
  }, [setMessage]);

  const saveNode = useCallback(async (payload: CustomNodePayload) => {
    setBusy(true);
    try {
      if (definition) await workspaceApi.updateCustomNode(definition.id, payload);
      else await workspaceApi.createCustomNode(payload);
      await refreshRegistry();
      setOpen(false);
      setDefinition(null);
      setMessage('نود سفارشی ذخیره شد و در User Nodes قرار گرفت');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'ذخیره نود سفارشی ناموفق بود');
    } finally {
      setBusy(false);
    }
  }, [definition, refreshRegistry, setMessage]);

  const deleteNode = useCallback(async () => {
    if (!definition) return;
    if (!window.confirm(`نود «${definition.label}» حذف شود؟`)) return;
    setBusy(true);
    try {
      await workspaceApi.deleteCustomNode(definition.id);
      await refreshRegistry();
      setOpen(false);
      setDefinition(null);
      setMessage('نود سفارشی حذف شد');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'حذف نود سفارشی ناموفق بود');
    } finally {
      setBusy(false);
    }
  }, [definition, refreshRegistry, setMessage]);

  return {
    definition,
    open,
    busy,
    openBuilder,
    closeBuilder,
    editNode,
    saveNode,
    deleteNode,
  };
}
