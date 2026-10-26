'use strict';
module.exports={
  appId:'local.stripbot.desktop',productName:'Strip Bot',
  directories:{output:'releases/installers'},
  artifactName:'Strip-Bot-Setup-${version}-${arch}.${ext}',
  win:{target:[{target:'nsis',arch:['x64']}],icon:'../public/strip-bot.ico',signAndEditExecutable:false},
  nsis:{oneClick:false,perMachine:false,allowToChangeInstallationDirectory:true,createDesktopShortcut:true,createStartMenuShortcut:true,deleteAppDataOnUninstall:false,differentialPackage:true},
  publish:[{provider:'github',owner:'mkusidodohsvebdks888',repo:'Strip-Bot-Releases',private:false,releaseType:'release'}]
};
