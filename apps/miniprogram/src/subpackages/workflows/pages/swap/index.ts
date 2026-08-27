import { createSwapPanelControllerDefinition } from '../../components/workflow-swap-panel/controller.js';
import { createWorkflowPageDefinition } from '../../components/controller-host.js';

Page(createWorkflowPageDefinition(createSwapPanelControllerDefinition) as never);
