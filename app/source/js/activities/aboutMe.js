/**
    AboutMe activity
**/
'use strict';

var Activity = require('../components/Activity');
var ko = require('knockout');
var userProfile = require('../data/userProfile');
var onboarding = require('../data/onboarding');
var homeAddress = require('../data/homeAddress');
var marketplaceProfile = require('../data/marketplaceProfile');

var A = Activity.extend(function AboutMeActivity() {

    Activity.apply(this, arguments);

    this.viewModel = new ViewModel(this.app);
    this.accessLevel = this.app.UserType.loggedUser;

    var serviceProfessionalNavBar = Activity.createSubsectionNavBar('Profile', {
        backLink: '/userProfile' , helpLink: this.viewModel.helpLinkProfessionals
    });
    this.serviceProfessionalNavBar = serviceProfessionalNavBar.model.toPlainObject(true);
    var clientNavBar = Activity.createSubsectionNavBar('Profile', {
        backLink: '/userProfile' , helpLink: this.viewModel.helpLinkClients
    });
    this.clientNavBar = serviceProfessionalNavBar.model.toPlainObject(true);
    this.navBar = this.viewModel.user.isServiceProfessional() ? serviceProfessionalNavBar : clientNavBar;
    // Share navBar with desktop nav through viewModel
    this.viewModel.navBar = this.navBar;

    this.registerHandler({
        target: userProfile,
        event: 'error',
        handler: function(err) {
            var msg = err.task === 'save' ? 'Unable to save contact data.' : 'Unable to load contact data.';
            this.app.modals.showError({
                title: msg,
                error: err
            });
        }.bind(this)
    });

    this.registerHandler({
        target: homeAddress,
        event: 'error',
        handler: function(err) {
            var msg = err.task === 'save' ? 'Unable to save address details.' : 'Unable to load address details.';
            this.app.modals.showError({
                title: msg,
                error: err
            });
        }.bind(this)
    });

    this.registerHandler({
        target: marketplaceProfile,
        event: 'error',
        handler: function(err) {
            var msg = err.task === 'save' ? 'Unable to save your public data.' : 'Unable to load your public data.';
            this.app.modals.showError({
                title: msg,
                error: err
            });
        }.bind(this)
    });
});

exports.init = A.init;

A.prototype.updateNavBarState = function updateNavBarState() {

    if (!onboarding.updateNavBar(this.navBar)) {
        // Reset
        var nav = this.viewModel.user.isServiceProfessional() ? this.serviceProfessionalNavBar : this.clientNavBar;
        this.navBar.model.updateWith(nav, true);
    }
};

A.prototype.show = function show(state) {
    Activity.prototype.show.call(this, state);

    // Discard any previous unsaved edit
    this.viewModel.discard();

    this.updateNavBarState();

    // Keep data updated:
    this.viewModel.sync();
};

var ContactInfoVM = require('../viewmodels/ContactInfoVM');
var MarketplaceProfilePictureVM = require('../viewmodels/MarketplaceProfilePictureVM');

function ViewModel(app) {

    this.helpLinkProfessionals = '/help/relatedArticles/201967756-telling-the-community-about-yourself';
    this.helpLinkClients = '/help/relatedArticles/201960753-telling-the-community-about-yourself';
    this.helpLink = ko.pureComputed(function() {
        return this.user.isServiceProfessional() ? this.helpLinkProfessionals : this.helpLinkClients ;
    }, this);

    this.isInOnboarding = onboarding.inProgress;

    this.contactInfo = new ContactInfoVM(app);
    this.marketplaceProfilePicture = new MarketplaceProfilePictureVM(app);

    this.user = this.contactInfo.user;

    var vms = [this.contactInfo, this.marketplaceProfilePicture];

    this.submitText = ko.pureComputed(function() {
        return (
            onboarding.inProgress() ?
                'Save and continue' :
            this.isLoading() ?
                'loading...' :
                this.isSaving() ?
                    'saving...' :
                    'Save'
        );
    }, this);

    this.save = function() {
        Promise.all(vms.map(function(vm) { return vm.save(); }))
        .then(function() {
            if (onboarding.inProgress()) {
                onboarding.goNext();
            }
            else {
                app.successSave();
            }
        })
        .catch(function() {
            // catch error, managed on event
        });
    };

    this.discard = function() {
        vms.forEach(function(vm) {
            if (vm.discard) vm.discard();
        });
    };
    this.sync = function() {
        vms.forEach(function(vm) {
            if (vm.sync) vm.sync();
        });
    };

    var createStatusObs = function(t, name) {
        t[name] = ko.pureComputed(function() {
            vms.reduce(function(prev, vm) {
                if (vm[name] && vm[name]()) {
                    return true;
                }
                return prev;
            }, false);
        });
    };
    createStatusObs(this, 'isLoading');
    createStatusObs(this, 'isSaving');
    createStatusObs(this, 'isSyncing');
    createStatusObs(this, 'isLocked');
}
