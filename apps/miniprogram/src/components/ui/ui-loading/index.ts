import { needsCurrentRuntimeSkyline3172UiCompatibility } from '../../../platform/runtime-ui-compatibility.js';

Component({
  properties: {
    compact: { type: Boolean, value: false },
    inheritColor: { type: Boolean, value: false },
    label: { type: String, value: '' },
  },
  data: {
    skyline3172UiCompatibility: needsCurrentRuntimeSkyline3172UiCompatibility(),
  },
});
