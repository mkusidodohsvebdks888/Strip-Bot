const {test}=require('node:test');
const assert=require('node:assert/strict');
const load=()=>import('../codex-ui/src/components/ModelSwitcher/display-speed.mjs');
test('five response-display presets remain in allowed pacing range', async()=>{
 const {displayRates,displayRateIndex,displayRateForIndex,displayRateLabels}=await load();
 assert.equal(displayRates.length,5);
 assert.equal(displayRateLabels.length,5);
 assert.deepEqual([0,1,2,3,4].map(displayRateForIndex),displayRates);
 assert.deepEqual(displayRates.map(displayRateIndex),[0,1,2,3,4]);
 assert.equal(displayRateIndex(undefined),4);
 assert.equal(displayRateIndex(190),3);
 assert.equal(displayRateForIndex(-100),30);
 assert.equal(displayRateForIndex(99),null);
});
