/**
    WeeklySchedule model.
 **/
'use strict';

var ko = require('knockout'),
    moment = require('moment-timezone'),
    Model = require('./Model'),
    WeekDaySchedule = require('./WeekDaySchedule'),
    TimeRange = require('./TimeRange');

/**
    Main model defining the week schedule
    per week date, or just set all days times
    as available with a single flag.
**/
function WeeklySchedule(values) {

    Model(this);

    this.model.defProperties({
        sunday: {
            isArray: true,
            Model: TimeRange
        },
        monday: {
            isArray: true,
            Model: TimeRange
        },
        tuesday: {
            isArray: true,
            Model: TimeRange
        },
        wednesday: {
            isArray: true,
            Model: TimeRange
        },
        thursday: {
            isArray: true,
            Model: TimeRange
        },
        friday: {
            isArray: true,
            Model: TimeRange
        },
        saturday: {
            isArray: true,
            Model: TimeRange
        },
        isAllTime: false,
        timeZone: ''
    }, values);

    // Index access
    this.weekDays = [
        this.sunday,
        this.monday,
        this.tuesday,
        this.wednesday,
        this.thursday,
        this.friday,
        this.saturday
    ];

    this.weekDays.forEach(WeekDaySchedule);

    this.timeZoneDisplayName = ko.computed(function () {
        var tzid = this.timeZone(),
            tz = moment.tz(tzid),
            name = tz.tz();

        // !moment.tz.zoneExists, just check the name is enough
        if (!name) {
            var localtz = moment.tz.guess();
            if (localtz)
                tz = moment.tz(localtz.name);
            if (tz)
                name = tz.tz();
            if (name)
                setTimeout(function () {
                    this.timeZone(name);
                }.bind(this), 1);
        }

        if (name)
            return name + ' (' + tz.zoneAbbr() + ')';
        else
            return '';
    }, this);
}

module.exports = WeeklySchedule;
