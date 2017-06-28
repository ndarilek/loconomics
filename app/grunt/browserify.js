'use strict';

module.exports = function(/*grunt*/) {

    /**
        Browserify config
    **/
	var bconfig = {
        options: {
            transform: [['stringify', {
                appliesTo: { includeExtensions: ['.html'] },
                minify: true,
                minifyAppliesTo: { includeExtensions: ['.html'] },
                minifyOptions: require('./htmlmin.settings')
            }]]
        }
    };

    /**
        App bundle
    **/
    bconfig.app = {
        'src': [
            './source/js/app.js'
        ],
        'dest': './build/assets/js/app.js',
        'options': {
            // Enable debug evern when compiling script.js, the min.js will delete debug info for production use:
            'debug': false,
            'require': [
                'jquery',
                'bootstrap',
                'bootstrap-switch',
                'jquery.ajaxQueue',

                'moment',
                'numeral',
                'knockout',
                'knockout.mapping',
                //'lodash', // specific modules fetched on demand to minimize the size
                'es6-promise',
                'localforage',
                'is_js',
                'moment-timezone',
                './source/js/custom-modernizr.js:custom-modernizr',
                // Using a specific browser version of events.EventEmitter, to avoid
                // the extra load of NodeJS/Browserify 'events' module that has heavy-unneed
                // dependencies as 'utils'.
                './node_modules/events:events',
                './vendor/iagosrl/ko/formatBinding:ko/formatBinding',
                './vendor/iagosrl/ko/domElementBinding:ko/domElementBinding',
                './vendor/iagosrl/layoutUpdateEvent:layoutUpdateEvent',
                './vendor/iagosrl/throttle:iagosrl/throttle',
                'knockout-sortable',
                'geocomplete',
                'jquery-mobile',
                'fastclick',
                'jquery.ui.touch-punch',
                'jquery.fileupload',
                'load-image',
                'load-image.meta',
                'load-image.ios',
                'jquery.fileupload-process',
                'jquery.fileupload-image'
            ]
        }
    };

    return bconfig;
};
