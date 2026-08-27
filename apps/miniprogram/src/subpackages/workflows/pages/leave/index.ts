import { createLeavePanelControllerDefinition } from '../../components/workflow-leave-panel/controller.js';
import { createWorkflowPageDefinition } from '../../components/controller-host.js';

Page(
  createWorkflowPageDefinition(createLeavePanelControllerDefinition, {
    controller: 'leave:controller-onload',
    page: 'leave:page-onload',
  }) as never,
);
