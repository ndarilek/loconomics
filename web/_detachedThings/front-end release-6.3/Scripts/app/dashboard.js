﻿/**
    User private dashboard section
**/
var $ = require('jquery');
var LcUrl = require('../LC/LcUrl');
var ajaxForms = require('LC/ajaxForms');

// Code on page ready
$(function () {
    /* Sidebar */
    var 
    toggle = require('../LC/toggle'),
    ProviderPosition = require('../LC/ProviderPosition');
    // Attaching 'change position' action to the sidebar links
    $(document).on('click', '[href = "#togglePositionState"]', function () {
        var 
      $t = $(this),
      v = $t.text(),
      n = toggle(v, ['on', 'off']),
      positionId = $t.closest('[data-position-id]').data('position-id');

        var pos = new ProviderPosition(positionId);
        pos
    .on(pos.stateChangedEvent, function (state) {
        $t.text(state);
    })
    .changeState(n);

        return false;
    })
    .on('click', '.delete-position a', function () {
        var positionId = $(this).closest('[data-position-id]').data('position-id');
        var pos = new ProviderPosition(positionId);

        pos
    .on(pos.removedEvent, function (msg) {
        // Current position page doesn't exist anymore, out!
        window.location = LcUrl.LangPath + 'dashboard/your-work/';
    })
    .remove();

        return false;
    });

    /* Promote */
    var generateBookNowButton = require('./dashboard/generateBookNowButton');
    // Listen on DashboardPromote instead of the more close container DashboardBookNowButton
    // allows to continue working without re-attachment after html-ajax-reloads from ajaxForm.
    generateBookNowButton.on('.DashboardPromote'); //'.DashboardBookNowButton'

    /* Privacy */
    var privacySettings = require('./dashboard/privacySettings');
    privacySettings.on('.DashboardPrivacy');

    /* Payments */
    var paymentAccount = require('./dashboard/paymentAccount');
    paymentAccount.on('.DashboardPayments');

    /* about-you */
    $('html').on('ajaxFormReturnedHtml', '.DashboardAboutYou form.ajax', function (e, $container) {
        if ($container.is('.DashboardAboutYou') || $container.find('.DashboardAboutYou').length)
            initAboutYou.apply(null, arguments);
    });
    initAboutYou();

    /* Your work init */
    $('html').on('ajaxFormReturnedHtml', '.DashboardYourWork form.ajax', function (e, $container) {
        if ($container.is('.DashboardYourWork') || $container.find('.DashboardYourWork').length)
            initYourWorkDom.apply(null, arguments);
    });
    initYourWorkDom();

    /* Availabilty */
    initAvailability();
    $('.DashboardAvailability').on('ajaxFormReturnedHtml', function (e, $container) {
        if ($container.is('.DashboardAvailability') || $container.find('.DashboardAvailability').length)
            initAvailability.apply(null, arguments);
    });
});

/**
    Instant saving and correct changes tracking
**/
function setInstantSavingSection(sectionSelector) {

    var $section = $(sectionSelector);

    if ($section.data('instant-saving')) {
        $section.on('change', ':input', function () {
            ajaxForms.doInstantSaving($section, [this]);
        });
    }
}

function initAboutYou() {
    /* Profile photo */
    var changeProfilePhoto = require('./dashboard/changeProfilePhoto');
    changeProfilePhoto.on('.DashboardAboutYou');

    /* About you / education */
    var education = require('./dashboard/educationCrudl');
    education.on('.DashboardAboutYou');

    /* About you / verifications */
    require('./dashboard/verificationsActions').on('.DashboardVerifications');
    require('./dashboard/verificationsCrudl').on('.DashboardAboutYou');

    // Instant saving
    setInstantSavingSection('.DashboardPublicBio');
    setInstantSavingSection('.DashboardPersonalWebsite');
}

