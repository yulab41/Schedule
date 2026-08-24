import { registerWorkflowPanel } from '../controller-host.js';
import { createLeavePanelControllerDefinition } from './controller.js';

registerWorkflowPanel(createLeavePanelControllerDefinition);
