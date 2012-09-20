﻿
/*
 * For Messaging, waiting for loadHashBang to know if we must load
 * an specific message thread at page loading
 */
$(document).bind('loadHashBang', function (event, hashbangvalue) {
    var urlParameters = getHashBangParameters(hashbangvalue);
    // Analize parameters values
    if (urlParameters.Thread) {
        openMessageThreadInTab(urlParameters.Thread, "Message Thread " + urlParameters.Thread, urlParameters.Message);
    }
    if (urlParameters.BookingRequest) {
        openBookingInTab(urlParameters.BookingRequest, urlParameters.Booking,
            "Booking Request " + urlParameters.BookingRequest);
    } else if (urlParameters.Booking) {
        openBookingInTab(0, urlParameters.Booking,
            "Booking " + urlParameters.Booking, ('Review' in urlParameters));
    }
});

$(document).ready(function () {
    /* Special urls */
    function checkSpecialURIs() {
        if (location.hash == '#!pricing') {
            // go to the first position pricing tab
            if (/\/Dashboard\/Positions\//i.test(location.pathname)) {
                // Find first position, pricing tab
                var u = $('#main.tabbed > .tabs > li:eq(0) > a').attr('href') + '-pricing';
                window.location = u;
            } else {
                // Redirect to positions page
                window.location = UrlUtil.LangPath + 'Dashboard/Positions/#!pricing';
            }
        }
    }
    checkSpecialURIs();
    if ($.fn.hashchange)
        $(window).hashchange(checkSpecialURIs);
    /*
    * Change Photo
    */
    $('#changephoto').click(function () {
        popup(UrlUtil.LangPath + 'Dashboard/ChangePhoto/', { width: 240, height: 240 });
        return false;
    });
    /*
    * Modify position photos: Upload Photo, Edit, Delete
    */
    initPositionPhotos();
    $('.positionphotos').parent().on('click', '.positionphotos-tools-upload > a', function () {
        var posID = $(this).closest('form').find('input[name=PositionID]').val();
        popup(UrlUtil.LangPath + 'Dashboard/UploadPhoto/?PositionID=' + posID, 'small');
        return false;
    })
    .on('click', '.positionphotos-gallery li a', function () {
        var $t = $(this);
        var form = $t.closest('form');
        var editPanel = $('.positionphotos-edit', form);
        smoothBoxBlockCloseAll(form);
        // Set this photo as selected
        var selected = $t.closest('li');
        selected.addClass('selected').siblings().removeClass('selected');
        //var selected = $('.positionphotos-gallery > ol > li.selected', form);
        if (selected != null && selected.length > 0) {
            var selImg = selected.find('img');
            // Moving selected to be edit panel
            var photoID = selected.attr('id').match(/^UserPhoto-(\d+)$/)[1];
            editPanel.find('[name=PhotoID]').val(photoID);
            editPanel.find('img').attr('src', selImg.attr('src'));
            editPanel.find('[name=photo-caption]').val(selImg.attr('alt'));
            var isPrimaryValue = selected.hasClass('is-primary-photo') ? 'True' : 'False';
            editPanel.find('[name=is-primary-photo]').prop('checked', false);
            editPanel.find('[name=is-primary-photo][value=' + isPrimaryValue + ']').prop('checked', true);
        }
        return false;
    })
    .on('click', '.positionphotos-edit-delete a', function () {
        var editPanel = $(this).closest('.positionphotos-edit');
        // Change the field delete-photo to True and send form for an ajax request with
        // server delete task and content reload
        editPanel.find('[name=delete-photo]').val('True');
        editPanel.closest('form').submit();
    })
    // Show a message to the user about all was saved fine
    .on('ajaxFormReturnedHtml', '.positionphotos', function () {
        ajaxFormMessageOnHtmlReturnedWithoutValidationErrors(this, "All was saved succesfully!");
    });

    /*
    * Booking list actions
    */
    $('body').delegate('.bookings-list .actions .item-action', 'click', function () {
        var $t = $(this);
        if ($t.hasClass('change-state'))
            openChangeBookingStateForm($t.data('booking-id'), $t);
        else
            openBookingInTab(
                $t.data('booking-request-id'),
                $t.data('booking-id'),
                $t.closest('.bookings-list').find('.user-public-name:eq(0)').text()
            );
    });

    /*
    * Booking Request confirmation
    */
    $('body').delegate('.booking-request-action', 'click', function () {
        var brId = $(this).data('booking-request-id');
        var $tab = $(this).closest('.tab-body');
        var options = { autoUnblockLoading: true };
        var data = { BookingRequestID: brId };
        var $t = $(this);
        var url;
        if ($t.hasClass('button-confirm-datetime')) {
            data.ConfirmedDateType = $(this).data('date-type');
            url = 'Booking/$ConfirmBookingRequest/';
        } else if ($t.hasClass('button-decline-booking')) {
            url = 'Booking/$DeclineBookingRequest/';
        } else if ($t.hasClass('button-cancel-booking')) {
            url = 'Booking/$CancelBookingRequest/';
        } else {
            // Bad handler:
            return;
        }
        var ctx = { form: $tab, boxIsContainer: true };

        // Loading, with retard
        ctx.loadingtimer = setTimeout(function () {
            $tab.block(loadingBlock);
        }, gLoadingRetard);

        // Do the Ajax post
        $.ajax({
            url: UrlUtil.LangPath + url,
            data: data,
            context: ctx,
            success: function (data, text, jx) {
                $.proxy(ajaxFormsSuccessHandler, this)(data, text, jx);
                // Some list updates
                // After update request, bookings-list tab need be reloaded
                $('#bookings-all').reload();
                // After update request, state changed, new message created, reload thread list to reflect it
                $('#inbox').reload();
            },
            error: ajaxErrorPopupHandler,
            complete: ajaxFormsCompleteHandler
        });
    })
    .delegate('.review-booking-action', 'click', function () {
        var $t = $(this);
        var extraData = {};
        var asUserID = $t.data('as-user-id');
        if (asUserID)
            extraData = { AsUserID: asUserID };
        openBookingInTab(
            0,
            $t.data('booking-id'),
            $t.closest('.booking').find('.user-public-name:eq(0)').text(),
            true,
            extraData
        );
    })
    .delegate('.booking-review .open-booking-action', 'click', function () {
        var $t = $(this);
        openBookingInTab(
            0,
            $t.data('booking-id'),
            $t.closest('.booking-review').find('.user-public-name:eq(0)').text()
        );
    });

    /*===============
    * Admin bookings
    */
    $('#admin-bookings').on('click', '.change-booking-status .set-status, .change-booking-status .see-payment-data', function () {
        var $t = $(this);
        var form = $t.closest('form');
        var h = form.find('.change-booking-state-action');
        h.val($t.val());
        if ($t.hasClass('set-status'))
            h.attr('name', 'change-booking-status-id');
        else if ($t.hasClass('see-payment-data'))
            h.attr('name', 'see-payment-data');
        form.submit();
    })
    .on('ajaxSuccessPostMessageClosed', '.change-booking-status-form', function (e, data) {
        if (data.Code == 0) $(this).closest('.tab-body').reload();
    }).on('ajaxSuccessPost', '.change-booking-status-form', function (e, data) {
        if (data.Code == 0)
        // Reload bookings lists already loaded to refresh state (because could change the content)
            $(this).closest('.tab-body').siblings('.tab-body').each(function () {
                // only if already loaded:
                var $t = $(this);
                if ($t.children().length > 0)
                    $t.reload();
            });
    });

    /*=========
    * Messaging
    */
    $('body').delegate('.message-thread-list .actions .item-action', 'click', function () {
        var $t = $(this);
        var auxT = $t.data('message-aux-t');
        var auxID = $t.data('message-aux-id');
        if ((auxT == "Booking" || auxT == "BookingRequest") && auxID) {
            var brID = auxID;
            var bID = 0;
            if (auxT == "Booking") {
                brID = 0;
                bID = auxID;
            }
            openBookingInTab(
                brID,
                bID,
                $t.closest('.items-list').find('.user-public-name:eq(0)').text()
            );
        } else
            openMessageThreadInTab(
                $(this).data('message-thread-id'),
                $(this).closest('.message-thread-list').find('.user-public-name:eq(0)').text());
    })
    .delegate('.conversation-messages > li.new-message textarea', 'focus', function () {
        $(this).animate({ height: 250 });
    });

    /*** Locations ***/
    (function ($positionslocations) {
        // Fast quick
        if ($positionslocations.length == 0) return;

        $positionslocations.each(function () {
            var $locationsPanel = $(this);

            var ep = $locationsPanel.children('.edit-panel');
            var vp = $locationsPanel.children('.view-panel');

            vp.on('click', '.addlocation', function () {
                // We read the data-source-url attribute to get the Default value, with LocationID=0, instead the last reload value:
                ep.show().reload(ep.attr('data-source-url') + '&' + $(this).data('extra-query'));
                return false;
            })
            .on('click', '.address .edit', function () {
                // We read the data-source-url attribute to get the Default value, and we replace LocationID=0 with the clicked location-id data:
                ep.show().reload(ep.attr('data-source-url').replace('LocationID=0', 'LocationID=' + $(this).closest('.address').data('location-id')));
                return false;
            }).on('click', '.address .delete', function () {
                var res = vp.find('.lc-ressources');
                var loc = $(this).closest('.address');
                if (confirm(res.children('.confirm-delete-location-message').text())) {
                    smoothBoxBlock(res.children('.delete-location-loading-message'), loc);
                    var luse = loc.closest('.locations-set').data('location-use');
                    $.ajax({
                        url: ep.attr('data-source-url').replace('LocationID=0', 'LocationID=' + loc.data('location-id')) + '&action=delete&use=' + luse,
                        //UrlUtil.LangPath + 'Dashboard/$PositionsLocationEdit/?action=delete&LocationID=' + loc.data('location-id'),
                        success: function (data) {
                            if (data && data.Code == 0) {
                                smoothBoxBlock('<div>' + data.Result + '</div>', loc);
                                loc.click(function () { smoothBoxBlock(null, loc); loc.hide('slow', function () { loc.remove() }) });
                            }
                        },
                        error: function (jx, message, ex) {
                            ajaxErrorPopupHandler(jx, message, ex);
                            smoothBoxBlock(null, loc);
                        }
                    });
                }
                return false;
            });
            function closeAndClearEditPanel() {
                ep.hide('slow', function () {
                    // Remove form to avoid a 'flickering cached data' effect next time is showed:
                    ep.children().remove()
                });
                return false;
            }
            ep.on('click', '.cancel-action', closeAndClearEditPanel)
            .on('ajaxSuccessPost', 'form', function (e, data) {
                if (data.Code == 0) vp.show('slow').reload();
            })
            .on('ajaxSuccessPostMessageClosed', '.ajax-box', closeAndClearEditPanel);
        });
    })($('.positionlocations'));

    /*==============
    * Payments
    */
    function payment_preference_check() {
        var bank = $('.bank-account-preference');
        var checkedvalue = null;
        $('input[name=payment-type]').each(function () {
            if (this.checked)
                checkedvalue = this.value;
        });
        if (checkedvalue == '4')
            bank.show(300);
        else
            if (bank.is(':visible'))
                bank.hide(300);
            else
                bank.css('display', 'none');
    }
    $('input[name=payment-type]').change(payment_preference_check);
    payment_preference_check();

    /*==============
    * Licenses
    */
    function setup_license_request_form($t) {
        var v = $t.val();
        var option = $t.find(':selected');
        var p = $t.parent();
        var form = p.closest('.positionlicenses');
        var licenseRequest = $('.license-request', form);
        var det = $('.license-details', p);
        if (v) {
            $('.license-description', det).text(option.data('description'));
            $('.license-state', det).text(option.data('state-name'));
            $('.license-authority', det).text(option.data('authority-name'))
                .attr('href', option.data('verification-url'));
            var geturl = option.data('get-license-url');
            if (geturl)
                $('.get-license-url', form).show().attr('href', geturl);
            else
                $('.get-license-url', form).hide();
            // Showing:
            det.show(300);
            licenseRequest.show(300);
            form.find('.actions button').show(300);
        } else {
            det.hide(300);
            licenseRequest.hide(300);
            form.find('.actions button').hide(300);
        }
    }
    $('body').delegate('.license-type-selector > select', 'change', function () {
        setup_license_request_form($(this));
    }).delegate('form.positionlicenses', 'ajaxFormReturnedHtml', function () {
        // Listen the form.ajax event about returning html after post the form:
        setup_license_request_form($('.license-type-selector > select'));
    });
    setup_license_request_form($('.license-type-selector > select'));
    /*==========================
    * Verified licenses widget
    */
    $('body').on('click', '.user-verified-licenses h5', function () {
        $(this).siblings('.verified-license-details').toggle(300);
        return false;
    });

    /*==========================
    * Pricing Wizard: packages
    */
    (function ($pricingPackage) {
        // Fast quick
        if ($pricingPackage.length == 0) return;

        $pricingPackage.find('.add-package').click(function () {
            var editPanel = $(this).siblings('.edit-panel');
            // We read the data-source-url attribute to get the Default value, with ProviderPackageID=0, instead the last reload value:
            editPanel.show().reload(editPanel.attr('data-source-url'));
            $(this).hide('slow');
            return false;
        });
        $pricingPackage.find('.view-panel').on('click', '.provider-package .edit', function () {
            var editPanel = $(this).closest('.package-pricing-type').find('.edit-panel');
            editPanel.closest('.pricingwizard').find('.add-package').hide('slow');
            // We read the data-source-url attribute to get the Default value, and we replace ProviderPackageID=0 with the clicked provider-package-id data:
            editPanel.show().reload(editPanel.attr('data-source-url').replace('ProviderPackageID=0', 'ProviderPackageID=' + $(this).data('provider-package-id')));
            return false;
        }).on('click', '.provider-package .delete', function () {
            var pak = $(this).closest('.provider-package');
            var res = pak.closest('.view-panel').find('.lc-ressources');
            if (confirm(res.children('.confirm-delete-package-message').text())) {
                smoothBoxBlock(res.children('.delete-package-loading-message'), pak);
                $.ajax({ url: UrlUtil.LangPath + 'PricingWizard/$ProviderPackageEdit/?action=delete&ProviderPackageID=' + $(this).data('provider-package-id'),
                    success: function (data) {
                        if (data && data.Code == 0) {
                            smoothBoxBlock('<div>' + data.Result + '</div>', pak);
                            pak.click(function () { smoothBoxBlock(null, pak); pak.hide('slow', function () { pak.remove() }) });
                        }
                    },
                    error: function (jx, message, ex) {
                        ajaxErrorPopupHandler(jx, message, ex);
                        smoothBoxBlock(null, pak);
                    }
                });
            }
        });
        $pricingPackage.find('.edit-panel').each(function () {
            var editPanel = $(this);
            var pw = editPanel.closest('.pricingwizard');
            var hasEdit = editPanel.children().length == 0;
            pw.find('.add-package').toggle(hasEdit);
            editPanel.toggle(!hasEdit)
                    .on('click', '.cancel-action', function () {
                        editPanel.hide('slow', function () {
                            $(this).closest('.pricingwizard').find('.add-package').show('fast');
                            $(this).children().remove();
                        });
                    });
        });
        $pricingPackage.on('ajaxSuccessPost', '.edit-panel form', function (e, data) {
            if (data.Code == 0) {
                var pw = $(this).closest('.pricingwizard');
                pw.find('.your-packages').show('slow').reload();
            }
        }).on('ajaxSuccessPostMessageClosed', '.edit-panel .ajax-box', function (e, data) {
            $(this).closest('.edit-panel').hide('slow', function () {
                $(this).closest('.pricingwizard').find('.add-package').show('fast');
                $(this).children().remove()
            });
        });
    })($('.pricingwizard.package-pricing-type'));

    /**==================
    * Background check 
    */
    $('.position-background-check-tab').on('click', '.position-background-check .buy-action', function () {
        var bcid = $(this).data('background-check-id');
        var posID = $(this).data('position-id');
        var cont = $(this).closest('.position-background-check');
        cont.data('position-id', posID);
        var ps1 = cont.find('.popup.buy-step-1');
        var f = ps1.find('form');
        f.find('[name=BackgroundCheckID]').val(bcid);
        f.find('.main-action').val($(this).text());

        smoothBoxBlock(ps1, cont, 'background-check');
        return false;
    })
    .on('click', '.position-background-check .close-popup-action', function () {
        var cont = $(this).closest('.position-background-check');
        var posID = cont.data('position-id');
        smoothBoxBlock(null, cont);
        if ($(this).closest('.popup').is('.buy-step-2'))
            cont.closest('.tab-body').reload(UrlUtil.LangPath + 'Dashboard/$PositionsBackgroundCheck/?PositionID=' + posID);
        return false;
    })
    .on('ajaxSuccessPost', '.popup.buy-step-1 form', function (e, data) {
        if (data.Code == 101) {
            var cont = $(this).closest('.position-background-check');
            smoothBoxBlock(null, cont);
            var ps2 = cont.find('.popup.buy-step-2');
            smoothBoxBlock(ps2, cont, 'background-check');
        }
    });

    /**==============
    * Preferences
    */
    $('.preferences').on('click', '.my-account a', function () {
        var c = $(this).closest('.tab-body');
        c.on('click', '.cancel-action', function () {
            smoothBoxBlock(null, c);
        });
        var lres = c.find('.my-account-ressources');
        c.on('ajaxSuccessPostMessageClosed', '.ajax-box', function () {
            window.location.reload();
        });
        var b;
        switch ($(this).attr('href')) {
            case '#delete-my-account':
                b = smoothBoxBlock(lres.children('.delete-message-confirm').clone(), c);
                break;
            case '#deactivate-my-account':
                b = smoothBoxBlock(lres.children('.deactivate-message-confirm').clone(), c);
                break;
            case '#reactivate-my-account':
                b = smoothBoxBlock(lres.children('.reactivate-message-confirm').clone(), c);
                break;
        }
        if (b) {
            $('html,body').stop(true, true).animate({ scrollTop: b.offset().top }, 500, null);
        }
        return false;
    });
});

