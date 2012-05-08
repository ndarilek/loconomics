/* Author: Loconomics */

/* Generic blockUI options sets */
var loadingBlock = { message: '<img src="' + UrlUtil.AppPath + 'img/loading.gif"/>' };
var errorBlock = function (error, reload, style) {
    return {
        css: $.extend({ cursor: 'default' }, style || {}),
        message: 'There was an error'
            + (error ? ': ' + error : '')
            + (reload ? ' <a href="javascript: ' + reload + ';">Click to reload</a>' : '')
    }
};

$.fn.HasScrollBar = function () {
    if (!this) return false;
    //note: clientHeight= height of holder
    //scrollHeight= we have content till this height
    return (this.clientHeight < this.scrollHeight) || (this.clientWidth < this.scrollWidth);
}

/*
 * Tabbed interface logic
 */
var TabbedUX = {
    init: function () {
        $('body').delegate('.tabbed > .tabs > li:not(.tabs-slider) > a', 'click', function () {
            var $t = $(this);
            TabbedUX.focusTab($t.attr('href'));
            return false;
        })
        .delegate('.tabbed > .tabs-slider > a', 'mousedown', TabbedUX.startMoveTabsSlider)
        .delegate('.tabbed > .tabs-slider > a', 'mouseup mouseleave', TabbedUX.endMoveTabsSlider)
        .delegate('.tabbed > .tabs-slider-limit', 'mouseenter', TabbedUX.startMoveTabsSlider)
        .delegate('.tabbed > .tabs-slider-limit', 'mouseleave', TabbedUX.endMoveTabsSlider)
        .delegate('.tabbed > .tabs > li.removable', 'click', function () { TabbedUX.removeTab(null, this) });

        // Init page loaded tabbed containers:
        $('.tabbed').each(function () {
            // Init slider
            TabbedUX.setupSlider($(this));
            // Clean white spaces (they create excesive separation between some tabs)
            $('.tabs', this).contents().each(function () {
                // if this is a text node, remove it:
                if (this.nodeType == 3)
                    $(this).remove();
            });
        });
    },
    moveTabsSlider: function () {
        $t = $(this);
        var dir = $t.hasClass('tabs-slider-right') ? 1 : -1;
        var tabsSlider = $t.parent();
        var tabs = tabsSlider.siblings('.tabs:eq(0)');
        tabs[0].scrollLeft += 20 * dir;
        TabbedUX.checkTabSliderLimits(tabsSlider.parent(), tabs);
        return false;
    },
    startMoveTabsSlider: function () {
        var t = $(this);
        var tabs = t.closest('.tabbed').children('.tabs:eq(0)');
        // Stop previous animations:
        tabs.stop(true);
        var speed = .3; /* speed unit: pixels/miliseconds */
        var fxa = function () { TabbedUX.checkTabSliderLimits(tabs.parent(), tabs) };
        if (t.hasClass('right')) {
            // Calculate time based on speed we want and how many distance there is:
            var time = (tabs[0].scrollWidth - tabs[0].scrollLeft - tabs.width()) * 1 / speed;
            tabs.animate({ scrollLeft: tabs[0].scrollWidth - tabs.width() },
            { duration: time, step: fxa, complete: fxa, easing: 'swing' });
        } else {
            // Calculate time based on speed we want and how many distance there is:
            var time = tabs[0].scrollLeft * 1 / speed;
            tabs.animate({ scrollLeft: 0 },
            { duration: time, step: fxa, complete: fxa, easing: 'swing' });
        }
    },
    endMoveTabsSlider: function () {
        var tabContainer = $(this).closest('.tabbed');
        tabContainer.children('.tabs:eq(0)').stop(true);
        TabbedUX.checkTabSliderLimits(tabContainer);
    },
    checkTabSliderLimits: function (tabContainer, tabs) {
        tabs = tabs || tabContainer.children('.tabs:eq(0)');
        // Set visibility of visual limiters:
        tabContainer.children('.tabs-slider-limit-left').toggle(tabs[0].scrollLeft > 0);
        tabContainer.children('.tabs-slider-limit-right').toggle(
            (tabs[0].scrollLeft + tabs.width()) < tabs[0].scrollWidth);
    },
    setupSlider: function (tabContainer) {
        var ts = tabContainer.children('.tabs-slider');
        if (tabContainer.children('.tabs').HasScrollBar()) {
            tabContainer.addClass('has-tabs-slider');
            if (ts.length == 0) {
                ts = document.createElement('div');
                ts.className = 'tabs-slider';
                $(ts)
                // Arrows:
                    .append('<a class="tabs-slider-left left" href="#">&lt;&lt;</a>')
                    .append('<a class="tabs-slider-right right" href="#">&gt;&gt;</a>');
                tabContainer.append(ts);
                tabContainer
                // Desing details:
                    .append('<div class="tabs-slider-limit tabs-slider-limit-left left" href="#"></div>')
                    .append('<div class="tabs-slider-limit tabs-slider-limit-right right" href="#"></div>');
            } else {
                ts.show();
            }
        } else {
            tabContainer.removeClass('has-tabs-slider');
            ts.hide();
        }
        TabbedUX.checkTabSliderLimits(tabContainer);
    },
    getTabContextByArgs: function (args) {
        if (args.length == 1 && typeof (args[0]) == 'string')
            return this.getTabContext(args[0], null, null);
        if (args.length == 1 && args[0].tab)
            return args[0];
        else
            return this.getTabContext(
                args.length > 0 ? args[0] : null,
                args.length > 1 ? args[1] : null,
                args.length > 2 ? args[2] : null
            );
    },
    getTabContext: function (tabOrSelector, menuitemOrSelector) {
        var mi, ma, tab, tabContainer;
        if (tabOrSelector) {
            tab = $(tabOrSelector);
            if (tab.length == 1) {
                tabContainer = tab.parent();
                ma = tabContainer.find('> .tabs > li > a[href=#' + tab.get(0).id + ']');
                mi = ma.parent();
            }
        } else if (menuitemOrSelector) {
            ma = $(menuitemOrSelector);
            if (ma.is('li')) {
                mi = ma;
                ma = mi.children('a:eq(0)');
            } else
                mi = ma.parent();
            tabContainer = mi.parent().parent();
            tab = tabContainer.find('>.tab-body#' + ma.attr('href'));
        }
        return { tab: tab, menuanchor: ma, menuitem: mi, tabContainer: tabContainer };
    },
    checkTabContext: function (ctx, functionname, args) {
        if (!ctx.tab || ctx.tab.length != 1 || !ctx.menuitem || ctx.menuitem.length != 1
            || !ctx.tabContainer || ctx.tabContainer.length != 1 || !ctx.menuanchor || ctx.menuanchor.length != 1) {
            if (console && console.error)
                console.error('TabbedUX.' + functionname + ', bad arguments: ' + Array.join(args, ', '));
            return false;
        }
        return true;
    },
    focusTab: function () {
        var ctx = this.getTabContextByArgs(arguments);
        if (!this.checkTabContext(ctx, 'focusTab', arguments)) return;

        if (ctx.menuitem.hasClass('current') ||
            ctx.menuitem.hasClass('disabled'))
            return false;

        // Unset current menu element
        ctx.menuitem.siblings('.current').removeClass('current')
            .find('>a').removeClass('current');
        // Set current menu element
        ctx.menuitem.addClass('current');
        ctx.menuanchor.addClass('current');

        // Hide current tab-body and trigger event
        ctx.tab.siblings('.current').removeClass('current')
            .triggerHandler('tabUnfocused');
        // Show current tab-body and trigger event
        ctx.tab.addClass('current')
            .triggerHandler('tabFocused');
        return true;
    },
    focusTabIndex: function (tabContainer, tabIndex) {
        if (tabContainer)
            return this.focusTab(this.getTabContext(tabContainer.find('>.tab-body:eq(' + tabIndex + ')')));
        return false;
    },
    /* Enable a tab, disabling all others tabs -usefull in wizard style pages- */
    enableTab: function () {
        var ctx = this.getTabContextByArgs(arguments);
        if (!this.checkTabContext(ctx, 'enableTab', arguments)) return;
        var rtn = false;
        if (ctx.menuitem.is('.disabled')) {
            // Remove disabled class from focused tab and menu item
            ctx.tab.removeClass('disabled')
            .triggerHandler('tabEnabled');
            ctx.menuitem.removeClass('disabled');
            rtn = true;
        }
        // Focus tab:
        this.focusTab(ctx);
        // Disabled tabs and menu items:
        ctx.tab.siblings(':not(.disabled)')
            .addClass('disabled')
            .triggerHandler('tabDisabled');
        ctx.menuitem.siblings(':not(.disabled)')
            .addClass('disabled');
        return rtn;
    },
    showhideDuration: 0,
    showhideEasing: null,
    showTab: function () {
        var ctx = this.getTabContextByArgs(arguments);
        if (!this.checkTabContext(ctx, 'showTab', arguments)) return;
        // Show tab and menu item
        ctx.tab.show(this.showhideDuration);
        ctx.menuitem.show(this.showhideEasing);
    },
    hideTab: function () {
        var ctx = this.getTabContextByArgs(arguments);
        if (!this.checkTabContext(ctx, 'hideTab', arguments)) return;
        // Show tab and menu item
        ctx.tab.hide(this.showhideDuration);
        ctx.menuitem.hide(this.showhideEasing);
    },
    tabBodyClassExceptions: { 'tab-body': 0, 'tabbed': 0, 'current': 0, 'disabled': 0 },
    createTab: function (tabContainer, idName, label) {
        tabContainer = $(tabContainer);
        // tabContainer must be only one and valid container
        // and idName must not exists
        if (tabContainer.length == 1 && tabContainer.is('.tabbed') &&
            document.getElementById(idName) == null) {
            // Create tab div:
            var tab = document.createElement('div');
            tab.id = idName;
            // Required class
            tab.className = "tab-body";
            var $tab = $(tab);
            // Get an existing sibling and copy (with some exceptions) their css classes
            $.each(tabContainer.children('.tab-body:eq(0)').attr('class').split(/\s+/), function (i, v) {
                if (!(v in TabbedUX.tabBodyClassExceptions))
                    $tab.addClass(v);
            });
            // Add to container
            tabContainer.append(tab);

            // Create menu entry
            var menuitem = document.createElement('li');
            // Because is a dynamically created tab, is a dynamically removable tab:
            menuitem.className = "removable";
            var menuanchor = document.createElement('a');
            menuanchor.setAttribute('href', '#' + idName);
            $(menuanchor).text(label);
            $(menuitem).append(menuanchor);
            // Add to tabs list container
            tabContainer.children('.tabs:eq(0)').append(menuitem);

            // Trigger event, on tabContainer, with the new tab as data
            tabContainer.triggerHandler('tabCreated', [tab]);

            this.setupSlider(tabContainer);

            return tab;
        }
        return false;
    },
    removeTab: function () {
        var ctx = this.getTabContextByArgs(arguments);
        if (!this.checkTabContext(ctx, 'removeTab', arguments)) return;

        // Only remove if is a 'removable' tab
        if (!ctx.menuitem.hasClass('removable'))
            return false;
        // If tab is currently focused tab, change to first tab
        if (ctx.menuitem.hasClass('current'))
            this.focusTabIndex(ctx.tabContainer, 0);
        ctx.menuitem.remove();
        var tabid = ctx.tab.get(0).id;
        ctx.tab.remove();

        this.setupSlider(ctx.tabContainer);

        // Trigger event, on tabContainer, with the removed tab id as data
        ctx.tabContainer.triggerHandler('tabRemoved', [tabid]);
        return true;
    }
};

