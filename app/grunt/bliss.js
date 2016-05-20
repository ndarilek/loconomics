'use strict';

module.exports = function(grunt) {

    var includedPatterns = ['modals/**/*.html', 'activities/**/*.html', 'templates/**/*.html'];
    var includedDir = 'source/html/';
    var includedFiles = grunt.file.expand({
        cwd: includedDir,
        filter: grunt.file.isFile
    }, includedPatterns);
    
    var facebookAppID = '180579422039773',
        facebookLang = 'en-US';
    
    var splashIncludedFiles = [
        'activities/splashIndex.html',
        'activities/splashThanks.html',
        'activities/signup.html',
        'activities/terms.html'
    ];
    var moment = require('moment');
    var version = moment().format('YYYYMMDDHHmm');

    return {
        app: {
          files: {
            'build/app.html': ['source/html/app.js.html']
          },
          options: {
            context: {
                debug: false,
                includedFiles: includedFiles,
                cordovajs: false,
                siteUrl: 'http://dev.loconomics.com',
                facebookAppID: facebookAppID,
                facebookLang: facebookLang
            }
          }
        },
        webapp: {
          files: {
            '../web/_specialRoutes/app.html': ['source/html/web.js.html']
          },
          options: {
            context: {
                debug: false,
                includedFiles: includedFiles,
                facebookAppID: facebookAppID,
                facebookLang: facebookLang,
                cssVersion: version,
                jsVersion: version
            }
          }
        },
        appDebug: {
          files: {
            'build/appDebug.html': ['source/html/app.js.html']
          },
          options: {
            context: {
                debug: true,
                includedFiles: includedFiles,
                cordovajs: false,
                siteUrl: 'http://dev.loconomics.com',
                facebookAppID: facebookAppID,
                facebookLang: facebookLang
                //siteUrl: 'http://localhost/source'
            }
          }
        },
        splash: {
          files: {
            'build/splash.html': ['source/html/splash.js.html']
          },
          options: {
            context: {
                debug: false,
                includedFiles: splashIncludedFiles,
                siteUrl: '',
                facebookAppID: facebookAppID,
                facebookLang: facebookLang
            }
          }
        },
        phonegap: {
          files: {
            'phonegap/www/index.html': ['source/html/app.js.html']
          },
          options: {
            context: {
                debug: false,
                includedFiles: includedFiles,
                cordovajs: true,
                siteUrl: 'https://loconomics.com',
                facebookAppID: facebookAppID,
                facebookLang: facebookLang
            }
          }
        },
        phonegapDev: {
          files: {
            'phonegap/www/index.html': ['source/html/app.js.html']
          },
          options: {
            context: {
                debug: true,
                includedFiles: includedFiles,
                cordovajs: true,
                siteUrl: 'http://dev.loconomics.com',
                facebookAppID: facebookAppID,
                facebookLang: facebookLang
            }
          }
        },
        cordovaConfigJson: {
            files: {
                'phonegap/.cordova/config.json': ['source/cordova-config.js.json']
            },
            options: {
                context: {
                    id: '<%= package.appId %>',
                    phonegapbuildId: '<%= package.phonegapbuildId %>',
                    version: '<%= package.version %>'
                }
            }
        },
        cordovaConfigXml: {
            files: {
                'phonegap/www/config.xml': ['source/cordova-config.js.xml']
            },
            options: {
                context: {
                    id: '<%= package.appId %>',
                    version: '<%= package.version %>',
                    name: '<%= package.appName %>',
                    description: '<%= package.appDescription %>',
                    author: {
                      email: 'support@loconomics.com',
                      url: 'https://loconomics.com',
                      text: '<%= package.author %>'
                    },
                    facebookAppID: facebookAppID,
                    facebookLang: facebookLang,
                    facebookAppName: '<%= package.appName %>'
                }
            }
        },
        cordovaConfigXmlDev: {
            files: {
                'phonegap/www/config.xml': ['source/cordova-config.js.xml']
            },
            options: {
                context: {
                    id: '<%= package.devAppId %>',
                    version: '<%= package.version %>',
                    name: '<%= package.devAppName %>',
                    description: '<%= package.appDescription %>',
                    author: {
                      email: 'support@loconomics.com',
                      url: 'https://loconomics.com',
                      text: '<%= package.author %>'
                    },
                    facebookAppID: facebookAppID,
                    facebookLang: facebookLang,
                    facebookAppName: '<%= package.appName %>'
                }
            }
        }
    };
};