function initAvailability(e) {
  // We need to avoid this logic when an event bubble
  // from the any fieldset.ajax, because its a subform event
  // and must not reset the main form (#504)
  if (e && e.target && /fieldset/i.test(e.target.nodeName))
    return;

  require('./dashboard/monthlySchedule').on();
  var weekly = require('./dashboard/weeklySchedule').on();
  require('./dashboard/calendarSync').on();
  require('./dashboard/appointmentsCrudl').on('.DashboardAvailability');

  // Instant saving
  setInstantSavingSection('.DashboardWeeklySchedule');
  setInstantSavingSection('.DashboardMonthlySchedule');
  setInstantSavingSection('.DashboardCalendarSync');
}

/**
  Initialize Dom elements and events handlers for Your-work logic.

  NOTE: .DashboardYourWork is an ajax-box parent of the form.ajax, every section
  is inside the form and replaced on html returned from server.
**/
function initYourWorkDom() {
    /* Your work / pricing */
    require('./dashboard/pricingCrudl').on();

    /* Your work / services */
    require('./dashboard/serviceAttributesValidation').setup($('.DashboardYourWork form'));

    // If we are in ajax-load, re-execute page scripts to update inline global variables
    if (arguments && arguments[3]) {
        var scripts = $(arguments[3].responseText).filter('script').map(function () { return (this.text || this.textContent || this.innerHTML || ''); });
        // 'each' functional style is not valid, for some reason evaling from there doesn't works,
        // (something like a fake window instance) so we do it with a simple loop:
        for (var i = 0; i < scripts.length; i++) {
            $.globalEval(scripts[i]);
        }
    }

    // Initialize SelectAttributes components for all categories
    // of service attributes on the page.
    var SelectAttributes = require('./dashboard/SelectAttributes');
    var attsLists = window.serviceAttributesLists || {};
    $(".SelectAttributes-autocompleteInput").each(function () {

        var $el = $(this),
            catId = $el.data('autocomplete-id'),
            selectedAtts = new SelectAttributes($el.closest('.SelectAttributes'), catId);

        // NOTE: The data is pulled from a global object,
        // thats added by the page on the body with a inline script.
        // Could be replaced by an AJAX call to JSON data, adding
        // a loading spinner hover SelectAttributes elements
        // while loading the 'attsLists' data.
        var list = attsLists[catId] || [];

        selectedAtts.setupAutocomplete(list);
        selectedAtts.fillWithCheckedAttributes(list);
    });

    // Instant saving and correct changes tracking
    setInstantSavingSection('.DashboardServices');

    /* Your work / cancellation */
    setInstantSavingSection('.DashboardCancellationPolicy');

    /* Your work / scheduling */
    setInstantSavingSection('.DashboardSchedulingOptions');

    /* Your work / locations */
    require('./dashboard/locationsCrudl').on('.DashboardYourWork');

    /* Your work / licenses */
    require('./dashboard/licensesCrudl').on('.DashboardYourWork');

    /* Your work / photos */
    require('./dashboard/managePhotosUI').on('.DashboardPhotos');
    // PhotosUI is special and cannot do instant-saving on form changes
    // because of the re-use of the editing form
    //setInstantSavingSection('.DashboardPhotos');

    /* Your work / reviews */
    $('.DashboardYourWork').on('ajaxSuccessPost', 'form', function (event, data) {
        // Reseting the email addresses on success to avoid resend again messages because
        // mistake of a second submit.
        var tb = $('.DashboardReviews [name=clientsemails]');
        // Only if there was a value:
        if (tb.val()) {
            tb
      .val('')
      .attr('placeholder', tb.data('success-message'))
            // support for IE, 'non-placeholder-browsers'
      .placeholder();
        }
    });

    /* Your work / add-position */
    var addPosition = require('./dashboard/addPosition');
    addPosition.init('.DashboardAddPosition');
    $('body').on('ajaxFormReturnedHtml', '.DashboardAddPosition', function () {
        addPosition.init();
    });
}