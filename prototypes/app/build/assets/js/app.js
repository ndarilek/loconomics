;(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
/*!
 * numeral.js
 * version : 1.5.3
 * author : Adam Draper
 * license : MIT
 * http://adamwdraper.github.com/Numeral-js/
 */

(function () {

    /************************************
        Constants
    ************************************/

    var numeral,
        VERSION = '1.5.3',
        // internal storage for language config files
        languages = {},
        currentLanguage = 'en',
        zeroFormat = null,
        defaultFormat = '0,0',
        // check for nodeJS
        hasModule = (typeof module !== 'undefined' && module.exports);


    /************************************
        Constructors
    ************************************/


    // Numeral prototype object
    function Numeral (number) {
        this._value = number;
    }

    /**
     * Implementation of toFixed() that treats floats more like decimals
     *
     * Fixes binary rounding issues (eg. (0.615).toFixed(2) === '0.61') that present
     * problems for accounting- and finance-related software.
     */
    function toFixed (value, precision, roundingFunction, optionals) {
        var power = Math.pow(10, precision),
            optionalsRegExp,
            output;
            
        //roundingFunction = (roundingFunction !== undefined ? roundingFunction : Math.round);
        // Multiply up by precision, round accurately, then divide and use native toFixed():
        output = (roundingFunction(value * power) / power).toFixed(precision);

        if (optionals) {
            optionalsRegExp = new RegExp('0{1,' + optionals + '}$');
            output = output.replace(optionalsRegExp, '');
        }

        return output;
    }

    /************************************
        Formatting
    ************************************/

    // determine what type of formatting we need to do
    function formatNumeral (n, format, roundingFunction) {
        var output;

        // figure out what kind of format we are dealing with
        if (format.indexOf('$') > -1) { // currency!!!!!
            output = formatCurrency(n, format, roundingFunction);
        } else if (format.indexOf('%') > -1) { // percentage
            output = formatPercentage(n, format, roundingFunction);
        } else if (format.indexOf(':') > -1) { // time
            output = formatTime(n, format);
        } else { // plain ol' numbers or bytes
            output = formatNumber(n._value, format, roundingFunction);
        }

        // return string
        return output;
    }

    // revert to number
    function unformatNumeral (n, string) {
        var stringOriginal = string,
            thousandRegExp,
            millionRegExp,
            billionRegExp,
            trillionRegExp,
            suffixes = ['KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'],
            bytesMultiplier = false,
            power;

        if (string.indexOf(':') > -1) {
            n._value = unformatTime(string);
        } else {
            if (string === zeroFormat) {
                n._value = 0;
            } else {
                if (languages[currentLanguage].delimiters.decimal !== '.') {
                    string = string.replace(/\./g,'').replace(languages[currentLanguage].delimiters.decimal, '.');
                }

                // see if abbreviations are there so that we can multiply to the correct number
                thousandRegExp = new RegExp('[^a-zA-Z]' + languages[currentLanguage].abbreviations.thousand + '(?:\\)|(\\' + languages[currentLanguage].currency.symbol + ')?(?:\\))?)?$');
                millionRegExp = new RegExp('[^a-zA-Z]' + languages[currentLanguage].abbreviations.million + '(?:\\)|(\\' + languages[currentLanguage].currency.symbol + ')?(?:\\))?)?$');
                billionRegExp = new RegExp('[^a-zA-Z]' + languages[currentLanguage].abbreviations.billion + '(?:\\)|(\\' + languages[currentLanguage].currency.symbol + ')?(?:\\))?)?$');
                trillionRegExp = new RegExp('[^a-zA-Z]' + languages[currentLanguage].abbreviations.trillion + '(?:\\)|(\\' + languages[currentLanguage].currency.symbol + ')?(?:\\))?)?$');

                // see if bytes are there so that we can multiply to the correct number
                for (power = 0; power <= suffixes.length; power++) {
                    bytesMultiplier = (string.indexOf(suffixes[power]) > -1) ? Math.pow(1024, power + 1) : false;

                    if (bytesMultiplier) {
                        break;
                    }
                }

                // do some math to create our number
                n._value = ((bytesMultiplier) ? bytesMultiplier : 1) * ((stringOriginal.match(thousandRegExp)) ? Math.pow(10, 3) : 1) * ((stringOriginal.match(millionRegExp)) ? Math.pow(10, 6) : 1) * ((stringOriginal.match(billionRegExp)) ? Math.pow(10, 9) : 1) * ((stringOriginal.match(trillionRegExp)) ? Math.pow(10, 12) : 1) * ((string.indexOf('%') > -1) ? 0.01 : 1) * (((string.split('-').length + Math.min(string.split('(').length-1, string.split(')').length-1)) % 2)? 1: -1) * Number(string.replace(/[^0-9\.]+/g, ''));

                // round if we are talking about bytes
                n._value = (bytesMultiplier) ? Math.ceil(n._value) : n._value;
            }
        }
        return n._value;
    }

    function formatCurrency (n, format, roundingFunction) {
        var symbolIndex = format.indexOf('$'),
            openParenIndex = format.indexOf('('),
            minusSignIndex = format.indexOf('-'),
            space = '',
            spliceIndex,
            output;

        // check for space before or after currency
        if (format.indexOf(' $') > -1) {
            space = ' ';
            format = format.replace(' $', '');
        } else if (format.indexOf('$ ') > -1) {
            space = ' ';
            format = format.replace('$ ', '');
        } else {
            format = format.replace('$', '');
        }

        // format the number
        output = formatNumber(n._value, format, roundingFunction);

        // position the symbol
        if (symbolIndex <= 1) {
            if (output.indexOf('(') > -1 || output.indexOf('-') > -1) {
                output = output.split('');
                spliceIndex = 1;
                if (symbolIndex < openParenIndex || symbolIndex < minusSignIndex){
                    // the symbol appears before the "(" or "-"
                    spliceIndex = 0;
                }
                output.splice(spliceIndex, 0, languages[currentLanguage].currency.symbol + space);
                output = output.join('');
            } else {
                output = languages[currentLanguage].currency.symbol + space + output;
            }
        } else {
            if (output.indexOf(')') > -1) {
                output = output.split('');
                output.splice(-1, 0, space + languages[currentLanguage].currency.symbol);
                output = output.join('');
            } else {
                output = output + space + languages[currentLanguage].currency.symbol;
            }
        }

        return output;
    }

    function formatPercentage (n, format, roundingFunction) {
        var space = '',
            output,
            value = n._value * 100;

        // check for space before %
        if (format.indexOf(' %') > -1) {
            space = ' ';
            format = format.replace(' %', '');
        } else {
            format = format.replace('%', '');
        }

        output = formatNumber(value, format, roundingFunction);
        
        if (output.indexOf(')') > -1 ) {
            output = output.split('');
            output.splice(-1, 0, space + '%');
            output = output.join('');
        } else {
            output = output + space + '%';
        }

        return output;
    }

    function formatTime (n) {
        var hours = Math.floor(n._value/60/60),
            minutes = Math.floor((n._value - (hours * 60 * 60))/60),
            seconds = Math.round(n._value - (hours * 60 * 60) - (minutes * 60));
        return hours + ':' + ((minutes < 10) ? '0' + minutes : minutes) + ':' + ((seconds < 10) ? '0' + seconds : seconds);
    }

    function unformatTime (string) {
        var timeArray = string.split(':'),
            seconds = 0;
        // turn hours and minutes into seconds and add them all up
        if (timeArray.length === 3) {
            // hours
            seconds = seconds + (Number(timeArray[0]) * 60 * 60);
            // minutes
            seconds = seconds + (Number(timeArray[1]) * 60);
            // seconds
            seconds = seconds + Number(timeArray[2]);
        } else if (timeArray.length === 2) {
            // minutes
            seconds = seconds + (Number(timeArray[0]) * 60);
            // seconds
            seconds = seconds + Number(timeArray[1]);
        }
        return Number(seconds);
    }

    function formatNumber (value, format, roundingFunction) {
        var negP = false,
            signed = false,
            optDec = false,
            abbr = '',
            abbrK = false, // force abbreviation to thousands
            abbrM = false, // force abbreviation to millions
            abbrB = false, // force abbreviation to billions
            abbrT = false, // force abbreviation to trillions
            abbrForce = false, // force abbreviation
            bytes = '',
            ord = '',
            abs = Math.abs(value),
            suffixes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'],
            min,
            max,
            power,
            w,
            precision,
            thousands,
            d = '',
            neg = false;

        // check if number is zero and a custom zero format has been set
        if (value === 0 && zeroFormat !== null) {
            return zeroFormat;
        } else {
            // see if we should use parentheses for negative number or if we should prefix with a sign
            // if both are present we default to parentheses
            if (format.indexOf('(') > -1) {
                negP = true;
                format = format.slice(1, -1);
            } else if (format.indexOf('+') > -1) {
                signed = true;
                format = format.replace(/\+/g, '');
            }

            // see if abbreviation is wanted
            if (format.indexOf('a') > -1) {
                // check if abbreviation is specified
                abbrK = format.indexOf('aK') >= 0;
                abbrM = format.indexOf('aM') >= 0;
                abbrB = format.indexOf('aB') >= 0;
                abbrT = format.indexOf('aT') >= 0;
                abbrForce = abbrK || abbrM || abbrB || abbrT;

                // check for space before abbreviation
                if (format.indexOf(' a') > -1) {
                    abbr = ' ';
                    format = format.replace(' a', '');
                } else {
                    format = format.replace('a', '');
                }

                if (abs >= Math.pow(10, 12) && !abbrForce || abbrT) {
                    // trillion
                    abbr = abbr + languages[currentLanguage].abbreviations.trillion;
                    value = value / Math.pow(10, 12);
                } else if (abs < Math.pow(10, 12) && abs >= Math.pow(10, 9) && !abbrForce || abbrB) {
                    // billion
                    abbr = abbr + languages[currentLanguage].abbreviations.billion;
                    value = value / Math.pow(10, 9);
                } else if (abs < Math.pow(10, 9) && abs >= Math.pow(10, 6) && !abbrForce || abbrM) {
                    // million
                    abbr = abbr + languages[currentLanguage].abbreviations.million;
                    value = value / Math.pow(10, 6);
                } else if (abs < Math.pow(10, 6) && abs >= Math.pow(10, 3) && !abbrForce || abbrK) {
                    // thousand
                    abbr = abbr + languages[currentLanguage].abbreviations.thousand;
                    value = value / Math.pow(10, 3);
                }
            }

            // see if we are formatting bytes
            if (format.indexOf('b') > -1) {
                // check for space before
                if (format.indexOf(' b') > -1) {
                    bytes = ' ';
                    format = format.replace(' b', '');
                } else {
                    format = format.replace('b', '');
                }

                for (power = 0; power <= suffixes.length; power++) {
                    min = Math.pow(1024, power);
                    max = Math.pow(1024, power+1);

                    if (value >= min && value < max) {
                        bytes = bytes + suffixes[power];
                        if (min > 0) {
                            value = value / min;
                        }
                        break;
                    }
                }
            }

            // see if ordinal is wanted
            if (format.indexOf('o') > -1) {
                // check for space before
                if (format.indexOf(' o') > -1) {
                    ord = ' ';
                    format = format.replace(' o', '');
                } else {
                    format = format.replace('o', '');
                }

                ord = ord + languages[currentLanguage].ordinal(value);
            }

            if (format.indexOf('[.]') > -1) {
                optDec = true;
                format = format.replace('[.]', '.');
            }

            w = value.toString().split('.')[0];
            precision = format.split('.')[1];
            thousands = format.indexOf(',');

            if (precision) {
                if (precision.indexOf('[') > -1) {
                    precision = precision.replace(']', '');
                    precision = precision.split('[');
                    d = toFixed(value, (precision[0].length + precision[1].length), roundingFunction, precision[1].length);
                } else {
                    d = toFixed(value, precision.length, roundingFunction);
                }

                w = d.split('.')[0];

                if (d.split('.')[1].length) {
                    d = languages[currentLanguage].delimiters.decimal + d.split('.')[1];
                } else {
                    d = '';
                }

                if (optDec && Number(d.slice(1)) === 0) {
                    d = '';
                }
            } else {
                w = toFixed(value, null, roundingFunction);
            }

            // format number
            if (w.indexOf('-') > -1) {
                w = w.slice(1);
                neg = true;
            }

            if (thousands > -1) {
                w = w.toString().replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1' + languages[currentLanguage].delimiters.thousands);
            }

            if (format.indexOf('.') === 0) {
                w = '';
            }

            return ((negP && neg) ? '(' : '') + ((!negP && neg) ? '-' : '') + ((!neg && signed) ? '+' : '') + w + d + ((ord) ? ord : '') + ((abbr) ? abbr : '') + ((bytes) ? bytes : '') + ((negP && neg) ? ')' : '');
        }
    }

    /************************************
        Top Level Functions
    ************************************/

    numeral = function (input) {
        if (numeral.isNumeral(input)) {
            input = input.value();
        } else if (input === 0 || typeof input === 'undefined') {
            input = 0;
        } else if (!Number(input)) {
            input = numeral.fn.unformat(input);
        }

        return new Numeral(Number(input));
    };

    // version number
    numeral.version = VERSION;

    // compare numeral object
    numeral.isNumeral = function (obj) {
        return obj instanceof Numeral;
    };

    // This function will load languages and then set the global language.  If
    // no arguments are passed in, it will simply return the current global
    // language key.
    numeral.language = function (key, values) {
        if (!key) {
            return currentLanguage;
        }

        if (key && !values) {
            if(!languages[key]) {
                throw new Error('Unknown language : ' + key);
            }
            currentLanguage = key;
        }

        if (values || !languages[key]) {
            loadLanguage(key, values);
        }

        return numeral;
    };
    
    // This function provides access to the loaded language data.  If
    // no arguments are passed in, it will simply return the current
    // global language object.
    numeral.languageData = function (key) {
        if (!key) {
            return languages[currentLanguage];
        }
        
        if (!languages[key]) {
            throw new Error('Unknown language : ' + key);
        }
        
        return languages[key];
    };

    numeral.language('en', {
        delimiters: {
            thousands: ',',
            decimal: '.'
        },
        abbreviations: {
            thousand: 'k',
            million: 'm',
            billion: 'b',
            trillion: 't'
        },
        ordinal: function (number) {
            var b = number % 10;
            return (~~ (number % 100 / 10) === 1) ? 'th' :
                (b === 1) ? 'st' :
                (b === 2) ? 'nd' :
                (b === 3) ? 'rd' : 'th';
        },
        currency: {
            symbol: '$'
        }
    });

    numeral.zeroFormat = function (format) {
        zeroFormat = typeof(format) === 'string' ? format : null;
    };

    numeral.defaultFormat = function (format) {
        defaultFormat = typeof(format) === 'string' ? format : '0.0';
    };

    /************************************
        Helpers
    ************************************/

    function loadLanguage(key, values) {
        languages[key] = values;
    }

    /************************************
        Floating-point helpers
    ************************************/

    // The floating-point helper functions and implementation
    // borrows heavily from sinful.js: http://guipn.github.io/sinful.js/

    /**
     * Array.prototype.reduce for browsers that don't support it
     * https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/Reduce#Compatibility
     */
    if ('function' !== typeof Array.prototype.reduce) {
        Array.prototype.reduce = function (callback, opt_initialValue) {
            'use strict';
            
            if (null === this || 'undefined' === typeof this) {
                // At the moment all modern browsers, that support strict mode, have
                // native implementation of Array.prototype.reduce. For instance, IE8
                // does not support strict mode, so this check is actually useless.
                throw new TypeError('Array.prototype.reduce called on null or undefined');
            }
            
            if ('function' !== typeof callback) {
                throw new TypeError(callback + ' is not a function');
            }

            var index,
                value,
                length = this.length >>> 0,
                isValueSet = false;

            if (1 < arguments.length) {
                value = opt_initialValue;
                isValueSet = true;
            }

            for (index = 0; length > index; ++index) {
                if (this.hasOwnProperty(index)) {
                    if (isValueSet) {
                        value = callback(value, this[index], index, this);
                    } else {
                        value = this[index];
                        isValueSet = true;
                    }
                }
            }

            if (!isValueSet) {
                throw new TypeError('Reduce of empty array with no initial value');
            }

            return value;
        };
    }

    
    /**
     * Computes the multiplier necessary to make x >= 1,
     * effectively eliminating miscalculations caused by
     * finite precision.
     */
    function multiplier(x) {
        var parts = x.toString().split('.');
        if (parts.length < 2) {
            return 1;
        }
        return Math.pow(10, parts[1].length);
    }

    /**
     * Given a variable number of arguments, returns the maximum
     * multiplier that must be used to normalize an operation involving
     * all of them.
     */
    function correctionFactor() {
        var args = Array.prototype.slice.call(arguments);
        return args.reduce(function (prev, next) {
            var mp = multiplier(prev),
                mn = multiplier(next);
        return mp > mn ? mp : mn;
        }, -Infinity);
    }        


    /************************************
        Numeral Prototype
    ************************************/


    numeral.fn = Numeral.prototype = {

        clone : function () {
            return numeral(this);
        },

        format : function (inputString, roundingFunction) {
            return formatNumeral(this, 
                  inputString ? inputString : defaultFormat, 
                  (roundingFunction !== undefined) ? roundingFunction : Math.round
              );
        },

        unformat : function (inputString) {
            if (Object.prototype.toString.call(inputString) === '[object Number]') { 
                return inputString; 
            }
            return unformatNumeral(this, inputString ? inputString : defaultFormat);
        },

        value : function () {
            return this._value;
        },

        valueOf : function () {
            return this._value;
        },

        set : function (value) {
            this._value = Number(value);
            return this;
        },

        add : function (value) {
            var corrFactor = correctionFactor.call(null, this._value, value);
            function cback(accum, curr, currI, O) {
                return accum + corrFactor * curr;
            }
            this._value = [this._value, value].reduce(cback, 0) / corrFactor;
            return this;
        },

        subtract : function (value) {
            var corrFactor = correctionFactor.call(null, this._value, value);
            function cback(accum, curr, currI, O) {
                return accum - corrFactor * curr;
            }
            this._value = [value].reduce(cback, this._value * corrFactor) / corrFactor;            
            return this;
        },

        multiply : function (value) {
            function cback(accum, curr, currI, O) {
                var corrFactor = correctionFactor(accum, curr);
                return (accum * corrFactor) * (curr * corrFactor) /
                    (corrFactor * corrFactor);
            }
            this._value = [this._value, value].reduce(cback, 1);
            return this;
        },

        divide : function (value) {
            function cback(accum, curr, currI, O) {
                var corrFactor = correctionFactor(accum, curr);
                return (accum * corrFactor) / (curr * corrFactor);
            }
            this._value = [this._value, value].reduce(cback);            
            return this;
        },

        difference : function (value) {
            return Math.abs(numeral(this._value).subtract(value).value());
        }

    };

    /************************************
        Exposing Numeral
    ************************************/

    // CommonJS module is defined
    if (hasModule) {
        module.exports = numeral;
    }

    /*global ender:false */
    if (typeof ender === 'undefined') {
        // here, `this` means `window` in the browser, or `global` on the server
        // add `numeral` as a global object via a string identifier,
        // for Closure Compiler 'advanced' mode
        this['numeral'] = numeral;
    }

    /*global define:false */
    if (typeof define === 'function' && define.amd) {
        define([], function () {
            return numeral;
        });
    }
}).call(this);

},{}],2:[function(require,module,exports){
/**
    Account activity
**/
'use strict';

var singleton = null,
    NavAction = require('../viewmodels/NavAction'),
    NavBar = require('../viewmodels/NavBar');

exports.init = function initAccount($activity, app) {

    if (singleton === null)
        singleton = new AccountActivity($activity, app);
    
    return singleton;
};

function AccountActivity($activity, app) {
    
    this.accessLevel = app.UserType.LoggedUser;

    this.$activity = $activity;
    this.app = app;
    
    this.navBar = new NavBar({
        title: 'Account',
        leftAction: NavAction.menuNewItem,
        rightAction: NavAction.menuIn
    });
}

AccountActivity.prototype.show = function show(options) {

};

},{"../viewmodels/NavAction":75,"../viewmodels/NavBar":76}],3:[function(require,module,exports){
/** Calendar activity **/
'use strict';

var $ = require('jquery'),
    moment = require('moment'),
    ko = require('knockout'),
    NavAction = require('../viewmodels/NavAction'),
    NavBar = require('../viewmodels/NavBar');
require('../components/DatePicker');

var singleton = null;

exports.init = function initAppointment($activity, app) {

    if (singleton === null)
        singleton = new AppointmentActivity($activity, app);
    
    return singleton;
};

function AppointmentActivity($activity, app) {

    this.accessLevel = app.UserType.Provider;
    this.menuItem = 'calendar';
    
    /* Getting elements */
    this.$activity = $activity;
    this.$appointmentView = $activity.find('#calendarAppointmentView');
    this.$chooseNew = $('#calendarChooseNew');
    this.app = app;
    
    // Object to hold the options passed on 'show' as a result
    // of a request from another activity
    this.requestInfo = null;
    
    // Create a specific backAction that shows current date
    // and return to calendar in current date.
    // Later some more changes are applied, with viewmodel ready
    var backAction = new NavAction({
        link: 'calendar/', // Preserve last slash, for later use
        icon: NavAction.goBack.icon(),
        isTitle: true,
        text: 'Calendar'
    });
    this.navBar = new NavBar({
        title: '',
        leftAction: backAction,
        rightAction: NavAction.goHelpIndex
    });
    
    this.initAppointment();
    
    // This title text is dynamic, we need to replace it by a computed observable
    // showing the current date
    var defBackText = backAction.text._initialValue;
    backAction.text = ko.computed(function() {

        var d = this.appointmentsDataView.currentDate();
        if (!d)
            // Fallback to the default title
            return defBackText;

        var m = moment(d);
        var t = m.format('dddd [(]M/D[)]');
        return t;
    }, this);
    // And the link is dynamic too, to allow return to the date
    // that matches current appointment
    var defLink = backAction.link._initialValue;
    backAction.link = ko.computed(function() {

        var d = this.appointmentsDataView.currentDate();
        if (!d)
            // Fallback to the default link
            return defLink;

        return defLink + d.toISOString();
    }, this);
    
    this.appointmentsDataView.currentAppointment.subscribe(function (apt) {
        // Update URL to match the appointment ID and
        // track it state
        // Get ID from URL, to avoid do anything if the same.
        var aptId = apt.id();
        var urlId = /appointment\/(\d+)/i.test(window.location);
        urlId = urlId && urlId[1] || '';
        if (urlId !== '0' && aptId !== null && urlId !== aptId.toString()) {
            // TODO: save a useful state
            app.shell.history.pushState(null, null, 'appointment/' + aptId);
        }
    });
}

AppointmentActivity.prototype.show = function show(options) {
    /* jshint maxcomplexity:10 */
    this.requestInfo = options || {};
    
    // If there are options (there are not on startup or
    // on cancelled edition).
    // And it comes back from the textEditor.
    if (options !== null) {

        var booking = this.appointmentsDataView.currentAppointment();

        if (options.request === 'textEditor' && booking) {

            booking[options.field](options.text);
        }
        else if (options.selectClient === true && booking) {

            booking.client(options.selectedClient);
        }
        else if (typeof(options.selectedDatetime) !== 'undefined' && booking) {

            booking.startTime(options.selectedDatetime);
            // TODO Calculate the endTime given an appointment duration, retrieved from the
            // selected service
            //var duration = booking.pricing && booking.pricing.duration;
            // Or by default (if no pricing selected or any) the user preferred
            // time gap
            //duration = duration || user.preferences.timeSlotsGap;
            // PROTOTYPE:
            var duration = 60; // minutes
            booking.endTime(moment(booking.startTime()).add(duration, 'minutes').toDate());
        }
        else if (options.selectServices === true && booking) {

            booking.services(options.selectedServices);
        }
        else if (options.selectLocation === true && booking) {

            booking.location(options.selectedLocation);
        }
    }
    
    var aptId = options && options.route && options.route.segments[0];
    aptId = parseInt(aptId, 10);
    aptId = aptId || 0;
    this.showAppointment(aptId);
};

var Appointment = require('../models/Appointment');

AppointmentActivity.prototype.showAppointment = function showAppointment(aptId) {
    /*jshint maxstatements:36*/

    if (aptId) {
        // TODO: select appointment 'aptId'
        

    } else if (aptId === 0) {
        this.appointmentsDataView.newAppointment(new Appointment());
        this.appointmentsDataView.editMode(true);        
    }
};

AppointmentActivity.prototype.initAppointment = function initAppointment() {
    if (!this.__initedAppointment) {
        this.__initedAppointment = true;

        var app = this.app;
        
        // Data
        var testData = require('../testdata/calendarAppointments').appointments;
        var appointmentsDataView = {
            appointments: ko.observableArray(testData),
            currentIndex: ko.observable(0),
            editMode: ko.observable(false),
            newAppointment: ko.observable(null)
        };
        
        this.appointmentsDataView = appointmentsDataView;
        
        appointmentsDataView.isNew = ko.computed(function(){
            return this.newAppointment() !== null;
        }, appointmentsDataView);
        
        appointmentsDataView.currentAppointment = ko.computed({
            read: function() {
                if (this.isNew()) {
                    return this.newAppointment();
                }
                else {
                    return this.appointments()[this.currentIndex() % this.appointments().length];
                }
            },
            write: function(apt) {
                var index = this.currentIndex() % this.appointments().length;
                this.appointments()[index] = apt;
                this.appointments.valueHasMutated();
            },
            owner: appointmentsDataView
        });
        
        appointmentsDataView.originalEditedAppointment = {};
 
        appointmentsDataView.goPrevious = function goPrevious() {
            if (this.editMode()) return;
        
            if (this.currentIndex() === 0)
                this.currentIndex(this.appointments().length - 1);
            else
                this.currentIndex((this.currentIndex() - 1) % this.appointments().length);
        };
        
        appointmentsDataView.goNext = function goNext() {
            if (this.editMode()) return;

            this.currentIndex((this.currentIndex() + 1) % this.appointments().length);
        };

        appointmentsDataView.edit = function edit() {
            this.editMode(true);
        }.bind(appointmentsDataView);
        
        appointmentsDataView.cancel = function cancel() {
            
            // if is new, discard
            if (this.isNew()) {
                this.newAppointment(null);
            }
            else {
                // revert changes
                this.currentAppointment(new Appointment(this.originalEditedAppointment));
            }

            this.editMode(false);
        }.bind(appointmentsDataView);
        
        appointmentsDataView.save = function save() {
            // If is a new one, add it to the collection
            if (this.isNew()) {
                
                var newApt = this.newAppointment();
                // TODO: some fieds need some kind of calculation that is persisted
                // son cannot be computed. Simulated:
                newApt.summary('Massage Therapist Booking');
                newApt.id(4);
                
                // Add to the list:
                this.appointments.push(newApt);
                // now, reset
                this.newAppointment(null);
                // current index must be the just-added apt
                this.currentIndex(this.appointments().length - 1);
                
                // On adding a new one, the confirmation page must be showed
                app.shell.go('bookingConfirmation', {
                    booking: newApt
                });
            }

            this.editMode(false);
        }.bind(appointmentsDataView);
        
        appointmentsDataView.editMode.subscribe(function(isEdit) {
            
            this.$activity.toggleClass('in-edit', isEdit);
            this.$appointmentView.find('.AppointmentCard').toggleClass('in-edit', isEdit);
            
            if (isEdit) {
                // Create a copy of the appointment so we revert on 'cancel'
                appointmentsDataView.originalEditedAppointment = 
                    ko.toJS(appointmentsDataView.currentAppointment());
            }
            
        }.bind(this));
        
        appointmentsDataView.pickDateTime = function pickDateTime() {

            app.shell.go('datetimePicker', {
                selectedDatetime: null
            });
        };
        
        appointmentsDataView.pickClient = function pickClient() {

            app.shell.go('clients', {
                selectClient: true,
                selectedClient: null
            });
        };

        appointmentsDataView.pickService = function pickService() {

            app.shell.go('services', {
                selectServices: true,
                selectedServices: appointmentsDataView.currentAppointment().services()
            });
        };

        appointmentsDataView.changePrice = function changePrice() {
            // TODO
        };
        
        appointmentsDataView.pickLocation = function pickLocation() {

            app.shell.go('locations', {
                selectLocation: true,
                selectedLocation: appointmentsDataView.currentAppointment().location()
            });
        };

        var textFieldsHeaders = {
            preNotesToClient: 'Notes to client',
            postNotesToClient: 'Notes to client (afterwards)',
            preNotesToSelf: 'Notes to self',
            postNotesToSelf: 'Booking summary'
        };
        
        appointmentsDataView.editTextField = function editTextField(field) {

            app.shell.go('textEditor', {
                request: 'textEditor',
                field: field,
                title: appointmentsDataView.isNew() ? 'New booking' : 'Booking',
                header: textFieldsHeaders[field],
                text: appointmentsDataView.currentAppointment()[field]()
            });
        }.bind(this);
        
        appointmentsDataView.currentDate = ko.computed(function() {
            
            var apt = this.currentAppointment(),
                justDate = null;

            if (apt && apt.startTime())
                justDate = moment(apt.startTime()).hours(0).minutes(0).seconds(0).toDate();
            
            return justDate;
        }, appointmentsDataView);
        
        ko.applyBindings(appointmentsDataView, this.$activity.get(0));
    }
};

},{"../components/DatePicker":27,"../models/Appointment":30,"../testdata/calendarAppointments":46,"../viewmodels/NavAction":75,"../viewmodels/NavBar":76,"knockout":false,"moment":false}],4:[function(require,module,exports){
/**
    bookingConfirmation activity
**/
'use strict';

var $ = require('jquery'),
    ko = require('knockout');
    
var singleton = null;

exports.init = function initClients($activity, app) {

    if (singleton === null)
        singleton = new BookingConfirmationActivity($activity, app);
    
    return singleton;
};

function BookingConfirmationActivity($activity, app) {

    this.accessLevel = app.UserType.LoggedUser;
    
    this.$activity = $activity;
    this.app = app;

    this.dataView = new ViewModel();
    ko.applyBindings(this.dataView, $activity.get(0));
}

BookingConfirmationActivity.prototype.show = function show(options) {

    if (options && options.booking)
        this.dataView.booking(options.booking);
};

function ViewModel() {

    // :Appointment
    this.booking = ko.observable(null);
}

},{"knockout":false}],5:[function(require,module,exports){
/** Calendar activity **/
'use strict';

var $ = require('jquery'),
    moment = require('moment');
require('../components/DatePicker');
var ko = require('knockout');
var CalendarSlot = require('../models/CalendarSlot'),
    NavBar = require('../viewmodels/NavBar'),
    NavAction = require('../viewmodels/NavAction');

var singleton = null;

exports.init = function initCalendar($activity, app) {

    if (singleton === null)
        singleton = new CalendarActivity($activity, app);
    
    return singleton;
};

function CalendarActivity($activity, app) {

    this.accessLevel = app.UserType.LoggedUser;
    this.navBar = new NavBar({
        title: 'Calendar',
        leftAction: NavAction.menuNewItem,
        rightAction: NavAction.menuIn
    });
    
    /* Getting elements */
    this.$activity = $activity;
    this.$datepicker = $activity.find('#calendarDatePicker');
    this.$dailyView = $activity.find('#calendarDailyView');
    this.$dateHeader = $activity.find('#calendarDateHeader');
    this.$dateTitle = this.$dateHeader.children('.CalendarDateHeader-date');
    this.$chooseNew = $('#calendarChooseNew');
    this.app = app;
    
    /* Init components */
    this.$datepicker.show().datepicker();

    // Data
    this.dataView = new ViewModel();
    ko.applyBindings(this.dataView, $activity.get(0));

    // Testing data
    this.dataView.slotsData(require('../testdata/calendarSlots').calendar);
    
    // Object to hold the options passed on 'show' as a result
    // of a request from another activity
    this.requestInfo = null;

    /* Event handlers */
    // Changes on currentDate
    this.dataView.currentDate.subscribe(function(date) {
        
        if (date) {
            var mdate = moment(date);

            if (mdate.isValid()) {
                
                var isoDate = mdate.toISOString();
                
                // Update datepicker selected date on date change (from 
                // a different source than the datepicker itself
                this.$datepicker.removeClass('is-visible');
                // Change not from the widget?
                if (this.$datepicker.datepicker('getValue').toISOString() !== isoDate)
                    this.$datepicker.datepicker('setValue', date, true);

                // On currentDate changes, update the URL
                // TODO: save a useful state
                // DOUBT: push or replace state? (more history entries or the same?)
                app.shell.history.pushState(null, null, 'calendar/' + isoDate);
                
                // DONE
                return;
            }
        }
        
        // Something fail, bad date or not date at all
        // Set the current one
        this.dataView.currentDate(new Date());

    }.bind(this));

    // Swipe date on gesture
    this.$dailyView
    .on('swipeleft swiperight', function(e) {
        e.preventDefault();
        
        var dir = e.type === 'swipeleft' ? 'next' : 'prev';
        
        // Hack to solve the freezy-swipe and tap-after bug on JQM:
        $(document).trigger('touchend');
        // Change date
        this.$datepicker.datepicker('moveValue', dir, 'date');

    }.bind(this));
    
    // Changing date with buttons:
    this.$dateHeader.on('tap', '.CalendarDateHeader-switch', function(e) {
        switch (e.currentTarget.getAttribute('href')) {
            case '#prev':
                this.$datepicker.datepicker('moveValue', 'prev', 'date');
                break;
            case '#next':
                this.$datepicker.datepicker('moveValue', 'next', 'date');
                break;
            default:
                // Lets default:
                return;
        }
        e.preventDefault();
        e.stopPropagation();
    }.bind(this));

    // Showing datepicker when pressing the title
    this.$dateTitle.on('tap', function(e) {
        this.$datepicker.toggleClass('is-visible');
        e.preventDefault();
        e.stopPropagation();
    }.bind(this));

    // Updating view date when picked another one
    this.$datepicker.on('changeDate', function(e) {
        if (e.viewMode === 'days') {
            this.dataView.currentDate(e.date);
        }
    }.bind(this));

    // Set date to match datepicker for first update
    this.dataView.currentDate(this.$datepicker.datepicker('getValue'));
}

CalendarActivity.prototype.show = function show(options) {
    /* jshint maxcomplexity:10 */
    
    if (options && options.route && options.route.segments) {
        var sdate = options.route.segments[0],
            mdate = moment(sdate),
            date = mdate.isValid() ? mdate.toDate() : null;

        if (date)
            this.dataView.currentDate(date);
    }
};

function ViewModel() {

    this.slots = ko.observableArray([]);
    this.slotsData = ko.observable({});
    this.currentDate = ko.observable(new Date());
    
    // Update current slots on date change
    this.currentDate.subscribe(function (date) {

        var mdate = moment(date),
            sdate = mdate.format('YYYY-MM-DD');
        
        var slots = this.slotsData();

        if (slots.hasOwnProperty(sdate)) {
            this.slots(slots[sdate]);
        } else {
            this.slots(slots['default']);
        }
    }.bind(this));
}

},{"../components/DatePicker":27,"../models/CalendarSlot":33,"../testdata/calendarSlots":47,"../viewmodels/NavAction":75,"../viewmodels/NavBar":76,"knockout":false,"moment":false}],6:[function(require,module,exports){
/**
    clients activity
**/
'use strict';

var $ = require('jquery'),
    ko = require('knockout'),
    NavBar = require('../viewmodels/NavBar'),
    NavAction = require('../viewmodels/NavAction');
    
var singleton = null;

exports.init = function initClients($activity, app) {

    if (singleton === null)
        singleton = new ClientsActivity($activity, app);
    
    return singleton;
};

function ClientsActivity($activity, app) {

    this.accessLevel = app.UserType.Provider;
    this.navBar = new NavBar({
        title: 'Clients',
        leftAction: NavAction.menuNewItem,
        rightAction: NavAction.menuIn
    });
    // NOTE: For client-edit activity, use this:
    /*
    this.navBar = new NavBar({
        title: '',
        leftAction: NavAction.goBack.model.clone({
            text: 'Clients'
        }),
        rightAction: NavAction.goHelpIndex
    });
    */
    
    this.$activity = $activity;
    this.app = app;
    this.$index = $activity.find('#clientsIndex');
    this.$listView = $activity.find('#clientsListView');

    this.dataView = new ViewModel();
    ko.applyBindings(this.dataView, $activity.get(0));

    // TestingData
    this.dataView.clients(require('../testdata/clients').clients);
    
    // Handler to update header based on a mode change:
    this.dataView.isSelectionMode.subscribe(function (itIs) {
        this.dataView.headerText(itIs ? 'Select a client' : 'Clients');
    }.bind(this));

    // Object to hold the options passed on 'show' as a result
    // of a request from another activity
    this.requestInfo = null;
    
    // Handler to go back with the selected client when 
    // selection mode goes off and requestInfo is for
    // 'select mode'
    this.dataView.isSelectionMode.subscribe(function (itIs) {
        // We have a request and
        // it requested to select a client
        // and selection mode goes off
        if (this.requestInfo &&
            this.requestInfo.selectClient === true &&
            itIs === false) {
            
            // Pass the selected client in the info
            this.requestInfo.selectedClient = this.dataView.selectedClient();
            // And go back
            this.app.shell.goBack(this.requestInfo);
            // Last, clear requestInfo
            this.requestInfo = null;
        }
    }.bind(this));
}

ClientsActivity.prototype.show = function show(options) {

    // On every show, search gets reseted
    this.dataView.searchText('');
  
    options = options || {};
    this.requestInfo = options;

    if (options.selectClient === true)
        this.dataView.isSelectionMode(true);
};

function ViewModel() {

    this.headerText = ko.observable('Clients');

    // Especial mode when instead of pick and edit we are just selecting
    // (when editing an appointment)
    this.isSelectionMode = ko.observable(false);

    // Full list of clients
    this.clients = ko.observableArray([]);
    
    // Search text, used to filter 'clients'
    this.searchText = ko.observable('');
    
    // Utility to get a filtered list of clients based on clients
    this.getFilteredList = function getFilteredList() {
        var s = (this.searchText() || '').toLowerCase();

        return this.clients().filter(function(client) {
            var n = client && client.fullName() && client.fullName() || '';
            n = n.toLowerCase();
            return n.indexOf(s) > -1;
        });
    };

    // Filtered list of clients
    this.filteredClients = ko.computed(function() {
        return this.getFilteredList();
    }, this);
    
    // Grouped list of filtered clients
    this.groupedClients = ko.computed(function(){

        var clients = this.filteredClients().sort(function(clientA, clientB) {
            return clientA.firstName() > clientB.firstName();
        });
        
        var groups = [],
            latestGroup = null,
            latestLetter = null;

        clients.forEach(function(client) {
            var letter = (client.firstName()[0] || '').toUpperCase();
            if (letter !== latestLetter) {
                latestGroup = {
                    letter: letter,
                    clients: [client]
                };
                groups.push(latestGroup);
                latestLetter = letter;
            }
            else {
                latestGroup.clients.push(client);
            }
        });

        return groups;

    }, this);
    
    this.selectedClient = ko.observable(null);
    
    this.selectClient = function(selectedClient) {
        
        this.selectedClient(selectedClient);
        this.isSelectionMode(false);

    }.bind(this);
}

},{"../testdata/clients":48,"../viewmodels/NavAction":75,"../viewmodels/NavBar":76,"knockout":false}],7:[function(require,module,exports){
/**
    ContactInfo activity
**/
'use strict';

var singleton = null,
    ko = require('knockout'),
    NavBar = require('../viewmodels/NavBar'),
    NavAction = require('../viewmodels/NavAction');

exports.init = function initContactInfo($activity, app) {

    if (singleton === null)
        singleton = new ContactInfoActivity($activity, app);
    
    return singleton;
};

function ContactInfoActivity($activity, app) {

    this.accessLevel = app.UserType.LoggedUser;
    
    this.$activity = $activity;
    this.app = app;
    this.dataView = new ViewModel();
    this.dataView.profile = app.model.user;
    ko.applyBindings(this.dataView, $activity.get(0));

    this.navBar = new NavBar({
        title: '',
        leftAction: NavAction.goBack.model.clone({
            text: 'Account',
            isTitle: true
        }),
        rightAction: NavAction.goHelpIndex
    });
    
    app.model.user().onboardingStep.subscribe(function (step) {
        
        if (step) {
            // TODO Set navbar step index
            // Setting navbar for Onboarding/wizard mode
            this.navBar.leftAction().text('');
            // Setting header
            this.dataView.headerText('How can we reach you?');
            this.dataView.buttonText('Save and continue');
        }
        else {
            // TODO Remove step index
            // Setting navbar to default
            this.navBar.leftAction().text('Account');
            // Setting header to default
            this.dataView.headerText('Contact information');
            this.dataView.buttonText('Save');
        }
    }.bind(this));
}

ContactInfoActivity.prototype.show = function show(options) {

};

function ViewModel() {

    this.headerText = ko.observable('Contact information');
    this.buttonText = ko.observable('Save');
    this.profile = ko.observable();
}

},{"../viewmodels/NavAction":75,"../viewmodels/NavBar":76,"knockout":false}],8:[function(require,module,exports){
/**
    datetimePicker activity
**/
'use strict';

var $ = require('jquery'),
    moment = require('moment'),
    ko = require('knockout'),
    Time = require('../utils/Time'),
    NavBar = require('../viewmodels/NavBar'),
    NavAction = require('../viewmodels/NavAction');
require('../components/DatePicker');
    
var singleton = null;

exports.init = function initDatetimePicker($activity, app) {

    if (singleton === null)
        singleton = new DatetimePickerActivity($activity, app);

    return singleton;
};

function DatetimePickerActivity($activity, app) {

    this.accessLevel = app.UserType.LoggedUser;
    this.navBar = new NavBar({
        title: '',
        leftAction: NavAction.goBack,
        rightAction: NavAction.goHelpIndex
    });
    
    this.app = app;
    this.$activity = $activity;
    this.$datePicker = $activity.find('#datetimePickerDatePicker');
    this.$timePicker = $activity.find('#datetimePickerTimePicker');

    /* Init components */
    this.$datePicker.show().datepicker();
    
    var dataView = this.dataView = new ViewModel();
    dataView.headerText = 'Select a start time';
    ko.applyBindings(dataView, $activity.get(0));
    
    // Events
    this.$datePicker.on('changeDate', function(e) {
        if (e.viewMode === 'days') {
            dataView.selectedDate(e.date);
        }
    }.bind(this));
    
    // TestingData
    dataView.slotsData = require('../testdata/timeSlots').timeSlots;
 
    dataView.selectedDate.subscribe(function(date) {
        this.bindDateData(date);
    }.bind(this));

    this.bindDateData(new Date());
    
    // Object to hold the options passed on 'show' as a result
    // of a request from another activity
    this.requestInfo = null;
    
    // Handler to go back with the selected date-time when
    // that selection is done (could be to null)
    this.dataView.selectedDatetime.subscribe(function (datetime) {
        // We have a request
        if (this.requestInfo) {
            // Pass the selected datetime in the info
            this.requestInfo.selectedDatetime = this.dataView.selectedDatetime();
            // And go back
            this.app.shell.goBack(this.requestInfo);
            // Last, clear requestInfo
            this.requestInfo = null;
        }
    }.bind(this));
}

DatetimePickerActivity.prototype.show = function show(options) {
  
    options = options || {};
    this.requestInfo = options;
};

DatetimePickerActivity.prototype.bindDateData = function bindDateData(date) {

    var sdate = moment(date).format('YYYY-MM-DD');
    var slotsData = this.dataView.slotsData;

    if (slotsData.hasOwnProperty(sdate)) {
        this.dataView.slots(slotsData[sdate]);
    } else {
        this.dataView.slots(slotsData['default']);
    }
};

function ViewModel() {

    this.headerText = ko.observable('Select a time');
    this.selectedDate = ko.observable(new Date());
    this.slotsData = {};
    this.slots = ko.observableArray([]);
    this.groupedSlots = ko.computed(function(){
        /*
          before 12:00pm (noon) = morning
          afternoon: 12:00pm until 5:00pm
          evening: 5:00pm - 11:59pm
        */
        // Since slots must be for the same date,
        // to define the groups ranges use the first date
        var datePart = this.slots() && this.slots()[0] || new Date();
        var groups = [
            {
                group: 'Morning',
                slots: [],
                starts: new Time(datePart, 0, 0),
                ends: new Time(datePart, 12, 0)
            },
            {
                group: 'Afternoon',
                slots: [],
                starts: new Time(datePart, 12, 0),
                ends: new Time(datePart, 17, 0)
            },
            {
                group: 'Evening',
                slots: [],
                starts: new Time(datePart, 17, 0),
                ends: new Time(datePart, 24, 0)
            }
        ];
        var slots = this.slots().sort();
        slots.forEach(function(slot) {
            groups.forEach(function(group) {
                if (slot >= group.starts &&
                    slot < group.ends) {
                    group.slots.push(slot);
                }
            });
        });

        return groups;

    }, this);
    
    this.selectedDatetime = ko.observable(null);
    
    this.selectDatetime = function(selectedDatetime) {
        
        this.selectedDatetime(selectedDatetime);

    }.bind(this);

}

},{"../components/DatePicker":27,"../testdata/timeSlots":52,"../utils/Time":56,"../viewmodels/NavAction":75,"../viewmodels/NavBar":76,"knockout":false,"moment":false}],9:[function(require,module,exports){
/**
    Home activity
**/
'use strict';

var $ = require('jquery'),
    ko = require('knockout'),
    NavBar = require('../viewmodels/NavBar'),
    NavAction = require('../viewmodels/NavAction');

var singleton = null;

exports.init = function initHome($activity, app) {

    if (singleton === null)
        singleton = new HomeActivity($activity, app);
    
    return singleton;
};

function HomeActivity($activity, app) {
    
    this.accessLevel = app.UserType.Provider;
    this.navBar = new NavBar({
        title: null, // null for logo
        leftAction: NavAction.menuNewItem,
        rightAction: NavAction.menuIn
    });

    this.$activity = $activity;
    this.app = app;
    this.$nextBooking = $activity.find('#homeNextBooking');
    this.$upcomingBookings = $activity.find('#homeUpcomingBookings');
    this.$inbox = $activity.find('#homeInbox');
    this.$performance = $activity.find('#homePerformance');
    this.$getMore = $activity.find('#homeGetMore');

    this.dataView = new ViewModel();
    ko.applyBindings(this.dataView, $activity.get(0));

    // TestingData
    setSomeTestingData(this.dataView);

    // Object to hold the options passed on 'show' as a result
    // of a request from another activity
    this.requestInfo = null;
}

HomeActivity.prototype.show = function show(options) {
 
    options = options || {};
    this.requestInfo = options;
    var v = this.dataView,
        appModel = this.app.model;
    
    // Update data
    appModel.getUpcomingBookings().then(function(upcoming) {

        if (upcoming.nextBookingID)
            appModel.getBooking(upcoming.nextBookingID).then(v.nextBooking);
        else
            v.nextBooking(null);

        v.upcomingBookings.today.quantity(upcoming.today.quantity);
        v.upcomingBookings.today.time(upcoming.today.time && new Date(upcoming.today.time));
        v.upcomingBookings.tomorrow.quantity(upcoming.tomorrow.quantity);
        v.upcomingBookings.tomorrow.time(upcoming.tomorrow.time && new Date(upcoming.tomorrow.time));
        v.upcomingBookings.nextWeek.quantity(upcoming.nextWeek.quantity);
    });
};

var UpcomingBookingsSummary = require('../models/UpcomingBookingsSummary'),
    MailFolder = require('../models/MailFolder'),
    PerformanceSummary = require('../models/PerformanceSummary'),
    GetMore = require('../models/GetMore');

function ViewModel() {

    this.upcomingBookings = new UpcomingBookingsSummary();

    // :Appointment
    this.nextBooking = ko.observable(null);
    
    this.inbox = new MailFolder({
        topNumber: 4
    });
    
    this.performance = new PerformanceSummary();
    
    this.getMore = new GetMore();
}

/** TESTING DATA **/
var Time = require('../utils/Time');

function setSomeTestingData(dataView) {
    
    dataView.inbox.messages(require('../testdata/messages').messages);
    
    dataView.performance.earnings.currentAmount(2400);
    dataView.performance.earnings.nextAmount(6200.54);
    dataView.performance.timeBooked.percent(0.93);
    
    dataView.getMore.model.updateWith({
        availability: true,
        payments: true,
        profile: true,
        coop: true
    });
}

},{"../models/GetMore":35,"../models/MailFolder":38,"../models/PerformanceSummary":41,"../models/UpcomingBookingsSummary":44,"../testdata/messages":50,"../utils/Time":56,"../viewmodels/NavAction":75,"../viewmodels/NavBar":76,"knockout":false}],10:[function(require,module,exports){
/**
    Index activity
**/
'use strict';

var singleton = null,
    NavBar = require('../viewmodels/NavBar'),
    NavAction = require('../viewmodels/NavAction');

exports.init = function initIndex($activity, app) {

    if (singleton === null)
        singleton = new IndexActivity($activity, app);
    
    return singleton;
};

function IndexActivity($activity, app) {

    this.$activity = $activity;
    this.app = app;
    
    this.navBar = new NavBar({
        title: null, // null for logo
        leftAction: NavAction.goLogin,
        rightAction: NavAction.menuOut
    });
    
    // Any user can access this
    this.accessLevel = null;
}

IndexActivity.prototype.show = function show(options) {
    // It checks if the user is logged so then 
    // their 'logged index' is the dashboard not this
    // page that is focused on anonymous users
    if (!this.app.model.user().isAnonymous()) {
        this.app.goDashboard();
    }
};

},{"../viewmodels/NavAction":75,"../viewmodels/NavBar":76}],11:[function(require,module,exports){
/**
    LearnMore activity
**/
'use strict';
var ko = require('knockout'),
    NavBar = require('../viewmodels/NavBar'),
    NavAction = require('../viewmodels/NavAction');

var singleton = null;

exports.init = function initLearnMore($activity, app) {

    if (singleton === null)
        singleton = new LearnMoreActivity($activity, app);
    
    return singleton;
};

function LearnMoreActivity($activity, app) {

    this.$activity = $activity;
    this.app = app;
    this.dataView = new ViewModel();
    ko.applyBindings(this.dataView, $activity.get(0));
    
    this.navBar = new NavBar({
        title: null, // null for logo
        leftAction: NavAction.goBack,
        rightAction: NavAction.menuOut
    });
}

LearnMoreActivity.prototype.show = function show(options) {

    if (options && options.route &&
        options.route.segments &&
        options.route.segments.length) {
        this.dataView.profile(options.route.segments[0]);
    }
};

function ViewModel() {
    this.profile = ko.observable('customer');
}
},{"../viewmodels/NavAction":75,"../viewmodels/NavBar":76,"knockout":false}],12:[function(require,module,exports){
/**
    LocationEdition activity
**/
'use strict';
var ko = require('knockout'),
    Location = require('../models/Location'),
    NavBar = require('../viewmodels/NavBar'),
    NavAction = require('../viewmodels/NavAction');

var singleton = null;

exports.init = function initLocationEdition($activity, app) {

    if (singleton === null)
        singleton = new LocationEditionActivity($activity, app);
    
    return singleton;
};

function LocationEditionActivity($activity, app) {
    
    this.accessLevel = app.UserType.Provider;

    this.$activity = $activity;
    this.app = app;
    this.dataView = new ViewModel();
    ko.applyBindings(this.dataView, $activity.get(0));
    
    this.navBar = new NavBar({
        title: '',
        leftAction: NavAction.goBack.model.clone({
            text: 'Locations'
        }),
        rightAction: NavAction.goHelpIndex
    });
}

LocationEditionActivity.prototype.show = function show(options) {
    //jshint maxcomplexity:10
    
    var id = 0,
        create = '';

    if (options) {
        if (options.locationID) {
            id = options.locationID;
        }
        else if (options.route && options.route.segments) {
            
            id = parseInt(options.route.segments[0]);
        }
        else if (options.create) {
            create = options.create;
        }
    }
    
    if (id) {
        // TODO
        // var location = this.app.model.getLocation(id)
        // NOTE testing data
        var locations = {
            '1': new Location({
                locationID: 1,
                name: 'Home',
                addressLine1: 'Here Street',
                city: 'San Francisco',
                postalCode: '90001',
                stateProvinceCode: 'CA',
                countryID: 1,
                isServiceRadius: true,
                isServiceLocation: false
            }),
            '2': new Location({
                locationID: 1,
                name: 'Workshop',
                addressLine1: 'Unknow Street',
                city: 'San Francisco',
                postalCode: '90001',
                stateProvinceCode: 'CA',
                countryID: 1,
                isServiceRadius: false,
                isServiceLocation: true
            })
        };
        var location = locations[id];
        if (location) {
            this.dataView.location(location);

            this.dataView.header('Edit Location');
        } else {
            this.dataView.location(null);
            this.dataView.header('Unknow location or was deleted');
        }
    }
    else {
        // New location
        this.dataView.location(new Location());
        
        switch (options.create) {
            case 'serviceRadius':
                this.dataView.location().isServiceRadius(true);
                this.dataView.header('Add a service radius');
                break;
            case 'serviceLocation':
                this.dataView.location().isServiceLocation(true);
                this.dataView.header('Add a service location');
                break;
            default:
                this.dataView.location().isServiceRadius(true);
                this.dataView.location().isServiceLocation(true);
                this.dataView.header('Add a location');
                break;
        }
    }
};

function ViewModel() {
    
    this.location = ko.observable(new Location());
    
    this.header = ko.observable('Edit Location');
    
    // TODO
    this.save = function() {};
    this.cancel = function() {};
}
},{"../models/Location":37,"../viewmodels/NavAction":75,"../viewmodels/NavBar":76,"knockout":false}],13:[function(require,module,exports){
/**
    locations activity
**/
'use strict';

var $ = require('jquery'),
    ko = require('knockout'),
    NavBar = require('../viewmodels/NavBar'),
    NavAction = require('../viewmodels/NavAction');
    
var singleton = null;

exports.init = function initLocations($activity, app) {

    if (singleton === null)
        singleton = new LocationsActivity($activity, app);
    
    return singleton;
};

function LocationsActivity($activity, app) {
    
    this.accessLevel = app.UserType.Provider;
    this.navBar = new NavBar({
        title: 'Locations',
        leftAction: NavAction.menuNewItem,
        rightAction: NavAction.menuIn
    });

    this.app = app;
    this.$activity = $activity;
    this.$listView = $activity.find('#locationsListView');

    var dataView = this.dataView = new ViewModel(app);
    ko.applyBindings(dataView, $activity.get(0));

    // TestingData
    dataView.locations(require('../testdata/locations').locations);

    // Handler to update header based on a mode change:
    this.dataView.isSelectionMode.subscribe(function (itIs) {
        this.dataView.headerText(itIs ? 'Select or add a service location' : 'Locations');
        
        // Update navbar too
        this.navBar.leftAction(NavAction.goBack.model.clone());
        this.navBar.rightAction(NavAction.goHelpIndex);
        // Title must be empty
        this.navBar.title('');
        // TODO Replaced by a progress bar on booking creation
        // TODO Or leftAction().text(..) on booking edition (return to booking)
        // or coming from Jobtitle/schedule (return to schedule/job title)?
        
    }.bind(this));

    // Object to hold the options passed on 'show' as a result
    // of a request from another activity
    this.requestInfo = null;
    
    // Handler to go back with the selected location when 
    // selection mode goes off and requestInfo is for
    // 'select mode'
    this.dataView.isSelectionMode.subscribe(function (itIs) {
        // We have a request and
        // it requested to select a location
        // and selection mode goes off
        if (this.requestInfo &&
            this.requestInfo.selectLocation === true &&
            itIs === false) {
            
            // Pass the selected client in the info
            this.requestInfo.selectedLocation = this.dataView.selectedLocation();
            // And go back
            this.app.shell.goBack(this.requestInfo);
            // Last, clear requestInfo
            this.requestInfo = null;
        }
    }.bind(this));
}

LocationsActivity.prototype.show = function show(options) {
  
    options = options || {};
    this.requestInfo = options;

    if (options.selectLocation === true) {
        this.dataView.isSelectionMode(true);
        // preset:
        this.dataView.selectedLocation(options.selectedLocation);
    }
    else if (options.route && options.route.segments) {
        var id = options.route.segments[0];
        if (id) {
            if (id === 'new') {
                this.app.shell.go('locationEdition', {
                    create: options.route.segments[1] // 'serviceRadius', 'serviceLocation'
                });
            }
            else {
                this.app.shell.go('locationEdition', {
                    locationID: id
                });
            }
        }
    }
};

function ViewModel(app) {

    this.headerText = ko.observable('Locations');

    // Full list of locations
    this.locations = ko.observableArray([]);

    // Especial mode when instead of pick and edit we are just selecting
    // (when editing an appointment)
    this.isSelectionMode = ko.observable(false);

    this.selectedLocation = ko.observable(null);
    
    this.selectLocation = function(selectedLocation) {
        
        if (this.isSelectionMode() === true) {
            this.selectedLocation(selectedLocation);
            this.isSelectionMode(false);
        }
        else {
            app.shell.go('locationEdition', {
                locationID: selectedLocation.locationID()
            });
        }

    }.bind(this);
}

},{"../testdata/locations":49,"../viewmodels/NavAction":75,"../viewmodels/NavBar":76,"knockout":false}],14:[function(require,module,exports){
/**
    Login activity
**/
'use strict';

var $ = require('jquery'),
    ko = require('knockout'),
  User = require('../models/User'),
    NavBar = require('../viewmodels/NavBar'),
    NavAction = require('../viewmodels/NavAction');

var singleton = null;

exports.init = function initLogin($activity, app) {

    if (singleton === null)
        singleton = new LoginActivity($activity, app);
    
    return singleton;
};

function LoginActivity($activity, app) {
    
    this.accessLevel = app.UserType.Anonymous;
    this.navBar = new NavBar({
        title: 'Log in',
        leftAction: NavAction.goBack,
        rightAction: NavAction.menuOut
    });

    this.$activity = $activity;
    this.app = app;
    this.dataView = new ViewModel();
    ko.applyBindings(this.dataView, $activity.get(0));
    
    // Perform log-in request when is requested by the form:
    this.dataView.isLogingIn.subscribe(function(v) {
        if (v === true) {
            
            // Perform loging
            
            // Notify state:
            var $btn = $activity.find('[type="submit"]');
            $btn.button('loading');
            
            // Clear previous error so makes clear we
            // are attempting
            this.dataView.loginError('');
        
            var ended = function ended() {
                this.dataView.isLogingIn(false);
                $btn.button('reset');
            }.bind(this);
            
            // After clean-up error (to force some view updates),
            // validate and abort on error
            // Manually checking error on each field
            if (this.dataView.username.error() ||
                this.dataView.password.error()) {
                this.dataView.loginError('Review your data');
                ended();
                return;
            }
            
            app.model.login(
                this.dataView.username(),
                this.dataView.password()
            ).then(function(loginData) {
                
                this.dataView.loginError('');
                ended();
                
                // Remove form data
                this.dataView.username('');
                this.dataView.password('');
                
                this.app.goDashboard();

            }.bind(this)).catch(function() {
                
                this.dataView.loginError('Invalid username or password');
                ended();
            }.bind(this));
        }
    }.bind(this));
    
    // Focus first bad field on error
    this.dataView.loginError.subscribe(function(err) {
        // Login is easy since we mark both unique fields
        // as error on loginError (its a general form error)
        var input = $activity.find(':input').get(0);
        if (err)
            input.focus();
        else
            input.blur();
    });
}

LoginActivity.prototype.show = function show(options) {
};

function ViewModel() {
    
    this.username = ko.observable('');
    this.password = ko.observable('');
    this.loginError = ko.observable('');
    
    this.isLogingIn = ko.observable(false);
    
    this.performLogin = function performLogin() {

        this.isLogingIn(true);        
    }.bind(this);
    
    // validate username as an email
    var emailRegexp = /^[-0-9A-Za-z!#$%&'*+/=?^_`{|}~.]+@[-0-9A-Za-z!#$%&'*+/=?^_`{|}~.]+$/;
    this.username.error = ko.observable('');
    this.username.subscribe(function(v) {
        if (v) {
            if (emailRegexp.test(v)) {
                this.username.error('');
            }
            else {
                this.username.error('Is not a valid email');
            }
        }
        else {
            this.username.error('Required');
        }
    }.bind(this));
    
    // required password
    this.password.error = ko.observable('');
    this.password.subscribe(function(v) {
        var err = '';
        if (!v)
            err = 'Required';
        
        this.password.error(err);
    }.bind(this));
}

},{"../models/User":45,"../viewmodels/NavAction":75,"../viewmodels/NavBar":76,"knockout":false}],15:[function(require,module,exports){
/**
    Logout activity
**/
'use strict';

var singleton = null;

exports.init = function initLogout($activity, app) {

    if (singleton === null)
        singleton = new LogoutActivity($activity, app);
    
    return singleton;
};

function LogoutActivity($activity, app) {
    
    this.accessLevel = app.UserType.LoggedUser;

    this.$activity = $activity;
    this.app = app;
}

LogoutActivity.prototype.show = function show(options) {

    this.app.model.logout().then(function() {
        // Anonymous user again
        var newAnon = this.app.model.user().constructor.newAnonymous();
        this.app.model.user().model.updateWith(newAnon);

        // Go index
        this.app.shell.go('/');
        
    }.bind(this));
};

},{}],16:[function(require,module,exports){
/**
    OnboardingComplete activity
**/
'use strict';

var singleton = null;

exports.init = function initOnboardingComplete($activity, app) {

    if (singleton === null)
        singleton = new OnboardingCompleteActivity($activity, app);
    
    return singleton;
};

function OnboardingCompleteActivity($activity, app) {

    this.accessLevel = app.UserType.LoggedUser;
    
    this.$activity = $activity;
    this.app = app;
}

OnboardingCompleteActivity.prototype.show = function show(options) {

};

},{}],17:[function(require,module,exports){
/**
    OnboardingHome activity
**/
'use strict';

var singleton = null,
    NavBar = require('../viewmodels/NavBar'),
    NavAction = require('../viewmodels/NavAction');

exports.init = function initOnboardingHome($activity, app) {

    if (singleton === null)
        singleton = new OnboardingHomeActivity($activity, app);
    
    return singleton;
};

function OnboardingHomeActivity($activity, app) {

    this.accessLevel = app.UserType.LoggedUser;
    
    this.$activity = $activity;
    this.app = app;
    
    this.navBar = new NavBar({
        title: null, // null for Logo
        leftAction: NavAction.goLogout,
        rightAction: null
    });
}

OnboardingHomeActivity.prototype.show = function show(options) {

};

},{"../viewmodels/NavAction":75,"../viewmodels/NavBar":76}],18:[function(require,module,exports){
/**
    Onboarding Positions activity
**/
'use strict';

var $ = require('jquery'),
    ko = require('knockout'),
    NavBar = require('../viewmodels/NavBar'),
    NavAction = require('../viewmodels/NavAction');

var singleton = null;

exports.init = function initOnboardingPositions($activity, app) {

    if (singleton === null)
        singleton = new OnboardingPositionsActivity($activity, app);
    
    return singleton;
};

function OnboardingPositionsActivity($activity, app) {

    this.accessLevel = app.UserType.Provider;
    
    this.$activity = $activity;
    this.app = app;
    this.dataView = new ViewModel();
    ko.applyBindings(this.dataView, $activity.get(0));

    // TestingData
    setSomeTestingData(this.dataView);

    // Object to hold the options passed on 'show' as a result
    // of a request from another activity
    this.requestInfo = null;
    
    this.navBar = new NavBar({
        title: 'Job Titles',
        leftAction: NavAction.menuNewItem,
        rightAction: NavAction.menuIn
    });
}

OnboardingPositionsActivity.prototype.show = function show(options) {
 
    options = options || {};
    this.requestInfo = options;
};

function ViewModel() {

    // Full list of positions
    this.positions = ko.observableArray([]);
}

var Position = require('../models/Position');
// UserPosition model
function setSomeTestingData(dataview) {
    
    dataview.positions.push(new Position({
        positionSingular: 'Massage Therapist'
    }));
    dataview.positions.push(new Position({
        positionSingular: 'Housekeeper'
    }));
}
},{"../models/Position":42,"../viewmodels/NavAction":75,"../viewmodels/NavBar":76,"knockout":false}],19:[function(require,module,exports){
/**
    services activity
**/
'use strict';

var $ = require('jquery'),
    ko = require('knockout'),
    NavBar = require('../viewmodels/NavBar'),
    NavAction = require('../viewmodels/NavAction');
    
var singleton = null;

exports.init = function initServices($activity, app) {

    if (singleton === null)
        singleton = new ServicesActivity($activity, app);
    
    return singleton;
};

function ServicesActivity($activity, app) {

    this.accessLevel = app.UserType.Provider;
    this.navBar = new NavBar({
        // TODO: on show, need to be updated with the JobTitle name
        title: 'Pricing and Services',
        leftAction: NavAction.goBack, // To JobTitles list inside scheduling
        rightAction: NavAction.goHelpIndex
    });
    
    this.app = app;
    this.$activity = $activity;
    this.$listView = $activity.find('#servicesListView');

    var dataView = this.dataView = new ViewModel();
    ko.applyBindings(dataView, $activity.get(0));

    // TestingData
    dataView.services(require('../testdata/services').services.map(Selectable));

    // Object to hold the options passed on 'show' as a result
    // of a request from another activity
    this.requestInfo = null;
    
    // Handler to go back with the selected service when 
    // selection mode goes off and requestInfo is for
    // 'select mode'
    this.dataView.isSelectionMode.subscribe(function (itIs) {
        // We have a request and
        // it requested to select a service
        // and selection mode goes off
        if (this.requestInfo &&
            this.requestInfo.selectServices === true &&
            itIs === false) {
            
            // Pass the selected client in the info
            this.requestInfo.selectedServices = this.dataView.selectedServices();
            // And go back
            this.app.shell.goBack(this.requestInfo);
            // Last, clear requestInfo
            this.requestInfo = null;
        }
    }.bind(this));
}

ServicesActivity.prototype.show = function show(options) {

  
    options = options || {};
    this.requestInfo = options;

    if (options.selectServices === true) {
        this.dataView.isSelectionMode(true);
        
        /* Trials to presets the selected services, NOT WORKING
        var services = (options.selectedServices || []);
        var selectedServices = this.dataView.selectedServices;
        selectedServices.removeAll();
        this.dataView.services().forEach(function(service) {
            services.forEach(function(selService) {
                if (selService === service) {
                    service.isSelected(true);
                    selectedServices.push(service);
                } else {
                    service.isSelected(false);
                }
            });
        });
        */
    }
};

function Selectable(obj) {
    obj.isSelected = ko.observable(false);
    return obj;
}

function ViewModel() {

    // Full list of services
    this.services = ko.observableArray([]);

    // Especial mode when instead of pick and edit we are just selecting
    // (when editing an appointment)
    this.isSelectionMode = ko.observable(false);

    // Grouped list of pricings:
    // Defined groups: regular services and add-ons
    this.groupedServices = ko.computed(function(){

        var services = this.services();
        var isSelection = this.isSelectionMode();

        var servicesGroup = {
                group: isSelection ? 'Select standalone services' : 'Standalone services',
                services: []
            },
            addonsGroup = {
                group: isSelection ? 'Select add-on services' : 'Add-on services',
                services: []
            },
            groups = [servicesGroup, addonsGroup];

        services.forEach(function(service) {
            
            var isAddon = service.isAddon();
            if (isAddon) {
                addonsGroup.services.push(service);
            }
            else {
                servicesGroup.services.push(service);
            }
        });

        return groups;

    }, this);
    
    this.selectedServices = ko.observableArray([]);
    /**
        Toggle the selection status of a service, adding
        or removing it from the 'selectedServices' array.
    **/
    this.toggleServiceSelection = function(service) {
        
        var inIndex = -1,
            isSelected = this.selectedServices().some(function(selectedService, index) {
            if (selectedService === service) {
                inIndex = index;
                return true;
            }
        });
        
        service.isSelected(!isSelected);

        if (isSelected)
            this.selectedServices.splice(inIndex, 1);
        else
            this.selectedServices.push(service);

    }.bind(this);
    
    /**
        Ends the selection process, ready to collect selection
        and passing it to the request activity
    **/
    this.endSelection = function() {
        
        this.isSelectionMode(false);
        
    }.bind(this);
}

},{"../testdata/services":51,"../viewmodels/NavAction":75,"../viewmodels/NavBar":76,"knockout":false}],20:[function(require,module,exports){
/**
    Signup activity
**/
'use strict';

var $ = require('jquery'),
    ko = require('knockout'),
    NavBar = require('../viewmodels/NavBar'),
    NavAction = require('../viewmodels/NavAction');

var singleton = null;

exports.init = function initSignup($activity, app) {

    if (singleton === null)
        singleton = new SignupActivity($activity, app);
    
    return singleton;
};

function SignupActivity($activity, app) {

    this.accessLevel = app.UserType.Anonymous;
    
    this.$activity = $activity;
    this.app = app;
    this.dataView = new ViewModel();
    ko.applyBindings(this.dataView, $activity.get(0));
    
    this.navBar = new NavBar({
        title: null, // null for Logo
        leftAction: null,
        rightAction: NavAction.menuOut
    });
    
    // TODO: implement real login
    // TESTING: the button state with a fake delay
    $activity.find('#accountSignUpBtn').on('click', function (e) {
        var $btn = $(e.target).button('loading');

        setTimeout(function() {
        
            $btn.button('reset');
            
            // TESTING: populating user
            fakeSignup(this.app);
          
            // NOTE: onboarding or not?
            var onboarding = false;
            if (onboarding) {
                this.app.shell.go('onboardingHome');
            }
            else {
                this.app.shell.go('home');
            }
        }, 1000);

        return false;
    }.bind(this));
}

SignupActivity.prototype.show = function show(options) {

    if (options && options.route &&
        options.route.segments &&
        options.route.segments.length) {
        this.dataView.profile(options.route.segments[0]);
    }
};

// TODO: remove after implement real login
function fakeSignup(app) {
    app.model.user.model().updateWith(app.model.user().constructor.newAnonymous());
}

function ViewModel() {
    this.profile = ko.observable('customer');
}
},{"../viewmodels/NavAction":75,"../viewmodels/NavBar":76,"knockout":false}],21:[function(require,module,exports){
/**
    textEditor activity
**/
'use strict';

var $ = require('jquery'),
    ko = require('knockout'),
    EventEmitter = require('events').EventEmitter,
    NavBar = require('../viewmodels/NavBar'),
    NavAction = require('../viewmodels/NavAction');
    
var singleton = null;

exports.init = function initTextEditor($activity, app) {
    
    if (singleton === null)
        singleton = new TextEditorActivity($activity, app);
    
    return singleton;
};

function TextEditorActivity($activity, app) {

    this.navBar = new NavBar({
        // Title is empty ever, since we are in 'go back' mode all the time here
        title: '',
        // but leftAction.text is updated on 'show' with passed value,
        // so we need a clone to not modify the shared static instance
        leftAction: NavAction.goBack.model.clone({ isTitle: true }),
        rightAction: NavAction.goHelpIndex
    });
    
    // Fields
    this.$activity = $activity;
    this.app = app;
    this.$textarea = this.$activity.find('textarea');
    this.textarea = this.$textarea.get(0);

    // Data
    this.dataView = new ViewModel();
    ko.applyBindings(this.dataView, $activity.get(0));
    
    // Object to hold the options passed on 'show' as a result
    // of a request from another activity
    this.requestInfo = null;
    
    // Handlers
    // Handler for the 'saved' event so the activity
    // returns back to the requester activity giving it
    // the new text
    this.dataView.on('saved', function() {
        if (this.requestInfo) {
            // Update the info with the new text
            this.requestInfo.text = this.dataView.text();
        }

        // and pass it back
        this.app.shell.goBack(this.requestInfo);
    }.bind(this));
 
    // Handler the cancel event
    this.dataView.on('cancel', function() {
        // return, nothing changed
        app.shell.goBack();
    }.bind(this));
}

TextEditorActivity.prototype.show = function show(options) {
    
    options = options || {};
    this.requestInfo = options;

    // Set navigation title or nothing
    this.navBar.leftAction().text(options.title || '');
    
    // Field header
    this.dataView.headerText(options.header);
    this.dataView.text(options.text);
    if (options.rowsNumber)
        this.dataView.rowsNumber(options.rowsNumber);
        
    // Inmediate focus to the textarea for better usability
    this.textarea.focus();
    this.$textarea.click();
};

function ViewModel() {

    this.headerText = ko.observable('Text');

    // Text to edit
    this.text = ko.observable('');
    
    // Number of rows for the textarea
    this.rowsNumber = ko.observable(2);

    this.cancel = function cancel() {
        this.emit('cancel');
    };
    
    this.save = function save() {
        this.emit('saved');
    };
}

ViewModel._inherits(EventEmitter);

},{"../viewmodels/NavAction":75,"../viewmodels/NavBar":76,"events":false,"knockout":false}],22:[function(require,module,exports){
/**
    Registration of custom html components used by the App.
    All with 'app-' as prefix.
    
    Some definitions may be included on-line rather than on separated
    files (viewmodels), templates are linked so need to be 
    included in the html file with the same ID that referenced here,
    usually using as DOM ID the same name as the component with sufix '-template'.
**/
'use strict';

var ko = require('knockout');
var propTools = require('./utils/jsPropertiesTools');

function getObservable(obsOrValue) {
    if (typeof(obsOrValue) === 'function')
        return obsOrValue;
    else
        return ko.observable(obsOrValue);
}

exports.registerAll = function() {
    
    /// navbar-action
    ko.components.register('app-navbar-action', {
        template: { element: 'navbar-action-template' },
        viewModel: function(params) {

            propTools.defineGetter(this, 'action', function() {
                return (
                    params.action && params.navBar() ?
                    params.navBar()[params.action]() :
                    null
                );
            });
        }
    });
    
    /// unlabeled-input
    ko.components.register('app-unlabeled-input', {
        template: { element: 'unlabeled-input-template' },
        viewModel: function(params) {

            this.value = getObservable(params.value);
            this.placeholder = getObservable(params.placeholder);
        }
    });
};

},{"./utils/jsPropertiesTools":63,"knockout":false}],23:[function(require,module,exports){
/**
    Navbar extension of the App,
    adds the elements to manage a view model
    for the NavBar and automatic changes
    under some model changes like user login/logout
**/
'use strict';

var ko = require('knockout'),
    $ = require('jquery'),
    NavBar = require('./viewmodels/NavBar'),
    NavAction = require('./viewmodels/NavAction');

exports.extends = function (app) {
    
    // REVIEW: still needed? Maybe the per activity navBar means
    // this is not needed. Some previous logic was already removed
    // because was useless.
    //
    // Adjust the navbar setup depending on current user,
    // since different things are need for logged-in/out.
    function adjustUserBar() {

        var user = app.model.user();

        if (user.isAnonymous()) {
            app.navBar().rightAction(NavAction.menuOut);
        }
    }
    // Commented lines, used previously but unused now, it must be enough with the update
    // per activity change
    //app.model.user().isAnonymous.subscribe(updateStatesOnUserChange);
    //app.model.user().onboardingStep.subscribe(updateStatesOnUserChange);
    
    app.navBar = ko.observable(null);
    
    var refreshNav = function refreshNav() {
        // Trigger event to force a component update
        $('.AppNav').trigger('contentChange');
    };
    var autoRefreshNav = function autoRefreshNav(action) {
        if (action) {
            action.text.subscribe(refreshNav);
            action.isTitle.subscribe(refreshNav);
            action.icon.subscribe(refreshNav);
            action.isMenu.subscribe(refreshNav);
        }
    };

    /**
        Update the nav model using the Activity defaults
    **/
    app.updateAppNav = function updateAppNav(activity) {

        // if the activity has its own
        if ('navBar' in activity) {
            // Use specializied activity bar data
            app.navBar(activity.navBar);
        }
        else {
            // Use default one
            app.navBar(new NavBar());
        }

        // TODO Double check if needed.
        // Latest changes, when needed
        adjustUserBar();
        
        refreshNav();
        autoRefreshNav(app.navBar().leftAction());
        autoRefreshNav(app.navBar().rightAction());
    };
    
    
    /**
        Update the app menu to highlight the
        given link name
    **/
    app.updateMenu = function updateMenu(name) {
        
        var $menu = $('.App-menus .navbar-collapse');
        
        // Remove any active
        $menu
        .find('li')
        .removeClass('active');
        // Add active
        $menu
        .find('.go-' + name)
        .closest('li')
        .addClass('active');
        // Hide menu
        $menu
        .filter(':visible')
        .collapse('hide');
    };
};

},{"./viewmodels/NavAction":75,"./viewmodels/NavBar":76,"knockout":false}],24:[function(require,module,exports){
/**
    List of activities loaded in the App,
    as an object with the activity name as the key
    and the controller as value.
**/
'use strict';

module.exports = {
    'calendar': require('./activities/calendar'),
    'datetimePicker': require('./activities/datetimePicker'),
    'clients': require('./activities/clients'),
    'services': require('./activities/services'),
    'locations': require('./activities/locations'),
    'textEditor': require('./activities/textEditor'),
    'home': require('./activities/home'),
    'appointment': require('./activities/appointment'),
    'bookingConfirmation': require('./activities/bookingConfirmation'),
    'index': require('./activities/index'),
    'login': require('./activities/login'),
    'logout': require('./activities/logout'),
    'learnMore': require('./activities/learnMore'),
    'signup': require('./activities/signup'),
    'contactInfo': require('./activities/contactInfo'),
    'onboardingPositions': require('./activities/onboardingPositions'),
    'onboardingHome': require('./activities/onboardingHome'),
    'locationEdition': require('./activities/locationEdition'),
    'onboardingComplete': require('./activities/onboardingComplete'),
    'account': require('./activities/account')
};

},{"./activities/account":2,"./activities/appointment":3,"./activities/bookingConfirmation":4,"./activities/calendar":5,"./activities/clients":6,"./activities/contactInfo":7,"./activities/datetimePicker":8,"./activities/home":9,"./activities/index":10,"./activities/learnMore":11,"./activities/locationEdition":12,"./activities/locations":13,"./activities/login":14,"./activities/logout":15,"./activities/onboardingComplete":16,"./activities/onboardingHome":17,"./activities/onboardingPositions":18,"./activities/services":19,"./activities/signup":20,"./activities/textEditor":21}],25:[function(require,module,exports){
'use strict';

/** Global dependencies **/
var $ = require('jquery');
require('jquery-mobile');
var ko = require('knockout');
ko.bindingHandlers.format = require('ko/formatBinding').formatBinding;
var bootknock = require('./utils/bootknockBindingHelpers');
require('./utils/Function.prototype._inherits');
require('./utils/Function.prototype._delayed');
// Promise polyfill, so its not 'require'd per module:
require('es6-promise').polyfill();

var layoutUpdateEvent = require('layoutUpdateEvent');
var NavBar = require('./viewmodels/NavBar'),
    NavAction = require('./viewmodels/NavAction'),
    AppModel = require('./viewmodels/AppModel');

// Register the special locale
require('./locales/en-US-LC');

/**
    A set of fixes/workarounds for Bootstrap behavior/plugins
    to be executed before Bootstrap is included/executed.
    For example, because of data-binding removing/creating elements,
    some old references to removed items may get alive and need update,
    or re-enabling some behaviors.
**/
function preBootstrapWorkarounds() {
    // Internal Bootstrap source utility
    function getTargetFromTrigger($trigger) {
        var href,
            target = $trigger.attr('data-target') ||
            (href = $trigger.attr('href')) && 
            href.replace(/.*(?=#[^\s]+$)/, ''); // strip for ie7

        return $(target);
    }
    
    // Bug: navbar-collapse elements hold a reference to their original
    // $trigger, but that trigger can change on different 'clicks' or
    // get removed the original, so it must reference the new one
    // (the latests clicked, and not the cached one under the 'data' API).    
    // NOTE: handler must execute before the Bootstrap handler for the same
    // event in order to work.
    $(document).on('click.bs.collapse.data-api.workaround', '[data-toggle="collapse"]', function(e) {
        var $t = $(this),
            $target = getTargetFromTrigger($t),
            data = $target && $target.data('bs.collapse');
        
        // If any
        if (data) {
            // Replace the trigger in the data reference:
            data.$trigger = $t;
        }
        // On else, nothing to do, a new Collapse instance will be created
        // with the correct target, the first time
    });
}

/**
    App static class
**/
var app = {
    shell: require('./app.shell'),
    
    // New app model, that starts with anonymous user
    model: new AppModel(),
    
    /** Load activities controllers (not initialized) **/
    activities: require('./app.activities'),
    
    /**
        Just redirect the better place for current user and state.
        NOTE: Its a delayed function, since on many contexts need to
        wait for the current 'routing' from end before do the new
        history change.
        TODO: Maybe, rather than delay it, can stop current routing
        (changes on Shell required) and perform the new.
        TODO: Maybe alternative to previous, to provide a 'replace'
        in shell rather than a go, to avoid append redirect entries
        in the history, that create the problem of 'broken back button'
    **/
    goDashboard: function goDashboard() {
        var onboarding = this.model.user().onboardingStep();
        if (onboarding) {
            this.shell.go('onboardingHome/' + onboarding);
        }
        else {
            this.shell.go('home');
        }
    }._delayed(1)
};

/** Continue app creation with things that need a reference to the app **/

require('./app-navbar').extends(app);

require('./app-components').registerAll();

app.getActivity = function getActivity(name) {
    var activity = this.activities[name];
    if (activity) {
        var $act = this.shell.items.find(name);
        if ($act && $act.length)
            return activity.init($act, this);
    }
    return null;
};

app.getActivityControllerByRoute = function getActivityControllerByRoute(route) {
    // From the route object, the important piece is route.name
    // that contains the activity name except if is the root
    var actName = route.name || this.shell.indexName;
    
    return this.getActivity(actName);
};

// accessControl setup: cannot be specified on Shell creation because
// depends on the app instance
app.shell.accessControl = require('./utils/accessControl')(app);

// Shortcut to UserType enumeration used to set permissions
app.UserType = app.model.user().constructor.UserType;

/** App Init **/
var appInit = function appInit() {
    /*jshint maxstatements:30 */
    
    // Enabling the 'layoutUpdate' jQuery Window event that happens on resize and transitionend,
    // and can be triggered manually by any script to notify changes on layout that
    // may require adjustments on other scripts that listen to it.
    // The event is throttle, guaranting that the minor handlers are executed rather
    // than a lot of them in short time frames (as happen with 'resize' events).
    layoutUpdateEvent.on();
    
    // NOTE: Safari iOS bug workaround, min-height/height on html doesn't work as expected,
    // getting bigger than viewport. May be a problem only on Safari and not in 
    // the WebView, double check.
    // With the additional problem with height:100%, so Activities get a
    // fixed size (calculated from body) if height:100% is applied through CSS
    var iOS = /(iPad|iPhone|iPod)/g.test( navigator.userAgent );
    if (iOS) {
        var $b = $('body');
        var fixActivities = function fixActivities() {
            var h = $b.height();
            $('[data-activity].full-height').height(h);
        };

        $('html').height(window.innerHeight + 'px');
        fixActivities();
        $(window).on('layoutUpdate', function() {
            $('html').height(window.innerHeight + 'px');
            fixActivities();
        });
    }
    
    // iOS-7+ status bar fix. Apply on plugin loaded (cordova/phonegap environment)
    // and in any system, so any other systems fix its solved too if needed 
    // just updating the plugin (future proof) and ensure homogeneous cross plaftform behavior.
    if (window.StatusBar) {
        // Fix iOS-7+ overlay problem
        // Is in config.xml too, but seems not to work there.
        window.StatusBar.overlaysWebView(false);
    }
    
    // Bootstrap
    preBootstrapWorkarounds();
    require('bootstrap');
    
    // Load Knockout binding helpers
    bootknock.plugIn(ko);
    
    // Plugins setup
    if (window && window.plugins && window.plugins.Keyboard) {
        window.plugins.Keyboard.disableScroll(true);
    }
    
    // Easy links to shell actions, like goBack, in html elements
    // Example: <button data-shell="goBack 2">Go 2 times back</button>
    // NOTE: Important, registered before the shell.run to be executed
    // before its 'catch all links' handler
    $(document).on('tap', '[data-shell]', function(e) {
        // Using attr rather than the 'data' API to get updated
        // DOM values
        var cmdline = $(this).attr('data-shell') || '',
            args = cmdline.split(' '),
            cmd = args[0];

        if (cmd && typeof(app.shell[cmd]) === 'function') {
            app.shell[cmd].apply(app.shell, args.slice(1));
            
            // Cancel any other action on the link, to avoid double linking results
            e.stopImmediatePropagation();
            e.preventDefault();
        }
    });
    
    // When an activity is ready in the Shell:
    app.shell.on(app.shell.events.itemReady, function($act, state) {
        
        // Connect the 'activities' controllers to their views
        // Get initialized activity for the DOM element
        var actName = $act.data('activity');
        var activity = app.getActivity(actName);
        // Trigger the 'show' logic of the activity controller:
        activity.show(state);

        // Update menu
        var menuItem = activity.menuItem || actName;
        app.updateMenu(menuItem);
        
        // Update app navigation
        app.updateAppNav(activity);
    });
    
    // Set model for the AppNav
    ko.applyBindings({
        navBar: app.navBar
    }, $('.AppNav').get(0));
    
    var SmartNavBar = require('./components/SmartNavBar');
    var navBars = SmartNavBar.getAll();
    // Creates an event by listening to it, so other scripts can trigger
    // a 'contentChange' event to force a refresh of the navbar (to 
    // calculate and apply a new size); expected from dynamic navbars
    // that change it content based on observables.
    navBars.forEach(function(navbar) {
        $(navbar.el).on('contentChange', function() {
            navbar.refresh();
        });
    });
    
    // Listen for menu events (collapse in SmartNavBar)
    // to apply the backdrop
    var togglingBackdrop = false;
    $(document).on('show.bs.collapse hide.bs.collapse', '.AppNav .navbar-collapse', function(e) {
        if (!togglingBackdrop) {
            togglingBackdrop = true;
            var enabled = e.type === 'show';
            $('body').toggleClass('use-backdrop', enabled);
            // Hide any other opened collapse
            $('.collapsing, .collapse.in').collapse('hide');
            togglingBackdrop = false;
        }
    });

    // App init:
    var alertError = function(err) {
        window.alert('There was an error loading: ' + err && err.message || err);
    };

    app.model.init()
    .then(app.shell.run.bind(app.shell), alertError)
    .then(function() {
        // Mark the page as ready
        $('html').addClass('is-ready');
        // As app, hides splash screen
        if (window.navigator && window.navigator.splashscreen) {
            window.navigator.splashscreen.hide();
        }
    }, alertError);

    // DEBUG
    window.app = app;
};

// App init on page ready and phonegap ready
if (window.cordova) {
    // On DOM-Ready first
    $(function() {
        // Page is ready, device is too?
        // Note: Cordova ensures to call the handler even if the
        // event was already fired, so is good to do it inside
        // the dom-ready and we are ensuring that everything is
        // ready.
        $(document).on('deviceready', appInit);
    });
} else {
    // Only on DOM-Ready, for in browser development
    $(appInit);
}
},{"./app-components":22,"./app-navbar":23,"./app.activities":24,"./app.shell":26,"./components/SmartNavBar":28,"./locales/en-US-LC":29,"./utils/Function.prototype._delayed":53,"./utils/Function.prototype._inherits":54,"./utils/accessControl":57,"./utils/bootknockBindingHelpers":59,"./viewmodels/AppModel":74,"./viewmodels/NavAction":75,"./viewmodels/NavBar":76,"es6-promise":false,"knockout":false}],26:[function(require,module,exports){
/**
    Setup of the shell object used by the app
**/
'use strict';

var baseUrl = window.location.pathname;

//var History = require('./app-shell-history').create(baseUrl);
var History = require('./utils/shell/hashbangHistory');

// Shell dependencies
var shell = require('./utils/shell/index'),
    Shell = shell.Shell,
    DomItemsManager = shell.DomItemsManager;

// Creating the shell:
var shell = new Shell({

    // Selector, DOM element or jQuery object pointing
    // the root or container for the shell items
    root: 'body',

    // If is not in the site root, the base URL is required:
    baseUrl: baseUrl,
    
    forceHashbang: true,

    indexName: 'index',

    // for faster mobile experience (jquery-mobile event):
    linkEvent: 'tap',

    // No need for loader, everything comes bundled
    loader: null,

    // History Polyfill:
    history: History,

    // A DomItemsManager or equivalent object instance needs to
    // be provided:
    domItemsManager: new DomItemsManager({
        idAttributeName: 'data-activity'
    })
});

// Catch errors on item/page loading, showing..
shell.on('error', function(err) {
    
    var str = 'Unknow error';
    if (err) {
        if (typeof(err) === 'string') {
            str = err;
        }
        else if (err.message) {
            str = err.message;
        }
        else {
            str = JSON.stringify(err);
        }
    }

    // TODO change with a dialog or something
    window.alert(str);
});

module.exports = shell;

},{"./utils/shell/hashbangHistory":68,"./utils/shell/index":69}],27:[function(require,module,exports){
/* =========================================================
 * DatePicker JS Component, with several
 * modes and optional inline-permanent visualization.
 *
 * Copyright 2014 Loconomics Coop.
 *
 * Based on:
 * bootstrap-datepicker.js 
 * http://www.eyecon.ro/bootstrap-datepicker
 * =========================================================
 * Copyright 2012 Stefan Petre
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * ========================================================= */

var $ = require('jquery'); 

var classes = {
    component: 'DatePicker',
    months: 'DatePicker-months',
    days: 'DatePicker-days',
    monthDay: 'day',
    month: 'month',
    year: 'year',
    years: 'DatePicker-years'
};

// Picker object
var DatePicker = function(element, options) {
    /*jshint maxstatements:32,maxcomplexity:24*/
    this.element = $(element);
    this.format = DPGlobal.parseFormat(options.format||this.element.data('date-format')||'mm/dd/yyyy');
    
    this.isInput = this.element.is('input');
    this.component = this.element.is('.date') ? this.element.find('.add-on') : false;
    this.isPlaceholder = this.element.is('.calendar-placeholder');
    
    this.picker = $(DPGlobal.template)
                        .appendTo(this.isPlaceholder ? this.element : 'body')
                        .on('click tap', $.proxy(this.click, this));
    // TODO: to review if 'container' class can be avoided, so in placeholder mode gets optional
    // if is wanted can be placed on the placeholder element (or container-fluid or nothing)
    this.picker.addClass(this.isPlaceholder ? 'container' : 'dropdown-menu');
    
    if (this.isPlaceholder) {
        this.picker.show();
        if (this.element.data('date') == 'today') {
            this.date = new Date();
            this.set();
        }
        this.element.trigger({
            type: 'show',
            date: this.date
        });
    }
    else if (this.isInput) {
        this.element.on({
            focus: $.proxy(this.show, this),
            //blur: $.proxy(this.hide, this),
            keyup: $.proxy(this.update, this)
        });
    } else {
        if (this.component){
            this.component.on('click tap', $.proxy(this.show, this));
        } else {
            this.element.on('click tap', $.proxy(this.show, this));
        }
    }
    
    /* Touch events to swipe dates */
    this.element
    .on('swipeleft', function(e) {
        e.preventDefault();
        this.moveDate('next');
    }.bind(this))
    .on('swiperight', function(e) {
        e.preventDefault();
        this.moveDate('prev');
    }.bind(this));

    /* Set-up view mode */
    this.minViewMode = options.minViewMode||this.element.data('date-minviewmode')||0;
    if (typeof this.minViewMode === 'string') {
        switch (this.minViewMode) {
            case 'months':
                this.minViewMode = 1;
                break;
            case 'years':
                this.minViewMode = 2;
                break;
            default:
                this.minViewMode = 0;
                break;
        }
    }
    this.viewMode = options.viewMode||this.element.data('date-viewmode')||0;
    if (typeof this.viewMode === 'string') {
        switch (this.viewMode) {
            case 'months':
                this.viewMode = 1;
                break;
            case 'years':
                this.viewMode = 2;
                break;
            default:
                this.viewMode = 0;
                break;
        }
    }
    this.startViewMode = this.viewMode;
    this.weekStart = options.weekStart||this.element.data('date-weekstart')||0;
    this.weekEnd = this.weekStart === 0 ? 6 : this.weekStart - 1;
    this.onRender = options.onRender;
    this.fillDow();
    this.fillMonths();
    this.update();
    this.showMode();
};

DatePicker.prototype = {
    constructor: DatePicker,
    
    show: function(e) {
        this.picker.show();
        this.height = this.component ? this.component.outerHeight() : this.element.outerHeight();
        this.place();
        $(window).on('resize', $.proxy(this.place, this));
        if (e ) {
            e.stopPropagation();
            e.preventDefault();
        }
        if (!this.isInput) {
        }
        var that = this;
        $(document).on('mousedown', function(ev){
            if ($(ev.target).closest('.' + classes.component).length === 0) {
                that.hide();
            }
        });
        this.element.trigger({
            type: 'show',
            date: this.date
        });
    },
    
    hide: function(){
        this.picker.hide();
        $(window).off('resize', this.place);
        this.viewMode = this.startViewMode;
        this.showMode();
        if (!this.isInput) {
            $(document).off('mousedown', this.hide);
        }
        //this.set();
        this.element.trigger({
            type: 'hide',
            date: this.date
        });
    },
    
    set: function() {
        var formated = DPGlobal.formatDate(this.date, this.format);
        if (!this.isInput) {
            if (this.component){
                this.element.find('input').prop('value', formated);
            }
            this.element.data('date', formated);
        } else {
            this.element.prop('value', formated);
        }
    },
    
    /**
        Sets a date as value and notify with an event.
        Parameter dontNotify is only for cases where the calendar or
        some related component gets already updated but the highlighted
        date needs to be updated without create infinite recursion 
        because of notification. In other case, dont use.
    **/
    setValue: function(newDate, dontNotify) {
        if (typeof newDate === 'string') {
            this.date = DPGlobal.parseDate(newDate, this.format);
        } else {
            this.date = new Date(newDate);
        }
        this.set();
        this.viewDate = new Date(this.date.getFullYear(), this.date.getMonth(), 1, 0, 0, 0, 0);
        this.fill();
        
        if (dontNotify !== true) {
            // Notify:
            this.element.trigger({
                type: 'changeDate',
                date: this.date,
                viewMode: DPGlobal.modes[this.viewMode].clsName
            });
        }
    },
    
    getValue: function() {
        return this.date;
    },
    
    moveValue: function(dir, mode) {
        // dir can be: 'prev', 'next'
        if (['prev', 'next'].indexOf(dir && dir.toLowerCase()) == -1)
            // No valid option:
            return;

        // default mode is the current one
        mode = mode ?
            DPGlobal.modesSet[mode] :
            DPGlobal.modes[this.viewMode];

        this.date['set' + mode.navFnc].call(
            this.date,
            this.date['get' + mode.navFnc].call(this.date) + 
            mode.navStep * (dir === 'prev' ? -1 : 1)
        );
        this.setValue(this.date);
        return this.date;
    },
    
    place: function(){
        var offset = this.component ? this.component.offset() : this.element.offset();
        this.picker.css({
            top: offset.top + this.height,
            left: offset.left
        });
    },
    
    update: function(newDate){
        this.date = DPGlobal.parseDate(
            typeof newDate === 'string' ? newDate : (this.isInput ? this.element.prop('value') : this.element.data('date')),
            this.format
        );
        this.viewDate = new Date(this.date.getFullYear(), this.date.getMonth(), 1, 0, 0, 0, 0);
        this.fill();
    },
    
    fillDow: function(){
        var dowCnt = this.weekStart;
        var html = '<tr>';
        while (dowCnt < this.weekStart + 7) {
            html += '<th class="dow">'+DPGlobal.dates.daysMin[(dowCnt++)%7]+'</th>';
        }
        html += '</tr>';
        this.picker.find('.' + classes.days + ' thead').append(html);
    },
    
    fillMonths: function(){
        var html = '';
        var i = 0;
        while (i < 12) {
            html += '<span class="' + classes.month + '">'+DPGlobal.dates.monthsShort[i++]+'</span>';
        }
        this.picker.find('.' + classes.months + ' td').append(html);
    },
    
    fill: function() {
        /*jshint maxstatements:66, maxcomplexity:28*/
        var d = new Date(this.viewDate),
            year = d.getFullYear(),
            month = d.getMonth(),
            currentDate = this.date.valueOf();
        this.picker
        .find('.' + classes.days + ' th:eq(1)')
        .html(DPGlobal.dates.months[month] + ' ' + year);
        var prevMonth = new Date(year, month-1, 28,0,0,0,0),
            day = DPGlobal.getDaysInMonth(prevMonth.getFullYear(), prevMonth.getMonth());
        prevMonth.setDate(day);
        prevMonth.setDate(day - (prevMonth.getDay() - this.weekStart + 7)%7);
        var nextMonth = new Date(prevMonth);
        nextMonth.setDate(nextMonth.getDate() + 42);
        nextMonth = nextMonth.valueOf();
        var html = [];
        var clsName,
            prevY,
            prevM;
            
        if (this._daysCreated !== true) {
            // Create html (first time only)
       
            while(prevMonth.valueOf() < nextMonth) {
                if (prevMonth.getDay() === this.weekStart) {
                    html.push('<tr>');
                }
                clsName = this.onRender(prevMonth);
                prevY = prevMonth.getFullYear();
                prevM = prevMonth.getMonth();
                if ((prevM < month &&  prevY === year) ||  prevY < year) {
                    clsName += ' old';
                } else if ((prevM > month && prevY === year) || prevY > year) {
                    clsName += ' new';
                }
                if (prevMonth.valueOf() === currentDate) {
                    clsName += ' active';
                }
                html.push('<td class="' + classes.monthDay + ' ' + clsName+'">'+prevMonth.getDate() + '</td>');
                if (prevMonth.getDay() === this.weekEnd) {
                    html.push('</tr>');
                }
                prevMonth.setDate(prevMonth.getDate()+1);
            }
            
            this.picker.find('.' + classes.days + ' tbody').empty().append(html.join(''));
            this._daysCreated = true;
        }
        else {
            // Update days values
            
            var weekTr = this.picker.find('.' + classes.days + ' tbody tr:first-child()');
            var dayTd = null;
            while(prevMonth.valueOf() < nextMonth) {
                var currentWeekDayIndex = prevMonth.getDay() - this.weekStart;

                clsName = this.onRender(prevMonth);
                prevY = prevMonth.getFullYear();
                prevM = prevMonth.getMonth();
                if ((prevM < month &&  prevY === year) ||  prevY < year) {
                    clsName += ' old';
                } else if ((prevM > month && prevY === year) || prevY > year) {
                    clsName += ' new';
                }
                if (prevMonth.valueOf() === currentDate) {
                    clsName += ' active';
                }
                //html.push('<td class="day '+clsName+'">'+prevMonth.getDate() + '</td>');
                dayTd = weekTr.find('td:eq(' + currentWeekDayIndex + ')');
                dayTd
                .attr('class', 'day ' + clsName)
                .text(prevMonth.getDate());
                
                // Next week?
                if (prevMonth.getDay() === this.weekEnd) {
                    weekTr = weekTr.next('tr');
                }
                prevMonth.setDate(prevMonth.getDate()+1);
            }
        }

        var currentYear = this.date.getFullYear();
        
        var months = this.picker.find('.' + classes.months)
                    .find('th:eq(1)')
                        .html(year)
                        .end()
                    .find('span').removeClass('active');
        if (currentYear === year) {
            months.eq(this.date.getMonth()).addClass('active');
        }
        
        html = '';
        year = parseInt(year/10, 10) * 10;
        var yearCont = this.picker.find('.' + classes.years)
                            .find('th:eq(1)')
                                .text(year + '-' + (year + 9))
                                .end()
                            .find('td');
        
        year -= 1;
        var i;
        if (this._yearsCreated !== true) {

            for (i = -1; i < 11; i++) {
                html += '<span class="' + classes.year + (i === -1 || i === 10 ? ' old' : '')+(currentYear === year ? ' active' : '')+'">'+year+'</span>';
                year += 1;
            }
            
            yearCont.html(html);
            this._yearsCreated = true;
        }
        else {
            
            var yearSpan = yearCont.find('span:first-child()');
            for (i = -1; i < 11; i++) {
                //html += '<span class="year'+(i === -1 || i === 10 ? ' old' : '')+(currentYear === year ? ' active' : '')+'">'+year+'</span>';
                yearSpan
                .text(year)
                .attr('class', 'year' + (i === -1 || i === 10 ? ' old' : '') + (currentYear === year ? ' active' : ''));
                year += 1;
                yearSpan = yearSpan.next();
            }
        }
    },
    
    moveDate: function(dir, mode) {
        // dir can be: 'prev', 'next'
        if (['prev', 'next'].indexOf(dir && dir.toLowerCase()) == -1)
            // No valid option:
            return;
            
        // default mode is the current one
        mode = mode || this.viewMode;

        this.viewDate['set'+DPGlobal.modes[mode].navFnc].call(
            this.viewDate,
            this.viewDate['get'+DPGlobal.modes[mode].navFnc].call(this.viewDate) + 
            DPGlobal.modes[mode].navStep * (dir === 'prev' ? -1 : 1)
        );
        this.fill();
        this.set();
    },

    click: function(e) {
        /*jshint maxcomplexity:16*/
        e.stopPropagation();
        e.preventDefault();
        var target = $(e.target).closest('span, td, th');
        if (target.length === 1) {
            var month, year;
            switch(target[0].nodeName.toLowerCase()) {
                case 'th':
                    switch(target[0].className) {
                        case 'switch':
                            this.showMode(1);
                            break;
                        case 'prev':
                        case 'next':
                            this.moveDate(target[0].className);
                            break;
                    }
                    break;
                case 'span':
                    if (target.is('.' + classes.month)) {
                        month = target.parent().find('span').index(target);
                        this.viewDate.setMonth(month);
                    } else {
                        year = parseInt(target.text(), 10)||0;
                        this.viewDate.setFullYear(year);
                    }
                    if (this.viewMode !== 0) {
                        this.date = new Date(this.viewDate);
                        this.element.trigger({
                            type: 'changeDate',
                            date: this.date,
                            viewMode: DPGlobal.modes[this.viewMode].clsName
                        });
                    }
                    this.showMode(-1);
                    this.fill();
                    this.set();
                    break;
                case 'td':
                    if (target.is('.day') && !target.is('.disabled')){
                        var day = parseInt(target.text(), 10)||1;
                        month = this.viewDate.getMonth();
                        if (target.is('.old')) {
                            month -= 1;
                        } else if (target.is('.new')) {
                            month += 1;
                        }
                        year = this.viewDate.getFullYear();
                        this.date = new Date(year, month, day,0,0,0,0);
                        this.viewDate = new Date(year, month, Math.min(28, day),0,0,0,0);
                        this.fill();
                        this.set();
                        this.element.trigger({
                            type: 'changeDate',
                            date: this.date,
                            viewMode: DPGlobal.modes[this.viewMode].clsName
                        });
                    }
                    break;
            }
        }
    },
    
    mousedown: function(e){
        e.stopPropagation();
        e.preventDefault();
    },
    
    showMode: function(dir) {
        if (dir) {
            this.viewMode = Math.max(this.minViewMode, Math.min(2, this.viewMode + dir));
        }
        this.picker.find('>div').hide().filter('.' + classes.component + '-' + DPGlobal.modes[this.viewMode].clsName).show();
    }
};

$.fn.datepicker = function ( option ) {
    var vals = Array.prototype.slice.call(arguments, 1);
    var returned;
    this.each(function () {
        var $this = $(this),
            data = $this.data('datepicker'),
            options = typeof option === 'object' && option;
        if (!data) {
            $this.data('datepicker', (data = new DatePicker(this, $.extend({}, $.fn.datepicker.defaults,options))));
        }

        if (typeof option === 'string') {
            returned = data[option].apply(data, vals);
            // There is a value returned by the method?
            if (typeof(returned !== 'undefined')) {
                // Go out the loop to return the value from the first
                // element-method execution
                return false;
            }
            // Follow next loop item
        }
    });
    if (typeof(returned) !== 'undefined')
        return returned;
    else
        // chaining:
        return this;
};

$.fn.datepicker.defaults = {
    onRender: function(date) {
        return '';
    }
};
$.fn.datepicker.Constructor = DatePicker;

var DPGlobal = {
    modes: [
        {
            clsName: 'days',
            navFnc: 'Month',
            navStep: 1
        },
        {
            clsName: 'months',
            navFnc: 'FullYear',
            navStep: 1
        },
        {
            clsName: 'years',
            navFnc: 'FullYear',
            navStep: 10
        },
        {
            clsName: 'day',
            navFnc: 'Date',
            navStep: 1
        }
    ],
    dates:{
        days: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
        daysShort: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
        daysMin: ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"],
        months: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
        monthsShort: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
    },
    isLeapYear: function (year) {
        return (((year % 4 === 0) && (year % 100 !== 0)) || (year % 400 === 0));
    },
    getDaysInMonth: function (year, month) {
        return [31, (DPGlobal.isLeapYear(year) ? 29 : 28), 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month];
    },
    parseFormat: function(format){
        var separator = format.match(/[.\/\-\s].*?/),
            parts = format.split(/\W+/);
        if (!separator || !parts || parts.length === 0){
            throw new Error("Invalid date format.");
        }
        return {separator: separator, parts: parts};
    },
    parseDate: function(date, format) {
        /*jshint maxcomplexity:11*/
        var parts = date.split(format.separator),
            val;
        date = new Date();
        date.setHours(0);
        date.setMinutes(0);
        date.setSeconds(0);
        date.setMilliseconds(0);
        if (parts.length === format.parts.length) {
            var year = date.getFullYear(), day = date.getDate(), month = date.getMonth();
            for (var i=0, cnt = format.parts.length; i < cnt; i++) {
                val = parseInt(parts[i], 10)||1;
                switch(format.parts[i]) {
                    case 'dd':
                    case 'd':
                        day = val;
                        date.setDate(val);
                        break;
                    case 'mm':
                    case 'm':
                        month = val - 1;
                        date.setMonth(val - 1);
                        break;
                    case 'yy':
                        year = 2000 + val;
                        date.setFullYear(2000 + val);
                        break;
                    case 'yyyy':
                        year = val;
                        date.setFullYear(val);
                        break;
                }
            }
            date = new Date(year, month, day, 0 ,0 ,0);
        }
        return date;
    },
    formatDate: function(date, format){
        var val = {
            d: date.getDate(),
            m: date.getMonth() + 1,
            yy: date.getFullYear().toString().substring(2),
            yyyy: date.getFullYear()
        };
        val.dd = (val.d < 10 ? '0' : '') + val.d;
        val.mm = (val.m < 10 ? '0' : '') + val.m;
        date = [];
        for (var i=0, cnt = format.parts.length; i < cnt; i++) {
            date.push(val[format.parts[i]]);
        }
        return date.join(format.separator);
    },
    headTemplate: '<thead>'+
                        '<tr>'+
                            '<th class="prev">&lsaquo;</th>'+
                            '<th colspan="5" class="switch"></th>'+
                            '<th class="next">&rsaquo;</th>'+
                        '</tr>'+
                    '</thead>',
    contTemplate: '<tbody><tr><td colspan="7"></td></tr></tbody>'
};
DPGlobal.template = '<div class="' + classes.component + '">'+
                        '<div class="' + classes.days + '">'+
                            '<table class=" table-condensed">'+
                                DPGlobal.headTemplate+
                                '<tbody></tbody>'+
                            '</table>'+
                        '</div>'+
                        '<div class="' + classes.months + '">'+
                            '<table class="table-condensed">'+
                                DPGlobal.headTemplate+
                                DPGlobal.contTemplate+
                            '</table>'+
                        '</div>'+
                        '<div class="' + classes.years + '">'+
                            '<table class="table-condensed">'+
                                DPGlobal.headTemplate+
                                DPGlobal.contTemplate+
                            '</table>'+
                        '</div>'+
                    '</div>';
DPGlobal.modesSet = {
    'date': DPGlobal.modes[3],
    'month': DPGlobal.modes[0],
    'year': DPGlobal.modes[1],
    'decade': DPGlobal.modes[2]
};

/** Public API **/
exports.DatePicker = DatePicker;
exports.defaults = DPGlobal;
exports.utils = DPGlobal;

},{}],28:[function(require,module,exports){
/**
    SmartNavBar component.
    Requires its CSS counterpart.
    
    Created based on the project:
    
    Project-Tyson
    Website: https://github.com/c2prods/Project-Tyson
    Author: c2prods
    License:
    The MIT License (MIT)
    Copyright (c) 2013 c2prods
    Permission is hereby granted, free of charge, to any person obtaining a copy of
    this software and associated documentation files (the "Software"), to deal in
    the Software without restriction, including without limitation the rights to
    use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
    the Software, and to permit persons to whom the Software is furnished to do so,
    subject to the following conditions:
    The above copyright notice and this permission notice shall be included in all
    copies or substantial portions of the Software.
    THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
    IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS
    FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
    COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER
    IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
    CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
**/
var $ = require('jquery');

/**
    Internal utility.
    Removes all children for a DOM node
**/
var clearNode = function (node) {
    while(node.firstChild){
        node.removeChild(node.firstChild);
    }
};

/**
    Calculates and applies the best sizing and distribution for the title
    depending on content and buttons.
    Pass in the title element, buttons must be found as siblings of it.
**/
var textboxResize = function textboxResize(el) {
    /* jshint maxstatements: 28, maxcomplexity:11 */
    
    var leftbtn = el.parentNode.querySelectorAll('.SmartNavBar-edge.left')[0];
    var rightbtn = el.parentNode.querySelectorAll('.SmartNavBar-edge.right')[0];
    if (typeof leftbtn === 'undefined') {
        leftbtn = {
            offsetWidth: 0,
            className: ''
        };
    }
    if (typeof rightbtn === 'undefined') {
        rightbtn = {
            offsetWidth: 0,
            className: ''
        };
    }
    
    var margin = Math.max(leftbtn.offsetWidth, rightbtn.offsetWidth);
    el.style.marginLeft = margin + 'px';
    el.style.marginRight = margin + 'px';
    var tooLong = (el.offsetWidth < el.scrollWidth) ? true : false;
    if (tooLong) {
        if (leftbtn.offsetWidth < rightbtn.offsetWidth) {
            el.style.marginLeft = leftbtn.offsetWidth + 'px';
            el.style.textAlign = 'right';
        } else {
            el.style.marginRight = rightbtn.offsetWidth + 'px';
            el.style.textAlign = 'left';
        }
        tooLong = (el.offsetWidth<el.scrollWidth) ? true : false;
        if (tooLong) {
            if (new RegExp('arrow').test(leftbtn.className)) {
                clearNode(leftbtn.childNodes[1]);
                el.style.marginLeft = '26px';
            }
            if (new RegExp('arrow').test(rightbtn.className)) {
                clearNode(rightbtn.childNodes[1]);
                el.style.marginRight = '26px';
            }
        }
    }
};

exports.textboxResize = textboxResize;

/**
    SmartNavBar class, instantiate with a DOM element
    representing a navbar.
    API:
    - refresh: updates the control taking care of the needed
        width for title and buttons
**/
var SmartNavBar = function SmartNavBar(el) {
    this.el = el;
    
    this.refresh = function refresh() {
        var h = $(el).children('h1').get(0);
        if (h)
            textboxResize(h);
    };

    this.refresh(); 
};

exports.SmartNavBar = SmartNavBar;

/**
    Get instances for all the SmartNavBar elements in the DOM
**/
exports.getAll = function getAll() {
    var all = $('.SmartNavBar');
    return $.map(all, function(item) { return new SmartNavBar(item); });
};

/**
    Refresh all SmartNavBar found in the document.
**/
exports.refreshAll = function refreshAll() {
    $('.SmartNavBar > h1').each(function() { textboxResize(this); });
};

},{}],29:[function(require,module,exports){
/**
    Custom Loconomics 'locale' styles for date/times.
    Its a bit more 'cool' rendering dates ;-)
**/
'use strict';

var moment = require('moment');
// Since the task of define a locale changes
// the current global locale, we save a reference
// and restore it later so nothing changed.
var current = moment.locale();

moment.locale('en-US-LC', {
    meridiemParse : /[ap]\.?\.?/i,
    meridiem : function (hours, minutes, isLower) {
        if (hours > 11) {
            return isLower ? 'p' : 'P';
        } else {
            return isLower ? 'a' : 'A';
        }
    },
    calendar : {
        lastDay : '[Yesterday]',
        sameDay : '[Today]',
        nextDay : '[Tomorrow]',
        lastWeek : '[last] dddd',
        nextWeek : 'dddd',
        sameElse : 'M/D'
    },
    longDateFormat : {
        LT: 'h:mma',
        LTS: 'h:mm:ssa',
        L: 'MM/DD/YYYY',
        l: 'M/D/YYYY',
        LL: 'MMMM Do YYYY',
        ll: 'MMM D YYYY',
        LLL: 'MMMM Do YYYY LT',
        lll: 'MMM D YYYY LT',
        LLLL: 'dddd, MMMM Do YYYY LT',
        llll: 'ddd, MMM D YYYY LT'
    }
});

// Restore locale
moment.locale(current);

},{"moment":false}],30:[function(require,module,exports){
/** Appointment model **/
'use strict';

var ko = require('knockout'),
    Model = require('./Model'),
    Client = require('./Client'),
    Location = require('./Location'),
    Service = require('./Service'),
    moment = require('moment');
   
function Appointment(values) {
    
    Model(this);

    this.model.defProperties({
        id: null,
        
        startTime: null,
        endTime: null,
        
        // Event summary:
        summary: 'New booking',
        
        subtotalPrice: 0,
        feePrice: 0,
        pfeePrice: 0,
        totalPrice: 0,
        ptotalPrice: 0,
        
        preNotesToClient: null,
        postNotesToClient: null,
        preNotesToSelf: null,
        postNotesToSelf: null
    }, values);
    
    values = values || {};

    this.client = ko.observable(values.client ? new Client(values.client) : null);

    this.location = ko.observable(new Location(values.location));
    this.locationSummary = ko.computed(function() {
        return this.location().singleLine();
    }, this);
    
    this.services = ko.observableArray((values.services || []).map(function(service) {
        return (service instanceof Service) ? service : new Service(service);
    }));
    this.servicesSummary = ko.computed(function() {
        return this.services().map(function(service) {
            return service.name();
        }).join(', ');
    }, this);
    
    // Price update on services changes
    // TODO Is not complete for production
    this.services.subscribe(function(services) {
        this.ptotalPrice(services.reduce(function(prev, cur) {
            return prev + cur.price();
        }, 0));
    }.bind(this));
    
    // Smart visualization of date and time
    this.displayedDate = ko.pureComputed(function() {
        
        return moment(this.startTime()).locale('en-US-LC').calendar();
        
    }, this);
    
    this.displayedStartTime = ko.pureComputed(function() {
        
        return moment(this.startTime()).locale('en-US-LC').format('LT');
        
    }, this);
    
    this.displayedEndTime = ko.pureComputed(function() {
        
        return moment(this.endTime()).locale('en-US-LC').format('LT');
        
    }, this);
    
    this.displayedTimeRange = ko.pureComputed(function() {
        
        return this.displayedStartTime() + '-' + this.displayedEndTime();
        
    }, this);
    
    this.itStarted = ko.pureComputed(function() {
        return (this.startTime() && new Date() >= this.startTime());
    }, this);
    
    this.itEnded = ko.pureComputed(function() {
        return (this.endTime() && new Date() >= this.endTime());
    }, this);
    
    this.isNew = ko.pureComputed(function() {
        return (!this.id());
    }, this);
    
    this.stateHeader = ko.pureComputed(function() {
        
        var text = '';
        if (!this.isNew()) {
            if (this.itStarted()) {
                if (this.itEnded()) {
                    text = 'Completed:';
                }
                else {
                    text = 'Now:';
                }
            }
            else {
                text = 'Upcoming:';
            }
        }

        return text;
        
    }, this);
}

module.exports = Appointment;

},{"./Client":34,"./Location":37,"./Model":40,"./Service":43,"knockout":false,"moment":false}],31:[function(require,module,exports){
/** BookingSummary model **/
'use strict';

var ko = require('knockout'),
    Model = require('./Model'),
    moment = require('moment');
    
function BookingSummary(values) {
    
    Model(this);

    this.model.defProperties({
        quantity: 0,
        concept: '',
        time: null,
        timeFormat: ' [@] h:mma'
    }, values);

    this.phrase = ko.pureComputed(function(){
        var t = this.time() && moment(this.time()).format(this.timeFormat()) || '';        
        return this.concept() + t;
    }, this);

}

module.exports = BookingSummary;

},{"./Model":40,"knockout":false,"moment":false}],32:[function(require,module,exports){
/**
    Event model
**/
'use strict';

/* Example JSON (returned by the REST API):
{
  "EventID": 353,
  "UserID": 141,
  "EventTypeID": 3,
  "Summary": "Housekeeper services for JoshuaProvider D.",
  "AvailabilityTypeID": 3,
  "StartTime": "2014-03-25T08:00:00Z",
  "EndTime": "2014-03-25T18:00:00Z",
  "Kind": 0,
  "IsAllDay": false,
  "TimeZone": "01:00:00",
  "Location": "null",
  "UpdatedDate": "2014-10-30T15:44:49.653",
  "CreatedDate": null,
  "Description": "test description of a REST event",
  "RecurrenceRule": {
    "FrequencyTypeID": 502,
    "Interval": 1,
    "Until": "2014-07-01T00:00:00",
    "Count": null,
    "Ending": "date",
    "SelectedWeekDays": [
      1,
    ],
    "MonthlyWeekDay": false,
    "Incompatible": false,
    "TooMany": false
  },
  "RecurrenceOccurrences": null,
  "ReadOnly": false
}*/

function RecurrenceRule(values) {
    Model(this);
    
    this.model.defProperties({
        frequencyTypeID: 0,
        interval: 1, //:Integer
        until: null, //:Date
        count: null, //:Integer
        ending: null, // :string Possible values allowed: 'never', 'date', 'ocurrences'
        selectedWeekDays: [], // :integer[] 0:Sunday
        monthlyWeekDay: false,
        incompatible: false,
        tooMany: false
    }, values);
}

function RecurrenceOccurrence(values) {
    Model(this);
    
    this.model.defProperties({
        startTime: null, //:Date
        endTime: null //:Date
    }, values);
}

var ko = require('knockout'),
    Model = require('./Model'),
    moment = require('moment');
   
function CalendarEvent(values) {
    
    Model(this);
    
    this.model.defProperties({
        calendarEventID: 0,
        userID: 0,
        eventTypeID: 3,
        summary: '',
        availabilityTypeID: 0,
        startTime: null,
        endTime: null,
        kind: 0,
        isAllDay: false,
        timeZone: 'Z',
        location: null,
        updatedDate: null,
        createdDate: null,
        description: '',
        readOnly: false
    }, values);

    this.recurrenceRule = ko.observable(
        values && 
        values.recurrenceRule && 
        new RecurrenceRule(values.recurrenceRule)
    );
    this.recurrenceOccurrences = ko.observableArray([]); //:RecurrenceOccurrence[]
    if (values && values.recurrenceOccurrences) {
        values.recurrenceOccurrences.forEach(function(occurrence) {
            
            this.RecurrenceOccurrences.push(new RecurrenceOccurrence(occurrence));
            
        }.bind(this));
    }
}

module.exports = CalendarEvent;

CalendarEvent.RecurrenceRule = RecurrenceRule;
CalendarEvent.RecurrenceOccurrence = RecurrenceOccurrence;
},{"./Model":40,"knockout":false,"moment":false}],33:[function(require,module,exports){
/** CalendarSlot model.

    Describes a time slot in the calendar, for a consecutive
    event, appointment or free time.
 **/
'use strict';

var ko = require('knockout'),
    Model = require('./Model'),
    Client = require('./Client');

function CalendarSlot(values) {
    
    Model(this);

    this.model.defProperties({
        startTime: null,
        endTime: null,
        
        subject: '',
        description: null,
        link: '#',

        actionIcon: null,
        actionText: null,
        
        classNames: ''

    }, values);
}

module.exports = CalendarSlot;

},{"./Client":34,"./Model":40,"knockout":false}],34:[function(require,module,exports){
/** Client model **/
'use strict';

var ko = require('knockout'),
    Model = require('./Model');

function Client(values) {
    
    Model(this);
    
    this.model.defProperties({
        firstName: '',
        lastName: ''
    }, values);

    this.fullName = ko.computed(function() {
        return (this.firstName() + ' ' + this.lastName());
    }, this);
}

module.exports = Client;

},{"./Model":40,"knockout":false}],35:[function(require,module,exports){
/** GetMore model **/
'use strict';

var ko = require('knockout'),
    Model = require('./Model'),
    ListViewItem = require('./ListViewItem');

function GetMore(values) {

    Model(this);

    this.model.defProperties({
        availability: false,
        payments: false,
        profile: false,
        coop: true
    });
    
    var availableItems = {
        availability: new ListViewItem({
            contentLine1: 'Complete your availability to create a cleaner calendar',
            markerIcon: 'glyphicon glyphicon-calendar',
            actionIcon: 'glyphicon glyphicon-chevron-right'
        }),
        payments: new ListViewItem({
            contentLine1: 'Start accepting payments through Loconomics',
            markerIcon: 'glyphicon glyphicon-usd',
            actionIcon: 'glyphicon glyphicon-chevron-right'
        }),
        profile: new ListViewItem({
            contentLine1: 'Activate your profile in the marketplace',
            markerIcon: 'glyphicon glyphicon-user',
            actionIcon: 'glyphicon glyphicon-chevron-right'
        }),
        coop: new ListViewItem({
            contentLine1: 'Learn more about our cooperative',
            actionIcon: 'glyphicon glyphicon-chevron-right'
        })
    };

    this.items = ko.pureComputed(function() {
        var items = [];
        
        Object.keys(availableItems).forEach(function(key) {
            
            if (this[key]())
                items.push(availableItems[key]);
        }.bind(this));

        return items;
    }, this);
}

module.exports = GetMore;

},{"./ListViewItem":36,"./Model":40,"knockout":false}],36:[function(require,module,exports){
/** ListViewItem model.

    Describes a generic item of a
    ListView component.
 **/
'use strict';

var ko = require('knockout'),
    Model = require('./Model'),
    moment = require('moment');

function ListViewItem(values) {
    
    Model(this);

    this.model.defProperties({
        markerLine1: null,
        markerLine2: null,
        markerIcon: null,
        
        contentLine1: '',
        contentLine2: null,
        link: '#',

        actionIcon: null,
        actionText: null,
        
        classNames: ''

    }, values);
}

module.exports = ListViewItem;

},{"./Model":40,"knockout":false,"moment":false}],37:[function(require,module,exports){
/** Location model **/
'use strict';

var ko = require('knockout'),
    Model = require('./Model');

function Location(values) {

    Model(this);
    
    this.model.defProperties({
        locationID: 0,
        name: '',
        addressLine1: null,
        addressLine2: null,
        city: null,
        stateProvinceCode: null,
        stateProviceID: null,
        postalCode: null,
        postalCodeID: null,
        countryID: null,
        latitude: null,
        longitude: null,
        specialInstructions: null,
        isServiceRadius: false,
        isServiceLocation: false,
        serviceRadius: 0
    }, values);
    
    this.singleLine = ko.computed(function() {
        
        var list = [
            this.addressLine1(),
            this.city(),
            this.postalCode(),
            this.stateProvinceCode()
        ];
        
        return list.filter(function(v) { return !!v; }).join(', ');
    }, this);
    
    this.countryName = ko.computed(function() {
        return (
            this.countryID() === 1 ?
            'United States' :
            this.countryID() === 2 ?
            'Spain' :
            'unknow'
        );
    }, this);
    
    this.countryCodeAlpha2 = ko.computed(function() {
        return (
            this.countryID() === 1 ?
            'US' :
            this.countryID() === 2 ?
            'ES' :
            ''
        );
    }, this);
    
    this.latlng = ko.computed(function() {
        return {
            lat: this.latitude(),
            lng: this.longitude()
        };
    }, this);
}

module.exports = Location;

},{"./Model":40,"knockout":false}],38:[function(require,module,exports){
/** MailFolder model **/
'use strict';

var ko = require('knockout'),
    Model = require('./Model'),
    moment = require('moment'),
    _ = require('lodash');

function MailFolder(values) {

    Model(this);

    this.model.defProperties({
        messages: [],
        topNumber: 10
    }, values);
    
    this.top = ko.pureComputed(function top(num) {
        if (num) this.topNumber(num);
        return _.first(this.messages(), this.topNumber());
    }, this);
}

module.exports = MailFolder;

},{"./Model":40,"knockout":false,"lodash":false,"moment":false}],39:[function(require,module,exports){
/** Message model.

    Describes a message from a MailFolder.
    A message could be of different types,
    as inquiries, bookings, booking requests.
 **/
'use strict';

var ko = require('knockout'),
    Model = require('./Model'),
    moment = require('moment');
//TODO   Thread = require('./Thread');

function Message(values) {
    
    Model(this);

    this.model.defProperties({
        createdDate: null,
        updatedDate: null,
        
        subject: '',
        content: null,
        link: '#',

        actionIcon: null,
        actionText: null,
        
        classNames: ''

    }, values);
    
    // Smart visualization of date and time
    this.displayedDate = ko.pureComputed(function() {
        
        return moment(this.createdDate()).locale('en-US-LC').calendar();
        
    }, this);
    
    this.displayedTime = ko.pureComputed(function() {
        
        return moment(this.createdDate()).locale('en-US-LC').format('LT');
        
    }, this);
}

module.exports = Message;

},{"./Model":40,"knockout":false,"moment":false}],40:[function(require,module,exports){
/**
    Model class to help build models.

    Is not exactly an 'OOP base' class, but provides
    utilities to models and a model definition object
    when executed in their constructors as:
    
    '''
    function MyModel() {
        Model(this);
        // Now, there is a this.model property with
        // an instance of the Model class, with 
        // utilities and model settings.
    }
    '''
    
    That auto creation of 'model' property can be avoided
    when using the object instantiation syntax ('new' keyword):
    
    '''
    var model = new Model(obj);
    // There is no a 'obj.model' property, can be
    // assigned to whatever property or nothing.
    '''
**/
'use strict';
var ko = require('knockout');
ko.mapping = require('knockout.mapping');

function Model(modelObject) {
    
    if (!(this instanceof Model)) {
        // Executed as a function, it must create
        // a Model instance
        var model = new Model(modelObject);
        // and register automatically as part
        // of the modelObject in 'model' property
        modelObject.model = model;
        
        // Returns the instance
        return model;
    }
 
    // It includes a reference to the object
    this.modelObject = modelObject;
    // It maintains a list of properties and fields
    this.propertiesList = [];
    this.fieldsList = [];
    // It allow setting the 'ko.mapping.fromJS' mapping options
    // to control conversions from plain JS objects when 
    // 'updateWith'.
    this.mappingOptions = {};
}

module.exports = Model;

/**
    Define observable properties using the given
    properties object definition that includes de default values,
    and some optional initialValues (normally that is provided externally
    as a parameter to the model constructor, while default values are
    set in the constructor).
    That properties become members of the modelObject, simplifying 
    model definitions.
    
    It uses Knockout.observable and observableArray, so properties
    are funtions that reads the value when no arguments or sets when
    one argument is passed of.
**/
Model.prototype.defProperties = function defProperties(properties, initialValues) {

    initialValues = initialValues || {};

    var modelObject = this.modelObject,
        propertiesList = this.propertiesList;

    Object.keys(properties).forEach(function(key) {
        
        var defVal = properties[key];
        // Create observable property with default value
        modelObject[key] = Array.isArray(defVal) ?
            ko.observableArray(defVal) :
            ko.observable(defVal);
        // Remember default
        modelObject[key]._defaultValue = defVal;
        // remember initial
        modelObject[key]._initialValue = initialValues[key];
        
        // If there is an initialValue, set it:
        if (typeof(initialValues[key]) !== 'undefined') {
            modelObject[key](initialValues[key]);
        }
        
        // Add to the internal registry
        propertiesList.push(key);
    });
};

/**
    Define fields as plain members of the modelObject using
    the fields object definition that includes default values,
    and some optional initialValues.
    
    Its like defProperties, but for plain js values rather than observables.
**/
Model.prototype.defFields = function defFields(fields, initialValues) {

    initialValues = initialValues || {};

    var modelObject = this.modelObject,
        fieldsList = this.fieldsList;

    Object.keys(fields).each(function(key) {
        
        var defVal = fields[key];
        // Create field with default value
        modelObject[key] = defVal;
        
        // If there is an initialValue, set it:
        if (typeof(initialValues[key]) !== 'undefined') {
            modelObject[key] = initialValues[key];
        }
        
        // Add to the internal registry
        fieldsList.push(key);
    });    
};

Model.prototype.updateWith = function updateWith(data) {
    
    // We need a plain object for 'fromJS'.
    // If is a model, extract their properties and fields from
    // the observables (fromJS), so we not get computed
    // or functions, just registered properties and fields
    if (data && data.model instanceof Model) {
        
        var plain = {};

        data.model.propertiesList.forEach(function(property) {
            // Properties are observables, so functions without params:
            plain[property] = data[property]();
        });
        
        data.model.fieldsList.forEach(function(field) {
            // Fields are just plain object members for values, just copy:
            plain[field] = data[field];
        });

        data = plain;
    }

    ko.mapping.fromJS(data, this.mappingOptions, this.modelObject);
};

Model.prototype.clone = function clone(data) {
    // Get a plain object with the object data
    var plain = ko.mapping.toJS(this.modelObject);
    // Create a new model instance, using the source plain object
    // as initial values
    var cloned = new this.modelObject.constructor(plain);
    // Update the cloned with the provided plain data used
    // to replace values on the cloned one, for quick one-step creation
    // of derived objects.
    cloned.model.updateWith(data);
    // Cloned model ready:
    return cloned;
};

},{"knockout":false,"knockout.mapping":false}],41:[function(require,module,exports){
/** PerformanceSummary model **/
'use strict';

var ko = require('knockout'),
    Model = require('./Model'),
    ListViewItem = require('./ListViewItem'),
    moment = require('moment'),
    numeral = require('numeral');

function PerformanceSummary(values) {

    Model(this);

    values = values || {};

    this.earnings = new Earnings(values.earnings);
    
    var earningsLine = new ListViewItem();
    earningsLine.markerLine1 = ko.computed(function() {
        var num = numeral(this.currentAmount()).format('$0,0');
        return num;
    }, this.earnings);
    earningsLine.contentLine1 = ko.computed(function() {
        return this.currentConcept();
    }, this.earnings);
    earningsLine.markerLine2 = ko.computed(function() {
        var num = numeral(this.nextAmount()).format('$0,0');
        return num;
    }, this.earnings);
    earningsLine.contentLine2 = ko.computed(function() {
        return this.nextConcept();
    }, this.earnings);
    

    this.timeBooked = new TimeBooked(values.timeBooked);

    var timeBookedLine = new ListViewItem();
    timeBookedLine.markerLine1 = ko.computed(function() {
        var num = numeral(this.percent()).format('0%');
        return num;
    }, this.timeBooked);
    timeBookedLine.contentLine1 = ko.computed(function() {
        return this.concept();
    }, this.timeBooked);
    
    
    this.items = ko.pureComputed(function() {
        var items = [];
        
        items.push(earningsLine);
        items.push(timeBookedLine);

        return items;
    }, this);
}

module.exports = PerformanceSummary;

function Earnings(values) {

    Model(this);
    
    this.model.defProperties({
    
         currentAmount: 0,
         currentConceptTemplate: 'already paid this month',
         nextAmount: 0,
         nextConceptTemplate: 'projected {month} earnings'

    }, values);
    
    this.currentConcept = ko.pureComputed(function() {

        var month = moment().format('MMMM');
        return this.currentConceptTemplate().replace(/\{month\}/, month);

    }, this);

    this.nextConcept = ko.pureComputed(function() {

        var month = moment().add(1, 'month').format('MMMM');
        return this.nextConceptTemplate().replace(/\{month\}/, month);

    }, this);
}

function TimeBooked(values) {

    Model(this);
    
    this.model.defProperties({
    
        percent: 0,
        conceptTemplate: 'of available time booked in {month}'
    
    }, values);
    
    this.concept = ko.pureComputed(function() {

        var month = moment().add(1, 'month').format('MMMM');
        return this.conceptTemplate().replace(/\{month\}/, month);

    }, this);
}

},{"./ListViewItem":36,"./Model":40,"knockout":false,"moment":false,"numeral":1}],42:[function(require,module,exports){
/** Position model.
 **/
'use strict';

var ko = require('knockout'),
    Model = require('./Model');

function Position(values) {
    
    Model(this);

    this.model.defProperties({
        positionID: 0,
        positionSingular: '',
        positionPlural: '',
        description: '',
        active: true

    }, values);
}

module.exports = Position;

},{"./Model":40,"knockout":false}],43:[function(require,module,exports){
/** Service model **/
'use strict';

var ko = require('knockout'),
    Model = require('./Model');

function Service(values) {

    Model(this);
    
    this.model.defProperties({
        name: '',
        price: 0,
        duration: 0, // in minutes
        isAddon: false
    }, values);
    
    this.durationText = ko.computed(function() {
        var minutes = this.duration() || 0;
        // TODO: Formatting, localization
        return minutes ? minutes + ' minutes' : '';
    }, this);
}

module.exports = Service;

},{"./Model":40,"knockout":false}],44:[function(require,module,exports){
/** UpcomingBookingsSummary model **/
'use strict';

var ko = require('knockout'),
    Model = require('./Model'),
    BookingSummary = require('./BookingSummary');

function UpcomingBookingsSummary() {

    Model(this);

    this.today = new BookingSummary({
        concept: 'left today',
        timeFormat: ' [ending @] h:mma'
    });
    this.tomorrow = new BookingSummary({
        concept: 'tomorrow',
        timeFormat: ' [starting @] h:mma'
    });
    this.nextWeek = new BookingSummary({
        concept: 'next week'
    });
    
    this.items = ko.pureComputed(function() {
        var items = [];
        
        //if (this.today.quantity())
        items.push(this.today);
        //if (this.tomorrow.quantity())
        items.push(this.tomorrow);
        //if (this.nextWeek.quantity())
        items.push(this.nextWeek);

        return items;
    }, this);
    
}

module.exports = UpcomingBookingsSummary;

},{"./BookingSummary":31,"./Model":40,"knockout":false}],45:[function(require,module,exports){
/** User model **/
'use strict';

var ko = require('knockout'),
    Model = require('./Model');

// Enum UserType
var UserType = {
    None: 0,
    Anonymous: 1,
    Customer: 2,
    Provider: 4,
    Admin: 8,
    LoggedUser: 14,
    User: 15,
    System: 16
};

function User(values) {
    
    Model(this);
    
    this.model.defProperties({
        userID: 0,
        email: '',
        firstName: '',
        middleIn: '',
        lastName: '',
        secondLastName: '',
        nickName: null,
        publicBio: null,
        genderID: 0,
        preferredLanguageID: null,
        preferredCountryID: null,
        isProvider: false,
        isCustomer: false,
        isMember: false,
        isAdmin: false,
        mobilePhone: null,
        alternatePhone: null,
        providerProfileURL: null,
        providerWebsiteURL: null,
        createdDate: null,
        updatedDate: null,
        modifiedBy: null,
        active: false,
        accountStatusID: 0,
        bookCode: null,
        onboardingStep: null,
        businessName: null,
        alternateEmail: null
    }, values);

    this.fullName = ko.computed(function() {
        return (this.firstName() + ' ' + this.lastName());
    }, this);
    
    this.userType = ko.pureComputed({
        read: function() {
            var c = this.isCustomer(),
                p = this.isProvider(),
                a = this.isAdmin();
            
            var userType = 0;
            
            if (this.isAnonymous()) {
                userType = userType | UserType.Anonymous;
            }
            if (c)
                userType = userType | UserType.Customer;
            if (p)
                userType = userType | UserType.Provider;
            if (a)
                userType = userType | UserType.Admin;
            
            return userType;
        },
        /* NOTE: Not require for now:
        write: function(v) {
        },*/
        owner: this
    });
    
    this.isAnonymous = ko.pureComputed(function(){
        return this.userID() < 1;
    }, this);
    
    /**
        It matches a UserType from the enumeration?
    **/
    this.isUserType = function isUserType(type) {
        return (this.userType() & type);
    }.bind(this);
}

module.exports = User;

User.UserType = UserType;

/* Creatint an anonymous user with some pressets */
User.newAnonymous = function newAnonymous() {
    return new User({
        userID: 0,
        email: '',
        firstName: '',
        onboardingStep: null
    });
};

},{"./Model":40,"knockout":false}],46:[function(require,module,exports){
/** Calendar Appointments test data **/
var Appointment = require('../models/Appointment');
var testLocations = require('./locations').locations;
var testServices = require('./services').services;
var ko = require('knockout');
var moment = require('moment');

var today = moment(),
    tomorrow = moment().add(1, 'days'),
    tomorrow10 = tomorrow.clone().hours(10).minutes(0).seconds(0),
    tomorrow16 = tomorrow.clone().hours(16).minutes(30).seconds(0);
    
var testData = [
    new Appointment({
        id: 1,
        startTime: tomorrow10,
        endTime: tomorrow16,
        summary: 'Massage Therapist Booking',
        //pricingSummary: 'Deep Tissue Massage 120m plus 2 more',
        services: testServices,
        ptotalPrice: 95.0,
        location: ko.toJS(testLocations[0]),
        preNotesToClient: 'Looking forward to seeing the new color',
        preNotesToSelf: 'Ask him about his new color',
        client: {
            firstName: 'Joshua',
            lastName: 'Danielson'
        }
    }),
    new Appointment({
        id: 2,
        startTime: new Date(2014, 11, 1, 13, 0, 0),
        endTime: new Date(2014, 11, 1, 13, 50, 0),
        summary: 'Massage Therapist Booking',
        //pricingSummary: 'Another Massage 50m',
        services: [testServices[0]],
        ptotalPrice: 95.0,
        location: ko.toJS(testLocations[1]),
        preNotesToClient: 'Something else',
        preNotesToSelf: 'Remember that thing',
        client: {
            firstName: 'Joshua',
            lastName: 'Danielson'
        }
    }),
    new Appointment({
        id: 3,
        startTime: new Date(2014, 11, 1, 16, 0, 0),
        endTime: new Date(2014, 11, 1, 18, 0, 0),
        summary: 'Massage Therapist Booking',
        //pricingSummary: 'Tissue Massage 120m',
        services: [testServices[1]],
        ptotalPrice: 95.0,
        location: ko.toJS(testLocations[2]),
        preNotesToClient: '',
        preNotesToSelf: 'Ask him about the forgotten notes',
        client: {
            firstName: 'Joshua',
            lastName: 'Danielson'
        }
    }),
];

exports.appointments = testData;

},{"../models/Appointment":30,"./locations":49,"./services":51,"knockout":false,"moment":false}],47:[function(require,module,exports){
/** Calendar Slots test data **/
var CalendarSlot = require('../models/CalendarSlot');

var Time = require('../utils/Time');
var moment = require('moment');

var today = new Date(),
    tomorrow = new Date();
tomorrow.setDate(tomorrow.getDate() + 1);

var stoday = moment(today).format('YYYY-MM-DD'),
    stomorrow = moment(tomorrow).format('YYYY-MM-DD');

var testData1 = [
    new CalendarSlot({
        startTime: new Time(today, 0, 0, 0),
        endTime: new Time(today, 12, 0, 0),
        
        subject: 'Free',
        description: null,
        link: '#!appointment/0',

        actionIcon: 'glyphicon glyphicon-plus',
        actionText: null,

        classNames: 'ListView-item--tag-success'
    }),
    new CalendarSlot({
        startTime: new Time(today, 12, 0, 0),
        endTime: new Time(today, 13, 0, 0),
        
        subject: 'Josh Danielson',
        description: 'Deep Tissue Massage',
        link: '#!appointment/3',

        actionIcon: 'glyphicon glyphicon-plus',
        actionText: null,

        classNames: null
    }),
    new CalendarSlot({
        startTime: new Time(today, 13, 0, 0),
        endTime: new Time(today, 15, 0, 0),

        subject: 'Do that important thing',
        description: null,
        link: '#!event/8',

        actionIcon: 'glyphicon glyphicon-new-window',
        actionText: null,

        classNames: null
    }),
    new CalendarSlot({
        startTime: new Time(today, 15, 0, 0),
        endTime: new Time(today, 16, 0, 0),
        
        subject: 'Iago Lorenzo',
        description: 'Deep Tissue Massage Long Name',
        link: '#!appointment/5',

        actionIcon: null,
        actionText: '$159.90',

        classNames: null
    }),
    new CalendarSlot({
        startTime: new Time(today, 16, 0, 0),
        endTime: new Time(today, 0, 0, 0),
        
        subject: 'Free',
        description: null,
        link: '#!appointment/0',

        actionIcon: 'glyphicon glyphicon-plus',
        actionText: null,

        classNames: 'ListView-item--tag-success'
    })
];
var testData2 = [
    new CalendarSlot({
        startTime: new Time(tomorrow, 0, 0, 0),
        endTime: new Time(tomorrow, 9, 0, 0),
        
        subject: 'Free',
        description: null,
        link: '#!appointment/0',

        actionIcon: 'glyphicon glyphicon-plus',
        actionText: null,

        classNames: 'ListView-item--tag-success'
    }),
    new CalendarSlot({
        startTime: new Time(tomorrow, 9, 0, 0),
        endTime: new Time(tomorrow, 10, 0, 0),
        
        subject: 'Jaren Freely',
        description: 'Deep Tissue Massage Long Name',
        link: '#!appointment/1',

        actionIcon: null,
        actionText: '$59.90',

        classNames: null
    }),
    new CalendarSlot({
        startTime: new Time(tomorrow, 10, 0, 0),
        endTime: new Time(tomorrow, 11, 0, 0),
        
        subject: 'Free',
        description: null,
        link: '#!appointment/0',

        actionIcon: 'glyphicon glyphicon-plus',
        actionText: null,

        classNames: 'ListView-item--tag-success'
    }),
    new CalendarSlot({
        startTime: new Time(tomorrow, 11, 0, 0),
        endTime: new Time(tomorrow, 12, 45, 0),
        
        subject: 'CONFIRM-Susan Dee',
        description: 'Deep Tissue Massage',
        link: '#!appointment/2',

        actionIcon: null,
        actionText: '$70',

        classNames: 'ListView-item--tag-warning'
    }),
    new CalendarSlot({
        startTime: new Time(tomorrow, 12, 45, 0),
        endTime: new Time(tomorrow, 16, 0, 0),
        
        subject: 'Free',
        description: null,
        link: '#!appointment/0',

        actionIcon: 'glyphicon glyphicon-plus',
        actionText: null,

        classNames: 'ListView-item--tag-success'
    }),
    new CalendarSlot({
        startTime: new Time(tomorrow, 16, 0, 0),
        endTime: new Time(tomorrow, 17, 15, 0),
        
        subject: 'Susan Dee',
        description: 'Deep Tissue Massage',
        link: '#!appointment/3',

        actionIcon: 'glyphicon glyphicon-plus',
        actionText: null,

        classNames: null
    }),
    new CalendarSlot({
        startTime: new Time(tomorrow, 17, 15, 0),
        endTime: new Time(tomorrow, 18, 30, 0),
        
        subject: 'Dentist appointment',
        description: null,
        link: '#!event/4',

        actionIcon: 'glyphicon glyphicon-new-window',
        actionText: null,

        classNames: null
    }),
    new CalendarSlot({
        startTime: new Time(tomorrow, 18, 30, 0),
        endTime: new Time(tomorrow, 19, 30, 0),
        
        subject: 'Susan Dee',
        description: 'Deep Tissue Massage Long Name',
        link: '#!appointment/5',

        actionIcon: null,
        actionText: '$159.90',

        classNames: null
    }),
    new CalendarSlot({
        startTime: new Time(tomorrow, 19, 30, 0),
        endTime: new Time(tomorrow, 23, 0, 0),
        
        subject: 'Free',
        description: null,
        link: '#!appointment/0',

        actionIcon: 'glyphicon glyphicon-plus',
        actionText: null,

        classNames: 'ListView-item--tag-success'
    }),
    new CalendarSlot({
        startTime: new Time(tomorrow, 23, 0, 0),
        endTime: new Time(tomorrow, 0, 0, 0),

        subject: 'Jaren Freely',
        description: 'Deep Tissue Massage',
        link: '#!appointment/6',

        actionIcon: null,
        actionText: '$80',

        classNames: null
    })
];
var testDataFree = [
    new CalendarSlot({
        startTime: new Time(tomorrow, 0, 0, 0),
        endTime: new Time(tomorrow, 0, 0, 0),

        subject: 'Free',
        description: null,
        link: '#!appointment/0',

        actionIcon: 'glyphicon glyphicon-plus',
        actionText: null,

        classNames: 'ListView-item--tag-success'
    })
];

var testData = {
    'default': testDataFree
};
testData[stoday] = testData1;
testData[stomorrow] = testData2;

exports.calendar = testData;

},{"../models/CalendarSlot":33,"../utils/Time":56,"moment":false}],48:[function(require,module,exports){
/** Clients test data **/
var Client = require('../models/Client');

var testData = [
    new Client ({
        firstName: 'Joshua',
        lastName: 'Danielson'
    }),
    new Client({
        firstName: 'Iago',
        lastName: 'Lorenzo'
    }),
    new Client({
        firstName: 'Fernando',
        lastName: 'Gago'
    }),
    new Client({
        firstName: 'Adam',
        lastName: 'Finch'
    }),
    new Client({
        firstName: 'Alan',
        lastName: 'Ferguson'
    }),
    new Client({
        firstName: 'Alex',
        lastName: 'Pena'
    }),
    new Client({
        firstName: 'Alexis',
        lastName: 'Peaca'
    }),
    new Client({
        firstName: 'Arthur',
        lastName: 'Miller'
    })
];

exports.clients = testData;

},{"../models/Client":34}],49:[function(require,module,exports){
/** Locations test data **/
var Location = require('../models/Location');

var testData = [
    new Location ({
        locationID: 1,
        name: 'ActviSpace',
        addressLine1: '3150 18th Street',
        postalCode: 90001,
        isServiceRadius: true,
        serviceRadius: 2
    }),
    new Location({
        locationID: 2,
        name: 'Corey\'s Apt',
        addressLine1: '187 Bocana St.',
        postalCode: 90002
    }),
    new Location({
        locationID: 3,
        name: 'Josh\'a Apt',
        addressLine1: '429 Corbett Ave',
        postalCode: 90003
    })
];

exports.locations = testData;

},{"../models/Location":37}],50:[function(require,module,exports){
/** Inbox test data **/
var Message = require('../models/Message');

var Time = require('../utils/Time');
var moment = require('moment');

var today = new Date(),
    yesterday = new Date(),
    lastWeek = new Date(),
    oldDate = new Date();
yesterday.setDate(yesterday.getDate() - 1);
lastWeek.setDate(lastWeek.getDate() - 2);
oldDate.setDate(oldDate.getDate() - 16);

var testData = [
    new Message({
        createdDate: new Time(today, 11, 0, 0),
        
        subject: 'CONFIRM-Susan Dee',
        content: 'Deep Tissue Massage',
        link: '#messages/inbox/1',

        actionIcon: null,
        actionText: '$70',

        classNames: 'ListView-item--tag-warning'
    }),
    new Message({
        createdDate: new Time(yesterday, 13, 0, 0),

        subject: 'Do you do "Exotic Massage"?',
        content: 'Hi, I wanted to know if you perform as par of your services...',
        link: '#messages/inbox/3',

        actionIcon: 'glyphicon glyphicon-share-alt',
        actionText: null,

        classNames: null
    }),
    new Message({
        createdDate: new Time(lastWeek, 12, 0, 0),
        
        subject: 'Josh Danielson',
        content: 'Deep Tissue Massage',
        link: '#messages/inbox/2',

        actionIcon: 'glyphicon glyphicon-plus',
        actionText: null,

        classNames: null
    }),
    new Message({
        createdDate: new Time(oldDate, 15, 0, 0),
        
        subject: 'Inquiry',
        content: 'Another question from another client.',
        link: '#messages/inbox/4',

        actionIcon: 'glyphicon glyphicon-share-alt',

        classNames: null
    })
];

exports.messages = testData;

},{"../models/Message":39,"../utils/Time":56,"moment":false}],51:[function(require,module,exports){
/** Services test data **/
var Service = require('../models/Service');

var testData = [
    new Service ({
        name: 'Deep Tissue Massage',
        price: 95,
        duration: 120
    }),
    new Service({
        name: 'Tissue Massage',
        price: 60,
        duration: 60
    }),
    new Service({
        name: 'Special oils',
        price: 95,
        isAddon: true
    }),
    new Service({
        name: 'Some service extra',
        price: 40,
        duration: 20,
        isAddon: true
    })
];

exports.services = testData;

},{"../models/Service":43}],52:[function(require,module,exports){
/** 
    timeSlots
    testing data
**/

var Time = require('../utils/Time');

var moment = require('moment');

var today = new Date(),
    tomorrow = new Date();
tomorrow.setDate(tomorrow.getDate() + 1);

var stoday = moment(today).format('YYYY-MM-DD'),
    stomorrow = moment(tomorrow).format('YYYY-MM-DD');

var testData1 = [
    Time(today, 9, 15),
    Time(today, 11, 30),
    Time(today, 12, 0),
    Time(today, 12, 30),
    Time(today, 16, 15),
    Time(today, 18, 0),
    Time(today, 18, 30),
    Time(today, 19, 0),
    Time(today, 19, 30),
    Time(today, 21, 30),
    Time(today, 22, 0)
];

var testData2 = [
    Time(tomorrow, 8, 0),
    Time(tomorrow, 10, 30),
    Time(tomorrow, 11, 0),
    Time(tomorrow, 11, 30),
    Time(tomorrow, 12, 0),
    Time(tomorrow, 12, 30),
    Time(tomorrow, 13, 0),
    Time(tomorrow, 13, 30),
    Time(tomorrow, 14, 45),
    Time(tomorrow, 16, 0),
    Time(tomorrow, 16, 30)
];

var testDataBusy = [
];

var testData = {
    'default': testDataBusy
};
testData[stoday] = testData1;
testData[stomorrow] = testData2;

exports.timeSlots = testData;

},{"../utils/Time":56,"moment":false}],53:[function(require,module,exports){
/**
    New Function method: '_delayed'.
    It returns a new function, wrapping the original one,
    that once its call will delay the execution the given milliseconds,
    using a setTimeout.
    The new function returns 'undefined' since it has not the result,
    because of that is only suitable with return-free functions 
    like event handlers.
    
    Why: sometimes, the handler for an event needs to be executed
    after a delay instead of instantly.
**/
Function.prototype._delayed = function delayed(milliseconds) {
    var fn = this;
    return function() {
        var context = this,
            args = arguments;
        setTimeout(function () {
            fn.apply(context, args);
        }, milliseconds);
    };
};

},{}],54:[function(require,module,exports){
/**
    Extending the Function class with an inherits method.
    
    The initial low dash is to mark it as no-standard.
**/
Function.prototype._inherits = function _inherits(superCtor) {
    this.prototype = Object.create(superCtor.prototype, {
        constructor: {
            value: this,
            enumerable: false,
            writable: true,
            configurable: true
        }
    });
};

},{}],55:[function(require,module,exports){
/**
    REST API access
**/
'use strict';
var $ = require('jquery');

function lowerFirstLetter(n) {
    return n && n[0] && n[0].toLowerCase && (n[0].toLowerCase() + n.slice(1)) || n;
}

function lowerCamelizeObject(obj) {
    //jshint maxcomplexity:8
    
    if (!obj || typeof(obj) !== 'object') return obj;

    var ret = Array.isArray(obj) ? [] : {};
    for(var k in obj) {
        if (obj.hasOwnProperty(k)) {
            var newk = lowerFirstLetter(k);
            ret[newk] = typeof(obj[k]) === 'object' ?
                lowerCamelizeObject(obj[k]) :
                obj[k]
            ;
        }
    }
    return ret;
}

function Rest(optionsOrUrl) {
    
    var url = typeof(optionsOrUrl) === 'string' ?
        optionsOrUrl :
        optionsOrUrl && optionsOrUrl.url;

    this.baseUrl = url;
    // Optional extraHeaders for all requests,
    // usually for authentication tokens
    this.extraHeaders = null;
}

Rest.prototype.get = function get(apiUrl, data) {
    return this.request(apiUrl, 'get', data);
};

Rest.prototype.put = function get(apiUrl, data) {
    return this.request(apiUrl, 'put', data);
};

Rest.prototype.post = function get(apiUrl, data) {
    return this.request(apiUrl, 'post', data);
};

Rest.prototype.delete = function get(apiUrl, data) {
    return this.request(apiUrl, 'delete', data);
};

Rest.prototype.putFile = function putFile(apiUrl, data) {
    // NOTE basic putFile implementation, one file, use fileUpload?
    return this.request(apiUrl, 'delete', data, 'multipart/form-data');
};

Rest.prototype.request = function request(apiUrl, httpMethod, data, contentType) {
    
    var thisRest = this;
    var url = this.baseUrl + apiUrl;

    return Promise.resolve($.ajax({
        url: url,
        // Avoid cache for data.
        cache: false,
        dataType: 'json',
        method: httpMethod,
        headers: this.extraHeaders,
        // URLENCODED input:
        // Convert to JSON and back just to ensure the values are converted/encoded
        // properly to be sent, like Dates being converted to ISO format.
        data: data && JSON.parse(JSON.stringify(data)),
        contentType: contentType || 'application/x-www-form-urlencoded'
        // Alternate: JSON as input
        //data: JSON.stringify(data),
        //contentType: contentType || 'application/json'
    }))
    .then(lowerCamelizeObject)
    .catch(function(err) {
        // On authorization error, give oportunity to retry the operation
        if (err.status === 401) {
            var retry = request.bind(this, apiUrl, httpMethod, data, contentType);
            var retryPromise = thisRest.onAuthorizationRequired(retry);
            if (retryPromise) {
                // It returned something, expecting is a promise:
                return Promise.resolve(retryPromise)
                .catch(function(){
                    // There is error on retry, just return the
                    // original call error
                    return err;
                });
            }
        }
        // by default, continue propagating the error
        return err;
    });
};

Rest.prototype.onAuthorizationRequired = function onAuthorizationRequired(retry) {
    // To be implemented outside, by default don't wait
    // for retry, just return nothing:
    return;
};

module.exports = Rest;

},{}],56:[function(require,module,exports){
/**
    Time class utility.
    Shorter way to create a Date instance
    specifying only the Time part,
    defaulting to current date or 
    another ready date instance.
**/
function Time(date, hour, minute, second) {
    if (!(date instanceof Date)) {
 
        second = minute;
        minute = hour;
        hour = date;
        
        date = new Date();   
    }

    return new Date(date.getFullYear(), date.getMonth(), date.getDate(), hour || 0, minute || 0, second || 0);
}
module.exports = Time;

},{}],57:[function(require,module,exports){
/**
    Create an Access Control for an app that just checks
    the activity property for allowed user level.
    To be provided to Shell.js and used by the app.js,
    very tied to that both classes.
    
    Activities can define on its object an accessLevel
    property like next examples
    
    this.accessLevel = app.Usertype.User; // anyone
    this.accessLevel = app.UserType.Anonymous; // anonymous users only
    this.accessLevel = app.UserType.LoggedUser; // authenticated users only
**/
'use strict';

// UserType enumeration is bit based, so several
// users can has access in a single property
var UserType = require('../models/User').UserType;

module.exports = function createAccessControl(app) {
    
    return function accessControl(route) {

        var activity = app.getActivityControllerByRoute(route);

        var user = app.model.user();
        var currentType = user && user.userType();

        if (activity && activity.accessLevel) {

            var can = activity.accessLevel & currentType;
            
            if (!can) {
                // Notify error, why cannot access
                return {
                    requiredLevel: activity.accessLevel,
                    currentType: currentType
                };
            }
        }

        // Allow
        return null;
    };
};

},{"../models/User":45}],58:[function(require,module,exports){
'use strict';

var unwrap = function unwrap(value) {
    return (typeof(value) === 'function' ? value() : value);
};

exports.defineCrudApiForRest = function defineCrudApiForRest(settings) {
    
    var extendedObject = settings.extendedObject,
        Model = settings.Model,
        modelName = settings.modelName,
        modelListName = settings.modelListName,
        modelUrl = settings.modelUrl,
        idPropertyName = settings.idPropertyName;

    extendedObject['get' + modelListName] = function getList(filters) {
        
        return this.rest.get(modelUrl, filters)
        .then(function(rawItems) {
            return rawItems && rawItems.map(function(rawItem) {
                return new Model(rawItem);
            });
        });
    };
    
    extendedObject['get' + modelName] = function getItem(itemID) {
        
        return this.rest.get(modelUrl + '/' + itemID)
        .then(function(rawItem) {
            
            return rawItem && new Model(rawItem);
        });
    };

    extendedObject['post' + modelName] = function postItem(anItem) {
        
        return this.rest.post(modelUrl, anItem).then(function(anItem) {
            return new Model(anItem);
        });
    };

    extendedObject['put' + modelName] = function putItem(anItem) {
        return this.rest.put(modelUrl + '/' + unwrap(anItem[idPropertyName]), anItem);
    };
    
    extendedObject['set' + modelName] = function setItem(anItem) {
        var id = unwrap(anItem[idPropertyName]);
        if (id)
            return this['put' + modelName](anItem);
        else
            return this['post' + modelName](anItem);
    };

    extendedObject['del' + modelName] = function delItem(anItem) {
        var id = anItem && unwrap(anItem[idPropertyName]) ||
                anItem;
        if (id)
            return this.rest.delete(modelUrl + '/' + id, anItem)
            .then(function(deletedItem) {
                return deletedItem && new Model(deletedItem);
            });
        else
            throw new Error('Need an ID or an object with the ID property to delete');
    };
};
},{}],59:[function(require,module,exports){
/**
    Bootknock: Set of Knockout Binding Helpers for Bootstrap js components (jquery plugins)
    
    Dependencies: jquery
    Injected dependencies: knockout
**/
'use strict';

// Dependencies
var $ = require('jquery');
// DI i18n library
exports.i18n = null;

function createHelpers(ko) {
    var helpers = {};

    /** Popover Binding **/
    helpers.popover = {
        update: function(element, valueAccessor, allBindings) {
            var srcOptions = ko.unwrap(valueAccessor());

            // Duplicating options object to pass to popover without
            // overwrittng source configuration
            var options = $.extend(true, {}, srcOptions);
            
            // Unwrapping content text
            options.content = ko.unwrap(srcOptions.content);
            
            if (options.content) {
            
                // Localize:
                options.content = 
                    exports.i18n && exports.i18n.t(options.content) ||
                    options.content;
                
                // To get the new options, we need destroy it first:
                $(element).popover('destroy').popover(options);

                // Se muestra si el elemento tiene el foco
                if ($(element).is(':focus'))
                    $(element).popover('show');

            } else {
                $(element).popover('destroy');
            }
        }
    };
    
    return helpers;
}

/**
    Plug helpers in the provided Knockout instance
**/
function plugIn(ko, prefix) {
    var name,
        helpers = createHelpers(ko);
    
    for(var h in helpers) {
        if (helpers.hasOwnProperty && !helpers.hasOwnProperty(h))
            continue;

        name = prefix ? prefix + h[0].toUpperCase() + h.slice(1) : h;
        ko.bindingHandlers[name] = helpers[h];
    }
}

exports.plugIn = plugIn;
exports.createBindingHelpers = createHelpers;

},{}],60:[function(require,module,exports){
/**
    Espace a string for use on a RegExp.
    Usually, to look for a string in a text multiple times
    or with some expressions, some common are 
    look for a text 'in the beginning' (^)
    or 'at the end' ($).
    
    Author: http://stackoverflow.com/users/151312/coolaj86 and http://stackoverflow.com/users/9410/aristotle-pagaltzis
    Link: http://stackoverflow.com/a/6969486
**/
'use strict';

// Referring to the table here:
// https://developer.mozilla.org/en/JavaScript/Reference/Global_Objects/regexp
// these characters should be escaped
// \ ^ $ * + ? . ( ) | { } [ ]
// These characters only have special meaning inside of brackets
// they do not need to be escaped, but they MAY be escaped
// without any adverse effects (to the best of my knowledge and casual testing)
// : ! , = 
// my test "~!@#$%^&*(){}[]`/=?+\|-_;:'\",<.>".match(/[\#]/g)

var specials = [
    // order matters for these
      "-"
    , "["
    , "]"
    // order doesn't matter for any of these
    , "/"
    , "{"
    , "}"
    , "("
    , ")"
    , "*"
    , "+"
    , "?"
    , "."
    , "\\"
    , "^"
    , "$"
    , "|"
  ]

  // I choose to escape every character with '\'
  // even though only some strictly require it when inside of []
, regex = RegExp('[' + specials.join('\\') + ']', 'g')
;

var escapeRegExp = function (str) {
return str.replace(regex, "\\$&");
};

module.exports = escapeRegExp;

// test escapeRegExp("/path/to/res?search=this.that")

},{}],61:[function(require,module,exports){
/**
* escapeSelector
*
* source: http://kjvarga.blogspot.com.es/2009/06/jquery-plugin-to-escape-css-selector.html
*
* Escape all special jQuery CSS selector characters in *selector*.
* Useful when you have a class or id which contains special characters
* which you need to include in a selector.
*/
'use strict';

var specials = [
  '#', '&', '~', '=', '>', 
  "'", ':', '"', '!', ';', ','
];
var regexSpecials = [
  '.', '*', '+', '|', '[', ']', '(', ')', '/', '^', '$'
];
var sRE = new RegExp(
  '(' + specials.join('|') + '|\\' + regexSpecials.join('|\\') + ')', 'g'
);

module.exports = function(selector) {
  return selector.replace(sRE, '\\$1');
};

},{}],62:[function(require,module,exports){
/**
    Read a page's GET URL variables and return them as an associative array.
**/
'user strict';
//global window

module.exports = function getUrlQuery(url) {

    url = url || window.location.href;

    var vars = [], hash,
        queryIndex = url.indexOf('?');
    if (queryIndex > -1) {
        var hashes = url.slice(queryIndex + 1).split('&');
        for(var i = 0; i < hashes.length; i++)
        {
            hash = hashes[i].split('=');
            vars.push(hash[0]);
            vars[hash[0]] = hash[1];
        }
    }
    return vars;
};

},{}],63:[function(require,module,exports){
/**
    Set of utilities to define Javascript Properties
    independently of the browser.
    
    Allows to define getters and setters.
    
    Adapted code from the original created by Jeff Walden
    http://whereswalden.com/2010/04/16/more-spidermonkey-changes-ancient-esoteric-very-rarely-used-syntax-for-creating-getters-and-setters-is-being-removed/
**/
'use strict';

function accessorDescriptor(field, fun)
{
    var desc = { enumerable: true, configurable: true };
    desc[field] = fun;
    return desc;
}

function defineGetter(obj, prop, get)
{
    if (Object.defineProperty)
        return Object.defineProperty(obj, prop, accessorDescriptor("get", get));
    if (Object.prototype.__defineGetter__)
        return obj.__defineGetter__(prop, get);

    throw new Error("browser does not support getters");
}

function defineSetter(obj, prop, set)
{
    if (Object.defineProperty)
        return Object.defineProperty(obj, prop, accessorDescriptor("set", set));
    if (Object.prototype.__defineSetter__)
        return obj.__defineSetter__(prop, set);

    throw new Error("browser does not support setters");
}

module.exports = {
    defineGetter: defineGetter,
    defineSetter: defineSetter
};

},{}],64:[function(require,module,exports){
/**
    DomItemsManager class, that manage a collection 
    of HTML/DOM items under a root/container, where
    only one element at the time is visible, providing
    tools to uniquerly identify the items,
    to create or update new items (through 'inject'),
    get the current, find by the ID and more.
**/
'use strict';

var $ = require('jquery');
var escapeSelector = require('../escapeSelector');

function DomItemsManager(settings) {

    this.idAttributeName = settings.idAttributeName || 'id';
    this.allowDuplicates = !!settings.allowDuplicates || false;
    this.$root = null;
    // On page ready, get the root element:
    $(function() {
        this.$root = $(settings.root || 'body');
    }.bind(this));
}

module.exports = DomItemsManager;

DomItemsManager.prototype.find = function find(containerName, root) {
    var $root = $(root || this.$root);
    return $root.find('[' + this.idAttributeName + '="' + escapeSelector(containerName) + '"]');
};

DomItemsManager.prototype.getActive = function getActive() {
    return this.$root.find('[' + this.idAttributeName + ']:visible');
};

/**
    It adds the item in the html provided (can be only the element or 
    contained in another or a full html page).
    Replaces any existant if duplicates are not allowed.
**/
DomItemsManager.prototype.inject = function inject(name, html) {

    // Filtering input html (can be partial or full pages)
    // http://stackoverflow.com/a/12848798
    html = html.replace(/^[\s\S]*<body.*?>|<\/body>[\s\S]*$/g, '');

    // Creating a wrapper around the html
    // (can be provided the innerHtml or outerHtml, doesn't matters with next approach)
    var $html = $('<div/>', { html: html }),
        // We look for the container element (when the outerHtml is provided)
        $c = this.find(name, $html);

    if ($c.length === 0) {
        // Its innerHtml, so the wrapper becomes the container itself
        $c = $html.attr(this.idAttributeName, name);
    }

    if (!this.allowDuplicates) {
        // No more than one container instance can exists at the same time
        // We look for any existent one and its replaced with the new
        var $prev = this.find(name);
        if ($prev.length > 0) {
            $prev.replaceWith($c);
            $c = $prev;
        }
    }

    // Add to the document
    // (on the case of duplicated found, this will do nothing, no worry)
    $c.appendTo(this.$root);
};

/** 
    The switch method receive the items to interchange as active or current,
    the 'from' and 'to', and the shell instance that MUST be used
    to notify each event that involves the item:
    willClose, willOpen, ready, opened, closed.
    It receives as latest parameter the 'notification' object that must be
    passed with the event so handlers has context state information.
    
    It's designed to be able to manage transitions, but this default
    implementation is as simple as 'show the new and hide the old'.
**/
DomItemsManager.prototype.switch = function switchActiveItem($from, $to, shell, notification) {

    if (!$to.is(':visible')) {
        shell.emit(shell.events.willOpen, $to, notification);
        $to.show();
        // Its enough visible and in DOM to perform initialization tasks
        // that may involve layout information
        shell.emit(shell.events.itemReady, $to, notification);
        // When its completely opened
        shell.emit(shell.events.opened, $to, notification);
    } else {
        // Its ready; maybe it was but sub-location
        // or state change need to be communicated
        shell.emit(shell.events.itemReady, $to, notification);
    }

    if ($from.is(':visible')) {
        shell.emit(shell.events.willClose, $from, notification);
        // Do 'unfocus' on the hidden element after notify 'willClose'
        // for better UX: hidden elements are not reachable and has good
        // side effects like hidding the on-screen keyboard if an input was
        // focused
        $from.find(':focus').blur();
        // hide and notify it ended
        $from.hide();
        shell.emit(shell.events.closed, $from, notification);
    }
};

/**
    Initializes the list of items. No more than one
    must be opened/visible at the same time, so at the 
    init all the elements are closed waiting to set
    one as the active or the current one.
**/
DomItemsManager.prototype.init = function init() {
    this.getActive().hide();
};

},{"../escapeSelector":61}],65:[function(require,module,exports){
/**
    Javascritp Shell for SPAs.
**/
/*global window, document */
'use strict';

/** DI entry points for default builds. Most dependencies can be
    specified in the constructor settings for per-instance setup.
**/
var deps = require('./dependencies');

/** Constructor **/

function Shell(settings) {
    //jshint maxcomplexity:14
    
    deps.EventEmitter.call(this);

    this.$ = settings.jquery || deps.jquery;
    this.$root = this.$(settings.root);
    this.baseUrl = settings.baseUrl || '';
    // With forceHashbang=true:
    // - fragments URLs cannot be used to scroll to an element (default browser behavior),
    //   they are defaultPrevented to avoid confuse the routing mechanism and current URL.
    // - pressed links to fragments URLs are not routed, they are skipped silently
    //   except when they are a hashbang (#!). This way, special links
    //   that performn js actions doesn't conflits.
    // - all URLs routed through the shell includes a hashbang (#!), the shell ensures
    //   that happens by appending the hashbang to any URL passed in (except the standard hash
    //   that are skipt).
    this.forceHashbang = settings.forceHashbang || false;
    this.linkEvent = settings.linkEvent || 'click';
    this.parseUrl = (settings.parseUrl || deps.parseUrl).bind(this, this.baseUrl);
    this.absolutizeUrl = (settings.absolutizeUrl || deps.absolutizeUrl).bind(this, this.baseUrl);

    this.history = settings.history || window.history;

    this.indexName = settings.indexName || 'index';
    
    this.items = settings.domItemsManager;

    // loader can be disabled passing 'null', so we must
    // ensure to not use the default on that cases:
    this.loader = typeof(settings.loader) === 'undefined' ? deps.loader : settings.loader;
    // loader setup
    if (this.loader)
        this.loader.baseUrl = this.baseUrl;

    // Definition of events that this object can trigger,
    // its value can be customized but any listener needs
    // to keep updated to the correct event string-name used.
    // The items manipulation events MUST be triggered
    // by the 'items.switch' function
    this.events = {
        willOpen: 'shell-will-open',
        willClose: 'shell-will-close',
        itemReady: 'shell-item-ready',
        closed: 'shell-closed',
        opened: 'shell-opened'
    };
    
    /**
        A function to decide if the
        access is allowed (returns 'null')
        or not (return a state object with information
        that will be passed to the 'nonAccessName' item;
        the 'route' property on the state is automatically filled).
        
        The default buit-in just allow everything 
        by just returning 'null' all the time.
        
        It receives as parameter the state object,
        that almost contains the 'route' property with
        information about the URL.
    **/
    this.accessControl = settings.accessControl || deps.accessControl;
    // What item load on non access
    this.nonAccessName = settings.nonAccessName || 'index';
}

// Shell inherits from EventEmitter
Shell.prototype = Object.create(deps.EventEmitter.prototype, {
    constructor: {
        value: Shell,
        enumerable: false,
        writable: true,
        configurable: true
    }
});

module.exports = Shell;


/** API definition **/

Shell.prototype.go = function go(url, state) {

    if (this.forceHashbang) {
        if (!/^#!/.test(url)) {
            url = '#!' + url;
        }
    }
    else {
        url = this.absolutizeUrl(url);
    }
    this.history.pushState(state, undefined, url);
    // pushState do NOT trigger the popstate event, so
    return this.replace(state);
};

Shell.prototype.goBack = function goBack(state, steps) {
    steps = 0 - (steps || 1);
    // If there is nothing to go-back or not enought
    // 'back' steps, go to the index
    if (steps < 0 && Math.abs(steps) >= this.history.length) {
        this.go(this.indexName);
    }
    else {
        // On replace, the passed state is merged with
        // the one that comes from the saved history
        // entry (it 'pops' when doing the history.go())
        this._pendingStateUpdate = state;
        this.history.go(steps);
    }
};

/**
    Process the given state in order to get the current state
    based on that or the saved in history, merge it with
    any updated state pending and adds the route information,
    returning an state object suitable to use.
**/
Shell.prototype.getUpdatedState = function getUpdatedState(state) {
    /*jshint maxcomplexity: 8 */
    
    // For current uses, any pendingStateUpdate is used as
    // the state, rather than the provided one
    state = this._pendingStateUpdate || state || this.history.state || {};
    
    // TODO: more advanced uses must be to use the 'state' to
    // recover the UI state, with any message from other UI
    // passing in a way that allow update the state, not
    // replace it (from pendingStateUpdate).
    /*
    // State or default state
    state = state || this.history.state || {};
    // merge pending updated state
    this.$.extend(state, this._pendingStateUpdate);
    // discard the update
    */
    this._pendingStateUpdate = null;
    
    // Doesn't matters if state includes already 
    // 'route' information, need to be overwritten
    // to match the current one.
    // NOTE: previously, a check prevented this if
    // route property exists, creating infinite loops
    // on redirections from activity.show since 'route' doesn't
    // match the new desired location
    
    // Detect if is a hashbang URL or an standard one.
    // Except if the app is forced to use hashbang.
    var isHashBang = /#!/.test(location.href) || this.forceHashbang;
    
    var link = (
        isHashBang ?
        location.hash :
        location.pathname
    ) + (location.search || '');
    
    // Set the route
    state.route = this.parseUrl(link);
    
    return state;
};

Shell.prototype.replace = function replace(state) {
    
    state = this.getUpdatedState(state);

    // Use the index on root calls
    if (state.route.root === true) {
        state.route = this.parseUrl(this.indexName);
    }
    
    // Access control
    var accessError = this.accessControl(state.route);
    if (accessError) {
        return this.go(this.nonAccessName, accessError);
    }

    // Locating the container
    var $cont = this.items.find(state.route.name);
    var shell = this;
    var promise = null;

    if ($cont && $cont.length) {
        promise = new Promise(function(resolve, reject) {
            try {

                var $oldCont = shell.items.getActive();
                $oldCont = $oldCont.not($cont);
                shell.items.switch($oldCont, $cont, shell, state);

                resolve(); //? resolve(act);
            }
            catch (ex) {
                reject(ex);
            }
        });
    }
    else {
        if (this.loader) {
            // load and inject the content in the page
            // then try the replace again
            promise = this.loader.load(state.route).then(function(html) {
                // Add to the items (the manager takes care you
                // add only the item, if there is one)
                shell.items.inject(state.route.name, html);
                // Double check that the item was added and is ready
                // to avoid an infinite loop because a request not returning
                // the item and the 'replace' trying to load it again, and again, and..
                if (shell.items.find(state.route.name).length)
                    return shell.replace(state);
            });
        }
        else {
            var err = new Error('Page not found (' + state.route.name + ')');
            console.warn('Shell Page not found, state:', state);
            promise = Promise.reject(err);
        }
    }
    
    var thisShell = this;
    promise.catch(function(err) {
        if (!(err instanceof Error))
            err = new Error(err);

        // Log error, 
        console.error('Shell, unexpected error.', err);
        // notify as an event
        thisShell.emit('error', err);
        // and continue propagating the error
        return err;
    });

    return promise;
};

Shell.prototype.run = function run() {

    var shell = this;

    // Catch popstate event to update shell replacing the active container.
    // Allows polyfills to provide a different but equivalent event name
    this.$(window).on(this.history.popstateEvent || 'popstate', function(event) {
        
        var state = event.state || 
            (event.originalEvent && event.originalEvent.state) || 
            shell.history.state;

        // get state for current. To support polyfills, we use the general getter
        // history.state as fallback (they must be the same on browsers supporting History API)
        shell.replace(state);
    });

    // Catch all links in the page (not only $root ones) and like-links
    this.$(document).on(this.linkEvent, '[href], [data-href]', function(e) {
        
        var $t = shell.$(this),
            href = $t.attr('href') || $t.data('href');

        // Do nothing if the URL contains the protocol
        if (/^[a-z]+:/i.test(href)) {
            return;
        }
        else if (shell.forceHashbang && /^#([^!]|$)/.test(href)) {
            // Standard hash, but not hashbang: avoid routing and default behavior
            e.preventDefault();
            return;
        }

        e.preventDefault();
        //? e.stopImmediatePropagation();

        shell.go(href);
    });

    // Initiallize state
    this.items.init();
    // Route to the current url/state
    this.replace();
};

},{"./dependencies":67}],66:[function(require,module,exports){
/**
    absolutizeUrl utility 
    that ensures the url provided
    being in the path of the given baseUrl
**/
'use strict';

var sanitizeUrl = require('./sanitizeUrl'),
    escapeRegExp = require('../escapeRegExp');

function absolutizeUrl(baseUrl, url) {

    // sanitize before check
    url = sanitizeUrl(url);

    // Check if use the base already
    var matchBase = new RegExp('^' + escapeRegExp(baseUrl), 'i');
    if (matchBase.test(url)) {
        return url;
    }

    // build and sanitize
    return sanitizeUrl(baseUrl + url);
}

module.exports = absolutizeUrl;

},{"../escapeRegExp":60,"./sanitizeUrl":72}],67:[function(require,module,exports){
/**
    External dependencies for Shell in a separate module
    to use as DI, needs setup before call the Shell.js
    module class
**/
'use strict';

module.exports = {
    parseUrl: null,
    absolutizeUrl: null,
    jquery: null,
    loader: null,
    accessControl: function allowAll(name) {
        // allow access by default
        return null;
    },
    EventEmitter: null
};

},{}],68:[function(require,module,exports){
/**
    Simple implementation of the History API using only hashbangs URLs,
    doesn't matters the browser support.
    Used to avoid from setting URLs that has not an end-point,
    like in local environments without a server doing url-rewriting,
    in phonegap apps, or to completely by-pass browser support because
    is buggy (like Android <= 4.1).
    
    NOTES:
    - Browser must support 'hashchange' event.
    - Browser must has support for standard JSON class.
    - Relies on sessionstorage for persistance, supported by all browsers and webviews 
      for a enough long time now.
    - Similar approach as History.js polyfill, but simplified, appending a fake query
      parameter '_suid=0' to the hash value (actual query goes before the hash, but
      we need it inside).
    - For simplification, only the state is persisted, the 'title' parameter is not
      used at all (the same as major browsers do, so is not a problem); in this line,
      only history entries with state are persisted.
**/
//global location
'use strict';
var $ = require('jquery'),
    sanitizeUrl = require('./sanitizeUrl'),
    getUrlQuery = require('../getUrlQuery');

// Init: Load saved copy from sessionStorage
var session = sessionStorage.getItem('hashbangHistory.store');
// Or create a new one
if (!session) {
    session = {
        // States array where each index is the SUID code and the
        // value is just the value passed as state on pushState/replaceState
        states: []
    };
}
else {
    session = JSON.parse(session);
}


/**
    Get the SUID number
    from a hash string
**/
function getSuid(hash) {
    
    var suid = +getUrlQuery(hash)._suid;
    if (isNaN(suid))
        return null;
    else
        return suid;
}

function setSuid(hash, suid) {
    
    // We need the query, since we need 
    // to replace the _suid (may exist)
    // and recreate the query in the
    // returned hash-url
    var qs = getUrlQuery(hash);
    qs.push('_suid');
    qs._suid = suid;

    var query = [];
    for(var i = 0; i < qs.length; i++) {
        query.push(qs[i] + '=' + encodeURIComponent(qs[qs[i]]));
    }
    query = query.join('&');
    
    if (query) {
        var index = hash.indexOf('?');
        if (index > -1)
            hash = hash.substr(0, index);
        hash += '?' + query;
    }

    return hash;
}

/**
    Ask to persist the session data.
    It is done with a timeout in order to avoid
    delay in the current task mainly any handler
    that acts after a History change.
**/
function persist() {
    // Enough time to allow routing tasks,
    // most animations from finish and the UI
    // being responsive.
    // Because sessionStorage is synchronous.
    setTimeout(function() {
        sessionStorage.setItem('hashbangHistory.store', JSON.stringify(session));
    }, 1500);
}

/**
    Returns the given state or null
    if is an empty object.
**/
function checkState(state) {
    
    if (state) {
        // is empty?
        for(var i in state) {
            // No
            return state;
        }
        // its empty
        return null;
    }
    // Anything else
    return state;
}

/**
    Get a canonical representation
    of the URL so can be compared
    with success.
**/
function cannonicalUrl(url) {
    
    // Avoid some bad or problematic syntax
    url = sanitizeUrl(url || '');
    
    // Get the hash part
    var ihash = url.indexOf('#');
    if (ihash > -1) {
        url = url.substr(ihash + 1);
    }
    // Maybe a hashbang URL, remove the
    // 'bang' (the hash was removed already)
    url = url.replace(/^!/, '');

    return url;
}

/**
    Tracks the latest URL
    being pushed or replaced by
    the API.
    This allows later to avoid
    trigger the popstate event,
    since must NOT be triggered
    as a result of that API methods
**/
var latestPushedReplacedUrl = null;

/**
    History Polyfill
**/
var hashbangHistory = {
    pushState: function pushState(state, title, url) {

        // cleanup url
        url = cannonicalUrl(url);
        
        // save new state for url
        state = checkState(state) || null;
        if (state !== null) {
            // save state
            session.states.push(state);
            var suid = session.states.length - 1;
            // update URL with the suid
            url = setSuid(url, suid);
            // call to persist the updated session
            persist();
        }
        
        latestPushedReplacedUrl = url;
        
        // update location to track history:
        location.hash = '#!' + url;
    },
    replaceState: function replaceState(state, title, url) {
        
        // cleanup url
        url = cannonicalUrl(url);
        
        // it has saved state?
        var suid = getSuid(url),
            hasOldState = suid !== null;

        // save new state for url
        state = checkState(state) || null;
        // its saved if there is something to save
        // or something to destroy
        if (state !== null || hasOldState) {
            // save state
            if (hasOldState) {
                // replace existing state
                session.states[suid] = state;
                // the url remains the same
            }
            else {
                // create state
                session.states.push(state);
                suid = session.states.length - 1;
                // update URL with the suid
                url = setSuid(url, suid);
            }
            // call to persist the updated session
            persist();
        }
        
        latestPushedReplacedUrl = url;

        // update location to track history:
        location.hash = '#!' + url;
    },
    get state() {
    
        // Get latest saved state, thats the current one
        var last = session.states.length;
        if (last === 0)
            return null;
        else
            return session.states[last - 1];
    },
    get length() {
        return window.history.length;
    },
    go: function go(offset) {
        window.history.go(offset);
    },
    back: function back() {
        window.history.back();
    },
    forward: function forward() {
        window.history.forward();
    }
};

// Attach hashcange event to trigger History API event 'popstate'
var $w = $(window);
$w.on('hashchange', function(e) {
    
    var url = e.originalEvent.newURL;
    url = cannonicalUrl(url);
    
    // An URL being pushed or replaced
    // must NOT trigger popstate
    if (url === latestPushedReplacedUrl)
        return;
    
    // get state from history entry
    // for the updated URL, if any
    // (can have value when traversing
    // history).
    var suid = getSuid(url),
        state = null;
    
    if (suid !== null)
        state = session.states[suid];

    $w.trigger(new $.Event('popstate', {
        state: state
    }), 'hashbangHistory');
});

// For HistoryAPI capable browsers, we need
// to capture the native 'popstate' event that
// gets triggered on our push/replaceState because
// of the location change, but too on traversing
// the history (back/forward).
// We will lock the event except when is
// the one we trigger.
//
// NOTE: to this trick to work, this must
// be the first handler attached for this
// event, so can block all others.
// ALTERNATIVE: instead of this, on the
// push/replaceState methods detect if
// HistoryAPI is native supported and
// use replaceState there rather than
// a hash change.
$w.on('popstate', function(e, source) {
    
    // Ensuring is the one we trigger
    if (source === 'hashbangHistory')
        return;
    
    // In other case, block:
    e.preventDefault();
    e.stopImmediatePropagation();
});

// Expose API
module.exports = hashbangHistory;

},{"../getUrlQuery":62,"./sanitizeUrl":72}],69:[function(require,module,exports){
/**
    Default build of the Shell component.
    It returns the Shell class as a module property,
    setting up the built-in modules as its dependencies,
    and the external 'jquery' and 'events' (for the EventEmitter).
    It returns too the built-it DomItemsManager class as a property for convenience.
**/
'use strict';

var deps = require('./dependencies'),
    DomItemsManager = require('./DomItemsManager'),
    parseUrl = require('./parseUrl'),
    absolutizeUrl = require('./absolutizeUrl'),
    $ = require('jquery'),
    loader = require('./loader'),
    EventEmitter = require('events').EventEmitter;

$.extend(deps, {
    parseUrl: parseUrl,
    absolutizeUrl: absolutizeUrl,
    jquery: $,
    loader: loader,
    EventEmitter: EventEmitter
});

// Dependencies are ready, we can load the class:
var Shell = require('./Shell');

exports.Shell = Shell;
exports.DomItemsManager = DomItemsManager;

},{"./DomItemsManager":64,"./Shell":65,"./absolutizeUrl":66,"./dependencies":67,"./loader":70,"./parseUrl":71,"events":false}],70:[function(require,module,exports){
/**
    Loader utility to load Shell items on demand with AJAX
**/
'use strict';

var $ = require('jquery');

module.exports = {
    
    baseUrl: '/',
    
    load: function load(route) {
        return new Promise(function(resolve, reject) {
            console.log('LOADER PROMISE', route, route.name);
            resolve('');
            /*$.ajax({
                url: module.exports.baseUrl + route.name + '.html',
                cache: false
                // We are loading the program and no loader screen in place,
                // so any in between interaction will be problematic.
                //async: false
            }).then(resolve, reject);*/
        });
    }
};

},{}],71:[function(require,module,exports){
/**
    parseUrl function detecting
    the main parts of the URL in a
    convenience way for routing.
**/
'use strict';

var getUrlQuery = require('../getUrlQuery'),
    escapeRegExp = require('../escapeRegExp');

function parseUrl(baseUrl, link) {

    link = link || '';

    var rawUrl = link;

    // hashbang support: remove the #! or single # and use the rest as the link
    link = link.replace(/^#!/, '').replace(/^#/, '');
    
    // remove optional initial slash or dot-slash
    link = link.replace(/^\/|^\.\//, '');

    // URL Query as an object, empty object if no query
    var query = getUrlQuery(link || '?');

    // remove query from the rest of URL to parse
    link = link.replace(/\?.*$/, '');

    // Remove the baseUrl to get the app base.
    var path = link.replace(new RegExp('^' + escapeRegExp(baseUrl), 'i'), '');

    // Get first segment or page name (anything until a slash or extension beggining)
    var match = /^\/?([^\/\.]+)[^\/]*(\/.*)*$/.exec(path);

    var parsed = {
        root: true,
        name: null,
        segments: null,
        path: null,
        url: rawUrl,
        query: query
    };

    if (match) {
        parsed.root = false;
        if (match[1]) {
            parsed.name = match[1];

            if (match[2]) {
                parsed.path = match[2];
                parsed.segments = match[2].replace(/^\//, '').split('/');
            }
            else {
                parsed.path = '/';
                parsed.segments = [];
            }
        }
    }

    return parsed;
}

module.exports = parseUrl;
},{"../escapeRegExp":60,"../getUrlQuery":62}],72:[function(require,module,exports){
/**
    sanitizeUrl utility that ensures
    that problematic parts get removed.
    
    As for now it does:
    - removes parent directory syntax
    - removes duplicated slashes
**/
'use strict';

function sanitizeUrl(url) {
    return url.replace(/\.{2,}/g, '').replace(/\/{2,}/g, '/');
}

module.exports = sanitizeUrl;
},{}],73:[function(require,module,exports){
/** AppModel extension,
    focused on the Events API
**/
'use strict';
var CalendarEvent = require('../models/CalendarEvent'),
    apiHelper = require('../utils/apiHelper');

exports.extends = function (AppModel) {
    
    apiHelper.defineCrudApiForRest({
        extendedObject: AppModel.prototype,
        Model: CalendarEvent,
        modelName: 'CalendarEvent',
        modelListName: 'CalendarEvents',
        modelUrl: 'events',
        idPropertyName: 'calendarEventID'
    });
    
    /** # API
        AppModel.prototype.getEvents::
        @param {object} filters: {
            start: Date,
            end: Date,
            types: [3, 5] // [optional] List EventTypesIDs
        }
        ---
        AppModel.prototype.getEvent
        ---
        AppModel.prototype.putEvent
        ---
        AppModel.prototype.postEvent
        ---
        AppModel.prototype.delEvent
        ---
        AppModel.prototype.setEvent
    **/
};
},{"../models/CalendarEvent":32,"../utils/apiHelper":58}],74:[function(require,module,exports){
/** AppModel, centralizes all the data for the app,
    caching and sharing data across activities and performing
    requests
**/
var ko = require('knockout'),
    Model = require('../models/Model'),
    User = require('../models/User'),
    Rest = require('../utils/Rest'),
    localforage = require('localforage');

function AppModel(values) {

    Model(this);
    
    this.model.defProperties({
        user: User.newAnonymous()
    }, values);
}

/** Initialize and wait for anything up **/
AppModel.prototype.init = function init() {
    
    // NOTE: URL to be updated
    this.rest = new Rest('http://dev.loconomics.com/en-US/rest/');
    //this.rest = new Rest('http://localhost/source/en-US/rest/');
    
    // Setup Rest authentication
    this.rest.onAuthorizationRequired = function(retry) {
        
        this.tryLogin()
        .then(function() {
            // Logged! Just retry
            retry();
        });
    }.bind(this);
    
    // Local data
    // TODO Investigate why automatic selection an IndexedDB are
    // failing and we need to use the worse-performance localstorage back-end
    localforage.config({
        name: 'LoconomicsApp',
        version: 0.1,
        size : 4980736, // Size of database, in bytes. WebSQL-only for now.
        storeName : 'keyvaluepairs',
        description : 'Loconomics App',
        driver: localforage.LOCALSTORAGE
    });

    // Initialize: check the user has login data and needed
    // cached data
    return new Promise(function(resolve, reject) {

        // Callback to just resolve without error (passing in the error
        // to the 'resolve' will make the process to fail),
        // since we don't need to create an error for the
        // app init, if there is not enough saved information
        // the app has code to request a login.
        var resolveAnyway = function(doesnMatter){        
            console.warning('App Model Init err', doesnMatter);
            resolve();
        };
        
        // If there are credentials saved
        localforage.getItem('credentials').then(function(credentials) {

            if (credentials &&
                credentials.userID &&
                credentials.username &&
                credentials.authKey) {

                // use authorization key for each
                // new Rest request
                this.rest.extraHeaders = {
                    alu: credentials.userID,
                    alk: credentials.authKey
                };
                
                // It has credentials! Has basic profile data?
                localforage.getItem('profile').then(function(profile) {
                    if (profile) {
                        // Set user data
                        this.user().model.updateWith(profile);
                        // End succesfully
                        resolve();
                    }
                    else {
                        // No profile, we need to request it to be able
                        // to work correctly, so we
                        // attempt a login (the tryLogin process performs
                        // a login with the saved credentials and fetch
                        // the profile to save it in the local copy)
                        this.tryLogin().then(resolve, resolveAnyway);
                    }
                }.bind(this), resolveAnyway);
            }
            else {
                // End successfully. Not loggin is not an error,
                // is just the first app start-up
                resolve();
            }
        }.bind(this), resolveAnyway);
    }.bind(this));
};

/**
    Account methods
**/
AppModel.prototype.tryLogin = function tryLogin() {
    // Get saved credentials
    return localforage.getItem('credentials')
    .then(function(credentials) {
        // If we have ones, try to log-in
        if (credentials) {
            // Attempt login with that
            return this.login(
                credentials.username,
                credentials.password
            );
        } else {
            throw new Error('No saved credentials');
        }
    }.bind(this));
};

AppModel.prototype.login = function login(username, password) {

    // Reset the extra headers to attempt the login
    this.rest.extraHeaders = null;

    return this.rest.post('login', {
        username: username,
        password: password,
        returnProfile: true
    }).then(function(logged) {

        // use authorization key for each
        // new Rest request
        this.rest.extraHeaders = {
            alu: logged.userId,
            alk: logged.authKey
        };

        // async local save, don't wait
        localforage.setItem('credentials', {
            userID: logged.userId,
            username: username,
            password: password,
            authKey: logged.authKey
        });
        localforage.setItem('profile', logged.profile);

        // Set user data
        this.user().model.updateWith(logged.profile);

        return logged;
    }.bind(this));
};

AppModel.prototype.logout = function logout() {

    // Local app close session
    this.rest.extraHeaders = null;
    localforage.removeItem('credentials');
    localforage.removeItem('profile');
    
    // Don't need to wait the result of the REST operation
    this.rest.post('logout');
    
    return Promise.resolve();
};

AppModel.prototype.getUpcomingBookings = function getUpcomingBookings() {
    return this.rest.get('upcoming-bookings');
};

AppModel.prototype.getBooking = function getBooking(id) {
    return this.rest.get('get-booking', { bookingID: id });
};

module.exports = AppModel;

// Class splited in different files to mitigate size and organization
// but keeping access to the common set of methods and objects easy with
// the same class.
// Loading extensions/partials:
require('./AppModel-events').extends(AppModel);

},{"../models/Model":40,"../models/User":45,"../utils/Rest":55,"./AppModel-events":73,"knockout":false,"localforage":false}],75:[function(require,module,exports){
/** NavAction view model.
    It allows set-up per activity for the AppNav action button.
**/
var ko = require('knockout'),
    Model = require('../models/Model');

function NavAction(values) {
    
    Model(this);
    
    this.model.defProperties({
        link: '',
        icon: '',
        text: '',
        // 'Test' is the header title but placed in the button/action
        isTitle: false,
        // 'Link' is the element ID of a modal (starts with a #)
        isModal: false,
        // 'Link' is a Shell command, like 'goBack 2'
        isShell: false,
        // Set if the element is a menu button, in that case 'link'
        // will be the ID of the menu (contained in the page; without the hash), using
        // the text and icon but special meaning for the text value 'menu'
        // on icon property that will use the standard menu icon.
        isMenu: false
    }, values);
}

module.exports = NavAction;

// Set of view utilities to get the link for the expected html attributes

NavAction.prototype.getHref = function getHref() {
    return (
        (this.isMenu() || this.isModal() || this.isShell()) ?
        '#' :
        this.link()
    );
};

NavAction.prototype.getModalTarget = function getModalTarget() {
    return (
        (this.isMenu() || !this.isModal() || this.isShell()) ?
        '' :
        this.link()
    );
};

NavAction.prototype.getShellCommand = function getShellCommand() {
    return (
        (this.isMenu() || !this.isShell()) ?
        '' :
        this.link()
    );
};

NavAction.prototype.getMenuID = function getMenuID() {
    return (
        (!this.isMenu()) ?
        '' :
        this.link()
    );
};

NavAction.prototype.getMenuLink = function getMenuLink() {
    return (
        (!this.isMenu()) ?
        '' :
        '#' + this.link()
    );
};

/** Static, shared actions **/
NavAction.goHome = new NavAction({
    link: '/',
    icon: 'glyphicon glyphicon-home'
});

NavAction.goBack = new NavAction({
    link: 'goBack',
    icon: 'glyphicon glyphicon-arrow-left',
    isShell: true
});

// TODO TO REMOVE, Example of modal
NavAction.newItem = new NavAction({
    link: '#newItem',
    icon: 'glyphicon glyphicon-plus',
    isModal: true
});

NavAction.menuIn = new NavAction({
    link: 'menuIn',
    icon: 'menu',
    isMenu: true
});

NavAction.menuOut = new NavAction({
    link: 'menuOut',
    icon: 'menu',
    isMenu: true
});

NavAction.menuNewItem = new NavAction({
    link: 'menuNewItem',
    icon: 'glyphicon glyphicon-plus',
    isMenu: true
});

NavAction.goHelpIndex = new NavAction({
    link: '#helpIndex',
    text: 'help',
    isModal: true
});

NavAction.goLogin = new NavAction({
    link: '/login',
    text: 'log-in'
});

NavAction.goLogout = new NavAction({
    link: '/logout',
    text: 'log-out'
});

NavAction.goSignup = new NavAction({
    link: '/signup',
    text: 'sign-up'
});

},{"../models/Model":40,"knockout":false}],76:[function(require,module,exports){
/** NavBar view model.
    It allows customize the NavBar per activity.
**/
var ko = require('knockout'),
    Model = require('../models/Model'),
    NavAction = require('./NavAction');

function NavBar(values) {
    
    Model(this);
    
    this.model.defProperties({
        // Title showed in the center
        // When the title is 'null', the app logo is showed in place,
        // on empty text, the empty text is showed and no logo.
        title: '',
        // NavAction instance:
        leftAction: null,
        // NavAction instance:
        rightAction: null
    }, values);
}

module.exports = NavBar;

},{"../models/Model":40,"./NavAction":75,"knockout":false}]},{},[25])
//@ sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIkM6L1VzZXJzL0lhZ28vUHJveGVjdG9zL0xvY29ub21pY3MuY29tL3N0eWxlZ3VpZGUvcHJvdG90eXBlcy9hcHAvbm9kZV9tb2R1bGVzL251bWVyYWwvbnVtZXJhbC5qcyIsIkM6L1VzZXJzL0lhZ28vUHJveGVjdG9zL0xvY29ub21pY3MuY29tL3N0eWxlZ3VpZGUvcHJvdG90eXBlcy9hcHAvc291cmNlL2pzL2FjdGl2aXRpZXMvYWNjb3VudC5qcyIsIkM6L1VzZXJzL0lhZ28vUHJveGVjdG9zL0xvY29ub21pY3MuY29tL3N0eWxlZ3VpZGUvcHJvdG90eXBlcy9hcHAvc291cmNlL2pzL2FjdGl2aXRpZXMvYXBwb2ludG1lbnQuanMiLCJDOi9Vc2Vycy9JYWdvL1Byb3hlY3Rvcy9Mb2Nvbm9taWNzLmNvbS9zdHlsZWd1aWRlL3Byb3RvdHlwZXMvYXBwL3NvdXJjZS9qcy9hY3Rpdml0aWVzL2Jvb2tpbmdDb25maXJtYXRpb24uanMiLCJDOi9Vc2Vycy9JYWdvL1Byb3hlY3Rvcy9Mb2Nvbm9taWNzLmNvbS9zdHlsZWd1aWRlL3Byb3RvdHlwZXMvYXBwL3NvdXJjZS9qcy9hY3Rpdml0aWVzL2NhbGVuZGFyLmpzIiwiQzovVXNlcnMvSWFnby9Qcm94ZWN0b3MvTG9jb25vbWljcy5jb20vc3R5bGVndWlkZS9wcm90b3R5cGVzL2FwcC9zb3VyY2UvanMvYWN0aXZpdGllcy9jbGllbnRzLmpzIiwiQzovVXNlcnMvSWFnby9Qcm94ZWN0b3MvTG9jb25vbWljcy5jb20vc3R5bGVndWlkZS9wcm90b3R5cGVzL2FwcC9zb3VyY2UvanMvYWN0aXZpdGllcy9jb250YWN0SW5mby5qcyIsIkM6L1VzZXJzL0lhZ28vUHJveGVjdG9zL0xvY29ub21pY3MuY29tL3N0eWxlZ3VpZGUvcHJvdG90eXBlcy9hcHAvc291cmNlL2pzL2FjdGl2aXRpZXMvZGF0ZXRpbWVQaWNrZXIuanMiLCJDOi9Vc2Vycy9JYWdvL1Byb3hlY3Rvcy9Mb2Nvbm9taWNzLmNvbS9zdHlsZWd1aWRlL3Byb3RvdHlwZXMvYXBwL3NvdXJjZS9qcy9hY3Rpdml0aWVzL2hvbWUuanMiLCJDOi9Vc2Vycy9JYWdvL1Byb3hlY3Rvcy9Mb2Nvbm9taWNzLmNvbS9zdHlsZWd1aWRlL3Byb3RvdHlwZXMvYXBwL3NvdXJjZS9qcy9hY3Rpdml0aWVzL2luZGV4LmpzIiwiQzovVXNlcnMvSWFnby9Qcm94ZWN0b3MvTG9jb25vbWljcy5jb20vc3R5bGVndWlkZS9wcm90b3R5cGVzL2FwcC9zb3VyY2UvanMvYWN0aXZpdGllcy9sZWFybk1vcmUuanMiLCJDOi9Vc2Vycy9JYWdvL1Byb3hlY3Rvcy9Mb2Nvbm9taWNzLmNvbS9zdHlsZWd1aWRlL3Byb3RvdHlwZXMvYXBwL3NvdXJjZS9qcy9hY3Rpdml0aWVzL2xvY2F0aW9uRWRpdGlvbi5qcyIsIkM6L1VzZXJzL0lhZ28vUHJveGVjdG9zL0xvY29ub21pY3MuY29tL3N0eWxlZ3VpZGUvcHJvdG90eXBlcy9hcHAvc291cmNlL2pzL2FjdGl2aXRpZXMvbG9jYXRpb25zLmpzIiwiQzovVXNlcnMvSWFnby9Qcm94ZWN0b3MvTG9jb25vbWljcy5jb20vc3R5bGVndWlkZS9wcm90b3R5cGVzL2FwcC9zb3VyY2UvanMvYWN0aXZpdGllcy9sb2dpbi5qcyIsIkM6L1VzZXJzL0lhZ28vUHJveGVjdG9zL0xvY29ub21pY3MuY29tL3N0eWxlZ3VpZGUvcHJvdG90eXBlcy9hcHAvc291cmNlL2pzL2FjdGl2aXRpZXMvbG9nb3V0LmpzIiwiQzovVXNlcnMvSWFnby9Qcm94ZWN0b3MvTG9jb25vbWljcy5jb20vc3R5bGVndWlkZS9wcm90b3R5cGVzL2FwcC9zb3VyY2UvanMvYWN0aXZpdGllcy9vbmJvYXJkaW5nQ29tcGxldGUuanMiLCJDOi9Vc2Vycy9JYWdvL1Byb3hlY3Rvcy9Mb2Nvbm9taWNzLmNvbS9zdHlsZWd1aWRlL3Byb3RvdHlwZXMvYXBwL3NvdXJjZS9qcy9hY3Rpdml0aWVzL29uYm9hcmRpbmdIb21lLmpzIiwiQzovVXNlcnMvSWFnby9Qcm94ZWN0b3MvTG9jb25vbWljcy5jb20vc3R5bGVndWlkZS9wcm90b3R5cGVzL2FwcC9zb3VyY2UvanMvYWN0aXZpdGllcy9vbmJvYXJkaW5nUG9zaXRpb25zLmpzIiwiQzovVXNlcnMvSWFnby9Qcm94ZWN0b3MvTG9jb25vbWljcy5jb20vc3R5bGVndWlkZS9wcm90b3R5cGVzL2FwcC9zb3VyY2UvanMvYWN0aXZpdGllcy9zZXJ2aWNlcy5qcyIsIkM6L1VzZXJzL0lhZ28vUHJveGVjdG9zL0xvY29ub21pY3MuY29tL3N0eWxlZ3VpZGUvcHJvdG90eXBlcy9hcHAvc291cmNlL2pzL2FjdGl2aXRpZXMvc2lnbnVwLmpzIiwiQzovVXNlcnMvSWFnby9Qcm94ZWN0b3MvTG9jb25vbWljcy5jb20vc3R5bGVndWlkZS9wcm90b3R5cGVzL2FwcC9zb3VyY2UvanMvYWN0aXZpdGllcy90ZXh0RWRpdG9yLmpzIiwiQzovVXNlcnMvSWFnby9Qcm94ZWN0b3MvTG9jb25vbWljcy5jb20vc3R5bGVndWlkZS9wcm90b3R5cGVzL2FwcC9zb3VyY2UvanMvYXBwLWNvbXBvbmVudHMuanMiLCJDOi9Vc2Vycy9JYWdvL1Byb3hlY3Rvcy9Mb2Nvbm9taWNzLmNvbS9zdHlsZWd1aWRlL3Byb3RvdHlwZXMvYXBwL3NvdXJjZS9qcy9hcHAtbmF2YmFyLmpzIiwiQzovVXNlcnMvSWFnby9Qcm94ZWN0b3MvTG9jb25vbWljcy5jb20vc3R5bGVndWlkZS9wcm90b3R5cGVzL2FwcC9zb3VyY2UvanMvYXBwLmFjdGl2aXRpZXMuanMiLCJDOi9Vc2Vycy9JYWdvL1Byb3hlY3Rvcy9Mb2Nvbm9taWNzLmNvbS9zdHlsZWd1aWRlL3Byb3RvdHlwZXMvYXBwL3NvdXJjZS9qcy9hcHAuanMiLCJDOi9Vc2Vycy9JYWdvL1Byb3hlY3Rvcy9Mb2Nvbm9taWNzLmNvbS9zdHlsZWd1aWRlL3Byb3RvdHlwZXMvYXBwL3NvdXJjZS9qcy9hcHAuc2hlbGwuanMiLCJDOi9Vc2Vycy9JYWdvL1Byb3hlY3Rvcy9Mb2Nvbm9taWNzLmNvbS9zdHlsZWd1aWRlL3Byb3RvdHlwZXMvYXBwL3NvdXJjZS9qcy9jb21wb25lbnRzL0RhdGVQaWNrZXIuanMiLCJDOi9Vc2Vycy9JYWdvL1Byb3hlY3Rvcy9Mb2Nvbm9taWNzLmNvbS9zdHlsZWd1aWRlL3Byb3RvdHlwZXMvYXBwL3NvdXJjZS9qcy9jb21wb25lbnRzL1NtYXJ0TmF2QmFyLmpzIiwiQzovVXNlcnMvSWFnby9Qcm94ZWN0b3MvTG9jb25vbWljcy5jb20vc3R5bGVndWlkZS9wcm90b3R5cGVzL2FwcC9zb3VyY2UvanMvbG9jYWxlcy9lbi1VUy1MQy5qcyIsIkM6L1VzZXJzL0lhZ28vUHJveGVjdG9zL0xvY29ub21pY3MuY29tL3N0eWxlZ3VpZGUvcHJvdG90eXBlcy9hcHAvc291cmNlL2pzL21vZGVscy9BcHBvaW50bWVudC5qcyIsIkM6L1VzZXJzL0lhZ28vUHJveGVjdG9zL0xvY29ub21pY3MuY29tL3N0eWxlZ3VpZGUvcHJvdG90eXBlcy9hcHAvc291cmNlL2pzL21vZGVscy9Cb29raW5nU3VtbWFyeS5qcyIsIkM6L1VzZXJzL0lhZ28vUHJveGVjdG9zL0xvY29ub21pY3MuY29tL3N0eWxlZ3VpZGUvcHJvdG90eXBlcy9hcHAvc291cmNlL2pzL21vZGVscy9DYWxlbmRhckV2ZW50LmpzIiwiQzovVXNlcnMvSWFnby9Qcm94ZWN0b3MvTG9jb25vbWljcy5jb20vc3R5bGVndWlkZS9wcm90b3R5cGVzL2FwcC9zb3VyY2UvanMvbW9kZWxzL0NhbGVuZGFyU2xvdC5qcyIsIkM6L1VzZXJzL0lhZ28vUHJveGVjdG9zL0xvY29ub21pY3MuY29tL3N0eWxlZ3VpZGUvcHJvdG90eXBlcy9hcHAvc291cmNlL2pzL21vZGVscy9DbGllbnQuanMiLCJDOi9Vc2Vycy9JYWdvL1Byb3hlY3Rvcy9Mb2Nvbm9taWNzLmNvbS9zdHlsZWd1aWRlL3Byb3RvdHlwZXMvYXBwL3NvdXJjZS9qcy9tb2RlbHMvR2V0TW9yZS5qcyIsIkM6L1VzZXJzL0lhZ28vUHJveGVjdG9zL0xvY29ub21pY3MuY29tL3N0eWxlZ3VpZGUvcHJvdG90eXBlcy9hcHAvc291cmNlL2pzL21vZGVscy9MaXN0Vmlld0l0ZW0uanMiLCJDOi9Vc2Vycy9JYWdvL1Byb3hlY3Rvcy9Mb2Nvbm9taWNzLmNvbS9zdHlsZWd1aWRlL3Byb3RvdHlwZXMvYXBwL3NvdXJjZS9qcy9tb2RlbHMvTG9jYXRpb24uanMiLCJDOi9Vc2Vycy9JYWdvL1Byb3hlY3Rvcy9Mb2Nvbm9taWNzLmNvbS9zdHlsZWd1aWRlL3Byb3RvdHlwZXMvYXBwL3NvdXJjZS9qcy9tb2RlbHMvTWFpbEZvbGRlci5qcyIsIkM6L1VzZXJzL0lhZ28vUHJveGVjdG9zL0xvY29ub21pY3MuY29tL3N0eWxlZ3VpZGUvcHJvdG90eXBlcy9hcHAvc291cmNlL2pzL21vZGVscy9NZXNzYWdlLmpzIiwiQzovVXNlcnMvSWFnby9Qcm94ZWN0b3MvTG9jb25vbWljcy5jb20vc3R5bGVndWlkZS9wcm90b3R5cGVzL2FwcC9zb3VyY2UvanMvbW9kZWxzL01vZGVsLmpzIiwiQzovVXNlcnMvSWFnby9Qcm94ZWN0b3MvTG9jb25vbWljcy5jb20vc3R5bGVndWlkZS9wcm90b3R5cGVzL2FwcC9zb3VyY2UvanMvbW9kZWxzL1BlcmZvcm1hbmNlU3VtbWFyeS5qcyIsIkM6L1VzZXJzL0lhZ28vUHJveGVjdG9zL0xvY29ub21pY3MuY29tL3N0eWxlZ3VpZGUvcHJvdG90eXBlcy9hcHAvc291cmNlL2pzL21vZGVscy9Qb3NpdGlvbi5qcyIsIkM6L1VzZXJzL0lhZ28vUHJveGVjdG9zL0xvY29ub21pY3MuY29tL3N0eWxlZ3VpZGUvcHJvdG90eXBlcy9hcHAvc291cmNlL2pzL21vZGVscy9TZXJ2aWNlLmpzIiwiQzovVXNlcnMvSWFnby9Qcm94ZWN0b3MvTG9jb25vbWljcy5jb20vc3R5bGVndWlkZS9wcm90b3R5cGVzL2FwcC9zb3VyY2UvanMvbW9kZWxzL1VwY29taW5nQm9va2luZ3NTdW1tYXJ5LmpzIiwiQzovVXNlcnMvSWFnby9Qcm94ZWN0b3MvTG9jb25vbWljcy5jb20vc3R5bGVndWlkZS9wcm90b3R5cGVzL2FwcC9zb3VyY2UvanMvbW9kZWxzL1VzZXIuanMiLCJDOi9Vc2Vycy9JYWdvL1Byb3hlY3Rvcy9Mb2Nvbm9taWNzLmNvbS9zdHlsZWd1aWRlL3Byb3RvdHlwZXMvYXBwL3NvdXJjZS9qcy90ZXN0ZGF0YS9jYWxlbmRhckFwcG9pbnRtZW50cy5qcyIsIkM6L1VzZXJzL0lhZ28vUHJveGVjdG9zL0xvY29ub21pY3MuY29tL3N0eWxlZ3VpZGUvcHJvdG90eXBlcy9hcHAvc291cmNlL2pzL3Rlc3RkYXRhL2NhbGVuZGFyU2xvdHMuanMiLCJDOi9Vc2Vycy9JYWdvL1Byb3hlY3Rvcy9Mb2Nvbm9taWNzLmNvbS9zdHlsZWd1aWRlL3Byb3RvdHlwZXMvYXBwL3NvdXJjZS9qcy90ZXN0ZGF0YS9jbGllbnRzLmpzIiwiQzovVXNlcnMvSWFnby9Qcm94ZWN0b3MvTG9jb25vbWljcy5jb20vc3R5bGVndWlkZS9wcm90b3R5cGVzL2FwcC9zb3VyY2UvanMvdGVzdGRhdGEvbG9jYXRpb25zLmpzIiwiQzovVXNlcnMvSWFnby9Qcm94ZWN0b3MvTG9jb25vbWljcy5jb20vc3R5bGVndWlkZS9wcm90b3R5cGVzL2FwcC9zb3VyY2UvanMvdGVzdGRhdGEvbWVzc2FnZXMuanMiLCJDOi9Vc2Vycy9JYWdvL1Byb3hlY3Rvcy9Mb2Nvbm9taWNzLmNvbS9zdHlsZWd1aWRlL3Byb3RvdHlwZXMvYXBwL3NvdXJjZS9qcy90ZXN0ZGF0YS9zZXJ2aWNlcy5qcyIsIkM6L1VzZXJzL0lhZ28vUHJveGVjdG9zL0xvY29ub21pY3MuY29tL3N0eWxlZ3VpZGUvcHJvdG90eXBlcy9hcHAvc291cmNlL2pzL3Rlc3RkYXRhL3RpbWVTbG90cy5qcyIsIkM6L1VzZXJzL0lhZ28vUHJveGVjdG9zL0xvY29ub21pY3MuY29tL3N0eWxlZ3VpZGUvcHJvdG90eXBlcy9hcHAvc291cmNlL2pzL3V0aWxzL0Z1bmN0aW9uLnByb3RvdHlwZS5fZGVsYXllZC5qcyIsIkM6L1VzZXJzL0lhZ28vUHJveGVjdG9zL0xvY29ub21pY3MuY29tL3N0eWxlZ3VpZGUvcHJvdG90eXBlcy9hcHAvc291cmNlL2pzL3V0aWxzL0Z1bmN0aW9uLnByb3RvdHlwZS5faW5oZXJpdHMuanMiLCJDOi9Vc2Vycy9JYWdvL1Byb3hlY3Rvcy9Mb2Nvbm9taWNzLmNvbS9zdHlsZWd1aWRlL3Byb3RvdHlwZXMvYXBwL3NvdXJjZS9qcy91dGlscy9SZXN0LmpzIiwiQzovVXNlcnMvSWFnby9Qcm94ZWN0b3MvTG9jb25vbWljcy5jb20vc3R5bGVndWlkZS9wcm90b3R5cGVzL2FwcC9zb3VyY2UvanMvdXRpbHMvVGltZS5qcyIsIkM6L1VzZXJzL0lhZ28vUHJveGVjdG9zL0xvY29ub21pY3MuY29tL3N0eWxlZ3VpZGUvcHJvdG90eXBlcy9hcHAvc291cmNlL2pzL3V0aWxzL2FjY2Vzc0NvbnRyb2wuanMiLCJDOi9Vc2Vycy9JYWdvL1Byb3hlY3Rvcy9Mb2Nvbm9taWNzLmNvbS9zdHlsZWd1aWRlL3Byb3RvdHlwZXMvYXBwL3NvdXJjZS9qcy91dGlscy9hcGlIZWxwZXIuanMiLCJDOi9Vc2Vycy9JYWdvL1Byb3hlY3Rvcy9Mb2Nvbm9taWNzLmNvbS9zdHlsZWd1aWRlL3Byb3RvdHlwZXMvYXBwL3NvdXJjZS9qcy91dGlscy9ib290a25vY2tCaW5kaW5nSGVscGVycy5qcyIsIkM6L1VzZXJzL0lhZ28vUHJveGVjdG9zL0xvY29ub21pY3MuY29tL3N0eWxlZ3VpZGUvcHJvdG90eXBlcy9hcHAvc291cmNlL2pzL3V0aWxzL2VzY2FwZVJlZ0V4cC5qcyIsIkM6L1VzZXJzL0lhZ28vUHJveGVjdG9zL0xvY29ub21pY3MuY29tL3N0eWxlZ3VpZGUvcHJvdG90eXBlcy9hcHAvc291cmNlL2pzL3V0aWxzL2VzY2FwZVNlbGVjdG9yLmpzIiwiQzovVXNlcnMvSWFnby9Qcm94ZWN0b3MvTG9jb25vbWljcy5jb20vc3R5bGVndWlkZS9wcm90b3R5cGVzL2FwcC9zb3VyY2UvanMvdXRpbHMvZ2V0VXJsUXVlcnkuanMiLCJDOi9Vc2Vycy9JYWdvL1Byb3hlY3Rvcy9Mb2Nvbm9taWNzLmNvbS9zdHlsZWd1aWRlL3Byb3RvdHlwZXMvYXBwL3NvdXJjZS9qcy91dGlscy9qc1Byb3BlcnRpZXNUb29scy5qcyIsIkM6L1VzZXJzL0lhZ28vUHJveGVjdG9zL0xvY29ub21pY3MuY29tL3N0eWxlZ3VpZGUvcHJvdG90eXBlcy9hcHAvc291cmNlL2pzL3V0aWxzL3NoZWxsL0RvbUl0ZW1zTWFuYWdlci5qcyIsIkM6L1VzZXJzL0lhZ28vUHJveGVjdG9zL0xvY29ub21pY3MuY29tL3N0eWxlZ3VpZGUvcHJvdG90eXBlcy9hcHAvc291cmNlL2pzL3V0aWxzL3NoZWxsL1NoZWxsLmpzIiwiQzovVXNlcnMvSWFnby9Qcm94ZWN0b3MvTG9jb25vbWljcy5jb20vc3R5bGVndWlkZS9wcm90b3R5cGVzL2FwcC9zb3VyY2UvanMvdXRpbHMvc2hlbGwvYWJzb2x1dGl6ZVVybC5qcyIsIkM6L1VzZXJzL0lhZ28vUHJveGVjdG9zL0xvY29ub21pY3MuY29tL3N0eWxlZ3VpZGUvcHJvdG90eXBlcy9hcHAvc291cmNlL2pzL3V0aWxzL3NoZWxsL2RlcGVuZGVuY2llcy5qcyIsIkM6L1VzZXJzL0lhZ28vUHJveGVjdG9zL0xvY29ub21pY3MuY29tL3N0eWxlZ3VpZGUvcHJvdG90eXBlcy9hcHAvc291cmNlL2pzL3V0aWxzL3NoZWxsL2hhc2hiYW5nSGlzdG9yeS5qcyIsIkM6L1VzZXJzL0lhZ28vUHJveGVjdG9zL0xvY29ub21pY3MuY29tL3N0eWxlZ3VpZGUvcHJvdG90eXBlcy9hcHAvc291cmNlL2pzL3V0aWxzL3NoZWxsL2luZGV4LmpzIiwiQzovVXNlcnMvSWFnby9Qcm94ZWN0b3MvTG9jb25vbWljcy5jb20vc3R5bGVndWlkZS9wcm90b3R5cGVzL2FwcC9zb3VyY2UvanMvdXRpbHMvc2hlbGwvbG9hZGVyLmpzIiwiQzovVXNlcnMvSWFnby9Qcm94ZWN0b3MvTG9jb25vbWljcy5jb20vc3R5bGVndWlkZS9wcm90b3R5cGVzL2FwcC9zb3VyY2UvanMvdXRpbHMvc2hlbGwvcGFyc2VVcmwuanMiLCJDOi9Vc2Vycy9JYWdvL1Byb3hlY3Rvcy9Mb2Nvbm9taWNzLmNvbS9zdHlsZWd1aWRlL3Byb3RvdHlwZXMvYXBwL3NvdXJjZS9qcy91dGlscy9zaGVsbC9zYW5pdGl6ZVVybC5qcyIsIkM6L1VzZXJzL0lhZ28vUHJveGVjdG9zL0xvY29ub21pY3MuY29tL3N0eWxlZ3VpZGUvcHJvdG90eXBlcy9hcHAvc291cmNlL2pzL3ZpZXdtb2RlbHMvQXBwTW9kZWwtZXZlbnRzLmpzIiwiQzovVXNlcnMvSWFnby9Qcm94ZWN0b3MvTG9jb25vbWljcy5jb20vc3R5bGVndWlkZS9wcm90b3R5cGVzL2FwcC9zb3VyY2UvanMvdmlld21vZGVscy9BcHBNb2RlbC5qcyIsIkM6L1VzZXJzL0lhZ28vUHJveGVjdG9zL0xvY29ub21pY3MuY29tL3N0eWxlZ3VpZGUvcHJvdG90eXBlcy9hcHAvc291cmNlL2pzL3ZpZXdtb2RlbHMvTmF2QWN0aW9uLmpzIiwiQzovVXNlcnMvSWFnby9Qcm94ZWN0b3MvTG9jb25vbWljcy5jb20vc3R5bGVndWlkZS9wcm90b3R5cGVzL2FwcC9zb3VyY2UvanMvdmlld21vZGVscy9OYXZCYXIuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdnFCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2xDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDL1VBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDeENBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMxS0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2pLQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcEVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMzSkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzlHQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3hDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzNDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDN0hBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcklBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzdJQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbkNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMxQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNsQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2pFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzVLQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDN0VBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDMUdBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2hEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2pHQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDN0JBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN6UkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbEVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDeHBCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDN0hBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzdDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3pIQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDMUJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMzR0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2hDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNyQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdERBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2pDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3RFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN4QkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQy9DQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdktBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN4R0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN0QkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN6QkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdkNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzVHQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2hFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzNPQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN2Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDM0JBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNqRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM1QkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdERBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdEJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2ZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM5R0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3BCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM3Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNoRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDckVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdkRBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDekJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN2QkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDMUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDekhBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNyU0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzFCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNsQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNqU0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDOUJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDekJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM5REE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2RBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3BDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMxTEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDaklBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIvKiFcbiAqIG51bWVyYWwuanNcbiAqIHZlcnNpb24gOiAxLjUuM1xuICogYXV0aG9yIDogQWRhbSBEcmFwZXJcbiAqIGxpY2Vuc2UgOiBNSVRcbiAqIGh0dHA6Ly9hZGFtd2RyYXBlci5naXRodWIuY29tL051bWVyYWwtanMvXG4gKi9cblxuKGZ1bmN0aW9uICgpIHtcblxuICAgIC8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICAgICAgQ29uc3RhbnRzXG4gICAgKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG4gICAgdmFyIG51bWVyYWwsXG4gICAgICAgIFZFUlNJT04gPSAnMS41LjMnLFxuICAgICAgICAvLyBpbnRlcm5hbCBzdG9yYWdlIGZvciBsYW5ndWFnZSBjb25maWcgZmlsZXNcbiAgICAgICAgbGFuZ3VhZ2VzID0ge30sXG4gICAgICAgIGN1cnJlbnRMYW5ndWFnZSA9ICdlbicsXG4gICAgICAgIHplcm9Gb3JtYXQgPSBudWxsLFxuICAgICAgICBkZWZhdWx0Rm9ybWF0ID0gJzAsMCcsXG4gICAgICAgIC8vIGNoZWNrIGZvciBub2RlSlNcbiAgICAgICAgaGFzTW9kdWxlID0gKHR5cGVvZiBtb2R1bGUgIT09ICd1bmRlZmluZWQnICYmIG1vZHVsZS5leHBvcnRzKTtcblxuXG4gICAgLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICAgICAgICBDb25zdHJ1Y3RvcnNcbiAgICAqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cblxuICAgIC8vIE51bWVyYWwgcHJvdG90eXBlIG9iamVjdFxuICAgIGZ1bmN0aW9uIE51bWVyYWwgKG51bWJlcikge1xuICAgICAgICB0aGlzLl92YWx1ZSA9IG51bWJlcjtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBJbXBsZW1lbnRhdGlvbiBvZiB0b0ZpeGVkKCkgdGhhdCB0cmVhdHMgZmxvYXRzIG1vcmUgbGlrZSBkZWNpbWFsc1xuICAgICAqXG4gICAgICogRml4ZXMgYmluYXJ5IHJvdW5kaW5nIGlzc3VlcyAoZWcuICgwLjYxNSkudG9GaXhlZCgyKSA9PT0gJzAuNjEnKSB0aGF0IHByZXNlbnRcbiAgICAgKiBwcm9ibGVtcyBmb3IgYWNjb3VudGluZy0gYW5kIGZpbmFuY2UtcmVsYXRlZCBzb2Z0d2FyZS5cbiAgICAgKi9cbiAgICBmdW5jdGlvbiB0b0ZpeGVkICh2YWx1ZSwgcHJlY2lzaW9uLCByb3VuZGluZ0Z1bmN0aW9uLCBvcHRpb25hbHMpIHtcbiAgICAgICAgdmFyIHBvd2VyID0gTWF0aC5wb3coMTAsIHByZWNpc2lvbiksXG4gICAgICAgICAgICBvcHRpb25hbHNSZWdFeHAsXG4gICAgICAgICAgICBvdXRwdXQ7XG4gICAgICAgICAgICBcbiAgICAgICAgLy9yb3VuZGluZ0Z1bmN0aW9uID0gKHJvdW5kaW5nRnVuY3Rpb24gIT09IHVuZGVmaW5lZCA/IHJvdW5kaW5nRnVuY3Rpb24gOiBNYXRoLnJvdW5kKTtcbiAgICAgICAgLy8gTXVsdGlwbHkgdXAgYnkgcHJlY2lzaW9uLCByb3VuZCBhY2N1cmF0ZWx5LCB0aGVuIGRpdmlkZSBhbmQgdXNlIG5hdGl2ZSB0b0ZpeGVkKCk6XG4gICAgICAgIG91dHB1dCA9IChyb3VuZGluZ0Z1bmN0aW9uKHZhbHVlICogcG93ZXIpIC8gcG93ZXIpLnRvRml4ZWQocHJlY2lzaW9uKTtcblxuICAgICAgICBpZiAob3B0aW9uYWxzKSB7XG4gICAgICAgICAgICBvcHRpb25hbHNSZWdFeHAgPSBuZXcgUmVnRXhwKCcwezEsJyArIG9wdGlvbmFscyArICd9JCcpO1xuICAgICAgICAgICAgb3V0cHV0ID0gb3V0cHV0LnJlcGxhY2Uob3B0aW9uYWxzUmVnRXhwLCAnJyk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gb3V0cHV0O1xuICAgIH1cblxuICAgIC8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICAgICAgRm9ybWF0dGluZ1xuICAgICoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cblxuICAgIC8vIGRldGVybWluZSB3aGF0IHR5cGUgb2YgZm9ybWF0dGluZyB3ZSBuZWVkIHRvIGRvXG4gICAgZnVuY3Rpb24gZm9ybWF0TnVtZXJhbCAobiwgZm9ybWF0LCByb3VuZGluZ0Z1bmN0aW9uKSB7XG4gICAgICAgIHZhciBvdXRwdXQ7XG5cbiAgICAgICAgLy8gZmlndXJlIG91dCB3aGF0IGtpbmQgb2YgZm9ybWF0IHdlIGFyZSBkZWFsaW5nIHdpdGhcbiAgICAgICAgaWYgKGZvcm1hdC5pbmRleE9mKCckJykgPiAtMSkgeyAvLyBjdXJyZW5jeSEhISEhXG4gICAgICAgICAgICBvdXRwdXQgPSBmb3JtYXRDdXJyZW5jeShuLCBmb3JtYXQsIHJvdW5kaW5nRnVuY3Rpb24pO1xuICAgICAgICB9IGVsc2UgaWYgKGZvcm1hdC5pbmRleE9mKCclJykgPiAtMSkgeyAvLyBwZXJjZW50YWdlXG4gICAgICAgICAgICBvdXRwdXQgPSBmb3JtYXRQZXJjZW50YWdlKG4sIGZvcm1hdCwgcm91bmRpbmdGdW5jdGlvbik7XG4gICAgICAgIH0gZWxzZSBpZiAoZm9ybWF0LmluZGV4T2YoJzonKSA+IC0xKSB7IC8vIHRpbWVcbiAgICAgICAgICAgIG91dHB1dCA9IGZvcm1hdFRpbWUobiwgZm9ybWF0KTtcbiAgICAgICAgfSBlbHNlIHsgLy8gcGxhaW4gb2wnIG51bWJlcnMgb3IgYnl0ZXNcbiAgICAgICAgICAgIG91dHB1dCA9IGZvcm1hdE51bWJlcihuLl92YWx1ZSwgZm9ybWF0LCByb3VuZGluZ0Z1bmN0aW9uKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIHJldHVybiBzdHJpbmdcbiAgICAgICAgcmV0dXJuIG91dHB1dDtcbiAgICB9XG5cbiAgICAvLyByZXZlcnQgdG8gbnVtYmVyXG4gICAgZnVuY3Rpb24gdW5mb3JtYXROdW1lcmFsIChuLCBzdHJpbmcpIHtcbiAgICAgICAgdmFyIHN0cmluZ09yaWdpbmFsID0gc3RyaW5nLFxuICAgICAgICAgICAgdGhvdXNhbmRSZWdFeHAsXG4gICAgICAgICAgICBtaWxsaW9uUmVnRXhwLFxuICAgICAgICAgICAgYmlsbGlvblJlZ0V4cCxcbiAgICAgICAgICAgIHRyaWxsaW9uUmVnRXhwLFxuICAgICAgICAgICAgc3VmZml4ZXMgPSBbJ0tCJywgJ01CJywgJ0dCJywgJ1RCJywgJ1BCJywgJ0VCJywgJ1pCJywgJ1lCJ10sXG4gICAgICAgICAgICBieXRlc011bHRpcGxpZXIgPSBmYWxzZSxcbiAgICAgICAgICAgIHBvd2VyO1xuXG4gICAgICAgIGlmIChzdHJpbmcuaW5kZXhPZignOicpID4gLTEpIHtcbiAgICAgICAgICAgIG4uX3ZhbHVlID0gdW5mb3JtYXRUaW1lKHN0cmluZyk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBpZiAoc3RyaW5nID09PSB6ZXJvRm9ybWF0KSB7XG4gICAgICAgICAgICAgICAgbi5fdmFsdWUgPSAwO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBpZiAobGFuZ3VhZ2VzW2N1cnJlbnRMYW5ndWFnZV0uZGVsaW1pdGVycy5kZWNpbWFsICE9PSAnLicpIHtcbiAgICAgICAgICAgICAgICAgICAgc3RyaW5nID0gc3RyaW5nLnJlcGxhY2UoL1xcLi9nLCcnKS5yZXBsYWNlKGxhbmd1YWdlc1tjdXJyZW50TGFuZ3VhZ2VdLmRlbGltaXRlcnMuZGVjaW1hbCwgJy4nKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAvLyBzZWUgaWYgYWJicmV2aWF0aW9ucyBhcmUgdGhlcmUgc28gdGhhdCB3ZSBjYW4gbXVsdGlwbHkgdG8gdGhlIGNvcnJlY3QgbnVtYmVyXG4gICAgICAgICAgICAgICAgdGhvdXNhbmRSZWdFeHAgPSBuZXcgUmVnRXhwKCdbXmEtekEtWl0nICsgbGFuZ3VhZ2VzW2N1cnJlbnRMYW5ndWFnZV0uYWJicmV2aWF0aW9ucy50aG91c2FuZCArICcoPzpcXFxcKXwoXFxcXCcgKyBsYW5ndWFnZXNbY3VycmVudExhbmd1YWdlXS5jdXJyZW5jeS5zeW1ib2wgKyAnKT8oPzpcXFxcKSk/KT8kJyk7XG4gICAgICAgICAgICAgICAgbWlsbGlvblJlZ0V4cCA9IG5ldyBSZWdFeHAoJ1teYS16QS1aXScgKyBsYW5ndWFnZXNbY3VycmVudExhbmd1YWdlXS5hYmJyZXZpYXRpb25zLm1pbGxpb24gKyAnKD86XFxcXCl8KFxcXFwnICsgbGFuZ3VhZ2VzW2N1cnJlbnRMYW5ndWFnZV0uY3VycmVuY3kuc3ltYm9sICsgJyk/KD86XFxcXCkpPyk/JCcpO1xuICAgICAgICAgICAgICAgIGJpbGxpb25SZWdFeHAgPSBuZXcgUmVnRXhwKCdbXmEtekEtWl0nICsgbGFuZ3VhZ2VzW2N1cnJlbnRMYW5ndWFnZV0uYWJicmV2aWF0aW9ucy5iaWxsaW9uICsgJyg/OlxcXFwpfChcXFxcJyArIGxhbmd1YWdlc1tjdXJyZW50TGFuZ3VhZ2VdLmN1cnJlbmN5LnN5bWJvbCArICcpPyg/OlxcXFwpKT8pPyQnKTtcbiAgICAgICAgICAgICAgICB0cmlsbGlvblJlZ0V4cCA9IG5ldyBSZWdFeHAoJ1teYS16QS1aXScgKyBsYW5ndWFnZXNbY3VycmVudExhbmd1YWdlXS5hYmJyZXZpYXRpb25zLnRyaWxsaW9uICsgJyg/OlxcXFwpfChcXFxcJyArIGxhbmd1YWdlc1tjdXJyZW50TGFuZ3VhZ2VdLmN1cnJlbmN5LnN5bWJvbCArICcpPyg/OlxcXFwpKT8pPyQnKTtcblxuICAgICAgICAgICAgICAgIC8vIHNlZSBpZiBieXRlcyBhcmUgdGhlcmUgc28gdGhhdCB3ZSBjYW4gbXVsdGlwbHkgdG8gdGhlIGNvcnJlY3QgbnVtYmVyXG4gICAgICAgICAgICAgICAgZm9yIChwb3dlciA9IDA7IHBvd2VyIDw9IHN1ZmZpeGVzLmxlbmd0aDsgcG93ZXIrKykge1xuICAgICAgICAgICAgICAgICAgICBieXRlc011bHRpcGxpZXIgPSAoc3RyaW5nLmluZGV4T2Yoc3VmZml4ZXNbcG93ZXJdKSA+IC0xKSA/IE1hdGgucG93KDEwMjQsIHBvd2VyICsgMSkgOiBmYWxzZTtcblxuICAgICAgICAgICAgICAgICAgICBpZiAoYnl0ZXNNdWx0aXBsaWVyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIC8vIGRvIHNvbWUgbWF0aCB0byBjcmVhdGUgb3VyIG51bWJlclxuICAgICAgICAgICAgICAgIG4uX3ZhbHVlID0gKChieXRlc011bHRpcGxpZXIpID8gYnl0ZXNNdWx0aXBsaWVyIDogMSkgKiAoKHN0cmluZ09yaWdpbmFsLm1hdGNoKHRob3VzYW5kUmVnRXhwKSkgPyBNYXRoLnBvdygxMCwgMykgOiAxKSAqICgoc3RyaW5nT3JpZ2luYWwubWF0Y2gobWlsbGlvblJlZ0V4cCkpID8gTWF0aC5wb3coMTAsIDYpIDogMSkgKiAoKHN0cmluZ09yaWdpbmFsLm1hdGNoKGJpbGxpb25SZWdFeHApKSA/IE1hdGgucG93KDEwLCA5KSA6IDEpICogKChzdHJpbmdPcmlnaW5hbC5tYXRjaCh0cmlsbGlvblJlZ0V4cCkpID8gTWF0aC5wb3coMTAsIDEyKSA6IDEpICogKChzdHJpbmcuaW5kZXhPZignJScpID4gLTEpID8gMC4wMSA6IDEpICogKCgoc3RyaW5nLnNwbGl0KCctJykubGVuZ3RoICsgTWF0aC5taW4oc3RyaW5nLnNwbGl0KCcoJykubGVuZ3RoLTEsIHN0cmluZy5zcGxpdCgnKScpLmxlbmd0aC0xKSkgJSAyKT8gMTogLTEpICogTnVtYmVyKHN0cmluZy5yZXBsYWNlKC9bXjAtOVxcLl0rL2csICcnKSk7XG5cbiAgICAgICAgICAgICAgICAvLyByb3VuZCBpZiB3ZSBhcmUgdGFsa2luZyBhYm91dCBieXRlc1xuICAgICAgICAgICAgICAgIG4uX3ZhbHVlID0gKGJ5dGVzTXVsdGlwbGllcikgPyBNYXRoLmNlaWwobi5fdmFsdWUpIDogbi5fdmFsdWU7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG4uX3ZhbHVlO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGZvcm1hdEN1cnJlbmN5IChuLCBmb3JtYXQsIHJvdW5kaW5nRnVuY3Rpb24pIHtcbiAgICAgICAgdmFyIHN5bWJvbEluZGV4ID0gZm9ybWF0LmluZGV4T2YoJyQnKSxcbiAgICAgICAgICAgIG9wZW5QYXJlbkluZGV4ID0gZm9ybWF0LmluZGV4T2YoJygnKSxcbiAgICAgICAgICAgIG1pbnVzU2lnbkluZGV4ID0gZm9ybWF0LmluZGV4T2YoJy0nKSxcbiAgICAgICAgICAgIHNwYWNlID0gJycsXG4gICAgICAgICAgICBzcGxpY2VJbmRleCxcbiAgICAgICAgICAgIG91dHB1dDtcblxuICAgICAgICAvLyBjaGVjayBmb3Igc3BhY2UgYmVmb3JlIG9yIGFmdGVyIGN1cnJlbmN5XG4gICAgICAgIGlmIChmb3JtYXQuaW5kZXhPZignICQnKSA+IC0xKSB7XG4gICAgICAgICAgICBzcGFjZSA9ICcgJztcbiAgICAgICAgICAgIGZvcm1hdCA9IGZvcm1hdC5yZXBsYWNlKCcgJCcsICcnKTtcbiAgICAgICAgfSBlbHNlIGlmIChmb3JtYXQuaW5kZXhPZignJCAnKSA+IC0xKSB7XG4gICAgICAgICAgICBzcGFjZSA9ICcgJztcbiAgICAgICAgICAgIGZvcm1hdCA9IGZvcm1hdC5yZXBsYWNlKCckICcsICcnKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGZvcm1hdCA9IGZvcm1hdC5yZXBsYWNlKCckJywgJycpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gZm9ybWF0IHRoZSBudW1iZXJcbiAgICAgICAgb3V0cHV0ID0gZm9ybWF0TnVtYmVyKG4uX3ZhbHVlLCBmb3JtYXQsIHJvdW5kaW5nRnVuY3Rpb24pO1xuXG4gICAgICAgIC8vIHBvc2l0aW9uIHRoZSBzeW1ib2xcbiAgICAgICAgaWYgKHN5bWJvbEluZGV4IDw9IDEpIHtcbiAgICAgICAgICAgIGlmIChvdXRwdXQuaW5kZXhPZignKCcpID4gLTEgfHwgb3V0cHV0LmluZGV4T2YoJy0nKSA+IC0xKSB7XG4gICAgICAgICAgICAgICAgb3V0cHV0ID0gb3V0cHV0LnNwbGl0KCcnKTtcbiAgICAgICAgICAgICAgICBzcGxpY2VJbmRleCA9IDE7XG4gICAgICAgICAgICAgICAgaWYgKHN5bWJvbEluZGV4IDwgb3BlblBhcmVuSW5kZXggfHwgc3ltYm9sSW5kZXggPCBtaW51c1NpZ25JbmRleCl7XG4gICAgICAgICAgICAgICAgICAgIC8vIHRoZSBzeW1ib2wgYXBwZWFycyBiZWZvcmUgdGhlIFwiKFwiIG9yIFwiLVwiXG4gICAgICAgICAgICAgICAgICAgIHNwbGljZUluZGV4ID0gMDtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgb3V0cHV0LnNwbGljZShzcGxpY2VJbmRleCwgMCwgbGFuZ3VhZ2VzW2N1cnJlbnRMYW5ndWFnZV0uY3VycmVuY3kuc3ltYm9sICsgc3BhY2UpO1xuICAgICAgICAgICAgICAgIG91dHB1dCA9IG91dHB1dC5qb2luKCcnKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgb3V0cHV0ID0gbGFuZ3VhZ2VzW2N1cnJlbnRMYW5ndWFnZV0uY3VycmVuY3kuc3ltYm9sICsgc3BhY2UgKyBvdXRwdXQ7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBpZiAob3V0cHV0LmluZGV4T2YoJyknKSA+IC0xKSB7XG4gICAgICAgICAgICAgICAgb3V0cHV0ID0gb3V0cHV0LnNwbGl0KCcnKTtcbiAgICAgICAgICAgICAgICBvdXRwdXQuc3BsaWNlKC0xLCAwLCBzcGFjZSArIGxhbmd1YWdlc1tjdXJyZW50TGFuZ3VhZ2VdLmN1cnJlbmN5LnN5bWJvbCk7XG4gICAgICAgICAgICAgICAgb3V0cHV0ID0gb3V0cHV0LmpvaW4oJycpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBvdXRwdXQgPSBvdXRwdXQgKyBzcGFjZSArIGxhbmd1YWdlc1tjdXJyZW50TGFuZ3VhZ2VdLmN1cnJlbmN5LnN5bWJvbDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBvdXRwdXQ7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gZm9ybWF0UGVyY2VudGFnZSAobiwgZm9ybWF0LCByb3VuZGluZ0Z1bmN0aW9uKSB7XG4gICAgICAgIHZhciBzcGFjZSA9ICcnLFxuICAgICAgICAgICAgb3V0cHV0LFxuICAgICAgICAgICAgdmFsdWUgPSBuLl92YWx1ZSAqIDEwMDtcblxuICAgICAgICAvLyBjaGVjayBmb3Igc3BhY2UgYmVmb3JlICVcbiAgICAgICAgaWYgKGZvcm1hdC5pbmRleE9mKCcgJScpID4gLTEpIHtcbiAgICAgICAgICAgIHNwYWNlID0gJyAnO1xuICAgICAgICAgICAgZm9ybWF0ID0gZm9ybWF0LnJlcGxhY2UoJyAlJywgJycpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgZm9ybWF0ID0gZm9ybWF0LnJlcGxhY2UoJyUnLCAnJyk7XG4gICAgICAgIH1cblxuICAgICAgICBvdXRwdXQgPSBmb3JtYXROdW1iZXIodmFsdWUsIGZvcm1hdCwgcm91bmRpbmdGdW5jdGlvbik7XG4gICAgICAgIFxuICAgICAgICBpZiAob3V0cHV0LmluZGV4T2YoJyknKSA+IC0xICkge1xuICAgICAgICAgICAgb3V0cHV0ID0gb3V0cHV0LnNwbGl0KCcnKTtcbiAgICAgICAgICAgIG91dHB1dC5zcGxpY2UoLTEsIDAsIHNwYWNlICsgJyUnKTtcbiAgICAgICAgICAgIG91dHB1dCA9IG91dHB1dC5qb2luKCcnKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIG91dHB1dCA9IG91dHB1dCArIHNwYWNlICsgJyUnO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIG91dHB1dDtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBmb3JtYXRUaW1lIChuKSB7XG4gICAgICAgIHZhciBob3VycyA9IE1hdGguZmxvb3Iobi5fdmFsdWUvNjAvNjApLFxuICAgICAgICAgICAgbWludXRlcyA9IE1hdGguZmxvb3IoKG4uX3ZhbHVlIC0gKGhvdXJzICogNjAgKiA2MCkpLzYwKSxcbiAgICAgICAgICAgIHNlY29uZHMgPSBNYXRoLnJvdW5kKG4uX3ZhbHVlIC0gKGhvdXJzICogNjAgKiA2MCkgLSAobWludXRlcyAqIDYwKSk7XG4gICAgICAgIHJldHVybiBob3VycyArICc6JyArICgobWludXRlcyA8IDEwKSA/ICcwJyArIG1pbnV0ZXMgOiBtaW51dGVzKSArICc6JyArICgoc2Vjb25kcyA8IDEwKSA/ICcwJyArIHNlY29uZHMgOiBzZWNvbmRzKTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiB1bmZvcm1hdFRpbWUgKHN0cmluZykge1xuICAgICAgICB2YXIgdGltZUFycmF5ID0gc3RyaW5nLnNwbGl0KCc6JyksXG4gICAgICAgICAgICBzZWNvbmRzID0gMDtcbiAgICAgICAgLy8gdHVybiBob3VycyBhbmQgbWludXRlcyBpbnRvIHNlY29uZHMgYW5kIGFkZCB0aGVtIGFsbCB1cFxuICAgICAgICBpZiAodGltZUFycmF5Lmxlbmd0aCA9PT0gMykge1xuICAgICAgICAgICAgLy8gaG91cnNcbiAgICAgICAgICAgIHNlY29uZHMgPSBzZWNvbmRzICsgKE51bWJlcih0aW1lQXJyYXlbMF0pICogNjAgKiA2MCk7XG4gICAgICAgICAgICAvLyBtaW51dGVzXG4gICAgICAgICAgICBzZWNvbmRzID0gc2Vjb25kcyArIChOdW1iZXIodGltZUFycmF5WzFdKSAqIDYwKTtcbiAgICAgICAgICAgIC8vIHNlY29uZHNcbiAgICAgICAgICAgIHNlY29uZHMgPSBzZWNvbmRzICsgTnVtYmVyKHRpbWVBcnJheVsyXSk7XG4gICAgICAgIH0gZWxzZSBpZiAodGltZUFycmF5Lmxlbmd0aCA9PT0gMikge1xuICAgICAgICAgICAgLy8gbWludXRlc1xuICAgICAgICAgICAgc2Vjb25kcyA9IHNlY29uZHMgKyAoTnVtYmVyKHRpbWVBcnJheVswXSkgKiA2MCk7XG4gICAgICAgICAgICAvLyBzZWNvbmRzXG4gICAgICAgICAgICBzZWNvbmRzID0gc2Vjb25kcyArIE51bWJlcih0aW1lQXJyYXlbMV0pO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBOdW1iZXIoc2Vjb25kcyk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gZm9ybWF0TnVtYmVyICh2YWx1ZSwgZm9ybWF0LCByb3VuZGluZ0Z1bmN0aW9uKSB7XG4gICAgICAgIHZhciBuZWdQID0gZmFsc2UsXG4gICAgICAgICAgICBzaWduZWQgPSBmYWxzZSxcbiAgICAgICAgICAgIG9wdERlYyA9IGZhbHNlLFxuICAgICAgICAgICAgYWJiciA9ICcnLFxuICAgICAgICAgICAgYWJicksgPSBmYWxzZSwgLy8gZm9yY2UgYWJicmV2aWF0aW9uIHRvIHRob3VzYW5kc1xuICAgICAgICAgICAgYWJick0gPSBmYWxzZSwgLy8gZm9yY2UgYWJicmV2aWF0aW9uIHRvIG1pbGxpb25zXG4gICAgICAgICAgICBhYmJyQiA9IGZhbHNlLCAvLyBmb3JjZSBhYmJyZXZpYXRpb24gdG8gYmlsbGlvbnNcbiAgICAgICAgICAgIGFiYnJUID0gZmFsc2UsIC8vIGZvcmNlIGFiYnJldmlhdGlvbiB0byB0cmlsbGlvbnNcbiAgICAgICAgICAgIGFiYnJGb3JjZSA9IGZhbHNlLCAvLyBmb3JjZSBhYmJyZXZpYXRpb25cbiAgICAgICAgICAgIGJ5dGVzID0gJycsXG4gICAgICAgICAgICBvcmQgPSAnJyxcbiAgICAgICAgICAgIGFicyA9IE1hdGguYWJzKHZhbHVlKSxcbiAgICAgICAgICAgIHN1ZmZpeGVzID0gWydCJywgJ0tCJywgJ01CJywgJ0dCJywgJ1RCJywgJ1BCJywgJ0VCJywgJ1pCJywgJ1lCJ10sXG4gICAgICAgICAgICBtaW4sXG4gICAgICAgICAgICBtYXgsXG4gICAgICAgICAgICBwb3dlcixcbiAgICAgICAgICAgIHcsXG4gICAgICAgICAgICBwcmVjaXNpb24sXG4gICAgICAgICAgICB0aG91c2FuZHMsXG4gICAgICAgICAgICBkID0gJycsXG4gICAgICAgICAgICBuZWcgPSBmYWxzZTtcblxuICAgICAgICAvLyBjaGVjayBpZiBudW1iZXIgaXMgemVybyBhbmQgYSBjdXN0b20gemVybyBmb3JtYXQgaGFzIGJlZW4gc2V0XG4gICAgICAgIGlmICh2YWx1ZSA9PT0gMCAmJiB6ZXJvRm9ybWF0ICE9PSBudWxsKSB7XG4gICAgICAgICAgICByZXR1cm4gemVyb0Zvcm1hdDtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIC8vIHNlZSBpZiB3ZSBzaG91bGQgdXNlIHBhcmVudGhlc2VzIGZvciBuZWdhdGl2ZSBudW1iZXIgb3IgaWYgd2Ugc2hvdWxkIHByZWZpeCB3aXRoIGEgc2lnblxuICAgICAgICAgICAgLy8gaWYgYm90aCBhcmUgcHJlc2VudCB3ZSBkZWZhdWx0IHRvIHBhcmVudGhlc2VzXG4gICAgICAgICAgICBpZiAoZm9ybWF0LmluZGV4T2YoJygnKSA+IC0xKSB7XG4gICAgICAgICAgICAgICAgbmVnUCA9IHRydWU7XG4gICAgICAgICAgICAgICAgZm9ybWF0ID0gZm9ybWF0LnNsaWNlKDEsIC0xKTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoZm9ybWF0LmluZGV4T2YoJysnKSA+IC0xKSB7XG4gICAgICAgICAgICAgICAgc2lnbmVkID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICBmb3JtYXQgPSBmb3JtYXQucmVwbGFjZSgvXFwrL2csICcnKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gc2VlIGlmIGFiYnJldmlhdGlvbiBpcyB3YW50ZWRcbiAgICAgICAgICAgIGlmIChmb3JtYXQuaW5kZXhPZignYScpID4gLTEpIHtcbiAgICAgICAgICAgICAgICAvLyBjaGVjayBpZiBhYmJyZXZpYXRpb24gaXMgc3BlY2lmaWVkXG4gICAgICAgICAgICAgICAgYWJicksgPSBmb3JtYXQuaW5kZXhPZignYUsnKSA+PSAwO1xuICAgICAgICAgICAgICAgIGFiYnJNID0gZm9ybWF0LmluZGV4T2YoJ2FNJykgPj0gMDtcbiAgICAgICAgICAgICAgICBhYmJyQiA9IGZvcm1hdC5pbmRleE9mKCdhQicpID49IDA7XG4gICAgICAgICAgICAgICAgYWJiclQgPSBmb3JtYXQuaW5kZXhPZignYVQnKSA+PSAwO1xuICAgICAgICAgICAgICAgIGFiYnJGb3JjZSA9IGFiYnJLIHx8IGFiYnJNIHx8IGFiYnJCIHx8IGFiYnJUO1xuXG4gICAgICAgICAgICAgICAgLy8gY2hlY2sgZm9yIHNwYWNlIGJlZm9yZSBhYmJyZXZpYXRpb25cbiAgICAgICAgICAgICAgICBpZiAoZm9ybWF0LmluZGV4T2YoJyBhJykgPiAtMSkge1xuICAgICAgICAgICAgICAgICAgICBhYmJyID0gJyAnO1xuICAgICAgICAgICAgICAgICAgICBmb3JtYXQgPSBmb3JtYXQucmVwbGFjZSgnIGEnLCAnJyk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgZm9ybWF0ID0gZm9ybWF0LnJlcGxhY2UoJ2EnLCAnJyk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgaWYgKGFicyA+PSBNYXRoLnBvdygxMCwgMTIpICYmICFhYmJyRm9yY2UgfHwgYWJiclQpIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gdHJpbGxpb25cbiAgICAgICAgICAgICAgICAgICAgYWJiciA9IGFiYnIgKyBsYW5ndWFnZXNbY3VycmVudExhbmd1YWdlXS5hYmJyZXZpYXRpb25zLnRyaWxsaW9uO1xuICAgICAgICAgICAgICAgICAgICB2YWx1ZSA9IHZhbHVlIC8gTWF0aC5wb3coMTAsIDEyKTtcbiAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKGFicyA8IE1hdGgucG93KDEwLCAxMikgJiYgYWJzID49IE1hdGgucG93KDEwLCA5KSAmJiAhYWJickZvcmNlIHx8IGFiYnJCKSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIGJpbGxpb25cbiAgICAgICAgICAgICAgICAgICAgYWJiciA9IGFiYnIgKyBsYW5ndWFnZXNbY3VycmVudExhbmd1YWdlXS5hYmJyZXZpYXRpb25zLmJpbGxpb247XG4gICAgICAgICAgICAgICAgICAgIHZhbHVlID0gdmFsdWUgLyBNYXRoLnBvdygxMCwgOSk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIGlmIChhYnMgPCBNYXRoLnBvdygxMCwgOSkgJiYgYWJzID49IE1hdGgucG93KDEwLCA2KSAmJiAhYWJickZvcmNlIHx8IGFiYnJNKSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIG1pbGxpb25cbiAgICAgICAgICAgICAgICAgICAgYWJiciA9IGFiYnIgKyBsYW5ndWFnZXNbY3VycmVudExhbmd1YWdlXS5hYmJyZXZpYXRpb25zLm1pbGxpb247XG4gICAgICAgICAgICAgICAgICAgIHZhbHVlID0gdmFsdWUgLyBNYXRoLnBvdygxMCwgNik7XG4gICAgICAgICAgICAgICAgfSBlbHNlIGlmIChhYnMgPCBNYXRoLnBvdygxMCwgNikgJiYgYWJzID49IE1hdGgucG93KDEwLCAzKSAmJiAhYWJickZvcmNlIHx8IGFiYnJLKSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIHRob3VzYW5kXG4gICAgICAgICAgICAgICAgICAgIGFiYnIgPSBhYmJyICsgbGFuZ3VhZ2VzW2N1cnJlbnRMYW5ndWFnZV0uYWJicmV2aWF0aW9ucy50aG91c2FuZDtcbiAgICAgICAgICAgICAgICAgICAgdmFsdWUgPSB2YWx1ZSAvIE1hdGgucG93KDEwLCAzKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIHNlZSBpZiB3ZSBhcmUgZm9ybWF0dGluZyBieXRlc1xuICAgICAgICAgICAgaWYgKGZvcm1hdC5pbmRleE9mKCdiJykgPiAtMSkge1xuICAgICAgICAgICAgICAgIC8vIGNoZWNrIGZvciBzcGFjZSBiZWZvcmVcbiAgICAgICAgICAgICAgICBpZiAoZm9ybWF0LmluZGV4T2YoJyBiJykgPiAtMSkge1xuICAgICAgICAgICAgICAgICAgICBieXRlcyA9ICcgJztcbiAgICAgICAgICAgICAgICAgICAgZm9ybWF0ID0gZm9ybWF0LnJlcGxhY2UoJyBiJywgJycpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGZvcm1hdCA9IGZvcm1hdC5yZXBsYWNlKCdiJywgJycpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGZvciAocG93ZXIgPSAwOyBwb3dlciA8PSBzdWZmaXhlcy5sZW5ndGg7IHBvd2VyKyspIHtcbiAgICAgICAgICAgICAgICAgICAgbWluID0gTWF0aC5wb3coMTAyNCwgcG93ZXIpO1xuICAgICAgICAgICAgICAgICAgICBtYXggPSBNYXRoLnBvdygxMDI0LCBwb3dlcisxKTtcblxuICAgICAgICAgICAgICAgICAgICBpZiAodmFsdWUgPj0gbWluICYmIHZhbHVlIDwgbWF4KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBieXRlcyA9IGJ5dGVzICsgc3VmZml4ZXNbcG93ZXJdO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKG1pbiA+IDApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YWx1ZSA9IHZhbHVlIC8gbWluO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIHNlZSBpZiBvcmRpbmFsIGlzIHdhbnRlZFxuICAgICAgICAgICAgaWYgKGZvcm1hdC5pbmRleE9mKCdvJykgPiAtMSkge1xuICAgICAgICAgICAgICAgIC8vIGNoZWNrIGZvciBzcGFjZSBiZWZvcmVcbiAgICAgICAgICAgICAgICBpZiAoZm9ybWF0LmluZGV4T2YoJyBvJykgPiAtMSkge1xuICAgICAgICAgICAgICAgICAgICBvcmQgPSAnICc7XG4gICAgICAgICAgICAgICAgICAgIGZvcm1hdCA9IGZvcm1hdC5yZXBsYWNlKCcgbycsICcnKTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBmb3JtYXQgPSBmb3JtYXQucmVwbGFjZSgnbycsICcnKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBvcmQgPSBvcmQgKyBsYW5ndWFnZXNbY3VycmVudExhbmd1YWdlXS5vcmRpbmFsKHZhbHVlKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKGZvcm1hdC5pbmRleE9mKCdbLl0nKSA+IC0xKSB7XG4gICAgICAgICAgICAgICAgb3B0RGVjID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICBmb3JtYXQgPSBmb3JtYXQucmVwbGFjZSgnWy5dJywgJy4nKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdyA9IHZhbHVlLnRvU3RyaW5nKCkuc3BsaXQoJy4nKVswXTtcbiAgICAgICAgICAgIHByZWNpc2lvbiA9IGZvcm1hdC5zcGxpdCgnLicpWzFdO1xuICAgICAgICAgICAgdGhvdXNhbmRzID0gZm9ybWF0LmluZGV4T2YoJywnKTtcblxuICAgICAgICAgICAgaWYgKHByZWNpc2lvbikge1xuICAgICAgICAgICAgICAgIGlmIChwcmVjaXNpb24uaW5kZXhPZignWycpID4gLTEpIHtcbiAgICAgICAgICAgICAgICAgICAgcHJlY2lzaW9uID0gcHJlY2lzaW9uLnJlcGxhY2UoJ10nLCAnJyk7XG4gICAgICAgICAgICAgICAgICAgIHByZWNpc2lvbiA9IHByZWNpc2lvbi5zcGxpdCgnWycpO1xuICAgICAgICAgICAgICAgICAgICBkID0gdG9GaXhlZCh2YWx1ZSwgKHByZWNpc2lvblswXS5sZW5ndGggKyBwcmVjaXNpb25bMV0ubGVuZ3RoKSwgcm91bmRpbmdGdW5jdGlvbiwgcHJlY2lzaW9uWzFdLmxlbmd0aCk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgZCA9IHRvRml4ZWQodmFsdWUsIHByZWNpc2lvbi5sZW5ndGgsIHJvdW5kaW5nRnVuY3Rpb24pO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHcgPSBkLnNwbGl0KCcuJylbMF07XG5cbiAgICAgICAgICAgICAgICBpZiAoZC5zcGxpdCgnLicpWzFdLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgICAgICBkID0gbGFuZ3VhZ2VzW2N1cnJlbnRMYW5ndWFnZV0uZGVsaW1pdGVycy5kZWNpbWFsICsgZC5zcGxpdCgnLicpWzFdO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGQgPSAnJztcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBpZiAob3B0RGVjICYmIE51bWJlcihkLnNsaWNlKDEpKSA9PT0gMCkge1xuICAgICAgICAgICAgICAgICAgICBkID0gJyc7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB3ID0gdG9GaXhlZCh2YWx1ZSwgbnVsbCwgcm91bmRpbmdGdW5jdGlvbik7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIGZvcm1hdCBudW1iZXJcbiAgICAgICAgICAgIGlmICh3LmluZGV4T2YoJy0nKSA+IC0xKSB7XG4gICAgICAgICAgICAgICAgdyA9IHcuc2xpY2UoMSk7XG4gICAgICAgICAgICAgICAgbmVnID0gdHJ1ZTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKHRob3VzYW5kcyA+IC0xKSB7XG4gICAgICAgICAgICAgICAgdyA9IHcudG9TdHJpbmcoKS5yZXBsYWNlKC8oXFxkKSg/PShcXGR7M30pKyg/IVxcZCkpL2csICckMScgKyBsYW5ndWFnZXNbY3VycmVudExhbmd1YWdlXS5kZWxpbWl0ZXJzLnRob3VzYW5kcyk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChmb3JtYXQuaW5kZXhPZignLicpID09PSAwKSB7XG4gICAgICAgICAgICAgICAgdyA9ICcnO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4gKChuZWdQICYmIG5lZykgPyAnKCcgOiAnJykgKyAoKCFuZWdQICYmIG5lZykgPyAnLScgOiAnJykgKyAoKCFuZWcgJiYgc2lnbmVkKSA/ICcrJyA6ICcnKSArIHcgKyBkICsgKChvcmQpID8gb3JkIDogJycpICsgKChhYmJyKSA/IGFiYnIgOiAnJykgKyAoKGJ5dGVzKSA/IGJ5dGVzIDogJycpICsgKChuZWdQICYmIG5lZykgPyAnKScgOiAnJyk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gICAgICAgIFRvcCBMZXZlbCBGdW5jdGlvbnNcbiAgICAqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cbiAgICBudW1lcmFsID0gZnVuY3Rpb24gKGlucHV0KSB7XG4gICAgICAgIGlmIChudW1lcmFsLmlzTnVtZXJhbChpbnB1dCkpIHtcbiAgICAgICAgICAgIGlucHV0ID0gaW5wdXQudmFsdWUoKTtcbiAgICAgICAgfSBlbHNlIGlmIChpbnB1dCA9PT0gMCB8fCB0eXBlb2YgaW5wdXQgPT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgICAgICBpbnB1dCA9IDA7XG4gICAgICAgIH0gZWxzZSBpZiAoIU51bWJlcihpbnB1dCkpIHtcbiAgICAgICAgICAgIGlucHV0ID0gbnVtZXJhbC5mbi51bmZvcm1hdChpbnB1dCk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gbmV3IE51bWVyYWwoTnVtYmVyKGlucHV0KSk7XG4gICAgfTtcblxuICAgIC8vIHZlcnNpb24gbnVtYmVyXG4gICAgbnVtZXJhbC52ZXJzaW9uID0gVkVSU0lPTjtcblxuICAgIC8vIGNvbXBhcmUgbnVtZXJhbCBvYmplY3RcbiAgICBudW1lcmFsLmlzTnVtZXJhbCA9IGZ1bmN0aW9uIChvYmopIHtcbiAgICAgICAgcmV0dXJuIG9iaiBpbnN0YW5jZW9mIE51bWVyYWw7XG4gICAgfTtcblxuICAgIC8vIFRoaXMgZnVuY3Rpb24gd2lsbCBsb2FkIGxhbmd1YWdlcyBhbmQgdGhlbiBzZXQgdGhlIGdsb2JhbCBsYW5ndWFnZS4gIElmXG4gICAgLy8gbm8gYXJndW1lbnRzIGFyZSBwYXNzZWQgaW4sIGl0IHdpbGwgc2ltcGx5IHJldHVybiB0aGUgY3VycmVudCBnbG9iYWxcbiAgICAvLyBsYW5ndWFnZSBrZXkuXG4gICAgbnVtZXJhbC5sYW5ndWFnZSA9IGZ1bmN0aW9uIChrZXksIHZhbHVlcykge1xuICAgICAgICBpZiAoIWtleSkge1xuICAgICAgICAgICAgcmV0dXJuIGN1cnJlbnRMYW5ndWFnZTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChrZXkgJiYgIXZhbHVlcykge1xuICAgICAgICAgICAgaWYoIWxhbmd1YWdlc1trZXldKSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdVbmtub3duIGxhbmd1YWdlIDogJyArIGtleSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjdXJyZW50TGFuZ3VhZ2UgPSBrZXk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodmFsdWVzIHx8ICFsYW5ndWFnZXNba2V5XSkge1xuICAgICAgICAgICAgbG9hZExhbmd1YWdlKGtleSwgdmFsdWVzKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBudW1lcmFsO1xuICAgIH07XG4gICAgXG4gICAgLy8gVGhpcyBmdW5jdGlvbiBwcm92aWRlcyBhY2Nlc3MgdG8gdGhlIGxvYWRlZCBsYW5ndWFnZSBkYXRhLiAgSWZcbiAgICAvLyBubyBhcmd1bWVudHMgYXJlIHBhc3NlZCBpbiwgaXQgd2lsbCBzaW1wbHkgcmV0dXJuIHRoZSBjdXJyZW50XG4gICAgLy8gZ2xvYmFsIGxhbmd1YWdlIG9iamVjdC5cbiAgICBudW1lcmFsLmxhbmd1YWdlRGF0YSA9IGZ1bmN0aW9uIChrZXkpIHtcbiAgICAgICAgaWYgKCFrZXkpIHtcbiAgICAgICAgICAgIHJldHVybiBsYW5ndWFnZXNbY3VycmVudExhbmd1YWdlXTtcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgaWYgKCFsYW5ndWFnZXNba2V5XSkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdVbmtub3duIGxhbmd1YWdlIDogJyArIGtleSk7XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIHJldHVybiBsYW5ndWFnZXNba2V5XTtcbiAgICB9O1xuXG4gICAgbnVtZXJhbC5sYW5ndWFnZSgnZW4nLCB7XG4gICAgICAgIGRlbGltaXRlcnM6IHtcbiAgICAgICAgICAgIHRob3VzYW5kczogJywnLFxuICAgICAgICAgICAgZGVjaW1hbDogJy4nXG4gICAgICAgIH0sXG4gICAgICAgIGFiYnJldmlhdGlvbnM6IHtcbiAgICAgICAgICAgIHRob3VzYW5kOiAnaycsXG4gICAgICAgICAgICBtaWxsaW9uOiAnbScsXG4gICAgICAgICAgICBiaWxsaW9uOiAnYicsXG4gICAgICAgICAgICB0cmlsbGlvbjogJ3QnXG4gICAgICAgIH0sXG4gICAgICAgIG9yZGluYWw6IGZ1bmN0aW9uIChudW1iZXIpIHtcbiAgICAgICAgICAgIHZhciBiID0gbnVtYmVyICUgMTA7XG4gICAgICAgICAgICByZXR1cm4gKH5+IChudW1iZXIgJSAxMDAgLyAxMCkgPT09IDEpID8gJ3RoJyA6XG4gICAgICAgICAgICAgICAgKGIgPT09IDEpID8gJ3N0JyA6XG4gICAgICAgICAgICAgICAgKGIgPT09IDIpID8gJ25kJyA6XG4gICAgICAgICAgICAgICAgKGIgPT09IDMpID8gJ3JkJyA6ICd0aCc7XG4gICAgICAgIH0sXG4gICAgICAgIGN1cnJlbmN5OiB7XG4gICAgICAgICAgICBzeW1ib2w6ICckJ1xuICAgICAgICB9XG4gICAgfSk7XG5cbiAgICBudW1lcmFsLnplcm9Gb3JtYXQgPSBmdW5jdGlvbiAoZm9ybWF0KSB7XG4gICAgICAgIHplcm9Gb3JtYXQgPSB0eXBlb2YoZm9ybWF0KSA9PT0gJ3N0cmluZycgPyBmb3JtYXQgOiBudWxsO1xuICAgIH07XG5cbiAgICBudW1lcmFsLmRlZmF1bHRGb3JtYXQgPSBmdW5jdGlvbiAoZm9ybWF0KSB7XG4gICAgICAgIGRlZmF1bHRGb3JtYXQgPSB0eXBlb2YoZm9ybWF0KSA9PT0gJ3N0cmluZycgPyBmb3JtYXQgOiAnMC4wJztcbiAgICB9O1xuXG4gICAgLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICAgICAgICBIZWxwZXJzXG4gICAgKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG4gICAgZnVuY3Rpb24gbG9hZExhbmd1YWdlKGtleSwgdmFsdWVzKSB7XG4gICAgICAgIGxhbmd1YWdlc1trZXldID0gdmFsdWVzO1xuICAgIH1cblxuICAgIC8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICAgICAgRmxvYXRpbmctcG9pbnQgaGVscGVyc1xuICAgICoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cblxuICAgIC8vIFRoZSBmbG9hdGluZy1wb2ludCBoZWxwZXIgZnVuY3Rpb25zIGFuZCBpbXBsZW1lbnRhdGlvblxuICAgIC8vIGJvcnJvd3MgaGVhdmlseSBmcm9tIHNpbmZ1bC5qczogaHR0cDovL2d1aXBuLmdpdGh1Yi5pby9zaW5mdWwuanMvXG5cbiAgICAvKipcbiAgICAgKiBBcnJheS5wcm90b3R5cGUucmVkdWNlIGZvciBicm93c2VycyB0aGF0IGRvbid0IHN1cHBvcnQgaXRcbiAgICAgKiBodHRwczovL2RldmVsb3Blci5tb3ppbGxhLm9yZy9lbi1VUy9kb2NzL1dlYi9KYXZhU2NyaXB0L1JlZmVyZW5jZS9HbG9iYWxfT2JqZWN0cy9BcnJheS9SZWR1Y2UjQ29tcGF0aWJpbGl0eVxuICAgICAqL1xuICAgIGlmICgnZnVuY3Rpb24nICE9PSB0eXBlb2YgQXJyYXkucHJvdG90eXBlLnJlZHVjZSkge1xuICAgICAgICBBcnJheS5wcm90b3R5cGUucmVkdWNlID0gZnVuY3Rpb24gKGNhbGxiYWNrLCBvcHRfaW5pdGlhbFZhbHVlKSB7XG4gICAgICAgICAgICAndXNlIHN0cmljdCc7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGlmIChudWxsID09PSB0aGlzIHx8ICd1bmRlZmluZWQnID09PSB0eXBlb2YgdGhpcykge1xuICAgICAgICAgICAgICAgIC8vIEF0IHRoZSBtb21lbnQgYWxsIG1vZGVybiBicm93c2VycywgdGhhdCBzdXBwb3J0IHN0cmljdCBtb2RlLCBoYXZlXG4gICAgICAgICAgICAgICAgLy8gbmF0aXZlIGltcGxlbWVudGF0aW9uIG9mIEFycmF5LnByb3RvdHlwZS5yZWR1Y2UuIEZvciBpbnN0YW5jZSwgSUU4XG4gICAgICAgICAgICAgICAgLy8gZG9lcyBub3Qgc3VwcG9ydCBzdHJpY3QgbW9kZSwgc28gdGhpcyBjaGVjayBpcyBhY3R1YWxseSB1c2VsZXNzLlxuICAgICAgICAgICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ0FycmF5LnByb3RvdHlwZS5yZWR1Y2UgY2FsbGVkIG9uIG51bGwgb3IgdW5kZWZpbmVkJyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGlmICgnZnVuY3Rpb24nICE9PSB0eXBlb2YgY2FsbGJhY2spIHtcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKGNhbGxiYWNrICsgJyBpcyBub3QgYSBmdW5jdGlvbicpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB2YXIgaW5kZXgsXG4gICAgICAgICAgICAgICAgdmFsdWUsXG4gICAgICAgICAgICAgICAgbGVuZ3RoID0gdGhpcy5sZW5ndGggPj4+IDAsXG4gICAgICAgICAgICAgICAgaXNWYWx1ZVNldCA9IGZhbHNlO1xuXG4gICAgICAgICAgICBpZiAoMSA8IGFyZ3VtZW50cy5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICB2YWx1ZSA9IG9wdF9pbml0aWFsVmFsdWU7XG4gICAgICAgICAgICAgICAgaXNWYWx1ZVNldCA9IHRydWU7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGZvciAoaW5kZXggPSAwOyBsZW5ndGggPiBpbmRleDsgKytpbmRleCkge1xuICAgICAgICAgICAgICAgIGlmICh0aGlzLmhhc093blByb3BlcnR5KGluZGV4KSkge1xuICAgICAgICAgICAgICAgICAgICBpZiAoaXNWYWx1ZVNldCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgdmFsdWUgPSBjYWxsYmFjayh2YWx1ZSwgdGhpc1tpbmRleF0sIGluZGV4LCB0aGlzKTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhbHVlID0gdGhpc1tpbmRleF07XG4gICAgICAgICAgICAgICAgICAgICAgICBpc1ZhbHVlU2V0ID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKCFpc1ZhbHVlU2V0KSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcignUmVkdWNlIG9mIGVtcHR5IGFycmF5IHdpdGggbm8gaW5pdGlhbCB2YWx1ZScpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4gdmFsdWU7XG4gICAgICAgIH07XG4gICAgfVxuXG4gICAgXG4gICAgLyoqXG4gICAgICogQ29tcHV0ZXMgdGhlIG11bHRpcGxpZXIgbmVjZXNzYXJ5IHRvIG1ha2UgeCA+PSAxLFxuICAgICAqIGVmZmVjdGl2ZWx5IGVsaW1pbmF0aW5nIG1pc2NhbGN1bGF0aW9ucyBjYXVzZWQgYnlcbiAgICAgKiBmaW5pdGUgcHJlY2lzaW9uLlxuICAgICAqL1xuICAgIGZ1bmN0aW9uIG11bHRpcGxpZXIoeCkge1xuICAgICAgICB2YXIgcGFydHMgPSB4LnRvU3RyaW5nKCkuc3BsaXQoJy4nKTtcbiAgICAgICAgaWYgKHBhcnRzLmxlbmd0aCA8IDIpIHtcbiAgICAgICAgICAgIHJldHVybiAxO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBNYXRoLnBvdygxMCwgcGFydHNbMV0ubGVuZ3RoKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBHaXZlbiBhIHZhcmlhYmxlIG51bWJlciBvZiBhcmd1bWVudHMsIHJldHVybnMgdGhlIG1heGltdW1cbiAgICAgKiBtdWx0aXBsaWVyIHRoYXQgbXVzdCBiZSB1c2VkIHRvIG5vcm1hbGl6ZSBhbiBvcGVyYXRpb24gaW52b2x2aW5nXG4gICAgICogYWxsIG9mIHRoZW0uXG4gICAgICovXG4gICAgZnVuY3Rpb24gY29ycmVjdGlvbkZhY3RvcigpIHtcbiAgICAgICAgdmFyIGFyZ3MgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMpO1xuICAgICAgICByZXR1cm4gYXJncy5yZWR1Y2UoZnVuY3Rpb24gKHByZXYsIG5leHQpIHtcbiAgICAgICAgICAgIHZhciBtcCA9IG11bHRpcGxpZXIocHJldiksXG4gICAgICAgICAgICAgICAgbW4gPSBtdWx0aXBsaWVyKG5leHQpO1xuICAgICAgICByZXR1cm4gbXAgPiBtbiA/IG1wIDogbW47XG4gICAgICAgIH0sIC1JbmZpbml0eSk7XG4gICAgfSAgICAgICAgXG5cblxuICAgIC8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICAgICAgTnVtZXJhbCBQcm90b3R5cGVcbiAgICAqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cblxuICAgIG51bWVyYWwuZm4gPSBOdW1lcmFsLnByb3RvdHlwZSA9IHtcblxuICAgICAgICBjbG9uZSA6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHJldHVybiBudW1lcmFsKHRoaXMpO1xuICAgICAgICB9LFxuXG4gICAgICAgIGZvcm1hdCA6IGZ1bmN0aW9uIChpbnB1dFN0cmluZywgcm91bmRpbmdGdW5jdGlvbikge1xuICAgICAgICAgICAgcmV0dXJuIGZvcm1hdE51bWVyYWwodGhpcywgXG4gICAgICAgICAgICAgICAgICBpbnB1dFN0cmluZyA/IGlucHV0U3RyaW5nIDogZGVmYXVsdEZvcm1hdCwgXG4gICAgICAgICAgICAgICAgICAocm91bmRpbmdGdW5jdGlvbiAhPT0gdW5kZWZpbmVkKSA/IHJvdW5kaW5nRnVuY3Rpb24gOiBNYXRoLnJvdW5kXG4gICAgICAgICAgICAgICk7XG4gICAgICAgIH0sXG5cbiAgICAgICAgdW5mb3JtYXQgOiBmdW5jdGlvbiAoaW5wdXRTdHJpbmcpIHtcbiAgICAgICAgICAgIGlmIChPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwoaW5wdXRTdHJpbmcpID09PSAnW29iamVjdCBOdW1iZXJdJykgeyBcbiAgICAgICAgICAgICAgICByZXR1cm4gaW5wdXRTdHJpbmc7IFxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIHVuZm9ybWF0TnVtZXJhbCh0aGlzLCBpbnB1dFN0cmluZyA/IGlucHV0U3RyaW5nIDogZGVmYXVsdEZvcm1hdCk7XG4gICAgICAgIH0sXG5cbiAgICAgICAgdmFsdWUgOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5fdmFsdWU7XG4gICAgICAgIH0sXG5cbiAgICAgICAgdmFsdWVPZiA6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLl92YWx1ZTtcbiAgICAgICAgfSxcblxuICAgICAgICBzZXQgOiBmdW5jdGlvbiAodmFsdWUpIHtcbiAgICAgICAgICAgIHRoaXMuX3ZhbHVlID0gTnVtYmVyKHZhbHVlKTtcbiAgICAgICAgICAgIHJldHVybiB0aGlzO1xuICAgICAgICB9LFxuXG4gICAgICAgIGFkZCA6IGZ1bmN0aW9uICh2YWx1ZSkge1xuICAgICAgICAgICAgdmFyIGNvcnJGYWN0b3IgPSBjb3JyZWN0aW9uRmFjdG9yLmNhbGwobnVsbCwgdGhpcy5fdmFsdWUsIHZhbHVlKTtcbiAgICAgICAgICAgIGZ1bmN0aW9uIGNiYWNrKGFjY3VtLCBjdXJyLCBjdXJySSwgTykge1xuICAgICAgICAgICAgICAgIHJldHVybiBhY2N1bSArIGNvcnJGYWN0b3IgKiBjdXJyO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdGhpcy5fdmFsdWUgPSBbdGhpcy5fdmFsdWUsIHZhbHVlXS5yZWR1Y2UoY2JhY2ssIDApIC8gY29yckZhY3RvcjtcbiAgICAgICAgICAgIHJldHVybiB0aGlzO1xuICAgICAgICB9LFxuXG4gICAgICAgIHN1YnRyYWN0IDogZnVuY3Rpb24gKHZhbHVlKSB7XG4gICAgICAgICAgICB2YXIgY29yckZhY3RvciA9IGNvcnJlY3Rpb25GYWN0b3IuY2FsbChudWxsLCB0aGlzLl92YWx1ZSwgdmFsdWUpO1xuICAgICAgICAgICAgZnVuY3Rpb24gY2JhY2soYWNjdW0sIGN1cnIsIGN1cnJJLCBPKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGFjY3VtIC0gY29yckZhY3RvciAqIGN1cnI7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0aGlzLl92YWx1ZSA9IFt2YWx1ZV0ucmVkdWNlKGNiYWNrLCB0aGlzLl92YWx1ZSAqIGNvcnJGYWN0b3IpIC8gY29yckZhY3RvcjsgICAgICAgICAgICBcbiAgICAgICAgICAgIHJldHVybiB0aGlzO1xuICAgICAgICB9LFxuXG4gICAgICAgIG11bHRpcGx5IDogZnVuY3Rpb24gKHZhbHVlKSB7XG4gICAgICAgICAgICBmdW5jdGlvbiBjYmFjayhhY2N1bSwgY3VyciwgY3VyckksIE8pIHtcbiAgICAgICAgICAgICAgICB2YXIgY29yckZhY3RvciA9IGNvcnJlY3Rpb25GYWN0b3IoYWNjdW0sIGN1cnIpO1xuICAgICAgICAgICAgICAgIHJldHVybiAoYWNjdW0gKiBjb3JyRmFjdG9yKSAqIChjdXJyICogY29yckZhY3RvcikgL1xuICAgICAgICAgICAgICAgICAgICAoY29yckZhY3RvciAqIGNvcnJGYWN0b3IpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdGhpcy5fdmFsdWUgPSBbdGhpcy5fdmFsdWUsIHZhbHVlXS5yZWR1Y2UoY2JhY2ssIDEpO1xuICAgICAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgICAgIH0sXG5cbiAgICAgICAgZGl2aWRlIDogZnVuY3Rpb24gKHZhbHVlKSB7XG4gICAgICAgICAgICBmdW5jdGlvbiBjYmFjayhhY2N1bSwgY3VyciwgY3VyckksIE8pIHtcbiAgICAgICAgICAgICAgICB2YXIgY29yckZhY3RvciA9IGNvcnJlY3Rpb25GYWN0b3IoYWNjdW0sIGN1cnIpO1xuICAgICAgICAgICAgICAgIHJldHVybiAoYWNjdW0gKiBjb3JyRmFjdG9yKSAvIChjdXJyICogY29yckZhY3Rvcik7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0aGlzLl92YWx1ZSA9IFt0aGlzLl92YWx1ZSwgdmFsdWVdLnJlZHVjZShjYmFjayk7ICAgICAgICAgICAgXG4gICAgICAgICAgICByZXR1cm4gdGhpcztcbiAgICAgICAgfSxcblxuICAgICAgICBkaWZmZXJlbmNlIDogZnVuY3Rpb24gKHZhbHVlKSB7XG4gICAgICAgICAgICByZXR1cm4gTWF0aC5hYnMobnVtZXJhbCh0aGlzLl92YWx1ZSkuc3VidHJhY3QodmFsdWUpLnZhbHVlKCkpO1xuICAgICAgICB9XG5cbiAgICB9O1xuXG4gICAgLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICAgICAgICBFeHBvc2luZyBOdW1lcmFsXG4gICAgKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG4gICAgLy8gQ29tbW9uSlMgbW9kdWxlIGlzIGRlZmluZWRcbiAgICBpZiAoaGFzTW9kdWxlKSB7XG4gICAgICAgIG1vZHVsZS5leHBvcnRzID0gbnVtZXJhbDtcbiAgICB9XG5cbiAgICAvKmdsb2JhbCBlbmRlcjpmYWxzZSAqL1xuICAgIGlmICh0eXBlb2YgZW5kZXIgPT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgIC8vIGhlcmUsIGB0aGlzYCBtZWFucyBgd2luZG93YCBpbiB0aGUgYnJvd3Nlciwgb3IgYGdsb2JhbGAgb24gdGhlIHNlcnZlclxuICAgICAgICAvLyBhZGQgYG51bWVyYWxgIGFzIGEgZ2xvYmFsIG9iamVjdCB2aWEgYSBzdHJpbmcgaWRlbnRpZmllcixcbiAgICAgICAgLy8gZm9yIENsb3N1cmUgQ29tcGlsZXIgJ2FkdmFuY2VkJyBtb2RlXG4gICAgICAgIHRoaXNbJ251bWVyYWwnXSA9IG51bWVyYWw7XG4gICAgfVxuXG4gICAgLypnbG9iYWwgZGVmaW5lOmZhbHNlICovXG4gICAgaWYgKHR5cGVvZiBkZWZpbmUgPT09ICdmdW5jdGlvbicgJiYgZGVmaW5lLmFtZCkge1xuICAgICAgICBkZWZpbmUoW10sIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHJldHVybiBudW1lcmFsO1xuICAgICAgICB9KTtcbiAgICB9XG59KS5jYWxsKHRoaXMpO1xuIiwiLyoqXG4gICAgQWNjb3VudCBhY3Rpdml0eVxuKiovXG4ndXNlIHN0cmljdCc7XG5cbnZhciBzaW5nbGV0b24gPSBudWxsLFxuICAgIE5hdkFjdGlvbiA9IHJlcXVpcmUoJy4uL3ZpZXdtb2RlbHMvTmF2QWN0aW9uJyksXG4gICAgTmF2QmFyID0gcmVxdWlyZSgnLi4vdmlld21vZGVscy9OYXZCYXInKTtcblxuZXhwb3J0cy5pbml0ID0gZnVuY3Rpb24gaW5pdEFjY291bnQoJGFjdGl2aXR5LCBhcHApIHtcblxuICAgIGlmIChzaW5nbGV0b24gPT09IG51bGwpXG4gICAgICAgIHNpbmdsZXRvbiA9IG5ldyBBY2NvdW50QWN0aXZpdHkoJGFjdGl2aXR5LCBhcHApO1xuICAgIFxuICAgIHJldHVybiBzaW5nbGV0b247XG59O1xuXG5mdW5jdGlvbiBBY2NvdW50QWN0aXZpdHkoJGFjdGl2aXR5LCBhcHApIHtcbiAgICBcbiAgICB0aGlzLmFjY2Vzc0xldmVsID0gYXBwLlVzZXJUeXBlLkxvZ2dlZFVzZXI7XG5cbiAgICB0aGlzLiRhY3Rpdml0eSA9ICRhY3Rpdml0eTtcbiAgICB0aGlzLmFwcCA9IGFwcDtcbiAgICBcbiAgICB0aGlzLm5hdkJhciA9IG5ldyBOYXZCYXIoe1xuICAgICAgICB0aXRsZTogJ0FjY291bnQnLFxuICAgICAgICBsZWZ0QWN0aW9uOiBOYXZBY3Rpb24ubWVudU5ld0l0ZW0sXG4gICAgICAgIHJpZ2h0QWN0aW9uOiBOYXZBY3Rpb24ubWVudUluXG4gICAgfSk7XG59XG5cbkFjY291bnRBY3Rpdml0eS5wcm90b3R5cGUuc2hvdyA9IGZ1bmN0aW9uIHNob3cob3B0aW9ucykge1xuXG59O1xuIiwiLyoqIENhbGVuZGFyIGFjdGl2aXR5ICoqL1xyXG4ndXNlIHN0cmljdCc7XHJcblxyXG52YXIgJCA9IHJlcXVpcmUoJ2pxdWVyeScpLFxyXG4gICAgbW9tZW50ID0gcmVxdWlyZSgnbW9tZW50JyksXHJcbiAgICBrbyA9IHJlcXVpcmUoJ2tub2Nrb3V0JyksXHJcbiAgICBOYXZBY3Rpb24gPSByZXF1aXJlKCcuLi92aWV3bW9kZWxzL05hdkFjdGlvbicpLFxyXG4gICAgTmF2QmFyID0gcmVxdWlyZSgnLi4vdmlld21vZGVscy9OYXZCYXInKTtcclxucmVxdWlyZSgnLi4vY29tcG9uZW50cy9EYXRlUGlja2VyJyk7XHJcblxyXG52YXIgc2luZ2xldG9uID0gbnVsbDtcclxuXHJcbmV4cG9ydHMuaW5pdCA9IGZ1bmN0aW9uIGluaXRBcHBvaW50bWVudCgkYWN0aXZpdHksIGFwcCkge1xyXG5cclxuICAgIGlmIChzaW5nbGV0b24gPT09IG51bGwpXHJcbiAgICAgICAgc2luZ2xldG9uID0gbmV3IEFwcG9pbnRtZW50QWN0aXZpdHkoJGFjdGl2aXR5LCBhcHApO1xyXG4gICAgXHJcbiAgICByZXR1cm4gc2luZ2xldG9uO1xyXG59O1xyXG5cclxuZnVuY3Rpb24gQXBwb2ludG1lbnRBY3Rpdml0eSgkYWN0aXZpdHksIGFwcCkge1xyXG5cclxuICAgIHRoaXMuYWNjZXNzTGV2ZWwgPSBhcHAuVXNlclR5cGUuUHJvdmlkZXI7XHJcbiAgICB0aGlzLm1lbnVJdGVtID0gJ2NhbGVuZGFyJztcclxuICAgIFxyXG4gICAgLyogR2V0dGluZyBlbGVtZW50cyAqL1xyXG4gICAgdGhpcy4kYWN0aXZpdHkgPSAkYWN0aXZpdHk7XHJcbiAgICB0aGlzLiRhcHBvaW50bWVudFZpZXcgPSAkYWN0aXZpdHkuZmluZCgnI2NhbGVuZGFyQXBwb2ludG1lbnRWaWV3Jyk7XHJcbiAgICB0aGlzLiRjaG9vc2VOZXcgPSAkKCcjY2FsZW5kYXJDaG9vc2VOZXcnKTtcclxuICAgIHRoaXMuYXBwID0gYXBwO1xyXG4gICAgXHJcbiAgICAvLyBPYmplY3QgdG8gaG9sZCB0aGUgb3B0aW9ucyBwYXNzZWQgb24gJ3Nob3cnIGFzIGEgcmVzdWx0XHJcbiAgICAvLyBvZiBhIHJlcXVlc3QgZnJvbSBhbm90aGVyIGFjdGl2aXR5XHJcbiAgICB0aGlzLnJlcXVlc3RJbmZvID0gbnVsbDtcclxuICAgIFxyXG4gICAgLy8gQ3JlYXRlIGEgc3BlY2lmaWMgYmFja0FjdGlvbiB0aGF0IHNob3dzIGN1cnJlbnQgZGF0ZVxyXG4gICAgLy8gYW5kIHJldHVybiB0byBjYWxlbmRhciBpbiBjdXJyZW50IGRhdGUuXHJcbiAgICAvLyBMYXRlciBzb21lIG1vcmUgY2hhbmdlcyBhcmUgYXBwbGllZCwgd2l0aCB2aWV3bW9kZWwgcmVhZHlcclxuICAgIHZhciBiYWNrQWN0aW9uID0gbmV3IE5hdkFjdGlvbih7XHJcbiAgICAgICAgbGluazogJ2NhbGVuZGFyLycsIC8vIFByZXNlcnZlIGxhc3Qgc2xhc2gsIGZvciBsYXRlciB1c2VcclxuICAgICAgICBpY29uOiBOYXZBY3Rpb24uZ29CYWNrLmljb24oKSxcclxuICAgICAgICBpc1RpdGxlOiB0cnVlLFxyXG4gICAgICAgIHRleHQ6ICdDYWxlbmRhcidcclxuICAgIH0pO1xyXG4gICAgdGhpcy5uYXZCYXIgPSBuZXcgTmF2QmFyKHtcclxuICAgICAgICB0aXRsZTogJycsXHJcbiAgICAgICAgbGVmdEFjdGlvbjogYmFja0FjdGlvbixcclxuICAgICAgICByaWdodEFjdGlvbjogTmF2QWN0aW9uLmdvSGVscEluZGV4XHJcbiAgICB9KTtcclxuICAgIFxyXG4gICAgdGhpcy5pbml0QXBwb2ludG1lbnQoKTtcclxuICAgIFxyXG4gICAgLy8gVGhpcyB0aXRsZSB0ZXh0IGlzIGR5bmFtaWMsIHdlIG5lZWQgdG8gcmVwbGFjZSBpdCBieSBhIGNvbXB1dGVkIG9ic2VydmFibGVcclxuICAgIC8vIHNob3dpbmcgdGhlIGN1cnJlbnQgZGF0ZVxyXG4gICAgdmFyIGRlZkJhY2tUZXh0ID0gYmFja0FjdGlvbi50ZXh0Ll9pbml0aWFsVmFsdWU7XHJcbiAgICBiYWNrQWN0aW9uLnRleHQgPSBrby5jb21wdXRlZChmdW5jdGlvbigpIHtcclxuXHJcbiAgICAgICAgdmFyIGQgPSB0aGlzLmFwcG9pbnRtZW50c0RhdGFWaWV3LmN1cnJlbnREYXRlKCk7XHJcbiAgICAgICAgaWYgKCFkKVxyXG4gICAgICAgICAgICAvLyBGYWxsYmFjayB0byB0aGUgZGVmYXVsdCB0aXRsZVxyXG4gICAgICAgICAgICByZXR1cm4gZGVmQmFja1RleHQ7XHJcblxyXG4gICAgICAgIHZhciBtID0gbW9tZW50KGQpO1xyXG4gICAgICAgIHZhciB0ID0gbS5mb3JtYXQoJ2RkZGQgWyhdTS9EWyldJyk7XHJcbiAgICAgICAgcmV0dXJuIHQ7XHJcbiAgICB9LCB0aGlzKTtcclxuICAgIC8vIEFuZCB0aGUgbGluayBpcyBkeW5hbWljIHRvbywgdG8gYWxsb3cgcmV0dXJuIHRvIHRoZSBkYXRlXHJcbiAgICAvLyB0aGF0IG1hdGNoZXMgY3VycmVudCBhcHBvaW50bWVudFxyXG4gICAgdmFyIGRlZkxpbmsgPSBiYWNrQWN0aW9uLmxpbmsuX2luaXRpYWxWYWx1ZTtcclxuICAgIGJhY2tBY3Rpb24ubGluayA9IGtvLmNvbXB1dGVkKGZ1bmN0aW9uKCkge1xyXG5cclxuICAgICAgICB2YXIgZCA9IHRoaXMuYXBwb2ludG1lbnRzRGF0YVZpZXcuY3VycmVudERhdGUoKTtcclxuICAgICAgICBpZiAoIWQpXHJcbiAgICAgICAgICAgIC8vIEZhbGxiYWNrIHRvIHRoZSBkZWZhdWx0IGxpbmtcclxuICAgICAgICAgICAgcmV0dXJuIGRlZkxpbms7XHJcblxyXG4gICAgICAgIHJldHVybiBkZWZMaW5rICsgZC50b0lTT1N0cmluZygpO1xyXG4gICAgfSwgdGhpcyk7XHJcbiAgICBcclxuICAgIHRoaXMuYXBwb2ludG1lbnRzRGF0YVZpZXcuY3VycmVudEFwcG9pbnRtZW50LnN1YnNjcmliZShmdW5jdGlvbiAoYXB0KSB7XHJcbiAgICAgICAgLy8gVXBkYXRlIFVSTCB0byBtYXRjaCB0aGUgYXBwb2ludG1lbnQgSUQgYW5kXHJcbiAgICAgICAgLy8gdHJhY2sgaXQgc3RhdGVcclxuICAgICAgICAvLyBHZXQgSUQgZnJvbSBVUkwsIHRvIGF2b2lkIGRvIGFueXRoaW5nIGlmIHRoZSBzYW1lLlxyXG4gICAgICAgIHZhciBhcHRJZCA9IGFwdC5pZCgpO1xyXG4gICAgICAgIHZhciB1cmxJZCA9IC9hcHBvaW50bWVudFxcLyhcXGQrKS9pLnRlc3Qod2luZG93LmxvY2F0aW9uKTtcclxuICAgICAgICB1cmxJZCA9IHVybElkICYmIHVybElkWzFdIHx8ICcnO1xyXG4gICAgICAgIGlmICh1cmxJZCAhPT0gJzAnICYmIGFwdElkICE9PSBudWxsICYmIHVybElkICE9PSBhcHRJZC50b1N0cmluZygpKSB7XHJcbiAgICAgICAgICAgIC8vIFRPRE86IHNhdmUgYSB1c2VmdWwgc3RhdGVcclxuICAgICAgICAgICAgYXBwLnNoZWxsLmhpc3RvcnkucHVzaFN0YXRlKG51bGwsIG51bGwsICdhcHBvaW50bWVudC8nICsgYXB0SWQpO1xyXG4gICAgICAgIH1cclxuICAgIH0pO1xyXG59XHJcblxyXG5BcHBvaW50bWVudEFjdGl2aXR5LnByb3RvdHlwZS5zaG93ID0gZnVuY3Rpb24gc2hvdyhvcHRpb25zKSB7XHJcbiAgICAvKiBqc2hpbnQgbWF4Y29tcGxleGl0eToxMCAqL1xyXG4gICAgdGhpcy5yZXF1ZXN0SW5mbyA9IG9wdGlvbnMgfHwge307XHJcbiAgICBcclxuICAgIC8vIElmIHRoZXJlIGFyZSBvcHRpb25zICh0aGVyZSBhcmUgbm90IG9uIHN0YXJ0dXAgb3JcclxuICAgIC8vIG9uIGNhbmNlbGxlZCBlZGl0aW9uKS5cclxuICAgIC8vIEFuZCBpdCBjb21lcyBiYWNrIGZyb20gdGhlIHRleHRFZGl0b3IuXHJcbiAgICBpZiAob3B0aW9ucyAhPT0gbnVsbCkge1xyXG5cclxuICAgICAgICB2YXIgYm9va2luZyA9IHRoaXMuYXBwb2ludG1lbnRzRGF0YVZpZXcuY3VycmVudEFwcG9pbnRtZW50KCk7XHJcblxyXG4gICAgICAgIGlmIChvcHRpb25zLnJlcXVlc3QgPT09ICd0ZXh0RWRpdG9yJyAmJiBib29raW5nKSB7XHJcblxyXG4gICAgICAgICAgICBib29raW5nW29wdGlvbnMuZmllbGRdKG9wdGlvbnMudGV4dCk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGVsc2UgaWYgKG9wdGlvbnMuc2VsZWN0Q2xpZW50ID09PSB0cnVlICYmIGJvb2tpbmcpIHtcclxuXHJcbiAgICAgICAgICAgIGJvb2tpbmcuY2xpZW50KG9wdGlvbnMuc2VsZWN0ZWRDbGllbnQpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBlbHNlIGlmICh0eXBlb2Yob3B0aW9ucy5zZWxlY3RlZERhdGV0aW1lKSAhPT0gJ3VuZGVmaW5lZCcgJiYgYm9va2luZykge1xyXG5cclxuICAgICAgICAgICAgYm9va2luZy5zdGFydFRpbWUob3B0aW9ucy5zZWxlY3RlZERhdGV0aW1lKTtcclxuICAgICAgICAgICAgLy8gVE9ETyBDYWxjdWxhdGUgdGhlIGVuZFRpbWUgZ2l2ZW4gYW4gYXBwb2ludG1lbnQgZHVyYXRpb24sIHJldHJpZXZlZCBmcm9tIHRoZVxyXG4gICAgICAgICAgICAvLyBzZWxlY3RlZCBzZXJ2aWNlXHJcbiAgICAgICAgICAgIC8vdmFyIGR1cmF0aW9uID0gYm9va2luZy5wcmljaW5nICYmIGJvb2tpbmcucHJpY2luZy5kdXJhdGlvbjtcclxuICAgICAgICAgICAgLy8gT3IgYnkgZGVmYXVsdCAoaWYgbm8gcHJpY2luZyBzZWxlY3RlZCBvciBhbnkpIHRoZSB1c2VyIHByZWZlcnJlZFxyXG4gICAgICAgICAgICAvLyB0aW1lIGdhcFxyXG4gICAgICAgICAgICAvL2R1cmF0aW9uID0gZHVyYXRpb24gfHwgdXNlci5wcmVmZXJlbmNlcy50aW1lU2xvdHNHYXA7XHJcbiAgICAgICAgICAgIC8vIFBST1RPVFlQRTpcclxuICAgICAgICAgICAgdmFyIGR1cmF0aW9uID0gNjA7IC8vIG1pbnV0ZXNcclxuICAgICAgICAgICAgYm9va2luZy5lbmRUaW1lKG1vbWVudChib29raW5nLnN0YXJ0VGltZSgpKS5hZGQoZHVyYXRpb24sICdtaW51dGVzJykudG9EYXRlKCkpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBlbHNlIGlmIChvcHRpb25zLnNlbGVjdFNlcnZpY2VzID09PSB0cnVlICYmIGJvb2tpbmcpIHtcclxuXHJcbiAgICAgICAgICAgIGJvb2tpbmcuc2VydmljZXMob3B0aW9ucy5zZWxlY3RlZFNlcnZpY2VzKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgZWxzZSBpZiAob3B0aW9ucy5zZWxlY3RMb2NhdGlvbiA9PT0gdHJ1ZSAmJiBib29raW5nKSB7XHJcblxyXG4gICAgICAgICAgICBib29raW5nLmxvY2F0aW9uKG9wdGlvbnMuc2VsZWN0ZWRMb2NhdGlvbik7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG4gICAgXHJcbiAgICB2YXIgYXB0SWQgPSBvcHRpb25zICYmIG9wdGlvbnMucm91dGUgJiYgb3B0aW9ucy5yb3V0ZS5zZWdtZW50c1swXTtcclxuICAgIGFwdElkID0gcGFyc2VJbnQoYXB0SWQsIDEwKTtcclxuICAgIGFwdElkID0gYXB0SWQgfHwgMDtcclxuICAgIHRoaXMuc2hvd0FwcG9pbnRtZW50KGFwdElkKTtcclxufTtcclxuXHJcbnZhciBBcHBvaW50bWVudCA9IHJlcXVpcmUoJy4uL21vZGVscy9BcHBvaW50bWVudCcpO1xyXG5cclxuQXBwb2ludG1lbnRBY3Rpdml0eS5wcm90b3R5cGUuc2hvd0FwcG9pbnRtZW50ID0gZnVuY3Rpb24gc2hvd0FwcG9pbnRtZW50KGFwdElkKSB7XHJcbiAgICAvKmpzaGludCBtYXhzdGF0ZW1lbnRzOjM2Ki9cclxuXHJcbiAgICBpZiAoYXB0SWQpIHtcclxuICAgICAgICAvLyBUT0RPOiBzZWxlY3QgYXBwb2ludG1lbnQgJ2FwdElkJ1xyXG4gICAgICAgIFxyXG5cclxuICAgIH0gZWxzZSBpZiAoYXB0SWQgPT09IDApIHtcclxuICAgICAgICB0aGlzLmFwcG9pbnRtZW50c0RhdGFWaWV3Lm5ld0FwcG9pbnRtZW50KG5ldyBBcHBvaW50bWVudCgpKTtcclxuICAgICAgICB0aGlzLmFwcG9pbnRtZW50c0RhdGFWaWV3LmVkaXRNb2RlKHRydWUpOyAgICAgICAgXHJcbiAgICB9XHJcbn07XHJcblxyXG5BcHBvaW50bWVudEFjdGl2aXR5LnByb3RvdHlwZS5pbml0QXBwb2ludG1lbnQgPSBmdW5jdGlvbiBpbml0QXBwb2ludG1lbnQoKSB7XHJcbiAgICBpZiAoIXRoaXMuX19pbml0ZWRBcHBvaW50bWVudCkge1xyXG4gICAgICAgIHRoaXMuX19pbml0ZWRBcHBvaW50bWVudCA9IHRydWU7XHJcblxyXG4gICAgICAgIHZhciBhcHAgPSB0aGlzLmFwcDtcclxuICAgICAgICBcclxuICAgICAgICAvLyBEYXRhXHJcbiAgICAgICAgdmFyIHRlc3REYXRhID0gcmVxdWlyZSgnLi4vdGVzdGRhdGEvY2FsZW5kYXJBcHBvaW50bWVudHMnKS5hcHBvaW50bWVudHM7XHJcbiAgICAgICAgdmFyIGFwcG9pbnRtZW50c0RhdGFWaWV3ID0ge1xyXG4gICAgICAgICAgICBhcHBvaW50bWVudHM6IGtvLm9ic2VydmFibGVBcnJheSh0ZXN0RGF0YSksXHJcbiAgICAgICAgICAgIGN1cnJlbnRJbmRleDoga28ub2JzZXJ2YWJsZSgwKSxcclxuICAgICAgICAgICAgZWRpdE1vZGU6IGtvLm9ic2VydmFibGUoZmFsc2UpLFxyXG4gICAgICAgICAgICBuZXdBcHBvaW50bWVudDoga28ub2JzZXJ2YWJsZShudWxsKVxyXG4gICAgICAgIH07XHJcbiAgICAgICAgXHJcbiAgICAgICAgdGhpcy5hcHBvaW50bWVudHNEYXRhVmlldyA9IGFwcG9pbnRtZW50c0RhdGFWaWV3O1xyXG4gICAgICAgIFxyXG4gICAgICAgIGFwcG9pbnRtZW50c0RhdGFWaWV3LmlzTmV3ID0ga28uY29tcHV0ZWQoZnVuY3Rpb24oKXtcclxuICAgICAgICAgICAgcmV0dXJuIHRoaXMubmV3QXBwb2ludG1lbnQoKSAhPT0gbnVsbDtcclxuICAgICAgICB9LCBhcHBvaW50bWVudHNEYXRhVmlldyk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgYXBwb2ludG1lbnRzRGF0YVZpZXcuY3VycmVudEFwcG9pbnRtZW50ID0ga28uY29tcHV0ZWQoe1xyXG4gICAgICAgICAgICByZWFkOiBmdW5jdGlvbigpIHtcclxuICAgICAgICAgICAgICAgIGlmICh0aGlzLmlzTmV3KCkpIHtcclxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5uZXdBcHBvaW50bWVudCgpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgZWxzZSB7XHJcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMuYXBwb2ludG1lbnRzKClbdGhpcy5jdXJyZW50SW5kZXgoKSAlIHRoaXMuYXBwb2ludG1lbnRzKCkubGVuZ3RoXTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgd3JpdGU6IGZ1bmN0aW9uKGFwdCkge1xyXG4gICAgICAgICAgICAgICAgdmFyIGluZGV4ID0gdGhpcy5jdXJyZW50SW5kZXgoKSAlIHRoaXMuYXBwb2ludG1lbnRzKCkubGVuZ3RoO1xyXG4gICAgICAgICAgICAgICAgdGhpcy5hcHBvaW50bWVudHMoKVtpbmRleF0gPSBhcHQ7XHJcbiAgICAgICAgICAgICAgICB0aGlzLmFwcG9pbnRtZW50cy52YWx1ZUhhc011dGF0ZWQoKTtcclxuICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgb3duZXI6IGFwcG9pbnRtZW50c0RhdGFWaWV3XHJcbiAgICAgICAgfSk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgYXBwb2ludG1lbnRzRGF0YVZpZXcub3JpZ2luYWxFZGl0ZWRBcHBvaW50bWVudCA9IHt9O1xyXG4gXHJcbiAgICAgICAgYXBwb2ludG1lbnRzRGF0YVZpZXcuZ29QcmV2aW91cyA9IGZ1bmN0aW9uIGdvUHJldmlvdXMoKSB7XHJcbiAgICAgICAgICAgIGlmICh0aGlzLmVkaXRNb2RlKCkpIHJldHVybjtcclxuICAgICAgICBcclxuICAgICAgICAgICAgaWYgKHRoaXMuY3VycmVudEluZGV4KCkgPT09IDApXHJcbiAgICAgICAgICAgICAgICB0aGlzLmN1cnJlbnRJbmRleCh0aGlzLmFwcG9pbnRtZW50cygpLmxlbmd0aCAtIDEpO1xyXG4gICAgICAgICAgICBlbHNlXHJcbiAgICAgICAgICAgICAgICB0aGlzLmN1cnJlbnRJbmRleCgodGhpcy5jdXJyZW50SW5kZXgoKSAtIDEpICUgdGhpcy5hcHBvaW50bWVudHMoKS5sZW5ndGgpO1xyXG4gICAgICAgIH07XHJcbiAgICAgICAgXHJcbiAgICAgICAgYXBwb2ludG1lbnRzRGF0YVZpZXcuZ29OZXh0ID0gZnVuY3Rpb24gZ29OZXh0KCkge1xyXG4gICAgICAgICAgICBpZiAodGhpcy5lZGl0TW9kZSgpKSByZXR1cm47XHJcblxyXG4gICAgICAgICAgICB0aGlzLmN1cnJlbnRJbmRleCgodGhpcy5jdXJyZW50SW5kZXgoKSArIDEpICUgdGhpcy5hcHBvaW50bWVudHMoKS5sZW5ndGgpO1xyXG4gICAgICAgIH07XHJcblxyXG4gICAgICAgIGFwcG9pbnRtZW50c0RhdGFWaWV3LmVkaXQgPSBmdW5jdGlvbiBlZGl0KCkge1xyXG4gICAgICAgICAgICB0aGlzLmVkaXRNb2RlKHRydWUpO1xyXG4gICAgICAgIH0uYmluZChhcHBvaW50bWVudHNEYXRhVmlldyk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgYXBwb2ludG1lbnRzRGF0YVZpZXcuY2FuY2VsID0gZnVuY3Rpb24gY2FuY2VsKCkge1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgLy8gaWYgaXMgbmV3LCBkaXNjYXJkXHJcbiAgICAgICAgICAgIGlmICh0aGlzLmlzTmV3KCkpIHtcclxuICAgICAgICAgICAgICAgIHRoaXMubmV3QXBwb2ludG1lbnQobnVsbCk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgZWxzZSB7XHJcbiAgICAgICAgICAgICAgICAvLyByZXZlcnQgY2hhbmdlc1xyXG4gICAgICAgICAgICAgICAgdGhpcy5jdXJyZW50QXBwb2ludG1lbnQobmV3IEFwcG9pbnRtZW50KHRoaXMub3JpZ2luYWxFZGl0ZWRBcHBvaW50bWVudCkpO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICB0aGlzLmVkaXRNb2RlKGZhbHNlKTtcclxuICAgICAgICB9LmJpbmQoYXBwb2ludG1lbnRzRGF0YVZpZXcpO1xyXG4gICAgICAgIFxyXG4gICAgICAgIGFwcG9pbnRtZW50c0RhdGFWaWV3LnNhdmUgPSBmdW5jdGlvbiBzYXZlKCkge1xyXG4gICAgICAgICAgICAvLyBJZiBpcyBhIG5ldyBvbmUsIGFkZCBpdCB0byB0aGUgY29sbGVjdGlvblxyXG4gICAgICAgICAgICBpZiAodGhpcy5pc05ldygpKSB7XHJcbiAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgICAgIHZhciBuZXdBcHQgPSB0aGlzLm5ld0FwcG9pbnRtZW50KCk7XHJcbiAgICAgICAgICAgICAgICAvLyBUT0RPOiBzb21lIGZpZWRzIG5lZWQgc29tZSBraW5kIG9mIGNhbGN1bGF0aW9uIHRoYXQgaXMgcGVyc2lzdGVkXHJcbiAgICAgICAgICAgICAgICAvLyBzb24gY2Fubm90IGJlIGNvbXB1dGVkLiBTaW11bGF0ZWQ6XHJcbiAgICAgICAgICAgICAgICBuZXdBcHQuc3VtbWFyeSgnTWFzc2FnZSBUaGVyYXBpc3QgQm9va2luZycpO1xyXG4gICAgICAgICAgICAgICAgbmV3QXB0LmlkKDQpO1xyXG4gICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICAgICAvLyBBZGQgdG8gdGhlIGxpc3Q6XHJcbiAgICAgICAgICAgICAgICB0aGlzLmFwcG9pbnRtZW50cy5wdXNoKG5ld0FwdCk7XHJcbiAgICAgICAgICAgICAgICAvLyBub3csIHJlc2V0XHJcbiAgICAgICAgICAgICAgICB0aGlzLm5ld0FwcG9pbnRtZW50KG51bGwpO1xyXG4gICAgICAgICAgICAgICAgLy8gY3VycmVudCBpbmRleCBtdXN0IGJlIHRoZSBqdXN0LWFkZGVkIGFwdFxyXG4gICAgICAgICAgICAgICAgdGhpcy5jdXJyZW50SW5kZXgodGhpcy5hcHBvaW50bWVudHMoKS5sZW5ndGggLSAxKTtcclxuICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgLy8gT24gYWRkaW5nIGEgbmV3IG9uZSwgdGhlIGNvbmZpcm1hdGlvbiBwYWdlIG11c3QgYmUgc2hvd2VkXHJcbiAgICAgICAgICAgICAgICBhcHAuc2hlbGwuZ28oJ2Jvb2tpbmdDb25maXJtYXRpb24nLCB7XHJcbiAgICAgICAgICAgICAgICAgICAgYm9va2luZzogbmV3QXB0XHJcbiAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgdGhpcy5lZGl0TW9kZShmYWxzZSk7XHJcbiAgICAgICAgfS5iaW5kKGFwcG9pbnRtZW50c0RhdGFWaWV3KTtcclxuICAgICAgICBcclxuICAgICAgICBhcHBvaW50bWVudHNEYXRhVmlldy5lZGl0TW9kZS5zdWJzY3JpYmUoZnVuY3Rpb24oaXNFZGl0KSB7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICB0aGlzLiRhY3Rpdml0eS50b2dnbGVDbGFzcygnaW4tZWRpdCcsIGlzRWRpdCk7XHJcbiAgICAgICAgICAgIHRoaXMuJGFwcG9pbnRtZW50Vmlldy5maW5kKCcuQXBwb2ludG1lbnRDYXJkJykudG9nZ2xlQ2xhc3MoJ2luLWVkaXQnLCBpc0VkaXQpO1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgaWYgKGlzRWRpdCkge1xyXG4gICAgICAgICAgICAgICAgLy8gQ3JlYXRlIGEgY29weSBvZiB0aGUgYXBwb2ludG1lbnQgc28gd2UgcmV2ZXJ0IG9uICdjYW5jZWwnXHJcbiAgICAgICAgICAgICAgICBhcHBvaW50bWVudHNEYXRhVmlldy5vcmlnaW5hbEVkaXRlZEFwcG9pbnRtZW50ID0gXHJcbiAgICAgICAgICAgICAgICAgICAga28udG9KUyhhcHBvaW50bWVudHNEYXRhVmlldy5jdXJyZW50QXBwb2ludG1lbnQoKSk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgXHJcbiAgICAgICAgfS5iaW5kKHRoaXMpKTtcclxuICAgICAgICBcclxuICAgICAgICBhcHBvaW50bWVudHNEYXRhVmlldy5waWNrRGF0ZVRpbWUgPSBmdW5jdGlvbiBwaWNrRGF0ZVRpbWUoKSB7XHJcblxyXG4gICAgICAgICAgICBhcHAuc2hlbGwuZ28oJ2RhdGV0aW1lUGlja2VyJywge1xyXG4gICAgICAgICAgICAgICAgc2VsZWN0ZWREYXRldGltZTogbnVsbFxyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICB9O1xyXG4gICAgICAgIFxyXG4gICAgICAgIGFwcG9pbnRtZW50c0RhdGFWaWV3LnBpY2tDbGllbnQgPSBmdW5jdGlvbiBwaWNrQ2xpZW50KCkge1xyXG5cclxuICAgICAgICAgICAgYXBwLnNoZWxsLmdvKCdjbGllbnRzJywge1xyXG4gICAgICAgICAgICAgICAgc2VsZWN0Q2xpZW50OiB0cnVlLFxyXG4gICAgICAgICAgICAgICAgc2VsZWN0ZWRDbGllbnQ6IG51bGxcclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgfTtcclxuXHJcbiAgICAgICAgYXBwb2ludG1lbnRzRGF0YVZpZXcucGlja1NlcnZpY2UgPSBmdW5jdGlvbiBwaWNrU2VydmljZSgpIHtcclxuXHJcbiAgICAgICAgICAgIGFwcC5zaGVsbC5nbygnc2VydmljZXMnLCB7XHJcbiAgICAgICAgICAgICAgICBzZWxlY3RTZXJ2aWNlczogdHJ1ZSxcclxuICAgICAgICAgICAgICAgIHNlbGVjdGVkU2VydmljZXM6IGFwcG9pbnRtZW50c0RhdGFWaWV3LmN1cnJlbnRBcHBvaW50bWVudCgpLnNlcnZpY2VzKClcclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgfTtcclxuXHJcbiAgICAgICAgYXBwb2ludG1lbnRzRGF0YVZpZXcuY2hhbmdlUHJpY2UgPSBmdW5jdGlvbiBjaGFuZ2VQcmljZSgpIHtcclxuICAgICAgICAgICAgLy8gVE9ET1xyXG4gICAgICAgIH07XHJcbiAgICAgICAgXHJcbiAgICAgICAgYXBwb2ludG1lbnRzRGF0YVZpZXcucGlja0xvY2F0aW9uID0gZnVuY3Rpb24gcGlja0xvY2F0aW9uKCkge1xyXG5cclxuICAgICAgICAgICAgYXBwLnNoZWxsLmdvKCdsb2NhdGlvbnMnLCB7XHJcbiAgICAgICAgICAgICAgICBzZWxlY3RMb2NhdGlvbjogdHJ1ZSxcclxuICAgICAgICAgICAgICAgIHNlbGVjdGVkTG9jYXRpb246IGFwcG9pbnRtZW50c0RhdGFWaWV3LmN1cnJlbnRBcHBvaW50bWVudCgpLmxvY2F0aW9uKClcclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgfTtcclxuXHJcbiAgICAgICAgdmFyIHRleHRGaWVsZHNIZWFkZXJzID0ge1xyXG4gICAgICAgICAgICBwcmVOb3Rlc1RvQ2xpZW50OiAnTm90ZXMgdG8gY2xpZW50JyxcclxuICAgICAgICAgICAgcG9zdE5vdGVzVG9DbGllbnQ6ICdOb3RlcyB0byBjbGllbnQgKGFmdGVyd2FyZHMpJyxcclxuICAgICAgICAgICAgcHJlTm90ZXNUb1NlbGY6ICdOb3RlcyB0byBzZWxmJyxcclxuICAgICAgICAgICAgcG9zdE5vdGVzVG9TZWxmOiAnQm9va2luZyBzdW1tYXJ5J1xyXG4gICAgICAgIH07XHJcbiAgICAgICAgXHJcbiAgICAgICAgYXBwb2ludG1lbnRzRGF0YVZpZXcuZWRpdFRleHRGaWVsZCA9IGZ1bmN0aW9uIGVkaXRUZXh0RmllbGQoZmllbGQpIHtcclxuXHJcbiAgICAgICAgICAgIGFwcC5zaGVsbC5nbygndGV4dEVkaXRvcicsIHtcclxuICAgICAgICAgICAgICAgIHJlcXVlc3Q6ICd0ZXh0RWRpdG9yJyxcclxuICAgICAgICAgICAgICAgIGZpZWxkOiBmaWVsZCxcclxuICAgICAgICAgICAgICAgIHRpdGxlOiBhcHBvaW50bWVudHNEYXRhVmlldy5pc05ldygpID8gJ05ldyBib29raW5nJyA6ICdCb29raW5nJyxcclxuICAgICAgICAgICAgICAgIGhlYWRlcjogdGV4dEZpZWxkc0hlYWRlcnNbZmllbGRdLFxyXG4gICAgICAgICAgICAgICAgdGV4dDogYXBwb2ludG1lbnRzRGF0YVZpZXcuY3VycmVudEFwcG9pbnRtZW50KClbZmllbGRdKClcclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgfS5iaW5kKHRoaXMpO1xyXG4gICAgICAgIFxyXG4gICAgICAgIGFwcG9pbnRtZW50c0RhdGFWaWV3LmN1cnJlbnREYXRlID0ga28uY29tcHV0ZWQoZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICB2YXIgYXB0ID0gdGhpcy5jdXJyZW50QXBwb2ludG1lbnQoKSxcclxuICAgICAgICAgICAgICAgIGp1c3REYXRlID0gbnVsbDtcclxuXHJcbiAgICAgICAgICAgIGlmIChhcHQgJiYgYXB0LnN0YXJ0VGltZSgpKVxyXG4gICAgICAgICAgICAgICAganVzdERhdGUgPSBtb21lbnQoYXB0LnN0YXJ0VGltZSgpKS5ob3VycygwKS5taW51dGVzKDApLnNlY29uZHMoMCkudG9EYXRlKCk7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICByZXR1cm4ganVzdERhdGU7XHJcbiAgICAgICAgfSwgYXBwb2ludG1lbnRzRGF0YVZpZXcpO1xyXG4gICAgICAgIFxyXG4gICAgICAgIGtvLmFwcGx5QmluZGluZ3MoYXBwb2ludG1lbnRzRGF0YVZpZXcsIHRoaXMuJGFjdGl2aXR5LmdldCgwKSk7XHJcbiAgICB9XHJcbn07XHJcbiIsIi8qKlxyXG4gICAgYm9va2luZ0NvbmZpcm1hdGlvbiBhY3Rpdml0eVxyXG4qKi9cclxuJ3VzZSBzdHJpY3QnO1xyXG5cclxudmFyICQgPSByZXF1aXJlKCdqcXVlcnknKSxcclxuICAgIGtvID0gcmVxdWlyZSgna25vY2tvdXQnKTtcclxuICAgIFxyXG52YXIgc2luZ2xldG9uID0gbnVsbDtcclxuXHJcbmV4cG9ydHMuaW5pdCA9IGZ1bmN0aW9uIGluaXRDbGllbnRzKCRhY3Rpdml0eSwgYXBwKSB7XHJcblxyXG4gICAgaWYgKHNpbmdsZXRvbiA9PT0gbnVsbClcclxuICAgICAgICBzaW5nbGV0b24gPSBuZXcgQm9va2luZ0NvbmZpcm1hdGlvbkFjdGl2aXR5KCRhY3Rpdml0eSwgYXBwKTtcclxuICAgIFxyXG4gICAgcmV0dXJuIHNpbmdsZXRvbjtcclxufTtcclxuXHJcbmZ1bmN0aW9uIEJvb2tpbmdDb25maXJtYXRpb25BY3Rpdml0eSgkYWN0aXZpdHksIGFwcCkge1xyXG5cclxuICAgIHRoaXMuYWNjZXNzTGV2ZWwgPSBhcHAuVXNlclR5cGUuTG9nZ2VkVXNlcjtcclxuICAgIFxyXG4gICAgdGhpcy4kYWN0aXZpdHkgPSAkYWN0aXZpdHk7XHJcbiAgICB0aGlzLmFwcCA9IGFwcDtcclxuXHJcbiAgICB0aGlzLmRhdGFWaWV3ID0gbmV3IFZpZXdNb2RlbCgpO1xyXG4gICAga28uYXBwbHlCaW5kaW5ncyh0aGlzLmRhdGFWaWV3LCAkYWN0aXZpdHkuZ2V0KDApKTtcclxufVxyXG5cclxuQm9va2luZ0NvbmZpcm1hdGlvbkFjdGl2aXR5LnByb3RvdHlwZS5zaG93ID0gZnVuY3Rpb24gc2hvdyhvcHRpb25zKSB7XHJcblxyXG4gICAgaWYgKG9wdGlvbnMgJiYgb3B0aW9ucy5ib29raW5nKVxyXG4gICAgICAgIHRoaXMuZGF0YVZpZXcuYm9va2luZyhvcHRpb25zLmJvb2tpbmcpO1xyXG59O1xyXG5cclxuZnVuY3Rpb24gVmlld01vZGVsKCkge1xyXG5cclxuICAgIC8vIDpBcHBvaW50bWVudFxyXG4gICAgdGhpcy5ib29raW5nID0ga28ub2JzZXJ2YWJsZShudWxsKTtcclxufVxyXG4iLCIvKiogQ2FsZW5kYXIgYWN0aXZpdHkgKiovXHJcbid1c2Ugc3RyaWN0JztcclxuXHJcbnZhciAkID0gcmVxdWlyZSgnanF1ZXJ5JyksXHJcbiAgICBtb21lbnQgPSByZXF1aXJlKCdtb21lbnQnKTtcclxucmVxdWlyZSgnLi4vY29tcG9uZW50cy9EYXRlUGlja2VyJyk7XHJcbnZhciBrbyA9IHJlcXVpcmUoJ2tub2Nrb3V0Jyk7XHJcbnZhciBDYWxlbmRhclNsb3QgPSByZXF1aXJlKCcuLi9tb2RlbHMvQ2FsZW5kYXJTbG90JyksXHJcbiAgICBOYXZCYXIgPSByZXF1aXJlKCcuLi92aWV3bW9kZWxzL05hdkJhcicpLFxyXG4gICAgTmF2QWN0aW9uID0gcmVxdWlyZSgnLi4vdmlld21vZGVscy9OYXZBY3Rpb24nKTtcclxuXHJcbnZhciBzaW5nbGV0b24gPSBudWxsO1xyXG5cclxuZXhwb3J0cy5pbml0ID0gZnVuY3Rpb24gaW5pdENhbGVuZGFyKCRhY3Rpdml0eSwgYXBwKSB7XHJcblxyXG4gICAgaWYgKHNpbmdsZXRvbiA9PT0gbnVsbClcclxuICAgICAgICBzaW5nbGV0b24gPSBuZXcgQ2FsZW5kYXJBY3Rpdml0eSgkYWN0aXZpdHksIGFwcCk7XHJcbiAgICBcclxuICAgIHJldHVybiBzaW5nbGV0b247XHJcbn07XHJcblxyXG5mdW5jdGlvbiBDYWxlbmRhckFjdGl2aXR5KCRhY3Rpdml0eSwgYXBwKSB7XHJcblxyXG4gICAgdGhpcy5hY2Nlc3NMZXZlbCA9IGFwcC5Vc2VyVHlwZS5Mb2dnZWRVc2VyO1xyXG4gICAgdGhpcy5uYXZCYXIgPSBuZXcgTmF2QmFyKHtcclxuICAgICAgICB0aXRsZTogJ0NhbGVuZGFyJyxcclxuICAgICAgICBsZWZ0QWN0aW9uOiBOYXZBY3Rpb24ubWVudU5ld0l0ZW0sXHJcbiAgICAgICAgcmlnaHRBY3Rpb246IE5hdkFjdGlvbi5tZW51SW5cclxuICAgIH0pO1xyXG4gICAgXHJcbiAgICAvKiBHZXR0aW5nIGVsZW1lbnRzICovXHJcbiAgICB0aGlzLiRhY3Rpdml0eSA9ICRhY3Rpdml0eTtcclxuICAgIHRoaXMuJGRhdGVwaWNrZXIgPSAkYWN0aXZpdHkuZmluZCgnI2NhbGVuZGFyRGF0ZVBpY2tlcicpO1xyXG4gICAgdGhpcy4kZGFpbHlWaWV3ID0gJGFjdGl2aXR5LmZpbmQoJyNjYWxlbmRhckRhaWx5VmlldycpO1xyXG4gICAgdGhpcy4kZGF0ZUhlYWRlciA9ICRhY3Rpdml0eS5maW5kKCcjY2FsZW5kYXJEYXRlSGVhZGVyJyk7XHJcbiAgICB0aGlzLiRkYXRlVGl0bGUgPSB0aGlzLiRkYXRlSGVhZGVyLmNoaWxkcmVuKCcuQ2FsZW5kYXJEYXRlSGVhZGVyLWRhdGUnKTtcclxuICAgIHRoaXMuJGNob29zZU5ldyA9ICQoJyNjYWxlbmRhckNob29zZU5ldycpO1xyXG4gICAgdGhpcy5hcHAgPSBhcHA7XHJcbiAgICBcclxuICAgIC8qIEluaXQgY29tcG9uZW50cyAqL1xyXG4gICAgdGhpcy4kZGF0ZXBpY2tlci5zaG93KCkuZGF0ZXBpY2tlcigpO1xyXG5cclxuICAgIC8vIERhdGFcclxuICAgIHRoaXMuZGF0YVZpZXcgPSBuZXcgVmlld01vZGVsKCk7XHJcbiAgICBrby5hcHBseUJpbmRpbmdzKHRoaXMuZGF0YVZpZXcsICRhY3Rpdml0eS5nZXQoMCkpO1xyXG5cclxuICAgIC8vIFRlc3RpbmcgZGF0YVxyXG4gICAgdGhpcy5kYXRhVmlldy5zbG90c0RhdGEocmVxdWlyZSgnLi4vdGVzdGRhdGEvY2FsZW5kYXJTbG90cycpLmNhbGVuZGFyKTtcclxuICAgIFxyXG4gICAgLy8gT2JqZWN0IHRvIGhvbGQgdGhlIG9wdGlvbnMgcGFzc2VkIG9uICdzaG93JyBhcyBhIHJlc3VsdFxyXG4gICAgLy8gb2YgYSByZXF1ZXN0IGZyb20gYW5vdGhlciBhY3Rpdml0eVxyXG4gICAgdGhpcy5yZXF1ZXN0SW5mbyA9IG51bGw7XHJcblxyXG4gICAgLyogRXZlbnQgaGFuZGxlcnMgKi9cclxuICAgIC8vIENoYW5nZXMgb24gY3VycmVudERhdGVcclxuICAgIHRoaXMuZGF0YVZpZXcuY3VycmVudERhdGUuc3Vic2NyaWJlKGZ1bmN0aW9uKGRhdGUpIHtcclxuICAgICAgICBcclxuICAgICAgICBpZiAoZGF0ZSkge1xyXG4gICAgICAgICAgICB2YXIgbWRhdGUgPSBtb21lbnQoZGF0ZSk7XHJcblxyXG4gICAgICAgICAgICBpZiAobWRhdGUuaXNWYWxpZCgpKSB7XHJcbiAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgICAgIHZhciBpc29EYXRlID0gbWRhdGUudG9JU09TdHJpbmcoKTtcclxuICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgLy8gVXBkYXRlIGRhdGVwaWNrZXIgc2VsZWN0ZWQgZGF0ZSBvbiBkYXRlIGNoYW5nZSAoZnJvbSBcclxuICAgICAgICAgICAgICAgIC8vIGEgZGlmZmVyZW50IHNvdXJjZSB0aGFuIHRoZSBkYXRlcGlja2VyIGl0c2VsZlxyXG4gICAgICAgICAgICAgICAgdGhpcy4kZGF0ZXBpY2tlci5yZW1vdmVDbGFzcygnaXMtdmlzaWJsZScpO1xyXG4gICAgICAgICAgICAgICAgLy8gQ2hhbmdlIG5vdCBmcm9tIHRoZSB3aWRnZXQ/XHJcbiAgICAgICAgICAgICAgICBpZiAodGhpcy4kZGF0ZXBpY2tlci5kYXRlcGlja2VyKCdnZXRWYWx1ZScpLnRvSVNPU3RyaW5nKCkgIT09IGlzb0RhdGUpXHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy4kZGF0ZXBpY2tlci5kYXRlcGlja2VyKCdzZXRWYWx1ZScsIGRhdGUsIHRydWUpO1xyXG5cclxuICAgICAgICAgICAgICAgIC8vIE9uIGN1cnJlbnREYXRlIGNoYW5nZXMsIHVwZGF0ZSB0aGUgVVJMXHJcbiAgICAgICAgICAgICAgICAvLyBUT0RPOiBzYXZlIGEgdXNlZnVsIHN0YXRlXHJcbiAgICAgICAgICAgICAgICAvLyBET1VCVDogcHVzaCBvciByZXBsYWNlIHN0YXRlPyAobW9yZSBoaXN0b3J5IGVudHJpZXMgb3IgdGhlIHNhbWU/KVxyXG4gICAgICAgICAgICAgICAgYXBwLnNoZWxsLmhpc3RvcnkucHVzaFN0YXRlKG51bGwsIG51bGwsICdjYWxlbmRhci8nICsgaXNvRGF0ZSk7XHJcbiAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgICAgIC8vIERPTkVcclxuICAgICAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgICBcclxuICAgICAgICAvLyBTb21ldGhpbmcgZmFpbCwgYmFkIGRhdGUgb3Igbm90IGRhdGUgYXQgYWxsXHJcbiAgICAgICAgLy8gU2V0IHRoZSBjdXJyZW50IG9uZVxyXG4gICAgICAgIHRoaXMuZGF0YVZpZXcuY3VycmVudERhdGUobmV3IERhdGUoKSk7XHJcblxyXG4gICAgfS5iaW5kKHRoaXMpKTtcclxuXHJcbiAgICAvLyBTd2lwZSBkYXRlIG9uIGdlc3R1cmVcclxuICAgIHRoaXMuJGRhaWx5Vmlld1xyXG4gICAgLm9uKCdzd2lwZWxlZnQgc3dpcGVyaWdodCcsIGZ1bmN0aW9uKGUpIHtcclxuICAgICAgICBlLnByZXZlbnREZWZhdWx0KCk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgdmFyIGRpciA9IGUudHlwZSA9PT0gJ3N3aXBlbGVmdCcgPyAnbmV4dCcgOiAncHJldic7XHJcbiAgICAgICAgXHJcbiAgICAgICAgLy8gSGFjayB0byBzb2x2ZSB0aGUgZnJlZXp5LXN3aXBlIGFuZCB0YXAtYWZ0ZXIgYnVnIG9uIEpRTTpcclxuICAgICAgICAkKGRvY3VtZW50KS50cmlnZ2VyKCd0b3VjaGVuZCcpO1xyXG4gICAgICAgIC8vIENoYW5nZSBkYXRlXHJcbiAgICAgICAgdGhpcy4kZGF0ZXBpY2tlci5kYXRlcGlja2VyKCdtb3ZlVmFsdWUnLCBkaXIsICdkYXRlJyk7XHJcblxyXG4gICAgfS5iaW5kKHRoaXMpKTtcclxuICAgIFxyXG4gICAgLy8gQ2hhbmdpbmcgZGF0ZSB3aXRoIGJ1dHRvbnM6XHJcbiAgICB0aGlzLiRkYXRlSGVhZGVyLm9uKCd0YXAnLCAnLkNhbGVuZGFyRGF0ZUhlYWRlci1zd2l0Y2gnLCBmdW5jdGlvbihlKSB7XHJcbiAgICAgICAgc3dpdGNoIChlLmN1cnJlbnRUYXJnZXQuZ2V0QXR0cmlidXRlKCdocmVmJykpIHtcclxuICAgICAgICAgICAgY2FzZSAnI3ByZXYnOlxyXG4gICAgICAgICAgICAgICAgdGhpcy4kZGF0ZXBpY2tlci5kYXRlcGlja2VyKCdtb3ZlVmFsdWUnLCAncHJldicsICdkYXRlJyk7XHJcbiAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgY2FzZSAnI25leHQnOlxyXG4gICAgICAgICAgICAgICAgdGhpcy4kZGF0ZXBpY2tlci5kYXRlcGlja2VyKCdtb3ZlVmFsdWUnLCAnbmV4dCcsICdkYXRlJyk7XHJcbiAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgZGVmYXVsdDpcclxuICAgICAgICAgICAgICAgIC8vIExldHMgZGVmYXVsdDpcclxuICAgICAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICB9XHJcbiAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xyXG4gICAgICAgIGUuc3RvcFByb3BhZ2F0aW9uKCk7XHJcbiAgICB9LmJpbmQodGhpcykpO1xyXG5cclxuICAgIC8vIFNob3dpbmcgZGF0ZXBpY2tlciB3aGVuIHByZXNzaW5nIHRoZSB0aXRsZVxyXG4gICAgdGhpcy4kZGF0ZVRpdGxlLm9uKCd0YXAnLCBmdW5jdGlvbihlKSB7XHJcbiAgICAgICAgdGhpcy4kZGF0ZXBpY2tlci50b2dnbGVDbGFzcygnaXMtdmlzaWJsZScpO1xyXG4gICAgICAgIGUucHJldmVudERlZmF1bHQoKTtcclxuICAgICAgICBlLnN0b3BQcm9wYWdhdGlvbigpO1xyXG4gICAgfS5iaW5kKHRoaXMpKTtcclxuXHJcbiAgICAvLyBVcGRhdGluZyB2aWV3IGRhdGUgd2hlbiBwaWNrZWQgYW5vdGhlciBvbmVcclxuICAgIHRoaXMuJGRhdGVwaWNrZXIub24oJ2NoYW5nZURhdGUnLCBmdW5jdGlvbihlKSB7XHJcbiAgICAgICAgaWYgKGUudmlld01vZGUgPT09ICdkYXlzJykge1xyXG4gICAgICAgICAgICB0aGlzLmRhdGFWaWV3LmN1cnJlbnREYXRlKGUuZGF0ZSk7XHJcbiAgICAgICAgfVxyXG4gICAgfS5iaW5kKHRoaXMpKTtcclxuXHJcbiAgICAvLyBTZXQgZGF0ZSB0byBtYXRjaCBkYXRlcGlja2VyIGZvciBmaXJzdCB1cGRhdGVcclxuICAgIHRoaXMuZGF0YVZpZXcuY3VycmVudERhdGUodGhpcy4kZGF0ZXBpY2tlci5kYXRlcGlja2VyKCdnZXRWYWx1ZScpKTtcclxufVxyXG5cclxuQ2FsZW5kYXJBY3Rpdml0eS5wcm90b3R5cGUuc2hvdyA9IGZ1bmN0aW9uIHNob3cob3B0aW9ucykge1xyXG4gICAgLyoganNoaW50IG1heGNvbXBsZXhpdHk6MTAgKi9cclxuICAgIFxyXG4gICAgaWYgKG9wdGlvbnMgJiYgb3B0aW9ucy5yb3V0ZSAmJiBvcHRpb25zLnJvdXRlLnNlZ21lbnRzKSB7XHJcbiAgICAgICAgdmFyIHNkYXRlID0gb3B0aW9ucy5yb3V0ZS5zZWdtZW50c1swXSxcclxuICAgICAgICAgICAgbWRhdGUgPSBtb21lbnQoc2RhdGUpLFxyXG4gICAgICAgICAgICBkYXRlID0gbWRhdGUuaXNWYWxpZCgpID8gbWRhdGUudG9EYXRlKCkgOiBudWxsO1xyXG5cclxuICAgICAgICBpZiAoZGF0ZSlcclxuICAgICAgICAgICAgdGhpcy5kYXRhVmlldy5jdXJyZW50RGF0ZShkYXRlKTtcclxuICAgIH1cclxufTtcclxuXHJcbmZ1bmN0aW9uIFZpZXdNb2RlbCgpIHtcclxuXHJcbiAgICB0aGlzLnNsb3RzID0ga28ub2JzZXJ2YWJsZUFycmF5KFtdKTtcclxuICAgIHRoaXMuc2xvdHNEYXRhID0ga28ub2JzZXJ2YWJsZSh7fSk7XHJcbiAgICB0aGlzLmN1cnJlbnREYXRlID0ga28ub2JzZXJ2YWJsZShuZXcgRGF0ZSgpKTtcclxuICAgIFxyXG4gICAgLy8gVXBkYXRlIGN1cnJlbnQgc2xvdHMgb24gZGF0ZSBjaGFuZ2VcclxuICAgIHRoaXMuY3VycmVudERhdGUuc3Vic2NyaWJlKGZ1bmN0aW9uIChkYXRlKSB7XHJcblxyXG4gICAgICAgIHZhciBtZGF0ZSA9IG1vbWVudChkYXRlKSxcclxuICAgICAgICAgICAgc2RhdGUgPSBtZGF0ZS5mb3JtYXQoJ1lZWVktTU0tREQnKTtcclxuICAgICAgICBcclxuICAgICAgICB2YXIgc2xvdHMgPSB0aGlzLnNsb3RzRGF0YSgpO1xyXG5cclxuICAgICAgICBpZiAoc2xvdHMuaGFzT3duUHJvcGVydHkoc2RhdGUpKSB7XHJcbiAgICAgICAgICAgIHRoaXMuc2xvdHMoc2xvdHNbc2RhdGVdKTtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICB0aGlzLnNsb3RzKHNsb3RzWydkZWZhdWx0J10pO1xyXG4gICAgICAgIH1cclxuICAgIH0uYmluZCh0aGlzKSk7XHJcbn1cclxuIiwiLyoqXHJcbiAgICBjbGllbnRzIGFjdGl2aXR5XHJcbioqL1xyXG4ndXNlIHN0cmljdCc7XHJcblxyXG52YXIgJCA9IHJlcXVpcmUoJ2pxdWVyeScpLFxyXG4gICAga28gPSByZXF1aXJlKCdrbm9ja291dCcpLFxyXG4gICAgTmF2QmFyID0gcmVxdWlyZSgnLi4vdmlld21vZGVscy9OYXZCYXInKSxcclxuICAgIE5hdkFjdGlvbiA9IHJlcXVpcmUoJy4uL3ZpZXdtb2RlbHMvTmF2QWN0aW9uJyk7XHJcbiAgICBcclxudmFyIHNpbmdsZXRvbiA9IG51bGw7XHJcblxyXG5leHBvcnRzLmluaXQgPSBmdW5jdGlvbiBpbml0Q2xpZW50cygkYWN0aXZpdHksIGFwcCkge1xyXG5cclxuICAgIGlmIChzaW5nbGV0b24gPT09IG51bGwpXHJcbiAgICAgICAgc2luZ2xldG9uID0gbmV3IENsaWVudHNBY3Rpdml0eSgkYWN0aXZpdHksIGFwcCk7XHJcbiAgICBcclxuICAgIHJldHVybiBzaW5nbGV0b247XHJcbn07XHJcblxyXG5mdW5jdGlvbiBDbGllbnRzQWN0aXZpdHkoJGFjdGl2aXR5LCBhcHApIHtcclxuXHJcbiAgICB0aGlzLmFjY2Vzc0xldmVsID0gYXBwLlVzZXJUeXBlLlByb3ZpZGVyO1xyXG4gICAgdGhpcy5uYXZCYXIgPSBuZXcgTmF2QmFyKHtcclxuICAgICAgICB0aXRsZTogJ0NsaWVudHMnLFxyXG4gICAgICAgIGxlZnRBY3Rpb246IE5hdkFjdGlvbi5tZW51TmV3SXRlbSxcclxuICAgICAgICByaWdodEFjdGlvbjogTmF2QWN0aW9uLm1lbnVJblxyXG4gICAgfSk7XHJcbiAgICAvLyBOT1RFOiBGb3IgY2xpZW50LWVkaXQgYWN0aXZpdHksIHVzZSB0aGlzOlxyXG4gICAgLypcclxuICAgIHRoaXMubmF2QmFyID0gbmV3IE5hdkJhcih7XHJcbiAgICAgICAgdGl0bGU6ICcnLFxyXG4gICAgICAgIGxlZnRBY3Rpb246IE5hdkFjdGlvbi5nb0JhY2subW9kZWwuY2xvbmUoe1xyXG4gICAgICAgICAgICB0ZXh0OiAnQ2xpZW50cydcclxuICAgICAgICB9KSxcclxuICAgICAgICByaWdodEFjdGlvbjogTmF2QWN0aW9uLmdvSGVscEluZGV4XHJcbiAgICB9KTtcclxuICAgICovXHJcbiAgICBcclxuICAgIHRoaXMuJGFjdGl2aXR5ID0gJGFjdGl2aXR5O1xyXG4gICAgdGhpcy5hcHAgPSBhcHA7XHJcbiAgICB0aGlzLiRpbmRleCA9ICRhY3Rpdml0eS5maW5kKCcjY2xpZW50c0luZGV4Jyk7XHJcbiAgICB0aGlzLiRsaXN0VmlldyA9ICRhY3Rpdml0eS5maW5kKCcjY2xpZW50c0xpc3RWaWV3Jyk7XHJcblxyXG4gICAgdGhpcy5kYXRhVmlldyA9IG5ldyBWaWV3TW9kZWwoKTtcclxuICAgIGtvLmFwcGx5QmluZGluZ3ModGhpcy5kYXRhVmlldywgJGFjdGl2aXR5LmdldCgwKSk7XHJcblxyXG4gICAgLy8gVGVzdGluZ0RhdGFcclxuICAgIHRoaXMuZGF0YVZpZXcuY2xpZW50cyhyZXF1aXJlKCcuLi90ZXN0ZGF0YS9jbGllbnRzJykuY2xpZW50cyk7XHJcbiAgICBcclxuICAgIC8vIEhhbmRsZXIgdG8gdXBkYXRlIGhlYWRlciBiYXNlZCBvbiBhIG1vZGUgY2hhbmdlOlxyXG4gICAgdGhpcy5kYXRhVmlldy5pc1NlbGVjdGlvbk1vZGUuc3Vic2NyaWJlKGZ1bmN0aW9uIChpdElzKSB7XHJcbiAgICAgICAgdGhpcy5kYXRhVmlldy5oZWFkZXJUZXh0KGl0SXMgPyAnU2VsZWN0IGEgY2xpZW50JyA6ICdDbGllbnRzJyk7XHJcbiAgICB9LmJpbmQodGhpcykpO1xyXG5cclxuICAgIC8vIE9iamVjdCB0byBob2xkIHRoZSBvcHRpb25zIHBhc3NlZCBvbiAnc2hvdycgYXMgYSByZXN1bHRcclxuICAgIC8vIG9mIGEgcmVxdWVzdCBmcm9tIGFub3RoZXIgYWN0aXZpdHlcclxuICAgIHRoaXMucmVxdWVzdEluZm8gPSBudWxsO1xyXG4gICAgXHJcbiAgICAvLyBIYW5kbGVyIHRvIGdvIGJhY2sgd2l0aCB0aGUgc2VsZWN0ZWQgY2xpZW50IHdoZW4gXHJcbiAgICAvLyBzZWxlY3Rpb24gbW9kZSBnb2VzIG9mZiBhbmQgcmVxdWVzdEluZm8gaXMgZm9yXHJcbiAgICAvLyAnc2VsZWN0IG1vZGUnXHJcbiAgICB0aGlzLmRhdGFWaWV3LmlzU2VsZWN0aW9uTW9kZS5zdWJzY3JpYmUoZnVuY3Rpb24gKGl0SXMpIHtcclxuICAgICAgICAvLyBXZSBoYXZlIGEgcmVxdWVzdCBhbmRcclxuICAgICAgICAvLyBpdCByZXF1ZXN0ZWQgdG8gc2VsZWN0IGEgY2xpZW50XHJcbiAgICAgICAgLy8gYW5kIHNlbGVjdGlvbiBtb2RlIGdvZXMgb2ZmXHJcbiAgICAgICAgaWYgKHRoaXMucmVxdWVzdEluZm8gJiZcclxuICAgICAgICAgICAgdGhpcy5yZXF1ZXN0SW5mby5zZWxlY3RDbGllbnQgPT09IHRydWUgJiZcclxuICAgICAgICAgICAgaXRJcyA9PT0gZmFsc2UpIHtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIC8vIFBhc3MgdGhlIHNlbGVjdGVkIGNsaWVudCBpbiB0aGUgaW5mb1xyXG4gICAgICAgICAgICB0aGlzLnJlcXVlc3RJbmZvLnNlbGVjdGVkQ2xpZW50ID0gdGhpcy5kYXRhVmlldy5zZWxlY3RlZENsaWVudCgpO1xyXG4gICAgICAgICAgICAvLyBBbmQgZ28gYmFja1xyXG4gICAgICAgICAgICB0aGlzLmFwcC5zaGVsbC5nb0JhY2sodGhpcy5yZXF1ZXN0SW5mbyk7XHJcbiAgICAgICAgICAgIC8vIExhc3QsIGNsZWFyIHJlcXVlc3RJbmZvXHJcbiAgICAgICAgICAgIHRoaXMucmVxdWVzdEluZm8gPSBudWxsO1xyXG4gICAgICAgIH1cclxuICAgIH0uYmluZCh0aGlzKSk7XHJcbn1cclxuXHJcbkNsaWVudHNBY3Rpdml0eS5wcm90b3R5cGUuc2hvdyA9IGZ1bmN0aW9uIHNob3cob3B0aW9ucykge1xyXG5cclxuICAgIC8vIE9uIGV2ZXJ5IHNob3csIHNlYXJjaCBnZXRzIHJlc2V0ZWRcclxuICAgIHRoaXMuZGF0YVZpZXcuc2VhcmNoVGV4dCgnJyk7XHJcbiAgXHJcbiAgICBvcHRpb25zID0gb3B0aW9ucyB8fCB7fTtcclxuICAgIHRoaXMucmVxdWVzdEluZm8gPSBvcHRpb25zO1xyXG5cclxuICAgIGlmIChvcHRpb25zLnNlbGVjdENsaWVudCA9PT0gdHJ1ZSlcclxuICAgICAgICB0aGlzLmRhdGFWaWV3LmlzU2VsZWN0aW9uTW9kZSh0cnVlKTtcclxufTtcclxuXHJcbmZ1bmN0aW9uIFZpZXdNb2RlbCgpIHtcclxuXHJcbiAgICB0aGlzLmhlYWRlclRleHQgPSBrby5vYnNlcnZhYmxlKCdDbGllbnRzJyk7XHJcblxyXG4gICAgLy8gRXNwZWNpYWwgbW9kZSB3aGVuIGluc3RlYWQgb2YgcGljayBhbmQgZWRpdCB3ZSBhcmUganVzdCBzZWxlY3RpbmdcclxuICAgIC8vICh3aGVuIGVkaXRpbmcgYW4gYXBwb2ludG1lbnQpXHJcbiAgICB0aGlzLmlzU2VsZWN0aW9uTW9kZSA9IGtvLm9ic2VydmFibGUoZmFsc2UpO1xyXG5cclxuICAgIC8vIEZ1bGwgbGlzdCBvZiBjbGllbnRzXHJcbiAgICB0aGlzLmNsaWVudHMgPSBrby5vYnNlcnZhYmxlQXJyYXkoW10pO1xyXG4gICAgXHJcbiAgICAvLyBTZWFyY2ggdGV4dCwgdXNlZCB0byBmaWx0ZXIgJ2NsaWVudHMnXHJcbiAgICB0aGlzLnNlYXJjaFRleHQgPSBrby5vYnNlcnZhYmxlKCcnKTtcclxuICAgIFxyXG4gICAgLy8gVXRpbGl0eSB0byBnZXQgYSBmaWx0ZXJlZCBsaXN0IG9mIGNsaWVudHMgYmFzZWQgb24gY2xpZW50c1xyXG4gICAgdGhpcy5nZXRGaWx0ZXJlZExpc3QgPSBmdW5jdGlvbiBnZXRGaWx0ZXJlZExpc3QoKSB7XHJcbiAgICAgICAgdmFyIHMgPSAodGhpcy5zZWFyY2hUZXh0KCkgfHwgJycpLnRvTG93ZXJDYXNlKCk7XHJcblxyXG4gICAgICAgIHJldHVybiB0aGlzLmNsaWVudHMoKS5maWx0ZXIoZnVuY3Rpb24oY2xpZW50KSB7XHJcbiAgICAgICAgICAgIHZhciBuID0gY2xpZW50ICYmIGNsaWVudC5mdWxsTmFtZSgpICYmIGNsaWVudC5mdWxsTmFtZSgpIHx8ICcnO1xyXG4gICAgICAgICAgICBuID0gbi50b0xvd2VyQ2FzZSgpO1xyXG4gICAgICAgICAgICByZXR1cm4gbi5pbmRleE9mKHMpID4gLTE7XHJcbiAgICAgICAgfSk7XHJcbiAgICB9O1xyXG5cclxuICAgIC8vIEZpbHRlcmVkIGxpc3Qgb2YgY2xpZW50c1xyXG4gICAgdGhpcy5maWx0ZXJlZENsaWVudHMgPSBrby5jb21wdXRlZChmdW5jdGlvbigpIHtcclxuICAgICAgICByZXR1cm4gdGhpcy5nZXRGaWx0ZXJlZExpc3QoKTtcclxuICAgIH0sIHRoaXMpO1xyXG4gICAgXHJcbiAgICAvLyBHcm91cGVkIGxpc3Qgb2YgZmlsdGVyZWQgY2xpZW50c1xyXG4gICAgdGhpcy5ncm91cGVkQ2xpZW50cyA9IGtvLmNvbXB1dGVkKGZ1bmN0aW9uKCl7XHJcblxyXG4gICAgICAgIHZhciBjbGllbnRzID0gdGhpcy5maWx0ZXJlZENsaWVudHMoKS5zb3J0KGZ1bmN0aW9uKGNsaWVudEEsIGNsaWVudEIpIHtcclxuICAgICAgICAgICAgcmV0dXJuIGNsaWVudEEuZmlyc3ROYW1lKCkgPiBjbGllbnRCLmZpcnN0TmFtZSgpO1xyXG4gICAgICAgIH0pO1xyXG4gICAgICAgIFxyXG4gICAgICAgIHZhciBncm91cHMgPSBbXSxcclxuICAgICAgICAgICAgbGF0ZXN0R3JvdXAgPSBudWxsLFxyXG4gICAgICAgICAgICBsYXRlc3RMZXR0ZXIgPSBudWxsO1xyXG5cclxuICAgICAgICBjbGllbnRzLmZvckVhY2goZnVuY3Rpb24oY2xpZW50KSB7XHJcbiAgICAgICAgICAgIHZhciBsZXR0ZXIgPSAoY2xpZW50LmZpcnN0TmFtZSgpWzBdIHx8ICcnKS50b1VwcGVyQ2FzZSgpO1xyXG4gICAgICAgICAgICBpZiAobGV0dGVyICE9PSBsYXRlc3RMZXR0ZXIpIHtcclxuICAgICAgICAgICAgICAgIGxhdGVzdEdyb3VwID0ge1xyXG4gICAgICAgICAgICAgICAgICAgIGxldHRlcjogbGV0dGVyLFxyXG4gICAgICAgICAgICAgICAgICAgIGNsaWVudHM6IFtjbGllbnRdXHJcbiAgICAgICAgICAgICAgICB9O1xyXG4gICAgICAgICAgICAgICAgZ3JvdXBzLnB1c2gobGF0ZXN0R3JvdXApO1xyXG4gICAgICAgICAgICAgICAgbGF0ZXN0TGV0dGVyID0gbGV0dGVyO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgbGF0ZXN0R3JvdXAuY2xpZW50cy5wdXNoKGNsaWVudCk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgcmV0dXJuIGdyb3VwcztcclxuXHJcbiAgICB9LCB0aGlzKTtcclxuICAgIFxyXG4gICAgdGhpcy5zZWxlY3RlZENsaWVudCA9IGtvLm9ic2VydmFibGUobnVsbCk7XHJcbiAgICBcclxuICAgIHRoaXMuc2VsZWN0Q2xpZW50ID0gZnVuY3Rpb24oc2VsZWN0ZWRDbGllbnQpIHtcclxuICAgICAgICBcclxuICAgICAgICB0aGlzLnNlbGVjdGVkQ2xpZW50KHNlbGVjdGVkQ2xpZW50KTtcclxuICAgICAgICB0aGlzLmlzU2VsZWN0aW9uTW9kZShmYWxzZSk7XHJcblxyXG4gICAgfS5iaW5kKHRoaXMpO1xyXG59XHJcbiIsIi8qKlxuICAgIENvbnRhY3RJbmZvIGFjdGl2aXR5XG4qKi9cbid1c2Ugc3RyaWN0JztcblxudmFyIHNpbmdsZXRvbiA9IG51bGwsXG4gICAga28gPSByZXF1aXJlKCdrbm9ja291dCcpLFxuICAgIE5hdkJhciA9IHJlcXVpcmUoJy4uL3ZpZXdtb2RlbHMvTmF2QmFyJyksXG4gICAgTmF2QWN0aW9uID0gcmVxdWlyZSgnLi4vdmlld21vZGVscy9OYXZBY3Rpb24nKTtcblxuZXhwb3J0cy5pbml0ID0gZnVuY3Rpb24gaW5pdENvbnRhY3RJbmZvKCRhY3Rpdml0eSwgYXBwKSB7XG5cbiAgICBpZiAoc2luZ2xldG9uID09PSBudWxsKVxuICAgICAgICBzaW5nbGV0b24gPSBuZXcgQ29udGFjdEluZm9BY3Rpdml0eSgkYWN0aXZpdHksIGFwcCk7XG4gICAgXG4gICAgcmV0dXJuIHNpbmdsZXRvbjtcbn07XG5cbmZ1bmN0aW9uIENvbnRhY3RJbmZvQWN0aXZpdHkoJGFjdGl2aXR5LCBhcHApIHtcblxuICAgIHRoaXMuYWNjZXNzTGV2ZWwgPSBhcHAuVXNlclR5cGUuTG9nZ2VkVXNlcjtcbiAgICBcbiAgICB0aGlzLiRhY3Rpdml0eSA9ICRhY3Rpdml0eTtcbiAgICB0aGlzLmFwcCA9IGFwcDtcbiAgICB0aGlzLmRhdGFWaWV3ID0gbmV3IFZpZXdNb2RlbCgpO1xuICAgIHRoaXMuZGF0YVZpZXcucHJvZmlsZSA9IGFwcC5tb2RlbC51c2VyO1xuICAgIGtvLmFwcGx5QmluZGluZ3ModGhpcy5kYXRhVmlldywgJGFjdGl2aXR5LmdldCgwKSk7XG5cbiAgICB0aGlzLm5hdkJhciA9IG5ldyBOYXZCYXIoe1xuICAgICAgICB0aXRsZTogJycsXG4gICAgICAgIGxlZnRBY3Rpb246IE5hdkFjdGlvbi5nb0JhY2subW9kZWwuY2xvbmUoe1xuICAgICAgICAgICAgdGV4dDogJ0FjY291bnQnLFxuICAgICAgICAgICAgaXNUaXRsZTogdHJ1ZVxuICAgICAgICB9KSxcbiAgICAgICAgcmlnaHRBY3Rpb246IE5hdkFjdGlvbi5nb0hlbHBJbmRleFxuICAgIH0pO1xuICAgIFxuICAgIGFwcC5tb2RlbC51c2VyKCkub25ib2FyZGluZ1N0ZXAuc3Vic2NyaWJlKGZ1bmN0aW9uIChzdGVwKSB7XG4gICAgICAgIFxuICAgICAgICBpZiAoc3RlcCkge1xuICAgICAgICAgICAgLy8gVE9ETyBTZXQgbmF2YmFyIHN0ZXAgaW5kZXhcbiAgICAgICAgICAgIC8vIFNldHRpbmcgbmF2YmFyIGZvciBPbmJvYXJkaW5nL3dpemFyZCBtb2RlXG4gICAgICAgICAgICB0aGlzLm5hdkJhci5sZWZ0QWN0aW9uKCkudGV4dCgnJyk7XG4gICAgICAgICAgICAvLyBTZXR0aW5nIGhlYWRlclxuICAgICAgICAgICAgdGhpcy5kYXRhVmlldy5oZWFkZXJUZXh0KCdIb3cgY2FuIHdlIHJlYWNoIHlvdT8nKTtcbiAgICAgICAgICAgIHRoaXMuZGF0YVZpZXcuYnV0dG9uVGV4dCgnU2F2ZSBhbmQgY29udGludWUnKTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIC8vIFRPRE8gUmVtb3ZlIHN0ZXAgaW5kZXhcbiAgICAgICAgICAgIC8vIFNldHRpbmcgbmF2YmFyIHRvIGRlZmF1bHRcbiAgICAgICAgICAgIHRoaXMubmF2QmFyLmxlZnRBY3Rpb24oKS50ZXh0KCdBY2NvdW50Jyk7XG4gICAgICAgICAgICAvLyBTZXR0aW5nIGhlYWRlciB0byBkZWZhdWx0XG4gICAgICAgICAgICB0aGlzLmRhdGFWaWV3LmhlYWRlclRleHQoJ0NvbnRhY3QgaW5mb3JtYXRpb24nKTtcbiAgICAgICAgICAgIHRoaXMuZGF0YVZpZXcuYnV0dG9uVGV4dCgnU2F2ZScpO1xuICAgICAgICB9XG4gICAgfS5iaW5kKHRoaXMpKTtcbn1cblxuQ29udGFjdEluZm9BY3Rpdml0eS5wcm90b3R5cGUuc2hvdyA9IGZ1bmN0aW9uIHNob3cob3B0aW9ucykge1xuXG59O1xuXG5mdW5jdGlvbiBWaWV3TW9kZWwoKSB7XG5cbiAgICB0aGlzLmhlYWRlclRleHQgPSBrby5vYnNlcnZhYmxlKCdDb250YWN0IGluZm9ybWF0aW9uJyk7XG4gICAgdGhpcy5idXR0b25UZXh0ID0ga28ub2JzZXJ2YWJsZSgnU2F2ZScpO1xuICAgIHRoaXMucHJvZmlsZSA9IGtvLm9ic2VydmFibGUoKTtcbn1cbiIsIi8qKlxyXG4gICAgZGF0ZXRpbWVQaWNrZXIgYWN0aXZpdHlcclxuKiovXHJcbid1c2Ugc3RyaWN0JztcclxuXHJcbnZhciAkID0gcmVxdWlyZSgnanF1ZXJ5JyksXHJcbiAgICBtb21lbnQgPSByZXF1aXJlKCdtb21lbnQnKSxcclxuICAgIGtvID0gcmVxdWlyZSgna25vY2tvdXQnKSxcclxuICAgIFRpbWUgPSByZXF1aXJlKCcuLi91dGlscy9UaW1lJyksXHJcbiAgICBOYXZCYXIgPSByZXF1aXJlKCcuLi92aWV3bW9kZWxzL05hdkJhcicpLFxyXG4gICAgTmF2QWN0aW9uID0gcmVxdWlyZSgnLi4vdmlld21vZGVscy9OYXZBY3Rpb24nKTtcclxucmVxdWlyZSgnLi4vY29tcG9uZW50cy9EYXRlUGlja2VyJyk7XHJcbiAgICBcclxudmFyIHNpbmdsZXRvbiA9IG51bGw7XHJcblxyXG5leHBvcnRzLmluaXQgPSBmdW5jdGlvbiBpbml0RGF0ZXRpbWVQaWNrZXIoJGFjdGl2aXR5LCBhcHApIHtcclxuXHJcbiAgICBpZiAoc2luZ2xldG9uID09PSBudWxsKVxyXG4gICAgICAgIHNpbmdsZXRvbiA9IG5ldyBEYXRldGltZVBpY2tlckFjdGl2aXR5KCRhY3Rpdml0eSwgYXBwKTtcclxuXHJcbiAgICByZXR1cm4gc2luZ2xldG9uO1xyXG59O1xyXG5cclxuZnVuY3Rpb24gRGF0ZXRpbWVQaWNrZXJBY3Rpdml0eSgkYWN0aXZpdHksIGFwcCkge1xyXG5cclxuICAgIHRoaXMuYWNjZXNzTGV2ZWwgPSBhcHAuVXNlclR5cGUuTG9nZ2VkVXNlcjtcclxuICAgIHRoaXMubmF2QmFyID0gbmV3IE5hdkJhcih7XHJcbiAgICAgICAgdGl0bGU6ICcnLFxyXG4gICAgICAgIGxlZnRBY3Rpb246IE5hdkFjdGlvbi5nb0JhY2ssXHJcbiAgICAgICAgcmlnaHRBY3Rpb246IE5hdkFjdGlvbi5nb0hlbHBJbmRleFxyXG4gICAgfSk7XHJcbiAgICBcclxuICAgIHRoaXMuYXBwID0gYXBwO1xyXG4gICAgdGhpcy4kYWN0aXZpdHkgPSAkYWN0aXZpdHk7XHJcbiAgICB0aGlzLiRkYXRlUGlja2VyID0gJGFjdGl2aXR5LmZpbmQoJyNkYXRldGltZVBpY2tlckRhdGVQaWNrZXInKTtcclxuICAgIHRoaXMuJHRpbWVQaWNrZXIgPSAkYWN0aXZpdHkuZmluZCgnI2RhdGV0aW1lUGlja2VyVGltZVBpY2tlcicpO1xyXG5cclxuICAgIC8qIEluaXQgY29tcG9uZW50cyAqL1xyXG4gICAgdGhpcy4kZGF0ZVBpY2tlci5zaG93KCkuZGF0ZXBpY2tlcigpO1xyXG4gICAgXHJcbiAgICB2YXIgZGF0YVZpZXcgPSB0aGlzLmRhdGFWaWV3ID0gbmV3IFZpZXdNb2RlbCgpO1xyXG4gICAgZGF0YVZpZXcuaGVhZGVyVGV4dCA9ICdTZWxlY3QgYSBzdGFydCB0aW1lJztcclxuICAgIGtvLmFwcGx5QmluZGluZ3MoZGF0YVZpZXcsICRhY3Rpdml0eS5nZXQoMCkpO1xyXG4gICAgXHJcbiAgICAvLyBFdmVudHNcclxuICAgIHRoaXMuJGRhdGVQaWNrZXIub24oJ2NoYW5nZURhdGUnLCBmdW5jdGlvbihlKSB7XHJcbiAgICAgICAgaWYgKGUudmlld01vZGUgPT09ICdkYXlzJykge1xyXG4gICAgICAgICAgICBkYXRhVmlldy5zZWxlY3RlZERhdGUoZS5kYXRlKTtcclxuICAgICAgICB9XHJcbiAgICB9LmJpbmQodGhpcykpO1xyXG4gICAgXHJcbiAgICAvLyBUZXN0aW5nRGF0YVxyXG4gICAgZGF0YVZpZXcuc2xvdHNEYXRhID0gcmVxdWlyZSgnLi4vdGVzdGRhdGEvdGltZVNsb3RzJykudGltZVNsb3RzO1xyXG4gXHJcbiAgICBkYXRhVmlldy5zZWxlY3RlZERhdGUuc3Vic2NyaWJlKGZ1bmN0aW9uKGRhdGUpIHtcclxuICAgICAgICB0aGlzLmJpbmREYXRlRGF0YShkYXRlKTtcclxuICAgIH0uYmluZCh0aGlzKSk7XHJcblxyXG4gICAgdGhpcy5iaW5kRGF0ZURhdGEobmV3IERhdGUoKSk7XHJcbiAgICBcclxuICAgIC8vIE9iamVjdCB0byBob2xkIHRoZSBvcHRpb25zIHBhc3NlZCBvbiAnc2hvdycgYXMgYSByZXN1bHRcclxuICAgIC8vIG9mIGEgcmVxdWVzdCBmcm9tIGFub3RoZXIgYWN0aXZpdHlcclxuICAgIHRoaXMucmVxdWVzdEluZm8gPSBudWxsO1xyXG4gICAgXHJcbiAgICAvLyBIYW5kbGVyIHRvIGdvIGJhY2sgd2l0aCB0aGUgc2VsZWN0ZWQgZGF0ZS10aW1lIHdoZW5cclxuICAgIC8vIHRoYXQgc2VsZWN0aW9uIGlzIGRvbmUgKGNvdWxkIGJlIHRvIG51bGwpXHJcbiAgICB0aGlzLmRhdGFWaWV3LnNlbGVjdGVkRGF0ZXRpbWUuc3Vic2NyaWJlKGZ1bmN0aW9uIChkYXRldGltZSkge1xyXG4gICAgICAgIC8vIFdlIGhhdmUgYSByZXF1ZXN0XHJcbiAgICAgICAgaWYgKHRoaXMucmVxdWVzdEluZm8pIHtcclxuICAgICAgICAgICAgLy8gUGFzcyB0aGUgc2VsZWN0ZWQgZGF0ZXRpbWUgaW4gdGhlIGluZm9cclxuICAgICAgICAgICAgdGhpcy5yZXF1ZXN0SW5mby5zZWxlY3RlZERhdGV0aW1lID0gdGhpcy5kYXRhVmlldy5zZWxlY3RlZERhdGV0aW1lKCk7XHJcbiAgICAgICAgICAgIC8vIEFuZCBnbyBiYWNrXHJcbiAgICAgICAgICAgIHRoaXMuYXBwLnNoZWxsLmdvQmFjayh0aGlzLnJlcXVlc3RJbmZvKTtcclxuICAgICAgICAgICAgLy8gTGFzdCwgY2xlYXIgcmVxdWVzdEluZm9cclxuICAgICAgICAgICAgdGhpcy5yZXF1ZXN0SW5mbyA9IG51bGw7XHJcbiAgICAgICAgfVxyXG4gICAgfS5iaW5kKHRoaXMpKTtcclxufVxyXG5cclxuRGF0ZXRpbWVQaWNrZXJBY3Rpdml0eS5wcm90b3R5cGUuc2hvdyA9IGZ1bmN0aW9uIHNob3cob3B0aW9ucykge1xyXG4gIFxyXG4gICAgb3B0aW9ucyA9IG9wdGlvbnMgfHwge307XHJcbiAgICB0aGlzLnJlcXVlc3RJbmZvID0gb3B0aW9ucztcclxufTtcclxuXHJcbkRhdGV0aW1lUGlja2VyQWN0aXZpdHkucHJvdG90eXBlLmJpbmREYXRlRGF0YSA9IGZ1bmN0aW9uIGJpbmREYXRlRGF0YShkYXRlKSB7XHJcblxyXG4gICAgdmFyIHNkYXRlID0gbW9tZW50KGRhdGUpLmZvcm1hdCgnWVlZWS1NTS1ERCcpO1xyXG4gICAgdmFyIHNsb3RzRGF0YSA9IHRoaXMuZGF0YVZpZXcuc2xvdHNEYXRhO1xyXG5cclxuICAgIGlmIChzbG90c0RhdGEuaGFzT3duUHJvcGVydHkoc2RhdGUpKSB7XHJcbiAgICAgICAgdGhpcy5kYXRhVmlldy5zbG90cyhzbG90c0RhdGFbc2RhdGVdKTtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgICAgdGhpcy5kYXRhVmlldy5zbG90cyhzbG90c0RhdGFbJ2RlZmF1bHQnXSk7XHJcbiAgICB9XHJcbn07XHJcblxyXG5mdW5jdGlvbiBWaWV3TW9kZWwoKSB7XHJcblxyXG4gICAgdGhpcy5oZWFkZXJUZXh0ID0ga28ub2JzZXJ2YWJsZSgnU2VsZWN0IGEgdGltZScpO1xyXG4gICAgdGhpcy5zZWxlY3RlZERhdGUgPSBrby5vYnNlcnZhYmxlKG5ldyBEYXRlKCkpO1xyXG4gICAgdGhpcy5zbG90c0RhdGEgPSB7fTtcclxuICAgIHRoaXMuc2xvdHMgPSBrby5vYnNlcnZhYmxlQXJyYXkoW10pO1xyXG4gICAgdGhpcy5ncm91cGVkU2xvdHMgPSBrby5jb21wdXRlZChmdW5jdGlvbigpe1xyXG4gICAgICAgIC8qXHJcbiAgICAgICAgICBiZWZvcmUgMTI6MDBwbSAobm9vbikgPSBtb3JuaW5nXHJcbiAgICAgICAgICBhZnRlcm5vb246IDEyOjAwcG0gdW50aWwgNTowMHBtXHJcbiAgICAgICAgICBldmVuaW5nOiA1OjAwcG0gLSAxMTo1OXBtXHJcbiAgICAgICAgKi9cclxuICAgICAgICAvLyBTaW5jZSBzbG90cyBtdXN0IGJlIGZvciB0aGUgc2FtZSBkYXRlLFxyXG4gICAgICAgIC8vIHRvIGRlZmluZSB0aGUgZ3JvdXBzIHJhbmdlcyB1c2UgdGhlIGZpcnN0IGRhdGVcclxuICAgICAgICB2YXIgZGF0ZVBhcnQgPSB0aGlzLnNsb3RzKCkgJiYgdGhpcy5zbG90cygpWzBdIHx8IG5ldyBEYXRlKCk7XHJcbiAgICAgICAgdmFyIGdyb3VwcyA9IFtcclxuICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgICAgZ3JvdXA6ICdNb3JuaW5nJyxcclxuICAgICAgICAgICAgICAgIHNsb3RzOiBbXSxcclxuICAgICAgICAgICAgICAgIHN0YXJ0czogbmV3IFRpbWUoZGF0ZVBhcnQsIDAsIDApLFxyXG4gICAgICAgICAgICAgICAgZW5kczogbmV3IFRpbWUoZGF0ZVBhcnQsIDEyLCAwKVxyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICB7XHJcbiAgICAgICAgICAgICAgICBncm91cDogJ0FmdGVybm9vbicsXHJcbiAgICAgICAgICAgICAgICBzbG90czogW10sXHJcbiAgICAgICAgICAgICAgICBzdGFydHM6IG5ldyBUaW1lKGRhdGVQYXJ0LCAxMiwgMCksXHJcbiAgICAgICAgICAgICAgICBlbmRzOiBuZXcgVGltZShkYXRlUGFydCwgMTcsIDApXHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICAgIGdyb3VwOiAnRXZlbmluZycsXHJcbiAgICAgICAgICAgICAgICBzbG90czogW10sXHJcbiAgICAgICAgICAgICAgICBzdGFydHM6IG5ldyBUaW1lKGRhdGVQYXJ0LCAxNywgMCksXHJcbiAgICAgICAgICAgICAgICBlbmRzOiBuZXcgVGltZShkYXRlUGFydCwgMjQsIDApXHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICBdO1xyXG4gICAgICAgIHZhciBzbG90cyA9IHRoaXMuc2xvdHMoKS5zb3J0KCk7XHJcbiAgICAgICAgc2xvdHMuZm9yRWFjaChmdW5jdGlvbihzbG90KSB7XHJcbiAgICAgICAgICAgIGdyb3Vwcy5mb3JFYWNoKGZ1bmN0aW9uKGdyb3VwKSB7XHJcbiAgICAgICAgICAgICAgICBpZiAoc2xvdCA+PSBncm91cC5zdGFydHMgJiZcclxuICAgICAgICAgICAgICAgICAgICBzbG90IDwgZ3JvdXAuZW5kcykge1xyXG4gICAgICAgICAgICAgICAgICAgIGdyb3VwLnNsb3RzLnB1c2goc2xvdCk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgIH0pO1xyXG5cclxuICAgICAgICByZXR1cm4gZ3JvdXBzO1xyXG5cclxuICAgIH0sIHRoaXMpO1xyXG4gICAgXHJcbiAgICB0aGlzLnNlbGVjdGVkRGF0ZXRpbWUgPSBrby5vYnNlcnZhYmxlKG51bGwpO1xyXG4gICAgXHJcbiAgICB0aGlzLnNlbGVjdERhdGV0aW1lID0gZnVuY3Rpb24oc2VsZWN0ZWREYXRldGltZSkge1xyXG4gICAgICAgIFxyXG4gICAgICAgIHRoaXMuc2VsZWN0ZWREYXRldGltZShzZWxlY3RlZERhdGV0aW1lKTtcclxuXHJcbiAgICB9LmJpbmQodGhpcyk7XHJcblxyXG59XHJcbiIsIi8qKlxuICAgIEhvbWUgYWN0aXZpdHlcbioqL1xuJ3VzZSBzdHJpY3QnO1xuXG52YXIgJCA9IHJlcXVpcmUoJ2pxdWVyeScpLFxuICAgIGtvID0gcmVxdWlyZSgna25vY2tvdXQnKSxcbiAgICBOYXZCYXIgPSByZXF1aXJlKCcuLi92aWV3bW9kZWxzL05hdkJhcicpLFxuICAgIE5hdkFjdGlvbiA9IHJlcXVpcmUoJy4uL3ZpZXdtb2RlbHMvTmF2QWN0aW9uJyk7XG5cbnZhciBzaW5nbGV0b24gPSBudWxsO1xuXG5leHBvcnRzLmluaXQgPSBmdW5jdGlvbiBpbml0SG9tZSgkYWN0aXZpdHksIGFwcCkge1xuXG4gICAgaWYgKHNpbmdsZXRvbiA9PT0gbnVsbClcbiAgICAgICAgc2luZ2xldG9uID0gbmV3IEhvbWVBY3Rpdml0eSgkYWN0aXZpdHksIGFwcCk7XG4gICAgXG4gICAgcmV0dXJuIHNpbmdsZXRvbjtcbn07XG5cbmZ1bmN0aW9uIEhvbWVBY3Rpdml0eSgkYWN0aXZpdHksIGFwcCkge1xuICAgIFxuICAgIHRoaXMuYWNjZXNzTGV2ZWwgPSBhcHAuVXNlclR5cGUuUHJvdmlkZXI7XG4gICAgdGhpcy5uYXZCYXIgPSBuZXcgTmF2QmFyKHtcbiAgICAgICAgdGl0bGU6IG51bGwsIC8vIG51bGwgZm9yIGxvZ29cbiAgICAgICAgbGVmdEFjdGlvbjogTmF2QWN0aW9uLm1lbnVOZXdJdGVtLFxuICAgICAgICByaWdodEFjdGlvbjogTmF2QWN0aW9uLm1lbnVJblxuICAgIH0pO1xuXG4gICAgdGhpcy4kYWN0aXZpdHkgPSAkYWN0aXZpdHk7XG4gICAgdGhpcy5hcHAgPSBhcHA7XG4gICAgdGhpcy4kbmV4dEJvb2tpbmcgPSAkYWN0aXZpdHkuZmluZCgnI2hvbWVOZXh0Qm9va2luZycpO1xuICAgIHRoaXMuJHVwY29taW5nQm9va2luZ3MgPSAkYWN0aXZpdHkuZmluZCgnI2hvbWVVcGNvbWluZ0Jvb2tpbmdzJyk7XG4gICAgdGhpcy4kaW5ib3ggPSAkYWN0aXZpdHkuZmluZCgnI2hvbWVJbmJveCcpO1xuICAgIHRoaXMuJHBlcmZvcm1hbmNlID0gJGFjdGl2aXR5LmZpbmQoJyNob21lUGVyZm9ybWFuY2UnKTtcbiAgICB0aGlzLiRnZXRNb3JlID0gJGFjdGl2aXR5LmZpbmQoJyNob21lR2V0TW9yZScpO1xuXG4gICAgdGhpcy5kYXRhVmlldyA9IG5ldyBWaWV3TW9kZWwoKTtcbiAgICBrby5hcHBseUJpbmRpbmdzKHRoaXMuZGF0YVZpZXcsICRhY3Rpdml0eS5nZXQoMCkpO1xuXG4gICAgLy8gVGVzdGluZ0RhdGFcbiAgICBzZXRTb21lVGVzdGluZ0RhdGEodGhpcy5kYXRhVmlldyk7XG5cbiAgICAvLyBPYmplY3QgdG8gaG9sZCB0aGUgb3B0aW9ucyBwYXNzZWQgb24gJ3Nob3cnIGFzIGEgcmVzdWx0XG4gICAgLy8gb2YgYSByZXF1ZXN0IGZyb20gYW5vdGhlciBhY3Rpdml0eVxuICAgIHRoaXMucmVxdWVzdEluZm8gPSBudWxsO1xufVxuXG5Ib21lQWN0aXZpdHkucHJvdG90eXBlLnNob3cgPSBmdW5jdGlvbiBzaG93KG9wdGlvbnMpIHtcbiBcbiAgICBvcHRpb25zID0gb3B0aW9ucyB8fCB7fTtcbiAgICB0aGlzLnJlcXVlc3RJbmZvID0gb3B0aW9ucztcbiAgICB2YXIgdiA9IHRoaXMuZGF0YVZpZXcsXG4gICAgICAgIGFwcE1vZGVsID0gdGhpcy5hcHAubW9kZWw7XG4gICAgXG4gICAgLy8gVXBkYXRlIGRhdGFcbiAgICBhcHBNb2RlbC5nZXRVcGNvbWluZ0Jvb2tpbmdzKCkudGhlbihmdW5jdGlvbih1cGNvbWluZykge1xuXG4gICAgICAgIGlmICh1cGNvbWluZy5uZXh0Qm9va2luZ0lEKVxuICAgICAgICAgICAgYXBwTW9kZWwuZ2V0Qm9va2luZyh1cGNvbWluZy5uZXh0Qm9va2luZ0lEKS50aGVuKHYubmV4dEJvb2tpbmcpO1xuICAgICAgICBlbHNlXG4gICAgICAgICAgICB2Lm5leHRCb29raW5nKG51bGwpO1xuXG4gICAgICAgIHYudXBjb21pbmdCb29raW5ncy50b2RheS5xdWFudGl0eSh1cGNvbWluZy50b2RheS5xdWFudGl0eSk7XG4gICAgICAgIHYudXBjb21pbmdCb29raW5ncy50b2RheS50aW1lKHVwY29taW5nLnRvZGF5LnRpbWUgJiYgbmV3IERhdGUodXBjb21pbmcudG9kYXkudGltZSkpO1xuICAgICAgICB2LnVwY29taW5nQm9va2luZ3MudG9tb3Jyb3cucXVhbnRpdHkodXBjb21pbmcudG9tb3Jyb3cucXVhbnRpdHkpO1xuICAgICAgICB2LnVwY29taW5nQm9va2luZ3MudG9tb3Jyb3cudGltZSh1cGNvbWluZy50b21vcnJvdy50aW1lICYmIG5ldyBEYXRlKHVwY29taW5nLnRvbW9ycm93LnRpbWUpKTtcbiAgICAgICAgdi51cGNvbWluZ0Jvb2tpbmdzLm5leHRXZWVrLnF1YW50aXR5KHVwY29taW5nLm5leHRXZWVrLnF1YW50aXR5KTtcbiAgICB9KTtcbn07XG5cbnZhciBVcGNvbWluZ0Jvb2tpbmdzU3VtbWFyeSA9IHJlcXVpcmUoJy4uL21vZGVscy9VcGNvbWluZ0Jvb2tpbmdzU3VtbWFyeScpLFxuICAgIE1haWxGb2xkZXIgPSByZXF1aXJlKCcuLi9tb2RlbHMvTWFpbEZvbGRlcicpLFxuICAgIFBlcmZvcm1hbmNlU3VtbWFyeSA9IHJlcXVpcmUoJy4uL21vZGVscy9QZXJmb3JtYW5jZVN1bW1hcnknKSxcbiAgICBHZXRNb3JlID0gcmVxdWlyZSgnLi4vbW9kZWxzL0dldE1vcmUnKTtcblxuZnVuY3Rpb24gVmlld01vZGVsKCkge1xuXG4gICAgdGhpcy51cGNvbWluZ0Jvb2tpbmdzID0gbmV3IFVwY29taW5nQm9va2luZ3NTdW1tYXJ5KCk7XG5cbiAgICAvLyA6QXBwb2ludG1lbnRcbiAgICB0aGlzLm5leHRCb29raW5nID0ga28ub2JzZXJ2YWJsZShudWxsKTtcbiAgICBcbiAgICB0aGlzLmluYm94ID0gbmV3IE1haWxGb2xkZXIoe1xuICAgICAgICB0b3BOdW1iZXI6IDRcbiAgICB9KTtcbiAgICBcbiAgICB0aGlzLnBlcmZvcm1hbmNlID0gbmV3IFBlcmZvcm1hbmNlU3VtbWFyeSgpO1xuICAgIFxuICAgIHRoaXMuZ2V0TW9yZSA9IG5ldyBHZXRNb3JlKCk7XG59XG5cbi8qKiBURVNUSU5HIERBVEEgKiovXG52YXIgVGltZSA9IHJlcXVpcmUoJy4uL3V0aWxzL1RpbWUnKTtcblxuZnVuY3Rpb24gc2V0U29tZVRlc3RpbmdEYXRhKGRhdGFWaWV3KSB7XG4gICAgXG4gICAgZGF0YVZpZXcuaW5ib3gubWVzc2FnZXMocmVxdWlyZSgnLi4vdGVzdGRhdGEvbWVzc2FnZXMnKS5tZXNzYWdlcyk7XG4gICAgXG4gICAgZGF0YVZpZXcucGVyZm9ybWFuY2UuZWFybmluZ3MuY3VycmVudEFtb3VudCgyNDAwKTtcbiAgICBkYXRhVmlldy5wZXJmb3JtYW5jZS5lYXJuaW5ncy5uZXh0QW1vdW50KDYyMDAuNTQpO1xuICAgIGRhdGFWaWV3LnBlcmZvcm1hbmNlLnRpbWVCb29rZWQucGVyY2VudCgwLjkzKTtcbiAgICBcbiAgICBkYXRhVmlldy5nZXRNb3JlLm1vZGVsLnVwZGF0ZVdpdGgoe1xuICAgICAgICBhdmFpbGFiaWxpdHk6IHRydWUsXG4gICAgICAgIHBheW1lbnRzOiB0cnVlLFxuICAgICAgICBwcm9maWxlOiB0cnVlLFxuICAgICAgICBjb29wOiB0cnVlXG4gICAgfSk7XG59XG4iLCIvKipcbiAgICBJbmRleCBhY3Rpdml0eVxuKiovXG4ndXNlIHN0cmljdCc7XG5cbnZhciBzaW5nbGV0b24gPSBudWxsLFxuICAgIE5hdkJhciA9IHJlcXVpcmUoJy4uL3ZpZXdtb2RlbHMvTmF2QmFyJyksXG4gICAgTmF2QWN0aW9uID0gcmVxdWlyZSgnLi4vdmlld21vZGVscy9OYXZBY3Rpb24nKTtcblxuZXhwb3J0cy5pbml0ID0gZnVuY3Rpb24gaW5pdEluZGV4KCRhY3Rpdml0eSwgYXBwKSB7XG5cbiAgICBpZiAoc2luZ2xldG9uID09PSBudWxsKVxuICAgICAgICBzaW5nbGV0b24gPSBuZXcgSW5kZXhBY3Rpdml0eSgkYWN0aXZpdHksIGFwcCk7XG4gICAgXG4gICAgcmV0dXJuIHNpbmdsZXRvbjtcbn07XG5cbmZ1bmN0aW9uIEluZGV4QWN0aXZpdHkoJGFjdGl2aXR5LCBhcHApIHtcblxuICAgIHRoaXMuJGFjdGl2aXR5ID0gJGFjdGl2aXR5O1xuICAgIHRoaXMuYXBwID0gYXBwO1xuICAgIFxuICAgIHRoaXMubmF2QmFyID0gbmV3IE5hdkJhcih7XG4gICAgICAgIHRpdGxlOiBudWxsLCAvLyBudWxsIGZvciBsb2dvXG4gICAgICAgIGxlZnRBY3Rpb246IE5hdkFjdGlvbi5nb0xvZ2luLFxuICAgICAgICByaWdodEFjdGlvbjogTmF2QWN0aW9uLm1lbnVPdXRcbiAgICB9KTtcbiAgICBcbiAgICAvLyBBbnkgdXNlciBjYW4gYWNjZXNzIHRoaXNcbiAgICB0aGlzLmFjY2Vzc0xldmVsID0gbnVsbDtcbn1cblxuSW5kZXhBY3Rpdml0eS5wcm90b3R5cGUuc2hvdyA9IGZ1bmN0aW9uIHNob3cob3B0aW9ucykge1xuICAgIC8vIEl0IGNoZWNrcyBpZiB0aGUgdXNlciBpcyBsb2dnZWQgc28gdGhlbiBcbiAgICAvLyB0aGVpciAnbG9nZ2VkIGluZGV4JyBpcyB0aGUgZGFzaGJvYXJkIG5vdCB0aGlzXG4gICAgLy8gcGFnZSB0aGF0IGlzIGZvY3VzZWQgb24gYW5vbnltb3VzIHVzZXJzXG4gICAgaWYgKCF0aGlzLmFwcC5tb2RlbC51c2VyKCkuaXNBbm9ueW1vdXMoKSkge1xuICAgICAgICB0aGlzLmFwcC5nb0Rhc2hib2FyZCgpO1xuICAgIH1cbn07XG4iLCIvKipcbiAgICBMZWFybk1vcmUgYWN0aXZpdHlcbioqL1xuJ3VzZSBzdHJpY3QnO1xudmFyIGtvID0gcmVxdWlyZSgna25vY2tvdXQnKSxcbiAgICBOYXZCYXIgPSByZXF1aXJlKCcuLi92aWV3bW9kZWxzL05hdkJhcicpLFxuICAgIE5hdkFjdGlvbiA9IHJlcXVpcmUoJy4uL3ZpZXdtb2RlbHMvTmF2QWN0aW9uJyk7XG5cbnZhciBzaW5nbGV0b24gPSBudWxsO1xuXG5leHBvcnRzLmluaXQgPSBmdW5jdGlvbiBpbml0TGVhcm5Nb3JlKCRhY3Rpdml0eSwgYXBwKSB7XG5cbiAgICBpZiAoc2luZ2xldG9uID09PSBudWxsKVxuICAgICAgICBzaW5nbGV0b24gPSBuZXcgTGVhcm5Nb3JlQWN0aXZpdHkoJGFjdGl2aXR5LCBhcHApO1xuICAgIFxuICAgIHJldHVybiBzaW5nbGV0b247XG59O1xuXG5mdW5jdGlvbiBMZWFybk1vcmVBY3Rpdml0eSgkYWN0aXZpdHksIGFwcCkge1xuXG4gICAgdGhpcy4kYWN0aXZpdHkgPSAkYWN0aXZpdHk7XG4gICAgdGhpcy5hcHAgPSBhcHA7XG4gICAgdGhpcy5kYXRhVmlldyA9IG5ldyBWaWV3TW9kZWwoKTtcbiAgICBrby5hcHBseUJpbmRpbmdzKHRoaXMuZGF0YVZpZXcsICRhY3Rpdml0eS5nZXQoMCkpO1xuICAgIFxuICAgIHRoaXMubmF2QmFyID0gbmV3IE5hdkJhcih7XG4gICAgICAgIHRpdGxlOiBudWxsLCAvLyBudWxsIGZvciBsb2dvXG4gICAgICAgIGxlZnRBY3Rpb246IE5hdkFjdGlvbi5nb0JhY2ssXG4gICAgICAgIHJpZ2h0QWN0aW9uOiBOYXZBY3Rpb24ubWVudU91dFxuICAgIH0pO1xufVxuXG5MZWFybk1vcmVBY3Rpdml0eS5wcm90b3R5cGUuc2hvdyA9IGZ1bmN0aW9uIHNob3cob3B0aW9ucykge1xuXG4gICAgaWYgKG9wdGlvbnMgJiYgb3B0aW9ucy5yb3V0ZSAmJlxuICAgICAgICBvcHRpb25zLnJvdXRlLnNlZ21lbnRzICYmXG4gICAgICAgIG9wdGlvbnMucm91dGUuc2VnbWVudHMubGVuZ3RoKSB7XG4gICAgICAgIHRoaXMuZGF0YVZpZXcucHJvZmlsZShvcHRpb25zLnJvdXRlLnNlZ21lbnRzWzBdKTtcbiAgICB9XG59O1xuXG5mdW5jdGlvbiBWaWV3TW9kZWwoKSB7XG4gICAgdGhpcy5wcm9maWxlID0ga28ub2JzZXJ2YWJsZSgnY3VzdG9tZXInKTtcbn0iLCIvKipcbiAgICBMb2NhdGlvbkVkaXRpb24gYWN0aXZpdHlcbioqL1xuJ3VzZSBzdHJpY3QnO1xudmFyIGtvID0gcmVxdWlyZSgna25vY2tvdXQnKSxcbiAgICBMb2NhdGlvbiA9IHJlcXVpcmUoJy4uL21vZGVscy9Mb2NhdGlvbicpLFxuICAgIE5hdkJhciA9IHJlcXVpcmUoJy4uL3ZpZXdtb2RlbHMvTmF2QmFyJyksXG4gICAgTmF2QWN0aW9uID0gcmVxdWlyZSgnLi4vdmlld21vZGVscy9OYXZBY3Rpb24nKTtcblxudmFyIHNpbmdsZXRvbiA9IG51bGw7XG5cbmV4cG9ydHMuaW5pdCA9IGZ1bmN0aW9uIGluaXRMb2NhdGlvbkVkaXRpb24oJGFjdGl2aXR5LCBhcHApIHtcblxuICAgIGlmIChzaW5nbGV0b24gPT09IG51bGwpXG4gICAgICAgIHNpbmdsZXRvbiA9IG5ldyBMb2NhdGlvbkVkaXRpb25BY3Rpdml0eSgkYWN0aXZpdHksIGFwcCk7XG4gICAgXG4gICAgcmV0dXJuIHNpbmdsZXRvbjtcbn07XG5cbmZ1bmN0aW9uIExvY2F0aW9uRWRpdGlvbkFjdGl2aXR5KCRhY3Rpdml0eSwgYXBwKSB7XG4gICAgXG4gICAgdGhpcy5hY2Nlc3NMZXZlbCA9IGFwcC5Vc2VyVHlwZS5Qcm92aWRlcjtcblxuICAgIHRoaXMuJGFjdGl2aXR5ID0gJGFjdGl2aXR5O1xuICAgIHRoaXMuYXBwID0gYXBwO1xuICAgIHRoaXMuZGF0YVZpZXcgPSBuZXcgVmlld01vZGVsKCk7XG4gICAga28uYXBwbHlCaW5kaW5ncyh0aGlzLmRhdGFWaWV3LCAkYWN0aXZpdHkuZ2V0KDApKTtcbiAgICBcbiAgICB0aGlzLm5hdkJhciA9IG5ldyBOYXZCYXIoe1xuICAgICAgICB0aXRsZTogJycsXG4gICAgICAgIGxlZnRBY3Rpb246IE5hdkFjdGlvbi5nb0JhY2subW9kZWwuY2xvbmUoe1xuICAgICAgICAgICAgdGV4dDogJ0xvY2F0aW9ucydcbiAgICAgICAgfSksXG4gICAgICAgIHJpZ2h0QWN0aW9uOiBOYXZBY3Rpb24uZ29IZWxwSW5kZXhcbiAgICB9KTtcbn1cblxuTG9jYXRpb25FZGl0aW9uQWN0aXZpdHkucHJvdG90eXBlLnNob3cgPSBmdW5jdGlvbiBzaG93KG9wdGlvbnMpIHtcbiAgICAvL2pzaGludCBtYXhjb21wbGV4aXR5OjEwXG4gICAgXG4gICAgdmFyIGlkID0gMCxcbiAgICAgICAgY3JlYXRlID0gJyc7XG5cbiAgICBpZiAob3B0aW9ucykge1xuICAgICAgICBpZiAob3B0aW9ucy5sb2NhdGlvbklEKSB7XG4gICAgICAgICAgICBpZCA9IG9wdGlvbnMubG9jYXRpb25JRDtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIGlmIChvcHRpb25zLnJvdXRlICYmIG9wdGlvbnMucm91dGUuc2VnbWVudHMpIHtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgaWQgPSBwYXJzZUludChvcHRpb25zLnJvdXRlLnNlZ21lbnRzWzBdKTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIGlmIChvcHRpb25zLmNyZWF0ZSkge1xuICAgICAgICAgICAgY3JlYXRlID0gb3B0aW9ucy5jcmVhdGU7XG4gICAgICAgIH1cbiAgICB9XG4gICAgXG4gICAgaWYgKGlkKSB7XG4gICAgICAgIC8vIFRPRE9cbiAgICAgICAgLy8gdmFyIGxvY2F0aW9uID0gdGhpcy5hcHAubW9kZWwuZ2V0TG9jYXRpb24oaWQpXG4gICAgICAgIC8vIE5PVEUgdGVzdGluZyBkYXRhXG4gICAgICAgIHZhciBsb2NhdGlvbnMgPSB7XG4gICAgICAgICAgICAnMSc6IG5ldyBMb2NhdGlvbih7XG4gICAgICAgICAgICAgICAgbG9jYXRpb25JRDogMSxcbiAgICAgICAgICAgICAgICBuYW1lOiAnSG9tZScsXG4gICAgICAgICAgICAgICAgYWRkcmVzc0xpbmUxOiAnSGVyZSBTdHJlZXQnLFxuICAgICAgICAgICAgICAgIGNpdHk6ICdTYW4gRnJhbmNpc2NvJyxcbiAgICAgICAgICAgICAgICBwb3N0YWxDb2RlOiAnOTAwMDEnLFxuICAgICAgICAgICAgICAgIHN0YXRlUHJvdmluY2VDb2RlOiAnQ0EnLFxuICAgICAgICAgICAgICAgIGNvdW50cnlJRDogMSxcbiAgICAgICAgICAgICAgICBpc1NlcnZpY2VSYWRpdXM6IHRydWUsXG4gICAgICAgICAgICAgICAgaXNTZXJ2aWNlTG9jYXRpb246IGZhbHNlXG4gICAgICAgICAgICB9KSxcbiAgICAgICAgICAgICcyJzogbmV3IExvY2F0aW9uKHtcbiAgICAgICAgICAgICAgICBsb2NhdGlvbklEOiAxLFxuICAgICAgICAgICAgICAgIG5hbWU6ICdXb3Jrc2hvcCcsXG4gICAgICAgICAgICAgICAgYWRkcmVzc0xpbmUxOiAnVW5rbm93IFN0cmVldCcsXG4gICAgICAgICAgICAgICAgY2l0eTogJ1NhbiBGcmFuY2lzY28nLFxuICAgICAgICAgICAgICAgIHBvc3RhbENvZGU6ICc5MDAwMScsXG4gICAgICAgICAgICAgICAgc3RhdGVQcm92aW5jZUNvZGU6ICdDQScsXG4gICAgICAgICAgICAgICAgY291bnRyeUlEOiAxLFxuICAgICAgICAgICAgICAgIGlzU2VydmljZVJhZGl1czogZmFsc2UsXG4gICAgICAgICAgICAgICAgaXNTZXJ2aWNlTG9jYXRpb246IHRydWVcbiAgICAgICAgICAgIH0pXG4gICAgICAgIH07XG4gICAgICAgIHZhciBsb2NhdGlvbiA9IGxvY2F0aW9uc1tpZF07XG4gICAgICAgIGlmIChsb2NhdGlvbikge1xuICAgICAgICAgICAgdGhpcy5kYXRhVmlldy5sb2NhdGlvbihsb2NhdGlvbik7XG5cbiAgICAgICAgICAgIHRoaXMuZGF0YVZpZXcuaGVhZGVyKCdFZGl0IExvY2F0aW9uJyk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLmRhdGFWaWV3LmxvY2F0aW9uKG51bGwpO1xuICAgICAgICAgICAgdGhpcy5kYXRhVmlldy5oZWFkZXIoJ1Vua25vdyBsb2NhdGlvbiBvciB3YXMgZGVsZXRlZCcpO1xuICAgICAgICB9XG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgICAvLyBOZXcgbG9jYXRpb25cbiAgICAgICAgdGhpcy5kYXRhVmlldy5sb2NhdGlvbihuZXcgTG9jYXRpb24oKSk7XG4gICAgICAgIFxuICAgICAgICBzd2l0Y2ggKG9wdGlvbnMuY3JlYXRlKSB7XG4gICAgICAgICAgICBjYXNlICdzZXJ2aWNlUmFkaXVzJzpcbiAgICAgICAgICAgICAgICB0aGlzLmRhdGFWaWV3LmxvY2F0aW9uKCkuaXNTZXJ2aWNlUmFkaXVzKHRydWUpO1xuICAgICAgICAgICAgICAgIHRoaXMuZGF0YVZpZXcuaGVhZGVyKCdBZGQgYSBzZXJ2aWNlIHJhZGl1cycpO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgY2FzZSAnc2VydmljZUxvY2F0aW9uJzpcbiAgICAgICAgICAgICAgICB0aGlzLmRhdGFWaWV3LmxvY2F0aW9uKCkuaXNTZXJ2aWNlTG9jYXRpb24odHJ1ZSk7XG4gICAgICAgICAgICAgICAgdGhpcy5kYXRhVmlldy5oZWFkZXIoJ0FkZCBhIHNlcnZpY2UgbG9jYXRpb24nKTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgICAgICAgdGhpcy5kYXRhVmlldy5sb2NhdGlvbigpLmlzU2VydmljZVJhZGl1cyh0cnVlKTtcbiAgICAgICAgICAgICAgICB0aGlzLmRhdGFWaWV3LmxvY2F0aW9uKCkuaXNTZXJ2aWNlTG9jYXRpb24odHJ1ZSk7XG4gICAgICAgICAgICAgICAgdGhpcy5kYXRhVmlldy5oZWFkZXIoJ0FkZCBhIGxvY2F0aW9uJyk7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICB9XG59O1xuXG5mdW5jdGlvbiBWaWV3TW9kZWwoKSB7XG4gICAgXG4gICAgdGhpcy5sb2NhdGlvbiA9IGtvLm9ic2VydmFibGUobmV3IExvY2F0aW9uKCkpO1xuICAgIFxuICAgIHRoaXMuaGVhZGVyID0ga28ub2JzZXJ2YWJsZSgnRWRpdCBMb2NhdGlvbicpO1xuICAgIFxuICAgIC8vIFRPRE9cbiAgICB0aGlzLnNhdmUgPSBmdW5jdGlvbigpIHt9O1xuICAgIHRoaXMuY2FuY2VsID0gZnVuY3Rpb24oKSB7fTtcbn0iLCIvKipcclxuICAgIGxvY2F0aW9ucyBhY3Rpdml0eVxyXG4qKi9cclxuJ3VzZSBzdHJpY3QnO1xyXG5cclxudmFyICQgPSByZXF1aXJlKCdqcXVlcnknKSxcclxuICAgIGtvID0gcmVxdWlyZSgna25vY2tvdXQnKSxcclxuICAgIE5hdkJhciA9IHJlcXVpcmUoJy4uL3ZpZXdtb2RlbHMvTmF2QmFyJyksXHJcbiAgICBOYXZBY3Rpb24gPSByZXF1aXJlKCcuLi92aWV3bW9kZWxzL05hdkFjdGlvbicpO1xyXG4gICAgXHJcbnZhciBzaW5nbGV0b24gPSBudWxsO1xyXG5cclxuZXhwb3J0cy5pbml0ID0gZnVuY3Rpb24gaW5pdExvY2F0aW9ucygkYWN0aXZpdHksIGFwcCkge1xyXG5cclxuICAgIGlmIChzaW5nbGV0b24gPT09IG51bGwpXHJcbiAgICAgICAgc2luZ2xldG9uID0gbmV3IExvY2F0aW9uc0FjdGl2aXR5KCRhY3Rpdml0eSwgYXBwKTtcclxuICAgIFxyXG4gICAgcmV0dXJuIHNpbmdsZXRvbjtcclxufTtcclxuXHJcbmZ1bmN0aW9uIExvY2F0aW9uc0FjdGl2aXR5KCRhY3Rpdml0eSwgYXBwKSB7XHJcbiAgICBcclxuICAgIHRoaXMuYWNjZXNzTGV2ZWwgPSBhcHAuVXNlclR5cGUuUHJvdmlkZXI7XHJcbiAgICB0aGlzLm5hdkJhciA9IG5ldyBOYXZCYXIoe1xyXG4gICAgICAgIHRpdGxlOiAnTG9jYXRpb25zJyxcclxuICAgICAgICBsZWZ0QWN0aW9uOiBOYXZBY3Rpb24ubWVudU5ld0l0ZW0sXHJcbiAgICAgICAgcmlnaHRBY3Rpb246IE5hdkFjdGlvbi5tZW51SW5cclxuICAgIH0pO1xyXG5cclxuICAgIHRoaXMuYXBwID0gYXBwO1xyXG4gICAgdGhpcy4kYWN0aXZpdHkgPSAkYWN0aXZpdHk7XHJcbiAgICB0aGlzLiRsaXN0VmlldyA9ICRhY3Rpdml0eS5maW5kKCcjbG9jYXRpb25zTGlzdFZpZXcnKTtcclxuXHJcbiAgICB2YXIgZGF0YVZpZXcgPSB0aGlzLmRhdGFWaWV3ID0gbmV3IFZpZXdNb2RlbChhcHApO1xyXG4gICAga28uYXBwbHlCaW5kaW5ncyhkYXRhVmlldywgJGFjdGl2aXR5LmdldCgwKSk7XHJcblxyXG4gICAgLy8gVGVzdGluZ0RhdGFcclxuICAgIGRhdGFWaWV3LmxvY2F0aW9ucyhyZXF1aXJlKCcuLi90ZXN0ZGF0YS9sb2NhdGlvbnMnKS5sb2NhdGlvbnMpO1xyXG5cclxuICAgIC8vIEhhbmRsZXIgdG8gdXBkYXRlIGhlYWRlciBiYXNlZCBvbiBhIG1vZGUgY2hhbmdlOlxyXG4gICAgdGhpcy5kYXRhVmlldy5pc1NlbGVjdGlvbk1vZGUuc3Vic2NyaWJlKGZ1bmN0aW9uIChpdElzKSB7XHJcbiAgICAgICAgdGhpcy5kYXRhVmlldy5oZWFkZXJUZXh0KGl0SXMgPyAnU2VsZWN0IG9yIGFkZCBhIHNlcnZpY2UgbG9jYXRpb24nIDogJ0xvY2F0aW9ucycpO1xyXG4gICAgICAgIFxyXG4gICAgICAgIC8vIFVwZGF0ZSBuYXZiYXIgdG9vXHJcbiAgICAgICAgdGhpcy5uYXZCYXIubGVmdEFjdGlvbihOYXZBY3Rpb24uZ29CYWNrLm1vZGVsLmNsb25lKCkpO1xyXG4gICAgICAgIHRoaXMubmF2QmFyLnJpZ2h0QWN0aW9uKE5hdkFjdGlvbi5nb0hlbHBJbmRleCk7XHJcbiAgICAgICAgLy8gVGl0bGUgbXVzdCBiZSBlbXB0eVxyXG4gICAgICAgIHRoaXMubmF2QmFyLnRpdGxlKCcnKTtcclxuICAgICAgICAvLyBUT0RPIFJlcGxhY2VkIGJ5IGEgcHJvZ3Jlc3MgYmFyIG9uIGJvb2tpbmcgY3JlYXRpb25cclxuICAgICAgICAvLyBUT0RPIE9yIGxlZnRBY3Rpb24oKS50ZXh0KC4uKSBvbiBib29raW5nIGVkaXRpb24gKHJldHVybiB0byBib29raW5nKVxyXG4gICAgICAgIC8vIG9yIGNvbWluZyBmcm9tIEpvYnRpdGxlL3NjaGVkdWxlIChyZXR1cm4gdG8gc2NoZWR1bGUvam9iIHRpdGxlKT9cclxuICAgICAgICBcclxuICAgIH0uYmluZCh0aGlzKSk7XHJcblxyXG4gICAgLy8gT2JqZWN0IHRvIGhvbGQgdGhlIG9wdGlvbnMgcGFzc2VkIG9uICdzaG93JyBhcyBhIHJlc3VsdFxyXG4gICAgLy8gb2YgYSByZXF1ZXN0IGZyb20gYW5vdGhlciBhY3Rpdml0eVxyXG4gICAgdGhpcy5yZXF1ZXN0SW5mbyA9IG51bGw7XHJcbiAgICBcclxuICAgIC8vIEhhbmRsZXIgdG8gZ28gYmFjayB3aXRoIHRoZSBzZWxlY3RlZCBsb2NhdGlvbiB3aGVuIFxyXG4gICAgLy8gc2VsZWN0aW9uIG1vZGUgZ29lcyBvZmYgYW5kIHJlcXVlc3RJbmZvIGlzIGZvclxyXG4gICAgLy8gJ3NlbGVjdCBtb2RlJ1xyXG4gICAgdGhpcy5kYXRhVmlldy5pc1NlbGVjdGlvbk1vZGUuc3Vic2NyaWJlKGZ1bmN0aW9uIChpdElzKSB7XHJcbiAgICAgICAgLy8gV2UgaGF2ZSBhIHJlcXVlc3QgYW5kXHJcbiAgICAgICAgLy8gaXQgcmVxdWVzdGVkIHRvIHNlbGVjdCBhIGxvY2F0aW9uXHJcbiAgICAgICAgLy8gYW5kIHNlbGVjdGlvbiBtb2RlIGdvZXMgb2ZmXHJcbiAgICAgICAgaWYgKHRoaXMucmVxdWVzdEluZm8gJiZcclxuICAgICAgICAgICAgdGhpcy5yZXF1ZXN0SW5mby5zZWxlY3RMb2NhdGlvbiA9PT0gdHJ1ZSAmJlxyXG4gICAgICAgICAgICBpdElzID09PSBmYWxzZSkge1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgLy8gUGFzcyB0aGUgc2VsZWN0ZWQgY2xpZW50IGluIHRoZSBpbmZvXHJcbiAgICAgICAgICAgIHRoaXMucmVxdWVzdEluZm8uc2VsZWN0ZWRMb2NhdGlvbiA9IHRoaXMuZGF0YVZpZXcuc2VsZWN0ZWRMb2NhdGlvbigpO1xyXG4gICAgICAgICAgICAvLyBBbmQgZ28gYmFja1xyXG4gICAgICAgICAgICB0aGlzLmFwcC5zaGVsbC5nb0JhY2sodGhpcy5yZXF1ZXN0SW5mbyk7XHJcbiAgICAgICAgICAgIC8vIExhc3QsIGNsZWFyIHJlcXVlc3RJbmZvXHJcbiAgICAgICAgICAgIHRoaXMucmVxdWVzdEluZm8gPSBudWxsO1xyXG4gICAgICAgIH1cclxuICAgIH0uYmluZCh0aGlzKSk7XHJcbn1cclxuXHJcbkxvY2F0aW9uc0FjdGl2aXR5LnByb3RvdHlwZS5zaG93ID0gZnVuY3Rpb24gc2hvdyhvcHRpb25zKSB7XHJcbiAgXHJcbiAgICBvcHRpb25zID0gb3B0aW9ucyB8fCB7fTtcclxuICAgIHRoaXMucmVxdWVzdEluZm8gPSBvcHRpb25zO1xyXG5cclxuICAgIGlmIChvcHRpb25zLnNlbGVjdExvY2F0aW9uID09PSB0cnVlKSB7XHJcbiAgICAgICAgdGhpcy5kYXRhVmlldy5pc1NlbGVjdGlvbk1vZGUodHJ1ZSk7XHJcbiAgICAgICAgLy8gcHJlc2V0OlxyXG4gICAgICAgIHRoaXMuZGF0YVZpZXcuc2VsZWN0ZWRMb2NhdGlvbihvcHRpb25zLnNlbGVjdGVkTG9jYXRpb24pO1xyXG4gICAgfVxyXG4gICAgZWxzZSBpZiAob3B0aW9ucy5yb3V0ZSAmJiBvcHRpb25zLnJvdXRlLnNlZ21lbnRzKSB7XHJcbiAgICAgICAgdmFyIGlkID0gb3B0aW9ucy5yb3V0ZS5zZWdtZW50c1swXTtcclxuICAgICAgICBpZiAoaWQpIHtcclxuICAgICAgICAgICAgaWYgKGlkID09PSAnbmV3Jykge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5hcHAuc2hlbGwuZ28oJ2xvY2F0aW9uRWRpdGlvbicsIHtcclxuICAgICAgICAgICAgICAgICAgICBjcmVhdGU6IG9wdGlvbnMucm91dGUuc2VnbWVudHNbMV0gLy8gJ3NlcnZpY2VSYWRpdXMnLCAnc2VydmljZUxvY2F0aW9uJ1xyXG4gICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgZWxzZSB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLmFwcC5zaGVsbC5nbygnbG9jYXRpb25FZGl0aW9uJywge1xyXG4gICAgICAgICAgICAgICAgICAgIGxvY2F0aW9uSUQ6IGlkXHJcbiAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgIH1cclxufTtcclxuXHJcbmZ1bmN0aW9uIFZpZXdNb2RlbChhcHApIHtcclxuXHJcbiAgICB0aGlzLmhlYWRlclRleHQgPSBrby5vYnNlcnZhYmxlKCdMb2NhdGlvbnMnKTtcclxuXHJcbiAgICAvLyBGdWxsIGxpc3Qgb2YgbG9jYXRpb25zXHJcbiAgICB0aGlzLmxvY2F0aW9ucyA9IGtvLm9ic2VydmFibGVBcnJheShbXSk7XHJcblxyXG4gICAgLy8gRXNwZWNpYWwgbW9kZSB3aGVuIGluc3RlYWQgb2YgcGljayBhbmQgZWRpdCB3ZSBhcmUganVzdCBzZWxlY3RpbmdcclxuICAgIC8vICh3aGVuIGVkaXRpbmcgYW4gYXBwb2ludG1lbnQpXHJcbiAgICB0aGlzLmlzU2VsZWN0aW9uTW9kZSA9IGtvLm9ic2VydmFibGUoZmFsc2UpO1xyXG5cclxuICAgIHRoaXMuc2VsZWN0ZWRMb2NhdGlvbiA9IGtvLm9ic2VydmFibGUobnVsbCk7XHJcbiAgICBcclxuICAgIHRoaXMuc2VsZWN0TG9jYXRpb24gPSBmdW5jdGlvbihzZWxlY3RlZExvY2F0aW9uKSB7XHJcbiAgICAgICAgXHJcbiAgICAgICAgaWYgKHRoaXMuaXNTZWxlY3Rpb25Nb2RlKCkgPT09IHRydWUpIHtcclxuICAgICAgICAgICAgdGhpcy5zZWxlY3RlZExvY2F0aW9uKHNlbGVjdGVkTG9jYXRpb24pO1xyXG4gICAgICAgICAgICB0aGlzLmlzU2VsZWN0aW9uTW9kZShmYWxzZSk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGVsc2Uge1xyXG4gICAgICAgICAgICBhcHAuc2hlbGwuZ28oJ2xvY2F0aW9uRWRpdGlvbicsIHtcclxuICAgICAgICAgICAgICAgIGxvY2F0aW9uSUQ6IHNlbGVjdGVkTG9jYXRpb24ubG9jYXRpb25JRCgpXHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICB9LmJpbmQodGhpcyk7XHJcbn1cclxuIiwiLyoqXG4gICAgTG9naW4gYWN0aXZpdHlcbioqL1xuJ3VzZSBzdHJpY3QnO1xuXG52YXIgJCA9IHJlcXVpcmUoJ2pxdWVyeScpLFxuICAgIGtvID0gcmVxdWlyZSgna25vY2tvdXQnKSxcbiAgVXNlciA9IHJlcXVpcmUoJy4uL21vZGVscy9Vc2VyJyksXG4gICAgTmF2QmFyID0gcmVxdWlyZSgnLi4vdmlld21vZGVscy9OYXZCYXInKSxcbiAgICBOYXZBY3Rpb24gPSByZXF1aXJlKCcuLi92aWV3bW9kZWxzL05hdkFjdGlvbicpO1xuXG52YXIgc2luZ2xldG9uID0gbnVsbDtcblxuZXhwb3J0cy5pbml0ID0gZnVuY3Rpb24gaW5pdExvZ2luKCRhY3Rpdml0eSwgYXBwKSB7XG5cbiAgICBpZiAoc2luZ2xldG9uID09PSBudWxsKVxuICAgICAgICBzaW5nbGV0b24gPSBuZXcgTG9naW5BY3Rpdml0eSgkYWN0aXZpdHksIGFwcCk7XG4gICAgXG4gICAgcmV0dXJuIHNpbmdsZXRvbjtcbn07XG5cbmZ1bmN0aW9uIExvZ2luQWN0aXZpdHkoJGFjdGl2aXR5LCBhcHApIHtcbiAgICBcbiAgICB0aGlzLmFjY2Vzc0xldmVsID0gYXBwLlVzZXJUeXBlLkFub255bW91cztcbiAgICB0aGlzLm5hdkJhciA9IG5ldyBOYXZCYXIoe1xuICAgICAgICB0aXRsZTogJ0xvZyBpbicsXG4gICAgICAgIGxlZnRBY3Rpb246IE5hdkFjdGlvbi5nb0JhY2ssXG4gICAgICAgIHJpZ2h0QWN0aW9uOiBOYXZBY3Rpb24ubWVudU91dFxuICAgIH0pO1xuXG4gICAgdGhpcy4kYWN0aXZpdHkgPSAkYWN0aXZpdHk7XG4gICAgdGhpcy5hcHAgPSBhcHA7XG4gICAgdGhpcy5kYXRhVmlldyA9IG5ldyBWaWV3TW9kZWwoKTtcbiAgICBrby5hcHBseUJpbmRpbmdzKHRoaXMuZGF0YVZpZXcsICRhY3Rpdml0eS5nZXQoMCkpO1xuICAgIFxuICAgIC8vIFBlcmZvcm0gbG9nLWluIHJlcXVlc3Qgd2hlbiBpcyByZXF1ZXN0ZWQgYnkgdGhlIGZvcm06XG4gICAgdGhpcy5kYXRhVmlldy5pc0xvZ2luZ0luLnN1YnNjcmliZShmdW5jdGlvbih2KSB7XG4gICAgICAgIGlmICh2ID09PSB0cnVlKSB7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIC8vIFBlcmZvcm0gbG9naW5nXG4gICAgICAgICAgICBcbiAgICAgICAgICAgIC8vIE5vdGlmeSBzdGF0ZTpcbiAgICAgICAgICAgIHZhciAkYnRuID0gJGFjdGl2aXR5LmZpbmQoJ1t0eXBlPVwic3VibWl0XCJdJyk7XG4gICAgICAgICAgICAkYnRuLmJ1dHRvbignbG9hZGluZycpO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICAvLyBDbGVhciBwcmV2aW91cyBlcnJvciBzbyBtYWtlcyBjbGVhciB3ZVxuICAgICAgICAgICAgLy8gYXJlIGF0dGVtcHRpbmdcbiAgICAgICAgICAgIHRoaXMuZGF0YVZpZXcubG9naW5FcnJvcignJyk7XG4gICAgICAgIFxuICAgICAgICAgICAgdmFyIGVuZGVkID0gZnVuY3Rpb24gZW5kZWQoKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5kYXRhVmlldy5pc0xvZ2luZ0luKGZhbHNlKTtcbiAgICAgICAgICAgICAgICAkYnRuLmJ1dHRvbigncmVzZXQnKTtcbiAgICAgICAgICAgIH0uYmluZCh0aGlzKTtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgLy8gQWZ0ZXIgY2xlYW4tdXAgZXJyb3IgKHRvIGZvcmNlIHNvbWUgdmlldyB1cGRhdGVzKSxcbiAgICAgICAgICAgIC8vIHZhbGlkYXRlIGFuZCBhYm9ydCBvbiBlcnJvclxuICAgICAgICAgICAgLy8gTWFudWFsbHkgY2hlY2tpbmcgZXJyb3Igb24gZWFjaCBmaWVsZFxuICAgICAgICAgICAgaWYgKHRoaXMuZGF0YVZpZXcudXNlcm5hbWUuZXJyb3IoKSB8fFxuICAgICAgICAgICAgICAgIHRoaXMuZGF0YVZpZXcucGFzc3dvcmQuZXJyb3IoKSkge1xuICAgICAgICAgICAgICAgIHRoaXMuZGF0YVZpZXcubG9naW5FcnJvcignUmV2aWV3IHlvdXIgZGF0YScpO1xuICAgICAgICAgICAgICAgIGVuZGVkKCk7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgXG4gICAgICAgICAgICBhcHAubW9kZWwubG9naW4oXG4gICAgICAgICAgICAgICAgdGhpcy5kYXRhVmlldy51c2VybmFtZSgpLFxuICAgICAgICAgICAgICAgIHRoaXMuZGF0YVZpZXcucGFzc3dvcmQoKVxuICAgICAgICAgICAgKS50aGVuKGZ1bmN0aW9uKGxvZ2luRGF0YSkge1xuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIHRoaXMuZGF0YVZpZXcubG9naW5FcnJvcignJyk7XG4gICAgICAgICAgICAgICAgZW5kZWQoKTtcbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAvLyBSZW1vdmUgZm9ybSBkYXRhXG4gICAgICAgICAgICAgICAgdGhpcy5kYXRhVmlldy51c2VybmFtZSgnJyk7XG4gICAgICAgICAgICAgICAgdGhpcy5kYXRhVmlldy5wYXNzd29yZCgnJyk7XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgdGhpcy5hcHAuZ29EYXNoYm9hcmQoKTtcblxuICAgICAgICAgICAgfS5iaW5kKHRoaXMpKS5jYXRjaChmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICB0aGlzLmRhdGFWaWV3LmxvZ2luRXJyb3IoJ0ludmFsaWQgdXNlcm5hbWUgb3IgcGFzc3dvcmQnKTtcbiAgICAgICAgICAgICAgICBlbmRlZCgpO1xuICAgICAgICAgICAgfS5iaW5kKHRoaXMpKTtcbiAgICAgICAgfVxuICAgIH0uYmluZCh0aGlzKSk7XG4gICAgXG4gICAgLy8gRm9jdXMgZmlyc3QgYmFkIGZpZWxkIG9uIGVycm9yXG4gICAgdGhpcy5kYXRhVmlldy5sb2dpbkVycm9yLnN1YnNjcmliZShmdW5jdGlvbihlcnIpIHtcbiAgICAgICAgLy8gTG9naW4gaXMgZWFzeSBzaW5jZSB3ZSBtYXJrIGJvdGggdW5pcXVlIGZpZWxkc1xuICAgICAgICAvLyBhcyBlcnJvciBvbiBsb2dpbkVycm9yIChpdHMgYSBnZW5lcmFsIGZvcm0gZXJyb3IpXG4gICAgICAgIHZhciBpbnB1dCA9ICRhY3Rpdml0eS5maW5kKCc6aW5wdXQnKS5nZXQoMCk7XG4gICAgICAgIGlmIChlcnIpXG4gICAgICAgICAgICBpbnB1dC5mb2N1cygpO1xuICAgICAgICBlbHNlXG4gICAgICAgICAgICBpbnB1dC5ibHVyKCk7XG4gICAgfSk7XG59XG5cbkxvZ2luQWN0aXZpdHkucHJvdG90eXBlLnNob3cgPSBmdW5jdGlvbiBzaG93KG9wdGlvbnMpIHtcbn07XG5cbmZ1bmN0aW9uIFZpZXdNb2RlbCgpIHtcbiAgICBcbiAgICB0aGlzLnVzZXJuYW1lID0ga28ub2JzZXJ2YWJsZSgnJyk7XG4gICAgdGhpcy5wYXNzd29yZCA9IGtvLm9ic2VydmFibGUoJycpO1xuICAgIHRoaXMubG9naW5FcnJvciA9IGtvLm9ic2VydmFibGUoJycpO1xuICAgIFxuICAgIHRoaXMuaXNMb2dpbmdJbiA9IGtvLm9ic2VydmFibGUoZmFsc2UpO1xuICAgIFxuICAgIHRoaXMucGVyZm9ybUxvZ2luID0gZnVuY3Rpb24gcGVyZm9ybUxvZ2luKCkge1xuXG4gICAgICAgIHRoaXMuaXNMb2dpbmdJbih0cnVlKTsgICAgICAgIFxuICAgIH0uYmluZCh0aGlzKTtcbiAgICBcbiAgICAvLyB2YWxpZGF0ZSB1c2VybmFtZSBhcyBhbiBlbWFpbFxuICAgIHZhciBlbWFpbFJlZ2V4cCA9IC9eWy0wLTlBLVphLXohIyQlJicqKy89P15fYHt8fX4uXStAWy0wLTlBLVphLXohIyQlJicqKy89P15fYHt8fX4uXSskLztcbiAgICB0aGlzLnVzZXJuYW1lLmVycm9yID0ga28ub2JzZXJ2YWJsZSgnJyk7XG4gICAgdGhpcy51c2VybmFtZS5zdWJzY3JpYmUoZnVuY3Rpb24odikge1xuICAgICAgICBpZiAodikge1xuICAgICAgICAgICAgaWYgKGVtYWlsUmVnZXhwLnRlc3QodikpIHtcbiAgICAgICAgICAgICAgICB0aGlzLnVzZXJuYW1lLmVycm9yKCcnKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIHRoaXMudXNlcm5hbWUuZXJyb3IoJ0lzIG5vdCBhIHZhbGlkIGVtYWlsJyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICB0aGlzLnVzZXJuYW1lLmVycm9yKCdSZXF1aXJlZCcpO1xuICAgICAgICB9XG4gICAgfS5iaW5kKHRoaXMpKTtcbiAgICBcbiAgICAvLyByZXF1aXJlZCBwYXNzd29yZFxuICAgIHRoaXMucGFzc3dvcmQuZXJyb3IgPSBrby5vYnNlcnZhYmxlKCcnKTtcbiAgICB0aGlzLnBhc3N3b3JkLnN1YnNjcmliZShmdW5jdGlvbih2KSB7XG4gICAgICAgIHZhciBlcnIgPSAnJztcbiAgICAgICAgaWYgKCF2KVxuICAgICAgICAgICAgZXJyID0gJ1JlcXVpcmVkJztcbiAgICAgICAgXG4gICAgICAgIHRoaXMucGFzc3dvcmQuZXJyb3IoZXJyKTtcbiAgICB9LmJpbmQodGhpcykpO1xufVxuIiwiLyoqXG4gICAgTG9nb3V0IGFjdGl2aXR5XG4qKi9cbid1c2Ugc3RyaWN0JztcblxudmFyIHNpbmdsZXRvbiA9IG51bGw7XG5cbmV4cG9ydHMuaW5pdCA9IGZ1bmN0aW9uIGluaXRMb2dvdXQoJGFjdGl2aXR5LCBhcHApIHtcblxuICAgIGlmIChzaW5nbGV0b24gPT09IG51bGwpXG4gICAgICAgIHNpbmdsZXRvbiA9IG5ldyBMb2dvdXRBY3Rpdml0eSgkYWN0aXZpdHksIGFwcCk7XG4gICAgXG4gICAgcmV0dXJuIHNpbmdsZXRvbjtcbn07XG5cbmZ1bmN0aW9uIExvZ291dEFjdGl2aXR5KCRhY3Rpdml0eSwgYXBwKSB7XG4gICAgXG4gICAgdGhpcy5hY2Nlc3NMZXZlbCA9IGFwcC5Vc2VyVHlwZS5Mb2dnZWRVc2VyO1xuXG4gICAgdGhpcy4kYWN0aXZpdHkgPSAkYWN0aXZpdHk7XG4gICAgdGhpcy5hcHAgPSBhcHA7XG59XG5cbkxvZ291dEFjdGl2aXR5LnByb3RvdHlwZS5zaG93ID0gZnVuY3Rpb24gc2hvdyhvcHRpb25zKSB7XG5cbiAgICB0aGlzLmFwcC5tb2RlbC5sb2dvdXQoKS50aGVuKGZ1bmN0aW9uKCkge1xuICAgICAgICAvLyBBbm9ueW1vdXMgdXNlciBhZ2FpblxuICAgICAgICB2YXIgbmV3QW5vbiA9IHRoaXMuYXBwLm1vZGVsLnVzZXIoKS5jb25zdHJ1Y3Rvci5uZXdBbm9ueW1vdXMoKTtcbiAgICAgICAgdGhpcy5hcHAubW9kZWwudXNlcigpLm1vZGVsLnVwZGF0ZVdpdGgobmV3QW5vbik7XG5cbiAgICAgICAgLy8gR28gaW5kZXhcbiAgICAgICAgdGhpcy5hcHAuc2hlbGwuZ28oJy8nKTtcbiAgICAgICAgXG4gICAgfS5iaW5kKHRoaXMpKTtcbn07XG4iLCIvKipcbiAgICBPbmJvYXJkaW5nQ29tcGxldGUgYWN0aXZpdHlcbioqL1xuJ3VzZSBzdHJpY3QnO1xuXG52YXIgc2luZ2xldG9uID0gbnVsbDtcblxuZXhwb3J0cy5pbml0ID0gZnVuY3Rpb24gaW5pdE9uYm9hcmRpbmdDb21wbGV0ZSgkYWN0aXZpdHksIGFwcCkge1xuXG4gICAgaWYgKHNpbmdsZXRvbiA9PT0gbnVsbClcbiAgICAgICAgc2luZ2xldG9uID0gbmV3IE9uYm9hcmRpbmdDb21wbGV0ZUFjdGl2aXR5KCRhY3Rpdml0eSwgYXBwKTtcbiAgICBcbiAgICByZXR1cm4gc2luZ2xldG9uO1xufTtcblxuZnVuY3Rpb24gT25ib2FyZGluZ0NvbXBsZXRlQWN0aXZpdHkoJGFjdGl2aXR5LCBhcHApIHtcblxuICAgIHRoaXMuYWNjZXNzTGV2ZWwgPSBhcHAuVXNlclR5cGUuTG9nZ2VkVXNlcjtcbiAgICBcbiAgICB0aGlzLiRhY3Rpdml0eSA9ICRhY3Rpdml0eTtcbiAgICB0aGlzLmFwcCA9IGFwcDtcbn1cblxuT25ib2FyZGluZ0NvbXBsZXRlQWN0aXZpdHkucHJvdG90eXBlLnNob3cgPSBmdW5jdGlvbiBzaG93KG9wdGlvbnMpIHtcblxufTtcbiIsIi8qKlxuICAgIE9uYm9hcmRpbmdIb21lIGFjdGl2aXR5XG4qKi9cbid1c2Ugc3RyaWN0JztcblxudmFyIHNpbmdsZXRvbiA9IG51bGwsXG4gICAgTmF2QmFyID0gcmVxdWlyZSgnLi4vdmlld21vZGVscy9OYXZCYXInKSxcbiAgICBOYXZBY3Rpb24gPSByZXF1aXJlKCcuLi92aWV3bW9kZWxzL05hdkFjdGlvbicpO1xuXG5leHBvcnRzLmluaXQgPSBmdW5jdGlvbiBpbml0T25ib2FyZGluZ0hvbWUoJGFjdGl2aXR5LCBhcHApIHtcblxuICAgIGlmIChzaW5nbGV0b24gPT09IG51bGwpXG4gICAgICAgIHNpbmdsZXRvbiA9IG5ldyBPbmJvYXJkaW5nSG9tZUFjdGl2aXR5KCRhY3Rpdml0eSwgYXBwKTtcbiAgICBcbiAgICByZXR1cm4gc2luZ2xldG9uO1xufTtcblxuZnVuY3Rpb24gT25ib2FyZGluZ0hvbWVBY3Rpdml0eSgkYWN0aXZpdHksIGFwcCkge1xuXG4gICAgdGhpcy5hY2Nlc3NMZXZlbCA9IGFwcC5Vc2VyVHlwZS5Mb2dnZWRVc2VyO1xuICAgIFxuICAgIHRoaXMuJGFjdGl2aXR5ID0gJGFjdGl2aXR5O1xuICAgIHRoaXMuYXBwID0gYXBwO1xuICAgIFxuICAgIHRoaXMubmF2QmFyID0gbmV3IE5hdkJhcih7XG4gICAgICAgIHRpdGxlOiBudWxsLCAvLyBudWxsIGZvciBMb2dvXG4gICAgICAgIGxlZnRBY3Rpb246IE5hdkFjdGlvbi5nb0xvZ291dCxcbiAgICAgICAgcmlnaHRBY3Rpb246IG51bGxcbiAgICB9KTtcbn1cblxuT25ib2FyZGluZ0hvbWVBY3Rpdml0eS5wcm90b3R5cGUuc2hvdyA9IGZ1bmN0aW9uIHNob3cob3B0aW9ucykge1xuXG59O1xuIiwiLyoqXG4gICAgT25ib2FyZGluZyBQb3NpdGlvbnMgYWN0aXZpdHlcbioqL1xuJ3VzZSBzdHJpY3QnO1xuXG52YXIgJCA9IHJlcXVpcmUoJ2pxdWVyeScpLFxuICAgIGtvID0gcmVxdWlyZSgna25vY2tvdXQnKSxcbiAgICBOYXZCYXIgPSByZXF1aXJlKCcuLi92aWV3bW9kZWxzL05hdkJhcicpLFxuICAgIE5hdkFjdGlvbiA9IHJlcXVpcmUoJy4uL3ZpZXdtb2RlbHMvTmF2QWN0aW9uJyk7XG5cbnZhciBzaW5nbGV0b24gPSBudWxsO1xuXG5leHBvcnRzLmluaXQgPSBmdW5jdGlvbiBpbml0T25ib2FyZGluZ1Bvc2l0aW9ucygkYWN0aXZpdHksIGFwcCkge1xuXG4gICAgaWYgKHNpbmdsZXRvbiA9PT0gbnVsbClcbiAgICAgICAgc2luZ2xldG9uID0gbmV3IE9uYm9hcmRpbmdQb3NpdGlvbnNBY3Rpdml0eSgkYWN0aXZpdHksIGFwcCk7XG4gICAgXG4gICAgcmV0dXJuIHNpbmdsZXRvbjtcbn07XG5cbmZ1bmN0aW9uIE9uYm9hcmRpbmdQb3NpdGlvbnNBY3Rpdml0eSgkYWN0aXZpdHksIGFwcCkge1xuXG4gICAgdGhpcy5hY2Nlc3NMZXZlbCA9IGFwcC5Vc2VyVHlwZS5Qcm92aWRlcjtcbiAgICBcbiAgICB0aGlzLiRhY3Rpdml0eSA9ICRhY3Rpdml0eTtcbiAgICB0aGlzLmFwcCA9IGFwcDtcbiAgICB0aGlzLmRhdGFWaWV3ID0gbmV3IFZpZXdNb2RlbCgpO1xuICAgIGtvLmFwcGx5QmluZGluZ3ModGhpcy5kYXRhVmlldywgJGFjdGl2aXR5LmdldCgwKSk7XG5cbiAgICAvLyBUZXN0aW5nRGF0YVxuICAgIHNldFNvbWVUZXN0aW5nRGF0YSh0aGlzLmRhdGFWaWV3KTtcblxuICAgIC8vIE9iamVjdCB0byBob2xkIHRoZSBvcHRpb25zIHBhc3NlZCBvbiAnc2hvdycgYXMgYSByZXN1bHRcbiAgICAvLyBvZiBhIHJlcXVlc3QgZnJvbSBhbm90aGVyIGFjdGl2aXR5XG4gICAgdGhpcy5yZXF1ZXN0SW5mbyA9IG51bGw7XG4gICAgXG4gICAgdGhpcy5uYXZCYXIgPSBuZXcgTmF2QmFyKHtcbiAgICAgICAgdGl0bGU6ICdKb2IgVGl0bGVzJyxcbiAgICAgICAgbGVmdEFjdGlvbjogTmF2QWN0aW9uLm1lbnVOZXdJdGVtLFxuICAgICAgICByaWdodEFjdGlvbjogTmF2QWN0aW9uLm1lbnVJblxuICAgIH0pO1xufVxuXG5PbmJvYXJkaW5nUG9zaXRpb25zQWN0aXZpdHkucHJvdG90eXBlLnNob3cgPSBmdW5jdGlvbiBzaG93KG9wdGlvbnMpIHtcbiBcbiAgICBvcHRpb25zID0gb3B0aW9ucyB8fCB7fTtcbiAgICB0aGlzLnJlcXVlc3RJbmZvID0gb3B0aW9ucztcbn07XG5cbmZ1bmN0aW9uIFZpZXdNb2RlbCgpIHtcblxuICAgIC8vIEZ1bGwgbGlzdCBvZiBwb3NpdGlvbnNcbiAgICB0aGlzLnBvc2l0aW9ucyA9IGtvLm9ic2VydmFibGVBcnJheShbXSk7XG59XG5cbnZhciBQb3NpdGlvbiA9IHJlcXVpcmUoJy4uL21vZGVscy9Qb3NpdGlvbicpO1xuLy8gVXNlclBvc2l0aW9uIG1vZGVsXG5mdW5jdGlvbiBzZXRTb21lVGVzdGluZ0RhdGEoZGF0YXZpZXcpIHtcbiAgICBcbiAgICBkYXRhdmlldy5wb3NpdGlvbnMucHVzaChuZXcgUG9zaXRpb24oe1xuICAgICAgICBwb3NpdGlvblNpbmd1bGFyOiAnTWFzc2FnZSBUaGVyYXBpc3QnXG4gICAgfSkpO1xuICAgIGRhdGF2aWV3LnBvc2l0aW9ucy5wdXNoKG5ldyBQb3NpdGlvbih7XG4gICAgICAgIHBvc2l0aW9uU2luZ3VsYXI6ICdIb3VzZWtlZXBlcidcbiAgICB9KSk7XG59IiwiLyoqXHJcbiAgICBzZXJ2aWNlcyBhY3Rpdml0eVxyXG4qKi9cclxuJ3VzZSBzdHJpY3QnO1xyXG5cclxudmFyICQgPSByZXF1aXJlKCdqcXVlcnknKSxcclxuICAgIGtvID0gcmVxdWlyZSgna25vY2tvdXQnKSxcclxuICAgIE5hdkJhciA9IHJlcXVpcmUoJy4uL3ZpZXdtb2RlbHMvTmF2QmFyJyksXHJcbiAgICBOYXZBY3Rpb24gPSByZXF1aXJlKCcuLi92aWV3bW9kZWxzL05hdkFjdGlvbicpO1xyXG4gICAgXHJcbnZhciBzaW5nbGV0b24gPSBudWxsO1xyXG5cclxuZXhwb3J0cy5pbml0ID0gZnVuY3Rpb24gaW5pdFNlcnZpY2VzKCRhY3Rpdml0eSwgYXBwKSB7XHJcblxyXG4gICAgaWYgKHNpbmdsZXRvbiA9PT0gbnVsbClcclxuICAgICAgICBzaW5nbGV0b24gPSBuZXcgU2VydmljZXNBY3Rpdml0eSgkYWN0aXZpdHksIGFwcCk7XHJcbiAgICBcclxuICAgIHJldHVybiBzaW5nbGV0b247XHJcbn07XHJcblxyXG5mdW5jdGlvbiBTZXJ2aWNlc0FjdGl2aXR5KCRhY3Rpdml0eSwgYXBwKSB7XHJcblxyXG4gICAgdGhpcy5hY2Nlc3NMZXZlbCA9IGFwcC5Vc2VyVHlwZS5Qcm92aWRlcjtcclxuICAgIHRoaXMubmF2QmFyID0gbmV3IE5hdkJhcih7XHJcbiAgICAgICAgLy8gVE9ETzogb24gc2hvdywgbmVlZCB0byBiZSB1cGRhdGVkIHdpdGggdGhlIEpvYlRpdGxlIG5hbWVcclxuICAgICAgICB0aXRsZTogJ1ByaWNpbmcgYW5kIFNlcnZpY2VzJyxcclxuICAgICAgICBsZWZ0QWN0aW9uOiBOYXZBY3Rpb24uZ29CYWNrLCAvLyBUbyBKb2JUaXRsZXMgbGlzdCBpbnNpZGUgc2NoZWR1bGluZ1xyXG4gICAgICAgIHJpZ2h0QWN0aW9uOiBOYXZBY3Rpb24uZ29IZWxwSW5kZXhcclxuICAgIH0pO1xyXG4gICAgXHJcbiAgICB0aGlzLmFwcCA9IGFwcDtcclxuICAgIHRoaXMuJGFjdGl2aXR5ID0gJGFjdGl2aXR5O1xyXG4gICAgdGhpcy4kbGlzdFZpZXcgPSAkYWN0aXZpdHkuZmluZCgnI3NlcnZpY2VzTGlzdFZpZXcnKTtcclxuXHJcbiAgICB2YXIgZGF0YVZpZXcgPSB0aGlzLmRhdGFWaWV3ID0gbmV3IFZpZXdNb2RlbCgpO1xyXG4gICAga28uYXBwbHlCaW5kaW5ncyhkYXRhVmlldywgJGFjdGl2aXR5LmdldCgwKSk7XHJcblxyXG4gICAgLy8gVGVzdGluZ0RhdGFcclxuICAgIGRhdGFWaWV3LnNlcnZpY2VzKHJlcXVpcmUoJy4uL3Rlc3RkYXRhL3NlcnZpY2VzJykuc2VydmljZXMubWFwKFNlbGVjdGFibGUpKTtcclxuXHJcbiAgICAvLyBPYmplY3QgdG8gaG9sZCB0aGUgb3B0aW9ucyBwYXNzZWQgb24gJ3Nob3cnIGFzIGEgcmVzdWx0XHJcbiAgICAvLyBvZiBhIHJlcXVlc3QgZnJvbSBhbm90aGVyIGFjdGl2aXR5XHJcbiAgICB0aGlzLnJlcXVlc3RJbmZvID0gbnVsbDtcclxuICAgIFxyXG4gICAgLy8gSGFuZGxlciB0byBnbyBiYWNrIHdpdGggdGhlIHNlbGVjdGVkIHNlcnZpY2Ugd2hlbiBcclxuICAgIC8vIHNlbGVjdGlvbiBtb2RlIGdvZXMgb2ZmIGFuZCByZXF1ZXN0SW5mbyBpcyBmb3JcclxuICAgIC8vICdzZWxlY3QgbW9kZSdcclxuICAgIHRoaXMuZGF0YVZpZXcuaXNTZWxlY3Rpb25Nb2RlLnN1YnNjcmliZShmdW5jdGlvbiAoaXRJcykge1xyXG4gICAgICAgIC8vIFdlIGhhdmUgYSByZXF1ZXN0IGFuZFxyXG4gICAgICAgIC8vIGl0IHJlcXVlc3RlZCB0byBzZWxlY3QgYSBzZXJ2aWNlXHJcbiAgICAgICAgLy8gYW5kIHNlbGVjdGlvbiBtb2RlIGdvZXMgb2ZmXHJcbiAgICAgICAgaWYgKHRoaXMucmVxdWVzdEluZm8gJiZcclxuICAgICAgICAgICAgdGhpcy5yZXF1ZXN0SW5mby5zZWxlY3RTZXJ2aWNlcyA9PT0gdHJ1ZSAmJlxyXG4gICAgICAgICAgICBpdElzID09PSBmYWxzZSkge1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgLy8gUGFzcyB0aGUgc2VsZWN0ZWQgY2xpZW50IGluIHRoZSBpbmZvXHJcbiAgICAgICAgICAgIHRoaXMucmVxdWVzdEluZm8uc2VsZWN0ZWRTZXJ2aWNlcyA9IHRoaXMuZGF0YVZpZXcuc2VsZWN0ZWRTZXJ2aWNlcygpO1xyXG4gICAgICAgICAgICAvLyBBbmQgZ28gYmFja1xyXG4gICAgICAgICAgICB0aGlzLmFwcC5zaGVsbC5nb0JhY2sodGhpcy5yZXF1ZXN0SW5mbyk7XHJcbiAgICAgICAgICAgIC8vIExhc3QsIGNsZWFyIHJlcXVlc3RJbmZvXHJcbiAgICAgICAgICAgIHRoaXMucmVxdWVzdEluZm8gPSBudWxsO1xyXG4gICAgICAgIH1cclxuICAgIH0uYmluZCh0aGlzKSk7XHJcbn1cclxuXHJcblNlcnZpY2VzQWN0aXZpdHkucHJvdG90eXBlLnNob3cgPSBmdW5jdGlvbiBzaG93KG9wdGlvbnMpIHtcclxuXHJcbiAgXHJcbiAgICBvcHRpb25zID0gb3B0aW9ucyB8fCB7fTtcclxuICAgIHRoaXMucmVxdWVzdEluZm8gPSBvcHRpb25zO1xyXG5cclxuICAgIGlmIChvcHRpb25zLnNlbGVjdFNlcnZpY2VzID09PSB0cnVlKSB7XHJcbiAgICAgICAgdGhpcy5kYXRhVmlldy5pc1NlbGVjdGlvbk1vZGUodHJ1ZSk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgLyogVHJpYWxzIHRvIHByZXNldHMgdGhlIHNlbGVjdGVkIHNlcnZpY2VzLCBOT1QgV09SS0lOR1xyXG4gICAgICAgIHZhciBzZXJ2aWNlcyA9IChvcHRpb25zLnNlbGVjdGVkU2VydmljZXMgfHwgW10pO1xyXG4gICAgICAgIHZhciBzZWxlY3RlZFNlcnZpY2VzID0gdGhpcy5kYXRhVmlldy5zZWxlY3RlZFNlcnZpY2VzO1xyXG4gICAgICAgIHNlbGVjdGVkU2VydmljZXMucmVtb3ZlQWxsKCk7XHJcbiAgICAgICAgdGhpcy5kYXRhVmlldy5zZXJ2aWNlcygpLmZvckVhY2goZnVuY3Rpb24oc2VydmljZSkge1xyXG4gICAgICAgICAgICBzZXJ2aWNlcy5mb3JFYWNoKGZ1bmN0aW9uKHNlbFNlcnZpY2UpIHtcclxuICAgICAgICAgICAgICAgIGlmIChzZWxTZXJ2aWNlID09PSBzZXJ2aWNlKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgc2VydmljZS5pc1NlbGVjdGVkKHRydWUpO1xyXG4gICAgICAgICAgICAgICAgICAgIHNlbGVjdGVkU2VydmljZXMucHVzaChzZXJ2aWNlKTtcclxuICAgICAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICAgICAgc2VydmljZS5pc1NlbGVjdGVkKGZhbHNlKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgfSk7XHJcbiAgICAgICAgKi9cclxuICAgIH1cclxufTtcclxuXHJcbmZ1bmN0aW9uIFNlbGVjdGFibGUob2JqKSB7XHJcbiAgICBvYmouaXNTZWxlY3RlZCA9IGtvLm9ic2VydmFibGUoZmFsc2UpO1xyXG4gICAgcmV0dXJuIG9iajtcclxufVxyXG5cclxuZnVuY3Rpb24gVmlld01vZGVsKCkge1xyXG5cclxuICAgIC8vIEZ1bGwgbGlzdCBvZiBzZXJ2aWNlc1xyXG4gICAgdGhpcy5zZXJ2aWNlcyA9IGtvLm9ic2VydmFibGVBcnJheShbXSk7XHJcblxyXG4gICAgLy8gRXNwZWNpYWwgbW9kZSB3aGVuIGluc3RlYWQgb2YgcGljayBhbmQgZWRpdCB3ZSBhcmUganVzdCBzZWxlY3RpbmdcclxuICAgIC8vICh3aGVuIGVkaXRpbmcgYW4gYXBwb2ludG1lbnQpXHJcbiAgICB0aGlzLmlzU2VsZWN0aW9uTW9kZSA9IGtvLm9ic2VydmFibGUoZmFsc2UpO1xyXG5cclxuICAgIC8vIEdyb3VwZWQgbGlzdCBvZiBwcmljaW5nczpcclxuICAgIC8vIERlZmluZWQgZ3JvdXBzOiByZWd1bGFyIHNlcnZpY2VzIGFuZCBhZGQtb25zXHJcbiAgICB0aGlzLmdyb3VwZWRTZXJ2aWNlcyA9IGtvLmNvbXB1dGVkKGZ1bmN0aW9uKCl7XHJcblxyXG4gICAgICAgIHZhciBzZXJ2aWNlcyA9IHRoaXMuc2VydmljZXMoKTtcclxuICAgICAgICB2YXIgaXNTZWxlY3Rpb24gPSB0aGlzLmlzU2VsZWN0aW9uTW9kZSgpO1xyXG5cclxuICAgICAgICB2YXIgc2VydmljZXNHcm91cCA9IHtcclxuICAgICAgICAgICAgICAgIGdyb3VwOiBpc1NlbGVjdGlvbiA/ICdTZWxlY3Qgc3RhbmRhbG9uZSBzZXJ2aWNlcycgOiAnU3RhbmRhbG9uZSBzZXJ2aWNlcycsXHJcbiAgICAgICAgICAgICAgICBzZXJ2aWNlczogW11cclxuICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgYWRkb25zR3JvdXAgPSB7XHJcbiAgICAgICAgICAgICAgICBncm91cDogaXNTZWxlY3Rpb24gPyAnU2VsZWN0IGFkZC1vbiBzZXJ2aWNlcycgOiAnQWRkLW9uIHNlcnZpY2VzJyxcclxuICAgICAgICAgICAgICAgIHNlcnZpY2VzOiBbXVxyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICBncm91cHMgPSBbc2VydmljZXNHcm91cCwgYWRkb25zR3JvdXBdO1xyXG5cclxuICAgICAgICBzZXJ2aWNlcy5mb3JFYWNoKGZ1bmN0aW9uKHNlcnZpY2UpIHtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIHZhciBpc0FkZG9uID0gc2VydmljZS5pc0FkZG9uKCk7XHJcbiAgICAgICAgICAgIGlmIChpc0FkZG9uKSB7XHJcbiAgICAgICAgICAgICAgICBhZGRvbnNHcm91cC5zZXJ2aWNlcy5wdXNoKHNlcnZpY2UpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgc2VydmljZXNHcm91cC5zZXJ2aWNlcy5wdXNoKHNlcnZpY2UpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfSk7XHJcblxyXG4gICAgICAgIHJldHVybiBncm91cHM7XHJcblxyXG4gICAgfSwgdGhpcyk7XHJcbiAgICBcclxuICAgIHRoaXMuc2VsZWN0ZWRTZXJ2aWNlcyA9IGtvLm9ic2VydmFibGVBcnJheShbXSk7XHJcbiAgICAvKipcclxuICAgICAgICBUb2dnbGUgdGhlIHNlbGVjdGlvbiBzdGF0dXMgb2YgYSBzZXJ2aWNlLCBhZGRpbmdcclxuICAgICAgICBvciByZW1vdmluZyBpdCBmcm9tIHRoZSAnc2VsZWN0ZWRTZXJ2aWNlcycgYXJyYXkuXHJcbiAgICAqKi9cclxuICAgIHRoaXMudG9nZ2xlU2VydmljZVNlbGVjdGlvbiA9IGZ1bmN0aW9uKHNlcnZpY2UpIHtcclxuICAgICAgICBcclxuICAgICAgICB2YXIgaW5JbmRleCA9IC0xLFxyXG4gICAgICAgICAgICBpc1NlbGVjdGVkID0gdGhpcy5zZWxlY3RlZFNlcnZpY2VzKCkuc29tZShmdW5jdGlvbihzZWxlY3RlZFNlcnZpY2UsIGluZGV4KSB7XHJcbiAgICAgICAgICAgIGlmIChzZWxlY3RlZFNlcnZpY2UgPT09IHNlcnZpY2UpIHtcclxuICAgICAgICAgICAgICAgIGluSW5kZXggPSBpbmRleDtcclxuICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfSk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgc2VydmljZS5pc1NlbGVjdGVkKCFpc1NlbGVjdGVkKTtcclxuXHJcbiAgICAgICAgaWYgKGlzU2VsZWN0ZWQpXHJcbiAgICAgICAgICAgIHRoaXMuc2VsZWN0ZWRTZXJ2aWNlcy5zcGxpY2UoaW5JbmRleCwgMSk7XHJcbiAgICAgICAgZWxzZVxyXG4gICAgICAgICAgICB0aGlzLnNlbGVjdGVkU2VydmljZXMucHVzaChzZXJ2aWNlKTtcclxuXHJcbiAgICB9LmJpbmQodGhpcyk7XHJcbiAgICBcclxuICAgIC8qKlxyXG4gICAgICAgIEVuZHMgdGhlIHNlbGVjdGlvbiBwcm9jZXNzLCByZWFkeSB0byBjb2xsZWN0IHNlbGVjdGlvblxyXG4gICAgICAgIGFuZCBwYXNzaW5nIGl0IHRvIHRoZSByZXF1ZXN0IGFjdGl2aXR5XHJcbiAgICAqKi9cclxuICAgIHRoaXMuZW5kU2VsZWN0aW9uID0gZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgXHJcbiAgICAgICAgdGhpcy5pc1NlbGVjdGlvbk1vZGUoZmFsc2UpO1xyXG4gICAgICAgIFxyXG4gICAgfS5iaW5kKHRoaXMpO1xyXG59XHJcbiIsIi8qKlxuICAgIFNpZ251cCBhY3Rpdml0eVxuKiovXG4ndXNlIHN0cmljdCc7XG5cbnZhciAkID0gcmVxdWlyZSgnanF1ZXJ5JyksXG4gICAga28gPSByZXF1aXJlKCdrbm9ja291dCcpLFxuICAgIE5hdkJhciA9IHJlcXVpcmUoJy4uL3ZpZXdtb2RlbHMvTmF2QmFyJyksXG4gICAgTmF2QWN0aW9uID0gcmVxdWlyZSgnLi4vdmlld21vZGVscy9OYXZBY3Rpb24nKTtcblxudmFyIHNpbmdsZXRvbiA9IG51bGw7XG5cbmV4cG9ydHMuaW5pdCA9IGZ1bmN0aW9uIGluaXRTaWdudXAoJGFjdGl2aXR5LCBhcHApIHtcblxuICAgIGlmIChzaW5nbGV0b24gPT09IG51bGwpXG4gICAgICAgIHNpbmdsZXRvbiA9IG5ldyBTaWdudXBBY3Rpdml0eSgkYWN0aXZpdHksIGFwcCk7XG4gICAgXG4gICAgcmV0dXJuIHNpbmdsZXRvbjtcbn07XG5cbmZ1bmN0aW9uIFNpZ251cEFjdGl2aXR5KCRhY3Rpdml0eSwgYXBwKSB7XG5cbiAgICB0aGlzLmFjY2Vzc0xldmVsID0gYXBwLlVzZXJUeXBlLkFub255bW91cztcbiAgICBcbiAgICB0aGlzLiRhY3Rpdml0eSA9ICRhY3Rpdml0eTtcbiAgICB0aGlzLmFwcCA9IGFwcDtcbiAgICB0aGlzLmRhdGFWaWV3ID0gbmV3IFZpZXdNb2RlbCgpO1xuICAgIGtvLmFwcGx5QmluZGluZ3ModGhpcy5kYXRhVmlldywgJGFjdGl2aXR5LmdldCgwKSk7XG4gICAgXG4gICAgdGhpcy5uYXZCYXIgPSBuZXcgTmF2QmFyKHtcbiAgICAgICAgdGl0bGU6IG51bGwsIC8vIG51bGwgZm9yIExvZ29cbiAgICAgICAgbGVmdEFjdGlvbjogbnVsbCxcbiAgICAgICAgcmlnaHRBY3Rpb246IE5hdkFjdGlvbi5tZW51T3V0XG4gICAgfSk7XG4gICAgXG4gICAgLy8gVE9ETzogaW1wbGVtZW50IHJlYWwgbG9naW5cbiAgICAvLyBURVNUSU5HOiB0aGUgYnV0dG9uIHN0YXRlIHdpdGggYSBmYWtlIGRlbGF5XG4gICAgJGFjdGl2aXR5LmZpbmQoJyNhY2NvdW50U2lnblVwQnRuJykub24oJ2NsaWNrJywgZnVuY3Rpb24gKGUpIHtcbiAgICAgICAgdmFyICRidG4gPSAkKGUudGFyZ2V0KS5idXR0b24oJ2xvYWRpbmcnKTtcblxuICAgICAgICBzZXRUaW1lb3V0KGZ1bmN0aW9uKCkge1xuICAgICAgICBcbiAgICAgICAgICAgICRidG4uYnV0dG9uKCdyZXNldCcpO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICAvLyBURVNUSU5HOiBwb3B1bGF0aW5nIHVzZXJcbiAgICAgICAgICAgIGZha2VTaWdudXAodGhpcy5hcHApO1xuICAgICAgICAgIFxuICAgICAgICAgICAgLy8gTk9URTogb25ib2FyZGluZyBvciBub3Q/XG4gICAgICAgICAgICB2YXIgb25ib2FyZGluZyA9IGZhbHNlO1xuICAgICAgICAgICAgaWYgKG9uYm9hcmRpbmcpIHtcbiAgICAgICAgICAgICAgICB0aGlzLmFwcC5zaGVsbC5nbygnb25ib2FyZGluZ0hvbWUnKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIHRoaXMuYXBwLnNoZWxsLmdvKCdob21lJyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0sIDEwMDApO1xuXG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9LmJpbmQodGhpcykpO1xufVxuXG5TaWdudXBBY3Rpdml0eS5wcm90b3R5cGUuc2hvdyA9IGZ1bmN0aW9uIHNob3cob3B0aW9ucykge1xuXG4gICAgaWYgKG9wdGlvbnMgJiYgb3B0aW9ucy5yb3V0ZSAmJlxuICAgICAgICBvcHRpb25zLnJvdXRlLnNlZ21lbnRzICYmXG4gICAgICAgIG9wdGlvbnMucm91dGUuc2VnbWVudHMubGVuZ3RoKSB7XG4gICAgICAgIHRoaXMuZGF0YVZpZXcucHJvZmlsZShvcHRpb25zLnJvdXRlLnNlZ21lbnRzWzBdKTtcbiAgICB9XG59O1xuXG4vLyBUT0RPOiByZW1vdmUgYWZ0ZXIgaW1wbGVtZW50IHJlYWwgbG9naW5cbmZ1bmN0aW9uIGZha2VTaWdudXAoYXBwKSB7XG4gICAgYXBwLm1vZGVsLnVzZXIubW9kZWwoKS51cGRhdGVXaXRoKGFwcC5tb2RlbC51c2VyKCkuY29uc3RydWN0b3IubmV3QW5vbnltb3VzKCkpO1xufVxuXG5mdW5jdGlvbiBWaWV3TW9kZWwoKSB7XG4gICAgdGhpcy5wcm9maWxlID0ga28ub2JzZXJ2YWJsZSgnY3VzdG9tZXInKTtcbn0iLCIvKipcclxuICAgIHRleHRFZGl0b3IgYWN0aXZpdHlcclxuKiovXHJcbid1c2Ugc3RyaWN0JztcclxuXHJcbnZhciAkID0gcmVxdWlyZSgnanF1ZXJ5JyksXHJcbiAgICBrbyA9IHJlcXVpcmUoJ2tub2Nrb3V0JyksXHJcbiAgICBFdmVudEVtaXR0ZXIgPSByZXF1aXJlKCdldmVudHMnKS5FdmVudEVtaXR0ZXIsXHJcbiAgICBOYXZCYXIgPSByZXF1aXJlKCcuLi92aWV3bW9kZWxzL05hdkJhcicpLFxyXG4gICAgTmF2QWN0aW9uID0gcmVxdWlyZSgnLi4vdmlld21vZGVscy9OYXZBY3Rpb24nKTtcclxuICAgIFxyXG52YXIgc2luZ2xldG9uID0gbnVsbDtcclxuXHJcbmV4cG9ydHMuaW5pdCA9IGZ1bmN0aW9uIGluaXRUZXh0RWRpdG9yKCRhY3Rpdml0eSwgYXBwKSB7XHJcbiAgICBcclxuICAgIGlmIChzaW5nbGV0b24gPT09IG51bGwpXHJcbiAgICAgICAgc2luZ2xldG9uID0gbmV3IFRleHRFZGl0b3JBY3Rpdml0eSgkYWN0aXZpdHksIGFwcCk7XHJcbiAgICBcclxuICAgIHJldHVybiBzaW5nbGV0b247XHJcbn07XHJcblxyXG5mdW5jdGlvbiBUZXh0RWRpdG9yQWN0aXZpdHkoJGFjdGl2aXR5LCBhcHApIHtcclxuXHJcbiAgICB0aGlzLm5hdkJhciA9IG5ldyBOYXZCYXIoe1xyXG4gICAgICAgIC8vIFRpdGxlIGlzIGVtcHR5IGV2ZXIsIHNpbmNlIHdlIGFyZSBpbiAnZ28gYmFjaycgbW9kZSBhbGwgdGhlIHRpbWUgaGVyZVxyXG4gICAgICAgIHRpdGxlOiAnJyxcclxuICAgICAgICAvLyBidXQgbGVmdEFjdGlvbi50ZXh0IGlzIHVwZGF0ZWQgb24gJ3Nob3cnIHdpdGggcGFzc2VkIHZhbHVlLFxyXG4gICAgICAgIC8vIHNvIHdlIG5lZWQgYSBjbG9uZSB0byBub3QgbW9kaWZ5IHRoZSBzaGFyZWQgc3RhdGljIGluc3RhbmNlXHJcbiAgICAgICAgbGVmdEFjdGlvbjogTmF2QWN0aW9uLmdvQmFjay5tb2RlbC5jbG9uZSh7IGlzVGl0bGU6IHRydWUgfSksXHJcbiAgICAgICAgcmlnaHRBY3Rpb246IE5hdkFjdGlvbi5nb0hlbHBJbmRleFxyXG4gICAgfSk7XHJcbiAgICBcclxuICAgIC8vIEZpZWxkc1xyXG4gICAgdGhpcy4kYWN0aXZpdHkgPSAkYWN0aXZpdHk7XHJcbiAgICB0aGlzLmFwcCA9IGFwcDtcclxuICAgIHRoaXMuJHRleHRhcmVhID0gdGhpcy4kYWN0aXZpdHkuZmluZCgndGV4dGFyZWEnKTtcclxuICAgIHRoaXMudGV4dGFyZWEgPSB0aGlzLiR0ZXh0YXJlYS5nZXQoMCk7XHJcblxyXG4gICAgLy8gRGF0YVxyXG4gICAgdGhpcy5kYXRhVmlldyA9IG5ldyBWaWV3TW9kZWwoKTtcclxuICAgIGtvLmFwcGx5QmluZGluZ3ModGhpcy5kYXRhVmlldywgJGFjdGl2aXR5LmdldCgwKSk7XHJcbiAgICBcclxuICAgIC8vIE9iamVjdCB0byBob2xkIHRoZSBvcHRpb25zIHBhc3NlZCBvbiAnc2hvdycgYXMgYSByZXN1bHRcclxuICAgIC8vIG9mIGEgcmVxdWVzdCBmcm9tIGFub3RoZXIgYWN0aXZpdHlcclxuICAgIHRoaXMucmVxdWVzdEluZm8gPSBudWxsO1xyXG4gICAgXHJcbiAgICAvLyBIYW5kbGVyc1xyXG4gICAgLy8gSGFuZGxlciBmb3IgdGhlICdzYXZlZCcgZXZlbnQgc28gdGhlIGFjdGl2aXR5XHJcbiAgICAvLyByZXR1cm5zIGJhY2sgdG8gdGhlIHJlcXVlc3RlciBhY3Rpdml0eSBnaXZpbmcgaXRcclxuICAgIC8vIHRoZSBuZXcgdGV4dFxyXG4gICAgdGhpcy5kYXRhVmlldy5vbignc2F2ZWQnLCBmdW5jdGlvbigpIHtcclxuICAgICAgICBpZiAodGhpcy5yZXF1ZXN0SW5mbykge1xyXG4gICAgICAgICAgICAvLyBVcGRhdGUgdGhlIGluZm8gd2l0aCB0aGUgbmV3IHRleHRcclxuICAgICAgICAgICAgdGhpcy5yZXF1ZXN0SW5mby50ZXh0ID0gdGhpcy5kYXRhVmlldy50ZXh0KCk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICAvLyBhbmQgcGFzcyBpdCBiYWNrXHJcbiAgICAgICAgdGhpcy5hcHAuc2hlbGwuZ29CYWNrKHRoaXMucmVxdWVzdEluZm8pO1xyXG4gICAgfS5iaW5kKHRoaXMpKTtcclxuIFxyXG4gICAgLy8gSGFuZGxlciB0aGUgY2FuY2VsIGV2ZW50XHJcbiAgICB0aGlzLmRhdGFWaWV3Lm9uKCdjYW5jZWwnLCBmdW5jdGlvbigpIHtcclxuICAgICAgICAvLyByZXR1cm4sIG5vdGhpbmcgY2hhbmdlZFxyXG4gICAgICAgIGFwcC5zaGVsbC5nb0JhY2soKTtcclxuICAgIH0uYmluZCh0aGlzKSk7XHJcbn1cclxuXHJcblRleHRFZGl0b3JBY3Rpdml0eS5wcm90b3R5cGUuc2hvdyA9IGZ1bmN0aW9uIHNob3cob3B0aW9ucykge1xyXG4gICAgXHJcbiAgICBvcHRpb25zID0gb3B0aW9ucyB8fCB7fTtcclxuICAgIHRoaXMucmVxdWVzdEluZm8gPSBvcHRpb25zO1xyXG5cclxuICAgIC8vIFNldCBuYXZpZ2F0aW9uIHRpdGxlIG9yIG5vdGhpbmdcclxuICAgIHRoaXMubmF2QmFyLmxlZnRBY3Rpb24oKS50ZXh0KG9wdGlvbnMudGl0bGUgfHwgJycpO1xyXG4gICAgXHJcbiAgICAvLyBGaWVsZCBoZWFkZXJcclxuICAgIHRoaXMuZGF0YVZpZXcuaGVhZGVyVGV4dChvcHRpb25zLmhlYWRlcik7XHJcbiAgICB0aGlzLmRhdGFWaWV3LnRleHQob3B0aW9ucy50ZXh0KTtcclxuICAgIGlmIChvcHRpb25zLnJvd3NOdW1iZXIpXHJcbiAgICAgICAgdGhpcy5kYXRhVmlldy5yb3dzTnVtYmVyKG9wdGlvbnMucm93c051bWJlcik7XHJcbiAgICAgICAgXHJcbiAgICAvLyBJbm1lZGlhdGUgZm9jdXMgdG8gdGhlIHRleHRhcmVhIGZvciBiZXR0ZXIgdXNhYmlsaXR5XHJcbiAgICB0aGlzLnRleHRhcmVhLmZvY3VzKCk7XHJcbiAgICB0aGlzLiR0ZXh0YXJlYS5jbGljaygpO1xyXG59O1xyXG5cclxuZnVuY3Rpb24gVmlld01vZGVsKCkge1xyXG5cclxuICAgIHRoaXMuaGVhZGVyVGV4dCA9IGtvLm9ic2VydmFibGUoJ1RleHQnKTtcclxuXHJcbiAgICAvLyBUZXh0IHRvIGVkaXRcclxuICAgIHRoaXMudGV4dCA9IGtvLm9ic2VydmFibGUoJycpO1xyXG4gICAgXHJcbiAgICAvLyBOdW1iZXIgb2Ygcm93cyBmb3IgdGhlIHRleHRhcmVhXHJcbiAgICB0aGlzLnJvd3NOdW1iZXIgPSBrby5vYnNlcnZhYmxlKDIpO1xyXG5cclxuICAgIHRoaXMuY2FuY2VsID0gZnVuY3Rpb24gY2FuY2VsKCkge1xyXG4gICAgICAgIHRoaXMuZW1pdCgnY2FuY2VsJyk7XHJcbiAgICB9O1xyXG4gICAgXHJcbiAgICB0aGlzLnNhdmUgPSBmdW5jdGlvbiBzYXZlKCkge1xyXG4gICAgICAgIHRoaXMuZW1pdCgnc2F2ZWQnKTtcclxuICAgIH07XHJcbn1cclxuXHJcblZpZXdNb2RlbC5faW5oZXJpdHMoRXZlbnRFbWl0dGVyKTtcclxuIiwiLyoqXHJcbiAgICBSZWdpc3RyYXRpb24gb2YgY3VzdG9tIGh0bWwgY29tcG9uZW50cyB1c2VkIGJ5IHRoZSBBcHAuXHJcbiAgICBBbGwgd2l0aCAnYXBwLScgYXMgcHJlZml4LlxyXG4gICAgXHJcbiAgICBTb21lIGRlZmluaXRpb25zIG1heSBiZSBpbmNsdWRlZCBvbi1saW5lIHJhdGhlciB0aGFuIG9uIHNlcGFyYXRlZFxyXG4gICAgZmlsZXMgKHZpZXdtb2RlbHMpLCB0ZW1wbGF0ZXMgYXJlIGxpbmtlZCBzbyBuZWVkIHRvIGJlIFxyXG4gICAgaW5jbHVkZWQgaW4gdGhlIGh0bWwgZmlsZSB3aXRoIHRoZSBzYW1lIElEIHRoYXQgcmVmZXJlbmNlZCBoZXJlLFxyXG4gICAgdXN1YWxseSB1c2luZyBhcyBET00gSUQgdGhlIHNhbWUgbmFtZSBhcyB0aGUgY29tcG9uZW50IHdpdGggc3VmaXggJy10ZW1wbGF0ZScuXHJcbioqL1xyXG4ndXNlIHN0cmljdCc7XHJcblxyXG52YXIga28gPSByZXF1aXJlKCdrbm9ja291dCcpO1xyXG52YXIgcHJvcFRvb2xzID0gcmVxdWlyZSgnLi91dGlscy9qc1Byb3BlcnRpZXNUb29scycpO1xyXG5cclxuZnVuY3Rpb24gZ2V0T2JzZXJ2YWJsZShvYnNPclZhbHVlKSB7XHJcbiAgICBpZiAodHlwZW9mKG9ic09yVmFsdWUpID09PSAnZnVuY3Rpb24nKVxyXG4gICAgICAgIHJldHVybiBvYnNPclZhbHVlO1xyXG4gICAgZWxzZVxyXG4gICAgICAgIHJldHVybiBrby5vYnNlcnZhYmxlKG9ic09yVmFsdWUpO1xyXG59XHJcblxyXG5leHBvcnRzLnJlZ2lzdGVyQWxsID0gZnVuY3Rpb24oKSB7XHJcbiAgICBcclxuICAgIC8vLyBuYXZiYXItYWN0aW9uXHJcbiAgICBrby5jb21wb25lbnRzLnJlZ2lzdGVyKCdhcHAtbmF2YmFyLWFjdGlvbicsIHtcclxuICAgICAgICB0ZW1wbGF0ZTogeyBlbGVtZW50OiAnbmF2YmFyLWFjdGlvbi10ZW1wbGF0ZScgfSxcclxuICAgICAgICB2aWV3TW9kZWw6IGZ1bmN0aW9uKHBhcmFtcykge1xyXG5cclxuICAgICAgICAgICAgcHJvcFRvb2xzLmRlZmluZUdldHRlcih0aGlzLCAnYWN0aW9uJywgZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gKFxyXG4gICAgICAgICAgICAgICAgICAgIHBhcmFtcy5hY3Rpb24gJiYgcGFyYW1zLm5hdkJhcigpID9cclxuICAgICAgICAgICAgICAgICAgICBwYXJhbXMubmF2QmFyKClbcGFyYW1zLmFjdGlvbl0oKSA6XHJcbiAgICAgICAgICAgICAgICAgICAgbnVsbFxyXG4gICAgICAgICAgICAgICAgKTtcclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgfVxyXG4gICAgfSk7XHJcbiAgICBcclxuICAgIC8vLyB1bmxhYmVsZWQtaW5wdXRcclxuICAgIGtvLmNvbXBvbmVudHMucmVnaXN0ZXIoJ2FwcC11bmxhYmVsZWQtaW5wdXQnLCB7XHJcbiAgICAgICAgdGVtcGxhdGU6IHsgZWxlbWVudDogJ3VubGFiZWxlZC1pbnB1dC10ZW1wbGF0ZScgfSxcclxuICAgICAgICB2aWV3TW9kZWw6IGZ1bmN0aW9uKHBhcmFtcykge1xyXG5cclxuICAgICAgICAgICAgdGhpcy52YWx1ZSA9IGdldE9ic2VydmFibGUocGFyYW1zLnZhbHVlKTtcclxuICAgICAgICAgICAgdGhpcy5wbGFjZWhvbGRlciA9IGdldE9ic2VydmFibGUocGFyYW1zLnBsYWNlaG9sZGVyKTtcclxuICAgICAgICB9XHJcbiAgICB9KTtcclxufTtcclxuIiwiLyoqXHJcbiAgICBOYXZiYXIgZXh0ZW5zaW9uIG9mIHRoZSBBcHAsXHJcbiAgICBhZGRzIHRoZSBlbGVtZW50cyB0byBtYW5hZ2UgYSB2aWV3IG1vZGVsXHJcbiAgICBmb3IgdGhlIE5hdkJhciBhbmQgYXV0b21hdGljIGNoYW5nZXNcclxuICAgIHVuZGVyIHNvbWUgbW9kZWwgY2hhbmdlcyBsaWtlIHVzZXIgbG9naW4vbG9nb3V0XHJcbioqL1xyXG4ndXNlIHN0cmljdCc7XHJcblxyXG52YXIga28gPSByZXF1aXJlKCdrbm9ja291dCcpLFxyXG4gICAgJCA9IHJlcXVpcmUoJ2pxdWVyeScpLFxyXG4gICAgTmF2QmFyID0gcmVxdWlyZSgnLi92aWV3bW9kZWxzL05hdkJhcicpLFxyXG4gICAgTmF2QWN0aW9uID0gcmVxdWlyZSgnLi92aWV3bW9kZWxzL05hdkFjdGlvbicpO1xyXG5cclxuZXhwb3J0cy5leHRlbmRzID0gZnVuY3Rpb24gKGFwcCkge1xyXG4gICAgXHJcbiAgICAvLyBSRVZJRVc6IHN0aWxsIG5lZWRlZD8gTWF5YmUgdGhlIHBlciBhY3Rpdml0eSBuYXZCYXIgbWVhbnNcclxuICAgIC8vIHRoaXMgaXMgbm90IG5lZWRlZC4gU29tZSBwcmV2aW91cyBsb2dpYyB3YXMgYWxyZWFkeSByZW1vdmVkXHJcbiAgICAvLyBiZWNhdXNlIHdhcyB1c2VsZXNzLlxyXG4gICAgLy9cclxuICAgIC8vIEFkanVzdCB0aGUgbmF2YmFyIHNldHVwIGRlcGVuZGluZyBvbiBjdXJyZW50IHVzZXIsXHJcbiAgICAvLyBzaW5jZSBkaWZmZXJlbnQgdGhpbmdzIGFyZSBuZWVkIGZvciBsb2dnZWQtaW4vb3V0LlxyXG4gICAgZnVuY3Rpb24gYWRqdXN0VXNlckJhcigpIHtcclxuXHJcbiAgICAgICAgdmFyIHVzZXIgPSBhcHAubW9kZWwudXNlcigpO1xyXG5cclxuICAgICAgICBpZiAodXNlci5pc0Fub255bW91cygpKSB7XHJcbiAgICAgICAgICAgIGFwcC5uYXZCYXIoKS5yaWdodEFjdGlvbihOYXZBY3Rpb24ubWVudU91dCk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG4gICAgLy8gQ29tbWVudGVkIGxpbmVzLCB1c2VkIHByZXZpb3VzbHkgYnV0IHVudXNlZCBub3csIGl0IG11c3QgYmUgZW5vdWdoIHdpdGggdGhlIHVwZGF0ZVxyXG4gICAgLy8gcGVyIGFjdGl2aXR5IGNoYW5nZVxyXG4gICAgLy9hcHAubW9kZWwudXNlcigpLmlzQW5vbnltb3VzLnN1YnNjcmliZSh1cGRhdGVTdGF0ZXNPblVzZXJDaGFuZ2UpO1xyXG4gICAgLy9hcHAubW9kZWwudXNlcigpLm9uYm9hcmRpbmdTdGVwLnN1YnNjcmliZSh1cGRhdGVTdGF0ZXNPblVzZXJDaGFuZ2UpO1xyXG4gICAgXHJcbiAgICBhcHAubmF2QmFyID0ga28ub2JzZXJ2YWJsZShudWxsKTtcclxuICAgIFxyXG4gICAgdmFyIHJlZnJlc2hOYXYgPSBmdW5jdGlvbiByZWZyZXNoTmF2KCkge1xyXG4gICAgICAgIC8vIFRyaWdnZXIgZXZlbnQgdG8gZm9yY2UgYSBjb21wb25lbnQgdXBkYXRlXHJcbiAgICAgICAgJCgnLkFwcE5hdicpLnRyaWdnZXIoJ2NvbnRlbnRDaGFuZ2UnKTtcclxuICAgIH07XHJcbiAgICB2YXIgYXV0b1JlZnJlc2hOYXYgPSBmdW5jdGlvbiBhdXRvUmVmcmVzaE5hdihhY3Rpb24pIHtcclxuICAgICAgICBpZiAoYWN0aW9uKSB7XHJcbiAgICAgICAgICAgIGFjdGlvbi50ZXh0LnN1YnNjcmliZShyZWZyZXNoTmF2KTtcclxuICAgICAgICAgICAgYWN0aW9uLmlzVGl0bGUuc3Vic2NyaWJlKHJlZnJlc2hOYXYpO1xyXG4gICAgICAgICAgICBhY3Rpb24uaWNvbi5zdWJzY3JpYmUocmVmcmVzaE5hdik7XHJcbiAgICAgICAgICAgIGFjdGlvbi5pc01lbnUuc3Vic2NyaWJlKHJlZnJlc2hOYXYpO1xyXG4gICAgICAgIH1cclxuICAgIH07XHJcblxyXG4gICAgLyoqXHJcbiAgICAgICAgVXBkYXRlIHRoZSBuYXYgbW9kZWwgdXNpbmcgdGhlIEFjdGl2aXR5IGRlZmF1bHRzXHJcbiAgICAqKi9cclxuICAgIGFwcC51cGRhdGVBcHBOYXYgPSBmdW5jdGlvbiB1cGRhdGVBcHBOYXYoYWN0aXZpdHkpIHtcclxuXHJcbiAgICAgICAgLy8gaWYgdGhlIGFjdGl2aXR5IGhhcyBpdHMgb3duXHJcbiAgICAgICAgaWYgKCduYXZCYXInIGluIGFjdGl2aXR5KSB7XHJcbiAgICAgICAgICAgIC8vIFVzZSBzcGVjaWFsaXppZWQgYWN0aXZpdHkgYmFyIGRhdGFcclxuICAgICAgICAgICAgYXBwLm5hdkJhcihhY3Rpdml0eS5uYXZCYXIpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBlbHNlIHtcclxuICAgICAgICAgICAgLy8gVXNlIGRlZmF1bHQgb25lXHJcbiAgICAgICAgICAgIGFwcC5uYXZCYXIobmV3IE5hdkJhcigpKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIC8vIFRPRE8gRG91YmxlIGNoZWNrIGlmIG5lZWRlZC5cclxuICAgICAgICAvLyBMYXRlc3QgY2hhbmdlcywgd2hlbiBuZWVkZWRcclxuICAgICAgICBhZGp1c3RVc2VyQmFyKCk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgcmVmcmVzaE5hdigpO1xyXG4gICAgICAgIGF1dG9SZWZyZXNoTmF2KGFwcC5uYXZCYXIoKS5sZWZ0QWN0aW9uKCkpO1xyXG4gICAgICAgIGF1dG9SZWZyZXNoTmF2KGFwcC5uYXZCYXIoKS5yaWdodEFjdGlvbigpKTtcclxuICAgIH07XHJcbiAgICBcclxuICAgIFxyXG4gICAgLyoqXHJcbiAgICAgICAgVXBkYXRlIHRoZSBhcHAgbWVudSB0byBoaWdobGlnaHQgdGhlXHJcbiAgICAgICAgZ2l2ZW4gbGluayBuYW1lXHJcbiAgICAqKi9cclxuICAgIGFwcC51cGRhdGVNZW51ID0gZnVuY3Rpb24gdXBkYXRlTWVudShuYW1lKSB7XHJcbiAgICAgICAgXHJcbiAgICAgICAgdmFyICRtZW51ID0gJCgnLkFwcC1tZW51cyAubmF2YmFyLWNvbGxhcHNlJyk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgLy8gUmVtb3ZlIGFueSBhY3RpdmVcclxuICAgICAgICAkbWVudVxyXG4gICAgICAgIC5maW5kKCdsaScpXHJcbiAgICAgICAgLnJlbW92ZUNsYXNzKCdhY3RpdmUnKTtcclxuICAgICAgICAvLyBBZGQgYWN0aXZlXHJcbiAgICAgICAgJG1lbnVcclxuICAgICAgICAuZmluZCgnLmdvLScgKyBuYW1lKVxyXG4gICAgICAgIC5jbG9zZXN0KCdsaScpXHJcbiAgICAgICAgLmFkZENsYXNzKCdhY3RpdmUnKTtcclxuICAgICAgICAvLyBIaWRlIG1lbnVcclxuICAgICAgICAkbWVudVxyXG4gICAgICAgIC5maWx0ZXIoJzp2aXNpYmxlJylcclxuICAgICAgICAuY29sbGFwc2UoJ2hpZGUnKTtcclxuICAgIH07XHJcbn07XHJcbiIsIi8qKlxyXG4gICAgTGlzdCBvZiBhY3Rpdml0aWVzIGxvYWRlZCBpbiB0aGUgQXBwLFxyXG4gICAgYXMgYW4gb2JqZWN0IHdpdGggdGhlIGFjdGl2aXR5IG5hbWUgYXMgdGhlIGtleVxyXG4gICAgYW5kIHRoZSBjb250cm9sbGVyIGFzIHZhbHVlLlxyXG4qKi9cclxuJ3VzZSBzdHJpY3QnO1xyXG5cclxubW9kdWxlLmV4cG9ydHMgPSB7XHJcbiAgICAnY2FsZW5kYXInOiByZXF1aXJlKCcuL2FjdGl2aXRpZXMvY2FsZW5kYXInKSxcclxuICAgICdkYXRldGltZVBpY2tlcic6IHJlcXVpcmUoJy4vYWN0aXZpdGllcy9kYXRldGltZVBpY2tlcicpLFxyXG4gICAgJ2NsaWVudHMnOiByZXF1aXJlKCcuL2FjdGl2aXRpZXMvY2xpZW50cycpLFxyXG4gICAgJ3NlcnZpY2VzJzogcmVxdWlyZSgnLi9hY3Rpdml0aWVzL3NlcnZpY2VzJyksXHJcbiAgICAnbG9jYXRpb25zJzogcmVxdWlyZSgnLi9hY3Rpdml0aWVzL2xvY2F0aW9ucycpLFxyXG4gICAgJ3RleHRFZGl0b3InOiByZXF1aXJlKCcuL2FjdGl2aXRpZXMvdGV4dEVkaXRvcicpLFxyXG4gICAgJ2hvbWUnOiByZXF1aXJlKCcuL2FjdGl2aXRpZXMvaG9tZScpLFxyXG4gICAgJ2FwcG9pbnRtZW50JzogcmVxdWlyZSgnLi9hY3Rpdml0aWVzL2FwcG9pbnRtZW50JyksXHJcbiAgICAnYm9va2luZ0NvbmZpcm1hdGlvbic6IHJlcXVpcmUoJy4vYWN0aXZpdGllcy9ib29raW5nQ29uZmlybWF0aW9uJyksXHJcbiAgICAnaW5kZXgnOiByZXF1aXJlKCcuL2FjdGl2aXRpZXMvaW5kZXgnKSxcclxuICAgICdsb2dpbic6IHJlcXVpcmUoJy4vYWN0aXZpdGllcy9sb2dpbicpLFxyXG4gICAgJ2xvZ291dCc6IHJlcXVpcmUoJy4vYWN0aXZpdGllcy9sb2dvdXQnKSxcclxuICAgICdsZWFybk1vcmUnOiByZXF1aXJlKCcuL2FjdGl2aXRpZXMvbGVhcm5Nb3JlJyksXHJcbiAgICAnc2lnbnVwJzogcmVxdWlyZSgnLi9hY3Rpdml0aWVzL3NpZ251cCcpLFxyXG4gICAgJ2NvbnRhY3RJbmZvJzogcmVxdWlyZSgnLi9hY3Rpdml0aWVzL2NvbnRhY3RJbmZvJyksXHJcbiAgICAnb25ib2FyZGluZ1Bvc2l0aW9ucyc6IHJlcXVpcmUoJy4vYWN0aXZpdGllcy9vbmJvYXJkaW5nUG9zaXRpb25zJyksXHJcbiAgICAnb25ib2FyZGluZ0hvbWUnOiByZXF1aXJlKCcuL2FjdGl2aXRpZXMvb25ib2FyZGluZ0hvbWUnKSxcclxuICAgICdsb2NhdGlvbkVkaXRpb24nOiByZXF1aXJlKCcuL2FjdGl2aXRpZXMvbG9jYXRpb25FZGl0aW9uJyksXHJcbiAgICAnb25ib2FyZGluZ0NvbXBsZXRlJzogcmVxdWlyZSgnLi9hY3Rpdml0aWVzL29uYm9hcmRpbmdDb21wbGV0ZScpLFxyXG4gICAgJ2FjY291bnQnOiByZXF1aXJlKCcuL2FjdGl2aXRpZXMvYWNjb3VudCcpXHJcbn07XHJcbiIsIid1c2Ugc3RyaWN0JztcclxuXHJcbi8qKiBHbG9iYWwgZGVwZW5kZW5jaWVzICoqL1xyXG52YXIgJCA9IHJlcXVpcmUoJ2pxdWVyeScpO1xyXG5yZXF1aXJlKCdqcXVlcnktbW9iaWxlJyk7XHJcbnZhciBrbyA9IHJlcXVpcmUoJ2tub2Nrb3V0Jyk7XHJcbmtvLmJpbmRpbmdIYW5kbGVycy5mb3JtYXQgPSByZXF1aXJlKCdrby9mb3JtYXRCaW5kaW5nJykuZm9ybWF0QmluZGluZztcclxudmFyIGJvb3Rrbm9jayA9IHJlcXVpcmUoJy4vdXRpbHMvYm9vdGtub2NrQmluZGluZ0hlbHBlcnMnKTtcclxucmVxdWlyZSgnLi91dGlscy9GdW5jdGlvbi5wcm90b3R5cGUuX2luaGVyaXRzJyk7XHJcbnJlcXVpcmUoJy4vdXRpbHMvRnVuY3Rpb24ucHJvdG90eXBlLl9kZWxheWVkJyk7XHJcbi8vIFByb21pc2UgcG9seWZpbGwsIHNvIGl0cyBub3QgJ3JlcXVpcmUnZCBwZXIgbW9kdWxlOlxyXG5yZXF1aXJlKCdlczYtcHJvbWlzZScpLnBvbHlmaWxsKCk7XHJcblxyXG52YXIgbGF5b3V0VXBkYXRlRXZlbnQgPSByZXF1aXJlKCdsYXlvdXRVcGRhdGVFdmVudCcpO1xyXG52YXIgTmF2QmFyID0gcmVxdWlyZSgnLi92aWV3bW9kZWxzL05hdkJhcicpLFxyXG4gICAgTmF2QWN0aW9uID0gcmVxdWlyZSgnLi92aWV3bW9kZWxzL05hdkFjdGlvbicpLFxyXG4gICAgQXBwTW9kZWwgPSByZXF1aXJlKCcuL3ZpZXdtb2RlbHMvQXBwTW9kZWwnKTtcclxuXHJcbi8vIFJlZ2lzdGVyIHRoZSBzcGVjaWFsIGxvY2FsZVxyXG5yZXF1aXJlKCcuL2xvY2FsZXMvZW4tVVMtTEMnKTtcclxuXHJcbi8qKlxyXG4gICAgQSBzZXQgb2YgZml4ZXMvd29ya2Fyb3VuZHMgZm9yIEJvb3RzdHJhcCBiZWhhdmlvci9wbHVnaW5zXHJcbiAgICB0byBiZSBleGVjdXRlZCBiZWZvcmUgQm9vdHN0cmFwIGlzIGluY2x1ZGVkL2V4ZWN1dGVkLlxyXG4gICAgRm9yIGV4YW1wbGUsIGJlY2F1c2Ugb2YgZGF0YS1iaW5kaW5nIHJlbW92aW5nL2NyZWF0aW5nIGVsZW1lbnRzLFxyXG4gICAgc29tZSBvbGQgcmVmZXJlbmNlcyB0byByZW1vdmVkIGl0ZW1zIG1heSBnZXQgYWxpdmUgYW5kIG5lZWQgdXBkYXRlLFxyXG4gICAgb3IgcmUtZW5hYmxpbmcgc29tZSBiZWhhdmlvcnMuXHJcbioqL1xyXG5mdW5jdGlvbiBwcmVCb290c3RyYXBXb3JrYXJvdW5kcygpIHtcclxuICAgIC8vIEludGVybmFsIEJvb3RzdHJhcCBzb3VyY2UgdXRpbGl0eVxyXG4gICAgZnVuY3Rpb24gZ2V0VGFyZ2V0RnJvbVRyaWdnZXIoJHRyaWdnZXIpIHtcclxuICAgICAgICB2YXIgaHJlZixcclxuICAgICAgICAgICAgdGFyZ2V0ID0gJHRyaWdnZXIuYXR0cignZGF0YS10YXJnZXQnKSB8fFxyXG4gICAgICAgICAgICAoaHJlZiA9ICR0cmlnZ2VyLmF0dHIoJ2hyZWYnKSkgJiYgXHJcbiAgICAgICAgICAgIGhyZWYucmVwbGFjZSgvLiooPz0jW15cXHNdKyQpLywgJycpOyAvLyBzdHJpcCBmb3IgaWU3XHJcblxyXG4gICAgICAgIHJldHVybiAkKHRhcmdldCk7XHJcbiAgICB9XHJcbiAgICBcclxuICAgIC8vIEJ1ZzogbmF2YmFyLWNvbGxhcHNlIGVsZW1lbnRzIGhvbGQgYSByZWZlcmVuY2UgdG8gdGhlaXIgb3JpZ2luYWxcclxuICAgIC8vICR0cmlnZ2VyLCBidXQgdGhhdCB0cmlnZ2VyIGNhbiBjaGFuZ2Ugb24gZGlmZmVyZW50ICdjbGlja3MnIG9yXHJcbiAgICAvLyBnZXQgcmVtb3ZlZCB0aGUgb3JpZ2luYWwsIHNvIGl0IG11c3QgcmVmZXJlbmNlIHRoZSBuZXcgb25lXHJcbiAgICAvLyAodGhlIGxhdGVzdHMgY2xpY2tlZCwgYW5kIG5vdCB0aGUgY2FjaGVkIG9uZSB1bmRlciB0aGUgJ2RhdGEnIEFQSSkuICAgIFxyXG4gICAgLy8gTk9URTogaGFuZGxlciBtdXN0IGV4ZWN1dGUgYmVmb3JlIHRoZSBCb290c3RyYXAgaGFuZGxlciBmb3IgdGhlIHNhbWVcclxuICAgIC8vIGV2ZW50IGluIG9yZGVyIHRvIHdvcmsuXHJcbiAgICAkKGRvY3VtZW50KS5vbignY2xpY2suYnMuY29sbGFwc2UuZGF0YS1hcGkud29ya2Fyb3VuZCcsICdbZGF0YS10b2dnbGU9XCJjb2xsYXBzZVwiXScsIGZ1bmN0aW9uKGUpIHtcclxuICAgICAgICB2YXIgJHQgPSAkKHRoaXMpLFxyXG4gICAgICAgICAgICAkdGFyZ2V0ID0gZ2V0VGFyZ2V0RnJvbVRyaWdnZXIoJHQpLFxyXG4gICAgICAgICAgICBkYXRhID0gJHRhcmdldCAmJiAkdGFyZ2V0LmRhdGEoJ2JzLmNvbGxhcHNlJyk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgLy8gSWYgYW55XHJcbiAgICAgICAgaWYgKGRhdGEpIHtcclxuICAgICAgICAgICAgLy8gUmVwbGFjZSB0aGUgdHJpZ2dlciBpbiB0aGUgZGF0YSByZWZlcmVuY2U6XHJcbiAgICAgICAgICAgIGRhdGEuJHRyaWdnZXIgPSAkdDtcclxuICAgICAgICB9XHJcbiAgICAgICAgLy8gT24gZWxzZSwgbm90aGluZyB0byBkbywgYSBuZXcgQ29sbGFwc2UgaW5zdGFuY2Ugd2lsbCBiZSBjcmVhdGVkXHJcbiAgICAgICAgLy8gd2l0aCB0aGUgY29ycmVjdCB0YXJnZXQsIHRoZSBmaXJzdCB0aW1lXHJcbiAgICB9KTtcclxufVxyXG5cclxuLyoqXHJcbiAgICBBcHAgc3RhdGljIGNsYXNzXHJcbioqL1xyXG52YXIgYXBwID0ge1xyXG4gICAgc2hlbGw6IHJlcXVpcmUoJy4vYXBwLnNoZWxsJyksXHJcbiAgICBcclxuICAgIC8vIE5ldyBhcHAgbW9kZWwsIHRoYXQgc3RhcnRzIHdpdGggYW5vbnltb3VzIHVzZXJcclxuICAgIG1vZGVsOiBuZXcgQXBwTW9kZWwoKSxcclxuICAgIFxyXG4gICAgLyoqIExvYWQgYWN0aXZpdGllcyBjb250cm9sbGVycyAobm90IGluaXRpYWxpemVkKSAqKi9cclxuICAgIGFjdGl2aXRpZXM6IHJlcXVpcmUoJy4vYXBwLmFjdGl2aXRpZXMnKSxcclxuICAgIFxyXG4gICAgLyoqXHJcbiAgICAgICAgSnVzdCByZWRpcmVjdCB0aGUgYmV0dGVyIHBsYWNlIGZvciBjdXJyZW50IHVzZXIgYW5kIHN0YXRlLlxyXG4gICAgICAgIE5PVEU6IEl0cyBhIGRlbGF5ZWQgZnVuY3Rpb24sIHNpbmNlIG9uIG1hbnkgY29udGV4dHMgbmVlZCB0b1xyXG4gICAgICAgIHdhaXQgZm9yIHRoZSBjdXJyZW50ICdyb3V0aW5nJyBmcm9tIGVuZCBiZWZvcmUgZG8gdGhlIG5ld1xyXG4gICAgICAgIGhpc3RvcnkgY2hhbmdlLlxyXG4gICAgICAgIFRPRE86IE1heWJlLCByYXRoZXIgdGhhbiBkZWxheSBpdCwgY2FuIHN0b3AgY3VycmVudCByb3V0aW5nXHJcbiAgICAgICAgKGNoYW5nZXMgb24gU2hlbGwgcmVxdWlyZWQpIGFuZCBwZXJmb3JtIHRoZSBuZXcuXHJcbiAgICAgICAgVE9ETzogTWF5YmUgYWx0ZXJuYXRpdmUgdG8gcHJldmlvdXMsIHRvIHByb3ZpZGUgYSAncmVwbGFjZSdcclxuICAgICAgICBpbiBzaGVsbCByYXRoZXIgdGhhbiBhIGdvLCB0byBhdm9pZCBhcHBlbmQgcmVkaXJlY3QgZW50cmllc1xyXG4gICAgICAgIGluIHRoZSBoaXN0b3J5LCB0aGF0IGNyZWF0ZSB0aGUgcHJvYmxlbSBvZiAnYnJva2VuIGJhY2sgYnV0dG9uJ1xyXG4gICAgKiovXHJcbiAgICBnb0Rhc2hib2FyZDogZnVuY3Rpb24gZ29EYXNoYm9hcmQoKSB7XHJcbiAgICAgICAgdmFyIG9uYm9hcmRpbmcgPSB0aGlzLm1vZGVsLnVzZXIoKS5vbmJvYXJkaW5nU3RlcCgpO1xyXG4gICAgICAgIGlmIChvbmJvYXJkaW5nKSB7XHJcbiAgICAgICAgICAgIHRoaXMuc2hlbGwuZ28oJ29uYm9hcmRpbmdIb21lLycgKyBvbmJvYXJkaW5nKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgZWxzZSB7XHJcbiAgICAgICAgICAgIHRoaXMuc2hlbGwuZ28oJ2hvbWUnKTtcclxuICAgICAgICB9XHJcbiAgICB9Ll9kZWxheWVkKDEpXHJcbn07XHJcblxyXG4vKiogQ29udGludWUgYXBwIGNyZWF0aW9uIHdpdGggdGhpbmdzIHRoYXQgbmVlZCBhIHJlZmVyZW5jZSB0byB0aGUgYXBwICoqL1xyXG5cclxucmVxdWlyZSgnLi9hcHAtbmF2YmFyJykuZXh0ZW5kcyhhcHApO1xyXG5cclxucmVxdWlyZSgnLi9hcHAtY29tcG9uZW50cycpLnJlZ2lzdGVyQWxsKCk7XHJcblxyXG5hcHAuZ2V0QWN0aXZpdHkgPSBmdW5jdGlvbiBnZXRBY3Rpdml0eShuYW1lKSB7XHJcbiAgICB2YXIgYWN0aXZpdHkgPSB0aGlzLmFjdGl2aXRpZXNbbmFtZV07XHJcbiAgICBpZiAoYWN0aXZpdHkpIHtcclxuICAgICAgICB2YXIgJGFjdCA9IHRoaXMuc2hlbGwuaXRlbXMuZmluZChuYW1lKTtcclxuICAgICAgICBpZiAoJGFjdCAmJiAkYWN0Lmxlbmd0aClcclxuICAgICAgICAgICAgcmV0dXJuIGFjdGl2aXR5LmluaXQoJGFjdCwgdGhpcyk7XHJcbiAgICB9XHJcbiAgICByZXR1cm4gbnVsbDtcclxufTtcclxuXHJcbmFwcC5nZXRBY3Rpdml0eUNvbnRyb2xsZXJCeVJvdXRlID0gZnVuY3Rpb24gZ2V0QWN0aXZpdHlDb250cm9sbGVyQnlSb3V0ZShyb3V0ZSkge1xyXG4gICAgLy8gRnJvbSB0aGUgcm91dGUgb2JqZWN0LCB0aGUgaW1wb3J0YW50IHBpZWNlIGlzIHJvdXRlLm5hbWVcclxuICAgIC8vIHRoYXQgY29udGFpbnMgdGhlIGFjdGl2aXR5IG5hbWUgZXhjZXB0IGlmIGlzIHRoZSByb290XHJcbiAgICB2YXIgYWN0TmFtZSA9IHJvdXRlLm5hbWUgfHwgdGhpcy5zaGVsbC5pbmRleE5hbWU7XHJcbiAgICBcclxuICAgIHJldHVybiB0aGlzLmdldEFjdGl2aXR5KGFjdE5hbWUpO1xyXG59O1xyXG5cclxuLy8gYWNjZXNzQ29udHJvbCBzZXR1cDogY2Fubm90IGJlIHNwZWNpZmllZCBvbiBTaGVsbCBjcmVhdGlvbiBiZWNhdXNlXHJcbi8vIGRlcGVuZHMgb24gdGhlIGFwcCBpbnN0YW5jZVxyXG5hcHAuc2hlbGwuYWNjZXNzQ29udHJvbCA9IHJlcXVpcmUoJy4vdXRpbHMvYWNjZXNzQ29udHJvbCcpKGFwcCk7XHJcblxyXG4vLyBTaG9ydGN1dCB0byBVc2VyVHlwZSBlbnVtZXJhdGlvbiB1c2VkIHRvIHNldCBwZXJtaXNzaW9uc1xyXG5hcHAuVXNlclR5cGUgPSBhcHAubW9kZWwudXNlcigpLmNvbnN0cnVjdG9yLlVzZXJUeXBlO1xyXG5cclxuLyoqIEFwcCBJbml0ICoqL1xyXG52YXIgYXBwSW5pdCA9IGZ1bmN0aW9uIGFwcEluaXQoKSB7XHJcbiAgICAvKmpzaGludCBtYXhzdGF0ZW1lbnRzOjMwICovXHJcbiAgICBcclxuICAgIC8vIEVuYWJsaW5nIHRoZSAnbGF5b3V0VXBkYXRlJyBqUXVlcnkgV2luZG93IGV2ZW50IHRoYXQgaGFwcGVucyBvbiByZXNpemUgYW5kIHRyYW5zaXRpb25lbmQsXHJcbiAgICAvLyBhbmQgY2FuIGJlIHRyaWdnZXJlZCBtYW51YWxseSBieSBhbnkgc2NyaXB0IHRvIG5vdGlmeSBjaGFuZ2VzIG9uIGxheW91dCB0aGF0XHJcbiAgICAvLyBtYXkgcmVxdWlyZSBhZGp1c3RtZW50cyBvbiBvdGhlciBzY3JpcHRzIHRoYXQgbGlzdGVuIHRvIGl0LlxyXG4gICAgLy8gVGhlIGV2ZW50IGlzIHRocm90dGxlLCBndWFyYW50aW5nIHRoYXQgdGhlIG1pbm9yIGhhbmRsZXJzIGFyZSBleGVjdXRlZCByYXRoZXJcclxuICAgIC8vIHRoYW4gYSBsb3Qgb2YgdGhlbSBpbiBzaG9ydCB0aW1lIGZyYW1lcyAoYXMgaGFwcGVuIHdpdGggJ3Jlc2l6ZScgZXZlbnRzKS5cclxuICAgIGxheW91dFVwZGF0ZUV2ZW50Lm9uKCk7XHJcbiAgICBcclxuICAgIC8vIE5PVEU6IFNhZmFyaSBpT1MgYnVnIHdvcmthcm91bmQsIG1pbi1oZWlnaHQvaGVpZ2h0IG9uIGh0bWwgZG9lc24ndCB3b3JrIGFzIGV4cGVjdGVkLFxyXG4gICAgLy8gZ2V0dGluZyBiaWdnZXIgdGhhbiB2aWV3cG9ydC4gTWF5IGJlIGEgcHJvYmxlbSBvbmx5IG9uIFNhZmFyaSBhbmQgbm90IGluIFxyXG4gICAgLy8gdGhlIFdlYlZpZXcsIGRvdWJsZSBjaGVjay5cclxuICAgIC8vIFdpdGggdGhlIGFkZGl0aW9uYWwgcHJvYmxlbSB3aXRoIGhlaWdodDoxMDAlLCBzbyBBY3Rpdml0aWVzIGdldCBhXHJcbiAgICAvLyBmaXhlZCBzaXplIChjYWxjdWxhdGVkIGZyb20gYm9keSkgaWYgaGVpZ2h0OjEwMCUgaXMgYXBwbGllZCB0aHJvdWdoIENTU1xyXG4gICAgdmFyIGlPUyA9IC8oaVBhZHxpUGhvbmV8aVBvZCkvZy50ZXN0KCBuYXZpZ2F0b3IudXNlckFnZW50ICk7XHJcbiAgICBpZiAoaU9TKSB7XHJcbiAgICAgICAgdmFyICRiID0gJCgnYm9keScpO1xyXG4gICAgICAgIHZhciBmaXhBY3Rpdml0aWVzID0gZnVuY3Rpb24gZml4QWN0aXZpdGllcygpIHtcclxuICAgICAgICAgICAgdmFyIGggPSAkYi5oZWlnaHQoKTtcclxuICAgICAgICAgICAgJCgnW2RhdGEtYWN0aXZpdHldLmZ1bGwtaGVpZ2h0JykuaGVpZ2h0KGgpO1xyXG4gICAgICAgIH07XHJcblxyXG4gICAgICAgICQoJ2h0bWwnKS5oZWlnaHQod2luZG93LmlubmVySGVpZ2h0ICsgJ3B4Jyk7XHJcbiAgICAgICAgZml4QWN0aXZpdGllcygpO1xyXG4gICAgICAgICQod2luZG93KS5vbignbGF5b3V0VXBkYXRlJywgZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgICAgICQoJ2h0bWwnKS5oZWlnaHQod2luZG93LmlubmVySGVpZ2h0ICsgJ3B4Jyk7XHJcbiAgICAgICAgICAgIGZpeEFjdGl2aXRpZXMoKTtcclxuICAgICAgICB9KTtcclxuICAgIH1cclxuICAgIFxyXG4gICAgLy8gaU9TLTcrIHN0YXR1cyBiYXIgZml4LiBBcHBseSBvbiBwbHVnaW4gbG9hZGVkIChjb3Jkb3ZhL3Bob25lZ2FwIGVudmlyb25tZW50KVxyXG4gICAgLy8gYW5kIGluIGFueSBzeXN0ZW0sIHNvIGFueSBvdGhlciBzeXN0ZW1zIGZpeCBpdHMgc29sdmVkIHRvbyBpZiBuZWVkZWQgXHJcbiAgICAvLyBqdXN0IHVwZGF0aW5nIHRoZSBwbHVnaW4gKGZ1dHVyZSBwcm9vZikgYW5kIGVuc3VyZSBob21vZ2VuZW91cyBjcm9zcyBwbGFmdGZvcm0gYmVoYXZpb3IuXHJcbiAgICBpZiAod2luZG93LlN0YXR1c0Jhcikge1xyXG4gICAgICAgIC8vIEZpeCBpT1MtNysgb3ZlcmxheSBwcm9ibGVtXHJcbiAgICAgICAgLy8gSXMgaW4gY29uZmlnLnhtbCB0b28sIGJ1dCBzZWVtcyBub3QgdG8gd29yayB0aGVyZS5cclxuICAgICAgICB3aW5kb3cuU3RhdHVzQmFyLm92ZXJsYXlzV2ViVmlldyhmYWxzZSk7XHJcbiAgICB9XHJcbiAgICBcclxuICAgIC8vIEJvb3RzdHJhcFxyXG4gICAgcHJlQm9vdHN0cmFwV29ya2Fyb3VuZHMoKTtcclxuICAgIHJlcXVpcmUoJ2Jvb3RzdHJhcCcpO1xyXG4gICAgXHJcbiAgICAvLyBMb2FkIEtub2Nrb3V0IGJpbmRpbmcgaGVscGVyc1xyXG4gICAgYm9vdGtub2NrLnBsdWdJbihrbyk7XHJcbiAgICBcclxuICAgIC8vIFBsdWdpbnMgc2V0dXBcclxuICAgIGlmICh3aW5kb3cgJiYgd2luZG93LnBsdWdpbnMgJiYgd2luZG93LnBsdWdpbnMuS2V5Ym9hcmQpIHtcclxuICAgICAgICB3aW5kb3cucGx1Z2lucy5LZXlib2FyZC5kaXNhYmxlU2Nyb2xsKHRydWUpO1xyXG4gICAgfVxyXG4gICAgXHJcbiAgICAvLyBFYXN5IGxpbmtzIHRvIHNoZWxsIGFjdGlvbnMsIGxpa2UgZ29CYWNrLCBpbiBodG1sIGVsZW1lbnRzXHJcbiAgICAvLyBFeGFtcGxlOiA8YnV0dG9uIGRhdGEtc2hlbGw9XCJnb0JhY2sgMlwiPkdvIDIgdGltZXMgYmFjazwvYnV0dG9uPlxyXG4gICAgLy8gTk9URTogSW1wb3J0YW50LCByZWdpc3RlcmVkIGJlZm9yZSB0aGUgc2hlbGwucnVuIHRvIGJlIGV4ZWN1dGVkXHJcbiAgICAvLyBiZWZvcmUgaXRzICdjYXRjaCBhbGwgbGlua3MnIGhhbmRsZXJcclxuICAgICQoZG9jdW1lbnQpLm9uKCd0YXAnLCAnW2RhdGEtc2hlbGxdJywgZnVuY3Rpb24oZSkge1xyXG4gICAgICAgIC8vIFVzaW5nIGF0dHIgcmF0aGVyIHRoYW4gdGhlICdkYXRhJyBBUEkgdG8gZ2V0IHVwZGF0ZWRcclxuICAgICAgICAvLyBET00gdmFsdWVzXHJcbiAgICAgICAgdmFyIGNtZGxpbmUgPSAkKHRoaXMpLmF0dHIoJ2RhdGEtc2hlbGwnKSB8fCAnJyxcclxuICAgICAgICAgICAgYXJncyA9IGNtZGxpbmUuc3BsaXQoJyAnKSxcclxuICAgICAgICAgICAgY21kID0gYXJnc1swXTtcclxuXHJcbiAgICAgICAgaWYgKGNtZCAmJiB0eXBlb2YoYXBwLnNoZWxsW2NtZF0pID09PSAnZnVuY3Rpb24nKSB7XHJcbiAgICAgICAgICAgIGFwcC5zaGVsbFtjbWRdLmFwcGx5KGFwcC5zaGVsbCwgYXJncy5zbGljZSgxKSk7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAvLyBDYW5jZWwgYW55IG90aGVyIGFjdGlvbiBvbiB0aGUgbGluaywgdG8gYXZvaWQgZG91YmxlIGxpbmtpbmcgcmVzdWx0c1xyXG4gICAgICAgICAgICBlLnN0b3BJbW1lZGlhdGVQcm9wYWdhdGlvbigpO1xyXG4gICAgICAgICAgICBlLnByZXZlbnREZWZhdWx0KCk7XHJcbiAgICAgICAgfVxyXG4gICAgfSk7XHJcbiAgICBcclxuICAgIC8vIFdoZW4gYW4gYWN0aXZpdHkgaXMgcmVhZHkgaW4gdGhlIFNoZWxsOlxyXG4gICAgYXBwLnNoZWxsLm9uKGFwcC5zaGVsbC5ldmVudHMuaXRlbVJlYWR5LCBmdW5jdGlvbigkYWN0LCBzdGF0ZSkge1xyXG4gICAgICAgIFxyXG4gICAgICAgIC8vIENvbm5lY3QgdGhlICdhY3Rpdml0aWVzJyBjb250cm9sbGVycyB0byB0aGVpciB2aWV3c1xyXG4gICAgICAgIC8vIEdldCBpbml0aWFsaXplZCBhY3Rpdml0eSBmb3IgdGhlIERPTSBlbGVtZW50XHJcbiAgICAgICAgdmFyIGFjdE5hbWUgPSAkYWN0LmRhdGEoJ2FjdGl2aXR5Jyk7XHJcbiAgICAgICAgdmFyIGFjdGl2aXR5ID0gYXBwLmdldEFjdGl2aXR5KGFjdE5hbWUpO1xyXG4gICAgICAgIC8vIFRyaWdnZXIgdGhlICdzaG93JyBsb2dpYyBvZiB0aGUgYWN0aXZpdHkgY29udHJvbGxlcjpcclxuICAgICAgICBhY3Rpdml0eS5zaG93KHN0YXRlKTtcclxuXHJcbiAgICAgICAgLy8gVXBkYXRlIG1lbnVcclxuICAgICAgICB2YXIgbWVudUl0ZW0gPSBhY3Rpdml0eS5tZW51SXRlbSB8fCBhY3ROYW1lO1xyXG4gICAgICAgIGFwcC51cGRhdGVNZW51KG1lbnVJdGVtKTtcclxuICAgICAgICBcclxuICAgICAgICAvLyBVcGRhdGUgYXBwIG5hdmlnYXRpb25cclxuICAgICAgICBhcHAudXBkYXRlQXBwTmF2KGFjdGl2aXR5KTtcclxuICAgIH0pO1xyXG4gICAgXHJcbiAgICAvLyBTZXQgbW9kZWwgZm9yIHRoZSBBcHBOYXZcclxuICAgIGtvLmFwcGx5QmluZGluZ3Moe1xyXG4gICAgICAgIG5hdkJhcjogYXBwLm5hdkJhclxyXG4gICAgfSwgJCgnLkFwcE5hdicpLmdldCgwKSk7XHJcbiAgICBcclxuICAgIHZhciBTbWFydE5hdkJhciA9IHJlcXVpcmUoJy4vY29tcG9uZW50cy9TbWFydE5hdkJhcicpO1xyXG4gICAgdmFyIG5hdkJhcnMgPSBTbWFydE5hdkJhci5nZXRBbGwoKTtcclxuICAgIC8vIENyZWF0ZXMgYW4gZXZlbnQgYnkgbGlzdGVuaW5nIHRvIGl0LCBzbyBvdGhlciBzY3JpcHRzIGNhbiB0cmlnZ2VyXHJcbiAgICAvLyBhICdjb250ZW50Q2hhbmdlJyBldmVudCB0byBmb3JjZSBhIHJlZnJlc2ggb2YgdGhlIG5hdmJhciAodG8gXHJcbiAgICAvLyBjYWxjdWxhdGUgYW5kIGFwcGx5IGEgbmV3IHNpemUpOyBleHBlY3RlZCBmcm9tIGR5bmFtaWMgbmF2YmFyc1xyXG4gICAgLy8gdGhhdCBjaGFuZ2UgaXQgY29udGVudCBiYXNlZCBvbiBvYnNlcnZhYmxlcy5cclxuICAgIG5hdkJhcnMuZm9yRWFjaChmdW5jdGlvbihuYXZiYXIpIHtcclxuICAgICAgICAkKG5hdmJhci5lbCkub24oJ2NvbnRlbnRDaGFuZ2UnLCBmdW5jdGlvbigpIHtcclxuICAgICAgICAgICAgbmF2YmFyLnJlZnJlc2goKTtcclxuICAgICAgICB9KTtcclxuICAgIH0pO1xyXG4gICAgXHJcbiAgICAvLyBMaXN0ZW4gZm9yIG1lbnUgZXZlbnRzIChjb2xsYXBzZSBpbiBTbWFydE5hdkJhcilcclxuICAgIC8vIHRvIGFwcGx5IHRoZSBiYWNrZHJvcFxyXG4gICAgdmFyIHRvZ2dsaW5nQmFja2Ryb3AgPSBmYWxzZTtcclxuICAgICQoZG9jdW1lbnQpLm9uKCdzaG93LmJzLmNvbGxhcHNlIGhpZGUuYnMuY29sbGFwc2UnLCAnLkFwcE5hdiAubmF2YmFyLWNvbGxhcHNlJywgZnVuY3Rpb24oZSkge1xyXG4gICAgICAgIGlmICghdG9nZ2xpbmdCYWNrZHJvcCkge1xyXG4gICAgICAgICAgICB0b2dnbGluZ0JhY2tkcm9wID0gdHJ1ZTtcclxuICAgICAgICAgICAgdmFyIGVuYWJsZWQgPSBlLnR5cGUgPT09ICdzaG93JztcclxuICAgICAgICAgICAgJCgnYm9keScpLnRvZ2dsZUNsYXNzKCd1c2UtYmFja2Ryb3AnLCBlbmFibGVkKTtcclxuICAgICAgICAgICAgLy8gSGlkZSBhbnkgb3RoZXIgb3BlbmVkIGNvbGxhcHNlXHJcbiAgICAgICAgICAgICQoJy5jb2xsYXBzaW5nLCAuY29sbGFwc2UuaW4nKS5jb2xsYXBzZSgnaGlkZScpO1xyXG4gICAgICAgICAgICB0b2dnbGluZ0JhY2tkcm9wID0gZmFsc2U7XHJcbiAgICAgICAgfVxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gQXBwIGluaXQ6XHJcbiAgICB2YXIgYWxlcnRFcnJvciA9IGZ1bmN0aW9uKGVycikge1xyXG4gICAgICAgIHdpbmRvdy5hbGVydCgnVGhlcmUgd2FzIGFuIGVycm9yIGxvYWRpbmc6ICcgKyBlcnIgJiYgZXJyLm1lc3NhZ2UgfHwgZXJyKTtcclxuICAgIH07XHJcblxyXG4gICAgYXBwLm1vZGVsLmluaXQoKVxyXG4gICAgLnRoZW4oYXBwLnNoZWxsLnJ1bi5iaW5kKGFwcC5zaGVsbCksIGFsZXJ0RXJyb3IpXHJcbiAgICAudGhlbihmdW5jdGlvbigpIHtcclxuICAgICAgICAvLyBNYXJrIHRoZSBwYWdlIGFzIHJlYWR5XHJcbiAgICAgICAgJCgnaHRtbCcpLmFkZENsYXNzKCdpcy1yZWFkeScpO1xyXG4gICAgICAgIC8vIEFzIGFwcCwgaGlkZXMgc3BsYXNoIHNjcmVlblxyXG4gICAgICAgIGlmICh3aW5kb3cubmF2aWdhdG9yICYmIHdpbmRvdy5uYXZpZ2F0b3Iuc3BsYXNoc2NyZWVuKSB7XHJcbiAgICAgICAgICAgIHdpbmRvdy5uYXZpZ2F0b3Iuc3BsYXNoc2NyZWVuLmhpZGUoKTtcclxuICAgICAgICB9XHJcbiAgICB9LCBhbGVydEVycm9yKTtcclxuXHJcbiAgICAvLyBERUJVR1xyXG4gICAgd2luZG93LmFwcCA9IGFwcDtcclxufTtcclxuXHJcbi8vIEFwcCBpbml0IG9uIHBhZ2UgcmVhZHkgYW5kIHBob25lZ2FwIHJlYWR5XHJcbmlmICh3aW5kb3cuY29yZG92YSkge1xyXG4gICAgLy8gT24gRE9NLVJlYWR5IGZpcnN0XHJcbiAgICAkKGZ1bmN0aW9uKCkge1xyXG4gICAgICAgIC8vIFBhZ2UgaXMgcmVhZHksIGRldmljZSBpcyB0b28/XHJcbiAgICAgICAgLy8gTm90ZTogQ29yZG92YSBlbnN1cmVzIHRvIGNhbGwgdGhlIGhhbmRsZXIgZXZlbiBpZiB0aGVcclxuICAgICAgICAvLyBldmVudCB3YXMgYWxyZWFkeSBmaXJlZCwgc28gaXMgZ29vZCB0byBkbyBpdCBpbnNpZGVcclxuICAgICAgICAvLyB0aGUgZG9tLXJlYWR5IGFuZCB3ZSBhcmUgZW5zdXJpbmcgdGhhdCBldmVyeXRoaW5nIGlzXHJcbiAgICAgICAgLy8gcmVhZHkuXHJcbiAgICAgICAgJChkb2N1bWVudCkub24oJ2RldmljZXJlYWR5JywgYXBwSW5pdCk7XHJcbiAgICB9KTtcclxufSBlbHNlIHtcclxuICAgIC8vIE9ubHkgb24gRE9NLVJlYWR5LCBmb3IgaW4gYnJvd3NlciBkZXZlbG9wbWVudFxyXG4gICAgJChhcHBJbml0KTtcclxufSIsIi8qKlxyXG4gICAgU2V0dXAgb2YgdGhlIHNoZWxsIG9iamVjdCB1c2VkIGJ5IHRoZSBhcHBcclxuKiovXHJcbid1c2Ugc3RyaWN0JztcclxuXHJcbnZhciBiYXNlVXJsID0gd2luZG93LmxvY2F0aW9uLnBhdGhuYW1lO1xyXG5cclxuLy92YXIgSGlzdG9yeSA9IHJlcXVpcmUoJy4vYXBwLXNoZWxsLWhpc3RvcnknKS5jcmVhdGUoYmFzZVVybCk7XHJcbnZhciBIaXN0b3J5ID0gcmVxdWlyZSgnLi91dGlscy9zaGVsbC9oYXNoYmFuZ0hpc3RvcnknKTtcclxuXHJcbi8vIFNoZWxsIGRlcGVuZGVuY2llc1xyXG52YXIgc2hlbGwgPSByZXF1aXJlKCcuL3V0aWxzL3NoZWxsL2luZGV4JyksXHJcbiAgICBTaGVsbCA9IHNoZWxsLlNoZWxsLFxyXG4gICAgRG9tSXRlbXNNYW5hZ2VyID0gc2hlbGwuRG9tSXRlbXNNYW5hZ2VyO1xyXG5cclxuLy8gQ3JlYXRpbmcgdGhlIHNoZWxsOlxyXG52YXIgc2hlbGwgPSBuZXcgU2hlbGwoe1xyXG5cclxuICAgIC8vIFNlbGVjdG9yLCBET00gZWxlbWVudCBvciBqUXVlcnkgb2JqZWN0IHBvaW50aW5nXHJcbiAgICAvLyB0aGUgcm9vdCBvciBjb250YWluZXIgZm9yIHRoZSBzaGVsbCBpdGVtc1xyXG4gICAgcm9vdDogJ2JvZHknLFxyXG5cclxuICAgIC8vIElmIGlzIG5vdCBpbiB0aGUgc2l0ZSByb290LCB0aGUgYmFzZSBVUkwgaXMgcmVxdWlyZWQ6XHJcbiAgICBiYXNlVXJsOiBiYXNlVXJsLFxyXG4gICAgXHJcbiAgICBmb3JjZUhhc2hiYW5nOiB0cnVlLFxyXG5cclxuICAgIGluZGV4TmFtZTogJ2luZGV4JyxcclxuXHJcbiAgICAvLyBmb3IgZmFzdGVyIG1vYmlsZSBleHBlcmllbmNlIChqcXVlcnktbW9iaWxlIGV2ZW50KTpcclxuICAgIGxpbmtFdmVudDogJ3RhcCcsXHJcblxyXG4gICAgLy8gTm8gbmVlZCBmb3IgbG9hZGVyLCBldmVyeXRoaW5nIGNvbWVzIGJ1bmRsZWRcclxuICAgIGxvYWRlcjogbnVsbCxcclxuXHJcbiAgICAvLyBIaXN0b3J5IFBvbHlmaWxsOlxyXG4gICAgaGlzdG9yeTogSGlzdG9yeSxcclxuXHJcbiAgICAvLyBBIERvbUl0ZW1zTWFuYWdlciBvciBlcXVpdmFsZW50IG9iamVjdCBpbnN0YW5jZSBuZWVkcyB0b1xyXG4gICAgLy8gYmUgcHJvdmlkZWQ6XHJcbiAgICBkb21JdGVtc01hbmFnZXI6IG5ldyBEb21JdGVtc01hbmFnZXIoe1xyXG4gICAgICAgIGlkQXR0cmlidXRlTmFtZTogJ2RhdGEtYWN0aXZpdHknXHJcbiAgICB9KVxyXG59KTtcclxuXHJcbi8vIENhdGNoIGVycm9ycyBvbiBpdGVtL3BhZ2UgbG9hZGluZywgc2hvd2luZy4uXHJcbnNoZWxsLm9uKCdlcnJvcicsIGZ1bmN0aW9uKGVycikge1xyXG4gICAgXHJcbiAgICB2YXIgc3RyID0gJ1Vua25vdyBlcnJvcic7XHJcbiAgICBpZiAoZXJyKSB7XHJcbiAgICAgICAgaWYgKHR5cGVvZihlcnIpID09PSAnc3RyaW5nJykge1xyXG4gICAgICAgICAgICBzdHIgPSBlcnI7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGVsc2UgaWYgKGVyci5tZXNzYWdlKSB7XHJcbiAgICAgICAgICAgIHN0ciA9IGVyci5tZXNzYWdlO1xyXG4gICAgICAgIH1cclxuICAgICAgICBlbHNlIHtcclxuICAgICAgICAgICAgc3RyID0gSlNPTi5zdHJpbmdpZnkoZXJyKTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgLy8gVE9ETyBjaGFuZ2Ugd2l0aCBhIGRpYWxvZyBvciBzb21ldGhpbmdcclxuICAgIHdpbmRvdy5hbGVydChzdHIpO1xyXG59KTtcclxuXHJcbm1vZHVsZS5leHBvcnRzID0gc2hlbGw7XHJcbiIsIi8qID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxyXG4gKiBEYXRlUGlja2VyIEpTIENvbXBvbmVudCwgd2l0aCBzZXZlcmFsXHJcbiAqIG1vZGVzIGFuZCBvcHRpb25hbCBpbmxpbmUtcGVybWFuZW50IHZpc3VhbGl6YXRpb24uXHJcbiAqXHJcbiAqIENvcHlyaWdodCAyMDE0IExvY29ub21pY3MgQ29vcC5cclxuICpcclxuICogQmFzZWQgb246XHJcbiAqIGJvb3RzdHJhcC1kYXRlcGlja2VyLmpzIFxyXG4gKiBodHRwOi8vd3d3LmV5ZWNvbi5yby9ib290c3RyYXAtZGF0ZXBpY2tlclxyXG4gKiA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cclxuICogQ29weXJpZ2h0IDIwMTIgU3RlZmFuIFBldHJlXHJcbiAqXHJcbiAqIExpY2Vuc2VkIHVuZGVyIHRoZSBBcGFjaGUgTGljZW5zZSwgVmVyc2lvbiAyLjAgKHRoZSBcIkxpY2Vuc2VcIik7XHJcbiAqIHlvdSBtYXkgbm90IHVzZSB0aGlzIGZpbGUgZXhjZXB0IGluIGNvbXBsaWFuY2Ugd2l0aCB0aGUgTGljZW5zZS5cclxuICogWW91IG1heSBvYnRhaW4gYSBjb3B5IG9mIHRoZSBMaWNlbnNlIGF0XHJcbiAqXHJcbiAqIGh0dHA6Ly93d3cuYXBhY2hlLm9yZy9saWNlbnNlcy9MSUNFTlNFLTIuMFxyXG4gKlxyXG4gKiBVbmxlc3MgcmVxdWlyZWQgYnkgYXBwbGljYWJsZSBsYXcgb3IgYWdyZWVkIHRvIGluIHdyaXRpbmcsIHNvZnR3YXJlXHJcbiAqIGRpc3RyaWJ1dGVkIHVuZGVyIHRoZSBMaWNlbnNlIGlzIGRpc3RyaWJ1dGVkIG9uIGFuIFwiQVMgSVNcIiBCQVNJUyxcclxuICogV0lUSE9VVCBXQVJSQU5USUVTIE9SIENPTkRJVElPTlMgT0YgQU5ZIEtJTkQsIGVpdGhlciBleHByZXNzIG9yIGltcGxpZWQuXHJcbiAqIFNlZSB0aGUgTGljZW5zZSBmb3IgdGhlIHNwZWNpZmljIGxhbmd1YWdlIGdvdmVybmluZyBwZXJtaXNzaW9ucyBhbmRcclxuICogbGltaXRhdGlvbnMgdW5kZXIgdGhlIExpY2Vuc2UuXHJcbiAqID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PSAqL1xyXG5cclxudmFyICQgPSByZXF1aXJlKCdqcXVlcnknKTsgXHJcblxyXG52YXIgY2xhc3NlcyA9IHtcclxuICAgIGNvbXBvbmVudDogJ0RhdGVQaWNrZXInLFxyXG4gICAgbW9udGhzOiAnRGF0ZVBpY2tlci1tb250aHMnLFxyXG4gICAgZGF5czogJ0RhdGVQaWNrZXItZGF5cycsXHJcbiAgICBtb250aERheTogJ2RheScsXHJcbiAgICBtb250aDogJ21vbnRoJyxcclxuICAgIHllYXI6ICd5ZWFyJyxcclxuICAgIHllYXJzOiAnRGF0ZVBpY2tlci15ZWFycydcclxufTtcclxuXHJcbi8vIFBpY2tlciBvYmplY3RcclxudmFyIERhdGVQaWNrZXIgPSBmdW5jdGlvbihlbGVtZW50LCBvcHRpb25zKSB7XHJcbiAgICAvKmpzaGludCBtYXhzdGF0ZW1lbnRzOjMyLG1heGNvbXBsZXhpdHk6MjQqL1xyXG4gICAgdGhpcy5lbGVtZW50ID0gJChlbGVtZW50KTtcclxuICAgIHRoaXMuZm9ybWF0ID0gRFBHbG9iYWwucGFyc2VGb3JtYXQob3B0aW9ucy5mb3JtYXR8fHRoaXMuZWxlbWVudC5kYXRhKCdkYXRlLWZvcm1hdCcpfHwnbW0vZGQveXl5eScpO1xyXG4gICAgXHJcbiAgICB0aGlzLmlzSW5wdXQgPSB0aGlzLmVsZW1lbnQuaXMoJ2lucHV0Jyk7XHJcbiAgICB0aGlzLmNvbXBvbmVudCA9IHRoaXMuZWxlbWVudC5pcygnLmRhdGUnKSA/IHRoaXMuZWxlbWVudC5maW5kKCcuYWRkLW9uJykgOiBmYWxzZTtcclxuICAgIHRoaXMuaXNQbGFjZWhvbGRlciA9IHRoaXMuZWxlbWVudC5pcygnLmNhbGVuZGFyLXBsYWNlaG9sZGVyJyk7XHJcbiAgICBcclxuICAgIHRoaXMucGlja2VyID0gJChEUEdsb2JhbC50ZW1wbGF0ZSlcclxuICAgICAgICAgICAgICAgICAgICAgICAgLmFwcGVuZFRvKHRoaXMuaXNQbGFjZWhvbGRlciA/IHRoaXMuZWxlbWVudCA6ICdib2R5JylcclxuICAgICAgICAgICAgICAgICAgICAgICAgLm9uKCdjbGljayB0YXAnLCAkLnByb3h5KHRoaXMuY2xpY2ssIHRoaXMpKTtcclxuICAgIC8vIFRPRE86IHRvIHJldmlldyBpZiAnY29udGFpbmVyJyBjbGFzcyBjYW4gYmUgYXZvaWRlZCwgc28gaW4gcGxhY2Vob2xkZXIgbW9kZSBnZXRzIG9wdGlvbmFsXHJcbiAgICAvLyBpZiBpcyB3YW50ZWQgY2FuIGJlIHBsYWNlZCBvbiB0aGUgcGxhY2Vob2xkZXIgZWxlbWVudCAob3IgY29udGFpbmVyLWZsdWlkIG9yIG5vdGhpbmcpXHJcbiAgICB0aGlzLnBpY2tlci5hZGRDbGFzcyh0aGlzLmlzUGxhY2Vob2xkZXIgPyAnY29udGFpbmVyJyA6ICdkcm9wZG93bi1tZW51Jyk7XHJcbiAgICBcclxuICAgIGlmICh0aGlzLmlzUGxhY2Vob2xkZXIpIHtcclxuICAgICAgICB0aGlzLnBpY2tlci5zaG93KCk7XHJcbiAgICAgICAgaWYgKHRoaXMuZWxlbWVudC5kYXRhKCdkYXRlJykgPT0gJ3RvZGF5Jykge1xyXG4gICAgICAgICAgICB0aGlzLmRhdGUgPSBuZXcgRGF0ZSgpO1xyXG4gICAgICAgICAgICB0aGlzLnNldCgpO1xyXG4gICAgICAgIH1cclxuICAgICAgICB0aGlzLmVsZW1lbnQudHJpZ2dlcih7XHJcbiAgICAgICAgICAgIHR5cGU6ICdzaG93JyxcclxuICAgICAgICAgICAgZGF0ZTogdGhpcy5kYXRlXHJcbiAgICAgICAgfSk7XHJcbiAgICB9XHJcbiAgICBlbHNlIGlmICh0aGlzLmlzSW5wdXQpIHtcclxuICAgICAgICB0aGlzLmVsZW1lbnQub24oe1xyXG4gICAgICAgICAgICBmb2N1czogJC5wcm94eSh0aGlzLnNob3csIHRoaXMpLFxyXG4gICAgICAgICAgICAvL2JsdXI6ICQucHJveHkodGhpcy5oaWRlLCB0aGlzKSxcclxuICAgICAgICAgICAga2V5dXA6ICQucHJveHkodGhpcy51cGRhdGUsIHRoaXMpXHJcbiAgICAgICAgfSk7XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICAgIGlmICh0aGlzLmNvbXBvbmVudCl7XHJcbiAgICAgICAgICAgIHRoaXMuY29tcG9uZW50Lm9uKCdjbGljayB0YXAnLCAkLnByb3h5KHRoaXMuc2hvdywgdGhpcykpO1xyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgIHRoaXMuZWxlbWVudC5vbignY2xpY2sgdGFwJywgJC5wcm94eSh0aGlzLnNob3csIHRoaXMpKTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcbiAgICBcclxuICAgIC8qIFRvdWNoIGV2ZW50cyB0byBzd2lwZSBkYXRlcyAqL1xyXG4gICAgdGhpcy5lbGVtZW50XHJcbiAgICAub24oJ3N3aXBlbGVmdCcsIGZ1bmN0aW9uKGUpIHtcclxuICAgICAgICBlLnByZXZlbnREZWZhdWx0KCk7XHJcbiAgICAgICAgdGhpcy5tb3ZlRGF0ZSgnbmV4dCcpO1xyXG4gICAgfS5iaW5kKHRoaXMpKVxyXG4gICAgLm9uKCdzd2lwZXJpZ2h0JywgZnVuY3Rpb24oZSkge1xyXG4gICAgICAgIGUucHJldmVudERlZmF1bHQoKTtcclxuICAgICAgICB0aGlzLm1vdmVEYXRlKCdwcmV2Jyk7XHJcbiAgICB9LmJpbmQodGhpcykpO1xyXG5cclxuICAgIC8qIFNldC11cCB2aWV3IG1vZGUgKi9cclxuICAgIHRoaXMubWluVmlld01vZGUgPSBvcHRpb25zLm1pblZpZXdNb2RlfHx0aGlzLmVsZW1lbnQuZGF0YSgnZGF0ZS1taW52aWV3bW9kZScpfHwwO1xyXG4gICAgaWYgKHR5cGVvZiB0aGlzLm1pblZpZXdNb2RlID09PSAnc3RyaW5nJykge1xyXG4gICAgICAgIHN3aXRjaCAodGhpcy5taW5WaWV3TW9kZSkge1xyXG4gICAgICAgICAgICBjYXNlICdtb250aHMnOlxyXG4gICAgICAgICAgICAgICAgdGhpcy5taW5WaWV3TW9kZSA9IDE7XHJcbiAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgY2FzZSAneWVhcnMnOlxyXG4gICAgICAgICAgICAgICAgdGhpcy5taW5WaWV3TW9kZSA9IDI7XHJcbiAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgZGVmYXVsdDpcclxuICAgICAgICAgICAgICAgIHRoaXMubWluVmlld01vZGUgPSAwO1xyXG4gICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG4gICAgdGhpcy52aWV3TW9kZSA9IG9wdGlvbnMudmlld01vZGV8fHRoaXMuZWxlbWVudC5kYXRhKCdkYXRlLXZpZXdtb2RlJyl8fDA7XHJcbiAgICBpZiAodHlwZW9mIHRoaXMudmlld01vZGUgPT09ICdzdHJpbmcnKSB7XHJcbiAgICAgICAgc3dpdGNoICh0aGlzLnZpZXdNb2RlKSB7XHJcbiAgICAgICAgICAgIGNhc2UgJ21vbnRocyc6XHJcbiAgICAgICAgICAgICAgICB0aGlzLnZpZXdNb2RlID0gMTtcclxuICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICBjYXNlICd5ZWFycyc6XHJcbiAgICAgICAgICAgICAgICB0aGlzLnZpZXdNb2RlID0gMjtcclxuICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICBkZWZhdWx0OlxyXG4gICAgICAgICAgICAgICAgdGhpcy52aWV3TW9kZSA9IDA7XHJcbiAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICB9XHJcbiAgICB9XHJcbiAgICB0aGlzLnN0YXJ0Vmlld01vZGUgPSB0aGlzLnZpZXdNb2RlO1xyXG4gICAgdGhpcy53ZWVrU3RhcnQgPSBvcHRpb25zLndlZWtTdGFydHx8dGhpcy5lbGVtZW50LmRhdGEoJ2RhdGUtd2Vla3N0YXJ0Jyl8fDA7XHJcbiAgICB0aGlzLndlZWtFbmQgPSB0aGlzLndlZWtTdGFydCA9PT0gMCA/IDYgOiB0aGlzLndlZWtTdGFydCAtIDE7XHJcbiAgICB0aGlzLm9uUmVuZGVyID0gb3B0aW9ucy5vblJlbmRlcjtcclxuICAgIHRoaXMuZmlsbERvdygpO1xyXG4gICAgdGhpcy5maWxsTW9udGhzKCk7XHJcbiAgICB0aGlzLnVwZGF0ZSgpO1xyXG4gICAgdGhpcy5zaG93TW9kZSgpO1xyXG59O1xyXG5cclxuRGF0ZVBpY2tlci5wcm90b3R5cGUgPSB7XHJcbiAgICBjb25zdHJ1Y3RvcjogRGF0ZVBpY2tlcixcclxuICAgIFxyXG4gICAgc2hvdzogZnVuY3Rpb24oZSkge1xyXG4gICAgICAgIHRoaXMucGlja2VyLnNob3coKTtcclxuICAgICAgICB0aGlzLmhlaWdodCA9IHRoaXMuY29tcG9uZW50ID8gdGhpcy5jb21wb25lbnQub3V0ZXJIZWlnaHQoKSA6IHRoaXMuZWxlbWVudC5vdXRlckhlaWdodCgpO1xyXG4gICAgICAgIHRoaXMucGxhY2UoKTtcclxuICAgICAgICAkKHdpbmRvdykub24oJ3Jlc2l6ZScsICQucHJveHkodGhpcy5wbGFjZSwgdGhpcykpO1xyXG4gICAgICAgIGlmIChlICkge1xyXG4gICAgICAgICAgICBlLnN0b3BQcm9wYWdhdGlvbigpO1xyXG4gICAgICAgICAgICBlLnByZXZlbnREZWZhdWx0KCk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGlmICghdGhpcy5pc0lucHV0KSB7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHZhciB0aGF0ID0gdGhpcztcclxuICAgICAgICAkKGRvY3VtZW50KS5vbignbW91c2Vkb3duJywgZnVuY3Rpb24oZXYpe1xyXG4gICAgICAgICAgICBpZiAoJChldi50YXJnZXQpLmNsb3Nlc3QoJy4nICsgY2xhc3Nlcy5jb21wb25lbnQpLmxlbmd0aCA9PT0gMCkge1xyXG4gICAgICAgICAgICAgICAgdGhhdC5oaWRlKCk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9KTtcclxuICAgICAgICB0aGlzLmVsZW1lbnQudHJpZ2dlcih7XHJcbiAgICAgICAgICAgIHR5cGU6ICdzaG93JyxcclxuICAgICAgICAgICAgZGF0ZTogdGhpcy5kYXRlXHJcbiAgICAgICAgfSk7XHJcbiAgICB9LFxyXG4gICAgXHJcbiAgICBoaWRlOiBmdW5jdGlvbigpe1xyXG4gICAgICAgIHRoaXMucGlja2VyLmhpZGUoKTtcclxuICAgICAgICAkKHdpbmRvdykub2ZmKCdyZXNpemUnLCB0aGlzLnBsYWNlKTtcclxuICAgICAgICB0aGlzLnZpZXdNb2RlID0gdGhpcy5zdGFydFZpZXdNb2RlO1xyXG4gICAgICAgIHRoaXMuc2hvd01vZGUoKTtcclxuICAgICAgICBpZiAoIXRoaXMuaXNJbnB1dCkge1xyXG4gICAgICAgICAgICAkKGRvY3VtZW50KS5vZmYoJ21vdXNlZG93bicsIHRoaXMuaGlkZSk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIC8vdGhpcy5zZXQoKTtcclxuICAgICAgICB0aGlzLmVsZW1lbnQudHJpZ2dlcih7XHJcbiAgICAgICAgICAgIHR5cGU6ICdoaWRlJyxcclxuICAgICAgICAgICAgZGF0ZTogdGhpcy5kYXRlXHJcbiAgICAgICAgfSk7XHJcbiAgICB9LFxyXG4gICAgXHJcbiAgICBzZXQ6IGZ1bmN0aW9uKCkge1xyXG4gICAgICAgIHZhciBmb3JtYXRlZCA9IERQR2xvYmFsLmZvcm1hdERhdGUodGhpcy5kYXRlLCB0aGlzLmZvcm1hdCk7XHJcbiAgICAgICAgaWYgKCF0aGlzLmlzSW5wdXQpIHtcclxuICAgICAgICAgICAgaWYgKHRoaXMuY29tcG9uZW50KXtcclxuICAgICAgICAgICAgICAgIHRoaXMuZWxlbWVudC5maW5kKCdpbnB1dCcpLnByb3AoJ3ZhbHVlJywgZm9ybWF0ZWQpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIHRoaXMuZWxlbWVudC5kYXRhKCdkYXRlJywgZm9ybWF0ZWQpO1xyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgIHRoaXMuZWxlbWVudC5wcm9wKCd2YWx1ZScsIGZvcm1hdGVkKTtcclxuICAgICAgICB9XHJcbiAgICB9LFxyXG4gICAgXHJcbiAgICAvKipcclxuICAgICAgICBTZXRzIGEgZGF0ZSBhcyB2YWx1ZSBhbmQgbm90aWZ5IHdpdGggYW4gZXZlbnQuXHJcbiAgICAgICAgUGFyYW1ldGVyIGRvbnROb3RpZnkgaXMgb25seSBmb3IgY2FzZXMgd2hlcmUgdGhlIGNhbGVuZGFyIG9yXHJcbiAgICAgICAgc29tZSByZWxhdGVkIGNvbXBvbmVudCBnZXRzIGFscmVhZHkgdXBkYXRlZCBidXQgdGhlIGhpZ2hsaWdodGVkXHJcbiAgICAgICAgZGF0ZSBuZWVkcyB0byBiZSB1cGRhdGVkIHdpdGhvdXQgY3JlYXRlIGluZmluaXRlIHJlY3Vyc2lvbiBcclxuICAgICAgICBiZWNhdXNlIG9mIG5vdGlmaWNhdGlvbi4gSW4gb3RoZXIgY2FzZSwgZG9udCB1c2UuXHJcbiAgICAqKi9cclxuICAgIHNldFZhbHVlOiBmdW5jdGlvbihuZXdEYXRlLCBkb250Tm90aWZ5KSB7XHJcbiAgICAgICAgaWYgKHR5cGVvZiBuZXdEYXRlID09PSAnc3RyaW5nJykge1xyXG4gICAgICAgICAgICB0aGlzLmRhdGUgPSBEUEdsb2JhbC5wYXJzZURhdGUobmV3RGF0ZSwgdGhpcy5mb3JtYXQpO1xyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgIHRoaXMuZGF0ZSA9IG5ldyBEYXRlKG5ld0RhdGUpO1xyXG4gICAgICAgIH1cclxuICAgICAgICB0aGlzLnNldCgpO1xyXG4gICAgICAgIHRoaXMudmlld0RhdGUgPSBuZXcgRGF0ZSh0aGlzLmRhdGUuZ2V0RnVsbFllYXIoKSwgdGhpcy5kYXRlLmdldE1vbnRoKCksIDEsIDAsIDAsIDAsIDApO1xyXG4gICAgICAgIHRoaXMuZmlsbCgpO1xyXG4gICAgICAgIFxyXG4gICAgICAgIGlmIChkb250Tm90aWZ5ICE9PSB0cnVlKSB7XHJcbiAgICAgICAgICAgIC8vIE5vdGlmeTpcclxuICAgICAgICAgICAgdGhpcy5lbGVtZW50LnRyaWdnZXIoe1xyXG4gICAgICAgICAgICAgICAgdHlwZTogJ2NoYW5nZURhdGUnLFxyXG4gICAgICAgICAgICAgICAgZGF0ZTogdGhpcy5kYXRlLFxyXG4gICAgICAgICAgICAgICAgdmlld01vZGU6IERQR2xvYmFsLm1vZGVzW3RoaXMudmlld01vZGVdLmNsc05hbWVcclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgfVxyXG4gICAgfSxcclxuICAgIFxyXG4gICAgZ2V0VmFsdWU6IGZ1bmN0aW9uKCkge1xyXG4gICAgICAgIHJldHVybiB0aGlzLmRhdGU7XHJcbiAgICB9LFxyXG4gICAgXHJcbiAgICBtb3ZlVmFsdWU6IGZ1bmN0aW9uKGRpciwgbW9kZSkge1xyXG4gICAgICAgIC8vIGRpciBjYW4gYmU6ICdwcmV2JywgJ25leHQnXHJcbiAgICAgICAgaWYgKFsncHJldicsICduZXh0J10uaW5kZXhPZihkaXIgJiYgZGlyLnRvTG93ZXJDYXNlKCkpID09IC0xKVxyXG4gICAgICAgICAgICAvLyBObyB2YWxpZCBvcHRpb246XHJcbiAgICAgICAgICAgIHJldHVybjtcclxuXHJcbiAgICAgICAgLy8gZGVmYXVsdCBtb2RlIGlzIHRoZSBjdXJyZW50IG9uZVxyXG4gICAgICAgIG1vZGUgPSBtb2RlID9cclxuICAgICAgICAgICAgRFBHbG9iYWwubW9kZXNTZXRbbW9kZV0gOlxyXG4gICAgICAgICAgICBEUEdsb2JhbC5tb2Rlc1t0aGlzLnZpZXdNb2RlXTtcclxuXHJcbiAgICAgICAgdGhpcy5kYXRlWydzZXQnICsgbW9kZS5uYXZGbmNdLmNhbGwoXHJcbiAgICAgICAgICAgIHRoaXMuZGF0ZSxcclxuICAgICAgICAgICAgdGhpcy5kYXRlWydnZXQnICsgbW9kZS5uYXZGbmNdLmNhbGwodGhpcy5kYXRlKSArIFxyXG4gICAgICAgICAgICBtb2RlLm5hdlN0ZXAgKiAoZGlyID09PSAncHJldicgPyAtMSA6IDEpXHJcbiAgICAgICAgKTtcclxuICAgICAgICB0aGlzLnNldFZhbHVlKHRoaXMuZGF0ZSk7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMuZGF0ZTtcclxuICAgIH0sXHJcbiAgICBcclxuICAgIHBsYWNlOiBmdW5jdGlvbigpe1xyXG4gICAgICAgIHZhciBvZmZzZXQgPSB0aGlzLmNvbXBvbmVudCA/IHRoaXMuY29tcG9uZW50Lm9mZnNldCgpIDogdGhpcy5lbGVtZW50Lm9mZnNldCgpO1xyXG4gICAgICAgIHRoaXMucGlja2VyLmNzcyh7XHJcbiAgICAgICAgICAgIHRvcDogb2Zmc2V0LnRvcCArIHRoaXMuaGVpZ2h0LFxyXG4gICAgICAgICAgICBsZWZ0OiBvZmZzZXQubGVmdFxyXG4gICAgICAgIH0pO1xyXG4gICAgfSxcclxuICAgIFxyXG4gICAgdXBkYXRlOiBmdW5jdGlvbihuZXdEYXRlKXtcclxuICAgICAgICB0aGlzLmRhdGUgPSBEUEdsb2JhbC5wYXJzZURhdGUoXHJcbiAgICAgICAgICAgIHR5cGVvZiBuZXdEYXRlID09PSAnc3RyaW5nJyA/IG5ld0RhdGUgOiAodGhpcy5pc0lucHV0ID8gdGhpcy5lbGVtZW50LnByb3AoJ3ZhbHVlJykgOiB0aGlzLmVsZW1lbnQuZGF0YSgnZGF0ZScpKSxcclxuICAgICAgICAgICAgdGhpcy5mb3JtYXRcclxuICAgICAgICApO1xyXG4gICAgICAgIHRoaXMudmlld0RhdGUgPSBuZXcgRGF0ZSh0aGlzLmRhdGUuZ2V0RnVsbFllYXIoKSwgdGhpcy5kYXRlLmdldE1vbnRoKCksIDEsIDAsIDAsIDAsIDApO1xyXG4gICAgICAgIHRoaXMuZmlsbCgpO1xyXG4gICAgfSxcclxuICAgIFxyXG4gICAgZmlsbERvdzogZnVuY3Rpb24oKXtcclxuICAgICAgICB2YXIgZG93Q250ID0gdGhpcy53ZWVrU3RhcnQ7XHJcbiAgICAgICAgdmFyIGh0bWwgPSAnPHRyPic7XHJcbiAgICAgICAgd2hpbGUgKGRvd0NudCA8IHRoaXMud2Vla1N0YXJ0ICsgNykge1xyXG4gICAgICAgICAgICBodG1sICs9ICc8dGggY2xhc3M9XCJkb3dcIj4nK0RQR2xvYmFsLmRhdGVzLmRheXNNaW5bKGRvd0NudCsrKSU3XSsnPC90aD4nO1xyXG4gICAgICAgIH1cclxuICAgICAgICBodG1sICs9ICc8L3RyPic7XHJcbiAgICAgICAgdGhpcy5waWNrZXIuZmluZCgnLicgKyBjbGFzc2VzLmRheXMgKyAnIHRoZWFkJykuYXBwZW5kKGh0bWwpO1xyXG4gICAgfSxcclxuICAgIFxyXG4gICAgZmlsbE1vbnRoczogZnVuY3Rpb24oKXtcclxuICAgICAgICB2YXIgaHRtbCA9ICcnO1xyXG4gICAgICAgIHZhciBpID0gMDtcclxuICAgICAgICB3aGlsZSAoaSA8IDEyKSB7XHJcbiAgICAgICAgICAgIGh0bWwgKz0gJzxzcGFuIGNsYXNzPVwiJyArIGNsYXNzZXMubW9udGggKyAnXCI+JytEUEdsb2JhbC5kYXRlcy5tb250aHNTaG9ydFtpKytdKyc8L3NwYW4+JztcclxuICAgICAgICB9XHJcbiAgICAgICAgdGhpcy5waWNrZXIuZmluZCgnLicgKyBjbGFzc2VzLm1vbnRocyArICcgdGQnKS5hcHBlbmQoaHRtbCk7XHJcbiAgICB9LFxyXG4gICAgXHJcbiAgICBmaWxsOiBmdW5jdGlvbigpIHtcclxuICAgICAgICAvKmpzaGludCBtYXhzdGF0ZW1lbnRzOjY2LCBtYXhjb21wbGV4aXR5OjI4Ki9cclxuICAgICAgICB2YXIgZCA9IG5ldyBEYXRlKHRoaXMudmlld0RhdGUpLFxyXG4gICAgICAgICAgICB5ZWFyID0gZC5nZXRGdWxsWWVhcigpLFxyXG4gICAgICAgICAgICBtb250aCA9IGQuZ2V0TW9udGgoKSxcclxuICAgICAgICAgICAgY3VycmVudERhdGUgPSB0aGlzLmRhdGUudmFsdWVPZigpO1xyXG4gICAgICAgIHRoaXMucGlja2VyXHJcbiAgICAgICAgLmZpbmQoJy4nICsgY2xhc3Nlcy5kYXlzICsgJyB0aDplcSgxKScpXHJcbiAgICAgICAgLmh0bWwoRFBHbG9iYWwuZGF0ZXMubW9udGhzW21vbnRoXSArICcgJyArIHllYXIpO1xyXG4gICAgICAgIHZhciBwcmV2TW9udGggPSBuZXcgRGF0ZSh5ZWFyLCBtb250aC0xLCAyOCwwLDAsMCwwKSxcclxuICAgICAgICAgICAgZGF5ID0gRFBHbG9iYWwuZ2V0RGF5c0luTW9udGgocHJldk1vbnRoLmdldEZ1bGxZZWFyKCksIHByZXZNb250aC5nZXRNb250aCgpKTtcclxuICAgICAgICBwcmV2TW9udGguc2V0RGF0ZShkYXkpO1xyXG4gICAgICAgIHByZXZNb250aC5zZXREYXRlKGRheSAtIChwcmV2TW9udGguZ2V0RGF5KCkgLSB0aGlzLndlZWtTdGFydCArIDcpJTcpO1xyXG4gICAgICAgIHZhciBuZXh0TW9udGggPSBuZXcgRGF0ZShwcmV2TW9udGgpO1xyXG4gICAgICAgIG5leHRNb250aC5zZXREYXRlKG5leHRNb250aC5nZXREYXRlKCkgKyA0Mik7XHJcbiAgICAgICAgbmV4dE1vbnRoID0gbmV4dE1vbnRoLnZhbHVlT2YoKTtcclxuICAgICAgICB2YXIgaHRtbCA9IFtdO1xyXG4gICAgICAgIHZhciBjbHNOYW1lLFxyXG4gICAgICAgICAgICBwcmV2WSxcclxuICAgICAgICAgICAgcHJldk07XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgIGlmICh0aGlzLl9kYXlzQ3JlYXRlZCAhPT0gdHJ1ZSkge1xyXG4gICAgICAgICAgICAvLyBDcmVhdGUgaHRtbCAoZmlyc3QgdGltZSBvbmx5KVxyXG4gICAgICAgXHJcbiAgICAgICAgICAgIHdoaWxlKHByZXZNb250aC52YWx1ZU9mKCkgPCBuZXh0TW9udGgpIHtcclxuICAgICAgICAgICAgICAgIGlmIChwcmV2TW9udGguZ2V0RGF5KCkgPT09IHRoaXMud2Vla1N0YXJ0KSB7XHJcbiAgICAgICAgICAgICAgICAgICAgaHRtbC5wdXNoKCc8dHI+Jyk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBjbHNOYW1lID0gdGhpcy5vblJlbmRlcihwcmV2TW9udGgpO1xyXG4gICAgICAgICAgICAgICAgcHJldlkgPSBwcmV2TW9udGguZ2V0RnVsbFllYXIoKTtcclxuICAgICAgICAgICAgICAgIHByZXZNID0gcHJldk1vbnRoLmdldE1vbnRoKCk7XHJcbiAgICAgICAgICAgICAgICBpZiAoKHByZXZNIDwgbW9udGggJiYgIHByZXZZID09PSB5ZWFyKSB8fCAgcHJldlkgPCB5ZWFyKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgY2xzTmFtZSArPSAnIG9sZCc7XHJcbiAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKChwcmV2TSA+IG1vbnRoICYmIHByZXZZID09PSB5ZWFyKSB8fCBwcmV2WSA+IHllYXIpIHtcclxuICAgICAgICAgICAgICAgICAgICBjbHNOYW1lICs9ICcgbmV3JztcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIGlmIChwcmV2TW9udGgudmFsdWVPZigpID09PSBjdXJyZW50RGF0ZSkge1xyXG4gICAgICAgICAgICAgICAgICAgIGNsc05hbWUgKz0gJyBhY3RpdmUnO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgaHRtbC5wdXNoKCc8dGQgY2xhc3M9XCInICsgY2xhc3Nlcy5tb250aERheSArICcgJyArIGNsc05hbWUrJ1wiPicrcHJldk1vbnRoLmdldERhdGUoKSArICc8L3RkPicpO1xyXG4gICAgICAgICAgICAgICAgaWYgKHByZXZNb250aC5nZXREYXkoKSA9PT0gdGhpcy53ZWVrRW5kKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgaHRtbC5wdXNoKCc8L3RyPicpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgcHJldk1vbnRoLnNldERhdGUocHJldk1vbnRoLmdldERhdGUoKSsxKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgdGhpcy5waWNrZXIuZmluZCgnLicgKyBjbGFzc2VzLmRheXMgKyAnIHRib2R5JykuZW1wdHkoKS5hcHBlbmQoaHRtbC5qb2luKCcnKSk7XHJcbiAgICAgICAgICAgIHRoaXMuX2RheXNDcmVhdGVkID0gdHJ1ZTtcclxuICAgICAgICB9XHJcbiAgICAgICAgZWxzZSB7XHJcbiAgICAgICAgICAgIC8vIFVwZGF0ZSBkYXlzIHZhbHVlc1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgdmFyIHdlZWtUciA9IHRoaXMucGlja2VyLmZpbmQoJy4nICsgY2xhc3Nlcy5kYXlzICsgJyB0Ym9keSB0cjpmaXJzdC1jaGlsZCgpJyk7XHJcbiAgICAgICAgICAgIHZhciBkYXlUZCA9IG51bGw7XHJcbiAgICAgICAgICAgIHdoaWxlKHByZXZNb250aC52YWx1ZU9mKCkgPCBuZXh0TW9udGgpIHtcclxuICAgICAgICAgICAgICAgIHZhciBjdXJyZW50V2Vla0RheUluZGV4ID0gcHJldk1vbnRoLmdldERheSgpIC0gdGhpcy53ZWVrU3RhcnQ7XHJcblxyXG4gICAgICAgICAgICAgICAgY2xzTmFtZSA9IHRoaXMub25SZW5kZXIocHJldk1vbnRoKTtcclxuICAgICAgICAgICAgICAgIHByZXZZID0gcHJldk1vbnRoLmdldEZ1bGxZZWFyKCk7XHJcbiAgICAgICAgICAgICAgICBwcmV2TSA9IHByZXZNb250aC5nZXRNb250aCgpO1xyXG4gICAgICAgICAgICAgICAgaWYgKChwcmV2TSA8IG1vbnRoICYmICBwcmV2WSA9PT0geWVhcikgfHwgIHByZXZZIDwgeWVhcikge1xyXG4gICAgICAgICAgICAgICAgICAgIGNsc05hbWUgKz0gJyBvbGQnO1xyXG4gICAgICAgICAgICAgICAgfSBlbHNlIGlmICgocHJldk0gPiBtb250aCAmJiBwcmV2WSA9PT0geWVhcikgfHwgcHJldlkgPiB5ZWFyKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgY2xzTmFtZSArPSAnIG5ldyc7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBpZiAocHJldk1vbnRoLnZhbHVlT2YoKSA9PT0gY3VycmVudERhdGUpIHtcclxuICAgICAgICAgICAgICAgICAgICBjbHNOYW1lICs9ICcgYWN0aXZlJztcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIC8vaHRtbC5wdXNoKCc8dGQgY2xhc3M9XCJkYXkgJytjbHNOYW1lKydcIj4nK3ByZXZNb250aC5nZXREYXRlKCkgKyAnPC90ZD4nKTtcclxuICAgICAgICAgICAgICAgIGRheVRkID0gd2Vla1RyLmZpbmQoJ3RkOmVxKCcgKyBjdXJyZW50V2Vla0RheUluZGV4ICsgJyknKTtcclxuICAgICAgICAgICAgICAgIGRheVRkXHJcbiAgICAgICAgICAgICAgICAuYXR0cignY2xhc3MnLCAnZGF5ICcgKyBjbHNOYW1lKVxyXG4gICAgICAgICAgICAgICAgLnRleHQocHJldk1vbnRoLmdldERhdGUoKSk7XHJcbiAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgICAgIC8vIE5leHQgd2Vlaz9cclxuICAgICAgICAgICAgICAgIGlmIChwcmV2TW9udGguZ2V0RGF5KCkgPT09IHRoaXMud2Vla0VuZCkge1xyXG4gICAgICAgICAgICAgICAgICAgIHdlZWtUciA9IHdlZWtUci5uZXh0KCd0cicpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgcHJldk1vbnRoLnNldERhdGUocHJldk1vbnRoLmdldERhdGUoKSsxKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgdmFyIGN1cnJlbnRZZWFyID0gdGhpcy5kYXRlLmdldEZ1bGxZZWFyKCk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgdmFyIG1vbnRocyA9IHRoaXMucGlja2VyLmZpbmQoJy4nICsgY2xhc3Nlcy5tb250aHMpXHJcbiAgICAgICAgICAgICAgICAgICAgLmZpbmQoJ3RoOmVxKDEpJylcclxuICAgICAgICAgICAgICAgICAgICAgICAgLmh0bWwoeWVhcilcclxuICAgICAgICAgICAgICAgICAgICAgICAgLmVuZCgpXHJcbiAgICAgICAgICAgICAgICAgICAgLmZpbmQoJ3NwYW4nKS5yZW1vdmVDbGFzcygnYWN0aXZlJyk7XHJcbiAgICAgICAgaWYgKGN1cnJlbnRZZWFyID09PSB5ZWFyKSB7XHJcbiAgICAgICAgICAgIG1vbnRocy5lcSh0aGlzLmRhdGUuZ2V0TW9udGgoKSkuYWRkQ2xhc3MoJ2FjdGl2ZScpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBcclxuICAgICAgICBodG1sID0gJyc7XHJcbiAgICAgICAgeWVhciA9IHBhcnNlSW50KHllYXIvMTAsIDEwKSAqIDEwO1xyXG4gICAgICAgIHZhciB5ZWFyQ29udCA9IHRoaXMucGlja2VyLmZpbmQoJy4nICsgY2xhc3Nlcy55ZWFycylcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC5maW5kKCd0aDplcSgxKScpXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLnRleHQoeWVhciArICctJyArICh5ZWFyICsgOSkpXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLmVuZCgpXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAuZmluZCgndGQnKTtcclxuICAgICAgICBcclxuICAgICAgICB5ZWFyIC09IDE7XHJcbiAgICAgICAgdmFyIGk7XHJcbiAgICAgICAgaWYgKHRoaXMuX3llYXJzQ3JlYXRlZCAhPT0gdHJ1ZSkge1xyXG5cclxuICAgICAgICAgICAgZm9yIChpID0gLTE7IGkgPCAxMTsgaSsrKSB7XHJcbiAgICAgICAgICAgICAgICBodG1sICs9ICc8c3BhbiBjbGFzcz1cIicgKyBjbGFzc2VzLnllYXIgKyAoaSA9PT0gLTEgfHwgaSA9PT0gMTAgPyAnIG9sZCcgOiAnJykrKGN1cnJlbnRZZWFyID09PSB5ZWFyID8gJyBhY3RpdmUnIDogJycpKydcIj4nK3llYXIrJzwvc3Bhbj4nO1xyXG4gICAgICAgICAgICAgICAgeWVhciArPSAxO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICB5ZWFyQ29udC5odG1sKGh0bWwpO1xyXG4gICAgICAgICAgICB0aGlzLl95ZWFyc0NyZWF0ZWQgPSB0cnVlO1xyXG4gICAgICAgIH1cclxuICAgICAgICBlbHNlIHtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIHZhciB5ZWFyU3BhbiA9IHllYXJDb250LmZpbmQoJ3NwYW46Zmlyc3QtY2hpbGQoKScpO1xyXG4gICAgICAgICAgICBmb3IgKGkgPSAtMTsgaSA8IDExOyBpKyspIHtcclxuICAgICAgICAgICAgICAgIC8vaHRtbCArPSAnPHNwYW4gY2xhc3M9XCJ5ZWFyJysoaSA9PT0gLTEgfHwgaSA9PT0gMTAgPyAnIG9sZCcgOiAnJykrKGN1cnJlbnRZZWFyID09PSB5ZWFyID8gJyBhY3RpdmUnIDogJycpKydcIj4nK3llYXIrJzwvc3Bhbj4nO1xyXG4gICAgICAgICAgICAgICAgeWVhclNwYW5cclxuICAgICAgICAgICAgICAgIC50ZXh0KHllYXIpXHJcbiAgICAgICAgICAgICAgICAuYXR0cignY2xhc3MnLCAneWVhcicgKyAoaSA9PT0gLTEgfHwgaSA9PT0gMTAgPyAnIG9sZCcgOiAnJykgKyAoY3VycmVudFllYXIgPT09IHllYXIgPyAnIGFjdGl2ZScgOiAnJykpO1xyXG4gICAgICAgICAgICAgICAgeWVhciArPSAxO1xyXG4gICAgICAgICAgICAgICAgeWVhclNwYW4gPSB5ZWFyU3Bhbi5uZXh0KCk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICB9LFxyXG4gICAgXHJcbiAgICBtb3ZlRGF0ZTogZnVuY3Rpb24oZGlyLCBtb2RlKSB7XHJcbiAgICAgICAgLy8gZGlyIGNhbiBiZTogJ3ByZXYnLCAnbmV4dCdcclxuICAgICAgICBpZiAoWydwcmV2JywgJ25leHQnXS5pbmRleE9mKGRpciAmJiBkaXIudG9Mb3dlckNhc2UoKSkgPT0gLTEpXHJcbiAgICAgICAgICAgIC8vIE5vIHZhbGlkIG9wdGlvbjpcclxuICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAvLyBkZWZhdWx0IG1vZGUgaXMgdGhlIGN1cnJlbnQgb25lXHJcbiAgICAgICAgbW9kZSA9IG1vZGUgfHwgdGhpcy52aWV3TW9kZTtcclxuXHJcbiAgICAgICAgdGhpcy52aWV3RGF0ZVsnc2V0JytEUEdsb2JhbC5tb2Rlc1ttb2RlXS5uYXZGbmNdLmNhbGwoXHJcbiAgICAgICAgICAgIHRoaXMudmlld0RhdGUsXHJcbiAgICAgICAgICAgIHRoaXMudmlld0RhdGVbJ2dldCcrRFBHbG9iYWwubW9kZXNbbW9kZV0ubmF2Rm5jXS5jYWxsKHRoaXMudmlld0RhdGUpICsgXHJcbiAgICAgICAgICAgIERQR2xvYmFsLm1vZGVzW21vZGVdLm5hdlN0ZXAgKiAoZGlyID09PSAncHJldicgPyAtMSA6IDEpXHJcbiAgICAgICAgKTtcclxuICAgICAgICB0aGlzLmZpbGwoKTtcclxuICAgICAgICB0aGlzLnNldCgpO1xyXG4gICAgfSxcclxuXHJcbiAgICBjbGljazogZnVuY3Rpb24oZSkge1xyXG4gICAgICAgIC8qanNoaW50IG1heGNvbXBsZXhpdHk6MTYqL1xyXG4gICAgICAgIGUuc3RvcFByb3BhZ2F0aW9uKCk7XHJcbiAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xyXG4gICAgICAgIHZhciB0YXJnZXQgPSAkKGUudGFyZ2V0KS5jbG9zZXN0KCdzcGFuLCB0ZCwgdGgnKTtcclxuICAgICAgICBpZiAodGFyZ2V0Lmxlbmd0aCA9PT0gMSkge1xyXG4gICAgICAgICAgICB2YXIgbW9udGgsIHllYXI7XHJcbiAgICAgICAgICAgIHN3aXRjaCh0YXJnZXRbMF0ubm9kZU5hbWUudG9Mb3dlckNhc2UoKSkge1xyXG4gICAgICAgICAgICAgICAgY2FzZSAndGgnOlxyXG4gICAgICAgICAgICAgICAgICAgIHN3aXRjaCh0YXJnZXRbMF0uY2xhc3NOYW1lKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGNhc2UgJ3N3aXRjaCc6XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnNob3dNb2RlKDEpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGNhc2UgJ3ByZXYnOlxyXG4gICAgICAgICAgICAgICAgICAgICAgICBjYXNlICduZXh0JzpcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMubW92ZURhdGUodGFyZ2V0WzBdLmNsYXNzTmFtZSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgICAgICBjYXNlICdzcGFuJzpcclxuICAgICAgICAgICAgICAgICAgICBpZiAodGFyZ2V0LmlzKCcuJyArIGNsYXNzZXMubW9udGgpKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIG1vbnRoID0gdGFyZ2V0LnBhcmVudCgpLmZpbmQoJ3NwYW4nKS5pbmRleCh0YXJnZXQpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnZpZXdEYXRlLnNldE1vbnRoKG1vbnRoKTtcclxuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB5ZWFyID0gcGFyc2VJbnQodGFyZ2V0LnRleHQoKSwgMTApfHwwO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnZpZXdEYXRlLnNldEZ1bGxZZWFyKHllYXIpO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICBpZiAodGhpcy52aWV3TW9kZSAhPT0gMCkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmRhdGUgPSBuZXcgRGF0ZSh0aGlzLnZpZXdEYXRlKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5lbGVtZW50LnRyaWdnZXIoe1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogJ2NoYW5nZURhdGUnLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZGF0ZTogdGhpcy5kYXRlLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdmlld01vZGU6IERQR2xvYmFsLm1vZGVzW3RoaXMudmlld01vZGVdLmNsc05hbWVcclxuICAgICAgICAgICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuc2hvd01vZGUoLTEpO1xyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuZmlsbCgpO1xyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuc2V0KCk7XHJcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgICAgICBjYXNlICd0ZCc6XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKHRhcmdldC5pcygnLmRheScpICYmICF0YXJnZXQuaXMoJy5kaXNhYmxlZCcpKXtcclxuICAgICAgICAgICAgICAgICAgICAgICAgdmFyIGRheSA9IHBhcnNlSW50KHRhcmdldC50ZXh0KCksIDEwKXx8MTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgbW9udGggPSB0aGlzLnZpZXdEYXRlLmdldE1vbnRoKCk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICh0YXJnZXQuaXMoJy5vbGQnKSkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbW9udGggLT0gMTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIGlmICh0YXJnZXQuaXMoJy5uZXcnKSkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbW9udGggKz0gMTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICB5ZWFyID0gdGhpcy52aWV3RGF0ZS5nZXRGdWxsWWVhcigpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmRhdGUgPSBuZXcgRGF0ZSh5ZWFyLCBtb250aCwgZGF5LDAsMCwwLDApO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnZpZXdEYXRlID0gbmV3IERhdGUoeWVhciwgbW9udGgsIE1hdGgubWluKDI4LCBkYXkpLDAsMCwwLDApO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmZpbGwoKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5zZXQoKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5lbGVtZW50LnRyaWdnZXIoe1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogJ2NoYW5nZURhdGUnLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZGF0ZTogdGhpcy5kYXRlLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdmlld01vZGU6IERQR2xvYmFsLm1vZGVzW3RoaXMudmlld01vZGVdLmNsc05hbWVcclxuICAgICAgICAgICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgfSxcclxuICAgIFxyXG4gICAgbW91c2Vkb3duOiBmdW5jdGlvbihlKXtcclxuICAgICAgICBlLnN0b3BQcm9wYWdhdGlvbigpO1xyXG4gICAgICAgIGUucHJldmVudERlZmF1bHQoKTtcclxuICAgIH0sXHJcbiAgICBcclxuICAgIHNob3dNb2RlOiBmdW5jdGlvbihkaXIpIHtcclxuICAgICAgICBpZiAoZGlyKSB7XHJcbiAgICAgICAgICAgIHRoaXMudmlld01vZGUgPSBNYXRoLm1heCh0aGlzLm1pblZpZXdNb2RlLCBNYXRoLm1pbigyLCB0aGlzLnZpZXdNb2RlICsgZGlyKSk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHRoaXMucGlja2VyLmZpbmQoJz5kaXYnKS5oaWRlKCkuZmlsdGVyKCcuJyArIGNsYXNzZXMuY29tcG9uZW50ICsgJy0nICsgRFBHbG9iYWwubW9kZXNbdGhpcy52aWV3TW9kZV0uY2xzTmFtZSkuc2hvdygpO1xyXG4gICAgfVxyXG59O1xyXG5cclxuJC5mbi5kYXRlcGlja2VyID0gZnVuY3Rpb24gKCBvcHRpb24gKSB7XHJcbiAgICB2YXIgdmFscyA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cywgMSk7XHJcbiAgICB2YXIgcmV0dXJuZWQ7XHJcbiAgICB0aGlzLmVhY2goZnVuY3Rpb24gKCkge1xyXG4gICAgICAgIHZhciAkdGhpcyA9ICQodGhpcyksXHJcbiAgICAgICAgICAgIGRhdGEgPSAkdGhpcy5kYXRhKCdkYXRlcGlja2VyJyksXHJcbiAgICAgICAgICAgIG9wdGlvbnMgPSB0eXBlb2Ygb3B0aW9uID09PSAnb2JqZWN0JyAmJiBvcHRpb247XHJcbiAgICAgICAgaWYgKCFkYXRhKSB7XHJcbiAgICAgICAgICAgICR0aGlzLmRhdGEoJ2RhdGVwaWNrZXInLCAoZGF0YSA9IG5ldyBEYXRlUGlja2VyKHRoaXMsICQuZXh0ZW5kKHt9LCAkLmZuLmRhdGVwaWNrZXIuZGVmYXVsdHMsb3B0aW9ucykpKSk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBpZiAodHlwZW9mIG9wdGlvbiA9PT0gJ3N0cmluZycpIHtcclxuICAgICAgICAgICAgcmV0dXJuZWQgPSBkYXRhW29wdGlvbl0uYXBwbHkoZGF0YSwgdmFscyk7XHJcbiAgICAgICAgICAgIC8vIFRoZXJlIGlzIGEgdmFsdWUgcmV0dXJuZWQgYnkgdGhlIG1ldGhvZD9cclxuICAgICAgICAgICAgaWYgKHR5cGVvZihyZXR1cm5lZCAhPT0gJ3VuZGVmaW5lZCcpKSB7XHJcbiAgICAgICAgICAgICAgICAvLyBHbyBvdXQgdGhlIGxvb3AgdG8gcmV0dXJuIHRoZSB2YWx1ZSBmcm9tIHRoZSBmaXJzdFxyXG4gICAgICAgICAgICAgICAgLy8gZWxlbWVudC1tZXRob2QgZXhlY3V0aW9uXHJcbiAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgLy8gRm9sbG93IG5leHQgbG9vcCBpdGVtXHJcbiAgICAgICAgfVxyXG4gICAgfSk7XHJcbiAgICBpZiAodHlwZW9mKHJldHVybmVkKSAhPT0gJ3VuZGVmaW5lZCcpXHJcbiAgICAgICAgcmV0dXJuIHJldHVybmVkO1xyXG4gICAgZWxzZVxyXG4gICAgICAgIC8vIGNoYWluaW5nOlxyXG4gICAgICAgIHJldHVybiB0aGlzO1xyXG59O1xyXG5cclxuJC5mbi5kYXRlcGlja2VyLmRlZmF1bHRzID0ge1xyXG4gICAgb25SZW5kZXI6IGZ1bmN0aW9uKGRhdGUpIHtcclxuICAgICAgICByZXR1cm4gJyc7XHJcbiAgICB9XHJcbn07XHJcbiQuZm4uZGF0ZXBpY2tlci5Db25zdHJ1Y3RvciA9IERhdGVQaWNrZXI7XHJcblxyXG52YXIgRFBHbG9iYWwgPSB7XHJcbiAgICBtb2RlczogW1xyXG4gICAgICAgIHtcclxuICAgICAgICAgICAgY2xzTmFtZTogJ2RheXMnLFxyXG4gICAgICAgICAgICBuYXZGbmM6ICdNb250aCcsXHJcbiAgICAgICAgICAgIG5hdlN0ZXA6IDFcclxuICAgICAgICB9LFxyXG4gICAgICAgIHtcclxuICAgICAgICAgICAgY2xzTmFtZTogJ21vbnRocycsXHJcbiAgICAgICAgICAgIG5hdkZuYzogJ0Z1bGxZZWFyJyxcclxuICAgICAgICAgICAgbmF2U3RlcDogMVxyXG4gICAgICAgIH0sXHJcbiAgICAgICAge1xyXG4gICAgICAgICAgICBjbHNOYW1lOiAneWVhcnMnLFxyXG4gICAgICAgICAgICBuYXZGbmM6ICdGdWxsWWVhcicsXHJcbiAgICAgICAgICAgIG5hdlN0ZXA6IDEwXHJcbiAgICAgICAgfSxcclxuICAgICAgICB7XHJcbiAgICAgICAgICAgIGNsc05hbWU6ICdkYXknLFxyXG4gICAgICAgICAgICBuYXZGbmM6ICdEYXRlJyxcclxuICAgICAgICAgICAgbmF2U3RlcDogMVxyXG4gICAgICAgIH1cclxuICAgIF0sXHJcbiAgICBkYXRlczp7XHJcbiAgICAgICAgZGF5czogW1wiU3VuZGF5XCIsIFwiTW9uZGF5XCIsIFwiVHVlc2RheVwiLCBcIldlZG5lc2RheVwiLCBcIlRodXJzZGF5XCIsIFwiRnJpZGF5XCIsIFwiU2F0dXJkYXlcIiwgXCJTdW5kYXlcIl0sXHJcbiAgICAgICAgZGF5c1Nob3J0OiBbXCJTdW5cIiwgXCJNb25cIiwgXCJUdWVcIiwgXCJXZWRcIiwgXCJUaHVcIiwgXCJGcmlcIiwgXCJTYXRcIiwgXCJTdW5cIl0sXHJcbiAgICAgICAgZGF5c01pbjogW1wiU3VcIiwgXCJNb1wiLCBcIlR1XCIsIFwiV2VcIiwgXCJUaFwiLCBcIkZyXCIsIFwiU2FcIiwgXCJTdVwiXSxcclxuICAgICAgICBtb250aHM6IFtcIkphbnVhcnlcIiwgXCJGZWJydWFyeVwiLCBcIk1hcmNoXCIsIFwiQXByaWxcIiwgXCJNYXlcIiwgXCJKdW5lXCIsIFwiSnVseVwiLCBcIkF1Z3VzdFwiLCBcIlNlcHRlbWJlclwiLCBcIk9jdG9iZXJcIiwgXCJOb3ZlbWJlclwiLCBcIkRlY2VtYmVyXCJdLFxyXG4gICAgICAgIG1vbnRoc1Nob3J0OiBbXCJKYW5cIiwgXCJGZWJcIiwgXCJNYXJcIiwgXCJBcHJcIiwgXCJNYXlcIiwgXCJKdW5cIiwgXCJKdWxcIiwgXCJBdWdcIiwgXCJTZXBcIiwgXCJPY3RcIiwgXCJOb3ZcIiwgXCJEZWNcIl1cclxuICAgIH0sXHJcbiAgICBpc0xlYXBZZWFyOiBmdW5jdGlvbiAoeWVhcikge1xyXG4gICAgICAgIHJldHVybiAoKCh5ZWFyICUgNCA9PT0gMCkgJiYgKHllYXIgJSAxMDAgIT09IDApKSB8fCAoeWVhciAlIDQwMCA9PT0gMCkpO1xyXG4gICAgfSxcclxuICAgIGdldERheXNJbk1vbnRoOiBmdW5jdGlvbiAoeWVhciwgbW9udGgpIHtcclxuICAgICAgICByZXR1cm4gWzMxLCAoRFBHbG9iYWwuaXNMZWFwWWVhcih5ZWFyKSA/IDI5IDogMjgpLCAzMSwgMzAsIDMxLCAzMCwgMzEsIDMxLCAzMCwgMzEsIDMwLCAzMV1bbW9udGhdO1xyXG4gICAgfSxcclxuICAgIHBhcnNlRm9ybWF0OiBmdW5jdGlvbihmb3JtYXQpe1xyXG4gICAgICAgIHZhciBzZXBhcmF0b3IgPSBmb3JtYXQubWF0Y2goL1suXFwvXFwtXFxzXS4qPy8pLFxyXG4gICAgICAgICAgICBwYXJ0cyA9IGZvcm1hdC5zcGxpdCgvXFxXKy8pO1xyXG4gICAgICAgIGlmICghc2VwYXJhdG9yIHx8ICFwYXJ0cyB8fCBwYXJ0cy5sZW5ndGggPT09IDApe1xyXG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJJbnZhbGlkIGRhdGUgZm9ybWF0LlwiKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgcmV0dXJuIHtzZXBhcmF0b3I6IHNlcGFyYXRvciwgcGFydHM6IHBhcnRzfTtcclxuICAgIH0sXHJcbiAgICBwYXJzZURhdGU6IGZ1bmN0aW9uKGRhdGUsIGZvcm1hdCkge1xyXG4gICAgICAgIC8qanNoaW50IG1heGNvbXBsZXhpdHk6MTEqL1xyXG4gICAgICAgIHZhciBwYXJ0cyA9IGRhdGUuc3BsaXQoZm9ybWF0LnNlcGFyYXRvciksXHJcbiAgICAgICAgICAgIHZhbDtcclxuICAgICAgICBkYXRlID0gbmV3IERhdGUoKTtcclxuICAgICAgICBkYXRlLnNldEhvdXJzKDApO1xyXG4gICAgICAgIGRhdGUuc2V0TWludXRlcygwKTtcclxuICAgICAgICBkYXRlLnNldFNlY29uZHMoMCk7XHJcbiAgICAgICAgZGF0ZS5zZXRNaWxsaXNlY29uZHMoMCk7XHJcbiAgICAgICAgaWYgKHBhcnRzLmxlbmd0aCA9PT0gZm9ybWF0LnBhcnRzLmxlbmd0aCkge1xyXG4gICAgICAgICAgICB2YXIgeWVhciA9IGRhdGUuZ2V0RnVsbFllYXIoKSwgZGF5ID0gZGF0ZS5nZXREYXRlKCksIG1vbnRoID0gZGF0ZS5nZXRNb250aCgpO1xyXG4gICAgICAgICAgICBmb3IgKHZhciBpPTAsIGNudCA9IGZvcm1hdC5wYXJ0cy5sZW5ndGg7IGkgPCBjbnQ7IGkrKykge1xyXG4gICAgICAgICAgICAgICAgdmFsID0gcGFyc2VJbnQocGFydHNbaV0sIDEwKXx8MTtcclxuICAgICAgICAgICAgICAgIHN3aXRjaChmb3JtYXQucGFydHNbaV0pIHtcclxuICAgICAgICAgICAgICAgICAgICBjYXNlICdkZCc6XHJcbiAgICAgICAgICAgICAgICAgICAgY2FzZSAnZCc6XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGRheSA9IHZhbDtcclxuICAgICAgICAgICAgICAgICAgICAgICAgZGF0ZS5zZXREYXRlKHZhbCk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICAgICAgICAgIGNhc2UgJ21tJzpcclxuICAgICAgICAgICAgICAgICAgICBjYXNlICdtJzpcclxuICAgICAgICAgICAgICAgICAgICAgICAgbW9udGggPSB2YWwgLSAxO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBkYXRlLnNldE1vbnRoKHZhbCAtIDEpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgICAgICAgICBjYXNlICd5eSc6XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHllYXIgPSAyMDAwICsgdmFsO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBkYXRlLnNldEZ1bGxZZWFyKDIwMDAgKyB2YWwpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgICAgICAgICBjYXNlICd5eXl5JzpcclxuICAgICAgICAgICAgICAgICAgICAgICAgeWVhciA9IHZhbDtcclxuICAgICAgICAgICAgICAgICAgICAgICAgZGF0ZS5zZXRGdWxsWWVhcih2YWwpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBkYXRlID0gbmV3IERhdGUoeWVhciwgbW9udGgsIGRheSwgMCAsMCAsMCk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHJldHVybiBkYXRlO1xyXG4gICAgfSxcclxuICAgIGZvcm1hdERhdGU6IGZ1bmN0aW9uKGRhdGUsIGZvcm1hdCl7XHJcbiAgICAgICAgdmFyIHZhbCA9IHtcclxuICAgICAgICAgICAgZDogZGF0ZS5nZXREYXRlKCksXHJcbiAgICAgICAgICAgIG06IGRhdGUuZ2V0TW9udGgoKSArIDEsXHJcbiAgICAgICAgICAgIHl5OiBkYXRlLmdldEZ1bGxZZWFyKCkudG9TdHJpbmcoKS5zdWJzdHJpbmcoMiksXHJcbiAgICAgICAgICAgIHl5eXk6IGRhdGUuZ2V0RnVsbFllYXIoKVxyXG4gICAgICAgIH07XHJcbiAgICAgICAgdmFsLmRkID0gKHZhbC5kIDwgMTAgPyAnMCcgOiAnJykgKyB2YWwuZDtcclxuICAgICAgICB2YWwubW0gPSAodmFsLm0gPCAxMCA/ICcwJyA6ICcnKSArIHZhbC5tO1xyXG4gICAgICAgIGRhdGUgPSBbXTtcclxuICAgICAgICBmb3IgKHZhciBpPTAsIGNudCA9IGZvcm1hdC5wYXJ0cy5sZW5ndGg7IGkgPCBjbnQ7IGkrKykge1xyXG4gICAgICAgICAgICBkYXRlLnB1c2godmFsW2Zvcm1hdC5wYXJ0c1tpXV0pO1xyXG4gICAgICAgIH1cclxuICAgICAgICByZXR1cm4gZGF0ZS5qb2luKGZvcm1hdC5zZXBhcmF0b3IpO1xyXG4gICAgfSxcclxuICAgIGhlYWRUZW1wbGF0ZTogJzx0aGVhZD4nK1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAnPHRyPicrXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAnPHRoIGNsYXNzPVwicHJldlwiPiZsc2FxdW87PC90aD4nK1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgJzx0aCBjb2xzcGFuPVwiNVwiIGNsYXNzPVwic3dpdGNoXCI+PC90aD4nK1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgJzx0aCBjbGFzcz1cIm5leHRcIj4mcnNhcXVvOzwvdGg+JytcclxuICAgICAgICAgICAgICAgICAgICAgICAgJzwvdHI+JytcclxuICAgICAgICAgICAgICAgICAgICAnPC90aGVhZD4nLFxyXG4gICAgY29udFRlbXBsYXRlOiAnPHRib2R5Pjx0cj48dGQgY29sc3Bhbj1cIjdcIj48L3RkPjwvdHI+PC90Ym9keT4nXHJcbn07XHJcbkRQR2xvYmFsLnRlbXBsYXRlID0gJzxkaXYgY2xhc3M9XCInICsgY2xhc3Nlcy5jb21wb25lbnQgKyAnXCI+JytcclxuICAgICAgICAgICAgICAgICAgICAgICAgJzxkaXYgY2xhc3M9XCInICsgY2xhc3Nlcy5kYXlzICsgJ1wiPicrXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAnPHRhYmxlIGNsYXNzPVwiIHRhYmxlLWNvbmRlbnNlZFwiPicrXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgRFBHbG9iYWwuaGVhZFRlbXBsYXRlK1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICc8dGJvZHk+PC90Ym9keT4nK1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgJzwvdGFibGU+JytcclxuICAgICAgICAgICAgICAgICAgICAgICAgJzwvZGl2PicrXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICc8ZGl2IGNsYXNzPVwiJyArIGNsYXNzZXMubW9udGhzICsgJ1wiPicrXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAnPHRhYmxlIGNsYXNzPVwidGFibGUtY29uZGVuc2VkXCI+JytcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBEUEdsb2JhbC5oZWFkVGVtcGxhdGUrXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgRFBHbG9iYWwuY29udFRlbXBsYXRlK1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgJzwvdGFibGU+JytcclxuICAgICAgICAgICAgICAgICAgICAgICAgJzwvZGl2PicrXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICc8ZGl2IGNsYXNzPVwiJyArIGNsYXNzZXMueWVhcnMgKyAnXCI+JytcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICc8dGFibGUgY2xhc3M9XCJ0YWJsZS1jb25kZW5zZWRcIj4nK1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIERQR2xvYmFsLmhlYWRUZW1wbGF0ZStcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBEUEdsb2JhbC5jb250VGVtcGxhdGUrXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAnPC90YWJsZT4nK1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAnPC9kaXY+JytcclxuICAgICAgICAgICAgICAgICAgICAnPC9kaXY+JztcclxuRFBHbG9iYWwubW9kZXNTZXQgPSB7XHJcbiAgICAnZGF0ZSc6IERQR2xvYmFsLm1vZGVzWzNdLFxyXG4gICAgJ21vbnRoJzogRFBHbG9iYWwubW9kZXNbMF0sXHJcbiAgICAneWVhcic6IERQR2xvYmFsLm1vZGVzWzFdLFxyXG4gICAgJ2RlY2FkZSc6IERQR2xvYmFsLm1vZGVzWzJdXHJcbn07XHJcblxyXG4vKiogUHVibGljIEFQSSAqKi9cclxuZXhwb3J0cy5EYXRlUGlja2VyID0gRGF0ZVBpY2tlcjtcclxuZXhwb3J0cy5kZWZhdWx0cyA9IERQR2xvYmFsO1xyXG5leHBvcnRzLnV0aWxzID0gRFBHbG9iYWw7XHJcbiIsIi8qKlxyXG4gICAgU21hcnROYXZCYXIgY29tcG9uZW50LlxyXG4gICAgUmVxdWlyZXMgaXRzIENTUyBjb3VudGVycGFydC5cclxuICAgIFxyXG4gICAgQ3JlYXRlZCBiYXNlZCBvbiB0aGUgcHJvamVjdDpcclxuICAgIFxyXG4gICAgUHJvamVjdC1UeXNvblxyXG4gICAgV2Vic2l0ZTogaHR0cHM6Ly9naXRodWIuY29tL2MycHJvZHMvUHJvamVjdC1UeXNvblxyXG4gICAgQXV0aG9yOiBjMnByb2RzXHJcbiAgICBMaWNlbnNlOlxyXG4gICAgVGhlIE1JVCBMaWNlbnNlIChNSVQpXHJcbiAgICBDb3B5cmlnaHQgKGMpIDIwMTMgYzJwcm9kc1xyXG4gICAgUGVybWlzc2lvbiBpcyBoZXJlYnkgZ3JhbnRlZCwgZnJlZSBvZiBjaGFyZ2UsIHRvIGFueSBwZXJzb24gb2J0YWluaW5nIGEgY29weSBvZlxyXG4gICAgdGhpcyBzb2Z0d2FyZSBhbmQgYXNzb2NpYXRlZCBkb2N1bWVudGF0aW9uIGZpbGVzICh0aGUgXCJTb2Z0d2FyZVwiKSwgdG8gZGVhbCBpblxyXG4gICAgdGhlIFNvZnR3YXJlIHdpdGhvdXQgcmVzdHJpY3Rpb24sIGluY2x1ZGluZyB3aXRob3V0IGxpbWl0YXRpb24gdGhlIHJpZ2h0cyB0b1xyXG4gICAgdXNlLCBjb3B5LCBtb2RpZnksIG1lcmdlLCBwdWJsaXNoLCBkaXN0cmlidXRlLCBzdWJsaWNlbnNlLCBhbmQvb3Igc2VsbCBjb3BpZXMgb2ZcclxuICAgIHRoZSBTb2Z0d2FyZSwgYW5kIHRvIHBlcm1pdCBwZXJzb25zIHRvIHdob20gdGhlIFNvZnR3YXJlIGlzIGZ1cm5pc2hlZCB0byBkbyBzbyxcclxuICAgIHN1YmplY3QgdG8gdGhlIGZvbGxvd2luZyBjb25kaXRpb25zOlxyXG4gICAgVGhlIGFib3ZlIGNvcHlyaWdodCBub3RpY2UgYW5kIHRoaXMgcGVybWlzc2lvbiBub3RpY2Ugc2hhbGwgYmUgaW5jbHVkZWQgaW4gYWxsXHJcbiAgICBjb3BpZXMgb3Igc3Vic3RhbnRpYWwgcG9ydGlvbnMgb2YgdGhlIFNvZnR3YXJlLlxyXG4gICAgVEhFIFNPRlRXQVJFIElTIFBST1ZJREVEIFwiQVMgSVNcIiwgV0lUSE9VVCBXQVJSQU5UWSBPRiBBTlkgS0lORCwgRVhQUkVTUyBPUlxyXG4gICAgSU1QTElFRCwgSU5DTFVESU5HIEJVVCBOT1QgTElNSVRFRCBUTyBUSEUgV0FSUkFOVElFUyBPRiBNRVJDSEFOVEFCSUxJVFksIEZJVE5FU1NcclxuICAgIEZPUiBBIFBBUlRJQ1VMQVIgUFVSUE9TRSBBTkQgTk9OSU5GUklOR0VNRU5ULiBJTiBOTyBFVkVOVCBTSEFMTCBUSEUgQVVUSE9SUyBPUlxyXG4gICAgQ09QWVJJR0hUIEhPTERFUlMgQkUgTElBQkxFIEZPUiBBTlkgQ0xBSU0sIERBTUFHRVMgT1IgT1RIRVIgTElBQklMSVRZLCBXSEVUSEVSXHJcbiAgICBJTiBBTiBBQ1RJT04gT0YgQ09OVFJBQ1QsIFRPUlQgT1IgT1RIRVJXSVNFLCBBUklTSU5HIEZST00sIE9VVCBPRiBPUiBJTlxyXG4gICAgQ09OTkVDVElPTiBXSVRIIFRIRSBTT0ZUV0FSRSBPUiBUSEUgVVNFIE9SIE9USEVSIERFQUxJTkdTIElOIFRIRSBTT0ZUV0FSRS5cclxuKiovXHJcbnZhciAkID0gcmVxdWlyZSgnanF1ZXJ5Jyk7XHJcblxyXG4vKipcclxuICAgIEludGVybmFsIHV0aWxpdHkuXHJcbiAgICBSZW1vdmVzIGFsbCBjaGlsZHJlbiBmb3IgYSBET00gbm9kZVxyXG4qKi9cclxudmFyIGNsZWFyTm9kZSA9IGZ1bmN0aW9uIChub2RlKSB7XHJcbiAgICB3aGlsZShub2RlLmZpcnN0Q2hpbGQpe1xyXG4gICAgICAgIG5vZGUucmVtb3ZlQ2hpbGQobm9kZS5maXJzdENoaWxkKTtcclxuICAgIH1cclxufTtcclxuXHJcbi8qKlxyXG4gICAgQ2FsY3VsYXRlcyBhbmQgYXBwbGllcyB0aGUgYmVzdCBzaXppbmcgYW5kIGRpc3RyaWJ1dGlvbiBmb3IgdGhlIHRpdGxlXHJcbiAgICBkZXBlbmRpbmcgb24gY29udGVudCBhbmQgYnV0dG9ucy5cclxuICAgIFBhc3MgaW4gdGhlIHRpdGxlIGVsZW1lbnQsIGJ1dHRvbnMgbXVzdCBiZSBmb3VuZCBhcyBzaWJsaW5ncyBvZiBpdC5cclxuKiovXHJcbnZhciB0ZXh0Ym94UmVzaXplID0gZnVuY3Rpb24gdGV4dGJveFJlc2l6ZShlbCkge1xyXG4gICAgLyoganNoaW50IG1heHN0YXRlbWVudHM6IDI4LCBtYXhjb21wbGV4aXR5OjExICovXHJcbiAgICBcclxuICAgIHZhciBsZWZ0YnRuID0gZWwucGFyZW50Tm9kZS5xdWVyeVNlbGVjdG9yQWxsKCcuU21hcnROYXZCYXItZWRnZS5sZWZ0JylbMF07XHJcbiAgICB2YXIgcmlnaHRidG4gPSBlbC5wYXJlbnROb2RlLnF1ZXJ5U2VsZWN0b3JBbGwoJy5TbWFydE5hdkJhci1lZGdlLnJpZ2h0JylbMF07XHJcbiAgICBpZiAodHlwZW9mIGxlZnRidG4gPT09ICd1bmRlZmluZWQnKSB7XHJcbiAgICAgICAgbGVmdGJ0biA9IHtcclxuICAgICAgICAgICAgb2Zmc2V0V2lkdGg6IDAsXHJcbiAgICAgICAgICAgIGNsYXNzTmFtZTogJydcclxuICAgICAgICB9O1xyXG4gICAgfVxyXG4gICAgaWYgKHR5cGVvZiByaWdodGJ0biA9PT0gJ3VuZGVmaW5lZCcpIHtcclxuICAgICAgICByaWdodGJ0biA9IHtcclxuICAgICAgICAgICAgb2Zmc2V0V2lkdGg6IDAsXHJcbiAgICAgICAgICAgIGNsYXNzTmFtZTogJydcclxuICAgICAgICB9O1xyXG4gICAgfVxyXG4gICAgXHJcbiAgICB2YXIgbWFyZ2luID0gTWF0aC5tYXgobGVmdGJ0bi5vZmZzZXRXaWR0aCwgcmlnaHRidG4ub2Zmc2V0V2lkdGgpO1xyXG4gICAgZWwuc3R5bGUubWFyZ2luTGVmdCA9IG1hcmdpbiArICdweCc7XHJcbiAgICBlbC5zdHlsZS5tYXJnaW5SaWdodCA9IG1hcmdpbiArICdweCc7XHJcbiAgICB2YXIgdG9vTG9uZyA9IChlbC5vZmZzZXRXaWR0aCA8IGVsLnNjcm9sbFdpZHRoKSA/IHRydWUgOiBmYWxzZTtcclxuICAgIGlmICh0b29Mb25nKSB7XHJcbiAgICAgICAgaWYgKGxlZnRidG4ub2Zmc2V0V2lkdGggPCByaWdodGJ0bi5vZmZzZXRXaWR0aCkge1xyXG4gICAgICAgICAgICBlbC5zdHlsZS5tYXJnaW5MZWZ0ID0gbGVmdGJ0bi5vZmZzZXRXaWR0aCArICdweCc7XHJcbiAgICAgICAgICAgIGVsLnN0eWxlLnRleHRBbGlnbiA9ICdyaWdodCc7XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgZWwuc3R5bGUubWFyZ2luUmlnaHQgPSByaWdodGJ0bi5vZmZzZXRXaWR0aCArICdweCc7XHJcbiAgICAgICAgICAgIGVsLnN0eWxlLnRleHRBbGlnbiA9ICdsZWZ0JztcclxuICAgICAgICB9XHJcbiAgICAgICAgdG9vTG9uZyA9IChlbC5vZmZzZXRXaWR0aDxlbC5zY3JvbGxXaWR0aCkgPyB0cnVlIDogZmFsc2U7XHJcbiAgICAgICAgaWYgKHRvb0xvbmcpIHtcclxuICAgICAgICAgICAgaWYgKG5ldyBSZWdFeHAoJ2Fycm93JykudGVzdChsZWZ0YnRuLmNsYXNzTmFtZSkpIHtcclxuICAgICAgICAgICAgICAgIGNsZWFyTm9kZShsZWZ0YnRuLmNoaWxkTm9kZXNbMV0pO1xyXG4gICAgICAgICAgICAgICAgZWwuc3R5bGUubWFyZ2luTGVmdCA9ICcyNnB4JztcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBpZiAobmV3IFJlZ0V4cCgnYXJyb3cnKS50ZXN0KHJpZ2h0YnRuLmNsYXNzTmFtZSkpIHtcclxuICAgICAgICAgICAgICAgIGNsZWFyTm9kZShyaWdodGJ0bi5jaGlsZE5vZGVzWzFdKTtcclxuICAgICAgICAgICAgICAgIGVsLnN0eWxlLm1hcmdpblJpZ2h0ID0gJzI2cHgnO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG59O1xyXG5cclxuZXhwb3J0cy50ZXh0Ym94UmVzaXplID0gdGV4dGJveFJlc2l6ZTtcclxuXHJcbi8qKlxyXG4gICAgU21hcnROYXZCYXIgY2xhc3MsIGluc3RhbnRpYXRlIHdpdGggYSBET00gZWxlbWVudFxyXG4gICAgcmVwcmVzZW50aW5nIGEgbmF2YmFyLlxyXG4gICAgQVBJOlxyXG4gICAgLSByZWZyZXNoOiB1cGRhdGVzIHRoZSBjb250cm9sIHRha2luZyBjYXJlIG9mIHRoZSBuZWVkZWRcclxuICAgICAgICB3aWR0aCBmb3IgdGl0bGUgYW5kIGJ1dHRvbnNcclxuKiovXHJcbnZhciBTbWFydE5hdkJhciA9IGZ1bmN0aW9uIFNtYXJ0TmF2QmFyKGVsKSB7XHJcbiAgICB0aGlzLmVsID0gZWw7XHJcbiAgICBcclxuICAgIHRoaXMucmVmcmVzaCA9IGZ1bmN0aW9uIHJlZnJlc2goKSB7XHJcbiAgICAgICAgdmFyIGggPSAkKGVsKS5jaGlsZHJlbignaDEnKS5nZXQoMCk7XHJcbiAgICAgICAgaWYgKGgpXHJcbiAgICAgICAgICAgIHRleHRib3hSZXNpemUoaCk7XHJcbiAgICB9O1xyXG5cclxuICAgIHRoaXMucmVmcmVzaCgpOyBcclxufTtcclxuXHJcbmV4cG9ydHMuU21hcnROYXZCYXIgPSBTbWFydE5hdkJhcjtcclxuXHJcbi8qKlxyXG4gICAgR2V0IGluc3RhbmNlcyBmb3IgYWxsIHRoZSBTbWFydE5hdkJhciBlbGVtZW50cyBpbiB0aGUgRE9NXHJcbioqL1xyXG5leHBvcnRzLmdldEFsbCA9IGZ1bmN0aW9uIGdldEFsbCgpIHtcclxuICAgIHZhciBhbGwgPSAkKCcuU21hcnROYXZCYXInKTtcclxuICAgIHJldHVybiAkLm1hcChhbGwsIGZ1bmN0aW9uKGl0ZW0pIHsgcmV0dXJuIG5ldyBTbWFydE5hdkJhcihpdGVtKTsgfSk7XHJcbn07XHJcblxyXG4vKipcclxuICAgIFJlZnJlc2ggYWxsIFNtYXJ0TmF2QmFyIGZvdW5kIGluIHRoZSBkb2N1bWVudC5cclxuKiovXHJcbmV4cG9ydHMucmVmcmVzaEFsbCA9IGZ1bmN0aW9uIHJlZnJlc2hBbGwoKSB7XHJcbiAgICAkKCcuU21hcnROYXZCYXIgPiBoMScpLmVhY2goZnVuY3Rpb24oKSB7IHRleHRib3hSZXNpemUodGhpcyk7IH0pO1xyXG59O1xyXG4iLCIvKipcclxuICAgIEN1c3RvbSBMb2Nvbm9taWNzICdsb2NhbGUnIHN0eWxlcyBmb3IgZGF0ZS90aW1lcy5cclxuICAgIEl0cyBhIGJpdCBtb3JlICdjb29sJyByZW5kZXJpbmcgZGF0ZXMgOy0pXHJcbioqL1xyXG4ndXNlIHN0cmljdCc7XHJcblxyXG52YXIgbW9tZW50ID0gcmVxdWlyZSgnbW9tZW50Jyk7XHJcbi8vIFNpbmNlIHRoZSB0YXNrIG9mIGRlZmluZSBhIGxvY2FsZSBjaGFuZ2VzXHJcbi8vIHRoZSBjdXJyZW50IGdsb2JhbCBsb2NhbGUsIHdlIHNhdmUgYSByZWZlcmVuY2VcclxuLy8gYW5kIHJlc3RvcmUgaXQgbGF0ZXIgc28gbm90aGluZyBjaGFuZ2VkLlxyXG52YXIgY3VycmVudCA9IG1vbWVudC5sb2NhbGUoKTtcclxuXHJcbm1vbWVudC5sb2NhbGUoJ2VuLVVTLUxDJywge1xyXG4gICAgbWVyaWRpZW1QYXJzZSA6IC9bYXBdXFwuP1xcLj8vaSxcclxuICAgIG1lcmlkaWVtIDogZnVuY3Rpb24gKGhvdXJzLCBtaW51dGVzLCBpc0xvd2VyKSB7XHJcbiAgICAgICAgaWYgKGhvdXJzID4gMTEpIHtcclxuICAgICAgICAgICAgcmV0dXJuIGlzTG93ZXIgPyAncCcgOiAnUCc7XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgcmV0dXJuIGlzTG93ZXIgPyAnYScgOiAnQSc7XHJcbiAgICAgICAgfVxyXG4gICAgfSxcclxuICAgIGNhbGVuZGFyIDoge1xyXG4gICAgICAgIGxhc3REYXkgOiAnW1llc3RlcmRheV0nLFxyXG4gICAgICAgIHNhbWVEYXkgOiAnW1RvZGF5XScsXHJcbiAgICAgICAgbmV4dERheSA6ICdbVG9tb3Jyb3ddJyxcclxuICAgICAgICBsYXN0V2VlayA6ICdbbGFzdF0gZGRkZCcsXHJcbiAgICAgICAgbmV4dFdlZWsgOiAnZGRkZCcsXHJcbiAgICAgICAgc2FtZUVsc2UgOiAnTS9EJ1xyXG4gICAgfSxcclxuICAgIGxvbmdEYXRlRm9ybWF0IDoge1xyXG4gICAgICAgIExUOiAnaDptbWEnLFxyXG4gICAgICAgIExUUzogJ2g6bW06c3NhJyxcclxuICAgICAgICBMOiAnTU0vREQvWVlZWScsXHJcbiAgICAgICAgbDogJ00vRC9ZWVlZJyxcclxuICAgICAgICBMTDogJ01NTU0gRG8gWVlZWScsXHJcbiAgICAgICAgbGw6ICdNTU0gRCBZWVlZJyxcclxuICAgICAgICBMTEw6ICdNTU1NIERvIFlZWVkgTFQnLFxyXG4gICAgICAgIGxsbDogJ01NTSBEIFlZWVkgTFQnLFxyXG4gICAgICAgIExMTEw6ICdkZGRkLCBNTU1NIERvIFlZWVkgTFQnLFxyXG4gICAgICAgIGxsbGw6ICdkZGQsIE1NTSBEIFlZWVkgTFQnXHJcbiAgICB9XHJcbn0pO1xyXG5cclxuLy8gUmVzdG9yZSBsb2NhbGVcclxubW9tZW50LmxvY2FsZShjdXJyZW50KTtcclxuIiwiLyoqIEFwcG9pbnRtZW50IG1vZGVsICoqL1xyXG4ndXNlIHN0cmljdCc7XHJcblxyXG52YXIga28gPSByZXF1aXJlKCdrbm9ja291dCcpLFxyXG4gICAgTW9kZWwgPSByZXF1aXJlKCcuL01vZGVsJyksXHJcbiAgICBDbGllbnQgPSByZXF1aXJlKCcuL0NsaWVudCcpLFxyXG4gICAgTG9jYXRpb24gPSByZXF1aXJlKCcuL0xvY2F0aW9uJyksXHJcbiAgICBTZXJ2aWNlID0gcmVxdWlyZSgnLi9TZXJ2aWNlJyksXHJcbiAgICBtb21lbnQgPSByZXF1aXJlKCdtb21lbnQnKTtcclxuICAgXHJcbmZ1bmN0aW9uIEFwcG9pbnRtZW50KHZhbHVlcykge1xyXG4gICAgXHJcbiAgICBNb2RlbCh0aGlzKTtcclxuXHJcbiAgICB0aGlzLm1vZGVsLmRlZlByb3BlcnRpZXMoe1xyXG4gICAgICAgIGlkOiBudWxsLFxyXG4gICAgICAgIFxyXG4gICAgICAgIHN0YXJ0VGltZTogbnVsbCxcclxuICAgICAgICBlbmRUaW1lOiBudWxsLFxyXG4gICAgICAgIFxyXG4gICAgICAgIC8vIEV2ZW50IHN1bW1hcnk6XHJcbiAgICAgICAgc3VtbWFyeTogJ05ldyBib29raW5nJyxcclxuICAgICAgICBcclxuICAgICAgICBzdWJ0b3RhbFByaWNlOiAwLFxyXG4gICAgICAgIGZlZVByaWNlOiAwLFxyXG4gICAgICAgIHBmZWVQcmljZTogMCxcclxuICAgICAgICB0b3RhbFByaWNlOiAwLFxyXG4gICAgICAgIHB0b3RhbFByaWNlOiAwLFxyXG4gICAgICAgIFxyXG4gICAgICAgIHByZU5vdGVzVG9DbGllbnQ6IG51bGwsXHJcbiAgICAgICAgcG9zdE5vdGVzVG9DbGllbnQ6IG51bGwsXHJcbiAgICAgICAgcHJlTm90ZXNUb1NlbGY6IG51bGwsXHJcbiAgICAgICAgcG9zdE5vdGVzVG9TZWxmOiBudWxsXHJcbiAgICB9LCB2YWx1ZXMpO1xyXG4gICAgXHJcbiAgICB2YWx1ZXMgPSB2YWx1ZXMgfHwge307XHJcblxyXG4gICAgdGhpcy5jbGllbnQgPSBrby5vYnNlcnZhYmxlKHZhbHVlcy5jbGllbnQgPyBuZXcgQ2xpZW50KHZhbHVlcy5jbGllbnQpIDogbnVsbCk7XHJcblxyXG4gICAgdGhpcy5sb2NhdGlvbiA9IGtvLm9ic2VydmFibGUobmV3IExvY2F0aW9uKHZhbHVlcy5sb2NhdGlvbikpO1xyXG4gICAgdGhpcy5sb2NhdGlvblN1bW1hcnkgPSBrby5jb21wdXRlZChmdW5jdGlvbigpIHtcclxuICAgICAgICByZXR1cm4gdGhpcy5sb2NhdGlvbigpLnNpbmdsZUxpbmUoKTtcclxuICAgIH0sIHRoaXMpO1xyXG4gICAgXHJcbiAgICB0aGlzLnNlcnZpY2VzID0ga28ub2JzZXJ2YWJsZUFycmF5KCh2YWx1ZXMuc2VydmljZXMgfHwgW10pLm1hcChmdW5jdGlvbihzZXJ2aWNlKSB7XHJcbiAgICAgICAgcmV0dXJuIChzZXJ2aWNlIGluc3RhbmNlb2YgU2VydmljZSkgPyBzZXJ2aWNlIDogbmV3IFNlcnZpY2Uoc2VydmljZSk7XHJcbiAgICB9KSk7XHJcbiAgICB0aGlzLnNlcnZpY2VzU3VtbWFyeSA9IGtvLmNvbXB1dGVkKGZ1bmN0aW9uKCkge1xyXG4gICAgICAgIHJldHVybiB0aGlzLnNlcnZpY2VzKCkubWFwKGZ1bmN0aW9uKHNlcnZpY2UpIHtcclxuICAgICAgICAgICAgcmV0dXJuIHNlcnZpY2UubmFtZSgpO1xyXG4gICAgICAgIH0pLmpvaW4oJywgJyk7XHJcbiAgICB9LCB0aGlzKTtcclxuICAgIFxyXG4gICAgLy8gUHJpY2UgdXBkYXRlIG9uIHNlcnZpY2VzIGNoYW5nZXNcclxuICAgIC8vIFRPRE8gSXMgbm90IGNvbXBsZXRlIGZvciBwcm9kdWN0aW9uXHJcbiAgICB0aGlzLnNlcnZpY2VzLnN1YnNjcmliZShmdW5jdGlvbihzZXJ2aWNlcykge1xyXG4gICAgICAgIHRoaXMucHRvdGFsUHJpY2Uoc2VydmljZXMucmVkdWNlKGZ1bmN0aW9uKHByZXYsIGN1cikge1xyXG4gICAgICAgICAgICByZXR1cm4gcHJldiArIGN1ci5wcmljZSgpO1xyXG4gICAgICAgIH0sIDApKTtcclxuICAgIH0uYmluZCh0aGlzKSk7XHJcbiAgICBcclxuICAgIC8vIFNtYXJ0IHZpc3VhbGl6YXRpb24gb2YgZGF0ZSBhbmQgdGltZVxyXG4gICAgdGhpcy5kaXNwbGF5ZWREYXRlID0ga28ucHVyZUNvbXB1dGVkKGZ1bmN0aW9uKCkge1xyXG4gICAgICAgIFxyXG4gICAgICAgIHJldHVybiBtb21lbnQodGhpcy5zdGFydFRpbWUoKSkubG9jYWxlKCdlbi1VUy1MQycpLmNhbGVuZGFyKCk7XHJcbiAgICAgICAgXHJcbiAgICB9LCB0aGlzKTtcclxuICAgIFxyXG4gICAgdGhpcy5kaXNwbGF5ZWRTdGFydFRpbWUgPSBrby5wdXJlQ29tcHV0ZWQoZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgXHJcbiAgICAgICAgcmV0dXJuIG1vbWVudCh0aGlzLnN0YXJ0VGltZSgpKS5sb2NhbGUoJ2VuLVVTLUxDJykuZm9ybWF0KCdMVCcpO1xyXG4gICAgICAgIFxyXG4gICAgfSwgdGhpcyk7XHJcbiAgICBcclxuICAgIHRoaXMuZGlzcGxheWVkRW5kVGltZSA9IGtvLnB1cmVDb21wdXRlZChmdW5jdGlvbigpIHtcclxuICAgICAgICBcclxuICAgICAgICByZXR1cm4gbW9tZW50KHRoaXMuZW5kVGltZSgpKS5sb2NhbGUoJ2VuLVVTLUxDJykuZm9ybWF0KCdMVCcpO1xyXG4gICAgICAgIFxyXG4gICAgfSwgdGhpcyk7XHJcbiAgICBcclxuICAgIHRoaXMuZGlzcGxheWVkVGltZVJhbmdlID0ga28ucHVyZUNvbXB1dGVkKGZ1bmN0aW9uKCkge1xyXG4gICAgICAgIFxyXG4gICAgICAgIHJldHVybiB0aGlzLmRpc3BsYXllZFN0YXJ0VGltZSgpICsgJy0nICsgdGhpcy5kaXNwbGF5ZWRFbmRUaW1lKCk7XHJcbiAgICAgICAgXHJcbiAgICB9LCB0aGlzKTtcclxuICAgIFxyXG4gICAgdGhpcy5pdFN0YXJ0ZWQgPSBrby5wdXJlQ29tcHV0ZWQoZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgcmV0dXJuICh0aGlzLnN0YXJ0VGltZSgpICYmIG5ldyBEYXRlKCkgPj0gdGhpcy5zdGFydFRpbWUoKSk7XHJcbiAgICB9LCB0aGlzKTtcclxuICAgIFxyXG4gICAgdGhpcy5pdEVuZGVkID0ga28ucHVyZUNvbXB1dGVkKGZ1bmN0aW9uKCkge1xyXG4gICAgICAgIHJldHVybiAodGhpcy5lbmRUaW1lKCkgJiYgbmV3IERhdGUoKSA+PSB0aGlzLmVuZFRpbWUoKSk7XHJcbiAgICB9LCB0aGlzKTtcclxuICAgIFxyXG4gICAgdGhpcy5pc05ldyA9IGtvLnB1cmVDb21wdXRlZChmdW5jdGlvbigpIHtcclxuICAgICAgICByZXR1cm4gKCF0aGlzLmlkKCkpO1xyXG4gICAgfSwgdGhpcyk7XHJcbiAgICBcclxuICAgIHRoaXMuc3RhdGVIZWFkZXIgPSBrby5wdXJlQ29tcHV0ZWQoZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgXHJcbiAgICAgICAgdmFyIHRleHQgPSAnJztcclxuICAgICAgICBpZiAoIXRoaXMuaXNOZXcoKSkge1xyXG4gICAgICAgICAgICBpZiAodGhpcy5pdFN0YXJ0ZWQoKSkge1xyXG4gICAgICAgICAgICAgICAgaWYgKHRoaXMuaXRFbmRlZCgpKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdGV4dCA9ICdDb21wbGV0ZWQ6JztcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgICAgIHRleHQgPSAnTm93Oic7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgZWxzZSB7XHJcbiAgICAgICAgICAgICAgICB0ZXh0ID0gJ1VwY29taW5nOic7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHJldHVybiB0ZXh0O1xyXG4gICAgICAgIFxyXG4gICAgfSwgdGhpcyk7XHJcbn1cclxuXHJcbm1vZHVsZS5leHBvcnRzID0gQXBwb2ludG1lbnQ7XHJcbiIsIi8qKiBCb29raW5nU3VtbWFyeSBtb2RlbCAqKi9cclxuJ3VzZSBzdHJpY3QnO1xyXG5cclxudmFyIGtvID0gcmVxdWlyZSgna25vY2tvdXQnKSxcclxuICAgIE1vZGVsID0gcmVxdWlyZSgnLi9Nb2RlbCcpLFxyXG4gICAgbW9tZW50ID0gcmVxdWlyZSgnbW9tZW50Jyk7XHJcbiAgICBcclxuZnVuY3Rpb24gQm9va2luZ1N1bW1hcnkodmFsdWVzKSB7XHJcbiAgICBcclxuICAgIE1vZGVsKHRoaXMpO1xyXG5cclxuICAgIHRoaXMubW9kZWwuZGVmUHJvcGVydGllcyh7XHJcbiAgICAgICAgcXVhbnRpdHk6IDAsXHJcbiAgICAgICAgY29uY2VwdDogJycsXHJcbiAgICAgICAgdGltZTogbnVsbCxcclxuICAgICAgICB0aW1lRm9ybWF0OiAnIFtAXSBoOm1tYSdcclxuICAgIH0sIHZhbHVlcyk7XHJcblxyXG4gICAgdGhpcy5waHJhc2UgPSBrby5wdXJlQ29tcHV0ZWQoZnVuY3Rpb24oKXtcclxuICAgICAgICB2YXIgdCA9IHRoaXMudGltZSgpICYmIG1vbWVudCh0aGlzLnRpbWUoKSkuZm9ybWF0KHRoaXMudGltZUZvcm1hdCgpKSB8fCAnJzsgICAgICAgIFxyXG4gICAgICAgIHJldHVybiB0aGlzLmNvbmNlcHQoKSArIHQ7XHJcbiAgICB9LCB0aGlzKTtcclxuXHJcbn1cclxuXHJcbm1vZHVsZS5leHBvcnRzID0gQm9va2luZ1N1bW1hcnk7XHJcbiIsIi8qKlxyXG4gICAgRXZlbnQgbW9kZWxcclxuKiovXHJcbid1c2Ugc3RyaWN0JztcclxuXHJcbi8qIEV4YW1wbGUgSlNPTiAocmV0dXJuZWQgYnkgdGhlIFJFU1QgQVBJKTpcclxue1xyXG4gIFwiRXZlbnRJRFwiOiAzNTMsXHJcbiAgXCJVc2VySURcIjogMTQxLFxyXG4gIFwiRXZlbnRUeXBlSURcIjogMyxcclxuICBcIlN1bW1hcnlcIjogXCJIb3VzZWtlZXBlciBzZXJ2aWNlcyBmb3IgSm9zaHVhUHJvdmlkZXIgRC5cIixcclxuICBcIkF2YWlsYWJpbGl0eVR5cGVJRFwiOiAzLFxyXG4gIFwiU3RhcnRUaW1lXCI6IFwiMjAxNC0wMy0yNVQwODowMDowMFpcIixcclxuICBcIkVuZFRpbWVcIjogXCIyMDE0LTAzLTI1VDE4OjAwOjAwWlwiLFxyXG4gIFwiS2luZFwiOiAwLFxyXG4gIFwiSXNBbGxEYXlcIjogZmFsc2UsXHJcbiAgXCJUaW1lWm9uZVwiOiBcIjAxOjAwOjAwXCIsXHJcbiAgXCJMb2NhdGlvblwiOiBcIm51bGxcIixcclxuICBcIlVwZGF0ZWREYXRlXCI6IFwiMjAxNC0xMC0zMFQxNTo0NDo0OS42NTNcIixcclxuICBcIkNyZWF0ZWREYXRlXCI6IG51bGwsXHJcbiAgXCJEZXNjcmlwdGlvblwiOiBcInRlc3QgZGVzY3JpcHRpb24gb2YgYSBSRVNUIGV2ZW50XCIsXHJcbiAgXCJSZWN1cnJlbmNlUnVsZVwiOiB7XHJcbiAgICBcIkZyZXF1ZW5jeVR5cGVJRFwiOiA1MDIsXHJcbiAgICBcIkludGVydmFsXCI6IDEsXHJcbiAgICBcIlVudGlsXCI6IFwiMjAxNC0wNy0wMVQwMDowMDowMFwiLFxyXG4gICAgXCJDb3VudFwiOiBudWxsLFxyXG4gICAgXCJFbmRpbmdcIjogXCJkYXRlXCIsXHJcbiAgICBcIlNlbGVjdGVkV2Vla0RheXNcIjogW1xyXG4gICAgICAxLFxyXG4gICAgXSxcclxuICAgIFwiTW9udGhseVdlZWtEYXlcIjogZmFsc2UsXHJcbiAgICBcIkluY29tcGF0aWJsZVwiOiBmYWxzZSxcclxuICAgIFwiVG9vTWFueVwiOiBmYWxzZVxyXG4gIH0sXHJcbiAgXCJSZWN1cnJlbmNlT2NjdXJyZW5jZXNcIjogbnVsbCxcclxuICBcIlJlYWRPbmx5XCI6IGZhbHNlXHJcbn0qL1xyXG5cclxuZnVuY3Rpb24gUmVjdXJyZW5jZVJ1bGUodmFsdWVzKSB7XHJcbiAgICBNb2RlbCh0aGlzKTtcclxuICAgIFxyXG4gICAgdGhpcy5tb2RlbC5kZWZQcm9wZXJ0aWVzKHtcclxuICAgICAgICBmcmVxdWVuY3lUeXBlSUQ6IDAsXHJcbiAgICAgICAgaW50ZXJ2YWw6IDEsIC8vOkludGVnZXJcclxuICAgICAgICB1bnRpbDogbnVsbCwgLy86RGF0ZVxyXG4gICAgICAgIGNvdW50OiBudWxsLCAvLzpJbnRlZ2VyXHJcbiAgICAgICAgZW5kaW5nOiBudWxsLCAvLyA6c3RyaW5nIFBvc3NpYmxlIHZhbHVlcyBhbGxvd2VkOiAnbmV2ZXInLCAnZGF0ZScsICdvY3VycmVuY2VzJ1xyXG4gICAgICAgIHNlbGVjdGVkV2Vla0RheXM6IFtdLCAvLyA6aW50ZWdlcltdIDA6U3VuZGF5XHJcbiAgICAgICAgbW9udGhseVdlZWtEYXk6IGZhbHNlLFxyXG4gICAgICAgIGluY29tcGF0aWJsZTogZmFsc2UsXHJcbiAgICAgICAgdG9vTWFueTogZmFsc2VcclxuICAgIH0sIHZhbHVlcyk7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIFJlY3VycmVuY2VPY2N1cnJlbmNlKHZhbHVlcykge1xyXG4gICAgTW9kZWwodGhpcyk7XHJcbiAgICBcclxuICAgIHRoaXMubW9kZWwuZGVmUHJvcGVydGllcyh7XHJcbiAgICAgICAgc3RhcnRUaW1lOiBudWxsLCAvLzpEYXRlXHJcbiAgICAgICAgZW5kVGltZTogbnVsbCAvLzpEYXRlXHJcbiAgICB9LCB2YWx1ZXMpO1xyXG59XHJcblxyXG52YXIga28gPSByZXF1aXJlKCdrbm9ja291dCcpLFxyXG4gICAgTW9kZWwgPSByZXF1aXJlKCcuL01vZGVsJyksXHJcbiAgICBtb21lbnQgPSByZXF1aXJlKCdtb21lbnQnKTtcclxuICAgXHJcbmZ1bmN0aW9uIENhbGVuZGFyRXZlbnQodmFsdWVzKSB7XHJcbiAgICBcclxuICAgIE1vZGVsKHRoaXMpO1xyXG4gICAgXHJcbiAgICB0aGlzLm1vZGVsLmRlZlByb3BlcnRpZXMoe1xyXG4gICAgICAgIGNhbGVuZGFyRXZlbnRJRDogMCxcclxuICAgICAgICB1c2VySUQ6IDAsXHJcbiAgICAgICAgZXZlbnRUeXBlSUQ6IDMsXHJcbiAgICAgICAgc3VtbWFyeTogJycsXHJcbiAgICAgICAgYXZhaWxhYmlsaXR5VHlwZUlEOiAwLFxyXG4gICAgICAgIHN0YXJ0VGltZTogbnVsbCxcclxuICAgICAgICBlbmRUaW1lOiBudWxsLFxyXG4gICAgICAgIGtpbmQ6IDAsXHJcbiAgICAgICAgaXNBbGxEYXk6IGZhbHNlLFxyXG4gICAgICAgIHRpbWVab25lOiAnWicsXHJcbiAgICAgICAgbG9jYXRpb246IG51bGwsXHJcbiAgICAgICAgdXBkYXRlZERhdGU6IG51bGwsXHJcbiAgICAgICAgY3JlYXRlZERhdGU6IG51bGwsXHJcbiAgICAgICAgZGVzY3JpcHRpb246ICcnLFxyXG4gICAgICAgIHJlYWRPbmx5OiBmYWxzZVxyXG4gICAgfSwgdmFsdWVzKTtcclxuXHJcbiAgICB0aGlzLnJlY3VycmVuY2VSdWxlID0ga28ub2JzZXJ2YWJsZShcclxuICAgICAgICB2YWx1ZXMgJiYgXHJcbiAgICAgICAgdmFsdWVzLnJlY3VycmVuY2VSdWxlICYmIFxyXG4gICAgICAgIG5ldyBSZWN1cnJlbmNlUnVsZSh2YWx1ZXMucmVjdXJyZW5jZVJ1bGUpXHJcbiAgICApO1xyXG4gICAgdGhpcy5yZWN1cnJlbmNlT2NjdXJyZW5jZXMgPSBrby5vYnNlcnZhYmxlQXJyYXkoW10pOyAvLzpSZWN1cnJlbmNlT2NjdXJyZW5jZVtdXHJcbiAgICBpZiAodmFsdWVzICYmIHZhbHVlcy5yZWN1cnJlbmNlT2NjdXJyZW5jZXMpIHtcclxuICAgICAgICB2YWx1ZXMucmVjdXJyZW5jZU9jY3VycmVuY2VzLmZvckVhY2goZnVuY3Rpb24ob2NjdXJyZW5jZSkge1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgdGhpcy5SZWN1cnJlbmNlT2NjdXJyZW5jZXMucHVzaChuZXcgUmVjdXJyZW5jZU9jY3VycmVuY2Uob2NjdXJyZW5jZSkpO1xyXG4gICAgICAgICAgICBcclxuICAgICAgICB9LmJpbmQodGhpcykpO1xyXG4gICAgfVxyXG59XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IENhbGVuZGFyRXZlbnQ7XHJcblxyXG5DYWxlbmRhckV2ZW50LlJlY3VycmVuY2VSdWxlID0gUmVjdXJyZW5jZVJ1bGU7XHJcbkNhbGVuZGFyRXZlbnQuUmVjdXJyZW5jZU9jY3VycmVuY2UgPSBSZWN1cnJlbmNlT2NjdXJyZW5jZTsiLCIvKiogQ2FsZW5kYXJTbG90IG1vZGVsLlxyXG5cclxuICAgIERlc2NyaWJlcyBhIHRpbWUgc2xvdCBpbiB0aGUgY2FsZW5kYXIsIGZvciBhIGNvbnNlY3V0aXZlXHJcbiAgICBldmVudCwgYXBwb2ludG1lbnQgb3IgZnJlZSB0aW1lLlxyXG4gKiovXHJcbid1c2Ugc3RyaWN0JztcclxuXHJcbnZhciBrbyA9IHJlcXVpcmUoJ2tub2Nrb3V0JyksXHJcbiAgICBNb2RlbCA9IHJlcXVpcmUoJy4vTW9kZWwnKSxcclxuICAgIENsaWVudCA9IHJlcXVpcmUoJy4vQ2xpZW50Jyk7XHJcblxyXG5mdW5jdGlvbiBDYWxlbmRhclNsb3QodmFsdWVzKSB7XHJcbiAgICBcclxuICAgIE1vZGVsKHRoaXMpO1xyXG5cclxuICAgIHRoaXMubW9kZWwuZGVmUHJvcGVydGllcyh7XHJcbiAgICAgICAgc3RhcnRUaW1lOiBudWxsLFxyXG4gICAgICAgIGVuZFRpbWU6IG51bGwsXHJcbiAgICAgICAgXHJcbiAgICAgICAgc3ViamVjdDogJycsXHJcbiAgICAgICAgZGVzY3JpcHRpb246IG51bGwsXHJcbiAgICAgICAgbGluazogJyMnLFxyXG5cclxuICAgICAgICBhY3Rpb25JY29uOiBudWxsLFxyXG4gICAgICAgIGFjdGlvblRleHQ6IG51bGwsXHJcbiAgICAgICAgXHJcbiAgICAgICAgY2xhc3NOYW1lczogJydcclxuXHJcbiAgICB9LCB2YWx1ZXMpO1xyXG59XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IENhbGVuZGFyU2xvdDtcclxuIiwiLyoqIENsaWVudCBtb2RlbCAqKi9cclxuJ3VzZSBzdHJpY3QnO1xyXG5cclxudmFyIGtvID0gcmVxdWlyZSgna25vY2tvdXQnKSxcclxuICAgIE1vZGVsID0gcmVxdWlyZSgnLi9Nb2RlbCcpO1xyXG5cclxuZnVuY3Rpb24gQ2xpZW50KHZhbHVlcykge1xyXG4gICAgXHJcbiAgICBNb2RlbCh0aGlzKTtcclxuICAgIFxyXG4gICAgdGhpcy5tb2RlbC5kZWZQcm9wZXJ0aWVzKHtcclxuICAgICAgICBmaXJzdE5hbWU6ICcnLFxyXG4gICAgICAgIGxhc3ROYW1lOiAnJ1xyXG4gICAgfSwgdmFsdWVzKTtcclxuXHJcbiAgICB0aGlzLmZ1bGxOYW1lID0ga28uY29tcHV0ZWQoZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgcmV0dXJuICh0aGlzLmZpcnN0TmFtZSgpICsgJyAnICsgdGhpcy5sYXN0TmFtZSgpKTtcclxuICAgIH0sIHRoaXMpO1xyXG59XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IENsaWVudDtcclxuIiwiLyoqIEdldE1vcmUgbW9kZWwgKiovXHJcbid1c2Ugc3RyaWN0JztcclxuXHJcbnZhciBrbyA9IHJlcXVpcmUoJ2tub2Nrb3V0JyksXHJcbiAgICBNb2RlbCA9IHJlcXVpcmUoJy4vTW9kZWwnKSxcclxuICAgIExpc3RWaWV3SXRlbSA9IHJlcXVpcmUoJy4vTGlzdFZpZXdJdGVtJyk7XHJcblxyXG5mdW5jdGlvbiBHZXRNb3JlKHZhbHVlcykge1xyXG5cclxuICAgIE1vZGVsKHRoaXMpO1xyXG5cclxuICAgIHRoaXMubW9kZWwuZGVmUHJvcGVydGllcyh7XHJcbiAgICAgICAgYXZhaWxhYmlsaXR5OiBmYWxzZSxcclxuICAgICAgICBwYXltZW50czogZmFsc2UsXHJcbiAgICAgICAgcHJvZmlsZTogZmFsc2UsXHJcbiAgICAgICAgY29vcDogdHJ1ZVxyXG4gICAgfSk7XHJcbiAgICBcclxuICAgIHZhciBhdmFpbGFibGVJdGVtcyA9IHtcclxuICAgICAgICBhdmFpbGFiaWxpdHk6IG5ldyBMaXN0Vmlld0l0ZW0oe1xyXG4gICAgICAgICAgICBjb250ZW50TGluZTE6ICdDb21wbGV0ZSB5b3VyIGF2YWlsYWJpbGl0eSB0byBjcmVhdGUgYSBjbGVhbmVyIGNhbGVuZGFyJyxcclxuICAgICAgICAgICAgbWFya2VySWNvbjogJ2dseXBoaWNvbiBnbHlwaGljb24tY2FsZW5kYXInLFxyXG4gICAgICAgICAgICBhY3Rpb25JY29uOiAnZ2x5cGhpY29uIGdseXBoaWNvbi1jaGV2cm9uLXJpZ2h0J1xyXG4gICAgICAgIH0pLFxyXG4gICAgICAgIHBheW1lbnRzOiBuZXcgTGlzdFZpZXdJdGVtKHtcclxuICAgICAgICAgICAgY29udGVudExpbmUxOiAnU3RhcnQgYWNjZXB0aW5nIHBheW1lbnRzIHRocm91Z2ggTG9jb25vbWljcycsXHJcbiAgICAgICAgICAgIG1hcmtlckljb246ICdnbHlwaGljb24gZ2x5cGhpY29uLXVzZCcsXHJcbiAgICAgICAgICAgIGFjdGlvbkljb246ICdnbHlwaGljb24gZ2x5cGhpY29uLWNoZXZyb24tcmlnaHQnXHJcbiAgICAgICAgfSksXHJcbiAgICAgICAgcHJvZmlsZTogbmV3IExpc3RWaWV3SXRlbSh7XHJcbiAgICAgICAgICAgIGNvbnRlbnRMaW5lMTogJ0FjdGl2YXRlIHlvdXIgcHJvZmlsZSBpbiB0aGUgbWFya2V0cGxhY2UnLFxyXG4gICAgICAgICAgICBtYXJrZXJJY29uOiAnZ2x5cGhpY29uIGdseXBoaWNvbi11c2VyJyxcclxuICAgICAgICAgICAgYWN0aW9uSWNvbjogJ2dseXBoaWNvbiBnbHlwaGljb24tY2hldnJvbi1yaWdodCdcclxuICAgICAgICB9KSxcclxuICAgICAgICBjb29wOiBuZXcgTGlzdFZpZXdJdGVtKHtcclxuICAgICAgICAgICAgY29udGVudExpbmUxOiAnTGVhcm4gbW9yZSBhYm91dCBvdXIgY29vcGVyYXRpdmUnLFxyXG4gICAgICAgICAgICBhY3Rpb25JY29uOiAnZ2x5cGhpY29uIGdseXBoaWNvbi1jaGV2cm9uLXJpZ2h0J1xyXG4gICAgICAgIH0pXHJcbiAgICB9O1xyXG5cclxuICAgIHRoaXMuaXRlbXMgPSBrby5wdXJlQ29tcHV0ZWQoZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgdmFyIGl0ZW1zID0gW107XHJcbiAgICAgICAgXHJcbiAgICAgICAgT2JqZWN0LmtleXMoYXZhaWxhYmxlSXRlbXMpLmZvckVhY2goZnVuY3Rpb24oa2V5KSB7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICBpZiAodGhpc1trZXldKCkpXHJcbiAgICAgICAgICAgICAgICBpdGVtcy5wdXNoKGF2YWlsYWJsZUl0ZW1zW2tleV0pO1xyXG4gICAgICAgIH0uYmluZCh0aGlzKSk7XHJcblxyXG4gICAgICAgIHJldHVybiBpdGVtcztcclxuICAgIH0sIHRoaXMpO1xyXG59XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IEdldE1vcmU7XHJcbiIsIi8qKiBMaXN0Vmlld0l0ZW0gbW9kZWwuXHJcblxyXG4gICAgRGVzY3JpYmVzIGEgZ2VuZXJpYyBpdGVtIG9mIGFcclxuICAgIExpc3RWaWV3IGNvbXBvbmVudC5cclxuICoqL1xyXG4ndXNlIHN0cmljdCc7XHJcblxyXG52YXIga28gPSByZXF1aXJlKCdrbm9ja291dCcpLFxyXG4gICAgTW9kZWwgPSByZXF1aXJlKCcuL01vZGVsJyksXHJcbiAgICBtb21lbnQgPSByZXF1aXJlKCdtb21lbnQnKTtcclxuXHJcbmZ1bmN0aW9uIExpc3RWaWV3SXRlbSh2YWx1ZXMpIHtcclxuICAgIFxyXG4gICAgTW9kZWwodGhpcyk7XHJcblxyXG4gICAgdGhpcy5tb2RlbC5kZWZQcm9wZXJ0aWVzKHtcclxuICAgICAgICBtYXJrZXJMaW5lMTogbnVsbCxcclxuICAgICAgICBtYXJrZXJMaW5lMjogbnVsbCxcclxuICAgICAgICBtYXJrZXJJY29uOiBudWxsLFxyXG4gICAgICAgIFxyXG4gICAgICAgIGNvbnRlbnRMaW5lMTogJycsXHJcbiAgICAgICAgY29udGVudExpbmUyOiBudWxsLFxyXG4gICAgICAgIGxpbms6ICcjJyxcclxuXHJcbiAgICAgICAgYWN0aW9uSWNvbjogbnVsbCxcclxuICAgICAgICBhY3Rpb25UZXh0OiBudWxsLFxyXG4gICAgICAgIFxyXG4gICAgICAgIGNsYXNzTmFtZXM6ICcnXHJcblxyXG4gICAgfSwgdmFsdWVzKTtcclxufVxyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBMaXN0Vmlld0l0ZW07XHJcbiIsIi8qKiBMb2NhdGlvbiBtb2RlbCAqKi9cclxuJ3VzZSBzdHJpY3QnO1xyXG5cclxudmFyIGtvID0gcmVxdWlyZSgna25vY2tvdXQnKSxcclxuICAgIE1vZGVsID0gcmVxdWlyZSgnLi9Nb2RlbCcpO1xyXG5cclxuZnVuY3Rpb24gTG9jYXRpb24odmFsdWVzKSB7XHJcblxyXG4gICAgTW9kZWwodGhpcyk7XHJcbiAgICBcclxuICAgIHRoaXMubW9kZWwuZGVmUHJvcGVydGllcyh7XHJcbiAgICAgICAgbG9jYXRpb25JRDogMCxcclxuICAgICAgICBuYW1lOiAnJyxcclxuICAgICAgICBhZGRyZXNzTGluZTE6IG51bGwsXHJcbiAgICAgICAgYWRkcmVzc0xpbmUyOiBudWxsLFxyXG4gICAgICAgIGNpdHk6IG51bGwsXHJcbiAgICAgICAgc3RhdGVQcm92aW5jZUNvZGU6IG51bGwsXHJcbiAgICAgICAgc3RhdGVQcm92aWNlSUQ6IG51bGwsXHJcbiAgICAgICAgcG9zdGFsQ29kZTogbnVsbCxcclxuICAgICAgICBwb3N0YWxDb2RlSUQ6IG51bGwsXHJcbiAgICAgICAgY291bnRyeUlEOiBudWxsLFxyXG4gICAgICAgIGxhdGl0dWRlOiBudWxsLFxyXG4gICAgICAgIGxvbmdpdHVkZTogbnVsbCxcclxuICAgICAgICBzcGVjaWFsSW5zdHJ1Y3Rpb25zOiBudWxsLFxyXG4gICAgICAgIGlzU2VydmljZVJhZGl1czogZmFsc2UsXHJcbiAgICAgICAgaXNTZXJ2aWNlTG9jYXRpb246IGZhbHNlLFxyXG4gICAgICAgIHNlcnZpY2VSYWRpdXM6IDBcclxuICAgIH0sIHZhbHVlcyk7XHJcbiAgICBcclxuICAgIHRoaXMuc2luZ2xlTGluZSA9IGtvLmNvbXB1dGVkKGZ1bmN0aW9uKCkge1xyXG4gICAgICAgIFxyXG4gICAgICAgIHZhciBsaXN0ID0gW1xyXG4gICAgICAgICAgICB0aGlzLmFkZHJlc3NMaW5lMSgpLFxyXG4gICAgICAgICAgICB0aGlzLmNpdHkoKSxcclxuICAgICAgICAgICAgdGhpcy5wb3N0YWxDb2RlKCksXHJcbiAgICAgICAgICAgIHRoaXMuc3RhdGVQcm92aW5jZUNvZGUoKVxyXG4gICAgICAgIF07XHJcbiAgICAgICAgXHJcbiAgICAgICAgcmV0dXJuIGxpc3QuZmlsdGVyKGZ1bmN0aW9uKHYpIHsgcmV0dXJuICEhdjsgfSkuam9pbignLCAnKTtcclxuICAgIH0sIHRoaXMpO1xyXG4gICAgXHJcbiAgICB0aGlzLmNvdW50cnlOYW1lID0ga28uY29tcHV0ZWQoZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgcmV0dXJuIChcclxuICAgICAgICAgICAgdGhpcy5jb3VudHJ5SUQoKSA9PT0gMSA/XHJcbiAgICAgICAgICAgICdVbml0ZWQgU3RhdGVzJyA6XHJcbiAgICAgICAgICAgIHRoaXMuY291bnRyeUlEKCkgPT09IDIgP1xyXG4gICAgICAgICAgICAnU3BhaW4nIDpcclxuICAgICAgICAgICAgJ3Vua25vdydcclxuICAgICAgICApO1xyXG4gICAgfSwgdGhpcyk7XHJcbiAgICBcclxuICAgIHRoaXMuY291bnRyeUNvZGVBbHBoYTIgPSBrby5jb21wdXRlZChmdW5jdGlvbigpIHtcclxuICAgICAgICByZXR1cm4gKFxyXG4gICAgICAgICAgICB0aGlzLmNvdW50cnlJRCgpID09PSAxID9cclxuICAgICAgICAgICAgJ1VTJyA6XHJcbiAgICAgICAgICAgIHRoaXMuY291bnRyeUlEKCkgPT09IDIgP1xyXG4gICAgICAgICAgICAnRVMnIDpcclxuICAgICAgICAgICAgJydcclxuICAgICAgICApO1xyXG4gICAgfSwgdGhpcyk7XHJcbiAgICBcclxuICAgIHRoaXMubGF0bG5nID0ga28uY29tcHV0ZWQoZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgcmV0dXJuIHtcclxuICAgICAgICAgICAgbGF0OiB0aGlzLmxhdGl0dWRlKCksXHJcbiAgICAgICAgICAgIGxuZzogdGhpcy5sb25naXR1ZGUoKVxyXG4gICAgICAgIH07XHJcbiAgICB9LCB0aGlzKTtcclxufVxyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBMb2NhdGlvbjtcclxuIiwiLyoqIE1haWxGb2xkZXIgbW9kZWwgKiovXHJcbid1c2Ugc3RyaWN0JztcclxuXHJcbnZhciBrbyA9IHJlcXVpcmUoJ2tub2Nrb3V0JyksXHJcbiAgICBNb2RlbCA9IHJlcXVpcmUoJy4vTW9kZWwnKSxcclxuICAgIG1vbWVudCA9IHJlcXVpcmUoJ21vbWVudCcpLFxyXG4gICAgXyA9IHJlcXVpcmUoJ2xvZGFzaCcpO1xyXG5cclxuZnVuY3Rpb24gTWFpbEZvbGRlcih2YWx1ZXMpIHtcclxuXHJcbiAgICBNb2RlbCh0aGlzKTtcclxuXHJcbiAgICB0aGlzLm1vZGVsLmRlZlByb3BlcnRpZXMoe1xyXG4gICAgICAgIG1lc3NhZ2VzOiBbXSxcclxuICAgICAgICB0b3BOdW1iZXI6IDEwXHJcbiAgICB9LCB2YWx1ZXMpO1xyXG4gICAgXHJcbiAgICB0aGlzLnRvcCA9IGtvLnB1cmVDb21wdXRlZChmdW5jdGlvbiB0b3AobnVtKSB7XHJcbiAgICAgICAgaWYgKG51bSkgdGhpcy50b3BOdW1iZXIobnVtKTtcclxuICAgICAgICByZXR1cm4gXy5maXJzdCh0aGlzLm1lc3NhZ2VzKCksIHRoaXMudG9wTnVtYmVyKCkpO1xyXG4gICAgfSwgdGhpcyk7XHJcbn1cclxuXHJcbm1vZHVsZS5leHBvcnRzID0gTWFpbEZvbGRlcjtcclxuIiwiLyoqIE1lc3NhZ2UgbW9kZWwuXHJcblxyXG4gICAgRGVzY3JpYmVzIGEgbWVzc2FnZSBmcm9tIGEgTWFpbEZvbGRlci5cclxuICAgIEEgbWVzc2FnZSBjb3VsZCBiZSBvZiBkaWZmZXJlbnQgdHlwZXMsXHJcbiAgICBhcyBpbnF1aXJpZXMsIGJvb2tpbmdzLCBib29raW5nIHJlcXVlc3RzLlxyXG4gKiovXHJcbid1c2Ugc3RyaWN0JztcclxuXHJcbnZhciBrbyA9IHJlcXVpcmUoJ2tub2Nrb3V0JyksXHJcbiAgICBNb2RlbCA9IHJlcXVpcmUoJy4vTW9kZWwnKSxcclxuICAgIG1vbWVudCA9IHJlcXVpcmUoJ21vbWVudCcpO1xyXG4vL1RPRE8gICBUaHJlYWQgPSByZXF1aXJlKCcuL1RocmVhZCcpO1xyXG5cclxuZnVuY3Rpb24gTWVzc2FnZSh2YWx1ZXMpIHtcclxuICAgIFxyXG4gICAgTW9kZWwodGhpcyk7XHJcblxyXG4gICAgdGhpcy5tb2RlbC5kZWZQcm9wZXJ0aWVzKHtcclxuICAgICAgICBjcmVhdGVkRGF0ZTogbnVsbCxcclxuICAgICAgICB1cGRhdGVkRGF0ZTogbnVsbCxcclxuICAgICAgICBcclxuICAgICAgICBzdWJqZWN0OiAnJyxcclxuICAgICAgICBjb250ZW50OiBudWxsLFxyXG4gICAgICAgIGxpbms6ICcjJyxcclxuXHJcbiAgICAgICAgYWN0aW9uSWNvbjogbnVsbCxcclxuICAgICAgICBhY3Rpb25UZXh0OiBudWxsLFxyXG4gICAgICAgIFxyXG4gICAgICAgIGNsYXNzTmFtZXM6ICcnXHJcblxyXG4gICAgfSwgdmFsdWVzKTtcclxuICAgIFxyXG4gICAgLy8gU21hcnQgdmlzdWFsaXphdGlvbiBvZiBkYXRlIGFuZCB0aW1lXHJcbiAgICB0aGlzLmRpc3BsYXllZERhdGUgPSBrby5wdXJlQ29tcHV0ZWQoZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgXHJcbiAgICAgICAgcmV0dXJuIG1vbWVudCh0aGlzLmNyZWF0ZWREYXRlKCkpLmxvY2FsZSgnZW4tVVMtTEMnKS5jYWxlbmRhcigpO1xyXG4gICAgICAgIFxyXG4gICAgfSwgdGhpcyk7XHJcbiAgICBcclxuICAgIHRoaXMuZGlzcGxheWVkVGltZSA9IGtvLnB1cmVDb21wdXRlZChmdW5jdGlvbigpIHtcclxuICAgICAgICBcclxuICAgICAgICByZXR1cm4gbW9tZW50KHRoaXMuY3JlYXRlZERhdGUoKSkubG9jYWxlKCdlbi1VUy1MQycpLmZvcm1hdCgnTFQnKTtcclxuICAgICAgICBcclxuICAgIH0sIHRoaXMpO1xyXG59XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IE1lc3NhZ2U7XHJcbiIsIi8qKlxyXG4gICAgTW9kZWwgY2xhc3MgdG8gaGVscCBidWlsZCBtb2RlbHMuXHJcblxyXG4gICAgSXMgbm90IGV4YWN0bHkgYW4gJ09PUCBiYXNlJyBjbGFzcywgYnV0IHByb3ZpZGVzXHJcbiAgICB1dGlsaXRpZXMgdG8gbW9kZWxzIGFuZCBhIG1vZGVsIGRlZmluaXRpb24gb2JqZWN0XHJcbiAgICB3aGVuIGV4ZWN1dGVkIGluIHRoZWlyIGNvbnN0cnVjdG9ycyBhczpcclxuICAgIFxyXG4gICAgJycnXHJcbiAgICBmdW5jdGlvbiBNeU1vZGVsKCkge1xyXG4gICAgICAgIE1vZGVsKHRoaXMpO1xyXG4gICAgICAgIC8vIE5vdywgdGhlcmUgaXMgYSB0aGlzLm1vZGVsIHByb3BlcnR5IHdpdGhcclxuICAgICAgICAvLyBhbiBpbnN0YW5jZSBvZiB0aGUgTW9kZWwgY2xhc3MsIHdpdGggXHJcbiAgICAgICAgLy8gdXRpbGl0aWVzIGFuZCBtb2RlbCBzZXR0aW5ncy5cclxuICAgIH1cclxuICAgICcnJ1xyXG4gICAgXHJcbiAgICBUaGF0IGF1dG8gY3JlYXRpb24gb2YgJ21vZGVsJyBwcm9wZXJ0eSBjYW4gYmUgYXZvaWRlZFxyXG4gICAgd2hlbiB1c2luZyB0aGUgb2JqZWN0IGluc3RhbnRpYXRpb24gc3ludGF4ICgnbmV3JyBrZXl3b3JkKTpcclxuICAgIFxyXG4gICAgJycnXHJcbiAgICB2YXIgbW9kZWwgPSBuZXcgTW9kZWwob2JqKTtcclxuICAgIC8vIFRoZXJlIGlzIG5vIGEgJ29iai5tb2RlbCcgcHJvcGVydHksIGNhbiBiZVxyXG4gICAgLy8gYXNzaWduZWQgdG8gd2hhdGV2ZXIgcHJvcGVydHkgb3Igbm90aGluZy5cclxuICAgICcnJ1xyXG4qKi9cclxuJ3VzZSBzdHJpY3QnO1xyXG52YXIga28gPSByZXF1aXJlKCdrbm9ja291dCcpO1xyXG5rby5tYXBwaW5nID0gcmVxdWlyZSgna25vY2tvdXQubWFwcGluZycpO1xyXG5cclxuZnVuY3Rpb24gTW9kZWwobW9kZWxPYmplY3QpIHtcclxuICAgIFxyXG4gICAgaWYgKCEodGhpcyBpbnN0YW5jZW9mIE1vZGVsKSkge1xyXG4gICAgICAgIC8vIEV4ZWN1dGVkIGFzIGEgZnVuY3Rpb24sIGl0IG11c3QgY3JlYXRlXHJcbiAgICAgICAgLy8gYSBNb2RlbCBpbnN0YW5jZVxyXG4gICAgICAgIHZhciBtb2RlbCA9IG5ldyBNb2RlbChtb2RlbE9iamVjdCk7XHJcbiAgICAgICAgLy8gYW5kIHJlZ2lzdGVyIGF1dG9tYXRpY2FsbHkgYXMgcGFydFxyXG4gICAgICAgIC8vIG9mIHRoZSBtb2RlbE9iamVjdCBpbiAnbW9kZWwnIHByb3BlcnR5XHJcbiAgICAgICAgbW9kZWxPYmplY3QubW9kZWwgPSBtb2RlbDtcclxuICAgICAgICBcclxuICAgICAgICAvLyBSZXR1cm5zIHRoZSBpbnN0YW5jZVxyXG4gICAgICAgIHJldHVybiBtb2RlbDtcclxuICAgIH1cclxuIFxyXG4gICAgLy8gSXQgaW5jbHVkZXMgYSByZWZlcmVuY2UgdG8gdGhlIG9iamVjdFxyXG4gICAgdGhpcy5tb2RlbE9iamVjdCA9IG1vZGVsT2JqZWN0O1xyXG4gICAgLy8gSXQgbWFpbnRhaW5zIGEgbGlzdCBvZiBwcm9wZXJ0aWVzIGFuZCBmaWVsZHNcclxuICAgIHRoaXMucHJvcGVydGllc0xpc3QgPSBbXTtcclxuICAgIHRoaXMuZmllbGRzTGlzdCA9IFtdO1xyXG4gICAgLy8gSXQgYWxsb3cgc2V0dGluZyB0aGUgJ2tvLm1hcHBpbmcuZnJvbUpTJyBtYXBwaW5nIG9wdGlvbnNcclxuICAgIC8vIHRvIGNvbnRyb2wgY29udmVyc2lvbnMgZnJvbSBwbGFpbiBKUyBvYmplY3RzIHdoZW4gXHJcbiAgICAvLyAndXBkYXRlV2l0aCcuXHJcbiAgICB0aGlzLm1hcHBpbmdPcHRpb25zID0ge307XHJcbn1cclxuXHJcbm1vZHVsZS5leHBvcnRzID0gTW9kZWw7XHJcblxyXG4vKipcclxuICAgIERlZmluZSBvYnNlcnZhYmxlIHByb3BlcnRpZXMgdXNpbmcgdGhlIGdpdmVuXHJcbiAgICBwcm9wZXJ0aWVzIG9iamVjdCBkZWZpbml0aW9uIHRoYXQgaW5jbHVkZXMgZGUgZGVmYXVsdCB2YWx1ZXMsXHJcbiAgICBhbmQgc29tZSBvcHRpb25hbCBpbml0aWFsVmFsdWVzIChub3JtYWxseSB0aGF0IGlzIHByb3ZpZGVkIGV4dGVybmFsbHlcclxuICAgIGFzIGEgcGFyYW1ldGVyIHRvIHRoZSBtb2RlbCBjb25zdHJ1Y3Rvciwgd2hpbGUgZGVmYXVsdCB2YWx1ZXMgYXJlXHJcbiAgICBzZXQgaW4gdGhlIGNvbnN0cnVjdG9yKS5cclxuICAgIFRoYXQgcHJvcGVydGllcyBiZWNvbWUgbWVtYmVycyBvZiB0aGUgbW9kZWxPYmplY3QsIHNpbXBsaWZ5aW5nIFxyXG4gICAgbW9kZWwgZGVmaW5pdGlvbnMuXHJcbiAgICBcclxuICAgIEl0IHVzZXMgS25vY2tvdXQub2JzZXJ2YWJsZSBhbmQgb2JzZXJ2YWJsZUFycmF5LCBzbyBwcm9wZXJ0aWVzXHJcbiAgICBhcmUgZnVudGlvbnMgdGhhdCByZWFkcyB0aGUgdmFsdWUgd2hlbiBubyBhcmd1bWVudHMgb3Igc2V0cyB3aGVuXHJcbiAgICBvbmUgYXJndW1lbnQgaXMgcGFzc2VkIG9mLlxyXG4qKi9cclxuTW9kZWwucHJvdG90eXBlLmRlZlByb3BlcnRpZXMgPSBmdW5jdGlvbiBkZWZQcm9wZXJ0aWVzKHByb3BlcnRpZXMsIGluaXRpYWxWYWx1ZXMpIHtcclxuXHJcbiAgICBpbml0aWFsVmFsdWVzID0gaW5pdGlhbFZhbHVlcyB8fCB7fTtcclxuXHJcbiAgICB2YXIgbW9kZWxPYmplY3QgPSB0aGlzLm1vZGVsT2JqZWN0LFxyXG4gICAgICAgIHByb3BlcnRpZXNMaXN0ID0gdGhpcy5wcm9wZXJ0aWVzTGlzdDtcclxuXHJcbiAgICBPYmplY3Qua2V5cyhwcm9wZXJ0aWVzKS5mb3JFYWNoKGZ1bmN0aW9uKGtleSkge1xyXG4gICAgICAgIFxyXG4gICAgICAgIHZhciBkZWZWYWwgPSBwcm9wZXJ0aWVzW2tleV07XHJcbiAgICAgICAgLy8gQ3JlYXRlIG9ic2VydmFibGUgcHJvcGVydHkgd2l0aCBkZWZhdWx0IHZhbHVlXHJcbiAgICAgICAgbW9kZWxPYmplY3Rba2V5XSA9IEFycmF5LmlzQXJyYXkoZGVmVmFsKSA/XHJcbiAgICAgICAgICAgIGtvLm9ic2VydmFibGVBcnJheShkZWZWYWwpIDpcclxuICAgICAgICAgICAga28ub2JzZXJ2YWJsZShkZWZWYWwpO1xyXG4gICAgICAgIC8vIFJlbWVtYmVyIGRlZmF1bHRcclxuICAgICAgICBtb2RlbE9iamVjdFtrZXldLl9kZWZhdWx0VmFsdWUgPSBkZWZWYWw7XHJcbiAgICAgICAgLy8gcmVtZW1iZXIgaW5pdGlhbFxyXG4gICAgICAgIG1vZGVsT2JqZWN0W2tleV0uX2luaXRpYWxWYWx1ZSA9IGluaXRpYWxWYWx1ZXNba2V5XTtcclxuICAgICAgICBcclxuICAgICAgICAvLyBJZiB0aGVyZSBpcyBhbiBpbml0aWFsVmFsdWUsIHNldCBpdDpcclxuICAgICAgICBpZiAodHlwZW9mKGluaXRpYWxWYWx1ZXNba2V5XSkgIT09ICd1bmRlZmluZWQnKSB7XHJcbiAgICAgICAgICAgIG1vZGVsT2JqZWN0W2tleV0oaW5pdGlhbFZhbHVlc1trZXldKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgXHJcbiAgICAgICAgLy8gQWRkIHRvIHRoZSBpbnRlcm5hbCByZWdpc3RyeVxyXG4gICAgICAgIHByb3BlcnRpZXNMaXN0LnB1c2goa2V5KTtcclxuICAgIH0pO1xyXG59O1xyXG5cclxuLyoqXHJcbiAgICBEZWZpbmUgZmllbGRzIGFzIHBsYWluIG1lbWJlcnMgb2YgdGhlIG1vZGVsT2JqZWN0IHVzaW5nXHJcbiAgICB0aGUgZmllbGRzIG9iamVjdCBkZWZpbml0aW9uIHRoYXQgaW5jbHVkZXMgZGVmYXVsdCB2YWx1ZXMsXHJcbiAgICBhbmQgc29tZSBvcHRpb25hbCBpbml0aWFsVmFsdWVzLlxyXG4gICAgXHJcbiAgICBJdHMgbGlrZSBkZWZQcm9wZXJ0aWVzLCBidXQgZm9yIHBsYWluIGpzIHZhbHVlcyByYXRoZXIgdGhhbiBvYnNlcnZhYmxlcy5cclxuKiovXHJcbk1vZGVsLnByb3RvdHlwZS5kZWZGaWVsZHMgPSBmdW5jdGlvbiBkZWZGaWVsZHMoZmllbGRzLCBpbml0aWFsVmFsdWVzKSB7XHJcblxyXG4gICAgaW5pdGlhbFZhbHVlcyA9IGluaXRpYWxWYWx1ZXMgfHwge307XHJcblxyXG4gICAgdmFyIG1vZGVsT2JqZWN0ID0gdGhpcy5tb2RlbE9iamVjdCxcclxuICAgICAgICBmaWVsZHNMaXN0ID0gdGhpcy5maWVsZHNMaXN0O1xyXG5cclxuICAgIE9iamVjdC5rZXlzKGZpZWxkcykuZWFjaChmdW5jdGlvbihrZXkpIHtcclxuICAgICAgICBcclxuICAgICAgICB2YXIgZGVmVmFsID0gZmllbGRzW2tleV07XHJcbiAgICAgICAgLy8gQ3JlYXRlIGZpZWxkIHdpdGggZGVmYXVsdCB2YWx1ZVxyXG4gICAgICAgIG1vZGVsT2JqZWN0W2tleV0gPSBkZWZWYWw7XHJcbiAgICAgICAgXHJcbiAgICAgICAgLy8gSWYgdGhlcmUgaXMgYW4gaW5pdGlhbFZhbHVlLCBzZXQgaXQ6XHJcbiAgICAgICAgaWYgKHR5cGVvZihpbml0aWFsVmFsdWVzW2tleV0pICE9PSAndW5kZWZpbmVkJykge1xyXG4gICAgICAgICAgICBtb2RlbE9iamVjdFtrZXldID0gaW5pdGlhbFZhbHVlc1trZXldO1xyXG4gICAgICAgIH1cclxuICAgICAgICBcclxuICAgICAgICAvLyBBZGQgdG8gdGhlIGludGVybmFsIHJlZ2lzdHJ5XHJcbiAgICAgICAgZmllbGRzTGlzdC5wdXNoKGtleSk7XHJcbiAgICB9KTsgICAgXHJcbn07XHJcblxyXG5Nb2RlbC5wcm90b3R5cGUudXBkYXRlV2l0aCA9IGZ1bmN0aW9uIHVwZGF0ZVdpdGgoZGF0YSkge1xyXG4gICAgXHJcbiAgICAvLyBXZSBuZWVkIGEgcGxhaW4gb2JqZWN0IGZvciAnZnJvbUpTJy5cclxuICAgIC8vIElmIGlzIGEgbW9kZWwsIGV4dHJhY3QgdGhlaXIgcHJvcGVydGllcyBhbmQgZmllbGRzIGZyb21cclxuICAgIC8vIHRoZSBvYnNlcnZhYmxlcyAoZnJvbUpTKSwgc28gd2Ugbm90IGdldCBjb21wdXRlZFxyXG4gICAgLy8gb3IgZnVuY3Rpb25zLCBqdXN0IHJlZ2lzdGVyZWQgcHJvcGVydGllcyBhbmQgZmllbGRzXHJcbiAgICBpZiAoZGF0YSAmJiBkYXRhLm1vZGVsIGluc3RhbmNlb2YgTW9kZWwpIHtcclxuICAgICAgICBcclxuICAgICAgICB2YXIgcGxhaW4gPSB7fTtcclxuXHJcbiAgICAgICAgZGF0YS5tb2RlbC5wcm9wZXJ0aWVzTGlzdC5mb3JFYWNoKGZ1bmN0aW9uKHByb3BlcnR5KSB7XHJcbiAgICAgICAgICAgIC8vIFByb3BlcnRpZXMgYXJlIG9ic2VydmFibGVzLCBzbyBmdW5jdGlvbnMgd2l0aG91dCBwYXJhbXM6XHJcbiAgICAgICAgICAgIHBsYWluW3Byb3BlcnR5XSA9IGRhdGFbcHJvcGVydHldKCk7XHJcbiAgICAgICAgfSk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgZGF0YS5tb2RlbC5maWVsZHNMaXN0LmZvckVhY2goZnVuY3Rpb24oZmllbGQpIHtcclxuICAgICAgICAgICAgLy8gRmllbGRzIGFyZSBqdXN0IHBsYWluIG9iamVjdCBtZW1iZXJzIGZvciB2YWx1ZXMsIGp1c3QgY29weTpcclxuICAgICAgICAgICAgcGxhaW5bZmllbGRdID0gZGF0YVtmaWVsZF07XHJcbiAgICAgICAgfSk7XHJcblxyXG4gICAgICAgIGRhdGEgPSBwbGFpbjtcclxuICAgIH1cclxuXHJcbiAgICBrby5tYXBwaW5nLmZyb21KUyhkYXRhLCB0aGlzLm1hcHBpbmdPcHRpb25zLCB0aGlzLm1vZGVsT2JqZWN0KTtcclxufTtcclxuXHJcbk1vZGVsLnByb3RvdHlwZS5jbG9uZSA9IGZ1bmN0aW9uIGNsb25lKGRhdGEpIHtcclxuICAgIC8vIEdldCBhIHBsYWluIG9iamVjdCB3aXRoIHRoZSBvYmplY3QgZGF0YVxyXG4gICAgdmFyIHBsYWluID0ga28ubWFwcGluZy50b0pTKHRoaXMubW9kZWxPYmplY3QpO1xyXG4gICAgLy8gQ3JlYXRlIGEgbmV3IG1vZGVsIGluc3RhbmNlLCB1c2luZyB0aGUgc291cmNlIHBsYWluIG9iamVjdFxyXG4gICAgLy8gYXMgaW5pdGlhbCB2YWx1ZXNcclxuICAgIHZhciBjbG9uZWQgPSBuZXcgdGhpcy5tb2RlbE9iamVjdC5jb25zdHJ1Y3RvcihwbGFpbik7XHJcbiAgICAvLyBVcGRhdGUgdGhlIGNsb25lZCB3aXRoIHRoZSBwcm92aWRlZCBwbGFpbiBkYXRhIHVzZWRcclxuICAgIC8vIHRvIHJlcGxhY2UgdmFsdWVzIG9uIHRoZSBjbG9uZWQgb25lLCBmb3IgcXVpY2sgb25lLXN0ZXAgY3JlYXRpb25cclxuICAgIC8vIG9mIGRlcml2ZWQgb2JqZWN0cy5cclxuICAgIGNsb25lZC5tb2RlbC51cGRhdGVXaXRoKGRhdGEpO1xyXG4gICAgLy8gQ2xvbmVkIG1vZGVsIHJlYWR5OlxyXG4gICAgcmV0dXJuIGNsb25lZDtcclxufTtcclxuIiwiLyoqIFBlcmZvcm1hbmNlU3VtbWFyeSBtb2RlbCAqKi9cclxuJ3VzZSBzdHJpY3QnO1xyXG5cclxudmFyIGtvID0gcmVxdWlyZSgna25vY2tvdXQnKSxcclxuICAgIE1vZGVsID0gcmVxdWlyZSgnLi9Nb2RlbCcpLFxyXG4gICAgTGlzdFZpZXdJdGVtID0gcmVxdWlyZSgnLi9MaXN0Vmlld0l0ZW0nKSxcclxuICAgIG1vbWVudCA9IHJlcXVpcmUoJ21vbWVudCcpLFxyXG4gICAgbnVtZXJhbCA9IHJlcXVpcmUoJ251bWVyYWwnKTtcclxuXHJcbmZ1bmN0aW9uIFBlcmZvcm1hbmNlU3VtbWFyeSh2YWx1ZXMpIHtcclxuXHJcbiAgICBNb2RlbCh0aGlzKTtcclxuXHJcbiAgICB2YWx1ZXMgPSB2YWx1ZXMgfHwge307XHJcblxyXG4gICAgdGhpcy5lYXJuaW5ncyA9IG5ldyBFYXJuaW5ncyh2YWx1ZXMuZWFybmluZ3MpO1xyXG4gICAgXHJcbiAgICB2YXIgZWFybmluZ3NMaW5lID0gbmV3IExpc3RWaWV3SXRlbSgpO1xyXG4gICAgZWFybmluZ3NMaW5lLm1hcmtlckxpbmUxID0ga28uY29tcHV0ZWQoZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgdmFyIG51bSA9IG51bWVyYWwodGhpcy5jdXJyZW50QW1vdW50KCkpLmZvcm1hdCgnJDAsMCcpO1xyXG4gICAgICAgIHJldHVybiBudW07XHJcbiAgICB9LCB0aGlzLmVhcm5pbmdzKTtcclxuICAgIGVhcm5pbmdzTGluZS5jb250ZW50TGluZTEgPSBrby5jb21wdXRlZChmdW5jdGlvbigpIHtcclxuICAgICAgICByZXR1cm4gdGhpcy5jdXJyZW50Q29uY2VwdCgpO1xyXG4gICAgfSwgdGhpcy5lYXJuaW5ncyk7XHJcbiAgICBlYXJuaW5nc0xpbmUubWFya2VyTGluZTIgPSBrby5jb21wdXRlZChmdW5jdGlvbigpIHtcclxuICAgICAgICB2YXIgbnVtID0gbnVtZXJhbCh0aGlzLm5leHRBbW91bnQoKSkuZm9ybWF0KCckMCwwJyk7XHJcbiAgICAgICAgcmV0dXJuIG51bTtcclxuICAgIH0sIHRoaXMuZWFybmluZ3MpO1xyXG4gICAgZWFybmluZ3NMaW5lLmNvbnRlbnRMaW5lMiA9IGtvLmNvbXB1dGVkKGZ1bmN0aW9uKCkge1xyXG4gICAgICAgIHJldHVybiB0aGlzLm5leHRDb25jZXB0KCk7XHJcbiAgICB9LCB0aGlzLmVhcm5pbmdzKTtcclxuICAgIFxyXG5cclxuICAgIHRoaXMudGltZUJvb2tlZCA9IG5ldyBUaW1lQm9va2VkKHZhbHVlcy50aW1lQm9va2VkKTtcclxuXHJcbiAgICB2YXIgdGltZUJvb2tlZExpbmUgPSBuZXcgTGlzdFZpZXdJdGVtKCk7XHJcbiAgICB0aW1lQm9va2VkTGluZS5tYXJrZXJMaW5lMSA9IGtvLmNvbXB1dGVkKGZ1bmN0aW9uKCkge1xyXG4gICAgICAgIHZhciBudW0gPSBudW1lcmFsKHRoaXMucGVyY2VudCgpKS5mb3JtYXQoJzAlJyk7XHJcbiAgICAgICAgcmV0dXJuIG51bTtcclxuICAgIH0sIHRoaXMudGltZUJvb2tlZCk7XHJcbiAgICB0aW1lQm9va2VkTGluZS5jb250ZW50TGluZTEgPSBrby5jb21wdXRlZChmdW5jdGlvbigpIHtcclxuICAgICAgICByZXR1cm4gdGhpcy5jb25jZXB0KCk7XHJcbiAgICB9LCB0aGlzLnRpbWVCb29rZWQpO1xyXG4gICAgXHJcbiAgICBcclxuICAgIHRoaXMuaXRlbXMgPSBrby5wdXJlQ29tcHV0ZWQoZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgdmFyIGl0ZW1zID0gW107XHJcbiAgICAgICAgXHJcbiAgICAgICAgaXRlbXMucHVzaChlYXJuaW5nc0xpbmUpO1xyXG4gICAgICAgIGl0ZW1zLnB1c2godGltZUJvb2tlZExpbmUpO1xyXG5cclxuICAgICAgICByZXR1cm4gaXRlbXM7XHJcbiAgICB9LCB0aGlzKTtcclxufVxyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBQZXJmb3JtYW5jZVN1bW1hcnk7XHJcblxyXG5mdW5jdGlvbiBFYXJuaW5ncyh2YWx1ZXMpIHtcclxuXHJcbiAgICBNb2RlbCh0aGlzKTtcclxuICAgIFxyXG4gICAgdGhpcy5tb2RlbC5kZWZQcm9wZXJ0aWVzKHtcclxuICAgIFxyXG4gICAgICAgICBjdXJyZW50QW1vdW50OiAwLFxyXG4gICAgICAgICBjdXJyZW50Q29uY2VwdFRlbXBsYXRlOiAnYWxyZWFkeSBwYWlkIHRoaXMgbW9udGgnLFxyXG4gICAgICAgICBuZXh0QW1vdW50OiAwLFxyXG4gICAgICAgICBuZXh0Q29uY2VwdFRlbXBsYXRlOiAncHJvamVjdGVkIHttb250aH0gZWFybmluZ3MnXHJcblxyXG4gICAgfSwgdmFsdWVzKTtcclxuICAgIFxyXG4gICAgdGhpcy5jdXJyZW50Q29uY2VwdCA9IGtvLnB1cmVDb21wdXRlZChmdW5jdGlvbigpIHtcclxuXHJcbiAgICAgICAgdmFyIG1vbnRoID0gbW9tZW50KCkuZm9ybWF0KCdNTU1NJyk7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMuY3VycmVudENvbmNlcHRUZW1wbGF0ZSgpLnJlcGxhY2UoL1xce21vbnRoXFx9LywgbW9udGgpO1xyXG5cclxuICAgIH0sIHRoaXMpO1xyXG5cclxuICAgIHRoaXMubmV4dENvbmNlcHQgPSBrby5wdXJlQ29tcHV0ZWQoZnVuY3Rpb24oKSB7XHJcblxyXG4gICAgICAgIHZhciBtb250aCA9IG1vbWVudCgpLmFkZCgxLCAnbW9udGgnKS5mb3JtYXQoJ01NTU0nKTtcclxuICAgICAgICByZXR1cm4gdGhpcy5uZXh0Q29uY2VwdFRlbXBsYXRlKCkucmVwbGFjZSgvXFx7bW9udGhcXH0vLCBtb250aCk7XHJcblxyXG4gICAgfSwgdGhpcyk7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIFRpbWVCb29rZWQodmFsdWVzKSB7XHJcblxyXG4gICAgTW9kZWwodGhpcyk7XHJcbiAgICBcclxuICAgIHRoaXMubW9kZWwuZGVmUHJvcGVydGllcyh7XHJcbiAgICBcclxuICAgICAgICBwZXJjZW50OiAwLFxyXG4gICAgICAgIGNvbmNlcHRUZW1wbGF0ZTogJ29mIGF2YWlsYWJsZSB0aW1lIGJvb2tlZCBpbiB7bW9udGh9J1xyXG4gICAgXHJcbiAgICB9LCB2YWx1ZXMpO1xyXG4gICAgXHJcbiAgICB0aGlzLmNvbmNlcHQgPSBrby5wdXJlQ29tcHV0ZWQoZnVuY3Rpb24oKSB7XHJcblxyXG4gICAgICAgIHZhciBtb250aCA9IG1vbWVudCgpLmFkZCgxLCAnbW9udGgnKS5mb3JtYXQoJ01NTU0nKTtcclxuICAgICAgICByZXR1cm4gdGhpcy5jb25jZXB0VGVtcGxhdGUoKS5yZXBsYWNlKC9cXHttb250aFxcfS8sIG1vbnRoKTtcclxuXHJcbiAgICB9LCB0aGlzKTtcclxufVxyXG4iLCIvKiogUG9zaXRpb24gbW9kZWwuXHJcbiAqKi9cclxuJ3VzZSBzdHJpY3QnO1xyXG5cclxudmFyIGtvID0gcmVxdWlyZSgna25vY2tvdXQnKSxcclxuICAgIE1vZGVsID0gcmVxdWlyZSgnLi9Nb2RlbCcpO1xyXG5cclxuZnVuY3Rpb24gUG9zaXRpb24odmFsdWVzKSB7XHJcbiAgICBcclxuICAgIE1vZGVsKHRoaXMpO1xyXG5cclxuICAgIHRoaXMubW9kZWwuZGVmUHJvcGVydGllcyh7XHJcbiAgICAgICAgcG9zaXRpb25JRDogMCxcclxuICAgICAgICBwb3NpdGlvblNpbmd1bGFyOiAnJyxcclxuICAgICAgICBwb3NpdGlvblBsdXJhbDogJycsXHJcbiAgICAgICAgZGVzY3JpcHRpb246ICcnLFxyXG4gICAgICAgIGFjdGl2ZTogdHJ1ZVxyXG5cclxuICAgIH0sIHZhbHVlcyk7XHJcbn1cclxuXHJcbm1vZHVsZS5leHBvcnRzID0gUG9zaXRpb247XHJcbiIsIi8qKiBTZXJ2aWNlIG1vZGVsICoqL1xyXG4ndXNlIHN0cmljdCc7XHJcblxyXG52YXIga28gPSByZXF1aXJlKCdrbm9ja291dCcpLFxyXG4gICAgTW9kZWwgPSByZXF1aXJlKCcuL01vZGVsJyk7XHJcblxyXG5mdW5jdGlvbiBTZXJ2aWNlKHZhbHVlcykge1xyXG5cclxuICAgIE1vZGVsKHRoaXMpO1xyXG4gICAgXHJcbiAgICB0aGlzLm1vZGVsLmRlZlByb3BlcnRpZXMoe1xyXG4gICAgICAgIG5hbWU6ICcnLFxyXG4gICAgICAgIHByaWNlOiAwLFxyXG4gICAgICAgIGR1cmF0aW9uOiAwLCAvLyBpbiBtaW51dGVzXHJcbiAgICAgICAgaXNBZGRvbjogZmFsc2VcclxuICAgIH0sIHZhbHVlcyk7XHJcbiAgICBcclxuICAgIHRoaXMuZHVyYXRpb25UZXh0ID0ga28uY29tcHV0ZWQoZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgdmFyIG1pbnV0ZXMgPSB0aGlzLmR1cmF0aW9uKCkgfHwgMDtcclxuICAgICAgICAvLyBUT0RPOiBGb3JtYXR0aW5nLCBsb2NhbGl6YXRpb25cclxuICAgICAgICByZXR1cm4gbWludXRlcyA/IG1pbnV0ZXMgKyAnIG1pbnV0ZXMnIDogJyc7XHJcbiAgICB9LCB0aGlzKTtcclxufVxyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBTZXJ2aWNlO1xyXG4iLCIvKiogVXBjb21pbmdCb29raW5nc1N1bW1hcnkgbW9kZWwgKiovXHJcbid1c2Ugc3RyaWN0JztcclxuXHJcbnZhciBrbyA9IHJlcXVpcmUoJ2tub2Nrb3V0JyksXHJcbiAgICBNb2RlbCA9IHJlcXVpcmUoJy4vTW9kZWwnKSxcclxuICAgIEJvb2tpbmdTdW1tYXJ5ID0gcmVxdWlyZSgnLi9Cb29raW5nU3VtbWFyeScpO1xyXG5cclxuZnVuY3Rpb24gVXBjb21pbmdCb29raW5nc1N1bW1hcnkoKSB7XHJcblxyXG4gICAgTW9kZWwodGhpcyk7XHJcblxyXG4gICAgdGhpcy50b2RheSA9IG5ldyBCb29raW5nU3VtbWFyeSh7XHJcbiAgICAgICAgY29uY2VwdDogJ2xlZnQgdG9kYXknLFxyXG4gICAgICAgIHRpbWVGb3JtYXQ6ICcgW2VuZGluZyBAXSBoOm1tYSdcclxuICAgIH0pO1xyXG4gICAgdGhpcy50b21vcnJvdyA9IG5ldyBCb29raW5nU3VtbWFyeSh7XHJcbiAgICAgICAgY29uY2VwdDogJ3RvbW9ycm93JyxcclxuICAgICAgICB0aW1lRm9ybWF0OiAnIFtzdGFydGluZyBAXSBoOm1tYSdcclxuICAgIH0pO1xyXG4gICAgdGhpcy5uZXh0V2VlayA9IG5ldyBCb29raW5nU3VtbWFyeSh7XHJcbiAgICAgICAgY29uY2VwdDogJ25leHQgd2VlaydcclxuICAgIH0pO1xyXG4gICAgXHJcbiAgICB0aGlzLml0ZW1zID0ga28ucHVyZUNvbXB1dGVkKGZ1bmN0aW9uKCkge1xyXG4gICAgICAgIHZhciBpdGVtcyA9IFtdO1xyXG4gICAgICAgIFxyXG4gICAgICAgIC8vaWYgKHRoaXMudG9kYXkucXVhbnRpdHkoKSlcclxuICAgICAgICBpdGVtcy5wdXNoKHRoaXMudG9kYXkpO1xyXG4gICAgICAgIC8vaWYgKHRoaXMudG9tb3Jyb3cucXVhbnRpdHkoKSlcclxuICAgICAgICBpdGVtcy5wdXNoKHRoaXMudG9tb3Jyb3cpO1xyXG4gICAgICAgIC8vaWYgKHRoaXMubmV4dFdlZWsucXVhbnRpdHkoKSlcclxuICAgICAgICBpdGVtcy5wdXNoKHRoaXMubmV4dFdlZWspO1xyXG5cclxuICAgICAgICByZXR1cm4gaXRlbXM7XHJcbiAgICB9LCB0aGlzKTtcclxuICAgIFxyXG59XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IFVwY29taW5nQm9va2luZ3NTdW1tYXJ5O1xyXG4iLCIvKiogVXNlciBtb2RlbCAqKi9cclxuJ3VzZSBzdHJpY3QnO1xyXG5cclxudmFyIGtvID0gcmVxdWlyZSgna25vY2tvdXQnKSxcclxuICAgIE1vZGVsID0gcmVxdWlyZSgnLi9Nb2RlbCcpO1xyXG5cclxuLy8gRW51bSBVc2VyVHlwZVxyXG52YXIgVXNlclR5cGUgPSB7XHJcbiAgICBOb25lOiAwLFxyXG4gICAgQW5vbnltb3VzOiAxLFxyXG4gICAgQ3VzdG9tZXI6IDIsXHJcbiAgICBQcm92aWRlcjogNCxcclxuICAgIEFkbWluOiA4LFxyXG4gICAgTG9nZ2VkVXNlcjogMTQsXHJcbiAgICBVc2VyOiAxNSxcclxuICAgIFN5c3RlbTogMTZcclxufTtcclxuXHJcbmZ1bmN0aW9uIFVzZXIodmFsdWVzKSB7XHJcbiAgICBcclxuICAgIE1vZGVsKHRoaXMpO1xyXG4gICAgXHJcbiAgICB0aGlzLm1vZGVsLmRlZlByb3BlcnRpZXMoe1xyXG4gICAgICAgIHVzZXJJRDogMCxcclxuICAgICAgICBlbWFpbDogJycsXHJcbiAgICAgICAgZmlyc3ROYW1lOiAnJyxcclxuICAgICAgICBtaWRkbGVJbjogJycsXHJcbiAgICAgICAgbGFzdE5hbWU6ICcnLFxyXG4gICAgICAgIHNlY29uZExhc3ROYW1lOiAnJyxcclxuICAgICAgICBuaWNrTmFtZTogbnVsbCxcclxuICAgICAgICBwdWJsaWNCaW86IG51bGwsXHJcbiAgICAgICAgZ2VuZGVySUQ6IDAsXHJcbiAgICAgICAgcHJlZmVycmVkTGFuZ3VhZ2VJRDogbnVsbCxcclxuICAgICAgICBwcmVmZXJyZWRDb3VudHJ5SUQ6IG51bGwsXHJcbiAgICAgICAgaXNQcm92aWRlcjogZmFsc2UsXHJcbiAgICAgICAgaXNDdXN0b21lcjogZmFsc2UsXHJcbiAgICAgICAgaXNNZW1iZXI6IGZhbHNlLFxyXG4gICAgICAgIGlzQWRtaW46IGZhbHNlLFxyXG4gICAgICAgIG1vYmlsZVBob25lOiBudWxsLFxyXG4gICAgICAgIGFsdGVybmF0ZVBob25lOiBudWxsLFxyXG4gICAgICAgIHByb3ZpZGVyUHJvZmlsZVVSTDogbnVsbCxcclxuICAgICAgICBwcm92aWRlcldlYnNpdGVVUkw6IG51bGwsXHJcbiAgICAgICAgY3JlYXRlZERhdGU6IG51bGwsXHJcbiAgICAgICAgdXBkYXRlZERhdGU6IG51bGwsXHJcbiAgICAgICAgbW9kaWZpZWRCeTogbnVsbCxcclxuICAgICAgICBhY3RpdmU6IGZhbHNlLFxyXG4gICAgICAgIGFjY291bnRTdGF0dXNJRDogMCxcclxuICAgICAgICBib29rQ29kZTogbnVsbCxcclxuICAgICAgICBvbmJvYXJkaW5nU3RlcDogbnVsbCxcclxuICAgICAgICBidXNpbmVzc05hbWU6IG51bGwsXHJcbiAgICAgICAgYWx0ZXJuYXRlRW1haWw6IG51bGxcclxuICAgIH0sIHZhbHVlcyk7XHJcblxyXG4gICAgdGhpcy5mdWxsTmFtZSA9IGtvLmNvbXB1dGVkKGZ1bmN0aW9uKCkge1xyXG4gICAgICAgIHJldHVybiAodGhpcy5maXJzdE5hbWUoKSArICcgJyArIHRoaXMubGFzdE5hbWUoKSk7XHJcbiAgICB9LCB0aGlzKTtcclxuICAgIFxyXG4gICAgdGhpcy51c2VyVHlwZSA9IGtvLnB1cmVDb21wdXRlZCh7XHJcbiAgICAgICAgcmVhZDogZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgICAgIHZhciBjID0gdGhpcy5pc0N1c3RvbWVyKCksXHJcbiAgICAgICAgICAgICAgICBwID0gdGhpcy5pc1Byb3ZpZGVyKCksXHJcbiAgICAgICAgICAgICAgICBhID0gdGhpcy5pc0FkbWluKCk7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICB2YXIgdXNlclR5cGUgPSAwO1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgaWYgKHRoaXMuaXNBbm9ueW1vdXMoKSkge1xyXG4gICAgICAgICAgICAgICAgdXNlclR5cGUgPSB1c2VyVHlwZSB8IFVzZXJUeXBlLkFub255bW91cztcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBpZiAoYylcclxuICAgICAgICAgICAgICAgIHVzZXJUeXBlID0gdXNlclR5cGUgfCBVc2VyVHlwZS5DdXN0b21lcjtcclxuICAgICAgICAgICAgaWYgKHApXHJcbiAgICAgICAgICAgICAgICB1c2VyVHlwZSA9IHVzZXJUeXBlIHwgVXNlclR5cGUuUHJvdmlkZXI7XHJcbiAgICAgICAgICAgIGlmIChhKVxyXG4gICAgICAgICAgICAgICAgdXNlclR5cGUgPSB1c2VyVHlwZSB8IFVzZXJUeXBlLkFkbWluO1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgcmV0dXJuIHVzZXJUeXBlO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgLyogTk9URTogTm90IHJlcXVpcmUgZm9yIG5vdzpcclxuICAgICAgICB3cml0ZTogZnVuY3Rpb24odikge1xyXG4gICAgICAgIH0sKi9cclxuICAgICAgICBvd25lcjogdGhpc1xyXG4gICAgfSk7XHJcbiAgICBcclxuICAgIHRoaXMuaXNBbm9ueW1vdXMgPSBrby5wdXJlQ29tcHV0ZWQoZnVuY3Rpb24oKXtcclxuICAgICAgICByZXR1cm4gdGhpcy51c2VySUQoKSA8IDE7XHJcbiAgICB9LCB0aGlzKTtcclxuICAgIFxyXG4gICAgLyoqXHJcbiAgICAgICAgSXQgbWF0Y2hlcyBhIFVzZXJUeXBlIGZyb20gdGhlIGVudW1lcmF0aW9uP1xyXG4gICAgKiovXHJcbiAgICB0aGlzLmlzVXNlclR5cGUgPSBmdW5jdGlvbiBpc1VzZXJUeXBlKHR5cGUpIHtcclxuICAgICAgICByZXR1cm4gKHRoaXMudXNlclR5cGUoKSAmIHR5cGUpO1xyXG4gICAgfS5iaW5kKHRoaXMpO1xyXG59XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IFVzZXI7XHJcblxyXG5Vc2VyLlVzZXJUeXBlID0gVXNlclR5cGU7XHJcblxyXG4vKiBDcmVhdGludCBhbiBhbm9ueW1vdXMgdXNlciB3aXRoIHNvbWUgcHJlc3NldHMgKi9cclxuVXNlci5uZXdBbm9ueW1vdXMgPSBmdW5jdGlvbiBuZXdBbm9ueW1vdXMoKSB7XHJcbiAgICByZXR1cm4gbmV3IFVzZXIoe1xyXG4gICAgICAgIHVzZXJJRDogMCxcclxuICAgICAgICBlbWFpbDogJycsXHJcbiAgICAgICAgZmlyc3ROYW1lOiAnJyxcclxuICAgICAgICBvbmJvYXJkaW5nU3RlcDogbnVsbFxyXG4gICAgfSk7XHJcbn07XHJcbiIsIi8qKiBDYWxlbmRhciBBcHBvaW50bWVudHMgdGVzdCBkYXRhICoqL1xyXG52YXIgQXBwb2ludG1lbnQgPSByZXF1aXJlKCcuLi9tb2RlbHMvQXBwb2ludG1lbnQnKTtcclxudmFyIHRlc3RMb2NhdGlvbnMgPSByZXF1aXJlKCcuL2xvY2F0aW9ucycpLmxvY2F0aW9ucztcclxudmFyIHRlc3RTZXJ2aWNlcyA9IHJlcXVpcmUoJy4vc2VydmljZXMnKS5zZXJ2aWNlcztcclxudmFyIGtvID0gcmVxdWlyZSgna25vY2tvdXQnKTtcclxudmFyIG1vbWVudCA9IHJlcXVpcmUoJ21vbWVudCcpO1xyXG5cclxudmFyIHRvZGF5ID0gbW9tZW50KCksXHJcbiAgICB0b21vcnJvdyA9IG1vbWVudCgpLmFkZCgxLCAnZGF5cycpLFxyXG4gICAgdG9tb3Jyb3cxMCA9IHRvbW9ycm93LmNsb25lKCkuaG91cnMoMTApLm1pbnV0ZXMoMCkuc2Vjb25kcygwKSxcclxuICAgIHRvbW9ycm93MTYgPSB0b21vcnJvdy5jbG9uZSgpLmhvdXJzKDE2KS5taW51dGVzKDMwKS5zZWNvbmRzKDApO1xyXG4gICAgXHJcbnZhciB0ZXN0RGF0YSA9IFtcclxuICAgIG5ldyBBcHBvaW50bWVudCh7XHJcbiAgICAgICAgaWQ6IDEsXHJcbiAgICAgICAgc3RhcnRUaW1lOiB0b21vcnJvdzEwLFxyXG4gICAgICAgIGVuZFRpbWU6IHRvbW9ycm93MTYsXHJcbiAgICAgICAgc3VtbWFyeTogJ01hc3NhZ2UgVGhlcmFwaXN0IEJvb2tpbmcnLFxyXG4gICAgICAgIC8vcHJpY2luZ1N1bW1hcnk6ICdEZWVwIFRpc3N1ZSBNYXNzYWdlIDEyMG0gcGx1cyAyIG1vcmUnLFxyXG4gICAgICAgIHNlcnZpY2VzOiB0ZXN0U2VydmljZXMsXHJcbiAgICAgICAgcHRvdGFsUHJpY2U6IDk1LjAsXHJcbiAgICAgICAgbG9jYXRpb246IGtvLnRvSlModGVzdExvY2F0aW9uc1swXSksXHJcbiAgICAgICAgcHJlTm90ZXNUb0NsaWVudDogJ0xvb2tpbmcgZm9yd2FyZCB0byBzZWVpbmcgdGhlIG5ldyBjb2xvcicsXHJcbiAgICAgICAgcHJlTm90ZXNUb1NlbGY6ICdBc2sgaGltIGFib3V0IGhpcyBuZXcgY29sb3InLFxyXG4gICAgICAgIGNsaWVudDoge1xyXG4gICAgICAgICAgICBmaXJzdE5hbWU6ICdKb3NodWEnLFxyXG4gICAgICAgICAgICBsYXN0TmFtZTogJ0RhbmllbHNvbidcclxuICAgICAgICB9XHJcbiAgICB9KSxcclxuICAgIG5ldyBBcHBvaW50bWVudCh7XHJcbiAgICAgICAgaWQ6IDIsXHJcbiAgICAgICAgc3RhcnRUaW1lOiBuZXcgRGF0ZSgyMDE0LCAxMSwgMSwgMTMsIDAsIDApLFxyXG4gICAgICAgIGVuZFRpbWU6IG5ldyBEYXRlKDIwMTQsIDExLCAxLCAxMywgNTAsIDApLFxyXG4gICAgICAgIHN1bW1hcnk6ICdNYXNzYWdlIFRoZXJhcGlzdCBCb29raW5nJyxcclxuICAgICAgICAvL3ByaWNpbmdTdW1tYXJ5OiAnQW5vdGhlciBNYXNzYWdlIDUwbScsXHJcbiAgICAgICAgc2VydmljZXM6IFt0ZXN0U2VydmljZXNbMF1dLFxyXG4gICAgICAgIHB0b3RhbFByaWNlOiA5NS4wLFxyXG4gICAgICAgIGxvY2F0aW9uOiBrby50b0pTKHRlc3RMb2NhdGlvbnNbMV0pLFxyXG4gICAgICAgIHByZU5vdGVzVG9DbGllbnQ6ICdTb21ldGhpbmcgZWxzZScsXHJcbiAgICAgICAgcHJlTm90ZXNUb1NlbGY6ICdSZW1lbWJlciB0aGF0IHRoaW5nJyxcclxuICAgICAgICBjbGllbnQ6IHtcclxuICAgICAgICAgICAgZmlyc3ROYW1lOiAnSm9zaHVhJyxcclxuICAgICAgICAgICAgbGFzdE5hbWU6ICdEYW5pZWxzb24nXHJcbiAgICAgICAgfVxyXG4gICAgfSksXHJcbiAgICBuZXcgQXBwb2ludG1lbnQoe1xyXG4gICAgICAgIGlkOiAzLFxyXG4gICAgICAgIHN0YXJ0VGltZTogbmV3IERhdGUoMjAxNCwgMTEsIDEsIDE2LCAwLCAwKSxcclxuICAgICAgICBlbmRUaW1lOiBuZXcgRGF0ZSgyMDE0LCAxMSwgMSwgMTgsIDAsIDApLFxyXG4gICAgICAgIHN1bW1hcnk6ICdNYXNzYWdlIFRoZXJhcGlzdCBCb29raW5nJyxcclxuICAgICAgICAvL3ByaWNpbmdTdW1tYXJ5OiAnVGlzc3VlIE1hc3NhZ2UgMTIwbScsXHJcbiAgICAgICAgc2VydmljZXM6IFt0ZXN0U2VydmljZXNbMV1dLFxyXG4gICAgICAgIHB0b3RhbFByaWNlOiA5NS4wLFxyXG4gICAgICAgIGxvY2F0aW9uOiBrby50b0pTKHRlc3RMb2NhdGlvbnNbMl0pLFxyXG4gICAgICAgIHByZU5vdGVzVG9DbGllbnQ6ICcnLFxyXG4gICAgICAgIHByZU5vdGVzVG9TZWxmOiAnQXNrIGhpbSBhYm91dCB0aGUgZm9yZ290dGVuIG5vdGVzJyxcclxuICAgICAgICBjbGllbnQ6IHtcclxuICAgICAgICAgICAgZmlyc3ROYW1lOiAnSm9zaHVhJyxcclxuICAgICAgICAgICAgbGFzdE5hbWU6ICdEYW5pZWxzb24nXHJcbiAgICAgICAgfVxyXG4gICAgfSksXHJcbl07XHJcblxyXG5leHBvcnRzLmFwcG9pbnRtZW50cyA9IHRlc3REYXRhO1xyXG4iLCIvKiogQ2FsZW5kYXIgU2xvdHMgdGVzdCBkYXRhICoqL1xyXG52YXIgQ2FsZW5kYXJTbG90ID0gcmVxdWlyZSgnLi4vbW9kZWxzL0NhbGVuZGFyU2xvdCcpO1xyXG5cclxudmFyIFRpbWUgPSByZXF1aXJlKCcuLi91dGlscy9UaW1lJyk7XHJcbnZhciBtb21lbnQgPSByZXF1aXJlKCdtb21lbnQnKTtcclxuXHJcbnZhciB0b2RheSA9IG5ldyBEYXRlKCksXHJcbiAgICB0b21vcnJvdyA9IG5ldyBEYXRlKCk7XHJcbnRvbW9ycm93LnNldERhdGUodG9tb3Jyb3cuZ2V0RGF0ZSgpICsgMSk7XHJcblxyXG52YXIgc3RvZGF5ID0gbW9tZW50KHRvZGF5KS5mb3JtYXQoJ1lZWVktTU0tREQnKSxcclxuICAgIHN0b21vcnJvdyA9IG1vbWVudCh0b21vcnJvdykuZm9ybWF0KCdZWVlZLU1NLUREJyk7XHJcblxyXG52YXIgdGVzdERhdGExID0gW1xyXG4gICAgbmV3IENhbGVuZGFyU2xvdCh7XHJcbiAgICAgICAgc3RhcnRUaW1lOiBuZXcgVGltZSh0b2RheSwgMCwgMCwgMCksXHJcbiAgICAgICAgZW5kVGltZTogbmV3IFRpbWUodG9kYXksIDEyLCAwLCAwKSxcclxuICAgICAgICBcclxuICAgICAgICBzdWJqZWN0OiAnRnJlZScsXHJcbiAgICAgICAgZGVzY3JpcHRpb246IG51bGwsXHJcbiAgICAgICAgbGluazogJyMhYXBwb2ludG1lbnQvMCcsXHJcblxyXG4gICAgICAgIGFjdGlvbkljb246ICdnbHlwaGljb24gZ2x5cGhpY29uLXBsdXMnLFxyXG4gICAgICAgIGFjdGlvblRleHQ6IG51bGwsXHJcblxyXG4gICAgICAgIGNsYXNzTmFtZXM6ICdMaXN0Vmlldy1pdGVtLS10YWctc3VjY2VzcydcclxuICAgIH0pLFxyXG4gICAgbmV3IENhbGVuZGFyU2xvdCh7XHJcbiAgICAgICAgc3RhcnRUaW1lOiBuZXcgVGltZSh0b2RheSwgMTIsIDAsIDApLFxyXG4gICAgICAgIGVuZFRpbWU6IG5ldyBUaW1lKHRvZGF5LCAxMywgMCwgMCksXHJcbiAgICAgICAgXHJcbiAgICAgICAgc3ViamVjdDogJ0pvc2ggRGFuaWVsc29uJyxcclxuICAgICAgICBkZXNjcmlwdGlvbjogJ0RlZXAgVGlzc3VlIE1hc3NhZ2UnLFxyXG4gICAgICAgIGxpbms6ICcjIWFwcG9pbnRtZW50LzMnLFxyXG5cclxuICAgICAgICBhY3Rpb25JY29uOiAnZ2x5cGhpY29uIGdseXBoaWNvbi1wbHVzJyxcclxuICAgICAgICBhY3Rpb25UZXh0OiBudWxsLFxyXG5cclxuICAgICAgICBjbGFzc05hbWVzOiBudWxsXHJcbiAgICB9KSxcclxuICAgIG5ldyBDYWxlbmRhclNsb3Qoe1xyXG4gICAgICAgIHN0YXJ0VGltZTogbmV3IFRpbWUodG9kYXksIDEzLCAwLCAwKSxcclxuICAgICAgICBlbmRUaW1lOiBuZXcgVGltZSh0b2RheSwgMTUsIDAsIDApLFxyXG5cclxuICAgICAgICBzdWJqZWN0OiAnRG8gdGhhdCBpbXBvcnRhbnQgdGhpbmcnLFxyXG4gICAgICAgIGRlc2NyaXB0aW9uOiBudWxsLFxyXG4gICAgICAgIGxpbms6ICcjIWV2ZW50LzgnLFxyXG5cclxuICAgICAgICBhY3Rpb25JY29uOiAnZ2x5cGhpY29uIGdseXBoaWNvbi1uZXctd2luZG93JyxcclxuICAgICAgICBhY3Rpb25UZXh0OiBudWxsLFxyXG5cclxuICAgICAgICBjbGFzc05hbWVzOiBudWxsXHJcbiAgICB9KSxcclxuICAgIG5ldyBDYWxlbmRhclNsb3Qoe1xyXG4gICAgICAgIHN0YXJ0VGltZTogbmV3IFRpbWUodG9kYXksIDE1LCAwLCAwKSxcclxuICAgICAgICBlbmRUaW1lOiBuZXcgVGltZSh0b2RheSwgMTYsIDAsIDApLFxyXG4gICAgICAgIFxyXG4gICAgICAgIHN1YmplY3Q6ICdJYWdvIExvcmVuem8nLFxyXG4gICAgICAgIGRlc2NyaXB0aW9uOiAnRGVlcCBUaXNzdWUgTWFzc2FnZSBMb25nIE5hbWUnLFxyXG4gICAgICAgIGxpbms6ICcjIWFwcG9pbnRtZW50LzUnLFxyXG5cclxuICAgICAgICBhY3Rpb25JY29uOiBudWxsLFxyXG4gICAgICAgIGFjdGlvblRleHQ6ICckMTU5LjkwJyxcclxuXHJcbiAgICAgICAgY2xhc3NOYW1lczogbnVsbFxyXG4gICAgfSksXHJcbiAgICBuZXcgQ2FsZW5kYXJTbG90KHtcclxuICAgICAgICBzdGFydFRpbWU6IG5ldyBUaW1lKHRvZGF5LCAxNiwgMCwgMCksXHJcbiAgICAgICAgZW5kVGltZTogbmV3IFRpbWUodG9kYXksIDAsIDAsIDApLFxyXG4gICAgICAgIFxyXG4gICAgICAgIHN1YmplY3Q6ICdGcmVlJyxcclxuICAgICAgICBkZXNjcmlwdGlvbjogbnVsbCxcclxuICAgICAgICBsaW5rOiAnIyFhcHBvaW50bWVudC8wJyxcclxuXHJcbiAgICAgICAgYWN0aW9uSWNvbjogJ2dseXBoaWNvbiBnbHlwaGljb24tcGx1cycsXHJcbiAgICAgICAgYWN0aW9uVGV4dDogbnVsbCxcclxuXHJcbiAgICAgICAgY2xhc3NOYW1lczogJ0xpc3RWaWV3LWl0ZW0tLXRhZy1zdWNjZXNzJ1xyXG4gICAgfSlcclxuXTtcclxudmFyIHRlc3REYXRhMiA9IFtcclxuICAgIG5ldyBDYWxlbmRhclNsb3Qoe1xyXG4gICAgICAgIHN0YXJ0VGltZTogbmV3IFRpbWUodG9tb3Jyb3csIDAsIDAsIDApLFxyXG4gICAgICAgIGVuZFRpbWU6IG5ldyBUaW1lKHRvbW9ycm93LCA5LCAwLCAwKSxcclxuICAgICAgICBcclxuICAgICAgICBzdWJqZWN0OiAnRnJlZScsXHJcbiAgICAgICAgZGVzY3JpcHRpb246IG51bGwsXHJcbiAgICAgICAgbGluazogJyMhYXBwb2ludG1lbnQvMCcsXHJcblxyXG4gICAgICAgIGFjdGlvbkljb246ICdnbHlwaGljb24gZ2x5cGhpY29uLXBsdXMnLFxyXG4gICAgICAgIGFjdGlvblRleHQ6IG51bGwsXHJcblxyXG4gICAgICAgIGNsYXNzTmFtZXM6ICdMaXN0Vmlldy1pdGVtLS10YWctc3VjY2VzcydcclxuICAgIH0pLFxyXG4gICAgbmV3IENhbGVuZGFyU2xvdCh7XHJcbiAgICAgICAgc3RhcnRUaW1lOiBuZXcgVGltZSh0b21vcnJvdywgOSwgMCwgMCksXHJcbiAgICAgICAgZW5kVGltZTogbmV3IFRpbWUodG9tb3Jyb3csIDEwLCAwLCAwKSxcclxuICAgICAgICBcclxuICAgICAgICBzdWJqZWN0OiAnSmFyZW4gRnJlZWx5JyxcclxuICAgICAgICBkZXNjcmlwdGlvbjogJ0RlZXAgVGlzc3VlIE1hc3NhZ2UgTG9uZyBOYW1lJyxcclxuICAgICAgICBsaW5rOiAnIyFhcHBvaW50bWVudC8xJyxcclxuXHJcbiAgICAgICAgYWN0aW9uSWNvbjogbnVsbCxcclxuICAgICAgICBhY3Rpb25UZXh0OiAnJDU5LjkwJyxcclxuXHJcbiAgICAgICAgY2xhc3NOYW1lczogbnVsbFxyXG4gICAgfSksXHJcbiAgICBuZXcgQ2FsZW5kYXJTbG90KHtcclxuICAgICAgICBzdGFydFRpbWU6IG5ldyBUaW1lKHRvbW9ycm93LCAxMCwgMCwgMCksXHJcbiAgICAgICAgZW5kVGltZTogbmV3IFRpbWUodG9tb3Jyb3csIDExLCAwLCAwKSxcclxuICAgICAgICBcclxuICAgICAgICBzdWJqZWN0OiAnRnJlZScsXHJcbiAgICAgICAgZGVzY3JpcHRpb246IG51bGwsXHJcbiAgICAgICAgbGluazogJyMhYXBwb2ludG1lbnQvMCcsXHJcblxyXG4gICAgICAgIGFjdGlvbkljb246ICdnbHlwaGljb24gZ2x5cGhpY29uLXBsdXMnLFxyXG4gICAgICAgIGFjdGlvblRleHQ6IG51bGwsXHJcblxyXG4gICAgICAgIGNsYXNzTmFtZXM6ICdMaXN0Vmlldy1pdGVtLS10YWctc3VjY2VzcydcclxuICAgIH0pLFxyXG4gICAgbmV3IENhbGVuZGFyU2xvdCh7XHJcbiAgICAgICAgc3RhcnRUaW1lOiBuZXcgVGltZSh0b21vcnJvdywgMTEsIDAsIDApLFxyXG4gICAgICAgIGVuZFRpbWU6IG5ldyBUaW1lKHRvbW9ycm93LCAxMiwgNDUsIDApLFxyXG4gICAgICAgIFxyXG4gICAgICAgIHN1YmplY3Q6ICdDT05GSVJNLVN1c2FuIERlZScsXHJcbiAgICAgICAgZGVzY3JpcHRpb246ICdEZWVwIFRpc3N1ZSBNYXNzYWdlJyxcclxuICAgICAgICBsaW5rOiAnIyFhcHBvaW50bWVudC8yJyxcclxuXHJcbiAgICAgICAgYWN0aW9uSWNvbjogbnVsbCxcclxuICAgICAgICBhY3Rpb25UZXh0OiAnJDcwJyxcclxuXHJcbiAgICAgICAgY2xhc3NOYW1lczogJ0xpc3RWaWV3LWl0ZW0tLXRhZy13YXJuaW5nJ1xyXG4gICAgfSksXHJcbiAgICBuZXcgQ2FsZW5kYXJTbG90KHtcclxuICAgICAgICBzdGFydFRpbWU6IG5ldyBUaW1lKHRvbW9ycm93LCAxMiwgNDUsIDApLFxyXG4gICAgICAgIGVuZFRpbWU6IG5ldyBUaW1lKHRvbW9ycm93LCAxNiwgMCwgMCksXHJcbiAgICAgICAgXHJcbiAgICAgICAgc3ViamVjdDogJ0ZyZWUnLFxyXG4gICAgICAgIGRlc2NyaXB0aW9uOiBudWxsLFxyXG4gICAgICAgIGxpbms6ICcjIWFwcG9pbnRtZW50LzAnLFxyXG5cclxuICAgICAgICBhY3Rpb25JY29uOiAnZ2x5cGhpY29uIGdseXBoaWNvbi1wbHVzJyxcclxuICAgICAgICBhY3Rpb25UZXh0OiBudWxsLFxyXG5cclxuICAgICAgICBjbGFzc05hbWVzOiAnTGlzdFZpZXctaXRlbS0tdGFnLXN1Y2Nlc3MnXHJcbiAgICB9KSxcclxuICAgIG5ldyBDYWxlbmRhclNsb3Qoe1xyXG4gICAgICAgIHN0YXJ0VGltZTogbmV3IFRpbWUodG9tb3Jyb3csIDE2LCAwLCAwKSxcclxuICAgICAgICBlbmRUaW1lOiBuZXcgVGltZSh0b21vcnJvdywgMTcsIDE1LCAwKSxcclxuICAgICAgICBcclxuICAgICAgICBzdWJqZWN0OiAnU3VzYW4gRGVlJyxcclxuICAgICAgICBkZXNjcmlwdGlvbjogJ0RlZXAgVGlzc3VlIE1hc3NhZ2UnLFxyXG4gICAgICAgIGxpbms6ICcjIWFwcG9pbnRtZW50LzMnLFxyXG5cclxuICAgICAgICBhY3Rpb25JY29uOiAnZ2x5cGhpY29uIGdseXBoaWNvbi1wbHVzJyxcclxuICAgICAgICBhY3Rpb25UZXh0OiBudWxsLFxyXG5cclxuICAgICAgICBjbGFzc05hbWVzOiBudWxsXHJcbiAgICB9KSxcclxuICAgIG5ldyBDYWxlbmRhclNsb3Qoe1xyXG4gICAgICAgIHN0YXJ0VGltZTogbmV3IFRpbWUodG9tb3Jyb3csIDE3LCAxNSwgMCksXHJcbiAgICAgICAgZW5kVGltZTogbmV3IFRpbWUodG9tb3Jyb3csIDE4LCAzMCwgMCksXHJcbiAgICAgICAgXHJcbiAgICAgICAgc3ViamVjdDogJ0RlbnRpc3QgYXBwb2ludG1lbnQnLFxyXG4gICAgICAgIGRlc2NyaXB0aW9uOiBudWxsLFxyXG4gICAgICAgIGxpbms6ICcjIWV2ZW50LzQnLFxyXG5cclxuICAgICAgICBhY3Rpb25JY29uOiAnZ2x5cGhpY29uIGdseXBoaWNvbi1uZXctd2luZG93JyxcclxuICAgICAgICBhY3Rpb25UZXh0OiBudWxsLFxyXG5cclxuICAgICAgICBjbGFzc05hbWVzOiBudWxsXHJcbiAgICB9KSxcclxuICAgIG5ldyBDYWxlbmRhclNsb3Qoe1xyXG4gICAgICAgIHN0YXJ0VGltZTogbmV3IFRpbWUodG9tb3Jyb3csIDE4LCAzMCwgMCksXHJcbiAgICAgICAgZW5kVGltZTogbmV3IFRpbWUodG9tb3Jyb3csIDE5LCAzMCwgMCksXHJcbiAgICAgICAgXHJcbiAgICAgICAgc3ViamVjdDogJ1N1c2FuIERlZScsXHJcbiAgICAgICAgZGVzY3JpcHRpb246ICdEZWVwIFRpc3N1ZSBNYXNzYWdlIExvbmcgTmFtZScsXHJcbiAgICAgICAgbGluazogJyMhYXBwb2ludG1lbnQvNScsXHJcblxyXG4gICAgICAgIGFjdGlvbkljb246IG51bGwsXHJcbiAgICAgICAgYWN0aW9uVGV4dDogJyQxNTkuOTAnLFxyXG5cclxuICAgICAgICBjbGFzc05hbWVzOiBudWxsXHJcbiAgICB9KSxcclxuICAgIG5ldyBDYWxlbmRhclNsb3Qoe1xyXG4gICAgICAgIHN0YXJ0VGltZTogbmV3IFRpbWUodG9tb3Jyb3csIDE5LCAzMCwgMCksXHJcbiAgICAgICAgZW5kVGltZTogbmV3IFRpbWUodG9tb3Jyb3csIDIzLCAwLCAwKSxcclxuICAgICAgICBcclxuICAgICAgICBzdWJqZWN0OiAnRnJlZScsXHJcbiAgICAgICAgZGVzY3JpcHRpb246IG51bGwsXHJcbiAgICAgICAgbGluazogJyMhYXBwb2ludG1lbnQvMCcsXHJcblxyXG4gICAgICAgIGFjdGlvbkljb246ICdnbHlwaGljb24gZ2x5cGhpY29uLXBsdXMnLFxyXG4gICAgICAgIGFjdGlvblRleHQ6IG51bGwsXHJcblxyXG4gICAgICAgIGNsYXNzTmFtZXM6ICdMaXN0Vmlldy1pdGVtLS10YWctc3VjY2VzcydcclxuICAgIH0pLFxyXG4gICAgbmV3IENhbGVuZGFyU2xvdCh7XHJcbiAgICAgICAgc3RhcnRUaW1lOiBuZXcgVGltZSh0b21vcnJvdywgMjMsIDAsIDApLFxyXG4gICAgICAgIGVuZFRpbWU6IG5ldyBUaW1lKHRvbW9ycm93LCAwLCAwLCAwKSxcclxuXHJcbiAgICAgICAgc3ViamVjdDogJ0phcmVuIEZyZWVseScsXHJcbiAgICAgICAgZGVzY3JpcHRpb246ICdEZWVwIFRpc3N1ZSBNYXNzYWdlJyxcclxuICAgICAgICBsaW5rOiAnIyFhcHBvaW50bWVudC82JyxcclxuXHJcbiAgICAgICAgYWN0aW9uSWNvbjogbnVsbCxcclxuICAgICAgICBhY3Rpb25UZXh0OiAnJDgwJyxcclxuXHJcbiAgICAgICAgY2xhc3NOYW1lczogbnVsbFxyXG4gICAgfSlcclxuXTtcclxudmFyIHRlc3REYXRhRnJlZSA9IFtcclxuICAgIG5ldyBDYWxlbmRhclNsb3Qoe1xyXG4gICAgICAgIHN0YXJ0VGltZTogbmV3IFRpbWUodG9tb3Jyb3csIDAsIDAsIDApLFxyXG4gICAgICAgIGVuZFRpbWU6IG5ldyBUaW1lKHRvbW9ycm93LCAwLCAwLCAwKSxcclxuXHJcbiAgICAgICAgc3ViamVjdDogJ0ZyZWUnLFxyXG4gICAgICAgIGRlc2NyaXB0aW9uOiBudWxsLFxyXG4gICAgICAgIGxpbms6ICcjIWFwcG9pbnRtZW50LzAnLFxyXG5cclxuICAgICAgICBhY3Rpb25JY29uOiAnZ2x5cGhpY29uIGdseXBoaWNvbi1wbHVzJyxcclxuICAgICAgICBhY3Rpb25UZXh0OiBudWxsLFxyXG5cclxuICAgICAgICBjbGFzc05hbWVzOiAnTGlzdFZpZXctaXRlbS0tdGFnLXN1Y2Nlc3MnXHJcbiAgICB9KVxyXG5dO1xyXG5cclxudmFyIHRlc3REYXRhID0ge1xyXG4gICAgJ2RlZmF1bHQnOiB0ZXN0RGF0YUZyZWVcclxufTtcclxudGVzdERhdGFbc3RvZGF5XSA9IHRlc3REYXRhMTtcclxudGVzdERhdGFbc3RvbW9ycm93XSA9IHRlc3REYXRhMjtcclxuXHJcbmV4cG9ydHMuY2FsZW5kYXIgPSB0ZXN0RGF0YTtcclxuIiwiLyoqIENsaWVudHMgdGVzdCBkYXRhICoqL1xyXG52YXIgQ2xpZW50ID0gcmVxdWlyZSgnLi4vbW9kZWxzL0NsaWVudCcpO1xyXG5cclxudmFyIHRlc3REYXRhID0gW1xyXG4gICAgbmV3IENsaWVudCAoe1xyXG4gICAgICAgIGZpcnN0TmFtZTogJ0pvc2h1YScsXHJcbiAgICAgICAgbGFzdE5hbWU6ICdEYW5pZWxzb24nXHJcbiAgICB9KSxcclxuICAgIG5ldyBDbGllbnQoe1xyXG4gICAgICAgIGZpcnN0TmFtZTogJ0lhZ28nLFxyXG4gICAgICAgIGxhc3ROYW1lOiAnTG9yZW56bydcclxuICAgIH0pLFxyXG4gICAgbmV3IENsaWVudCh7XHJcbiAgICAgICAgZmlyc3ROYW1lOiAnRmVybmFuZG8nLFxyXG4gICAgICAgIGxhc3ROYW1lOiAnR2FnbydcclxuICAgIH0pLFxyXG4gICAgbmV3IENsaWVudCh7XHJcbiAgICAgICAgZmlyc3ROYW1lOiAnQWRhbScsXHJcbiAgICAgICAgbGFzdE5hbWU6ICdGaW5jaCdcclxuICAgIH0pLFxyXG4gICAgbmV3IENsaWVudCh7XHJcbiAgICAgICAgZmlyc3ROYW1lOiAnQWxhbicsXHJcbiAgICAgICAgbGFzdE5hbWU6ICdGZXJndXNvbidcclxuICAgIH0pLFxyXG4gICAgbmV3IENsaWVudCh7XHJcbiAgICAgICAgZmlyc3ROYW1lOiAnQWxleCcsXHJcbiAgICAgICAgbGFzdE5hbWU6ICdQZW5hJ1xyXG4gICAgfSksXHJcbiAgICBuZXcgQ2xpZW50KHtcclxuICAgICAgICBmaXJzdE5hbWU6ICdBbGV4aXMnLFxyXG4gICAgICAgIGxhc3ROYW1lOiAnUGVhY2EnXHJcbiAgICB9KSxcclxuICAgIG5ldyBDbGllbnQoe1xyXG4gICAgICAgIGZpcnN0TmFtZTogJ0FydGh1cicsXHJcbiAgICAgICAgbGFzdE5hbWU6ICdNaWxsZXInXHJcbiAgICB9KVxyXG5dO1xyXG5cclxuZXhwb3J0cy5jbGllbnRzID0gdGVzdERhdGE7XHJcbiIsIi8qKiBMb2NhdGlvbnMgdGVzdCBkYXRhICoqL1xyXG52YXIgTG9jYXRpb24gPSByZXF1aXJlKCcuLi9tb2RlbHMvTG9jYXRpb24nKTtcclxuXHJcbnZhciB0ZXN0RGF0YSA9IFtcclxuICAgIG5ldyBMb2NhdGlvbiAoe1xyXG4gICAgICAgIGxvY2F0aW9uSUQ6IDEsXHJcbiAgICAgICAgbmFtZTogJ0FjdHZpU3BhY2UnLFxyXG4gICAgICAgIGFkZHJlc3NMaW5lMTogJzMxNTAgMTh0aCBTdHJlZXQnLFxyXG4gICAgICAgIHBvc3RhbENvZGU6IDkwMDAxLFxyXG4gICAgICAgIGlzU2VydmljZVJhZGl1czogdHJ1ZSxcclxuICAgICAgICBzZXJ2aWNlUmFkaXVzOiAyXHJcbiAgICB9KSxcclxuICAgIG5ldyBMb2NhdGlvbih7XHJcbiAgICAgICAgbG9jYXRpb25JRDogMixcclxuICAgICAgICBuYW1lOiAnQ29yZXlcXCdzIEFwdCcsXHJcbiAgICAgICAgYWRkcmVzc0xpbmUxOiAnMTg3IEJvY2FuYSBTdC4nLFxyXG4gICAgICAgIHBvc3RhbENvZGU6IDkwMDAyXHJcbiAgICB9KSxcclxuICAgIG5ldyBMb2NhdGlvbih7XHJcbiAgICAgICAgbG9jYXRpb25JRDogMyxcclxuICAgICAgICBuYW1lOiAnSm9zaFxcJ2EgQXB0JyxcclxuICAgICAgICBhZGRyZXNzTGluZTE6ICc0MjkgQ29yYmV0dCBBdmUnLFxyXG4gICAgICAgIHBvc3RhbENvZGU6IDkwMDAzXHJcbiAgICB9KVxyXG5dO1xyXG5cclxuZXhwb3J0cy5sb2NhdGlvbnMgPSB0ZXN0RGF0YTtcclxuIiwiLyoqIEluYm94IHRlc3QgZGF0YSAqKi9cclxudmFyIE1lc3NhZ2UgPSByZXF1aXJlKCcuLi9tb2RlbHMvTWVzc2FnZScpO1xyXG5cclxudmFyIFRpbWUgPSByZXF1aXJlKCcuLi91dGlscy9UaW1lJyk7XHJcbnZhciBtb21lbnQgPSByZXF1aXJlKCdtb21lbnQnKTtcclxuXHJcbnZhciB0b2RheSA9IG5ldyBEYXRlKCksXHJcbiAgICB5ZXN0ZXJkYXkgPSBuZXcgRGF0ZSgpLFxyXG4gICAgbGFzdFdlZWsgPSBuZXcgRGF0ZSgpLFxyXG4gICAgb2xkRGF0ZSA9IG5ldyBEYXRlKCk7XHJcbnllc3RlcmRheS5zZXREYXRlKHllc3RlcmRheS5nZXREYXRlKCkgLSAxKTtcclxubGFzdFdlZWsuc2V0RGF0ZShsYXN0V2Vlay5nZXREYXRlKCkgLSAyKTtcclxub2xkRGF0ZS5zZXREYXRlKG9sZERhdGUuZ2V0RGF0ZSgpIC0gMTYpO1xyXG5cclxudmFyIHRlc3REYXRhID0gW1xyXG4gICAgbmV3IE1lc3NhZ2Uoe1xyXG4gICAgICAgIGNyZWF0ZWREYXRlOiBuZXcgVGltZSh0b2RheSwgMTEsIDAsIDApLFxyXG4gICAgICAgIFxyXG4gICAgICAgIHN1YmplY3Q6ICdDT05GSVJNLVN1c2FuIERlZScsXHJcbiAgICAgICAgY29udGVudDogJ0RlZXAgVGlzc3VlIE1hc3NhZ2UnLFxyXG4gICAgICAgIGxpbms6ICcjbWVzc2FnZXMvaW5ib3gvMScsXHJcblxyXG4gICAgICAgIGFjdGlvbkljb246IG51bGwsXHJcbiAgICAgICAgYWN0aW9uVGV4dDogJyQ3MCcsXHJcblxyXG4gICAgICAgIGNsYXNzTmFtZXM6ICdMaXN0Vmlldy1pdGVtLS10YWctd2FybmluZydcclxuICAgIH0pLFxyXG4gICAgbmV3IE1lc3NhZ2Uoe1xyXG4gICAgICAgIGNyZWF0ZWREYXRlOiBuZXcgVGltZSh5ZXN0ZXJkYXksIDEzLCAwLCAwKSxcclxuXHJcbiAgICAgICAgc3ViamVjdDogJ0RvIHlvdSBkbyBcIkV4b3RpYyBNYXNzYWdlXCI/JyxcclxuICAgICAgICBjb250ZW50OiAnSGksIEkgd2FudGVkIHRvIGtub3cgaWYgeW91IHBlcmZvcm0gYXMgcGFyIG9mIHlvdXIgc2VydmljZXMuLi4nLFxyXG4gICAgICAgIGxpbms6ICcjbWVzc2FnZXMvaW5ib3gvMycsXHJcblxyXG4gICAgICAgIGFjdGlvbkljb246ICdnbHlwaGljb24gZ2x5cGhpY29uLXNoYXJlLWFsdCcsXHJcbiAgICAgICAgYWN0aW9uVGV4dDogbnVsbCxcclxuXHJcbiAgICAgICAgY2xhc3NOYW1lczogbnVsbFxyXG4gICAgfSksXHJcbiAgICBuZXcgTWVzc2FnZSh7XHJcbiAgICAgICAgY3JlYXRlZERhdGU6IG5ldyBUaW1lKGxhc3RXZWVrLCAxMiwgMCwgMCksXHJcbiAgICAgICAgXHJcbiAgICAgICAgc3ViamVjdDogJ0pvc2ggRGFuaWVsc29uJyxcclxuICAgICAgICBjb250ZW50OiAnRGVlcCBUaXNzdWUgTWFzc2FnZScsXHJcbiAgICAgICAgbGluazogJyNtZXNzYWdlcy9pbmJveC8yJyxcclxuXHJcbiAgICAgICAgYWN0aW9uSWNvbjogJ2dseXBoaWNvbiBnbHlwaGljb24tcGx1cycsXHJcbiAgICAgICAgYWN0aW9uVGV4dDogbnVsbCxcclxuXHJcbiAgICAgICAgY2xhc3NOYW1lczogbnVsbFxyXG4gICAgfSksXHJcbiAgICBuZXcgTWVzc2FnZSh7XHJcbiAgICAgICAgY3JlYXRlZERhdGU6IG5ldyBUaW1lKG9sZERhdGUsIDE1LCAwLCAwKSxcclxuICAgICAgICBcclxuICAgICAgICBzdWJqZWN0OiAnSW5xdWlyeScsXHJcbiAgICAgICAgY29udGVudDogJ0Fub3RoZXIgcXVlc3Rpb24gZnJvbSBhbm90aGVyIGNsaWVudC4nLFxyXG4gICAgICAgIGxpbms6ICcjbWVzc2FnZXMvaW5ib3gvNCcsXHJcblxyXG4gICAgICAgIGFjdGlvbkljb246ICdnbHlwaGljb24gZ2x5cGhpY29uLXNoYXJlLWFsdCcsXHJcblxyXG4gICAgICAgIGNsYXNzTmFtZXM6IG51bGxcclxuICAgIH0pXHJcbl07XHJcblxyXG5leHBvcnRzLm1lc3NhZ2VzID0gdGVzdERhdGE7XHJcbiIsIi8qKiBTZXJ2aWNlcyB0ZXN0IGRhdGEgKiovXHJcbnZhciBTZXJ2aWNlID0gcmVxdWlyZSgnLi4vbW9kZWxzL1NlcnZpY2UnKTtcclxuXHJcbnZhciB0ZXN0RGF0YSA9IFtcclxuICAgIG5ldyBTZXJ2aWNlICh7XHJcbiAgICAgICAgbmFtZTogJ0RlZXAgVGlzc3VlIE1hc3NhZ2UnLFxyXG4gICAgICAgIHByaWNlOiA5NSxcclxuICAgICAgICBkdXJhdGlvbjogMTIwXHJcbiAgICB9KSxcclxuICAgIG5ldyBTZXJ2aWNlKHtcclxuICAgICAgICBuYW1lOiAnVGlzc3VlIE1hc3NhZ2UnLFxyXG4gICAgICAgIHByaWNlOiA2MCxcclxuICAgICAgICBkdXJhdGlvbjogNjBcclxuICAgIH0pLFxyXG4gICAgbmV3IFNlcnZpY2Uoe1xyXG4gICAgICAgIG5hbWU6ICdTcGVjaWFsIG9pbHMnLFxyXG4gICAgICAgIHByaWNlOiA5NSxcclxuICAgICAgICBpc0FkZG9uOiB0cnVlXHJcbiAgICB9KSxcclxuICAgIG5ldyBTZXJ2aWNlKHtcclxuICAgICAgICBuYW1lOiAnU29tZSBzZXJ2aWNlIGV4dHJhJyxcclxuICAgICAgICBwcmljZTogNDAsXHJcbiAgICAgICAgZHVyYXRpb246IDIwLFxyXG4gICAgICAgIGlzQWRkb246IHRydWVcclxuICAgIH0pXHJcbl07XHJcblxyXG5leHBvcnRzLnNlcnZpY2VzID0gdGVzdERhdGE7XHJcbiIsIi8qKiBcclxuICAgIHRpbWVTbG90c1xyXG4gICAgdGVzdGluZyBkYXRhXHJcbioqL1xyXG5cclxudmFyIFRpbWUgPSByZXF1aXJlKCcuLi91dGlscy9UaW1lJyk7XHJcblxyXG52YXIgbW9tZW50ID0gcmVxdWlyZSgnbW9tZW50Jyk7XHJcblxyXG52YXIgdG9kYXkgPSBuZXcgRGF0ZSgpLFxyXG4gICAgdG9tb3Jyb3cgPSBuZXcgRGF0ZSgpO1xyXG50b21vcnJvdy5zZXREYXRlKHRvbW9ycm93LmdldERhdGUoKSArIDEpO1xyXG5cclxudmFyIHN0b2RheSA9IG1vbWVudCh0b2RheSkuZm9ybWF0KCdZWVlZLU1NLUREJyksXHJcbiAgICBzdG9tb3Jyb3cgPSBtb21lbnQodG9tb3Jyb3cpLmZvcm1hdCgnWVlZWS1NTS1ERCcpO1xyXG5cclxudmFyIHRlc3REYXRhMSA9IFtcclxuICAgIFRpbWUodG9kYXksIDksIDE1KSxcclxuICAgIFRpbWUodG9kYXksIDExLCAzMCksXHJcbiAgICBUaW1lKHRvZGF5LCAxMiwgMCksXHJcbiAgICBUaW1lKHRvZGF5LCAxMiwgMzApLFxyXG4gICAgVGltZSh0b2RheSwgMTYsIDE1KSxcclxuICAgIFRpbWUodG9kYXksIDE4LCAwKSxcclxuICAgIFRpbWUodG9kYXksIDE4LCAzMCksXHJcbiAgICBUaW1lKHRvZGF5LCAxOSwgMCksXHJcbiAgICBUaW1lKHRvZGF5LCAxOSwgMzApLFxyXG4gICAgVGltZSh0b2RheSwgMjEsIDMwKSxcclxuICAgIFRpbWUodG9kYXksIDIyLCAwKVxyXG5dO1xyXG5cclxudmFyIHRlc3REYXRhMiA9IFtcclxuICAgIFRpbWUodG9tb3Jyb3csIDgsIDApLFxyXG4gICAgVGltZSh0b21vcnJvdywgMTAsIDMwKSxcclxuICAgIFRpbWUodG9tb3Jyb3csIDExLCAwKSxcclxuICAgIFRpbWUodG9tb3Jyb3csIDExLCAzMCksXHJcbiAgICBUaW1lKHRvbW9ycm93LCAxMiwgMCksXHJcbiAgICBUaW1lKHRvbW9ycm93LCAxMiwgMzApLFxyXG4gICAgVGltZSh0b21vcnJvdywgMTMsIDApLFxyXG4gICAgVGltZSh0b21vcnJvdywgMTMsIDMwKSxcclxuICAgIFRpbWUodG9tb3Jyb3csIDE0LCA0NSksXHJcbiAgICBUaW1lKHRvbW9ycm93LCAxNiwgMCksXHJcbiAgICBUaW1lKHRvbW9ycm93LCAxNiwgMzApXHJcbl07XHJcblxyXG52YXIgdGVzdERhdGFCdXN5ID0gW1xyXG5dO1xyXG5cclxudmFyIHRlc3REYXRhID0ge1xyXG4gICAgJ2RlZmF1bHQnOiB0ZXN0RGF0YUJ1c3lcclxufTtcclxudGVzdERhdGFbc3RvZGF5XSA9IHRlc3REYXRhMTtcclxudGVzdERhdGFbc3RvbW9ycm93XSA9IHRlc3REYXRhMjtcclxuXHJcbmV4cG9ydHMudGltZVNsb3RzID0gdGVzdERhdGE7XHJcbiIsIi8qKlxyXG4gICAgTmV3IEZ1bmN0aW9uIG1ldGhvZDogJ19kZWxheWVkJy5cclxuICAgIEl0IHJldHVybnMgYSBuZXcgZnVuY3Rpb24sIHdyYXBwaW5nIHRoZSBvcmlnaW5hbCBvbmUsXHJcbiAgICB0aGF0IG9uY2UgaXRzIGNhbGwgd2lsbCBkZWxheSB0aGUgZXhlY3V0aW9uIHRoZSBnaXZlbiBtaWxsaXNlY29uZHMsXHJcbiAgICB1c2luZyBhIHNldFRpbWVvdXQuXHJcbiAgICBUaGUgbmV3IGZ1bmN0aW9uIHJldHVybnMgJ3VuZGVmaW5lZCcgc2luY2UgaXQgaGFzIG5vdCB0aGUgcmVzdWx0LFxyXG4gICAgYmVjYXVzZSBvZiB0aGF0IGlzIG9ubHkgc3VpdGFibGUgd2l0aCByZXR1cm4tZnJlZSBmdW5jdGlvbnMgXHJcbiAgICBsaWtlIGV2ZW50IGhhbmRsZXJzLlxyXG4gICAgXHJcbiAgICBXaHk6IHNvbWV0aW1lcywgdGhlIGhhbmRsZXIgZm9yIGFuIGV2ZW50IG5lZWRzIHRvIGJlIGV4ZWN1dGVkXHJcbiAgICBhZnRlciBhIGRlbGF5IGluc3RlYWQgb2YgaW5zdGFudGx5LlxyXG4qKi9cclxuRnVuY3Rpb24ucHJvdG90eXBlLl9kZWxheWVkID0gZnVuY3Rpb24gZGVsYXllZChtaWxsaXNlY29uZHMpIHtcclxuICAgIHZhciBmbiA9IHRoaXM7XHJcbiAgICByZXR1cm4gZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgdmFyIGNvbnRleHQgPSB0aGlzLFxyXG4gICAgICAgICAgICBhcmdzID0gYXJndW1lbnRzO1xyXG4gICAgICAgIHNldFRpbWVvdXQoZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICBmbi5hcHBseShjb250ZXh0LCBhcmdzKTtcclxuICAgICAgICB9LCBtaWxsaXNlY29uZHMpO1xyXG4gICAgfTtcclxufTtcclxuIiwiLyoqXHJcbiAgICBFeHRlbmRpbmcgdGhlIEZ1bmN0aW9uIGNsYXNzIHdpdGggYW4gaW5oZXJpdHMgbWV0aG9kLlxyXG4gICAgXHJcbiAgICBUaGUgaW5pdGlhbCBsb3cgZGFzaCBpcyB0byBtYXJrIGl0IGFzIG5vLXN0YW5kYXJkLlxyXG4qKi9cclxuRnVuY3Rpb24ucHJvdG90eXBlLl9pbmhlcml0cyA9IGZ1bmN0aW9uIF9pbmhlcml0cyhzdXBlckN0b3IpIHtcclxuICAgIHRoaXMucHJvdG90eXBlID0gT2JqZWN0LmNyZWF0ZShzdXBlckN0b3IucHJvdG90eXBlLCB7XHJcbiAgICAgICAgY29uc3RydWN0b3I6IHtcclxuICAgICAgICAgICAgdmFsdWU6IHRoaXMsXHJcbiAgICAgICAgICAgIGVudW1lcmFibGU6IGZhbHNlLFxyXG4gICAgICAgICAgICB3cml0YWJsZTogdHJ1ZSxcclxuICAgICAgICAgICAgY29uZmlndXJhYmxlOiB0cnVlXHJcbiAgICAgICAgfVxyXG4gICAgfSk7XHJcbn07XHJcbiIsIi8qKlxyXG4gICAgUkVTVCBBUEkgYWNjZXNzXHJcbioqL1xyXG4ndXNlIHN0cmljdCc7XHJcbnZhciAkID0gcmVxdWlyZSgnanF1ZXJ5Jyk7XHJcblxyXG5mdW5jdGlvbiBsb3dlckZpcnN0TGV0dGVyKG4pIHtcclxuICAgIHJldHVybiBuICYmIG5bMF0gJiYgblswXS50b0xvd2VyQ2FzZSAmJiAoblswXS50b0xvd2VyQ2FzZSgpICsgbi5zbGljZSgxKSkgfHwgbjtcclxufVxyXG5cclxuZnVuY3Rpb24gbG93ZXJDYW1lbGl6ZU9iamVjdChvYmopIHtcclxuICAgIC8vanNoaW50IG1heGNvbXBsZXhpdHk6OFxyXG4gICAgXHJcbiAgICBpZiAoIW9iaiB8fCB0eXBlb2Yob2JqKSAhPT0gJ29iamVjdCcpIHJldHVybiBvYmo7XHJcblxyXG4gICAgdmFyIHJldCA9IEFycmF5LmlzQXJyYXkob2JqKSA/IFtdIDoge307XHJcbiAgICBmb3IodmFyIGsgaW4gb2JqKSB7XHJcbiAgICAgICAgaWYgKG9iai5oYXNPd25Qcm9wZXJ0eShrKSkge1xyXG4gICAgICAgICAgICB2YXIgbmV3ayA9IGxvd2VyRmlyc3RMZXR0ZXIoayk7XHJcbiAgICAgICAgICAgIHJldFtuZXdrXSA9IHR5cGVvZihvYmpba10pID09PSAnb2JqZWN0JyA/XHJcbiAgICAgICAgICAgICAgICBsb3dlckNhbWVsaXplT2JqZWN0KG9ialtrXSkgOlxyXG4gICAgICAgICAgICAgICAgb2JqW2tdXHJcbiAgICAgICAgICAgIDtcclxuICAgICAgICB9XHJcbiAgICB9XHJcbiAgICByZXR1cm4gcmV0O1xyXG59XHJcblxyXG5mdW5jdGlvbiBSZXN0KG9wdGlvbnNPclVybCkge1xyXG4gICAgXHJcbiAgICB2YXIgdXJsID0gdHlwZW9mKG9wdGlvbnNPclVybCkgPT09ICdzdHJpbmcnID9cclxuICAgICAgICBvcHRpb25zT3JVcmwgOlxyXG4gICAgICAgIG9wdGlvbnNPclVybCAmJiBvcHRpb25zT3JVcmwudXJsO1xyXG5cclxuICAgIHRoaXMuYmFzZVVybCA9IHVybDtcclxuICAgIC8vIE9wdGlvbmFsIGV4dHJhSGVhZGVycyBmb3IgYWxsIHJlcXVlc3RzLFxyXG4gICAgLy8gdXN1YWxseSBmb3IgYXV0aGVudGljYXRpb24gdG9rZW5zXHJcbiAgICB0aGlzLmV4dHJhSGVhZGVycyA9IG51bGw7XHJcbn1cclxuXHJcblJlc3QucHJvdG90eXBlLmdldCA9IGZ1bmN0aW9uIGdldChhcGlVcmwsIGRhdGEpIHtcclxuICAgIHJldHVybiB0aGlzLnJlcXVlc3QoYXBpVXJsLCAnZ2V0JywgZGF0YSk7XHJcbn07XHJcblxyXG5SZXN0LnByb3RvdHlwZS5wdXQgPSBmdW5jdGlvbiBnZXQoYXBpVXJsLCBkYXRhKSB7XHJcbiAgICByZXR1cm4gdGhpcy5yZXF1ZXN0KGFwaVVybCwgJ3B1dCcsIGRhdGEpO1xyXG59O1xyXG5cclxuUmVzdC5wcm90b3R5cGUucG9zdCA9IGZ1bmN0aW9uIGdldChhcGlVcmwsIGRhdGEpIHtcclxuICAgIHJldHVybiB0aGlzLnJlcXVlc3QoYXBpVXJsLCAncG9zdCcsIGRhdGEpO1xyXG59O1xyXG5cclxuUmVzdC5wcm90b3R5cGUuZGVsZXRlID0gZnVuY3Rpb24gZ2V0KGFwaVVybCwgZGF0YSkge1xyXG4gICAgcmV0dXJuIHRoaXMucmVxdWVzdChhcGlVcmwsICdkZWxldGUnLCBkYXRhKTtcclxufTtcclxuXHJcblJlc3QucHJvdG90eXBlLnB1dEZpbGUgPSBmdW5jdGlvbiBwdXRGaWxlKGFwaVVybCwgZGF0YSkge1xyXG4gICAgLy8gTk9URSBiYXNpYyBwdXRGaWxlIGltcGxlbWVudGF0aW9uLCBvbmUgZmlsZSwgdXNlIGZpbGVVcGxvYWQ/XHJcbiAgICByZXR1cm4gdGhpcy5yZXF1ZXN0KGFwaVVybCwgJ2RlbGV0ZScsIGRhdGEsICdtdWx0aXBhcnQvZm9ybS1kYXRhJyk7XHJcbn07XHJcblxyXG5SZXN0LnByb3RvdHlwZS5yZXF1ZXN0ID0gZnVuY3Rpb24gcmVxdWVzdChhcGlVcmwsIGh0dHBNZXRob2QsIGRhdGEsIGNvbnRlbnRUeXBlKSB7XHJcbiAgICBcclxuICAgIHZhciB0aGlzUmVzdCA9IHRoaXM7XHJcbiAgICB2YXIgdXJsID0gdGhpcy5iYXNlVXJsICsgYXBpVXJsO1xyXG5cclxuICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUoJC5hamF4KHtcclxuICAgICAgICB1cmw6IHVybCxcclxuICAgICAgICAvLyBBdm9pZCBjYWNoZSBmb3IgZGF0YS5cclxuICAgICAgICBjYWNoZTogZmFsc2UsXHJcbiAgICAgICAgZGF0YVR5cGU6ICdqc29uJyxcclxuICAgICAgICBtZXRob2Q6IGh0dHBNZXRob2QsXHJcbiAgICAgICAgaGVhZGVyczogdGhpcy5leHRyYUhlYWRlcnMsXHJcbiAgICAgICAgLy8gVVJMRU5DT0RFRCBpbnB1dDpcclxuICAgICAgICAvLyBDb252ZXJ0IHRvIEpTT04gYW5kIGJhY2sganVzdCB0byBlbnN1cmUgdGhlIHZhbHVlcyBhcmUgY29udmVydGVkL2VuY29kZWRcclxuICAgICAgICAvLyBwcm9wZXJseSB0byBiZSBzZW50LCBsaWtlIERhdGVzIGJlaW5nIGNvbnZlcnRlZCB0byBJU08gZm9ybWF0LlxyXG4gICAgICAgIGRhdGE6IGRhdGEgJiYgSlNPTi5wYXJzZShKU09OLnN0cmluZ2lmeShkYXRhKSksXHJcbiAgICAgICAgY29udGVudFR5cGU6IGNvbnRlbnRUeXBlIHx8ICdhcHBsaWNhdGlvbi94LXd3dy1mb3JtLXVybGVuY29kZWQnXHJcbiAgICAgICAgLy8gQWx0ZXJuYXRlOiBKU09OIGFzIGlucHV0XHJcbiAgICAgICAgLy9kYXRhOiBKU09OLnN0cmluZ2lmeShkYXRhKSxcclxuICAgICAgICAvL2NvbnRlbnRUeXBlOiBjb250ZW50VHlwZSB8fCAnYXBwbGljYXRpb24vanNvbidcclxuICAgIH0pKVxyXG4gICAgLnRoZW4obG93ZXJDYW1lbGl6ZU9iamVjdClcclxuICAgIC5jYXRjaChmdW5jdGlvbihlcnIpIHtcclxuICAgICAgICAvLyBPbiBhdXRob3JpemF0aW9uIGVycm9yLCBnaXZlIG9wb3J0dW5pdHkgdG8gcmV0cnkgdGhlIG9wZXJhdGlvblxyXG4gICAgICAgIGlmIChlcnIuc3RhdHVzID09PSA0MDEpIHtcclxuICAgICAgICAgICAgdmFyIHJldHJ5ID0gcmVxdWVzdC5iaW5kKHRoaXMsIGFwaVVybCwgaHR0cE1ldGhvZCwgZGF0YSwgY29udGVudFR5cGUpO1xyXG4gICAgICAgICAgICB2YXIgcmV0cnlQcm9taXNlID0gdGhpc1Jlc3Qub25BdXRob3JpemF0aW9uUmVxdWlyZWQocmV0cnkpO1xyXG4gICAgICAgICAgICBpZiAocmV0cnlQcm9taXNlKSB7XHJcbiAgICAgICAgICAgICAgICAvLyBJdCByZXR1cm5lZCBzb21ldGhpbmcsIGV4cGVjdGluZyBpcyBhIHByb21pc2U6XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKHJldHJ5UHJvbWlzZSlcclxuICAgICAgICAgICAgICAgIC5jYXRjaChmdW5jdGlvbigpe1xyXG4gICAgICAgICAgICAgICAgICAgIC8vIFRoZXJlIGlzIGVycm9yIG9uIHJldHJ5LCBqdXN0IHJldHVybiB0aGVcclxuICAgICAgICAgICAgICAgICAgICAvLyBvcmlnaW5hbCBjYWxsIGVycm9yXHJcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGVycjtcclxuICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgICAgIC8vIGJ5IGRlZmF1bHQsIGNvbnRpbnVlIHByb3BhZ2F0aW5nIHRoZSBlcnJvclxyXG4gICAgICAgIHJldHVybiBlcnI7XHJcbiAgICB9KTtcclxufTtcclxuXHJcblJlc3QucHJvdG90eXBlLm9uQXV0aG9yaXphdGlvblJlcXVpcmVkID0gZnVuY3Rpb24gb25BdXRob3JpemF0aW9uUmVxdWlyZWQocmV0cnkpIHtcclxuICAgIC8vIFRvIGJlIGltcGxlbWVudGVkIG91dHNpZGUsIGJ5IGRlZmF1bHQgZG9uJ3Qgd2FpdFxyXG4gICAgLy8gZm9yIHJldHJ5LCBqdXN0IHJldHVybiBub3RoaW5nOlxyXG4gICAgcmV0dXJuO1xyXG59O1xyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBSZXN0O1xyXG4iLCIvKipcclxuICAgIFRpbWUgY2xhc3MgdXRpbGl0eS5cclxuICAgIFNob3J0ZXIgd2F5IHRvIGNyZWF0ZSBhIERhdGUgaW5zdGFuY2VcclxuICAgIHNwZWNpZnlpbmcgb25seSB0aGUgVGltZSBwYXJ0LFxyXG4gICAgZGVmYXVsdGluZyB0byBjdXJyZW50IGRhdGUgb3IgXHJcbiAgICBhbm90aGVyIHJlYWR5IGRhdGUgaW5zdGFuY2UuXHJcbioqL1xyXG5mdW5jdGlvbiBUaW1lKGRhdGUsIGhvdXIsIG1pbnV0ZSwgc2Vjb25kKSB7XHJcbiAgICBpZiAoIShkYXRlIGluc3RhbmNlb2YgRGF0ZSkpIHtcclxuIFxyXG4gICAgICAgIHNlY29uZCA9IG1pbnV0ZTtcclxuICAgICAgICBtaW51dGUgPSBob3VyO1xyXG4gICAgICAgIGhvdXIgPSBkYXRlO1xyXG4gICAgICAgIFxyXG4gICAgICAgIGRhdGUgPSBuZXcgRGF0ZSgpOyAgIFxyXG4gICAgfVxyXG5cclxuICAgIHJldHVybiBuZXcgRGF0ZShkYXRlLmdldEZ1bGxZZWFyKCksIGRhdGUuZ2V0TW9udGgoKSwgZGF0ZS5nZXREYXRlKCksIGhvdXIgfHwgMCwgbWludXRlIHx8IDAsIHNlY29uZCB8fCAwKTtcclxufVxyXG5tb2R1bGUuZXhwb3J0cyA9IFRpbWU7XHJcbiIsIi8qKlxyXG4gICAgQ3JlYXRlIGFuIEFjY2VzcyBDb250cm9sIGZvciBhbiBhcHAgdGhhdCBqdXN0IGNoZWNrc1xyXG4gICAgdGhlIGFjdGl2aXR5IHByb3BlcnR5IGZvciBhbGxvd2VkIHVzZXIgbGV2ZWwuXHJcbiAgICBUbyBiZSBwcm92aWRlZCB0byBTaGVsbC5qcyBhbmQgdXNlZCBieSB0aGUgYXBwLmpzLFxyXG4gICAgdmVyeSB0aWVkIHRvIHRoYXQgYm90aCBjbGFzc2VzLlxyXG4gICAgXHJcbiAgICBBY3Rpdml0aWVzIGNhbiBkZWZpbmUgb24gaXRzIG9iamVjdCBhbiBhY2Nlc3NMZXZlbFxyXG4gICAgcHJvcGVydHkgbGlrZSBuZXh0IGV4YW1wbGVzXHJcbiAgICBcclxuICAgIHRoaXMuYWNjZXNzTGV2ZWwgPSBhcHAuVXNlcnR5cGUuVXNlcjsgLy8gYW55b25lXHJcbiAgICB0aGlzLmFjY2Vzc0xldmVsID0gYXBwLlVzZXJUeXBlLkFub255bW91czsgLy8gYW5vbnltb3VzIHVzZXJzIG9ubHlcclxuICAgIHRoaXMuYWNjZXNzTGV2ZWwgPSBhcHAuVXNlclR5cGUuTG9nZ2VkVXNlcjsgLy8gYXV0aGVudGljYXRlZCB1c2VycyBvbmx5XHJcbioqL1xyXG4ndXNlIHN0cmljdCc7XHJcblxyXG4vLyBVc2VyVHlwZSBlbnVtZXJhdGlvbiBpcyBiaXQgYmFzZWQsIHNvIHNldmVyYWxcclxuLy8gdXNlcnMgY2FuIGhhcyBhY2Nlc3MgaW4gYSBzaW5nbGUgcHJvcGVydHlcclxudmFyIFVzZXJUeXBlID0gcmVxdWlyZSgnLi4vbW9kZWxzL1VzZXInKS5Vc2VyVHlwZTtcclxuXHJcbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gY3JlYXRlQWNjZXNzQ29udHJvbChhcHApIHtcclxuICAgIFxyXG4gICAgcmV0dXJuIGZ1bmN0aW9uIGFjY2Vzc0NvbnRyb2wocm91dGUpIHtcclxuXHJcbiAgICAgICAgdmFyIGFjdGl2aXR5ID0gYXBwLmdldEFjdGl2aXR5Q29udHJvbGxlckJ5Um91dGUocm91dGUpO1xyXG5cclxuICAgICAgICB2YXIgdXNlciA9IGFwcC5tb2RlbC51c2VyKCk7XHJcbiAgICAgICAgdmFyIGN1cnJlbnRUeXBlID0gdXNlciAmJiB1c2VyLnVzZXJUeXBlKCk7XHJcblxyXG4gICAgICAgIGlmIChhY3Rpdml0eSAmJiBhY3Rpdml0eS5hY2Nlc3NMZXZlbCkge1xyXG5cclxuICAgICAgICAgICAgdmFyIGNhbiA9IGFjdGl2aXR5LmFjY2Vzc0xldmVsICYgY3VycmVudFR5cGU7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICBpZiAoIWNhbikge1xyXG4gICAgICAgICAgICAgICAgLy8gTm90aWZ5IGVycm9yLCB3aHkgY2Fubm90IGFjY2Vzc1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIHtcclxuICAgICAgICAgICAgICAgICAgICByZXF1aXJlZExldmVsOiBhY3Rpdml0eS5hY2Nlc3NMZXZlbCxcclxuICAgICAgICAgICAgICAgICAgICBjdXJyZW50VHlwZTogY3VycmVudFR5cGVcclxuICAgICAgICAgICAgICAgIH07XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIC8vIEFsbG93XHJcbiAgICAgICAgcmV0dXJuIG51bGw7XHJcbiAgICB9O1xyXG59O1xyXG4iLCIndXNlIHN0cmljdCc7XHJcblxyXG52YXIgdW53cmFwID0gZnVuY3Rpb24gdW53cmFwKHZhbHVlKSB7XHJcbiAgICByZXR1cm4gKHR5cGVvZih2YWx1ZSkgPT09ICdmdW5jdGlvbicgPyB2YWx1ZSgpIDogdmFsdWUpO1xyXG59O1xyXG5cclxuZXhwb3J0cy5kZWZpbmVDcnVkQXBpRm9yUmVzdCA9IGZ1bmN0aW9uIGRlZmluZUNydWRBcGlGb3JSZXN0KHNldHRpbmdzKSB7XHJcbiAgICBcclxuICAgIHZhciBleHRlbmRlZE9iamVjdCA9IHNldHRpbmdzLmV4dGVuZGVkT2JqZWN0LFxyXG4gICAgICAgIE1vZGVsID0gc2V0dGluZ3MuTW9kZWwsXHJcbiAgICAgICAgbW9kZWxOYW1lID0gc2V0dGluZ3MubW9kZWxOYW1lLFxyXG4gICAgICAgIG1vZGVsTGlzdE5hbWUgPSBzZXR0aW5ncy5tb2RlbExpc3ROYW1lLFxyXG4gICAgICAgIG1vZGVsVXJsID0gc2V0dGluZ3MubW9kZWxVcmwsXHJcbiAgICAgICAgaWRQcm9wZXJ0eU5hbWUgPSBzZXR0aW5ncy5pZFByb3BlcnR5TmFtZTtcclxuXHJcbiAgICBleHRlbmRlZE9iamVjdFsnZ2V0JyArIG1vZGVsTGlzdE5hbWVdID0gZnVuY3Rpb24gZ2V0TGlzdChmaWx0ZXJzKSB7XHJcbiAgICAgICAgXHJcbiAgICAgICAgcmV0dXJuIHRoaXMucmVzdC5nZXQobW9kZWxVcmwsIGZpbHRlcnMpXHJcbiAgICAgICAgLnRoZW4oZnVuY3Rpb24ocmF3SXRlbXMpIHtcclxuICAgICAgICAgICAgcmV0dXJuIHJhd0l0ZW1zICYmIHJhd0l0ZW1zLm1hcChmdW5jdGlvbihyYXdJdGVtKSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gbmV3IE1vZGVsKHJhd0l0ZW0pO1xyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICB9KTtcclxuICAgIH07XHJcbiAgICBcclxuICAgIGV4dGVuZGVkT2JqZWN0WydnZXQnICsgbW9kZWxOYW1lXSA9IGZ1bmN0aW9uIGdldEl0ZW0oaXRlbUlEKSB7XHJcbiAgICAgICAgXHJcbiAgICAgICAgcmV0dXJuIHRoaXMucmVzdC5nZXQobW9kZWxVcmwgKyAnLycgKyBpdGVtSUQpXHJcbiAgICAgICAgLnRoZW4oZnVuY3Rpb24ocmF3SXRlbSkge1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgcmV0dXJuIHJhd0l0ZW0gJiYgbmV3IE1vZGVsKHJhd0l0ZW0pO1xyXG4gICAgICAgIH0pO1xyXG4gICAgfTtcclxuXHJcbiAgICBleHRlbmRlZE9iamVjdFsncG9zdCcgKyBtb2RlbE5hbWVdID0gZnVuY3Rpb24gcG9zdEl0ZW0oYW5JdGVtKSB7XHJcbiAgICAgICAgXHJcbiAgICAgICAgcmV0dXJuIHRoaXMucmVzdC5wb3N0KG1vZGVsVXJsLCBhbkl0ZW0pLnRoZW4oZnVuY3Rpb24oYW5JdGVtKSB7XHJcbiAgICAgICAgICAgIHJldHVybiBuZXcgTW9kZWwoYW5JdGVtKTtcclxuICAgICAgICB9KTtcclxuICAgIH07XHJcblxyXG4gICAgZXh0ZW5kZWRPYmplY3RbJ3B1dCcgKyBtb2RlbE5hbWVdID0gZnVuY3Rpb24gcHV0SXRlbShhbkl0ZW0pIHtcclxuICAgICAgICByZXR1cm4gdGhpcy5yZXN0LnB1dChtb2RlbFVybCArICcvJyArIHVud3JhcChhbkl0ZW1baWRQcm9wZXJ0eU5hbWVdKSwgYW5JdGVtKTtcclxuICAgIH07XHJcbiAgICBcclxuICAgIGV4dGVuZGVkT2JqZWN0WydzZXQnICsgbW9kZWxOYW1lXSA9IGZ1bmN0aW9uIHNldEl0ZW0oYW5JdGVtKSB7XHJcbiAgICAgICAgdmFyIGlkID0gdW53cmFwKGFuSXRlbVtpZFByb3BlcnR5TmFtZV0pO1xyXG4gICAgICAgIGlmIChpZClcclxuICAgICAgICAgICAgcmV0dXJuIHRoaXNbJ3B1dCcgKyBtb2RlbE5hbWVdKGFuSXRlbSk7XHJcbiAgICAgICAgZWxzZVxyXG4gICAgICAgICAgICByZXR1cm4gdGhpc1sncG9zdCcgKyBtb2RlbE5hbWVdKGFuSXRlbSk7XHJcbiAgICB9O1xyXG5cclxuICAgIGV4dGVuZGVkT2JqZWN0WydkZWwnICsgbW9kZWxOYW1lXSA9IGZ1bmN0aW9uIGRlbEl0ZW0oYW5JdGVtKSB7XHJcbiAgICAgICAgdmFyIGlkID0gYW5JdGVtICYmIHVud3JhcChhbkl0ZW1baWRQcm9wZXJ0eU5hbWVdKSB8fFxyXG4gICAgICAgICAgICAgICAgYW5JdGVtO1xyXG4gICAgICAgIGlmIChpZClcclxuICAgICAgICAgICAgcmV0dXJuIHRoaXMucmVzdC5kZWxldGUobW9kZWxVcmwgKyAnLycgKyBpZCwgYW5JdGVtKVxyXG4gICAgICAgICAgICAudGhlbihmdW5jdGlvbihkZWxldGVkSXRlbSkge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIGRlbGV0ZWRJdGVtICYmIG5ldyBNb2RlbChkZWxldGVkSXRlbSk7XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgIGVsc2VcclxuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdOZWVkIGFuIElEIG9yIGFuIG9iamVjdCB3aXRoIHRoZSBJRCBwcm9wZXJ0eSB0byBkZWxldGUnKTtcclxuICAgIH07XHJcbn07IiwiLyoqXHJcbiAgICBCb290a25vY2s6IFNldCBvZiBLbm9ja291dCBCaW5kaW5nIEhlbHBlcnMgZm9yIEJvb3RzdHJhcCBqcyBjb21wb25lbnRzIChqcXVlcnkgcGx1Z2lucylcclxuICAgIFxyXG4gICAgRGVwZW5kZW5jaWVzOiBqcXVlcnlcclxuICAgIEluamVjdGVkIGRlcGVuZGVuY2llczoga25vY2tvdXRcclxuKiovXHJcbid1c2Ugc3RyaWN0JztcclxuXHJcbi8vIERlcGVuZGVuY2llc1xyXG52YXIgJCA9IHJlcXVpcmUoJ2pxdWVyeScpO1xyXG4vLyBESSBpMThuIGxpYnJhcnlcclxuZXhwb3J0cy5pMThuID0gbnVsbDtcclxuXHJcbmZ1bmN0aW9uIGNyZWF0ZUhlbHBlcnMoa28pIHtcclxuICAgIHZhciBoZWxwZXJzID0ge307XHJcblxyXG4gICAgLyoqIFBvcG92ZXIgQmluZGluZyAqKi9cclxuICAgIGhlbHBlcnMucG9wb3ZlciA9IHtcclxuICAgICAgICB1cGRhdGU6IGZ1bmN0aW9uKGVsZW1lbnQsIHZhbHVlQWNjZXNzb3IsIGFsbEJpbmRpbmdzKSB7XHJcbiAgICAgICAgICAgIHZhciBzcmNPcHRpb25zID0ga28udW53cmFwKHZhbHVlQWNjZXNzb3IoKSk7XHJcblxyXG4gICAgICAgICAgICAvLyBEdXBsaWNhdGluZyBvcHRpb25zIG9iamVjdCB0byBwYXNzIHRvIHBvcG92ZXIgd2l0aG91dFxyXG4gICAgICAgICAgICAvLyBvdmVyd3JpdHRuZyBzb3VyY2UgY29uZmlndXJhdGlvblxyXG4gICAgICAgICAgICB2YXIgb3B0aW9ucyA9ICQuZXh0ZW5kKHRydWUsIHt9LCBzcmNPcHRpb25zKTtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIC8vIFVud3JhcHBpbmcgY29udGVudCB0ZXh0XHJcbiAgICAgICAgICAgIG9wdGlvbnMuY29udGVudCA9IGtvLnVud3JhcChzcmNPcHRpb25zLmNvbnRlbnQpO1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgaWYgKG9wdGlvbnMuY29udGVudCkge1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgICAgIC8vIExvY2FsaXplOlxyXG4gICAgICAgICAgICAgICAgb3B0aW9ucy5jb250ZW50ID0gXHJcbiAgICAgICAgICAgICAgICAgICAgZXhwb3J0cy5pMThuICYmIGV4cG9ydHMuaTE4bi50KG9wdGlvbnMuY29udGVudCkgfHxcclxuICAgICAgICAgICAgICAgICAgICBvcHRpb25zLmNvbnRlbnQ7XHJcbiAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgICAgIC8vIFRvIGdldCB0aGUgbmV3IG9wdGlvbnMsIHdlIG5lZWQgZGVzdHJveSBpdCBmaXJzdDpcclxuICAgICAgICAgICAgICAgICQoZWxlbWVudCkucG9wb3ZlcignZGVzdHJveScpLnBvcG92ZXIob3B0aW9ucyk7XHJcblxyXG4gICAgICAgICAgICAgICAgLy8gU2UgbXVlc3RyYSBzaSBlbCBlbGVtZW50byB0aWVuZSBlbCBmb2NvXHJcbiAgICAgICAgICAgICAgICBpZiAoJChlbGVtZW50KS5pcygnOmZvY3VzJykpXHJcbiAgICAgICAgICAgICAgICAgICAgJChlbGVtZW50KS5wb3BvdmVyKCdzaG93Jyk7XHJcblxyXG4gICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgJChlbGVtZW50KS5wb3BvdmVyKCdkZXN0cm95Jyk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICB9O1xyXG4gICAgXHJcbiAgICByZXR1cm4gaGVscGVycztcclxufVxyXG5cclxuLyoqXHJcbiAgICBQbHVnIGhlbHBlcnMgaW4gdGhlIHByb3ZpZGVkIEtub2Nrb3V0IGluc3RhbmNlXHJcbioqL1xyXG5mdW5jdGlvbiBwbHVnSW4oa28sIHByZWZpeCkge1xyXG4gICAgdmFyIG5hbWUsXHJcbiAgICAgICAgaGVscGVycyA9IGNyZWF0ZUhlbHBlcnMoa28pO1xyXG4gICAgXHJcbiAgICBmb3IodmFyIGggaW4gaGVscGVycykge1xyXG4gICAgICAgIGlmIChoZWxwZXJzLmhhc093blByb3BlcnR5ICYmICFoZWxwZXJzLmhhc093blByb3BlcnR5KGgpKVxyXG4gICAgICAgICAgICBjb250aW51ZTtcclxuXHJcbiAgICAgICAgbmFtZSA9IHByZWZpeCA/IHByZWZpeCArIGhbMF0udG9VcHBlckNhc2UoKSArIGguc2xpY2UoMSkgOiBoO1xyXG4gICAgICAgIGtvLmJpbmRpbmdIYW5kbGVyc1tuYW1lXSA9IGhlbHBlcnNbaF07XHJcbiAgICB9XHJcbn1cclxuXHJcbmV4cG9ydHMucGx1Z0luID0gcGx1Z0luO1xyXG5leHBvcnRzLmNyZWF0ZUJpbmRpbmdIZWxwZXJzID0gY3JlYXRlSGVscGVycztcclxuIiwiLyoqXHJcbiAgICBFc3BhY2UgYSBzdHJpbmcgZm9yIHVzZSBvbiBhIFJlZ0V4cC5cclxuICAgIFVzdWFsbHksIHRvIGxvb2sgZm9yIGEgc3RyaW5nIGluIGEgdGV4dCBtdWx0aXBsZSB0aW1lc1xyXG4gICAgb3Igd2l0aCBzb21lIGV4cHJlc3Npb25zLCBzb21lIGNvbW1vbiBhcmUgXHJcbiAgICBsb29rIGZvciBhIHRleHQgJ2luIHRoZSBiZWdpbm5pbmcnICheKVxyXG4gICAgb3IgJ2F0IHRoZSBlbmQnICgkKS5cclxuICAgIFxyXG4gICAgQXV0aG9yOiBodHRwOi8vc3RhY2tvdmVyZmxvdy5jb20vdXNlcnMvMTUxMzEyL2Nvb2xhajg2IGFuZCBodHRwOi8vc3RhY2tvdmVyZmxvdy5jb20vdXNlcnMvOTQxMC9hcmlzdG90bGUtcGFnYWx0emlzXHJcbiAgICBMaW5rOiBodHRwOi8vc3RhY2tvdmVyZmxvdy5jb20vYS82OTY5NDg2XHJcbioqL1xyXG4ndXNlIHN0cmljdCc7XHJcblxyXG4vLyBSZWZlcnJpbmcgdG8gdGhlIHRhYmxlIGhlcmU6XHJcbi8vIGh0dHBzOi8vZGV2ZWxvcGVyLm1vemlsbGEub3JnL2VuL0phdmFTY3JpcHQvUmVmZXJlbmNlL0dsb2JhbF9PYmplY3RzL3JlZ2V4cFxyXG4vLyB0aGVzZSBjaGFyYWN0ZXJzIHNob3VsZCBiZSBlc2NhcGVkXHJcbi8vIFxcIF4gJCAqICsgPyAuICggKSB8IHsgfSBbIF1cclxuLy8gVGhlc2UgY2hhcmFjdGVycyBvbmx5IGhhdmUgc3BlY2lhbCBtZWFuaW5nIGluc2lkZSBvZiBicmFja2V0c1xyXG4vLyB0aGV5IGRvIG5vdCBuZWVkIHRvIGJlIGVzY2FwZWQsIGJ1dCB0aGV5IE1BWSBiZSBlc2NhcGVkXHJcbi8vIHdpdGhvdXQgYW55IGFkdmVyc2UgZWZmZWN0cyAodG8gdGhlIGJlc3Qgb2YgbXkga25vd2xlZGdlIGFuZCBjYXN1YWwgdGVzdGluZylcclxuLy8gOiAhICwgPSBcclxuLy8gbXkgdGVzdCBcIn4hQCMkJV4mKigpe31bXWAvPT8rXFx8LV87OidcXFwiLDwuPlwiLm1hdGNoKC9bXFwjXS9nKVxyXG5cclxudmFyIHNwZWNpYWxzID0gW1xyXG4gICAgLy8gb3JkZXIgbWF0dGVycyBmb3IgdGhlc2VcclxuICAgICAgXCItXCJcclxuICAgICwgXCJbXCJcclxuICAgICwgXCJdXCJcclxuICAgIC8vIG9yZGVyIGRvZXNuJ3QgbWF0dGVyIGZvciBhbnkgb2YgdGhlc2VcclxuICAgICwgXCIvXCJcclxuICAgICwgXCJ7XCJcclxuICAgICwgXCJ9XCJcclxuICAgICwgXCIoXCJcclxuICAgICwgXCIpXCJcclxuICAgICwgXCIqXCJcclxuICAgICwgXCIrXCJcclxuICAgICwgXCI/XCJcclxuICAgICwgXCIuXCJcclxuICAgICwgXCJcXFxcXCJcclxuICAgICwgXCJeXCJcclxuICAgICwgXCIkXCJcclxuICAgICwgXCJ8XCJcclxuICBdXHJcblxyXG4gIC8vIEkgY2hvb3NlIHRvIGVzY2FwZSBldmVyeSBjaGFyYWN0ZXIgd2l0aCAnXFwnXHJcbiAgLy8gZXZlbiB0aG91Z2ggb25seSBzb21lIHN0cmljdGx5IHJlcXVpcmUgaXQgd2hlbiBpbnNpZGUgb2YgW11cclxuLCByZWdleCA9IFJlZ0V4cCgnWycgKyBzcGVjaWFscy5qb2luKCdcXFxcJykgKyAnXScsICdnJylcclxuO1xyXG5cclxudmFyIGVzY2FwZVJlZ0V4cCA9IGZ1bmN0aW9uIChzdHIpIHtcclxucmV0dXJuIHN0ci5yZXBsYWNlKHJlZ2V4LCBcIlxcXFwkJlwiKTtcclxufTtcclxuXHJcbm1vZHVsZS5leHBvcnRzID0gZXNjYXBlUmVnRXhwO1xyXG5cclxuLy8gdGVzdCBlc2NhcGVSZWdFeHAoXCIvcGF0aC90by9yZXM/c2VhcmNoPXRoaXMudGhhdFwiKVxyXG4iLCIvKipcclxuKiBlc2NhcGVTZWxlY3RvclxyXG4qXHJcbiogc291cmNlOiBodHRwOi8va2p2YXJnYS5ibG9nc3BvdC5jb20uZXMvMjAwOS8wNi9qcXVlcnktcGx1Z2luLXRvLWVzY2FwZS1jc3Mtc2VsZWN0b3IuaHRtbFxyXG4qXHJcbiogRXNjYXBlIGFsbCBzcGVjaWFsIGpRdWVyeSBDU1Mgc2VsZWN0b3IgY2hhcmFjdGVycyBpbiAqc2VsZWN0b3IqLlxyXG4qIFVzZWZ1bCB3aGVuIHlvdSBoYXZlIGEgY2xhc3Mgb3IgaWQgd2hpY2ggY29udGFpbnMgc3BlY2lhbCBjaGFyYWN0ZXJzXHJcbiogd2hpY2ggeW91IG5lZWQgdG8gaW5jbHVkZSBpbiBhIHNlbGVjdG9yLlxyXG4qL1xyXG4ndXNlIHN0cmljdCc7XHJcblxyXG52YXIgc3BlY2lhbHMgPSBbXHJcbiAgJyMnLCAnJicsICd+JywgJz0nLCAnPicsIFxyXG4gIFwiJ1wiLCAnOicsICdcIicsICchJywgJzsnLCAnLCdcclxuXTtcclxudmFyIHJlZ2V4U3BlY2lhbHMgPSBbXHJcbiAgJy4nLCAnKicsICcrJywgJ3wnLCAnWycsICddJywgJygnLCAnKScsICcvJywgJ14nLCAnJCdcclxuXTtcclxudmFyIHNSRSA9IG5ldyBSZWdFeHAoXHJcbiAgJygnICsgc3BlY2lhbHMuam9pbignfCcpICsgJ3xcXFxcJyArIHJlZ2V4U3BlY2lhbHMuam9pbignfFxcXFwnKSArICcpJywgJ2cnXHJcbik7XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKHNlbGVjdG9yKSB7XHJcbiAgcmV0dXJuIHNlbGVjdG9yLnJlcGxhY2Uoc1JFLCAnXFxcXCQxJyk7XHJcbn07XHJcbiIsIi8qKlxyXG4gICAgUmVhZCBhIHBhZ2UncyBHRVQgVVJMIHZhcmlhYmxlcyBhbmQgcmV0dXJuIHRoZW0gYXMgYW4gYXNzb2NpYXRpdmUgYXJyYXkuXHJcbioqL1xyXG4ndXNlciBzdHJpY3QnO1xyXG4vL2dsb2JhbCB3aW5kb3dcclxuXHJcbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gZ2V0VXJsUXVlcnkodXJsKSB7XHJcblxyXG4gICAgdXJsID0gdXJsIHx8IHdpbmRvdy5sb2NhdGlvbi5ocmVmO1xyXG5cclxuICAgIHZhciB2YXJzID0gW10sIGhhc2gsXHJcbiAgICAgICAgcXVlcnlJbmRleCA9IHVybC5pbmRleE9mKCc/Jyk7XHJcbiAgICBpZiAocXVlcnlJbmRleCA+IC0xKSB7XHJcbiAgICAgICAgdmFyIGhhc2hlcyA9IHVybC5zbGljZShxdWVyeUluZGV4ICsgMSkuc3BsaXQoJyYnKTtcclxuICAgICAgICBmb3IodmFyIGkgPSAwOyBpIDwgaGFzaGVzLmxlbmd0aDsgaSsrKVxyXG4gICAgICAgIHtcclxuICAgICAgICAgICAgaGFzaCA9IGhhc2hlc1tpXS5zcGxpdCgnPScpO1xyXG4gICAgICAgICAgICB2YXJzLnB1c2goaGFzaFswXSk7XHJcbiAgICAgICAgICAgIHZhcnNbaGFzaFswXV0gPSBoYXNoWzFdO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuICAgIHJldHVybiB2YXJzO1xyXG59O1xyXG4iLCIvKipcclxuICAgIFNldCBvZiB1dGlsaXRpZXMgdG8gZGVmaW5lIEphdmFzY3JpcHQgUHJvcGVydGllc1xyXG4gICAgaW5kZXBlbmRlbnRseSBvZiB0aGUgYnJvd3Nlci5cclxuICAgIFxyXG4gICAgQWxsb3dzIHRvIGRlZmluZSBnZXR0ZXJzIGFuZCBzZXR0ZXJzLlxyXG4gICAgXHJcbiAgICBBZGFwdGVkIGNvZGUgZnJvbSB0aGUgb3JpZ2luYWwgY3JlYXRlZCBieSBKZWZmIFdhbGRlblxyXG4gICAgaHR0cDovL3doZXJlc3dhbGRlbi5jb20vMjAxMC8wNC8xNi9tb3JlLXNwaWRlcm1vbmtleS1jaGFuZ2VzLWFuY2llbnQtZXNvdGVyaWMtdmVyeS1yYXJlbHktdXNlZC1zeW50YXgtZm9yLWNyZWF0aW5nLWdldHRlcnMtYW5kLXNldHRlcnMtaXMtYmVpbmctcmVtb3ZlZC9cclxuKiovXHJcbid1c2Ugc3RyaWN0JztcclxuXHJcbmZ1bmN0aW9uIGFjY2Vzc29yRGVzY3JpcHRvcihmaWVsZCwgZnVuKVxyXG57XHJcbiAgICB2YXIgZGVzYyA9IHsgZW51bWVyYWJsZTogdHJ1ZSwgY29uZmlndXJhYmxlOiB0cnVlIH07XHJcbiAgICBkZXNjW2ZpZWxkXSA9IGZ1bjtcclxuICAgIHJldHVybiBkZXNjO1xyXG59XHJcblxyXG5mdW5jdGlvbiBkZWZpbmVHZXR0ZXIob2JqLCBwcm9wLCBnZXQpXHJcbntcclxuICAgIGlmIChPYmplY3QuZGVmaW5lUHJvcGVydHkpXHJcbiAgICAgICAgcmV0dXJuIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShvYmosIHByb3AsIGFjY2Vzc29yRGVzY3JpcHRvcihcImdldFwiLCBnZXQpKTtcclxuICAgIGlmIChPYmplY3QucHJvdG90eXBlLl9fZGVmaW5lR2V0dGVyX18pXHJcbiAgICAgICAgcmV0dXJuIG9iai5fX2RlZmluZUdldHRlcl9fKHByb3AsIGdldCk7XHJcblxyXG4gICAgdGhyb3cgbmV3IEVycm9yKFwiYnJvd3NlciBkb2VzIG5vdCBzdXBwb3J0IGdldHRlcnNcIik7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIGRlZmluZVNldHRlcihvYmosIHByb3AsIHNldClcclxue1xyXG4gICAgaWYgKE9iamVjdC5kZWZpbmVQcm9wZXJ0eSlcclxuICAgICAgICByZXR1cm4gT2JqZWN0LmRlZmluZVByb3BlcnR5KG9iaiwgcHJvcCwgYWNjZXNzb3JEZXNjcmlwdG9yKFwic2V0XCIsIHNldCkpO1xyXG4gICAgaWYgKE9iamVjdC5wcm90b3R5cGUuX19kZWZpbmVTZXR0ZXJfXylcclxuICAgICAgICByZXR1cm4gb2JqLl9fZGVmaW5lU2V0dGVyX18ocHJvcCwgc2V0KTtcclxuXHJcbiAgICB0aHJvdyBuZXcgRXJyb3IoXCJicm93c2VyIGRvZXMgbm90IHN1cHBvcnQgc2V0dGVyc1wiKTtcclxufVxyXG5cclxubW9kdWxlLmV4cG9ydHMgPSB7XHJcbiAgICBkZWZpbmVHZXR0ZXI6IGRlZmluZUdldHRlcixcclxuICAgIGRlZmluZVNldHRlcjogZGVmaW5lU2V0dGVyXHJcbn07XHJcbiIsIi8qKlxyXG4gICAgRG9tSXRlbXNNYW5hZ2VyIGNsYXNzLCB0aGF0IG1hbmFnZSBhIGNvbGxlY3Rpb24gXHJcbiAgICBvZiBIVE1ML0RPTSBpdGVtcyB1bmRlciBhIHJvb3QvY29udGFpbmVyLCB3aGVyZVxyXG4gICAgb25seSBvbmUgZWxlbWVudCBhdCB0aGUgdGltZSBpcyB2aXNpYmxlLCBwcm92aWRpbmdcclxuICAgIHRvb2xzIHRvIHVuaXF1ZXJseSBpZGVudGlmeSB0aGUgaXRlbXMsXHJcbiAgICB0byBjcmVhdGUgb3IgdXBkYXRlIG5ldyBpdGVtcyAodGhyb3VnaCAnaW5qZWN0JyksXHJcbiAgICBnZXQgdGhlIGN1cnJlbnQsIGZpbmQgYnkgdGhlIElEIGFuZCBtb3JlLlxyXG4qKi9cclxuJ3VzZSBzdHJpY3QnO1xyXG5cclxudmFyICQgPSByZXF1aXJlKCdqcXVlcnknKTtcclxudmFyIGVzY2FwZVNlbGVjdG9yID0gcmVxdWlyZSgnLi4vZXNjYXBlU2VsZWN0b3InKTtcclxuXHJcbmZ1bmN0aW9uIERvbUl0ZW1zTWFuYWdlcihzZXR0aW5ncykge1xyXG5cclxuICAgIHRoaXMuaWRBdHRyaWJ1dGVOYW1lID0gc2V0dGluZ3MuaWRBdHRyaWJ1dGVOYW1lIHx8ICdpZCc7XHJcbiAgICB0aGlzLmFsbG93RHVwbGljYXRlcyA9ICEhc2V0dGluZ3MuYWxsb3dEdXBsaWNhdGVzIHx8IGZhbHNlO1xyXG4gICAgdGhpcy4kcm9vdCA9IG51bGw7XHJcbiAgICAvLyBPbiBwYWdlIHJlYWR5LCBnZXQgdGhlIHJvb3QgZWxlbWVudDpcclxuICAgICQoZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgdGhpcy4kcm9vdCA9ICQoc2V0dGluZ3Mucm9vdCB8fCAnYm9keScpO1xyXG4gICAgfS5iaW5kKHRoaXMpKTtcclxufVxyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBEb21JdGVtc01hbmFnZXI7XHJcblxyXG5Eb21JdGVtc01hbmFnZXIucHJvdG90eXBlLmZpbmQgPSBmdW5jdGlvbiBmaW5kKGNvbnRhaW5lck5hbWUsIHJvb3QpIHtcclxuICAgIHZhciAkcm9vdCA9ICQocm9vdCB8fCB0aGlzLiRyb290KTtcclxuICAgIHJldHVybiAkcm9vdC5maW5kKCdbJyArIHRoaXMuaWRBdHRyaWJ1dGVOYW1lICsgJz1cIicgKyBlc2NhcGVTZWxlY3Rvcihjb250YWluZXJOYW1lKSArICdcIl0nKTtcclxufTtcclxuXHJcbkRvbUl0ZW1zTWFuYWdlci5wcm90b3R5cGUuZ2V0QWN0aXZlID0gZnVuY3Rpb24gZ2V0QWN0aXZlKCkge1xyXG4gICAgcmV0dXJuIHRoaXMuJHJvb3QuZmluZCgnWycgKyB0aGlzLmlkQXR0cmlidXRlTmFtZSArICddOnZpc2libGUnKTtcclxufTtcclxuXHJcbi8qKlxyXG4gICAgSXQgYWRkcyB0aGUgaXRlbSBpbiB0aGUgaHRtbCBwcm92aWRlZCAoY2FuIGJlIG9ubHkgdGhlIGVsZW1lbnQgb3IgXHJcbiAgICBjb250YWluZWQgaW4gYW5vdGhlciBvciBhIGZ1bGwgaHRtbCBwYWdlKS5cclxuICAgIFJlcGxhY2VzIGFueSBleGlzdGFudCBpZiBkdXBsaWNhdGVzIGFyZSBub3QgYWxsb3dlZC5cclxuKiovXHJcbkRvbUl0ZW1zTWFuYWdlci5wcm90b3R5cGUuaW5qZWN0ID0gZnVuY3Rpb24gaW5qZWN0KG5hbWUsIGh0bWwpIHtcclxuXHJcbiAgICAvLyBGaWx0ZXJpbmcgaW5wdXQgaHRtbCAoY2FuIGJlIHBhcnRpYWwgb3IgZnVsbCBwYWdlcylcclxuICAgIC8vIGh0dHA6Ly9zdGFja292ZXJmbG93LmNvbS9hLzEyODQ4Nzk4XHJcbiAgICBodG1sID0gaHRtbC5yZXBsYWNlKC9eW1xcc1xcU10qPGJvZHkuKj8+fDxcXC9ib2R5PltcXHNcXFNdKiQvZywgJycpO1xyXG5cclxuICAgIC8vIENyZWF0aW5nIGEgd3JhcHBlciBhcm91bmQgdGhlIGh0bWxcclxuICAgIC8vIChjYW4gYmUgcHJvdmlkZWQgdGhlIGlubmVySHRtbCBvciBvdXRlckh0bWwsIGRvZXNuJ3QgbWF0dGVycyB3aXRoIG5leHQgYXBwcm9hY2gpXHJcbiAgICB2YXIgJGh0bWwgPSAkKCc8ZGl2Lz4nLCB7IGh0bWw6IGh0bWwgfSksXHJcbiAgICAgICAgLy8gV2UgbG9vayBmb3IgdGhlIGNvbnRhaW5lciBlbGVtZW50ICh3aGVuIHRoZSBvdXRlckh0bWwgaXMgcHJvdmlkZWQpXHJcbiAgICAgICAgJGMgPSB0aGlzLmZpbmQobmFtZSwgJGh0bWwpO1xyXG5cclxuICAgIGlmICgkYy5sZW5ndGggPT09IDApIHtcclxuICAgICAgICAvLyBJdHMgaW5uZXJIdG1sLCBzbyB0aGUgd3JhcHBlciBiZWNvbWVzIHRoZSBjb250YWluZXIgaXRzZWxmXHJcbiAgICAgICAgJGMgPSAkaHRtbC5hdHRyKHRoaXMuaWRBdHRyaWJ1dGVOYW1lLCBuYW1lKTtcclxuICAgIH1cclxuXHJcbiAgICBpZiAoIXRoaXMuYWxsb3dEdXBsaWNhdGVzKSB7XHJcbiAgICAgICAgLy8gTm8gbW9yZSB0aGFuIG9uZSBjb250YWluZXIgaW5zdGFuY2UgY2FuIGV4aXN0cyBhdCB0aGUgc2FtZSB0aW1lXHJcbiAgICAgICAgLy8gV2UgbG9vayBmb3IgYW55IGV4aXN0ZW50IG9uZSBhbmQgaXRzIHJlcGxhY2VkIHdpdGggdGhlIG5ld1xyXG4gICAgICAgIHZhciAkcHJldiA9IHRoaXMuZmluZChuYW1lKTtcclxuICAgICAgICBpZiAoJHByZXYubGVuZ3RoID4gMCkge1xyXG4gICAgICAgICAgICAkcHJldi5yZXBsYWNlV2l0aCgkYyk7XHJcbiAgICAgICAgICAgICRjID0gJHByZXY7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIC8vIEFkZCB0byB0aGUgZG9jdW1lbnRcclxuICAgIC8vIChvbiB0aGUgY2FzZSBvZiBkdXBsaWNhdGVkIGZvdW5kLCB0aGlzIHdpbGwgZG8gbm90aGluZywgbm8gd29ycnkpXHJcbiAgICAkYy5hcHBlbmRUbyh0aGlzLiRyb290KTtcclxufTtcclxuXHJcbi8qKiBcclxuICAgIFRoZSBzd2l0Y2ggbWV0aG9kIHJlY2VpdmUgdGhlIGl0ZW1zIHRvIGludGVyY2hhbmdlIGFzIGFjdGl2ZSBvciBjdXJyZW50LFxyXG4gICAgdGhlICdmcm9tJyBhbmQgJ3RvJywgYW5kIHRoZSBzaGVsbCBpbnN0YW5jZSB0aGF0IE1VU1QgYmUgdXNlZFxyXG4gICAgdG8gbm90aWZ5IGVhY2ggZXZlbnQgdGhhdCBpbnZvbHZlcyB0aGUgaXRlbTpcclxuICAgIHdpbGxDbG9zZSwgd2lsbE9wZW4sIHJlYWR5LCBvcGVuZWQsIGNsb3NlZC5cclxuICAgIEl0IHJlY2VpdmVzIGFzIGxhdGVzdCBwYXJhbWV0ZXIgdGhlICdub3RpZmljYXRpb24nIG9iamVjdCB0aGF0IG11c3QgYmVcclxuICAgIHBhc3NlZCB3aXRoIHRoZSBldmVudCBzbyBoYW5kbGVycyBoYXMgY29udGV4dCBzdGF0ZSBpbmZvcm1hdGlvbi5cclxuICAgIFxyXG4gICAgSXQncyBkZXNpZ25lZCB0byBiZSBhYmxlIHRvIG1hbmFnZSB0cmFuc2l0aW9ucywgYnV0IHRoaXMgZGVmYXVsdFxyXG4gICAgaW1wbGVtZW50YXRpb24gaXMgYXMgc2ltcGxlIGFzICdzaG93IHRoZSBuZXcgYW5kIGhpZGUgdGhlIG9sZCcuXHJcbioqL1xyXG5Eb21JdGVtc01hbmFnZXIucHJvdG90eXBlLnN3aXRjaCA9IGZ1bmN0aW9uIHN3aXRjaEFjdGl2ZUl0ZW0oJGZyb20sICR0bywgc2hlbGwsIG5vdGlmaWNhdGlvbikge1xyXG5cclxuICAgIGlmICghJHRvLmlzKCc6dmlzaWJsZScpKSB7XHJcbiAgICAgICAgc2hlbGwuZW1pdChzaGVsbC5ldmVudHMud2lsbE9wZW4sICR0bywgbm90aWZpY2F0aW9uKTtcclxuICAgICAgICAkdG8uc2hvdygpO1xyXG4gICAgICAgIC8vIEl0cyBlbm91Z2ggdmlzaWJsZSBhbmQgaW4gRE9NIHRvIHBlcmZvcm0gaW5pdGlhbGl6YXRpb24gdGFza3NcclxuICAgICAgICAvLyB0aGF0IG1heSBpbnZvbHZlIGxheW91dCBpbmZvcm1hdGlvblxyXG4gICAgICAgIHNoZWxsLmVtaXQoc2hlbGwuZXZlbnRzLml0ZW1SZWFkeSwgJHRvLCBub3RpZmljYXRpb24pO1xyXG4gICAgICAgIC8vIFdoZW4gaXRzIGNvbXBsZXRlbHkgb3BlbmVkXHJcbiAgICAgICAgc2hlbGwuZW1pdChzaGVsbC5ldmVudHMub3BlbmVkLCAkdG8sIG5vdGlmaWNhdGlvbik7XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICAgIC8vIEl0cyByZWFkeTsgbWF5YmUgaXQgd2FzIGJ1dCBzdWItbG9jYXRpb25cclxuICAgICAgICAvLyBvciBzdGF0ZSBjaGFuZ2UgbmVlZCB0byBiZSBjb21tdW5pY2F0ZWRcclxuICAgICAgICBzaGVsbC5lbWl0KHNoZWxsLmV2ZW50cy5pdGVtUmVhZHksICR0bywgbm90aWZpY2F0aW9uKTtcclxuICAgIH1cclxuXHJcbiAgICBpZiAoJGZyb20uaXMoJzp2aXNpYmxlJykpIHtcclxuICAgICAgICBzaGVsbC5lbWl0KHNoZWxsLmV2ZW50cy53aWxsQ2xvc2UsICRmcm9tLCBub3RpZmljYXRpb24pO1xyXG4gICAgICAgIC8vIERvICd1bmZvY3VzJyBvbiB0aGUgaGlkZGVuIGVsZW1lbnQgYWZ0ZXIgbm90aWZ5ICd3aWxsQ2xvc2UnXHJcbiAgICAgICAgLy8gZm9yIGJldHRlciBVWDogaGlkZGVuIGVsZW1lbnRzIGFyZSBub3QgcmVhY2hhYmxlIGFuZCBoYXMgZ29vZFxyXG4gICAgICAgIC8vIHNpZGUgZWZmZWN0cyBsaWtlIGhpZGRpbmcgdGhlIG9uLXNjcmVlbiBrZXlib2FyZCBpZiBhbiBpbnB1dCB3YXNcclxuICAgICAgICAvLyBmb2N1c2VkXHJcbiAgICAgICAgJGZyb20uZmluZCgnOmZvY3VzJykuYmx1cigpO1xyXG4gICAgICAgIC8vIGhpZGUgYW5kIG5vdGlmeSBpdCBlbmRlZFxyXG4gICAgICAgICRmcm9tLmhpZGUoKTtcclxuICAgICAgICBzaGVsbC5lbWl0KHNoZWxsLmV2ZW50cy5jbG9zZWQsICRmcm9tLCBub3RpZmljYXRpb24pO1xyXG4gICAgfVxyXG59O1xyXG5cclxuLyoqXHJcbiAgICBJbml0aWFsaXplcyB0aGUgbGlzdCBvZiBpdGVtcy4gTm8gbW9yZSB0aGFuIG9uZVxyXG4gICAgbXVzdCBiZSBvcGVuZWQvdmlzaWJsZSBhdCB0aGUgc2FtZSB0aW1lLCBzbyBhdCB0aGUgXHJcbiAgICBpbml0IGFsbCB0aGUgZWxlbWVudHMgYXJlIGNsb3NlZCB3YWl0aW5nIHRvIHNldFxyXG4gICAgb25lIGFzIHRoZSBhY3RpdmUgb3IgdGhlIGN1cnJlbnQgb25lLlxyXG4qKi9cclxuRG9tSXRlbXNNYW5hZ2VyLnByb3RvdHlwZS5pbml0ID0gZnVuY3Rpb24gaW5pdCgpIHtcclxuICAgIHRoaXMuZ2V0QWN0aXZlKCkuaGlkZSgpO1xyXG59O1xyXG4iLCIvKipcclxuICAgIEphdmFzY3JpdHAgU2hlbGwgZm9yIFNQQXMuXHJcbioqL1xyXG4vKmdsb2JhbCB3aW5kb3csIGRvY3VtZW50ICovXHJcbid1c2Ugc3RyaWN0JztcclxuXHJcbi8qKiBESSBlbnRyeSBwb2ludHMgZm9yIGRlZmF1bHQgYnVpbGRzLiBNb3N0IGRlcGVuZGVuY2llcyBjYW4gYmVcclxuICAgIHNwZWNpZmllZCBpbiB0aGUgY29uc3RydWN0b3Igc2V0dGluZ3MgZm9yIHBlci1pbnN0YW5jZSBzZXR1cC5cclxuKiovXHJcbnZhciBkZXBzID0gcmVxdWlyZSgnLi9kZXBlbmRlbmNpZXMnKTtcclxuXHJcbi8qKiBDb25zdHJ1Y3RvciAqKi9cclxuXHJcbmZ1bmN0aW9uIFNoZWxsKHNldHRpbmdzKSB7XHJcbiAgICAvL2pzaGludCBtYXhjb21wbGV4aXR5OjE0XHJcbiAgICBcclxuICAgIGRlcHMuRXZlbnRFbWl0dGVyLmNhbGwodGhpcyk7XHJcblxyXG4gICAgdGhpcy4kID0gc2V0dGluZ3MuanF1ZXJ5IHx8IGRlcHMuanF1ZXJ5O1xyXG4gICAgdGhpcy4kcm9vdCA9IHRoaXMuJChzZXR0aW5ncy5yb290KTtcclxuICAgIHRoaXMuYmFzZVVybCA9IHNldHRpbmdzLmJhc2VVcmwgfHwgJyc7XHJcbiAgICAvLyBXaXRoIGZvcmNlSGFzaGJhbmc9dHJ1ZTpcclxuICAgIC8vIC0gZnJhZ21lbnRzIFVSTHMgY2Fubm90IGJlIHVzZWQgdG8gc2Nyb2xsIHRvIGFuIGVsZW1lbnQgKGRlZmF1bHQgYnJvd3NlciBiZWhhdmlvciksXHJcbiAgICAvLyAgIHRoZXkgYXJlIGRlZmF1bHRQcmV2ZW50ZWQgdG8gYXZvaWQgY29uZnVzZSB0aGUgcm91dGluZyBtZWNoYW5pc20gYW5kIGN1cnJlbnQgVVJMLlxyXG4gICAgLy8gLSBwcmVzc2VkIGxpbmtzIHRvIGZyYWdtZW50cyBVUkxzIGFyZSBub3Qgcm91dGVkLCB0aGV5IGFyZSBza2lwcGVkIHNpbGVudGx5XHJcbiAgICAvLyAgIGV4Y2VwdCB3aGVuIHRoZXkgYXJlIGEgaGFzaGJhbmcgKCMhKS4gVGhpcyB3YXksIHNwZWNpYWwgbGlua3NcclxuICAgIC8vICAgdGhhdCBwZXJmb3JtbiBqcyBhY3Rpb25zIGRvZXNuJ3QgY29uZmxpdHMuXHJcbiAgICAvLyAtIGFsbCBVUkxzIHJvdXRlZCB0aHJvdWdoIHRoZSBzaGVsbCBpbmNsdWRlcyBhIGhhc2hiYW5nICgjISksIHRoZSBzaGVsbCBlbnN1cmVzXHJcbiAgICAvLyAgIHRoYXQgaGFwcGVucyBieSBhcHBlbmRpbmcgdGhlIGhhc2hiYW5nIHRvIGFueSBVUkwgcGFzc2VkIGluIChleGNlcHQgdGhlIHN0YW5kYXJkIGhhc2hcclxuICAgIC8vICAgdGhhdCBhcmUgc2tpcHQpLlxyXG4gICAgdGhpcy5mb3JjZUhhc2hiYW5nID0gc2V0dGluZ3MuZm9yY2VIYXNoYmFuZyB8fCBmYWxzZTtcclxuICAgIHRoaXMubGlua0V2ZW50ID0gc2V0dGluZ3MubGlua0V2ZW50IHx8ICdjbGljayc7XHJcbiAgICB0aGlzLnBhcnNlVXJsID0gKHNldHRpbmdzLnBhcnNlVXJsIHx8IGRlcHMucGFyc2VVcmwpLmJpbmQodGhpcywgdGhpcy5iYXNlVXJsKTtcclxuICAgIHRoaXMuYWJzb2x1dGl6ZVVybCA9IChzZXR0aW5ncy5hYnNvbHV0aXplVXJsIHx8IGRlcHMuYWJzb2x1dGl6ZVVybCkuYmluZCh0aGlzLCB0aGlzLmJhc2VVcmwpO1xyXG5cclxuICAgIHRoaXMuaGlzdG9yeSA9IHNldHRpbmdzLmhpc3RvcnkgfHwgd2luZG93Lmhpc3Rvcnk7XHJcblxyXG4gICAgdGhpcy5pbmRleE5hbWUgPSBzZXR0aW5ncy5pbmRleE5hbWUgfHwgJ2luZGV4JztcclxuICAgIFxyXG4gICAgdGhpcy5pdGVtcyA9IHNldHRpbmdzLmRvbUl0ZW1zTWFuYWdlcjtcclxuXHJcbiAgICAvLyBsb2FkZXIgY2FuIGJlIGRpc2FibGVkIHBhc3NpbmcgJ251bGwnLCBzbyB3ZSBtdXN0XHJcbiAgICAvLyBlbnN1cmUgdG8gbm90IHVzZSB0aGUgZGVmYXVsdCBvbiB0aGF0IGNhc2VzOlxyXG4gICAgdGhpcy5sb2FkZXIgPSB0eXBlb2Yoc2V0dGluZ3MubG9hZGVyKSA9PT0gJ3VuZGVmaW5lZCcgPyBkZXBzLmxvYWRlciA6IHNldHRpbmdzLmxvYWRlcjtcclxuICAgIC8vIGxvYWRlciBzZXR1cFxyXG4gICAgaWYgKHRoaXMubG9hZGVyKVxyXG4gICAgICAgIHRoaXMubG9hZGVyLmJhc2VVcmwgPSB0aGlzLmJhc2VVcmw7XHJcblxyXG4gICAgLy8gRGVmaW5pdGlvbiBvZiBldmVudHMgdGhhdCB0aGlzIG9iamVjdCBjYW4gdHJpZ2dlcixcclxuICAgIC8vIGl0cyB2YWx1ZSBjYW4gYmUgY3VzdG9taXplZCBidXQgYW55IGxpc3RlbmVyIG5lZWRzXHJcbiAgICAvLyB0byBrZWVwIHVwZGF0ZWQgdG8gdGhlIGNvcnJlY3QgZXZlbnQgc3RyaW5nLW5hbWUgdXNlZC5cclxuICAgIC8vIFRoZSBpdGVtcyBtYW5pcHVsYXRpb24gZXZlbnRzIE1VU1QgYmUgdHJpZ2dlcmVkXHJcbiAgICAvLyBieSB0aGUgJ2l0ZW1zLnN3aXRjaCcgZnVuY3Rpb25cclxuICAgIHRoaXMuZXZlbnRzID0ge1xyXG4gICAgICAgIHdpbGxPcGVuOiAnc2hlbGwtd2lsbC1vcGVuJyxcclxuICAgICAgICB3aWxsQ2xvc2U6ICdzaGVsbC13aWxsLWNsb3NlJyxcclxuICAgICAgICBpdGVtUmVhZHk6ICdzaGVsbC1pdGVtLXJlYWR5JyxcclxuICAgICAgICBjbG9zZWQ6ICdzaGVsbC1jbG9zZWQnLFxyXG4gICAgICAgIG9wZW5lZDogJ3NoZWxsLW9wZW5lZCdcclxuICAgIH07XHJcbiAgICBcclxuICAgIC8qKlxyXG4gICAgICAgIEEgZnVuY3Rpb24gdG8gZGVjaWRlIGlmIHRoZVxyXG4gICAgICAgIGFjY2VzcyBpcyBhbGxvd2VkIChyZXR1cm5zICdudWxsJylcclxuICAgICAgICBvciBub3QgKHJldHVybiBhIHN0YXRlIG9iamVjdCB3aXRoIGluZm9ybWF0aW9uXHJcbiAgICAgICAgdGhhdCB3aWxsIGJlIHBhc3NlZCB0byB0aGUgJ25vbkFjY2Vzc05hbWUnIGl0ZW07XHJcbiAgICAgICAgdGhlICdyb3V0ZScgcHJvcGVydHkgb24gdGhlIHN0YXRlIGlzIGF1dG9tYXRpY2FsbHkgZmlsbGVkKS5cclxuICAgICAgICBcclxuICAgICAgICBUaGUgZGVmYXVsdCBidWl0LWluIGp1c3QgYWxsb3cgZXZlcnl0aGluZyBcclxuICAgICAgICBieSBqdXN0IHJldHVybmluZyAnbnVsbCcgYWxsIHRoZSB0aW1lLlxyXG4gICAgICAgIFxyXG4gICAgICAgIEl0IHJlY2VpdmVzIGFzIHBhcmFtZXRlciB0aGUgc3RhdGUgb2JqZWN0LFxyXG4gICAgICAgIHRoYXQgYWxtb3N0IGNvbnRhaW5zIHRoZSAncm91dGUnIHByb3BlcnR5IHdpdGhcclxuICAgICAgICBpbmZvcm1hdGlvbiBhYm91dCB0aGUgVVJMLlxyXG4gICAgKiovXHJcbiAgICB0aGlzLmFjY2Vzc0NvbnRyb2wgPSBzZXR0aW5ncy5hY2Nlc3NDb250cm9sIHx8IGRlcHMuYWNjZXNzQ29udHJvbDtcclxuICAgIC8vIFdoYXQgaXRlbSBsb2FkIG9uIG5vbiBhY2Nlc3NcclxuICAgIHRoaXMubm9uQWNjZXNzTmFtZSA9IHNldHRpbmdzLm5vbkFjY2Vzc05hbWUgfHwgJ2luZGV4JztcclxufVxyXG5cclxuLy8gU2hlbGwgaW5oZXJpdHMgZnJvbSBFdmVudEVtaXR0ZXJcclxuU2hlbGwucHJvdG90eXBlID0gT2JqZWN0LmNyZWF0ZShkZXBzLkV2ZW50RW1pdHRlci5wcm90b3R5cGUsIHtcclxuICAgIGNvbnN0cnVjdG9yOiB7XHJcbiAgICAgICAgdmFsdWU6IFNoZWxsLFxyXG4gICAgICAgIGVudW1lcmFibGU6IGZhbHNlLFxyXG4gICAgICAgIHdyaXRhYmxlOiB0cnVlLFxyXG4gICAgICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZVxyXG4gICAgfVxyXG59KTtcclxuXHJcbm1vZHVsZS5leHBvcnRzID0gU2hlbGw7XHJcblxyXG5cclxuLyoqIEFQSSBkZWZpbml0aW9uICoqL1xyXG5cclxuU2hlbGwucHJvdG90eXBlLmdvID0gZnVuY3Rpb24gZ28odXJsLCBzdGF0ZSkge1xyXG5cclxuICAgIGlmICh0aGlzLmZvcmNlSGFzaGJhbmcpIHtcclxuICAgICAgICBpZiAoIS9eIyEvLnRlc3QodXJsKSkge1xyXG4gICAgICAgICAgICB1cmwgPSAnIyEnICsgdXJsO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuICAgIGVsc2Uge1xyXG4gICAgICAgIHVybCA9IHRoaXMuYWJzb2x1dGl6ZVVybCh1cmwpO1xyXG4gICAgfVxyXG4gICAgdGhpcy5oaXN0b3J5LnB1c2hTdGF0ZShzdGF0ZSwgdW5kZWZpbmVkLCB1cmwpO1xyXG4gICAgLy8gcHVzaFN0YXRlIGRvIE5PVCB0cmlnZ2VyIHRoZSBwb3BzdGF0ZSBldmVudCwgc29cclxuICAgIHJldHVybiB0aGlzLnJlcGxhY2Uoc3RhdGUpO1xyXG59O1xyXG5cclxuU2hlbGwucHJvdG90eXBlLmdvQmFjayA9IGZ1bmN0aW9uIGdvQmFjayhzdGF0ZSwgc3RlcHMpIHtcclxuICAgIHN0ZXBzID0gMCAtIChzdGVwcyB8fCAxKTtcclxuICAgIC8vIElmIHRoZXJlIGlzIG5vdGhpbmcgdG8gZ28tYmFjayBvciBub3QgZW5vdWdodFxyXG4gICAgLy8gJ2JhY2snIHN0ZXBzLCBnbyB0byB0aGUgaW5kZXhcclxuICAgIGlmIChzdGVwcyA8IDAgJiYgTWF0aC5hYnMoc3RlcHMpID49IHRoaXMuaGlzdG9yeS5sZW5ndGgpIHtcclxuICAgICAgICB0aGlzLmdvKHRoaXMuaW5kZXhOYW1lKTtcclxuICAgIH1cclxuICAgIGVsc2Uge1xyXG4gICAgICAgIC8vIE9uIHJlcGxhY2UsIHRoZSBwYXNzZWQgc3RhdGUgaXMgbWVyZ2VkIHdpdGhcclxuICAgICAgICAvLyB0aGUgb25lIHRoYXQgY29tZXMgZnJvbSB0aGUgc2F2ZWQgaGlzdG9yeVxyXG4gICAgICAgIC8vIGVudHJ5IChpdCAncG9wcycgd2hlbiBkb2luZyB0aGUgaGlzdG9yeS5nbygpKVxyXG4gICAgICAgIHRoaXMuX3BlbmRpbmdTdGF0ZVVwZGF0ZSA9IHN0YXRlO1xyXG4gICAgICAgIHRoaXMuaGlzdG9yeS5nbyhzdGVwcyk7XHJcbiAgICB9XHJcbn07XHJcblxyXG4vKipcclxuICAgIFByb2Nlc3MgdGhlIGdpdmVuIHN0YXRlIGluIG9yZGVyIHRvIGdldCB0aGUgY3VycmVudCBzdGF0ZVxyXG4gICAgYmFzZWQgb24gdGhhdCBvciB0aGUgc2F2ZWQgaW4gaGlzdG9yeSwgbWVyZ2UgaXQgd2l0aFxyXG4gICAgYW55IHVwZGF0ZWQgc3RhdGUgcGVuZGluZyBhbmQgYWRkcyB0aGUgcm91dGUgaW5mb3JtYXRpb24sXHJcbiAgICByZXR1cm5pbmcgYW4gc3RhdGUgb2JqZWN0IHN1aXRhYmxlIHRvIHVzZS5cclxuKiovXHJcblNoZWxsLnByb3RvdHlwZS5nZXRVcGRhdGVkU3RhdGUgPSBmdW5jdGlvbiBnZXRVcGRhdGVkU3RhdGUoc3RhdGUpIHtcclxuICAgIC8qanNoaW50IG1heGNvbXBsZXhpdHk6IDggKi9cclxuICAgIFxyXG4gICAgLy8gRm9yIGN1cnJlbnQgdXNlcywgYW55IHBlbmRpbmdTdGF0ZVVwZGF0ZSBpcyB1c2VkIGFzXHJcbiAgICAvLyB0aGUgc3RhdGUsIHJhdGhlciB0aGFuIHRoZSBwcm92aWRlZCBvbmVcclxuICAgIHN0YXRlID0gdGhpcy5fcGVuZGluZ1N0YXRlVXBkYXRlIHx8IHN0YXRlIHx8IHRoaXMuaGlzdG9yeS5zdGF0ZSB8fCB7fTtcclxuICAgIFxyXG4gICAgLy8gVE9ETzogbW9yZSBhZHZhbmNlZCB1c2VzIG11c3QgYmUgdG8gdXNlIHRoZSAnc3RhdGUnIHRvXHJcbiAgICAvLyByZWNvdmVyIHRoZSBVSSBzdGF0ZSwgd2l0aCBhbnkgbWVzc2FnZSBmcm9tIG90aGVyIFVJXHJcbiAgICAvLyBwYXNzaW5nIGluIGEgd2F5IHRoYXQgYWxsb3cgdXBkYXRlIHRoZSBzdGF0ZSwgbm90XHJcbiAgICAvLyByZXBsYWNlIGl0IChmcm9tIHBlbmRpbmdTdGF0ZVVwZGF0ZSkuXHJcbiAgICAvKlxyXG4gICAgLy8gU3RhdGUgb3IgZGVmYXVsdCBzdGF0ZVxyXG4gICAgc3RhdGUgPSBzdGF0ZSB8fCB0aGlzLmhpc3Rvcnkuc3RhdGUgfHwge307XHJcbiAgICAvLyBtZXJnZSBwZW5kaW5nIHVwZGF0ZWQgc3RhdGVcclxuICAgIHRoaXMuJC5leHRlbmQoc3RhdGUsIHRoaXMuX3BlbmRpbmdTdGF0ZVVwZGF0ZSk7XHJcbiAgICAvLyBkaXNjYXJkIHRoZSB1cGRhdGVcclxuICAgICovXHJcbiAgICB0aGlzLl9wZW5kaW5nU3RhdGVVcGRhdGUgPSBudWxsO1xyXG4gICAgXHJcbiAgICAvLyBEb2Vzbid0IG1hdHRlcnMgaWYgc3RhdGUgaW5jbHVkZXMgYWxyZWFkeSBcclxuICAgIC8vICdyb3V0ZScgaW5mb3JtYXRpb24sIG5lZWQgdG8gYmUgb3ZlcndyaXR0ZW5cclxuICAgIC8vIHRvIG1hdGNoIHRoZSBjdXJyZW50IG9uZS5cclxuICAgIC8vIE5PVEU6IHByZXZpb3VzbHksIGEgY2hlY2sgcHJldmVudGVkIHRoaXMgaWZcclxuICAgIC8vIHJvdXRlIHByb3BlcnR5IGV4aXN0cywgY3JlYXRpbmcgaW5maW5pdGUgbG9vcHNcclxuICAgIC8vIG9uIHJlZGlyZWN0aW9ucyBmcm9tIGFjdGl2aXR5LnNob3cgc2luY2UgJ3JvdXRlJyBkb2Vzbid0XHJcbiAgICAvLyBtYXRjaCB0aGUgbmV3IGRlc2lyZWQgbG9jYXRpb25cclxuICAgIFxyXG4gICAgLy8gRGV0ZWN0IGlmIGlzIGEgaGFzaGJhbmcgVVJMIG9yIGFuIHN0YW5kYXJkIG9uZS5cclxuICAgIC8vIEV4Y2VwdCBpZiB0aGUgYXBwIGlzIGZvcmNlZCB0byB1c2UgaGFzaGJhbmcuXHJcbiAgICB2YXIgaXNIYXNoQmFuZyA9IC8jIS8udGVzdChsb2NhdGlvbi5ocmVmKSB8fCB0aGlzLmZvcmNlSGFzaGJhbmc7XHJcbiAgICBcclxuICAgIHZhciBsaW5rID0gKFxyXG4gICAgICAgIGlzSGFzaEJhbmcgP1xyXG4gICAgICAgIGxvY2F0aW9uLmhhc2ggOlxyXG4gICAgICAgIGxvY2F0aW9uLnBhdGhuYW1lXHJcbiAgICApICsgKGxvY2F0aW9uLnNlYXJjaCB8fCAnJyk7XHJcbiAgICBcclxuICAgIC8vIFNldCB0aGUgcm91dGVcclxuICAgIHN0YXRlLnJvdXRlID0gdGhpcy5wYXJzZVVybChsaW5rKTtcclxuICAgIFxyXG4gICAgcmV0dXJuIHN0YXRlO1xyXG59O1xyXG5cclxuU2hlbGwucHJvdG90eXBlLnJlcGxhY2UgPSBmdW5jdGlvbiByZXBsYWNlKHN0YXRlKSB7XHJcbiAgICBcclxuICAgIHN0YXRlID0gdGhpcy5nZXRVcGRhdGVkU3RhdGUoc3RhdGUpO1xyXG5cclxuICAgIC8vIFVzZSB0aGUgaW5kZXggb24gcm9vdCBjYWxsc1xyXG4gICAgaWYgKHN0YXRlLnJvdXRlLnJvb3QgPT09IHRydWUpIHtcclxuICAgICAgICBzdGF0ZS5yb3V0ZSA9IHRoaXMucGFyc2VVcmwodGhpcy5pbmRleE5hbWUpO1xyXG4gICAgfVxyXG4gICAgXHJcbiAgICAvLyBBY2Nlc3MgY29udHJvbFxyXG4gICAgdmFyIGFjY2Vzc0Vycm9yID0gdGhpcy5hY2Nlc3NDb250cm9sKHN0YXRlLnJvdXRlKTtcclxuICAgIGlmIChhY2Nlc3NFcnJvcikge1xyXG4gICAgICAgIHJldHVybiB0aGlzLmdvKHRoaXMubm9uQWNjZXNzTmFtZSwgYWNjZXNzRXJyb3IpO1xyXG4gICAgfVxyXG5cclxuICAgIC8vIExvY2F0aW5nIHRoZSBjb250YWluZXJcclxuICAgIHZhciAkY29udCA9IHRoaXMuaXRlbXMuZmluZChzdGF0ZS5yb3V0ZS5uYW1lKTtcclxuICAgIHZhciBzaGVsbCA9IHRoaXM7XHJcbiAgICB2YXIgcHJvbWlzZSA9IG51bGw7XHJcblxyXG4gICAgaWYgKCRjb250ICYmICRjb250Lmxlbmd0aCkge1xyXG4gICAgICAgIHByb21pc2UgPSBuZXcgUHJvbWlzZShmdW5jdGlvbihyZXNvbHZlLCByZWplY3QpIHtcclxuICAgICAgICAgICAgdHJ5IHtcclxuXHJcbiAgICAgICAgICAgICAgICB2YXIgJG9sZENvbnQgPSBzaGVsbC5pdGVtcy5nZXRBY3RpdmUoKTtcclxuICAgICAgICAgICAgICAgICRvbGRDb250ID0gJG9sZENvbnQubm90KCRjb250KTtcclxuICAgICAgICAgICAgICAgIHNoZWxsLml0ZW1zLnN3aXRjaCgkb2xkQ29udCwgJGNvbnQsIHNoZWxsLCBzdGF0ZSk7XHJcblxyXG4gICAgICAgICAgICAgICAgcmVzb2x2ZSgpOyAvLz8gcmVzb2x2ZShhY3QpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIGNhdGNoIChleCkge1xyXG4gICAgICAgICAgICAgICAgcmVqZWN0KGV4KTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH0pO1xyXG4gICAgfVxyXG4gICAgZWxzZSB7XHJcbiAgICAgICAgaWYgKHRoaXMubG9hZGVyKSB7XHJcbiAgICAgICAgICAgIC8vIGxvYWQgYW5kIGluamVjdCB0aGUgY29udGVudCBpbiB0aGUgcGFnZVxyXG4gICAgICAgICAgICAvLyB0aGVuIHRyeSB0aGUgcmVwbGFjZSBhZ2FpblxyXG4gICAgICAgICAgICBwcm9taXNlID0gdGhpcy5sb2FkZXIubG9hZChzdGF0ZS5yb3V0ZSkudGhlbihmdW5jdGlvbihodG1sKSB7XHJcbiAgICAgICAgICAgICAgICAvLyBBZGQgdG8gdGhlIGl0ZW1zICh0aGUgbWFuYWdlciB0YWtlcyBjYXJlIHlvdVxyXG4gICAgICAgICAgICAgICAgLy8gYWRkIG9ubHkgdGhlIGl0ZW0sIGlmIHRoZXJlIGlzIG9uZSlcclxuICAgICAgICAgICAgICAgIHNoZWxsLml0ZW1zLmluamVjdChzdGF0ZS5yb3V0ZS5uYW1lLCBodG1sKTtcclxuICAgICAgICAgICAgICAgIC8vIERvdWJsZSBjaGVjayB0aGF0IHRoZSBpdGVtIHdhcyBhZGRlZCBhbmQgaXMgcmVhZHlcclxuICAgICAgICAgICAgICAgIC8vIHRvIGF2b2lkIGFuIGluZmluaXRlIGxvb3AgYmVjYXVzZSBhIHJlcXVlc3Qgbm90IHJldHVybmluZ1xyXG4gICAgICAgICAgICAgICAgLy8gdGhlIGl0ZW0gYW5kIHRoZSAncmVwbGFjZScgdHJ5aW5nIHRvIGxvYWQgaXQgYWdhaW4sIGFuZCBhZ2FpbiwgYW5kLi5cclxuICAgICAgICAgICAgICAgIGlmIChzaGVsbC5pdGVtcy5maW5kKHN0YXRlLnJvdXRlLm5hbWUpLmxlbmd0aClcclxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gc2hlbGwucmVwbGFjZShzdGF0ZSk7XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgIH1cclxuICAgICAgICBlbHNlIHtcclxuICAgICAgICAgICAgdmFyIGVyciA9IG5ldyBFcnJvcignUGFnZSBub3QgZm91bmQgKCcgKyBzdGF0ZS5yb3V0ZS5uYW1lICsgJyknKTtcclxuICAgICAgICAgICAgY29uc29sZS53YXJuKCdTaGVsbCBQYWdlIG5vdCBmb3VuZCwgc3RhdGU6Jywgc3RhdGUpO1xyXG4gICAgICAgICAgICBwcm9taXNlID0gUHJvbWlzZS5yZWplY3QoZXJyKTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcbiAgICBcclxuICAgIHZhciB0aGlzU2hlbGwgPSB0aGlzO1xyXG4gICAgcHJvbWlzZS5jYXRjaChmdW5jdGlvbihlcnIpIHtcclxuICAgICAgICBpZiAoIShlcnIgaW5zdGFuY2VvZiBFcnJvcikpXHJcbiAgICAgICAgICAgIGVyciA9IG5ldyBFcnJvcihlcnIpO1xyXG5cclxuICAgICAgICAvLyBMb2cgZXJyb3IsIFxyXG4gICAgICAgIGNvbnNvbGUuZXJyb3IoJ1NoZWxsLCB1bmV4cGVjdGVkIGVycm9yLicsIGVycik7XHJcbiAgICAgICAgLy8gbm90aWZ5IGFzIGFuIGV2ZW50XHJcbiAgICAgICAgdGhpc1NoZWxsLmVtaXQoJ2Vycm9yJywgZXJyKTtcclxuICAgICAgICAvLyBhbmQgY29udGludWUgcHJvcGFnYXRpbmcgdGhlIGVycm9yXHJcbiAgICAgICAgcmV0dXJuIGVycjtcclxuICAgIH0pO1xyXG5cclxuICAgIHJldHVybiBwcm9taXNlO1xyXG59O1xyXG5cclxuU2hlbGwucHJvdG90eXBlLnJ1biA9IGZ1bmN0aW9uIHJ1bigpIHtcclxuXHJcbiAgICB2YXIgc2hlbGwgPSB0aGlzO1xyXG5cclxuICAgIC8vIENhdGNoIHBvcHN0YXRlIGV2ZW50IHRvIHVwZGF0ZSBzaGVsbCByZXBsYWNpbmcgdGhlIGFjdGl2ZSBjb250YWluZXIuXHJcbiAgICAvLyBBbGxvd3MgcG9seWZpbGxzIHRvIHByb3ZpZGUgYSBkaWZmZXJlbnQgYnV0IGVxdWl2YWxlbnQgZXZlbnQgbmFtZVxyXG4gICAgdGhpcy4kKHdpbmRvdykub24odGhpcy5oaXN0b3J5LnBvcHN0YXRlRXZlbnQgfHwgJ3BvcHN0YXRlJywgZnVuY3Rpb24oZXZlbnQpIHtcclxuICAgICAgICBcclxuICAgICAgICB2YXIgc3RhdGUgPSBldmVudC5zdGF0ZSB8fCBcclxuICAgICAgICAgICAgKGV2ZW50Lm9yaWdpbmFsRXZlbnQgJiYgZXZlbnQub3JpZ2luYWxFdmVudC5zdGF0ZSkgfHwgXHJcbiAgICAgICAgICAgIHNoZWxsLmhpc3Rvcnkuc3RhdGU7XHJcblxyXG4gICAgICAgIC8vIGdldCBzdGF0ZSBmb3IgY3VycmVudC4gVG8gc3VwcG9ydCBwb2x5ZmlsbHMsIHdlIHVzZSB0aGUgZ2VuZXJhbCBnZXR0ZXJcclxuICAgICAgICAvLyBoaXN0b3J5LnN0YXRlIGFzIGZhbGxiYWNrICh0aGV5IG11c3QgYmUgdGhlIHNhbWUgb24gYnJvd3NlcnMgc3VwcG9ydGluZyBIaXN0b3J5IEFQSSlcclxuICAgICAgICBzaGVsbC5yZXBsYWNlKHN0YXRlKTtcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIENhdGNoIGFsbCBsaW5rcyBpbiB0aGUgcGFnZSAobm90IG9ubHkgJHJvb3Qgb25lcykgYW5kIGxpa2UtbGlua3NcclxuICAgIHRoaXMuJChkb2N1bWVudCkub24odGhpcy5saW5rRXZlbnQsICdbaHJlZl0sIFtkYXRhLWhyZWZdJywgZnVuY3Rpb24oZSkge1xyXG4gICAgICAgIFxyXG4gICAgICAgIHZhciAkdCA9IHNoZWxsLiQodGhpcyksXHJcbiAgICAgICAgICAgIGhyZWYgPSAkdC5hdHRyKCdocmVmJykgfHwgJHQuZGF0YSgnaHJlZicpO1xyXG5cclxuICAgICAgICAvLyBEbyBub3RoaW5nIGlmIHRoZSBVUkwgY29udGFpbnMgdGhlIHByb3RvY29sXHJcbiAgICAgICAgaWYgKC9eW2Etel0rOi9pLnRlc3QoaHJlZikpIHtcclxuICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgIH1cclxuICAgICAgICBlbHNlIGlmIChzaGVsbC5mb3JjZUhhc2hiYW5nICYmIC9eIyhbXiFdfCQpLy50ZXN0KGhyZWYpKSB7XHJcbiAgICAgICAgICAgIC8vIFN0YW5kYXJkIGhhc2gsIGJ1dCBub3QgaGFzaGJhbmc6IGF2b2lkIHJvdXRpbmcgYW5kIGRlZmF1bHQgYmVoYXZpb3JcclxuICAgICAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xyXG4gICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBlLnByZXZlbnREZWZhdWx0KCk7XHJcbiAgICAgICAgLy8/IGUuc3RvcEltbWVkaWF0ZVByb3BhZ2F0aW9uKCk7XHJcblxyXG4gICAgICAgIHNoZWxsLmdvKGhyZWYpO1xyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gSW5pdGlhbGxpemUgc3RhdGVcclxuICAgIHRoaXMuaXRlbXMuaW5pdCgpO1xyXG4gICAgLy8gUm91dGUgdG8gdGhlIGN1cnJlbnQgdXJsL3N0YXRlXHJcbiAgICB0aGlzLnJlcGxhY2UoKTtcclxufTtcclxuIiwiLyoqXHJcbiAgICBhYnNvbHV0aXplVXJsIHV0aWxpdHkgXHJcbiAgICB0aGF0IGVuc3VyZXMgdGhlIHVybCBwcm92aWRlZFxyXG4gICAgYmVpbmcgaW4gdGhlIHBhdGggb2YgdGhlIGdpdmVuIGJhc2VVcmxcclxuKiovXHJcbid1c2Ugc3RyaWN0JztcclxuXHJcbnZhciBzYW5pdGl6ZVVybCA9IHJlcXVpcmUoJy4vc2FuaXRpemVVcmwnKSxcclxuICAgIGVzY2FwZVJlZ0V4cCA9IHJlcXVpcmUoJy4uL2VzY2FwZVJlZ0V4cCcpO1xyXG5cclxuZnVuY3Rpb24gYWJzb2x1dGl6ZVVybChiYXNlVXJsLCB1cmwpIHtcclxuXHJcbiAgICAvLyBzYW5pdGl6ZSBiZWZvcmUgY2hlY2tcclxuICAgIHVybCA9IHNhbml0aXplVXJsKHVybCk7XHJcblxyXG4gICAgLy8gQ2hlY2sgaWYgdXNlIHRoZSBiYXNlIGFscmVhZHlcclxuICAgIHZhciBtYXRjaEJhc2UgPSBuZXcgUmVnRXhwKCdeJyArIGVzY2FwZVJlZ0V4cChiYXNlVXJsKSwgJ2knKTtcclxuICAgIGlmIChtYXRjaEJhc2UudGVzdCh1cmwpKSB7XHJcbiAgICAgICAgcmV0dXJuIHVybDtcclxuICAgIH1cclxuXHJcbiAgICAvLyBidWlsZCBhbmQgc2FuaXRpemVcclxuICAgIHJldHVybiBzYW5pdGl6ZVVybChiYXNlVXJsICsgdXJsKTtcclxufVxyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBhYnNvbHV0aXplVXJsO1xyXG4iLCIvKipcclxuICAgIEV4dGVybmFsIGRlcGVuZGVuY2llcyBmb3IgU2hlbGwgaW4gYSBzZXBhcmF0ZSBtb2R1bGVcclxuICAgIHRvIHVzZSBhcyBESSwgbmVlZHMgc2V0dXAgYmVmb3JlIGNhbGwgdGhlIFNoZWxsLmpzXHJcbiAgICBtb2R1bGUgY2xhc3NcclxuKiovXHJcbid1c2Ugc3RyaWN0JztcclxuXHJcbm1vZHVsZS5leHBvcnRzID0ge1xyXG4gICAgcGFyc2VVcmw6IG51bGwsXHJcbiAgICBhYnNvbHV0aXplVXJsOiBudWxsLFxyXG4gICAganF1ZXJ5OiBudWxsLFxyXG4gICAgbG9hZGVyOiBudWxsLFxyXG4gICAgYWNjZXNzQ29udHJvbDogZnVuY3Rpb24gYWxsb3dBbGwobmFtZSkge1xyXG4gICAgICAgIC8vIGFsbG93IGFjY2VzcyBieSBkZWZhdWx0XHJcbiAgICAgICAgcmV0dXJuIG51bGw7XHJcbiAgICB9LFxyXG4gICAgRXZlbnRFbWl0dGVyOiBudWxsXHJcbn07XHJcbiIsIi8qKlxyXG4gICAgU2ltcGxlIGltcGxlbWVudGF0aW9uIG9mIHRoZSBIaXN0b3J5IEFQSSB1c2luZyBvbmx5IGhhc2hiYW5ncyBVUkxzLFxyXG4gICAgZG9lc24ndCBtYXR0ZXJzIHRoZSBicm93c2VyIHN1cHBvcnQuXHJcbiAgICBVc2VkIHRvIGF2b2lkIGZyb20gc2V0dGluZyBVUkxzIHRoYXQgaGFzIG5vdCBhbiBlbmQtcG9pbnQsXHJcbiAgICBsaWtlIGluIGxvY2FsIGVudmlyb25tZW50cyB3aXRob3V0IGEgc2VydmVyIGRvaW5nIHVybC1yZXdyaXRpbmcsXHJcbiAgICBpbiBwaG9uZWdhcCBhcHBzLCBvciB0byBjb21wbGV0ZWx5IGJ5LXBhc3MgYnJvd3NlciBzdXBwb3J0IGJlY2F1c2VcclxuICAgIGlzIGJ1Z2d5IChsaWtlIEFuZHJvaWQgPD0gNC4xKS5cclxuICAgIFxyXG4gICAgTk9URVM6XHJcbiAgICAtIEJyb3dzZXIgbXVzdCBzdXBwb3J0ICdoYXNoY2hhbmdlJyBldmVudC5cclxuICAgIC0gQnJvd3NlciBtdXN0IGhhcyBzdXBwb3J0IGZvciBzdGFuZGFyZCBKU09OIGNsYXNzLlxyXG4gICAgLSBSZWxpZXMgb24gc2Vzc2lvbnN0b3JhZ2UgZm9yIHBlcnNpc3RhbmNlLCBzdXBwb3J0ZWQgYnkgYWxsIGJyb3dzZXJzIGFuZCB3ZWJ2aWV3cyBcclxuICAgICAgZm9yIGEgZW5vdWdoIGxvbmcgdGltZSBub3cuXHJcbiAgICAtIFNpbWlsYXIgYXBwcm9hY2ggYXMgSGlzdG9yeS5qcyBwb2x5ZmlsbCwgYnV0IHNpbXBsaWZpZWQsIGFwcGVuZGluZyBhIGZha2UgcXVlcnlcclxuICAgICAgcGFyYW1ldGVyICdfc3VpZD0wJyB0byB0aGUgaGFzaCB2YWx1ZSAoYWN0dWFsIHF1ZXJ5IGdvZXMgYmVmb3JlIHRoZSBoYXNoLCBidXRcclxuICAgICAgd2UgbmVlZCBpdCBpbnNpZGUpLlxyXG4gICAgLSBGb3Igc2ltcGxpZmljYXRpb24sIG9ubHkgdGhlIHN0YXRlIGlzIHBlcnNpc3RlZCwgdGhlICd0aXRsZScgcGFyYW1ldGVyIGlzIG5vdFxyXG4gICAgICB1c2VkIGF0IGFsbCAodGhlIHNhbWUgYXMgbWFqb3IgYnJvd3NlcnMgZG8sIHNvIGlzIG5vdCBhIHByb2JsZW0pOyBpbiB0aGlzIGxpbmUsXHJcbiAgICAgIG9ubHkgaGlzdG9yeSBlbnRyaWVzIHdpdGggc3RhdGUgYXJlIHBlcnNpc3RlZC5cclxuKiovXHJcbi8vZ2xvYmFsIGxvY2F0aW9uXHJcbid1c2Ugc3RyaWN0JztcclxudmFyICQgPSByZXF1aXJlKCdqcXVlcnknKSxcclxuICAgIHNhbml0aXplVXJsID0gcmVxdWlyZSgnLi9zYW5pdGl6ZVVybCcpLFxyXG4gICAgZ2V0VXJsUXVlcnkgPSByZXF1aXJlKCcuLi9nZXRVcmxRdWVyeScpO1xyXG5cclxuLy8gSW5pdDogTG9hZCBzYXZlZCBjb3B5IGZyb20gc2Vzc2lvblN0b3JhZ2VcclxudmFyIHNlc3Npb24gPSBzZXNzaW9uU3RvcmFnZS5nZXRJdGVtKCdoYXNoYmFuZ0hpc3Rvcnkuc3RvcmUnKTtcclxuLy8gT3IgY3JlYXRlIGEgbmV3IG9uZVxyXG5pZiAoIXNlc3Npb24pIHtcclxuICAgIHNlc3Npb24gPSB7XHJcbiAgICAgICAgLy8gU3RhdGVzIGFycmF5IHdoZXJlIGVhY2ggaW5kZXggaXMgdGhlIFNVSUQgY29kZSBhbmQgdGhlXHJcbiAgICAgICAgLy8gdmFsdWUgaXMganVzdCB0aGUgdmFsdWUgcGFzc2VkIGFzIHN0YXRlIG9uIHB1c2hTdGF0ZS9yZXBsYWNlU3RhdGVcclxuICAgICAgICBzdGF0ZXM6IFtdXHJcbiAgICB9O1xyXG59XHJcbmVsc2Uge1xyXG4gICAgc2Vzc2lvbiA9IEpTT04ucGFyc2Uoc2Vzc2lvbik7XHJcbn1cclxuXHJcblxyXG4vKipcclxuICAgIEdldCB0aGUgU1VJRCBudW1iZXJcclxuICAgIGZyb20gYSBoYXNoIHN0cmluZ1xyXG4qKi9cclxuZnVuY3Rpb24gZ2V0U3VpZChoYXNoKSB7XHJcbiAgICBcclxuICAgIHZhciBzdWlkID0gK2dldFVybFF1ZXJ5KGhhc2gpLl9zdWlkO1xyXG4gICAgaWYgKGlzTmFOKHN1aWQpKVxyXG4gICAgICAgIHJldHVybiBudWxsO1xyXG4gICAgZWxzZVxyXG4gICAgICAgIHJldHVybiBzdWlkO1xyXG59XHJcblxyXG5mdW5jdGlvbiBzZXRTdWlkKGhhc2gsIHN1aWQpIHtcclxuICAgIFxyXG4gICAgLy8gV2UgbmVlZCB0aGUgcXVlcnksIHNpbmNlIHdlIG5lZWQgXHJcbiAgICAvLyB0byByZXBsYWNlIHRoZSBfc3VpZCAobWF5IGV4aXN0KVxyXG4gICAgLy8gYW5kIHJlY3JlYXRlIHRoZSBxdWVyeSBpbiB0aGVcclxuICAgIC8vIHJldHVybmVkIGhhc2gtdXJsXHJcbiAgICB2YXIgcXMgPSBnZXRVcmxRdWVyeShoYXNoKTtcclxuICAgIHFzLnB1c2goJ19zdWlkJyk7XHJcbiAgICBxcy5fc3VpZCA9IHN1aWQ7XHJcblxyXG4gICAgdmFyIHF1ZXJ5ID0gW107XHJcbiAgICBmb3IodmFyIGkgPSAwOyBpIDwgcXMubGVuZ3RoOyBpKyspIHtcclxuICAgICAgICBxdWVyeS5wdXNoKHFzW2ldICsgJz0nICsgZW5jb2RlVVJJQ29tcG9uZW50KHFzW3FzW2ldXSkpO1xyXG4gICAgfVxyXG4gICAgcXVlcnkgPSBxdWVyeS5qb2luKCcmJyk7XHJcbiAgICBcclxuICAgIGlmIChxdWVyeSkge1xyXG4gICAgICAgIHZhciBpbmRleCA9IGhhc2guaW5kZXhPZignPycpO1xyXG4gICAgICAgIGlmIChpbmRleCA+IC0xKVxyXG4gICAgICAgICAgICBoYXNoID0gaGFzaC5zdWJzdHIoMCwgaW5kZXgpO1xyXG4gICAgICAgIGhhc2ggKz0gJz8nICsgcXVlcnk7XHJcbiAgICB9XHJcblxyXG4gICAgcmV0dXJuIGhhc2g7XHJcbn1cclxuXHJcbi8qKlxyXG4gICAgQXNrIHRvIHBlcnNpc3QgdGhlIHNlc3Npb24gZGF0YS5cclxuICAgIEl0IGlzIGRvbmUgd2l0aCBhIHRpbWVvdXQgaW4gb3JkZXIgdG8gYXZvaWRcclxuICAgIGRlbGF5IGluIHRoZSBjdXJyZW50IHRhc2sgbWFpbmx5IGFueSBoYW5kbGVyXHJcbiAgICB0aGF0IGFjdHMgYWZ0ZXIgYSBIaXN0b3J5IGNoYW5nZS5cclxuKiovXHJcbmZ1bmN0aW9uIHBlcnNpc3QoKSB7XHJcbiAgICAvLyBFbm91Z2ggdGltZSB0byBhbGxvdyByb3V0aW5nIHRhc2tzLFxyXG4gICAgLy8gbW9zdCBhbmltYXRpb25zIGZyb20gZmluaXNoIGFuZCB0aGUgVUlcclxuICAgIC8vIGJlaW5nIHJlc3BvbnNpdmUuXHJcbiAgICAvLyBCZWNhdXNlIHNlc3Npb25TdG9yYWdlIGlzIHN5bmNocm9ub3VzLlxyXG4gICAgc2V0VGltZW91dChmdW5jdGlvbigpIHtcclxuICAgICAgICBzZXNzaW9uU3RvcmFnZS5zZXRJdGVtKCdoYXNoYmFuZ0hpc3Rvcnkuc3RvcmUnLCBKU09OLnN0cmluZ2lmeShzZXNzaW9uKSk7XHJcbiAgICB9LCAxNTAwKTtcclxufVxyXG5cclxuLyoqXHJcbiAgICBSZXR1cm5zIHRoZSBnaXZlbiBzdGF0ZSBvciBudWxsXHJcbiAgICBpZiBpcyBhbiBlbXB0eSBvYmplY3QuXHJcbioqL1xyXG5mdW5jdGlvbiBjaGVja1N0YXRlKHN0YXRlKSB7XHJcbiAgICBcclxuICAgIGlmIChzdGF0ZSkge1xyXG4gICAgICAgIC8vIGlzIGVtcHR5P1xyXG4gICAgICAgIGZvcih2YXIgaSBpbiBzdGF0ZSkge1xyXG4gICAgICAgICAgICAvLyBOb1xyXG4gICAgICAgICAgICByZXR1cm4gc3RhdGU7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIC8vIGl0cyBlbXB0eVxyXG4gICAgICAgIHJldHVybiBudWxsO1xyXG4gICAgfVxyXG4gICAgLy8gQW55dGhpbmcgZWxzZVxyXG4gICAgcmV0dXJuIHN0YXRlO1xyXG59XHJcblxyXG4vKipcclxuICAgIEdldCBhIGNhbm9uaWNhbCByZXByZXNlbnRhdGlvblxyXG4gICAgb2YgdGhlIFVSTCBzbyBjYW4gYmUgY29tcGFyZWRcclxuICAgIHdpdGggc3VjY2Vzcy5cclxuKiovXHJcbmZ1bmN0aW9uIGNhbm5vbmljYWxVcmwodXJsKSB7XHJcbiAgICBcclxuICAgIC8vIEF2b2lkIHNvbWUgYmFkIG9yIHByb2JsZW1hdGljIHN5bnRheFxyXG4gICAgdXJsID0gc2FuaXRpemVVcmwodXJsIHx8ICcnKTtcclxuICAgIFxyXG4gICAgLy8gR2V0IHRoZSBoYXNoIHBhcnRcclxuICAgIHZhciBpaGFzaCA9IHVybC5pbmRleE9mKCcjJyk7XHJcbiAgICBpZiAoaWhhc2ggPiAtMSkge1xyXG4gICAgICAgIHVybCA9IHVybC5zdWJzdHIoaWhhc2ggKyAxKTtcclxuICAgIH1cclxuICAgIC8vIE1heWJlIGEgaGFzaGJhbmcgVVJMLCByZW1vdmUgdGhlXHJcbiAgICAvLyAnYmFuZycgKHRoZSBoYXNoIHdhcyByZW1vdmVkIGFscmVhZHkpXHJcbiAgICB1cmwgPSB1cmwucmVwbGFjZSgvXiEvLCAnJyk7XHJcblxyXG4gICAgcmV0dXJuIHVybDtcclxufVxyXG5cclxuLyoqXHJcbiAgICBUcmFja3MgdGhlIGxhdGVzdCBVUkxcclxuICAgIGJlaW5nIHB1c2hlZCBvciByZXBsYWNlZCBieVxyXG4gICAgdGhlIEFQSS5cclxuICAgIFRoaXMgYWxsb3dzIGxhdGVyIHRvIGF2b2lkXHJcbiAgICB0cmlnZ2VyIHRoZSBwb3BzdGF0ZSBldmVudCxcclxuICAgIHNpbmNlIG11c3QgTk9UIGJlIHRyaWdnZXJlZFxyXG4gICAgYXMgYSByZXN1bHQgb2YgdGhhdCBBUEkgbWV0aG9kc1xyXG4qKi9cclxudmFyIGxhdGVzdFB1c2hlZFJlcGxhY2VkVXJsID0gbnVsbDtcclxuXHJcbi8qKlxyXG4gICAgSGlzdG9yeSBQb2x5ZmlsbFxyXG4qKi9cclxudmFyIGhhc2hiYW5nSGlzdG9yeSA9IHtcclxuICAgIHB1c2hTdGF0ZTogZnVuY3Rpb24gcHVzaFN0YXRlKHN0YXRlLCB0aXRsZSwgdXJsKSB7XHJcblxyXG4gICAgICAgIC8vIGNsZWFudXAgdXJsXHJcbiAgICAgICAgdXJsID0gY2Fubm9uaWNhbFVybCh1cmwpO1xyXG4gICAgICAgIFxyXG4gICAgICAgIC8vIHNhdmUgbmV3IHN0YXRlIGZvciB1cmxcclxuICAgICAgICBzdGF0ZSA9IGNoZWNrU3RhdGUoc3RhdGUpIHx8IG51bGw7XHJcbiAgICAgICAgaWYgKHN0YXRlICE9PSBudWxsKSB7XHJcbiAgICAgICAgICAgIC8vIHNhdmUgc3RhdGVcclxuICAgICAgICAgICAgc2Vzc2lvbi5zdGF0ZXMucHVzaChzdGF0ZSk7XHJcbiAgICAgICAgICAgIHZhciBzdWlkID0gc2Vzc2lvbi5zdGF0ZXMubGVuZ3RoIC0gMTtcclxuICAgICAgICAgICAgLy8gdXBkYXRlIFVSTCB3aXRoIHRoZSBzdWlkXHJcbiAgICAgICAgICAgIHVybCA9IHNldFN1aWQodXJsLCBzdWlkKTtcclxuICAgICAgICAgICAgLy8gY2FsbCB0byBwZXJzaXN0IHRoZSB1cGRhdGVkIHNlc3Npb25cclxuICAgICAgICAgICAgcGVyc2lzdCgpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBcclxuICAgICAgICBsYXRlc3RQdXNoZWRSZXBsYWNlZFVybCA9IHVybDtcclxuICAgICAgICBcclxuICAgICAgICAvLyB1cGRhdGUgbG9jYXRpb24gdG8gdHJhY2sgaGlzdG9yeTpcclxuICAgICAgICBsb2NhdGlvbi5oYXNoID0gJyMhJyArIHVybDtcclxuICAgIH0sXHJcbiAgICByZXBsYWNlU3RhdGU6IGZ1bmN0aW9uIHJlcGxhY2VTdGF0ZShzdGF0ZSwgdGl0bGUsIHVybCkge1xyXG4gICAgICAgIFxyXG4gICAgICAgIC8vIGNsZWFudXAgdXJsXHJcbiAgICAgICAgdXJsID0gY2Fubm9uaWNhbFVybCh1cmwpO1xyXG4gICAgICAgIFxyXG4gICAgICAgIC8vIGl0IGhhcyBzYXZlZCBzdGF0ZT9cclxuICAgICAgICB2YXIgc3VpZCA9IGdldFN1aWQodXJsKSxcclxuICAgICAgICAgICAgaGFzT2xkU3RhdGUgPSBzdWlkICE9PSBudWxsO1xyXG5cclxuICAgICAgICAvLyBzYXZlIG5ldyBzdGF0ZSBmb3IgdXJsXHJcbiAgICAgICAgc3RhdGUgPSBjaGVja1N0YXRlKHN0YXRlKSB8fCBudWxsO1xyXG4gICAgICAgIC8vIGl0cyBzYXZlZCBpZiB0aGVyZSBpcyBzb21ldGhpbmcgdG8gc2F2ZVxyXG4gICAgICAgIC8vIG9yIHNvbWV0aGluZyB0byBkZXN0cm95XHJcbiAgICAgICAgaWYgKHN0YXRlICE9PSBudWxsIHx8IGhhc09sZFN0YXRlKSB7XHJcbiAgICAgICAgICAgIC8vIHNhdmUgc3RhdGVcclxuICAgICAgICAgICAgaWYgKGhhc09sZFN0YXRlKSB7XHJcbiAgICAgICAgICAgICAgICAvLyByZXBsYWNlIGV4aXN0aW5nIHN0YXRlXHJcbiAgICAgICAgICAgICAgICBzZXNzaW9uLnN0YXRlc1tzdWlkXSA9IHN0YXRlO1xyXG4gICAgICAgICAgICAgICAgLy8gdGhlIHVybCByZW1haW5zIHRoZSBzYW1lXHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgZWxzZSB7XHJcbiAgICAgICAgICAgICAgICAvLyBjcmVhdGUgc3RhdGVcclxuICAgICAgICAgICAgICAgIHNlc3Npb24uc3RhdGVzLnB1c2goc3RhdGUpO1xyXG4gICAgICAgICAgICAgICAgc3VpZCA9IHNlc3Npb24uc3RhdGVzLmxlbmd0aCAtIDE7XHJcbiAgICAgICAgICAgICAgICAvLyB1cGRhdGUgVVJMIHdpdGggdGhlIHN1aWRcclxuICAgICAgICAgICAgICAgIHVybCA9IHNldFN1aWQodXJsLCBzdWlkKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAvLyBjYWxsIHRvIHBlcnNpc3QgdGhlIHVwZGF0ZWQgc2Vzc2lvblxyXG4gICAgICAgICAgICBwZXJzaXN0KCk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIFxyXG4gICAgICAgIGxhdGVzdFB1c2hlZFJlcGxhY2VkVXJsID0gdXJsO1xyXG5cclxuICAgICAgICAvLyB1cGRhdGUgbG9jYXRpb24gdG8gdHJhY2sgaGlzdG9yeTpcclxuICAgICAgICBsb2NhdGlvbi5oYXNoID0gJyMhJyArIHVybDtcclxuICAgIH0sXHJcbiAgICBnZXQgc3RhdGUoKSB7XHJcbiAgICBcclxuICAgICAgICAvLyBHZXQgbGF0ZXN0IHNhdmVkIHN0YXRlLCB0aGF0cyB0aGUgY3VycmVudCBvbmVcclxuICAgICAgICB2YXIgbGFzdCA9IHNlc3Npb24uc3RhdGVzLmxlbmd0aDtcclxuICAgICAgICBpZiAobGFzdCA9PT0gMClcclxuICAgICAgICAgICAgcmV0dXJuIG51bGw7XHJcbiAgICAgICAgZWxzZVxyXG4gICAgICAgICAgICByZXR1cm4gc2Vzc2lvbi5zdGF0ZXNbbGFzdCAtIDFdO1xyXG4gICAgfSxcclxuICAgIGdldCBsZW5ndGgoKSB7XHJcbiAgICAgICAgcmV0dXJuIHdpbmRvdy5oaXN0b3J5Lmxlbmd0aDtcclxuICAgIH0sXHJcbiAgICBnbzogZnVuY3Rpb24gZ28ob2Zmc2V0KSB7XHJcbiAgICAgICAgd2luZG93Lmhpc3RvcnkuZ28ob2Zmc2V0KTtcclxuICAgIH0sXHJcbiAgICBiYWNrOiBmdW5jdGlvbiBiYWNrKCkge1xyXG4gICAgICAgIHdpbmRvdy5oaXN0b3J5LmJhY2soKTtcclxuICAgIH0sXHJcbiAgICBmb3J3YXJkOiBmdW5jdGlvbiBmb3J3YXJkKCkge1xyXG4gICAgICAgIHdpbmRvdy5oaXN0b3J5LmZvcndhcmQoKTtcclxuICAgIH1cclxufTtcclxuXHJcbi8vIEF0dGFjaCBoYXNoY2FuZ2UgZXZlbnQgdG8gdHJpZ2dlciBIaXN0b3J5IEFQSSBldmVudCAncG9wc3RhdGUnXHJcbnZhciAkdyA9ICQod2luZG93KTtcclxuJHcub24oJ2hhc2hjaGFuZ2UnLCBmdW5jdGlvbihlKSB7XHJcbiAgICBcclxuICAgIHZhciB1cmwgPSBlLm9yaWdpbmFsRXZlbnQubmV3VVJMO1xyXG4gICAgdXJsID0gY2Fubm9uaWNhbFVybCh1cmwpO1xyXG4gICAgXHJcbiAgICAvLyBBbiBVUkwgYmVpbmcgcHVzaGVkIG9yIHJlcGxhY2VkXHJcbiAgICAvLyBtdXN0IE5PVCB0cmlnZ2VyIHBvcHN0YXRlXHJcbiAgICBpZiAodXJsID09PSBsYXRlc3RQdXNoZWRSZXBsYWNlZFVybClcclxuICAgICAgICByZXR1cm47XHJcbiAgICBcclxuICAgIC8vIGdldCBzdGF0ZSBmcm9tIGhpc3RvcnkgZW50cnlcclxuICAgIC8vIGZvciB0aGUgdXBkYXRlZCBVUkwsIGlmIGFueVxyXG4gICAgLy8gKGNhbiBoYXZlIHZhbHVlIHdoZW4gdHJhdmVyc2luZ1xyXG4gICAgLy8gaGlzdG9yeSkuXHJcbiAgICB2YXIgc3VpZCA9IGdldFN1aWQodXJsKSxcclxuICAgICAgICBzdGF0ZSA9IG51bGw7XHJcbiAgICBcclxuICAgIGlmIChzdWlkICE9PSBudWxsKVxyXG4gICAgICAgIHN0YXRlID0gc2Vzc2lvbi5zdGF0ZXNbc3VpZF07XHJcblxyXG4gICAgJHcudHJpZ2dlcihuZXcgJC5FdmVudCgncG9wc3RhdGUnLCB7XHJcbiAgICAgICAgc3RhdGU6IHN0YXRlXHJcbiAgICB9KSwgJ2hhc2hiYW5nSGlzdG9yeScpO1xyXG59KTtcclxuXHJcbi8vIEZvciBIaXN0b3J5QVBJIGNhcGFibGUgYnJvd3NlcnMsIHdlIG5lZWRcclxuLy8gdG8gY2FwdHVyZSB0aGUgbmF0aXZlICdwb3BzdGF0ZScgZXZlbnQgdGhhdFxyXG4vLyBnZXRzIHRyaWdnZXJlZCBvbiBvdXIgcHVzaC9yZXBsYWNlU3RhdGUgYmVjYXVzZVxyXG4vLyBvZiB0aGUgbG9jYXRpb24gY2hhbmdlLCBidXQgdG9vIG9uIHRyYXZlcnNpbmdcclxuLy8gdGhlIGhpc3RvcnkgKGJhY2svZm9yd2FyZCkuXHJcbi8vIFdlIHdpbGwgbG9jayB0aGUgZXZlbnQgZXhjZXB0IHdoZW4gaXNcclxuLy8gdGhlIG9uZSB3ZSB0cmlnZ2VyLlxyXG4vL1xyXG4vLyBOT1RFOiB0byB0aGlzIHRyaWNrIHRvIHdvcmssIHRoaXMgbXVzdFxyXG4vLyBiZSB0aGUgZmlyc3QgaGFuZGxlciBhdHRhY2hlZCBmb3IgdGhpc1xyXG4vLyBldmVudCwgc28gY2FuIGJsb2NrIGFsbCBvdGhlcnMuXHJcbi8vIEFMVEVSTkFUSVZFOiBpbnN0ZWFkIG9mIHRoaXMsIG9uIHRoZVxyXG4vLyBwdXNoL3JlcGxhY2VTdGF0ZSBtZXRob2RzIGRldGVjdCBpZlxyXG4vLyBIaXN0b3J5QVBJIGlzIG5hdGl2ZSBzdXBwb3J0ZWQgYW5kXHJcbi8vIHVzZSByZXBsYWNlU3RhdGUgdGhlcmUgcmF0aGVyIHRoYW5cclxuLy8gYSBoYXNoIGNoYW5nZS5cclxuJHcub24oJ3BvcHN0YXRlJywgZnVuY3Rpb24oZSwgc291cmNlKSB7XHJcbiAgICBcclxuICAgIC8vIEVuc3VyaW5nIGlzIHRoZSBvbmUgd2UgdHJpZ2dlclxyXG4gICAgaWYgKHNvdXJjZSA9PT0gJ2hhc2hiYW5nSGlzdG9yeScpXHJcbiAgICAgICAgcmV0dXJuO1xyXG4gICAgXHJcbiAgICAvLyBJbiBvdGhlciBjYXNlLCBibG9jazpcclxuICAgIGUucHJldmVudERlZmF1bHQoKTtcclxuICAgIGUuc3RvcEltbWVkaWF0ZVByb3BhZ2F0aW9uKCk7XHJcbn0pO1xyXG5cclxuLy8gRXhwb3NlIEFQSVxyXG5tb2R1bGUuZXhwb3J0cyA9IGhhc2hiYW5nSGlzdG9yeTtcclxuIiwiLyoqXHJcbiAgICBEZWZhdWx0IGJ1aWxkIG9mIHRoZSBTaGVsbCBjb21wb25lbnQuXHJcbiAgICBJdCByZXR1cm5zIHRoZSBTaGVsbCBjbGFzcyBhcyBhIG1vZHVsZSBwcm9wZXJ0eSxcclxuICAgIHNldHRpbmcgdXAgdGhlIGJ1aWx0LWluIG1vZHVsZXMgYXMgaXRzIGRlcGVuZGVuY2llcyxcclxuICAgIGFuZCB0aGUgZXh0ZXJuYWwgJ2pxdWVyeScgYW5kICdldmVudHMnIChmb3IgdGhlIEV2ZW50RW1pdHRlcikuXHJcbiAgICBJdCByZXR1cm5zIHRvbyB0aGUgYnVpbHQtaXQgRG9tSXRlbXNNYW5hZ2VyIGNsYXNzIGFzIGEgcHJvcGVydHkgZm9yIGNvbnZlbmllbmNlLlxyXG4qKi9cclxuJ3VzZSBzdHJpY3QnO1xyXG5cclxudmFyIGRlcHMgPSByZXF1aXJlKCcuL2RlcGVuZGVuY2llcycpLFxyXG4gICAgRG9tSXRlbXNNYW5hZ2VyID0gcmVxdWlyZSgnLi9Eb21JdGVtc01hbmFnZXInKSxcclxuICAgIHBhcnNlVXJsID0gcmVxdWlyZSgnLi9wYXJzZVVybCcpLFxyXG4gICAgYWJzb2x1dGl6ZVVybCA9IHJlcXVpcmUoJy4vYWJzb2x1dGl6ZVVybCcpLFxyXG4gICAgJCA9IHJlcXVpcmUoJ2pxdWVyeScpLFxyXG4gICAgbG9hZGVyID0gcmVxdWlyZSgnLi9sb2FkZXInKSxcclxuICAgIEV2ZW50RW1pdHRlciA9IHJlcXVpcmUoJ2V2ZW50cycpLkV2ZW50RW1pdHRlcjtcclxuXHJcbiQuZXh0ZW5kKGRlcHMsIHtcclxuICAgIHBhcnNlVXJsOiBwYXJzZVVybCxcclxuICAgIGFic29sdXRpemVVcmw6IGFic29sdXRpemVVcmwsXHJcbiAgICBqcXVlcnk6ICQsXHJcbiAgICBsb2FkZXI6IGxvYWRlcixcclxuICAgIEV2ZW50RW1pdHRlcjogRXZlbnRFbWl0dGVyXHJcbn0pO1xyXG5cclxuLy8gRGVwZW5kZW5jaWVzIGFyZSByZWFkeSwgd2UgY2FuIGxvYWQgdGhlIGNsYXNzOlxyXG52YXIgU2hlbGwgPSByZXF1aXJlKCcuL1NoZWxsJyk7XHJcblxyXG5leHBvcnRzLlNoZWxsID0gU2hlbGw7XHJcbmV4cG9ydHMuRG9tSXRlbXNNYW5hZ2VyID0gRG9tSXRlbXNNYW5hZ2VyO1xyXG4iLCIvKipcclxuICAgIExvYWRlciB1dGlsaXR5IHRvIGxvYWQgU2hlbGwgaXRlbXMgb24gZGVtYW5kIHdpdGggQUpBWFxyXG4qKi9cclxuJ3VzZSBzdHJpY3QnO1xyXG5cclxudmFyICQgPSByZXF1aXJlKCdqcXVlcnknKTtcclxuXHJcbm1vZHVsZS5leHBvcnRzID0ge1xyXG4gICAgXHJcbiAgICBiYXNlVXJsOiAnLycsXHJcbiAgICBcclxuICAgIGxvYWQ6IGZ1bmN0aW9uIGxvYWQocm91dGUpIHtcclxuICAgICAgICByZXR1cm4gbmV3IFByb21pc2UoZnVuY3Rpb24ocmVzb2x2ZSwgcmVqZWN0KSB7XHJcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKCdMT0FERVIgUFJPTUlTRScsIHJvdXRlLCByb3V0ZS5uYW1lKTtcclxuICAgICAgICAgICAgcmVzb2x2ZSgnJyk7XHJcbiAgICAgICAgICAgIC8qJC5hamF4KHtcclxuICAgICAgICAgICAgICAgIHVybDogbW9kdWxlLmV4cG9ydHMuYmFzZVVybCArIHJvdXRlLm5hbWUgKyAnLmh0bWwnLFxyXG4gICAgICAgICAgICAgICAgY2FjaGU6IGZhbHNlXHJcbiAgICAgICAgICAgICAgICAvLyBXZSBhcmUgbG9hZGluZyB0aGUgcHJvZ3JhbSBhbmQgbm8gbG9hZGVyIHNjcmVlbiBpbiBwbGFjZSxcclxuICAgICAgICAgICAgICAgIC8vIHNvIGFueSBpbiBiZXR3ZWVuIGludGVyYWN0aW9uIHdpbGwgYmUgcHJvYmxlbWF0aWMuXHJcbiAgICAgICAgICAgICAgICAvL2FzeW5jOiBmYWxzZVxyXG4gICAgICAgICAgICB9KS50aGVuKHJlc29sdmUsIHJlamVjdCk7Ki9cclxuICAgICAgICB9KTtcclxuICAgIH1cclxufTtcclxuIiwiLyoqXHJcbiAgICBwYXJzZVVybCBmdW5jdGlvbiBkZXRlY3RpbmdcclxuICAgIHRoZSBtYWluIHBhcnRzIG9mIHRoZSBVUkwgaW4gYVxyXG4gICAgY29udmVuaWVuY2Ugd2F5IGZvciByb3V0aW5nLlxyXG4qKi9cclxuJ3VzZSBzdHJpY3QnO1xyXG5cclxudmFyIGdldFVybFF1ZXJ5ID0gcmVxdWlyZSgnLi4vZ2V0VXJsUXVlcnknKSxcclxuICAgIGVzY2FwZVJlZ0V4cCA9IHJlcXVpcmUoJy4uL2VzY2FwZVJlZ0V4cCcpO1xyXG5cclxuZnVuY3Rpb24gcGFyc2VVcmwoYmFzZVVybCwgbGluaykge1xyXG5cclxuICAgIGxpbmsgPSBsaW5rIHx8ICcnO1xyXG5cclxuICAgIHZhciByYXdVcmwgPSBsaW5rO1xyXG5cclxuICAgIC8vIGhhc2hiYW5nIHN1cHBvcnQ6IHJlbW92ZSB0aGUgIyEgb3Igc2luZ2xlICMgYW5kIHVzZSB0aGUgcmVzdCBhcyB0aGUgbGlua1xyXG4gICAgbGluayA9IGxpbmsucmVwbGFjZSgvXiMhLywgJycpLnJlcGxhY2UoL14jLywgJycpO1xyXG4gICAgXHJcbiAgICAvLyByZW1vdmUgb3B0aW9uYWwgaW5pdGlhbCBzbGFzaCBvciBkb3Qtc2xhc2hcclxuICAgIGxpbmsgPSBsaW5rLnJlcGxhY2UoL15cXC98XlxcLlxcLy8sICcnKTtcclxuXHJcbiAgICAvLyBVUkwgUXVlcnkgYXMgYW4gb2JqZWN0LCBlbXB0eSBvYmplY3QgaWYgbm8gcXVlcnlcclxuICAgIHZhciBxdWVyeSA9IGdldFVybFF1ZXJ5KGxpbmsgfHwgJz8nKTtcclxuXHJcbiAgICAvLyByZW1vdmUgcXVlcnkgZnJvbSB0aGUgcmVzdCBvZiBVUkwgdG8gcGFyc2VcclxuICAgIGxpbmsgPSBsaW5rLnJlcGxhY2UoL1xcPy4qJC8sICcnKTtcclxuXHJcbiAgICAvLyBSZW1vdmUgdGhlIGJhc2VVcmwgdG8gZ2V0IHRoZSBhcHAgYmFzZS5cclxuICAgIHZhciBwYXRoID0gbGluay5yZXBsYWNlKG5ldyBSZWdFeHAoJ14nICsgZXNjYXBlUmVnRXhwKGJhc2VVcmwpLCAnaScpLCAnJyk7XHJcblxyXG4gICAgLy8gR2V0IGZpcnN0IHNlZ21lbnQgb3IgcGFnZSBuYW1lIChhbnl0aGluZyB1bnRpbCBhIHNsYXNoIG9yIGV4dGVuc2lvbiBiZWdnaW5pbmcpXHJcbiAgICB2YXIgbWF0Y2ggPSAvXlxcLz8oW15cXC9cXC5dKylbXlxcL10qKFxcLy4qKSokLy5leGVjKHBhdGgpO1xyXG5cclxuICAgIHZhciBwYXJzZWQgPSB7XHJcbiAgICAgICAgcm9vdDogdHJ1ZSxcclxuICAgICAgICBuYW1lOiBudWxsLFxyXG4gICAgICAgIHNlZ21lbnRzOiBudWxsLFxyXG4gICAgICAgIHBhdGg6IG51bGwsXHJcbiAgICAgICAgdXJsOiByYXdVcmwsXHJcbiAgICAgICAgcXVlcnk6IHF1ZXJ5XHJcbiAgICB9O1xyXG5cclxuICAgIGlmIChtYXRjaCkge1xyXG4gICAgICAgIHBhcnNlZC5yb290ID0gZmFsc2U7XHJcbiAgICAgICAgaWYgKG1hdGNoWzFdKSB7XHJcbiAgICAgICAgICAgIHBhcnNlZC5uYW1lID0gbWF0Y2hbMV07XHJcblxyXG4gICAgICAgICAgICBpZiAobWF0Y2hbMl0pIHtcclxuICAgICAgICAgICAgICAgIHBhcnNlZC5wYXRoID0gbWF0Y2hbMl07XHJcbiAgICAgICAgICAgICAgICBwYXJzZWQuc2VnbWVudHMgPSBtYXRjaFsyXS5yZXBsYWNlKC9eXFwvLywgJycpLnNwbGl0KCcvJyk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgZWxzZSB7XHJcbiAgICAgICAgICAgICAgICBwYXJzZWQucGF0aCA9ICcvJztcclxuICAgICAgICAgICAgICAgIHBhcnNlZC5zZWdtZW50cyA9IFtdO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIHJldHVybiBwYXJzZWQ7XHJcbn1cclxuXHJcbm1vZHVsZS5leHBvcnRzID0gcGFyc2VVcmw7IiwiLyoqXHJcbiAgICBzYW5pdGl6ZVVybCB1dGlsaXR5IHRoYXQgZW5zdXJlc1xyXG4gICAgdGhhdCBwcm9ibGVtYXRpYyBwYXJ0cyBnZXQgcmVtb3ZlZC5cclxuICAgIFxyXG4gICAgQXMgZm9yIG5vdyBpdCBkb2VzOlxyXG4gICAgLSByZW1vdmVzIHBhcmVudCBkaXJlY3Rvcnkgc3ludGF4XHJcbiAgICAtIHJlbW92ZXMgZHVwbGljYXRlZCBzbGFzaGVzXHJcbioqL1xyXG4ndXNlIHN0cmljdCc7XHJcblxyXG5mdW5jdGlvbiBzYW5pdGl6ZVVybCh1cmwpIHtcclxuICAgIHJldHVybiB1cmwucmVwbGFjZSgvXFwuezIsfS9nLCAnJykucmVwbGFjZSgvXFwvezIsfS9nLCAnLycpO1xyXG59XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IHNhbml0aXplVXJsOyIsIi8qKiBBcHBNb2RlbCBleHRlbnNpb24sXHJcbiAgICBmb2N1c2VkIG9uIHRoZSBFdmVudHMgQVBJXHJcbioqL1xyXG4ndXNlIHN0cmljdCc7XHJcbnZhciBDYWxlbmRhckV2ZW50ID0gcmVxdWlyZSgnLi4vbW9kZWxzL0NhbGVuZGFyRXZlbnQnKSxcclxuICAgIGFwaUhlbHBlciA9IHJlcXVpcmUoJy4uL3V0aWxzL2FwaUhlbHBlcicpO1xyXG5cclxuZXhwb3J0cy5leHRlbmRzID0gZnVuY3Rpb24gKEFwcE1vZGVsKSB7XHJcbiAgICBcclxuICAgIGFwaUhlbHBlci5kZWZpbmVDcnVkQXBpRm9yUmVzdCh7XHJcbiAgICAgICAgZXh0ZW5kZWRPYmplY3Q6IEFwcE1vZGVsLnByb3RvdHlwZSxcclxuICAgICAgICBNb2RlbDogQ2FsZW5kYXJFdmVudCxcclxuICAgICAgICBtb2RlbE5hbWU6ICdDYWxlbmRhckV2ZW50JyxcclxuICAgICAgICBtb2RlbExpc3ROYW1lOiAnQ2FsZW5kYXJFdmVudHMnLFxyXG4gICAgICAgIG1vZGVsVXJsOiAnZXZlbnRzJyxcclxuICAgICAgICBpZFByb3BlcnR5TmFtZTogJ2NhbGVuZGFyRXZlbnRJRCdcclxuICAgIH0pO1xyXG4gICAgXHJcbiAgICAvKiogIyBBUElcclxuICAgICAgICBBcHBNb2RlbC5wcm90b3R5cGUuZ2V0RXZlbnRzOjpcclxuICAgICAgICBAcGFyYW0ge29iamVjdH0gZmlsdGVyczoge1xyXG4gICAgICAgICAgICBzdGFydDogRGF0ZSxcclxuICAgICAgICAgICAgZW5kOiBEYXRlLFxyXG4gICAgICAgICAgICB0eXBlczogWzMsIDVdIC8vIFtvcHRpb25hbF0gTGlzdCBFdmVudFR5cGVzSURzXHJcbiAgICAgICAgfVxyXG4gICAgICAgIC0tLVxyXG4gICAgICAgIEFwcE1vZGVsLnByb3RvdHlwZS5nZXRFdmVudFxyXG4gICAgICAgIC0tLVxyXG4gICAgICAgIEFwcE1vZGVsLnByb3RvdHlwZS5wdXRFdmVudFxyXG4gICAgICAgIC0tLVxyXG4gICAgICAgIEFwcE1vZGVsLnByb3RvdHlwZS5wb3N0RXZlbnRcclxuICAgICAgICAtLS1cclxuICAgICAgICBBcHBNb2RlbC5wcm90b3R5cGUuZGVsRXZlbnRcclxuICAgICAgICAtLS1cclxuICAgICAgICBBcHBNb2RlbC5wcm90b3R5cGUuc2V0RXZlbnRcclxuICAgICoqL1xyXG59OyIsIi8qKiBBcHBNb2RlbCwgY2VudHJhbGl6ZXMgYWxsIHRoZSBkYXRhIGZvciB0aGUgYXBwLFxyXG4gICAgY2FjaGluZyBhbmQgc2hhcmluZyBkYXRhIGFjcm9zcyBhY3Rpdml0aWVzIGFuZCBwZXJmb3JtaW5nXHJcbiAgICByZXF1ZXN0c1xyXG4qKi9cclxudmFyIGtvID0gcmVxdWlyZSgna25vY2tvdXQnKSxcclxuICAgIE1vZGVsID0gcmVxdWlyZSgnLi4vbW9kZWxzL01vZGVsJyksXHJcbiAgICBVc2VyID0gcmVxdWlyZSgnLi4vbW9kZWxzL1VzZXInKSxcclxuICAgIFJlc3QgPSByZXF1aXJlKCcuLi91dGlscy9SZXN0JyksXHJcbiAgICBsb2NhbGZvcmFnZSA9IHJlcXVpcmUoJ2xvY2FsZm9yYWdlJyk7XHJcblxyXG5mdW5jdGlvbiBBcHBNb2RlbCh2YWx1ZXMpIHtcclxuXHJcbiAgICBNb2RlbCh0aGlzKTtcclxuICAgIFxyXG4gICAgdGhpcy5tb2RlbC5kZWZQcm9wZXJ0aWVzKHtcclxuICAgICAgICB1c2VyOiBVc2VyLm5ld0Fub255bW91cygpXHJcbiAgICB9LCB2YWx1ZXMpO1xyXG59XHJcblxyXG4vKiogSW5pdGlhbGl6ZSBhbmQgd2FpdCBmb3IgYW55dGhpbmcgdXAgKiovXHJcbkFwcE1vZGVsLnByb3RvdHlwZS5pbml0ID0gZnVuY3Rpb24gaW5pdCgpIHtcclxuICAgIFxyXG4gICAgLy8gTk9URTogVVJMIHRvIGJlIHVwZGF0ZWRcclxuICAgIHRoaXMucmVzdCA9IG5ldyBSZXN0KCdodHRwOi8vZGV2LmxvY29ub21pY3MuY29tL2VuLVVTL3Jlc3QvJyk7XHJcbiAgICAvL3RoaXMucmVzdCA9IG5ldyBSZXN0KCdodHRwOi8vbG9jYWxob3N0L3NvdXJjZS9lbi1VUy9yZXN0LycpO1xyXG4gICAgXHJcbiAgICAvLyBTZXR1cCBSZXN0IGF1dGhlbnRpY2F0aW9uXHJcbiAgICB0aGlzLnJlc3Qub25BdXRob3JpemF0aW9uUmVxdWlyZWQgPSBmdW5jdGlvbihyZXRyeSkge1xyXG4gICAgICAgIFxyXG4gICAgICAgIHRoaXMudHJ5TG9naW4oKVxyXG4gICAgICAgIC50aGVuKGZ1bmN0aW9uKCkge1xyXG4gICAgICAgICAgICAvLyBMb2dnZWQhIEp1c3QgcmV0cnlcclxuICAgICAgICAgICAgcmV0cnkoKTtcclxuICAgICAgICB9KTtcclxuICAgIH0uYmluZCh0aGlzKTtcclxuICAgIFxyXG4gICAgLy8gTG9jYWwgZGF0YVxyXG4gICAgLy8gVE9ETyBJbnZlc3RpZ2F0ZSB3aHkgYXV0b21hdGljIHNlbGVjdGlvbiBhbiBJbmRleGVkREIgYXJlXHJcbiAgICAvLyBmYWlsaW5nIGFuZCB3ZSBuZWVkIHRvIHVzZSB0aGUgd29yc2UtcGVyZm9ybWFuY2UgbG9jYWxzdG9yYWdlIGJhY2stZW5kXHJcbiAgICBsb2NhbGZvcmFnZS5jb25maWcoe1xyXG4gICAgICAgIG5hbWU6ICdMb2Nvbm9taWNzQXBwJyxcclxuICAgICAgICB2ZXJzaW9uOiAwLjEsXHJcbiAgICAgICAgc2l6ZSA6IDQ5ODA3MzYsIC8vIFNpemUgb2YgZGF0YWJhc2UsIGluIGJ5dGVzLiBXZWJTUUwtb25seSBmb3Igbm93LlxyXG4gICAgICAgIHN0b3JlTmFtZSA6ICdrZXl2YWx1ZXBhaXJzJyxcclxuICAgICAgICBkZXNjcmlwdGlvbiA6ICdMb2Nvbm9taWNzIEFwcCcsXHJcbiAgICAgICAgZHJpdmVyOiBsb2NhbGZvcmFnZS5MT0NBTFNUT1JBR0VcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIEluaXRpYWxpemU6IGNoZWNrIHRoZSB1c2VyIGhhcyBsb2dpbiBkYXRhIGFuZCBuZWVkZWRcclxuICAgIC8vIGNhY2hlZCBkYXRhXHJcbiAgICByZXR1cm4gbmV3IFByb21pc2UoZnVuY3Rpb24ocmVzb2x2ZSwgcmVqZWN0KSB7XHJcblxyXG4gICAgICAgIC8vIENhbGxiYWNrIHRvIGp1c3QgcmVzb2x2ZSB3aXRob3V0IGVycm9yIChwYXNzaW5nIGluIHRoZSBlcnJvclxyXG4gICAgICAgIC8vIHRvIHRoZSAncmVzb2x2ZScgd2lsbCBtYWtlIHRoZSBwcm9jZXNzIHRvIGZhaWwpLFxyXG4gICAgICAgIC8vIHNpbmNlIHdlIGRvbid0IG5lZWQgdG8gY3JlYXRlIGFuIGVycm9yIGZvciB0aGVcclxuICAgICAgICAvLyBhcHAgaW5pdCwgaWYgdGhlcmUgaXMgbm90IGVub3VnaCBzYXZlZCBpbmZvcm1hdGlvblxyXG4gICAgICAgIC8vIHRoZSBhcHAgaGFzIGNvZGUgdG8gcmVxdWVzdCBhIGxvZ2luLlxyXG4gICAgICAgIHZhciByZXNvbHZlQW55d2F5ID0gZnVuY3Rpb24oZG9lc25NYXR0ZXIpeyAgICAgICAgXHJcbiAgICAgICAgICAgIGNvbnNvbGUud2FybmluZygnQXBwIE1vZGVsIEluaXQgZXJyJywgZG9lc25NYXR0ZXIpO1xyXG4gICAgICAgICAgICByZXNvbHZlKCk7XHJcbiAgICAgICAgfTtcclxuICAgICAgICBcclxuICAgICAgICAvLyBJZiB0aGVyZSBhcmUgY3JlZGVudGlhbHMgc2F2ZWRcclxuICAgICAgICBsb2NhbGZvcmFnZS5nZXRJdGVtKCdjcmVkZW50aWFscycpLnRoZW4oZnVuY3Rpb24oY3JlZGVudGlhbHMpIHtcclxuXHJcbiAgICAgICAgICAgIGlmIChjcmVkZW50aWFscyAmJlxyXG4gICAgICAgICAgICAgICAgY3JlZGVudGlhbHMudXNlcklEICYmXHJcbiAgICAgICAgICAgICAgICBjcmVkZW50aWFscy51c2VybmFtZSAmJlxyXG4gICAgICAgICAgICAgICAgY3JlZGVudGlhbHMuYXV0aEtleSkge1xyXG5cclxuICAgICAgICAgICAgICAgIC8vIHVzZSBhdXRob3JpemF0aW9uIGtleSBmb3IgZWFjaFxyXG4gICAgICAgICAgICAgICAgLy8gbmV3IFJlc3QgcmVxdWVzdFxyXG4gICAgICAgICAgICAgICAgdGhpcy5yZXN0LmV4dHJhSGVhZGVycyA9IHtcclxuICAgICAgICAgICAgICAgICAgICBhbHU6IGNyZWRlbnRpYWxzLnVzZXJJRCxcclxuICAgICAgICAgICAgICAgICAgICBhbGs6IGNyZWRlbnRpYWxzLmF1dGhLZXlcclxuICAgICAgICAgICAgICAgIH07XHJcbiAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgICAgIC8vIEl0IGhhcyBjcmVkZW50aWFscyEgSGFzIGJhc2ljIHByb2ZpbGUgZGF0YT9cclxuICAgICAgICAgICAgICAgIGxvY2FsZm9yYWdlLmdldEl0ZW0oJ3Byb2ZpbGUnKS50aGVuKGZ1bmN0aW9uKHByb2ZpbGUpIHtcclxuICAgICAgICAgICAgICAgICAgICBpZiAocHJvZmlsZSkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBTZXQgdXNlciBkYXRhXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMudXNlcigpLm1vZGVsLnVwZGF0ZVdpdGgocHJvZmlsZSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIEVuZCBzdWNjZXNmdWxseVxyXG4gICAgICAgICAgICAgICAgICAgICAgICByZXNvbHZlKCk7XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgIGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBObyBwcm9maWxlLCB3ZSBuZWVkIHRvIHJlcXVlc3QgaXQgdG8gYmUgYWJsZVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyB0byB3b3JrIGNvcnJlY3RseSwgc28gd2VcclxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gYXR0ZW1wdCBhIGxvZ2luICh0aGUgdHJ5TG9naW4gcHJvY2VzcyBwZXJmb3Jtc1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBhIGxvZ2luIHdpdGggdGhlIHNhdmVkIGNyZWRlbnRpYWxzIGFuZCBmZXRjaFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyB0aGUgcHJvZmlsZSB0byBzYXZlIGl0IGluIHRoZSBsb2NhbCBjb3B5KVxyXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnRyeUxvZ2luKCkudGhlbihyZXNvbHZlLCByZXNvbHZlQW55d2F5KTtcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICB9LmJpbmQodGhpcyksIHJlc29sdmVBbnl3YXkpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgLy8gRW5kIHN1Y2Nlc3NmdWxseS4gTm90IGxvZ2dpbiBpcyBub3QgYW4gZXJyb3IsXHJcbiAgICAgICAgICAgICAgICAvLyBpcyBqdXN0IHRoZSBmaXJzdCBhcHAgc3RhcnQtdXBcclxuICAgICAgICAgICAgICAgIHJlc29sdmUoKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH0uYmluZCh0aGlzKSwgcmVzb2x2ZUFueXdheSk7XHJcbiAgICB9LmJpbmQodGhpcykpO1xyXG59O1xyXG5cclxuLyoqXHJcbiAgICBBY2NvdW50IG1ldGhvZHNcclxuKiovXHJcbkFwcE1vZGVsLnByb3RvdHlwZS50cnlMb2dpbiA9IGZ1bmN0aW9uIHRyeUxvZ2luKCkge1xyXG4gICAgLy8gR2V0IHNhdmVkIGNyZWRlbnRpYWxzXHJcbiAgICByZXR1cm4gbG9jYWxmb3JhZ2UuZ2V0SXRlbSgnY3JlZGVudGlhbHMnKVxyXG4gICAgLnRoZW4oZnVuY3Rpb24oY3JlZGVudGlhbHMpIHtcclxuICAgICAgICAvLyBJZiB3ZSBoYXZlIG9uZXMsIHRyeSB0byBsb2ctaW5cclxuICAgICAgICBpZiAoY3JlZGVudGlhbHMpIHtcclxuICAgICAgICAgICAgLy8gQXR0ZW1wdCBsb2dpbiB3aXRoIHRoYXRcclxuICAgICAgICAgICAgcmV0dXJuIHRoaXMubG9naW4oXHJcbiAgICAgICAgICAgICAgICBjcmVkZW50aWFscy51c2VybmFtZSxcclxuICAgICAgICAgICAgICAgIGNyZWRlbnRpYWxzLnBhc3N3b3JkXHJcbiAgICAgICAgICAgICk7XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdObyBzYXZlZCBjcmVkZW50aWFscycpO1xyXG4gICAgICAgIH1cclxuICAgIH0uYmluZCh0aGlzKSk7XHJcbn07XHJcblxyXG5BcHBNb2RlbC5wcm90b3R5cGUubG9naW4gPSBmdW5jdGlvbiBsb2dpbih1c2VybmFtZSwgcGFzc3dvcmQpIHtcclxuXHJcbiAgICAvLyBSZXNldCB0aGUgZXh0cmEgaGVhZGVycyB0byBhdHRlbXB0IHRoZSBsb2dpblxyXG4gICAgdGhpcy5yZXN0LmV4dHJhSGVhZGVycyA9IG51bGw7XHJcblxyXG4gICAgcmV0dXJuIHRoaXMucmVzdC5wb3N0KCdsb2dpbicsIHtcclxuICAgICAgICB1c2VybmFtZTogdXNlcm5hbWUsXHJcbiAgICAgICAgcGFzc3dvcmQ6IHBhc3N3b3JkLFxyXG4gICAgICAgIHJldHVyblByb2ZpbGU6IHRydWVcclxuICAgIH0pLnRoZW4oZnVuY3Rpb24obG9nZ2VkKSB7XHJcblxyXG4gICAgICAgIC8vIHVzZSBhdXRob3JpemF0aW9uIGtleSBmb3IgZWFjaFxyXG4gICAgICAgIC8vIG5ldyBSZXN0IHJlcXVlc3RcclxuICAgICAgICB0aGlzLnJlc3QuZXh0cmFIZWFkZXJzID0ge1xyXG4gICAgICAgICAgICBhbHU6IGxvZ2dlZC51c2VySWQsXHJcbiAgICAgICAgICAgIGFsazogbG9nZ2VkLmF1dGhLZXlcclxuICAgICAgICB9O1xyXG5cclxuICAgICAgICAvLyBhc3luYyBsb2NhbCBzYXZlLCBkb24ndCB3YWl0XHJcbiAgICAgICAgbG9jYWxmb3JhZ2Uuc2V0SXRlbSgnY3JlZGVudGlhbHMnLCB7XHJcbiAgICAgICAgICAgIHVzZXJJRDogbG9nZ2VkLnVzZXJJZCxcclxuICAgICAgICAgICAgdXNlcm5hbWU6IHVzZXJuYW1lLFxyXG4gICAgICAgICAgICBwYXNzd29yZDogcGFzc3dvcmQsXHJcbiAgICAgICAgICAgIGF1dGhLZXk6IGxvZ2dlZC5hdXRoS2V5XHJcbiAgICAgICAgfSk7XHJcbiAgICAgICAgbG9jYWxmb3JhZ2Uuc2V0SXRlbSgncHJvZmlsZScsIGxvZ2dlZC5wcm9maWxlKTtcclxuXHJcbiAgICAgICAgLy8gU2V0IHVzZXIgZGF0YVxyXG4gICAgICAgIHRoaXMudXNlcigpLm1vZGVsLnVwZGF0ZVdpdGgobG9nZ2VkLnByb2ZpbGUpO1xyXG5cclxuICAgICAgICByZXR1cm4gbG9nZ2VkO1xyXG4gICAgfS5iaW5kKHRoaXMpKTtcclxufTtcclxuXHJcbkFwcE1vZGVsLnByb3RvdHlwZS5sb2dvdXQgPSBmdW5jdGlvbiBsb2dvdXQoKSB7XHJcblxyXG4gICAgLy8gTG9jYWwgYXBwIGNsb3NlIHNlc3Npb25cclxuICAgIHRoaXMucmVzdC5leHRyYUhlYWRlcnMgPSBudWxsO1xyXG4gICAgbG9jYWxmb3JhZ2UucmVtb3ZlSXRlbSgnY3JlZGVudGlhbHMnKTtcclxuICAgIGxvY2FsZm9yYWdlLnJlbW92ZUl0ZW0oJ3Byb2ZpbGUnKTtcclxuICAgIFxyXG4gICAgLy8gRG9uJ3QgbmVlZCB0byB3YWl0IHRoZSByZXN1bHQgb2YgdGhlIFJFU1Qgb3BlcmF0aW9uXHJcbiAgICB0aGlzLnJlc3QucG9zdCgnbG9nb3V0Jyk7XHJcbiAgICBcclxuICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUoKTtcclxufTtcclxuXHJcbkFwcE1vZGVsLnByb3RvdHlwZS5nZXRVcGNvbWluZ0Jvb2tpbmdzID0gZnVuY3Rpb24gZ2V0VXBjb21pbmdCb29raW5ncygpIHtcclxuICAgIHJldHVybiB0aGlzLnJlc3QuZ2V0KCd1cGNvbWluZy1ib29raW5ncycpO1xyXG59O1xyXG5cclxuQXBwTW9kZWwucHJvdG90eXBlLmdldEJvb2tpbmcgPSBmdW5jdGlvbiBnZXRCb29raW5nKGlkKSB7XHJcbiAgICByZXR1cm4gdGhpcy5yZXN0LmdldCgnZ2V0LWJvb2tpbmcnLCB7IGJvb2tpbmdJRDogaWQgfSk7XHJcbn07XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IEFwcE1vZGVsO1xyXG5cclxuLy8gQ2xhc3Mgc3BsaXRlZCBpbiBkaWZmZXJlbnQgZmlsZXMgdG8gbWl0aWdhdGUgc2l6ZSBhbmQgb3JnYW5pemF0aW9uXHJcbi8vIGJ1dCBrZWVwaW5nIGFjY2VzcyB0byB0aGUgY29tbW9uIHNldCBvZiBtZXRob2RzIGFuZCBvYmplY3RzIGVhc3kgd2l0aFxyXG4vLyB0aGUgc2FtZSBjbGFzcy5cclxuLy8gTG9hZGluZyBleHRlbnNpb25zL3BhcnRpYWxzOlxyXG5yZXF1aXJlKCcuL0FwcE1vZGVsLWV2ZW50cycpLmV4dGVuZHMoQXBwTW9kZWwpO1xyXG4iLCIvKiogTmF2QWN0aW9uIHZpZXcgbW9kZWwuXHJcbiAgICBJdCBhbGxvd3Mgc2V0LXVwIHBlciBhY3Rpdml0eSBmb3IgdGhlIEFwcE5hdiBhY3Rpb24gYnV0dG9uLlxyXG4qKi9cclxudmFyIGtvID0gcmVxdWlyZSgna25vY2tvdXQnKSxcclxuICAgIE1vZGVsID0gcmVxdWlyZSgnLi4vbW9kZWxzL01vZGVsJyk7XHJcblxyXG5mdW5jdGlvbiBOYXZBY3Rpb24odmFsdWVzKSB7XHJcbiAgICBcclxuICAgIE1vZGVsKHRoaXMpO1xyXG4gICAgXHJcbiAgICB0aGlzLm1vZGVsLmRlZlByb3BlcnRpZXMoe1xyXG4gICAgICAgIGxpbms6ICcnLFxyXG4gICAgICAgIGljb246ICcnLFxyXG4gICAgICAgIHRleHQ6ICcnLFxyXG4gICAgICAgIC8vICdUZXN0JyBpcyB0aGUgaGVhZGVyIHRpdGxlIGJ1dCBwbGFjZWQgaW4gdGhlIGJ1dHRvbi9hY3Rpb25cclxuICAgICAgICBpc1RpdGxlOiBmYWxzZSxcclxuICAgICAgICAvLyAnTGluaycgaXMgdGhlIGVsZW1lbnQgSUQgb2YgYSBtb2RhbCAoc3RhcnRzIHdpdGggYSAjKVxyXG4gICAgICAgIGlzTW9kYWw6IGZhbHNlLFxyXG4gICAgICAgIC8vICdMaW5rJyBpcyBhIFNoZWxsIGNvbW1hbmQsIGxpa2UgJ2dvQmFjayAyJ1xyXG4gICAgICAgIGlzU2hlbGw6IGZhbHNlLFxyXG4gICAgICAgIC8vIFNldCBpZiB0aGUgZWxlbWVudCBpcyBhIG1lbnUgYnV0dG9uLCBpbiB0aGF0IGNhc2UgJ2xpbmsnXHJcbiAgICAgICAgLy8gd2lsbCBiZSB0aGUgSUQgb2YgdGhlIG1lbnUgKGNvbnRhaW5lZCBpbiB0aGUgcGFnZTsgd2l0aG91dCB0aGUgaGFzaCksIHVzaW5nXHJcbiAgICAgICAgLy8gdGhlIHRleHQgYW5kIGljb24gYnV0IHNwZWNpYWwgbWVhbmluZyBmb3IgdGhlIHRleHQgdmFsdWUgJ21lbnUnXHJcbiAgICAgICAgLy8gb24gaWNvbiBwcm9wZXJ0eSB0aGF0IHdpbGwgdXNlIHRoZSBzdGFuZGFyZCBtZW51IGljb24uXHJcbiAgICAgICAgaXNNZW51OiBmYWxzZVxyXG4gICAgfSwgdmFsdWVzKTtcclxufVxyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBOYXZBY3Rpb247XHJcblxyXG4vLyBTZXQgb2YgdmlldyB1dGlsaXRpZXMgdG8gZ2V0IHRoZSBsaW5rIGZvciB0aGUgZXhwZWN0ZWQgaHRtbCBhdHRyaWJ1dGVzXHJcblxyXG5OYXZBY3Rpb24ucHJvdG90eXBlLmdldEhyZWYgPSBmdW5jdGlvbiBnZXRIcmVmKCkge1xyXG4gICAgcmV0dXJuIChcclxuICAgICAgICAodGhpcy5pc01lbnUoKSB8fCB0aGlzLmlzTW9kYWwoKSB8fCB0aGlzLmlzU2hlbGwoKSkgP1xyXG4gICAgICAgICcjJyA6XHJcbiAgICAgICAgdGhpcy5saW5rKClcclxuICAgICk7XHJcbn07XHJcblxyXG5OYXZBY3Rpb24ucHJvdG90eXBlLmdldE1vZGFsVGFyZ2V0ID0gZnVuY3Rpb24gZ2V0TW9kYWxUYXJnZXQoKSB7XHJcbiAgICByZXR1cm4gKFxyXG4gICAgICAgICh0aGlzLmlzTWVudSgpIHx8ICF0aGlzLmlzTW9kYWwoKSB8fCB0aGlzLmlzU2hlbGwoKSkgP1xyXG4gICAgICAgICcnIDpcclxuICAgICAgICB0aGlzLmxpbmsoKVxyXG4gICAgKTtcclxufTtcclxuXHJcbk5hdkFjdGlvbi5wcm90b3R5cGUuZ2V0U2hlbGxDb21tYW5kID0gZnVuY3Rpb24gZ2V0U2hlbGxDb21tYW5kKCkge1xyXG4gICAgcmV0dXJuIChcclxuICAgICAgICAodGhpcy5pc01lbnUoKSB8fCAhdGhpcy5pc1NoZWxsKCkpID9cclxuICAgICAgICAnJyA6XHJcbiAgICAgICAgdGhpcy5saW5rKClcclxuICAgICk7XHJcbn07XHJcblxyXG5OYXZBY3Rpb24ucHJvdG90eXBlLmdldE1lbnVJRCA9IGZ1bmN0aW9uIGdldE1lbnVJRCgpIHtcclxuICAgIHJldHVybiAoXHJcbiAgICAgICAgKCF0aGlzLmlzTWVudSgpKSA/XHJcbiAgICAgICAgJycgOlxyXG4gICAgICAgIHRoaXMubGluaygpXHJcbiAgICApO1xyXG59O1xyXG5cclxuTmF2QWN0aW9uLnByb3RvdHlwZS5nZXRNZW51TGluayA9IGZ1bmN0aW9uIGdldE1lbnVMaW5rKCkge1xyXG4gICAgcmV0dXJuIChcclxuICAgICAgICAoIXRoaXMuaXNNZW51KCkpID9cclxuICAgICAgICAnJyA6XHJcbiAgICAgICAgJyMnICsgdGhpcy5saW5rKClcclxuICAgICk7XHJcbn07XHJcblxyXG4vKiogU3RhdGljLCBzaGFyZWQgYWN0aW9ucyAqKi9cclxuTmF2QWN0aW9uLmdvSG9tZSA9IG5ldyBOYXZBY3Rpb24oe1xyXG4gICAgbGluazogJy8nLFxyXG4gICAgaWNvbjogJ2dseXBoaWNvbiBnbHlwaGljb24taG9tZSdcclxufSk7XHJcblxyXG5OYXZBY3Rpb24uZ29CYWNrID0gbmV3IE5hdkFjdGlvbih7XHJcbiAgICBsaW5rOiAnZ29CYWNrJyxcclxuICAgIGljb246ICdnbHlwaGljb24gZ2x5cGhpY29uLWFycm93LWxlZnQnLFxyXG4gICAgaXNTaGVsbDogdHJ1ZVxyXG59KTtcclxuXHJcbi8vIFRPRE8gVE8gUkVNT1ZFLCBFeGFtcGxlIG9mIG1vZGFsXHJcbk5hdkFjdGlvbi5uZXdJdGVtID0gbmV3IE5hdkFjdGlvbih7XHJcbiAgICBsaW5rOiAnI25ld0l0ZW0nLFxyXG4gICAgaWNvbjogJ2dseXBoaWNvbiBnbHlwaGljb24tcGx1cycsXHJcbiAgICBpc01vZGFsOiB0cnVlXHJcbn0pO1xyXG5cclxuTmF2QWN0aW9uLm1lbnVJbiA9IG5ldyBOYXZBY3Rpb24oe1xyXG4gICAgbGluazogJ21lbnVJbicsXHJcbiAgICBpY29uOiAnbWVudScsXHJcbiAgICBpc01lbnU6IHRydWVcclxufSk7XHJcblxyXG5OYXZBY3Rpb24ubWVudU91dCA9IG5ldyBOYXZBY3Rpb24oe1xyXG4gICAgbGluazogJ21lbnVPdXQnLFxyXG4gICAgaWNvbjogJ21lbnUnLFxyXG4gICAgaXNNZW51OiB0cnVlXHJcbn0pO1xyXG5cclxuTmF2QWN0aW9uLm1lbnVOZXdJdGVtID0gbmV3IE5hdkFjdGlvbih7XHJcbiAgICBsaW5rOiAnbWVudU5ld0l0ZW0nLFxyXG4gICAgaWNvbjogJ2dseXBoaWNvbiBnbHlwaGljb24tcGx1cycsXHJcbiAgICBpc01lbnU6IHRydWVcclxufSk7XHJcblxyXG5OYXZBY3Rpb24uZ29IZWxwSW5kZXggPSBuZXcgTmF2QWN0aW9uKHtcclxuICAgIGxpbms6ICcjaGVscEluZGV4JyxcclxuICAgIHRleHQ6ICdoZWxwJyxcclxuICAgIGlzTW9kYWw6IHRydWVcclxufSk7XHJcblxyXG5OYXZBY3Rpb24uZ29Mb2dpbiA9IG5ldyBOYXZBY3Rpb24oe1xyXG4gICAgbGluazogJy9sb2dpbicsXHJcbiAgICB0ZXh0OiAnbG9nLWluJ1xyXG59KTtcclxuXHJcbk5hdkFjdGlvbi5nb0xvZ291dCA9IG5ldyBOYXZBY3Rpb24oe1xyXG4gICAgbGluazogJy9sb2dvdXQnLFxyXG4gICAgdGV4dDogJ2xvZy1vdXQnXHJcbn0pO1xyXG5cclxuTmF2QWN0aW9uLmdvU2lnbnVwID0gbmV3IE5hdkFjdGlvbih7XHJcbiAgICBsaW5rOiAnL3NpZ251cCcsXHJcbiAgICB0ZXh0OiAnc2lnbi11cCdcclxufSk7XHJcbiIsIi8qKiBOYXZCYXIgdmlldyBtb2RlbC5cclxuICAgIEl0IGFsbG93cyBjdXN0b21pemUgdGhlIE5hdkJhciBwZXIgYWN0aXZpdHkuXHJcbioqL1xyXG52YXIga28gPSByZXF1aXJlKCdrbm9ja291dCcpLFxyXG4gICAgTW9kZWwgPSByZXF1aXJlKCcuLi9tb2RlbHMvTW9kZWwnKSxcclxuICAgIE5hdkFjdGlvbiA9IHJlcXVpcmUoJy4vTmF2QWN0aW9uJyk7XHJcblxyXG5mdW5jdGlvbiBOYXZCYXIodmFsdWVzKSB7XHJcbiAgICBcclxuICAgIE1vZGVsKHRoaXMpO1xyXG4gICAgXHJcbiAgICB0aGlzLm1vZGVsLmRlZlByb3BlcnRpZXMoe1xyXG4gICAgICAgIC8vIFRpdGxlIHNob3dlZCBpbiB0aGUgY2VudGVyXHJcbiAgICAgICAgLy8gV2hlbiB0aGUgdGl0bGUgaXMgJ251bGwnLCB0aGUgYXBwIGxvZ28gaXMgc2hvd2VkIGluIHBsYWNlLFxyXG4gICAgICAgIC8vIG9uIGVtcHR5IHRleHQsIHRoZSBlbXB0eSB0ZXh0IGlzIHNob3dlZCBhbmQgbm8gbG9nby5cclxuICAgICAgICB0aXRsZTogJycsXHJcbiAgICAgICAgLy8gTmF2QWN0aW9uIGluc3RhbmNlOlxyXG4gICAgICAgIGxlZnRBY3Rpb246IG51bGwsXHJcbiAgICAgICAgLy8gTmF2QWN0aW9uIGluc3RhbmNlOlxyXG4gICAgICAgIHJpZ2h0QWN0aW9uOiBudWxsXHJcbiAgICB9LCB2YWx1ZXMpO1xyXG59XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IE5hdkJhcjtcclxuIl19
;