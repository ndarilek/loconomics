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
    years: 'DatePicker-years',
    weekDays: 'DatePicker-weekDays',
    active: 'active'
};

var events = {
    dayRendered: 'dayRendered',
    dateChanged: 'dateChanged',
    show: 'show',
    hide: 'hide',
    dateSet: 'dateSet',
    // IMPORTANT: Triggered after a value is set or updated in the viewDate property
    // without check if the same or not (but operations updating it happens on a change)
    // AND after is changed and calendar filled (fill method called, so DOM reflects the new viewDate).
    viewDateChanged: 'viewDateChanged'
};

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
        daysMin: ["Su", "M", "Tu", "W", "Th", "F", "Sa", "Su"],
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

// Picker object
var DatePicker = function(element, options) {
    /*jshint maxstatements:50,maxcomplexity:30*/
    this.element = $(element);
    this.format = DPGlobal.parseFormat(options.format||this.element.data('date-format')||'mm/dd/yyyy');
    
    this.isInput = this.element.is('input');
    this.component = this.element.is('.date') ? this.element.find('.add-on') : false;
    this.isPlaceholder = this.element.is('.calendar-placeholder');
    
    // Creating initial HTML
    this.picker = $(DPGlobal.template)
                        .appendTo(this.isPlaceholder ? this.element : 'body')
                        .on('click', $.proxy(this.click, this));
    this.picker.addClass(this.isPlaceholder ? '' : 'dropdown-menu');
    if (options.extraClasses)
        this.picker.addClass(options.extraClasses);
    
    // Create base html for..
    var html = '';
    // ..Days
    for(var r = 0; r < 6; r++) {
        html += '<tr>';
        for(var c = 0; c < 7; c++) {
            html += '<td class="' + classes.monthDay + '"><span>&nbsp;</span></td>';
        }
        html += '</tr>';
    }
    this.picker.find('.' + classes.days + ' tbody').append(html);
    // ..Years
    html = '';
    var yearCont = this.picker.find('.' + classes.years + ' td');
    for (var i = -1; i < 11; i++) {
        html += '<span class="' + classes.year + (i === -1 || i === 10 ? ' old' : '') + '"></span>';
    }
    yearCont.html(html);
    
    // Target set-up
    if (this.isPlaceholder) {
        this.picker.show();
        if (this.element.data('date') == 'today') {
            this.date = new Date();
            this.set();
        }
        this.element.trigger({
            type: events.show,
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
            this.component.on('click', $.proxy(this.show, this));
        } else {
            this.element.on('click', $.proxy(this.show, this));
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
    
    _triggerViewDateChange: function() {
        var viewModeName = DPGlobal.modes[this.viewMode].clsName;
        this.element.trigger(events.viewDateChanged, [{ viewDate: this.viewDate, viewMode: viewModeName }]);
    },
    
    show: function(e) {
        this.picker.show();
        this.height = this.component ? this.component.outerHeight() : this.element.outerHeight();
        this.place();
        $(window)
            .off('resize.datepicker')
            .on('resize.datepicker', $.proxy(this.place, this));
        
        if (e) {
            e.stopPropagation();
            e.preventDefault();
        }
        if (!this.isInput) {
        }
        var that = this;
        $(document)
        .off('mousedown.datepicker')
        .on('mousedown.datepicker', function(ev){
            if ($(ev.target).closest('.' + classes.component).length === 0) {
                that.hide();
            }
        });
        this.element.trigger({
            type: events.show,
            date: this.date
        });
    },
    
    hide: function(){
        this.picker.hide();
        $(window).off('resize.datepicker', this.place);
        this.viewMode = this.startViewMode;
        this.showMode();
        if (!this.isInput) {
            $(document).off('mousedown.datepicker', this.hide);
        }
        //this.set();
        this.element.trigger({
            type: events.hide,
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
        this.element.trigger(events.dateSet, [this.date, formated]);
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
        // TODO Must check dontNotify?
        this._triggerViewDateChange();
        
        if (dontNotify !== true) {
            // Notify:
            this.element.trigger({
                type: events.dateChanged,
                date: this.date,
                viewMode: DPGlobal.modes[this.viewMode].clsName
            });
        }
    },
    
    getValue: function() {
        return this.date;
    },
    
    getViewDate: function() {
        return this.viewDate;
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
        this._triggerViewDateChange();
    },
    
    getDaysElements: function() {
        return this.picker.find('.' + classes.days + ' .' + classes.monthDay);
    },
    
    fillDow: function(){
        var dowCnt = this.weekStart;
        var html = '<tr class="' + classes.weekDays + '">';
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
        /*jshint maxstatements:70, maxcomplexity:28*/
        var d = new Date(this.viewDate),
            year = d.getFullYear(),
            month = d.getMonth(),
            currentDate = this.date.valueOf();
        
        // Calculate first date to show, usually on previous month:
        var prevMonth = new Date(year, month-1, 28,0,0,0,0),
            lastDayPrevMonth = DPGlobal.getDaysInMonth(prevMonth.getFullYear(), prevMonth.getMonth());
        // L18N?
        prevMonth.setDate(lastDayPrevMonth);
        prevMonth.setDate(lastDayPrevMonth - (prevMonth.getDay() - this.weekStart + 7)%7);        

        // IMPORTANT: Avoid duplicated work, by checking we are still showing the same month,
        // so not need to 're-render' everything, only swap the active date
        if (this._prevDate && this._prevDate.getMonth() === this.viewDate.getMonth()) {
            var tbody = this.picker.find('.' + classes.days + ' tbody');
            // Remove previous active date mark
            // (viewDate has effectively the value of previous active date, but doing a class search woks too :-)
            tbody.find('.' + classes.monthDay + '.' + classes.active)
            .removeClass(classes.active);

            // Add date mark to current
            var diff = lastDayPrevMonth - prevMonth.getDate(),
                index = diff + this.date.getDate(),
                irow = (index / 7) |0,
                icol = index % 7;
            tbody.find('tr:eq(' + irow + ') td:eq(' + icol + ')').addClass(classes.active);        
            
            this._prevDate = new Date(this.viewDate);
        }
        else {
            this._prevDate = new Date(this.viewDate);

            // Header
            this.picker
            .find('.' + classes.days + ' th:eq(1)')
            .html(DPGlobal.dates.months[month] + ' ' + year);

            // Calculate ending
            var nextMonth = new Date(prevMonth);
            nextMonth.setDate(nextMonth.getDate() + 42);
            nextMonth = nextMonth.valueOf();
            var clsName,
                prevY,
                prevM;

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
                    clsName += ' ' + classes.active;
                }

                dayTd = weekTr.find('td:eq(' + currentWeekDayIndex + ')');
                dayTd
                .attr('class', classes.monthDay + ' ' + clsName)
                .data('date-time', prevMonth.toISOString())
                .children('span').text(prevMonth.getDate());

                this.picker.trigger(events.dayRendered, [dayTd]);

                // Next week?
                if (prevMonth.getDay() === this.weekEnd) {
                    weekTr = weekTr.next('tr');
                }
                prevMonth.setDate(prevMonth.getDate()+1);
            }
        }

        // Fill month and year modes:
        
        var currentYear = this.date.getFullYear();
        
        var months = this.picker.find('.' + classes.months)
                    .find('th:eq(1)')
                        .html(year)
                        .end()
                    .find('span').removeClass(classes.active);
        if (currentYear === year) {
            months.eq(this.date.getMonth()).addClass(classes.active);
        }
        
        year = parseInt(year/10, 10) * 10;
        var yearCont = this.picker.find('.' + classes.years)
                            .find('th:eq(1)')
                                .text(year + '-' + (year + 9))
                                .end()
                            .find('td');
        
        year -= 1;
        var i;
        var yearSpan = yearCont.find('span:first-child()');
        for (i = -1; i < 11; i++) {
            yearSpan
            .text(year)
            .attr('class', classes.year + (i === -1 || i === 10 ? ' old' : '') + (currentYear === year ? ' ' + classes.active : ''));
            year += 1;
            yearSpan = yearSpan.next();
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
        this._triggerViewDateChange();
        this.set();
    },

    click: function(e) {
        /*jshint maxcomplexity:16, maxstatements:30*/
        e.stopPropagation();
        e.preventDefault();
        var target = $(e.target).closest('span.month, span.year, td, th');
        if (target.length === 1) {
            var month, year;
            
            var completeMonthYear = function completeMonthYear() {
                if (this.viewMode !== 0) {
                    this.date = new Date(this.viewDate);
                    this.element.trigger({
                        type: events.dateChanged,
                        date: this.date,
                        viewMode: DPGlobal.modes[this.viewMode].clsName
                    });
                }
                this.showMode(-1);
                this.fill();
                this.set();
            }.bind(this);

            if (target.hasClass('switch')) {
                    this.showMode(1);
            }
            else if (target.hasClass('prev') ||
                target.hasClass('next')) {
                    this.moveDate(target[0].className);
            }
            else if (target.hasClass(classes.month)) {
                month = target.parent().find('span').index(target);
                this.viewDate.setMonth(month);
                completeMonthYear();
                this._triggerViewDateChange();
            }
            else if (target.hasClass(classes.year)) {
                year = parseInt(target.text(), 10)||0;
                this.viewDate.setFullYear(year);
                completeMonthYear();
                this._triggerViewDateChange();
            }
            else if (target.hasClass(classes.monthDay)) {
                if (!target.is('.disabled')){
                    var day = parseInt(target.text(), 10)||1;
                    month = this.viewDate.getMonth();
                    month += target.hasClass('old') ? -1 :
                        target.hasClass('new') ? 1 : 0;

                    year = this.viewDate.getFullYear();
                    this.date = new Date(year, month, day,0,0,0,0);
                    this.viewDate = new Date(year, month, Math.min(28, day),0,0,0,0);
                    this.fill();
                    this._triggerViewDateChange();
                    this.set();
                    this.element.trigger({
                        type: events.dateChanged,
                        date: this.date,
                        viewMode: DPGlobal.modes[this.viewMode].clsName
                    });
                }
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
            if (typeof(returned) !== 'undefined') {
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
    onRender: function(/*date*/) {
        return '';
    }
};
$.fn.datepicker.Constructor = DatePicker;

/** Public API **/
exports.DatePicker = DatePicker;
exports.defaults = DPGlobal;
exports.utils = DPGlobal;
