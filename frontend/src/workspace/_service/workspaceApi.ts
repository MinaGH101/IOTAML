import { assistantApi } from '../../features/assistant/api/assistantApi';
import { componentsApi } from '../../features/components/api/componentsApi';
import { nodesApi } from '../../features/custom-nodes/api/nodesApi';
import { runsApi } from '../../features/execution/api/runsApi';
import { workflowsApi } from '../../features/workflow/api/workflowsApi';

/** Compatibility facade for existing feature hooks. New code imports the domain client directly. */
export const workspaceApi = {
  nodeCatalog: nodesApi.catalog,
  customNode: nodesApi.getCustom,
  createCustomNode: nodesApi.createCustom,
  updateCustomNode: nodesApi.updateCustom,
  deleteCustomNode: nodesApi.removeCustom,
  components: componentsApi.list,
  createComponent: componentsApi.create,
  getComponent: componentsApi.get,
  updateComponent: componentsApi.update,
  deleteComponent: componentsApi.remove,
  componentVersions: componentsApi.versions,
  getComponentVersion: componentsApi.getVersion,
  createComponentVersion: componentsApi.createVersion,
  makeComponentVersionCurrent: componentsApi.makeCurrent,
  deleteComponentVersion: componentsApi.removeVersion,
  exportComponent: componentsApi.export,
  importComponent: componentsApi.import,
  componentRegistry: componentsApi.registry,
  workflows: workflowsApi.list,
  createWorkflow: workflowsApi.create,
  renameWorkflow: workflowsApi.rename,
  deleteWorkflow: workflowsApi.remove,
  getWorkflow: workflowsApi.get,
  autosaveWorkflow: workflowsApi.autosave,
  workflowVersions: workflowsApi.versions,
  getWorkflowVersion: workflowsApi.getVersion,
  createWorkflowVersion: workflowsApi.createVersion,
  restoreWorkflowVersion: workflowsApi.restoreVersion,
  deleteWorkflowVersion: workflowsApi.removeVersion,
  validateWorkflow: workflowsApi.validate,
  createRun: runsApi.create,
  getRun: runsApi.get,
  runProgress: runsApi.progress,
  cancelRun: runsApi.cancel,
  retryRun: runsApi.retry,
  listRuns: runsApi.list,
  assistantChat: assistantApi.chat,
};