/* Init code */
$(document).ready(function () {

    if (!hasPlaceholderSupport) {
        $('.has-placeholder form input[type="text"][placeholder]').focus(function () {
            if (this.value == this.getAttribute('placeholder'))
                this.value = "";
        }).blur(function () {
            if (!this.value.length)
                this.value = this.getAttribute('placeholder');
        });
    }

    /** Account popups **/
    $(document).delegate('a.login', 'click', function () {
        popup(UrlUtil.LangPath + 'Account/$Login/', { width: 410, height: 320 });
        return false;
    });
    $(document).delegate('a.register', 'click', function () {
        popup(UrlUtil.LangPath + 'Account/$Register/', { width: 450, height: 430 });
        return false;
    });
    $(document).delegate('a.forgot-password', 'click', function () {
        popup(UrlUtil.LangPath + 'Account/$ForgotPassword/', { width: 400, height: 220 });
        return false;
    });

    $('a#launchHowItWorks').click(function (event) {
        event.preventDefault();
        $('div.blockUI.blockMsg.blockPage').addClass('fancy');
        $.blockUI({
            message: $('#howItWorksModal'),
            centerY: true,
            css: {
                top: ($(window).height() - 550) / 2 + 'px',
                left: ($(window).width() - 400) / 2 + 'px',
                width: '400px',
                padding: '25px',
                border: '5px solid #b5e1e2',
                '-moz-border-radius': '12px',
                '-webkit-border-radius': '12px',
                'border-radius': '12px',
                '-moz-background-clip': 'padding',
                '-webkit-background-clip': 'padding-box',
                'background-clip': 'padding-box'
            },
            overlayCSS: { cursor: 'default' }
        });

        $('.blockOverlay').attr('title', 'Click to unblock').click($.unblockUI);
    });

    $('div.progress-bar').each(function () {
        var pd = $(this).find('.text .percent-done').text();
        $(this).find('.total .percent-done').css('width', pd);
    });

    // Autocomplete on User Supplied data
    $('#titleSearch').autocomplete({ source: UrlUtil.JsonPath + 'GetPositions/Autocomplete/',
        // dataSupply: [
        // 	{value: 'housekeeper', display: 'housekeeper'}, 
        // 	{value: 'plumber', display: 'plumber'}, 
        // 	{value: 'carpenter', display: 'carpenter'}, 
        // 	{value: 'landscaper', display: 'landscaper'}, 
        // 	{value: 'babysitter', display: 'babysitter'}, 
        // 	{value: 'french', display: 'french tutor'}, 
        // 	{value: 'math', display: 'math tutor'}, 
        // 	{value: 'guitar', display: 'guitar lessons'}
        // ],
        /*width: '230px',*/
        select: function (event, ui) {
            if ($('#selectedTitles option').length < 5) {
                if ($('#selectedTitles option:contains(' + ui.data.display + ')').length < 1) {
                    $('#selectedTitles').append('<option value="' + ui.data.value + '">' + ui.data.display + '</option>').removeClass('empty');
                }
                else { return false }
            }
            else { return false }
            $('#titleSearch').val('');
        }
    });

    // Trigger whole list
    $('#seeAllTitles').click(function () {
        $('#titleSearch').autocomplete({ source: 'button.supply' });
    });

    // Remove selected item
    $('#selectedTitles li').live('click', function () {
        $(this).remove();
        $('#titleSearch').focus();
    });

    // Date Picker
    $.datepicker.setDefaults($.datepicker.regional[$('html').attr('lang')]);
    $(".date-pick")
        .val(new Date().asString($.datepicker._defaults.dateFormat))
        .datepicker({
            showOn: "button",
            buttonImage: "",
            buttonImageOnly: true,
            showAnim: "blind"
        });

    // Tabbed interface
    TabbedUX.init();

    /** Auto-fill menu sub-items using tabbed pages -only works for current page items- **/
    $('.autofill-submenu .current').each(function () {
        var parentmenu = $(this);
        // getting the submenu elementos from the tabs marked with class 'autofill-submenu-items'
        var items = $('.autofill-submenu-items li');
        // if there is items, create the submenu cloning it!
        if (items.length > 0) {
            var submenu = document.createElement("ul");
            parentmenu.append(submenu);
            // Cloning without events:
            var newitems = items.clone(false, false);
            $(submenu).append(newitems);

            // We need attach events to maintain the tabbed interface working
            // New Items (cloned) must change tabs:
            newitems.find("a").click(function () {
                // Trigger event in the original item
                $("a[href='" + this.getAttribute("href") + "']", items).click();
                // Change menu:
                $(this).parent().parent().find("a").removeClass('current');
                $(this).addClass('current');
                // Stop event:
                return false;
            });
            // Original items must change menu:
            items.find("a").click(function () {
                newitems.parent().find("a").removeClass('current').
                filter("*[href='" + this.getAttribute("href") + "']").addClass('current');
            });
        }
    });

    /** Dashboard Alerts carousel **/
    $('#dashboard-alerts').each(function () {
        var da = $(this);

        var ul = da.find('ul');
        var set = ul.find('li');
        var cont = $('<div></div>');
        cont.css('position', 'relative');
        cont.css('width', ul.width());
        cont.css('height', ul.height());
        cont.css('margin', 'auto');
        cont.css('overflow', 'hidden');
        cont.css('display', 'inline-block');
        ul.css('position', 'relative');
        ul.css('overflow', 'visible');
        ul.css('width', 'auto');
        ul.wrap(cont);
        var w = cont.width();

        function routeAlerts(event) {
            var p = ul.data('page') || 0;
            if (event.data.reverse)
                p--;
            else
                p++;

            if (p <= 0)
                p = 0;
            else if (p + 1 >= ul.width() / w)
                p = Math.round(ul.width() / w, 0) - 1;

            offl = (w + 3) * (0 - p);

            ul.data('page', p);

            ul.stop().animate({ left: offl }, { duration: 'fast' });
            return false;
        }

        da.find('.more.next').click({ reverse: false }, routeAlerts);
        da.find('.more.previous').click({ reverse: true }, routeAlerts);
    });
    //$('#dashboard-alerts > ul > li').hide().slice(0, 2).show();

    /* Active/Desactive search filters */
    $(".buttons-list .button").click(function () { $(this).toggleClass('selected'); return false; });

    /* Wizard Tabbed Forms: ajax submit and next-step loading  */
    $("body").delegate(".tabbed.wizard .next", "click", function () {
        // getting the form
        var form = $(this).parents('form').eq(0);
        // getting the current wizard step-tab
        var currentStep = form.parents('.tab-body').eq(0);
        // getting the wizard container
        var wizard = form.parents('.tabbed.wizard').eq(0);
        // getting the wizard-next-step
        var nextStep = $(this).data('wizard-next-step');

        // First at all, if unobtrusive validation is enabled, validate
        var valobject = form.data('unobtrusiveValidation');
        if (valobject && valobject.validate() == false)
        // Validation is actived, was executed and the result is 'false': bad data, stop Post:
            return;

        // Raise event
        currentStep.trigger('beginSubmitWizardStep');

        // Loading, with retard
        var loadingtimer = setTimeout(function () {
            currentStep.block(loadingBlock);
        }, 600);
        var autoUnblockLoading = true;

        var ok = false;

        // Do the Ajax post
        $.ajax({
            url: (form.attr('action') || ''),
            type: 'POST',
            data: form.serialize(),
            success: function (data, text, jx) {
                // If is a JSON result:
                if (typeof (data) === 'object') {
                    if (data.Code == 0) {
                        // If there is next-step
                        if (nextStep) {
                            // If next step is internal url (a next wizard tab)
                            if (/^#/.test(nextStep)) {
                                $(nextStep).trigger('beginLoadWizardStep');

                                TabbedUX.enableTab(nextStep);

                                ok = true;
                                $(nextStep).trigger('endLoadWizardStep');
                            } else {
                                // If there is a next-step URI that is not internal link, we load it
                                window.location = nextStep;
                            }
                        }
                    } else if (data.Code == 1) {
                        // Just like in normal form.ajax, Code=1 means a client Redirect to the URL at data.Result
                        window.location = data.Result;
                    } else { // data.Code < 0
                        // There is an error code.

                        // Unblock loading:
                        currentStep.unblock();
                        // Block with message:
                        var message = (data.Result ? data.Result.ErrorMessage ? data.Result.ErrorMessage : data.Result : '');
                        currentStep.block({
                            message: 'Error: ' + message,
                            css: popupStyle(popupSize('small')),
                            timeout: 20000
                        })
                        .click(function () { currentStep.unblock(); });

                        // Do not unblock in complete function!
                        autoUnblockLoading = false;
                    }
                } else {
                    // Post was wrong, html was returned to replace current form:
                    currentStep.html(data);
                    currentStep.trigger('reloadedHtmlWizardStep');
                }
                currentStep.unblock();
            },
            error: ajaxErrorPopupHandler,
            complete: function () {
                currentStep.trigger('endSubmitWizardStep', ok);

                // Disable loading
                clearTimeout(loadingtimer);
                // Unblock
                if (autoUnblockLoading) {
                    currentStep.unblock();
                }
            }
        });
        return false;
    });

    /*******************************
    * Ajax Forms generic function.
    * Result expected is:
    * - html, for validation errors from server, replacing current .ajax-box content
    * - json, with structure: { Code: integer-number, Result: string-or-object }
    *   Code numbers:
    *    - Negative: errors, with a Result object { ErrorMessage: string }
    *    - Zero: success result, it shows a message with content: Result string, else form data attribute 'success-post-message', else a generic message
    *    - 1: success result, Result contains a URL, the page will be redirected to that.
    *    - Major 1: success result, with custom handler throught the form event 'success-post-message'.
    */
    function ajaxFormsSubmitHandler(event) {
        // Default data for required params:
        var form = (event.data ? event.data.form : null) || $(this);
        var box = (event.data ? event.data.box : null) || form.closest(".ajax-box");
        var action = (event.data ? event.data.action : null) || form.attr('action') || '';
        var data = form.find(':input').serialize();

        // First at all, if unobtrusive validation is enabled, validate
        var valobject = form.data('unobtrusiveValidation');
        if (valobject && valobject.validate() == false)
        // Validation is actived, was executed and the result is 'false': bad data, stop Post:
            return;

        // Loading, with retard
        var loadingtimer = setTimeout(function () {
            box.block(loadingBlock);
        }, 600);
        var autoUnblockLoading = true;

        // Do the Ajax post
        $.ajax({
            url: (action),
            type: 'POST',
            data: data,
            success: function (data, text, jx) {
                // If is a JSON result:
                if (typeof (data) === 'object') {
                    // Special Code 1: do a redirect
                    if (data.Code == 1) {
                        window.location = data.Result;
                    } else if (data.Code == 0) {
                        // Special Code 0: general success code, show message saying that 'all was fine'

                        // Unblock loading:
                        box.unblock();
                        // Block with message:
                        var message = data.Result || form.data('success-post-message') || 'Saved';
                        box.block({
                            message: message,
                            css: popupStyle(popupSize('small'))
                        })
                        .click(function () { box.unblock(); });
                        // Do not unblock in complete function!
                        autoUnblockLoading = false;
                    } else if (data.Code > 1) {
                        // User Code: trigger custom event to manage results:
                        form.trigger('ajaxSuccessPost', [data, text, jx]);
                    } else { // data.Code < 0
                        // There is an error code.

                        // Unblock loading:
                        box.unblock();
                        // Block with message:
                        var message = data.Code + ": " + (data.Result ? data.Result.ErrorMessage ? data.Result.ErrorMessage : data.Result : '');
                        box.block({
                            message: 'Error: ' + message,
                            css: popupStyle(popupSize('small'))
                        })
                        .click(function () { box.unblock(); });

                        // Do not unblock in complete function!
                        autoUnblockLoading = false;
                    }
                } else {
                    // Post was wrong, html was returned to replace current 
                    // form container: the ajax-box.
                    var newhtml = $(data);
                    // Check if the returned element is the ajax-box, if not, find
                    // the element in the newhtml:
                    if (!newhtml.is('.ajax-box'))
                        newhtml = newhtml.find('.ajax-box');
                    // Replace the box with the new html:
                    box.replaceWith(newhtml);
                }
            },
            error: ajaxErrorPopupHandler,
            complete: function () {
                // Disable loading
                clearTimeout(loadingtimer);
                // Unblock
                if (autoUnblockLoading) {
                    box.unblock();
                }
            }
        });

        // Stop normal POST:
        return false;
    }
    /* Attach a delegated handler to manage ajax forms */
    $(document).delegate('form.ajax', 'submit', ajaxFormsSubmitHandler);
    /* Attach a delegated handler for a special ajax form case: subforms, using fieldsets. */
    $(document).delegate('fieldset.ajax .ajax-fieldset-submit', 'click',
        function (event) {
            var form = $(this).closest('fieldset.ajax');
            event.data = {
                form: form,
                box: form.closest('.ajax-box'),
                action: form.data('ajax-fieldset-action')
            };
            return ajaxFormsSubmitHandler(event);
        }
    );

    /* Generic script for fieldsets with class .has-confirm, allowing show
    the content only if the main confirm fields have 'yes' selected */
    $("fieldset.has-confirm").each(function () {
        var fs = $(this);
        fs.find("> .confirm input").change(function () {
            var t = $(this);
            if (t.is(':checked'))
                if (t.val() == 'yes')
                    fs.removeClass('confirmed-no').addClass('confirmed-yes');
                else
                    fs.removeClass('confirmed-yes').addClass('confirmed-no');
        });
    });

    /* Generic script for help-point button, that will open the help-center at
    index or at specific page depending on the context
    ('.current' classes asigned and data-help-point="section" attribute or
    element id)
    */
    $(".help-point > a").click(function () {
        // We get the last 'current' element, that will be the deepest child with
        // .current setted.
        var c = $(".current:visible:last");
        // We save the path like an array
        var path = [];
        path.push(c.data('help-point'));
        // We look for parents with 'current' assigned, to get the full path
        c.parents('.current').each(function () {
            path.push($(this).data('help-point'));
        });
        // Building the relative url for help-center
        var rurl = path.reverse().join('');
        // If there is not 'data-help-point' values, we use the current element id to search,
        // or nothing (that means help center main page)
        if (!rurl) rurl = (c.attr('id') ? '?s=' + encodeURIComponent(c.attr('id')) : '');
        // Opening the help center
        popup(UrlUtil.LangPath + 'HelpCenter/' + rurl, 'large');
        // Do not allow browser to open the link url:
        return false;
    });
});

