import { createDirectoryPanelControllerDefinition } from './directory-panel-controller.js';
import { directoryDiagnosticsBridge } from './directory-diagnostics-bridge.js';

Component(createDirectoryPanelControllerDefinition(directoryDiagnosticsBridge));
