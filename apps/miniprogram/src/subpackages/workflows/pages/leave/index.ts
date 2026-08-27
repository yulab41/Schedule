import { createLeavePanelControllerDefinition } from '../../components/workflow-leave-panel/controller.js';
import { createWorkflowPageDefinition } from '../../components/controller-host.js';

Page(createWorkflowPageDefinition(createLeavePanelControllerDefinition) as never);
