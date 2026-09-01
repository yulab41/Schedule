// One same-subpackage controller output is shared by the workbench component and standalone page.
// Keeping this wrapper as the build entry avoids packaging the directory controller twice.
export { createDirectoryPanelControllerDefinition } from './controller.js';
