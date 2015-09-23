/**
    datetimePicker activity
**/
'use strict';

var ko = require('knockout'),
    Time = require('../utils/Time'),
    moment = require('moment'),
    getDateWithoutTime = require('../utils/getDateWithoutTime');

require('../components/DatePicker');
var datepickerAvailability = require('../utils/datepickerAvailability');

var Activity = require('../components/Activity');

var A = Activity.extends(function DatetimePickerActivity() {
    
    Activity.apply(this, arguments);

    this.accessLevel = this.app.UserType.loggedUser;
    this.viewModel = new ViewModel(this.app);
    // Defaults settings for navBar.
    this.navBar = Activity.createSubsectionNavBar('', {
        helpId: 'datetimePickerHelp'
    });
    // Save defaults to restore on updateNavBarState when needed:
    this.defaultLeftAction = this.navBar.leftAction().model.toPlainObject();
    
    // Getting elements
    this.$datePicker = this.$activity.find('#datetimePickerDatePicker');
    this.$timePicker = this.$activity.find('#datetimePickerTimePicker');
    

    /* Init components */
    this.$datePicker.show().datepicker({ extraClasses: 'DatePicker--tagged' });
    this.tagAvailability = datepickerAvailability.create(this.app, this.$datePicker, this.viewModel.isLoading);
    
    this.registerHandler({
        target: this.$datePicker,
        event: 'dateChanged',
        handler: function(e) {
            if (e.viewMode === 'days') {
                this.viewModel.selectedDate(e.date);
            }
        }.bind(this)
    });
    
    this.registerHandler({
        target: this.viewModel.selectedDate,
        handler: function(date) {
            this.bindDateData(date);
        }.bind(this)
    });
    
    // Return the selected date-time
    this.registerHandler({
        target: this.viewModel.selectedDatetime,
        handler: function (datetime) {
            if (!datetime) return;
            // Pass the selected datetime in the info
            this.requestData.selectedDatetime = datetime;
            this.requestData.allowBookUnavailableTime = this.viewModel.allowBookUnavailableTime();
            // And go back
            this.app.shell.goBack(this.requestData);
        }.bind(this)
    });
    
//    this.registerHandler({
//        target: this.viewModel.pickedTime,
//        handler: function(t) {
//            if (t) {
//                if (!(t instanceof Date)) {
//                    // Build date-time
//                    var timespan = moment.duration(t);
//                    t = moment(this.selectedDate()).startOf('day').add(timespan).toDate();
//                }
//                this.allowBookUnavailableTime(true);
//                this.selectedDatetime(t);
//            }
//        }.bind(this.viewModel)
//    });
    
    this.returnRequest = function returnRequest() {
        this.app.shell.goBack(this.requestData);
    }.bind(this);
    
    // First load of today data
    this.bindDateData(this.viewModel.selectedDate())
    .then(function() {
        // Once finished, load the whole month
        this.tagAvailability(this.viewModel.selectedDate());
    }.bind(this));
});

exports.init = A.init;

A.prototype.updateNavBarState = function updateNavBarState() {
    
    var header = this.requestData.headerText;
    this.viewModel.headerText(header || 'Select date and time');

    if (this.requestData.title) {
        // Replace title
        this.navBar.title(this.requestData.title);
    }
    else {
        // Title must be empty
        this.navBar.title('');
        this.navBar.leftAction().text(this.requestData.navTitle || '');
    }
    
    if (this.requestData.cancelLink) {
        this.convertToCancelAction(this.navBar.leftAction(), this.requestData.cancelLink);
    }
    else {
        // Reset to defaults, or given title:
        this.navBar.leftAction().model.updateWith(this.defaultLeftAction);
        if (this.requestData.navTitle)
            this.navBar.leftAction().text(this.requestData.navTitle);
        // Uses a custom handler so it returns keeping the given state:
        this.navBar.leftAction().handler(this.returnRequest);
    }
};

A.prototype.show = function show(state) {
    // Reset
    this.viewModel.selectedDatetime(null);
    this.viewModel.pickedTime(null);
    this.viewModel.allowBookUnavailableTime(false);
    
    Activity.prototype.show.call(this, state);
    
    // Parameters: pass a required duration
    this.viewModel.requiredDuration(this.requestData.requiredDuration |0);

    // Preselect a date, or current date
    this.viewModel.selectedDate(getDateWithoutTime(this.requestData.selectedDatetime));
    this.$datePicker.datepicker('setValue', this.viewModel.selectedDate(), true);
    
    if (!this.__firstShowDone) {
        this.__firstShowDone = true;
        // Force first refresh on datepicker to allow
        // event handlers to get notified on first time:
        this.$datePicker.datepicker('fill');
    }
    
    this.updateNavBarState();
};

