(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
var jQuery = require('jquery');
require('./core');
require('./widget');
require('./position');
require('./menu');

/*!
 * jQuery UI Autocomplete 1.10.4
 * http://jqueryui.com
 *
 * Copyright 2014 jQuery Foundation and other contributors
 * Released under the MIT license.
 * http://jquery.org/license
 *
 * http://api.jqueryui.com/autocomplete/
 *
 * Depends:
 *	jquery.ui.core.js
 *	jquery.ui.widget.js
 *	jquery.ui.position.js
 *	jquery.ui.menu.js
 */
(function( $, undefined ) {

$.widget( "ui.autocomplete", {
	version: "1.10.4",
	defaultElement: "<input>",
	options: {
		appendTo: null,
		autoFocus: false,
		delay: 300,
		minLength: 1,
		position: {
			my: "left top",
			at: "left bottom",
			collision: "none"
		},
		source: null,

		// callbacks
		change: null,
		close: null,
		focus: null,
		open: null,
		response: null,
		search: null,
		select: null
	},

	requestIndex: 0,
	pending: 0,

	_create: function() {
		// Some browsers only repeat keydown events, not keypress events,
		// so we use the suppressKeyPress flag to determine if we've already
		// handled the keydown event. #7269
		// Unfortunately the code for & in keypress is the same as the up arrow,
		// so we use the suppressKeyPressRepeat flag to avoid handling keypress
		// events when we know the keydown event was used to modify the
		// search term. #7799
		var suppressKeyPress, suppressKeyPressRepeat, suppressInput,
			nodeName = this.element[0].nodeName.toLowerCase(),
			isTextarea = nodeName === "textarea",
			isInput = nodeName === "input";

		this.isMultiLine =
			// Textareas are always multi-line
			isTextarea ? true :
			// Inputs are always single-line, even if inside a contentEditable element
			// IE also treats inputs as contentEditable
			isInput ? false :
			// All other element types are determined by whether or not they're contentEditable
			this.element.prop( "isContentEditable" );

		this.valueMethod = this.element[ isTextarea || isInput ? "val" : "text" ];
		this.isNewMenu = true;

		this.element
			.addClass( "ui-autocomplete-input" )
			.attr( "autocomplete", "off" );

		this._on( this.element, {
			keydown: function( event ) {
				if ( this.element.prop( "readOnly" ) ) {
					suppressKeyPress = true;
					suppressInput = true;
					suppressKeyPressRepeat = true;
					return;
				}

				suppressKeyPress = false;
				suppressInput = false;
				suppressKeyPressRepeat = false;
				var keyCode = $.ui.keyCode;
				switch( event.keyCode ) {
				case keyCode.PAGE_UP:
					suppressKeyPress = true;
					this._move( "previousPage", event );
					break;
				case keyCode.PAGE_DOWN:
					suppressKeyPress = true;
					this._move( "nextPage", event );
					break;
				case keyCode.UP:
					suppressKeyPress = true;
					this._keyEvent( "previous", event );
					break;
				case keyCode.DOWN:
					suppressKeyPress = true;
					this._keyEvent( "next", event );
					break;
				case keyCode.ENTER:
				case keyCode.NUMPAD_ENTER:
					// when menu is open and has focus
					if ( this.menu.active ) {
						// #6055 - Opera still allows the keypress to occur
						// which causes forms to submit
						suppressKeyPress = true;
						event.preventDefault();
						this.menu.select( event );
					}
					break;
				case keyCode.TAB:
					if ( this.menu.active ) {
						this.menu.select( event );
					}
					break;
				case keyCode.ESCAPE:
					if ( this.menu.element.is( ":visible" ) ) {
						this._value( this.term );
						this.close( event );
						// Different browsers have different default behavior for escape
						// Single press can mean undo or clear
						// Double press in IE means clear the whole form
						event.preventDefault();
					}
					break;
				default:
					suppressKeyPressRepeat = true;
					// search timeout should be triggered before the input value is changed
					this._searchTimeout( event );
					break;
				}
			},
			keypress: function( event ) {
				if ( suppressKeyPress ) {
					suppressKeyPress = false;
					if ( !this.isMultiLine || this.menu.element.is( ":visible" ) ) {
						event.preventDefault();
					}
					return;
				}
				if ( suppressKeyPressRepeat ) {
					return;
				}

				// replicate some key handlers to allow them to repeat in Firefox and Opera
				var keyCode = $.ui.keyCode;
				switch( event.keyCode ) {
				case keyCode.PAGE_UP:
					this._move( "previousPage", event );
					break;
				case keyCode.PAGE_DOWN:
					this._move( "nextPage", event );
					break;
				case keyCode.UP:
					this._keyEvent( "previous", event );
					break;
				case keyCode.DOWN:
					this._keyEvent( "next", event );
					break;
				}
			},
			input: function( event ) {
				if ( suppressInput ) {
					suppressInput = false;
					event.preventDefault();
					return;
				}
				this._searchTimeout( event );
			},
			focus: function() {
				this.selectedItem = null;
				this.previous = this._value();
			},
			blur: function( event ) {
				if ( this.cancelBlur ) {
					delete this.cancelBlur;
					return;
				}

				clearTimeout( this.searching );
				this.close( event );
				this._change( event );
			}
		});

		this._initSource();
		this.menu = $( "<ul>" )
			.addClass( "ui-autocomplete ui-front" )
			.appendTo( this._appendTo() )
			.menu({
				// disable ARIA support, the live region takes care of that
				role: null
			})
			.hide()
			.data( "ui-menu" );

		this._on( this.menu.element, {
			mousedown: function( event ) {
				// prevent moving focus out of the text field
				event.preventDefault();

				// IE doesn't prevent moving focus even with event.preventDefault()
				// so we set a flag to know when we should ignore the blur event
				this.cancelBlur = true;
				this._delay(function() {
					delete this.cancelBlur;
				});

				// clicking on the scrollbar causes focus to shift to the body
				// but we can't detect a mouseup or a click immediately afterward
				// so we have to track the next mousedown and close the menu if
				// the user clicks somewhere outside of the autocomplete
				var menuElement = this.menu.element[ 0 ];
				if ( !$( event.target ).closest( ".ui-menu-item" ).length ) {
					this._delay(function() {
						var that = this;
						this.document.one( "mousedown", function( event ) {
							if ( event.target !== that.element[ 0 ] &&
									event.target !== menuElement &&
									!$.contains( menuElement, event.target ) ) {
								that.close();
							}
						});
					});
				}
			},
			menufocus: function( event, ui ) {
				// support: Firefox
				// Prevent accidental activation of menu items in Firefox (#7024 #9118)
				if ( this.isNewMenu ) {
					this.isNewMenu = false;
					if ( event.originalEvent && /^mouse/.test( event.originalEvent.type ) ) {
						this.menu.blur();

						this.document.one( "mousemove", function() {
							$( event.target ).trigger( event.originalEvent );
						});

						return;
					}
				}

				var item = ui.item.data( "ui-autocomplete-item" );
				if ( false !== this._trigger( "focus", event, { item: item } ) ) {
					// use value to match what will end up in the input, if it was a key event
					if ( event.originalEvent && /^key/.test( event.originalEvent.type ) ) {
						this._value( item.value );
					}
				} else {
					// Normally the input is populated with the item's value as the
					// menu is navigated, causing screen readers to notice a change and
					// announce the item. Since the focus event was canceled, this doesn't
					// happen, so we update the live region so that screen readers can
					// still notice the change and announce it.
					this.liveRegion.text( item.value );
				}
			},
			menuselect: function( event, ui ) {
				var item = ui.item.data( "ui-autocomplete-item" ),
					previous = this.previous;

				// only trigger when focus was lost (click on menu)
				if ( this.element[0] !== this.document[0].activeElement ) {
					this.element.focus();
					this.previous = previous;
					// #6109 - IE triggers two focus events and the second
					// is asynchronous, so we need to reset the previous
					// term synchronously and asynchronously :-(
					this._delay(function() {
						this.previous = previous;
						this.selectedItem = item;
					});
				}

				if ( false !== this._trigger( "select", event, { item: item } ) ) {
					this._value( item.value );
				}
				// reset the term after the select event
				// this allows custom select handling to work properly
				this.term = this._value();

				this.close( event );
				this.selectedItem = item;
			}
		});

		this.liveRegion = $( "<span>", {
				role: "status",
				"aria-live": "polite"
			})
			.addClass( "ui-helper-hidden-accessible" )
			.insertBefore( this.element );

		// turning off autocomplete prevents the browser from remembering the
		// value when navigating through history, so we re-enable autocomplete
		// if the page is unloaded before the widget is destroyed. #7790
		this._on( this.window, {
			beforeunload: function() {
				this.element.removeAttr( "autocomplete" );
			}
		});
	},

	_destroy: function() {
		clearTimeout( this.searching );
		this.element
			.removeClass( "ui-autocomplete-input" )
			.removeAttr( "autocomplete" );
		this.menu.element.remove();
		this.liveRegion.remove();
	},

	_setOption: function( key, value ) {
		this._super( key, value );
		if ( key === "source" ) {
			this._initSource();
		}
		if ( key === "appendTo" ) {
			this.menu.element.appendTo( this._appendTo() );
		}
		if ( key === "disabled" && value && this.xhr ) {
			this.xhr.abort();
		}
	},

	_appendTo: function() {
		var element = this.options.appendTo;

		if ( element ) {
			element = element.jquery || element.nodeType ?
				$( element ) :
				this.document.find( element ).eq( 0 );
		}

		if ( !element ) {
			element = this.element.closest( ".ui-front" );
		}

		if ( !element.length ) {
			element = this.document[0].body;
		}

		return element;
	},

	_initSource: function() {
		var array, url,
			that = this;
		if ( $.isArray(this.options.source) ) {
			array = this.options.source;
			this.source = function( request, response ) {
				response( $.ui.autocomplete.filter( array, request.term ) );
			};
		} else if ( typeof this.options.source === "string" ) {
			url = this.options.source;
			this.source = function( request, response ) {
				if ( that.xhr ) {
					that.xhr.abort();
				}
				that.xhr = $.ajax({
					url: url,
					data: request,
					dataType: "json",
					success: function( data ) {
						response( data );
					},
					error: function() {
						response( [] );
					}
				});
			};
		} else {
			this.source = this.options.source;
		}
	},

	_searchTimeout: function( event ) {
		clearTimeout( this.searching );
		this.searching = this._delay(function() {
			// only search if the value has changed
			if ( this.term !== this._value() ) {
				this.selectedItem = null;
				this.search( null, event );
			}
		}, this.options.delay );
	},

	search: function( value, event ) {
		value = value != null ? value : this._value();

		// always save the actual value, not the one passed as an argument
		this.term = this._value();

		if ( value.length < this.options.minLength ) {
			return this.close( event );
		}

		if ( this._trigger( "search", event ) === false ) {
			return;
		}

		return this._search( value );
	},

	_search: function( value ) {
		this.pending++;
		this.element.addClass( "ui-autocomplete-loading" );
		this.cancelSearch = false;

		this.source( { term: value }, this._response() );
	},

	_response: function() {
		var index = ++this.requestIndex;

		return $.proxy(function( content ) {
			if ( index === this.requestIndex ) {
				this.__response( content );
			}

			this.pending--;
			if ( !this.pending ) {
				this.element.removeClass( "ui-autocomplete-loading" );
			}
		}, this );
	},

	__response: function( content ) {
		if ( content ) {
			content = this._normalize( content );
		}
		this._trigger( "response", null, { content: content } );
		if ( !this.options.disabled && content && content.length && !this.cancelSearch ) {
			this._suggest( content );
			this._trigger( "open" );
		} else {
			// use ._close() instead of .close() so we don't cancel future searches
			this._close();
		}
	},

	close: function( event ) {
		this.cancelSearch = true;
		this._close( event );
	},

	_close: function( event ) {
		if ( this.menu.element.is( ":visible" ) ) {
			this.menu.element.hide();
			this.menu.blur();
			this.isNewMenu = true;
			this._trigger( "close", event );
		}
	},

	_change: function( event ) {
		if ( this.previous !== this._value() ) {
			this._trigger( "change", event, { item: this.selectedItem } );
		}
	},

	_normalize: function( items ) {
		// assume all items have the right format when the first item is complete
		if ( items.length && items[0].label && items[0].value ) {
			return items;
		}
		return $.map( items, function( item ) {
			if ( typeof item === "string" ) {
				return {
					label: item,
					value: item
				};
			}
			return $.extend({
				label: item.label || item.value,
				value: item.value || item.label
			}, item );
		});
	},

	_suggest: function( items ) {
		var ul = this.menu.element.empty();
		this._renderMenu( ul, items );
		this.isNewMenu = true;
		this.menu.refresh();

		// size and position menu
		ul.show();
		this._resizeMenu();
		ul.position( $.extend({
			of: this.element
		}, this.options.position ));

		if ( this.options.autoFocus ) {
			this.menu.next();
		}
	},

	_resizeMenu: function() {
		var ul = this.menu.element;
		ul.outerWidth( Math.max(
			// Firefox wraps long text (possibly a rounding bug)
			// so we add 1px to avoid the wrapping (#7513)
			ul.width( "" ).outerWidth() + 1,
			this.element.outerWidth()
		) );
	},

	_renderMenu: function( ul, items ) {
		var that = this;
		$.each( items, function( index, item ) {
			that._renderItemData( ul, item );
		});
	},

	_renderItemData: function( ul, item ) {
		return this._renderItem( ul, item ).data( "ui-autocomplete-item", item );
	},

	_renderItem: function( ul, item ) {
		return $( "<li>" )
			.append( $( "<a>" ).text( item.label ) )
			.appendTo( ul );
	},

	_move: function( direction, event ) {
		if ( !this.menu.element.is( ":visible" ) ) {
			this.search( null, event );
			return;
		}
		if ( this.menu.isFirstItem() && /^previous/.test( direction ) ||
				this.menu.isLastItem() && /^next/.test( direction ) ) {
			this._value( this.term );
			this.menu.blur();
			return;
		}
		this.menu[ direction ]( event );
	},

	widget: function() {
		return this.menu.element;
	},

	_value: function() {
		return this.valueMethod.apply( this.element, arguments );
	},

	_keyEvent: function( keyEvent, event ) {
		if ( !this.isMultiLine || this.menu.element.is( ":visible" ) ) {
			this._move( keyEvent, event );

			// prevents moving cursor to beginning/end of the text field in some browsers
			event.preventDefault();
		}
	}
});

$.extend( $.ui.autocomplete, {
	escapeRegex: function( value ) {
		return value.replace(/[\-\[\]{}()*+?.,\\\^$|#\s]/g, "\\$&");
	},
	filter: function(array, term) {
		var matcher = new RegExp( $.ui.autocomplete.escapeRegex(term), "i" );
		return $.grep( array, function(value) {
			return matcher.test( value.label || value.value || value );
		});
	}
});


// live region extension, adding a `messages` option
// NOTE: This is an experimental API. We are still investigating
// a full solution for string manipulation and internationalization.
$.widget( "ui.autocomplete", $.ui.autocomplete, {
	options: {
		messages: {
			noResults: "No search results.",
			results: function( amount ) {
				return amount + ( amount > 1 ? " results are" : " result is" ) +
					" available, use up and down arrow keys to navigate.";
			}
		}
	},

	__response: function( content ) {
		var message;
		this._superApply( arguments );
		if ( this.options.disabled || this.cancelSearch ) {
			return;
		}
		if ( content && content.length ) {
			message = this.options.messages.results( content.length );
		} else {
			message = this.options.messages.noResults;
		}
		this.liveRegion.text( message );
	}
});

}( jQuery ));

},{"./core":2,"./menu":3,"./position":4,"./widget":5}],2:[function(require,module,exports){
var jQuery = require('jquery');

/*!
 * jQuery UI Core 1.10.4
 * http://jqueryui.com
 *
 * Copyright 2014 jQuery Foundation and other contributors
 * Released under the MIT license.
 * http://jquery.org/license
 *
 * http://api.jqueryui.com/category/ui-core/
 */
(function( $, undefined ) {

var uuid = 0,
	runiqueId = /^ui-id-\d+$/;

// $.ui might exist from components with no dependencies, e.g., $.ui.position
$.ui = $.ui || {};

$.extend( $.ui, {
	version: "1.10.4",

	keyCode: {
		BACKSPACE: 8,
		COMMA: 188,
		DELETE: 46,
		DOWN: 40,
		END: 35,
		ENTER: 13,
		ESCAPE: 27,
		HOME: 36,
		LEFT: 37,
		NUMPAD_ADD: 107,
		NUMPAD_DECIMAL: 110,
		NUMPAD_DIVIDE: 111,
		NUMPAD_ENTER: 108,
		NUMPAD_MULTIPLY: 106,
		NUMPAD_SUBTRACT: 109,
		PAGE_DOWN: 34,
		PAGE_UP: 33,
		PERIOD: 190,
		RIGHT: 39,
		SPACE: 32,
		TAB: 9,
		UP: 38
	}
});

// plugins
$.fn.extend({
	focus: (function( orig ) {
		return function( delay, fn ) {
			return typeof delay === "number" ?
				this.each(function() {
					var elem = this;
					setTimeout(function() {
						$( elem ).focus();
						if ( fn ) {
							fn.call( elem );
						}
					}, delay );
				}) :
				orig.apply( this, arguments );
		};
	})( $.fn.focus ),

	scrollParent: function() {
		var scrollParent;
		if (($.ui.ie && (/(static|relative)/).test(this.css("position"))) || (/absolute/).test(this.css("position"))) {
			scrollParent = this.parents().filter(function() {
				return (/(relative|absolute|fixed)/).test($.css(this,"position")) && (/(auto|scroll)/).test($.css(this,"overflow")+$.css(this,"overflow-y")+$.css(this,"overflow-x"));
			}).eq(0);
		} else {
			scrollParent = this.parents().filter(function() {
				return (/(auto|scroll)/).test($.css(this,"overflow")+$.css(this,"overflow-y")+$.css(this,"overflow-x"));
			}).eq(0);
		}

		return (/fixed/).test(this.css("position")) || !scrollParent.length ? $(document) : scrollParent;
	},

	zIndex: function( zIndex ) {
		if ( zIndex !== undefined ) {
			return this.css( "zIndex", zIndex );
		}

		if ( this.length ) {
			var elem = $( this[ 0 ] ), position, value;
			while ( elem.length && elem[ 0 ] !== document ) {
				// Ignore z-index if position is set to a value where z-index is ignored by the browser
				// This makes behavior of this function consistent across browsers
				// WebKit always returns auto if the element is positioned
				position = elem.css( "position" );
				if ( position === "absolute" || position === "relative" || position === "fixed" ) {
					// IE returns 0 when zIndex is not specified
					// other browsers return a string
					// we ignore the case of nested elements with an explicit value of 0
					// <div style="z-index: -10;"><div style="z-index: 0;"></div></div>
					value = parseInt( elem.css( "zIndex" ), 10 );
					if ( !isNaN( value ) && value !== 0 ) {
						return value;
					}
				}
				elem = elem.parent();
			}
		}

		return 0;
	},

	uniqueId: function() {
		return this.each(function() {
			if ( !this.id ) {
				this.id = "ui-id-" + (++uuid);
			}
		});
	},

	removeUniqueId: function() {
		return this.each(function() {
			if ( runiqueId.test( this.id ) ) {
				$( this ).removeAttr( "id" );
			}
		});
	}
});

// selectors
function focusable( element, isTabIndexNotNaN ) {
	var map, mapName, img,
		nodeName = element.nodeName.toLowerCase();
	if ( "area" === nodeName ) {
		map = element.parentNode;
		mapName = map.name;
		if ( !element.href || !mapName || map.nodeName.toLowerCase() !== "map" ) {
			return false;
		}
		img = $( "img[usemap=#" + mapName + "]" )[0];
		return !!img && visible( img );
	}
	return ( /input|select|textarea|button|object/.test( nodeName ) ?
		!element.disabled :
		"a" === nodeName ?
			element.href || isTabIndexNotNaN :
			isTabIndexNotNaN) &&
		// the element and all of its ancestors must be visible
		visible( element );
}

function visible( element ) {
	return $.expr.filters.visible( element ) &&
		!$( element ).parents().addBack().filter(function() {
			return $.css( this, "visibility" ) === "hidden";
		}).length;
}

$.extend( $.expr[ ":" ], {
	data: $.expr.createPseudo ?
		$.expr.createPseudo(function( dataName ) {
			return function( elem ) {
				return !!$.data( elem, dataName );
			};
		}) :
		// support: jQuery <1.8
		function( elem, i, match ) {
			return !!$.data( elem, match[ 3 ] );
		},

	focusable: function( element ) {
		return focusable( element, !isNaN( $.attr( element, "tabindex" ) ) );
	},

	tabbable: function( element ) {
		var tabIndex = $.attr( element, "tabindex" ),
			isTabIndexNaN = isNaN( tabIndex );
		return ( isTabIndexNaN || tabIndex >= 0 ) && focusable( element, !isTabIndexNaN );
	}
});

// support: jQuery <1.8
if ( !$( "<a>" ).outerWidth( 1 ).jquery ) {
	$.each( [ "Width", "Height" ], function( i, name ) {
		var side = name === "Width" ? [ "Left", "Right" ] : [ "Top", "Bottom" ],
			type = name.toLowerCase(),
			orig = {
				innerWidth: $.fn.innerWidth,
				innerHeight: $.fn.innerHeight,
				outerWidth: $.fn.outerWidth,
				outerHeight: $.fn.outerHeight
			};

		function reduce( elem, size, border, margin ) {
			$.each( side, function() {
				size -= parseFloat( $.css( elem, "padding" + this ) ) || 0;
				if ( border ) {
					size -= parseFloat( $.css( elem, "border" + this + "Width" ) ) || 0;
				}
				if ( margin ) {
					size -= parseFloat( $.css( elem, "margin" + this ) ) || 0;
				}
			});
			return size;
		}

		$.fn[ "inner" + name ] = function( size ) {
			if ( size === undefined ) {
				return orig[ "inner" + name ].call( this );
			}

			return this.each(function() {
				$( this ).css( type, reduce( this, size ) + "px" );
			});
		};

		$.fn[ "outer" + name] = function( size, margin ) {
			if ( typeof size !== "number" ) {
				return orig[ "outer" + name ].call( this, size );
			}

			return this.each(function() {
				$( this).css( type, reduce( this, size, true, margin ) + "px" );
			});
		};
	});
}

// support: jQuery <1.8
if ( !$.fn.addBack ) {
	$.fn.addBack = function( selector ) {
		return this.add( selector == null ?
			this.prevObject : this.prevObject.filter( selector )
		);
	};
}

// support: jQuery 1.6.1, 1.6.2 (http://bugs.jquery.com/ticket/9413)
if ( $( "<a>" ).data( "a-b", "a" ).removeData( "a-b" ).data( "a-b" ) ) {
	$.fn.removeData = (function( removeData ) {
		return function( key ) {
			if ( arguments.length ) {
				return removeData.call( this, $.camelCase( key ) );
			} else {
				return removeData.call( this );
			}
		};
	})( $.fn.removeData );
}





// deprecated
$.ui.ie = !!/msie [\w.]+/.exec( navigator.userAgent.toLowerCase() );

$.support.selectstart = "onselectstart" in document.createElement( "div" );
$.fn.extend({
	disableSelection: function() {
		return this.bind( ( $.support.selectstart ? "selectstart" : "mousedown" ) +
			".ui-disableSelection", function( event ) {
				event.preventDefault();
			});
	},

	enableSelection: function() {
		return this.unbind( ".ui-disableSelection" );
	}
});

$.extend( $.ui, {
	// $.ui.plugin is deprecated. Use $.widget() extensions instead.
	plugin: {
		add: function( module, option, set ) {
			var i,
				proto = $.ui[ module ].prototype;
			for ( i in set ) {
				proto.plugins[ i ] = proto.plugins[ i ] || [];
				proto.plugins[ i ].push( [ option, set[ i ] ] );
			}
		},
		call: function( instance, name, args ) {
			var i,
				set = instance.plugins[ name ];
			if ( !set || !instance.element[ 0 ].parentNode || instance.element[ 0 ].parentNode.nodeType === 11 ) {
				return;
			}

			for ( i = 0; i < set.length; i++ ) {
				if ( instance.options[ set[ i ][ 0 ] ] ) {
					set[ i ][ 1 ].apply( instance.element, args );
				}
			}
		}
	},

	// only used by resizable
	hasScroll: function( el, a ) {

		//If overflow is hidden, the element might have extra content, but the user wants to hide it
		if ( $( el ).css( "overflow" ) === "hidden") {
			return false;
		}

		var scroll = ( a && a === "left" ) ? "scrollLeft" : "scrollTop",
			has = false;

		if ( el[ scroll ] > 0 ) {
			return true;
		}

		// TODO: determine which cases actually cause this to happen
		// if the element doesn't have the scroll set, see if it's possible to
		// set the scroll
		el[ scroll ] = 1;
		has = ( el[ scroll ] > 0 );
		el[ scroll ] = 0;
		return has;
	}
});

})( jQuery );

},{}],3:[function(require,module,exports){
var jQuery = require('jquery');
require('./core');
require('./widget');
require('./position');

/*!
 * jQuery UI Menu 1.10.4
 * http://jqueryui.com
 *
 * Copyright 2014 jQuery Foundation and other contributors
 * Released under the MIT license.
 * http://jquery.org/license
 *
 * http://api.jqueryui.com/menu/
 *
 * Depends:
 *	jquery.ui.core.js
 *	jquery.ui.widget.js
 *	jquery.ui.position.js
 */
(function( $, undefined ) {

$.widget( "ui.menu", {
	version: "1.10.4",
	defaultElement: "<ul>",
	delay: 300,
	options: {
		icons: {
			submenu: "ui-icon-carat-1-e"
		},
		menus: "ul",
		position: {
			my: "left top",
			at: "right top"
		},
		role: "menu",

		// callbacks
		blur: null,
		focus: null,
		select: null
	},

	_create: function() {
		this.activeMenu = this.element;
		// flag used to prevent firing of the click handler
		// as the event bubbles up through nested menus
		this.mouseHandled = false;
		this.element
			.uniqueId()
			.addClass( "ui-menu ui-widget ui-widget-content ui-corner-all" )
			.toggleClass( "ui-menu-icons", !!this.element.find( ".ui-icon" ).length )
			.attr({
				role: this.options.role,
				tabIndex: 0
			})
			// need to catch all clicks on disabled menu
			// not possible through _on
			.bind( "click" + this.eventNamespace, $.proxy(function( event ) {
				if ( this.options.disabled ) {
					event.preventDefault();
				}
			}, this ));

		if ( this.options.disabled ) {
			this.element
				.addClass( "ui-state-disabled" )
				.attr( "aria-disabled", "true" );
		}

		this._on({
			// Prevent focus from sticking to links inside menu after clicking
			// them (focus should always stay on UL during navigation).
			"mousedown .ui-menu-item > a": function( event ) {
				event.preventDefault();
			},
			"click .ui-state-disabled > a": function( event ) {
				event.preventDefault();
			},
			"click .ui-menu-item:has(a)": function( event ) {
				var target = $( event.target ).closest( ".ui-menu-item" );
				if ( !this.mouseHandled && target.not( ".ui-state-disabled" ).length ) {
					this.select( event );

					// Only set the mouseHandled flag if the event will bubble, see #9469.
					if ( !event.isPropagationStopped() ) {
						this.mouseHandled = true;
					}

					// Open submenu on click
					if ( target.has( ".ui-menu" ).length ) {
						this.expand( event );
					} else if ( !this.element.is( ":focus" ) && $( this.document[ 0 ].activeElement ).closest( ".ui-menu" ).length ) {

						// Redirect focus to the menu
						this.element.trigger( "focus", [ true ] );

						// If the active item is on the top level, let it stay active.
						// Otherwise, blur the active item since it is no longer visible.
						if ( this.active && this.active.parents( ".ui-menu" ).length === 1 ) {
							clearTimeout( this.timer );
						}
					}
				}
			},
			"mouseenter .ui-menu-item": function( event ) {
				var target = $( event.currentTarget );
				// Remove ui-state-active class from siblings of the newly focused menu item
				// to avoid a jump caused by adjacent elements both having a class with a border
				target.siblings().children( ".ui-state-active" ).removeClass( "ui-state-active" );
				this.focus( event, target );
			},
			mouseleave: "collapseAll",
			"mouseleave .ui-menu": "collapseAll",
			focus: function( event, keepActiveItem ) {
				// If there's already an active item, keep it active
				// If not, activate the first item
				var item = this.active || this.element.children( ".ui-menu-item" ).eq( 0 );

				if ( !keepActiveItem ) {
					this.focus( event, item );
				}
			},
			blur: function( event ) {
				this._delay(function() {
					if ( !$.contains( this.element[0], this.document[0].activeElement ) ) {
						this.collapseAll( event );
					}
				});
			},
			keydown: "_keydown"
		});

		this.refresh();

		// Clicks outside of a menu collapse any open menus
		this._on( this.document, {
			click: function( event ) {
				if ( !$( event.target ).closest( ".ui-menu" ).length ) {
					this.collapseAll( event );
				}

				// Reset the mouseHandled flag
				this.mouseHandled = false;
			}
		});
	},

	_destroy: function() {
		// Destroy (sub)menus
		this.element
			.removeAttr( "aria-activedescendant" )
			.find( ".ui-menu" ).addBack()
				.removeClass( "ui-menu ui-widget ui-widget-content ui-corner-all ui-menu-icons" )
				.removeAttr( "role" )
				.removeAttr( "tabIndex" )
				.removeAttr( "aria-labelledby" )
				.removeAttr( "aria-expanded" )
				.removeAttr( "aria-hidden" )
				.removeAttr( "aria-disabled" )
				.removeUniqueId()
				.show();

		// Destroy menu items
		this.element.find( ".ui-menu-item" )
			.removeClass( "ui-menu-item" )
			.removeAttr( "role" )
			.removeAttr( "aria-disabled" )
			.children( "a" )
				.removeUniqueId()
				.removeClass( "ui-corner-all ui-state-hover" )
				.removeAttr( "tabIndex" )
				.removeAttr( "role" )
				.removeAttr( "aria-haspopup" )
				.children().each( function() {
					var elem = $( this );
					if ( elem.data( "ui-menu-submenu-carat" ) ) {
						elem.remove();
					}
				});

		// Destroy menu dividers
		this.element.find( ".ui-menu-divider" ).removeClass( "ui-menu-divider ui-widget-content" );
	},

	_keydown: function( event ) {
		var match, prev, character, skip, regex,
			preventDefault = true;

		function escape( value ) {
			return value.replace( /[\-\[\]{}()*+?.,\\\^$|#\s]/g, "\\$&" );
		}

		switch ( event.keyCode ) {
		case $.ui.keyCode.PAGE_UP:
			this.previousPage( event );
			break;
		case $.ui.keyCode.PAGE_DOWN:
			this.nextPage( event );
			break;
		case $.ui.keyCode.HOME:
			this._move( "first", "first", event );
			break;
		case $.ui.keyCode.END:
			this._move( "last", "last", event );
			break;
		case $.ui.keyCode.UP:
			this.previous( event );
			break;
		case $.ui.keyCode.DOWN:
			this.next( event );
			break;
		case $.ui.keyCode.LEFT:
			this.collapse( event );
			break;
		case $.ui.keyCode.RIGHT:
			if ( this.active && !this.active.is( ".ui-state-disabled" ) ) {
				this.expand( event );
			}
			break;
		case $.ui.keyCode.ENTER:
		case $.ui.keyCode.SPACE:
			this._activate( event );
			break;
		case $.ui.keyCode.ESCAPE:
			this.collapse( event );
			break;
		default:
			preventDefault = false;
			prev = this.previousFilter || "";
			character = String.fromCharCode( event.keyCode );
			skip = false;

			clearTimeout( this.filterTimer );

			if ( character === prev ) {
				skip = true;
			} else {
				character = prev + character;
			}

			regex = new RegExp( "^" + escape( character ), "i" );
			match = this.activeMenu.children( ".ui-menu-item" ).filter(function() {
				return regex.test( $( this ).children( "a" ).text() );
			});
			match = skip && match.index( this.active.next() ) !== -1 ?
				this.active.nextAll( ".ui-menu-item" ) :
				match;

			// If no matches on the current filter, reset to the last character pressed
			// to move down the menu to the first item that starts with that character
			if ( !match.length ) {
				character = String.fromCharCode( event.keyCode );
				regex = new RegExp( "^" + escape( character ), "i" );
				match = this.activeMenu.children( ".ui-menu-item" ).filter(function() {
					return regex.test( $( this ).children( "a" ).text() );
				});
			}

			if ( match.length ) {
				this.focus( event, match );
				if ( match.length > 1 ) {
					this.previousFilter = character;
					this.filterTimer = this._delay(function() {
						delete this.previousFilter;
					}, 1000 );
				} else {
					delete this.previousFilter;
				}
			} else {
				delete this.previousFilter;
			}
		}

		if ( preventDefault ) {
			event.preventDefault();
		}
	},

	_activate: function( event ) {
		if ( !this.active.is( ".ui-state-disabled" ) ) {
			if ( this.active.children( "a[aria-haspopup='true']" ).length ) {
				this.expand( event );
			} else {
				this.select( event );
			}
		}
	},

	refresh: function() {
		var menus,
			icon = this.options.icons.submenu,
			submenus = this.element.find( this.options.menus );

		this.element.toggleClass( "ui-menu-icons", !!this.element.find( ".ui-icon" ).length );

		// Initialize nested menus
		submenus.filter( ":not(.ui-menu)" )
			.addClass( "ui-menu ui-widget ui-widget-content ui-corner-all" )
			.hide()
			.attr({
				role: this.options.role,
				"aria-hidden": "true",
				"aria-expanded": "false"
			})
			.each(function() {
				var menu = $( this ),
					item = menu.prev( "a" ),
					submenuCarat = $( "<span>" )
						.addClass( "ui-menu-icon ui-icon " + icon )
						.data( "ui-menu-submenu-carat", true );

				item
					.attr( "aria-haspopup", "true" )
					.prepend( submenuCarat );
				menu.attr( "aria-labelledby", item.attr( "id" ) );
			});

		menus = submenus.add( this.element );

		// Don't refresh list items that are already adapted
		menus.children( ":not(.ui-menu-item):has(a)" )
			.addClass( "ui-menu-item" )
			.attr( "role", "presentation" )
			.children( "a" )
				.uniqueId()
				.addClass( "ui-corner-all" )
				.attr({
					tabIndex: -1,
					role: this._itemRole()
				});

		// Initialize unlinked menu-items containing spaces and/or dashes only as dividers
		menus.children( ":not(.ui-menu-item)" ).each(function() {
			var item = $( this );
			// hyphen, em dash, en dash
			if ( !/[^\-\u2014\u2013\s]/.test( item.text() ) ) {
				item.addClass( "ui-widget-content ui-menu-divider" );
			}
		});

		// Add aria-disabled attribute to any disabled menu item
		menus.children( ".ui-state-disabled" ).attr( "aria-disabled", "true" );

		// If the active item has been removed, blur the menu
		if ( this.active && !$.contains( this.element[ 0 ], this.active[ 0 ] ) ) {
			this.blur();
		}
	},

	_itemRole: function() {
		return {
			menu: "menuitem",
			listbox: "option"
		}[ this.options.role ];
	},

	_setOption: function( key, value ) {
		if ( key === "icons" ) {
			this.element.find( ".ui-menu-icon" )
				.removeClass( this.options.icons.submenu )
				.addClass( value.submenu );
		}
		this._super( key, value );
	},

	focus: function( event, item ) {
		var nested, focused;
		this.blur( event, event && event.type === "focus" );

		this._scrollIntoView( item );

		this.active = item.first();
		focused = this.active.children( "a" ).addClass( "ui-state-focus" );
		// Only update aria-activedescendant if there's a role
		// otherwise we assume focus is managed elsewhere
		if ( this.options.role ) {
			this.element.attr( "aria-activedescendant", focused.attr( "id" ) );
		}

		// Highlight active parent menu item, if any
		this.active
			.parent()
			.closest( ".ui-menu-item" )
			.children( "a:first" )
			.addClass( "ui-state-active" );

		if ( event && event.type === "keydown" ) {
			this._close();
		} else {
			this.timer = this._delay(function() {
				this._close();
			}, this.delay );
		}

		nested = item.children( ".ui-menu" );
		if ( nested.length && event && ( /^mouse/.test( event.type ) ) ) {
			this._startOpening(nested);
		}
		this.activeMenu = item.parent();

		this._trigger( "focus", event, { item: item } );
	},

	_scrollIntoView: function( item ) {
		var borderTop, paddingTop, offset, scroll, elementHeight, itemHeight;
		if ( this._hasScroll() ) {
			borderTop = parseFloat( $.css( this.activeMenu[0], "borderTopWidth" ) ) || 0;
			paddingTop = parseFloat( $.css( this.activeMenu[0], "paddingTop" ) ) || 0;
			offset = item.offset().top - this.activeMenu.offset().top - borderTop - paddingTop;
			scroll = this.activeMenu.scrollTop();
			elementHeight = this.activeMenu.height();
			itemHeight = item.height();

			if ( offset < 0 ) {
				this.activeMenu.scrollTop( scroll + offset );
			} else if ( offset + itemHeight > elementHeight ) {
				this.activeMenu.scrollTop( scroll + offset - elementHeight + itemHeight );
			}
		}
	},

	blur: function( event, fromFocus ) {
		if ( !fromFocus ) {
			clearTimeout( this.timer );
		}

		if ( !this.active ) {
			return;
		}

		this.active.children( "a" ).removeClass( "ui-state-focus" );
		this.active = null;

		this._trigger( "blur", event, { item: this.active } );
	},

	_startOpening: function( submenu ) {
		clearTimeout( this.timer );

		// Don't open if already open fixes a Firefox bug that caused a .5 pixel
		// shift in the submenu position when mousing over the carat icon
		if ( submenu.attr( "aria-hidden" ) !== "true" ) {
			return;
		}

		this.timer = this._delay(function() {
			this._close();
			this._open( submenu );
		}, this.delay );
	},

	_open: function( submenu ) {
		var position = $.extend({
			of: this.active
		}, this.options.position );

		clearTimeout( this.timer );
		this.element.find( ".ui-menu" ).not( submenu.parents( ".ui-menu" ) )
			.hide()
			.attr( "aria-hidden", "true" );

		submenu
			.show()
			.removeAttr( "aria-hidden" )
			.attr( "aria-expanded", "true" )
			.position( position );
	},

	collapseAll: function( event, all ) {
		clearTimeout( this.timer );
		this.timer = this._delay(function() {
			// If we were passed an event, look for the submenu that contains the event
			var currentMenu = all ? this.element :
				$( event && event.target ).closest( this.element.find( ".ui-menu" ) );

			// If we found no valid submenu ancestor, use the main menu to close all sub menus anyway
			if ( !currentMenu.length ) {
				currentMenu = this.element;
			}

			this._close( currentMenu );

			this.blur( event );
			this.activeMenu = currentMenu;
		}, this.delay );
	},

	// With no arguments, closes the currently active menu - if nothing is active
	// it closes all menus.  If passed an argument, it will search for menus BELOW
	_close: function( startMenu ) {
		if ( !startMenu ) {
			startMenu = this.active ? this.active.parent() : this.element;
		}

		startMenu
			.find( ".ui-menu" )
				.hide()
				.attr( "aria-hidden", "true" )
				.attr( "aria-expanded", "false" )
			.end()
			.find( "a.ui-state-active" )
				.removeClass( "ui-state-active" );
	},

	collapse: function( event ) {
		var newItem = this.active &&
			this.active.parent().closest( ".ui-menu-item", this.element );
		if ( newItem && newItem.length ) {
			this._close();
			this.focus( event, newItem );
		}
	},

	expand: function( event ) {
		var newItem = this.active &&
			this.active
				.children( ".ui-menu " )
				.children( ".ui-menu-item" )
				.first();

		if ( newItem && newItem.length ) {
			this._open( newItem.parent() );

			// Delay so Firefox will not hide activedescendant change in expanding submenu from AT
			this._delay(function() {
				this.focus( event, newItem );
			});
		}
	},

	next: function( event ) {
		this._move( "next", "first", event );
	},

	previous: function( event ) {
		this._move( "prev", "last", event );
	},

	isFirstItem: function() {
		return this.active && !this.active.prevAll( ".ui-menu-item" ).length;
	},

	isLastItem: function() {
		return this.active && !this.active.nextAll( ".ui-menu-item" ).length;
	},

	_move: function( direction, filter, event ) {
		var next;
		if ( this.active ) {
			if ( direction === "first" || direction === "last" ) {
				next = this.active
					[ direction === "first" ? "prevAll" : "nextAll" ]( ".ui-menu-item" )
					.eq( -1 );
			} else {
				next = this.active
					[ direction + "All" ]( ".ui-menu-item" )
					.eq( 0 );
			}
		}
		if ( !next || !next.length || !this.active ) {
			next = this.activeMenu.children( ".ui-menu-item" )[ filter ]();
		}

		this.focus( event, next );
	},

	nextPage: function( event ) {
		var item, base, height;

		if ( !this.active ) {
			this.next( event );
			return;
		}
		if ( this.isLastItem() ) {
			return;
		}
		if ( this._hasScroll() ) {
			base = this.active.offset().top;
			height = this.element.height();
			this.active.nextAll( ".ui-menu-item" ).each(function() {
				item = $( this );
				return item.offset().top - base - height < 0;
			});

			this.focus( event, item );
		} else {
			this.focus( event, this.activeMenu.children( ".ui-menu-item" )
				[ !this.active ? "first" : "last" ]() );
		}
	},

	previousPage: function( event ) {
		var item, base, height;
		if ( !this.active ) {
			this.next( event );
			return;
		}
		if ( this.isFirstItem() ) {
			return;
		}
		if ( this._hasScroll() ) {
			base = this.active.offset().top;
			height = this.element.height();
			this.active.prevAll( ".ui-menu-item" ).each(function() {
				item = $( this );
				return item.offset().top - base + height > 0;
			});

			this.focus( event, item );
		} else {
			this.focus( event, this.activeMenu.children( ".ui-menu-item" ).first() );
		}
	},

	_hasScroll: function() {
		return this.element.outerHeight() < this.element.prop( "scrollHeight" );
	},

	select: function( event ) {
		// TODO: It should never be possible to not have an active item at this
		// point, but the tests don't trigger mouseenter before click.
		this.active = this.active || $( event.target ).closest( ".ui-menu-item" );
		var ui = { item: this.active };
		if ( !this.active.has( ".ui-menu" ).length ) {
			this.collapseAll( event, true );
		}
		this._trigger( "select", event, ui );
	}
});

}( jQuery ));

},{"./core":2,"./position":4,"./widget":5}],4:[function(require,module,exports){
var jQuery = require('jquery');

/*!
 * jQuery UI Position 1.10.4
 * http://jqueryui.com
 *
 * Copyright 2014 jQuery Foundation and other contributors
 * Released under the MIT license.
 * http://jquery.org/license
 *
 * http://api.jqueryui.com/position/
 */
(function( $, undefined ) {

$.ui = $.ui || {};

var cachedScrollbarWidth,
	max = Math.max,
	abs = Math.abs,
	round = Math.round,
	rhorizontal = /left|center|right/,
	rvertical = /top|center|bottom/,
	roffset = /[\+\-]\d+(\.[\d]+)?%?/,
	rposition = /^\w+/,
	rpercent = /%$/,
	_position = $.fn.position;

function getOffsets( offsets, width, height ) {
	return [
		parseFloat( offsets[ 0 ] ) * ( rpercent.test( offsets[ 0 ] ) ? width / 100 : 1 ),
		parseFloat( offsets[ 1 ] ) * ( rpercent.test( offsets[ 1 ] ) ? height / 100 : 1 )
	];
}

function parseCss( element, property ) {
	return parseInt( $.css( element, property ), 10 ) || 0;
}

function getDimensions( elem ) {
	var raw = elem[0];
	if ( raw.nodeType === 9 ) {
		return {
			width: elem.width(),
			height: elem.height(),
			offset: { top: 0, left: 0 }
		};
	}
	if ( $.isWindow( raw ) ) {
		return {
			width: elem.width(),
			height: elem.height(),
			offset: { top: elem.scrollTop(), left: elem.scrollLeft() }
		};
	}
	if ( raw.preventDefault ) {
		return {
			width: 0,
			height: 0,
			offset: { top: raw.pageY, left: raw.pageX }
		};
	}
	return {
		width: elem.outerWidth(),
		height: elem.outerHeight(),
		offset: elem.offset()
	};
}

$.position = {
	scrollbarWidth: function() {
		if ( cachedScrollbarWidth !== undefined ) {
			return cachedScrollbarWidth;
		}
		var w1, w2,
			div = $( "<div style='display:block;position:absolute;width:50px;height:50px;overflow:hidden;'><div style='height:100px;width:auto;'></div></div>" ),
			innerDiv = div.children()[0];

		$( "body" ).append( div );
		w1 = innerDiv.offsetWidth;
		div.css( "overflow", "scroll" );

		w2 = innerDiv.offsetWidth;

		if ( w1 === w2 ) {
			w2 = div[0].clientWidth;
		}

		div.remove();

		return (cachedScrollbarWidth = w1 - w2);
	},
	getScrollInfo: function( within ) {
		var overflowX = within.isWindow || within.isDocument ? "" :
				within.element.css( "overflow-x" ),
			overflowY = within.isWindow || within.isDocument ? "" :
				within.element.css( "overflow-y" ),
			hasOverflowX = overflowX === "scroll" ||
				( overflowX === "auto" && within.width < within.element[0].scrollWidth ),
			hasOverflowY = overflowY === "scroll" ||
				( overflowY === "auto" && within.height < within.element[0].scrollHeight );
		return {
			width: hasOverflowY ? $.position.scrollbarWidth() : 0,
			height: hasOverflowX ? $.position.scrollbarWidth() : 0
		};
	},
	getWithinInfo: function( element ) {
		var withinElement = $( element || window ),
			isWindow = $.isWindow( withinElement[0] ),
			isDocument = !!withinElement[ 0 ] && withinElement[ 0 ].nodeType === 9;
		return {
			element: withinElement,
			isWindow: isWindow,
			isDocument: isDocument,
			offset: withinElement.offset() || { left: 0, top: 0 },
			scrollLeft: withinElement.scrollLeft(),
			scrollTop: withinElement.scrollTop(),
			width: isWindow ? withinElement.width() : withinElement.outerWidth(),
			height: isWindow ? withinElement.height() : withinElement.outerHeight()
		};
	}
};

$.fn.position = function( options ) {
	if ( !options || !options.of ) {
		return _position.apply( this, arguments );
	}

	// make a copy, we don't want to modify arguments
	options = $.extend( {}, options );

	var atOffset, targetWidth, targetHeight, targetOffset, basePosition, dimensions,
		target = $( options.of ),
		within = $.position.getWithinInfo( options.within ),
		scrollInfo = $.position.getScrollInfo( within ),
		collision = ( options.collision || "flip" ).split( " " ),
		offsets = {};

	dimensions = getDimensions( target );
	if ( target[0].preventDefault ) {
		// force left top to allow flipping
		options.at = "left top";
	}
	targetWidth = dimensions.width;
	targetHeight = dimensions.height;
	targetOffset = dimensions.offset;
	// clone to reuse original targetOffset later
	basePosition = $.extend( {}, targetOffset );

	// force my and at to have valid horizontal and vertical positions
	// if a value is missing or invalid, it will be converted to center
	$.each( [ "my", "at" ], function() {
		var pos = ( options[ this ] || "" ).split( " " ),
			horizontalOffset,
			verticalOffset;

		if ( pos.length === 1) {
			pos = rhorizontal.test( pos[ 0 ] ) ?
				pos.concat( [ "center" ] ) :
				rvertical.test( pos[ 0 ] ) ?
					[ "center" ].concat( pos ) :
					[ "center", "center" ];
		}
		pos[ 0 ] = rhorizontal.test( pos[ 0 ] ) ? pos[ 0 ] : "center";
		pos[ 1 ] = rvertical.test( pos[ 1 ] ) ? pos[ 1 ] : "center";

		// calculate offsets
		horizontalOffset = roffset.exec( pos[ 0 ] );
		verticalOffset = roffset.exec( pos[ 1 ] );
		offsets[ this ] = [
			horizontalOffset ? horizontalOffset[ 0 ] : 0,
			verticalOffset ? verticalOffset[ 0 ] : 0
		];

		// reduce to just the positions without the offsets
		options[ this ] = [
			rposition.exec( pos[ 0 ] )[ 0 ],
			rposition.exec( pos[ 1 ] )[ 0 ]
		];
	});

	// normalize collision option
	if ( collision.length === 1 ) {
		collision[ 1 ] = collision[ 0 ];
	}

	if ( options.at[ 0 ] === "right" ) {
		basePosition.left += targetWidth;
	} else if ( options.at[ 0 ] === "center" ) {
		basePosition.left += targetWidth / 2;
	}

	if ( options.at[ 1 ] === "bottom" ) {
		basePosition.top += targetHeight;
	} else if ( options.at[ 1 ] === "center" ) {
		basePosition.top += targetHeight / 2;
	}

	atOffset = getOffsets( offsets.at, targetWidth, targetHeight );
	basePosition.left += atOffset[ 0 ];
	basePosition.top += atOffset[ 1 ];

	return this.each(function() {
		var collisionPosition, using,
			elem = $( this ),
			elemWidth = elem.outerWidth(),
			elemHeight = elem.outerHeight(),
			marginLeft = parseCss( this, "marginLeft" ),
			marginTop = parseCss( this, "marginTop" ),
			collisionWidth = elemWidth + marginLeft + parseCss( this, "marginRight" ) + scrollInfo.width,
			collisionHeight = elemHeight + marginTop + parseCss( this, "marginBottom" ) + scrollInfo.height,
			position = $.extend( {}, basePosition ),
			myOffset = getOffsets( offsets.my, elem.outerWidth(), elem.outerHeight() );

		if ( options.my[ 0 ] === "right" ) {
			position.left -= elemWidth;
		} else if ( options.my[ 0 ] === "center" ) {
			position.left -= elemWidth / 2;
		}

		if ( options.my[ 1 ] === "bottom" ) {
			position.top -= elemHeight;
		} else if ( options.my[ 1 ] === "center" ) {
			position.top -= elemHeight / 2;
		}

		position.left += myOffset[ 0 ];
		position.top += myOffset[ 1 ];

		// if the browser doesn't support fractions, then round for consistent results
		if ( !$.support.offsetFractions ) {
			position.left = round( position.left );
			position.top = round( position.top );
		}

		collisionPosition = {
			marginLeft: marginLeft,
			marginTop: marginTop
		};

		$.each( [ "left", "top" ], function( i, dir ) {
			if ( $.ui.position[ collision[ i ] ] ) {
				$.ui.position[ collision[ i ] ][ dir ]( position, {
					targetWidth: targetWidth,
					targetHeight: targetHeight,
					elemWidth: elemWidth,
					elemHeight: elemHeight,
					collisionPosition: collisionPosition,
					collisionWidth: collisionWidth,
					collisionHeight: collisionHeight,
					offset: [ atOffset[ 0 ] + myOffset[ 0 ], atOffset [ 1 ] + myOffset[ 1 ] ],
					my: options.my,
					at: options.at,
					within: within,
					elem : elem
				});
			}
		});

		if ( options.using ) {
			// adds feedback as second argument to using callback, if present
			using = function( props ) {
				var left = targetOffset.left - position.left,
					right = left + targetWidth - elemWidth,
					top = targetOffset.top - position.top,
					bottom = top + targetHeight - elemHeight,
					feedback = {
						target: {
							element: target,
							left: targetOffset.left,
							top: targetOffset.top,
							width: targetWidth,
							height: targetHeight
						},
						element: {
							element: elem,
							left: position.left,
							top: position.top,
							width: elemWidth,
							height: elemHeight
						},
						horizontal: right < 0 ? "left" : left > 0 ? "right" : "center",
						vertical: bottom < 0 ? "top" : top > 0 ? "bottom" : "middle"
					};
				if ( targetWidth < elemWidth && abs( left + right ) < targetWidth ) {
					feedback.horizontal = "center";
				}
				if ( targetHeight < elemHeight && abs( top + bottom ) < targetHeight ) {
					feedback.vertical = "middle";
				}
				if ( max( abs( left ), abs( right ) ) > max( abs( top ), abs( bottom ) ) ) {
					feedback.important = "horizontal";
				} else {
					feedback.important = "vertical";
				}
				options.using.call( this, props, feedback );
			};
		}

		elem.offset( $.extend( position, { using: using } ) );
	});
};

$.ui.position = {
	fit: {
		left: function( position, data ) {
			var within = data.within,
				withinOffset = within.isWindow ? within.scrollLeft : within.offset.left,
				outerWidth = within.width,
				collisionPosLeft = position.left - data.collisionPosition.marginLeft,
				overLeft = withinOffset - collisionPosLeft,
				overRight = collisionPosLeft + data.collisionWidth - outerWidth - withinOffset,
				newOverRight;

			// element is wider than within
			if ( data.collisionWidth > outerWidth ) {
				// element is initially over the left side of within
				if ( overLeft > 0 && overRight <= 0 ) {
					newOverRight = position.left + overLeft + data.collisionWidth - outerWidth - withinOffset;
					position.left += overLeft - newOverRight;
				// element is initially over right side of within
				} else if ( overRight > 0 && overLeft <= 0 ) {
					position.left = withinOffset;
				// element is initially over both left and right sides of within
				} else {
					if ( overLeft > overRight ) {
						position.left = withinOffset + outerWidth - data.collisionWidth;
					} else {
						position.left = withinOffset;
					}
				}
			// too far left -> align with left edge
			} else if ( overLeft > 0 ) {
				position.left += overLeft;
			// too far right -> align with right edge
			} else if ( overRight > 0 ) {
				position.left -= overRight;
			// adjust based on position and margin
			} else {
				position.left = max( position.left - collisionPosLeft, position.left );
			}
		},
		top: function( position, data ) {
			var within = data.within,
				withinOffset = within.isWindow ? within.scrollTop : within.offset.top,
				outerHeight = data.within.height,
				collisionPosTop = position.top - data.collisionPosition.marginTop,
				overTop = withinOffset - collisionPosTop,
				overBottom = collisionPosTop + data.collisionHeight - outerHeight - withinOffset,
				newOverBottom;

			// element is taller than within
			if ( data.collisionHeight > outerHeight ) {
				// element is initially over the top of within
				if ( overTop > 0 && overBottom <= 0 ) {
					newOverBottom = position.top + overTop + data.collisionHeight - outerHeight - withinOffset;
					position.top += overTop - newOverBottom;
				// element is initially over bottom of within
				} else if ( overBottom > 0 && overTop <= 0 ) {
					position.top = withinOffset;
				// element is initially over both top and bottom of within
				} else {
					if ( overTop > overBottom ) {
						position.top = withinOffset + outerHeight - data.collisionHeight;
					} else {
						position.top = withinOffset;
					}
				}
			// too far up -> align with top
			} else if ( overTop > 0 ) {
				position.top += overTop;
			// too far down -> align with bottom edge
			} else if ( overBottom > 0 ) {
				position.top -= overBottom;
			// adjust based on position and margin
			} else {
				position.top = max( position.top - collisionPosTop, position.top );
			}
		}
	},
	flip: {
		left: function( position, data ) {
			var within = data.within,
				withinOffset = within.offset.left + within.scrollLeft,
				outerWidth = within.width,
				offsetLeft = within.isWindow ? within.scrollLeft : within.offset.left,
				collisionPosLeft = position.left - data.collisionPosition.marginLeft,
				overLeft = collisionPosLeft - offsetLeft,
				overRight = collisionPosLeft + data.collisionWidth - outerWidth - offsetLeft,
				myOffset = data.my[ 0 ] === "left" ?
					-data.elemWidth :
					data.my[ 0 ] === "right" ?
						data.elemWidth :
						0,
				atOffset = data.at[ 0 ] === "left" ?
					data.targetWidth :
					data.at[ 0 ] === "right" ?
						-data.targetWidth :
						0,
				offset = -2 * data.offset[ 0 ],
				newOverRight,
				newOverLeft;

			if ( overLeft < 0 ) {
				newOverRight = position.left + myOffset + atOffset + offset + data.collisionWidth - outerWidth - withinOffset;
				if ( newOverRight < 0 || newOverRight < abs( overLeft ) ) {
					position.left += myOffset + atOffset + offset;
				}
			}
			else if ( overRight > 0 ) {
				newOverLeft = position.left - data.collisionPosition.marginLeft + myOffset + atOffset + offset - offsetLeft;
				if ( newOverLeft > 0 || abs( newOverLeft ) < overRight ) {
					position.left += myOffset + atOffset + offset;
				}
			}
		},
		top: function( position, data ) {
			var within = data.within,
				withinOffset = within.offset.top + within.scrollTop,
				outerHeight = within.height,
				offsetTop = within.isWindow ? within.scrollTop : within.offset.top,
				collisionPosTop = position.top - data.collisionPosition.marginTop,
				overTop = collisionPosTop - offsetTop,
				overBottom = collisionPosTop + data.collisionHeight - outerHeight - offsetTop,
				top = data.my[ 1 ] === "top",
				myOffset = top ?
					-data.elemHeight :
					data.my[ 1 ] === "bottom" ?
						data.elemHeight :
						0,
				atOffset = data.at[ 1 ] === "top" ?
					data.targetHeight :
					data.at[ 1 ] === "bottom" ?
						-data.targetHeight :
						0,
				offset = -2 * data.offset[ 1 ],
				newOverTop,
				newOverBottom;
			if ( overTop < 0 ) {
				newOverBottom = position.top + myOffset + atOffset + offset + data.collisionHeight - outerHeight - withinOffset;
				if ( ( position.top + myOffset + atOffset + offset) > overTop && ( newOverBottom < 0 || newOverBottom < abs( overTop ) ) ) {
					position.top += myOffset + atOffset + offset;
				}
			}
			else if ( overBottom > 0 ) {
				newOverTop = position.top - data.collisionPosition.marginTop + myOffset + atOffset + offset - offsetTop;
				if ( ( position.top + myOffset + atOffset + offset) > overBottom && ( newOverTop > 0 || abs( newOverTop ) < overBottom ) ) {
					position.top += myOffset + atOffset + offset;
				}
			}
		}
	},
	flipfit: {
		left: function() {
			$.ui.position.flip.left.apply( this, arguments );
			$.ui.position.fit.left.apply( this, arguments );
		},
		top: function() {
			$.ui.position.flip.top.apply( this, arguments );
			$.ui.position.fit.top.apply( this, arguments );
		}
	}
};

// fraction support test
(function () {
	var testElement, testElementParent, testElementStyle, offsetLeft, i,
		body = document.getElementsByTagName( "body" )[ 0 ],
		div = document.createElement( "div" );

	//Create a "fake body" for testing based on method used in jQuery.support
	testElement = document.createElement( body ? "div" : "body" );
	testElementStyle = {
		visibility: "hidden",
		width: 0,
		height: 0,
		border: 0,
		margin: 0,
		background: "none"
	};
	if ( body ) {
		$.extend( testElementStyle, {
			position: "absolute",
			left: "-1000px",
			top: "-1000px"
		});
	}
	for ( i in testElementStyle ) {
		testElement.style[ i ] = testElementStyle[ i ];
	}
	testElement.appendChild( div );
	testElementParent = body || document.documentElement;
	testElementParent.insertBefore( testElement, testElementParent.firstChild );

	div.style.cssText = "position: absolute; left: 10.7432222px;";

	offsetLeft = $( div ).offset().left;
	$.support.offsetFractions = offsetLeft > 10 && offsetLeft < 11;

	testElement.innerHTML = "";
	testElementParent.removeChild( testElement );
})();

}( jQuery ) );

},{}],5:[function(require,module,exports){
var jQuery = require('jquery');

/*!
 * jQuery UI Widget 1.10.4
 * http://jqueryui.com
 *
 * Copyright 2014 jQuery Foundation and other contributors
 * Released under the MIT license.
 * http://jquery.org/license
 *
 * http://api.jqueryui.com/jQuery.widget/
 */
(function( $, undefined ) {

var uuid = 0,
	slice = Array.prototype.slice,
	_cleanData = $.cleanData;
$.cleanData = function( elems ) {
	for ( var i = 0, elem; (elem = elems[i]) != null; i++ ) {
		try {
			$( elem ).triggerHandler( "remove" );
		// http://bugs.jquery.com/ticket/8235
		} catch( e ) {}
	}
	_cleanData( elems );
};

$.widget = function( name, base, prototype ) {
	var fullName, existingConstructor, constructor, basePrototype,
		// proxiedPrototype allows the provided prototype to remain unmodified
		// so that it can be used as a mixin for multiple widgets (#8876)
		proxiedPrototype = {},
		namespace = name.split( "." )[ 0 ];

	name = name.split( "." )[ 1 ];
	fullName = namespace + "-" + name;

	if ( !prototype ) {
		prototype = base;
		base = $.Widget;
	}

	// create selector for plugin
	$.expr[ ":" ][ fullName.toLowerCase() ] = function( elem ) {
		return !!$.data( elem, fullName );
	};

	$[ namespace ] = $[ namespace ] || {};
	existingConstructor = $[ namespace ][ name ];
	constructor = $[ namespace ][ name ] = function( options, element ) {
		// allow instantiation without "new" keyword
		if ( !this._createWidget ) {
			return new constructor( options, element );
		}

		// allow instantiation without initializing for simple inheritance
		// must use "new" keyword (the code above always passes args)
		if ( arguments.length ) {
			this._createWidget( options, element );
		}
	};
	// extend with the existing constructor to carry over any static properties
	$.extend( constructor, existingConstructor, {
		version: prototype.version,
		// copy the object used to create the prototype in case we need to
		// redefine the widget later
		_proto: $.extend( {}, prototype ),
		// track widgets that inherit from this widget in case this widget is
		// redefined after a widget inherits from it
		_childConstructors: []
	});

	basePrototype = new base();
	// we need to make the options hash a property directly on the new instance
	// otherwise we'll modify the options hash on the prototype that we're
	// inheriting from
	basePrototype.options = $.widget.extend( {}, basePrototype.options );
	$.each( prototype, function( prop, value ) {
		if ( !$.isFunction( value ) ) {
			proxiedPrototype[ prop ] = value;
			return;
		}
		proxiedPrototype[ prop ] = (function() {
			var _super = function() {
					return base.prototype[ prop ].apply( this, arguments );
				},
				_superApply = function( args ) {
					return base.prototype[ prop ].apply( this, args );
				};
			return function() {
				var __super = this._super,
					__superApply = this._superApply,
					returnValue;

				this._super = _super;
				this._superApply = _superApply;

				returnValue = value.apply( this, arguments );

				this._super = __super;
				this._superApply = __superApply;

				return returnValue;
			};
		})();
	});
	constructor.prototype = $.widget.extend( basePrototype, {
		// TODO: remove support for widgetEventPrefix
		// always use the name + a colon as the prefix, e.g., draggable:start
		// don't prefix for widgets that aren't DOM-based
		widgetEventPrefix: existingConstructor ? (basePrototype.widgetEventPrefix || name) : name
	}, proxiedPrototype, {
		constructor: constructor,
		namespace: namespace,
		widgetName: name,
		widgetFullName: fullName
	});

	// If this widget is being redefined then we need to find all widgets that
	// are inheriting from it and redefine all of them so that they inherit from
	// the new version of this widget. We're essentially trying to replace one
	// level in the prototype chain.
	if ( existingConstructor ) {
		$.each( existingConstructor._childConstructors, function( i, child ) {
			var childPrototype = child.prototype;

			// redefine the child widget using the same prototype that was
			// originally used, but inherit from the new version of the base
			$.widget( childPrototype.namespace + "." + childPrototype.widgetName, constructor, child._proto );
		});
		// remove the list of existing child constructors from the old constructor
		// so the old child constructors can be garbage collected
		delete existingConstructor._childConstructors;
	} else {
		base._childConstructors.push( constructor );
	}

	$.widget.bridge( name, constructor );
};

$.widget.extend = function( target ) {
	var input = slice.call( arguments, 1 ),
		inputIndex = 0,
		inputLength = input.length,
		key,
		value;
	for ( ; inputIndex < inputLength; inputIndex++ ) {
		for ( key in input[ inputIndex ] ) {
			value = input[ inputIndex ][ key ];
			if ( input[ inputIndex ].hasOwnProperty( key ) && value !== undefined ) {
				// Clone objects
				if ( $.isPlainObject( value ) ) {
					target[ key ] = $.isPlainObject( target[ key ] ) ?
						$.widget.extend( {}, target[ key ], value ) :
						// Don't extend strings, arrays, etc. with objects
						$.widget.extend( {}, value );
				// Copy everything else by reference
				} else {
					target[ key ] = value;
				}
			}
		}
	}
	return target;
};

$.widget.bridge = function( name, object ) {
	var fullName = object.prototype.widgetFullName || name;
	$.fn[ name ] = function( options ) {
		var isMethodCall = typeof options === "string",
			args = slice.call( arguments, 1 ),
			returnValue = this;

		// allow multiple hashes to be passed on init
		options = !isMethodCall && args.length ?
			$.widget.extend.apply( null, [ options ].concat(args) ) :
			options;

		if ( isMethodCall ) {
			this.each(function() {
				var methodValue,
					instance = $.data( this, fullName );
				if ( !instance ) {
					return $.error( "cannot call methods on " + name + " prior to initialization; " +
						"attempted to call method '" + options + "'" );
				}
				if ( !$.isFunction( instance[options] ) || options.charAt( 0 ) === "_" ) {
					return $.error( "no such method '" + options + "' for " + name + " widget instance" );
				}
				methodValue = instance[ options ].apply( instance, args );
				if ( methodValue !== instance && methodValue !== undefined ) {
					returnValue = methodValue && methodValue.jquery ?
						returnValue.pushStack( methodValue.get() ) :
						methodValue;
					return false;
				}
			});
		} else {
			this.each(function() {
				var instance = $.data( this, fullName );
				if ( instance ) {
					instance.option( options || {} )._init();
				} else {
					$.data( this, fullName, new object( options, this ) );
				}
			});
		}

		return returnValue;
	};
};

$.Widget = function( /* options, element */ ) {};
$.Widget._childConstructors = [];

$.Widget.prototype = {
	widgetName: "widget",
	widgetEventPrefix: "",
	defaultElement: "<div>",
	options: {
		disabled: false,

		// callbacks
		create: null
	},
	_createWidget: function( options, element ) {
		element = $( element || this.defaultElement || this )[ 0 ];
		this.element = $( element );
		this.uuid = uuid++;
		this.eventNamespace = "." + this.widgetName + this.uuid;
		this.options = $.widget.extend( {},
			this.options,
			this._getCreateOptions(),
			options );

		this.bindings = $();
		this.hoverable = $();
		this.focusable = $();

		if ( element !== this ) {
			$.data( element, this.widgetFullName, this );
			this._on( true, this.element, {
				remove: function( event ) {
					if ( event.target === element ) {
						this.destroy();
					}
				}
			});
			this.document = $( element.style ?
				// element within the document
				element.ownerDocument :
				// element is window or document
				element.document || element );
			this.window = $( this.document[0].defaultView || this.document[0].parentWindow );
		}

		this._create();
		this._trigger( "create", null, this._getCreateEventData() );
		this._init();
	},
	_getCreateOptions: $.noop,
	_getCreateEventData: $.noop,
	_create: $.noop,
	_init: $.noop,

	destroy: function() {
		this._destroy();
		// we can probably remove the unbind calls in 2.0
		// all event bindings should go through this._on()
		this.element
			.unbind( this.eventNamespace )
			// 1.9 BC for #7810
			// TODO remove dual storage
			.removeData( this.widgetName )
			.removeData( this.widgetFullName )
			// support: jquery <1.6.3
			// http://bugs.jquery.com/ticket/9413
			.removeData( $.camelCase( this.widgetFullName ) );
		this.widget()
			.unbind( this.eventNamespace )
			.removeAttr( "aria-disabled" )
			.removeClass(
				this.widgetFullName + "-disabled " +
				"ui-state-disabled" );

		// clean up events and states
		this.bindings.unbind( this.eventNamespace );
		this.hoverable.removeClass( "ui-state-hover" );
		this.focusable.removeClass( "ui-state-focus" );
	},
	_destroy: $.noop,

	widget: function() {
		return this.element;
	},

	option: function( key, value ) {
		var options = key,
			parts,
			curOption,
			i;

		if ( arguments.length === 0 ) {
			// don't return a reference to the internal hash
			return $.widget.extend( {}, this.options );
		}

		if ( typeof key === "string" ) {
			// handle nested keys, e.g., "foo.bar" => { foo: { bar: ___ } }
			options = {};
			parts = key.split( "." );
			key = parts.shift();
			if ( parts.length ) {
				curOption = options[ key ] = $.widget.extend( {}, this.options[ key ] );
				for ( i = 0; i < parts.length - 1; i++ ) {
					curOption[ parts[ i ] ] = curOption[ parts[ i ] ] || {};
					curOption = curOption[ parts[ i ] ];
				}
				key = parts.pop();
				if ( arguments.length === 1 ) {
					return curOption[ key ] === undefined ? null : curOption[ key ];
				}
				curOption[ key ] = value;
			} else {
				if ( arguments.length === 1 ) {
					return this.options[ key ] === undefined ? null : this.options[ key ];
				}
				options[ key ] = value;
			}
		}

		this._setOptions( options );

		return this;
	},
	_setOptions: function( options ) {
		var key;

		for ( key in options ) {
			this._setOption( key, options[ key ] );
		}

		return this;
	},
	_setOption: function( key, value ) {
		this.options[ key ] = value;

		if ( key === "disabled" ) {
			this.widget()
				.toggleClass( this.widgetFullName + "-disabled ui-state-disabled", !!value )
				.attr( "aria-disabled", value );
			this.hoverable.removeClass( "ui-state-hover" );
			this.focusable.removeClass( "ui-state-focus" );
		}

		return this;
	},

	enable: function() {
		return this._setOption( "disabled", false );
	},
	disable: function() {
		return this._setOption( "disabled", true );
	},

	_on: function( suppressDisabledCheck, element, handlers ) {
		var delegateElement,
			instance = this;

		// no suppressDisabledCheck flag, shuffle arguments
		if ( typeof suppressDisabledCheck !== "boolean" ) {
			handlers = element;
			element = suppressDisabledCheck;
			suppressDisabledCheck = false;
		}

		// no element argument, shuffle and use this.element
		if ( !handlers ) {
			handlers = element;
			element = this.element;
			delegateElement = this.widget();
		} else {
			// accept selectors, DOM elements
			element = delegateElement = $( element );
			this.bindings = this.bindings.add( element );
		}

		$.each( handlers, function( event, handler ) {
			function handlerProxy() {
				// allow widgets to customize the disabled handling
				// - disabled as an array instead of boolean
				// - disabled class as method for disabling individual parts
				if ( !suppressDisabledCheck &&
						( instance.options.disabled === true ||
							$( this ).hasClass( "ui-state-disabled" ) ) ) {
					return;
				}
				return ( typeof handler === "string" ? instance[ handler ] : handler )
					.apply( instance, arguments );
			}

			// copy the guid so direct unbinding works
			if ( typeof handler !== "string" ) {
				handlerProxy.guid = handler.guid =
					handler.guid || handlerProxy.guid || $.guid++;
			}

			var match = event.match( /^(\w+)\s*(.*)$/ ),
				eventName = match[1] + instance.eventNamespace,
				selector = match[2];
			if ( selector ) {
				delegateElement.delegate( selector, eventName, handlerProxy );
			} else {
				element.bind( eventName, handlerProxy );
			}
		});
	},

	_off: function( element, eventName ) {
		eventName = (eventName || "").split( " " ).join( this.eventNamespace + " " ) + this.eventNamespace;
		element.unbind( eventName ).undelegate( eventName );
	},

	_delay: function( handler, delay ) {
		function handlerProxy() {
			return ( typeof handler === "string" ? instance[ handler ] : handler )
				.apply( instance, arguments );
		}
		var instance = this;
		return setTimeout( handlerProxy, delay || 0 );
	},

	_hoverable: function( element ) {
		this.hoverable = this.hoverable.add( element );
		this._on( element, {
			mouseenter: function( event ) {
				$( event.currentTarget ).addClass( "ui-state-hover" );
			},
			mouseleave: function( event ) {
				$( event.currentTarget ).removeClass( "ui-state-hover" );
			}
		});
	},

	_focusable: function( element ) {
		this.focusable = this.focusable.add( element );
		this._on( element, {
			focusin: function( event ) {
				$( event.currentTarget ).addClass( "ui-state-focus" );
			},
			focusout: function( event ) {
				$( event.currentTarget ).removeClass( "ui-state-focus" );
			}
		});
	},

	_trigger: function( type, event, data ) {
		var prop, orig,
			callback = this.options[ type ];

		data = data || {};
		event = $.Event( event );
		event.type = ( type === this.widgetEventPrefix ?
			type :
			this.widgetEventPrefix + type ).toLowerCase();
		// the original event may come from any element
		// so we need to reset the target on the new event
		event.target = this.element[ 0 ];

		// copy original event properties over to the new event
		orig = event.originalEvent;
		if ( orig ) {
			for ( prop in orig ) {
				if ( !( prop in event ) ) {
					event[ prop ] = orig[ prop ];
				}
			}
		}

		this.element.trigger( event, data );
		return !( $.isFunction( callback ) &&
			callback.apply( this.element[0], [ event ].concat( data ) ) === false ||
			event.isDefaultPrevented() );
	}
};

$.each( { show: "fadeIn", hide: "fadeOut" }, function( method, defaultEffect ) {
	$.Widget.prototype[ "_" + method ] = function( element, options, callback ) {
		if ( typeof options === "string" ) {
			options = { effect: options };
		}
		var hasOptions,
			effectName = !options ?
				method :
				options === true || typeof options === "number" ?
					defaultEffect :
					options.effect || defaultEffect;
		options = options || {};
		if ( typeof options === "number" ) {
			options = { duration: options };
		}
		hasOptions = !$.isEmptyObject( options );
		options.complete = callback;
		if ( options.delay ) {
			element.delay( options.delay );
		}
		if ( hasOptions && $.effects && $.effects.effect[ effectName ] ) {
			element[ method ]( options );
		} else if ( effectName !== method && element[ effectName ] ) {
			element[ effectName ]( options.duration, options.easing, callback );
		} else {
			element.queue(function( next ) {
				$( this )[ method ]();
				if ( callback ) {
					callback.call( element[ 0 ] );
				}
				next();
			});
		}
	};
});

})( jQuery );

},{}],6:[function(require,module,exports){
/**
    Model class to help build models.

    Is not exactly an 'OOP base' class, but provides
    utilities to models and a model definition object
    when executed in their constructors as:
    
    '''
    function MyModel() {
        Model(this);
        // Now, there is a this.model property with
        // an instance of the Model class, with 
        // utilities and model settings.
    }
    '''
    
    That auto creation of 'model' property can be avoided
    when using the object instantiation syntax ('new' keyword):
    
    '''
    var model = new Model(obj);
    // There is no a 'obj.model' property, can be
    // assigned to whatever property or nothing.
    '''
**/
'use strict';
var ko = require('knockout');
ko.mapping = require('knockout.mapping');
var $ = require('jquery');
var clone = function(obj) { return $.extend(true, {}, obj); };
var cloneValue = function(val, deepCopy) {
    /*jshint maxcomplexity: 10*/
    if (typeof(val) === 'object') {
        // A Date object is a special case: even being
        // an object, treat as a basic type, being copied as
        // a new instance independent of the deepCopy option
        if (val instanceof Date) {
            // A date clone
            return new Date(val);
        }
        else if (deepCopy === true) {
            if (val instanceof Array) {
                return val.map(function(item) {
                    return cloneValue(item, true);
                });
            }
            else if (val === null) {
                return null;
            }
            else if (val && val.model instanceof Model) {
                // A model copy
                return val.model.toPlainObject(deepCopy);
            }
            else {
                // Plain 'standard' object clone
                return clone(val);
            }
        }
        else if (deepCopy === false) {
            // Shallow copy
            return val;
        }
        // On else, left undefined, no references, no clones,
        // discarded value
        return undefined;
    }
    else {
        // A basic type value is already copied/cloned by javascript
        // on every assignment
        return val;
    }
};

function Model(modelObject) {
    
    if (!(this instanceof Model)) {
        // Executed as a function, it must create
        // a Model instance
        var model = new Model(modelObject);
        // and register automatically as part
        // of the modelObject in 'model' property
        modelObject.model = model;
        
        // Returns the instance
        return model;
    }
 
    // It includes a reference to the object
    this.modelObject = modelObject;
    // It maintains a list of properties and fields
    this.propertiesList = [];
    this.fieldsList = [];
    this.propertiesDefs = {};
    this.fieldsDefs = {};
    // It allow setting the 'ko.mapping.fromJS' mapping options
    // to control conversions from plain JS objects when 
    // 'updateWith'.
    this.mappingOptions = {};
    
    // Timestamp with the date of last change
    // in the data (automatically updated when changes
    // happens on properties; fields or any other member
    // added to the model cannot be observed for changes,
    // requiring manual updating with a 'new Date()', but is
    // better to use properties.
    // Its rated to zero just to avoid that consecutive
    // synchronous changes emit lot of notifications, specially
    // with bulk tasks like 'updateWith'.
    this.dataTimestamp = ko.observable(new Date()).extend({ rateLimit: 0 });
}

module.exports = Model;

/**
    Internal utility to map a value given its property/field
    definition
**/
function prepareValueByDef(val, def) {
    if (def.isArray && 
        !Array.isArray(val)) {
        if (typeof(val) !== 'undefined')
            val = [val];
        else
            val = [];
    }
    if (def && def.Model) {
        if (Array.isArray(val)) {
            val = val.map(function(item) {
                if (item instanceof def.Model ||
                    item === null ||
                    typeof(item) === 'undefined') {
                    // 'as is'
                    return item;
                }
                else {
                    return new def.Model(item);
                }
            });
        }
        else {
            if (!(val instanceof def.Model) &&
                val !== null &&
                typeof(val) !== 'undefined') {
                val = new def.Model(val);
            }
        }
    }
    return val;
}

function createDef(givenVal, initialVal) {
    
    var def,
        isModel = givenVal && givenVal.model instanceof Model,
        isArray = Array.isArray(givenVal),
        isObject = typeof(givenVal) === 'object' && !(givenVal instanceof Date);

    if (givenVal !== null && !isModel && isObject && !isArray) {
        def = givenVal;
    }
    else {
        def = {
            defaultValue: givenVal,
            isArray: isArray
        };
        if (isModel)
            def.Model = givenVal.constructor;
    }
    
    initialVal = typeof(initialVal) === 'undefined' ? def.defaultValue : initialVal;
    def.initialValue = prepareValueByDef(initialVal, def);
    
    return def;
}

/**
    Define observable properties using the given
    properties object definition that includes de default values,
    and some optional initialValues (normally that is provided externally
    as a parameter to the model constructor, while default values are
    set in the constructor).
    That properties become members of the modelObject, simplifying 
    model definitions.
    
    It uses Knockout.observable and observableArray, so properties
    are funtions that reads the value when no arguments or sets when
    one argument is passed of.
**/
Model.prototype.defProperties = function defProperties(properties, initialValues) {

    initialValues = initialValues || {};

    var modelObject = this.modelObject,
        propertiesList = this.propertiesList,
        defs = this.propertiesDefs,
        dataTimestamp = this.dataTimestamp;

    Object.keys(properties).forEach(function(key) {
        
        // Create and register definition
        var def = createDef(properties[key], initialValues[key]);
        defs[key] = def;

        // Create the observable property
        modelObject[key] = Array.isArray(def.initialValue) ?
            ko.observableArray(def.initialValue) :
            ko.observable(def.initialValue);

        // Remember default
        modelObject[key]._defaultValue = def.defaultValue;
        // remember initial
        modelObject[key]._initialValue = def.initialValue;    
        
        // Add subscriber to update the timestamp on changes
        modelObject[key].subscribe(function() {
            dataTimestamp(new Date());
        });
        
        // Add to the internal registry
        propertiesList.push(key);
    });
    
    // Update timestamp after the bulk creation.
    dataTimestamp(new Date());
};

/**
    Define fields as plain members of the modelObject using
    the fields object definition that includes default values,
    and some optional initialValues.
    
    Its like defProperties, but for plain js values rather than observables.
**/
Model.prototype.defFields = function defFields(fields, initialValues) {

    initialValues = initialValues || {};

    var modelObject = this.modelObject,
        defs = this.fieldsDefs,
        fieldsList = this.fieldsList;

    Object.keys(fields).each(function(key) {
        
        // Create and register definition
        var def = createDef(fields[key], initialValues[key]);
        defs[key] = def;
        
        // Create field with initial value
        modelObject[key] = def.initialValue;
        
        // Add to the internal registry
        fieldsList.push(key);
    });
};

/**
    Store the list of fields that make the ID/primary key
    and create an alias 'id' property that returns the
    value for the ID field or array of values when multiple
    fields.
**/
Model.prototype.defID = function defID(fieldsNames) {
    
    // Store the list
    this.idFieldsNames = fieldsNames;
    
    // Define ID observable
    if (fieldsNames.length === 1) {
        // Returns single value
        var field = fieldsNames[0];
        this.modelObject.id = ko.pureComputed(function() {
            return this[field]();
        }, this.modelObject);
    }
    else {
        this.modelObject.id = ko.pureComputed(function() {
            return fieldsNames.map(function(fieldName) {
                return this[fieldName]();
            }.bind(this));
        }, this.modelObject);
    }
};

/**
    Allows to register a property (previously defined) as 
    the model timestamp, so gets updated on any data change
    (keep in sync with the internal dataTimestamp).
**/
Model.prototype.regTimestamp = function regTimestampProperty(propertyName) {

    var prop = this.modelObject[propertyName];
    if (typeof(prop) !== 'function') {
        throw new Error('There is no observable property with name [' + 
                        propertyName + 
                        '] to register as timestamp.'
       );
    }
    // Add subscriber on internal timestamp to keep
    // the property updated
    this.dataTimestamp.subscribe(function(timestamp) {
        prop(timestamp);
    });
};

/**
    Returns a plain object with the properties and fields
    of the model object, just values.
    
    @param deepCopy:bool If left undefined, do not copy objects in
    values and not references. If false, do a shallow copy, setting
    up references in the result. If true, to a deep copy of all objects.
**/
Model.prototype.toPlainObject = function toPlainObject(deepCopy) {

    var plain = {},
        modelObj = this.modelObject;

    function setValue(property, val) {
        var clonedValue = cloneValue(val, deepCopy);
        if (typeof(clonedValue) !== 'undefined') {
            plain[property] = clonedValue;
        }
    }

    this.propertiesList.forEach(function(property) {
        // Properties are observables, so functions without params:
        var val = modelObj[property]();

        setValue(property, val);
    });

    this.fieldsList.forEach(function(field) {
        // Fields are just plain object members for values, just copy:
        var val = modelObj[field];

        setValue(field, val);
    });

    return plain;
};

Model.prototype.updateWith = function updateWith(data, deepCopy) {
    
    // We need a plain object for 'fromJS'.
    // If is a model, extract their properties and fields from
    // the observables (fromJS), so we not get computed
    // or functions, just registered properties and fields
    var timestamp = null;
    if (data && data.model instanceof Model) {

        // We need to set the same timestamp, so
        // remember for after the fromJS
        timestamp = data.model.dataTimestamp();
        
        // Replace data with a plain copy of itself
        data = data.model.toPlainObject(deepCopy);
    }

    var target = this.modelObject,
        defs = this.propertiesDefs;
    this.propertiesList.forEach(function(property) {
        var val = data[property],
            def = defs[property];
        if (typeof(val) !== 'undefined') {
            target[property](prepareValueByDef(val, def));
        }
    });

    defs = this.fieldsDefs;
    this.fieldsList.forEach(function(field) {
        var val = data[field],
            def = defs[field];
        if (typeof(val) !== 'undefined') {
            target[field] = prepareValueByDef(val, def);
        }
    });

    // Same timestamp if any
    if (timestamp)
        this.modelObject.model.dataTimestamp(timestamp);
};

/**
    Given a plain object in a accepted import structure
    (never a Model instance), it maps
    the data to the object following a set of mapping options
    of ko.mapping.
    If the data is a representation of the model by 'toPlainObject'
    then use 'updateWith' better.
    
    TODO: Review, not used still, no sure if really useful to depend
    on ko.mapping and this.
**/
Model.prototype.mapData = function mapData(data, optionalMapping) {
    ko.mapping.fromJS(data, optionalMapping || this.mappingOptions, this.modelObject);
};

Model.prototype.clone = function clone(data, deepCopy) {
    // Get a plain object with the object data
    var plain = this.toPlainObject(deepCopy);
    // Create a new model instance, using the source plain object
    // as initial values
    var cloned = new this.modelObject.constructor(plain);
    if (data) {
        // Update the cloned with the provided plain data used
        // to replace values on the cloned one, for quick one-step creation
        // of derived objects.
        cloned.model.updateWith(data);
    }
    else {
        // Since there is no initial differential data, ensure the
        // same timestamp since the clone is still identical to the source
        cloned.model.dataTimestamp(this.modelObject.model.dataTimestamp());
    }
    // Cloned model ready:
    return cloned;
};

/**
    Updates the dataTimestamp to the current unique datetime,
    so the model appear as touched/updated, even if not data change.
    Useful sometimes to make a difference from a cloned instance
    so appear different.
    NOTE: the datetime set is not exactly the current one, is the current
    number of milliseconds plus one,
    to ensure that the timestamp is different on edge cases where this
    method is called just after a creation or clonation, because the way
    javascript works and the limited milliseconds precision of the Date object
    there is a chance that the 'touched' date will be the same as before,
    thats avoided with this simple trick, so remains 'unique' in the current execution.
**/
Model.prototype.touch = function touch() {
    // We use the function way to get milliseconds, add 1 and create instance
    this.dataTimestamp(new Date(Date() + 1));
};

/**
    Replaces all the properties and fields data in the model object
    with the default ones of the constructor, plus optional new preset data.
**/
Model.prototype.reset = function reset(presets) {
    
    var newInstance = new this.modelObject.constructor(presets);

    this.updateWith(newInstance, true);
};

},{"knockout":false,"knockout.mapping":false}],7:[function(require,module,exports){
/**
**/
'use strict';

var Model = require('./Model');

module.exports = function PricingSummaryDetail(values) {
    
    Model(this);

    this.model.defProperties({
        pricingSummaryID: 0,
        pricingSummaryRevision: 0,
        serviceProfessionalServiceID: 0,
        serviceProfessionalDataInput: null,
        clientDataInput: null,
        hourlyPrice: null,
        price: null,
        serviceDurationMinutes: null,
        firstSessionDurationMinutes: null,
        serviceName: '',
        serviceDescription: null,
        numberOfSessions: 1,
        createdDate: null,
        updatedDate: null
    }, values);
};

},{"./Model":6}],8:[function(require,module,exports){
/**
    Account activity
**/
'use strict';

var Activity = require('../components/Activity');

var A = Activity.extends(function AccountActivity() {
    
    Activity.apply(this, arguments);

    this.accessLevel = this.app.UserType.loggedUser;
    
    this.navBar = Activity.createSectionNavBar('Account');
});

exports.init = A.init;

},{"../components/Activity":90}],9:[function(require,module,exports){
/**
    AddJobTitles activity
**/
'use strict';

var Activity = require('../components/Activity');
var $ = require('jquery');
//NOTE: IT DEPENDS on this, but jquery-ui touch events support requires special load order
// so thats being done in the entry point file
//require('jquery-ui/autocomplete');

var A = Activity.extends(function AddJobTitlesActivity() {
    
    Activity.apply(this, arguments);

    this.accessLevel = this.app.UserType.serviceProfessional;
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

A.prototype.updateNavBarState = function updateNavBarState() {

    var referrer = this.app.shell.referrerRoute;
    referrer = referrer && referrer.url || '/scheduling';
    var link = this.requestData.cancelLink || referrer;
    
    if (!this.app.model.onboarding.updateNavBar(this.navBar)) {
        this.convertToCancelAction(this.navBar.leftAction(), link);
    }
};

A.prototype.show = function show(options) {

    Activity.prototype.show.call(this, options);
    
    // Reset
    this.viewModel.searchText('');
    this.viewModel.jobTitles.removeAll();
    
    this.updateNavBarState();
};

var ko = require('knockout');
function ViewModel(app) {
    
    this.isSearching = ko.observable(false);
    this.isSaving = ko.observable(false);
    this.isLocked = this.isSaving;
    this.searchText = ko.observable('');
    this.jobTitles = ko.observableArray([]);
    
    this.submitText = ko.pureComputed(function() {
        return (
            app.model.onboarding.inProgress() ?
                'Save and continue' :
                this.isSaving() ? 
                    'saving...' : 
                    'Save'
        );
    }, this);
    
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
                value: 0,
                label: s
            });
            this.searchText('');
        }
    }.bind(this);
    
    /**
        Look for an item in the current list, returning
        its index in the list or -1 if nothing.
    **/
    this.findItem = function findItem(jobTitle) {
        var foundIndex = -1;
        this.jobTitles().some(function(item, index) {
            if (jobTitle.value !== 0 &&
                item.value === jobTitle.value ||
                item.label === jobTitle.label) {
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

        Promise.all(this.jobTitles().map(function(jobTitle) {
            return app.model.userJobProfile.createUserJobTitle({
                jobTitleID: jobTitle.value,
                jobTitleName: jobTitle.label
            });
        }))
        .then(function(/*results*/) {
            this.searchText('');
            this.isSaving(false);
            // Reset list
            this.jobTitles.removeAll();
            
            if (app.model.onboarding.inProgress()) {
                app.model.onboarding.goNext();
            }
            else {
                app.successSave();
            }
            
        }.bind(this))
        .catch(function(error) {
            this.searchText('');
            this.isSaving(false);
            app.modals.showError({
                title: 'Impossible to add one or more job titles',
                error: error
            });
        }.bind(this));
    }.bind(this);
}

},{"../components/Activity":90,"knockout":false}],10:[function(require,module,exports){
/**
    AddressEditor activity
    
    TODO: ModelVersion is NOT being used, so no getting updates if server updates
    the data after load (data load is requested but get first from cache). Use
    version and get sync'ed data when ready, and additionally notification to
    override changes if server data is different that any local change.

    TODO: The URL structure and how params are read is ready to allow
    edition of different kind of addresses, but actually only service addresses
    are fully supported, since 'home address' is edited in contactInfo and
    'billing addresses' are not used currently, but when needed, the support for this
    last will need to be completed. All the API calls right now are
    for model.serviceAdddresses for example.
**/
'use strict';
var ko = require('knockout'),
    Address = require('../models/Address'),
    Activity = require('../components/Activity');

var A = Activity.extends(function AddressEditorActivity() {

    Activity.apply(this, arguments);

    this.accessLevel = this.app.UserType.serviceProfessional;
    this.viewModel = new ViewModel(this.app);
    this.navBar = Activity.createSubsectionNavBar('Locations');
    
    // Remote postal code look-up
    // NOTE: copied the code inside the postalCode computed handler in contactInfo.js with slight changes
    var app = this.app,
        viewModel = this.viewModel;
    this.registerHandler({
        target: this.viewModel.address,
        handler: function(address) {
            if (address &&
               !address.postalCode._hasLookup) {
                address.postalCode._hasLookup = true;
                
                // On change to a valid code, do remote look-up
                ko.computed(function() {
                    var postalCode = this.postalCode();
                    
                    if (postalCode && !/^\s*$/.test(postalCode)) {
                        app.model.postalCodes.getItem(postalCode)
                        .then(function(info) {
                            if (info) {
                                address.city(info.city);
                                address.stateProvinceCode(info.stateProvinceCode);
                                address.stateProvinceName(info.stateProvinceName);
                                viewModel.errorMessages.postalCode('');
                            }
                        })
                        .catch(function(err) {
                            address.city('');
                            address.stateProvinceCode('');
                            address.stateProvinceName('');
                            // Expected errors, a single message, set
                            // on the observable
                            var msg = typeof(err) === 'string' ? err : null;
                            if (msg || err && err.responseJSON && err.responseJSON.errorMessage) {
                                viewModel.errorMessages.postalCode(msg || err.responseJSON.errorMessage);
                            }
                            else {
                                // Log to console for debugging purposes, on regular use an error on the
                                // postal code is not critical and can be transparent; if there are 
                                // connectivity or authentification errors will throw on saving the address
                                console.error('Server error validating Zip Code', err);
                            }
                        });
                    }
                }, address)
                // Avoid excessive requests by setting a timeout since the latest change
                .extend({ rateLimit: { timeout: 200, method: 'notifyWhenChangesStop' } });
            }
        }
    });
    
    // Special treatment of the save operation
    this.viewModel.onSave = function(addressID) {
        if (this.requestData.returnNewAsSelected === true) {
            // Go to previous activity that required
            // to select an address
            this.requestData.addressID = addressID;
            this.app.shell.goBack(this.requestData);
        }
        else {
            // Regular save
            this.app.successSave();
        }
    }.bind(this);
});

exports.init = A.init;

A.prototype.updateNavBarState = function updateNavBarState() {

    var link = this.requestData.cancelLink || '/serviceAddresses/' + this.viewModel.jobTitleID();
    
    this.convertToCancelAction(this.navBar.leftAction(), link);
};

A.prototype.show = function show(options) {
    //jshint maxcomplexity:10    
    Activity.prototype.show.call(this, options);
    
    // Reset
    this.viewModel.wasRemoved(false);
    
    // Params    
    var params = options && options.route && options.route.segments || [];

    var kind = params[0] || '',
        isService = kind === Address.kind.service,
        jobTitleID = isService ? params[1] |0 : 0,
        addressID = isService ? params[2] |0 : params[1] |0,
        // Only used on service address creation, instead an ID we get
        // a string for 'serviceArea' or 'serviceLocation')
        serviceType = params[2] || '';
    
    this.viewModel.jobTitleID(jobTitleID);
    this.viewModel.addressID(addressID);
    
    this.updateNavBarState();

    if (addressID) {
        // Get the address
        this.app.model.serviceAddresses.getItemVersion(jobTitleID, addressID)
        .then(function (addressVersion) {
            if (addressVersion) {
                this.viewModel.addressVersion(addressVersion);
                this.viewModel.header('Edit Location');
            } else {
                this.viewModel.addressVersion(null);
                this.viewModel.header('Unknow location or was deleted');
            }
        }.bind(this))
        .catch(function (err) {
            this.app.modals.showError({
                title: 'There was an error while loading.',
                error: err
            });
        }.bind(this));
    }
    else {
        // New address
        this.viewModel.addressVersion(this.app.model.serviceAddresses.newItemVersion({
            jobTitleID: jobTitleID
        }));

        switch (serviceType) {
            case 'serviceArea':
                this.viewModel.address().isServiceArea(true);
                this.viewModel.address().isServiceLocation(false);
                this.viewModel.header('Add a service area');
                break;
            case 'serviceLocation':
                this.viewModel.address().isServiceArea(false);
                this.viewModel.address().isServiceLocation(true);
                this.viewModel.header('Add a service location');
                break;
            default:
                this.viewModel.address().isServiceArea(true);
                this.viewModel.address().isServiceLocation(true);
                this.viewModel.header('Add a location');
                break;
        }
    }
};

function ViewModel(app) {

    this.header = ko.observable('Edit Location');
    
    // List of possible error messages registered
    // by name
    this.errorMessages = {
        postalCode: ko.observable('')
    };
    
    this.jobTitleID = ko.observable(0);
    this.addressID = ko.observable(0);
    
    this.addressVersion = ko.observable(null);
    this.address = ko.pureComputed(function() {
        var v = this.addressVersion();
        if (v) {
            return v.version;
        }
        return null;
    }, this);
    this.isLoading = app.model.serviceAddresses.state.isLoading;
    this.isSaving = app.model.serviceAddresses.state.isSaving;
    this.isDeleting = app.model.serviceAddresses.state.isDeleting;

    this.wasRemoved = ko.observable(false);
    
    this.isLocked = ko.computed(function() {
        return this.isDeleting() || app.model.serviceAddresses.state.isLocked();
    }, this);
    
    this.isNew = ko.pureComputed(function() {
        var add = this.address();
        return !add || !add.updatedDate();
    }, this);

    this.submitText = ko.pureComputed(function() {
        var v = this.addressVersion();
        return (
            this.isLoading() ? 
                'Loading...' : 
                this.isSaving() ? 
                    'Saving changes' : 
                    v && v.areDifferent() ?
                        'Save changes' :
                        'Saved'
        );
    }, this);

    this.unsavedChanges = ko.pureComputed(function() {
        var v = this.addressVersion();
        return v && v.areDifferent();
    }, this);
    
    this.deleteText = ko.pureComputed(function() {
        return (
            this.isDeleting() ? 
                'Deleting...' : 
                'Delete'
        );
    }, this);

    this.save = function() {

        app.model.serviceAddresses.setItem(this.address().model.toPlainObject())
        .then(function(serverData) {
            // Update version with server data.
            this.address().model.updateWith(serverData);
            // Push version so it appears as saved
            this.addressVersion().push({ evenIfObsolete: true });
            
            // Special save, function provided by the activity on set-up
            this.onSave(serverData.addressID);
        }.bind(this))
        .catch(function(err) {
            app.modals.showError({
                title: 'There was an error while saving.',
                error: err
            });
        });

    }.bind(this);
    
    this.confirmRemoval = function() {
        app.modals.confirm({
            title: 'Delete location',
            message: 'Are you sure? The operation cannot be undone.',
            yes: 'Delete',
            no: 'Keep'
        })
        .then(function() {
            this.remove();
        }.bind(this));
    }.bind(this);

    this.remove = function() {

        app.model.serviceAddresses.delItem(this.jobTitleID(), this.addressID())
        .then(function() {
            this.wasRemoved(true);
            // Go out the deleted location
            app.shell.goBack();
        }.bind(this))
        .catch(function(err) {
            app.modals.showError({
                title: 'There was an error while deleting.',
                error: err
            });
        });
    }.bind(this);
    
    /**
        Typed value binding rather than html binding allow to avoid
        problems because the data in html are string values while
        the actual data from the model is a number.
        Cause problems on some edge cases matching values and with
        detection of changes in the data (because the binding coming from the
        control assigning a string to the value).
    **/
    this.serviceRadiusOptions = ko.observableArray([
        { value: 0.5, label: '0.5 miles' },
        { value: 1.0, label: '1 mile' },
        { value: 2.0, label: '2 miles' },
        { value: 3.0, label: '3 miles' },
        { value: 4.0, label: '4 miles' },
        { value: 5.0, label: '5 miles' },
        { value: 10, label: '10 miles' },
        { value: 25, label: '25 miles' },
        { value: 50, label: '50 miles' },
    ]);
}

},{"../components/Activity":90,"../models/Address":95,"knockout":false}],11:[function(require,module,exports){
/** Calendar activity **/
'use strict';

var $ = require('jquery'),
    moment = require('moment'),
    Appointment = require('../models/Appointment'),
    ko = require('knockout'),
    getDateWithoutTime = require('../utils/getDateWithoutTime');

require('../components/DatePicker');

var Activity = require('../components/Activity');

var A = Activity.extends(function AppointmentActivity() {
    
    Activity.apply(this, arguments);

    this.accessLevel = this.app.UserType.serviceProfessional;    
    this.menuItem = 'calendar';
    
    this.$appointmentView = this.$activity.find('#calendarAppointmentView');
    this.$chooseNew = $('#calendarChooseNew');
    
    this.viewModel = new ViewModel(this.app);
    
    // Create default leftAction/backAction settings
    // later used to instantiate a new NavAction that will
    // dynamically change depending on viewModel data.
    var backActionSettings = {
        link: 'calendar/', // Preserve last slash, for later use
        icon: Activity.NavAction.goBack.icon(),
        isTitle: true,
        text: 'Calendar'
    };
    this.navBar = new Activity.NavBar({
        title: '',
        leftAction: new Activity.NavAction(backActionSettings),
        rightAction: Activity.NavAction.goHelpIndex
    });

    // NavBar must update depending on editMode state (to allow cancel and goBack)
    // and appointment date (on read-only, to go back to calendar on current date)
    ko.computed(function() {
        var editMode = this.viewModel.editMode(),
            isNew = this.viewModel.appointmentCardView() && this.viewModel.appointmentCardView().isNew(),
            date = this.viewModel.currentDate();

        if (editMode) {
            // Is cancel action
            
            if (isNew) {
                // Common way of keep a cancel button on navbar
                var cancelLink = this.viewModel.appointmentCardView();
                cancelLink = cancelLink && cancelLink.progress && cancelLink.progress.cancelLink;

                this.convertToCancelAction(this.navBar.leftAction(), cancelLink || this.requestData.cancelLink);
            }
            else {
                // Use the viewmodel cancelation with confirm, so avoid redirects (and all
                // its problems, as redirects to the sub-edition pages -for example, datetimePicker)
                // and avoid reload, just change current state and keeps in read-only mode
                this.navBar.leftAction().model.updateWith({
                    link: null,
                    text: 'cancel',
                    handler: this.viewModel.appointmentCardView().confirmCancel.bind(this)
                });
            }
        }
        else {
            // Is go to calendar/date action
            var defLink = backActionSettings.link,
                defBackText = backActionSettings.text;
            
            var link = date ? defLink + date.toISOString() : defLink;
            var text = date ? moment(date).format('dddd [(]M/D[)]') : defBackText;
            
            this.navBar.leftAction().model.updateWith($.extend({}, backActionSettings, {
                link: link,
                text: text,
                handler: null
            }));
        }

    }, this);

    
    // On changing the current appointment:
    // - Update URL to match the appointment currently showed
    // - Attach handlers to ID and StartTime so we load data for the new
    //   date when it changes (ID changes on create a booking, StartTime on
    //   edition).
    this.registerHandler({
        target: this.viewModel.currentAppointment,
        handler: function (apt) {
            if (!apt)
                return;

            if ((apt.id() === Appointment.specialIds.newBooking ||
                apt.id() === Appointment.specialIds.newEvent) &&
                !apt.__idDateHandlersAttached) {
                apt.__idDateHandlersAttached = true;
                var prevID = apt.id();
                // With explicit subscribe and not a computed because we
                // must avoid the first time execution (creates an infinite loop)
                apt.id.subscribe(function relocateList() {
                    var id = apt.id();
    
                    if (prevID > 0 || id <= 0) return;
                    prevID = id;
                    this.viewModel.setCurrent(null, id)
                    .then(function() {
                        this.viewModel.updateUrl();
                    }.bind(this));
                }.bind(this));
            }
            
        }.bind(this)._delayed(10)
        // IMPORTANT: delayed REQUIRED to avoid triple loading (activity.show) on first load triggered by a click event.
    });
});

exports.init = A.init;

A.prototype.show = function show(options) {
    /* jshint maxcomplexity:10 */
    Activity.prototype.show.call(this, options);
    
    // Prepare cancelLink, before any attempt of internal URL rewriting
    if (!this.requestData.cancelLink) {
        var referrer = this.app.shell.referrerRoute;
        referrer = referrer && referrer.url;
        // Avoid links to this same page at 'new booking' or 'new event' state
        // to prevent infinite loops
        //referrer && referrer.replace(/\/?appointment\//i, 'calendar/');
        var reg = /\/?appointment\/([^\/]*)\/((\-3)|(\-4))/i;
        if (referrer && reg.test(referrer)) {
            referrer.replace(reg, '/appointment/$1/');
        }
        
        this.requestData.cancelLink = referrer;
    }
    
    var s1 = options && options.route && options.route.segments[0],
        s2 = options && options.route && options.route.segments[1],
        s3 = options && options.route && options.route.segments[2],
        date,
        datetime,
        id,
        type;

    var isNumber = /^\-?\d+$/;
    if (isNumber.test(s1)) {
        // first parameter is an ID
        id = s1 |0;
        type = s2;
    }
    else {
        date = getDateWithoutTime(s1);
        datetime = s1 && new Date(s1) || date;
        id = s2 |0;
        type = s3;
    }
    
    var setupCard = function() {
        // The card component needs to be updated on load
        // with any option passed to the activity since the component
        // is able to to interact with other activities it has requested
        // (to request information edition)
        var cardApi = this.viewModel.appointmentCardView();
        if (cardApi) {
            // Preset the startTime to the one given by the requestData URL parameters
            // when not in an existent appointment, just because:
            // - On a new booking we can preset the date in the 'select date-time' step
            // - On a new event we can preset the date and time in the card
            // - On the other special cards, its allows to pass the datetime to the links
            //   for creation of a new booking/event.
            if (this.viewModel.appointmentCardView().currentID() <= 0) {
                this.viewModel.appointmentCardView().item().startTime(datetime);
            }

            cardApi.passIn(this.requestData);
        }
        else {
            // The first time may happen that the binding is not ready, no cardApi available
            // but we need it, attempt again in short so card is ready:
            setTimeout(setupCard, 80);
        }
    }.bind(this);

    this.viewModel.setCurrent(date, id, type)
    .then(setupCard);
};

var Appointment = require('../models/Appointment');

function findAppointmentInList(list, id) {
    var found = null,
        index = -1;
    list.some(function(apt, i) {
        if (apt.id() === id) {
            found = apt;
            index = i;
            return true;
        }
    });
    return {
        item: found,
        index: index
    };
}

var CalendarEvent = require('../models/CalendarEvent'),
    Booking = require('../models/Booking');

function ViewModel(app) {
    this.app = app;
    this.currentDate = ko.observable(new Date());
    this.currentID = ko.observable(0);
    this.currentIndex = ko.observable(0);
    this.editMode = ko.observable(false);
    this.isLoading = ko.observable(false);
    
    this.dateAvailability = ko.observable();
    this.appointments = ko.pureComputed(function() {
        var dateAvail = this.dateAvailability();
        return dateAvail && dateAvail.appointmentsList() || [];            
    }, this);
    
    // To access the component API we use next observable,
    // updated by the component with its view
    this.appointmentCardView = ko.observable(null);

    var loadingAppointment = new Appointment({
        id: Appointment.specialIds.loading,
        summary: 'Loading...'
    });
    var newEmptyDateAppointment = function newEmptyDateAppointment() {
        return new Appointment({
            id: Appointment.specialIds.emptyDate,
            summary: 'You have nothing scheduled',
            startTime: this.currentDate(),
            endTime: moment(this.currentDate()).add(1, 'days').toDate()
        });
    }.bind(this);
    var newUnavailableAppointment = function newUnavailableAppointment() {
        return new Appointment({
            id: Appointment.specialIds.unavailable,
            summary: 'You`re unavailable all day',
            startTime: this.currentDate(),
            endTime: moment(this.currentDate()).add(1, 'days').toDate()
        });
    }.bind(this);
    var newFreeAppointment = function newFreeAppointment() {
        return new Appointment({
            id: Appointment.specialIds.free,
            summary: 'Free',
            startTime: this.currentDate(),
            endTime: moment(this.currentDate()).add(1, 'days').toDate()
        });
    }.bind(this);
    var newEventAppointment = function newEventAppointment() {
        return new Appointment({
            id: Appointment.specialIds.newEvent,
            summary: 'New event...',
            sourceEvent: new CalendarEvent()
        });
    };
    var newBookingAppointment = function newBookingAppointment() {
        return new Appointment({
            id: Appointment.specialIds.newBooking,
            summary: 'New booking...',
            sourceEvent: new CalendarEvent(),
            sourceBooking: new Booking()
        });
    };
    
    this.currentAppointment = ko.observable(loadingAppointment);

    this.updateUrl = function updateUrl() {
        // Update URL to match the appointment ID and
        // track it state
        // Get ID from URL, to avoid do anything if the same.
        var apt = this.currentAppointment(),
            aptId = apt.id(),
            found = /appointment\/([^\/]+)\/(\-?\d+)/i.exec(window.location),
            urlId = found && found[2] |0,
            urlDate = found && found[1],
            curDateStr = getDateWithoutTime(apt.startTime()).toISOString();

        if (!found ||
            urlId !== aptId.toString() ||
            urlDate !== curDateStr) {
            
            var url = 'appointment/' + curDateStr + '/' + aptId;

            // If was an incomplete URL, just replace current state
            if (urlId === '')
                this.app.shell.replaceState(null, null, url);
            else
                this.app.shell.pushState(null, null, url);
        }
    };

    this.goPrevious = function goPrevious() {
        if (this.editMode()) return;

        var index = this.currentIndex() - 1;

        if (index < 0) {
            // Go previous date
            var m = moment(this.currentDate());
            if (!m.isValid()) {
                m = moment(new Date());
            }
            var prevDate = m.subtract(1, 'days').toDate();
            this.setCurrent(prevDate)
            .then(function() {
                this.updateUrl();
            }.bind(this));
        }
        else {
            // Go previous item in the list, by changing currentID
            index = index % this.appointments().length;
            var apt = this.appointments()[index];
            this.currentIndex(index);
            this.currentID(apt.id());
            this.currentAppointment(apt);
            this.updateUrl();
            // Complete load-double check: this.setCurrent(apt.startTime(), apt.id());
        }
    };

    this.goNext = function goNext() {
        if (this.editMode()) return;
        var index = this.currentIndex() + 1;

        if (index >= this.appointments().length) {
            // Go next date
            var m = moment(this.currentDate());
            if (!m.isValid()) {
                m = moment(new Date());
            }
            var nextDate = m.add(1, 'days').toDate();
            this.setCurrent(nextDate)
            .then(function() {
                this.updateUrl();
            }.bind(this));
        }
        else {
            // Go next item in the list, by changing currentID
            index = index % this.appointments().length;
            var apt = this.appointments()[index];
            this.currentIndex(index);
            this.currentID(apt.id());
            this.currentAppointment(apt);
            this.updateUrl();
            // Complete load-double check: this.setCurrent(apt.startTime(), apt.id());
        }
    };

    /**
        Changing the current viewed data by date and id
    **/

    this.getSpecialItem = function (id) {
        switch (id) {
            default:
            //case -1:
                return newEmptyDateAppointment();
            case Appointment.specialIds.free:
                return newFreeAppointment();
            case Appointment.specialIds.newEvent:
                return newEventAppointment();
            case Appointment.specialIds.newBooking:
                return newBookingAppointment();
            case Appointment.specialIds.loading:
                return loadingAppointment;
            case Appointment.specialIds.unavailable:
                return newUnavailableAppointment();
        }
    };
    this.setItemFromCurrentList = function (id) {
        /*jshint maxdepth:6,maxcomplexity:8*/
        var list = this.appointments(),
            index,
            item;

        // First, respect special IDs, except the 'no appts':
        if (id < -1) {
            item = this.getSpecialItem(id);
            index = -1;
        }
        else if (list.length === 0) {
            // No item ID, empty list:
            index = -1;
            // Show as empty or full-unavailable:
            if (this.dateAvailability().workDayMinutes() === 0)
                item = newUnavailableAppointment();
            else
                item = newEmptyDateAppointment();
        }
        else {
            // Start getting the first item in the list
            item = list[0];
            index = 0;
            
            // With any ID value
            if (id) {
                // Search the ID
                if (id > 0) {
                    // search item in cached list
                    var found = findAppointmentInList(list, id);

                    if (found.item) {
                        item = found.item;
                        index = found.index;
                    }
                    // Else, the first item will be used
                }
                else {
                    item = this.getSpecialItem(id);
                    index = -1;
                }
            }   
        }

        this.currentID(item.id());
        this.currentIndex(index);
        this.currentAppointment(item);
    };
    
    var _setCurrent = function setCurrent(date, id, type) {
        //jshint maxcomplexity:8
        // IMPORTANT: the date to use must be ever
        // a new object rather than the referenced one to
        // avoid some edge cases where the same object is mutated
        // and comparisions can fail. 
        // getDateWithoutTime ensure to create a new instance ever.
        date = date && getDateWithoutTime(date) || null;
        if (date)
            this.currentDate(date);
        
        if (!date) {
            if (id > 0) {
                // remote search for id
                this.isLoading(true);

                var notFound = function notFound() {
                    this.isLoading(false);
                    return _setCurrent(new Date());
                }.bind(this);

                var ids = {};
                if (type === 'booking')
                    ids.bookingID = id;
                else
                    ids.calendarEventID = id;
                
                return app.model.calendar.getAppointment(ids)
                .then(function (item) {
                    if (item) {
                        // Force a load for the item date.
                        var itDate = getDateWithoutTime(item.startTime());
                        this.isLoading(false);
                        return _setCurrent(itDate, item.id());
                    }
                    else {
                        return notFound();
                    }
                }.bind(this))
                .catch(notFound);
            }
            else if (id < 0) {
                // Special IDs
                return _setCurrent(new Date(), id);
            }
            else {
                // No date, no ID, load today
                return _setCurrent(new Date());
            }
        }
        else {
            this.isLoading(true);
            return app.model.calendar.getDateAvailability(date)
            .then(function (dateAvail) {
                this.isLoading(false);
                this.dateAvailability(dateAvail);
                this.setItemFromCurrentList(id);
            }.bind(this))
            .catch(function(err) {

                this.isLoading(false);

                var msg = 'Error loading calendar events.';
                app.modals.showError({
                    title: msg,
                    error: err && err.error || err
                });

            }.bind(this));
        }
    }.bind(this);

    var promiseSetCurrent = Promise.resolve();
    this.setCurrent = function setCurrent(date, id, type) {
        // NOTE: Do nothing if is already in loading process
        // TODO: review if is better to cancel current and continue or
        // just the current queue for when it's finish.
        // If set as 'allow concurrent'
        // the isLoading may be not enough to control the several loadings
        promiseSetCurrent = promiseSetCurrent.then(function() {
            return _setCurrent(date, id, type);
        });
        return promiseSetCurrent;
    };
}

},{"../components/Activity":90,"../components/DatePicker":91,"../models/Appointment":96,"../models/Booking":97,"../models/CalendarEvent":99,"../utils/getDateWithoutTime":157,"knockout":false,"moment":false}],12:[function(require,module,exports){
/**
    backgroundCheck activity
**/
'use strict';

var ko = require('knockout'),
    Activity = require('../components/Activity');

var A = Activity.extends(function BackgroundCheckActivity() {

    Activity.apply(this, arguments);

    this.accessLevel = this.app.UserType.loggedUser;
    this.viewModel = new ViewModel(this.app);
    // Defaults settings for navBar.
    this.navBar = Activity.createSubsectionNavBar('Marketplace Profile', {
        backLink: '/marketplaceProfile'
    });
});

exports.init = A.init;

A.prototype.show = function show(options) {
    Activity.prototype.show.call(this, options);
    
};

function ViewModel(/*app*/) {
    
    //this.isSyncing = app.model.backgroundCheck.state.isSyncing;
    this.isSyncing = ko.observable(false);
    this.isLoading = ko.observable(false);
    this.isSaving = ko.observable(false);
    
    this.list = ko.observableArray(testdata());
}


// IMPORTANT Background Check uses verification statuses
var Verification = function() {};
Verification.status = {
    confirmed: 1,
    pending: 2,
    revoked: 3,
    obsolete: 4
};

function testdata() {
    
    var verA = new BackgroundCheck({
            name: 'Database Search'
        }),
        verB = new BackgroundCheck({
            name: 'Basic Criminal'
        }),
        verC = new BackgroundCheck({
            name: 'Risk Adverse'
        }),
        verD = new BackgroundCheck({
            name: 'Healthcare Check'
        });

    return [
        new UserBackgroundCheck({
            statusID: Verification.status.confirmed,
            lastVerifiedDate: new Date(2015, 1, 12, 10, 23, 32),
            backgroundCheck: verA
        }),
        new UserBackgroundCheck({
            statusID: Verification.status.revoked,
            lastVerifiedDate: new Date(2015, 5, 20, 16, 4, 0),
            backgroundCheck: verB
        }),
        new UserBackgroundCheck({
            statusID: Verification.status.pending,
            lastVerifiedDate: new Date(2014, 11, 30, 19, 54, 4),
            backgroundCheck: verC
        }),
        new UserBackgroundCheck({
            statusID: Verification.status.obsolete,
            lastVerifiedDate: new Date(2014, 11, 30, 19, 54, 4),
            backgroundCheck: verD
        })
    ];
}


var Model = require('../models/Model');
// TODO Incomplete Model for UI mockup
function UserBackgroundCheck(values) {
    Model(this);
    
    this.model.defProperties({
        statusID: 0,
        lastVerifiedDate: null,
        backgroundCheck: {
            Model: BackgroundCheck
        }
    }, values);
    
    // Same as in UserVerifications
    this.statusText = ko.pureComputed(function() {
        // L18N
        var statusTextsenUS = {
            'verification.status.confirmed': 'Confirmed',
            'verification.status.pending': 'Pending',
            'verification.status.revoked': 'Revoked',
            'verification.status.obsolete': 'Obsolete'
        };
        var statusCode = enumGetName(this.statusID(), Verification.status);
        return statusTextsenUS['verification.status.' + statusCode];
    }, this);
    
    /**
        Check if verification has a given status by name
    **/
    this.isStatus = function (statusName) {
        var id = this.statusID();
        return Verification.status[statusName] === id;
    }.bind(this);
}
function BackgroundCheck(values) {
    Model(this);
    
    this.model.defProperties({
        name: ''
    }, values);
}

// Become shared util; it is on Verifications too:
function enumGetName(value, enumList) {
    var found = null;
    Object.keys(enumList).some(function(k) {
        if (enumList[k] === value) {
            found = k;
            return true;
        }
    });
    return found;
}
                               
},{"../components/Activity":90,"../models/Model":113,"knockout":false}],13:[function(require,module,exports){
/**
    BookMeButton activity
**/
'use strict';

var Activity = require('../components/Activity');
var ko = require('knockout'),
    $ = require('jquery');

var A = Activity.extends(function BookMeButtonActivity() {
    
    Activity.apply(this, arguments);
    
    this.viewModel = new ViewModel(this.app);
    this.accessLevel = this.app.UserType.serviceProfessional;

    this.navBar = Activity.createSubsectionNavBar('Scheduling');
    
    // Auto select text on textarea, for better 'copy'
    // NOTE: the 'select' must happen on click, no touch, not focus,
    // only 'click' is reliable and bug-free.
    this.registerHandler({
        target: this.$activity,
        event: 'click',
        selector: 'textarea',
        handler: function() {
            $(this).select();
        }
    });
    
    this.registerHandler({
        target: this.app.model.marketplaceProfile,
        event: 'error',
        handler: function(err) {
            if (err && err.task === 'save') return;
            var msg = 'Error loading data to build the Button.';
            this.app.modals.showError({
                title: msg,
                error: err && err.task && err.error || err
            });
        }.bind(this)
    });
});

exports.init = A.init;

A.prototype.show = function show(state) {
    Activity.prototype.show.call(this, state);
    
    // Keep data updated:
    this.app.model.marketplaceProfile.sync();
    
    // Set the job title
    var jobID = state.route.segments[0] |0;
    this.viewModel.jobTitleID(jobID);
};

function ViewModel(app) {

    var marketplaceProfile = app.model.marketplaceProfile;
    
    // Actual data for the form:
    
    // Read-only bookCode
    this.bookCode = ko.computed(function() {
        return marketplaceProfile.data.bookCode();
    });
    
    this.jobTitleID = ko.observable(0);
    
    // Button type, can be: 'small', 'medium', 'large', 'link'
    this.type = ko.observable('medium');

    this.isLocked = marketplaceProfile.isLocked;
    
    // Generation of the button code
    
    var buttonTemplate =
        '<!-- begin Loconomics book-me-button -->' +
        '<a style="display:inline-block"><img alt="" style="border:none" /></a>' + 
        '<!-- end Loconomics book-me-button -->';
    
    var linkTemplate =
        '<!-- begin Loconomics book-me-button -->' +
        '<a><span></span></a>' +
        '<!-- end Loconomics book-me-button -->';

    this.buttonHtmlCode = ko.pureComputed(function() {
        
        if (marketplaceProfile.isLoading()) {
            return 'loading...';
        }
        else {
            var type = this.type(),
                tpl = buttonTemplate;

            if (type === 'link')
                tpl = linkTemplate;

            var siteUrl = $('html').attr('data-site-url'),
                linkUrl = siteUrl + '/book/' + this.bookCode() + '/' + this.jobTitleID() + '/',
                imgUrl = siteUrl + '/img/extern/book-me-button-' + type + '.png';

            var code = generateButtonCode({
                tpl: tpl,
                label: 'Click here to book me now (on loconomics.com)',
                linkUrl: linkUrl,
                imgUrl: imgUrl
            });

            return code;
        }
    }, this);
    
    // TODO Copy feature; will need a native plugin
    this.copyCode = function() { };
    
    this.sendByEmail = function() {
        // TODO Send by email, with window.open('mailto:&body=code');
    };
}

function generateButtonCode(options) {

    var $btn = $($.parseHTML('<div>' + options.tpl + '</div>'));

    $btn
    .find('a')
    .attr('href', options.linkUrl)
    .find('span')
    .text(options.label);
    $btn
    .find('img')
    .attr('src', options.imgUrl)
    .attr('alt', options.label);

    return $btn.html();
}

},{"../components/Activity":90,"knockout":false}],14:[function(require,module,exports){
/**
    Booking activity
    
    It allows a client to book a serviceProfessional
**/
'use strict';

var Activity = require('../components/Activity'),
    ko = require('knockout');

var A = Activity.extends(function BookingActivity() {

    Activity.apply(this, arguments);

    this.accessLevel = this.app.UserType.loggedUser;
    this.viewModel = new ViewModel(this.app);
    this.navBar = Activity.createSectionNavBar('Booking');
    
    // Only on change (not first time), when choosed the option 'custom'
    // from gratuity, focus the textbox to input the custom value
    this.viewModel.presetGratuity.subscribe(function(preset) {
        if (preset === 'custom') {
            // Small delay to allow the binding to display the custom field,
            // the UI to update, and then focus it; trying to do it without
            // timeout will do nothing.
            setTimeout(function() {
                this.$activity.find('[name=custom-gratuity]').focus();
            }.bind(this), 50);
        }
    }.bind(this));
    
    this.registerHandler({
        target: this.viewModel.progress.step,
        handler: function() {
            // Trigger load of the specific step
            var load = this[this.viewModel.progress.currentStep() + 'Load'];
            if (load)
                load.call(this);
        }.bind(this)
    });

});

exports.init = A.init;

A.prototype.show = function show(state) {
    Activity.prototype.show.call(this, state);

    var params = state && state.route && state.route.segments;
    
    this.viewModel.serviceProfessionalID(params[0] |0);
    this.viewModel.jobTitleID(params[1] |0);
    
    // If there is not a serviceProfessional, redirect to search/home page to pick one
    // TODO Same if the serviceProfessional is not found
    if (this.viewModel.serviceProfessionalID() === 0 ||
        this.viewModel.jobTitleID() === 0) {
        this.app.shell.go('/home');
        return;
    }
    
    // Reset progress to none and trigger next so Load logic gets executed
    this.viewModel.progress.step(-1);
    this.viewModel.nextStep();
};

///
/// Registered static list of steps. There are different possible lists depending
/// on provider settings

var bookingRequestSteps = [
    'services',
    'selectLocation',
    'selectTimes',
    'payment',
    'confirm'
];
var instantBookingSteps = [
    'services',
    'selectLocation',
    'selectTime', // <- This is different
    'payment',
    'confirm'
];

// L18N
var stepsLabels = {
    services: 'Services',
    selectLocation: 'Select a location',
    selectTimes: 'Select preferred times',
    selectTime: 'Select the time',
    payment: 'Payment',
    confirm: 'Confirm'
};

///
/// Methods that initialize/load each step, given the name of registered steps
/// and sufix 'Load'

A.prototype.servicesLoad = function() {
    // TODO Depends on jobTitle:
    this.viewModel.supportGratuity(true);    
};

A.prototype.selectLocationLoad = function() {
    // TODO Load remote addresses for provider and jobtitle
    this.viewModel.serviceAddresses.sourceAddresses([]);
    // TEST
    this.app.model.serviceAddresses.getList(this.viewModel.jobTitleID())
    .then(function(list) {
        list = this.app.model.serviceAddresses.asModel(list);
        this.viewModel.serviceAddresses.sourceAddresses(list);
    }.bind(this));
};

A.prototype.selectTimesLoad = function() {
    // TODO 
};

A.prototype.selectTimeLoad = function() {
    // TODO 
};

A.prototype.paymentLoad = function() {
    // TODO 
};

A.prototype.confirmLoad = function() {
    // TODO 
};


var Model = require('../Models/Model');
var numeral = require('numeral');

var PricingSummaryDetail = require('../Models/PricingSummaryDetail');
// NOTE Right now the viewmodel for details is equal to the original mode
/* TODO Review if the pricingSummary viewmodels can be removed, mixed with original
    models and moved to viewmodel/ */
var PricingSummaryItemVM = PricingSummaryDetail;

PricingSummaryItemVM.fromServiceProfessionalService = function(service) {
    // TODO Support special hourly pricings, housekeeper, etc.
    var allSessionMinutes = service.numberOfSessions () > 0 ?
        service.serviceDurationMinutes() * service.numberOfSessions() :
        service.serviceDurationMinutes();

    return new PricingSummaryItemVM({
        serviceName: service.name(),
        serviceDescription: service.description(),
        numberOfSessions: service.numberOfSessions(),
        serviceDurationMinutes: allSessionMinutes,
        firstSessionDurationMinutes: service.serviceDurationMinutes(),
        price: service.price(),
        serviceProfessionalServiceID: service.serviceProfessionalServiceID(),
        hourlyPrice: (service.priceRateUnit() || '').toUpperCase() === 'HOUR' ? service.priceRate() : null
    });
};



var ServiceProfessionalServiceVM = require('../viewmodels/ServiceProfessionalService'),
    BookingProgress = require('../viewmodels/BookingProgress'),
    ServiceAddresses = require('../viewmodels/ServiceAddresses'),
    PublicUser = require('../models/PublicUser');

function ViewModel(app) {
    //jshint maxstatements:40
    
    this.serviceAddresses = new ServiceAddresses();
    
    this.serviceProfessionalID = ko.observable(0);
    this.jobTitleID = ko.observable(0);
    this.instantBooking = ko.observable(true);
    this.isLocked = ko.observable(false);
    this.bookingHeader = ko.pureComputed(function() {
        return this.instantBooking() ? 'Your instant booking' : 'Your booking request';
    }, this);
    
    // Se inicializa con un estado previo al primer paso
    // (necesario para el manejo de reset y preparación del activity)
    this.progress = new BookingProgress({ step: -1 });
    
    ko.computed(function() {
        this.progress.stepsList(this.instantBooking() ? instantBookingSteps : bookingRequestSteps);
    }, this);
    
    this.serviceProfessionalServices = new ServiceProfessionalServiceVM(app);
    this.jobTitleID.subscribe(this.serviceProfessionalServices.jobTitleID);
    this.serviceProfessionalID.subscribe(this.serviceProfessionalServices.serviceProfessionalID);
    this.serviceProfessionalServices.isSelectionMode(true);
    //this.serviceProfessionalServices.preSelectedServices([]);
    
    this.supportGratuity = ko.observable(false);
    this.customGratuity = ko.observable(0);
    this.presetGratuity = ko.observable(0);
    this.gratuityAmount = ko.observable(0);
    this.gratuityPercentage = ko.pureComputed(function() {
        var preset = this.presetGratuity();
        if (preset === 'custom')
            return 0;
        else
            return preset;
    }, this);

    this.summary = new PricingSummaryVM();
    // Automatic summary updates:
    this.gratuityPercentage.subscribe(this.summary.gratuityPercentage);
    this.gratuityAmount.subscribe(this.summary.gratuityAmount);
    ko.computed(function() {
        var services = this.serviceProfessionalServices.selectedServices();
        this.summary.services(services.map(function(service) {
            return PricingSummaryItemVM.fromServiceProfessionalService(service);
        }));
    }, this);
    
    this.makeRepeatBooking = ko.observable(false);
    this.promotionalCode = ko.observable('');
    
    this.nextStep = function() {
        this.progress.next();
    };
    
    this.goStep = function(stepName) {
        var i = this.progress.stepsList().indexOf(stepName);
        this.progress.step(i > -1 ? i : 0);
    };

    this.getStepLabel = function(stepName) {
        return stepsLabels[stepName] || stepName;
    };
    
    this.save = function() {
        // TODO Final step, confirm and save booking
    };
    
    this.serviceProfessionalInfo = ko.observable(null);
    this.isLoadingServiceProfessionalInfo = ko.observable(false);
    this.serviceProfessionalID.subscribe(function(userID) {
        this.isLoadingServiceProfessionalInfo(true);
        app.model.users.getUser(userID)
        .then(function(info) {
            info = new PublicUser(info);
            info.selectedJobTitleID(this.jobTitleID());
            this.serviceProfessionalInfo(info);
            this.isLoadingServiceProfessionalInfo(false);
        }.bind(this))
        .catch(function(err) {
            this.isLoadingServiceProfessionalInfo(false);
            app.modals.showError({ error: err });
        }.bind(this));
    }, this);

    this.isLoading = ko.pureComputed(function() {
        return (
            this.isLoadingServiceProfessionalInfo() ||
            this.serviceProfessionalServices.isLoading()
        );
    }, this);
}

function PricingSummaryVM(values) {

    Model(this);

    this.model.defProperties({
        services: {
            isArray: true,
            Model: PricingSummaryItemVM
        },
        gratuityPercentage: 0,
        gratuityAmount: 0,
        feesPercentage: 10
    }, values);

    this.subtotalPrice = ko.pureComputed(function() {
        return this.services().reduce(function(total, item) {
            total += item.price();
            return total;
        }, 0);
    }, this);
    
    this.fees = ko.pureComputed(function() {
        var t = this.subtotalPrice(),
            f = this.feesPercentage();
        return t * (f / 100);
    }, this);
    
    this.gratuity = ko.pureComputed(function() {
        var percentage = this.gratuityPercentage() |0,
            amount = this.gratuityAmount() |0;
        return (
            percentage > 0 ?
                (this.subtotalPrice() * (percentage / 100)) :
                amount < 0 ? 0 : amount
        );
    }, this);

    this.totalPrice = ko.pureComputed(function() {
        return this.subtotalPrice() + this.fees() + this.gratuity();
    }, this);
    
    this.feesMessage = ko.pureComputed(function() {
        var f = numeral(this.fees()).format('$#,##0.00');
        return '*includes a __fees__ first-time booking fee'.replace(/__fees__/g, f);
    }, this);

    this.items = ko.pureComputed(function() {

        var items = this.services().slice();
        var gratuity = this.gratuity();

        if (gratuity > 0) {
            var gratuityLabel = this.gratuityPercentage() ?
                'Gratuity (__gratuity__%)'.replace(/__gratuity__/g, (this.gratuityPercentage() |0)) :
                'Gratuity';

            items.push(new PricingSummaryItemVM({
                serviceName: gratuityLabel,
                price: this.gratuity()
            }));
        }

        return items;
    }, this);
    
    this.serviceDurationMinutes = ko.pureComputed(function() {
        return this.services().reduce(function(total, item) {
            total += item.serviceDurationMinutes();
            return total;
        }, 0);
    }, this);
    
    this.firstSessionDurationMinutes = ko.pureComputed(function() {
        return this.services().reduce(function(total, item) {
            total += item.firstSessionDurationMinutes();
            return total;
        }, 0);
    }, this);
    
    var duration2Language = require('../utils/duration2Language');
    
    this.serviceDurationDisplay = ko.pureComputed(function() {
        return duration2Language({ minutes: this.serviceDurationMinutes() });
    }, this);
    
    this.firstSessionDurationDisplay = ko.pureComputed(function() {
        return duration2Language({ minutes: this.firstSessionDurationMinutes() });
    }, this);
}

},{"../Models/Model":6,"../Models/PricingSummaryDetail":7,"../components/Activity":90,"../models/PublicUser":119,"../utils/duration2Language":154,"../viewmodels/BookingProgress":177,"../viewmodels/ServiceAddresses":182,"../viewmodels/ServiceProfessionalService":184,"knockout":false,"numeral":false}],15:[function(require,module,exports){
/** Calendar activity **/
'use strict';

var $ = require('jquery'),
    moment = require('moment'),
    ko = require('knockout'),
    getDateWithoutTime = require('../utils/getDateWithoutTime');

require('../components/DatePicker');
var datepickerAvailability = require('../utils/datepickerAvailability');

var Activity = require('../components/Activity');

var A = Activity.extends(function CalendarActivity() {
    
    Activity.apply(this, arguments);

    this.accessLevel = this.app.UserType.loggedUser;
    this.viewModel = new ViewModel(this.app);
    this.navBar = Activity.createSectionNavBar('Calendar');

    /* Getting elements */
    this.$datepicker = this.$activity.find('#calendarDatePicker');
    this.$dailyView = this.$activity.find('#calendarDailyView');
    this.$dateTitle = this.$activity.find('.CalendarDateHeader > .btn');
    this.$chooseNew = $('#calendarChooseNew');
    
    /* Init components */
    this.$datepicker.show().datepicker({ extraClasses: 'DatePicker--tagged' });
    
    this.tagAvailability = datepickerAvailability.create(this.app, this.$datepicker, this.viewModel.isLoading);

    /* Event handlers */
    // Changes on currentDate
    this.registerHandler({
        target: this.viewModel.currentDate,
        handler: function(date) {

            if (date) {
                var mdate = moment(date);

                if (mdate.isValid()) {

                    var isoDate = mdate.toISOString();

                    // Update datepicker selected date on date change (from 
                    // a different source than the datepicker itself
                    this.$datepicker.removeClass('is-visible');
                    // Change not from the widget?
                    if (this.$datepicker.datepicker('getValue').toISOString() !== isoDate)
                        this.$datepicker.datepicker('setValue', date, true);

                    // On currentDate changes, update the URL
                    // TODO: save a useful state
                    // DOUBT: push or replace state? (more history entries or the same?)
                    this.app.shell.pushState(null, null, 'calendar/' + isoDate);

                    // DONE
                    return;
                }
            }

            // Something fail, bad date or not date at all
            // Set the current 
            this.viewModel.currentDate(getDateWithoutTime());

        }.bind(this)
    });

    // Swipe date on gesture
    this.registerHandler({
        target: this.$dailyView,
        event: 'swipeleft swiperight',
        handler: function(e) {
            e.preventDefault();

            var dir = e.type === 'swipeleft' ? 'next' : 'prev';

            // Hack to solve the freezy-swipe and tap-after bug on JQM:
            $(document).trigger('touchend');
            // Change date
            this.$datepicker.datepicker('moveValue', dir, 'date');

        }.bind(this)
    });

    // Showing datepicker when pressing the title
    this.registerHandler({
        target: this.$dateTitle,
        event: 'click',
        handler: function(e) {
            this.$datepicker.toggleClass('is-visible');
            e.preventDefault();
            e.stopPropagation();
        }.bind(this)
    });

    // Updating view date when picked another one
    this.registerHandler({
        target: this.$datepicker,
        event: 'dateChanged',
        handler: function(e) {
            if (e.viewMode === 'days') {
                this.viewModel.currentDate(getDateWithoutTime(e.date));
            }
        }.bind(this)
    });

    // Set date to today
    this.viewModel.currentDate(getDateWithoutTime());
});

exports.init = A.init;

A.prototype.show = function show(options) {
    Activity.prototype.show.call(this, options);

    // Date from the parameter, fallback to today
    var sdate = options.route && options.route.segments && options.route.segments[0],
        date;
    if (sdate) {
        // Parsing date from ISO format
        var mdate = moment(sdate);
        // Check is valid, and ensure is date at 12AM
        date = mdate.isValid() ? getDateWithoutTime(mdate.toDate()) : null;
    }
    
    if (!date)
        // Today:
        date = getDateWithoutTime();
    
    // Reset to force new data load (can happens if schedule was change or anything in the middle)
    this.viewModel.previousDate = null;
    this.viewModel.currentDate(date);
    // Force a refresh of tags
    this.tagAvailability(date, true);
};

var Appointment = require('../models/Appointment'),
    TimeSlotViewModel = require('../viewmodels/TimeSlot');

function ViewModel(app) {

    this.currentDate = ko.observable(getDateWithoutTime());
    var fullDayFree = [Appointment.newFreeSlot({ date: this.currentDate() })];
    // The 'free' event must update with any change in currentDate
    this.currentDate.subscribe(function(date) {
        if (date) {
            fullDayFree[0].startTime(date);
            fullDayFree[0].endTime(date);
        }
    }, this);

    // slotsSource save the data as processed by a request of 
    // data because a date change.
    // It's updated by changes on currentDate that performs the remote loading
    this.slotsSource = ko.observable(fullDayFree);
    // slots computed, using slotsSource.
    // As computed in order to allow any other observable change
    // from trigger the creation of a new value
    this.slots = ko.computed(function() {
    
        var slots = this.slotsSource();
        
        // Hide unavailable slots, except if there is only one slot (so there
        // is ever something displayed)
        if (slots.length > 1) {
            slots = slots.filter(function(slot) {
                return slot.id() !== Appointment.specialIds.unavailable;
            });
        }
        
        return slots.map(TimeSlotViewModel.fromAppointment);

    }, this);
    
    this.isLoading = ko.observable(false);

    // Update current slots on date change
    // previousDate is public to allow being reset on a new show (discard old data
    // by forcing a load)
    this.previousDate = this.currentDate().toISOString();
    this.currentDate.subscribe(function (date) {

        // IMPORTANT: The date object may be reused and mutated between calls
        // (mostly because the widget I think), so is better to create
        // a clone and avoid getting race-conditions in the data downloading.
        date = new Date(Date.parse(date.toISOString()));

        // Avoid duplicated notification, un-changed date
        if (date.toISOString() === this.previousDate) {
            return;
        }
        this.previousDate = date.toISOString();

        this.isLoading(true);
        
        app.model.calendar.getDateAvailability(date)
        .then(function(dateAvail) {
            
            // IMPORTANT: First, we need to check that we are
            // in the same date still, because several loadings
            // can happen at a time (changing quickly from date to date
            // without wait for finish), avoiding a race-condition
            // that create flickering effects or replace the date events
            // by the events from other date, because it tooks more an changed.
            // TODO: still this has the minor bug of losing the isLoading
            // if a previous triggered load still didn't finished; its minor
            // because is very rare that happens, moving this stuff
            // to a special appModel for mixed bookings and events with 
            // per date cache that includes a view object with isLoading will
            // fix it and reduce this complexity.
            if (date.toISOString() !== this.currentDate().toISOString()) {
                // Race condition, not the same!! out:
                return;
            }
        
            // Update the source:
            this.slotsSource(dateAvail.list());
            this.isLoading(false);

        }.bind(this))
        .catch(function(err) {
            
            // Show free on error
            this.slotsSource(fullDayFree);
            this.isLoading(false);
            
            var msg = 'Error loading calendar events.';
            app.modals.showError({
                title: msg,
                error: err && err.error || err
            });
            
        }.bind(this));

    }.bind(this));
}

},{"../components/Activity":90,"../components/DatePicker":91,"../models/Appointment":96,"../utils/datepickerAvailability":153,"../utils/getDateWithoutTime":157,"../viewmodels/TimeSlot":185,"knockout":false,"moment":false}],16:[function(require,module,exports){
/**
    CalendarSyncing activity
**/
'use strict';

var Activity = require('../components/Activity'),
    $ = require('jquery'),
    ko = require('knockout');

var A = Activity.extends(function CalendarSyncingActivity() {
    
    Activity.apply(this, arguments);
    
    this.viewModel = new ViewModel(this.app);
    this.accessLevel = this.app.UserType.serviceProfessional;

    this.navBar = Activity.createSubsectionNavBar('Scheduling', {
        backLink: 'scheduling'
    });
    
    // Adding auto-select behavior to the export URL
    this.registerHandler({
        target: this.$activity.find('#calendarSync-icalExportUrl'),
        event: 'click',
        handler: function() {
            $(this).select();
        }
    });
    
    this.registerHandler({
        target: this.app.model.calendarSyncing,
        event: 'error',
        handler: function(err) {
            var msg = err.task === 'save' ? 'Error saving calendar syncing settings.' : 'Error loading calendar syncing settings.';
            this.app.modals.showError({
                title: msg,
                error: err && err.task && err.error || err
            });
        }.bind(this)
    });
});

exports.init = A.init;

A.prototype.show = function show(state) {
    Activity.prototype.show.call(this, state);
    
    // Keep data updated:
    this.app.model.calendarSyncing.sync();
    // Discard any previous unsaved edit
    this.viewModel.discard();
};

function ViewModel(app) {

    var calendarSyncing = app.model.calendarSyncing;

    var syncVersion = calendarSyncing.newVersion();
    syncVersion.isObsolete.subscribe(function(itIs) {
        if (itIs) {
            // new version from server while editing
            // FUTURE: warn about a new remote version asking
            // confirmation to load them or discard and overwrite them;
            // the same is need on save(), and on server response
            // with a 509:Conflict status (its body must contain the
            // server version).
            // Right now, just overwrite current changes with
            // remote ones:
            syncVersion.pull({ evenIfNewer: true });
        }
    });
    
    // Actual data for the form:
    this.sync = syncVersion.version;

    this.isLocked = ko.pureComputed(function() {
        return this.isLocked() || this.isReseting();
    }, calendarSyncing);

    this.submitText = ko.pureComputed(function() {
        return (
            this.isLoading() ? 
                'loading...' : 
                this.isSaving() ? 
                    'saving...' : 
                    'Save'
        );
    }, calendarSyncing);
    
    this.resetText = ko.pureComputed(function() {
        return (
            this.isReseting() ? 
                'reseting...' : 
                'Reset Private URL'
        );
    }, calendarSyncing);
    
    this.discard = function discard() {
        syncVersion.pull({ evenIfNewer: true });
    };

    this.save = function save() {
        syncVersion.pushSave()
        .then(function() {
            app.successSave();
        })
        .catch(function() {
            // catch error, managed on event
        });
    };
    
    this.reset = function reset() {
        calendarSyncing.resetExportUrl();
    };
}

},{"../components/Activity":90,"knockout":false}],17:[function(require,module,exports){
/**
    Cancellation Policy activity
**/
'use strict';

var ko = require('knockout'),
    moment = require('moment'),
    Activity = require('../components/Activity');

var A = Activity.extends(function CancellationPolicyActivity() {

    Activity.apply(this, arguments);

    this.accessLevel = this.app.UserType.serviceProfessional;
    this.viewModel = new ViewModel(this.app);
    this.navBar = Activity.createSubsectionNavBar('Job Title');
    
    // On changing jobTitleID:
    // - load addresses
    this.registerHandler({
        target: this.viewModel.jobTitleID,
        handler: function(jobTitleID) {
            if (jobTitleID) {
                this.viewModel.isLoading(true);
                // Get data for the Job title ID
                this.app.model.userJobProfile.getUserJobTitle(jobTitleID)
                .then(function(userJobTitle) {
                    // Save for use in the view
                    this.viewModel.userJobTitle(userJobTitle);
                }.bind(this))
                .catch(function (err) {
                    this.app.modals.showError({
                        title: 'There was an error while loading.',
                        error: err
                    });
                }.bind(this))
                .then(function() {
                    // Finally
                    this.viewModel.isLoading(false);
                }.bind(this));
            }
            else {
                this.viewModel.userJobTitle(null);
            }
        }.bind(this)
    });
});

exports.init = A.init;

A.prototype.show = function show(state) {
    Activity.prototype.show.call(this, state);

    var params = state && state.route && state.route.segments;
    this.viewModel.jobTitleID(params[0] |0);
};

function ViewModel(/*app*/) {

    this.jobTitleID = ko.observable(0);
    this.userJobTitle = ko.observable(null);
    
    this.isLoading = ko.observable(false);
    this.isSaving = ko.observable(false);
    this.isLocked = ko.pureComputed(function() {
        return this.isLoading() || this.isSaving();
    }, this);
    
    this.submitText = ko.pureComputed(function() {
        return (
            this.isLoading() ? 
                'loading...' : 
                this.isSaving() ? 
                    'saving...' : 
                    'Save'
        );
    }, this);
    
    this.save = function() {
        console.log('TODO Saving..');
    };

    this.policies = ko.observableArray([
        new CancellationPolicy({
            cancellationPolicyID: 1,
            name: 'Strict',
            description: '50% refund up to 5 days before booking, except fees',
            hoursRequired: 120,
            refundIfCancelledBefore: 0.5
        }),
        new CancellationPolicy({
            cancellationPolicyID: 2,
            name: 'Moderate',
            description: '100% refund up to 24 hours before booking, except fees.  No refund for under 24 hours and no-shows.',
            hoursRequired: 24,
            refundIfCancelledBefore: 1
        }),
        new CancellationPolicy({
            cancellationPolicyID: 3,
            name: 'Flexible',
            description: '100% refund up to 24 hours before booking, except fees.  50% refund for under 24 hours and no-shows.',
            hoursRequired: 24,
            refundIfCancelledBefore: 1
        })
    ]);
}

var Model = require('../models/Model');

var observableTime = ko.observable(new Date());
setInterval(function() {
    observableTime(new Date());
}, 1 * 60 * 1000);

function CancellationPolicy(values) {
    
    Model(this);
    
    this.model.defProperties({
        cancellationPolicyID: 0,
        name: '',
        description: '',
        hoursRequired: 0,
        refundIfCancelledBefore: 0
    }, values);
    
    this.refundIfCancelledBeforeDisplay = ko.pureComputed(function() {
        return Math.floor(this.refundIfCancelledBefore() * 100) + '%';
    }, this);

    this.refundLimitDate = ko.computed(function() {
        var d = moment(observableTime()).clone();
        d
        .add(7, 'days')
        .subtract(this.hoursRequired(), 'hours');
        return d.toDate();
    }, this);
}

},{"../components/Activity":90,"../models/Model":113,"knockout":false,"moment":false}],18:[function(require,module,exports){
/**
    ClientEdition activity
**/
'use strict';

var Activity = require('../components/Activity');
var is = require('is_js');

var A = Activity.extends(function ClientEditionActivity() {
    
    Activity.apply(this, arguments);
    
    this.viewModel = new ViewModel(this.app);
    
    this.accessLevel = this.app.UserType.loggedUser;
    
    this.navBar = Activity.createSubsectionNavBar('clients', {
        backLink: 'clients'
    });
    
    // If there is a change on the clientID, the updates must match
    // that (if is not already that)
    this.registerHandler({
        target: this.viewModel.clientID,
        handler: function (clientID) {
            if (!clientID)
                return;

            var found = /clientEditor\/(\-?\d+)/i.exec(window.location),
                urlID = found && found[1] |0;

            // If is different URL and current ID
            if (!found ||
                urlID !== clientID) {
                // Replace URL
                this.app.shell.replaceState(null, null, 'clientEditor/' + clientID);
            }
        }.bind(this)
    });
    
    // Special treatment of the save operation
    this.viewModel.onSave = function(clientID) {
        if (this.requestData.returnNewAsSelected === true) {
            // Go to previous activity that required
            // to select a client
            this.requestData.clientID = clientID;
            this.app.shell.goBack(this.requestData);
        }
        else {
            // Regular save
            this.app.successSave();
        }
    }.bind(this);
});

exports.init = A.init;

var ko = require('knockout');

A.prototype.updateNavBarState = function updateNavBarState() {

    var referrer = this.app.shell.referrerRoute;
    referrer = referrer && referrer.url || '/clients';
    var link = this.requestData.cancelLink || referrer;
    
    this.convertToCancelAction(this.navBar.leftAction(), link);
};

A.prototype.show = function show(state) {
    /*jshint maxcomplexity: 8*/
    Activity.prototype.show.call(this, state);
    
    // reset
    this.viewModel.clientID(0);
    
    this.updateNavBarState();

    // params
    var params = state && state.route && state.route.segments || [];
    
    var clientID = params[0] |0;
    
    if (clientID) {
        this.viewModel.clientID(clientID);
        
        /*this.viewModel.client.sync(clientID)
        .catch(function (err) {
            this.app.modals.showError({
                title: 'Error loading client data',
                error: err
            });
        }.bind(this));*/

        this.app.model.clients.createItemVersion(clientID)
        .then(function (clientVersion) {
            if (clientVersion) {
                this.viewModel.clientVersion(clientVersion);
                this.viewModel.header('Edit Client');
            } else {
                this.viewModel.clientVersion(null);
                this.viewModel.header('Unknow client or was deleted');
            }
        }.bind(this))
        .catch(function (err) {
            this.app.modals.showError({
                title: 'Error loading client data',
                error: err
            });
        }.bind(this));
    }
    else {
        
        // Check request parameters that allow preset client information
        // (used when the client is created based on an existent marketplace user)
        var presetData = this.requestData.presetData || {};
        // If there is not set an explicit 'false' value on editable
        // field (as when there is not data given), set to true so can be edited
        // NOTE: This is because a given marketplace user will come with editable:false
        // and need to be preserved, while on regular 'new client' all data is set by 
        // the service professional.
        if (presetData.editable !== false) {
            presetData.editable = true;
        }

        /*this.viewModel.client.newItem(presetData);*/
        // New client
        this.viewModel.clientVersion(this.app.model.clients.newItem(presetData));
        this.viewModel.header('Add a Client');
        
        // Extra preset data
        if (this.requestData.newForSearchText) {
            clientDataFromSearchText(this.requestData.newForSearchText || '', this.viewModel.client());
        }
    }
};

/**
    Small utility that just returns true if the given
    string seems a possible phone number, false otherwise.
    NOTE: Is NOT an exaustive phone validation check, just
    checks is there are several numbers so there is a chance
    to be a phone. There are stricker checks (annotated) but
    can fail on some situations (switchboard numbers) or in
    different locales.
**/
function seemsAPhoneNumber(str) {
    // Possible stricker comparision
    // return is.nanpPhone(str) || is.eppPhone(str);
    
    // Just if there are more than three consecutive numbers,
    // then 'may' be a phone number (may be anything else, but
    // since some special phone numbers can have letters or signs,
    // this is just a very lax and conservative (to avoid false negatives) check.
    return (/\d{3,}/).test(str || '');
}

/**
    Use the provided search text as the initial value
    for: name, email or phone (what fits better)
**/
function clientDataFromSearchText(txt, client) {
    if (is.email(txt)) {
        client.email(txt);
    }
    else if (seemsAPhoneNumber(txt)) {
        client.phone(txt);
    }
    else {
        // Otherwise, think is the fullname, spliting by white space
        var nameParts = txt.split(' ', 2);
        client.firstName(nameParts[0]);
        if (nameParts.length > 1) {
            client.lastName(nameParts[1]);
            // TODO For spanish (or any locale with secondLastName)
            // must try to detect the second last name?
        }
    }
}

function ViewModel(app) {
    /*jshint maxstatements:80 */
    
    this.clientID = ko.observable(0);
    
    this.clientVersion = ko.observable(null);
    this.client = ko.pureComputed(function() {
        var v = this.clientVersion();
        if (v) {
            return v.version;
        }
        return null;
    }, this);
    //this.client = app.model.clients.createWildcardItem();

    this.header = ko.observable('');
    
    this.isLoading = app.model.clients.state.isLoading;
    this.isSyncing = app.model.clients.state.isSyncing;
    this.isSaving = app.model.clients.state.isSaving;
    this.isLocked = ko.pureComputed(function() {
        return (
            app.model.clients.state.isLocked() ||
            this.isDeleting()
        );
    }, this);
    this.isReadOnly = ko.pureComputed(function() {
        var c = this.client();
        return c && !c.editable();
    }, this);

    this.isDeleting = app.model.clients.state.isDeleting;

    this.wasRemoved = ko.observable(false);

    this.isNew = ko.pureComputed(function() {
        var c = this.client();
        return !c || !c.updatedDate();
    }, this);

    this.submitText = ko.pureComputed(function() {
        var v = this.clientVersion();
        return (
            this.isLoading() ? 
                'Loading...' : 
                this.isSaving() ? 
                    'Saving changes' : 
                    this.isNew() ?
                        'Add client' :
                        v && v.areDifferent() ?
                            'Save changes' :
                            'Saved'
        );
    }, this);

    this.unsavedChanges = ko.pureComputed(function() {
        var v = this.clientVersion();
        return v && v.areDifferent();
    }, this);
    
    this.deleteText = ko.pureComputed(function() {
        return (
            this.isDeleting() ? 
                'Deleting...' : 
                'Delete'
        );
    }, this);

    this.save = function() {

        app.model.clients.setItem(this.client().model.toPlainObject())
        .then(function(serverData) {
            // Update version with server data.
            this.client().model.updateWith(serverData);
            // Push version so it appears as saved
            this.clientVersion().push({ evenIfObsolete: true });
          
            // Special save, function provided by the activity on set-up
            this.onSave(serverData.clientUserID);
        }.bind(this))
        .catch(function(err) {
            app.modals.showError({
                title: 'There was an error while saving.',
                error: err
            });
        });

    }.bind(this);
    
    this.confirmRemoval = function() {
        app.modals.confirm({
            title: 'Delete client',
            message: 'Are you sure? The operation cannot be undone.',
            yes: 'Delete',
            no: 'Keep'
        })
        .then(function() {
            this.remove();
        }.bind(this));
    }.bind(this);

    this.remove = function() {

        app.model.clients.delItem(this.clientID())
        .then(function() {
            this.wasRemoved(true);
            // Go out the deleted location
            app.shell.goBack();
        }.bind(this))
        .catch(function(err) {
            app.modals.showError({
                title: 'There was an error while deleting.',
                error: err
            });
        });
    }.bind(this);
    
    // Birth month day
    // TODO l10n
    this.months = ko.observableArray([
        { id: 1, name: 'January'},
        { id: 2, name: 'February'},
        { id: 3, name: 'March'},
        { id: 4, name: 'April'},
        { id: 5, name: 'May'},
        { id: 6, name: 'June'},
        { id: 7, name: 'July'},
        { id: 8, name: 'August'},
        { id: 9, name: 'September'},
        { id: 10, name: 'October'},
        { id: 11, name: 'November'},
        { id: 12, name: 'December'}
    ]);
    // We need to use a special observable in the form, that will
    // update the back-end profile.birthMonth
    this.selectedBirthMonth = ko.computed({
        read: function() {
            var c = this.client();
            if (c) {
                var birthMonth = c.birthMonth();
                return birthMonth ? this.months()[birthMonth - 1] : null;
            }
            return null;
        },
        write: function(month) {
            var c = this.client();
            if (c)
                c.birthMonth(month && month.id || null);
        },
        owner: this
    });
    
    this.monthDays = ko.observableArray([]);
    for (var iday = 1; iday <= 31; iday++) {
        this.monthDays.push(iday);
    }
    
    // Extra for button addons
    this.validEmail = ko.pureComputed(function() {
        var c = this.client();
        if (c) {
            var e = c.email();
            return is.email(e) ? e : '';
        }
        return '';
    }, this);

    this.validPhone = ko.pureComputed(function() {
        var c = this.client();
        if (c) {
            var e = c.phone();
            return seemsAPhoneNumber(e) ? e : '';
        }
        return '';
    }, this);
    
    // Public Search
    
    var foundPublicUser = function foundPublicUser(user) {
        // Only if still matches current view data
        var c = this.client();
        if (!c) return;
        
        // Don't offer if is already that user!
        if (c.clientUserID() === user.clientUserID) return;
        
        // NOTE: avoiding use fullName because it can make more than one conflicting
        // results, being not enough the name to confirm the user (use the search for that)
        //  c.fullName() === user.fullName ||
        if (c.email() === user.email ||
            c.phone() === user.phone) {

            // Notify user
            var msg = 'We`ve found an existing record for {0}. Would you like to add him to your clients?'.replace(/\{0\}/g, user.firstName);
            app.modals.confirm({
                title: 'client found at loconomics.com',
                message: msg
            })
            .then(function() {
                // Acepted
                // Replace current user data
                // but keep notesAboutClient
                var notes = c.notesAboutClient();
                c.model.updateWith(user);
                c.notesAboutClient(notes);
                this.clientID(user.clientUserID);
            }.bind(this))
            .catch(function() {
                // Discarded, do nothing
            });
        }
        
    }.bind(this);
    
    // When filering has no results:
    ko.computed(function() {
        var c = this.client();
        if (!c) return;
        
        // NOTE: discarded the fullName because several results can be retrieved,
        // better use the search for that and double check entries
        
        var email = c.email(),
            //fullName = c.fullName(),
            phone = c.phone();
        if (!email && !phone /*!fullName && */) return;

        app.model.clients.publicSearch({
            //fullName: fullName,
            email: email,
            phone: phone
        })
        .then(function(r) {
            if (r && r[0]) foundPublicUser(r[0]);
        }.bind(this))
        .catch(function() {
            // Doesn't matters
        });
    }, this)
    // Avoid excessive request by setting a timeout since the latest change
    .extend({ rateLimit: { timeout: 400, method: 'notifyWhenChangesStop' } });
}

},{"../components/Activity":90,"is_js":false,"knockout":false}],19:[function(require,module,exports){
/**
    clients activity
**/
'use strict';

var $ = require('jquery'),
    ko = require('knockout'),
    Activity = require('../components/Activity'),
    textSearch = require('../utils/textSearch');

var A = Activity.extends(function ClientsActivity() {
    
    Activity.apply(this, arguments);

    this.accessLevel = this.app.UserType.serviceProfessional;
    this.viewModel = new ViewModel(this.app);
    // Defaults settings for navBar.
    this.navBar = Activity.createSubsectionNavBar('Clients', {
        backLink: 'cms'
    });
    // Save defaults to restore on updateNavBarState when needed:
    this.defaultLeftAction = this.navBar.leftAction().model.toPlainObject();
    
    // Getting elements
    this.$index = this.$activity.find('#clientsIndex');
    this.$listView = this.$activity.find('#clientsListView');

    // Handler to go back with the selected client when 
    // there is one selected and requestData is for
    // 'select mode'
    this.registerHandler({
        target: this.viewModel.selectedClient,
        handler: function (theSelectedClient) {
            // We have a request and
            // it requested to select a client,
            // and a selected client
            if (this.requestData &&
                this.requestData.selectClient === true &&
                theSelectedClient) {

                // Pass the selected client in the info
                this.requestData.selectedClientID = theSelectedClient.clientUserID();
                // And go back
                this.app.shell.goBack(this.requestData);
                // Last, clear requestData
                this.requestData = null;
            }
        }.bind(this)
    });
    
    this.returnRequest = function returnRequest() {
        this.app.shell.goBack(this.requestData);
    }.bind(this);
});

exports.init = A.init;

A.prototype.updateNavBarState = function updateNavBarState() {
    //jshint maxcomplexity:8
    
    var itIs = this.viewModel.isSelectionMode();
    
    this.viewModel.headerText(itIs ? 'Select a client' : '');

    if (this.requestData.title) {
        // Replace title by title if required
        this.navBar.title(this.requestData.title);
    }
    else {
        // Title must be empty
        this.navBar.title('');
    }

    if (this.requestData.cancelLink) {
        this.convertToCancelAction(this.navBar.leftAction(), this.requestData.cancelLink);
    }
    else {
        // Reset to defaults, or given title:
        this.navBar.leftAction().model.updateWith(this.defaultLeftAction);
        if (this.requestData.navTitle)
            this.navBar.leftAction().text(this.requestData.navTitle);
    }
    
    if (itIs && !this.requestData.cancelLink) {
        // Uses a custom handler so it returns keeping the given state:
        this.navBar.leftAction().handler(this.returnRequest);
    }
    else if (!itIs) {
        this.navBar.leftAction().handler(null);
    }
};

A.prototype.show = function show(state) {
    Activity.prototype.show.call(this, state);
    
    // On every show, search gets reseted
    this.viewModel.searchText('');
    this.viewModel.selectedClient(null);
    this.viewModel.requestData = this.requestData;
    
    // Check if it comes from a clientEditor that
    // received the flag 'returnNewAsSelected' and a 
    // clientID: we were in selection mode->creating client->must
    // return the just created client to the previous page
    if (state.returnNewAsSelected === true &&
        state.clientID) {
        
        // perform an activity change but allow the current
        // to stop first
        setTimeout(function() {
            delete state.returnNewAsSelected;
            this.requestData.selectedClientID = state.clientID;
            // And go back
            this.app.shell.goBack(this.requestData);
        }.bind(this), 1);
        
        // avoid the rest operations
        return;
    }
    
    // Set selection:
    this.viewModel.isSelectionMode(state.selectClient === true);

    this.updateNavBarState();
    
    // Keep data updated:
    this.app.model.clients.sync()
    .catch(function(err) {
        this.app.modals.showError({
            title: 'Error loading the clients list',
            error: err
        });
    }.bind(this));
};

function ViewModel(app) {

    this.headerText = ko.observable('');

    // Especial mode when instead of pick and edit we are just selecting
    // (when editing an appointment)
    this.isSelectionMode = ko.observable(false);

    // Full list of clients
    this.clients = app.model.clients.list;
    this.isLoading = app.model.clients.state.isLoading;
    this.isSyncing = app.model.clients.state.isSyncing;
    
    // Search text, used to filter 'clients'
    this.searchText = ko.observable('');
    
    // Utility to get a filtered list of clients based on clients
    this.getFilteredList = function getFilteredList() {
        var s = (this.searchText() || '').toLowerCase();
        // Search the client by:
        // - full name
        // - (else) email
        // - (else) phone
        return this.clients().filter(function(client) {
            if (!client) return false;
            var found = textSearch(s, client.fullName());
            if (found) return true;
            found = textSearch(s, client.email());
            if (found) return true;
            found = textSearch(s, client.phone());
            return found;
        });
    };

    // Filtered list of clients
    this.filteredClients = ko.computed(function() {
        return this.getFilteredList();
    }, this);
    
    // Grouped list of filtered clients
    this.groupedClients = ko.computed(function(){

        // Sorting list, in a cross browser way (in Firefox, just A > B works, but not on webkit/blink)
        var clients = this.filteredClients().sort(function(clientA, clientB) {
            var a = clientA.firstName().toLowerCase(),
                b = clientB.firstName().toLowerCase();
            if (a === b)
                return 0;
            else if (a > b)
                return 1;
            else
                return -1;
        });
        
        var groups = [],
            latestGroup = null,
            latestLetter = null;

        clients.forEach(function(client) {
            var letter = (client.firstName()[0] || '').toUpperCase();
            if (letter !== latestLetter) {
                latestGroup = {
                    letter: letter,
                    clients: [client]
                };
                groups.push(latestGroup);
                latestLetter = letter;
            }
            else {
                latestGroup.clients.push(client);
            }
        });

        return groups;

    }, this);
    
    
    /// Public search
    this.publicSearchResults = ko.observableArray([]);
    this.publicSearchRunning = ko.observable(null);
    // When filering has no results:
    ko.computed(function() {    
        var filtered = this.filteredClients(),
            searchText = this.searchText(),
            request = null;

        // If there is search text and no results from local filtering
        if (filtered.length === 0 && searchText) {
            
            // Remove previous results
            this.publicSearchResults([]);
            
            request = app.model.clients.publicSearch({
                fullName: searchText,
                email: searchText,
                phone: searchText
            });
            this.publicSearchRunning(request);
            request.then(function(r) {
                this.publicSearchResults(r);
            }.bind(this))
            .catch(function(err) {
                app.modals.showError({
                    title: 'There was an error when on remote clients search',
                    error: err
                });
            })
            .then(function() {
                // Always:
                // if still the same, it ended then remove
                if (this.publicSearchRunning() === request)
                    this.publicSearchRunning(null);
            }.bind(this));
        }
        else {
            this.publicSearchResults([]);
            // Cancelling any pending request, to avoid
            // anwanted results when finish
            request = this.publicSearchRunning();
            if (request &&
                request.xhr &&
                request.xhr.abort) {
                request.xhr.abort();
                this.publicSearchRunning(null);
            }
        }
    }, this)
    // Avoid excessive request by setting a timeout since the latest change
    .extend({ rateLimit: { timeout: 400, method: 'notifyWhenChangesStop' } });
    
    /**
        Add a client from the public/remote search results
    **/
    this.addRemoteClient = function(client, event) {
        var data = client.model && client.model.toPlainObject() || client;
        var request = $.extend({}, this.requestData, {
            presetData: data,
            returnNewAsSelected: this.isSelectionMode()
        });
        app.shell.go('clientEditor', request);

        event.preventDefault();
        event.stopImmediatePropagation();
    }.bind(this);
    
    /**
        Call the activity to add a new client, passing the current
        search text so can be used as initial name/email/phone
    **/
    this.addNew = function(data, event) {
        event.preventDefault();
        event.stopImmediatePropagation();
        
        var request = $.extend({}, this.requestData, {
            newForSearchText: this.searchText(),
            returnNewAsSelected: this.isSelectionMode()
        });
        app.shell.go('clientEditor', request);
    }.bind(this);

    /// Selections
    
    this.selectedClient = ko.observable(null);
    
    this.selectClient = function(selectedClient, event) {
        event.preventDefault();
        event.stopImmediatePropagation();

        this.selectedClient(selectedClient);
    }.bind(this);
}

},{"../components/Activity":90,"../utils/textSearch":174,"knockout":false}],20:[function(require,module,exports){
/**
    CMS activity
    (Client Management System)
**/
'use strict';

var Activity = require('../components/Activity');
var ko = require('knockout');

var A = Activity.extends(function CmsActivity() {
    
    Activity.apply(this, arguments);
    
    this.viewModel = new ViewModel(this.app);
    
    this.accessLevel = this.app.UserType.loggedUser;
    
    this.navBar = Activity.createSectionNavBar('Client management');
});

exports.init = A.init;

A.prototype.show = function show(state) {
    Activity.prototype.show.call(this, state);

    // Keep data updated:
    this.app.model.clients.sync()
    .catch(function(err) {
        this.app.modals.showError({
            title: 'Error loading the clients list',
            error: err
        });
    }.bind(this));
};

var numeral = require('numeral');

function ViewModel(app) {
    
    this.clients = app.model.clients.list;

    this.clientsCount = ko.pureComputed(function() {
        var cs = this.clients();
        
        if (cs <= 0)
            return '0 clients';
        else if (cs === 1)
            return '1 client';
        else
            return numeral(cs.length |0).format('0,0') + ' clients';
    }, this);
}

},{"../components/Activity":90,"knockout":false,"numeral":false}],21:[function(require,module,exports){
/**
    ContactForm activity
**/
'use strict';

var Activity = require('../components/Activity'),
    VocElementEnum = require('../models/VocElementEnum');

var A = Activity.extends(function ContactFormActivity() {
    
    Activity.apply(this, arguments);
    
    this.viewModel = new ViewModel(this.app);
    
    this.accessLevel = this.app.UserType.loggedUser;
    
    this.navBar = Activity.createSubsectionNavBar('Talk to us');
});

exports.init = A.init;

A.prototype.show = function show(options) {
    Activity.prototype.show.call(this, options);

    var params = this.requestData.route.segments || [];
    var elementName = params[0] || '',
        elementID = VocElementEnum[elementName] |0;
    
    if (!elementName) {
        console.log('Feedback Support: Accessing without specify an element, using General (0)');
    }
    else if (!VocElementEnum.hasOwnProperty(elementName)) {
        console.error('Feedback Support: given a bad VOC Element name:', elementName);
    }

    this.viewModel.vocElementID(elementID);
};

var ko = require('knockout');
function ViewModel(app) {
    
    this.message = ko.observable('');
    this.wasSent = ko.observable(false);
    this.isSending = ko.observable(false);
    this.vocElementID = ko.observable(0);

    var updateWasSent = function() {
        this.wasSent(false);
    }.bind(this);
    this.message.subscribe(updateWasSent);
    
    this.submitText = ko.pureComputed(function() {
        return this.isSending() ? 'Sending..' : this.wasSent() ? 'Sent' : 'Send';
    }, this);
    
    this.send = function send() {
        this.isSending(true);
        app.model.feedback.postSupport({
            message: this.message(),
            vocElementID: this.vocElementID()
        })
        .then(function() {
            // Reset after being sent
            this.message('');
            this.wasSent(true);
        }.bind(this))
        .catch(function(err) {
            app.modals.showError({
                title: 'There was an error sending your feedback',
                error: err
            });
        })
        .then(function() {
            // Always
            this.isSending(false);
        }.bind(this));
    }.bind(this);
}

},{"../components/Activity":90,"../models/VocElementEnum":134,"knockout":false}],22:[function(require,module,exports){
/**
    ContactInfo activity
**/
'use strict';

var Activity = require('../components/Activity');
var ko = require('knockout');

var A = Activity.extends(function ContactInfoActivity() {
    
    Activity.apply(this, arguments);

    this.viewModel = new ViewModel(this.app);
    this.accessLevel = this.app.UserType.loggedUser;
    
    this.navBar = Activity.createSubsectionNavBar('Owner information', {
        backLink: 'ownerInfo'
    });
    this.defaultNavBar = this.navBar.model.toPlainObject();
    
    this.registerHandler({
        target: this.app.model.userProfile,
        event: 'error',
        handler: function(err) {
            var msg = err.task === 'save' ? 'Error saving contact data.' : 'Error loading contact data.';
            this.app.modals.showError({
                title: msg,
                error: err && err.error || err
            });
        }.bind(this)
    });
    
    this.registerHandler({
        target: this.app.model.homeAddress,
        event: 'error',
        handler: function(err) {
            var msg = err.task === 'save' ? 'Error saving address details.' : 'Error loading address details.';
            this.app.modals.showError({
                title: msg,
                error: err && err.error || err
            });
        }.bind(this)
    });
    
    // On change to a valid code, do remote look-up
    // NOTE: using directly a computed rather than the registerHandler to use
    // the rateLimit extender that avoids excesive request being performed on changes.
    // NOTE: the code inside the handler is mostly the same as in addressEditor for the same look-up.
    var app = this.app,
        viewModel = this.viewModel;
    ko.computed(function() {
        var postalCode = this.postalCode(),
            address = this;

        if (postalCode && !/^\s*$/.test(postalCode)) {
            app.model.postalCodes.getItem(postalCode)
            .then(function(info) {
                if (info) {
                    address.city(info.city);
                    address.stateProvinceCode(info.stateProvinceCode);
                    address.stateProvinceName(info.stateProvinceName);
                    viewModel.errorMessages.postalCode('');
                }
            })
            .catch(function(err) {
                address.city('');
                address.stateProvinceCode('');
                address.stateProvinceName('');
                // Expected errors, a single message, set
                // on the observable
                var msg = typeof(err) === 'string' ? err : null;
                if (msg || err && err.responseJSON && err.responseJSON.errorMessage) {
                    viewModel.errorMessages.postalCode(msg || err.responseJSON.errorMessage);
                }
                else {
                    // Log to console for debugging purposes, on regular use an error on the
                    // postal code is not critical and can be transparent; if there are 
                    // connectivity or authentification errors will throw on saving the address
                    console.error('Server error validating Zip Code', err);
                }
            });
        }
    }, this.viewModel.address)
    // Avoid excessive requests by setting a timeout since the latest change
    .extend({ rateLimit: { timeout: 200, method: 'notifyWhenChangesStop' } });
});

exports.init = A.init;

A.prototype.updateNavBarState = function updateNavBarState() {
    
    if (!this.app.model.onboarding.updateNavBar(this.navBar)) {
        // Reset
        this.navBar.model.updateWith(this.defaultNavBar);
    }
};

A.prototype.show = function show(state) {
    Activity.prototype.show.call(this, state);
    
    // Discard any previous unsaved edit
    this.viewModel.discard();
    
    this.updateNavBarState();
    
    // Keep data updated:
    this.app.model.userProfile.sync();
    this.app.model.homeAddress.sync();
};

function ViewModel(app) {

    this.headerText = ko.pureComputed(function() {
        return app.model.onboarding.inProgress() ?
            'How can we reach you?' :
            'Contact information';
    });
    
    // List of possible error messages registered
    // by name
    this.errorMessages = {
        postalCode: ko.observable('')
    };
    
    // User Profile
    var userProfile = app.model.userProfile;
    var profileVersion = userProfile.newVersion();
    profileVersion.isObsolete.subscribe(function(itIs) {
        if (itIs) {
            // new version from server while editing
            // FUTURE: warn about a new remote version asking
            // confirmation to load them or discard and overwrite them;
            // the same is need on save(), and on server response
            // with a 509:Conflict status (its body must contain the
            // server version).
            // Right now, just overwrite current changes with
            // remote ones:
            profileVersion.pull({ evenIfNewer: true });
        }
    });
    
    // Actual data for the form:
    this.profile = profileVersion.version;
    
    // TODO l10n
    this.months = ko.observableArray([
        { id: 1, name: 'January'},
        { id: 2, name: 'February'},
        { id: 3, name: 'March'},
        { id: 4, name: 'April'},
        { id: 5, name: 'May'},
        { id: 6, name: 'June'},
        { id: 7, name: 'July'},
        { id: 8, name: 'August'},
        { id: 9, name: 'September'},
        { id: 10, name: 'October'},
        { id: 11, name: 'November'},
        { id: 12, name: 'December'}
    ]);
    // We need to use a special observable in the form, that will
    // update the back-end profile.birthMonth
    this.selectedBirthMonth = ko.computed({
        read: function() {
            var birthMonth = this.profile.birthMonth();
            return birthMonth ? this.months()[birthMonth - 1] : null;
        },
        write: function(month) {
            this.profile.birthMonth(month && month.id || null);
        },
        owner: this
    });
    
    this.monthDays = ko.observableArray([]);
    for (var iday = 1; iday <= 31; iday++) {
        this.monthDays.push(iday);
    }
    
    // Home Address
    var homeAddress = app.model.homeAddress;
    var homeAddressVersion = homeAddress.newVersion();
    homeAddressVersion.isObsolete.subscribe(function(itIs) {
        if (itIs) {
            // new version from server while editing
            // FUTURE: warn about a new remote version asking
            // confirmation to load them or discard and overwrite them;
            // the same is need on save(), and on server response
            // with a 509:Conflict status (its body must contain the
            // server version).
            // Right now, just overwrite current changes with
            // remote ones:
            homeAddressVersion.pull({ evenIfNewer: true });
        }
    });
    
    // Actual data for the form:
    this.address = homeAddressVersion.version;

    // Control observables: special because must a mix
    // of the both remote models used in this viewmodel
    this.isLocked = ko.computed(function() {
        return userProfile.isLocked() || homeAddress.isLocked();
    }, this);
    this.isLoading = ko.computed(function() {
        return userProfile.isLoading() || homeAddress.isLoading();
    }, this);
    this.isSaving = ko.computed(function() {
        return userProfile.isSaving() || homeAddress.isSaving();
    }, this);

    this.submitText = ko.pureComputed(function() {
        return (
            app.model.onboarding.inProgress() ?
                'Save and continue' :
            this.isLoading() ? 
                'loading...' : 
                this.isSaving() ? 
                    'saving...' : 
                    'Save'
        );
    }, this);
    
    // Actions

    this.discard = function discard() {
        profileVersion.pull({ evenIfNewer: true });
        homeAddressVersion.pull({ evenIfNewer: true });
    }.bind(this);

    this.save = function save() {
        Promise.all([
            profileVersion.pushSave(),
            homeAddressVersion.pushSave()
        ])
        .then(function() {
            if (app.model.onboarding.inProgress()) {
                app.model.onboarding.goNext();
            }
            else {
                app.successSave();
            }
        })
        .catch(function() {
            // catch error, managed on event
        });
    }.bind(this);
}

},{"../components/Activity":90,"knockout":false}],23:[function(require,module,exports){
/**
    Conversation activity
**/
'use strict';

var Activity = require('../components/Activity');

var A = Activity.extends(function ConversationActivity() {
    
    Activity.apply(this, arguments);
    
    this.viewModel = new ViewModel(this.app);
    
    this.accessLevel = this.app.UserType.loggedUser;
    
    this.navBar = Activity.createSubsectionNavBar('Inbox', {
        backLink: 'inbox'
    });
});

exports.init = A.init;

A.prototype.show = function show(state) {
    Activity.prototype.show.call(this, state);

    // Reset
    this.viewModel.threadID(0);
    this.viewModel.thread(null);

    // Params
    var params = state && state.route && state.route.segments || [],
        threadID = params[0] |0;

    this.viewModel.threadID(threadID);
    
    // Load the data
    if (threadID) {
        this.viewModel.thread.sync(threadID)
        .catch(function(err) {
            this.app.modals.showError({
                title: 'Error loading conversation',
                error: err
            }).then(function() {
                this.app.shell.goBack();
            }.bind(this));
        }.bind(this));
    }
    else {
        this.app.modals.showError({
            title: 'Conversation Not Found'
        }).then(function() {
            this.app.shell.goBack();
        }.bind(this));
    }
};

var ko = require('knockout');

function ViewModel(app) {

    this.isLoading = app.model.messaging.state.isLoading;
    this.isSyncing = app.model.messaging.state.isSyncing;
    this.isSaving = app.model.messaging.state.isSaving;

    this.threadID = ko.observable(null);
    this.thread = app.model.messaging.createWildcardItem();

    this.subject = ko.pureComputed(function() {
        var m = this.thread();
        return (
            this.isLoading() ?
                'Loading...' :
                m && (m.subject() || '').replace(/^\s+|\s+$/g, '') || 'Conversation without subject'
        );
    }, this);
    
    // If the last message reference a booking, is
    // accessed with:
    this.bookingID = ko.pureComputed(function() {
        var msg = this.thread() && this.thread().messages()[0];
        if (msg &&
            (msg.auxT() || '').toLowerCase() === 'booking' &&
            msg.auxID()) {
            return msg.auxID();
        }
        else {
            return null;
        }
    }, this);
}

},{"../components/Activity":90,"knockout":false}],24:[function(require,module,exports){
/**
    Dashboard activity
**/
'use strict';

var ko = require('knockout');

var Activity = require('../components/Activity'),
    AppointmentView = require('../viewmodels/AppointmentView');

var A = Activity.extends(function DashboardActivity() {
    
    Activity.apply(this, arguments);

    this.accessLevel = this.app.UserType.loggedUser;
    this.viewModel = new ViewModel(this.app);
    // null for logo
    this.navBar = Activity.createSectionNavBar(null);
    
    // Getting elements
    this.$nextBooking = this.$activity.find('#dashboardNextBooking');
    this.$upcomingBookings = this.$activity.find('#dashboardUpcomingBookings');
    this.$inbox = this.$activity.find('#dashboardInbox');
    this.$performance = this.$activity.find('#dashboardPerformance');
    this.$getMore = this.$activity.find('#dashboardGetMore');
    
    // TestingData
    setSomeTestingData(this.viewModel);
});

exports.init = A.init;

A.prototype.show = function show(options) {
    Activity.prototype.show.call(this, options);
    
    var v = this.viewModel,
        app = this.app,
        appModel = this.app.model;
    
    if (this.requestData.completedOnboarding) {
        switch (this.requestData.completedOnboarding) {
            case 'welcome': // Schedule complete
                this.app.modals.showNotification({
                    title: 'Congrats',
                    message: 'You\'re all ready to start scheduling ' +
                        'clients. Click + to start adding bookings ' +
                        'and clients.'
                });
                break;
        }
    }
    
    var preapareShowErrorFor = function preapareShowErrorFor(title) {
        return function(err) {
            this.app.modals.showError({
                title: title,
                error: err
            });
        }.bind(this);
    }.bind(this);
    
    // Update data
    if (v.upcomingBookings.items().length) {
        v.upcomingBookings.isSyncing(true);
    }
    else {
        v.upcomingBookings.isLoading(true);
    }
    appModel.bookings.getUpcomingBookings()
    .then(function(upcoming) {

        if (upcoming.nextBookingID) {
            var previousID = v.nextBooking() && v.nextBooking().sourceBooking().bookingID();
            if (upcoming.nextBookingID !== previousID) {
                if (v.nextBooking()) {
                    v.nextBooking.isSyncing(true);
                }
                else {
                    v.nextBooking.isLoading(true);
                }
                appModel.calendar.getAppointment({ bookingID: upcoming.nextBookingID })
                .then(function(apt) {
                    v.nextBooking(new AppointmentView(apt, app));
                })
                .catch(preapareShowErrorFor('Error loading next booking'))
                .then(function() {
                    // Finally
                    v.nextBooking.isLoading(false);
                    v.nextBooking.isSyncing(false);
                });
            }
        }
        else {
            v.nextBooking(null);
        }

        v.upcomingBookings.today.quantity(upcoming.today.quantity);
        v.upcomingBookings.today.time(upcoming.today.time && new Date(upcoming.today.time));
        v.upcomingBookings.tomorrow.quantity(upcoming.tomorrow.quantity);
        v.upcomingBookings.tomorrow.time(upcoming.tomorrow.time && new Date(upcoming.tomorrow.time));
        v.upcomingBookings.nextWeek.quantity(upcoming.nextWeek.quantity);
        v.upcomingBookings.nextWeek.time(upcoming.nextWeek.time && new Date(upcoming.nextWeek.time));
    })
    .catch(preapareShowErrorFor('Error loading upcoming bookings'))
    .then(function() {
        // Finally
        v.upcomingBookings.isLoading(false);
        v.upcomingBookings.isSyncing(false);
    });
    
    // Messages
    var MessageView = require('../models/MessageView');
    if (v.inbox.messages().length)
        v.inbox.isSyncing(true);
    else
        v.inbox.isLoading(true);
    appModel.messaging.getList()
    .then(function(threads) {
        v.inbox.messages(threads().map(MessageView.fromThread.bind(null, app)));
    })
    .catch(preapareShowErrorFor('Error loading latest messages'))
    .then(function() {
        // Finally
        v.inbox.isLoading(false);
        v.inbox.isSyncing(false);
    });
};


var UpcomingBookingsSummary = require('../models/UpcomingBookingsSummary'),
    MailFolder = require('../models/MailFolder'),
    PerformanceSummary = require('../models/PerformanceSummary'),
    GetMore = require('../models/GetMore');

function ViewModel() {

    this.upcomingBookings = new UpcomingBookingsSummary();
    this.upcomingBookings.isLoading = ko.observable(false);
    this.upcomingBookings.isSyncing = ko.observable(false);

    this.nextBooking = ko.observable(null);
    this.nextBooking.isLoading = ko.observable(false);
    this.nextBooking.isSyncing = ko.observable(false);
    
    this.inbox = new MailFolder({
        topNumber: 4
    });
    this.inbox.isLoading = ko.observable(false);
    this.inbox.isSyncing = ko.observable(false);
    
    this.performance = new PerformanceSummary();
    
    this.getMore = new GetMore();
}

/** TESTING DATA **/
function setSomeTestingData(viewModel) {
    
    viewModel.performance.earnings.currentAmount(2400);
    viewModel.performance.earnings.nextAmount(6200.54);
    viewModel.performance.timeBooked.percent(0.93);
    
    viewModel.getMore.model.updateWith({
        availability: false,
        payments: true,
        profile: true,
        coop: false
    });
}

},{"../components/Activity":90,"../models/GetMore":104,"../models/MailFolder":109,"../models/MessageView":112,"../models/PerformanceSummary":114,"../models/UpcomingBookingsSummary":129,"../viewmodels/AppointmentView":176,"knockout":false}],25:[function(require,module,exports){
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

},{"../components/Activity":90,"../components/DatePicker":91,"../utils/Time":148,"../utils/datepickerAvailability":153,"../utils/getDateWithoutTime":157,"knockout":false,"moment":false}],26:[function(require,module,exports){
/**
    Education activity
**/
'use strict';

var Activity = require('../components/Activity');

var A = Activity.extends(function EducationActivity() {

    Activity.apply(this, arguments);

    this.accessLevel = this.app.UserType.loggedUser;
    this.viewModel = new ViewModel(this.app);
    // Defaults settings for navBar.
    this.navBar = Activity.createSubsectionNavBar('Marketplace Profile', {
backLink: '/marketplaceProfile'
    });
});

exports.init = A.init;

A.prototype.show = function show(options) {
    Activity.prototype.show.call(this, options);
    
    // Request a sync and catch any error
    this.app.model.education.sync()
    .catch(function (err) {
        this.app.modals.showError({
            title: 'Error loading education information',
            error: err
        });
    }.bind(this));
};

function ViewModel(app) {

    this.isLoading = app.model.education.state.isLoading;
    this.isSyncing = app.model.education.state.isSyncing;

    this.list = app.model.education.list;
}

},{"../components/Activity":90}],27:[function(require,module,exports){
/**
    EducationForm activity
**/
'use strict';

var Activity = require('../components/Activity'),
    ko = require('knockout');

var A = Activity.extends(function EducationFormActivity() {
    
    Activity.apply(this, arguments);
    
    this.viewModel = new ViewModel(this.app);
    this.accessLevel = this.app.UserType.loggedUser;

    this.navBar = Activity.createSubsectionNavBar('Education');
});

exports.init = A.init;

A.prototype.updateNavBarState = function updateNavBarState() {

    var link = this.requestData.cancelLink || '/education/';
    
    this.convertToCancelAction(this.navBar.leftAction(), link);
};

A.prototype.show = function show(state) {
    Activity.prototype.show.call(this, state);
    
    // Reset
    this.viewModel.version(null);

    // Params
    var params = state && state.route && state.route.segments || [];
    
    this.viewModel.educationID(params[0] |0);
    
    this.updateNavBarState();
    
    if (this.viewModel.educationID() === 0) {
        // NEW one
        this.viewModel.version(this.app.model.education.newItem());
    }
    else {
        // LOAD
        this.app.model.education.createItemVersion(this.viewModel.educationID())
        .then(function (educationVersion) {
            if (educationVersion) {
                this.viewModel.version(educationVersion);
            } else {
                throw new Error('No data');
            }
        }.bind(this))
        .catch(function (err) {
            this.app.modals.showError({
                title: 'There was an error while loading.',
                error: err
            })
            .then(function() {
                // On close modal, go back
                this.app.shell.goBack();
            }.bind(this));
        }.bind(this));
    }
};

function ViewModel(app) {

    this.educationID = ko.observable(0);
    this.isLoading = app.model.education.state.isLoading;
    this.isSaving = app.model.education.state.isSaving;
    this.isSyncing = app.model.education.state.isSyncing;
    this.isDeleting = app.model.education.state.isDeleting;
    this.isLocked = ko.computed(function() {
        return this.isDeleting() || app.model.education.state.isLocked();
    }, this);
    
    this.version = ko.observable(null);
    this.item = ko.pureComputed(function() {
        var v = this.version();
        if (v) {
            return v.version;
        }
        return null;
    }, this);
    
    this.isNew = ko.pureComputed(function() {
        var p = this.item();
        return p && !p.updatedDate();
    }, this);

    this.submitText = ko.pureComputed(function() {
        var v = this.version();
        return (
            this.isLoading() ? 
                'Loading...' : 
                this.isSaving() ? 
                    'Saving changes' : 
                    v && v.areDifferent() ?
                        'Save changes' :
                        'Saved'
        );
    }, this);

    this.unsavedChanges = ko.pureComputed(function() {
        var v = this.version();
        return v && v.areDifferent();
    }, this);
    
    this.deleteText = ko.pureComputed(function() {
        return (
            this.isDeleting() ? 
                'Deleting...' : 
                'Delete'
        );
    }, this);

    this.save = function() {
        app.model.education.setItem(this.item().model.toPlainObject())
        .then(function(serverData) {
            // Update version with server data.
            this.item().model.updateWith(serverData);
            // Push version so it appears as saved
            this.version().push({ evenIfObsolete: true });
            // Go out
            app.successSave();
        }.bind(this))
        .catch(function(err) {
            app.modals.showError({
                title: 'There was an error while saving.',
                error: err
            });
        });

    }.bind(this);
    
    this.confirmRemoval = function() {
        // L18N
        app.modals.confirm({
            title: 'Delete',
            message: 'Are you sure? The operation cannot be undone.',
            yes: 'Delete',
            no: 'Keep'
        })
        .then(function() {
            this.remove();
        }.bind(this));
    }.bind(this);

    this.remove = function() {
        app.model.education.delItem(this.educationID())
        .then(function() {
            // Go out
            // TODO: custom message??
            app.successSave();
        }.bind(this))
        .catch(function(err) {
            app.modals.showError({
                title: 'There was an error while deleting.',
                error: err
            });
        });
    }.bind(this);
    
    this.yearsOptions = ko.computed(function() {
        var l = [];
        for (var i = new Date().getFullYear(); i > 1900; i--) {
            l.push(i);
        }
        return l;
    });
}

},{"../components/Activity":90,"knockout":false}],28:[function(require,module,exports){
/**
    Faqs activity
**/
'use strict';

var Activity = require('../components/Activity');

var A = Activity.extends(function FaqsActivity() {
    
    Activity.apply(this, arguments);
    
    this.viewModel = new ViewModel();
    this.accessLevel = this.app.UserType.loggedUser;
    
    this.navBar = Activity.createSubsectionNavBar('Talk to us');
    
    // TestingData
    //setSomeTestingData(this.viewModel);
    this.currentLabels = '';
    this.loadArticles = function() {
        var url = 'https://loconomics.zendesk.com/api/v2/help_center/articles.json?label_names=' + encodeURIComponent(this.currentLabels);
        this.viewModel.isLoading(true);
        
        var $ = require('jquery');
        Promise.resolve($.get(url)).then(function(res) {
            if (res) {
                this.viewModel.faqs(res.articles.map(function(art) {
                    return new Faq({
                        id: art.id,
                        title: art.title,
                        description: art.body
                    });
                }));
            }
            else {
                this.viewModel.faqs([]);
            }
            this.viewModel.isLoading(false);
        }.bind(this))
        .catch(function(/*err*/) {
            this.viewModel.isLoading(false);
        }.bind(this));
    }.bind(this);
});

exports.init = A.init;

A.prototype.show = function show(state) {
    
    Activity.prototype.show.call(this, state);
    
    this.viewModel.searchText('');
    this.loadArticles();
};

var ko = require('knockout');

function ViewModel() {

    this.faqs = ko.observableArray([]);
    this.searchText = ko.observable('');
    this.isLoading = ko.observable(false);
    
    this.filteredFaqs = ko.pureComputed(function() {
        var s = this.searchText().toLowerCase();
        return this.faqs().filter(function(v) {
            var n = v && v.title() || '';
            n += v && v.description() || '';
            n = n.toLowerCase();
            return n.indexOf(s) > -1;
        });
    }, this);
}

var Model = require('../models/Model');
function Faq(values) {
    
    Model(this);

    this.model.defProperties({
        id: 0,
        title: '',
        description: ''
    }, values);
}

/** TESTING DATA **/
//function setSomeTestingData(viewModel) {
//    
//    var testdata = [
//        new Faq({
//            id: 1,
//            title: 'How do I set up a marketplace profile?',
//            description: 'Description about how I set up a marketplace profile'
//        }),
//        new Faq({
//            id: 2,
//            title: 'Another faq',
//            description: 'Another description'
//        })
//    ];
//    viewModel.faqs(testdata);
//}


},{"../components/Activity":90,"../models/Model":113,"knockout":false}],29:[function(require,module,exports){
/**
    Feedback activity
**/
'use strict';

var Activity = require('../components/Activity');

var A = Activity.extends(function FeedbackActivity() {
    
    Activity.apply(this, arguments);

    this.accessLevel = this.app.UserType.loggedUser;
    
    this.navBar = Activity.createSectionNavBar('Talk to us');
});

exports.init = A.init;

},{"../components/Activity":90}],30:[function(require,module,exports){
/**
    FeedbackForm activity
**/
'use strict';

var Activity = require('../components/Activity'),
    VocElementEnum = require('../models/VocElementEnum');

var A = Activity.extends(function FeedbackFormActivity() {
    
    Activity.apply(this, arguments);
    
    this.viewModel = new ViewModel(this.app);
    
    this.accessLevel = this.app.UserType.loggedUser;
    
    this.navBar = Activity.createSubsectionNavBar('Talk to us');
});

exports.init = A.init;

A.prototype.show = function show(options) {
    Activity.prototype.show.call(this, options);

    var params = this.requestData.route.segments || [];
    var elementName = params[0] || '',
        elementID = VocElementEnum[elementName] |0;
    
    if (!elementName) {
        console.log('Feedback Ideas: Accessing feedback without specify an element, using General (0)');
    }
    else if (!VocElementEnum.hasOwnProperty(elementName)) {
        console.error('Feedback Ideas: given a bad VOC Element name:', elementName);
    }

    this.viewModel.vocElementID(elementID);
};

var ko = require('knockout');
function ViewModel(app) {
    
    this.message = ko.observable('');
    this.becomeCollaborator = ko.observable(false);
    this.wasSent = ko.observable(false);
    this.isSending = ko.observable(false);
    this.vocElementID = ko.observable(0);

    var updateWasSent = function() {
        this.wasSent(false);
    }.bind(this);
    this.message.subscribe(updateWasSent);
    this.becomeCollaborator.subscribe(updateWasSent);
    
    this.submitText = ko.pureComputed(function() {
        return this.isSending() ? 'Sending..' : this.wasSent() ? 'Sent' : 'Send';
    }, this);
    
    this.send = function send() {
        this.isSending(true);
        app.model.feedback.postIdea({
            message: this.message(),
            becomeCollaborator: this.becomeCollaborator(),
            vocElementID: this.vocElementID()
        })
        .then(function() {
            // Reset after being sent
            this.message('');
            this.becomeCollaborator(false);
            this.wasSent(true);
        }.bind(this))
        .catch(function(err) {
            app.modals.showError({
                title: 'There was an error sending your feedback',
                error: err
            });
        })
        .then(function() {
            // Always
            this.isSending(false);
        }.bind(this));
    }.bind(this);
}

},{"../components/Activity":90,"../models/VocElementEnum":134,"knockout":false}],31:[function(require,module,exports){
/**
    Home activity (aka Search)
**/
'use strict';

var Activity = require('../components/Activity'),
    snapPoints = require('../utils/snapPoints');

var A = Activity.extends(function HomeActivity() {

    Activity.apply(this, arguments);
    this.navBar = null;
    this.accessLevel = null;
    this.viewModel = {
        isAnonymous: this.app.model.user().isAnonymous
    };
    var $header = this.$header = this.$activity.find('header');

    this.registerHandler({
        target: this.$activity,
        event: 'scroll-fixed-header',
        handler: function(e, what) {
            if (what === 'after') {
                $header.addClass('is-fixed');
            }
            else {
                $header.removeClass('is-fixed');
            }
        }
    });

    this.registerHandler({
        target: this.$activity,
        event: 'scroll-search',
        handler: function(e, what) {
            if (what === 'after') {
                $header.addClass('is-search');
            }
            else {
                $header.removeClass('is-search');
            }
        }
    });
});

exports.init = A.init;

A.prototype._registerSnapPoints = function() {

    var $searchBox = this.$activity.find('#homeSearch'),
        // Calculate the position where search box is completely hidden, and get 1 on the worse case -- bad value coerced to 0,
        // negative result because some lack of data (content hidden)
        searchPoint = Math.max(1, (
            // Top offset with the scrolling area plus current scrollTop to know the actual position inside the positioning context
            // (is an issue if the section is showed with scroll applied on the activity)
            $searchBox.offset().top + this.$activity.scrollTop() +
            // Add the box height but sustract the header height because that is fixed and overlaps
            $searchBox.outerHeight() - this.$header.outerHeight()
        ) |0);
    
    var pointsEvents = {
        // Just after start scrolling
        0: 'scroll-fixed-header'
    };
    pointsEvents[searchPoint] = 'scroll-search';

    snapPoints(this.$activity, pointsEvents);
};

A.prototype.show = function show(state) {
    Activity.prototype.show.call(this, state);
    
    if (!this._notFirstShow) {
        this._registerSnapPoints();
        this._notFirstShow = true;
    }
};

},{"../components/Activity":90,"../utils/snapPoints":173}],32:[function(require,module,exports){
/**
    Inbox activity
**/
'use strict';

var Activity = require('../components/Activity'),
    ko = require('knockout'),
    MessageView = require('../models/MessageView'),
    textSearch = require('../utils/textSearch');

var A = Activity.extends(function InboxActivity() {
    
    Activity.apply(this, arguments);
    
    this.viewModel = new ViewModel(this.app);
    this.accessLevel = this.app.UserType.loggedUser;
    
    this.navBar = Activity.createSectionNavBar('Inbox');
});

exports.init = A.init;

A.prototype.show = function show(options) {
    Activity.prototype.show.call(this, options);
    
    // Messages
    this.app.model.messaging.getList()
    .then(function(threads) {
        this.viewModel.sourceThreads(threads());
    }.bind(this))
    .catch(function(err) {
        this.app.modals.showError({
            title: 'Error loading messages',
            error: err
        });
    }.bind(this));
};

function ViewModel(app) {
    
    this.isLoading = app.model.messaging.state.isLoading;
    this.isSyncing = app.model.messaging.state.isSyncing;

    this.sourceThreads = ko.observableArray([]);
    
    this.searchText = ko.observable('');
    
    // NOTE: since current API-connection implementation only gets
    // the latest message with getList, the search is done in the
    // bodyText of the last message (additionally to the thread subject)
    // even if this implementation try to iterate all messages.
    this.threads = ko.pureComputed(function() {
        var t = this.sourceThreads(),
            s = this.searchText();

        if (!t)
            return [];
        else if (!s)
            return t.map(MessageView.fromThread.bind(null, app));
        else        
            return t.filter(function(thread) {
                var found = false;
                
                // Check subject
                found = textSearch(s, thread.subject());
                
                if (!found) {
                    // Try content of messages
                    // It stops on first 'true' result
                    thread.messages().some(function(msg) {
                        found = textSearch(s, msg.bodyText());
                        return found;
                    });
                }
                
                return found;
            }).map(MessageView.fromThread.bind(null, app));
    }, this);
}

},{"../components/Activity":90,"../models/MessageView":112,"../utils/textSearch":174,"knockout":false}],33:[function(require,module,exports){
/**
    Index activity
**/
'use strict';

var Activity = require('../components/Activity');

var A = Activity.extends(function IndexActivity() {
    
    Activity.apply(this, arguments);

    // Any user can access this
    this.accessLevel = null;
    
    // null for logo
    this.navBar = Activity.createSectionNavBar(null);
    this.navBar.rightAction(null);
});

exports.init = A.init;

A.prototype.show = function show(state) {
    Activity.prototype.show.call(this, state);
    
    // It checks if the user is logged so then 
    // their 'logged index' is the dashboard not this
    // page that is focused on anonymous users
    if (!this.app.model.user().isAnonymous()) {
        this.app.goDashboard();
    }
};

},{"../components/Activity":90}],34:[function(require,module,exports){
/**
    Jobtitles activity
**/
'use strict';

var Activity = require('../components/Activity'),
    ko = require('knockout');

var A = Activity.extends(function JobtitlesActivity() {
    
    Activity.apply(this, arguments);
    
    this.accessLevel = this.app.UserType.loggedUser;
    this.viewModel = new ViewModel(this.app);
    this.navBar = Activity.createSubsectionNavBar('Scheduling', {
        backLink: '/scheduling'
    });
    
    // On changing jobTitleID:
    // - load addresses
    // - load job title information
    // - load pricing
    this.registerHandler({
        target: this.viewModel.jobTitleID,
        handler: function(jobTitleID) {

            if (jobTitleID) {
                ////////////
                // Addresses
                this.app.model.serviceAddresses.getList(jobTitleID)
                .then(function(list) {

                    list = this.app.model.serviceAddresses.asModel(list);
                    this.viewModel.addresses(list);

                }.bind(this))
                .catch(function (err) {
                    this.app.modals.showError({
                        title: 'There was an error while loading addresses.',
                        error: err
                    });
                }.bind(this));
                
                ////////////
                // Pricing/Services
                this.app.model.serviceProfessionalServices.getList(jobTitleID)
                .then(function(list) {

                    list = this.app.model.serviceProfessionalServices.asModel(list);
                    this.viewModel.pricing(list);

                }.bind(this))
                .catch(function (err) {
                    this.app.modals.showError({
                        title: 'There was an error while loading services.',
                        error: err
                    });
                }.bind(this));
                
                ////////////
                // Job Title
                // Get data for the Job title ID
                this.app.model.jobTitles.getJobTitle(jobTitleID)
                .then(function(jobTitle) {

                    // Fill in job title name
                    this.viewModel.jobTitleName(jobTitle.singularName());
                }.bind(this))
                .catch(function(err) {
                    this.app.modals.showError({
                        title: 'There was an error while loading the job title.',
                        error: err
                    });
                }.bind(this));
            }
            else {
                this.viewModel.addresses([]);
                this.viewModel.pricing([]);
                this.viewModel.jobTitleName('Job Title');
            }
        }.bind(this)
    });
});

exports.init = A.init;

A.prototype.show = function show(state) {
    Activity.prototype.show.call(this, state);

    // Reset: avoiding errors because persisted data for different ID on loading
    // or outdated info forcing update
    this.viewModel.jobTitleID(0);

    // Parameters
    var params = state && state.route && state.route.segments || {};
    
    // Set the job title
    var jobID = params[0] |0;
    this.viewModel.jobTitleID(jobID);
};

function ViewModel(app) {
    
    this.jobTitleID = ko.observable(0);
    this.jobTitleName = ko.observable('Job Title');
    
    // Retrieves a computed that will link to the given named activity adding the current
    // jobTitleID and a mustReturn URL to point this page so its remember the back route
    this.getJobUrlTo = function(name) {
        // Sample '/serviceProfessionalServices/' + jobTitleID()
        return ko.pureComputed(function() {
            return (
                '/' + name + '/' + this.jobTitleID() + '?mustReturn=jobtitles/' + this.jobTitleID() +
                '&returnText=' + this.jobTitleName()
            );
        }, this);
    };
    
    this.addresses = ko.observable([]);
    this.pricing = ko.observable([]);

    // Computed since it can check several externa loadings
    this.isLoading = ko.pureComputed(function() {
        return (
            app.model.serviceAddresses.state.isLoading() ||
            app.model.serviceProfessionalServices.state.isLoading()
        );
        
    }, this);
    
    this.addressesCount = ko.pureComputed(function() {
        
        // TODO l10n.
        // Use i18next plural localization support rather than this manual.
        var count = this.addresses().length,
            one = '1 location',
            more = ' locations';
        
        if (count === 1)
            return one;
        else
            // Small numbers, no need for formatting
            return count + more;

    }, this);
    
    this.pricingCount = ko.pureComputed(function() {
        
        // TODO l10n.
        // Use i18next plural localization support rather than this manual.
        var count = this.pricing().length,
            one = '1 service',
            more = ' services';
        
        if (count === 1)
            return one;
        else
            // Small numbers, no need for formatting
            return count + more;

    }, this);
    
}

},{"../components/Activity":90,"knockout":false}],35:[function(require,module,exports){
/**
    LearnMore activity
**/
'use strict';
var ko = require('knockout'),
    Activity = require('../components/Activity');

var A = Activity.extends(function LearnMoreActivity() {
    
    Activity.apply(this, arguments);

    this.accessLevel = null;
    this.viewModel = new ViewModel(this.app);
    // null for logo
    this.navBar = Activity.createSectionNavBar(null);
    this.navBar.rightAction(null);
});

exports.init = A.init;

A.prototype.show = function show(options) {
    Activity.prototype.show.call(this, options);
    
    if (options && options.route &&
        options.route.segments &&
        options.route.segments.length) {
        this.viewModel.profile(options.route.segments[0]);
    }
};

function ViewModel() {
    this.profile = ko.observable('client');
}

},{"../components/Activity":90,"knockout":false}],36:[function(require,module,exports){
/**
    LicensesCertifications activity
**/
'use strict';

var ko = require('knockout'),
    $ = require('jquery'),
    Activity = require('../components/Activity');

var A = Activity.extends(function LicensesCertificationsActivity() {

    Activity.apply(this, arguments);

    this.accessLevel = this.app.UserType.serviceProfessional;
    this.viewModel = new ViewModel(this.app);
    // Defaults settings for navBar.
    this.navBar = Activity.createSubsectionNavBar('Job Title');

    // On changing jobTitleID:
    // - load licenses/certifications
    /* TODO Uncomment and update on implementing REST API AppModel
    this.registerHandler({
        target: this.viewModel.jobTitleID,
        handler: function(jobTitleID) {
            if (jobTitleID) {
                // Get data for the Job title ID
                this.app.model.licensesCertifications.getList(jobTitleID)
                .then(function(list) {
                    // Save for use in the view
                    this.viewModel.list(list);
                }.bind(this))
                .catch(function (err) {
                    this.app.modals.showError({
                        title: 'There was an error while loading.',
                        error: err
                    });
                }.bind(this));
            }
            else {
                this.viewModel.list([]);
            }
        }.bind(this)
    });*/
    // TODO Remove on implemented REST API
    this.viewModel.list(testdata());
});

exports.init = A.init;

A.prototype.show = function show(options) {
    Activity.prototype.show.call(this, options);

    var params = options && options.route && options.route.segments;
    this.viewModel.jobTitleID(params[0] |0);
};

function ViewModel(app) {

    this.jobTitleID = ko.observable(0);
    this.list = ko.observableArray([]);
    
    this.isSyncing = app.model.licensesCertifications.state.isSyncing();
    this.isLoading = app.model.licensesCertifications.state.isLoading();

    this.addNew = function() {
        var url = '#!licensesCertificationsForm/' + this.jobTitleID(),
            cancelUrl = app.shell.currentRoute.url;
        var request = $.extend({}, this.requestData, {
            cancelLink: cancelUrl
        });
        app.shell.go(url, request);
    }.bind(this);
    
    this.selectItem = function(item) {
        var url = '/licensesCertificationsForm/' + this.jobTitleID() + '/' +
            item.licenseCertificationID() + '?mustReturn=' + 
            encodeURIComponent(app.shell.currentRoute.url) +
            '&returnText=' + encodeURIComponent('Certifications/Licenses');
        app.shell.go(url, this.requestData);
    }.bind(this);
}


               
// TODO SAME CODE AS IN verifications activity, to refactor and share
var Model = require('../models/Model');
function Verification(values) {
    Model(this);
    
    this.model.defProperties({
        name: ''
    }, values);
}
Verification.status = {
    confirmed: 1,
    pending: 2,
    revoked: 3,
    obsolete: 4
};
function enumGetName(value, enumList) {
    var found = null;
    Object.keys(enumList).some(function(k) {
        if (enumList[k] === value) {
            found = k;
            return true;
        }
    });
    return found;
}


/// TESTDATA
var UserLicenseCertification = require('../models/UserLicenseCertification');
var LicenseCertification = require('../models/LicenseCertification');
function testdata() {
    
    var base = {
        17: new LicenseCertification({
            licenseCertificationID: 17,
            name: 'Certified Massage Therapist (CMT)',
            stateProvinceID: 1,
            countryID: 1,
            description: 'Required to complete at least 500 hours of massage education and training at an approved massage therapy school.  CMTs also must undergo background checks, including fingerprinting and other identification verification procedures.',
            authority: 'The California Massage Therapy Council (CAMTC)',
            verificationWebsiteUrl: 'https://www.camtc.org/VerifyCertification.aspx',
            howToGetLicensedUrl: 'https://www.camtc.org/FormDownloads/CAMTCApplicationChecklist.pdf',
            optionGroup: 'Certified Massage',
            createdDate: new Date(),
            updatedDate: new Date()
        }),
        18: new LicenseCertification({
            licenseCertificationID: 18,
            name: 'Certified Massage Practitioner (CMP)',
            stateProvinceID: 1,
            countryID: 1,
            description: 'Generally must complete at least 250 hours of education and training.  CMPs also must undergo background checks, including fingerprinting and other identification verification procedures.',
            authority: 'The California Massage Therapy Council (CAMTC)',
            verificationWebsiteUrl: 'https://www.camtc.org/VerifyCertification.aspx',
            howToGetLicensedUrl: 'https://www.camtc.org/FormDownloads/CAMTCApplicationChecklist.pdf',
            optionGroup: 'Certified Massage',
            createdDate: new Date(),
            updatedDate: new Date()
        })
    };
    
    // Augment Model with related info
    function augment(m) {
        m.licenseCertification = ko.computed(function() {
            return base[this.licenseCertificationID()] || null;
        }, m);
        
        // TODO statusText and isStatus copied from verifications, dedupe/refactor
        m.statusText = ko.pureComputed(function() {
            // L18N
            var statusTextsenUS = {
                'verification.status.confirmed': 'Confirmed',
                'verification.status.pending': 'Pending',
                'verification.status.revoked': 'Revoked',
                'verification.status.obsolete': 'Obsolete'
            };
            var statusCode = enumGetName(this.statusID(), Verification.status);
            return statusTextsenUS['verification.status.' + statusCode];
        }, m);

        /**
            Check if verification has a given status by name
        **/
        m.isStatus = function (statusName) {
            var id = this.statusID();
            return Verification.status[statusName] === id;
        }.bind(m);
        
        return m;
    }

    return [
        augment(new UserLicenseCertification({
            userID: 141,
            jobTitleID: 106,
            statusID: 2,
            licenseCertificationID: 18,
            licenseCertificationNumber: 21341234,
            stateProvinceID: 1,
            countryID: 1,
            expirationDate: new Date(2016, 1, 20),
            lastVerifiedDate: new Date(2015, 3, 20),
            createdDate: new Date(),
            updatedDate: new Date()
        })),
        augment(new UserLicenseCertification({
            userID: 141,
            jobTitleID: 106,
            statusID: 1,
            licenseCertificationID: 17,
            licenseCertificationNumber: 987654321,
            stateProvinceID: 1,
            countryID: 1,
            expirationDate: new Date(2016, 1, 20),
            lastVerifiedDate: new Date(2015, 3, 20),
            createdDate: new Date(),
            updatedDate: new Date()
        }))
    ];
}

},{"../components/Activity":90,"../models/LicenseCertification":107,"../models/Model":113,"../models/UserLicenseCertification":133,"knockout":false}],37:[function(require,module,exports){
/**
    LicensesCertificationsForm activity
**/
'use strict';

var Activity = require('../components/Activity'),
    ko = require('knockout');

var A = Activity.extends(function LicensesCertificationsFormActivity() {
    
    Activity.apply(this, arguments);
    
    this.viewModel = new ViewModel(this.app);
    this.accessLevel = this.app.UserType.serviceProfessional;

    this.navBar = Activity.createSubsectionNavBar('Certifications/Licenses');
    this.defaultNavBarSettings = this.navBar.model.toPlainObject(true);
});

exports.init = A.init;

A.prototype.updateNavBarState = function updateNavBarState() {

    var link = this.requestData.cancelLink || '/licensesCertifications/';
    
    if (this.viewModel.isNew())
        this.convertToCancelAction(this.navBar.leftAction(), link);
    else
        this.navBar.model.updateWith(this.defaultNavBarSettings, true);
};

A.prototype.show = function show(state) {
    Activity.prototype.show.call(this, state);
    
    // Reset
    this.viewModel.version(null);

    // Params
    var params = state && state.route && state.route.segments || [];
    
    this.viewModel.jobTitleID(params[0] |0);
    this.viewModel.licenseCertificationID(params[1] |0);
    
    this.updateNavBarState();
    
    // TODO Remove when AppModel
    var ModelVersion = require('../utils/ModelVersion'),
        UserLicenseCertification = require('../models/UserLicenseCertification');
    
    if (this.viewModel.isNew()) {
        this.viewModel.version(new ModelVersion(new UserLicenseCertification()));
    }
    else {
        this.viewModel.version(new ModelVersion(new UserLicenseCertification({
            userID: 141,
            jobTitleID: 106,
            statusID: 2,
            licenseCertificationID: 18,
            licenseCertificationNumber: 21341234,
            stateProvinceID: 1,
            countryID: 1,
            expirationDate: new Date(2016, 1, 20),
            lastVerifiedDate: new Date(2015, 3, 20),
            createdDate: new Date(),
            updatedDate: new Date()
        })));
    }
    
    
    // TODO IT DOES NOT WORKS THIS WAY: in the website dahsboard, the licenseID is provided
    // to the form, because there is a short list of them available, NOT auto-generated.
    // CHECK if put a dropdown selection or list selection here and then show the form or 
    // put the list of possible on the listing page (at /licensesCertifications)
    
    if (this.viewModel.licenseCertificationID() === 0) {
        // NEW one
        /* TODO Uncomment when AppModel
        this.viewModel.version(this.app.model.licensesCertifications.newItem());
        */
    }
    else {
        // LOAD
        /* TODO Uncomment when AppModel
        this.app.model.education.createItemVersion(this.viewModel.educationID())
        .then(function (educationVersion) {
            if (educationVersion) {
                this.viewModel.version(educationVersion);
            } else {
                throw new Error('No data');
            }
        }.bind(this))
        .catch(function (err) {
            this.app.modals.showError({
                title: 'There was an error while loading.',
                error: err
            })
            .then(function() {
                // On close modal, go back
                this.app.shell.goBack();
            }.bind(this));
        }.bind(this));*/
    }
};

function ViewModel(app) {

    this.licenseCertificationID = ko.observable(0);
    this.jobTitleID = ko.observable(0);
    // TODO Uncomment when appmodel
    this.isLoading = ko.observable(false); // app.model.licensesCertifications.state.isLoading;
    this.isSaving = ko.observable(false); //app.model.licensesCertifications.state.isSaving;
    this.isSyncing = ko.observable(false); //app.model.licensesCertifications.state.isSyncing;
    this.isDeleting = ko.observable(false); //app.model.licensesCertifications.state.isDeleting;
    this.isLocked = ko.observable(false); /*ko.computed(function() {
        return this.isDeleting() || app.model.licensesCertifications.state.isLocked();
    }, this);*/
    
    this.isNew = ko.pureComputed(function() {
        return this.licenseCertificationID() === 0;
    }, this);
    
    this.version = ko.observable(null);
    this.item = ko.pureComputed(function() {
        var v = this.version();
        if (v) {
            return v.version;
        }
        return null;
    }, this);
    
    // Fields for the new-certification-file
    this.stateProvinceID = ko.observable(0);
    this.file = ko.observable('');

    this.unsavedChanges = ko.pureComputed(function() {
        var v = this.version();
        return v && v.areDifferent();
    }, this);
    
    this.deleteText = ko.pureComputed(function() {
        return (
            this.isDeleting() ? 
                'Deleting...' : 
                'Delete'
        );
    }, this);

    this.save = function() {
        app.model.licensesCertifications.setItem(this.item().model.toPlainObject())
        .then(function(serverData) {
            // Update version with server data.
            this.item().model.updateWith(serverData);
            // Push version so it appears as saved
            this.version().push({ evenIfObsolete: true });
            // Go out
            app.successSave();
        }.bind(this))
        .catch(function(err) {
            app.modals.showError({
                title: 'There was an error while saving.',
                error: err
            });
        });

    }.bind(this);
    
    this.confirmRemoval = function() {
        // L18N
        app.modals.confirm({
            title: 'Delete',
            message: 'Are you sure? The operation cannot be undone.',
            yes: 'Delete',
            no: 'Keep'
        })
        .then(function() {
            this.remove();
        }.bind(this));
    }.bind(this);

    this.remove = function() {
        app.model.licensesCertifications.delItem(this.jobTitleID(), this.licenseCertificationID())
        .then(function() {
            // Go out
            // TODO: custom message??
            app.successSave();
        }.bind(this))
        .catch(function(err) {
            app.modals.showError({
                title: 'There was an error while deleting.',
                error: err
            });
        });
    }.bind(this);
    
    // TODO COMPLETE; FROM A MODEL, REMOTE?
    this.statesProvinces = ko.computed(function() {
        // BLOB copy:
        return [{"stateProvinceID":"23","name":"Alabama"},{"stateProvinceID":"49","name":"Alaska"},{"stateProvinceID":"52","name":"American Samoa"},{"stateProvinceID":"48","name":"Arizona"},{"stateProvinceID":"26","name":"Arkansas"},{"stateProvinceID":"60","name":"Armed Forces Americas (except Canada)"},{"stateProvinceID":"61","name":"Armed Forces Canada, Europe, Middle East, and Africa"},{"stateProvinceID":"62","name":"Armed Forces Pacific"},{"stateProvinceID":"1","name":"California"},{"stateProvinceID":"38","name":"Colorado"},{"stateProvinceID":"6","name":"Connecticut"},{"stateProvinceID":"2","name":"Delaware"},{"stateProvinceID":"51","name":"District of Columbia"},{"stateProvinceID":"57","name":"Federated States of Micronesia"},{"stateProvinceID":"28","name":"Florida"},{"stateProvinceID":"5","name":"Georgia"},{"stateProvinceID":"53","name":"Guam"},{"stateProvinceID":"50","name":"Hawaii"},{"stateProvinceID":"43","name":"Idaho"},{"stateProvinceID":"22","name":"Illinois"},{"stateProvinceID":"20","name":"Indiana"},{"stateProvinceID":"30","name":"Iowa"},{"stateProvinceID":"34","name":"Kansas"},{"stateProvinceID":"16","name":"Kentucky"},{"stateProvinceID":"19","name":"Louisiana"},{"stateProvinceID":"24","name":"Maine"},{"stateProvinceID":"58","name":"Marshall Islands"},{"stateProvinceID":"8","name":"Maryland"},{"stateProvinceID":"7","name":"Massachusetts"},{"stateProvinceID":"27","name":"Michigan"},{"stateProvinceID":"32","name":"Minnesota"},{"stateProvinceID":"21","name":"Mississippi"},{"stateProvinceID":"25","name":"Missouri"},{"stateProvinceID":"41","name":"Montana"},{"stateProvinceID":"37","name":"Nebraska"},{"stateProvinceID":"36","name":"Nevada"},{"stateProvinceID":"10","name":"New Hampshire"},{"stateProvinceID":"4","name":"New Jersey"},{"stateProvinceID":"47","name":"New Mexico"},{"stateProvinceID":"12","name":"New York"},{"stateProvinceID":"13","name":"North Carolina"},{"stateProvinceID":"39","name":"North Dakota"},{"stateProvinceID":"54","name":"Northern Mariana Islands"},{"stateProvinceID":"18","name":"Ohio"},{"stateProvinceID":"46","name":"Oklahoma"},{"stateProvinceID":"33","name":"Oregon"},{"stateProvinceID":"59","name":"Palau"},{"stateProvinceID":"3","name":"Pennsylvania"},{"stateProvinceID":"55","name":"Puerto Rico"},{"stateProvinceID":"14","name":"Rhode Island"},{"stateProvinceID":"9","name":"South Carolina"},{"stateProvinceID":"40","name":"South Dakota"},{"stateProvinceID":"17","name":"Tennessee"},{"stateProvinceID":"29","name":"Texas"},{"stateProvinceID":"56","name":"U.S. Virgin Islands"},{"stateProvinceID":"45","name":"Utah"},{"stateProvinceID":"15","name":"Vermont"},{"stateProvinceID":"11","name":"Virginia"},{"stateProvinceID":"42","name":"Washington"},{"stateProvinceID":"35","name":"West Virginia"},{"stateProvinceID":"31","name":"Wisconsin"},{"stateProvinceID":"44","name":"Wyoming"}];
    });
}

},{"../components/Activity":90,"../models/UserLicenseCertification":133,"../utils/ModelVersion":145,"knockout":false}],38:[function(require,module,exports){
/**
    Login activity
**/
'use strict';

var ko = require('knockout'),
    Activity = require('../components/Activity');

var A = Activity.extends(function LoginActivity() {
    
    Activity.apply(this, arguments);

    this.accessLevel = this.app.UserType.anonymous;
    this.viewModel = new ViewModel(this.app);
    this.navBar = Activity.createSectionNavBar('Log in');
    this.navBar.rightAction(null);
    
    // Perform log-in request when is requested by the form:
    this.registerHandler({
        target: this.viewModel.isLogingIn,
        handler: function(v) {
            if (v === true) {

                // Perform loging

                // Notify state:
                var $btn = this.$activity.find('[type="submit"]');
                $btn.button('loading');

                // Clear previous error so makes clear we
                // are attempting
                this.viewModel.loginError('');

                var ended = function ended() {
                    this.viewModel.isLogingIn(false);
                    $btn.button('reset');
                }.bind(this);

                // After clean-up error (to force some view updates),
                // validate and abort on error
                // Manually checking error on each field
                if (this.viewModel.username.error() ||
                    this.viewModel.password.error()) {
                    this.viewModel.loginError('Review your data');
                    ended();
                    return;
                }

                this.app.model.login(
                    this.viewModel.username(),
                    this.viewModel.password()
                ).then(function(/*loginData*/) {

                    this.viewModel.loginError('');
                    ended();

                    // Remove form data
                    this.viewModel.username('');
                    this.viewModel.password('');

                    this.app.goDashboard();

                }.bind(this)).catch(function(err) {

                    var msg = err && err.responseJSON && err.responseJSON.errorMessage ||
                        err && err.statusText ||
                        'Invalid username or password';

                    this.viewModel.loginError(msg);
                    ended();
                }.bind(this));
            }
        }.bind(this)
    });
    
    // Focus first bad field on error
    this.registerHandler({
        target: this.viewModel.loginError,
        handler: function(err) {
            // Login is easy since we mark both unique fields
            // as error on loginError (its a general form error)
            var input = this.$activity.find(':input').get(0);
            if (err)
                input.focus();
            else
                input.blur();
        }.bind(this)
    });
});

exports.init = A.init;

var FormCredentials = require('../viewmodels/FormCredentials');

function ViewModel() {

    var credentials = new FormCredentials();    
    this.username = credentials.username;
    this.password = credentials.password;

    this.loginError = ko.observable('');
    
    this.isLogingIn = ko.observable(false);
    
    this.performLogin = function performLogin() {

        this.isLogingIn(true);        
    }.bind(this);
}

},{"../components/Activity":90,"../viewmodels/FormCredentials":178,"knockout":false}],39:[function(require,module,exports){
/**
    Logout activity
**/
'use strict';

var Activity = require('../components/Activity');

var A = Activity.extends(function LogoutActivity() {
    
    Activity.apply(this, arguments);

    this.accessLevel = this.app.UserType.loggedUser;
});

exports.init = A.init;

A.prototype.show = function show(state) {
    Activity.prototype.show.call(this, state);
    
    this.app.model.logout().then(function() {
        // Anonymous user again
        var newAnon = this.app.model.user().constructor.newAnonymous();
        this.app.model.user().model.updateWith(newAnon);

        // Go index
        this.app.shell.go('/');
        
    }.bind(this));
};

},{"../components/Activity":90}],40:[function(require,module,exports){
/**
    MarketplaceJobtitles activity
**/
'use strict';

var Activity = require('../components/Activity'),
    ko = require('knockout');

var A = Activity.extends(function MarketplaceJobtitlesActivity() {
    
    Activity.apply(this, arguments);
    
    this.accessLevel = this.app.UserType.serviceProfessional;
    this.viewModel = new ViewModel(this.app);
    this.navBar = Activity.createSubsectionNavBar('Marketplace profile', {
        backLink: '/marketplaceProfile'
    });

    // On changing jobTitleID:
    // - load addresses
    // - load job title information
    // - load pricing
    this.registerHandler({
        target: this.viewModel.jobTitleID,
        handler: function(jobTitleID) {

            if (jobTitleID) {
                ////////////
                // Addresses
                this.app.model.serviceAddresses.getList(jobTitleID)
                .then(function(list) {

                    list = this.app.model.serviceAddresses.asModel(list);
                    this.viewModel.addresses(list);

                }.bind(this))
                .catch(function (err) {
                    this.app.modals.showError({
                        title: 'There was an error while loading addresses.',
                        error: err
                    });
                }.bind(this));
                
                ////////////
                // Pricing/Services
                this.app.model.serviceProfessionalServices.getList(jobTitleID)
                .then(function(list) {

                    list = this.app.model.serviceProfessionalServices.asModel(list);
                    this.viewModel.pricing(list);

                }.bind(this))
                .catch(function (err) {
                    this.app.modals.showError({
                        title: 'There was an error while loading services.',
                        error: err
                    });
                }.bind(this));
                
                ////////////
                // Job Title
                // Get data for the Job Title and User Profile
                this.app.model.userJobProfile.getUserJobTitleAndJobTitle(jobTitleID)
                //this.app.model.jobTitles.getJobTitle(jobTitleID)
                .then(function(job) {
                    // Fill the job title record
                    this.viewModel.jobTitle(job.jobTitle);
                    this.viewModel.userJobTitle(job.userJobTitle);
                }.bind(this))
                .catch(function(err) {
                    this.app.modals.showError({
                        title: 'There was an error while loading your job title.',
                        error: err
                    });
                }.bind(this));
            }
            else {
                this.viewModel.addresses([]);
                this.viewModel.pricing([]);
            }
        }.bind(this)
    });
});

exports.init = A.init;

A.prototype.show = function show(state) {
    Activity.prototype.show.call(this, state);

    // Reset: avoiding errors because persisted data for different ID on loading
    // or outdated info forcing update
    this.viewModel.jobTitleID(0);

    // Parameters
    var params = state && state.route && state.route.segments || {};
    
    // Set the job title
    var jobID = params[0] |0;
    this.viewModel.jobTitleID(jobID);
};

function ViewModel(app) {
    
    this.jobTitleID = ko.observable(0);
    this.jobTitle = ko.observable(null);
    this.userJobTitle = ko.observable(null);
    this.jobTitleName = ko.pureComputed(function() {
        var j = this.jobTitle();
        return j && j.singularName() || 'Job Title';
    }, this);
    
    // Retrieves a computed that will link to the given named activity adding the current
    // jobTitleID and a mustReturn URL to point this page so its remember the back route
    this.getJobUrlTo = function(name) {
        // Sample '/serviceProfessionalServices/' + jobTitleID()
        return ko.pureComputed(function() {
            return (
                '/' + name + '/' + this.jobTitleID() + '?mustReturn=marketplaceJobtitles/' + this.jobTitleID() +
                '&returnText=' + this.jobTitleName()
            );
        }, this);
    };
    
    this.isActiveStatus = ko.pureComputed({
        read: function() {
            var j = this.userJobTitle();
            return j && j.statusID() === 1 || false;
        },
        write: function(v) {
            var status = this.userJobTitle() && this.userJobTitle().statusID();
            if (v === true && status === 3) {
                this.userJobTitle().statusID(1);
            }
            else if (v === false && status === 1) {
                this.userJobTitle().statusID(3);
            }
            // TODO Push change to back-end
        },
        owner: this
    });
    
    this.statusLabel = ko.pureComputed(function() {
        return this.isActiveStatus() ? 'ON' : 'OFF';
    }, this);
    
    this.cancellationPolicyLabel = ko.pureComputed(function() {
        var pid = this.userJobTitle() && this.userJobTitle().cancellationPolicyID();
        // TODO fetch policy ID label
        return pid === 3 ? 'Flexible' : pid === 2 ? 'Moderate' : 'Strict';
    }, this);
    
    this.instantBooking = ko.pureComputed(function() {
        return this.userJobTitle() && this.userJobTitle().instantBooking();
    }, this);
    
    this.instantBookingLabel = ko.pureComputed(function() {
        return this.instantBooking() ? 'ON' : 'OFF';
    }, this);
    
    this.toggleInstantBooking = function() {
        var current = this.instantBooking();
        if (this.userJobTitle()) {
            this.userJobTitle().instantBooking(!current);
            // TODO Push change to server
        }
    };

    /// Related models information
    
    this.addresses = ko.observable([]);
    this.pricing = ko.observable([]);
    this.licenseCertifications = ko.observable([]);
    this.workPhotos = ko.observable([]);

    // Computed since it can check several externa loadings
    this.isLoading = ko.pureComputed(function() {
        return (
            app.model.serviceAddresses.state.isLoading() ||
            app.model.serviceProfessionalServices.state.isLoading()
        );
        
    }, this);
    
    this.addressesCount = ko.pureComputed(function() {
        
        // TODO l10n.
        // Use i18next plural localization support rather than this manual.
        var count = this.addresses().length,
            one = '1 location',
            more = ' locations';
        
        if (count === 1)
            return one;
        else
            // Small numbers, no need for formatting
            return count + more;

    }, this);
    
    this.pricingCount = ko.pureComputed(function() {
        
        // TODO l10n.
        // Use i18next plural localization support rather than this manual.
        var count = this.pricing().length,
            one = '1 service',
            more = ' services';
        
        if (count === 1)
            return one;
        else
            // Small numbers, no need for formatting
            return count + more;

    }, this);
    
    this.licensesCertificationsSummary = ko.pureComputed(function() {
        var lc = this.licenseCertifications();
        if (lc && lc.length) {
            // TODO Detect 
            var verified = 0,
                pending = 0;
            lc.forEach(function(l) {
                if (l && l.statusID() === 1)
                    verified++;
                else if (l && l.statusID() === 2)
                    pending++;
            });
            // L18N
            return verified + ' verified, ' + pending + ' pending';
        }
        else {
            // L18N
            return 'There are not verifications';
        }
    }, this);
    
    this.workPhotosSummary = ko.pureComputed(function() {
        var wp = this.workPhotos();
        // L18N
        if (wp && wp.length > 1)
            return wp.length + ' images';
        else if (wp && wp.length === 1)
            return '1 image';
        else
            return 'No images';
    }, this);
    
}

},{"../components/Activity":90,"knockout":false}],41:[function(require,module,exports){
/**
    MarketplaceProfile activity
**/
'use strict';

var Activity = require('../components/Activity'),
    UserJobProfileViewModel = require('../viewmodels/UserJobProfile'),
    ko = require('knockout'),
    moment = require('moment');

var A = Activity.extends(function MarketplaceProfileActivity() {

    Activity.apply(this, arguments);

    this.accessLevel = this.app.UserType.serviceProfessional;
    this.viewModel = new ViewModel(this.app);
    this.navBar = Activity.createSectionNavBar('Marketplace Profile');
    
    this.viewModel.showMarketplaceInfo(true);
    this.viewModel.baseUrl('/marketplaceJobtitles');
});

exports.init = A.init;

A.prototype.show = function show(state) {
    Activity.prototype.show.call(this, state);

    this.viewModel.sync();
};

function ViewModel(app) {
    // Just use the job profile view model (created for the job title listing
    // at 'scheduling'), instance, extend and return
    var jobVm = new UserJobProfileViewModel(app);
    
    // TODO read verifications count from model; computed
    jobVm.verificationsCount = ko.observable(3);
    
    jobVm.displayedVerificationsNumber = ko.computed(function() {
        var verificationsCount = this.verificationsCount();
        // Format
        // L18N
        return '(' + verificationsCount + ')';
    }, jobVm);

    jobVm.verificationsSecondaryText = ko.computed(function() {
        // TODO read count limit
        var verificationsLimit = 10,
            count = this.verificationsCount(),
            remaining = verificationsLimit - count;
        // Format
        // L18N
        return remaining > 0 ? 'You can add up to ' + remaining + ' more' : 'You cannot add more';
    }, jobVm);
    
    jobVm.displayedLastBackgroundCheck = ko.computed(function() {
        // TODO read last check date
        var lastDate = new Date(2014, 10, 14);
        return moment(lastDate).format('L');
    }, jobVm);

    return jobVm;
}

},{"../components/Activity":90,"../viewmodels/UserJobProfile":186,"knockout":false,"moment":false}],42:[function(require,module,exports){
/**
    OwnerInfo activity
**/
'use strict';

var Activity = require('../components/Activity');

var A = Activity.extends(function OwnerInfoActivity() {
    
    Activity.apply(this, arguments);

    this.accessLevel = this.app.UserType.loggedUser;
    
    this.navBar = Activity.createSubsectionNavBar('Account', {
        backLink: 'account'
    });
});

exports.init = A.init;

},{"../components/Activity":90}],43:[function(require,module,exports){
/**
    PrivacySettings activity
**/
'use strict';

var Activity = require('../components/Activity');
var ko = require('knockout');

var A = Activity.extends(function PrivacySettingsActivity() {
    
    Activity.apply(this, arguments);
    
    this.viewModel = new ViewModel(this.app);
    this.accessLevel = this.app.UserType.loggedUser;

    this.navBar = Activity.createSubsectionNavBar('Account', {
        backLink: 'account'
    });
    
    this.registerHandler({
        target: this.app.model.privacySettings,
        event: 'error',
        handler: function(err) {
            var msg = err.task === 'save' ? 'Error saving privacy settings.' : 'Error loading privacy settings.';
            this.app.modals.showError({
                title: msg,
                error: err && err.task && err.error || err
            });
        }.bind(this)
    });
});

exports.init = A.init;

A.prototype.show = function show(state) {
    Activity.prototype.show.call(this, state);
    
        // Keep data updated:
    this.app.model.privacySettings.sync();
    // Discard any previous unsaved edit
    this.viewModel.discard();
};

function ViewModel(app) {

    var privacySettings = app.model.privacySettings;

    var settingsVersion = privacySettings.newVersion();
    settingsVersion.isObsolete.subscribe(function(itIs) {
        if (itIs) {
            // new version from server while editing
            // FUTURE: warn about a new remote version asking
            // confirmation to load them or discard and overwrite them;
            // the same is need on save(), and on server response
            // with a 509:Conflict status (its body must contain the
            // server version).
            // Right now, just overwrite current changes with
            // remote ones:
            settingsVersion.pull({ evenIfNewer: true });
        }
    });
    
    // Actual data for the form:
    this.settings = settingsVersion.version;

    this.isLocked = privacySettings.isLocked;

    this.submitText = ko.pureComputed(function() {
        return (
            this.isLoading() ? 
                'loading...' : 
                this.isSaving() ? 
                    'saving...' : 
                    'Save'
        );
    }, privacySettings);
    
    this.discard = function discard() {
        settingsVersion.pull({ evenIfNewer: true });
    }.bind(this);

    this.save = function save() {
        settingsVersion.pushSave()
        .then(function() {
            app.successSave();
        })
        .catch(function() {
            // catch error, managed on event
        });
    }.bind(this);
}

},{"../components/Activity":90,"knockout":false}],44:[function(require,module,exports){
/**
    Provile activity
    
    Visualizes the public profile of a user, or current user
**/
'use strict';

var ko = require('knockout');

var Activity = require('../components/Activity');

var A = Activity.extends(function ProfileActivity() {
    
    Activity.apply(this, arguments);

    this.accessLevel = null;
    this.viewModel = new ViewModel(this.app);
    // null for logo
    this.navBar = Activity.createSectionNavBar(null);
});

exports.init = A.init;

A.prototype.show = function show(options) {
    Activity.prototype.show.call(this, options);
    
    var params = options.route && options.route.segments;
    this.viewModel.requestedUserID(params[0] |0);
};

function ViewModel(app) {

    this.requestedUserID = ko.observable(0);
    this.isLoading = ko.observable(false);
    this.isSyncing = ko.observable(false);
    
    this.profile = ko.pureComputed(function() {
        if (this.requestedUserID() === 0) {
            // Show current user profile
            return app.model.user();
        }
        else {
            // TODO: load another user profile
        }
    }, this);
}

},{"../components/Activity":90,"knockout":false}],45:[function(require,module,exports){
/**
    ProfilePictureBio activity
**/
'use strict';

var Activity = require('../components/Activity');
var ko = require('knockout');

var A = Activity.extends(function ProfilePictureBioActivity() {
    
    Activity.apply(this, arguments);

    this.viewModel = new ViewModel(this.app);
    this.accessLevel = this.app.UserType.loggedUser;
    
    this.navBar = Activity.createSubsectionNavBar('Marketplace profile', {
        backLink: 'marketplaceProfile'
    });
    
    this.registerHandler({
        target: this.app.model.marketplaceProfile,
        event: 'error',
        handler: function(err) {
            var msg = err.task === 'save' ? 'Error saving your data.' : 'Error loading your data.';
            this.app.modals.showError({
                title: msg,
                error: err && err.error || err
            });
        }.bind(this)
    });
});

exports.init = A.init;

A.prototype.show = function show(state) {
    Activity.prototype.show.call(this, state);
    
    // Discard any previous unsaved edit
    this.viewModel.discard();
    
    // Keep data updated:
    this.app.model.marketplaceProfile.sync();
};

function ViewModel(app) {

    // Marketplace Profile
    var marketplaceProfile = app.model.marketplaceProfile;
    var profileVersion = marketplaceProfile.newVersion();
    profileVersion.isObsolete.subscribe(function(itIs) {
        if (itIs) {
            // new version from server while editing
            // FUTURE: warn about a new remote version asking
            // confirmation to load them or discard and overwrite them;
            // the same is need on save(), and on server response
            // with a 509:Conflict status (its body must contain the
            // server version).
            // Right now, just overwrite current changes with
            // remote ones:
            profileVersion.pull({ evenIfNewer: true });
        }
    });
    
    // Actual data for the form:
    this.profile = profileVersion.version;
    
    // Control observables: special because must a mix
    // of the both remote models used in this viewmodel
    this.isLocked = marketplaceProfile.isLocked;
    this.isLoading = marketplaceProfile.isLoading;
    this.isSaving = marketplaceProfile.isSaving;

    this.submitText = ko.pureComputed(function() {
        return (
            this.isLoading() ? 
                'loading...' : 
                this.isSaving() ? 
                    'saving...' : 
                    'Save'
        );
    }, this);

    // Actions

    this.discard = function discard() {
        profileVersion.pull({ evenIfNewer: true });
    }.bind(this);

    this.save = function save() {
        profileVersion.pushSave()
        .then(function() {
            app.successSave();
        })
        .catch(function() {
            // catch error, managed on event
        });
    }.bind(this);
}

},{"../components/Activity":90,"knockout":false}],46:[function(require,module,exports){
/**
    Scheduling activity
**/
'use strict';

var Activity = require('../components/Activity'),
    UserJobProfileViewModel = require('../viewmodels/UserJobProfile');

var A = Activity.extends(function SchedulingActivity() {
    
    Activity.apply(this, arguments);

    this.accessLevel = this.app.UserType.loggedUser;
    this.viewModel = new UserJobProfileViewModel(this.app);
    this.navBar = Activity.createSectionNavBar('Scheduling');
});

exports.init = A.init;

A.prototype.show = function show(state) {
    Activity.prototype.show.call(this, state);

    this.viewModel.sync();
};

},{"../components/Activity":90,"../viewmodels/UserJobProfile":186}],47:[function(require,module,exports){
/**
    SchedulingPreferences activity
**/
'use strict';

var Activity = require('../components/Activity');
var ko = require('knockout');
var moment = require('moment');

var A = Activity.extends(function SchedulingPreferencesActivity() {
    
    Activity.apply(this, arguments);
    
    this.viewModel = new ViewModel(this.app);
    this.accessLevel = this.app.UserType.serviceProfessional;

    this.navBar = Activity.createSubsectionNavBar('Scheduling', {
        backLink: 'scheduling'
    });
    
    this.registerHandler({
        target: this.app.model.schedulingPreferences,
        event: 'error',
        handler: function(err) {
            var msg = err.task === 'save' ? 'Error saving scheduling preferences.' : 'Error loading scheduling preferences.';
            this.app.modals.showError({
                title: msg,
                error: err && err.task && err.error || err
            });
        }.bind(this)
    });
});

exports.init = A.init;

A.prototype.show = function show(state) {
    Activity.prototype.show.call(this, state);
    
    // Keep data updated:
    this.app.model.schedulingPreferences.sync();
    // Discard any previous unsaved edit
    this.viewModel.discard();
};

function ViewModel(app) {

    var schedulingPreferences = app.model.schedulingPreferences;

    var prefsVersion = schedulingPreferences.newVersion();
    prefsVersion.isObsolete.subscribe(function(itIs) {
        if (itIs) {
            // new version from server while editing
            // FUTURE: warn about a new remote version asking
            // confirmation to load them or discard and overwrite them;
            // the same is need on save(), and on server response
            // with a 509:Conflict status (its body must contain the
            // server version).
            // Right now, just overwrite current changes with
            // remote ones:
            prefsVersion.pull({ evenIfNewer: true });
        }
    });
    
    // Actual data for the form:
    this.prefs = prefsVersion.version;

    this.isLocked = schedulingPreferences.isLocked;

    this.submitText = ko.pureComputed(function() {
        return (
            this.isLoading() ? 
                'loading...' : 
                this.isSaving() ? 
                    'saving...' : 
                    'Save'
        );
    }, schedulingPreferences);
    
    this.discard = function discard() {
        prefsVersion.pull({ evenIfNewer: true });
    }.bind(this);

    this.save = function save() {
        prefsVersion.pushSave()
        .then(function() {
            app.successSave();
        })
        .catch(function() {
            // catch error, managed on event
        });
    }.bind(this);
    
    this.incrementsExample = ko.pureComputed(function() {
        
        var str = 'e.g. ',
            incSize = this.incrementsSizeInMinutes(),
            m = moment({ hour: 10, minute: 0 }),
            hours = [m.format('HH:mm')];
        
        for (var i = 1; i < 4; i++) {
            hours.push(
                m.add(incSize, 'minutes')
                .format('HH:mm')
            );
        }
        str += hours.join(', ');
        
        return str;
        
    }, this.prefs);
}

},{"../components/Activity":90,"knockout":false,"moment":false}],48:[function(require,module,exports){
/**
    Service Addresses activity
**/
'use strict';

var ko = require('knockout'),
    $ = require('jquery'),
    Activity = require('../components/Activity');

var A = Activity.extends(function ServiceAddressesActivity() {

    Activity.apply(this, arguments);

    this.accessLevel = this.app.UserType.serviceProfessional;
    this.viewModel = new ViewModel(this.app);
    // Defaults settings for navBar.
    this.navBar = Activity.createSubsectionNavBar('Job Title', {
        backLink: '/scheduling'
    });
    // Save defaults to restore on updateNavBarState when needed:
    this.defaultLeftAction = this.navBar.leftAction().model.toPlainObject();

    // On changing jobTitleID:
    // - load addresses
    this.registerHandler({
        target: this.viewModel.jobTitleID,
        handler: function(jobTitleID) {
            if (jobTitleID) {
                // Get data for the Job title ID
                this.app.model.jobTitles.getJobTitle(jobTitleID)
                .then(function(jobTitle) {
                    // Save for use in the view
                    this.viewModel.jobTitle(jobTitle);
                    // Update navbar (may indicate the jobTitle name)
                    this.updateNavBarState();
                    
                    // Get addresses
                    return this.app.model.serviceAddresses.getList(jobTitleID);
                }.bind(this))
                .then(function(list) {

                    list = this.app.model.serviceAddresses.asModel(list);
                    this.viewModel.serviceAddresses.sourceAddresses(list);

                }.bind(this))
                .catch(function (err) {
                    this.app.modals.showError({
                        title: 'There was an error while loading.',
                        error: err
                    });
                }.bind(this));
            }
            else {
                this.viewModel.serviceAddresses.sourceAddresses([]);
                this.viewModel.jobTitle(null);
                this.updateNavBarState();
            }
        }.bind(this)
    });
    
    // Go back with the selected address when triggered in the form/view
    this.viewModel.returnSelected = function(addressID, jobTitleID) {
        // Pass the selected client in the info
        this.requestData.selectedAddressID = addressID;
        this.requestData.selectedJobTitleID = jobTitleID;
        // And go back
        this.app.shell.goBack(this.requestData);
    }.bind(this);
    
    this.returnRequest = function returnRequest() {
        this.app.shell.goBack(this.requestData);
    }.bind(this);
});

exports.init = A.init;

A.prototype.applyOwnNavbarRules = function() {
    //jshint maxcomplexity:10
    
    var itIs = this.viewModel.serviceAddresses.isSelectionMode();

    if (this.requestData.title) {
        // Replace title by title if required
        this.navBar.title(this.requestData.title);
    }
    else {
        // Title must be empty
        this.navBar.title('');
    }

    if (this.requestData.cancelLink) {
        this.convertToCancelAction(this.navBar.leftAction(), this.requestData.cancelLink, this.requestData);
    }
    else {
        // Reset to defaults, or given title:
        this.navBar.leftAction().model.updateWith(this.defaultLeftAction);
        if (this.requestData.navTitle)
            this.navBar.leftAction().text(this.requestData.navTitle);

        var jid = this.viewModel.jobTitleID(),
            jname = this.viewModel.jobTitle() && this.viewModel.jobTitle().singularName() || 'Scheduling',
            url = this.mustReturnTo || (jid && '/jobtitles/' + jid || '/scheduling');

        this.navBar.leftAction().link(url);
        this.navBar.leftAction().text(jname);
    }

    if (itIs && !this.requestData.cancelLink) {
        // Uses a custom handler so it returns keeping the given state:
        this.navBar.leftAction().handler(this.returnRequest);
    }
    else if (!this.requestData.cancelLink) {
        this.navBar.leftAction().handler(null);
    }
};

A.prototype.updateNavBarState = function updateNavBarState() {
    //jshint maxcomplexity:12

    var itIs = this.viewModel.serviceAddresses.isSelectionMode();
    
    this.viewModel.headerText(itIs ? 'Select or add a service location' : 'Locations');

    // Perform updates that apply this request:
    this.app.model.onboarding.updateNavBar(this.navBar) ||
    //this.app.applyNavbarMustReturn(this.requestData) ||
    this.applyOwnNavbarRules();
};

A.prototype.show = function show(options) {
    Activity.prototype.show.call(this, options);
    
    // Remember route to go back, from a request of 'mustReturn' or last requested
    this.mustReturnTo = this.requestData.route.query.mustReturn || this.mustReturnTo;

    // Reset: avoiding errors because persisted data for different ID on loading
    // or outdated info forcing update
    this.viewModel.jobTitleID(0);
    this.viewModel.requestData = this.requestData;

    this.viewModel.serviceAddresses.isSelectionMode(options.selectAddress === true);
    this.viewModel.clientID(options.clientID || null);

    var params = options && options.route && options.route.segments;
    var jobTitleID = params[0] |0;
    
    // Check if it comes from an addressEditor that
    // received the flag 'returnNewAsSelected' and an
    // addressID: we were in selection mode->creating address->must
    // return the just created address to the previous page
    if (options.returnNewAsSelected === true &&
        options.addressID) {
        
        setTimeout(function() {
            delete options.returnNewAsSelected;
            this.viewModel.returnSelected(options.addressID, jobTitleID);
        }.bind(this), 1);
        // quick return
        return;
    }

    this.viewModel.jobTitleID(jobTitleID);

    this.updateNavBarState();
    
    if (jobTitleID === 0) {
        this.viewModel.jobTitles.sync();
    }
};

var UserJobProfile = require('../viewmodels/UserJobProfile'),
    ServiceAddresses = require('../viewmodels/ServiceAddresses');

function ViewModel(app) {
    
    this.serviceAddresses = new ServiceAddresses();

    this.headerText = ko.observable('Locations');
    
    this.jobTitleID = ko.observable(0);
    this.jobTitle = ko.observable(null);
    // Optionally, some times a clientID can be passed in order to create
    // a location for that client where perform a work.
    this.clientID = ko.observable(null);
    
    this.jobTitles = new UserJobProfile(app);
    this.jobTitles.baseUrl('/serviceAddress');
    this.jobTitles.selectJobTitle = function(jobTitle) {
        
        this.jobTitleID(jobTitle.jobTitleID());
        
        return false;
    }.bind(this);

    this.isSyncing = app.model.serviceAddresses.state.isSyncing();
    this.isLoading = ko.computed(function() {
        var add = app.model.serviceAddresses.state.isLoading(),
            jobs = this.jobTitles.isLoading();
        return add || jobs;
    }, this);
    
    this.goNext = function() {
        if (app.model.onboarding.inProgress()) {
            app.model.onboarding.goNext();
        }
    };

    // Replace default selectAddress
    this.serviceAddresses.selectAddress = function(selectedAddress, event) {
        if (this.serviceAddresses.isSelectionMode() === true) {
            // Run method injected by the activity to return a 
            // selected address:
            this.returnSelected(
                selectedAddress.addressID(),
                selectedAddress.jobTitleID()
            );
        }
        else {
            app.shell.go('addressEditor/service/' +
                this.jobTitleID() +
                '/' + selectedAddress.addressID()
            );
        }
        
        event.preventDefault();
        event.stopImmediatePropagation();

    }.bind(this);
    
    this.addServiceLocation = function() {
        var url = '#!addressEditor/service/' + this.jobTitleID() + '/serviceLocation';
        var request = $.extend({}, this.requestData, {
            returnNewAsSelected: this.serviceAddresses.isSelectionMode()
        });
        app.shell.go(url, request);
    }.bind(this);
    
    this.addServiceArea = function() {
        var url = '#!addressEditor/service/' + this.jobTitleID() + '/serviceArea';
        var request = $.extend({}, this.requestData, {
            returnNewAsSelected: this.serviceAddresses.isSelectionMode()
        });
        app.shell.go(url, request);
    }.bind(this);
    
    this.addClientLocation = function() {
        var url = '#!addressEditor/service/' + this.jobTitleID() + '/clientLocation/' + this.clientID();
        var request = $.extend({}, this.requestData, {
            returnNewAsSelected: this.serviceAddresses.isSelectionMode()
        });
        app.shell.go(url, request);
    }.bind(this);
    
    this.onboardingNextReady = ko.computed(function() {
        var isin = app.model.onboarding.inProgress(),
            hasItems = this.serviceAddresses.sourceAddresses().length > 0;

        return isin && hasItems;
    }, this);
}

},{"../components/Activity":90,"../viewmodels/ServiceAddresses":182,"../viewmodels/UserJobProfile":186,"knockout":false}],49:[function(require,module,exports){
/**
    ServiceProfessional Service activity
    
    TODO: Use ServiceProfessionalService ViewModel and template
**/
'use strict';

var ko = require('knockout'),
    _ = require('lodash'),
    $ = require('jquery'),
    Activity = require('../components/Activity');

var A = Activity.extends(function ServiceProfessionalServiceActivity() {

    Activity.apply(this, arguments);

    this.accessLevel = this.app.UserType.serviceProfessional;
    this.viewModel = new ViewModel(this.app);
    // Defaults settings for navBar.
    this.navBar = Activity.createSubsectionNavBar('Job Title', {
        backLink: '/scheduling'
    });
    // Save defaults to restore on updateNavBarState when needed:
    this.defaultLeftAction = this.navBar.leftAction().model.toPlainObject();
    
    // On changing jobTitleID:
    // - load pricing
    this.registerHandler({
        target: this.viewModel.jobTitle,
        handler: function(/*jobTitle*/) {
            // Update navbar (may indicate the jobTitle name)
            this.updateNavBarState();
        }.bind(this)
    });

    // On changing jobTitleID:
    // - load pricing
    this.registerHandler({
        target: this.viewModel.jobTitleID,
        handler: function(jobTitleID) {
            if (jobTitleID) {
                // Get data for the Job title ID and pricing types.
                // They are essential data
                Promise.all([
                    this.app.model.jobTitles.getJobTitle(jobTitleID),
                    this.app.model.pricingTypes.getList()
                ])
                .then(function(data) {
                    var jobTitle = data[0];
                    // Save for use in the view
                    this.viewModel.jobTitle(jobTitle);
                    // Get pricing
                    return this.app.model.serviceProfessionalServices.getList(jobTitleID);
                }.bind(this))
                .then(function(list) {

                    list = this.app.model.serviceProfessionalServices.asModel(list);
                    
                    // Read presets selection from requestData
                    var preset = this.requestData.selectedServices || [],
                        selection = this.viewModel.selectedServices;
                    
                    // Add the isSelected property to each item
                    list.forEach(function(item) {
                        var preSelected = preset.some(function(pr) {
                            if (pr.serviceProfessionalServiceID === item.serviceProfessionalServiceID())
                                return true;
                        }) || false;
                        
                        item.isSelected = ko.observable(preSelected);
                        
                        if (preSelected) {
                            selection.push(item);
                        }
                    });
                    this.viewModel.list(list);

                }.bind(this))
                .catch(function (err) {
                    this.app.modals.showError({
                        title: 'There was an error while loading.',
                        error: err
                    });
                }.bind(this));
            }
            else {
                this.viewModel.list([]);
                this.viewModel.jobTitle(null);
            }
        }.bind(this)
    });
    
    // Go back with the selected pricing when triggered in the form/view
    this.viewModel.returnSelected = function(pricing, jobTitleID) {
        // Pass the selected client in the info
        this.requestData.selectedServices = pricing;
        this.requestData.selectedJobTitleID = jobTitleID;
        // And go back
        this.app.shell.goBack(this.requestData);
    }.bind(this);
    
    this.returnRequest = function returnRequest() {
        this.app.shell.goBack(this.requestData);
    }.bind(this);
});

exports.init = A.init;

A.prototype.applyOwnNavbarRules = function() {
    //jshint maxcomplexity:10
    
    var itIs = this.viewModel.isSelectionMode();

    if (this.requestData.title) {
        // Replace title by title if required
        this.navBar.title(this.requestData.title);
    }
    else {
        // Title must be empty
        this.navBar.title('');
    }

    if (this.requestData.cancelLink) {
        this.convertToCancelAction(this.navBar.leftAction(), this.requestData.cancelLink, this.requestData);
    }
    else {
        // Reset to defaults, or given title:
        this.navBar.leftAction().model.updateWith(this.defaultLeftAction);
        if (this.requestData.navTitle)
            this.navBar.leftAction().text(this.requestData.navTitle);

        var jid = this.viewModel.jobTitleID(),
            jname = this.viewModel.jobTitle() && this.viewModel.jobTitle().singularName() || 'Scheduling',
            url = this.mustReturnTo || (jid && '/jobtitles/' + jid || '/scheduling');

        this.navBar.leftAction().link(url);
        this.navBar.leftAction().text(jname);
    }

    if (itIs && !this.requestData.cancelLink) {
        // Uses a custom handler so it returns keeping the given state:
        this.navBar.leftAction().handler(this.returnRequest);
    }
    else if (!this.requestData.cancelLink) {
        this.navBar.leftAction().handler(null);
    }
};

A.prototype.updateNavBarState = function updateNavBarState() {
    var itIs = this.viewModel.isSelectionMode();
    
    this.viewModel.headerText(itIs ? 'Select services' : 'Services');
    
    // Perform updates that apply this request:
    this.app.model.onboarding.updateNavBar(this.navBar) ||
    //this.app.applyNavbarMustReturn(this.requestData) ||
    this.applyOwnNavbarRules();
};

A.prototype.show = function show(options) {
    //jshint maxcomplexity:8
    Activity.prototype.show.call(this, options);
    
    // Remember route to go back, from a request of 'mustReturn' or last requested
    this.mustReturnTo = this.requestData.route.query.mustReturn || this.mustReturnTo;
        
    
    // Reset: avoiding errors because persisted data for different ID on loading
    // or outdated info forcing update
    this.viewModel.jobTitleID(0);
    this.viewModel.selectedServices.removeAll();
    this.viewModel.requestData = this.requestData;

    this.viewModel.isSelectionMode(this.requestData.selectPricing === true);
    
    // Params
    var params = options && options.route && options.route.segments;
    var jobTitleID = params[0] |0;
    if (jobTitleID === 0 && options.selectedJobTitleID > 0)
        jobTitleID = options.selectedJobTitleID |0;

    var isAdditionMode = params[0] === 'new' || params[1] === 'new';
    if (isAdditionMode) {
        // Sets referrer as cancelLink
        var ref = this.app.shell.referrerRoute;
        ref = ref && ref.url || '/';
        this.requestData.cancelLink = ref;
        // Set for editor links in the view
        this.viewModel.cancelLink(ref);
    }
    else {
        // Set this page as cancelLink for editor links in the view
        this.viewModel.cancelLink('/serviceProfessionalService/' + this.viewModel.jobTitleID());
    }

    this.viewModel.isAdditionMode(isAdditionMode);
    
    this.updateNavBarState();

    this.viewModel.jobTitleID(jobTitleID);
    
    if (jobTitleID === 0) {
        this.viewModel.jobTitles.sync();
    }
};

var UserJobProfile = require('../viewmodels/UserJobProfile');

function ViewModel(app) {

    this.headerText = ko.observable('Services');
    
    this.jobTitleID = ko.observable(0);
    this.jobTitle = ko.observable(null);
    this.isAdditionMode = ko.observable(false);
    this.cancelLink = ko.observable(null);
    
    this.jobTitles = new UserJobProfile(app);
    this.jobTitles.baseUrl('/serviceProfessionalService');
    this.jobTitles.selectJobTitle = function(jobTitle) {
        
        this.jobTitleID(jobTitle.jobTitleID());
        var url = 'serviceProfessionalService/' + jobTitle.jobTitleID();
        if (this.isAdditionMode())
            url += '/new';
        // pushState cannot be used because it conflicts with the 
        // selection logic (on new-booking progress)
        // TODO: commented until the bug with replaceState in HashbangHistory is fixed
        //app.shell.replaceState(null, null, url);
        
        return false;
    }.bind(this);

    this.list = ko.observableArray([]);

    this.isLoading = ko.computed(function() {
        return (
            app.model.serviceProfessionalServices.state.isLoading() ||
            app.model.pricingTypes.state.isLoading() ||
            app.model.jobTitles.state.isLoading()
        );
    });
    this.isLocked = this.isLoading;

    // Especial mode when instead of pick and edit we are just selecting
    this.isSelectionMode = ko.observable(false);

    this.submitText = ko.pureComputed(function() {
        return (
            this.isLoading() ? 
                'loading...' : 
                'Save and continue'
        );
    }, this);
    
    // Grouped list of pricings:
    // Defined groups by pricing type
    this.groupedServices = ko.computed(function(){

        var list = this.list();
        var isSelection = this.isSelectionMode();
        var groupNamePrefix = isSelection ? 'Select ' : '';

        var groups = [],
            groupsList = [];
        if (!this.isAdditionMode()) {
            groups = _.groupBy(list, function(pricingItem) {
                return pricingItem.pricingTypeID();
            });

            // Convert the indexed object into an array with some meta-data
            groupsList = Object.keys(groups).map(function(key) {
                var gr = {
                    pricing: groups[key],
                    // Load the pricing information
                    type: app.model.pricingTypes.getObservableItem(key)
                };
                gr.group = ko.computed(function() {
                    return groupNamePrefix + (
                        this.type() && this.type().pluralName() ||
                        'Services'
                    );
                }, gr);
                return gr;
            });
        }
        
        // Since the groupsList is built from the existent pricing items
        // if there are no records for some pricing type (or nothing when
        // just created the job title), that types/groups are not included,
        // so review and include now.
        // NOTE: as a good side effect of this approach, pricing types with
        // some pricing will appear first in the list (nearest to the top)
        var pricingTypes = this.jobTitle() && this.jobTitle().pricingTypes();
        if (pricingTypes && pricingTypes.length) {
            pricingTypes.forEach(function (jobType) {
                
                var typeID = jobType.pricingTypeID();
                // Not if already in the list
                if (groups.hasOwnProperty(typeID))
                    return;

                var gr = {
                    pricing: [],
                    type: app.model.pricingTypes.getObservableItem(typeID)
                };
                gr.group = ko.computed(function() {
                    return groupNamePrefix + (
                        this.type() && this.type().pluralName() ||
                        'Services'
                    );
                }, gr);

                groupsList.push(gr);
            });
        }

        return groupsList;

    }, this);

    this.selectedServices = ko.observableArray([]);
    /**
        Toggle the selection status of a pricing, adding
        or removing it from the 'selectedServices' array.
    **/
    this.toggleServiceSelection = function(pricing) {

        var inIndex = -1,
            isSelected = this.selectedServices().some(function(selectedServices, index) {
            if (selectedServices === pricing) {
                inIndex = index;
                return true;
            }
        });

        pricing.isSelected(!isSelected);

        if (isSelected)
            this.selectedServices.splice(inIndex, 1);
        else
            this.selectedServices.push(pricing);
    }.bind(this);
    
    this.onboardingNextReady = ko.computed(function() {
        var isin = app.model.onboarding.inProgress(),
            hasPricing = this.list().length > 0;
        
        return isin && hasPricing;
    }, this);
    
    /**
        Ends the selection process, ready to collect selection
        and passing it to the requester activity.
        Works too to pass to the next onboarding step
    **/
    this.endSelection = function(data, event) {
        
        if (app.model.onboarding.inProgress()) {
            app.model.onboarding.goNext();
        }
        else {
            // Run method injected by the activity to return a 
            // selected address:
            this.returnSelected(
                this.selectedServices().map(function(pricing) {
                    return {
                        serviceProfessionalServiceID: ko.unwrap(pricing.serviceProfessionalServiceID),
                        totalPrice: ko.unwrap(pricing.price)
                    };
                }),
                this.jobTitleID()
            );
        }

        event.preventDefault();
        event.stopImmediatePropagation();
    }.bind(this);
    
    this.editService = function(pricing) {
        app.shell.go('serviceProfessionalServiceEditor/' + this.jobTitleID() + '/' + pricing.serviceProfessionalServiceID());
    }.bind(this);
    
    /**
        Handler for the listview items, managing edition and selection depending on current mode
    **/
    this.tapService = function(pricing, event) {
        if (this.isSelectionMode()) {
            this.toggleServiceSelection(pricing);
        }
        else {
            this.editService(pricing);
        }

        event.preventDefault();
        event.stopImmediatePropagation();
    }.bind(this);
    
    this.tapNewService = function(group, event) {
        
        var url = '#!serviceProfessionalServiceEditor/' + this.jobTitleID() + '/new/' + (group.type() && group.type().pricingTypeID());

        // Passing original data, for in-progress process (as new-booking)
        // and the selected title since the URL could not be updated properly
        // (see the anotated comment about replaceState bug on this file)
        var request = $.extend({}, this.requestData, {
            selectedJobTitleID: this.jobTitleID()
        });
        if (!request.cancelLink) {
            $.extend(request, {
                cancelLink: this.cancelLink()
            });
        }
        
        // When in selection mode:
        // Add current selection as preselection, so can be recovered later and 
        // the editor can add the new pricing to the list
        if (this.isSelectionMode()) {
            request.selectedServices = this.selectedServices()
            .map(function(pricing) {
                return {
                    serviceProfessionalServiceID: ko.unwrap(pricing.serviceProfessionalServiceID),
                    totalPrice: ko.unwrap(pricing.totalPrice)
                };
            });
        }

        app.shell.go(url, request);

        event.preventDefault();
        event.stopImmediatePropagation();
    }.bind(this);
}

},{"../components/Activity":90,"../viewmodels/UserJobProfile":186,"knockout":false,"lodash":false}],50:[function(require,module,exports){
/**
    ServiceProfessionalServiceEditor activity
    
    TODO: ModelVersion is NOT being used, so no getting updates if server updates
    the data after load (data load is requested but get first from cache). Use
    version and get sync'ed data when ready, and additionally notification to
    override changes if server data is different that any local change.
**/
'use strict';
var ko = require('knockout'),
    Activity = require('../components/Activity'),
    PricingType = require('../models/PricingType');

var A = Activity.extends(function ServiceProfessionalServiceEditorActivity() {

    Activity.apply(this, arguments);

    this.accessLevel = this.app.UserType.serviceProfessional;
    this.viewModel = new ViewModel(this.app);
    this.navBar = Activity.createSubsectionNavBar('Services');
    
    /// Go out after save succesfully an item.
    /// Pricing is a plain object
    this.viewModel.onSave = function(pricing) {
        // Go back on save.
        // If we comes with a selection of pricing, we must add the new one
        // there and just go back (serviceProfessionalService is in selection mode) keeping
        // any requestData for in-progress state.
        if (this.requestData.selectedServices) {
            // Is an array of plain objects of just ID and totalPrice
            this.requestData.selectedServices.push({
                serviceProfessionalServiceID: pricing.serviceProfessionalServiceID,
                totalPrice: pricing.totalPrice
            });
            this.app.shell.goBack(this.requestData);
        }
        else {
            // Just execute the standard save process
            this.app.successSave();
        }
    }.bind(this);
});

exports.init = A.init;

A.prototype.updateNavBarState = function updateNavBarState() {

    var link = this.requestData.cancelLink || '/serviceProfessionalService/' + this.viewModel.jobTitleID();
    
    this.convertToCancelAction(this.navBar.leftAction(), link);
};

A.prototype.show = function show(options) {
    //jshint maxcomplexity:10    
    Activity.prototype.show.call(this, options);

    // Reset
    this.viewModel.wasRemoved(false);
    this.viewModel.serviceProfessionalServiceVersion(null);
    this.viewModel.pricingType(null);

    // Params
    var params = options && options.route && options.route.segments || [];

    var jobTitleID = params[0] |0,
        // Parameter [1] can be 'new' followed by a pricingTypeID as [2]
        pricingTypeID = params[1] === 'new' ? params[2] |0 : 0,
        // Or a pricingID
        serviceProfessionalServiceID = params[1] |0;

    this.viewModel.jobTitleID(jobTitleID);
    this.viewModel.serviceProfessionalServiceID(serviceProfessionalServiceID);
    
    this.updateNavBarState();
    
    /**
        The pricing record needs some special set-up after creation/loading and before
        being presented to the user, because special value-rules.
    **/
    var pricingSetup = function pricingSetup() {
        // Pricing fields that has a special initial value
        var c = this.viewModel.current();
        if (c) {
            // Name: must be the PricingType.fixedName ever if any, or
            //   the name saved in the pricing or
            //   the suggestedName as last fallback
            c.pricing.name(c.type.fixedName() || c.pricing.name() || c.type.suggestedName());
            // Required call after loading a pricing to reflect data correctly (cannot be automated)
            c.pricing.refreshNoPriceRate();
        }
        this.viewModel.isLoading(false);
    }.bind(this);
    
    var showInvalidRequestError = function() {
        this.viewModel.isLoading(false);
        this.app.modals.showError({
            title: 'Invalid request',
            error: { jobTitleID: jobTitleID, pricingTypeID: pricingTypeID, serviceProfessionalServiceID: serviceProfessionalServiceID }
        })
        .then(function() {
            // On close modal, go back
            this.app.shell.goBack();
        }.bind(this));
    }.bind(this);

    this.viewModel.isLoading(true);
    if (pricingTypeID) {
        // Load the pricing Type
        this.app.model.pricingTypes.getItem(pricingTypeID)
        .then(function(type) {
            if (type) {
                this.viewModel.pricingType(type);
                // New pricing
                this.viewModel.serviceProfessionalServiceVersion(this.app.model.serviceProfessionalServices.newItemVersion({
                    jobTitleID: jobTitleID,
                    pricingTypeID: pricingTypeID
                }));
                pricingSetup();
            }
            else {
                showInvalidRequestError();
            }
        }.bind(this));
    }
    else if (serviceProfessionalServiceID) {
        // Get the pricing
        this.app.model.serviceProfessionalServices.getItemVersion(jobTitleID, serviceProfessionalServiceID)
        .then(function (serviceProfessionalServiceVersion) {
            if (serviceProfessionalServiceVersion) {
                // Load the pricing type before put the version
                // returns to let the 'catch' to get any error
                return this.app.model.pricingTypes.getItem(serviceProfessionalServiceVersion.version.pricingTypeID())
                .then(function(type) {
                    if (type) {
                        this.viewModel.pricingType(type);
                        this.viewModel.serviceProfessionalServiceVersion(serviceProfessionalServiceVersion);
                        pricingSetup();
                    }
                    else {
                        showInvalidRequestError();
                    }
                }.bind(this));
            } else {
                showInvalidRequestError();
            }

        }.bind(this))
        .catch(function (err) {
            this.app.modals.showError({
                title: 'There was an error while loading.',
                error: err
            })
            .then(function() {
                // On close modal, go back
                this.app.shell.goBack();
            }.bind(this));
        }.bind(this));
    }
    else {
        showInvalidRequestError();
    }
};

function ViewModel(app) {
    /*jshint maxstatements: 35*/

    this.isLoading = ko.observable(false);
    // managed manually instead of
    //app.model.serviceProfessionalServices.state.isLoading;
    this.isSaving = app.model.serviceProfessionalServices.state.isSaving;
    this.isSyncing = app.model.serviceProfessionalServices.state.isSyncing;
    this.isDeleting = app.model.serviceProfessionalServices.state.isDeleting;
    this.jobTitleID = ko.observable(0);
    this.serviceProfessionalServiceID = ko.observable(0);
    // L10N
    this.moneySymbol = ko.observable('$');
    
    this.pricingType = ko.observable(new PricingType());

    this.serviceProfessionalServiceVersion = ko.observable(null);
    this.serviceProfessionalService = ko.pureComputed(function() {
        var v = this.serviceProfessionalServiceVersion();
        if (v) {
            return v.version;
        }
        return null;
    }, this);

    this.header = ko.pureComputed(function() {
        if (this.isLoading()) {
            return 'Loading...';
        }
        else if (this.serviceProfessionalServiceVersion()) {
            var t = this.pricingType();
            return t && t.singularName() || 'Service';
        }
        else {
            return 'Unknow service or was deleted';
        }

    }, this);
    
    // Quicker access in form, under a 'with'
    this.current = ko.pureComputed(function() {
        var t = this.pricingType(),
            p = this.serviceProfessionalService();
        
        if (t && p) {
            return {
                type: t,
                pricing: p
            };
        }
        return null;
    }, this);

    this.wasRemoved = ko.observable(false);
    
    this.isLocked = ko.computed(function() {
        return this.isDeleting() || app.model.serviceProfessionalServices.state.isLocked();
    }, this);
    
    this.isNew = ko.pureComputed(function() {
        var p = this.serviceProfessionalService();
        return p && !p.updatedDate();
    }, this);

    this.submitText = ko.pureComputed(function() {
        var v = this.serviceProfessionalServiceVersion();
        return (
            this.isLoading() ? 
                'Loading...' : 
                this.isSaving() ? 
                    'Saving changes' : 
                    v && v.areDifferent() ?
                        'Save changes' :
                        'Saved'
        );
    }, this);

    this.unsavedChanges = ko.pureComputed(function() {
        var v = this.serviceProfessionalServiceVersion();
        return v && v.areDifferent();
    }, this);
    
    this.deleteText = ko.pureComputed(function() {
        return (
            this.isDeleting() ? 
                'Deleting...' : 
                'Delete'
        );
    }, this);

    this.save = function() {
        
        app.model.serviceProfessionalServices.setItem(this.serviceProfessionalService().model.toPlainObject())
        .then(function(serverData) {
            // Update version with server data.
            this.serviceProfessionalService().model.updateWith(serverData);
            // Push version so it appears as saved
            this.serviceProfessionalServiceVersion().push({ evenIfObsolete: true });
            
            // After save logic provided by the activity, injected in the view:
            this.onSave(serverData);
        }.bind(this))
        .catch(function(err) {
            app.modals.showError({
                title: 'There was an error while saving.',
                error: err
            });
        });

    }.bind(this);
    
    this.confirmRemoval = function() {
        // TODO Better l10n or replace by a new preset field on pricingType.deleteLabel
        var p = this.pricingType();
        app.modals.confirm({
            title: 'Delete ' + (p && p.singularName()),
            message: 'Are you sure? The operation cannot be undone.',
            yes: 'Delete',
            no: 'Keep'
        })
        .then(function() {
            this.remove();
        }.bind(this));
    }.bind(this);

    this.remove = function() {

        app.model.serviceProfessionalServices.delItem(this.jobTitleID(), this.serviceProfessionalServiceID())
        .then(function() {
            this.wasRemoved(true);
            // Go out the deleted location
            app.shell.goBack();
        }.bind(this))
        .catch(function(err) {
            app.modals.showError({
                title: 'There was an error while deleting.',
                error: err
            });
        });
    }.bind(this);
}

},{"../components/Activity":90,"../models/PricingType":117,"knockout":false}],51:[function(require,module,exports){
/**
    ServiceProfessionalWebsite activity
**/
'use strict';

var Activity = require('../components/Activity'),
    ko = require('knockout');

var A = Activity.extends(function ServiceProfessionalWebsiteActivity() {
    
    Activity.apply(this, arguments);
    
    this.viewModel = new ViewModel(this.app);
    this.accessLevel = this.app.UserType.serviceProfessional;

    this.navBar = Activity.createSubsectionNavBar('Marketplace Profile', {
        backLink: 'marketplaceProfile'
    });
    
    this.registerHandler({
        target: this.app.model.marketplaceProfile,
        event: 'error',
        handler: function(err) {
            var msg = err.task === 'save' ? 'Error saving your website.' : 'Error loading your website.';
            this.app.modals.showError({
                title: msg,
                error: err && err.task && err.error || err
            });
        }.bind(this)
    });
});

exports.init = A.init;

A.prototype.show = function show(state) {
    Activity.prototype.show.call(this, state);
    
    // Keep data updated:
    this.app.model.marketplaceProfile.sync();
    // Discard any previous unsaved edit
    this.viewModel.discard();
};

function ViewModel(app) {

    var marketplaceProfile = app.model.marketplaceProfile;

    var profileVersion = marketplaceProfile.newVersion();
    profileVersion.isObsolete.subscribe(function(itIs) {
        if (itIs) {
            // new version from server while editing
            // FUTURE: warn about a new remote version asking
            // confirmation to load them or discard and overwrite them;
            // the same is need on save(), and on server response
            // with a 509:Conflict status (its body must contain the
            // server version).
            // Right now, just overwrite current changes with
            // remote ones:
            profileVersion.pull({ evenIfNewer: true });
        }
    });
    
    // Actual data for the form:
    this.profile = profileVersion.version;

    this.isLocked = marketplaceProfile.isLocked;

    this.submitText = ko.pureComputed(function() {
        return (
            this.isLoading() ? 
                'loading...' : 
                this.isSaving() ? 
                    'saving...' : 
                    'Save'
        );
    }, marketplaceProfile);
    
    this.discard = function discard() {
        profileVersion.pull({ evenIfNewer: true });
    };

    this.save = function save() {
        profileVersion.pushSave()
        .then(function() {
            app.successSave();
        })
        .catch(function() {
            // catch error, managed on event
        });
    };
}

},{"../components/Activity":90,"knockout":false}],52:[function(require,module,exports){
/**
    ServicesOverview activity
**/
'use strict';

var Activity = require('../components/Activity');
var ko = require('knockout');

var A = Activity.extends(function ServicesOverviewActivity() {
    
    Activity.apply(this, arguments);

    this.viewModel = new ViewModel(this.app);
    this.accessLevel = this.app.UserType.loggedUser;
    
    this.navBar = Activity.createSubsectionNavBar('Job Title');
    
    // On changing jobTitleID:
    // - load addresses
    this.registerHandler({
        target: this.viewModel.jobTitleID,
        handler: function(jobTitleID) {
            if (jobTitleID) {
                this.viewModel.isLoading(true);
                // Get data for the Job title ID
                this.app.model.userJobProfile.getUserJobTitle(jobTitleID)
                .then(function(userJobTitle) {
                    // Save for use in the view
                    this.viewModel.userJobTitle(userJobTitle);
                }.bind(this))
                .catch(function (err) {
                    this.app.modals.showError({
                        title: 'There was an error while loading.',
                        error: err
                    });
                }.bind(this))
                .then(function() {
                    // Finally
                    this.viewModel.isLoading(false);
                }.bind(this));
            }
            else {
                this.viewModel.userJobTitle(null);
            }
        }.bind(this)
    });
});

exports.init = A.init;

A.prototype.show = function show(state) {
    Activity.prototype.show.call(this, state);
    
    var params = state && state.route && state.route.segments;
    this.viewModel.jobTitleID(params[0] |0);
};

function ViewModel(/*app*/) {
    this.jobTitleID = ko.observable(0);
    this.userJobTitle = ko.observable(null);
    
    this.isLoading = ko.observable(false);
    this.isSaving = ko.observable(false);
    this.isLocked = ko.pureComputed(function() {
        return this.isLoading() || this.isSaving();
    }, this);
    
    var sampleDataList = [{
        name: ko.observable('Window cleaning')
    }, {
        name: ko.observable('Self-cleaning oven')
    }, {
        name: ko.observable('Cabinet cleaning')
    }];
    
    // TODO: Must be a component, with one instance per service attribute category, and being completed
    this.list = ko.observableArray(sampleDataList);
    this.attributeSearch = ko.observable('');
    var foundAttItem = function(att, item) {
        return item.name === att.name;
    };
    this.addAttribute = function() {
        var newOne = this.attributeSearch() || '';
        if (!/^\s*$/.test(newOne) &&
            !this.list().some(foundAttItem.bind(null, { name: newOne }))) {
            this.list.push({
                name: newOne
            });
        }
    };
    this.removeAttribute = function(att) {
        // ko array: remove
        this.list.remove(foundAttItem.bind(null, att));
    }.bind(this);
    
    this.submitText = ko.pureComputed(function() {
        return (
            this.isLoading() ? 
                'loading...' : 
                this.isSaving() ? 
                    'saving...' : 
                    'Save'
        );
    }, this);
    
    this.save = function() {
        console.log('TODO Saving..');
    };
}

},{"../components/Activity":90,"knockout":false}],53:[function(require,module,exports){
/**
    Signup activity
**/
'use strict';

var ko = require('knockout'),
    Activity = require('../components/Activity');

var A = Activity.extends(function SignupActivity() {
    
    Activity.apply(this, arguments);

    this.accessLevel = this.app.UserType.anonymous;
    this.viewModel = new ViewModel(this.app);
    // null for Logo
    this.navBar = Activity.createSectionNavBar(null);
    this.navBar.rightAction(null);
    
    // Perform sign-up request when is requested by the form:
    this.registerHandler({
        target: this.viewModel.isSigningUp,
        handler: function(v) {
            if (v === true) {

                // Perform signup

                // Notify state:
                var $btn = this.$activity.find('[type="submit"]');
                $btn.button('loading');

                // Clear previous error so makes clear we
                // are attempting
                this.viewModel.signupError('');

                var ended = function ended() {
                    this.viewModel.isSigningUp(false);
                    $btn.button('reset');
                }.bind(this);

                // After clean-up error (to force some view updates),
                // validate and abort on error
                // Manually checking error on each field
                if (this.viewModel.username.error() ||
                    this.viewModel.password.error()) {
                    this.viewModel.signupError('Review your data');
                    ended();
                    return;
                }

                this.app.model.signup(
                    this.viewModel.username(),
                    this.viewModel.password(),
                    this.viewModel.profile()
                ).then(function(signupData) {

                    this.viewModel.signupError('');
                    ended();
                    
                    // Start onboarding
                    this.app.model.onboarding.setStep(signupData.onboardingStep);

                    // Remove form data
                    this.viewModel.username('');
                    this.viewModel.password('');

                    this.app.goDashboard();

                }.bind(this)).catch(function(err) {

                    var msg = err && err.responseJSON && err.responseJSON.errorMessage ||
                        err && err.statusText ||
                        'Invalid username or password';

                    this.viewModel.signupError(msg);
                    ended();
                }.bind(this));
            }
        }.bind(this)
    });
    
    // Focus first bad field on error
    this.registerHandler({
        target: this.viewModel.signupError,
        handler: function(err) {
            // Signup is easy since we mark both unique fields
            // as error on signupError (its a general form error)
            var input = this.$activity.find(':input').get(0);
            if (err)
                input.focus();
            else
                input.blur();
        }.bind(this)
    });
});

exports.init = A.init;

A.prototype.show = function show(options) {
    Activity.prototype.show.call(this, options);
    
    if (options && options.route &&
        options.route.segments &&
        options.route.segments.length) {
        this.viewModel.profile(options.route.segments[0]);
    }
};


var FormCredentials = require('../viewmodels/FormCredentials');

function ViewModel() {

    var credentials = new FormCredentials();    
    this.username = credentials.username;
    this.password = credentials.password;

    this.signupError = ko.observable('');
    
    this.isSigningUp = ko.observable(false);
    
    this.performSignup = function performSignup() {

        this.isSigningUp(true);
    }.bind(this);

    this.profile = ko.observable('client');
}

},{"../components/Activity":90,"../viewmodels/FormCredentials":178,"knockout":false}],54:[function(require,module,exports){
/**
    textEditor activity
**/
//global window
'use strict';

var ko = require('knockout'),
    EventEmitter = require('events').EventEmitter,
    Activity = require('../components/Activity');

var A = Activity.extends(function TextEditorActivity() {
    
    Activity.apply(this, arguments);

    this.accessLevel = this.app.UserType.loggedUser;
    this.viewModel = new ViewModel(this.app);
    // Title is empty, since we are in 'go back' mode all the time here
    this.navBar = Activity.createSubsectionNavBar('');
    this.navBar.leftAction().handler(function() {
        this.emit('cancel');
    }.bind(this.viewModel));
    
    // Getting elements
    this.$textarea = this.$activity.find('textarea');
    this.textarea = this.$textarea.get(0);
    
    // Handler for the 'saved' event so the activity
    // returns back to the requester activity giving it
    // the new text
    this.registerHandler({
        target: this.viewModel,
        event: 'saved',
        handler: function() {
            // Update the info with the new text
            this.requestData.text = this.viewModel.text();
            // and pass it back
            this.app.shell.goBack(this.requestData);
        }.bind(this)
    });
    
    // Handler the cancel event
    this.registerHandler({
        target: this.viewModel,
        event: 'cancel',
        handler: function() {
            // return, nothing changed
            this.app.shell.goBack(this.requestData);
        }.bind(this)
    });
});

exports.init = A.init;

A.prototype.show = function show(options) {
    Activity.prototype.show.call(this, options);
    
    // Set navigation title or nothing
    this.navBar.leftAction().text(this.requestData.navTitle || '');
    
    // Field header
    this.viewModel.headerText(this.requestData.header);
    this.viewModel.text(this.requestData.text);
        
    // Inmediate focus to the textarea for better usability
    this.textarea.focus();
    this.$textarea.click();
    // IMPORTANT: WORKAROUND: for iOS: on iOS (checked up to 8.3, 2015-05-20), the opening of the virtual keyboard
    // makes a scroll down of the viewport, hiding the text field, header, anything, and only the
    // blank area gets showed. That bad autoscroll can be fixed on this single case with next trick
    // without flickering or bad effects (and alternative, generic approach is do it on the keyboardShow
    // event, but there a flickering happens and may affect cases where there is no need or can be worse
    // if field visibility and actual scroll is not checked):
    window.scrollTo(0, 0);
};

function ViewModel() {

    this.headerText = ko.observable('Text');

    // Text to edit
    this.text = ko.observable('');

    this.cancel = function cancel() {
        this.emit('cancel');
    };
    
    this.save = function save() {
        this.emit('saved');
    };
}

ViewModel._inherits(EventEmitter);

},{"../components/Activity":90,"events":false,"knockout":false}],55:[function(require,module,exports){
/**
    Verifications activity
**/
'use strict';

var ko = require('knockout'),
    Activity = require('../components/Activity');

var A = Activity.extends(function VerificationsActivity() {

    Activity.apply(this, arguments);

    this.accessLevel = this.app.UserType.loggedUser;
    this.viewModel = new ViewModel(this.app);
    // Defaults settings for navBar.
    this.navBar = Activity.createSubsectionNavBar('Marketplace Profile', {
        backLink: '/marketplaceProfile'
    });
    
    // Setup special links behavior to add/perform specific verifications
    this.registerHandler({
        target: this.$activity,
        event: 'click',
        selector: '[href="#resendEmailConfirmation"]',
        handler: function() {
            this.app.modals.showNotification({
                message: 'TO-DO: resend email confirmation'
            });
        }.bind(this)
    });
    this.registerHandler({
        target: this.$activity,
        event: 'click',
        selector: '[href="#connectWithFacebook"]',
        handler: function() {
            this.app.modals.showNotification({
                message: 'TO-DO: ask for connect with Facebook API'
            });
        }.bind(this)
    });
});

exports.init = A.init;

A.prototype.show = function show(options) {
    Activity.prototype.show.call(this, options);
    
};

function ViewModel(app) {
    
    //this.isSyncing = app.model.userVerifications.state.isSyncing;
    this.isSyncing = ko.observable(false);
    this.isLoading = ko.observable(false);
    this.isSaving = ko.observable(false);
    
    this.userVerifications = ko.observableArray(testdata());
    
    this.emailInfo = ko.observable('Please click on "Verify my account" in the e-mail we sent you to verify your address. <a class="btn btn-link btn-block"  href="#resendEmailConfirmation">Click here to resend.</a>');
    this.facebookInfo = ko.pureComputed(function() {
        var tpl = 'Letting potential __kind__ know you have a trusted online presence helps them know you\'re real. <a class="btn btn-link btn-block" href="#connectWithFacebook">Click here to connect your account.</a>';
        return tpl.replace(/__kind__/, app.model.user().isServiceProfessional() ? 'clients' : 'service professionals');
    });
}

function testdata() {
    
    var verA = new Verification({
            name: 'Email'
        }),
        verB = new Verification({
            name: 'Facebook'
        }),
        verC = new Verification({
            name: 'Loconomic\'s user-reviewed'
        });

    return [
        new UserVerification({
            statusID: Verification.status.confirmed,
            lastVerifiedDate: new Date(2015, 1, 12, 10, 23, 32),
            verification: verA
        }),
        new UserVerification({
            statusID: Verification.status.revoked,
            lastVerifiedDate: new Date(2015, 5, 20, 16, 4, 0),
            verification: verB
        }),
        new UserVerification({
            statusID: Verification.status.pending,
            lastVerifiedDate: new Date(2014, 11, 30, 19, 54, 4),
            verification: verC
        })
    ];
}

var Model = require('../models/Model');
// TODO Incomplete Model for UI mockup
function UserVerification(values) {
    Model(this);
    
    this.model.defProperties({
        statusID: 0,
        lastVerifiedDate: null,
        verification: {
            Model: Verification
        }
    }, values);
    
    this.statusText = ko.pureComputed(function() {
        // L18N
        var statusTextsenUS = {
            'verification.status.confirmed': 'Confirmed',
            'verification.status.pending': 'Pending',
            'verification.status.revoked': 'Revoked',
            'verification.status.obsolete': 'Obsolete'
        };
        var statusCode = enumGetName(this.statusID(), Verification.status);
        return statusTextsenUS['verification.status.' + statusCode];
    }, this);
    
    /**
        Check if verification has a given status by name
    **/
    this.isStatus = function (statusName) {
        var id = this.statusID();
        return Verification.status[statusName] === id;
    }.bind(this);
}
function Verification(values) {
    Model(this);
    
    this.model.defProperties({
        name: ''
    }, values);
}
Verification.status = {
    confirmed: 1,
    pending: 2,
    revoked: 3,
    obsolete: 4
};
function enumGetName(value, enumList) {
    var found = null;
    Object.keys(enumList).some(function(k) {
        if (enumList[k] === value) {
            found = k;
            return true;
        }
    });
    return found;
}
                               
},{"../components/Activity":90,"../models/Model":113,"knockout":false}],56:[function(require,module,exports){
/**
    WeeklySchedule activity
**/
'use strict';

var Activity = require('../components/Activity');
var ko = require('knockout');

var A = Activity.extends(function WeeklyScheduleActivity() {
    
    Activity.apply(this, arguments);
    
    this.viewModel = new ViewModel(this.app);
    this.accessLevel = this.app.UserType.serviceProfessional;

    this.navBar = Activity.createSubsectionNavBar('Scheduling', {
        backLink: 'scheduling'
    });
    this.defaultNavBar = this.navBar.model.toPlainObject();
    
    this.registerHandler({
        target: this.app.model.simplifiedWeeklySchedule,
        event: 'error',
        handler: function(err) {
            var msg = err.task === 'save' ? 'Error saving your weekly schedule.' : 'Error loading your weekly schedule.';
            this.app.modals.showError({
                title: msg,
                error: err && err.task && err.error || err
            });
        }.bind(this)
    });
});

exports.init = A.init;

A.prototype.updateNavBarState = function updateNavBarState() {
    
    if (!this.app.model.onboarding.updateNavBar(this.navBar)) {
        // Reset
        this.navBar.model.updateWith(this.defaultNavBar);
    }
};

A.prototype.show = function show(state) {
    Activity.prototype.show.call(this, state);
    
    this.updateNavBarState();
    
    // Keep data updated:
    this.app.model.simplifiedWeeklySchedule.sync();
    // Discard any previous unsaved edit
    this.viewModel.discard();
};

function ViewModel(app) {

    var simplifiedWeeklySchedule = app.model.simplifiedWeeklySchedule;

    var scheduleVersion = simplifiedWeeklySchedule.newVersion();
    scheduleVersion.isObsolete.subscribe(function(itIs) {
        if (itIs) {
            // new version from server while editing
            // FUTURE: warn about a new remote version asking
            // confirmation to load them or discard and overwrite them;
            // the same is need on save(), and on server response
            // with a 509:Conflict status (its body must contain the
            // server version).
            // Right now, just overwrite current changes with
            // remote ones:
            scheduleVersion.pull({ evenIfNewer: true });
        }
    });
    
    // Actual data for the form:
    this.schedule = scheduleVersion.version;

    this.isLocked = simplifiedWeeklySchedule.isLocked;
    this.isSaving = simplifiedWeeklySchedule.isSaving;

    this.submitText = ko.pureComputed(function() {
        return (
            app.model.onboarding.inProgress() ?
                'Save and continue' :
                this.isLoading() ? 
                    'loading...' : 
                    this.isSaving() ? 
                        'saving...' : 
                        'Save'
        );
    }, simplifiedWeeklySchedule);
    
    this.discard = function discard() {
        scheduleVersion.pull({ evenIfNewer: true });
    };

    this.save = function save() {
        scheduleVersion.pushSave()
        .then(function() {
            if (app.model.onboarding.inProgress()) {
                app.model.onboarding.goNext();
            } else {
                app.successSave();
            }
        })
        .catch(function() {
            // catch error, managed on event
        });
    };
}

},{"../components/Activity":90,"knockout":false}],57:[function(require,module,exports){
/**
    Welcome activity
**/
'use strict';

var Activity = require('../components/Activity');

var A = Activity.extends(function WelcomeActivity() {
    
    Activity.apply(this, arguments);

    this.accessLevel = this.app.UserType.loggedUser;
    
    var app = this.app;
    
    this.viewModel = {
        startOnboarding: function startOnboarding() {
            app.model.onboarding.goNext();
        }
    };
    
    this.navBar = new Activity.NavBar({
        title: null,
        leftAction: Activity.NavAction.goLogout,
        rightAction: null
    });
});

exports.init = A.init;

},{"../components/Activity":90}],58:[function(require,module,exports){
/**
    WorkPhotos activity
**/
'use strict';

var ko = require('knockout'),
    $ = require('jquery'),
    Activity = require('../components/Activity');

var A = Activity.extends(function WorkPhotosActivity() {

    Activity.apply(this, arguments);

    this.accessLevel = this.app.UserType.serviceProfessional;
    this.viewModel = new ViewModel(this.app);
    // Defaults settings for navBar.
    this.navBar = Activity.createSubsectionNavBar('Job Title');

    // On changing jobTitleID:
    // - load photos
    /* TODO Uncomment and update on implementing REST API AppModel
    this.registerHandler({
        target: this.viewModel.jobTitleID,
        handler: function(jobTitleID) {
            if (jobTitleID) {
                // Get data for the Job title ID
                this.app.model.workphotos.getList(jobTitleID)
                .then(function(list) {
                    // Save for use in the view
                    this.viewModel.list(list);
                }.bind(this))
                .catch(function (err) {
                    this.app.modals.showError({
                        title: 'There was an error while loading.',
                        error: err
                    });
                }.bind(this));
            }
            else {
                this.viewModel.list([]);
            }
        }.bind(this)
    });*/
    // TODO Remove on implemented REST API
    this.viewModel.list(testdata());
    
    // Event handlers for photo list management
    this.registerHandler({
        target: this.$activity,
        selector: '.WorkPhotos-imgBtn',
        event: 'click',
        handler: function(event) {
            $(event.target).closest('li').toggleClass('is-selected');
        }.bind(this)
    });
});

exports.init = A.init;

A.prototype.show = function show(options) {
    Activity.prototype.show.call(this, options);

    var params = options && options.route && options.route.segments;
    this.viewModel.jobTitleID(params[0] |0);
};

function ViewModel(app) {

    this.jobTitleID = ko.observable(0);
    this.list = ko.observableArray([]);
    
    this.isSyncing = app.model.licensesCertifications.state.isSyncing();
    this.isLoading = app.model.licensesCertifications.state.isLoading();

    this.addNew = function() {
        // Pick a new photo
        this.openPhotoPicker()
        .then(function(img) {
            var newItem = new WorkPhoto({
                url: img,
                title: ''
            });
            this.list.push(newItem);
        }.bind(this))
        .catch(function(err) {
            app.modals.showError({ error: err, title: 'Error getting photo.' });
        });
    }.bind(this);

    this.removeImg = function(item) {
        // Pick another photo to replace on 'item'
        this.list.remove(item);
    }.bind(this);

    this.openPhotoPicker = function() {
        /*global navigator,Camera*/
        return new Promise(function(resolve, reject) {
            if (navigator.camera && navigator.camera.getPicture) {
                navigator.camera.getPicture(function(img) {
                    resolve(img);
                }, function(err) {
                    // bug iOS note: http://plugins.cordova.io/#/package/org.apache.cordova.camera
                    setTimeout(function() {
                        reject(err);
                    }, 0);
                }, {
                    destinationType: Camera.DestinationType.FILE_URI,
                    targetWidth: 446,
                    targetHeight: 332,
                    saveToPhotoAlbum: true,
                    mediaType: Camera.MediaType.PICTURE,
                    correctOrientation: true
                });
            }
            else {
                // bug iOS note: http://plugins.cordova.io/#/package/org.apache.cordova.camera
                setTimeout(function() {
                    reject({ error: 'Unsupported', message: 'Impossible to get photo from device' });
                }, 0);
            }
        });
    };
    
    this.updateSort = function(/*info*/) {
        // TODO
    };
}



/// TESTDATA

var Model = require('../models/Model');
function WorkPhoto(values) {
    Model(this);
    
    this.model.defProperties({
        url: '',
        title: ''
    }, values);
}

function testdata() {
    return [
        new WorkPhoto({ url: 'https://loconomics.com/img/userphotos/u296/0c95dbccafd14953a94bde86eff4d34a-442x332.jpg', title: 'Testing photo 1' }),
        new WorkPhoto({ url: 'https://loconomics.com/img/userphotos/u296/3eb14073cb6a45138b6fd96b459bf3a1-442x332.jpg', title: 'Testing photo 2' }),
        new WorkPhoto({ url: 'https://loconomics.com/img/userphotos/u296/0c95dbccafd14953a94bde86eff4d34a-442x332.jpg', title: 'Testing photo 3' }),
        new WorkPhoto({ url: 'https://loconomics.com/img/userphotos/u296/3eb14073cb6a45138b6fd96b459bf3a1-442x332.jpg', title: 'Testing photo 4' })
    ];
}
},{"../components/Activity":90,"../models/Model":113,"knockout":false}],59:[function(require,module,exports){
/**
    Registration of custom html components used by the App.
    All with 'app-' as prefix.
    
    Some definitions may be included on-line rather than on separated
    files (viewmodels), templates are linked so need to be 
    included in the html file with the same ID that referenced here,
    usually using as DOM ID the same name as the component with sufix '-template'.
**/
'use strict';

var ko = require('knockout'),
    $ = require('jquery'),
    propTools = require('./utils/jsPropertiesTools'),
    getObservable = require('./utils/getObservable');

exports.registerAll = function() {
    
    /// navbar-action
    ko.components.register('app-navbar-action', {
        template: { element: 'navbar-action-template' },
        viewModel: function(params) {

            propTools.defineGetter(this, 'action', function() {
                return (
                    params.action && params.navBar() ?
                    params.navBar()[params.action]() :
                    null
                );
            });
        }
    });
    
    /// unlabeled-input
    ko.components.register('app-unlabeled-input', {
        template: { element: 'unlabeled-input-template' },
        viewModel: function(params) {

            this.value = getObservable(params.value);
            this.placeholder = getObservable(params.placeholder);
            this.disable = getObservable(params.disable);
            
            var userAttr = getObservable(params.attr);
            this.attr = ko.pureComputed(function() {
                var attr = userAttr() || {};
                return $.extend({}, attr, {
                    'aria-label': this.placeholder(),
                    placeholder: this.placeholder(),
                    type: this.type()
                });
            }, this);
            
            var type = getObservable(params.type);            
            this.type = ko.computed(function() {
                return type() || 'text';
            }, this);
        }
    });
    
    /// feedback-entry
    ko.components.register('app-feedback-entry', {
        template: { element: 'feedback-entry-template' },
        viewModel: function(params) {

            this.section = getObservable(params.section || '');
            this.url = ko.pureComputed(function() {
                return '/feedbackForm/' + this.section();
            }, this);
        }
    });
    
    /// feedback-entry
    ko.components.register('app-time-slot-tile', {
        template: { element: 'time-slot-tile-template' },
        viewModel: require('./viewmodels/TimeSlot')
    });
    
    /// loading-spinner
    ko.components.register('app-loading-spinner', {
        template: { element: 'loading-spinner-template' },
        viewModel: function(params) {
            var base = 'loadingSpinner';
            this.mod = getObservable(params.mod || '');
            this.cssClass = ko.pureComputed(function() {
                var c = base,
                    mods = (this.mod() || '').split(' ');
                if (mods.length)
                    c += ' ' + base + '--' + mods.join(' ' + base + '--');
                return c;
            }, this);
        }
    });

    /// appointment-card
    ko.components.register('app-appointment-card', {
        template: { element: 'appointment-card-template' },
        viewModel: require('./viewmodels/AppointmentCard')
    });
    
    /// job titles list
    ko.components.register('app-job-titles-list', {
        template: { element: 'job-titles-list-template' },
        viewModel: function(params) {
            this.jobTitles = getObservable(params.jobTitles || []);
            this.selectJobTitle = params.selectJobTitle || function() {};
            this.showMarketplaceInfo = getObservable(params.showMarketplaceInfo || false);
        }
    });
    
    /// Stars
    ko.components.register('app-stars-rating', {
        template: { element: 'stars-rating-template' },
        viewModel: function(params) {
            this.rating = getObservable(params.rating || 2.5);
            this.total = getObservable(params.total || 0);
            
            this.stars = ko.pureComputed(function() {
                var r = this.rating(),
                    list = [];
                for (var i = 1; i <= 5; i++) {
                    // TODO Support half values
                    list.push(i <= r ? 1 : 0);
                }
                return list;
            }, this);

            this.totalText = ko.pureComputed(function() {
                // TODO Conditional formatting for big numbers cases
                return '(' + this.total() + ')';
            }, this);
        }
    });
    
    /// ServiceProfessionalInfo
    ko.components.register('app-service-professional-info', {
        template: { element: 'service-professional-info-template' },
        viewModel: require('./viewmodels/ServiceProfessionalInfo')
    });
};

},{"./utils/getObservable":158,"./utils/jsPropertiesTools":161,"./viewmodels/AppointmentCard":175,"./viewmodels/ServiceProfessionalInfo":183,"./viewmodels/TimeSlot":185,"knockout":false}],60:[function(require,module,exports){
/**
    Navbar extension of the App,
    adds the elements to manage a view model
    for the NavBar and automatic changes
    under some model changes like user login/logout
**/
'use strict';

var ko = require('knockout'),
    $ = require('jquery'),
    NavBar = require('./viewmodels/NavBar'),
    NavAction = require('./viewmodels/NavAction');

exports.extends = function (app) {
    
    // REVIEW: still needed? Maybe the per activity navBar means
    // this is not needed. Some previous logic was already removed
    // because was useless.
    //
    // Adjust the navbar setup depending on current user,
    // since different things are need for logged-in/out.
    function adjustUserBar() {

        var user = app.model.user();

        if (user.isAnonymous()) {
            app.navBar().leftAction(NavAction.menuOut);
        }
    }
    // Commented lines, used previously but unused now, it must be enough with the update
    // per activity change
    //app.model.user().isAnonymous.subscribe(updateStatesOnUserChange);
    //app.model.user().onboardingStep.subscribe(updateStatesOnUserChange);
    
    app.navBar = ko.observable(null);
    
    var refreshNav = function refreshNav() {
        // Trigger event to force a component update
        $('.AppNav').trigger('contentChange');
    };
    var autoRefreshNav = function autoRefreshNav(action) {
        if (action) {
            action.text.subscribe(refreshNav);
            action.isTitle.subscribe(refreshNav);
            action.icon.subscribe(refreshNav);
            action.isMenu.subscribe(refreshNav);
        }
    };

    /**
        Update the nav model using the Activity defaults
    **/
    app.updateAppNav = function updateAppNav(activity, state) {

        // if the activity has its own
        if ('navBar' in activity) {
            if (activity.navBar === null) {
                // Activity requires no menu, create a hidden NavBar instance
                app.navBar(new NavBar({
                    hidden: true
                }));
            }
            else {
                // Use specializied activity bar data
                app.navBar(activity.navBar);
            }
        }
        else {
            // Use default one
            app.navBar(new NavBar());
        }
        
        app.applyNavbarMustReturn(state);

        // TODO Double check if needed.
        // Latest changes, when needed
        adjustUserBar();
        
        refreshNav();
        autoRefreshNav(app.navBar().leftAction());
        autoRefreshNav(app.navBar().rightAction());
    };
    
    app.applyNavbarMustReturn = function(state) {
        if (state && state.route && state.route.query &&
            state.route.query.mustReturn) {
            var returnLink = decodeURIComponent(state.route.query.mustReturn);
            // A text can be provided
            var returnText = decodeURIComponent(state.route.query.returnText || '');

            if (returnLink === '1' || returnLink === 'true') {
                // Left action forced to be a go-back
                app.navBar().leftAction(NavAction.goBack.model.clone({
                    text: returnText,
                    isShell: true,
                    isTitle: true
                }));
            }
            else {
                // Left action force to return to the given URL
                app.navBar().leftAction(NavAction.goBack.model.clone({
                    link: returnLink,
                    text: returnText,
                    isShell: false,
                    isTitle: true
                }));
            }
            return true;
        }
        return false;
    };
    
    
    /**
        Update the app menu to highlight the
        given link name
    **/
    app.updateMenu = function updateMenu(name) {
        
        var $menu = $('.App-menus .navbar-collapse');
        
        // Remove any active
        $menu
        .find('li')
        .removeClass('active');
        // Add active
        $menu
        .find('.go-' + name)
        .closest('li')
        .addClass('active');
        // Hide menu
        $menu
        .filter(':visible')
        .collapse('hide');
    };
    
    app.setupNavBarBinding = function setupNavBarBinding() {
        // Set model for the AppNav
        app.navBarBinding = {
            navBar: app.navBar,
            // Both: are later filled with a call to the model once loaded and ready
            photoUrl: ko.observable('about:blank'),
            userName: ko.observable('Me')
        };
        ko.applyBindings(app.navBarBinding, $('.AppNav').get(0));
    };
    
    /**
        Performs the 'back' task from the navbar link, if any.
        That is, trigger the left action.
        Fallback to shell goBack
    **/
    app.performsNavBarBack = function performsNavBarBack(options) {
        var nav = this.navBar(),
            left = nav && nav.leftAction(),
            $btn = $('.SmartNavBar-edge.left > a.SmartNavBar-btn');

        // There is an action, trigger like a click so all the handlers
        // attached on spare places do their work:
        if (left && !left.isMenu()) {
            var event = $.Event('click');
            event.options = options || {};
            $btn.trigger(event);
        }
        else if (this.shell) {
            this.shell.goBack();
        }
    };
    
    /**
        It shows an unobtrusive notification on the navbar place, that
        hides after a short timeout
    **/
    var lastNotificationTimer = null;
    app.showNavBarNotification = function showNavBarNotification(settings) {
        var msg = settings && settings.message || 'Hello World!',
            duration = settings && settings.duration || 2000,
            transitionDuration = settings && settings.transitionDuration || 400,
            $el = $('.AppNav .SmartNavBar-notification');

        $el.text(msg);
        $el.fadeIn(transitionDuration)
        .queue(function() {
            
            // Manual hide on clicking
            $el
            .off('click.manualHide')
            .on('click.manualHide', function() {
                $el.fadeOut(transitionDuration);
            });
            
            // Auto hide after timeout
            clearTimeout(lastNotificationTimer);
            lastNotificationTimer = setTimeout(function() {
                $el.fadeOut(transitionDuration);
            }, duration);
            
            $(this).dequeue();
        });
    };
};

},{"./viewmodels/NavAction":179,"./viewmodels/NavBar":180,"knockout":false}],61:[function(require,module,exports){
/**
    List of activities loaded in the App,
    as an object with the activity name as the key
    and the controller as value.
**/
'use strict';

var Activity = require('./components/Activity');
var EmptyActivity = Activity.extends(function EmptyActivity() {

    Activity.apply(this, arguments);

    this.accessLevel = null;
    this.viewModel = {};
    this.navBar = Activity.createSectionNavBar();
});

module.exports = {
    '_test': EmptyActivity,
    'calendar': require('./activities/calendar'),
    'datetimePicker': require('./activities/datetimePicker'),
    'clients': require('./activities/clients'),
    'serviceProfessionalService': require('./activities/serviceProfessionalService'),
    'serviceAddresses': require('./activities/serviceAddresses'),
    'textEditor': require('./activities/textEditor'),
    'dashboard': require('./activities/dashboard'),
    'appointment': require('./activities/appointment'),
    'index': require('./activities/index'),
    'login': require('./activities/login'),
    'logout': require('./activities/logout'),
    'learnMore': require('./activities/learnMore'),
    'signup': require('./activities/signup'),
    'contactInfo': require('./activities/contactInfo'),
    'welcome': require('./activities/welcome'),
    'addressEditor': require('./activities/addressEditor'),
    'account': require('./activities/account'),
    'inbox': require('./activities/inbox'),
    'conversation': require('./activities/conversation'),
    'scheduling': require('./activities/scheduling'),
    'jobtitles': require('./activities/jobtitles'),
    'feedback': require('./activities/feedback'),
    'faqs': require('./activities/faqs'),
    'feedbackForm': require('./activities/feedbackForm'),
    'contactForm': require('./activities/contactForm'),
    'cms': require('./activities/cms'),
    'clientEditor': require('./activities/clientEditor'),
    'schedulingPreferences': require('./activities/schedulingPreferences'),
    'calendarSyncing': require('./activities/calendarSyncing'),
    'weeklySchedule': require('./activities/weeklySchedule'),
    'bookMeButton': require('./activities/bookMeButton'),
    'ownerInfo': require('./activities/ownerInfo'),
    'privacySettings': require('./activities/privacySettings'),
    'addJobTitles': require('./activities/addJobTitles'),
    'serviceProfessionalServiceEditor': require('./activities/serviceProfessionalServiceEditor'),
    'marketplaceProfile': require('./activities/marketplaceProfile'),
    'marketplaceJobtitles': require('./activities/marketplaceJobtitles'),
    'profilePictureBio': require('./activities/profilePictureBio'),
    'servicesOverview': require('./activities/servicesOverview'),
    'verifications': require('./activities/verifications'),
    'education': require('./activities/education'),
    'serviceProfessionalWebsite': require('./activities/serviceProfessionalWebsite'),
    'backgroundCheck': require('./activities/backgroundCheck'),
    'educationForm': require('./activities/educationForm'),
    'cancellationPolicy': require('./activities/cancellationPolicy'),
    'licensesCertifications': require('./activities/licensesCertifications'),
    'licensesCertificationsForm': require('./activities/licensesCertificationsForm'),
    'workPhotos': require('./activities/workPhotos'),
    'profile': require('./activities/profile'),
    'home': require('./activities/home'),
    'booking': require('./activities/booking')
};

},{"./activities/account":8,"./activities/addJobTitles":9,"./activities/addressEditor":10,"./activities/appointment":11,"./activities/backgroundCheck":12,"./activities/bookMeButton":13,"./activities/booking":14,"./activities/calendar":15,"./activities/calendarSyncing":16,"./activities/cancellationPolicy":17,"./activities/clientEditor":18,"./activities/clients":19,"./activities/cms":20,"./activities/contactForm":21,"./activities/contactInfo":22,"./activities/conversation":23,"./activities/dashboard":24,"./activities/datetimePicker":25,"./activities/education":26,"./activities/educationForm":27,"./activities/faqs":28,"./activities/feedback":29,"./activities/feedbackForm":30,"./activities/home":31,"./activities/inbox":32,"./activities/index":33,"./activities/jobtitles":34,"./activities/learnMore":35,"./activities/licensesCertifications":36,"./activities/licensesCertificationsForm":37,"./activities/login":38,"./activities/logout":39,"./activities/marketplaceJobtitles":40,"./activities/marketplaceProfile":41,"./activities/ownerInfo":42,"./activities/privacySettings":43,"./activities/profile":44,"./activities/profilePictureBio":45,"./activities/scheduling":46,"./activities/schedulingPreferences":47,"./activities/serviceAddresses":48,"./activities/serviceProfessionalService":49,"./activities/serviceProfessionalServiceEditor":50,"./activities/serviceProfessionalWebsite":51,"./activities/servicesOverview":52,"./activities/signup":53,"./activities/textEditor":54,"./activities/verifications":55,"./activities/weeklySchedule":56,"./activities/welcome":57,"./activities/workPhotos":58,"./components/Activity":90}],62:[function(require,module,exports){
'use strict';

/** Global dependencies **/
var $ = require('jquery');
require('jquery-mobile');
require('./utils/jquery.multiline');
var ko = require('knockout');
ko.bindingHandlers.format = require('ko/formatBinding').formatBinding;
var bootknock = require('./utils/bootknockBindingHelpers');
require('./utils/Function.prototype._inherits');
require('./utils/Function.prototype._delayed');
// Polyfill for useful non-standard feature Function.name for IE9+
// (feature used to simplify creation of Activities and Models)
require('./utils/Function.prototype.name-polyfill');
// Promise polyfill, so its not 'require'd per module:
require('es6-promise').polyfill();

var layoutUpdateEvent = require('layoutUpdateEvent');
var AppModel = require('./appmodel/AppModel');

// Register the special locale
require('./locales/en-US-LC');

var attachFastClick = require('fastclick').attach;

/**
    A set of fixes/workarounds for Bootstrap behavior/plugins
    to be executed before Bootstrap is included/executed.
    For example, because of data-binding removing/creating elements,
    some old references to removed items may get alive and need update,
    or re-enabling some behaviors.
**/
function preBootstrapWorkarounds() {
    // Internal Bootstrap source utility
    function getTargetFromTrigger($trigger) {
        var href,
            target = $trigger.attr('data-target') ||
            (href = $trigger.attr('href')) && 
            href.replace(/.*(?=#[^\s]+$)/, ''); // strip for ie7

        return $(target);
    }
    
    // Bug: navbar-collapse elements hold a reference to their original
    // $trigger, but that trigger can change on different 'clicks' or
    // get removed the original, so it must reference the new one
    // (the latests clicked, and not the cached one under the 'data' API).    
    // NOTE: handler must execute before the Bootstrap handler for the same
    // event in order to work.
    $(document).on('click.bs.collapse.data-api.workaround', '[data-toggle="collapse"]', function() {
        var $t = $(this),
            $target = getTargetFromTrigger($t),
            data = $target && $target.data('bs.collapse');
        
        // If any
        if (data) {
            // Replace the trigger in the data reference:
            data.$trigger = $t;
        }
        // On else, nothing to do, a new Collapse instance will be created
        // with the correct target, the first time
    });
}

/**
    App static class
**/
var app = {
    shell: require('./app.shell'),
    
    // New app model, that starts with anonymous user
    model: new AppModel(),
    
    /** Load activities controllers (not initialized) **/
    activities: require('./app.activities'),
    
    modals: require('./app.modals'),
    
    /**
        Just redirect the better place for current user and state.
        NOTE: Its a delayed function, since on many contexts need to
        wait for the current 'routing' from end before do the new
        history change.
        TODO: Maybe, rather than delay it, can stop current routing
        (changes on Shell required) and perform the new.
        TODO: Maybe alternative to previous, to provide a 'replace'
        in shell rather than a go, to avoid append redirect entries
        in the history, that create the problem of 'broken back button'
    **/
    goDashboard: function goDashboard() {
        
        // To avoid infinite loops if we already are performing 
        // a goDashboard task, we flag the execution
        // being care of the delay introduced in the execution
        if (goDashboard._going === true) {
            return;
        }
        else {
            // Delayed to avoid collisions with in-the-middle
            // tasks: just allowing current routing to finish
            // before perform the 'redirect'
            // TODO: change by a real redirect that is able to
            // cancel the current app.shell routing process.
            setTimeout(function() {
        
                goDashboard._going = true;

                var onboarding = this.model.onboarding.stepUrl();

                if (onboarding) {
                    this.shell.go(onboarding);
                }
                else {
                    this.shell.go('/dashboard');
                }

                // Just because is delayed, needs
                // to be set off after an inmediate to 
                // ensure is set off after any other attempt
                // to add a delayed goDashboard:
                setTimeout(function() {
                    goDashboard._going = false;
                }, 1);
            }.bind(this), 1);
        }
    }
};

/** Continue app creation with things that need a reference to the app **/

require('./app-navbar').extends(app);

require('./app-components').registerAll();

app.getActivity = function getActivity(name) {
    var activity = this.activities[name];
    if (activity) {
        var $act = this.shell.items.find(name);
        if ($act && $act.length)
            return activity.init($act, this);
    }
    return null;
};

app.getActivityControllerByRoute = function getActivityControllerByRoute(route) {
    // From the route object, the important piece is route.name
    // that contains the activity name except if is the root
    var actName = route.name || this.shell.indexName;
    
    return this.getActivity(actName);
};

// accessControl setup: cannot be specified on Shell creation because
// depends on the app instance
app.shell.accessControl = require('./utils/accessControl')(app);

// Shortcut to UserType enumeration used to set permissions
app.UserType = require('./models/User').UserType;

// New method for common forms behavior after a successful save operation,
// the activity goes back (following the navbar back-link or shell.goBack())
// and notifying with a temporary unobtrusive navbar notification
app.successSave = function successSave(settings) {
    // defaults
    settings = $.extend({
        message: 'Your changes have been saved',
        link: null
    }, settings);
    
    // show notification
    this.showNavBarNotification(settings);
    
    // requested link or current activity go back
    if (settings.link)
        this.shell.go(settings.link);
    else
        this.performsNavBarBack({ silentMode: true });
};

/** App Init **/
var appInit = function appInit() {
    /*jshint maxstatements:50,maxcomplexity:16 */
    
    attachFastClick(document.body);
    
    // Jquery-ui components used
    require('jquery-ui/autocomplete');
    // Knockout binding for jquery-ui sortable.
    // It loads jquery-ui sortable and draggable as dependencies:
    require('knockout-sortable');
    // Just AFTER jquery-ui is loaded (or the selected components), load
    // the fix for touch support:
    require('jquery.ui.touch-punch');
    
    // Enabling the 'layoutUpdate' jQuery Window event that happens on resize and transitionend,
    // and can be triggered manually by any script to notify changes on layout that
    // may require adjustments on other scripts that listen to it.
    // The event is throttle, guaranting that the minor handlers are executed rather
    // than a lot of them in short time frames (as happen with 'resize' events).
    layoutUpdateEvent.layoutUpdateEvent += ' orientationchange';
    layoutUpdateEvent.on();
    
    // Keyboard plugin events are not compatible with jQuery events, but needed to
    // trigger a layoutUpdate, so here are connected, mainly fixing bugs on iOS when the keyboard
    // is hidding.
    var trigLayout = function trigLayout() {
        $(window).trigger('layoutUpdate');
    };
    window.addEventListener('native.keyboardshow', trigLayout);
    window.addEventListener('native.keyboardhide', trigLayout);

    // iOS-7+ status bar fix. Apply on plugin loaded (cordova/phonegap environment)
    // and in any system, so any other systems fix its solved too if needed 
    // just updating the plugin (future proof) and ensure homogeneous cross plaftform behavior.
    if (window.StatusBar) {
        // Fix iOS-7+ overlay problem
        // Is in config.xml too, but seems not to work without next call:
        window.StatusBar.overlaysWebView(false);
    }
    
    // Force an update delayed to ensure update after some things did additional work
    setTimeout(function() {
        $(window).trigger('layoutUpdate');
    }, 200);
    
    // Bootstrap
    preBootstrapWorkarounds();
    require('bootstrap');
    
    // Load Knockout binding helpers
    bootknock.plugIn(ko);
    require('./utils/bootstrapSwitchBinding').plugIn(ko);
    
    // Plugins setup
    if (window.cordova && window.cordova.plugins && window.cordova.plugins.Keyboard) {
        // Explicitely, we WANT auto scroll on keyboard show up.
        // Can be disabled only if there is a javascript solution to autoscroll
        // on input focus, else a bug will happen specially on iOS where input
        // fields gets hidden by the on screen keyboard.
        window.cordova.plugins.Keyboard.disableScroll(false);
    }
    
    // Easy links to shell actions, like goBack, in html elements
    // Example: <button data-shell="goBack 2">Go 2 times back</button>
    // NOTE: Important, registered before the shell.run to be executed
    // before its 'catch all links' handler
    $(document).on('click', '[data-shell]', function(e) {
        // Using attr rather than the 'data' API to get updated
        // DOM values
        var cmdline = $(this).attr('data-shell') || '',
            args = cmdline.split(' '),
            cmd = args[0];

        if (cmd && typeof(app.shell[cmd]) === 'function') {
            app.shell[cmd].apply(app.shell, args.slice(1));
            
            // Cancel any other action on the link, to avoid double linking results
            e.stopImmediatePropagation();
            e.preventDefault();
        }
    });
    
    // On Cordova/Phonegap app, special targets must be called using the window.open
    // API to ensure is correctly opened on the InAppBrowser (_blank) or system default
    // browser (_system).
    if (window.cordova) {
        $(document).on('click', '[target="_blank"], [target="_system"]', function(e) {
            window.open(this.getAttribute('href'), this.getAttribute('target'));
            e.preventDefault();
        });
    }
    
    // When an activity is ready in the Shell:
    app.shell.on(app.shell.events.itemReady, function($act, state) {
        
        // Must be the same:
        var routeName = app.shell.currentRoute.name;
        var actName = $act.data('activity');
        // If not, some race condition, not the same page go out
        if (routeName !== actName)
            return;

        // Connect the 'activities' controllers to their views
        var activity = app.getActivity(actName);
        // Trigger the 'show' logic of the activity controller:
        activity.show(state);
        
        // The show logic may do a redirect, loading other activity, double check
        routeName = app.shell.currentRoute.name;
        if (routeName !== actName)
            return;

        // Update menu
        var menuItem = activity.menuItem || actName;
        app.updateMenu(menuItem);

        // Update app navigation
        app.updateAppNav(activity, state);
    });
    // When an activity is hidden
    app.shell.on(app.shell.events.closed, function($act) {
        
        // Connect the 'activities' controllers to their views
        var actName = $act.data('activity');
        var activity = app.getActivity(actName);
        // Trigger the 'hide' logic of the activity controller:
        if (activity.hide)
            activity.hide();
    });
    // Catch errors on item/page loading, showing..
    app.shell.on('error', function(err) {
        app.modals.showError({ error: err });
    });
    
    // Scroll to element when clicking a usual fragment link (not a page link)
    var scrollToElement = require('./utils/scrollToElement');
    app.shell.on('fragmentNavigation', function(href) {
        // Check link, avoiding empty links
        // (href comes with the initial hash ever, so empty is just '#')
        if (href === '#') {
            // Notify for debugging, because this may be unwanted
            console.warn(
                'Navigation to an empty fragment, this may be not wanted. ' +
                'For root links, use "/"; on script handled links, call event.preventDefault; ' +
                'A touch event was listened on a link, but not the click event.'
            );
        }
        else {
            // Locate target
            var target = $(href);
            if (target.length) {
                // Smooth scrolling with animation
                scrollToElement(target, { animation: { duration: 300 } });
            }
        }
    });
    
    // Navbar binding
    app.setupNavBarBinding();
    
    var SmartNavBar = require('./components/SmartNavBar');
    var navBars = SmartNavBar.getAll();
    // Creates an event by listening to it, so other scripts can trigger
    // a 'contentChange' event to force a refresh of the navbar (to 
    // calculate and apply a new size); expected from dynamic navbars
    // that change it content based on observables.
    navBars.forEach(function(navbar) {
        $(navbar.el).on('contentChange', function() {
            navbar.refresh();
        });
    });
    
    // Listen for menu events (collapse in SmartNavBar)
    // to apply the backdrop; add another class, explicit for know the menu/nav is opened
    var togglingBackdrop = false;
    $(document).on('show.bs.collapse hide.bs.collapse', '.AppNav .navbar-collapse', function(e) {
        if (!togglingBackdrop) {
            togglingBackdrop = true;
            var enabled = e.type === 'show';
            $('body').toggleClass('use-backdrop', enabled);
            $('body').toggleClass('has-appNav-open', enabled);
            // Hide any other opened collapse
            $('.collapsing, .collapse.in').collapse('hide');
            togglingBackdrop = false;
        }
    });

    // Catch uncatch model errors
    app.model.on('error', function(err) {
        app.modals.showError({
            error: err
        });
    });
    
    // Additional form elements attribute and behavior: data-autoselect=true
    // sets to automatically select the text content of an input text control
    // when gets the focus
    $(document).on('focus', '[data-autoselect="true"]', function() {
        $(this).select();
    });
    
    // App init:
    var alertError = function(err) {
        app.modals.showError({
            title: 'There was an error loading',
            error: err
        });
    };

    app.model.init()
    .then(app.shell.run.bind(app.shell), alertError)
    .then(function() {
        // Mark the page as ready
        $('html').addClass('is-ready');
        // As app, hides splash screen
        if (window.navigator && window.navigator.splashscreen) {
            window.navigator.splashscreen.hide();
        }
        
        // Connect username in navbar
        ko.computed(function() {
            var n = app.model.userProfile.data.firstName();
            app.navBarBinding.userName(n || 'Me');
        });
        // Connect photoUrl in navbar
        ko.computed(function() {
            var n = app.model.marketplaceProfile.data.photoUrl();
            app.navBarBinding.photoUrl(n || 'about:blank');
        });
        
        // Onboarding model needs initialization
        app.model.onboarding.init(app);

        // Check onboarding step to redirect there on app start
        var step = app.model.user().onboardingStep();
        if (step && 
            app.model.onboarding.setStep(step)) {
            var url = app.model.onboarding.stepUrl();
            app.shell.go(url);
        }

    }, alertError);

    // DEBUG
    window.app = app;
};

// App init on page ready and phonegap ready
if (window.cordova) {
    // On DOM-Ready first
    $(function() {
        // Page is ready, device is too?
        // Note: Cordova ensures to call the handler even if the
        // event was already fired, so is good to do it inside
        // the dom-ready and we are ensuring that everything is
        // ready.
        $(document).on('deviceready', appInit);
    });
} else {
    // Only on DOM-Ready, for in browser development
    $(appInit);
}

},{"./app-components":59,"./app-navbar":60,"./app.activities":61,"./app.modals":63,"./app.shell":64,"./appmodel/AppModel":75,"./components/SmartNavBar":92,"./locales/en-US-LC":93,"./models/User":130,"./utils/Function.prototype._delayed":138,"./utils/Function.prototype._inherits":139,"./utils/Function.prototype.name-polyfill":140,"./utils/accessControl":149,"./utils/bootknockBindingHelpers":151,"./utils/bootstrapSwitchBinding":152,"./utils/jquery.multiline":160,"./utils/scrollToElement":163,"es6-promise":false,"jquery-ui/autocomplete":1,"knockout":false,"knockout-sortable":false}],63:[function(require,module,exports){
/**
    Access to use global App Modals
**/
'use strict';

var $ = require('jquery');

/**
    Generates a text message, with newlines if needed, describing the error
    object passed.
    @param err:any As a string, is returned 'as is'; as falsy, it return a generic
    message for 'unknow error'; as object, it investigate what type of error is to
    provide the more meaninful result, with fallback to JSON.stringify prefixed
    with 'Technical details:'.
    Objects recognized:
    - XHR/jQuery for JSON responses: just objects with responseJSON property, is
      used as the 'err' object and passed to the other object tests.
    - Object with 'errorMessage' (server-side formatted error).
    - Object with 'message' property, like the standard Error class and Exception objects.
    - Object with 'name' property, like the standard Exception objects. The name, if any,
      is set as prefix for the 'message' property value.
    - Object with 'errors' property. Each element in the array or object own keys
      is appended to the errorMessage or message separated by newline.
**/
exports.getErrorMessageFrom = function getErrorMessageFrom(err, defaultText) {
    /*jshint maxcomplexity:14, maxdepth:5*/

    defaultText = defaultText || 'Unknow error';
    
    if (!err) {
        return defaultText;
    }
    else if (typeof(err) === 'string') {
        return err || defaultText;
    }
    else {
        // If is a XHR object, use its response as the error.
        err = err.responseJSON || err;

        var msg = err.name && (err.name + ': ') || '';
        msg += err.errorMessage || err.message || '';

        if (err.errors) {
            msg += '\n' + exports.stringifyErrorsList(err.errors);
        }
        else {
            // Avoiding that en error converting the object (circular references)
            // breaks the error control!
            try {
                var jserr = JSON.stringify(err);
                // Avoiding that empty results (empty string or empty object when there
                // is no details to show) makes us to show an annoying 'technical details'
                var hasMoreInfo = jserr && jserr !== '{}';
                // Too if there is no more information than the one extracted to build the
                // message, since on that cases the 'technical details' will be just a 
                // json formatted of the same displayed message
                if (hasMoreInfo) {
                    // Reset initially, re-enabled only if there are more properties
                    // than the ones from the list
                    hasMoreInfo = false;
                    var messagePropertiesList = ['name', 'errorMessage', 'message', 'errors'];
                    Object.keys(err).forEach(function(key) {
                        if (messagePropertiesList.indexOf(key) === -1)
                            hasMoreInfo = true;
                    });
                }

                if (hasMoreInfo)
                    msg += '\n\nTechnical details: ' + jserr;
            }
            catch (ex) {
                console.log('Impossible to stringify JSON error', err, ex);
            }
        }

        return msg || defaultText;
    }
};

exports.stringifyErrorsList = function (errors) {
    var msg = '';
    if (Array.isArray(errors)) {
        msg = errors.join('\n');
    }
    else {
        msg = Object.keys(errors).map(function(key) {
            return errors[key].join('\n');
        }).join('\n');
    }
    return msg;
};

/**
    Show an error modal to notify the user.
    @param options:Object {
        message:string DEPRECATED. Optional. Informative error message.
        error:string Optional. Error/Exception/XHR object, used to auto
            generate the error message. It takes precedence over 'message'
            option, discarding an error object/string is passed.
            It replaces 'message' since can do the same and more.
        title:string Optional. The text to show in the modal's header,
            with fallback to the Modal's default title.
    }
    @returns Promise. It resolves when the modal is dismissed/closed.
    No formal rejection happens.
**/
exports.showError = function showErrorModal(options) {
    
    var modal = $('#errorModal'),
        header = modal.find('#errorModal-label'),
        body = modal.find('#errorModal-body');
    
    options = options || {};
    
    // Fallback error message
    var msg = body.data('default-text');

    // Error message from given error object, with fallback to default one.
    // DEPRECATED temporarly using the 'message' option.
    msg = exports.getErrorMessageFrom(options.error || options.message, msg);

    body.multiline(msg);

    header.text(options.title || header.data('default-text'));
    
    return new Promise(function(resolve) {
        modal.modal('show');
        modal.on('hide.bs.modal', function() {
            resolve();
        });
    });
};

/**
    Show confirmation modal with two buttons.
    @param options:object {
        title:string Header title text
        message:string Message text
        yes:string Yes button label
        no:string No button label
    }
    @returns Promise. It resolves if button 'yes' pressed
    and reject on button 'no' pressed or modal dismissed/closed.
**/
exports.confirm = function confirm(options) {
    
    var modal = $('#confirmModal'),
        header = modal.find('#confirmModal-label'),
        body = modal.find('#confirmModal-body'),
        yesBtn = modal.find('#confirmModal-yesBtn'),
        noBtn = modal.find('#confirmModal-noBtn');

    options = options || {};

    // Fallback error message
    var title = header.data('default-text'),
        msg = body.data('default-text'),
        yes = yesBtn.data('default-text'),
        no = noBtn.data('default-text');

    body.multiline(options.message || msg);
    header.text(options.title || title);
    yesBtn.text(options.yes || yes);
    noBtn.text(options.no || no);

    return new Promise(function(resolve, reject) {
        modal.modal('show');
        yesBtn.on('click', function() {
            resolve();
        });
        noBtn.on('click', function() {
            reject();
        });
        modal.on('hide.bs.modal', function() {
            reject();
        });
    });
};

/**
    Show an information modal to notify the user about something.
    @param options:Object {
        message:string. Informative message.
        title:string Optional. The text to show in the modal's header,
            with fallback to the Modal's default title.
    }
    @returns Promise. It resolves when the modal is dismissed/closed.
    No formal rejection happens.
**/
exports.showNotification = function showNotification(options) {
    
    var modal = $('#notificationModal'),
        header = modal.find('#notificationModal-label'),
        body = modal.find('#notificationModal-body');

    options = options || {};
    
    // Fallback message
    var msg = options.message || body.data('default-text');

    body.multiline(msg);

    header.text(options.title || header.data('default-text'));
    
    return new Promise(function(resolve) {
        modal.modal('show');
        modal.on('hide.bs.modal', function() {
            resolve();
        });
    });
};

exports.showTimePicker = require('./modals/timePicker').show;

},{"./modals/timePicker":94}],64:[function(require,module,exports){
/**
    Setup of the shell object used by the app
**/
'use strict';

var baseUrl = window.location.pathname;

//var History = require('./app-shell-history').create(baseUrl);
var History = require('./utils/shell/hashbangHistory');

// Shell dependencies
var shell = require('./utils/shell/index'),
    Shell = shell.Shell,
    DomItemsManager = shell.DomItemsManager;

//var iOS = /(iPad|iPhone|iPod)/g.test( navigator.userAgent );

// Creating the shell:
var shell = new Shell({

    // Selector, DOM element or jQuery object pointing
    // the root or container for the shell items
    root: 'App-activities', //'body',

    // If is not in the site root, the base URL is required:
    baseUrl: baseUrl,
    
    forceHashbang: true,

    indexName: 'index',

    linkEvent: 'click',

    // No need for loader, everything comes bundled
    loader: null,

    // History Polyfill:
    history: History,

    // A DomItemsManager or equivalent object instance needs to
    // be provided:
    domItemsManager: new DomItemsManager({
        idAttributeName: 'data-activity',
        root: '.App-activities'
    })
});

module.exports = shell;

},{"./utils/shell/hashbangHistory":168,"./utils/shell/index":169}],65:[function(require,module,exports){
/** 
    AppModel extension,
    focused on the Account related APIs:
    - login
    - logout
    - signup
**/
'use strict';

var localforage = require('localforage');

exports.plugIn = function (AppModel) {
    /**
        Try to perform an automatic login if there is a local
        copy of credentials to use on that,
        calling the login method that save the updated
        data and profile.
    **/
    AppModel.prototype.tryLogin = function tryLogin() {
        // Get saved credentials
        return localforage.getItem('credentials')
        .then(function(credentials) {
            // If we have ones, try to log-in
            if (credentials) {
                // Attempt login with that
                return this.login(
                    credentials.username,
                    credentials.password
                );
            } else {
                throw new Error('No saved credentials');
            }
        }.bind(this));
    };

    /**
        Performs a login attempt with the API by using
        the provided credentials.
    **/
    AppModel.prototype.login = function login(username, password) {

        // Reset the extra headers to attempt the login
        this.rest.extraHeaders = null;

        return this.rest.post('login', {
            username: username,
            password: password,
            returnProfile: true
        }).then(performLocalLogin(this, username, password));
    };

    /**
        Performs a logout, removing cached credentials
        and profile so the app can be filled up with
        new user information.
        It calls to the API logout call too, to remove
        any server-side session and notification
        (removes the cookie too, for browser environment
        that may use it).
    **/
    // FUTURE: TOREVIEW if the /logout call can be removed.
    AppModel.prototype.logout = function logout() {

        // Local app close session
        this.rest.extraHeaders = null;
        localforage.removeItem('credentials');
        localforage.removeItem('profile');
        
        // Local data clean-up!
        this.clearLocalData();

        // Don't need to wait the result of the REST operation
        this.rest.post('logout');

        return Promise.resolve();
    };

    /**
        Attempts to create a user account, getting logged
        if successfully like when doing a login call.
    **/
    AppModel.prototype.signup = function signup(username, password, profileType) {

        // Reset the extra headers to attempt the signup
        this.rest.extraHeadres = null;

        // The result is the same as in a login, and
        // we do the same as there to get the user logged
        // on the app on sign-up success.
        return this.rest.post('signup?utm_source=app', {
            username: username,
            password: password,
            profileType: profileType,
            returnProfile: true
        }).then(performLocalLogin(this, username, password));
    };
};

function performLocalLogin(thisAppModel, username, password) {

    return function(logged) {
        
        // Remove any previous local data if any:
        return thisAppModel.clearLocalData()
        .then(function() {

            // use authorization key for each
            // new Rest request
            thisAppModel.rest.extraHeaders = {
                alu: logged.userID,
                alk: logged.authKey
            };

            // async local save, don't wait
            localforage.setItem('credentials', {
                userID: logged.userID,
                username: username,
                password: password,
                authKey: logged.authKey
            });
            // IMPORTANT: Local name kept in sync with set-up at AppModel.userProfile
            localforage.setItem('profile', logged.profile);

            // Set user data
            thisAppModel.user().model.updateWith(logged.profile);

            return logged;
        });
    };
}

},{"localforage":false}],66:[function(require,module,exports){
/** Bookings

    IMPORTANT!!!! API not to use directly by the app, but through appModel.calendar (it has cache and more)
**/
'use strict';

var Booking = require('../models/Booking'),
    moment = require('moment'),
    ko = require('knockout');

exports.create = function create(appModel) {

    var api = {
        remote: {
            rest: appModel.rest,
            getBookings: function(filters) {
                return appModel.rest.get('me/bookings', filters)
                .then(function(rawItems) {
                    return rawItems && rawItems.map(function(rawItem) {
                        return new Booking(rawItem);
                    });
                });
            }
        }
    };

    api.getBookingsByDates = function getBookingsByDates(date, end) {
        
        end = end || moment(date).clone().add(1, 'days').toDate();
        
        // Remote loading data
        return api.remote.getBookings({
            start: date,
            end: end
        }).then(function(bookings) {
            // Put in cache (they are already model instances)
            var arr = ko.observableArray(bookings);
            // Return the observable array
            return arr;
        });
    };
    
    /**
        Get upcoming bookings meta-information for dashboard page
    **/
    api.getUpcomingBookings = function getUpcomingBookings() {
        return appModel.rest.get('me/upcoming-bookings');
    };

    /**
        Get a specific booking by ID
    **/
    api.getBooking = function getBooking(id) {
        if (!id) return Promise.reject('The bookingID is required to get a booking');
        return appModel.rest.get('me/bookings/' + id)
        .then(function(booking) {
            return new Booking(booking);
        });
    };
    
    /**
        Converts an Appointment model into a simplified
        booking plain object, suitable to REST API for edition
    **/
    api.appointmentToSimplifiedBooking = function(apt) {
        return {
            bookingID: apt.sourceBooking().bookingID(),
            jobTitleID: apt.jobTitleID(),
            clientUserID: apt.clientUserID(),
            addressID: apt.addressID(),
            startTime: apt.startTime(),
            pricing: apt.pricing().map(function(pricing) {
                // TODO: for now, the REST API allow only a list of IDs,
                // not objects, so next line is replaced:
                //return pricing.model.toPlainObject(true);
                return pricing.serviceProfessionalServiceID();
            }),
            preNotesToClient: apt.preNotesToClient(),
            preNotesToSelf: apt.preNotesToSelf(),
            postNotesToClient: apt.postNotesToClient(),
            postNotesToSelf: apt.postNotesToSelf()
        };
    };
    /**
        Converst a Booking model into a simplified
        booking plain object, suitable to REST API for edition
    **/
    api.bookingToSimplifiedBooking = function(booking) {
        console.log('DEBUG to simplified booking', booking.pricingSummary());
        return {
            bookingID: booking().bookingID(),
            clientUserID: booking.clientUserID(),
            addressID: booking.addressID(),
            startTime: booking.startTime(),
            pricing: booking.pricingSummary() && booking.pricingSummary().details().pricing
            .map(function(pricing) {
                // TODO: for now, the REST API allow only a list of IDs,
                // not objects, so next line is replaced:
                //return pricing.model.toPlainObject(true);
                return pricing.serviceProfessionalServiceID();
            }),
            preNotesToClient: booking.preNotesToClient(),
            preNotesToSelf: booking.preNotesToSelf(),
            postNotesToClient: booking.postNotesToClient(),
            postNotesToSelf: booking.postNotesToSelf()
        };
    };
    
    /**
        Creates/updates a booking by a service professional, given a simplified booking
        object or an Appointment model or a Booking model
    **/
    api.setServiceProfessionalBooking = function setServiceProfessionalBooking(booking, allowBookUnavailableTime) {    
        booking = booking.bookingID ?
            api.bookingToSimplifiedBooking(booking) :
            booking.sourceBooking ?
                api.appointmentToSimplifiedBooking(booking) :
                booking
        ;

        var id = booking.bookingID || '',
            method = id ? 'put' : 'post';
        
        booking.allowBookUnavailableTime = allowBookUnavailableTime || false;

        return appModel.rest[method]('me/service-professional-booking/' + id, booking)
        .then(function(serverBooking) {
            return new Booking(serverBooking);
        });
    };
    
    /**
        Creates/updates a booking by a client, given a simplified booking
        object or an Appointment model or a Booking model
    **/
    api.setClientBooking = function setClientBooking(booking) {
        booking = booking.bookingID ?
            api.bookingToSimplifiedBooking(booking) :
            booking.sourceBooking ?
                api.appointmentToSimplifiedBooking(booking) :
                booking
        ;

        var id = booking.bookingID || '',
            method = id ? 'put' : 'post';

        return appModel.rest[method]('me/client-booking/' + id, booking)
        .then(function(serverBooking) {
            return new Booking(serverBooking);
        });
    };

    return api;
};

},{"../models/Booking":97,"knockout":false,"moment":false}],67:[function(require,module,exports){
/**
    It offers access to calendar elements (appointments) and availability
    
    Appointments is an abstraction around calendar events
    that behave as bookings or as events (where bookings are built
    on top of an event instance --a booking record must have ever a serviceDateID event).
    
    With this appModel, the APIs to manage events&bookings are combined to offer related
    records easier in Appointments objects.
**/
'use strict';

var Appointment = require('../models/Appointment'),
    DateAvailability = require('../models/DateAvailability'),
    DateCache = require('../utils/DateCache'),
    moment = require('moment'),
    _ = require('lodash'),
    EventEmitter = require('events').EventEmitter;

exports.create = function create(appModel) {

    function Api() {
        EventEmitter.call(this);
        this.setMaxListeners(30);
    }
    Api._inherits(EventEmitter);
    
    var api = new Api();
    
    var cache = new DateCache({
        Model: DateAvailability,
        ttl: { minutes: 10 }
    });
    
    api.clearCache = function clearCache() {
        cache.clear();
        this.emit('clearCache');
    };
    
    appModel.on('clearLocalData', function() {
        api.clearCache();
    });

    /**
        Get a generic calendar appointment object, made of events and/or bookings,
        depending on the given ID in the ids object.
        
        TODO: gets single apt from the DateCache
    **/
    api.getAppointment = function getAppointment(ids) {

        if (ids.calendarEventID) {
            return appModel.calendarEvents.getEvent(ids.calendarEventID)
            .then(Appointment.fromCalendarEvent);
        }
        else if (ids.bookingID) {
            return appModel.bookings.getBooking(ids.bookingID)
            .then(function(booking) {
                // An appointment for booking needs the confirmed event information
                return appModel.calendarEvents.getEvent(booking.serviceDateID())
                .then(function(event) {
                    return Appointment.fromBooking(booking, event);
                });
            });
        }
        else {
            return Promise.reject('Unrecognized ID');
        }
    };
    
    api.setAppointment = function setAppointment(apt, allowBookUnavailableTime) {
        
        // TODO: Saving apt must invalidate the cache and force date
        // availability computation with UI update, when start time or start end changes 
        // (ever when inserting apt), for the previous date and the new one (if date changed)
        // and only date availability computation if date is the same but time changed.
        // And triggers "this.emit('clearCache');" passing as parameter the dates array that needs refresh
        
        // If is a booking
        if (apt.sourceBooking()) {
            return appModel.bookings.setServiceProfessionalBooking(apt, allowBookUnavailableTime)
            .then(function(booking) {
                
                // TODO: clearCache, enhance by discarding only the cache for the previous
                // and new date
                api.clearCache();
                
                // We need the event information too
                return appModel.calendarEvents.getEvent(booking.serviceDateID())
                .then(function(event) {
                    return Appointment.fromBooking(booking, event);
                });
            });
        }
        else if (apt.sourceEvent()) {
            return appModel.calendarEvents.setEvent(apt)
            .then(function(event) {
                return Appointment.fromCalendarEvent(event);
            });
        }
        else {
            return Promise.reject(new Error('Unrecognized appointment object'));
        }
    };
    
    /**
        Get a list of generic calendar appointment objects, made of events and/or bookings
        by Date, from the remote source directly.
        Used internally only, to get appointments with and without free/unavailable
        slots use getDateAvailability
    **/
    var getRemoteAppointmentsByDate = function getRemoteAppointmentsByDate(date) {
        return Promise.all([
            appModel.bookings.getBookingsByDates(date),
            appModel.calendarEvents.getEventsByDates(date)
        ]).then(function(group) {

            var events = group[1],
                bookings = group[0],
                apts = [];

            if (events && events().length) {
                apts = Appointment.listFromCalendarEventsBookings(events(), bookings());
            }

            // Return the array
            return apts;
        });
    };
    
    /**
        Fetch appointments and schedule information for the date from remote
        in a convenient object to use with the DateAvailability model.
    **/
    var getRemoteDateAvailability = function getRemoteDateAvailability(date) {
        return Promise.all([
            getRemoteAppointmentsByDate(date),
            appModel.simplifiedWeeklySchedule.load(),
            appModel.schedulingPreferences.load()
        ])
        .then(function(result) {
            var apts = result[0],
                settings = result[1],
                weekDaySchedule = settings.weekDays[date.getDay()](),
                prefs = result[2];

            var dateInfo = {
                date: date,
                appointmentsList: apts || [],
                weekDaySchedule: weekDaySchedule,
                schedulingPreferences: prefs
            };

            return dateInfo;
        });
    };
    
    /**
        Get the appointments and availability for the given date.
        It has cache control, if there is a valid copy is returned
        at the moment, if is reloaded and exists on cache, that copy is
        updated so all previous instances get the updated data too.
    **/
    api.getDateAvailability = function getDateAvailability(date) {
        
        var cached = cache.getSingle(date);

        if (cached) {
            return Promise.resolve(cached);
        }
        else {
            return getRemoteDateAvailability(date)
            .then(function(dateInfo) {
                // Update cache and retun data as class instance
                return cache.set(date, dateInfo).data;
            });
        }
    };
    
    
    //////
    // NEW MULTI DATES API
    
    /**
        Get a list of generic calendar appointment objects, made of events and/or bookings
        by Date, from the remote source directly.
        Used internally only, to get appointments with and without free/unavailable
        slots use getDateAvailability
    **/
    var getRemoteAppointmentsByDates = function getRemoteAppointmentsByDates(start, end) {
        return Promise.all([
            appModel.bookings.getBookingsByDates(start, end),
            appModel.calendarEvents.getEventsByDates(start, end)
        ]).then(function(group) {

            var events = group[1],
                bookings = group[0],
                apts = [];

            if (events && events().length) {
                apts = Appointment.listFromCalendarEventsBookings(events(), bookings());
            }

            // Group apts by date
            var grouped = _.groupBy(apts, function(apt) {
                return moment(apt.startTime()).format('YYYY-MM-DD');
            });
            
            // Ensure all the dates in the range are filled, with empty arrays in the holes.
            // NOTE: this way of first group apts and then fill gaps makes the resulting object
            // to display properties out of order (if some hole needed being filled out).
            var date = new Date(start);
            while (date <= end) {
                var key = moment(date).format('YYYY-MM-DD');
                
                if (!grouped.hasOwnProperty(key))
                    grouped[key] = [];

                // Next date:
                date.setDate(date.getDate() + 1);
            }

            return grouped;
        });
    };
    
    /**
        Fetch appointments and schedule information for the dates from remote
        in a convenient object to use with the DateAvailability model
        (returns an array of them).
    **/
    var getRemoteDatesAvailability = function getRemoteDatesAvailability(start, end) {
        return Promise.all([
            getRemoteAppointmentsByDates(start, end),
            appModel.simplifiedWeeklySchedule.load(),
            appModel.schedulingPreferences.load()
        ])
        .then(function(result) {
            var aptsDates = result[0],
                settings = result[1],
                results = {},
                prefs = result[2];

            Object.keys(aptsDates).forEach(function(dateKey) {
                var date = moment(dateKey, 'YYYY-MM-DD').toDate();
                var weekDaySchedule = settings.weekDays[date.getDay()]();
            
                var dateInfo = {
                    date: date,
                    appointmentsList: aptsDates[dateKey] || [],
                    weekDaySchedule: weekDaySchedule,
                    schedulingPreferences: prefs
                };

                results[dateKey] = dateInfo;
            });

            return results;
        });
    };
    
    api.getDatesAvailability = function getDatesAvailability(start, end) {

        var cacheResults = cache.get(start, end);
        // We know what dates we need and what data is cached already
        // If all cached, just resolve to cache
        if (cacheResults.minHole === null) {
            return Promise.resolve(cacheResults.byDate);
        }
        
        // Request all dates in the range (even if some cached in between)
        return getRemoteDatesAvailability(cacheResults.minHole, cacheResults.maxHole)
        .then(function(results) {
            // Add results to cache, creating DateAvailability object
            // and add that to the resultset
            Object.keys(results).forEach(function(dateKey) {
                cacheResults.byDate[dateKey] = cache.set(dateKey, results[dateKey]).data;
            });
            return cacheResults.byDate;
        });
    };

    return api;
};


},{"../models/Appointment":96,"../models/DateAvailability":102,"../utils/DateCache":137,"events":false,"lodash":false,"moment":false}],68:[function(require,module,exports){
/** Events

    IMPORTANT!!!! API not to use directly by the app, but through appModel.calendar (it has cache and more)
**/
'use strict';

var CalendarEvent = require('../models/CalendarEvent'),
    moment = require('moment'),
    ko = require('knockout');

exports.create = function create(appModel) {

    var api = {
        remote: {
            rest: appModel.rest,
            getCalendarEvents: function(filters) {
                return appModel.rest.get('me/events', filters)
                .then(function(rawItems) {
                    return rawItems && rawItems.map(function(rawItem) {
                        return new CalendarEvent(rawItem);
                    });
                });
            }
        }
    };

    api.getEventsByDates = function getEventsByDates(date, end) {
        
        end = end || moment(date).clone().add(1, 'days').toDate();
        
        // Remote loading data
        return api.remote.getCalendarEvents({
            start: date,
            end: end
        }).then(function(events) {

            // Put in array (they are already model instances)
            var arr = ko.observableArray(events);
            // Return the observable array
            // TODO Review really if has sense to have an observable array, take care of its use (on appointments mainly)
            return arr;
        });
    };
    
    /**
        Get a specific event by ID
    **/
    api.getEvent = function getEvent(id) {
        if (!id) return Promise.reject('The calendarEventID is required to get an event');

        return appModel.rest.get('me/events/' + id)
        .then(function(event) {
            return new CalendarEvent(event);
        });
    };
    
    api.appointmentToSimplifiedEvent = function(apt) {
        
        var rrule = apt.sourceEvent().recurrenceRule();
        if (rrule)
            rrule = apt.sourceEvent().recurrenceRule().model.toPlainObject();

        var occs = apt.sourceEvent().recurrenceOccurrences();
        if (occs)
            occs = occs.map(function(occ) {
                return occ && occ.model.toPlainObject() || null;
            }).filter(function(occ) { return occ !== null; });
        
        return {
            // The same as apt.sourceEvent().calendarEventID()
            calendarEventID: apt.id() < 0 ? 0 : apt.id(),
            eventTypeID: apt.sourceEvent().eventTypeID(),
            summary: apt.summary(),
            description: apt.description(),
            availabilityTypeID: apt.sourceEvent().availabilityTypeID(),
            location: apt.addressSummary(),
            startTime: apt.startTime(),
            endTime: apt.endTime(),
            isAllDay: apt.sourceEvent().isAllDay(),
            recurrenceRule: rrule,
            recurrenceOccurrences: occs
        };
    };

    /**
        Creates/updates a booking, given a simplified booking
        object or an Appointment model or a Booking model
    **/
    api.setEvent = function setEvent(event) {

        event = event.calendarEventID ?
            event.model.toPlainObject() :
            event.sourceEvent ?
                api.appointmentToSimplifiedEvent(event) :
                event
        ;

        var id = event.calendarEventID || '',
            method = id ? 'put' : 'post';

        return appModel.rest[method]('me/events' + (id ? '/' : '') + id, event)
        .then(function(serverEvent) {
            return new CalendarEvent(serverEvent);
        });
    };

    return api;
};

},{"../models/CalendarEvent":99,"knockout":false,"moment":false}],69:[function(require,module,exports){
/** Calendar Syncing app model
**/
'use strict';

var ko = require('knockout'),
    CalendarSyncing = require('../models/CalendarSyncing'),
    RemoteModel = require('../utils/RemoteModel');

exports.create = function create(appModel) {
    var rem = new RemoteModel({
        data: new CalendarSyncing(),
        ttl: { minutes: 1 },
        localStorageName: 'calendarSyncing',
        fetch: function fetch() {
            return appModel.rest.get('me/calendar-syncing');
        },
        push: function push() {
            return appModel.rest.put('me/calendar-syncing', this.data.model.toPlainObject());
        }
    });
    
    // Extending with the special API method 'resetExportUrl'
    rem.isReseting = ko.observable(false);
    rem.resetExportUrl = function resetExportUrl() {
        
        rem.isReseting(true);

        return appModel.rest.post('me/calendar-syncing/reset-export-url')
        .then(function(updatedSyncSettings) {
            // Updating the cached data
            rem.data.model.updateWith(updatedSyncSettings);
            rem.isReseting(false);

            return updatedSyncSettings;
        });
    };
    
    appModel.on('clearLocalData', function() {
        rem.clearCache();
    });

    return rem;
};

},{"../models/CalendarSyncing":100,"../utils/RemoteModel":146,"knockout":false}],70:[function(require,module,exports){
/** clients
**/
'use strict';

var Client = require('../models/Client');

var ListRemoteModel = require('../utils/ListRemoteModel');

exports.create = function create(appModel) {
    
    var api = new ListRemoteModel({
        listTtl: { minutes: 1 },
        itemIdField: 'clientUserID',
        Model: Client
    });

    api.addLocalforageSupport('clients');
    api.addRestSupport(appModel.rest, 'me/clients');
    
    appModel.on('clearLocalData', function() {
        api.clearCache();
    });
    
    /**
        Public search of users, possible clients by well
        know fields, with full value match.
    **/
    var publicSearchRequest = null;
    api.publicSearch = function publicSearch(search) {

        // Only one request at a time
        if (publicSearchRequest &&
            publicSearchRequest.abort) {
            try {
                publicSearchRequest.abort();
            } catch (abortErr) {
                console.error('Error aborting request', abortErr);
            }
        }
        
        var request = appModel.rest.get('me/clients/public-search', search);
        publicSearchRequest = request.xhr;
        
        // Catch 'abort' to avoid communicate a fake error in the promise; the
        // promise will just solve as success with empty array.
        request = request.catch(function(err) {
            if (err && err.statusText === 'abort')
                return [];
            else
                // Rethrow only if is not an 'abort'
                return err;
        });
        // Set again, removed by the catch returned promise
        request.xhr = publicSearchRequest;

        return request;
    };

    return api;
};

},{"../models/Client":101,"../utils/ListRemoteModel":144}],71:[function(require,module,exports){
/** Education (user education)
**/
'use strict';

var UserEducation = require('../models/UserEducation');
var ListRemoteModel = require('../utils/ListRemoteModel');

exports.create = function create(appModel) {
    
    var api = new ListRemoteModel({
        listTtl: { minutes: 1 },
        itemIdField: 'educationID',
        Model: UserEducation
    });

    api.addLocalforageSupport('education');
    // TODO swith next lines on REST API implementation
    //api.addRestSupport(appModel.rest, 'education');
    api.addMockedRemote(testdata());
    
    appModel.on('clearLocalData', function() {
        api.clearCache();
    });

    return api;
};

function testdata() {
    return [
        {
            educationID: 1,
            school: 'A school',
            degree: 'The degree',
            field: 'Field of study',
            startYear: 1993,
            endYear: 1996
        },
        {
            educationID: 2,
            school: 'Empire Beauty School - Scottsdale'
        },
        {
            educationID: 3,
            school: 'MIT',
            degree: 'Computering',
            field: 'Systems administration'
        }
    ];
}

},{"../models/UserEducation":131,"../utils/ListRemoteModel":144}],72:[function(require,module,exports){
/** Feedback
**/
//global navigator,window
'use strict';

exports.create = function create(appModel) {
    
    var getUserDeviceInfo = function getUserDeviceInfo() {
        var dev = window.device || {
            platform: 'web',
            model: 'unknow',
            cordova: '',
            version: ''
        };
        return {
            userAgent: navigator.userAgent,
            platform: dev.platform,
            version: dev.version,
            model: dev.model,
            cordova: dev.cordova
        };
    };
    
    return {
        /**
            @param values:Object {
                message:string,
                vocElementID:int,
                becomeCollaborator:boolean,
                userDevice:string (automatic)
            }
        **/
        postIdea: function postIdea(values) {
            values.userDevice = JSON.stringify(getUserDeviceInfo());
            return appModel.rest.post('feedback/ideas', values);
        },
        /**
            @param values:Object {
                message:string,
                vocElementID:int,
                userDevice:string (automatic)
            }
        **/
        postSupport: function postSupport(values) {
            values.userDevice = JSON.stringify(getUserDeviceInfo());
            return appModel.rest.post('feedback/support', values);
        }
    };
};

},{}],73:[function(require,module,exports){
/** Home Address
**/
'use strict';

var Address = require('../models/Address');

var RemoteModel = require('../utils/RemoteModel');

exports.create = function create(appModel) {
    var rem = new RemoteModel({
        data: new Address(),
        ttl: { minutes: 1 },
        localStorageName: 'homeAddress',
        fetch: function fetch() {
            return appModel.rest.get('me/addresses/home');
        },
        push: function push() {
            return appModel.rest.put('me/addresses/home', this.data.model.toPlainObject());
        }
    });
    
    appModel.on('clearLocalData', function() {
        rem.clearCache();
    });
    
    return rem;
};

},{"../models/Address":95,"../utils/RemoteModel":146}],74:[function(require,module,exports){
/** Fetch Job Titles and Pricing Types information
**/
'use strict';

var localforage = require('localforage'),
    JobTitle = require('../models/JobTitle'),
    ko = require('knockout');

exports.create = function create(appModel) {

    var api = {
            state:  {
                isLoading: ko.observable(false)
            }
        },
        cache = {
            jobTitles: {}
        };
    
    api.clearCache = function clearCache() {
        cache.jobTitles = {};
    };
    
    appModel.on('clearLocalData', function() {
        api.clearCache();
    });

    /**
        Public API
        Get a Job Title information by ID
    **/
    api.getJobTitle = function getJobTitle(id) {
        if (!id) return Promise.reject('Needs an ID to get a Job Title');

        // First, in-memory cache
        if (cache.jobTitles[id]) {
            return Promise.resolve(cache.jobTitles[id]);
        }
        else {
            api.state.isLoading(true);
            // Second, local storage
            return localforage.getItem('jobTitles/' + id)
            .then(function(jobTitle) {
                if (jobTitle) {
                    // cache in memory as Model instance
                    cache.jobTitles[id] = new JobTitle(jobTitle);
                    api.state.isLoading(false);
                    // return it
                    return cache.jobTitles[id];
                }
                else {
                    // Third and last, remote loading
                    return appModel.rest.get('job-titles/' + id)
                    .then(function (raw) {
                        // Cache in local storage
                        localforage.setItem('jobTitles/' + id, raw);
                        // cache in memory as Model instance
                        cache.jobTitles[id] = new JobTitle(raw);
                        api.state.isLoading(false);
                        // return it
                        return cache.jobTitles[id];
                    });
                }
            })
            .catch(function(err) {
                api.state.isLoading(false);
                // Rethrow error
                return err;
            });
        }
    };

    return api;
};

},{"../models/JobTitle":105,"knockout":false,"localforage":false}],75:[function(require,module,exports){
/** AppModel, centralizes all the data for the app,
    caching and sharing data across activities and performing
    requests
**/
var ko = require('knockout'),
    $ = require('jquery'),
    Rest = require('../utils/Rest'),
    localforage = require('localforage'),
    EventEmitter = require('events').EventEmitter;

function AppModel() {
    EventEmitter.call(this);
    this.setMaxListeners(30);
}

AppModel._inherits(EventEmitter);

module.exports = AppModel;

require('./AppModel-account').plugIn(AppModel);

/**
    Load credentials from the local storage, without error if there is nothing
    saved. If load profile data too, performing an tryLogin if no local data.
**/
AppModel.prototype.loadLocalCredentials = function loadLocalCredentials() {
    return new Promise(function(resolve) { // Never rejects: , reject) {

        // Callback to just resolve without error (passing in the error
        // to the 'resolve' will make the process to fail),
        // since we don't need to create an error for the
        // app init, if there is not enough saved information
        // the app has code to request a login.
        var resolveAnyway = function(doesnMatter){        
            console.warning('App Model Init err', doesnMatter);
            resolve();
        };
        
        // If there are credentials saved
        localforage.getItem('credentials').then(function(credentials) {

            if (credentials &&
                credentials.userID &&
                credentials.username &&
                credentials.authKey) {

                // use authorization key for each
                // new Rest request
                this.rest.extraHeaders = {
                    alu: credentials.userID,
                    alk: credentials.authKey
                };
                
                // It has credentials! Has basic profile data?
                // NOTE: the userProfile will load from local storage on this first
                // attempt, and lazily request updated data from remote so we need
                // to catch remote errors with events
                this.userProfile.once('error', function(err) {
                    this.emit('error', {
                        message: 'Impossible to load your data. Please check your Internet connection',
                        error: err
                    });
                }.bind(this));
                
                this.userProfile.load().then(function(profile) {
                    if (profile) {
                        // There is a profile cached                    
                        // End succesfully
                        resolve();
                    }
                    else {
                        // No profile, we need to request it to be able
                        // to work correctly, so we
                        // attempt a login (the tryLogin process performs
                        // a login with the saved credentials and fetch
                        // the profile to save it in the local copy)
                        this.tryLogin().then(resolve, resolveAnyway);
                    }
                }.bind(this), resolveAnyway)
                // The error event catch any error if happens, so avoid uncaught exceptions
                // in the console by catching the promise error
                .catch(function() { });
            }
            else {
                // End successfully. Not loggin is not an error,
                // is just the first app start-up
                resolve();
            }
        }.bind(this), resolveAnyway);
    }.bind(this));
};

/** Initialize and wait for anything up **/
AppModel.prototype.init = function init() {
    
    // Local data
    // TODO Investigate why automatic selection an IndexedDB are
    // failing and we need to use the worse-performance localstorage back-end
    localforage.config({
        name: 'LoconomicsApp',
        version: 0.1,
        size : 4980736, // Size of database, in bytes. WebSQL-only for now.
        storeName : 'keyvaluepairs',
        description : 'Loconomics App',
        driver: localforage.LOCALSTORAGE
    });
    
    // First, get any saved local config
    // NOTE: for now, this is optional, to get a saved siteUrl rather than the
    // default one, if any.
    return localforage.getItem('config')
    .then(function(config) {
        // Optional config
        config = config || {};
        
        if (config.siteUrl) {
            // Update the html URL
            $('html').attr('data-site-url', config.siteUrl);
        }
        else {
            config.siteUrl = $('html').attr('data-site-url');
        }
        
        this.config = config;
        this.rest = new Rest(config.siteUrl + '/api/v1/en-US/');
        
        // Setup Rest authentication
        this.rest.onAuthorizationRequired = function(retry) {

            this.tryLogin()
            .then(function() {
                // Logged! Just retry
                retry();
            });
        }.bind(this);
        
        // With config loaded and REST ready, load all modules
        this.loadModules();
        
        // Initialize: check the user has login data and needed
        // cached data, return its promise
        return this.loadLocalCredentials();
    }.bind(this));
};

AppModel.prototype.loadModules = function loadModules() {

    this.userProfile = require('./AppModel.userProfile').create(this);
    // NOTE: Alias for the user data
    // TODO:TOREVIEW if continue to makes sense to keep this 'user()' alias, document
    // where is used and why is preferred to the canonical way.
    this.user = ko.computed(function() {
        return this.userProfile.data;
    }, this);

    this.onboarding = require('./AppModel.onboarding').create(this);

    this.schedulingPreferences = require('./AppModel.schedulingPreferences').create(this);
    this.calendarSyncing = require('./AppModel.calendarSyncing').create(this);
    this.simplifiedWeeklySchedule = require('./AppModel.simplifiedWeeklySchedule').create(this);
    this.marketplaceProfile = require('./AppModel.marketplaceProfile').create(this);
    this.homeAddress = require('./AppModel.homeAddress').create(this);
    this.privacySettings = require('./AppModel.privacySettings').create(this);
    this.bookings = require('./AppModel.bookings').create(this);
    this.calendarEvents = require('./AppModel.calendarEvents').create(this);
    this.jobTitles = require('./AppModel.jobTitles').create(this);
    this.userJobProfile = require('./AppModel.userJobProfile').create(this);
    this.calendar = require('./AppModel.calendar').create(this);
    this.serviceAddresses = require('./AppModel.serviceAddresses').create(this);
    this.serviceProfessionalServices = require('./AppModel.serviceProfessionalServices').create(this);
    this.pricingTypes = require('./AppModel.pricingTypes').create(this);
    this.messaging = require('./AppModel.messaging').create(this);
    this.clients = require('./AppModel.clients').create(this);
    this.postalCodes = require('./AppModel.postalCodes').create(this);
    this.feedback = require('./AppModel.feedback').create(this);
    this.education = require('./AppModel.education').create(this);
    this.licensesCertifications = require('./AppModel.licensesCertifications').create(this);
    this.users = require('./AppModel.users').create(this);
    //UNSTABLE:this.availability = require('./AppModel.availability').create(this);
};

/**
    Clear the local stored data, but with careful for the special
    config data that is kept.
**/
AppModel.prototype.clearLocalData = function clearLocalData() {
    // Get config
    return localforage.getItem('config')
    .then(function(config) {
        // Clear all
        localforage.clear();

        if (config) {
            // Set config again
            localforage.setItem('config', config);
        }
        
        // Trigger notification, so other components
        // can make further clean-up or try synchronizations,
        // for example to clean-up in-memory cache.
        this.emit('clearLocalData');
    }.bind(this));
};

},{"../utils/Rest":147,"./AppModel-account":65,"./AppModel.bookings":66,"./AppModel.calendar":67,"./AppModel.calendarEvents":68,"./AppModel.calendarSyncing":69,"./AppModel.clients":70,"./AppModel.education":71,"./AppModel.feedback":72,"./AppModel.homeAddress":73,"./AppModel.jobTitles":74,"./AppModel.licensesCertifications":76,"./AppModel.marketplaceProfile":77,"./AppModel.messaging":78,"./AppModel.onboarding":79,"./AppModel.postalCodes":80,"./AppModel.pricingTypes":81,"./AppModel.privacySettings":82,"./AppModel.schedulingPreferences":83,"./AppModel.serviceAddresses":84,"./AppModel.serviceProfessionalServices":85,"./AppModel.simplifiedWeeklySchedule":86,"./AppModel.userJobProfile":87,"./AppModel.userProfile":88,"./AppModel.users":89,"events":false,"knockout":false,"localforage":false}],76:[function(require,module,exports){
/** Service LicensesCertifications

// TODO Initial work, complete and test
**/
'use strict';

var UserLicenseCertification = require('../models/UserLicenseCertification'),
    GroupListRemoteModel = require('../utils/GroupListRemoteModel');

exports.create = function create(appModel) {

    var api = new GroupListRemoteModel({
        // Conservative cache, just 1 minute
        listTtl: { minutes: 1 },
        groupIdField: 'jobTitleID',
        itemIdField: 'licenseCertificationID',
        Model: UserLicenseCertification
    });
    
    api.addLocalforageSupport('userLicenseCertifications');
    api.addRestSupport(appModel.rest, 'me/user-license-certifications/');
    
    appModel.on('clearLocalData', function() {
        api.clearCache();
    });
    
    return api;
};

},{"../models/UserLicenseCertification":133,"../utils/GroupListRemoteModel":141}],77:[function(require,module,exports){
/** MarketplaceProfile
**/
'use strict';

var MarketplaceProfile = require('../models/MarketplaceProfile');

var RemoteModel = require('../utils/RemoteModel');

exports.create = function create(appModel) {
    var rem = new RemoteModel({
        data: new MarketplaceProfile(),
        ttl: { minutes: 1 },
        localStorageName: 'marketplaceProfile',
        fetch: function fetch() {
            return appModel.rest.get('me/marketplace-profile');
        },
        push: function push() {
            return appModel.rest.put('me/marketplace-profile', this.data.model.toPlainObject());
        }
    });
    
    appModel.on('clearLocalData', function() {
        rem.clearCache();
    });
    
    return rem;
};

},{"../models/MarketplaceProfile":110,"../utils/RemoteModel":146}],78:[function(require,module,exports){
/** AppModel for messaging: threads and messages

    NOTE: Initial basic implementation
    TODO: Require advanced implementation, loading a limited
        amount of records for threads and messages per thread
        using the cursor parameters of the REST API to manage
        paging load.
**/
'use strict';

var Thread = require('../models/Thread'),
    CacheControl = require('../utils/CacheControl'),
    ListRemoteModel = require('../utils/ListRemoteModel');

exports.create = function create(appModel) {
    
    var api = new ListRemoteModel({
        listTtl: { minutes: 1 },
        itemIdField: 'threadID',
        Model: Thread
    });

    api.addLocalforageSupport('messaging');
    api.addRestSupport(appModel.rest, 'me/messaging');
    
    appModel.on('clearLocalData', function() {
        api.clearCache();
    });
    
    // Basic support is fetching all threads with the latest message of each one.
    // Replace getItem built-in to do non locally saved, fetch for all messages in
    // a thread (the thread is the item)
    var fullThreadsCache = {/*
        threadID: { control: CacheControl, thread: Thread }
    */};
    var fetchThreadRemote = function(threadID) {
        return appModel.rest.get('me/messaging/' + threadID, {
            limit: 1000 /* max messages in the thread */
        })
        .then(function(thread) {
            if (thread) {
                thread = new Thread(thread);
                var cached = fullThreadsCache[threadID];
                if (cached) {
                    cached.control.latest = new Date();
                    cached.thread = thread;
                } else {
                    fullThreadsCache[threadID] = {
                        control: new CacheControl({ ttl: { minutes: 1 } }),
                        thread: thread
                    };
                    fullThreadsCache[threadID].control.latest = new Date();
                }
                return thread;
            }
            else {
                throw new Error('Not Found');
            }
        });
    };
    var markAsEndedAndFollowUp = function(any) {
        api.state.isSyncing(false);
        api.state.isLoading(false);
        return any;
    };
    api.getItem = function getItem(threadID) {
        var cached = fullThreadsCache[threadID];
        if (cached && cached.thread) {
            if (cached.control.mustRevalidate()) {
                api.state.isSyncing(true);
                return fetchThreadRemote(threadID)
                .then(markAsEndedAndFollowUp, markAsEndedAndFollowUp);
            }
            else
                return Promise.resolve(cached.thread);
        } else {
            api.state.isLoading(true);
            return fetchThreadRemote(threadID)
            .then(markAsEndedAndFollowUp, markAsEndedAndFollowUp);
        }
    };

    return api;
};

},{"../models/Thread":128,"../utils/CacheControl":136,"../utils/ListRemoteModel":144}],79:[function(require,module,exports){
/**
    Onboarding tracking information
**/
'use strict';

var OnboardingProgress = require('../viewmodels/OnboardingProgress'),
    NavAction = require('../viewmodels/NavAction');

exports.create = function create(appModel) {
    
    // Onboarding management and state, initially empty so no progress
    var api = new OnboardingProgress();
    
    // Requires initialization to receive and app instance
    api.init = function init(app) {
        api.app = app;
    };
    
    // Extended with new methods

    // Set the correct onboarding progress and step given a step reference
    // (usually from database)
    api.setStep = function(stepReference) {
        if (stepReference) {
            var stepItems = stepReference.split(':', 2),
                group = stepItems[0],
                // step is the second part, or just the same as
                // the full name (that happens for the first steps that share
                // name with the group and only need to define the group name)
                step = stepItems[1] || group;

            // Try to set current step, follow to look for group if does not success
            if (this.setStepByName(step)) {
                return true;
            }
            // else:
            // Look for a group that matches
            var groupSteps = OnboardingProgress.predefinedStepGroups[group];
            if (groupSteps) {
                this.steps(groupSteps);
                this.group(group);
                if (this.setStepByName(step)) {
                    return true;
                }
            }
        }
        // No progress:
        this.model.reset();
        return false;
    };

    // Update the given navbar with the current onboarding information (only if in progress)
    api.updateNavBar = function(navBar) {
        var yep = this.inProgress();
        if (yep) {
            // On 2015-06-16 #575, changed decission from use a 'go back' action
            // (commented in following lines):
//            navBar.leftAction(NavAction.goBack.model.clone());
//            navBar.leftAction().handler(function() {
//                api.goPrevious();
//                return false;
//            });
            // to use the Log-out action
            navBar.leftAction(NavAction.goLogout);

            navBar.title(this.progressText());            
        }
        return yep;
    };
    
    api.goNext = function goNext() {
        var current = this.stepNumber();

        current++;

        if (current > this.totalSteps()) {
            // It ended!!
            this.stepNumber(-1);
            appModel.userProfile.saveOnboardingStep(null);
            this.app.shell.go('/', { completedOnboarding: api.group() });
        }
        else {
            // Get next step
            this.stepNumber(current);
            appModel.userProfile.saveOnboardingStep(this.stepReference());
            this.app.shell.go(this.stepUrl());
        }
    };
    
    api.goPrevious = function goPrevious() {
        var current = this.stepNumber();

        current--;

        if (current >= 0 && current <= this.totalSteps()) {
            // Get previous step
            this.stepNumber(current);
        }
        else {
            this.stepNumber(0);
        }

        appModel.userProfile.saveOnboardingStep(this.stepReference());
        this.app.shell.go(this.stepUrl());
    };
    
    return api;
};

},{"../viewmodels/NavAction":179,"../viewmodels/OnboardingProgress":181}],80:[function(require,module,exports){
/** Postal Code.

    Access the API to validate and retrieve information for a 
    given postal code.
    
    It just offers a 'get postal code info' method returning
    a plain object from the REST endpoint.
    
    Creates an in-memory cache for frequently used postal codes
**/
'use strict';

exports.create = function create(appModel) {

    var api = {},
        cache = {};
    
    api.getItem = function getItem(postalCode) {
        
        postalCode = postalCode || '';
        if (/^\s*$/.test(postalCode)) {
            return Promise.reject('Postal Code Not Valid');
        }
        
        // Check cache
        if (cache.hasOwnProperty(postalCode)) {
            return Promise.resolve(cache[postalCode]);
        }
        
        return appModel.rest.get('postal-codes/' + postalCode)
        .then(function(info) {
            // Save cache
            if (info) {
                cache[postalCode] = info;
            }
            // return
            return info;
        });
    };

    appModel.on('clearLocalData', function() {
        cache = {};
    });
    
    return api;
};

},{}],81:[function(require,module,exports){
/** Pricing Types
**/
'use strict';

var PricingType = require('../models/PricingType');

var ListRemoteModel = require('../utils/ListRemoteModel');

exports.create = function create(appModel) {
    
    var api = new ListRemoteModel({
        // Types does not changes usually, so big ttl
        listTtl: { days: 1 },
        itemIdField: 'pricingTypeID',
        Model: PricingType
    });

    api.addLocalforageSupport('pricing-types');
    api.addRestSupport(appModel.rest, 'pricing-types');
    
    appModel.on('clearLocalData', function() {
        api.clearCache();
    });

    return api;
};

},{"../models/PricingType":117,"../utils/ListRemoteModel":144}],82:[function(require,module,exports){
/** Privacy Settings
**/
'use strict';

var PrivacySettings = require('../models/PrivacySettings');

var RemoteModel = require('../utils/RemoteModel');

exports.create = function create(appModel) {
    var rem = new RemoteModel({
        data: new PrivacySettings(),
        ttl: { minutes: 1 },
        localStorageName: 'privacySettings',
        fetch: function fetch() {
            return appModel.rest.get('me/privacy-settings');
        },
        push: function push() {
            return appModel.rest.put('me/privacy-settings', this.data.model.toPlainObject());
        }
    });
    
    appModel.on('clearLocalData', function() {
        rem.clearCache();
    });
    
    return rem;
};

},{"../models/PrivacySettings":118,"../utils/RemoteModel":146}],83:[function(require,module,exports){
/**
**/
'use strict';

var SchedulingPreferences = require('../models/SchedulingPreferences');

var RemoteModel = require('../utils/RemoteModel');

exports.create = function create(appModel) {
    var rem = new RemoteModel({
        data: new SchedulingPreferences(),
        ttl: { minutes: 1 },
        localStorageName: 'schedulingPreferences',
        fetch: function fetch() {
            return appModel.rest.get('me/scheduling-preferences');
        },
        push: function push() {
            return appModel.rest.put('me/scheduling-preferences', this.data.model.toPlainObject())
            .then(function(result) {
                // We need to recompute availability as side effect of scheduling preferences changes
                appModel.calendar.clearCache();
                // Forward the result
                return result;
            });
        }
    });
    
    appModel.on('clearLocalData', function() {
        rem.clearCache();
    });
    
    return rem;
};

},{"../models/SchedulingPreferences":125,"../utils/RemoteModel":146}],84:[function(require,module,exports){
/** Service Addresses
**/
'use strict';

var Address = require('../models/Address'),
    GroupListRemoteModel = require('../utils/GroupListRemoteModel');

exports.create = function create(appModel) {

    var api = new GroupListRemoteModel({
        // Conservative cache, just 1 minute
        listTtl: { minutes: 1 },
        groupIdField: 'jobTitleID',
        itemIdField: 'addressID',
        Model: Address
    });
    
    api.addLocalforageSupport('addresses/service/');
    api.addRestSupport(appModel.rest, 'me/addresses/service/');
    
    appModel.on('clearLocalData', function() {
        api.clearCache();
    });
    
    return api;
};

},{"../models/Address":95,"../utils/GroupListRemoteModel":141}],85:[function(require,module,exports){
/** Service professional service
**/
'use strict';

var ServiceProfessionalService = require('../models/ServiceProfessionalService'),
    GroupListRemoteModel = require('../utils/GroupListRemoteModel');

exports.create = function create(appModel) {

    var api = new GroupListRemoteModel({
        // Conservative cache, just 1 minute
        listTtl: { minutes: 1 },
        groupIdField: 'jobTitleID',
        itemIdField: 'serviceProfessionalServiceID',
        Model: ServiceProfessionalService
    });

    api.addLocalforageSupport('service-professional-services/');
    api.addRestSupport(appModel.rest, 'me/service-professional-services/');
    
    appModel.on('clearLocalData', function() {
        api.clearCache();
    });
    
    return api;
};

},{"../models/ServiceProfessionalService":126,"../utils/GroupListRemoteModel":141}],86:[function(require,module,exports){
/**
**/
'use strict';

var SimplifiedWeeklySchedule = require('../models/SimplifiedWeeklySchedule'),
    RemoteModel = require('../utils/RemoteModel'),
    moment = require('moment');

// The slot size is fixed to 15 minutes by default.
// NOTE: currently, the API only allows 15 minutes slots,
// being that implicit, but part of the code is ready for explicit slotSize.
var defaultSlotSize = 15;
// A list of week day properties names allowed
// to be part of the objects describing weekly schedule
// (simplified or complete/slot based)
// Just lowecased english names
var weekDayProperties = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

exports.create = function create(appModel) {
    var rem = new RemoteModel({
        data: new SimplifiedWeeklySchedule(),
        ttl: { minutes: 1 },
        localStorageName: 'weeklySchedule',
        fetch: function fetch() {
            return appModel.rest.get('availability/weekly-schedule')
            .then(fromWeeklySchedule);
        },
        push: function push() {
            var plainData = {
                'all-time': false,
                'json-data': {}
            };
            if (this.data.isAllTime() === true) {
                plainData['all-time'] = true;
            }
            else {
                plainData['json-data'] = JSON.stringify(toWeeklySchedule(this.data.model.toPlainObject(true)));
            }

            return appModel.rest.put('availability/weekly-schedule', plainData)
            .then(fromWeeklySchedule)
            .then(function(result) {
                // We need to recompute availability as side effect of schedule
                appModel.calendar.clearCache();
                // Forward the result
                return result;
            });
        }
    });
    
    appModel.on('clearLocalData', function() {
        rem.clearCache();
    });
    
    return rem;
};

function fromWeeklySchedule(weeklySchedule) {
    
    // New simplified object, as a plain object with
    // weekdays properties and from-to properties like:
    // { sunday: { from: 0, to: 60 } }
    // Since this is expected to be consumed by fetch-push
    // operations, and later by an 'model.updateWith' operation,
    // so plain is simple and better on performance; can be
    // converted easily to the SimplifiedWeeklySchedule object.
    var simpleWS = {
        timeZone: weeklySchedule.timeZone || ''
    };
    
    // Only supports 'available' status with default 'unavailable'
    if (weeklySchedule.defaultStatus !== 'unavailable' ||
        weeklySchedule.status !== 'available') {
        throw {
            name: 'input-format',
            message: 'Weekly schedule, given statuses not supported, status: ' +
            weeklySchedule.status + ', defaultStatus: ' + 
            weeklySchedule.defaultStatus
          };
    }
    
    // given slotSize or default
    var slotSize = (weeklySchedule.slotSize || defaultSlotSize) |0;

    // Read slots per week-day ({ slots: { "sunday": [] } })
    Object.keys(weeklySchedule.slots)
    .forEach(function(weekday) {
        
        // Verify is a weekday property, or exit early
        if (weekDayProperties.indexOf(weekday) === -1) {
            return;
        }
        
        var dayslots = weeklySchedule.slots[weekday];
        
        // We get the first available slot and the last consecutive
        // to make the range
        var from = null,
            to = null,
            previous = null;

        // times are ordered in ascending
        // and with format "00:00:00" that we convert to minutes
        // (enough precision for simplified weekly schedule)
        // using moment.duration
        // NOTE: using 'some' rather than 'forEach' to be able
        // to exit early from the iteration by returning 'true'
        // when the end is reached.
        dayslots.some(function(slot) {
            var minutes = moment.duration(slot).asMinutes() |0;
            // We have not still a 'from' time:
            if (from === null) {
                from = minutes;
                previous = minutes;
            }
            else {
                // We have a beggining, check if this is consecutive
                // to previous, by checking previous plus slotSize
                if (previous + slotSize === minutes) {
                    // New end
                    to = minutes;
                    // Next iteration
                    previous = minutes;
                }
                else {
                    // No consecutive, we already has a range, any
                    // additional slot is discarded, out of the
                    // precision of the simplified weekly schedule,
                    // so we can go out the iteration:
                    return true;
                    
                    // NOTE: If in a future a more complete schedule
                    // need to be wroten using multiple ranges rather
                    // individual slots, this is the place to continue
                    // coding, populating an array of [{from, to}] :-)
                }
            }
        });
        
        // Slots checked, check the result
        if (from !== null) {
            
            var simpleDay = {
                from: from,
                to: 0
            };
            simpleWS[weekday] = simpleDay;

            // We have a range!
            if (to !== null) {
                // and has an end!
                // add the slot size to the ending
                simpleDay.to = to + slotSize;
            }
            else {
                // smaller range, just one slot,
                // add the slot size to the begining
                simpleDay.to = from + slotSize;
            }
        }
    });

    // Done!
    return simpleWS;
}

/**
    Pass in a plain object, not a model,
    getting an object suitable for the API endpoint.
**/
function toWeeklySchedule(simplifiedWeeklySchedule) {

    var slotSize = defaultSlotSize;
    
    // It's build with 'available' as explicit status:
    var weeklySchedule = {
        status: 'available',
        defaultAvailability: 'unavailable',
        slots: {},
        slotSize: slotSize,
        timeZone: simplifiedWeeklySchedule.timeZone
    };

    // Per weekday
    Object.keys(simplifiedWeeklySchedule)
    .forEach(function(weekday) {

        // Verify is a weekday property, or exit early
        if (weekDayProperties.indexOf(weekday) === -1) {
            return;
        }

        var simpleDay = simplifiedWeeklySchedule[weekday];

        // We need to expand the simplified time ranges 
        // in slots of the slotSize
        // The end time will be excluded, since slots
        // define only the start, being implicit the slotSize.
        var from = simpleDay.from |0,
            to = simpleDay.to |0;

        // Create the slot array
        weeklySchedule.slots[weekday] = [];

        // Integrity verification
        if (to > from) {
            // Iterate by the slotSize until we reach
            // the end, not including the 'to' since
            // slots indicate only the start of the slot
            // that is assumed to fill a slotSize starting
            // on that slot-time
            var previous = from;
            while (previous < to) {
                weeklySchedule.slots[weekday].push(minutesToTimeString(previous));
                previous += slotSize;
            }
        }
    });

    // Done!
    return weeklySchedule;
}

/**
    internal utility function 'to string with two digits almost'
**/
function twoDigits(n) {
    return Math.floor(n / 10) + '' + n % 10;
}

/**
    Convert a number of minutes
    in a string like: 00:00:00 (hours:minutes:seconds)
**/
function minutesToTimeString(minutes) {
    var d = moment.duration(minutes, 'minutes'),
        h = d.hours(),
        m = d.minutes(),
        s = d.seconds();
    
    return (
        twoDigits(h) + ':' +
        twoDigits(m) + ':' +
        twoDigits(s)
    );
}

},{"../models/SimplifiedWeeklySchedule":127,"../utils/RemoteModel":146,"moment":false}],87:[function(require,module,exports){
/**
    Model API to manage the collection of Job Titles assigned
    to the current user and its working data.
**/
'use strict';

var UserJobTitle = require('../models/UserJobTitle'),
    CacheControl = require('../utils/CacheControl'),
    localforage = require('localforage'),
    ko = require('knockout'),
    $ = require('jquery');

exports.create = function create(appModel) {

    var api = {},
        defaultTtl = { minutes: 1 },
        cache = {
            // Array of user job titles making
            // its profile
            userJobProfile: {
                cache: new CacheControl({ ttl: defaultTtl }),
                list: null
            },
            // Indexed list by jobTitleID to the user job titles models
            // in the list and cache information
            userJobTitles: {/*
                jobTitleID: { model: object, cache: CacheControl }
            */}
        };
    
    // Observable list
    api.list = ko.observableArray([]);
    // NOTE: Basic implementation, to enhance
    api.syncList = function syncList() {
        return api.getUserJobProfile().then(function(list) {
            api.list(list);
            return list;
        });
    };
    
    api.clearCache = function clearCache() {
        cache.userJobProfile.cache.latest = null;
        cache.userJobProfile.list = [];
        cache.userJobTitles = {};
    };
    
    appModel.on('clearLocalData', function() {
        api.clearCache();
    });

    /**
        Convert raw array of job titles records into
        an indexed array of models, actually an object
        with ID numbers as properties,
        and cache it in memory.
    **/
    function mapToUserJobProfile(rawItems) {
        cache.userJobProfile.list = [];
        cache.userJobTitles = {};

        if (rawItems) {
            rawItems.forEach(function(rawItem) {
                var m = new UserJobTitle(rawItem);
                cache.userJobProfile.list.push(m);
                // Saving and indexed copy and per item cache info
                setGetUserJobTitleToCache(rawItem);
            });
        }
        // Update observable
        api.list(cache.userJobProfile.list);

        // Update cache state
        cache.userJobProfile.cache.latest = new Date();
        
        return cache.userJobProfile.list;
    }
    
    /**
        Get the full jobProfile from local copy, throwing a Promise reject exception if nothing
    **/
    function getUserJobProfileFromLocal() {
        return localforage.getItem('userJobProfile')
        .then(function(userJobProfile) {
            if (userJobProfile) {
                return mapToUserJobProfile(userJobProfile);
            }
            // Return null since there is no data, the promise can catch
            // there is no data and attempt a remote
            return null;
        });
    }
    
    /**
        Set a raw userJobProfile record (from server) and set it in the
        cache, creating or updating the model (so all the time the same model instance
        is used) and cache control information.
        Returns the model instance.
    **/
    function setGetUserJobTitleToCache(rawItem) {
        var c = cache.userJobTitles[rawItem.jobTitleID] || {};
        // Update the model if exists, so get reflected to anyone consuming it
        if (c.model) {
            c.model.model.updateWith(rawItem);
        }
        else {
            // First time, create model
            c.model = new UserJobTitle(rawItem);
        }
        // Update cache control
        if (c.cache) {
            c.cache.latest = new Date();
        }
        else {
            c.cache = new CacheControl({ ttl: defaultTtl });
        }
        
        // If there is a profile list, add or update:
        var fullList =  cache.userJobProfile.list;
        if (fullList) {
            var found = null;
            fullList.some(function(it) {
                if (it.jobTitleID() === rawItem.jobTitleID) {
                    found = it;
                    return true;
                }
            });
            if (found) {
                found.model.updateWith(rawItem);
            }
            else {
                fullList.push(c.model);
            }
        }
        
        // Return the model, updated or just created
        return c.model;
    }
    
    /**
        Get the content from the cache, for full profile
        and save it in local storage
        NOTE It has no sense in current implementation (problem of fetch
        job title without a full job profile in cache/local)
    **/
    /*function saveCacheInLocal() {
        var plain = cache.userJobProfile.list.map(function(item) {
            // Each item is a model, get it in plain:
            return item.model.toPlainObject();
        });
        localforage.setItem('userJobProfile', plain);
    }*/
    
    // Private, fetch from remote
    var fetchUserJobProfile = function () {
        // Third and last, remote loading
        return appModel.rest.get('me/user-job-profile')
        .then(function (raw) {
            // Cache in local storage
            localforage.setItem('userJobProfile', raw);
            return mapToUserJobProfile(raw);
        });
    };
    
    /**
        Public API
        Get the complete list of UserJobTitle for
        all the JobTitles assigned to the current user
    **/
    api.getUserJobProfile = function () {
        // If no cache or must revalidate, go remote
        // (the first loading is ever 'must revalidate')
        if (cache.userJobProfile.cache.mustRevalidate()) {
            // If no cache, is first load, so try local
            if (!cache.userJobProfile.list) {
                // Local storage
                return getUserJobProfileFromLocal()
                .then(function(data) {
                    // launch remote for sync
                    var remotePromise = fetchUserJobProfile();
                    // Remote fallback: If no local, wait for remote
                    return data ? data : remotePromise;
                });
            }
            else {
                // No cache, no local, or obsolete, go remote:
                return fetchUserJobProfile();
            }
        }
        else {
            // There is cache and is still valid:
            return Promise.resolve(cache.userJobProfile.list);
        }
    };
    
    // Private, fetch from remote
    var fetchUserJobTitle = function(jobTitleID) {
        return appModel.rest.get('me/user-job-profile/' + jobTitleID)
        .then(function(raw) {
            // Save to cache and get model
            var m = setGetUserJobTitleToCache(raw);
            
            // TODO implement cache saving for single job-titles, currently
            // it needs to save the profile cache, that may not exists if
            // the first request is for a single job title.
            // Next lines are to save full profile, not valid here.
            // Save in local
            //saveCacheInLocal();
            
            // Return model
            return m;
        });
    };
    
    var pushNewUserJobTitle = function(values) {
        // Create job title in remote
        return appModel.rest.post('me/user-job-profile', $.extend({
            jobTitleID: 0,
            jobTitleName: '',
            intro: '',
            cancellationPolicyID: null,
            instantBooking: false
        }, values))
        .then(function(raw) {
            // Save to cache and get model
            var m = setGetUserJobTitleToCache(raw);
            
            // TODO implement cache saving for single job-titles, currently
            // it needs to save the profile cache, that may not exists if
            // the first request is for a single job title.
            // Next lines are to save full profile, not valid here.
            // Save in local
            //saveCacheInLocal();
            
            // Return model
            return m;
        });
    };
    
    /**
        Public API
        Get a UserJobTitle record for the given
        JobTitleID and the current user.
    **/
    api.getUserJobTitle = function (jobTitleID) {
        // Quick error
        if (!jobTitleID) return Promise.reject('Job Title ID required');
        
        // If no cache or must revalidate, go remote
        if (!cache.userJobTitles[jobTitleID] ||
            cache.userJobTitles[jobTitleID].cache.mustRevalidate()) {
            return fetchUserJobTitle(jobTitleID);
        }
        else {
            // First, try cache
            if (cache.userJobTitles[jobTitleID] &&
                cache.userJobTitles[jobTitleID].model) {
                return Promise.resolve(cache.userJobTitles[jobTitleID].model);
            }
            else {
                // Second, local storage, where we have the full job profile
                return getUserJobProfileFromLocal()
                .then(function(/*userJobProfile*/) {
                    // Not need for the parameter, the data is
                    // in memory and indexed, look for the job title
                    return cache.userJobTitles[jobTitleID].model;
                })
                // If no local copy (error on promise),
                // or that does not contains the job title (error on 'then'):
                // Third and last, remote loading
                .catch(fetchUserJobTitle.bind(null, jobTitleID));
            }
        }
    };
    
    api.createUserJobTitle = function (values) {
        return pushNewUserJobTitle(values);
    };
    
    /*************************/
    /** ADITIONAL UTILITIES **/
    api.getUserJobTitleAndJobTitle = function getUserJobTitleAndJobTitle(jobTitleID) {
        return api.getUserJobTitle(jobTitleID)
        .then(function(userJobTitle) {
            // Very unlikely error
            if (!userJobTitle) {
                throw {
                    name: 'Not Found',
                    message:
                        // LJDI:
                        'You have not this job title in your profile. ' + 
                        'Maybe was deleted from your profile recently.'
                };
            }

            // Get job title info too
            return Promise.all([
                userJobTitle,
                appModel.jobTitles.getJobTitle(jobTitleID)
            ]);
        })
        .then(function(all) {
            var jobTitle = all[1];
            // Very unlikely error
            if (!jobTitle) {
                throw {
                    name: 'Not Found',
                    // LJDI:
                    message: 'The job title does not exist.'
                };
            }
        
            return {
                jobTitleID: jobTitleID,
                userJobTitle: all[0],
                jobTitle: jobTitle
            };
        });
    };
    
    return api;
};

},{"../models/UserJobTitle":132,"../utils/CacheControl":136,"knockout":false,"localforage":false}],88:[function(require,module,exports){
/** UserProfile
**/
'use strict';

var User = require('../models/User');

var RemoteModel = require('../utils/RemoteModel'),
    localforage = require('localforage');

exports.create = function create(appModel) {
    var rem = new RemoteModel({
        data: User.newAnonymous(),
        ttl: { minutes: 1 },
        // IMPORTANT: Keep the name in sync with set-up at AppModel-account
        localStorageName: 'profile',
        fetch: function fetch() {
            return appModel.rest.get('me/profile');
        },
        push: function push() {
            return appModel.rest.put('me/profile', this.data.model.toPlainObject());
        }
    });
    
    appModel.on('clearLocalData', function() {
        rem.clearCache();
    });
    
    rem.saveOnboardingStep = function saveOnboardingStep(stepReference) {
        if (typeof(stepReference) === 'undefined') {
            stepReference = rem.data.onboardingStep();
        }
        else {
            rem.data.onboardingStep(stepReference);
        }

        return appModel.rest.put('me/profile/tracking', {
            onboardingStep: stepReference
        })
        .then(function() {
            // If success, save persistent local copy of the data to ensure the
            // new onboardingStep is saved
            localforage.setItem(rem.localStorageName, rem.data.model.toPlainObject());
        });
    };
    
    return rem;
};

},{"../models/User":130,"../utils/RemoteModel":146,"localforage":false}],89:[function(require,module,exports){
/**
    Query public data from other users in the marketplace,
    usually client fetching service professionals data
    to view profile, book them, etc.
**/
'use strict';

exports.create = function create(appModel) {
    
    var api = {};

    //appModel.on('clearLocalData', function() {
    //    api.clearCache();
    //});
    
    /**
        Get the user index/summary information. That includes
        an object with different properties that matches the results
        from other individual APIs, to get in one call information
        like profile, rating, verificationsSummary, jobProfile.
        Usefull to load faster a user public profile, service professional
        information to start a booking process or the user information
        widgets.
    **/
    api.getUser = function(userID) {
        return appModel.rest.get('users/' + (userID |0));
    };
    
    api.getProfile = function(userID) {
        return appModel.rest.get('users/' + (userID |0) + '/profile');
    };
    
    api.getJobProfile = function(userID) {
        return appModel.rest.get('users/' + (userID |0) + '/job-profile');
    };
    api.getJobTitle = function(userID, jobTitleID) {
        return appModel.rest.get('users/' + (userID |0) + '/job-profile/' + (jobTitleID |0));
    };
    
    var getAvailability = function getAvailability(userID, format, query) {
        return appModel.rest.get('users/' + (userID |0) + '/availability/' + format, query);
    };
    api.getAvailabilityPerDate = function(userID, startDate, endDate) {
        return getAvailability(userID, 'dates', { start: startDate, end: endDate });
    };
    api.getAvailabilityInsSlots = function(userID, startDate, endDate) {
        return getAvailability(userID, 'slots', { start: startDate, end: endDate });
    };

    var getRatings = function getRatings(modifier, userID) {
        return appModel.rest.get('users/' + (userID |0) + '/ratings' + (modifier ? '/' + modifier : ''));
    };
    api.getUserRatings = getRatings.bind(api, null);
    api.getClientRatings = getRatings.bind(api, 'client');
    api.getServiceProfessionalRatings = getRatings.bind(api, 'service-professional');
    api.getJobTitleRatings = function(userID, jobTitleID) { return getRatings(jobTitleID |0, userID); };
    
    api.getServiceAddresses = function(userID, jobTitleID) {
        return appModel.rest.get('users/' + (userID |0) + '/service-addresses/' + (jobTitleID |0));
    };

    api.getServiceProfessionalServices = function(serviceProfessionalUserID, jobTitleID) {
        return appModel.rest.get('users/' + (serviceProfessionalUserID |0) + '/service-professional-services/' + (jobTitleID |0));
    };
    
    var getVerificationsSummary = function getVerificationsSummary(modifier, userID) {
        return appModel.rest.get('users/' + (userID |0) + '/verifications-summary' + (modifier ? '/' + modifier : ''));
    };
    api.getUserVerificationsSummary = getVerificationsSummary.bind(api, null);
    api.getClientVerificationsSummary = getVerificationsSummary.bind(api, 'client');
    api.getServiceProfessionalVerificationsSummary = getVerificationsSummary.bind(api, 'service-professional');
    api.getJobTitleVerificationsSummary = function(userID, jobTitleID) { return getVerificationsSummary(jobTitleID |0, userID); };

    return api;
};
},{}],90:[function(require,module,exports){
/**
    Activity base class
**/
'use strict';

var ko = require('knockout'),
    NavAction = require('../viewmodels/NavAction'),
    NavBar = require('../viewmodels/NavBar');

require('../utils/Function.prototype._inherits');

/**
    Activity class definition
**/
function Activity($activity, app) {

    this.$activity = $activity;
    this.app = app;

    // Default access level: anyone
    this.accessLevel = app.UserType.none;
    
    // TODO: Future use of a viewState, plain object representation
    // of part of the viewModel to be used as the state passed to the
    // history and between activities calls.
    this.viewState = {};
    
    // Object to hold the options passed on 'show' as a result
    // of a request from another activity
    this.requestData = null;

    // Default navBar object.
    this.navBar = new NavBar({
        title: null, // null for logo
        leftAction: null,
        rightAction: null
    });
    
    // Knockout binding of viewState delayed to first show
    // to avoid problems with subclasses replacing the viewState
}

module.exports = Activity;

/**
    Set-up visualization of the view with the given options/state,
    with a reset of current state.
    Must be executed every time the activity is put in the current view.
**/
Activity.prototype.show = function show(options) {
    // TODO: must keep viewState up to date using options/state.
    //console.log('Activity show', this.constructor.name);
    if (!this.__bindingDone) {
        // A view model and bindings being applied is ever required
        // even on Activities without need for a view model, since
        // the use of components and templates, or any other data-bind
        // syntax, requires to be in a context with binding enabled:
        ko.applyBindings(this.viewModel || {}, this.$activity.get(0));
        this.__bindingDone = true;
    }
    
    options = options || {};
    this.requestData = options;
    
    // Enable registered handlers
    // Validation of each settings object is performed
    // on registered, avoided here.
    if (this._handlers &&
        this._handlersAreConnected !== true) {
        this._handlers.forEach(function(settings) {
            // Check if is an observable subscription
            if (!settings.event && settings.target.subscribe) {
                var subscription = settings.target.subscribe(settings.handler);
                // Observables has not a 'unsubscribe' function,
                // they return an object that must be 'disposed'.
                // Saving that with settings to allow 'unsubscribe' later.
                settings._subscription = subscription;

                // Inmediate execution: if current observable value is different
                // than previous one, execute the handler:
                // (this avoid that a changed state get omitted because happened
                // when subscription was off; it means a first time execution too).
                // NOTE: 'undefined' value on observable may cause this to fall
                if (settings._latestSubscribedValue !== settings.target()) {
                    settings.handler.call(settings.target, settings.target());
                }
            }
            else if (settings.selector) {
                settings.target.on(settings.event, settings.selector, settings.handler);
            }
            else if (settings.target.on) {
                settings.target.on(settings.event, settings.handler);
            }
            else {
                console.error('Activity.show: Bad registered handler', settings);
            }
        });
        // To avoid double connections:
        // NOTE: may happen that 'show' gets called several times without a 'hide'
        // in between, because 'show' acts as a refresher right now even from segment
        // changes from the same activity.
        this._handlersAreConnected = true;
    }
};

/**
    Perform tasks to stop anything running or stop handlers from listening.
    Must be executed every time the activity is hidden/removed 
    from the current view.
**/
Activity.prototype.hide = function hide() {
    
    // Disable registered handlers
    if (this._handlers) {
        this._handlers.forEach(function(settings) {
            // Check if is an observable subscription
            if (settings._subscription) {
                settings._subscription.dispose();
                // Save latest observable value to make a comparision
                // next time is enabled to ensure is executed if there was
                // a change while disabled:
                settings._latestSubscribedValue = settings.target();
            }
            else if (settings.target.off) {
                if (settings.selector)
                    settings.target.off(settings.event, settings.selector, settings.handler);
                else
                    settings.target.off(settings.event, settings.handler);
            }
            else if (settings.target.removeListener) {
                settings.target.removeListener(settings.event, settings.handler);
            }
            else {
                console.error('Activity.hide: Bad registered handler', settings);
            }
        });
        
        this._handlersAreConnected = false;
    }
};

/**
    Register a handler that acts on an event or subscription notification,
    that will be enabled on Activity.show and disabled on Activity.hide.

    @param settings:object {
        target: jQuery, EventEmitter, Knockout.observable. Required
        event: string. Event name (can have namespaces, several events allowed). Its required except when the target is an observable, there must
            be omitted.
        handler: Function. Required,
        selector: string. Optional. For jQuery events only, passed as the
            selector for delegated handlers.
    }
**/
Activity.prototype.registerHandler = function registerHandler(settings) {
    /*jshint maxcomplexity:8 */
    
    if (!settings)
        throw new Error('Register require a settings object');
    
    if (!settings.target || (!settings.target.on && !settings.target.subscribe))
        throw new Error('Target is null or not a jQuery, EventEmmiter or Observable object');
    
    if (typeof(settings.handler) !== 'function') {
        throw new Error('Handler must be a function.');
    }
    
    if (!settings.event && !settings.target.subscribe) {
        throw new Error('Event is null; it\'s required for non observable objects');
    }

    this._handlers = this._handlers || [];

    this._handlers.push(settings);
};

/**
    Static utilities
**/
// For commodity, common classes are exposed as static properties
Activity.NavBar = NavBar;
Activity.NavAction = NavAction;

// Quick creation of common types of NavBar
Activity.createSectionNavBar = function createSectionNavBar(title) {
    return new NavBar({
        title: title,
        leftAction: NavAction.menuIn,
        rightAction: NavAction.menuNewItem
    });
};

Activity.createSubsectionNavBar = function createSubsectionNavBar(title, options) {
    
    options = options || {};
    
    var goBackOptions = {
        text: title,
        isTitle: true
    };

    if (options.backLink) {
        goBackOptions.link = options.backLink;
        goBackOptions.isShell = false;
    }

    return new NavBar({
        title: '', // No title
        leftAction: NavAction.goBack.model.clone(goBackOptions),
        rightAction: options.helpId ?
            NavAction.goHelpIndex.model.clone({
                link: '#' + options.helpId
            }) :
            NavAction.goHelpIndex
    });
};

Activity.prototype.createCancelAction = function createCancelAction(cancelLink, state) {
    
    var app = this.app;
    
    var action = new NavAction({
        link: cancelLink,
        text: 'cancel',
        handler: function(event) {
            var link = this.link(),
                eoptions = event && event.options || {};
            
            var goLink = function() {
                if (link)
                    app.shell.go(link, state);
                else
                    app.shell.goBack(state);
            };
            
            // A silentMode passed to the event requires
            // avoid the modal (used when executing a saving task for example)
            if (eoptions.silentMode) {
                goLink();
            }
            else {
                // TODO L18N
                app.modals.confirm({
                    title: 'Cancel',
                    message: 'Are you sure?',
                    yes: 'Yes',
                    no: 'No'
                })
                .then(function() {
                    // Confirmed cancellation:
                    goLink();
                });
            }
        }
    });

    return action;
};

Activity.prototype.convertToCancelAction = function convertToCancelAction(actionModel, cancelLink) {
    var cancel = this.createCancelAction(cancelLink);
    actionModel.model.updateWith(cancel);
    // DUDE: handler is cpied by updateWith?
    actionModel.handler(cancel.handler());
};

/**
    Singleton helper
**/
var singlentonInstances = {};
var createSingleton = function createSingleton(ActivityClass, $activity, app) {
    
    if (singlentonInstances[ActivityClass.name] instanceof ActivityClass) {
        return singlentonInstances[ActivityClass.name];
    }
    else {
        var s = new ActivityClass($activity, app);
        singlentonInstances[ActivityClass.name] = s;
        return s;
    }
};
// Example of use
//exports.init = createSingleton.bind(null, ActivityClass);

/**
    Static method extends to help inheritance.
    Additionally, it adds a static init method ready for the new class
    that generates/retrieves the singleton.
**/
Activity.extends = function extendsActivity(ClassFn) {
    
    ClassFn._inherits(Activity);
    
    ClassFn.init = createSingleton.bind(null, ClassFn);
    
    return ClassFn;
};

},{"../utils/Function.prototype._inherits":139,"../viewmodels/NavAction":179,"../viewmodels/NavBar":180,"knockout":false}],91:[function(require,module,exports){
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
    /*jshint maxstatements:40,maxcomplexity:24*/
    this.element = $(element);
    this.format = DPGlobal.parseFormat(options.format||this.element.data('date-format')||'mm/dd/yyyy');
    
    this.isInput = this.element.is('input');
    this.component = this.element.is('.date') ? this.element.find('.add-on') : false;
    this.isPlaceholder = this.element.is('.calendar-placeholder');
    
    this.picker = $(DPGlobal.template)
                        .appendTo(this.isPlaceholder ? this.element : 'body')
                        .on('click', $.proxy(this.click, this));
    this.picker.addClass(this.isPlaceholder ? '' : 'dropdown-menu');
    if (options.extraClasses)
        this.picker.addClass(options.extraClasses);
    
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
            // DONE:
            return;
        }
        this._prevDate = new Date(this.viewDate);

        // Header
        this.picker
        .find('.' + classes.days + ' th:eq(1)')
        .html(DPGlobal.dates.months[month] + ' ' + year);

        // Calculate ending
        var nextMonth = new Date(prevMonth);
        nextMonth.setDate(nextMonth.getDate() + 42);
        nextMonth = nextMonth.valueOf();
        var html = [];
        var clsName,
            prevY,
            prevM;
            
        if (this._daysCreated !== true) {
            // Create base html (first time only)
            // TODO: Move to constructor
            for(var r = 0; r < 6; r++) {
                html.push('<tr>');
                for(var c = 0; c < 7; c++) {
                    html.push('<td class="' + classes.monthDay + '"><span>&nbsp;</span></td>');
                }
                html.push('</tr>');
            }

            this.picker.find('.' + classes.days + ' tbody').empty().append(html.join(''));
            this._daysCreated = true;
        }

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

        var currentYear = this.date.getFullYear();
        
        var months = this.picker.find('.' + classes.months)
                    .find('th:eq(1)')
                        .html(year)
                        .end()
                    .find('span').removeClass(classes.active);
        if (currentYear === year) {
            months.eq(this.date.getMonth()).addClass(classes.active);
        }
        
        html = '';
        year = parseInt(year/10, 10) * 10;
        var yearCont = this.picker.find('.' + classes.years)
                            .find('th:eq(1)')
                                .text(year + '-' + (year + 9))
                                .end()
                            .find('td');
        
        year -= 1;
        var i;
        if (this._yearsCreated !== true) {

            for (i = -1; i < 11; i++) {
                html += '<span class="' + classes.year + (i === -1 || i === 10 ? ' old' : '')+(currentYear === year ? ' ' + classes.active : '')+'">'+year+'</span>';
                year += 1;
            }
            
            yearCont.html(html);
            this._yearsCreated = true;
        }
        else {
            
            var yearSpan = yearCont.find('span:first-child()');
            for (i = -1; i < 11; i++) {
                //html += '<span class="year'+(i === -1 || i === 10 ? ' old' : '')+(currentYear === year ? ' ' + classes.active : '')+'">'+year+'</span>';
                yearSpan
                .text(year)
                .attr('class', 'year' + (i === -1 || i === 10 ? ' old' : '') + (currentYear === year ? ' ' + classes.active : ''));
                year += 1;
                yearSpan = yearSpan.next();
            }
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

},{}],92:[function(require,module,exports){
/**
    SmartNavBar component.
    Requires its CSS counterpart.
    
    Created based on the project:
    
    Project-Tyson
    Website: https://github.com/c2prods/Project-Tyson
    Author: c2prods
    License:
    The MIT License (MIT)
    Copyright (c) 2013 c2prods
    Permission is hereby granted, free of charge, to any person obtaining a copy of
    this software and associated documentation files (the "Software"), to deal in
    the Software without restriction, including without limitation the rights to
    use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
    the Software, and to permit persons to whom the Software is furnished to do so,
    subject to the following conditions:
    The above copyright notice and this permission notice shall be included in all
    copies or substantial portions of the Software.
    THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
    IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS
    FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
    COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER
    IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
    CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
**/
var $ = require('jquery');

/**
    Internal utility.
    Removes all children for a DOM node
**/
var clearNode = function (node) {
    while(node.firstChild){
        node.removeChild(node.firstChild);
    }
};

/**
    Calculates and applies the best sizing and distribution for the title
    depending on content and buttons.
    Pass in the title element, buttons must be found as siblings of it.
**/
var textboxResize = function textboxResize(el) {
    /* jshint maxstatements: 28, maxcomplexity:11 */
    
    var leftbtn = el.parentNode.querySelectorAll('.SmartNavBar-edge.left')[0];
    var rightbtn = el.parentNode.querySelectorAll('.SmartNavBar-edge.right')[0];
    if (typeof leftbtn === 'undefined') {
        leftbtn = {
            offsetWidth: 0,
            className: ''
        };
    }
    if (typeof rightbtn === 'undefined') {
        rightbtn = {
            offsetWidth: 0,
            className: ''
        };
    }
    
    var margin = Math.max(leftbtn.offsetWidth, rightbtn.offsetWidth);
    el.style.marginLeft = margin + 'px';
    el.style.marginRight = margin + 'px';
    var tooLong = (el.offsetWidth < el.scrollWidth) ? true : false;
    if (tooLong) {
        if (leftbtn.offsetWidth < rightbtn.offsetWidth) {
            el.style.marginLeft = leftbtn.offsetWidth + 'px';
            el.style.textAlign = 'right';
        } else {
            el.style.marginRight = rightbtn.offsetWidth + 'px';
            el.style.textAlign = 'left';
        }
        tooLong = (el.offsetWidth<el.scrollWidth) ? true : false;
        if (tooLong) {
            if (new RegExp('arrow').test(leftbtn.className)) {
                clearNode(leftbtn.childNodes[1]);
                el.style.marginLeft = '26px';
            }
            if (new RegExp('arrow').test(rightbtn.className)) {
                clearNode(rightbtn.childNodes[1]);
                el.style.marginRight = '26px';
            }
        }
    }
};

exports.textboxResize = textboxResize;

/**
    SmartNavBar class, instantiate with a DOM element
    representing a navbar.
    API:
    - refresh: updates the control taking care of the needed
        width for title and buttons
**/
var SmartNavBar = function SmartNavBar(el) {
    this.el = el;
    
    this.refresh = function refresh() {
        var h = $(el).children('h1').get(0);
        if (h)
            textboxResize(h);
    };

    this.refresh(); 
};

exports.SmartNavBar = SmartNavBar;

/**
    Get instances for all the SmartNavBar elements in the DOM
**/
exports.getAll = function getAll() {
    var all = $('.SmartNavBar');
    return $.map(all, function(item) { return new SmartNavBar(item); });
};

/**
    Refresh all SmartNavBar found in the document.
**/
exports.refreshAll = function refreshAll() {
    $('.SmartNavBar > h1').each(function() { textboxResize(this); });
};

},{}],93:[function(require,module,exports){
/**
    Custom Loconomics 'locale' styles for date/times.
    Its a bit more 'cool' rendering dates ;-)
**/
'use strict';

var moment = require('moment');
// Since the task of define a locale changes
// the current global locale, we save a reference
// and restore it later so nothing changed.
var current = moment.locale();

moment.locale('en-US-LC', {
    meridiemParse : /[ap]\.?\.?/i,
    meridiem : function (hours, minutes, isLower) {
        if (hours > 11) {
            return isLower ? 'p' : 'P';
        } else {
            return isLower ? 'a' : 'A';
        }
    },
    calendar : {
        lastDay : '[Yesterday]',
        sameDay : '[Today]',
        nextDay : '[Tomorrow]',
        lastWeek : '[last] dddd',
        nextWeek : 'dddd',
        sameElse : 'M/D'
    },
    longDateFormat : {
        LT: 'h:mma',
        LTS: 'h:mm:ssa',
        L: 'MM/DD/YYYY',
        l: 'M/D/YYYY',
        LL: 'MMMM Do YYYY',
        ll: 'MMM D YYYY',
        LLL: 'MMMM Do YYYY LT',
        lll: 'MMM D YYYY LT',
        LLLL: 'dddd, MMMM Do YYYY LT',
        llll: 'ddd, MMM D YYYY LT'
    }
});

// Restore locale
moment.locale(current);

},{"moment":false}],94:[function(require,module,exports){
'use strict';

var ko = require('knockout'),
    $ = require('jquery');

// internal utility function 'to string with two digits almost'
function twoDigits(n) {
    return Math.floor(n / 10) + '' + n % 10;
}

/**
    Shows a time picker, based on different dropdowns for each time part.
    Supports hours and minutes (with am/pm for US locale)
    @param options:Object {
        title:string Optional. The text to show in the modal's header,
            with fallback to the Modal's default title.
    }
    @returns Promise. It resolves when a button is pressed, with null on 'unset'
    and an object with { time:object, timeString:string } on 'select'.
    The time object is just a plain object as { hours: 0, minutes: 0, seconds: 0 }
    Is rejected when the modal is dismissed/closed without 'unset' or 'select'.
**/
exports.show = function showTimePicker(options) {
    //jshint maxcomplexity:10

    var modal = $('#timePickerModal'),
        vm = modal.data('viewmodel');
    
    if (!vm) {
        vm = new TimePickerModel();

        ko.applyBindings(vm, modal.get(0));
        modal.data('viewmodel', vm);
    }

    options = options || {};
    
    // Fallback title
    vm.title(options.title || 'Select time');
    vm.stepInMinutes(options.stepInMinutes || 5);
    if (typeof(options.selectedTime) === 'string') {
        vm.selectedTimeString(options.selectedTime);
    }
    else {
        vm.selectedTime(options.selectedTime || {});
    }
    vm.unsetLabel(options.unsetLabel || 'Remove');
    vm.selectLabel(options.selectLabel || 'Select');
    
    return new Promise(function(resolve, reject) {
        
        // Handlers
        var unset = function() {
            resolve(null);
            modal.modal('hide');
        };
        var select = function() {
            resolve({
                time: vm.selectedTime(),
                timeString: vm.selectedTimeString()
            });
            modal.modal('hide');
        };

        // Just closed without pick anything, rejects
        modal.off('hide.bs.modal');
        modal.on('hide.bs.modal', reject);
        modal.off('click', '.timePickerModal-unset');
        modal.on('click', '.timePickerModal-unset', unset);
        modal.off('click', '.timePickerModal-select');
        modal.on('click', '.timePickerModal-select', select);

        modal.modal('show');
    });
};

function TimePickerModel() {
    
    // Set-up viewmodel and binding
    var vm = {
        title: ko.observable(''),
        pickedHour: ko.observable(null),
        pickedMinute: ko.observable(null),
        pickedAmpm: ko.observable(null),
        stepInMinutes: ko.observable(5),
        unsetLabel: ko.observable('Remove'),
        selectLabel: ko.observable('Select')
    };
    // TODO: Make localization changes with any app locale change, with timeinterval,
    // as a computed or changed by events:
    vm.locale = ko.observable({ lang: 'en', region: 'US' });

    vm.hourValues = ko.computed(function() {
        var region = this.locale().region;
        var step = (this.stepInMinutes() / 60) |0;
        // IMPORTANT: avoid infinite loops:
        if (step <= 0) step = 1;
        var values = [],
            i;
        if (region === 'US') {
            values.push({
                value: 0,
                label: 12
            });
            for (i = 1; i < 12; i += step) {
                values.push({
                    value: i,
                    label: i
                });
            }
        } else {
            for (i = 0; i < 24; i += step) {
                values.push({
                    value: i,
                    label: i
                });
            }
        }
        return values;
    }, vm);
    vm.minuteValues = ko.computed(function() {
        //var region = this.locale().region;
        var step = this.stepInMinutes() |0;
        // IMPORTANT: avoid infinite loops:
        if (step <= 0) step = 1;
        // No minutes?
        if (step >= 60) return [];

        var values = [];
        //if (region === 'US') {
        for (var i = 0; i < 60; i += step) {
            values.push({
                value: i,
                label: twoDigits(i)
            });
        }
        return values;
    }, vm);
    vm.ampmValues = ko.computed(function() {
        var region = this.locale().region;

        var values = [];
        if (region === 'US') {
            values.push({
                value: 0, // added to hours
                label: 'AM'
            });
            values.push({
                value: 12, // added to hours
                label: 'PM'
            });
        }
        return values;
    }, vm);

    vm.selectedTime = ko.computed({
        read: function() {
            return {
                hours: this.pickedHour() + this.pickedAmpm(),
                minutes: this.pickedMinute(),
                seconds: 0
            };
        },
        write: function(v) {
            if (typeof(v) !== 'object') throw new Error('Invalid input for the time picker. Value:', v);
            v = v || {};
            var region = this.locale().region;
            if (region === 'US') {
                this.pickedHour((v.hours / 12) |0);
                this.pickedMinute(v.minutes |0);
                this.pickedAmpm((v.hours % 12) |0);
            }
            else {
                this.pickedHour(v.hours |0);
                this.pickedMinute(v.minutes |0);
                this.pickedAmpm(0);
            }
        },
        owner: vm
    });

    vm.selectedTimeString = ko.computed({
        read: function() {
            var t = this.selectedTime();
            return twoDigits(t.hours) + ':' + twoDigits(t.minutes) + ':' + twoDigits(t.seconds);
        },
        write: function(v) {
            v = v || '';
            var parts = v.split(':');
            this.selectedTime({
                hours: parts[0] |0,
                minutes: parts[1] |0,
                seconds: parts[2] |0
            });
        },
        owner: vm
    });
    
    return vm;
}

},{"knockout":false}],95:[function(require,module,exports){
/** Address model **/
'use strict';

var ko = require('knockout'),
    Model = require('./Model');

function Address(values) {

    Model(this);
    
    this.model.defProperties({
        addressID: 0,
        addressName: '',
        jobTitleID: 0,
        userID: 0,
        addressLine1: null,
        addressLine2: null,
        postalCode: null,
        city: null, // Autofilled by server
        stateProvinceCode: null, // Autofilled by server
        stateProvinceName: null, // Autofilled by server
        countryCode: null, // ISO Alpha-2 code, Ex.: 'US'
        latitude: null,
        longitude: null,
        specialInstructions: null,
        isServiceArea: false,
        isServiceLocation: false,
        serviceRadius: 0,
        createdDate: null, // Autofilled by server
        updatedDate: null, // Autofilled by server
        kind: '' // Autofilled by server
    }, values);
    
    this.singleLine = ko.computed(function() {
        
        var list = [
            this.addressLine1(),
            this.city(),
            this.postalCode(),
            this.stateProvinceCode()
        ];
        
        return list.filter(function(v) { return !!v; }).join(', ');
    }, this);
    
    // TODO: needed? l10n? must be provided by server side?
    var countries = {
        'US': 'United States',
        'ES': 'Spain'
    };
    this.countryName = ko.computed(function() {
        return countries[this.countryCode()] || 'unknow';
    }, this);

    // Useful GPS object with the format used by Google Maps
    this.latlng = ko.computed(function() {
        return {
            lat: this.latitude(),
            lng: this.longitude()
        };
    }, this);
}

module.exports = Address;

// Public Enumeration for the 'kind' property:
Address.kind = {
    home: 'home',
    billing: 'billing',
    service: 'service'
};

},{"./Model":113,"knockout":false}],96:[function(require,module,exports){
/** Appointment model **/
'use strict';

var ko = require('knockout'),
    Model = require('./Model'),
    moment = require('moment'),
    PricingSummaryDetail = require('./PricingSummaryDetail'),
    CalendarEvent = require('./CalendarEvent'),
    Booking = require('./Booking');

function Appointment(values) {
    
    Model(this);

    this.model.defProperties({
        // An appointment ever references an event, and its 'id' is a CalendarEventID
        // even if other complementary object are used as 'source'
        id: null,
        
        startTime: null,
        endTime: null,
        
        // CommonEvent fields:
        summary: 'New booking',
        description: null,
        
        // Event specific fields:
        isAllDay: false,

        // Fields specific for bookings
        price: 0,
        // Actual bookings fields to use on post/put
        clientUserID: null,
        pricing: {
            Model: PricingSummaryDetail,
            isArray: true
        },
        addressID: null,
        preNotesToClient: null,
        postNotesToClient: null,
        preNotesToSelf: null,
        postNotesToSelf: null,
        
        jobTitleID: 0,
        
        readOnly: false,
        
        sourceEvent: {
            Model: CalendarEvent,
            defaultValue: null
        },
        sourceBooking: {
            Model: Booking,
            defaultValue: null
        }
    }, values);

    // Smart visualization of date and time
    this.displayedDate = ko.pureComputed(function() {
        
        return moment(this.startTime()).locale('en-US-LC').calendar();
        
    }, this);
    
    this.displayedStartTime = ko.pureComputed(function() {
        
        return moment(this.startTime()).locale('en-US-LC').format('LT');
        
    }, this);
    
    this.displayedEndTime = ko.pureComputed(function() {
        
        return moment(this.endTime()).locale('en-US-LC').format('LT');
        
    }, this);
    
    this.displayedTimeRange = ko.pureComputed(function() {
        
        return this.displayedStartTime() + '-' + this.displayedEndTime();
        
    }, this);
    
    this.itStarted = ko.pureComputed(function() {
        return (this.startTime() && new Date() >= this.startTime());
    }, this);
    
    this.itEnded = ko.pureComputed(function() {
        return (this.endTime() && new Date() >= this.endTime());
    }, this);
    
    this.isNew = ko.pureComputed(function() {
        return (!this.id());
    }, this);
    
    this.stateHeader = ko.pureComputed(function() {
        
        var text = '';
        if (this.id() > 0 && this.sourceEvent()) {
            if (!this.sourceBooking()) {
                text = 'Calendar block';
            }
            else if (this.itStarted()) {
                if (this.itEnded()) {
                    text = 'Completed';
                }
                else {
                    text = 'Now';
                }
            }
            else {
                text = 'Upcoming';
            }
        }

        return text;
        
    }, this);
}

module.exports = Appointment;

/**
    Creates an appointment instance from a CalendarEvent model instance
**/
Appointment.fromCalendarEvent = function fromCalendarEvent(event) {
    var apt = new Appointment();
    
    // Include event in apt
    apt.id(event.calendarEventID());
    apt.startTime(event.startTime());
    apt.endTime(event.endTime());
    apt.summary(event.summary());
    apt.description(event.description());
    apt.isAllDay(event.isAllDay());
    apt.readOnly(event.readOnly());
    apt.sourceEvent(event);
    
    return apt;
};

/**
    Creates an appointment instance from a Booking and a CalendarEvent model instances
**/
Appointment.fromBooking = function fromBooking(booking, event) {
    // Include event in apt
    var apt = Appointment.fromCalendarEvent(event);
    
    // Include booking in apt
    apt.clientUserID(booking.clientUserID());
    apt.addressID(booking.serviceAddressID());
    apt.jobTitleID(booking.jobTitleID());
    apt.pricing(booking.pricingSummary() && booking.pricingSummary().details());
    apt.preNotesToClient(booking.preNotesToClient());
    apt.postNotesToClient(booking.postNotesToClient());
    apt.preNotesToSelf(booking.preNotesToSelf());
    apt.postNotesToSelf(booking.postNotesToSelf());
    
    // On bookings, readOnly must set to false (is sent as true ever from
    // the server, to prevent direct manipulation of the event that is part of
    // a booking
    apt.readOnly(false);

    var prices = booking.pricingSummary();
    if (prices) {
        // TODO Setting service professional price, for clients must be
        // just totalPrice()
        apt.price(prices.totalPrice() - prices.pFeePrice());
    }

    apt.sourceBooking(booking);

    return apt;
};

/**
    Creates a list of appointment instances from the list of events and bookings.
    The bookings list must contain every booking that belongs to the events of type
    'booking' from the list of events.
**/
Appointment.listFromCalendarEventsBookings = function listFromCalendarEventsBookings(events, bookings) {
    return events.map(function(event) {
        var booking = null;
        bookings.some(function(searchBooking) {
            var found = searchBooking.serviceDateID() === event.calendarEventID();
            if (found) {
                booking = searchBooking;
                return true;
            }
        });

        if (booking)
            return Appointment.fromBooking(booking, event);
        else
            return Appointment.fromCalendarEvent(event);
    });
};

Appointment.specialIds = {
    loading: 0,
    emptyDate: -1,
    free: -2,
    newEvent: -3,
    newBooking: -4,
    unavailable: -5,
    preparationTime: -6
};

var Time = require('../utils/Time');
/**
    Creates an Appointment instance that represents a calendar slot of
    free/spare time, for the given time range, or the full given date.
    @param options:Object {
        date:Date. Optional. Used to create a full date slot or default for start/end
            to date start or date end
        start:Date. Optional. Beggining of the slot
        end:Date. Optional. Ending of the slot
        text:string. Optional ['Free']. To allow external localization of the text.
    }
**/
Appointment.newFreeSlot = function newFreeSlot(options) {
    
    var start = options.start || new Time(options.date, 0, 0, 0),
        end = options.end || new Time(options.date, 0, 0, 0);

    return new Appointment({
        id: Appointment.specialIds.free,

        startTime: start,
        endTime: end,

        summary: options.text || 'Free',
        description: null
    });
};

Appointment.newUnavailableSlot = function newUnavailableSlot(options) {
    
    var start = options.start || new Time(options.date, 0, 0, 0),
        end = options.end || new Time(options.date, 0, 0, 0);

    return new Appointment({
        id: Appointment.specialIds.unavailable,

        startTime: start,
        endTime: end,

        summary: options.text || 'Unavailable',
        description: null
    });
};

Appointment.newPreparationTimeSlot = function newPreparationTimeSlot(options) {

    var start = options.start || new Time(options.date, 0, 0, 0),
        end = options.end || new Time(options.date, 0, 0, 0);

    return new Appointment({
        id: Appointment.specialIds.preparationTime,

        startTime: start,
        endTime: end,

        summary: options.text || 'Preparation time',
        description: null
    });
};
},{"../utils/Time":148,"./Booking":97,"./CalendarEvent":99,"./Model":113,"./PricingSummaryDetail":116,"knockout":false,"moment":false}],97:[function(require,module,exports){
/** Booking model.

    Describes a booking and related data,
    mainly the pricing summary and details, but
    can hold other related data if optionally loaded
    (address, dates, publicUserJobTitle)
 **/
'use strict';

var Model = require('./Model'),
    PricingSummary = require('./PricingSummary'),
    PublicUserJobTitle = require('./PublicUserJobTitle'),
    Address = require('./Address'),
    EventDates = require('./EventDates');

function Booking(values) {
    
    Model(this);

    this.model.defProperties({
        bookingID: 0,
        clientUserID: 0,
        serviceProfessionalUserID: 0,
        jobTitleID: 0,
        languageID: 0,
        countryID: 0,
        bookingStatusID: 0,
        bookingTypeID: 0,
        cancellationPolicyID: 0,
        parentBookingID: null,
        
        serviceAddressID: null,
        serviceDateID: null,
        alternativeDate1ID: null,
        alternativeDate2ID: null,
        
        pricingSummaryID: 0,
        pricingSummaryRevision: 0,
        paymentLastFourCardNumberDigits: null,
        totalPricePaidByClient: null,
        totalServiceFeesPaidByClient: null,
        totalPaidToServiceProfessional: null,
        totalServiceFeesPaidByServiceProfessional: null,

        instantBooking: false,
        firstTimeBooking: false,
        sendReminder: false,
        sendPromotional: false,
        recurrent: false,
        multiSession: false,
        pricingAdjustmentApplied: false,
        paymentEnabled: false,
        paymentCollected: false,
        paymentauthorized: false,
        awaitingResponseFromUserID: null,
        pricingAdjustmentRequested: false,
        
        updatedDate: null,
        
        specialRequests: null,
        preNotesToClient: null,
        postNotesToClient: null,
        preNotesToSelf: null,
        postNotesToSelf: null,
        
        reviewedByServiceProfessional: false,
        reviewedByClient: false,
        
        pricingSummary: new PricingSummary(),
        serviceAddress: {
            Model: Address
        },
        serviceDate: {
            Model: EventDates
        },
        alternativeDate1: {
            Model: EventDates
        },
        alternativeDate2: {
            Model: EventDates
        },
        userJobTitle: {
            Model: PublicUserJobTitle
        }
    }, values);
}

module.exports = Booking;

},{"./Address":95,"./EventDates":103,"./Model":113,"./PricingSummary":115,"./PublicUserJobTitle":120}],98:[function(require,module,exports){
/** BookingSummary model **/
'use strict';

var ko = require('knockout'),
    Model = require('./Model'),
    moment = require('moment');
    
function BookingSummary(values) {
    
    Model(this);

    this.model.defProperties({
        quantity: 0,
        concept: '',
        time: null,
        timeFormat: ' [@] h:mma'
    }, values);

    this.phrase = ko.pureComputed(function(){
        var t = this.timeFormat() && 
            this.time() && 
            moment(this.time()).format(this.timeFormat()) ||
            '';        
        return this.concept() + t;
    }, this);

    this.url = ko.pureComputed(function() {
        var url = this.time() &&
            '/calendar/' + this.time().toISOString();
        
        return url;
    }, this);
}

module.exports = BookingSummary;

},{"./Model":113,"knockout":false,"moment":false}],99:[function(require,module,exports){
/**
    Event model
**/
'use strict';

/* Example JSON (returned by the REST API):
{
  "EventID": 353,
  "UserID": 141,
  "EventTypeID": 3,
  "Summary": "Housekeeper services for John D.",
  "AvailabilityTypeID": 3,
  "StartTime": "2014-03-25T08:00:00Z",
  "EndTime": "2014-03-25T18:00:00Z",
  "Kind": 0,
  "IsAllDay": false,
  "TimeZone": "01:00:00",
  "Location": "null",
  "UpdatedDate": "2014-10-30T15:44:49.653",
  "CreatedDate": null,
  "Description": "test description of a REST event",
  "RecurrenceRule": {
    "FrequencyTypeID": 502,
    "Interval": 1,
    "Until": "2014-07-01T00:00:00",
    "Count": null,
    "Ending": "date",
    "SelectedWeekDays": [
      1,
    ],
    "MonthlyWeekDay": false,
    "Incompatible": false,
    "TooMany": false
  },
  "RecurrenceOccurrences": null,
  "ReadOnly": false
}*/

var Model = require('./Model');

function RecurrenceRule(values) {
    Model(this);
    
    this.model.defProperties({
        frequencyTypeID: 0,
        interval: 1, //:Integer
        until: null, //:Date
        count: null, //:Integer
        ending: null, // :string Possible values allowed: 'never', 'date', 'ocurrences'
        selectedWeekDays: [], // :integer[] 0:Sunday
        monthlyWeekDay: false,
        incompatible: false,
        tooMany: false
    }, values);
}

function RecurrenceOccurrence(values) {
    Model(this);
    
    this.model.defProperties({
        startTime: null, //:Date
        endTime: null //:Date
    }, values);
}
   
function CalendarEvent(values) {
    
    Model(this);
    
    // Special values: dates must be converted
    // to a Date object. They come as ISO string
    // TODO: Make this something generic, or even in Model definitions,
    // and use for updated/createdDate around all the project
    if (values) {
        values.startTime = values.startTime && new Date(Date.parse(values.startTime)) || null;
        values.endTime = values.endTime && new Date(Date.parse(values.endTime)) || null;
    }

    this.model.defProperties({
        calendarEventID: 0,
        userID: 0,
        eventTypeID: 3,
        summary: '',
        availabilityTypeID: 0,
        startTime: null,
        endTime: null,
        kind: 0,
        isAllDay: false,
        timeZone: 'Z',
        location: null,
        updatedDate: null,
        createdDate: null,
        description: '',
        readOnly: false,
        recurrenceRule: {
            Model: RecurrenceRule
        },
        recurrenceOccurrences: {
            isArray: true,
            Model: RecurrenceOccurrence
        }
    }, values);
}

module.exports = CalendarEvent;

CalendarEvent.RecurrenceRule = RecurrenceRule;
CalendarEvent.RecurrenceOccurrence = RecurrenceOccurrence;

},{"./Model":113}],100:[function(require,module,exports){
/**
    CalendarSyncing model.
 **/
'use strict';

var Model = require('./Model');

function CalendarSyncing(values) {

    Model(this);

    this.model.defProperties({
        icalExportUrl: '',
        icalImportUrl: ''
    }, values);
}

module.exports = CalendarSyncing;

},{"./Model":113}],101:[function(require,module,exports){
/** client model **/
'use strict';

var ko = require('knockout'),
    Model = require('./Model');

function Client(values) {
    
    Model(this);
    
    this.model.defProperties({
        clientUserID: 0,
        
        firstName: '',
        lastName: '',
        secondLastName: '',
        email: '',
        phone: null,
        canReceiveSms: false,
        birthMonthDay: null,
        birthMonth: null,
        
        notesAboutClient: null,
        
        createdDate: null,
        updatedDate: null,
        editable: false
    }, values);

    this.fullName = ko.pureComputed(function() {
        return ((this.firstName() || '') + ' ' + (this.lastName() || ''));
    }, this);
    
    this.birthDay = ko.pureComputed(function() {
        if (this.birthMonthDay() &&
            this.birthMonth()) {
            
            // TODO i10n
            return this.birthMonth() + '/' + this.birthMonthDay();
        }
        else {
            return null;
        }
    }, this);
}

module.exports = Client;

},{"./Model":113,"knockout":false}],102:[function(require,module,exports){
/**
    Keeps a date availability object that includes a list of appointments
    that fills all the times in the date (following the weekDaySchedule and free/unavailable
    times) and summary of the availability status of the date.
    Updating the main properties: appointmentsList, date, weekDaySchedule, the complete
    list and summaries auto calculate to show the proper listing.
**/
'use strict';

var Model = require('../models/Model');
var Appointment = require('../models/Appointment'),
    WeekDaySchedule = require('../models/WeekDaySchedule'),
    SchedulingPreferences = require('../models/SchedulingPreferences'),
    moment = require('moment'),
    ko = require('knockout'),
    availabilityCalculation = require('../utils/availabilityCalculation'),
    getDateWithoutTime = require('../utils/getDateWithoutTime');

function DateAvailability(values) {

    Model(this);
    
    this.model.defProperties({
        date: null, // Date
        weekDaySchedule: {
            Model: WeekDaySchedule
        },
        appointmentsList: {
            isArray: true,
            Model: Appointment
        },
        schedulingPreferences: {
            Model: SchedulingPreferences
        }
    }, values);
    
    /**
        :array<Appointment> List of appointments for all the times in the date.
        It introduces free and unavailable appointments using appointmentsList as base
        for actual *busy* appointments and the rules of weekDaySchedule
    **/
    this.list = ko.pureComputed(function() {
        return availabilityCalculation.fillDayAvailability(
            this.date(), this.appointmentsList(), this.weekDaySchedule(), this.schedulingPreferences()
        );
    }, this);

    /**
        :int
        Number of minutes scheduled for work in a generic/empty day
        based on the information at weekDaySchedule.
    **/
    this.workDayMinutes = ko.pureComputed(function() {
        var schedule = this.weekDaySchedule();
        // from-to are minutes of the day, so its easy to calculate
        return (schedule.to() - schedule.from()) |0;
    }, this);

    /**
        :int
        Number of minutes available to be scheduled in this date
        inside the work time (weekDaySchedule.
        It's the sum of all 'Free' appointments in the date.
    **/
    this.availableMinutes = ko.pureComputed(function() {
        return this.list().reduce(function(minutes, apt) {
            if (apt.id() === Appointment.specialIds.free) {
                var et = moment(apt.endTime()),
                    st = moment(apt.startTime());
                minutes += et.diff(st, 'minutes');
            }
            return minutes;
        }, 0);
    }, this);

    /**
        :int
        Percentage number from 0 to 100 of time
        available time in the date (availableMinutes / workDayMinutes)
    **/
    this.availablePercent = ko.pureComputed(function() {
        return (Math.round((this.availableMinutes() / this.workDayMinutes()) * 100));
    }, this);

    /**
        :string
        A text value from an enumeration that represents
            ranges of availablePercent, suitable for high level use as CSS classes.
            Special case on past date-time, when it returns 'past' rather than the
            availability, since past times are not availabile for anything new (can't change the past! ;-)
            Can be: 'none', 'low', 'medium', 'full', 'past'
    **/
    this.availableTag = ko.pureComputed(function() {
        var perc = this.availablePercent(),
            date = this.date(),
            today = getDateWithoutTime();

        if (date < today)
            return 'past';
        else if (perc >= 100)
            return 'full';
        else if (perc >= 50)
            return 'medium';
        else if (perc > 0)
            return 'low';
        else // <= 0
            return 'none';
    }, this);
    
    /**
        Retrieve a list of date-times that are free, available to be used,
        in this date with a separation between each of the given slotSize
        in minutes or using the default from the scheduling preferences
        included in the object.

        The parameter 'duration' (in minutes) allows that returned slots
        are free almost for the given duration. This allows to choose times
        that fit the needed service duration.
    **/
    this.getFreeTimeSlots = function getFreeTimeSlots(duration, slotSizeMinutes) {
        
        slotSizeMinutes = slotSizeMinutes || this.schedulingPreferences().incrementsSizeInMinutes();
        
        if (!duration)
            duration = slotSizeMinutes;
        
        var date = this.date(),
            today = getDateWithoutTime();
    
        // Quick return if with empty list when
        // - past date (no time)
        // - no available time (already computed)
        if (date < today ||
            this.availableMinutes() <= 0) {
            return [];
        }
        else {
            var slots = [];
            // Iterate every free appointment
            this.list().forEach(function (apt) {
                if (apt.id() === Appointment.specialIds.free) {
                    slots.push.apply(slots, createTimeSlots(apt.startTime(), apt.endTime(), slotSizeMinutes, duration));
                }
            });
            return slots;
        }
    };
}

module.exports = DateAvailability;

/**
    It creates slots between the given times and size for each one.
    Past times are avoided, because are not available
**/
function createTimeSlots(from, to, size, duration) {
    var i = moment(from),
        d,
        slots = [],
        now = new Date(),
        enought;

    // Shortcut if bad 'to' (avoid infinite loop)
    if (to <= from)
        return slots;

    while(i.toDate() < to) {
        d = i.clone().toDate();
        enought = i.clone().add(duration, 'minutes').toDate();
        // Check that:
        // - is not a past date
        // - it has enought time in advance to fill the expected duration
        if (d >= now &&
            enought <= to)
            slots.push(d);
        // Next slot
        i.add(size, 'minutes');
    }
    
    return slots;
}

},{"../models/Appointment":96,"../models/Model":113,"../models/SchedulingPreferences":125,"../models/WeekDaySchedule":135,"../utils/availabilityCalculation":150,"../utils/getDateWithoutTime":157,"knockout":false,"moment":false}],103:[function(require,module,exports){
/**
    A dates range, simplified info usually needed from an CalendarEvent.
**/
'use strict';

var Model = require('./Model');

module.exports = function EventDates(values) {
    
    Model(this);

    this.model.defProperties({
        startTime: null,
        endTime: null
    }, values);
};

},{"./Model":113}],104:[function(require,module,exports){
/** GetMore model **/
'use strict';

var ko = require('knockout'),
    Model = require('./Model'),
    ListViewItem = require('./ListViewItem');

function GetMore(values) {

    Model(this);

    this.model.defProperties({
        availability: false,
        payments: false,
        profile: false,
        coop: true
    }, values);

    var availableItems = {
        availability: new ListViewItem({
            contentLine1: 'Complete your availability to create a cleaner calendar',
            markerIcon: 'fa fa-fw fa-calendar'
        }),
        payments: new ListViewItem({
            contentLine1: 'Start accepting payments through Loconomics',
            markerIcon: 'fa ion ion-card'
        }),
        profile: new ListViewItem({
            contentLine1: 'Activate your profile in the marketplace',
            markerIcon: 'fa ion ion-cash'
        }),
        coop: new ListViewItem({
            contentLine1: 'Learn more about our cooperative',
            actionIcon: 'fa fa-gavel'
        })
    };

    this.items = ko.pureComputed(function() {
        var items = [];
        
        Object.keys(availableItems).forEach(function(key) {
            
            if (this[key]())
                items.push(availableItems[key]);
        }.bind(this));

        return items;
    }, this);
}

module.exports = GetMore;

},{"./ListViewItem":108,"./Model":113,"knockout":false}],105:[function(require,module,exports){
/** JobTitle model **/
'use strict';

var ko = require('knockout'),
    Model = require('./Model'),
    JobTitlePricingType = require('./JobTitlePricingType');

function JobTitle(values) {
    
    Model(this);
    
    this.model.defProperties({
        jobTitleID: 0,
        singularName: '',
        pluralName: '',
        aliases: '',
        description: null,
        searchDescription: null,
        createdDate: null,
        updatedDate: null
    }, values);

    this.model.defID(['jobTitleID']);

    // TODO: review if, not registered as a property, the list is updated
    // on syncs by using model.updateWith

    // Pricing Types relationship,
    // collection of JobTitlePricingType entities
    this.pricingTypes = ko.observableArray([]);
    if (values && values.pricingTypes) {
        values.pricingTypes.forEach(function(jobpricing) {
            this.pricingTypes.push(new JobTitlePricingType(jobpricing));
        }.bind(this));
    }
}

module.exports = JobTitle;

},{"./JobTitlePricingType":106,"./Model":113,"knockout":false}],106:[function(require,module,exports){
/**
    Defines the relationship between a JobTitle and a PricingType.
**/
'use strict';

var Model = require('./Model');

function JobTitlePricingType(values) {

    Model(this);
    
    this.model.defProperties({
        pricingTypeID: 0,
        // NOTE: Client Type is mostly unused today but exists
        // on all database records. It uses the default value
        // of 1 all the time for now.
        clientTypeID: 1,
        createdDate: null,
        updatedDate: null
    }, values);
    
    this.model.defID(['pricingTypeID', 'clientTypeID']);
}

module.exports = JobTitlePricingType;

},{"./Model":113}],107:[function(require,module,exports){
/** LicenseCertification model **/
'use strict';

var Model = require('./Model');

function LicenseCertification(values) {

    Model(this);
    
    this.model.defProperties({
        licenseCertificationID: 0,
        name: '',
        stateProvinceID: 0,
        countryID: 0,
        description: null,
        authority: null,
        verificationWebsiteUrl: null,
        howToGetLicensedUrl: null,
        optionGroup: null,
        createdDate: null, // Autofilled by server
        updatedDate: null, // Autofilled by server
    }, values);
    
    this.model.defID(['licenseCertificationID']);
}

module.exports = LicenseCertification;

},{"./Model":113}],108:[function(require,module,exports){
/** ListViewItem model.

    Describes a generic item of a
    ListView component.
 **/
'use strict';

var Model = require('./Model');

function ListViewItem(values) {
    
    Model(this);

    this.model.defProperties({
        markerLine1: null,
        markerLine2: null,
        markerIcon: null,
        
        contentLine1: '',
        contentLine2: null,
        link: '#',

        actionIcon: null,
        actionText: null,
        
        classNames: ''

    }, values);
}

module.exports = ListViewItem;

},{"./Model":113}],109:[function(require,module,exports){
/** MailFolder model **/
'use strict';

var ko = require('knockout'),
    Model = require('./Model'),
    _ = require('lodash');

function MailFolder(values) {

    Model(this);

    this.model.defProperties({
        messages: [],
        topNumber: 10
    }, values);
    
    this.top = ko.pureComputed(function top(num) {
        if (num) this.topNumber(num);
        return _.first(this.messages(), this.topNumber());
    }, this);
}

module.exports = MailFolder;

},{"./Model":113,"knockout":false,"lodash":false}],110:[function(require,module,exports){
/** MarketplaceProfile model **/
'use strict';

var Model = require('./Model'),
    ko = require('knockout');

function MarketplaceProfile(values) {
    
    Model(this);
    
    this.model.defProperties({
        userID: 0,
        
        publicBio: '',
        serviceProfessionalProfileUrlSlug: '',
        // This is a server-side computed variable (read-only for the user) for a Loconomics address
        // created using the serviceProfessionalProfileUrlSlug if any or the fallback system URL.
        serviceProfessionalProfileUrl: '',
        // Specify an external website of the serviceProfessional.
        serviceProfessionalWebsiteUrl: '',
        // Server-side generated code that allows to identificate special booking requests
        // from the book-me-now button. The server ensures that there is ever a value on this for serviceProfessionals.
        bookCode: '',

        createdDate: null,
        updatedDate: null
    }, values);
    
    // Special observable: photoUrl, is a well know URL, no saved on database, based on the userID
    // and the channel being in use
    this.photoUrl = ko.pureComputed(function() {
        var $ = require('jquery');
        var siteUrl = $('html').attr('data-site-url') || 'https://loconomics.com';
        return siteUrl + '/en-US/Profile/Photo/' + this.userID();
    }, this);
}

module.exports = MarketplaceProfile;

},{"./Model":113,"knockout":false}],111:[function(require,module,exports){
/** Message model.

    Describes a message that belongs to a Thread.
    A message could be of different types,
    as inquiries, bookings, booking requests.
 **/
'use strict';

var ko = require('knockout'),
    Model = require('./Model'),
    moment = require('moment');

function Message(values) {
    
    Model(this);

    this.model.defProperties({
        messageID: 0,
        threadID: 0,
        sentByUserID: null,
        typeID: null,
        auxT: null,
        auxID: null,
        bodyText: '',
        
        createdDate: null,
        updatedDate: null
    }, values);
    
    // Smart visualization of date and time
    this.displayedDate = ko.pureComputed(function() {
        return moment(this.createdDate()).locale('en-US-LC').calendar();
    }, this);
    
    this.displayedTime = ko.pureComputed(function() {
        return moment(this.createdDate()).locale('en-US-LC').format('LT');
    }, this);
}

module.exports = Message;

},{"./Model":113,"knockout":false,"moment":false}],112:[function(require,module,exports){
/** Message model.

    Describes a message from a MailFolder.
    A message could be of different types,
    as inquiries, bookings, booking requests.
 **/
'use strict';

var ko = require('knockout'),
    Model = require('./Model'),
    moment = require('moment');

function MessageView(values, app) {
    
    Model(this);

    this.model.defProperties({
        id: 0,
        createdDate: null,
        updatedDate: null,
        
        subject: '',
        content: null,
        link: '#',
        
        tag: '',
        classNames: '',
        
        sourceThread: null,
        sourceMessage: null

    }, values);
    
    // Smart visualization of date and time
    this.displayedDate = ko.pureComputed(function() {
        
        return moment(this.createdDate()).locale('en-US-LC').calendar();
        
    }, this);
    
    this.displayedTime = ko.pureComputed(function() {
        
        return moment(this.createdDate()).locale('en-US-LC').format('LT');

    }, this);
    
    this.quickDateTime = ko.pureComputed(function() {
        var date = this.createdDate();

        var m = moment(date).locale('en-US-LC'),
            t = moment().startOf('day');

        if (m.isAfter(t)) {
            return m.format('LT');
        }
        else {
            return m.fromNow();
        }
    }, this);
    
    this.client = ko.computed(function() {
        var s = this.sourceMessage();
        if (!s || !app) return null;

        var cid = s.sentByUserID();
        if (cid) {
            if (cid === app.model.userProfile.data.userID())
                return app.model.userProfile.data;
            else
                return app.model.clients.getObservableItem(cid, true)();
        }
        return null;
    }, this)
    .extend({ rateLimit: { method: 'notifyWhenChangesStop', timeout: 20 } });
}

module.exports = MessageView;

/**
    Creates a MessageView instance from a Thread instance.
    It's better to have almost one message in the thread (the latest
    one first, or the one to highlight) to build a
    more detailed MessageView
**/
MessageView.fromThread = function(app, thread) {
    
    var msg = thread.messages();
    msg = msg && msg[0] || null;
    
    // TODO: more different tag/classes depending on booking state as per design
    // NOTE: That requires to load the booking or request by auxID and wait for it
    var tag, classNames;
    if (msg.auxT() === 'Booking') {
        tag = 'Booking';
        classNames = 'text-success';
    }
    // TODO For state==request must be
    /*{
        tag = 'Booking request';
        classNames = 'text-warning';
    }*/
    
    return new MessageView({
        sourceThread: thread,
        sourceMessage: msg,
        id: thread.threadID(),
        createdDate: thread.createdDate(),
        updatedDate: thread.updatedDate(),
        subject: thread.subject(),
        content: msg && msg.bodyText() || '',
        link: '#!/conversation/' + thread.threadID(),
        tag: tag,
        classNames: classNames
    }, app);
};

},{"./Model":113,"knockout":false,"moment":false}],113:[function(require,module,exports){
module.exports=require(6)
},{"knockout":false,"knockout.mapping":false}],114:[function(require,module,exports){
/** PerformanceSummary model **/
'use strict';

var ko = require('knockout'),
    Model = require('./Model'),
    ListViewItem = require('./ListViewItem'),
    moment = require('moment'),
    numeral = require('numeral');

function PerformanceSummary(values) {

    Model(this);

    values = values || {};
    
    // TODO: define earnings and timeBooking as properties with def.Model?

    this.earnings = new Earnings(values.earnings);
    
    var earningsLine = new ListViewItem();
    earningsLine.markerLine1 = ko.computed(function() {
        var num = numeral(this.currentAmount()).format('$0,0');
        return num;
    }, this.earnings);
    earningsLine.contentLine1 = ko.computed(function() {
        return this.currentConcept();
    }, this.earnings);
    earningsLine.markerLine2 = ko.computed(function() {
        var num = numeral(this.nextAmount()).format('$0,0');
        return num;
    }, this.earnings);
    earningsLine.contentLine2 = ko.computed(function() {
        return this.nextConcept();
    }, this.earnings);
    

    this.timeBooked = new TimeBooked(values.timeBooked);

    var timeBookedLine = new ListViewItem();
    timeBookedLine.markerLine1 = ko.computed(function() {
        var num = numeral(this.percent()).format('0%');
        return num;
    }, this.timeBooked);
    timeBookedLine.contentLine1 = ko.computed(function() {
        return this.concept();
    }, this.timeBooked);
    
    
    this.items = ko.pureComputed(function() {
        var items = [];
        
        items.push(earningsLine);
        items.push(timeBookedLine);

        return items;
    }, this);
}

module.exports = PerformanceSummary;

function Earnings(values) {

    Model(this);
    
    this.model.defProperties({
    
         currentAmount: 0,
         currentConceptTemplate: 'already paid this month',
         nextAmount: 0,
         nextConceptTemplate: 'projected {month} earnings'

    }, values);
    
    this.currentConcept = ko.pureComputed(function() {

        var month = moment().format('MMMM');
        return this.currentConceptTemplate().replace(/\{month\}/, month);

    }, this);

    this.nextConcept = ko.pureComputed(function() {

        var month = moment().add(1, 'month').format('MMMM');
        return this.nextConceptTemplate().replace(/\{month\}/, month);

    }, this);
}

function TimeBooked(values) {

    Model(this);
    
    this.model.defProperties({
    
        percent: 0,
        conceptTemplate: 'of available time booked in {month}'
    
    }, values);
    
    this.concept = ko.pureComputed(function() {

        var month = moment().add(1, 'month').format('MMMM');
        return this.conceptTemplate().replace(/\{month\}/, month);

    }, this);
}

},{"./ListViewItem":108,"./Model":113,"knockout":false,"moment":false,"numeral":false}],115:[function(require,module,exports){
/**
**/
'use strict';

var Model = require('./Model'),
    PricingSummaryDetail = require('./PricingSummaryDetail');

module.exports = function PricingSummary(values) {
    
    Model(this);

    this.model.defProperties({
        pricingSummaryID: 0,
        pricingSummaryRevision: 0,
        serviceDurationMinutes: null,
        firstSessionDurationMinutes: null,
        
        subtotalPrice: null,
        feePrice: null,
        totalPrice: null,
        pFeePrice: null,
        subtotalRefunded: null,
        feeRefunded: null,
        totalRefunded: null,
        dateRefunded: null,
        
        createdDate: null,
        updatedDate: null,
        
        details: {
            Model: PricingSummaryDetail,
            isArray: true
        }
    }, values);
};

},{"./Model":113,"./PricingSummaryDetail":116}],116:[function(require,module,exports){
module.exports=require(7)
},{"./Model":113}],117:[function(require,module,exports){
/**
    Pricing Type model
**/
'use strict';

var Model = require('./Model');

function PricingType(values) {
    
    Model(this);
    
    this.model.defProperties({
        pricingTypeID: 0,
        singularName: '',
        pluralName: '',
        slugName: '',
        addNewLabel: null,
        serviceProfessionalDescription: null,
        // PriceCalculationType enumeration value:
        priceCalculation: null,
        isAddon: false,
        
        // Form Texts
        namePlaceHolder: null,
        suggestedName: null,
        fixedName: null,
        durationLabel: null,
        priceLabel: null,
        priceNote: null,
        firstTimeClientsOnlyLabel: null,
        descriptionPlaceHolder: null,
        priceRateQuantityLabel: null,
        priceRateUnitLabel: null,
        noPriceRateLabel: null,
        numberOfSessionsLabel: null,
        inPersonPhoneLabel: null,
        
        // Action And Validation Texts
        successOnDelete: null,
        errorOnDelete: null,
        successOnSave: null,
        errorOnSave: null,
        priceRateIsRequiredValidationError: null,
        priceRateUnitIsRequiredValidationError: null,
        
        // Help Texts
        learnMoreLabel: null,
        learnMoreText: null,
        priceRateLearnMoreLabel: null,
        priceRateLearnMoreText: null,
        noPriceRateLearnMoreLabel: null,
        noPriceRateLearnMoreText: null,
        
        // Additional configuration
        requireDuration: false,
        includeServiceAttributes: false,
        includeSpecialPromotion: false,
        
        // List Texts
        /// SummaryFormat is the default format for summaries (required),
        /// other formats are good for better detail, but depends
        /// on other options configured per type.
        /// Wildcards:
        /// {0}: duration
        /// {1}: sessions
        /// {2}: inperson/phone
        summaryFormat: null,
        summaryFormatMultipleSessions: null,
        summaryFormatNoDuration: null,
        summaryFormatMultipleSessionsNoDuration: null,
        withoutServiceAttributesClientMessage: null,
        withoutServiceAttributesServiceProfessionalMessage: null,
        firstTimeClientsOnlyListText: null,
        priceRateQuantityListLabel: null,
        priceRateUnitListLabel: null,
        noPriceRateListMessage: null,
        
        // Booking/PricingSummary Texts
        /// NameAndSummaryFormat is the default format for summaries with package name (required),
        /// other formats are good for better detail, but depends
        /// on other options configured per type.
        /// Wildcards:
        /// {0}: package name
        /// {1}: duration
        /// {2}: sessions
        /// {3}: inperson/phone
        nameAndSummaryFormat: null,
        nameAndSummaryFormatMultipleSessions: null,
        nameAndSummaryFormatNoDuration: null,
        nameAndSummaryFormatMultipleSessionsNoDuration: null,
        
        // Record maintenance
        createdDate: null,
        updatedDate: null
    }, values);
    
    this.model.defID(['pricingTypeID']);
}

module.exports = PricingType;

// Enumeration:
var PriceCalculationType = {
    FixedPrice: 1,
    HourlyPrice: 2
};

PricingType.PriceCalculationType = PriceCalculationType;

},{"./Model":113}],118:[function(require,module,exports){
/**
    PrivacySettings model
**/
'use strict';

var Model = require('./Model');

function PrivacySettings(values) {
    
    Model(this);
    
    this.model.defProperties({
        userID: 0,
        smsBookingCommunication: false,
        phoneBookingCommunication: false,
        loconomicsCommunityCommunication: false,
        loconomicsDbmCampaigns: false,
        profileSeoPermission: false,
        loconomicsMarketingCampaigns: false,
        coBrandedPartnerPermissions: false,
        createdDate: null,
        updatedDate: null
    }, values);
    
    this.model.defID(['userID']);
}

module.exports = PrivacySettings;

},{"./Model":113}],119:[function(require,module,exports){
/**
    Collection of public information from a user,
    holded on different models
    
    TODO: Some fields introduced to help the ServiceProfessionalInfo component, but may require refactor
**/
'use strict';

var Model = require('./Model'),
    PublicUserProfile = require('./PublicUserProfile'),
    PublicUserRating = require('./PublicUserRating'),
    PublicUserVerificationsSummary = require('./PublicUserVerificationsSummary'),
    PublicUserJobTitle = require('./PublicUserJobTitle'),
    ko = require('knockout');

function PublicUser(values) {
    
    Model(this);
    
    this.model.defProperties({
        profile: { Model: PublicUserProfile },
        rating: { Model: PublicUserRating },
        verificationsSummary: { Model: PublicUserVerificationsSummary },
        jobProfile: {
            Model: PublicUserJobTitle,
            isArray: true
        },
        // TODO To implement on server, REST API
        backgroundCheckPassed: null, // null, true, false
        // Utility data for ServiceProfessionalInfo
        selectedJobTitleID: null,
        isClientFavorite: false
    }, values);
    
    // Utilities for ServiceProfessionalInfo
    this.selectedJobTitle = ko.pureComputed(function() {
        var jid = this.selectedJobTitleID(),
            jp = this.jobProfile();
        if (!jid || !jp) return null;
        var found = null;
        jp.some(function(jobTitle) {
            if (jobTitle.jobTitleID() === jid) {
                found = jobTitle;
                return true;
            }
        });
        return found;
    }, this);
    
    this.backgroundCheckLabel = ko.pureComputed(function() {
        var v = this.backgroundCheckPassed();
        if (v === true) return 'OK';
        else if (v === false) return 'FAILED';
        else return '';
    }, this);
}

module.exports = PublicUser;

},{"./Model":113,"./PublicUserJobTitle":120,"./PublicUserProfile":121,"./PublicUserRating":122,"./PublicUserVerificationsSummary":124,"knockout":false}],120:[function(require,module,exports){
/**
    PublicUserJobTitle model, relationship between an user and a
    job title and the main data attached to that relation for
    public access (internal fields avoided) and additional
    useful job title info (shortcut to job title names for convenience).
    
    The model has optional properties that link
    to other model information related to a specific jobTitle
    for convenience when querying a wider set of information
    and keep it organized under this model instances.
**/
'use strict';

var Model = require('./Model'),
    PublicUserRating = require('./PublicUserRating'),
    PublicUserVerificationsSummary = require('./PublicUserVerificationsSummary');

function PublicUserJobTitle(values) {
    
    Model(this);
    
    this.model.defProperties({
        userID: 0,
        jobTitleID: 0,
        intro: null,
        cancellationPolicyID: 0,
        instantBooking: false,
        jobTitleSingularName: '',
        jobTitlePluralName: '',
        
        rating: { Model: PublicUserRating },
        verificationsSummary: { Model: PublicUserVerificationsSummary },
    }, values);

    this.model.defID(['userID', 'jobTitleID']);
}

module.exports = PublicUserJobTitle;

},{"./Model":113,"./PublicUserRating":122,"./PublicUserVerificationsSummary":124}],121:[function(require,module,exports){
/**
    Public information from a user.
**/
'use strict';

var Model = require('./Model'),
    ko = require('knockout');

function PublicUserProfile(values) {
    
    Model(this);
    
    this.model.defProperties({
        userID: 0,
        firstName: 0,
        lastName: 0,
        secondLastName: 0,
        businessName: 0,
        publicBio: 0,
        serviceProfessionalProfileUrlSlug: null,
        serviceProfessionalWebsiteUrl: null,
        photoUrl: null,
        email: null,
        phone: null,
        isServiceProfessional: false,
        isClient: false,
        updatedDate: null
    }, values);
    
    this.fullName = ko.pureComputed(function() {
        var nameParts = [this.firstName()];
        if (this.lastName())
            nameParts.push(this.lastName());
        if (this.secondLastName())
            nameParts.push(this.secondLastName);
        
        return nameParts.join(' ');
    }, this);
}

module.exports = PublicUserProfile;

},{"./Model":113,"knockout":false}],122:[function(require,module,exports){
/**
    Rating values for user, as user, client. service professional
    or job title specific.
**/
'use strict';

var Model = require('./Model');

function PublicUserRating(values) {
    
    Model(this);
    
    this.model.defProperties({
        rating1: 0,
        rating2: 0,
        rating3: 0,
        ratingAverage: 0,
        totalRatings: 0,
        serviceHours: 0,
        lastRatingDate: null
    }, values);
}

module.exports = PublicUserRating;

},{"./Model":113}],123:[function(require,module,exports){
/**
    Number of verifications for the user, as user, client, service professional
    or job title specific, per group of verifications
**/
'use strict';

var Model = require('./Model');

function PublicUserVerificationsGroup(values) {
    
    Model(this);
    
    this.model.defProperties({
        verificationsCount: 0,
        groupName: '',
        groupID: ''
    }, values);
}

module.exports = PublicUserVerificationsGroup;

},{"./Model":113}],124:[function(require,module,exports){
/**
    Number of verifications and grouped counts.
**/
'use strict';

var Model = require('./Model'),
    PublicUserVerificationsGroup = require('./PublicUserVerificationsGroup');

function PublicUserVerificationsSummary(values) {
    
    Model(this);
    
    this.model.defProperties({
        total: 0,
        groups: PublicUserVerificationsGroup
    }, values);
}

module.exports = PublicUserVerificationsSummary;

},{"./Model":113,"./PublicUserVerificationsGroup":123}],125:[function(require,module,exports){
/**
    SchedulingPreferences model.
 **/
'use strict';

var Model = require('./Model');

function SchedulingPreferences(values) {
    
    Model(this);

    this.model.defProperties({
        advanceTime: 24, // Hours
        betweenTime: 0, // Hours
        incrementsSizeInMinutes: 15
    }, values);
}

module.exports = SchedulingPreferences;

},{"./Model":113}],126:[function(require,module,exports){
/**
    ServiceProfessionalService model: manages an individual
    service from the user and a specific job title.
**/
'use strict';

var Model = require('./Model'),
    ko = require('knockout'),
    numeral = require('numeral');

function ServiceProfessionalService(values) {
    
    Model(this);
    
    this.model.defProperties({
        serviceProfessionalServiceID: 0,
        serviceProfessionalUserID: 0,
        jobTitleID: 0,
        pricingTypeID: 0,
        name: '',
        description: null,
        price: null,
        serviceDurationMinutes: null,
        firstTimeClientsOnly: false,
        numberOfSessions: 1,
        priceRate: null,
        priceRateUnit: 'hour',
        // Special property, not in source data just only an explicit
        // way to avoid validation of priceRate if not explicit value set
        noPriceRate: false,
        isPhone: false,
        // Array of integers, IDs of serviceAttributes
        serviceAttributes: [],
        createdDate: null,
        updatedDate: null
    }, values);
    
    this.model.defID(['serviceProfessionalServiceID']);
    
    // One way effect: set priceRate to null when setting on noPriceRate
    // But nothing on off and no other relations to avoid bad side effects.
    this.noPriceRate.subscribe(function(enabled) {
        if (enabled === true) {
            this.priceRate(null);
        }
    }, this);
    
    /**
        Ask for a refresh of the noPriceRate, that must be 'true' if the record exists and
        has no priceRate (to remember the previous value set by the user about noPriceRate).
        It ensure that the internal timestamp keep untouched.
        Cannot be automatic, so need to be called manually after a data load that does not
        want to reflect this change as a data change.
    **/
    this.refreshNoPriceRate = function refreshNoPriceRate() {
        // Not To State Price Rate: if is a saved pricing, mark the noPriceRate if price rate is
        // null or 0; cannot be done with a subscription on priceRate changes because will have
        // the bad side effect of auto mark noPriceRate on setting 0 on priceRate, breaking the
        // explicit purpose of the noPriceRate checkbox:
        if (this.serviceProfessionalServiceID() && (this.priceRate() |0) <= 0) {
            var ts = this.model.dataTimestamp();
            this.noPriceRate(true);
            // Set again timestamp so the model appear as untouched.
            this.model.dataTimestamp(ts);
        }
    };

    // Alternative edition of the serviceDurationMinutes fields:
    // Splited as hours and minutes
    var is = require('is_js');
    this.durationHoursPart = ko.pureComputed({
        read: function() {
            var fullMinutes = this.serviceDurationMinutes();
            
            if (is.not.number(fullMinutes))
                return null;

            return ((fullMinutes|0) / 60) |0;
        },
        write: function(hours) {
            var minutes = this.durationMinutesPart() |0;
            // Value comes from text
            hours = parseInt(hours, 10);
            if (is.not.number(hours))
                this.serviceDurationMinutes(null);
            else
                this.serviceDurationMinutes((hours|0) * 60 + minutes);
        },
        owner: this
    });
    this.durationMinutesPart = ko.pureComputed({
        read: function() {
            var fullMinutes = this.serviceDurationMinutes();

            if (is.not.number(fullMinutes))
                return null;

            return (fullMinutes|0) % 60;
        },
        write: function(minutes) {
            var hours = this.durationHoursPart() |0;
            // Value comes from text
            minutes = parseInt(minutes, 10);
            if (is.not.number(minutes))
                this.serviceDurationMinutes(null);
            else
                this.serviceDurationMinutes(hours * 60 + (minutes|0));
        },
        owner: this
    });
    
    
    /// Visual representation of several fields
    
    this.durationText = ko.pureComputed(function() {
        var minutes = this.serviceDurationMinutes() || 0;
        // TODO: l10n
        return minutes ? numeral(minutes).format('0,0') + ' minutes' : '';
    }, this);
    
    this.sessionsAndDuration = ko.pureComputed(function() {
        var sessions = this.numberOfSessions(),
            dur = this.durationText();
        if (sessions > 1)
            // TODO: l10n
            return sessions + ' sessions, ' + dur;
        else
            return dur;
    }, this);

    this.displayedPrice = ko.pureComputed(function() {
        var price = this.price(),
            rate = this.priceRate(),
            unit = this.priceRateUnit(),
            result = price || rate;
        // Formatting
        result = numeral(result).format('$0,0');
        // If is not price but rate, add unit
        if (!price && rate && unit) {
            result += '/' + unit;
        }
        return result;
    }, this);
}

module.exports = ServiceProfessionalService;

},{"./Model":113,"is_js":false,"knockout":false,"numeral":false}],127:[function(require,module,exports){
/**
    SimplifiedWeeklySchedule model.
    
    Its 'simplified' because it provides an API
    for simple time range per week day,
    a pair of from-to times.
    Good for current simple UI.
    
    The original weekly schedule defines the schedule
    in 15 minutes slots, so multiple time ranges can
    exists per week day, just marking each slot
    as available or unavailable. The AppModel
    will fill this model instances properly making
    any conversion from/to the source data.
 **/
'use strict';

var ko = require('knockout'),
    moment = require('moment-timezone'),
    Model = require('./Model'),
    WeekDaySchedule = require('./WeekDaySchedule');

/**
    It attemps to locate local/system timezone,
    getting the first IANA tzid that matches 
    local setup.
**/
function detectLocalTimezone() {
    var year = new Date().getFullYear(),
        winter = new Date(year, 1, 1),
        winOff = winter.getTimezoneOffset(),
        summer = new Date(year, 6, 1),
        sumOff = summer.getTimezoneOffset(),
        found = null;

    moment.tz.names().some(function(tz) {
        var zone = moment.tz.zone(tz);
        if (zone.offset(winter) === winOff &&
            zone.offset(summer) === sumOff) {
           found = zone;
           return true;
        }
    });

    return found;
}

/**
    Main model defining the week schedule
    per week date, or just set all days times
    as available with a single flag.
**/
function SimplifiedWeeklySchedule(values) {
    
    Model(this);

    this.model.defProperties({
        sunday: new WeekDaySchedule(),
        monday: new WeekDaySchedule(),
        tuesday: new WeekDaySchedule(),
        wednesday: new WeekDaySchedule(),
        thursday: new WeekDaySchedule(),
        friday: new WeekDaySchedule(),
        saturday: new WeekDaySchedule(),
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
    
    this.timeZoneDisplayName = ko.computed(function() {
        var tzid = this.timeZone(),
            tz = moment.tz(tzid),
            name = tz.tz();
        
        // !moment.tz.zoneExists, just check the name is enough
        if (!name) {
            var localtz = detectLocalTimezone();
            if (localtz)
                tz = moment.tz(localtz.name);
            if (tz)
                name = tz.tz();
            if (name)
                setTimeout(function() {
                    this.timeZone(name);
                }.bind(this), 1);
        }

        if (name)
            return name; // + ' (' + tz.zoneAbbr() + ')';
        else
            return '';
    }, this);
}

module.exports = SimplifiedWeeklySchedule;

},{"./Model":113,"./WeekDaySchedule":135,"knockout":false,"moment-timezone":false}],128:[function(require,module,exports){
/** Thread model.

    Describes a thread of messages.
 **/
'use strict';

var Model = require('./Model'),
    Message = require('./Message');

function Thread(values) {
    
    Model(this);

    this.model.defProperties({
        threadID: 0,
        
        clientUserID: null,
        serviceProfessionalUserID: null,
        jobTitleID: null,
        statusID: null,
        subject: null,
        
        messages: {
            isArray: true,
            Model: Message
        },
        
        createdDate: null,
        updatedDate: null        
    }, values);
}

module.exports = Thread;

},{"./Message":111,"./Model":113}],129:[function(require,module,exports){
/** UpcomingBookingsSummary model **/
'use strict';

var ko = require('knockout'),
    Model = require('./Model'),
    BookingSummary = require('./BookingSummary');

function UpcomingBookingsSummary() {

    Model(this);
    
    // TODO: define today, tomorrow and nextWeek as
    // properties with default Model?
    // Review how update happens on home/dashboard, it can helps
    // to simplify that

    this.today = new BookingSummary({
        concept: 'more today',
        timeFormat: ' [ending @] h:mma'
    });
    this.tomorrow = new BookingSummary({
        concept: 'tomorrow',
        timeFormat: ' [starting @] h:mma'
    });
    this.nextWeek = new BookingSummary({
        concept: 'next week',
        timeFormat: null
    });
    
    this.items = ko.pureComputed(function() {
        var items = [];
        
        //if (this.today.quantity())
        items.push(this.today);
        //if (this.tomorrow.quantity())
        items.push(this.tomorrow);
        //if (this.nextWeek.quantity())
        items.push(this.nextWeek);

        return items;
    }, this);
    
}

module.exports = UpcomingBookingsSummary;

},{"./BookingSummary":98,"./Model":113,"knockout":false}],130:[function(require,module,exports){
/** User model **/
'use strict';

var ko = require('knockout'),
    Model = require('./Model');

// Enum UserType
var UserType = {
    none: 0,
    anonymous: 1,
    client: 2,
    serviceProfessional: 4,
    // All Members (member-only:8) are service professionals too: 4+8
    member: 12,
    admin: 16,
    // All users except anonymous and system:
    loggedUser: 30,
    // All users except system,
    user: 31,
    system: 32
};

function User(values) {
    
    Model(this);
    
    this.model.defProperties({
        userID: 0,
        email: '',
        
        firstName: '',
        lastName: '',
        secondLastName: '',
        businessName: '',
        
        alternativeEmail: '',
        phone: '',
        canReceiveSms: '',
        birthMonthDay: null,
        birthMonth: null,
        
        isServiceProfessional: false,
        isClient: false,
        isMember: false,
        isAdmin: false,
        
        photoUrl: null,

        onboardingStep: null,
        accountStatusID: 0,
        createdDate: null,
        updatedDate: null
    }, values);

    this.fullName = ko.pureComputed(function() {
        var nameParts = [this.firstName()];
        if (this.lastName())
            nameParts.push(this.lastName());
        if (this.secondLastName())
            nameParts.push(this.secondLastName);
        
        return nameParts.join(' ');
    }, this);
    
    this.birthDay = ko.pureComputed(function() {
        if (this.birthMonthDay() &&
            this.birthMonth()) {
            
            // TODO i10n
            return this.birthMonth() + '/' + this.birthMonthDay();
        }
        else {
            return null;
        }
    }, this);
    
    this.userType = ko.pureComputed({
        read: function() {
            var c = this.isClient(),
                p = this.isServiceProfessional(),
                a = this.isAdmin();
            
            var userType = 0;
            
            if (this.isAnonymous())
                userType = userType | UserType.anonymous;
            if (c)
                userType = userType | UserType.client;
            if (p)
                userType = userType | UserType.serviceProfessional;
            if (a)
                userType = userType | UserType.admin;
            
            return userType;
        },
        /* NOTE: Not required for now:
        write: function(v) {
        },*/
        owner: this
    });
    
    this.isAnonymous = ko.pureComputed(function(){
        return this.userID() < 1;
    }, this);
    
    /**
        It matches a UserType from the enumeration?
    **/
    this.isUserType = function isUserType(type) {
        return (this.userType() & type);
    }.bind(this);
}

module.exports = User;

User.UserType = UserType;

/* Creatint an anonymous user with some pressets */
User.newAnonymous = function newAnonymous() {
    return new User({
        userID: 0,
        email: '',
        firstName: '',
        onboardingStep: null
    });
};

},{"./Model":113,"knockout":false}],131:[function(require,module,exports){
// TODO Incomplete Model for UI mockup
'use strict';

var Model = require('./Model');

function UserEducation(values) {
    Model(this);
    
    this.model.defProperties({
        educationID: 0,
        school: '',
        degree: '',
        field: '',
        startYear: null,
        endYear: null
    }, values);
}

module.exports = UserEducation;

},{"./Model":113}],132:[function(require,module,exports){
/**
    UserJobTitle model, relationship between an user and a
    job title and the main data attached to that relation.
**/
'use strict';

var Model = require('./Model');

function UserJobTitle(values) {
    
    Model(this);
    
    this.model.defProperties({
        userID: 0,
        jobTitleID: 0,
        intro: null,
        statusID: 0,
        cancellationPolicyID: 0,
        instantBooking: false,
        createdDate: null,
        updatedDate: null
    }, values);
    
    this.model.defID(['userID', 'jobTitleID']);
}

module.exports = UserJobTitle;

},{"./Model":113}],133:[function(require,module,exports){
/** UserLicenseCertification model **/
'use strict';

var Model = require('./Model'),
    ko = require('knockout');

function UserLicenseCertification(values) {

    Model(this);
    
    this.model.defProperties({
        userID: 0,
        jobTitleID: 0,
        statusID: 0,
        licenseCertificationID: 0,
        licenseCertificationUrl: '',
        licenseCertificationNumber: 0,
        licenseCertificationStatus: 0,
        expirationDate: null,
        issueDate: null,
        countryID: 0,
        stateProvinceID: 0,
        countyID: 0,
        city: '',
        firstName: null,
        lastName: null,
        middleInitial: null,
        secondLastName: null,
        businessName: null,
        actions: null,
        comments: null,
        verifiedBy: null,
        lastVerifiedDate: null,
        createdDate: null, // Autofilled by server
        updatedDate: null, // Autofilled by server
    }, values);
    
    this.model.defID(['userID', 'jobTitleID', 'licenseCertificationID']);
    
    this.countyName = ko.pureComputed(function() {
        // TODO Implement look-up of counties, a hardly cached version must exists ever
        return 'Alameda';
    }, this);
    this.stateProvinceName = ko.pureComputed(function() {
        // TODO Implement look-up, a hardly cached version must exists ever
        return 'California';
    }, this);
    this.stateProvinceCode = ko.pureComputed(function() {
        // TODO Implement look-up, a hardly cached version must exists ever
        return 'CA';
    }, this);
}

module.exports = UserLicenseCertification;

},{"./Model":113,"knockout":false}],134:[function(require,module,exports){
/**
    Enumeration of possible values for VocElementIDs, 
    used to identify sections/components when sending Feedback.
**/
'use strict';

module.exports = {
    general: 0,
    nps: 1,
    signup: 2,
    calendar: 3,
    inbox: 4,
    scheduling: 5,
    cms: 6,
    payments: 7,
    performance: 8,
    marketplaceProfile: 9,
    mobileFriendly: 10, // easy of using mobile/tablet app/web
    desktopFriendly: 11, // easy of using desktop website
    coopBenefits: 12,
    coopFee: 13,
    senseOfCommunity: 14,
    clientServiceAgents: 15,
    helpPages: 16
};

},{}],135:[function(require,module,exports){
/**
    Submodel that is used on the SimplifiedWeeklySchedule
    defining a single week day availability range.
    A full day must have values from:0 to:1440, never
    both as zero because thats considered as not available,
    so is better to use the isAllDay property.
**/
'use strict';

var Model = require('./Model'),
    moment = require('moment'),
    ko = require('knockout');

function WeekDaySchedule(values) {

    Model(this);

    // NOTE: from-to properies as numbers
    // for the minute of the day, from 0 (00:00) to 1439 (23:59)
    this.model.defProperties({
        from: 0,
        to: 0
    }, values);
    
    /**
        It allows to know if this week day is 
        enabled for weekly schedule, just it
        has from-to times.
        It allows to be set as true putting
        a default range (9a-5p) or false 
        setting both as 0p.
        
        Since on write two observables are being modified, and
        both are used in the read, a single change to the 
        value will trigger two notifications; to avoid that,
        the observable is rate limited with an inmediate value,
        son only one notification is received.
    **/
    this.isEnabled = ko.computed({
        read: function() {
            return (
                typeof(this.from()) === 'number' &&
                typeof(this.to()) === 'number' &&
                this.from() < this.to()
            );
        },
        write: function(val) {
            if (val === true) {
                // Default range 9a - 5p
                this.fromHour(9);
                this.toHour(17);
            }
            else {
                this.toHour(0);
                this.from(0);
            }
        },
        owner: this
    }).extend({ rateLimit: 0 });
    
    this.isAllDay = ko.computed({
        read: function() {
            return  (
                this.from() === 0 &&
                this.to() === 1440
            );
        },
        write: function(/*val*/) {
            this.from(0);
            this.to(1440);
        },
        owner: this
    }).extend({ rateLimit: 0 });
    
    // Additional interfaces to get/set the from/to times
    // by using a different data unit or format.
    
    // Integer, rounded-up, number of hours
    this.fromHour = ko.computed({
        read: function() {
            return Math.floor(this.from() / 60);
        },
        write: function(hours) {
            this.from((hours * 60) |0);
        },
        owner: this
    });
    this.toHour = ko.computed({
        read: function() {
            return Math.ceil(this.to() / 60);
        },
        write: function(hours) {
            this.to((hours * 60) |0);
        },
        owner: this
    });
    
    // String, time format ('hh:mm')
    this.fromTime = ko.computed({
        read: function() {
            return minutesToTimeString(this.from() |0);
        },
        write: function(time) {
            this.from(timeStringToMinutes(time));
        },
        owner: this
    });
    this.toTime = ko.computed({
        read: function() {
            return minutesToTimeString(this.to() |0);
        },
        write: function(time) {
            this.to(timeStringToMinutes(time));
        },
        owner: this
    });
}

module.exports = WeekDaySchedule;

//// UTILS,
// TODO Organize or externalize. some copied form appmodel..
/**
    internal utility function 'to string with two digits almost'
**/
function twoDigits(n) {
    return Math.floor(n / 10) + '' + n % 10;
}

/**
    Convert a number of minutes
    in a string like: 00:00:00 (hours:minutes:seconds)
**/
function minutesToTimeString(minutes) {
    var d = moment.duration(minutes, 'minutes'),
        h = d.hours(),
        m = d.minutes(),
        s = d.seconds();
    
    return (
        twoDigits(h) + ':' +
        twoDigits(m) + ':' +
        twoDigits(s)
    );
}

function timeStringToMinutes(time) {
    return moment.duration(time).asMinutes() |0;
}
},{"./Model":113,"knockout":false,"moment":false}],136:[function(require,module,exports){
/**
    Utility to help track the state of cached data
    managing time, preference and if must be revalidated
    or not.
    
    Its just manages meta data, but not the data to be cached.
**/
'use strict';

var moment = require('moment');

function CacheControl(options) {
    
    options = options || {};

    // A number of milliseconds or
    // An object with desired units and amount, all optional,
    // any combination with almost one specified, sample:
    // { years: 0, months: 0, weeks: 0, 
    //   days: 0, hours: 0, minutes: 0, seconds: 0, milliseconds: 0 }
    this.ttl = moment.duration(options.ttl).asMilliseconds();
    this.latest = options.latest || null;

    this.mustRevalidate = function mustRevalidate() {
        var tdiff = this.latest && new Date() - this.latest || Number.POSITIVE_INFINITY;
        return tdiff > this.ttl;
    };
    
    this.touch = function touch() {
        this.latest = new Date();
    };
}

module.exports = CacheControl;

},{"moment":false}],137:[function(require,module,exports){
/**
    Keep an in memory cache of data organized by date as key-value.
    
    IMPORTANT: Date without time, in ISO format YYYY-MM-DD, using
    local timezone. A change of timezone displayed to the user must
    invalidate the cache (through .clear()).
**/
'use strict';

var moment = require('moment'),
    CacheControl = require('./CacheControl');

module.exports = function DateCache(settings) {
    
    this.Model = settings && settings.Model || null;
    this.ttl = settings && settings.ttl || { minutes: 1 };
    
    this.byDate = {};
    
    this.clear = function() {
        this.byDate = {};
    };
    
    this.getSingle = function(date) {
        var dateKey = date;
        if (date instanceof Date)
            dateKey = moment(date).format('YYYY-MM-DD');
        
        if (this.byDate.hasOwnProperty(dateKey) &&
            !this.byDate[dateKey].control.mustRevalidate()) {

            return this.byDate[dateKey].data;
        }

        return null;
    };
    
    this.remove = function(date) {
        var dateKey = date;
        if (date instanceof Date)
            dateKey = moment(date).format('YYYY-MM-DD');
        delete this.byDate[dateKey];
    };
    
    this.get = function(start, end) {

        var date = new Date(start);
        var resultsPerDate = {},
            holes = [],
            minRequest = null,
            maxRequest = null;

        while (date <= end) {
            var dateKey = moment(date).format('YYYY-MM-DD');
            
            if (this.byDate.hasOwnProperty(dateKey) &&
                !this.byDate[dateKey].control.mustRevalidate()) {
                resultsPerDate[dateKey] = this.byDate[dateKey].data;
            }
            else {
                holes.push(new Date(date));
            }
            // Next date:
            date.setDate(date.getDate() + 1);
        }
        
        // Sort holes
        holes.sort(function(a, b) { return a === b ? 0 : a < b ? -1 : 1; });
        // min hole is the first one
        minRequest = holes.length ? holes[0] : null;
        // max hole is the last one
        maxRequest = holes.length ? holes[holes.length - 1] : null;
        
        return {
            byDate: resultsPerDate,
            holes: holes,
            minHole: minRequest,
            maxHole: maxRequest
        };
    };
    
    this.set = function(date, data) {
        // Date formatting. Provide a formatted date as string is valid too
        var dateKey = date;
        if (date instanceof Date)
            dateKey = moment(date).format('YYYY-MM-DD');
        
        // Update cache
        var c = this.byDate[dateKey];
        if (c && c.data) {
            if (this.Model)
                c.data.model.updateWith(data);
            else
                c.data = data;
        }
        else {
            c = {
                data: this.Model ? new this.Model(data) : data,
                control: new CacheControl({ ttl: this.ttl })
            };
            this.byDate[dateKey] = c;
        }
        c.control.touch();
        return c;
    };
};

},{"./CacheControl":136,"moment":false}],138:[function(require,module,exports){
/**
    New Function method: '_delayed'.
    It returns a new function, wrapping the original one,
    that once its call will delay the execution the given milliseconds,
    using a setTimeout.
    The new function returns 'undefined' since it has not the result,
    because of that is only suitable with return-free functions 
    like event handlers.
    
    Why: sometimes, the handler for an event needs to be executed
    after a delay instead of instantly.
**/
Function.prototype._delayed = function delayed(milliseconds) {
    var fn = this;
    return function() {
        var context = this,
            args = arguments;
        setTimeout(function () {
            fn.apply(context, args);
        }, milliseconds);
    };
};

},{}],139:[function(require,module,exports){
/**
    Extending the Function class with an inherits method.
    
    The initial low dash is to mark it as no-standard.
**/
Function.prototype._inherits = function _inherits(superCtor) {
    this.prototype = Object.create(superCtor.prototype, {
        constructor: {
            value: this,
            enumerable: false,
            writable: true,
            configurable: true
        }
    });
};

},{}],140:[function(require,module,exports){
/**
    Fix Function#name on browsers that do not support it (IE9+):
    
    http://stackoverflow.com/a/17056530/1622346    
**/
'use strict';
/*jshint -W068 */
if (!(function f() {}).name) {
    Object.defineProperty(Function.prototype, 'name', {
        get: function() {
            var name = this.toString().match(/^\s*function\s*(\S*)\s*\(/)[1];
            // For better performance only parse once, and then cache the
            // result through a new accessor for repeated access.
            Object.defineProperty(this, 'name', { value: name });
            return name;
        }
    });
}
},{}],141:[function(require,module,exports){
/**
    GroupListRemoteModel
    Utility class for common code for a data list entity from a remote source,
    with local copy and cache, where the full list is managed per groups,
    without paging/cursor, all the group data on each operation.
**/
'use strict';

var ko = require('knockout'),
    IndexedGroupListCache = require('./IndexedGroupListCache');

function required(val, msg) {
    if (val === null || typeof(val) === 'undefined') throw new Error(msg || 'Required parameter');
    else return val;
}

function GroupListRemoteModel(settings) {
    /*jshint maxstatements:28*/
    
    settings = settings || {};
    settings.listTtl = required(settings.listTtl, 'listTtl is required');
    settings.groupIdField = required(settings.groupIdField, 'groupIdField is required');
    settings.itemIdField = required(settings.itemIdField, 'itemIdField is required');
    // For now, optional model
    settings.Model = settings.Model || null;
    // Required for API additions
    this.settings = settings;

    this.state = {
        isLoading: ko.observable(false),
        isSyncing: ko.observable(false),
        isSaving: ko.observable(false),
        isDeleting: ko.observable(false)
    };

    var cache = new IndexedGroupListCache({
        listTtl: settings.listTtl,
        groupIdField: settings.groupIdField,
        itemIdField: settings.itemIdField
    });
    
    this.clearCache = cache.clearCache;

    this.state.isLocked = ko.pureComputed(function() {
        return this.isLoading() || this.isSaving() || this.isDeleting();
    }, this.state);

    /** Data Stores Management: implementation must be replaced, with custom code or using
        the helpers added to the class (see addXxSupport prototype methods).
    **/
    function notImplemented() { throw new Error('Not Implemented'); }
    this.fetchGroupFromLocal = notImplemented;
    this.fetchGroupFromRemote = notImplemented;
    this.pushGroupToLocal = notImplemented;
    this.pushGroupToRemote = notImplemented;
    this.removeItemFromRemote = notImplemented;

    /** API definition **/
    var api = this;

    api.getList = function getList(groupID) {
        var cacheEntry = cache.getGroupCache(groupID);

        if (cacheEntry.control.mustRevalidate()) {
            // No cache data, is first load, try from local
            if (!cacheEntry.list) {
                api.state.isLoading(true);
                // From local
                return this.fetchGroupFromLocal(groupID)
                .then(function(data) {
                    // launch remote for sync
                    api.state.isSyncing(true);
                    var remotePromise = this.fetchGroupFromRemote(groupID)
                    .then(function(serverData) {
                        cache.setGroupCache(groupID, serverData);
                        this.pushGroupToLocal(groupID, serverData);
                        api.state.isSyncing(false);
                        return serverData;
                    }.bind(this));
                    // Remote fallback: If no local, wait for remote
                    return data ? data : remotePromise;
                }.bind(this))
                .then(function(data) {
                    // Ever a list, even if empty
                    data = data || [];
                    cache.setGroupCache(groupID, data);
                    this.pushGroupToLocal(groupID, data);
                    api.state.isLoading(false);

                    return data;
                }.bind(this))
                .catch(function(err) {
                    api.state.isLoading(false);
                    api.state.isSyncing(false);
                    // rethrow error
                    return err;
                });
            } else {
                api.state.isSyncing(true);
                // From remote
                return this.fetchGroupFromRemote(groupID)
                .then(function(data) {
                    // Ever a list, even if empty
                    data = data || [];
                    cache.setGroupCache(groupID, data);
                    this.pushGroupToLocal(groupID, data);
                    api.state.isLoading(false);
                    api.state.isSyncing(false);

                    return data;
                }.bind(this))
                .catch(function(err) {
                    api.state.isLoading(false);
                    api.state.isSyncing(false);
                    // rethrow error
                    return err;
                });
            }
        }
        else {
            // From cache
            return Promise.resolve(cacheEntry.list);
        }
    };
    
    api.getItem = function getItem(groupID, itemID) {
        // IMPORTANT: To simplify, load all the list (is a short list)
        // and look from its cached index
        // TODO Implement item server look-up. Be careful with cache update,
        // list sorting and state flags.
        return api.getList(groupID)
        .then(function() {
            // Get from cached index
            var cacheItem = cache.getItemCache(groupID, itemID);

            // TODO: Enhance on future with actual look-up by API itemID
            // if not cached, throwing not found from the server (just to avoid
            // minor cases when a new item is not still in the cache if linked
            // from other app data). And keep updated list cache with that
            // items lookup
            if (!cacheItem) {
                console.warn('GroupListRemoteModel Not found', groupID, itemID, settings.Model);
                throw new Error('Not Found');
            }
            return cacheItem.item;
        });
    };

    /**
        Save an item in cache, local and remote.
        Can be new or updated.
        The IDs goes with all the other data, being
        groupID required, itemID required for updates
        but falsy for insertions.
        @param data:object Plain object
    **/
    api.setItem = function setItem(data) {
        api.state.isSaving(true);
        // Send to remote first
        return this.pushGroupToRemote(data)
        .then(function(serverData) {
            // Success! update local copy with returned data
            // IMPORTANT: to use server data here so we get values set
            // by the server, as updates dates and itemID when creating
            // a new item.
            if (serverData) {
                var groupID = serverData[settings.groupIdField];
                // Save in cache
                cache.setItemCache(groupID, serverData[settings.itemIdField], serverData);
                // Save in local storage
                // In local need to be saved all the grouped data, not just
                // the item; since we have the cache list updated, use that
                // full list to save local
                this.pushGroupToLocal(groupID, cache.getGroupCache(groupID).list);
            }
            api.state.isSaving(false);

            return serverData;
        }.bind(this))
        .catch(function(err) {
            api.state.isSaving(false);
            // Rethrow error
            return err;
        });
    };
    
    api.delItem = function delItem(groupID, itemID) {
        
        api.state.isDeleting(true);
        
        // Remove in remote first
        return this.removeItemFromRemote(groupID, itemID)
        .then(function(removedData) {
            // Update cache
            cache.delItemCache(groupID, itemID);
            // Save in local storage
            // In local need to be saved all the grouped data;
            // since we have the cache list updated, use that
            // full list to save local
            this.pushGroupToLocal(groupID, cache.getGroupCache(groupID).list);
            
            api.state.isDeleting(false);
            
            return removedData;
        }.bind(this))
        .catch(function(err) {
            api.state.isDeleting(false);
            // Rethrow error
            return err;
        });
    };
    
    /** Some Utils **/
    
    /**
        Generates and returns an observable inmediately,
        with the cached value or undefined,
        launching an item load that will update the observable
        on ready if there is no cached value.
        A method 'sync' is added to the observable so can be requested
        a data sync/reload on demand.
    **/
    api.getObservableItem = function getObservableItem(groupID, itemID, asModel) {
        // Get first value
        var firstValue = cache.getItemCache(groupID, itemID);
        firstValue = firstValue && firstValue.item || undefined;
        var obs = ko.observable(asModel ? api.asModel(firstValue) : firstValue);
        // Create method 'sync'
        obs.sync = function syncObservableItem() {
            return api.getItem(groupID, itemID)
            .then(function(item) {
                if (asModel)
                    obs().model.updateWith(item);
                else
                    obs(item);
            });
        };
        // First load if no cached value
        if (!firstValue)
            obs.sync();
        // Return
        return obs;
    };
    
    api.asModel = function asModel(object) {
        var Model = this.settings.Model;
        // if is an array, return a list of models
        if (Array.isArray(object)) {
            return object.map(function(item) {
                return new Model(item);
            });
        }
        else {
            return new Model(object);
        }
    };
    
    api.getItemModel = function getItemModel(groupID, itemID) {
        return api.getItem(groupID, itemID)
        .then(function(data) {
            return data ? api.asModel(data) : null;
        });
    };
    
    var ModelVersion = require('../utils/ModelVersion');
    api.getItemVersion = function getItemVersion(groupID, itemID) {
        return api.getItemModel(groupID, itemID)
        .then(function(model) {
            return model ? new ModelVersion(model) : null;
        });
    };
    
    api.newItemVersion = function newItemVersion(values) {
        // New original and version for the model
        var version = new ModelVersion(new this.settings.Model(values));
        // To be sure that the version appear as something 'new', unsaved,
        // we update its timestamp to be different to the original.
        version.version.model.touch();
        return version;
    };
}

module.exports = GroupListRemoteModel;

GroupListRemoteModel.prototype.addLocalforageSupport = function addLocalforageSupport(baseName) {
    var localforage = require('localforage');

    this.fetchGroupFromLocal = function fetchFromLocal(groupID) {
        return localforage.getItem(baseName + groupID);
    };
    this.pushGroupToLocal = function pushToLocal(groupID, data) {
        return localforage.setItem(baseName + groupID, data);
    };
};

GroupListRemoteModel.prototype.addRestSupport = function addRestSupport(restClient, baseUrl) {
    
    this.fetchGroupFromRemote = function fetchFromRemote(groupID) {
        return restClient.get(baseUrl + groupID);
    };
    this.pushGroupToRemote = function pushToRemote(data) {

        var groupID = data[this.settings.groupIdField],
            itemID = data[this.settings.itemIdField],
            method = data[this.settings.itemIdField] ? 'put' : 'post';

        var url = baseUrl + groupID + (
            itemID ? '/' + itemID : ''
        );
        return restClient[method](url, data);
    };
    this.removeItemFromRemote = function removeItemFromRemote(groupID, itemID) {
        return restClient.delete(baseUrl + groupID + '/' + itemID);
    };
};

},{"../utils/ModelVersion":145,"./IndexedGroupListCache":142,"knockout":false,"localforage":false}],142:[function(require,module,exports){
/**
    IndexedGroupListCache manages a in-memory cache for a list
    of objects, grouped by a field and with indexed access to groups
    and items, with cache control.
    
    Settings object as unique parameter:
    listTtl: ttl type constructor. TimeToLife for each group list cache.
    FUTURE: itemTtl: ttl type constructor. TimeToLife for each item cache.
    ttl: ttl type constructor. TimeToLife to use for list and item cache if there is no a more explicit one
    groupIdField: string Name of the field used to group objects
    itemIdField: string Name of the field used to uniquely identify each item
    FUTURE: Model: constructor of type Model.
    
    Note: 'ttl type constructor' can be a number of milliseconds or a value to pass to moment.duration constructor (momentjs module).
**/
'use strict';

var CacheControl = require('./CacheControl');

function createIndex(list, byField) {
    var index = {};
    
    list.forEach(function(item, itemIndex) {
        index[item[byField]] = {
            index: itemIndex,
            item: item
            // Direct referenc, could be a property too auto resolving as
            // something like get item() { return list[itemIndex[item[byField]]] || null; }
        };
    });

    return index;
}

function required(val, msg) {
    if (val === null || typeof(val) === 'undefined') throw new Error(msg || 'Required parameter');
    else return val;
}

function IndexedGroupListCache(settings) {
    
    settings = settings || {};
    settings.ttl = settings.ttl || 0;
    settings.listTtl = settings.listTtl || settings.ttl || 0;
    //FUTURE: settings.itemTtl = settings.itemTtl || settings.ttl || 0;
    settings.groupIdField = required(settings.groupIdField, 'groupIdField is required');
    settings.itemIdField = required(settings.itemIdField, 'itemIdField is required');
    //FUTURE: settings.Model = settings.Model || throw new Error('A Model is required');
    
    var cache = {/*
        groupIdField: {
            control: CacheControl,
            list: Array,
            index: {
                itemIdField: {
                    index: Integer (index in the list array),
                    item: Object (reference to the item object in the array)
                    // Maybe future: control: CacheControl per item
                },
                ..
            }
        },
        ..
    */};
    
    this.clearCache = function clearCache() {
        cache = {};
    };

    function newCacheEntry(list) {
        return {
            control: new CacheControl({ ttl: settings.listTtl }),
            list: list || null,
            index: list && createIndex(list, settings.itemIdField) || {}
        };
    }

    function setGroupCache(groupID, list) {
        var cacheEntry = cache[groupID];
        if (cacheEntry) {
            cacheEntry.list = list || [];
            cacheEntry.index = createIndex(list || [], settings.itemIdField);
        }
        else {
            cacheEntry = cache[groupID] = newCacheEntry(list);
        }
        cacheEntry.control.latest = new Date();
    }
    
    this.setGroupCache = setGroupCache;

    /**
        Get the cache entry for the Group
    **/
    function getGroupCache(groupID) {
        var cacheEntry = cache[groupID];
        return cacheEntry || newCacheEntry();
    }
    
    this.getGroupCache = getGroupCache;

    /**
        Get the cache entry from the Item
    **/
    function getItemCache(groupID, itemID) {
        var cacheEntry = cache[groupID];
        if (cacheEntry) {
            return cacheEntry.index[itemID] || null;
        }
        else {
            return null;
        }
    }
    
    this.getItemCache = getItemCache;

    function setItemCache(groupID, itemID, item) {
        var cacheEntry = cache[groupID] || newCacheEntry([]);
        
        // Loof for the entry, to update or insert a new one
        var itemEntry = cacheEntry.index[itemID];
        if (itemEntry) {
            // Update entry
            cacheEntry.list[itemEntry.index] = item;
            // Update reference in the index too (is not computed right now)
            itemEntry.item = item;
        }
        else {
            // Add to the list
            var itemIndex = cacheEntry.list.push(item) - 1;
            cacheEntry.index[itemID] = {
                index: itemIndex,
                item: item
            };
        }
    }
    
    this.setItemCache = setItemCache;

    function delItemCache(groupID, itemID) {
        var groupEntry = cache[groupID] || null;
        if (groupEntry) {
            var itemEntry = groupEntry.index[itemID];
            if (itemEntry) {
                // Update list removing the element in place, without holes
                groupEntry.list.splice(itemEntry.index, 1);
                // Update index by:
                // - Remove itemID entry
                delete groupEntry.index[itemID];
                // - Update every entry with an ID greater than the updated,
                // since they are now one position less in the updated list
                Object.keys(groupEntry.index).forEach(function(key) {
                    if (groupEntry.index[key].index > itemEntry.index)
                        groupEntry.index[key].index--;
                });
            }
        }
    }
    
    this.delItemCache = delItemCache;
    
    function delGroupCache(groupID) {
        var groupEntry = cache[groupID] || null;
        if (groupEntry) {
            // Delete the entry/property
            delete cache[groupID];
        }
    }
    
    this.delGroupCache = delGroupCache;
}

module.exports = IndexedGroupListCache;

},{"./CacheControl":136}],143:[function(require,module,exports){
/**
    IndexedListCache manages a in-memory cache for a list
    of objects, with indexed access to items
    and cache control.
    
    Settings object as unique parameter:
    listTtl: ttl type constructor. TimeToLife for each group list cache.
    FUTURE: itemTtl: ttl type constructor. TimeToLife for each item cache.
    ttl: ttl type constructor. TimeToLife to use for list and item cache if there is no a more explicit one
    itemIdField: string Name of the field used to uniquely identify each item
    Model: constructor of type Model.
    
    Note: 'ttl type constructor' can be a number of milliseconds or a value to pass to moment.duration constructor (momentjs module).
**/
'use strict';

var CacheControl = require('./CacheControl'),
    jsPropertiesTools = require('./jsPropertiesTools'),
    ko = require('knockout');

function createItemIndexEntry(list, itemIndex) {
    return {
        index: itemIndex,
        get item() {
            return list[this.index];
        }
    };
}

function createIndex(list, byField) {
    var index = {};
    
    list.forEach(function(item, itemIndex) {
        index[ko.unwrap(item[byField])] = createItemIndexEntry(list, itemIndex);
    });

    return index;
}

function required(val, msg) {
    if (val === null || typeof(val) === 'undefined') throw new Error(msg || 'Required parameter');
    else return val;
}

/**
    An item adapter receives the old and the new item data and returns
    the item to hold in the list. The returning object can be a reference
    to the same existent object (oldItem) that gets updated with the 
    new values (newItem), or just the newItem or any conversion over the
    raw newItem data.
    This allows to perform changes, add properties, or keep references,
    like creating observables, Models.
    
    This default implementation just returns the newItem.
**/
function defaultItemAdapter(oldItem, newItem) {
    return newItem;
}

function IndexedListCache(settings) {
    
    settings = settings || {};
    settings.ttl = settings.ttl || 0;
    settings.listTtl = settings.listTtl || settings.ttl || 0;
    //FUTURE: settings.itemTtl = settings.itemTtl || settings.ttl || 0;
    settings.itemIdField = required(settings.itemIdField, 'itemIdField is required');
    settings.itemAdapter = typeof(settings.itemAdapter) === 'function' ? settings.itemAdapter : defaultItemAdapter;

    // Internal flag to notify if the cache was not used still (no data set)
    // since its instantiation. On first setList will change to false and keep in that state.
    var unused = true;
    // Internal cache management
    var cache = {
        control: new CacheControl({ ttl: settings.listTtl }),
        list: ko.observableArray([]),
        index: {/*
            itemIdField: {
                index: Integer (index in the list array),
                item: Object (property referencing to the item object in the array by its index)
                // Maybe future: control: CacheControl per item
            },
            ..
        */}
    };
    
    this.clearCache = function clearCache() {
        cache.control.latest = null;
        cache.list([]);
        cache.index = {};
        unused = true;
    };

    /**
        Get the cache entry from the Item
    **/
    function getItemCache(itemID) {
        return cache.index[itemID] || null;
    }

    this.getItemCache = getItemCache;

    // Adapt a new item using the itemAdapter and getting the old reference.
    function adaptItem(newItem) {
        var oldItem = getItemCache(ko.unwrap(newItem[settings.itemIdField]));
        return settings.itemAdapter(oldItem, newItem);
    }
    
    // Adapt the each element in the list with the itemAdapter,
    // passing an old reference and the new item on each, and ensuring
    // to return ever an array, even if empty.
    function adaptList(list) {
        return (list || []).map(adaptItem);
    }

    function setList(list) {
        cache.list(adaptList(list));
        cache.index = createIndex(cache.list(), settings.itemIdField);
        cache.control.latest = new Date();
        unused = false;
    }

    // Public, read-only, access to cache info (objects are mutable, but almost the reference
    // cannot be broken; a change in the list instance updates the cache properly).
    jsPropertiesTools.defineGetter(this, 'control', function() { return cache.control; });
    jsPropertiesTools.defineGetter(this, 'list', function() { return cache.list; });
    jsPropertiesTools.defineSetter(this, 'list', function(list) { return setList(list); });
    jsPropertiesTools.defineGetter(this, 'index', function() { return cache.index; });
    jsPropertiesTools.defineGetter(this, 'unused', function() { return unused; });

    function setItemCache(item) {
        var itemID = ko.unwrap(item[settings.itemIdField]);
        // Look for the entry, to update or insert a new one
        var itemEntry = cache.index[itemID];
        if (itemEntry) {
            // Update entry
            cache.list()[itemEntry.index] = adaptItem(item);
        }
        else {
            // Add to the list
            var itemIndex = cache.list.push(adaptItem(item)) - 1;
            cache.index[itemID] = createItemIndexEntry(cache.list(), itemIndex);
        }
    }

    this.setItemCache = setItemCache;

    function delItemCache(itemID) {
        var itemEntry = cache.index[itemID];
        if (itemEntry) {
            // Update list removing the element in place, without holes
            cache.list.splice(itemEntry.index, 1);
            // Update index by:
            // - Remove itemID entry
            delete cache.index[itemID];
            // - Update every entry with an ID greater than the updated,
            // since they are now one position less in the updated list
            Object.keys(cache.index).forEach(function(key) {
                if (cache.index[key].index > itemEntry.index)
                    cache.index[key].index--;
            });
        }
    }
    
    this.delItemCache = delItemCache;
}

module.exports = IndexedListCache;

},{"./CacheControl":136,"./jsPropertiesTools":161,"knockout":false}],144:[function(require,module,exports){
/**
    ListRemoteModel
    Utility class for common code for a data list entity from a remote source,
    with local copy and cache, where the list is managed will all the data,
    without paging/cursor, with indexed access to each item by its ID.
    Is good for lists that keep small in the time.
    
    TODO To implement single item update mode, not full list each time, by set-up or method
**/
'use strict';

var ko = require('knockout'),
    IndexedListCache = require('./IndexedListCache');

function required(val, msg) {
    if (val === null || typeof(val) === 'undefined') throw new Error(msg || 'Required parameter');
    else return val;
}

function ListRemoteModel(settings) {
    /*jshint maxstatements:50*/

    settings = settings || {};
    settings.listTtl = required(settings.listTtl, 'listTtl is required');
    settings.itemIdField = required(settings.itemIdField, 'itemIdField is required');
    // Optional model
    settings.Model = settings.Model || null;
    // Required for API additions
    this.settings = settings;

    this.state = {
        isLoading: ko.observable(false),
        isSyncing: ko.observable(false),
        isSaving: ko.observable(false),
        isDeleting: ko.observable(false)
    };
    
    // Items are managed as plain object by default, but as permanent, updated
    // model instances if the Model class was specified.
    // This adapter is passed to the cache constructor too keep the in-memory
    // objects up to date with the correct structure.
    function itemAdapter(oldItem, newItem) {
        if (settings.Model) {
            // If the model item already exists, update with new values
            if (oldItem && oldItem instanceof settings.Model) {
                oldItem.model.updateWith(newItem);
                return oldItem;
            }
            else {
                // New created item.
                // If there was a previous, no-model, value, they are discarded
                // (that situation can only happens if there are irregular modifications
                // of the internal behavior).
                return new settings.Model(newItem);
            }
        }
        else {
            return newItem;
        }
    }
    
    var cache = new IndexedListCache({
        listTtl: settings.listTtl,
        itemIdField: settings.itemIdField,
        itemAdapter: itemAdapter
    });
    
    this.clearCache = cache.clearCache;

    this.state.isLocked = ko.pureComputed(function() {
        return this.isLoading() || this.isSaving() || this.isDeleting();
    }, this.state);

    /** Data Stores Management: implementation must be replaced, with custom code or using
        the helpers added to the class (see addXxSupport prototype methods).
    **/
    function notImplemented() { throw new Error('Not Implemented'); }
    this.fetchListFromLocal = notImplemented;
    this.fetchListFromRemote = notImplemented;
    this.pushListToLocal = notImplemented;
    this.pushListToRemote = notImplemented;
    this.removeItemFromRemote = notImplemented;
    
    /**
        Retrieves a plain array-objects from the cached list
    **/
    function getPlainCachedList() {
        var arr = cache.list();
        return arr.map(function(item) {
            if (item && settings.Model && item instanceof settings.Model) {
                return item.model.toPlainObject();
            }
            else {
                return item;
            }
        });
    }

    /** API definition **/
    var api = this;
    
    // Direct access to the observable cached list.
    api.list = cache.list;

    // Currently, just a wrapper for getList.
    api.sync = function sync() {
        return api.getList();
    };

    /**
        Promise based request to get the list (from cache, local or remote).
        It updates the observable list if new data is fetched.
        A general approach is to use the observable list and call the 'sync' method
        rather than wait this promise to finish ('sync' performs this load really).
    **/
    api.getList = function getList() {

        if (cache.control.mustRevalidate()) {
            // Cache still not used, then is first load, try load from local
            if (cache.unused) {
                api.state.isLoading(true);
                // From local
                return this.fetchListFromLocal()
                .then(function(data) {
                    // launch remote for sync
                    api.state.isSyncing(true);
                    var remotePromise = this.fetchListFromRemote()
                    .then(function(serverData) {
                        cache.list = serverData;
                        this.pushListToLocal(serverData);
                        api.state.isSyncing(false);
                        return serverData;
                    }.bind(this))
                    .catch(function(err) {
                        // If there was local data, catch error and
                        // stop sync since this promise will not
                        // be available to any consumer
                        if (data) {
                            api.state.isSyncing(false);
                            // Log to console
                            console.error('ListRemoteModel: remote synchronization failed', err);
                        }
                        else {
                            // This promise is returned so will be consumed,
                            // just rethrow and let the other catch-blocks do the common stuff
                            return err;
                        }
                    });
                    // Remote fallback: If no local, wait for remote
                    return data ? data : remotePromise;
                }.bind(this))
                .then(function(data) {
                    // Ever a list, even if empty
                    data = data || [];
                    cache.list = data;
                    this.pushListToLocal(data);
                    api.state.isLoading(false);

                    return cache.list;
                }.bind(this))
                .catch(function(err) {
                    api.state.isLoading(false);
                    api.state.isSyncing(false);
                    // rethrow error
                    return err;
                });
            } else {
                api.state.isSyncing(true);
                // From remote
                return this.fetchListFromRemote()
                .then(function(data) {
                    // Ever a list, even if empty
                    data = data || [];
                    cache.list = data;
                    this.pushListToLocal(data);
                    api.state.isLoading(false);
                    api.state.isSyncing(false);

                    return cache.list;
                }.bind(this))
                .catch(function(err) {
                    api.state.isLoading(false);
                    api.state.isSyncing(false);
                    // rethrow error
                    return err;
                });
            }
        }
        else {
            // From cache
            return Promise.resolve(cache.list);
        }
    };
    
    api.getItem = function getItem(itemID) {
        // IMPORTANT: To simplify, load all the list (is a short list)
        // and look from its cached index
        // TODO Implement item server look-up. Be careful with cache update,
        // list sorting and state flags.
        return api.getList()
        .then(function() {
            // Get from cached index
            var cacheItem = cache.getItemCache(itemID);

            // TODO: Enhance on future with actual look-up by API itemID
            // if not cached, throwing not found from the server (just to avoid
            // minor cases when a new item is not still in the cache if linked
            // from other app data). And keep updated list cache with that
            // items lookup
            if (!cacheItem) {
                console.warn('ListRemoteModel Not found', itemID, settings.Model);
                throw new Error('Not Found');
            }
            return cacheItem.item;
        });
    };
    
    /**
        Generates and returns an observable inmediately,
        with the cached value or undefined,
        launching an item load that will update the observable
        on ready if there is no cached value.
        A method 'sync' is added to the observable so can be requested
        a data sync/reload on demand.
    **/
    api.getObservableItem = function getObservableItem(itemID) {
        // Get first value
        var firstValue = cache.getItemCache(itemID);
        firstValue = firstValue && firstValue.item || undefined;
        var obs = ko.observable(firstValue);
        // Create method 'sync'
        obs.sync = function syncObservableItem() {
            return api.getItem(itemID)
            .then(function(itemModel) {
                obs(itemModel);
            });
        };
        // First load if no cached value
        if (!firstValue)
            obs.sync();
        // Return
        return obs;
    };
    
    /**
        Similar to getObservableItem, it allows to get
        an observable to an item model synchronously that
        it triggers an item load when its method 'sync'
        is called. The itemID is passed to the sync item,
        since the observable is meant to hold any item/itemID
        (its a wildcard).
        This way, a reference to an observable can be get on initialization
        even if there is no data still, even no itemID, and load
        it later lazily, on demand, while keeping the content of the
        previous outdated or different item.

        NOTE: API alternative names: getLazyItem, createMutableItem
        NOTE: Maybe can get state observables (loading, syncing..)?
        NOTE: On update a same itemID, maybe update the model with updateWith
                rather than change the reference model?? (double check:
                since the model is the same in cache, already updated
                with 'updateWith', there is no need to re-apply and no
                need to change the item observable because is the same
                updated already, right?
    **/
    api.createWildcardItem = function createWildcardItem() {
        // Utility for reuse in 'sync'
        var hasID = function(id) {
            return id !== null && typeof(id) !== 'undefined';
        };
        
        // Create observable, with initial undefined value
        var obs = ko.observable(undefined);

        // Create method 'sync'
        var lastID;
        /**
            Sync method to load an item, from cache ASAP and
            from local or remote if required by the cache control.
            It returns the Promise for fetching the value (getItem)
            so load/sync ending and error can be catched.
        **/
        obs.sync = function syncObservableItem(itemID) {
            
            var idChanged = hasID(itemID) && itemID !== lastID;
            lastID = hasID(itemID) ? itemID : lastID;
            
            // ASAP Get from cache if any and requested item changed
            if (idChanged) {
                var cachedItem = cache.getItemCache(lastID);
                if (cachedItem && cachedItem.item)
                    obs(cachedItem.item);
            }

            // Request updated value
            return api.getItem(lastID)
            .then(function(itemModel) {
                obs(itemModel);
                return itemModel;
            });
        };
        
        /**
            Sets the observable value to a new item instance
        **/
        obs.newItem = function newItem(defaults) {
            if (settings.Model)
                obs(new settings.Model(defaults));
            else
                obs(defaults || {});
        };

        // Return
        return obs;
    };

    /**
        Save an item in cache, local and remote.
        Can be new or updated.
        The IDs goes with all the other data, being
        groupID required, itemID required for updates
        but falsy for insertions.
        @param data:object Plain object
    **/
    api.setItem = function setItem(data) {
        api.state.isSaving(true);
        // Send to remote first
        return this.pushListToRemote(data)
        .then(function(serverData) {
            // Success! update local copy with returned data
            // IMPORTANT: to use server data here so we get values set
            // by the server, as updates dates and itemID when creating
            // a new item.
            if (serverData) {
                // Save in cache
                cache.setItemCache(serverData);
                // Save in local storage
                // In local need to be saved all the list, not just
                // the item; since we have the cache list updated, use that
                // full list to save local
                this.pushListToLocal(getPlainCachedList());
            }
            api.state.isSaving(false);

            return serverData;
        }.bind(this))
        .catch(function(err) {
            api.state.isSaving(false);
            // Rethrow error
            return err;
        });
    };
    
    api.delItem = function delItem(itemID) {
        
        api.state.isDeleting(true);
        
        // Remove in remote first
        return this.removeItemFromRemote(itemID)
        .then(function(removedData) {
            // Update cache
            cache.delItemCache(itemID);
            // Save in local storage
            // In local need to be saved all the list;
            // since we have the cache list updated, use that
            // full list to save local
            this.pushListToLocal(getPlainCachedList());

            api.state.isDeleting(false);
            
            return removedData;
        }.bind(this))
        .catch(function(err) {
            api.state.isDeleting(false);
            // Rethrow error
            return err;
        });
    };
    
    /** Some Utils **/

    var ModelVersion = require('../utils/ModelVersion');
    /**
        It creates a new ModelVersion for the requested item ID
        after load the item.
        The promise returns the ModelVersion ready, or null
        if the item does not exists.
    **/
    api.createItemVersion = function createItemVersion(itemID) {
        return api.getItem(itemID)
        .then(function(model) {
            return model ? new ModelVersion(model) : null;
        });
    };

    /**
        It creates a new Model instance with the given initial values,
        returning a ModelVersion object.
        The versioning allows to track the initial
        state (if comes from a set of defaults or clone) with
        the changes done; the internal version notifies itself
        as 'unsaved' ever.
        Its useful to keep the same ModelVersion aware code for
        editions and additions.
    **/
    api.newItem = function newItem(values) {
        // New original and version for the model
        var version = new ModelVersion(new settings.Model(values));
        // To be sure that the version appear as something 'new', unsaved,
        // we update its timestamp to be different to the original.
        version.version.model.touch();
        return version;
    };
}

module.exports = ListRemoteModel;

ListRemoteModel.prototype.addLocalforageSupport = function addLocalforageSupport(baseName) {
    var localforage = require('localforage');

    this.fetchListFromLocal = function fetchListFromLocal() {
        return localforage.getItem(baseName);
    };
    this.pushListToLocal = function pushListToLocal(data) {
        return localforage.setItem(baseName, data);
    };
};

ListRemoteModel.prototype.addRestSupport = function addRestSupport(restClient, baseUrl) {
    
    this.fetchListFromRemote = function fetchListFromRemote() {
        return restClient.get(baseUrl);
    };
    this.pushListToRemote = function pushListToRemote(data) {

        var itemID = data[this.settings.itemIdField],
            method = itemID ? 'put' : 'post';

        var url = baseUrl + (
            itemID ? '/' + itemID : ''
        );
        return restClient[method](url, data);
    };
    this.removeItemFromRemote = function removeItemFromRemote(itemID) {
        return restClient.delete(baseUrl + '/' + itemID);
    };
};

// For testing purposes, emulate a remote providing a static list for the data:
ListRemoteModel.prototype.addMockedRemote = function addMockedRemote(dataList) {
    this.fetchListFromRemote = function fetchListFromRemote() {
        return Promise.resolve(dataList);
    };
    this.pushListToRemote = function pushListToRemote(data) {
        return Promise.resolve(data);
    };
    this.removeItemFromRemote = function removeItemFromRemote(itemID) {
        return Promise.resolve(itemID);
    };
};
},{"../utils/ModelVersion":145,"./IndexedListCache":143,"knockout":false,"localforage":false}],145:[function(require,module,exports){
/**
    Utility that allows to keep an original model untouched
    while editing a version, helping synchronize both
    when desired by push/pull/sync-ing.
    
    Its the usual way to work on forms, where an in memory
    model can be used but in a copy so changes doesn't affects
    other uses of the in-memory model (and avoids remote syncing)
    until the copy want to be persisted by pushing it, or being
    discarded or refreshed with a remotely updated original model.
**/
'use strict';

var ko = require('knockout'),
    EventEmitter = require('events').EventEmitter;

function ModelVersion(original) {
    
    EventEmitter.call(this);
    
    this.original = original;
    
    // Create version
    // (updateWith takes care to set the same dataTimestamp)
    this.version = original.model.clone(null, true);
    
    // Computed that test equality, allowing being notified of changes
    // A rateLimit is used on each to avoid several syncrhonous notifications.
    
    /**
        Returns true when both versions has the same timestamp
    **/
    this.areDifferent = ko.pureComputed(function areDifferent() {
        return (
            this.original.model.dataTimestamp() !== 
            this.version.model.dataTimestamp()
        );
    }, this).extend({ rateLimit: 0 });
    /**
        Returns true when the version has newer changes than
        the original
    **/
    this.isNewer = ko.pureComputed(function isNewer() {
        return (
            this.original.model.dataTimestamp() < 
            this.version.model.dataTimestamp()
        );
    }, this).extend({ rateLimit: 0 });
    /**
        Returns true when the version has older changes than
        the original
    **/
    this.isObsolete = ko.pureComputed(function isComputed() {
        return (
            this.original.model.dataTimestamp() > 
            this.version.model.dataTimestamp()
        );
    }, this).extend({ rateLimit: 0 });
}

module.exports = ModelVersion;

ModelVersion._inherits(EventEmitter);

ModelVersion.prototype.getRollback = function getRollback(from) {
    if (from === 'version')
        return createRollbackFunction(this.version);
    else if (from === 'original')
        return createRollbackFunction(this.original);
    throw new Error('from value not valid');
};

/**
    Sends the version changes to the original
    
    options: {
        evenIfNewer: false
    }
**/
ModelVersion.prototype.pull = function pull(options) {

    options = options || {};
    
    // By default, nothing to do, or avoid overwrite changes.
    var result = false,
        rollback = null;
    
    if (options.evenIfNewer || !this.isNewer()) {
        // Update version with the original data,
        // creating first a rollback function.
        rollback = createRollbackFunction(this.version);
        // Ever deepCopy, since only properties and fields from models
        // are copied and that must avoid circular references
        // The method updateWith takes care to set the same dataTimestamp:        
        this.version.model.updateWith(this.original, true);
        // Done
        result = true;
    }

    this.emit('pull', result, rollback);
    return result;
};

/**
    Discard the version changes getting the original
    data.
    
    options: {
        evenIfObsolete: false
    }
**/
ModelVersion.prototype.push = function push(options) {
    
    options = options || {};
    
    // By default, nothing to do, or avoid overwrite changes.
    var result = false,
        rollback = null;

    if (options.evenIfObsolete || !this.isObsolete()) {
        // Update original, creating first a rollback function.
        rollback = createRollbackFunction(this.original);
        // Ever deepCopy, since only properties and fields from models
        // are copied and that must avoid circular references
        // The method updateWith takes care to set the same dataTimestamp.
        this.original.model.updateWith(this.version, true);
        // Done
        result = true;
    }

    this.emit('push', result, rollback);
    return result;
};

/**
    Sets original and version on the same version
    by getting the newest one.
**/
ModelVersion.prototype.sync = function sync() {
    
    if (this.isNewer())
        return this.push();
    else if (this.isObsolete())
        return this.pull();
    else
        return false;
};

/**
    Utility that create a function able to 
    perform a data rollback on execution, useful
    to pass on the events to allow react upon changes
    or external synchronization failures.
**/
function createRollbackFunction(modelInstance) {
    // Previous function creation, get NOW the information to
    // be backed for later.
    var backedData = modelInstance.model.toPlainObject(true),
        backedTimestamp = modelInstance.model.dataTimestamp();

    // Create the function that *may* get executed later, after
    // changes were done in the modelInstance.
    return function rollback() {
        // Set the backed data
        modelInstance.model.updateWith(backedData, true);
        // And the timestamp
        modelInstance.model.dataTimestamp(backedTimestamp);
    };
}

},{"events":false,"knockout":false}],146:[function(require,module,exports){
/**
    RemoteModel class.
    
    It helps managing a model instance, model versions
    for in memory modification, and the process to 
    receive or send the model data
    to a remote sources, with glue code for the tasks
    and state properties.
    
    Every instance or subclass must implement
    the fetch and pull methods that knows the specifics
    of the remotes.
**/
'use strict';

var ModelVersion = require('../utils/ModelVersion'),
    CacheControl = require('../utils/CacheControl'),
    ko = require('knockout'),
    localforage = require('localforage'),
    EventEmitter = require('events').EventEmitter;

function RemoteModel(options) {

    EventEmitter.call(this);
    
    options = options || {};
    
    var firstTimeLoad = true;
    
    // Marks a lock loading is happening, any user code
    // must wait for it
    this.isLoading = ko.observable(false);
    // Marks a lock saving is happening, any user code
    // must wait for it
    this.isSaving = ko.observable(false);
    // Marks a background synchronization: load or save,
    // user code knows is happening but can continue
    // using cached data
    this.isSyncing = ko.observable(false);
    // Utility to know whether any locking operation is
    // happening.
    // Just loading or saving
    this.isLocked = ko.pureComputed(function(){
        return this.isLoading() || this.isSaving();
    }, this);
    
    if (!options.data)
        throw new Error('RemoteModel data must be set on constructor and no changed later');
    this.data = options.data;
    
    this.cache = new CacheControl({
        ttl: options.ttl
    });
    
    this.clearCache = function clearCache() {
        this.cache.latest = null;
        this.data.model.reset();
    };
    
    // Optional name used to persist a copy of the data as plain object
    // in the local storage on every successfully load/save operation.
    // With no name, no saved (default).
    // It uses 'localforage', so may be not saved using localStorage actually,
    // but any supported and initialized storage system, like WebSQL, IndexedDB or LocalStorage.
    // localforage must have a set-up previous use of this option.
    this.localStorageName = options.localStorageName || null;
    
    // Recommended way to get the instance data
    // since it ensures to launch a load of the
    // data each time is accessed this way.
    this.getData = function getData() {
        this.load();
        return this.data;
    };

    this.newVersion = function newVersion() {
        var v = new ModelVersion(this.data);
        
        // Update the version data with the original
        // after a lock load finish, like the first time,
        // since the UI to edit the version will be lock
        // in the middle.
        this.isLoading.subscribe(function (isIt) {
            if (!isIt) {
                v.pull({ evenIfNewer: true });
            }
        });

        // new method for push and remote same returning
        // the save promise to track immediate success or error,
        // with error auto recovering original data.
        v.pushSave = function pushSave() {
            var rollback = v.getRollback('original');
            v.push({ evenIfObsolete: true });

            return this.save()
            .then(function() {
                // Update the version data with the new one
                // from the remote, that may include remote computed
                // values:
                v.pull({ evenIfNewer: true });
            })
            .catch(function(error) {
                // Performs a rollback of the original model
                rollback();
                // The version data keeps untouched, user may want to retry
                // or made changes on its un-saved data.
                // rethrow error
                return error;
            });
        }.bind(this);

        return v;
    };
    
    this.fetch = options.fetch || function fetch() { throw new Error('Not implemented'); };
    this.push = options.push || function push() { throw new Error('Not implementd'); };

    var loadFromRemote = function loadFromRemote() {
        return this.fetch()
        .then(function (serverData) {
            if (serverData) {
                // Ever deepCopy, since plain data from the server (and any
                // in between conversion on 'fecth') cannot have circular
                // references:
                this.data.model.updateWith(serverData, true);

                // persistent local copy?
                if (this.localStorageName) {
                    localforage.setItem(this.localStorageName, serverData);
                }
            }
            else {
                throw new Error('Remote model did not returned data, response must be a "Not Found"');
            }

            // Event
            if (this.isLoading()) {
                this.emit('loaded', serverData);
            }
            else {
                this.emit('synced', serverData);
            }

            // Finally: common tasks on success or error
            this.isLoading(false);
            this.isSyncing(false);

            this.cache.latest = new Date();
            return this.data;
        }.bind(this))
        .catch(function(err) {

            var wasLoad = this.isLoading();

            // Finally: common tasks on success or error
            this.isLoading(false);
            this.isSyncing(false);

            // Event
            var errPkg = {
                task: wasLoad ? 'load' : 'sync',
                error: err
            };
            // Be careful with 'error' event, is special and stops execution on emit
            // if no listeners attached: overwritting that behavior by just
            // print on console when nothing, or emit if some listener:
            if (EventEmitter.listenerCount(this, 'error') > 0) {
                this.emit('error', errPkg);
            }
            else {
                // Log it when not handled (even if the promise error is handled)
                console.error('RemoteModel Error', errPkg);
            }

            // Rethrow error
            return err;
        }.bind(this));
    }.bind(this);
    
    this.load = function load() {
        if (this.cache.mustRevalidate()) {
            
            if (firstTimeLoad)
                this.isLoading(true);
            else
                this.isSyncing(true);
            
            var promise = null;
            
            // If local storage is set for this, load first
            // from local, then follow with syncing from remote
            if (firstTimeLoad &&
                this.localStorageName) {

                promise = localforage.getItem(this.localStorageName)
                .then(function(localData) {
                    if (localData) {
                        this.data.model.updateWith(localData, true);
                        
                        // Load done:
                        this.isLoading(false);
                        this.isSyncing(false);
                        
                        // Local load done, do a background
                        // remote load.
                        loadFromRemote()
                        // Catch any promise-error on the remote, to avoid
                        // unexpected errors being uncatch, they still can be
                        // catch using the 'error' event on the RemoteModel instance.
                        .catch(function() { });
                        // just don't wait, return current
                        // data
                        return this.data;
                    }
                    else {
                        // When no data, perform a remote
                        // load and wait for it:
                        return loadFromRemote();
                    }
                }.bind(this));
            }
            else {
                // Perform the remote load:
                promise = loadFromRemote();
            }
            
            // First time, blocking load:
            // it returns when the load returns
            if (firstTimeLoad) {
                firstTimeLoad = false;
                // Returns the promise and will wait for the first load:
                return promise;
            }
            else {
                // Background load: is loading still
                // but we have cached data so we use
                // that for now.
                // Catch any promise-error on the remote, to avoid
                // unexpected errors being uncatch, they still can be
                // catch using the 'error' event on the RemoteModel instance.
                promise.catch(function() { });
                // If anything new from outside
                // versions will get notified with isObsolete()
                return Promise.resolve(this.data);
            }
        }
        else {
            // Return cached data, no need to load again for now.
            return Promise.resolve(this.data);
        }
    };

    this.save = function save() {
        this.isSaving(true);
        
        // Preserve the timestamp after being saved
        // to avoid false 'obsolete' warnings with
        // the version that created the new original
        var ts = this.data.model.dataTimestamp();

        return this.push()
        .then(function (serverData) {
            // Ever deepCopy, since plain data from the server
            // cannot have circular references:
            this.data.model.updateWith(serverData, true);
            this.data.model.dataTimestamp(ts);
            
            // persistent local copy?
            if (this.localStorageName) {
                localforage.setItem(this.localStorageName, serverData);
            }
            
            // Event
            this.emit('saved', serverData);
            
            // Finally: common tasks on success or error
            this.isSaving(false);
            
            this.cache.latest = new Date();
            return this.data;
        }.bind(this))
        .catch(function(err) {
            // Finally: common tasks on success or error
            this.isSaving(false);
            
            // Event
            var errPkg = {
                task: 'save',
                error: err
            };
            // Be careful with 'error' event, is special and stops execution on emit
            // if no listeners attached: overwritting that behavior by just
            // print on console when nothing, or emit if some listener:
            if (EventEmitter.listenerCount(this, 'error') > 0) {
                this.emit('error', errPkg);
            }
            else {
                // Log it when not handled (even if the promise error is handled)
                console.error('RemoteModel Error', errPkg);
            }
            
            // Rethrow error
            return err;
        }.bind(this));
    };
    
    /**
        Launch a syncing request. Returns nothing, the
        way to track any result is with events or 
        the instance observables.
        IMPORTANT: right now is just a request for 'load'
        that avoids promise errors from throwing.
    **/
    this.sync = function sync() {
        // Call for a load, that will be treated as 'syncing' after the
        // first load
        this.load()
        // Avoid errors from throwing in the console,
        // the 'error' event is there to track anyone.
        .catch(function() {});
    };
}

module.exports = RemoteModel;

RemoteModel._inherits(EventEmitter);

},{"../utils/CacheControl":136,"../utils/ModelVersion":145,"events":false,"knockout":false,"localforage":false}],147:[function(require,module,exports){
/**
    REST API access
**/
'use strict';
var $ = require('jquery');
require('jquery.ajaxQueue');

function lowerFirstLetter(n) {
    return n && n[0] && n[0].toLowerCase && (n[0].toLowerCase() + n.slice(1)) || n;
}

function lowerCamelizeObject(obj) {
    //jshint maxcomplexity:8
    
    if (!obj || typeof(obj) !== 'object') return obj;

    var ret = Array.isArray(obj) ? [] : {};
    for(var k in obj) {
        if (obj.hasOwnProperty(k)) {
            var newk = lowerFirstLetter(k);
            ret[newk] = typeof(obj[k]) === 'object' ?
                lowerCamelizeObject(obj[k]) :
                obj[k]
            ;
        }
    }
    return ret;
}

function Rest(optionsOrUrl) {
    
    var url = typeof(optionsOrUrl) === 'string' ?
        optionsOrUrl :
        optionsOrUrl && optionsOrUrl.url;

    this.baseUrl = url;
    // Optional extraHeaders for all requests,
    // usually for authentication tokens
    this.extraHeaders = null;
}

Rest.prototype.get = function get(apiUrl, data) {
    return this.request(apiUrl, 'get', data);
};

Rest.prototype.put = function get(apiUrl, data) {
    return this.request(apiUrl, 'put', data);
};

Rest.prototype.post = function get(apiUrl, data) {
    return this.request(apiUrl, 'post', data);
};

Rest.prototype.delete = function get(apiUrl, data) {
    return this.request(apiUrl, 'delete', data);
};

Rest.prototype.putFile = function putFile(apiUrl, data) {
    // NOTE basic putFile implementation, one file, use fileUpload?
    return this.request(apiUrl, 'delete', data, 'multipart/form-data');
};

Rest.prototype.request = function request(apiUrl, httpMethod, data, contentType) {
    
    var thisRest = this;
    var url = this.baseUrl + apiUrl;

    // Using a promise to avoid the differences and problems of the jQuery thenable
    // object, but attaching its original value as a new property 'xhr' of the promise
    // created for advanced use.
    var xhr = $.ajaxQueue({
        url: url,
        // Avoid cache for data.
        cache: false,
        dataType: 'json',
        method: httpMethod,
        headers: this.extraHeaders,
        // URLENCODED input:
        // Convert to JSON and back just to ensure the values are converted/encoded
        // properly to be sent, like Dates being converted to ISO format.
        data: data && JSON.parse(JSON.stringify(data)),
        contentType: contentType || 'application/x-www-form-urlencoded'
        // Alternate: JSON as input
        //data: JSON.stringify(data),
        //contentType: contentType || 'application/json'
    });

    var promiseXhr = Promise.resolve(xhr)
    .then(lowerCamelizeObject)
    .catch(function(err) {
        // On authorization error, give oportunity to retry the operation
        if (err.status === 401) {
            var retry = request.bind(this, apiUrl, httpMethod, data, contentType);
            var retryPromise = thisRest.onAuthorizationRequired(retry);
            if (retryPromise) {
                // It returned something, expecting is a promise:
                return Promise.resolve(retryPromise)
                .catch(function(){
                    // There is error on retry, just return the
                    // original call error
                    return err;
                });
            }
        }
        // by default, continue propagating the error
        return err;
    });
    
    promiseXhr.xhr = xhr;
    return promiseXhr;
};

Rest.prototype.onAuthorizationRequired = function onAuthorizationRequired(/*retry*/) {
    // To be implemented outside, if convenient executing:
    //retry();
    // by default don't wait for retry, just return nothing:
    return;
};

module.exports = Rest;

},{}],148:[function(require,module,exports){
/**
    Time class utility.
    Shorter way to create a Date instance
    specifying only the Time part,
    defaulting to current date or 
    another ready date instance.
**/
function Time(date, hour, minute, second) {
    if (!(date instanceof Date)) {
 
        second = minute;
        minute = hour;
        hour = date;
        
        date = new Date();   
    }

    return new Date(date.getFullYear(), date.getMonth(), date.getDate(), hour || 0, minute || 0, second || 0);
}
module.exports = Time;

},{}],149:[function(require,module,exports){
/**
    Create an Access Control for an app that just checks
    the activity property for allowed user level.
    To be provided to Shell.js and used by the app.js,
    very tied to that both classes.
    
    Activities can define on its object an accessLevel
    property like next examples
    
    this.accessLevel = app.Usertype.user; // anyone
    this.accessLevel = app.UserType.anonymous; // anonymous users only
    this.accessLevel = app.UserType.loggedUser; // authenticated users only
**/
'use strict';

// UserType enumeration is bit based, so several
// users can has access in a single property
//var UserType = require('../models/User').UserType;

module.exports = function createAccessControl(app) {
    
    return function accessControl(route) {

        var activity = app.getActivityControllerByRoute(route);

        var user = app.model.user();
        var currentType = user && user.userType();

        if (activity && activity.accessLevel) {

            var can = activity.accessLevel & currentType;
            
            if (!can) {
                // Notify error, why cannot access
                return {
                    requiredLevel: activity.accessLevel,
                    currentType: currentType
                };
            }
        }

        // Allow
        return null;
    };
};

},{}],150:[function(require,module,exports){
/**
    Set of functions to make calculations of availability
    per date given a list of appointments.
    It allows to sort them, create and insert free/unavailable appointments
    following a given daySchedule and summarize the date availability status.
    
    It relies (directly or not) in models like Appointment, 
    SimplifiedWeeklySchedule.WeekDaySchedule.
**/
'use strict';

var Appointment = require('../models/Appointment'),
    moment = require('moment');

exports.sortAppointments = function(a, b) {
    var as = a.startTime(),
        ae = a.endTime(),
        bs = b.startTime(),
        be = b.endTime();

    if (as === null)
        return -1;
    else if (bs === null)
        return 1;

    var eq = as.toISOString() === bs.toISOString();
    if (eq) {
        if (ae === null)
            return -1;
        else if (be === null)
            return 1;
        
        return ae - be;
    }
    else {
        return as - bs;
    }
};

/**
    It adds before every booking apt/slot a 'preparation time' slot for the 'preparationHours' (AKA 'betweenTime').
    The given slots array MUST BE SORTED.
    It takes care to:
    - do not add slots out of the given date
    - do not add slots that overlay other bookings (if two bookings too close; because of manual timing or preference
      change of the preparationHours)
**/
exports.fillPreparationTimeSlots = function fillPreparationTimeSlots(date, slots, preparationHours) {
    
    // Initial check of previous slot start and ends is the given date (at midnight)
    // so we avoid to insert slots out of the date.
    var prevEnd = date;

    slots.forEach(function(slot, index) {
        // for each booking
        if (slot.id() > 0 &&
            slot.sourceBooking()) {
            
            var end = slot.startTime(),
                start = moment(end).subtract(preparationHours, 'hours').toDate();
    
            // avoiding the preparation slot if it ends before or just on
            // the previous slot end (or before the date) to avoid unneeded slots
            // NOTE: do NOT a (end <= prevEnd return;) because will introduce a bug
            // since the prevEnd will not be collected, failing when there are 
            // more than 2 consecutive bookings
            if (end > prevEnd) {
                // ..or cuts the beggining of the slot ('start') by
                // the end of the previous slot (so fits perfectly, without overlay)
                start = start < prevEnd ? prevEnd : start;

                // its added before the current slot:
                slots.splice(index, 0, Appointment.newPreparationTimeSlot({
                    start: start,
                    end: end
                }));
            }
        }
        prevEnd = slot.endTime();
    });
};

/**
    Introduce free or unavailable slots wherever needed in the given
    array of Appointments, to fill any gap in a natural day
    (from Midnight to Midnight next date) and based on the
    given week day schedule.
    The hours in the schedule are assumed in the local time.
    A new array is returned.
    It introduce 'preparation time' slots too before of bookings when needed.
    
    date is a Date object representing the same date as used in
    the appointmentsList; it's used when no appointments exists (so
    date cannot be extracted from first appointent) to return an empty
    date unavaialable/free/unavailable slots; and when filling preparation slots, to
    avoid add a slot with time that starts in a previous date
    
    TODO: Make it compatible with an initial appointment that may start before the 
    date (but ends inside the date) and a final appointment that may end
    on the next date (but starts inside the date).
**/
exports.fillDayAvailability = function fillDayAvailability(date, appointmentsList, weekDaySchedule, schedulingPreferences) {

    // Shadow clone
    var slots = appointmentsList.slice(0);
    // sort the list
    slots.sort(exports.sortAppointments);
    // add preparation time for each booking
    exports.fillPreparationTimeSlots(date, slots, schedulingPreferences.betweenTime());

    var filledSlots = [],
        zeroTime = '00:00:00',
        last = zeroTime,
        lastDateTime = null,
        timeFormat = 'HH:mm:ss';

    if (slots.length === 0) {
        // No slots, empty date so create the required
        // unavailable/free/unavailable slots for the 'date'
        var fullStart = moment(date).startOf('day'),
            fullEnd = fullStart.clone().add(1, 'days');

        filledSlots = exports.createScheduleSlots({
            start: fullStart.toDate(),
            end: fullEnd.toDate()
        }, weekDaySchedule);
    }
    else {
        // Look for time gaps in the list
        slots.forEach(function(slot) {
            var start = slot.startTime(),
                s = moment(start),
                end = slot.endTime(),
                e = moment(end);

            if (s.format(timeFormat) > last) {

                if (lastDateTime === null) {
                    // First slot of the date, 12AM=00:00
                    lastDateTime = new Date(
                        start.getFullYear(), start.getMonth(), start.getDate(),
                        0, 0, 0
                    );
                }

                // There is a gap, fill it
                filledSlots.push.apply(filledSlots, exports.createScheduleSlots({
                    start: lastDateTime,
                    end: start
                }, weekDaySchedule));
            }

            filledSlots.push(slot);
            lastDateTime = end;
            last = e.format(timeFormat);
        });

        // Check latest to see a gap at the end:
        var lastEnd = lastDateTime && moment(lastDateTime).format(timeFormat);
        if (lastEnd !== zeroTime) {
            // There is a gap, filled it
            var nextMidnight = new Date(
                lastDateTime.getFullYear(),
                lastDateTime.getMonth(),
                // Next date!
                lastDateTime.getDate() + 1,
                // At zero hours!
                0, 0, 0
            );

            filledSlots.push.apply(filledSlots, exports.createScheduleSlots({
                start: lastDateTime,
                end: nextMidnight
            }, weekDaySchedule));
        }
    }

    return filledSlots;
};

/**
    Given a time range without appointments, and the day schedule,
    it returns an array of appointments objects to fullfill
    that empty range with unavailable/free appointments.
    
    The range must be two times inside the same date (local time), format
    range { start:Date, end:Date }
    
    weekDaySchedule is an instance of WeekDaySchedule Model, basically:
    { from:observable(Date), to:observable(Date) }
**/
exports.createScheduleSlots = function createScheduleSlots(range, weekDaySchedule) {
    /*jshint maxcomplexity:10*/
    var list = [],
        start = range.start,
        end = range.end,
        date = moment(start).startOf('day'),
        from = moment(date).add({ minutes: weekDaySchedule.from() }).toDate(),
        to = moment(date).add({ minutes: weekDaySchedule.to() }).toDate();

    // It happens before the week day schedule starts
    var beforeSchedule = 
        start < from &&
        end <= from;
    // It happens after the week day schedule ends
    var afterSchedule = 
        end > to &&
        start >= to;
    // It happens inside the week day schedule
    var insideSchedule =
        start >= from &&
        end <= to;

    if (beforeSchedule || afterSchedule) {
        list.push(
            Appointment.newUnavailableSlot({
                start: start,
                end: end
            })
        );
    }
    else if (insideSchedule) {
        list.push(
            Appointment.newFreeSlot({
                start: start,
                end: end
            })
        );
    }
    else {
        // Is in a intermediate position, needs two
        // or three slots
        var crossStart =
            start < from &&
            end > from;
        var crossEnd = 
            start < to &&
            end > to;

        if (crossStart) {
            // Unavailable slot until the 'from'
            list.push(
                Appointment.newUnavailableSlot({
                    start: start,
                    end: from
                })
            );
        }
        if (crossEnd) {
            // Unavailable after 'to'
            list.push(
                Appointment.newUnavailableSlot({
                    start: to,
                    end: end
                })
            );
        }

        if (crossStart && crossEnd) {
            // Full day free
            list.push(
                Appointment.newFreeSlot({
                    start: from,
                    end: to
                })
            );
        }
        else if (crossStart) {
            // Free slot until mid point
            list.push(
                Appointment.newFreeSlot({
                    start: from,
                    end: end
                })
            );
        }
        else if (crossEnd) {
            // Free slot from mid point
            list.push(
                Appointment.newFreeSlot({
                    start: start,
                    end: to
                })
            );
        }
    }
    
    // In the complex cases, is easy that the 
    // order gets inversed because of the if-else natural order
    // so ensure goes correct
    return list.sort(exports.sortAppointments);
};

},{"../models/Appointment":96,"moment":false}],151:[function(require,module,exports){
/**
    Bootknock: Set of Knockout Binding Helpers for Bootstrap js components (jquery plugins)
    
    Dependencies: jquery
    Injected dependencies: knockout
**/
'use strict';

// Dependencies
var $ = require('jquery');
// DI i18n library
exports.i18n = null;

function createHelpers(ko) {
    var helpers = {};

    /** Popover Binding **/
    helpers.popover = {
        update: function(element, valueAccessor) {
            var srcOptions = ko.unwrap(valueAccessor());

            // Duplicating options object to pass to popover without
            // overwrittng source configuration
            var options = $.extend(true, {}, srcOptions);
            
            // Unwrapping content text
            options.content = ko.unwrap(srcOptions.content);
            
            if (options.content) {
            
                // Localize:
                options.content = 
                    exports.i18n && exports.i18n.t(options.content) ||
                    options.content;
                
                // To get the new options, we need destroy it first:
                $(element).popover('destroy').popover(options);

                // Se muestra si el elemento tiene el foco
                if ($(element).is(':focus'))
                    $(element).popover('show');

            } else {
                $(element).popover('destroy');
            }
        }
    };
    
    return helpers;
}

/**
    Plug helpers in the provided Knockout instance
**/
function plugIn(ko, prefix) {
    var name,
        helpers = createHelpers(ko);
    
    for(var h in helpers) {
        if (helpers.hasOwnProperty && !helpers.hasOwnProperty(h))
            continue;

        name = prefix ? prefix + h[0].toUpperCase() + h.slice(1) : h;
        ko.bindingHandlers[name] = helpers[h];
    }
}

exports.plugIn = plugIn;
exports.createBindingHelpers = createHelpers;

},{}],152:[function(require,module,exports){
/**
    Knockout Binding Helper for the Bootstrap Switch plugin.
    
    Dependencies: jquery, bootstrap, bootstrap-switch
    Injected dependencies: knockout
    
    IMPORTANT NOTES:
    - A console error of type "object has not that property" will happen if specified
        a non existant option in the binding. The error looks strange when using the minified file.
    - The order of options in the binding matters when combining with disabled and readonly
        options: if the element is disabled:true or readonly:true, any attempt to change the
        value will fail silently, so if the same binding update changes disabled to false
        and the state, the 'disabled' change must happens before the 'state' change so both
        are successfully updated. For that, just specify 'disabled' before 'state' in the bindings
        definition.
**/
'use strict';

// Dependencies
var $ = require('jquery');
require('bootstrap');
require('bootstrap-switch');

/**
    Create and plug-in the Binding in the provided Knockout instance
**/
exports.plugIn = function plugIn(ko, prefix) {

    ko.bindingHandlers[prefix ? prefix + 'switch' : 'switch'] = {
        init: function(element, valueAccessor) {
            // Create plugin instance
            $(element).bootstrapSwitch();
            
            //console.log('switch init', ko.toJS(valueAccessor()));

            // Updating value on plugin changes
            $(element).on('switchChange.bootstrapSwitch', function (e, state) {
                var v = valueAccessor() || {};
                //console.log('switchChange', ko.toJS(v));
                
                // changed?
                var oldState = !!ko.unwrap(v.state),
                    newState = !!state;
                // Only update on change
                if (oldState !== newState) {
                    if (ko.isObservable(v.state)) {
                        if (ko.isWriteableObservable(v.state)) {
                            v.state(newState);
                        }
                    } else {
                        v.state = newState;
                    }
                }
            });
        },
        update: function(element, valueAccessor) {
            // Get options to be applied to the plugin instance
            var srcOptions = valueAccessor();
            
            var options = srcOptions || {};

            // Unwrapping every option value, getting a duplicated
            // plain object
            options = ko.toJS(options);
            //console.log('switch update', options);

            var $el = $(element);
            // Update every option in the plugin
            Object.keys(options).forEach(function(key) {
                $el.bootstrapSwitch(key, options[key]);
            });
        }
    };
};

},{}],153:[function(require,module,exports){
/**
    Allow attach availability loading and displaying capabilities
    to a datepicker component as part of an activity.
    
    It attaches handlers so it loads and update availability whenever
    the displayed month change, but it returns a method to do it
    on demand, like in the first load after choose a 'current date'
**/
'use strict';

var $ = require('jquery'),
    moment = require('moment');

exports.create = function createDatepickerAvailability(app, $datepicker, isLoading) {
    // Cache DOM elements
    var daysElements = $datepicker.datepicker('getDaysElements');
    // Cache last month showed, to double check later and don't load an already
    // displayed month
    var prevMonth = null;
    
    // Listen to cache changes in order to force a data load (to avoid invalid
    // availability being displayed after an apt was modified)
    app.model.calendar.on('clearCache', function(dates) {
        if (!dates) {
            prevMonth = null;
        }
        else {
            dates.some(function(date) {
                if (date.getMonth() === prevMonth) {
                    prevMonth = null;
                    return true;
                }
            });
        }
    });
    
    /**
        It tags, if the month changed, the calendar with the Date Availability.
        The refresh param forces the process even if the same month than previously tagged/rendered
    **/
    var tagAvailability = function tagAvailability(date, refresh) {
        var month = date.getMonth();
        // Avoid dupes
        if (month === prevMonth && !refresh) return;
        prevMonth = month;
        
        // We need to know the range of dates being displayed on the
        // monthly calendar, from the first week day of first month week
        // to 6 full weeks.
        var start = moment(date).clone().startOf('month').startOf('week'),
            end = start.clone().add(6, 'weeks');

        // Switch loading flag
        if (isLoading)
            isLoading(true);
        
        // Request the data
        app.model.calendar.getDatesAvailability(start, end)
        .then(function(resultByDates) {
            // We are still in the same showed month? (loading is async, so could have changed)
            if (month !== $datepicker.datepicker('getViewDate').getMonth()) return;

            // We received a set of DateAvailability objects per date (iso string key)
            // Iterate every day element, and use its date avail from the result
            daysElements.each(function() {
                // jshint maxcomplexity:10
                var $dateTd = $(this),
                    id = $dateTd.data('date-time'),
                    dateAvail = resultByDates[moment(id).format('YYYY-MM-DD')];   

                // Integrity check to avoid edge case exceptions (must not happens, but stronger code)
                if (!id || !dateAvail) return;
                
                // Remove any previous 'tag-' class from the cell classNames and keep for later change
                var cellClass = $dateTd.attr('class').replace(/(^|\s)tag-[^\s]+/, '');

                // Set a date cell class based on its availability
                var cls = '';
                switch(dateAvail.availableTag()) {
                    case 'past':
                        cls = 'tag-muted';
                        break;
                    case 'full':
                        cls = 'tag-blank';
                        break;
                    case 'medium':
                        cls = 'tag-dark';
                        break;
                    case 'low':
                        cls = 'tag-warning';
                        break;
                    case 'none':
                        cls = 'tag-danger';
                        break;
                }
                $dateTd.attr('class', cellClass + ' ' + cls);
            });
        })
        .catch(function(err) {
            app.modals.showError({
                title: 'Error loading availability',
                error: err
            });
        }.bind(this))
        .then(function() {
            // Finally
            if (isLoading)
                isLoading(false);
        }.bind(this));
    };
    
    // Handler to auto load/update availability for displayed day
    $datepicker.on('viewDateChanged', function(e, d) {
        if (d.viewMode === 'days') {
            tagAvailability(d.viewDate);
        }
    });
    
    return tagAvailability;
};

},{"moment":false}],154:[function(require,module,exports){
/**
    Converts a duration into a text using long
    language words.
    Example: 2:45 -> 2 hours, 45 minutes
    
    Can pass in a moment.duration object or a valid constructor
    parameter.
    Difference with moment.duration.humanize: this shows a precise
    representation, returning exact value for any non-zero unit,
    while humanize is an approximation in the higher unit
    (in the example above, humanize displays: '3 hours')
    
    TODO: I18N
**/
'use strict';

var moment = require('moment');

module.exports = function duration2Language(duration) {
    //jshint maxcomplexity:30
    duration = moment.duration(duration);
    var y = duration.years(),
        d = duration.days(),
        h = duration.hours(),
        m = duration.minutes(),
        s = duration.seconds(),
        l = duration.milliseconds(),
        parts = [];
    
    if (y === 1) parts.push('a year');
    else if (y) parts.push(y + ' years');
    if (d === 1) parts.push('a day');
    else if (d) parts.push(d + ' days');
    if (h === 1) parts.push('an hour');
    else if (h) parts.push(h + ' hours');
    if (m === 1) parts.push('a minute');
    else if (m) parts.push(m + ' minutes');
    if (s === 1) parts.push('a second');
    else if (s) parts.push(s + ' seconds');
    if (l === 1) parts.push('a millisecond');
    else if (l) parts.push(l + ' milliseconds');
    
    return parts.join(', ');
};
},{"moment":false}],155:[function(require,module,exports){
/**
    Espace a string for use on a RegExp.
    Usually, to look for a string in a text multiple times
    or with some expressions, some common are 
    look for a text 'in the beginning' (^)
    or 'at the end' ($).
    
    Author: http://stackoverflow.com/users/151312/coolaj86 and http://stackoverflow.com/users/9410/aristotle-pagaltzis
    Link: http://stackoverflow.com/a/6969486
**/
'use strict';

// Referring to the table here:
// https://developer.mozilla.org/en/JavaScript/Reference/Global_Objects/regexp
// these characters should be escaped
// \ ^ $ * + ? . ( ) | { } [ ]
// These characters only have special meaning inside of brackets
// they do not need to be escaped, but they MAY be escaped
// without any adverse effects (to the best of my knowledge and casual testing)
// : ! , = 
// my test "~!@#$%^&*(){}[]`/=?+\|-_;:'\",<.>".match(/[\#]/g)

var specials = [
    // order matters for these
      "-"
    , "["
    , "]"
    // order doesn't matter for any of these
    , "/"
    , "{"
    , "}"
    , "("
    , ")"
    , "*"
    , "+"
    , "?"
    , "."
    , "\\"
    , "^"
    , "$"
    , "|"
  ]

  // I choose to escape every character with '\'
  // even though only some strictly require it when inside of []
, regex = RegExp('[' + specials.join('\\') + ']', 'g')
;

var escapeRegExp = function (str) {
return str.replace(regex, "\\$&");
};

module.exports = escapeRegExp;

// test escapeRegExp("/path/to/res?search=this.that")

},{}],156:[function(require,module,exports){
/**
* escapeSelector
*
* source: http://kjvarga.blogspot.com.es/2009/06/jquery-plugin-to-escape-css-selector.html
*
* Escape all special jQuery CSS selector characters in *selector*.
* Useful when you have a class or id which contains special characters
* which you need to include in a selector.
*/
'use strict';

var specials = [
  '#', '&', '~', '=', '>', 
  "'", ':', '"', '!', ';', ','
];
var regexSpecials = [
  '.', '*', '+', '|', '[', ']', '(', ')', '/', '^', '$'
];
var sRE = new RegExp(
  '(' + specials.join('|') + '|\\' + regexSpecials.join('|\\') + ')', 'g'
);

module.exports = function(selector) {
  return selector.replace(sRE, '\\$1');
};

},{}],157:[function(require,module,exports){
/** getDateWithoutTime utility.
    Returns a new Date instance with time at zeroes
    and the same date as the input.
    It returns current date if no valid date or string passed.
**/
'use strict';

module.exports = function getDateWithoutTime(date) {
    if (!date) {
        date = new Date();
    }
    else if (!(date instanceof Date)) {
        date = new Date(date);
    }

    return new Date(
        date.getFullYear(),
        date.getMonth(),
        date.getDate(),
        0, 0, 0
    );
};

},{}],158:[function(require,module,exports){
/**
    Get a given value wrapped in an observable or returns
    it if its already an observable or just a function.
**/
'use strict';
var ko = require('knockout');

module.exports = function getObservable(obsOrValue) {
    if (typeof(obsOrValue) === 'function')
        return obsOrValue;
    else
        return ko.observable(obsOrValue);
};

},{"knockout":false}],159:[function(require,module,exports){
/**
    Read a page's GET URL variables and return them as an associative array.
**/
'user strict';
//global window

module.exports = function getUrlQuery(url) {

    url = url || window.location.href;

    var vars = [], hash,
        queryIndex = url.indexOf('?');
    if (queryIndex > -1) {
        var hashes = url.slice(queryIndex + 1).split('&');
        for(var i = 0; i < hashes.length; i++)
        {
            hash = hashes[i].split('=');
            vars.push(hash[0]);
            vars[hash[0]] = hash[1];
        }
    }
    return vars;
};

},{}],160:[function(require,module,exports){
// jQuery plugin to set multiline text in an element,
// by replacing \n by <br/> with careful to avoid XSS attacks.
// http://stackoverflow.com/a/13082028
'use strict';

var $ = require('jquery');

$.fn.multiline = function(text) {
    this.text(text);
    this.html(this.html().replace(/\n/g,'<br/>'));
    return this;
};

},{}],161:[function(require,module,exports){
/**
    Set of utilities to define Javascript Properties
    independently of the browser.
    
    Allows to define getters and setters.
    
    Adapted code from the original created by Jeff Walden
    http://whereswalden.com/2010/04/16/more-spidermonkey-changes-ancient-esoteric-very-rarely-used-syntax-for-creating-getters-and-setters-is-being-removed/
**/
'use strict';

function accessorDescriptor(field, fun)
{
    var desc = { enumerable: true, configurable: true };
    desc[field] = fun;
    return desc;
}

function defineGetter(obj, prop, get)
{
    if (Object.defineProperty)
        return Object.defineProperty(obj, prop, accessorDescriptor("get", get));
    if (Object.prototype.__defineGetter__)
        return obj.__defineGetter__(prop, get);

    throw new Error("browser does not support getters");
}

function defineSetter(obj, prop, set)
{
    if (Object.defineProperty)
        return Object.defineProperty(obj, prop, accessorDescriptor("set", set));
    if (Object.prototype.__defineSetter__)
        return obj.__defineSetter__(prop, set);

    throw new Error("browser does not support setters");
}

module.exports = {
    defineGetter: defineGetter,
    defineSetter: defineSetter
};

},{}],162:[function(require,module,exports){
/**
    Remove the accent and special characters from a text
    replacing each character for its basic equivalent.
    Useful to performs punctuation-insensitive text searchs.
**/
'use strict';

var map = {'À':'A','Á':'A','Â':'A','Ã':'A','Ä':'A','Å':'A','Æ':'AE','Ç':'C','È':'E','É':'E','Ê':'E','Ë':'E','Ì':'I','Í':'I','Î':'I','Ï':'I','Ð':'D','Ñ':'N','Ò':'O','Ó':'O','Ô':'O','Õ':'O','Ö':'O','Ø':'O','Ù':'U','Ú':'U','Û':'U','Ü':'U','Ý':'Y','ß':'s','à':'a','á':'a','â':'a','ã':'a','ä':'a','å':'a','æ':'ae','ç':'c','è':'e','é':'e','ê':'e','ë':'e','ì':'i','í':'i','î':'i','ï':'i','ñ':'n','ò':'o','ó':'o','ô':'o','õ':'o','ö':'o','ø':'o','ù':'u','ú':'u','û':'u','ü':'u','ý':'y','ÿ':'y','Ā':'A','ā':'a','Ă':'A','ă':'a','Ą':'A','ą':'a','Ć':'C','ć':'c','Ĉ':'C','ĉ':'c','Ċ':'C','ċ':'c','Č':'C','č':'c','Ď':'D','ď':'d','Đ':'D','đ':'d','Ē':'E','ē':'e','Ĕ':'E','ĕ':'e','Ė':'E','ė':'e','Ę':'E','ę':'e','Ě':'E','ě':'e','Ĝ':'G','ĝ':'g','Ğ':'G','ğ':'g','Ġ':'G','ġ':'g','Ģ':'G','ģ':'g','Ĥ':'H','ĥ':'h','Ħ':'H','ħ':'h','Ĩ':'I','ĩ':'i','Ī':'I','ī':'i','Ĭ':'I','ĭ':'i','Į':'I','į':'i','İ':'I','ı':'i','Ĳ':'IJ','ĳ':'ij','Ĵ':'J','ĵ':'j','Ķ':'K','ķ':'k','Ĺ':'L','ĺ':'l','Ļ':'L','ļ':'l','Ľ':'L','ľ':'l','Ŀ':'L','ŀ':'l','Ł':'L','ł':'l','Ń':'N','ń':'n','Ņ':'N','ņ':'n','Ň':'N','ň':'n','ŉ':'n','Ō':'O','ō':'o','Ŏ':'O','ŏ':'o','Ő':'O','ő':'o','Œ':'OE','œ':'oe','Ŕ':'R','ŕ':'r','Ŗ':'R','ŗ':'r','Ř':'R','ř':'r','Ś':'S','ś':'s','Ŝ':'S','ŝ':'s','Ş':'S','ş':'s','Š':'S','š':'s','Ţ':'T','ţ':'t','Ť':'T','ť':'t','Ŧ':'T','ŧ':'t','Ũ':'U','ũ':'u','Ū':'U','ū':'u','Ŭ':'U','ŭ':'u','Ů':'U','ů':'u','Ű':'U','ű':'u','Ų':'U','ų':'u','Ŵ':'W','ŵ':'w','Ŷ':'Y','ŷ':'y','Ÿ':'Y','Ź':'Z','ź':'z','Ż':'Z','ż':'z','Ž':'Z','ž':'z','ſ':'s','ƒ':'f','Ơ':'O','ơ':'o','Ư':'U','ư':'u','Ǎ':'A','ǎ':'a','Ǐ':'I','ǐ':'i','Ǒ':'O','ǒ':'o','Ǔ':'U','ǔ':'u','Ǖ':'U','ǖ':'u','Ǘ':'U','ǘ':'u','Ǚ':'U','ǚ':'u','Ǜ':'U','ǜ':'u','Ǻ':'A','ǻ':'a','Ǽ':'AE','ǽ':'ae','Ǿ':'O','ǿ':'o'};

module.exports = function removeAccent(str) {

    var res = '', c;
    for (var i = 0, l = str.length; i < l; i++) {
        c = str.charAt(i);
        res += map[c] || c;
    }
    return res;
};

},{}],163:[function(require,module,exports){
/**
    It scroll all needed elements in the page to make the
    target element to appear in the screen, if possible.
    
    It scrolls all the element ancestors (that may have
    or not a scrolling context).
    
    Only vertically.
    TODO: make it horizontal too.
**/
//global window
'use strict';

var $ = require('jquery');

// @param el:DOMElement|jQuery
// @param options:Object {
//      topOffset:int  Offset scroll from the top
// }
module.exports = function scrollToElement(el, options) {
    //jshint maxcomplexity:10
    var parent = $(el).parent();

    var topOffset = options && options.topOffset || 0;
    var animation = options && options.animation;
    
    var atRoot = false;

    do {
        // Go out on detached elements:
        if (!parent || !parent.length) return;
        // Check if root element (ends loop and has different rules for scrolling)
        atRoot = parent.get(0) === document.documentElement;
        
        // Relative position of the element is calculated in a different way
        // when at the root, so take care of that
        var relativeTop = atRoot ? el.position().top : el.offset().top;
        
        // IMPORTANT: elementTop with offset is used as is when atRoot
        // because the next scrollingTop calculating make it fail
        var elementTop = relativeTop - topOffset;
        var scrollingTop = elementTop + parent.scrollTop() - parent.offset().top;

        if (atRoot) {
            // IMPORTANT: special case, on the root
            // we can just use window.scroll or scrollTop for animation
            // BUT with a different amount, the elementTop
            if (animation)
                $('html,body').stop().animate({ scrollTop: elementTop }, animation);
            else
                window.scroll(0, elementTop);
        }
        else {
            if (animation)
                parent.stop().animate({ scrollTop: scrollingTop }, animation);
            else
                parent.scrollTop(scrollingTop);
        }

        parent = parent.parent();
    } while(!atRoot);
};

},{}],164:[function(require,module,exports){
/**
    DomItemsManager class, that manage a collection 
    of HTML/DOM items under a root/container, where
    only one element at the time is visible, providing
    tools to uniquerly identify the items,
    to create or update new items (through 'inject'),
    get the current, find by the ID and more.
**/
'use strict';

var $ = require('jquery');
var escapeSelector = require('../escapeSelector');

function DomItemsManager(settings) {

    this.idAttributeName = settings.idAttributeName || 'id';
    this.allowDuplicates = !!settings.allowDuplicates || false;
    this.root = settings.root || 'body';
    this.$root = null;
    // Define in ms the delay in a switch of items (prepare next ->delay-> hide current, show next)
    // NOTE: as of testing in iOS 8.3 iPad2 (slow), 140ms ended being a good default
    // to avoid some flickering effects, enough to let initialization logic to finish before
    // being showed, allow some common async redirects when executing an item logic but
    // enough quick to not being visually perceived the delay.
    // NOTE: on tests on Nexus 5 Android 5.1 with Chrome engine, 40ms was enought to have all the previous
    // benefits, but was too quick for iOS (even 100ms was too quick for iOS 8.3).
    this.switchDelay = settings.switchDelay || 140;
}

module.exports = DomItemsManager;

DomItemsManager.prototype.getAllItems = function getAllItems() {
    return this.$root.children('[' + this.idAttributeName + ']');
};

DomItemsManager.prototype.find = function find(containerName, root) {
    var $root = $(root || this.$root);
    return $root.children('[' + this.idAttributeName + '="' + escapeSelector(containerName) + '"]');
};

DomItemsManager.prototype.getActive = function getActive() {
    return this.$root.children('[' + this.idAttributeName + ']:visible');
};

/**
    It adds the item in the html provided (can be only the element or 
    contained in another or a full html page).
    Replaces any existant if duplicates are not allowed.
**/
DomItemsManager.prototype.inject = function inject(name, html) {

    // Filtering input html (can be partial or full pages)
    // http://stackoverflow.com/a/12848798
    html = html.replace(/^[\s\S]*<body.*?>|<\/body>[\s\S]*$/g, '');

    // Creating a wrapper around the html
    // (can be provided the innerHtml or outerHtml, doesn't matters with next approach)
    var $html = $('<div/>', { html: html }),
        // We look for the container element (when the outerHtml is provided)
        $c = this.find(name, $html);

    if ($c.length === 0) {
        // Its innerHtml, so the wrapper becomes the container itself
        $c = $html.attr(this.idAttributeName, name);
    }

    if (!this.allowDuplicates) {
        // No more than one container instance can exists at the same time
        // We look for any existent one and its replaced with the new
        var $prev = this.find(name);
        if ($prev.length > 0) {
            $prev.replaceWith($c);
            $c = $prev;
        }
    }

    // Add to the document
    // (on the case of duplicated found, this will do nothing, no worry)
    $c.appendTo(this.$root);
};

/** 
    The switch method receive the items to interchange as active or current,
    the 'from' and 'to', and the shell instance that MUST be used
    to notify each event that involves the item:
    willClose, willOpen, ready, opened, closed.
    It receives as latest parameter the 'notification' object that must be
    passed with the event so handlers has context state information.
    
    It's designed to be able to manage transitions, but this default
    implementation is as simple as 'show the new and hide the old'.
**/
DomItemsManager.prototype.switch = function switchActiveItem($from, $to, shell, state) {

    var toName = state.route.name;
    //console.log('switch to', toName);
    
    this.disableAccess();
    
    function hideit() {
        var fromIsHidden = $from.is('[hidden]');
        if ($from.length > 0 && !fromIsHidden) {
            shell.emit(shell.events.willClose, $from, state);
            // Do 'unfocus' on the hidden element after notify 'willClose'
            // for better UX: hidden elements are not reachable and has good
            // side effects like hidding the on-screen keyboard if an input was
            // focused
            $from.find(':focus').blur();
            // hide and notify it ended
            $from
            .attr('hidden', 'hidden')
            // For browser that don't support attr
            .css('display', 'none')
            // Reset z-index to avoid overlapping effect
            .css('z-index', '');

            shell.emit(shell.events.closed, $from, state);
        }
        else {
            // Just unfocus to avoid keyboard problems
            $from.find(':focus').blur();
        }
    }

    var toIsHidden = $to.is('[hidden]'); // !$to.is(':visible')

    if (toIsHidden) {
        shell.emit(shell.events.willOpen, $to, state);
        // Put outside screen
        /* DONE ALREADY in the CSS class assigned to items
        $to.css({
            position: 'absolute',
            zIndex: -1,
            top: 0,
            bottom: 0,
            left: 0,
            right: 0
        });*/
        $to.css('zIndex', -1);

        // Show it:
        $to
        .removeAttr('hidden')
        // For browser that don't support attr
        .css('display', 'block');

        // Its enough visible and in DOM to perform initialization tasks
        // that may involve layout information
        shell.emit(shell.events.itemReady, $to, state);
        
        //console.log('SWITCH ready done, wait', toName);

        // Finish in a small delay, enough to allow some initialization
        // set-up that take some time to finish avoiding flickering effects
        setTimeout(function() {
            //console.log('SWITCH entering hide-show for', toName, shell.currentRoute.name);
            //console.log('ending switch to', toName, 'and current is', shell.currentRoute.name);
            // Race condition, redirection in the middle, abort:
            if (toName !== shell.currentRoute.name)
                return;
            
            // Hide the from
            hideit();
            
            // Ends opening, reset transitional styles
            /* SETUP IS ALREADY CORRECT in the CSS class assigned to items
            $to.css({
                position: '',
                top: '',
                bottom: '',
                left: '',
                right: '',
                zIndex: 2
            });
            */
            $to.css('zIndex', 2);
            
            this.enableAccess();
            
            //console.log('SWITCH ended for', toName);

            // When its completely opened
            shell.emit(shell.events.opened, $to, state);
        }.bind(this), this.switchDelay);
    } else {
        //console.log('ending switch to', toName, 'and current is', shell.currentRoute.name, 'INSTANT (to was visible)');
        // Race condition, redirection in the middle, abort:
        if (toName !== shell.currentRoute.name)
            return;
        
        // Its ready; maybe it was but sub-location
        // or state change need to be communicated
        shell.emit(shell.events.itemReady, $to, state);
        
        this.enableAccess();
        
        hideit();
    }
};

/**
    Initializes the list of items. No more than one
    must be opened/visible at the same time, so at the 
    init all the elements are closed waiting to set
    one as the active or the current one.
    
    Execute after DOM ready.
**/
DomItemsManager.prototype.init = function init() {
    // On ready, get the root element:
    this.$root = $(this.root || 'body');

    this.getAllItems()
    .attr('hidden', 'hidden')
    // For browser that don't support attr
    .css('display', 'none');
    
    // A layer to visually hide an opening item while not completed opened
    $('<div class="items-backstage"/>').css({
        background: this.$root.css('background-color') || 'white',
        position: 'fixed',
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
        zIndex: 0
    }).appendTo(this.$root);
    
    // A layer to disable access to an item (disabling events)
    // NOTE: Tried CSS pointer-events:none has some strange side-effects: auto scroll-up.
    // TODO: After some testing with this, scroll-up happens again with this (??)
    var $disableLayer = $('<div class="items-disable-layer"/>').css({
        background: 'White',
        opacity: 0,
        position: 'fixed',
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
        zIndex: -1
    }).appendTo(this.$root);
    this.disableAccess = function() {
        $disableLayer.css('zIndex', 90900);
    };
    this.enableAccess = function() {
        $disableLayer.css('zIndex', -2);
    };
};

},{"../escapeSelector":156}],165:[function(require,module,exports){
/**
    Javascritp Shell for SPAs.
**/
/*global window, document */
'use strict';

/** DI entry points for default builds. Most dependencies can be
    specified in the constructor settings for per-instance setup.
**/
var deps = require('./dependencies');

/** Constructor **/

function Shell(settings) {
    //jshint maxcomplexity:14
    
    deps.EventEmitter.call(this);

    this.$ = settings.jquery || deps.jquery;
    this.$root = this.$(settings.root);
    this.baseUrl = settings.baseUrl || '';
    // With forceHashbang=true:
    // - fragments URLs cannot be used to scroll to an element (default browser behavior),
    //   they are defaultPrevented to avoid confuse the routing mechanism and current URL.
    // - pressed links to fragments URLs are not routed, they are skipped silently
    //   except when they are a hashbang (#!). This way, special links
    //   that performn js actions doesn't conflits.
    // - all URLs routed through the shell includes a hashbang (#!), the shell ensures
    //   that happens by appending the hashbang to any URL passed in (except the standard hash
    //   that are skipt).
    this.forceHashbang = settings.forceHashbang || false;
    this.linkEvent = settings.linkEvent || 'click';
    this.parseUrl = (settings.parseUrl || deps.parseUrl).bind(this, this.baseUrl);
    this.absolutizeUrl = (settings.absolutizeUrl || deps.absolutizeUrl).bind(this, this.baseUrl);

    this.history = settings.history || window.history;

    this.indexName = settings.indexName || 'index';
    
    this.items = settings.domItemsManager;

    // loader can be disabled passing 'null', so we must
    // ensure to not use the default on that cases:
    this.loader = typeof(settings.loader) === 'undefined' ? deps.loader : settings.loader;
    // loader setup
    if (this.loader)
        this.loader.baseUrl = this.baseUrl;

    // Definition of events that this object can trigger,
    // its value can be customized but any listener needs
    // to keep updated to the correct event string-name used.
    // The items manipulation events MUST be triggered
    // by the 'items.switch' function
    this.events = {
        willOpen: 'shell-will-open',
        willClose: 'shell-will-close',
        itemReady: 'shell-item-ready',
        closed: 'shell-closed',
        opened: 'shell-opened'
    };
    
    /**
        A function to decide if the
        access is allowed (returns 'null')
        or not (return a state object with information
        that will be passed to the 'nonAccessName' item;
        the 'route' property on the state is automatically filled).
        
        The default buit-in just allow everything 
        by just returning 'null' all the time.
        
        It receives as parameter the state object,
        that almost contains the 'route' property with
        information about the URL.
    **/
    this.accessControl = settings.accessControl || deps.accessControl;
    // What item load on non access
    this.nonAccessName = settings.nonAccessName || 'index';
    
    // Access to the current route
    this.currentRoute = null;
    // Access to referrer/previous route
    this.referrerRoute = null;
}

// Shell inherits from EventEmitter
Shell.prototype = Object.create(deps.EventEmitter.prototype, {
    constructor: {
        value: Shell,
        enumerable: false,
        writable: true,
        configurable: true
    }
});

module.exports = Shell;


/** API definition **/

Shell.prototype.go = function go(url, state) {

    if (this.forceHashbang) {
        if (!/^#!/.test(url)) {
            url = '#!' + url;
        }
    }
    else {
        url = this.absolutizeUrl(url);
    }
    this.history.pushState(state, undefined, url);
    // pushState do NOT trigger the popstate event, so
    return this.replace(state);
};

Shell.prototype.goBack = function goBack(state, steps) {
    steps = 0 - (steps || 1);
    // If there is nothing to go-back or not enought
    // 'back' steps, go to the index
    if (steps < 0 && Math.abs(steps) >= this.history.length) {
        this.go(this.indexName);
    }
    else {
        // On replace, the passed state is merged with
        // the one that comes from the saved history
        // entry (it 'pops' when doing the history.go())
        this._pendingStateUpdate = state;
        this.history.go(steps);
    }
};

/**
    Process the given state in order to get the current state
    based on that or the saved in history, merge it with
    any updated state pending and adds the route information,
    returning an state object suitable to use.
**/
Shell.prototype.getUpdatedState = function getUpdatedState(state) {
    /*jshint maxcomplexity: 8 */
    
    // For current uses, any pendingStateUpdate is used as
    // the state, rather than the provided one
    state = this._pendingStateUpdate || state || this.history.state || {};
    
    // TODO: more advanced uses must be to use the 'state' to
    // recover the UI state, with any message from other UI
    // passing in a way that allow update the state, not
    // replace it (from pendingStateUpdate).
    /*
    // State or default state
    state = state || this.history.state || {};
    // merge pending updated state
    this.$.extend(state, this._pendingStateUpdate);
    // discard the update
    */
    this._pendingStateUpdate = null;
    
    // Doesn't matters if state includes already 
    // 'route' information, need to be overwritten
    // to match the current one.
    // NOTE: previously, a check prevented this if
    // route property exists, creating infinite loops
    // on redirections from activity.show since 'route' doesn't
    // match the new desired location
    
    // Detect if is a hashbang URL or an standard one.
    // Except if the app is forced to use hashbang.
    var isHashBang = /#!/.test(location.href) || this.forceHashbang;
    
    var link = (
        isHashBang ?
        location.hash :
        location.pathname
    ) + (location.search || '');
    
    // Set the route
    state.route = this.parseUrl(link);
    
    return state;
};

Shell.prototype._getLocationRoutedUrl = function() {
    var reg = /^#!/;
    return reg.test(window.location.hash) ? window.location.hash : window.location.pathname + window.location.search + window.location.hash;
};

/**
    Internal use only.
    Update the URL/route saved as Referrer using the current one from location.
**/
Shell.prototype._refreshReferrer = function() {
    this.referrerRoute = this.parseUrl(this._getLocationRoutedUrl());
};
Shell.prototype._refreshCurrent = function() {
    this.currentRoute = this.parseUrl(this._getLocationRoutedUrl());
};

/**
    Shortcut to history.replaceState API that keeps some internal Shell state correct.
**/
Shell.prototype.replaceState = function replaceState(state, title, url) {
    this._refreshReferrer();
    this.history.replaceState(state, title, url);
    this._refreshCurrent();
};

/**
    Shortcut to history.replaceState API that keeps some internal Shell state correct.
**/
Shell.prototype.pushState = function pushState(state, title, url) {
    this._refreshReferrer();
    this.history.pushState(state, title, url);
    this._refreshCurrent();
};

Shell.prototype.replace = function replace(state) {
    
    state = this.getUpdatedState(state);

    // Use the index on root calls
    if (state.route.root === true) {
        state.route = this.parseUrl(this.indexName);
    }
    this.referrerRoute = this.currentRoute;
    this.currentRoute = state.route;
    //console.log('shell replace', state.route);

    // Access control
    var accessError = this.accessControl(state.route);
    if (accessError) {
        return this.go(this.nonAccessName, accessError);
    }

    // Locating the container
    var $cont = this.items.find(state.route.name);
    var shell = this;
    var promise = null;

    if ($cont && $cont.length) {
        promise = new Promise(function(resolve, reject) {
            try {

                var $oldCont = shell.items.getActive();
                $oldCont = $oldCont.not($cont);
                shell.items.switch($oldCont, $cont, shell, state);
                //console.log('shell replace after switch', state.route);

                resolve(); //? resolve(act);
            }
            catch (ex) {
                reject(ex);
            }
        });
    }
    else {
        if (this.loader) {
            // load and inject the content in the page
            // then try the replace again
            promise = this.loader.load(state.route).then(function(html) {
                // Add to the items (the manager takes care you
                // add only the item, if there is one)
                shell.items.inject(state.route.name, html);
                // Double check that the item was added and is ready
                // to avoid an infinite loop because a request not returning
                // the item and the 'replace' trying to load it again, and again, and..
                if (shell.items.find(state.route.name).length)
                    return shell.replace(state);
            });
        }
        else {
            var err = new Error('Page not found (' + state.route.name + ')');
            console.warn('Shell Page not found, state:', state);
            promise = Promise.reject(err);
            
            // To avoid being in an inexistant URL (generating inconsistency between
            // current view and URL, creating bad history entries),
            // a goBack is executed, just after the current pipe ends
            // TODO: implement redirect that cut current processing rather than execute delayed
            setTimeout(function() {
                this.goBack();
            }.bind(this), 1);
        }
    }
    
    var thisShell = this;
    promise.catch(function(err) {
        if (!(err instanceof Error))
            err = new Error(err);

        // Log error, 
        console.error('Shell, unexpected error.', err);
        // notify as an event
        thisShell.emit('error', err);
        // and continue propagating the error
        return err;
    });

    return promise;
};

Shell.prototype.run = function run() {

    var shell = this;

    // Catch popstate event to update shell replacing the active container.
    // Allows polyfills to provide a different but equivalent event name
    this.$(window).on(this.history.popstateEvent || 'popstate', function(event) {
        
        var state = event.state || 
            (event.originalEvent && event.originalEvent.state) || 
            shell.history.state;

        // get state for current. To support polyfills, we use the general getter
        // history.state as fallback (they must be the same on browsers supporting History API)
        shell.replace(state);
    });

    // TODO: Review if all this next still is usable and has use cases, since the project
    // now uses fastclick library to avoid the iOS delay, using again click against tap event.
    //
    // Catch all links in the page (not only $root ones) and like-links.
    // IMPORTANT: the timeout and linkWorking is a kind of hack/workaround because of:
    // - iOS click delay: changing linkEvent to be 'tap click' (jqm tap event) or 
    //   more standard but simplistic 'touchend click', only on iOS if possible, the
    //   iOS click delay can be avoided, letting the touch event to trigger this Shell handler
    //   and preventing the click from happening to avoid double execution
    //   (thanks to linkWorking and setTimeout).
    //   A broken alternative would be to use only one event, like 'tap' or 'touchend', but
    //   they fall down when a touch gesture happens in the limit of a link/element because
    //   a touchstart happens out of our target link -failing touchend and tap since don't 
    //   get triggered in our link- but the browser/webview still executes (and inmediatly)
    //   the 'click' event on the link. It seems an edge case but is easier to make it happens
    //   than it seems. It's the bug that forced to implement this workaournd :-/
    // - And additionally: it prevents two 'clicks' from happening excessive fast because
    //   some kind of a second unwanted touch happening very fast, making
    //   a click by mistake on a different link on the loaded new page.
    var linkWorking = null,
        // OLD: iOS 300ms delay, a bit increased to avoid problems.
        // NOTE: as of inclusion of fastclick in the main project, reduced
        // this delay to avoid being noticeable on some edge cases, but still
        // preserving because other not verified use cases (like on a touch on a link that dynamically
        // changes being perceived as two quick consecutive clicks, executing two actions in one and that being unwanted)
        linkWorkingDelay = 80; // 340; // ms
    //DEBUG var linkEvent = this.linkEvent;
    this.$(document).on(this.linkEvent, '[href], [data-href]', function(e) {
        //DEBUG console.log('Shell on event', e.type, linkWorking);
        // If working, avoid everything:
        if (linkWorking) return false;
        linkWorking = setTimeout(function() {
            linkWorking = null;
        }, linkWorkingDelay);

        var $t = shell.$(this),
            href = $t.attr('href') || $t.data('href');
        
        //DEBUG console.log('Shell on', linkEvent, e.type, 'href', href, 'element', $t);

        // Do nothing if the URL contains the protocol
        if (/^[a-z]+:/i.test(href)) {
            return;
        }
        else if (shell.forceHashbang && /^#([^!]|$)/.test(href)) {
            // Standard hash, but not hashbang: avoid routing and default behavior
            e.preventDefault();
            // Trigger special event on the shell, so external scripts can do
            // something, like trying to implement standard scroll behavior or any
            // Pass in: source fragment link, element that receive the original event and
            // the original event.
            shell.emit('fragmentNavigation', href, this, e);
            return;
        }

        e.preventDefault();

        // Executed delayed to avoid handler collisions, because
        // of the new page modifying the element and other handlers
        // reading it attributes and applying logic on the updated link
        // as if was the old one (example: shared links, like in a
        // global navbar, that modifies with the new page).
        setTimeout(function() {
            shell.go(href);
        }, 1);
    });

    // Initiallize state
    this.items.init();
    // Route to the current url/state
    this.replace();
};

},{"./dependencies":167}],166:[function(require,module,exports){
/**
    absolutizeUrl utility 
    that ensures the url provided
    being in the path of the given baseUrl
**/
'use strict';

var sanitizeUrl = require('./sanitizeUrl'),
    escapeRegExp = require('../escapeRegExp');

function absolutizeUrl(baseUrl, url) {

    // sanitize before check
    url = sanitizeUrl(url);

    // Check if use the base already
    var matchBase = new RegExp('^' + escapeRegExp(baseUrl), 'i');
    if (matchBase.test(url)) {
        return url;
    }

    // build and sanitize
    return sanitizeUrl(baseUrl + url);
}

module.exports = absolutizeUrl;

},{"../escapeRegExp":155,"./sanitizeUrl":172}],167:[function(require,module,exports){
/**
    External dependencies for Shell in a separate module
    to use as DI, needs setup before call the Shell.js
    module class
**/
'use strict';

module.exports = {
    parseUrl: null,
    absolutizeUrl: null,
    jquery: null,
    loader: null,
    accessControl: function allowAll(/*name*/) {
        // allow access by default
        return null;
    },
    EventEmitter: null
};

},{}],168:[function(require,module,exports){
/**
    Simple implementation of the History API using only hashbangs URLs,
    doesn't matters the browser support.
    Used to avoid from setting URLs that has not an end-point,
    like in local environments without a server doing url-rewriting,
    in phonegap apps, or to completely by-pass browser support because
    is buggy (like Android <= 4.1).
    
    NOTES:
    - Browser must support 'hashchange' event.
    - Browser must has support for standard JSON class.
    - Relies on sessionstorage for persistance, supported by all browsers and webviews 
      for a enough long time now.
    - Similar approach as History.js polyfill, but simplified, appending a fake query
      parameter '_suid=0' to the hash value (actual query goes before the hash, but
      we need it inside).
    - For simplification, only the state is persisted, the 'title' parameter is not
      used at all (the same as major browsers do, so is not a problem); in this line,
      only history entries with state are persisted.
      
    TODO replaceState does not work as expected, it creates a history entry rather than replace it
        A solution idea is to perform a browser go(-1) and the then hash change (push), but the go back
        must bypass the events notification.
**/
//global location
'use strict';
var $ = require('jquery'),
    sanitizeUrl = require('./sanitizeUrl'),
    getUrlQuery = require('../getUrlQuery');

// Init: Load saved copy from sessionStorage
var session = sessionStorage.getItem('hashbangHistory.store');
// Or create a new one
if (!session) {
    session = {
        // States array where each index is the SUID code and the
        // value is just the value passed as state on pushState/replaceState
        states: []
    };
}
else {
    session = JSON.parse(session);
}


/**
    Get the SUID number
    from a hash string
**/
function getSuid(hash) {
    
    var suid = +getUrlQuery(hash)._suid;
    if (isNaN(suid))
        return null;
    else
        return suid;
}

function setSuid(hash, suid) {
    
    // We need the query, since we need 
    // to replace the _suid (may exist)
    // and recreate the query in the
    // returned hash-url
    var qs = getUrlQuery(hash);
    qs.push('_suid');
    qs._suid = suid;

    var query = [];
    for(var i = 0; i < qs.length; i++) {
        query.push(qs[i] + '=' + encodeURIComponent(qs[qs[i]]));
    }
    query = query.join('&');
    
    if (query) {
        var index = hash.indexOf('?');
        if (index > -1)
            hash = hash.substr(0, index);
        hash += '?' + query;
    }

    return hash;
}

/**
    Ask to persist the session data.
    It is done with a timeout in order to avoid
    delay in the current task mainly any handler
    that acts after a History change.
**/
function persist() {
    // Enough time to allow routing tasks,
    // most animations from finish and the UI
    // being responsive.
    // Because sessionStorage is synchronous.
    setTimeout(function() {
        sessionStorage.setItem('hashbangHistory.store', JSON.stringify(session));
    }, 1500);
}

/**
    Returns the given state or null
    if is an empty object.
**/
function checkState(state) {
    
    if (state) {
        // is empty?
        if (Object.keys(state).length > 0) {
            // No
            return state;
        }
        // its empty
        return null;
    }
    // Anything else
    return state;
}

/**
    Get a canonical representation
    of the URL so can be compared
    with success.
**/
function cannonicalUrl(url) {
    
    // Avoid some bad or problematic syntax
    url = sanitizeUrl(url || '');
    
    // Get the hash part
    var ihash = url.indexOf('#');
    if (ihash > -1) {
        url = url.substr(ihash + 1);
    }
    // Maybe a hashbang URL, remove the
    // 'bang' (the hash was removed already)
    url = url.replace(/^!/, '');

    return url;
}

/**
    Tracks the latest URL
    being pushed or replaced by
    the API.
    This allows later to avoid
    trigger the popstate event,
    since must NOT be triggered
    as a result of that API methods
**/
var latestPushedReplacedUrl = null;

/**
    History Polyfill
**/
var hashbangHistory = {
    pushState: function pushState(state, title, url) {

        // cleanup url
        url = cannonicalUrl(url);
        
        // save new state for url
        state = checkState(state) || null;
        if (state !== null) {
            // save state
            session.states.push(state);
            var suid = session.states.length - 1;
            // update URL with the suid
            url = setSuid(url, suid);
            // call to persist the updated session
            persist();
        }
        
        latestPushedReplacedUrl = url;
        
        // update location to track history:
        location.hash = '#!' + url;
    },
    replaceState: function replaceState(state, title, url) {
        
        // cleanup url
        url = cannonicalUrl(url);
        
        // it has saved state?
        var suid = getSuid(url),
            hasOldState = suid !== null;

        // save new state for url
        state = checkState(state) || null;
        // its saved if there is something to save
        // or something to destroy
        if (state !== null || hasOldState) {
            // save state
            if (hasOldState) {
                // replace existing state
                session.states[suid] = state;
                // the url remains the same
            }
            else {
                // create state
                session.states.push(state);
                suid = session.states.length - 1;
                // update URL with the suid
                url = setSuid(url, suid);
            }
            // call to persist the updated session
            persist();
        }
        
        latestPushedReplacedUrl = url;

        // update location to track history:
        location.hash = '#!' + url;
    },
    get state() {
        
        var suid = getSuid(location.hash);
        return (
            suid !== null ?
            session.states[suid] :
            null
        );
    },
    get length() {
        return window.history.length;
    },
    go: function go(offset) {
        window.history.go(offset);
    },
    back: function back() {
        window.history.back();
    },
    forward: function forward() {
        window.history.forward();
    }
};

// Attach hashcange event to trigger History API event 'popstate'
var $w = $(window);
$w.on('hashchange', function(e) {
    
    var url = e.originalEvent.newURL;
    url = cannonicalUrl(url);
    
    // An URL being pushed or replaced
    // must NOT trigger popstate
    if (url === latestPushedReplacedUrl)
        return;
    
    // get state from history entry
    // for the updated URL, if any
    // (can have value when traversing
    // history).
    var suid = getSuid(url),
        state = null;
    
    if (suid !== null)
        state = session.states[suid];

    $w.trigger(new $.Event('popstate', {
        state: state
    }), 'hashbangHistory');
});

// For HistoryAPI capable browsers, we need
// to capture the native 'popstate' event that
// gets triggered on our push/replaceState because
// of the location change, but too on traversing
// the history (back/forward).
// We will lock the event except when is
// the one we trigger.
//
// NOTE: to this trick to work, this must
// be the first handler attached for this
// event, so can block all others.
// ALTERNATIVE: instead of this, on the
// push/replaceState methods detect if
// HistoryAPI is native supported and
// use replaceState there rather than
// a hash change.
$w.on('popstate', function(e, source) {
    
    // Ensuring is the one we trigger
    if (source === 'hashbangHistory')
        return;
    
    // In other case, block:
    e.preventDefault();
    e.stopImmediatePropagation();
});

// Expose API
module.exports = hashbangHistory;

},{"../getUrlQuery":159,"./sanitizeUrl":172}],169:[function(require,module,exports){
/**
    Default build of the Shell component.
    It returns the Shell class as a module property,
    setting up the built-in modules as its dependencies,
    and the external 'jquery' and 'events' (for the EventEmitter).
    It returns too the built-it DomItemsManager class as a property for convenience.
**/
'use strict';

var deps = require('./dependencies'),
    DomItemsManager = require('./DomItemsManager'),
    parseUrl = require('./parseUrl'),
    absolutizeUrl = require('./absolutizeUrl'),
    $ = require('jquery'),
    loader = require('./loader'),
    EventEmitter = require('events').EventEmitter;

$.extend(deps, {
    parseUrl: parseUrl,
    absolutizeUrl: absolutizeUrl,
    jquery: $,
    loader: loader,
    EventEmitter: EventEmitter
});

// Dependencies are ready, we can load the class:
var Shell = require('./Shell');

exports.Shell = Shell;
exports.DomItemsManager = DomItemsManager;

},{"./DomItemsManager":164,"./Shell":165,"./absolutizeUrl":166,"./dependencies":167,"./loader":170,"./parseUrl":171,"events":false}],170:[function(require,module,exports){
/**
    Loader utility to load Shell items on demand with AJAX
**/
'use strict';

var $ = require('jquery');

module.exports = {
    
    baseUrl: '/',
    
    load: function load(route) {
        return new Promise(function(resolve, reject) {
            console.log('Shell loading on demand', route.name, route);
            $.ajax({
                url: module.exports.baseUrl + route.name + '.html',
                cache: false
                // We are loading the program and no loader screen in place,
                // so any in between interaction will be problematic.
                //async: false
            }).then(resolve, reject);
        });
    }
};

},{}],171:[function(require,module,exports){
/**
    parseUrl function detecting
    the main parts of the URL in a
    convenience way for routing.
**/
'use strict';

var getUrlQuery = require('../getUrlQuery'),
    escapeRegExp = require('../escapeRegExp');

function parseUrl(baseUrl, link) {

    link = link || '';

    var rawUrl = link;

    // hashbang support: remove the #! or single # and use the rest as the link
    link = link.replace(/^#!/, '').replace(/^#/, '');
    
    // remove optional initial slash or dot-slash
    link = link.replace(/^\/|^\.\//, '');

    // URL Query as an object, empty object if no query
    var query = getUrlQuery(link || '?');

    // remove query from the rest of URL to parse
    link = link.replace(/\?.*$/, '');

    // Remove the baseUrl to get the app base.
    var path = link.replace(new RegExp('^' + escapeRegExp(baseUrl), 'i'), '');

    // Get first segment or page name (anything until a slash or extension beggining)
    var match = /^\/?([^\/\.]+)[^\/]*(\/.*)*$/.exec(path);

    var parsed = {
        root: true,
        name: null,
        segments: null,
        path: null,
        url: rawUrl,
        query: query
    };

    if (match) {
        parsed.root = false;
        if (match[1]) {
            parsed.name = match[1];

            if (match[2]) {
                parsed.path = match[2];
                parsed.segments = match[2].replace(/^\//, '').split('/');
            }
            else {
                parsed.path = '/';
                parsed.segments = [];
            }
        }
    }

    return parsed;
}

module.exports = parseUrl;
},{"../escapeRegExp":155,"../getUrlQuery":159}],172:[function(require,module,exports){
/**
    sanitizeUrl utility that ensures
    that problematic parts get removed.
    
    As for now it does:
    - removes parent directory syntax
    - removes duplicated slashes
**/
'use strict';

function sanitizeUrl(url) {
    return url.replace(/\.{2,}/g, '').replace(/\/{2,}/g, '/');
}

module.exports = sanitizeUrl;
},{}],173:[function(require,module,exports){
/**
    snapPoints.
    
    Allows to register for a jQuery element a series of
    scroll vertical positions (aka 'snap points') that
    will trigger a custom event (providing a name per snap point)
    that will be triggered then a scroll changes the
    current relative position with that point, being
    the relation 'before', 'after' or 'there'.
    Only triggers when there is a change (it remember previous registered
    state).
    
    The execution of each check on scrolling is throttle to avoid burst,
    being the precision of that throttle configurable throught the third
    parameter (in milliseconds). By default has a value that 'teorically'
    can enable reactions at 60fps.
    Can be completely disabled by passing 0 as precision, and the event
    will be triggered synchronously when scroll happens.
    
    TODO Allow horizontal points
**/

var $ = require('jquery'),
    throttle = require('iagosrl/throttle');

module.exports = function snapPoints($scrollerElement, points, precision) {
    //jshint maxcomplexity:8
    if (!points || !Object.keys(points).length) return;
    $scrollerElement = $scrollerElement || $(window);
    // 60fps precision by default
    precision = precision === 0 ? 0 : Math.abs(precision |0) || 16;
    
    var record = {};

    var checkScroll = function() {
        var top = $scrollerElement.scrollTop();
        Object.keys(points).forEach(function(point) {
            //jshint maxcomplexity:8
            point = point |0;
            var type;
            if (point === top) {
                if (record[point] !== 'there')
                    type = 'there';
            }
            else if (top > point) {
                if (record[point] !== 'after')
                    type = 'after';
            }
            else {
                if (record[point] !== 'before')
                    type = 'before';
            }
            if (type) {
                $scrollerElement.trigger(points[point], [type]);
                record[point] = type;
            }
        });
    };
    if (precision > 0)
        checkScroll = throttle(checkScroll , precision);

    $scrollerElement.scroll(checkScroll);
    // First time check
    checkScroll();
};

},{}],174:[function(require,module,exports){
/**
    Small utility to search a text fragment using
    case insensitive, accent/symbol insensitive.
**/
'use strict';

var removeAccent = require('./removeAccent');

module.exports = function textSearch(search, text) {

    var s = removeAccent(search || '').toLowerCase(),
        t = removeAccent(text || '').toLowerCase();

    return t.indexOf(s) > -1;
};

},{"./removeAccent":162}],175:[function(require,module,exports){
/** AppointmentCard view model.
    It provides data and method to visualize and 
    edit and appointment card, with booking, event
    or placeholder information
**/

var ko = require('knockout'),
    moment = require('moment'),
    getObservable = require('../utils/getObservable'),
    Appointment = require('../models/Appointment'),
    AppointmentView = require('../viewmodels/AppointmentView'),
    ModelVersion = require('../utils/ModelVersion'),
    getDateWithoutTime = require('../utils/getDateWithoutTime'),
    PricingSummaryDetail = require('../models/PricingSummaryDetail');

function AppointmentCardViewModel(params) {
    /*jshint maxstatements: 40*/

    this.sourceItem = getObservable(params.sourceItem);
    var app = this.app = ko.unwrap(params.app);

    this.editMode = getObservable(params.editMode);
    this.editedVersion = ko.observable(null);
    
    this.isSaving = ko.observable(false);
    this.isLoading = getObservable(params.isLoading);
    this.isLocked = ko.computed(function() {
        return this.isSaving() || this.isLoading();
    }, this);
    
    this.item = ko.observable(AppointmentView(this.sourceItem(), app));
    
    this.allowBookUnavailableTime = ko.observable(false);
    
    this.currentID = ko.pureComputed(function() {
        var it = this.item();
        return it && it.id() || 0;
    }, this);
    
    this.currentDatetime = ko.pureComputed(function() {
        return this.item() && this.item().startTime() || new Date();
    }, this);
    
    this.currentDate = ko.pureComputed(function() {
        return getDateWithoutTime(this.item() && this.item().startTime());
    }, this);
    
    this.isNew = ko.computed(function() {
        var id = this.currentID();
        return id === Appointment.specialIds.newBooking || id === Appointment.specialIds.newEvent;
    }, this);
    
    this.isBooking = ko.computed(function() {
        return this.item() && this.item().sourceBooking();
    }, this);
    
    /* Return true if is an event object but not a booking */
    this.isEvent = ko.computed(function() {
        return this.item() && this.item().sourceEvent() && !this.item().sourceBooking();
    }, this);
    
    this.headerClass = ko.pureComputed(function() {
        return (
            this.isBooking() ? (this.editMode() ? 'Card-title--warning' : 'Card-title--primary') :
            this.isEvent() ? 'Card-title--danger' :
            ''
        );
    }, this);
    
    this.newAppointmentVisible = ko.pureComputed(function() {
        var id = this.currentID();
        return id === Appointment.specialIds.free || id === Appointment.specialIds.emptyDate || id === Appointment.specialIds.unavailable;
    }, this);
    
    this.editScheduleVisible = ko.pureComputed(function() {
        return this.currentID() === Appointment.specialIds.unavailable;
    }, this);
    
    this.submitText = ko.pureComputed(function() {
        var v = this.editedVersion();
        return (
            this.isLoading() ? 
                'Loading...' : 
                this.isSaving() ? 
                    'Saving changes' : 
                    v && v.areDifferent() ?
                        this.isNew() && this.isBooking() ?
                            'Book' :
                            'Save changes'
                        : 'Saved'
        );
    }, this);

    /**
        If the sourceItem changes, is set as the item value
        discarding any model version and reverting
        editMode to false
    **/
    this.sourceItem.subscribe(function(sourceItem) {
        this.item(AppointmentView(sourceItem, app));
        this.editedVersion(null);
        this.editMode(false);

        // If the new item is a new one, set edit mode
        if (this.isNew()) {
            this.editMode(true);
        }
    }, this);

    /**
        Enter and finish edit:
        Create version and save data
    **/
    this.editMode.subscribe(function(isEdit) {
        if (this.currentID() <= 0 && !this.isNew()) {
            return;
        }
        if (isEdit) {
            // Create and set a version to be edited
            var version = new ModelVersion(this.sourceItem());
            version.version.sourceEvent(this.sourceItem().sourceEvent());
            version.version.sourceBooking(this.sourceItem().sourceBooking());
            this.editedVersion(version);
            this.item(AppointmentView(version.version, app));
            
            if (this.isNew() && this.isEvent()) {
                // Some defaults for events
                this.item().sourceEvent().availabilityTypeID(0); // Unavailable
                this.item().isAllDay(false);
                this.item().sourceEvent().eventTypeID(3); // Appointment/block-time
                this.item().summary('');
            }
        }
        else {
            this.item(AppointmentView(this.sourceItem(), app));
        }
    }, this);

    this.edit = function edit() {
        if (this.isLocked()) return;

        // A subscribed handler ensure to do the needed tasks
        this.editMode(true);
    }.bind(this);
    
    this.save = function save() {
        if (this.isLocked()) return;

        // There is a version? Push changes!
        var version = this.editedVersion();

        if (version && version.areDifferent()) {
            this.isSaving(true);
            app.model.calendar.setAppointment(version.version, this.allowBookUnavailableTime())
            .then(function(savedApt) {
                // Do not do a version push, just update with remote
                //version.push({ evenIfObsolete: true });
                // Update with remote data, the original appointment in the version,
                // not the currentAppointment or in the index in the list to avoid
                // race-conditions
                version.original.model.updateWith(savedApt);
                // Do a pull so original and version gets the exact same data
                version.pull({ evenIfNewer: true });

                // Go out edit mode
                this.editMode(false);
                
                // Notify
                if (this.isBooking()) {
                    
                    var msg = this.item().client().firstName() + ' will receive an e-mail confirmation.';
                    
                    app.modals.showNotification({
                        title: 'Confirmed!',
                        message: msg
                    });
                }
                
            }.bind(this))
            .catch(function(err) {
                // The version data keeps untouched, user may want to retry
                // or made changes on its un-saved data.
                // Show error
                app.modals.showError({
                    title: 'There was an error saving the data.',
                    error: err
                });
                // Don't replicate error, allow always
            })
            .then(function() {
                // ALWAYS:
                this.isSaving(false);
            }.bind(this));
        }
    }.bind(this);

    this.cancel = function cancel() {
        if (this.isLocked()) return;

        if (this.editedVersion()) {
            // Discard previous version
            this.editedVersion().pull({ evenIfNewer: true });
        }
        // Out of edit mode
        this.editMode(false);
    }.bind(this);
    
    this.confirmCancel = function confirmCancel() {
        this.app.modals.confirm({
            title: 'Cancel',
            message: 'Are you sure?',
            yes: 'Yes',
            no: 'No'
        })
        .then(function() {
            // Confirmed cancellation:
            this.cancel();
        }.bind(this));
    }.bind(this);

    /**
        External actions
    **/
    var editFieldOn = function editFieldOn(activity, data) {

        // Include appointment to recover state on return:
        data.appointment = this.item().model.toPlainObject(true);
        
        data.cancelLink = this.cancelLink;
        
        if (this.progress &&
            !this.progress.ended) {
            data.progress = this.progress;
            var step = data.progress.step || 1,
                total = data.progress.total || 1;
            // TODO I18N
            data.title = step + ' of ' + total;
            data.navTitle = null;
        } else {
            // keep data.progress so it does not restart the process after
            // an edition. The passIn already resets that on new calls
            data.progress = this.progress;
            // Edition title:
            data.title = null;
            data.navTitle = this.isBooking() ? 'Booking' : 'Event';
        }

        app.shell.go(activity, data);
    }.bind(this);

    this.pickDateTime = function pickDateTime() {
        if (this.isLocked()) return;

        editFieldOn('datetimePicker', {
            selectedDatetime: this.item().startTime(),
            datetimeField: 'startTime',
            headerText: 'Select the start time',
            requiredDuration: this.item().getServiceDurationMinutes()
        });
    }.bind(this);

    this.pickEndDateTime = function pickEndDateTime() {
        if (this.isLocked()) return;

        editFieldOn('datetimePicker', {
            selectedDatetime: this.item().endTime(),
            datetimeField: 'endTime',
            headerText: 'Select the end time'
        });
    }.bind(this);

    this.pickClient = function pickClient() {
        if (this.isLocked()) return;

        editFieldOn('clients', {
            selectClient: true,
            selectedClientID: this.item().sourceBooking().clientUserID()
        });
    }.bind(this);

    this.pickService = function pickService() {
        if (this.isLocked()) return;

        editFieldOn('serviceProfessionalService/' + this.item().jobTitleID(), {
            selectPricing: true,
            selectedServices: this.item().pricing()
            .map(function(pricing) {
                return {
                    serviceProfessionalServiceID: ko.unwrap(pricing.serviceProfessionalServiceID),
                    totalPrice: ko.unwrap(pricing.totalPrice)
                };
            })
        });
    }.bind(this);

    this.changePrice = function changePrice() {
        if (this.isLocked()) return;
        // TODO
    }.bind(this);

    this.pickLocation = function pickLocation() {
        if (this.isLocked()) return;

        editFieldOn('serviceAddresses/' + this.item().jobTitleID(), {
            selectAddress: true,
            selectedAddressID: this.item().addressID()
        });
    }.bind(this);

    var textFieldsHeaders = {
        preNotesToClient: 'Notes to client',
        postNotesToClient: 'Notes to client (afterwards)',
        preNotesToSelf: 'Notes to self',
        postNotesToSelf: 'Booking summary',
        summary: 'What?'
    };

    this.editTextField = function editTextField(field) {
        if (this.isLocked()) return;

        editFieldOn('textEditor', {
            request: 'textEditor',
            field: field,
            title: this.isNew() ? 'New booking' : 'Booking',
            header: textFieldsHeaders[field],
            text: this.item()[field]()
        });
    }.bind(this);
    
    // pass this ready model view as an API to the outside
    if (typeof(params.api) === 'function') {
        params.api(this);
    }
    
    // Calculate the endTime given an appointment duration, retrieved
    // from the selected service
    ko.computed(function calculateEndTime() {
        var duration = this.item().serviceDurationMinutes(),
            start = moment(this.item().startTime()),
            end;

        if (this.isBooking() &&
            start.isValid()) {
            end = start.add(duration, 'minutes').toDate();
            this.item().endTime(end);
        }
    }, this)
    .extend({ rateLimit: { method: 'notifyWhenChangesStop', timeout: 20 } });
}

/**
    It manages incoming data provided by external activities given
    the requestData received by the activity hosting this view instance.
    Used to manage the data returned by calls to edit data in
    external activities.
**/
AppointmentCardViewModel.prototype.passIn = function passIn(requestData) {
    /*jshint maxcomplexity:20,maxstatements:40 */
    
    // If the request includes an appointment plain object, that's an
    // in-editing appointment so put it in place (to restore a previous edition)
    if (requestData.appointment) {
        // Set the edit mode (it performs any required
        // set-up if we are not still in edit mode).
        this.editMode(true);
        // Sets the data
        this.item()
        .model.updateWith(requestData.appointment);
    }
    else if (!this.isNew()) {
        // On any other case, and to prevent a bad editMode state,
        // set off edit mode discarding unsaved data:
        this.cancel();
    }

    /// Manage specific single data from externally provided
    
    // It comes back from the textEditor.
    if (requestData.request === 'textEditor') {
        this.item()[requestData.field](requestData.text);
    }
    if (requestData.selectClient === true) {
        this.item().clientUserID(requestData.selectedClientID);
    }
    if (typeof(requestData.selectedDatetime) !== 'undefined') {
        var field = requestData.datetimeField;
        this.item()[field](requestData.selectedDatetime);
        this.allowBookUnavailableTime(requestData.allowBookUnavailableTime);
    }
    if (requestData.selectedJobTitleID) {
        this.item().jobTitleID(requestData.selectedJobTitleID);
    }
    if (requestData.selectAddress === true) {
        this.item().addressID(requestData.selectedAddressID);
    }
    if (requestData.selectPricing === true) {
        this.item().pricing(
            requestData.selectedServices.map(function(pricing) {
                return new PricingSummaryDetail(pricing);
            })
        );
    }
    
    if (this.isNew()) {
        if (requestData && requestData.cancelLink) {
            this.cancelLink = requestData.cancelLink;
        }
        else {
            // Using the Referrer URL as the link when cancelling the task
            var referrerUrl = this.app.shell.referrerRoute;
            referrerUrl = referrerUrl && referrerUrl.url || 'calendar';

            this.cancelLink = referrerUrl;
        }
    }

    // Special behavior for adding a booking: it requires a guided creation
    // through a progress path
    if (this.currentID() === Appointment.specialIds.newBooking) {
        if (!requestData.progress) {
            // Start!
            this.progress = {
                step: 1,
                total: 4,
                ended: false
            };
            // First step
            this.pickClient(); //._delayed(50)();
        }
        else if (requestData.progress) {
            this.progress = requestData.progress;
            var step = this.progress.step || 1;
            if (step < 2) {
                // Second step
                this.progress.step = 2;
                this.pickService();//._delayed(50)();
            }
            else if (step < 3) {
                // Thrid step
                requestData.progress.step = 3;
                this.pickDateTime();//._delayed(50)();
            }
            else if (step < 4) {
                requestData.progress.step = 4;
                this.pickLocation();//._delayed(50)();
            }
            else {
                // Steps finished, not it enters in revision mode before
                // finally save/create the booking, but remove the progress info
                // to avoid problems editing fields.
                this.progress.ended = true;
            }
        }
    } else {
        // Reset progress
        this.progress = null;
    }
};


module.exports = AppointmentCardViewModel;

},{"../models/Appointment":96,"../models/PricingSummaryDetail":116,"../utils/ModelVersion":145,"../utils/getDateWithoutTime":157,"../utils/getObservable":158,"../viewmodels/AppointmentView":176,"knockout":false,"moment":false}],176:[function(require,module,exports){
/**
    Appointment View model that wraps an Appointment
    model instance extended with extra methods connected
    to related data
**/
'use strict';

var ko = require('knockout');

module.exports = function AppointmentView(appointment, app) {
    if (appointment._isAppointmentView) return appointment;
    appointment._isAppointmentView = true;

    appointment.client = ko.computed(function() {
        var b = this.sourceBooking();
        if (!b) return null;
        
        var cid = this.clientUserID();
        if (cid) {
            return app.model.clients.getObservableItem(cid, true)();
        }
        return null;
    }, appointment)
    .extend({ rateLimit: { method: 'notifyWhenChangesStop', timeout: 20 } });
    
    appointment.address = ko.computed(function() {
        var aid = this.addressID(),
            jid = this.jobTitleID();
        if (aid && jid) {
            return app.model.serviceAddresses.getObservableItem(jid, aid, true)();
        }
        return null;
    }, appointment)
    .extend({ rateLimit: { method: 'notifyWhenChangesStop', timeout: 20 } });

    appointment.addressSummary = ko.computed(function() {
        var eventData = this.sourceEvent();
        var add = this.address();
        return add && add.singleLine() || eventData && eventData.location() || '';
    }, appointment)
    .extend({ rateLimit: { method: 'notifyWhenChangesStop', timeout: 20 } });
    
    /* Property with the pricing array plus information about the
        serviceProfessionalService.
    */
    appointment.pricingWithInfo = ko.computed(function() {
        var b = this.sourceBooking();
        if (!b) return [];

        var jid = this.jobTitleID(),
            details = this.pricing();

        return details.map(function(det) {
            return PricingSummaryDetailView(det, jid, app);
        });
    }, appointment)
    .extend({ rateLimit: { method: 'notifyWhenChangesStop', timeout: 60 } });

    appointment.servicesSummary = ko.computed(function() {
        return this.pricingWithInfo()
        .map(function(service) {
            return service.serviceProfessionalService().name();
        }).join(', ');
    }, appointment)
    .extend({ rateLimit: { method: 'notifyWhenChangesStop', timeout: 20 } });
    
    // ServiceDuration as function, because is needed for cases when cannot wait for the 
    // rated computed
    appointment.getServiceDurationMinutes = function() {
        var pricing = this.pricingWithInfo();
        var sum = pricing.reduce(function(prev, service) {
            return prev + service.serviceProfessionalService().serviceDurationMinutes();
        }, 0);
        return sum;
    };
    // ServiceDuration as computed so can be observed for changes
    appointment.serviceDurationMinutes = ko.computed(function() {
        return this.getServiceDurationMinutes();
    }, appointment)
    .extend({ rateLimit: { method: 'notifyWhenChangesStop', timeout: 20 } });
    
    ko.computed(function() {
        var pricing = appointment.pricing();
        this.price(pricing.reduce(function(prev, cur) {
            return prev + cur.price();
        }, 0));
    }, appointment)
    .extend({ rateLimit: { method: 'notifyWhenChangesStop', timeout: 20 } });

    return appointment;
};

function PricingSummaryDetailView(pricingSummaryDetail, jobTitleID, app) {

    pricingSummaryDetail.serviceProfessionalService = ko.computed(function() {
        var pid = this.serviceProfessionalServiceID();
        return app.model.serviceProfessionalServices
            .getObservableItem(jobTitleID, pid, true)();
    }, pricingSummaryDetail)
    .extend({ rateLimit: { method: 'notifyWhenChangesStop', timeout: 20 } });

    return pricingSummaryDetail;
}

},{"knockout":false}],177:[function(require,module,exports){
/**
    BookingProgress
**/
'use strict';

var Model = require('../models/Model'),
    ko = require('knockout');

function BookingProgress(values) {
    Model(this);

    this.model.defProperties({
        step: 0,
        stepsList: [],
        ended: false
    }, values);
    
    this.totalSteps = ko.pureComputed(function() {
        return this.stepsList().length;
    }, this);
    
    this.currentStep = ko.pureComputed(function() {
        return this.stepsList()[this.step()];
    }, this);
}

module.exports = BookingProgress;

BookingProgress.prototype.next = function() {
    var step = Math.max(0, Math.min(this.step() + 1, this.totalSteps() - 1));
    
    this.step(step);
};

BookingProgress.prototype.observeStep = function(stepName) {
    return ko.pureComputed(function() {
        return this.isStep(stepName);
    }, this);
};

BookingProgress.prototype.isStep = function(stepName) {
    return this.stepsList()[this.step()] === stepName;
};

/*
BookingProgress.prototype.getRequestData = function() {
    
    var data = {
        progress: {}
    };
    
    if (!this.ended()) {

        var step = data.step() || 1,
            total = data.totalSteps() || 1;
        // TODO I18N
        data.title = step + ' of ' + total;
        data.navTitle = null;
    } else {
        // Edition title:
        data.title = null;
        data.navTitle = 'Booking';
    }

    return data;
};
*/
},{"../models/Model":113,"knockout":false}],178:[function(require,module,exports){
/**
    Simple View Model with main credentials for
    use in a form, with validation.
    Used by Login and Signup activities
**/
'use strict';

var ko = require('knockout');

function FormCredentials() {

    this.username = ko.observable('');
    this.password = ko.observable('');
    
    // validate username as an email
    var emailRegexp = /^[-0-9A-Za-z!#$%&'*+/=?^_`{|}~.]+@[-0-9A-Za-z!#$%&'*+/=?^_`{|}~.]+$/;
    this.username.error = ko.observable('');
    this.username.subscribe(function(v) {
        if (v) {
            if (emailRegexp.test(v)) {
                this.username.error('');
            }
            else {
                this.username.error('Is not a valid email');
            }
        }
        else {
            this.username.error('Required');
        }
    }.bind(this));
    
    // required password
    this.password.error = ko.observable('');
    this.password.subscribe(function(v) {
        var err = '';
        if (!v)
            err = 'Required';
        
        this.password.error(err);
    }.bind(this));
}

module.exports = FormCredentials;

},{"knockout":false}],179:[function(require,module,exports){
/** NavAction view model.
    It allows set-up per activity for the AppNav action button.
**/
var Model = require('../models/Model');

function NavAction(values) {
    
    Model(this);
    
    this.model.defProperties({
        link: '',
        icon: '',
        text: '',
        // 'Test' is the header title but placed in the button/action
        isTitle: false,
        // 'Link' is the element ID of a modal (starts with a #)
        isModal: false,
        // 'Link' is a Shell command, like 'goBack 2'
        isShell: false,
        // Set if the element is a menu button, in that case 'link'
        // will be the ID of the menu (contained in the page; without the hash), using
        // the text and icon but special meaning for the text value 'menu'
        // on icon property that will use the standard menu icon.
        isMenu: false,
        // Custom function as event handler for button click.
        // The standard link gets disabled with this
        handler: null
    }, values);
    
    this.runHandler = function runHandler(obj, event) {
        var handler = this.handler();
        if (handler) {
            event.stopImmediatePropagation();
            event.preventDefault();
            handler.call(this, event, obj);
        }
    }.bind(this);
}

module.exports = NavAction;

// Set of view utilities to get the link for the expected html attributes

NavAction.prototype.getHref = function getHref() {
    return (
        (this.handler() || this.isMenu() || this.isModal() || this.isShell()) ?
        '#' :
        this.link()
    );
};

NavAction.prototype.getModalTarget = function getModalTarget() {
    return (
        (this.handler() || this.isMenu() || !this.isModal() || this.isShell()) ?
        '' :
        this.link()
    );
};

NavAction.prototype.getShellCommand = function getShellCommand() {
    return (
        (this.handler() || this.isMenu() || !this.isShell()) ?
        '' :
        this.link()
    );
};

NavAction.prototype.getMenuID = function getMenuID() {
    return (
        (this.handler() || !this.isMenu()) ?
        '' :
        this.link()
    );
};

NavAction.prototype.getMenuLink = function getMenuLink() {
    return (
        (this.handler() || !this.isMenu()) ?
        '' :
        '#' + this.link()
    );
};

/** Static, shared actions **/
NavAction.goHome = new NavAction({
    link: '/',
    icon: 'fa ion ion-stats-bars'
});

NavAction.goBack = new NavAction({
    link: 'goBack',
    icon: 'fa ion ion-ios-arrow-left',
    isShell: true
});

NavAction.menuIn = new NavAction({
    link: 'menuIn',
    icon: 'menu',
    isMenu: true
});

NavAction.menuOut = new NavAction({
    link: 'menuOut',
    icon: 'menu',
    isMenu: true
});

NavAction.menuNewItem = new NavAction({
    link: 'menuNewItem',
    icon: 'fa ion ion-ios-plus-empty',
    isMenu: true
});

NavAction.goHelpIndex = new NavAction({
    link: '#helpIndex',
    text: 'help',
    isModal: true
});

NavAction.goLogin = new NavAction({
    link: '/login',
    text: 'log-in'
});

NavAction.goLogout = new NavAction({
    link: '/logout',
    text: 'log-out'
});

NavAction.goSignup = new NavAction({
    link: '/signup',
    text: 'sign-up'
});

},{"../models/Model":113}],180:[function(require,module,exports){
/** NavBar view model.
    It allows customize the NavBar per activity.
**/
var Model = require('../models/Model'),
    NavAction = require('./NavAction');

function NavBar(values) {
    
    Model(this);
    
    this.model.defProperties({
        // Title showed in the center
        // When the title is 'null', the app logo is showed in place,
        // on empty text, the empty text is showed and no logo.
        title: '',
        leftAction: {
            Model: NavAction
        },
        rightAction: {
            Model: NavAction
        },
        hidden: false
    }, values);
}

module.exports = NavBar;

},{"../models/Model":113,"./NavAction":179}],181:[function(require,module,exports){
/** OnboardingProgress view model.
    It tracks the onboarding information and methods
    to update views to that state
**/
var Model = require('../models/Model'),
    ko = require('knockout');

function OnboardingProgress(values) {

    Model(this);
    
    this.model.defProperties({
        group: '',
        stepNumber: -1,
        steps: []
    }, values);
    
    this.totalSteps = ko.pureComputed(function() {
        // 'Zero' step is a welcome, not accounted:
        return this.steps().length - 1;
    }, this);
    
    this.stepName = ko.pureComputed(function() {
        var num = this.stepNumber(),
            tot = this.steps().length;

        if (tot > 0 &&
            num > -1 &&
            num < tot) {
            var name = this.steps()[num] || '';
            return name;
        }
        else {
            return null;
        }
    }, this);
    
    this.stepUrl = ko.pureComputed(function() {
        var url = this.stepName();
        if (url && !/^\//.test(url))
            url = '/' + url;
        return url;
    }, this);

    this.stepReference = ko.pureComputed(function() {
        return this.group() + ':' + this.stepName();
    }, this);
    
    this.progressText = ko.pureComputed(function() {
        // TODO L18N
        return this.stepNumber() + ' of ' + this.totalSteps();
    }, this);
    
    this.inProgress = ko.pureComputed(function() {
        return !!this.stepUrl();
    }, this);
}

module.exports = OnboardingProgress;

OnboardingProgress.prototype.setStepByName = function setStepByName(name) {
    var stepIndex = this.steps().indexOf(name);
    if (stepIndex > -1) {
        this.stepNumber(stepIndex);
        return true;
    }
    return false;
};

/**
    Static list of all the steps groups for the app
**/
OnboardingProgress.predefinedStepGroups = {
    // Scheduling onboarding, aka welcome
    welcome: [
        'welcome',
        'addJobTitles',
        // disabled on 2015-06-16 as of #575 comments
        //'serviceProfessionalService',
        //'serviceAddresses',
        'weeklySchedule',
        'contactInfo'
    ],
    marketplace: [
    ],
    payment: [
    ]
};

},{"../models/Model":113,"knockout":false}],182:[function(require,module,exports){
/**
    ServiceAddressesViewModel
**/
'use strict';

var ko = require('knockout');

function ServiceAddressesViewModel() {
    
    // Especial mode when instead of pick and edit we are just selecting
    // (when editing an appointment)
    this.isSelectionMode = ko.observable(false);

    this.sourceAddresses = ko.observableArray([]);
    this.addresses = ko.computed(function() {
        var list = this.sourceAddresses();
        if (this.isSelectionMode()) {
            // Filter by service addresses (excluding service area)
            list = list.filter(function(add) {
                return add.isServiceLocation();
            });
        }
        return list;
    }, this);
    
    this.selectedAddress = ko.observable(null);

    this.selectAddress = function(selectedAddress, event) {
        this.selectedAddress(selectedAddress);
        event.preventDefault();
        event.stopImmediatePropagation();
    }.bind(this);
    
    this.observerSelected = function(item) {
        return ko.pureComputed(function() {
            //return this.selectedAddress() === item;
            var sid = this.selectedAddress() && ko.unwrap(this.selectedAddress().addressID),
                iid = item && ko.unwrap(item.addressID);
            return sid === iid;
        }, this);
    }.bind(this);
}

module.exports = ServiceAddressesViewModel;

},{"knockout":false}],183:[function(require,module,exports){
/**
    ServiceProfessionalInfo component, shows public information
    about a serviceProfessional in a short card.
**/
'use strict';

var Model = require('../models/Model'),
    UserJobTitle = require('../models/UserJobTitle'),
    ko = require('knockout');

function ServiceProfessionalInfoVM(values) {
    Model(this);

    this.model.defProperties({
        serviceProfessionalID: 0,
        jobTitleID: 0,
        modClasses: 0,
        profile: {
            Model: UserPublicProfile
        },
        jobTitle: {
            Model: UserJobTitle
        },
        siteUrl: ''
    }, values);

    this.photoUrl = ko.pureComputed(function() {
        return this.siteUrl() + '/en-US/Profile/Photo/' + this.serviceProfessionalID();
    }, this);
}

module.exports = ServiceProfessionalInfoVM;

function UserPublicProfile(values) {
    Model(this);

    this.model.defProperties({
        firstName: '',
        lastName: '',
        secondLastName: '',
        businessName: '',

        hasPhotoUrl: false,
        isServiceProfessional: false
    }, values);

    this.fullName = ko.pureComputed(function() {
        var nameParts = [this.firstName()];
        if (this.lastName())
            nameParts.push(this.lastName());
        if (this.secondLastName())
            nameParts.push(this.secondLastName);
        
        return nameParts.join(' ');
    }, this);
}

},{"../models/Model":113,"../models/UserJobTitle":132,"knockout":false}],184:[function(require,module,exports){
/**
    ServiceProfessionalServiceViewModel
**/
'use strict';

var ko = require('knockout'),
    _ = require('lodash'),
    $ = require('jquery');

function ServiceProfessionalServiceViewModel(app) {

    this.isLoading = ko.observable(false);
    this.list = ko.observableArray([]);
    this.jobTitleID = ko.observable(0);
    // 0 to load current user pricing and allow edit
    this.serviceProfessionalID = ko.observable(null);
    this.jobTitle = ko.observable(null);
    this.isAdditionMode = ko.observable(false);
    // Especial mode when instead of pick and edit we are just selecting
    this.isSelectionMode = ko.observable(false);
    // Currently selected pricing
    this.selectedServices = ko.observableArray([]);
    // Preset selection, from a previous state (loaded data) or incoming selection:
    this.preSelectedServices = ko.observableArray([]);
    // Add activity requestData to keep progress/navigation on links
    this.requestData = ko.observable();
    this.cancelLink = ko.observable(null);
    
    this.allowAddServices = ko.pureComputed(function() {
        return this.serviceProfessionalID() === null;
    }, this);
    
    // Grouped list of pricings:
    // Defined groups by pricing type
    this.groupedServices = ko.computed(function(){

        var list = this.list();
        var isSelection = this.isSelectionMode();
        var groupNamePrefix = isSelection ? 'Select ' : '';

        var groups = [],
            groupsList = [];
        if (!this.isAdditionMode()) {
            groups = _.groupBy(list, function(service) {
                return service.pricingTypeID();
            });

            // Convert the indexed object into an array with some meta-data
            groupsList = Object.keys(groups).map(function(key) {
                var gr = {
                    services: groups[key],
                    // Load the pricing information
                    type: app.model.pricingTypes.getObservableItem(key)
                };
                gr.group = ko.computed(function() {
                    return groupNamePrefix + (
                        this.type() && this.type().pluralName() ||
                        'Services'
                    );
                }, gr);
                return gr;
            });
        }
        
        if (!this.isSelectionMode()) {
            // Since the groupsList is built from the existent pricing items
            // if there are no records for some pricing type (or nothing when
            // just created the job title), that types/groups are not included,
            // so review and include now.
            // NOTE: as a good side effect of this approach, pricing types with
            // some pricing will appear first in the list (nearest to the top)
            var pricingTypes = this.jobTitle() && this.jobTitle().pricingTypes();
            if (pricingTypes && pricingTypes.length) {
                pricingTypes.forEach(function (jobType) {

                    var typeID = jobType.pricingTypeID();
                    // Not if already in the list
                    if (groups.hasOwnProperty(typeID))
                        return;

                    var gr = {
                        services: [],
                        type: app.model.pricingTypes.getObservableItem(typeID)
                    };
                    gr.group = ko.computed(function() {
                        return groupNamePrefix + (
                            this.type() && this.type().pluralName() ||
                            'Services'
                        );
                    }, gr);

                    groupsList.push(gr);
                });
            }
        }

        return groupsList;

    }, this);

    /**
        Toggle the selection status of a single pricing, adding
        or removing it from the 'selectedServices' array.
    **/
    this.toggleServiceSelection = function(service) {

        var inIndex = -1,
            isSelected = this.selectedServices().some(function(selectedServices, index) {
            if (selectedServices === service) {
                inIndex = index;
                return true;
            }
        });

        service.isSelected(!isSelected);

        if (isSelected)
            this.selectedServices.splice(inIndex, 1);
        else
            this.selectedServices.push(service);
    }.bind(this);
    
    this.editService = function(service) {
        app.shell.go('serviceProfessionalServiceEditor/' + this.jobTitleID() + '/' + service.serviceProfessionalServiceID());
    }.bind(this);
    
    /**
        Handler for the listview items, managing edition and selection depending on current mode
    **/
    this.tapService = function(service, event) {
        if (this.isSelectionMode()) {
            this.toggleServiceSelection(service);
        }
        else {
            this.editService(service);
        }

        event.preventDefault();
        event.stopImmediatePropagation();
    }.bind(this);
    
    this.tapNewService = function(group, event) {
        
        var url = '#!serviceProfessionalServiceEditor/' + this.jobTitleID() + '/new/' + (group.type() && group.type().pricingTypeID());

        // Passing original data, for in-progress process (as new-booking)
        // and the selected title since the URL could not be updated properly
        // (see the anotated comment about replaceState bug on this file)
        var request = $.extend({}, this.requestData(), {
            selectedJobTitleID: this.jobTitleID()
        });
        if (!request.cancelLink) {
            $.extend(request, {
                cancelLink: this.cancelLink()
            });
        }
        
        // When in selection mode:
        // Add current selection as preselection, so can be recovered later and 
        // the editor can add the new pricing to the list
        if (this.isSelectionMode()) {
            request.selectedServices = this.selectedServices()
            .map(function(pricing) {
                return {
                    serviceProfessionalServiceID: ko.unwrap(pricing.serviceProfessionalServiceID),
                    totalPrice: ko.unwrap(pricing.totalPrice)
                };
            });
        }

        app.shell.go(url, request);

        event.preventDefault();
        event.stopImmediatePropagation();
    }.bind(this);
    
    var loadDataFor = function loadDataFor(serviceProfessionalID, jobTitleID) {
        if (jobTitleID) {
            this.isLoading(true);
            // Get data for the Job title ID and pricing types.
            // They are essential data
            Promise.all([
                app.model.jobTitles.getJobTitle(jobTitleID),
                app.model.pricingTypes.getList()
            ])
            .then(function(data) {
                var jobTitle = data[0];
                // Save for use in the view
                this.jobTitle(jobTitle);
                // Get services
                if (serviceProfessionalID)
                    return app.model.users.getServiceProfessionalServices(serviceProfessionalID, jobTitleID);
                else
                    return app.model.serviceProfessionalServices.getList(jobTitleID);
            }.bind(this))
            .then(function(list) {

                list = app.model.serviceProfessionalServices.asModel(list);

                // Read presets selection from requestData
                var preset = this.preSelectedServices(),
                    selection = this.selectedServices;

                // Add the isSelected property to each item
                list.forEach(function(item) {
                    var preSelected = preset.some(function(pr) {
                        if (pr.serviceProfessionalServiceID === item.serviceProfessionalServiceID())
                            return true;
                    }) || false;

                    item.isSelected = ko.observable(preSelected);

                    if (preSelected) {
                        selection.push(item);
                    }
                });
                this.list(list);
                
                this.isLoading(false);

            }.bind(this))
            .catch(function (err) {
                this.isLoading(false);
                app.modals.showError({
                    title: 'There was an error while loading.',
                    error: err
                });
            }.bind(this));
        }
        else {
            this.list([]);
            this.jobTitle(null);
        }
    }.bind(this);

    // AUTO LOAD on job title change
    ko.computed(function() {
        loadDataFor(this.serviceProfessionalID(), this.jobTitleID());
    }.bind(this)).extend({ rateLimit: { method: 'notifyWhenChangesStop', timeout: 20 } });
}

module.exports = ServiceProfessionalServiceViewModel;

},{"knockout":false,"lodash":false}],185:[function(require,module,exports){
/**
    TimeSlot view model (aka: CalendarSlot) for use
    as part of the template/component time-slot-tile or activities
    providing data for the template.
**/
'use strict';

var getObservable = require('../utils/getObservable');

function TimeSlotViewModel(params) {
    /*jshint maxcomplexity:9*/

    this.startTime = getObservable(params.startTime || null);
    this.endTime = getObservable(params.endTime || null);
    this.subject = getObservable(params.subject || null);
    this.description = getObservable(params.description || null);
    this.link = getObservable(params.link || null);
    this.actionIcon = getObservable(params.actionIcon || null);
    this.actionText = getObservable(params.actionText || null);
    this.classNames = getObservable(params.classNames || null);
}

module.exports = TimeSlotViewModel;

var numeral = require('numeral'),
    Appointment = require('../models/Appointment');

/**
    Static constructor to convert an Appointment model into 
    a TimeSlot instance following UI criteria for preset values/setup.
**/
TimeSlotViewModel.fromAppointment = function fromAppointment(apt) {
    /*jshint maxcomplexity:10 */
    
    // Commented the option to detect and not link unavail slots:
    //var unavail = Appointment.specialIds.unavailable === apt.id();
    //var link = null;
    //if (!unavail)
    var link = '#!appointment/' + apt.startTime().toISOString() + '/' + apt.id();
    
    if (apt.id() === Appointment.specialIds.preparationTime) {
        // Special link case: it goes to scheduling preferences to allow quick edit
        // the preparation time slots
        link = '#!schedulingPreferences?mustReturn=1';
    }

    var classNames = null;
    if (Appointment.specialIds.free === apt.id()) {
        classNames = 'Tile--tag-gray-lighter ';
    }
    else if (apt.id() > 0 && apt.sourceBooking()) {
        if (apt.sourceBooking().serviceDateID())
            classNames = 'Tile--tag-primary ' ;
        else
            // is a request:
            classNames = 'Tile--tag-warning ';
        
        classNames += 'ItemAddonTile--largerContent ';
    }
    else {
        // any block event, preparation time slots
        classNames = 'Tile--tag-danger ';
    }

    return new TimeSlotViewModel({
        startTime: apt.startTime,
        endTime: apt.endTime,
        subject: apt.summary,
        description: apt.description,
        link: link,
        actionIcon: (apt.sourceBooking() ? null : apt.sourceEvent() ? 'fa ion ion-ios-arrow-right' : !apt.id() ? 'fa ion ion-plus' : null),
        actionText: (
            apt.sourceBooking() && 
            apt.sourceBooking().pricingSummary() ? 
            numeral(apt.sourceBooking().pricingSummary().totalPrice() || 0).format('$0.00') :
            null
        ),
        classNames: classNames
    });
};

},{"../models/Appointment":96,"../utils/getObservable":158,"numeral":false}],186:[function(require,module,exports){
/**
    UserJobProfileViewModel: loads data and keep state
    to display the listing of job titles from the 
    user job profile.
**/
'use strict';

var ko = require('knockout');

function UserJobProfileViewModel(app) {
    
    this.showMarketplaceInfo = ko.observable(false);
    
    // Load and save job title info
    var jobTitlesIndex = {};
    function syncJobTitle(jobTitleID) {
        return app.model.jobTitles.getJobTitle(jobTitleID)
        .then(function(jobTitle) {
            jobTitlesIndex[jobTitleID] = jobTitle;

            // TODO: errors? not-found job title?
        });
    }
    // Creates a 'jobTitle' observable on the userJobTitle
    // model to have access to a cached jobTitle model.
    function attachJobTitle(userJobTitle) {
        userJobTitle.jobTitle = ko.computed(function(){
            return jobTitlesIndex[this.jobTitleID()];
        }, userJobTitle);
        // Shortcut to singular name
        userJobTitle.displayedSingularName = ko.computed(function() {
            return this.jobTitle() && this.jobTitle().singularName() || 'Unknow';
        }, userJobTitle);
    }
    
    function attachMarketplaceStatus(userJobtitle) {
        userJobtitle.marketplaceStatusHtml = ko.pureComputed(function() {
            var status = this.statusID();
            // L18N
            if (status === 1) {
                return 'Marketplace profile: <strong class="text-success">ON</strong>';
            }
            else if (status === 3) {
                return 'Marketplace profile: <strong class="text-danger">OFF</strong>';
            }
            else {
                // TODO: read number of steps left to activate from required alerts for the jobtitle
                // '__count__ steps left to activate'
                return '<span class="text-danger">There are steps left to activate</span>';
            }
        }, userJobtitle);
    }

    function attachExtras(userJobtitle) {
        attachJobTitle(userJobtitle);
        attachMarketplaceStatus(userJobtitle);
    }
    
    this.userJobProfile = ko.observableArray([]);
    // Updated using the live list, for background updates
    app.model.userJobProfile.list.subscribe(function(list) {
        // We need the job titles info before end
        Promise.all(list.map(function(userJobTitle) {
            return syncJobTitle(userJobTitle.jobTitleID());
        }))
        .then(function() {
            // Needs additional properties for the view
            list.forEach(attachExtras);

            this.userJobProfile(list);

            this.isLoading(false);
            this.isSyncing(false);
            this.thereIsError(false);
        }.bind(this))
        .catch(showLoadingError);
    }, this);

    this.isFirstTime = ko.observable(true);
    this.isLoading = ko.observable(false);
    this.isSyncing = ko.observable(false);
    this.thereIsError = ko.observable(false);
    this.baseUrl = ko.observable('/jobtitles');
    
    this.selectJobTitle = function(jobTitle) {
        // Gollow the next link:
        app.shell.go(this.baseUrl() + '/' + jobTitle.jobTitleID());
        // This function can be replaced by custom handling.
        // Stop events
        return false;
    }.bind(this);
    
    var showLoadingError = function showLoadingError(err) {
        app.modals.showError({
            title: 'An error happening when loading your job profile.',
            error: err && err.error || err
        });
        
        this.isLoading(false);
        this.isSyncing(false);
        this.thereIsError(true);
    }.bind(this);

    // Loading and sync of data
    this.sync = function sync() {
        var firstTime = this.isFirstTime();
        this.isFirstTime(false);

        if (firstTime) {
            this.isLoading(true);
        }
        else {
            this.isSyncing(true);
        }

        // Keep data updated:
        app.model.userJobProfile.syncList()
        .catch(showLoadingError);

    }.bind(this);
}

module.exports = UserJobProfileViewModel;

},{"knockout":false}]},{},[62])