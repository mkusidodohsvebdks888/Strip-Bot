'use strict';
// CLI compatibility entry. Desktop and tests create their own gateway instances.
const {createGateway, DEFAULTS: baseline} = require('./backend/gateway.cjs');
const {requireLocalUrl, extractText} = require('./backend/providers.cjs');
const DEFAULTS = {...baseline,provider:'ccswitch',endpoint:'http://127.0.0.1:15721/v1/responses',model:''};
const app = createGateway({defaults: DEFAULTS, ccOnly:true,ccSwitchOnly:true,connectionOptions:true,chatgptLogin:true});
if (require.main === module) {
  const port = Number(process.env.PORT || 3060);
  app.listen(port, '127.0.0.1', () => console.log(`Strip Bot 已启动：http://127.0.0.1:${port}`));
}
module.exports = {app, createGateway, requireLocalUrl, extractText, DEFAULTS};

