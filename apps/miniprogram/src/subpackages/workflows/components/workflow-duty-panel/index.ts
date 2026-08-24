import { registerWorkflowPanel } from '../controller-host.js';
import { createDutyPanelControllerDefinition } from './controller.js';

registerWorkflowPanel(createDutyPanelControllerDefinition);
