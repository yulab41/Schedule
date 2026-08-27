import { createSwapPanelControllerDefinition } from '../../components/workflow-swap-panel/controller.js';
import { createWorkflowPageDefinition } from '../../components/controller-host.js';

Page(
  createWorkflowPageDefinition(createSwapPanelControllerDefinition, {
    controller: 'swap:controller-onload',
    page: 'swap:page-onload',
  }) as never,
);