function openBookingInTab(bookingRequestID, bookingID, tabTitle, openReview, extraData) {
    var bid = bookingID;
    var brid = bookingRequestID;
    var data = extraData || {};
    data.BookingRequestID = brid;
    var url = "Booking/$BookingRequestDetails/";
    var tabId = 'bookingRequestID' + brid;

    if (bid && bid > 0) {
        url = "Booking/$BookingDetails/";
        data.BookingID = bid;
        tabId = 'bookingID' + bid;

        if (openReview === true) {
            url = "Booking/$BookingReview/";
            tabId += "_Review";
            if (data.AsUserID)
                tabId += "_AsOtherUser";
        }
    }

    var tab = TabbedUX.createTab('#main', tabId, tabTitle);
    if (tab) {
        TabbedUX.focusTab(tab);

        var $tab = $(tab);

        // Set the data-source-url of the new tab to the to be loaded url to enable jQuery.reload()
        $tab.data('source-url', UrlUtil.LangPath + url);

        var ctx = { form: $tab, boxIsContainer: true };

        // Loading, with retard
        ctx.loadingtimer = setTimeout(function () {
            $tab.block(loadingBlock);
        }, gLoadingRetard);

        // Do the Ajax post
        $.ajax({
            url: UrlUtil.LangPath + url,
            data: data,
            context: ctx,
            success: ajaxFormsSuccessHandler,
            error: ajaxErrorPopupHandler,
            complete: function () {
                $.proxy(ajaxFormsCompleteHandler, this)();

                // Updating the tab title, because when is loaded by URL, the title is the ID,
                // here is setted something more usable:
                TabbedUX.setTabTitle($tab, $tab.find('.user-public-name:eq(0)').text());
            }
        });
    } else
    // Tab couln't be created, already must exist, focus it
        TabbedUX.focusTab('#' + tabId);
}
function openMessageThreadInTab(threadId, tabTitle, highlightMessageId) {
    var tid = threadId;
    var data = { MessageThreadID: tid };
    var url = "Messaging/$MessageThread/";
    var tabId = 'messageThreadID-' + tid;

    var tab = TabbedUX.createTab('#main', tabId, tabTitle);
    if (tab) {
        TabbedUX.focusTab(tab);

        var $tab = $(tab);
        var ctx = { form: $tab, boxIsContainer: true };

        // Loading, with retard
        ctx.loadingtimer = setTimeout(function () {
            $tab.block(loadingBlock);
        }, gLoadingRetard);

        // Do the Ajax post
        $.ajax({
            url: UrlUtil.LangPath + url,
            data: data,
            context: ctx,
            success: ajaxFormsSuccessHandler,
            error: ajaxErrorPopupHandler,
            complete: function () {
                $.proxy(ajaxFormsCompleteHandler, this)();

                // Updating the tab title, because when is loaded by URL, the title is the ID,
                // here is setted something more usable:
                TabbedUX.setTabTitle($tab, $tab.find('.user-public-name:eq(0)').text());

                if (highlightMessageId) {
                    $tab.find('.message-' + highlightMessageId + ' > .message-section').addClass('highlighted');
                }
            }
        });
    } else {
        // Tab couln't be created, already must exist, focus it
        TabbedUX.focusTab('#' + tabId);
        // Search MessageID to highlight it
        if (highlightMessageId) {
            $('#' + tabId).find('.message-' + highlightMessageId + ' > .message-section').addClass('highlighted');
        }
    }
}