/*******************
 * Popup related 
 * functions
 */
function popupSize(size) {
    var s = (size == 'large' ? .8 : (size == 'medium' ? .5 : (size == 'small' ? .2 : size || .5)));
    return {
        width: Math.round($(window).width() * s),
        height: Math.round($(window).height() * s),
        sizeFactor: s
    }
}
function popupStyle(size) {
    return {
        cursor: 'default',
        width: size.width + 'px',
        left: Math.round(($(window).width() - size.width) / 2) - 30 + 'px',
        height: size.height + 'px',
        top: Math.round(($(window).height() - size.height) / 2) - 30 + 'px',
        padding: '25px',
        overflow: 'auto',
        border: '5px solid #b5e1e2',
        '-moz-border-radius': '12px',
        '-webkit-border-radius': '12px',
        'border-radius': '12px',
        '-moz-background-clip': 'padding',
        '-webkit-background-clip': 'padding-box',
        'background-clip': 'padding-box'
    };
}
function popup(url, size, complete){
    // Native popup
    //window.open(url);

    // Smart popup
    var swh;
    if (size && size.width)
        swh = size;
    else
        swh = popupSize(size);        
    
    $('div.blockUI.blockMsg.blockPage').addClass('fancy');
    $.blockUI({ 
       message: '<img src="' + UrlUtil.AppPath + 'img/loading.gif"/>',
       centerY: false,
       css: popupStyle(swh),
       overlayCSS: { cursor: 'default' }
    });

    // Loading Url with Ajax and place content inside the blocked-box
    $.ajax({ url: url,
        success: function (data) {
            if (typeof (data) === 'object') {
                if (data.Code && data.Code == 2) {
                    $.unblockUI();
                    popup(data.Result, { width: 410, height: 320 });
                } else {
                    // Unexpected code, show result
                    $('.blockMsg').html(data.Result);
                }
            } else {
                // Page content got, paste into the popup if is partial html (url starts with$)
                if (/((^\$)|(\/\$))/.test(url)) {
                    $('.blockMsg').html(data);
                } else {
                    // Else, if url is a full html page (normal page), put content into an iframe
                    var iframe = $('<iframe id="blockUIIframe" width="' + swh.width + '" height="' + swh.height + '" style="border:none;"></iframe>').get(0);
                    // When the iframe is ready
                    var iframeloaded = false;
                    iframe.onload = function () {
                        // Using iframeloaded to avoid infinite loops
                        if (!iframeloaded) {
                            iframeloaded = true;
                            injectIframeHtml(iframe, data);
                        }
                    };
                    // replace blocking element content (the loading) with the iframe:
                    $('.blockMsg').html(iframe);
                }
            }
        }, error: function (j, textStatus) {
            $('div.blockMsg').text('Page not found');
        }, complete: complete
    });

    
    $('.blockOverlay').attr('title','Click to unblock').click($.unblockUI);
}
function ajaxErrorPopupHandler(jx, message, ex) {
    var m = message;
    var iframe = null;
    size = popupSize('large');
    if (m == 'error') {
        iframe = $('<iframe id="blockUIIframe" width="' + size.width + '" height="' + (size.height - 10) + '"></iframe>').get(0);
        var iframeloaded = false;
        iframe.onload = function () {
            // Using iframeloaded to avoid infinite loops
            if (!iframeloaded) {
                iframeloaded = true;
                injectIframeHtml(iframe, jx.responseText);
            }
        };
        m = null;
    }  else
        m = m + "; " + ex;

    // Block all window, not only current element
    $.blockUI(errorBlock(m, null, popupStyle(size)));
    if (iframe)
        $('.blockMsg').html(iframe);
    $('.blockUI').click(function () { $.unblockUI() });
}
/* Puts full html inside the iframe element passed in a secure and compliant mode */
function injectIframeHtml(iframe, html) {
    // put ajax data inside iframe replacing all their html in secure 
    // compliant mode ($.html don't works to inject <html><head> content)

    /* document API version (problems with IE, don't execute iframe-html scripts) */
    /*var iframeDoc =
        // W3C compliant: ns, firefox-gecko, chrome/safari-webkit, opera, ie9
        iframe.contentDocument ||
        // old IE (5.5+)
        (iframe.contentWindow ? iframe.contentWindow.document : null) ||
        // fallback (very old IE?)
        document.frames[iframe.id].document;
    iframeDoc.open();
    iframeDoc.write(html);
    iframeDoc.close();*/

    /* javascript URI version (works fine everywhere!) */
    iframe.contentWindow.contents = html;
    iframe.src = 'javascript:window["contents"]';

    // About this technique, this http://sparecycles.wordpress.com/2012/03/08/inject-content-into-a-new-iframe/
}
function getURLParameter(name) {
    return decodeURI(
        (RegExp(name + '=' + '(.+?)(&|$)', 'i').exec(location.search) || [, null])[1]);
}
function hasPlaceholderSupport() {
    var input = document.createElement('input');
    return ('placeholder' in input);
}