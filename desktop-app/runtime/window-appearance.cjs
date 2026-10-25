'use strict';
// Explicit allow-list; never trust arbitrary colors or IPC arguments from the page.
const appearances = Object.freeze({
  warm: Object.freeze({color:'#faf9f6',symbolColor:'#4a4139',backgroundColor:'#faf9f6',theme:'light'}),
  white: Object.freeze({color:'#ffffff',symbolColor:'#3f3b36',backgroundColor:'#ffffff',theme:'light'}),
  mist: Object.freeze({color:'#f2f6fa',symbolColor:'#344353',backgroundColor:'#f2f6fa',theme:'light'}),
  graphite: Object.freeze({color:'#22262b',symbolColor:'#f0f0f1',backgroundColor:'#22262b',theme:'dark'}),
  dark: Object.freeze({color:'#211f1d',symbolColor:'#f2ece4',backgroundColor:'#211f1d',theme:'dark'}),
});
function getAppearance(value) {
  return typeof value === 'string' && Object.hasOwn(appearances,value) ? appearances[value] : null;
}
module.exports={getAppearance};
