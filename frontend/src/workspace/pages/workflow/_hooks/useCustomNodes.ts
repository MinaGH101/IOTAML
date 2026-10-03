import { nodesApi } from '../../../../features/custom-nodes/api/nodesApi';
import { useCallback, useState } from 'react';
import type { CustomNodeDefinition, CustomNodePayload, RegistryNode } from '../../../../shared/types';
import { userFriendlyErrorMessage } from '../../../../shared/lib/errorMessages';
export function useCustomNodes({ refreshRegistry, setMessage, }: {
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
        if (busy)
            return;
        setOpen(false);
        setDefinition(null);
    }, [busy]);
    const editNode = useCallback(async (node: RegistryNode) => {
        if (!node.isCustom)
            return;
        setBusy(true);
        try {
            setDefinition(await nodesApi.getCustom(node.id));
            setOpen(true);
        }
        catch (error) {
            setMessage(userFriendlyErrorMessage(error, 'نود سفارشی بارگذاری نشد. دوباره تلاش کنید.'));
        }
        finally {
            setBusy(false);
        }
    }, [setMessage]);
    const saveNode = useCallback(async (payload: CustomNodePayload) => {
        setBusy(true);
        try {
            if (definition)
                await nodesApi.updateCustom(definition.id, payload);
            else
                await nodesApi.createCustom(payload);
            await refreshRegistry();
            setOpen(false);
            setDefinition(null);
            setMessage('نود سفارشی ذخیره شد و در User Nodes قرار گرفت');
        }
        catch (error) {
            setMessage(userFriendlyErrorMessage(error, 'نود سفارشی ذخیره نشد. نام، پورت‌ها و کد آن را بررسی کنید.'));
        }
        finally {
            setBusy(false);
        }
    }, [definition, refreshRegistry, setMessage]);
    const deleteNode = useCallback(async () => {
        if (!definition)
            return;
        if (!window.confirm(`نود «${definition.label}» حذف شود؟`))
            return;
        setBusy(true);
        try {
            await nodesApi.removeCustom(definition.id);
            await refreshRegistry();
            setOpen(false);
            setDefinition(null);
            setMessage('نود سفارشی حذف شد');
        }
        catch (error) {
            setMessage(userFriendlyErrorMessage(error, 'نود سفارشی حذف نشد. استفاده آن در جریان‌ها را بررسی کنید.'));
        }
        finally {
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
