/** HelpCategory model.
 **/
'use strict';

var Model = require('./Model');
var ko = require('knockout');
var slug = require('../utils/slug');

function HelpCategory(values) {

    Model(this);

    this.model.defProperties({
        id: 0,
        name: '',
        description: ''
    }, values);
    
    this.tail = ko.pureComputed(function() {
        return this.id() + '-' + slug(this.name());
    }, this);
    
    this.urlPath = ko.pureComputed(function() {
        return '/help/categories/' + this.tail();
    }, this);
}

module.exports = HelpCategory;
