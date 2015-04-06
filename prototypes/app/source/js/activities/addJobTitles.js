/**
    AddJobTitles activity
**/
'use strict';

var Activity = require('../components/Activity');
var $ = require('jquery');
require('jquery-ui');

var A = Activity.extends(function AddJobTitlesActivity() {
    
    Activity.apply(this, arguments);

    this.accessLevel = this.app.UserType.Freelancer;
    this.viewModel = new ViewModel(this.app);
    this.navBar = Activity.createSubsectionNavBar('Scheduling');
    
    // Setup autocomplete
    var ac = this.$activity.find('#addJobTitles-search');
    var vw = this.viewModel;
    // Autocomplete positions and add to the list
    ac.autocomplete({
        source: function(request, response) {
            vw.searchBy(request.term)
            .then(function(results) {
                response(results);
            });
        },
        autoFocus: false,
        minLength: 0,
        select: function (event, ui) {
            // No value, no action :(
            if (!ui || !ui.item || !ui.item.value) return;

            vw.addItem(ui.item);

            return false;
        },
        focus: function (event, ui) {
            if (!ui || !ui.item || !ui.item.positionSingular);
            // We want the label in textbox, not the value
            $(this).val(ui.item.positionSingular);
            return false;
        }
    });
});

exports.init = A.init;

A.prototype.show = function show(options) {

    Activity.prototype.show.call(this, options);
    
    // Reset
    this.viewModel.searchText('');
    this.viewModel.jobTitles.removeAll();
};

var ko = require('knockout');
function ViewModel(app) {
    
    this.isSearching = ko.observable(false);
    this.isSaving = ko.observable(false);
    this.isLocked = this.isSaving;
    this.searchText = ko.observable('');
    this.jobTitles = ko.observableArray([]);
    this.submitText = ko.observable('Save');
    
    this.unsavedChanges = ko.pureComputed(function() {
        return !!this.jobTitles().length;
    }, this);

    this.searchBy = function searchBy(text) {
        return app.model.rest.get('job-titles/autocomplete', { search: text })
        .catch(function (err) {
            app.modals.showError({ error: err });
        });
    }.bind(this);
    
    this.search = function search() {
        this.searchBy(this.searchText());
    }.bind(this);
    
    this.addItem = function addItem(item) {
        // Add to the list, if is not already in it
        var foundIndex = this.findItem(item);
        if (foundIndex === -1) {
            this.jobTitles.push(item);
        }
    }.bind(this);
    
    this.add = function add() {
        var s = this.searchText();
        if (s) {
            this.addItem({
                value: null,
                label: s
            });
        }
    }.bind(this);
    
    /**
        Look for an item in the current list, returning
        its index in the list or -1 if nothing.
    **/
    this.findItem = function findItem(jobTitle) {
        var foundIndex = -1;
        this.jobTitles().some(function(item, index) {
            if (item.value === jobTitle.value) {
                foundIndex = index;
                return true;
            }
        });
        return foundIndex;
    };
    
    this.remove = function remove(jobTitle) {
        var removeIndex = this.findItem(jobTitle);
        if (removeIndex > -1) {
            this.jobTitles.splice(removeIndex, 1);
        }
    }.bind(this);
    
    this.save = function save() {
        this.isSaving(true);
        this.submitText('Saving');

        Promise.all(this.jobTitles().map(function(jobTitle) {
            return app.model.rest.post('user-job-profile', {
                jobTitleID: jobTitle.value,
                intro: '',
                cancellationPolicyID: null,
                instantBooking: false
            });
        }))
        .then(function(/*results*/) {
            this.submitText('Done');
            this.isSaving(false);
            // Reset list
            this.jobTitles.removeAll();
        }.bind(this))
        .catch(function(error) {
            this.submitText('Save');
            this.isSaving(false);
            app.modals.showError({
                title: 'Impossible to add one or more job titles',
                error: error
            });
        }.bind(this));
    }.bind(this);
}
