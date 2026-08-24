import { registerWorkflowPanel } from '../controller-host.js';
import { createSwapPanelControllerDefinition } from './controller.js';

registerWorkflowPanel(createSwapPanelControllerDefinition);
