/**
    SplashIndex activity
**/
'use strict';

var Activity = require('../components/Activity');

var A = Activity.extends(function SplashIndexActivity() {
    
    Activity.apply(this, arguments);
});

exports.init = A.init;

A.prototype.show = function show(state) {
    Activity.prototype.show.call(this, state);
};