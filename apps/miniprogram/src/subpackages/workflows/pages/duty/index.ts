import { createDutyPanelControllerDefinition } from '../../components/workflow-duty-panel/controller.js';
import { createWorkflowPageDefinition } from '../../components/controller-host.js';

Page(createWorkflowPageDefinition(createDutyPanelControllerDefinition) as never);