A.prototype.bindDateData = function bindDateData(date) {

    this.viewModel.isLoading(true);
    return this.app.model.calendar.getDateAvailability(date)
    .then(function(data) {
        
        this.viewModel.dateAvail(data);
        
        /*var sdate = moment(date).format('YYYY-MM-DD');
        this.viewModel.slots(data.slots.map(function(slot) {
            // From string to Date
            var dateslot = new Date(sdate + 'T' + slot);
            return dateslot;
        }));*/
    }.bind(this))
    .catch(function(err) {
        this.app.modals.showError({
            title: 'Error loading availability',
            error: err
        });
    }.bind(this))
    .then(function() {
        // Finally
        this.viewModel.isLoading(false);
    }.bind(this));
};

function ViewModel(app) {

    this.headerText = ko.observable('Select a time');
    this.selectedDate = ko.observable(getDateWithoutTime());
    this.isLoading = ko.observable(false);
    this.requiredDuration = ko.observable(0);
    
    this.durationDisplay = ko.pureComputed(function() {
        var fullMinutes = this.requiredDuration();
        if (fullMinutes <= 0)
            return '';

        var hours = Math.floor(fullMinutes / 60),
            minutes = fullMinutes % 60,
            text = '';

        if (hours > 0)
            text += moment.duration({ hours: hours }).humanize() + ' ';
        if (minutes > 0)
            text += moment.duration({ minutes: minutes }).humanize();

        return text;
    }, this);

    this.dateAvail = ko.observable();
    this.groupedSlots = ko.computed(function(){
        
        var requiredDuration = this.requiredDuration();
        
        /*
          before 12:00pm (noon) = morning
          afternoon: 12:00pm until 5:00pm
          evening: 5:00pm - 11:59pm
        */
        // Since slots must be for the same date,
        // to define the groups ranges use the first date
        var datePart = this.dateAvail() && this.dateAvail().date() || new Date();
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

        // Populate groups with the time slots
        var slots = this.dateAvail() && this.dateAvail().getFreeTimeSlots(requiredDuration) || [];
        // Iterate to organize by group
        slots.forEach(function(slot) {

            // Filter slots by the increment size preference
            /*var totalMinutes = moment.duration(slot).asMinutes() |0;
            if (totalMinutes % incSize !== 0) {
                return;
            }*/

            // Check every group
            groups.some(function(group) {
                // If matches the group, push to it
                // and go out of groups iteration quickly
                if (slot >= group.starts &&
                    slot < group.ends) {
                    group.slots.push(slot);
                    return true;
                }
            });
        });

        return groups;

    }, this);
    
    this.selectedDatetime = ko.observable(null);
    
    this.selectDatetime = function(selectedDatetime, event) {
        event.preventDefault();
        event.stopImmediatePropagation();
        this.selectedDatetime(selectedDatetime);
    }.bind(this);

    ///
    /// Time Picker

    this.pickedTime = ko.observable();
    this.allowBookUnavailableTime = ko.observable(false);
    
    this.getPickedDatetime = function() {
        var t = this.pickedTime();
        if (!(t instanceof Date)) {
            // Build date-time
            var timespan = moment.duration(t);
            t = moment(this.selectedDate()).startOf('day').add(timespan).toDate();
        }
        return t;
    };
    
    this.setPickedAsSelected = function() {
        this.allowBookUnavailableTime(true);
        this.selectedDatetime(this.getPickedDatetime());
    }.bind(this);
    
    this.showTimePicker = function() {
        app.modals.showTimePicker({
            title: 'Book an unavailable time',
            selectedTime: null,
            unsetLabel: 'Cancel'
        }).then(function(pickedValue) {
            if (pickedValue.time) {
                this.pickedTime(pickedValue.time);
                this.setPickedAsSelected();
            }
        }.bind(this))
        .catch(function() {
            // Just modal was dismissed, so picker was rejected but not an error
        });
    }.bind(this);
}