function initPositionPhotos() {
    $('form.positionphotos').each(function () {
        var form = $(this);
        // Prepare sortable script
        $(".positionphotos-gallery > ol", form).sortable({
            placeholder: "ui-state-highlight",
            update: function () {
                // Get photo order, a comma separated value of items IDs
                var order = $(this).sortable("toArray").toString();
                // Set order in the form element, to be sent later with the form
                $(this).closest('form').find('[name=gallery-order]').val(order);
            }
        });

        // Set primary photo to be edited
        var editPanel = $('.positionphotos-edit', form);
        // Look for a selected photo in the list
        var selected = $('.positionphotos-gallery > ol > li.selected', form);
        if (selected != null && selected.length > 0) {
            var selImg = selected.find('img');
            // Moving selected to be edit panel
            var photoID = selected.attr('id').match(/^UserPhoto-(\d+)$/)[1];
            editPanel.find('[name=PhotoID]').val(photoID);
            editPanel.find('img').attr('src', selImg.attr('src'));
            editPanel.find('[name=photo-caption]').val(selImg.attr('alt'));
            var isPrimaryValue = selected.hasClass('is-primary-photo') ? 'True' : 'False';
            editPanel.find('[name=is-primary-photo]').prop('checked', false);
            editPanel.find('[name=is-primary-photo][value=' + isPrimaryValue + ']').prop('checked', true);
        } else {
            if (form.find('.positionphotos-gallery > ol > li').length == 0) {
                smoothBoxBlock(form.find('.no-photos'), editPanel);
            } else {
                smoothBoxBlock(form.find('.no-primary-photo'), editPanel);
            }
        }
    });
}
function openChangeBookingStateForm(bookingID, button) {
    var tab = button.closest('.tab-body');
    var editPanel = $('.change-booking-status.edit-popup', tab);
    var bookingID = button.data('booking-id');
    var url = editPanel.data('source-url').replace('BookingID=0', 'BookingID=' + bookingID);
    editPanel.reload(url);
    editPanel.show();
    editPanel.on('click', '.close-edit-popup', function () {
        editPanel.hide();
    });
}
/* User Photo */
function reloadUserPhoto() {
    // Force image reload, in the parent document! (this is an iframe)
    $('#dashboard-avatar > .avatar').each(function () {
        var src = this.getAttribute('src');
        // avoid cache this time
        src = src + "?v" + new Date();
        this.setAttribute('src', src);
    });
}
function deleteUserPhoto() {
    $.blockUI(loadingBlock);
    jQuery.ajax({
        url: UrlUtil.LangUrl + "Dashboard/ChangePhoto/?delete=true",
        method: "GET",
        cache: false,
        dataType: "json",
        success: function (data) {
            if (data.Code == 0)
                $.blockUI(infoBlock(data.Result));
            else
                $.blockUI(errorBlock(data.Result.ErrorMessage));
            $('.blockUI .close-popup').click(function () { $.unblockUI() });
            reloadUserPhoto();
        },
        error: ajaxErrorPopupHandler
    });
}