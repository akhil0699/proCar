

(function( factory ){
	if ( typeof define === 'function' && define.amd ) {
		// AMD
		define( ['jquery', 'datatables.net'], function ( $ ) {
			return factory( $, window, document );
		} );
	}
	else if ( typeof exports === 'object' ) {
		// CommonJS
		module.exports = function (root, $) {
			if ( ! root ) {
				root = window;
			}

			if ( ! $ || ! $.fn.dataTable ) {
				$ = require('datatables.net')(root, $).$;
			}

			return factory( $, root, root.document );
		};
	}
	else {
		// Browser
		factory( jQuery, window, document );
	}
}(function( $, window, document, undefined ) {
'use strict';
var DataTable = $.fn.dataTable;


var Scroller = function ( dt, opts ) {
	
	if ( ! (this instanceof Scroller) ) {
		alert( "Scroller warning: Scroller must be initialised with the 'new' keyword." );
		return;
	}

	if ( opts === undefined ) {
		opts = {};
	}

	var dtApi = $.fn.dataTable.Api( dt );

		this.s = {
				dt: dtApi.settings()[0],

				dtApi: dtApi,

				tableTop: 0,

				tableBottom: 0,

				redrawTop: 0,

				redrawBottom: 0,

				autoHeight: true,

				viewportRows: 0,

				stateTO: null,

		stateSaveThrottle: function () {},

				drawTO: null,

		heights: {
			jump: null,
			page: null,
			virtual: null,
			scroll: null,

						row: null,

						viewport: null,
			labelFactor: 1
		},

		topRowFloat: 0,
		scrollDrawDiff: null,
		loaderVisible: false,
		forceReposition: false,
		baseRowTop: 0,
		baseScrollTop: 0,
		mousedown: false,
		lastScrollTop: 0
	};

	// @todo The defaults should extend a `c` property and the internal settings
	// only held in the `s` property. At the moment they are mixed
	this.s = $.extend( this.s, Scroller.oDefaults, opts );

	// Workaround for row height being read from height object (see above comment)
	this.s.heights.row = this.s.rowHeight;

		this.dom = {
		"force":    document.createElement('div'),
		"label":    $('<div class="dts_label">0</div>'),
		"scroller": null,
		"table":    null,
		"loader":   null
	};

	// Attach the instance to the DataTables instance so it can be accessed in
	// future. Don't initialise Scroller twice on the same table
	if ( this.s.dt.oScroller ) {
		return;
	}

	this.s.dt.oScroller = this;

	
	this.construct();
};



$.extend( Scroller.prototype, {
	
		measure: function ( redraw )
	{
		if ( this.s.autoHeight )
		{
			this._calcRowHeight();
		}

		var heights = this.s.heights;

		if ( heights.row ) {
			heights.viewport = this._parseHeight($(this.dom.scroller).css('max-height'));

			this.s.viewportRows = parseInt( heights.viewport / heights.row, 10 )+1;
			this.s.dt._iDisplayLength = this.s.viewportRows * this.s.displayBuffer;
		}

		var label = this.dom.label.outerHeight();
		heights.labelFactor = (heights.viewport-label) / heights.scroll;

		if ( redraw === undefined || redraw )
		{
			this.s.dt.oInstance.fnDraw( false );
		}
	},

		pageInfo: function()
	{
		var 
			dt = this.s.dt,
			iScrollTop = this.dom.scroller.scrollTop,
			iTotal = dt.fnRecordsDisplay(),
			iPossibleEnd = Math.ceil(this.pixelsToRow(iScrollTop + this.s.heights.viewport, false, this.s.ani));

		return {
			start: Math.floor(this.pixelsToRow(iScrollTop, false, this.s.ani)),
			end: iTotal < iPossibleEnd ? iTotal-1 : iPossibleEnd-1
		};
	},

		pixelsToRow: function ( pixels, intParse, virtual )
	{
		var diff = pixels - this.s.baseScrollTop;
		var row = virtual ?
			(this._domain( 'physicalToVirtual', this.s.baseScrollTop ) + diff) / this.s.heights.row :
			( diff / this.s.heights.row ) + this.s.baseRowTop;

		return intParse || intParse === undefined ?
			parseInt( row, 10 ) :
			row;
	},

		rowToPixels: function ( rowIdx, intParse, virtual )
	{
		var pixels;
		var diff = rowIdx - this.s.baseRowTop;

		if ( virtual ) {
			pixels = this._domain( 'virtualToPhysical', this.s.baseScrollTop );
			pixels += diff * this.s.heights.row;
		}
		else {
			pixels = this.s.baseScrollTop;
			pixels += diff * this.s.heights.row;
		}

		return intParse || intParse === undefined ?
			parseInt( pixels, 10 ) :
			pixels;
	},


		scrollToRow: function ( row, animate )
	{
		var that = this;
		var ani = false;
		var px = this.rowToPixels( row );

		// We need to know if the table will redraw or not before doing the
		// scroll. If it will not redraw, then we need to use the currently
		// displayed table, and scroll with the physical pixels. Otherwise, we
		// need to calculate the table's new position from the virtual
		// transform.
		var preRows = ((this.s.displayBuffer-1)/2) * this.s.viewportRows;
		var drawRow = row - preRows;
		if ( drawRow < 0 ) {
			drawRow = 0;
		}

		if ( (px > this.s.redrawBottom || px < this.s.redrawTop) && this.s.dt._iDisplayStart !== drawRow ) {
			ani = true;
			px = this._domain( 'virtualToPhysical', row * this.s.heights.row );

			// If we need records outside the current draw region, but the new
			// scrolling position is inside that (due to the non-linear nature
			// for larger numbers of records), we need to force position update.
			if ( this.s.redrawTop < px && px < this.s.redrawBottom ) {
				this.s.forceReposition = true;
				animate = false;
			}
		}

		if ( animate === undefined || animate )
		{
			this.s.ani = ani;
			$(this.dom.scroller).animate( {
				"scrollTop": px
			}, function () {
				// This needs to happen after the animation has completed and
				// the final scroll event fired
				setTimeout( function () {
					that.s.ani = false;
				}, 250 );
			} );
		}
		else
		{
			$(this.dom.scroller).scrollTop( px );
		}
	},


	
		construct: function ()
	{
		var that = this;
		var dt = this.s.dtApi;

		
		if ( !this.s.dt.oFeatures.bPaginate ) {
			this.s.dt.oApi._fnLog( this.s.dt, 0, 'Pagination must be enabled for Scroller' );
			return;
		}

				this.dom.force.style.position = "relative";
		this.dom.force.style.top = "0px";
		this.dom.force.style.left = "0px";
		this.dom.force.style.width = "1px";

		this.dom.scroller = $('div.'+this.s.dt.oClasses.sScrollBody, this.s.dt.nTableWrapper)[0];
		this.dom.scroller.appendChild( this.dom.force );
		this.dom.scroller.style.position = "relative";

		this.dom.table = $('>table', this.dom.scroller)[0];
		this.dom.table.style.position = "absolute";
		this.dom.table.style.top = "0px";
		this.dom.table.style.left = "0px";

		// Add class to 'announce' that we are a Scroller table
		$(dt.table().container()).addClass('dts DTS');

		// Add a 'loading' indicator
		if ( this.s.loadingIndicator )
		{
			this.dom.loader = $('<div class="dataTables_processing dts_loading">'+this.s.dt.oLanguage.sLoadingRecords+'</div>')
				.css('display', 'none');

			$(this.dom.scroller.parentNode)
				.css('position', 'relative')
				.append( this.dom.loader );
		}

		this.dom.label.appendTo(this.dom.scroller);

		
		if ( this.s.heights.row && this.s.heights.row != 'auto' )
		{
			this.s.autoHeight = false;
		}

		// Scrolling callback to see if a page change is needed
		this.s.ingnoreScroll = true;
		$(this.dom.scroller).on( 'scroll.dt-scroller', function (e) {
			that._scroll.call( that );
		} );

		// In iOS we catch the touchstart event in case the user tries to scroll
		// while the display is already scrolling
		$(this.dom.scroller).on('touchstart.dt-scroller', function () {
			that._scroll.call( that );
		} );

		$(this.dom.scroller)
			.on('mousedown.dt-scroller', function () {
				that.s.mousedown = true;
			})
			.on('mouseup.dt-scroller', function () {
				that.s.labelVisible = false;
				that.s.mousedown = false;
				that.dom.label.css('display', 'none');
			});

		// On resize, update the information element, since the number of rows shown might change
		$(window).on( 'resize.dt-scroller', function () {
			that.measure( false );
			that._info();
		} );

		// Add a state saving parameter to the DT state saving so we can restore the exact
		// position of the scrolling.
		var initialStateSave = true;
		var loadedState = dt.state.loaded();

		dt.on( 'stateSaveParams.scroller', function ( e, settings, data ) {
			if ( initialStateSave && loadedState ) {
				data.scroller = loadedState.scroller;
				initialStateSave = false;
			}
			else {
				// Need to used the saved position on init
				data.scroller = {
					topRow: that.s.topRowFloat,
					baseScrollTop: that.s.baseScrollTop,
					baseRowTop: that.s.baseRowTop,
					scrollTop: that.s.lastScrollTop
				};
			}
		} );

		if ( loadedState && loadedState.scroller ) {
			this.s.topRowFloat = loadedState.scroller.topRow;
			this.s.baseScrollTop = loadedState.scroller.baseScrollTop;
			this.s.baseRowTop = loadedState.scroller.baseRowTop;
		}

		this.measure( false );
	
		that.s.stateSaveThrottle = that.s.dt.oApi._fnThrottle( function () {
			that.s.dtApi.state.save();
		}, 500 );

		dt.on( 'init.scroller', function () {
			that.measure( false );

			// Setting to `jump` will instruct _draw to calculate the scroll top
			// position
			that.s.scrollType = 'jump';
			that._draw();

			// Update the scroller when the DataTable is redrawn
			dt.on( 'draw.scroller', function () {
				that._draw();
			});
		} );

		// Set height before the draw happens, allowing everything else to update
		// on draw complete without worry for roder.
		dt.on( 'preDraw.dt.scroller', function () {
			that._scrollForce();
		} );

		// Destructor
		dt.on( 'destroy.scroller', function () {
			$(window).off( 'resize.dt-scroller' );
			$(that.dom.scroller).off('.dt-scroller');
			$(that.s.dt.nTable).off( '.scroller' );

			$(that.s.dt.nTableWrapper).removeClass('DTS');
			$('div.DTS_Loading', that.dom.scroller.parentNode).remove();

			that.dom.table.style.position = "";
			that.dom.table.style.top = "";
			that.dom.table.style.left = "";
		} );
	},


	
		_calcRowHeight: function ()
	{
		var dt = this.s.dt;
		var origTable = dt.nTable;
		var nTable = origTable.cloneNode( false );
		var tbody = $('<tbody/>').appendTo( nTable );
		var container = $(
			'<div class="'+dt.oClasses.sWrapper+' DTS">'+
				'<div class="'+dt.oClasses.sScrollWrapper+'">'+
					'<div class="'+dt.oClasses.sScrollBody+'"></div>'+
				'</div>'+
			'</div>'
		);

		// Want 3 rows in the sizing table so :first-child and :last-child
		// CSS styles don't come into play - take the size of the middle row
		$('tbody tr:lt(4)', origTable).clone().appendTo( tbody );
        var rowsCount = $('tr', tbody).length;

        if ( rowsCount === 1 ) {
            tbody.prepend('<tr><td>&#160;</td></tr>');
            tbody.append('<tr><td>&#160;</td></tr>');
		}
		else {
            for (; rowsCount < 3; rowsCount++) {
                tbody.append('<tr><td>&#160;</td></tr>');
            }
		}
	
		$('div.'+dt.oClasses.sScrollBody, container).append( nTable );

		// If initialised using `dom`, use the holding element as the insert point
		var insertEl = this.s.dt.nHolding || origTable.parentNode;

		if ( ! $(insertEl).is(':visible') ) {
			insertEl = 'body';
		}

		// Remove form element links as they might select over others (particularly radio and checkboxes)
		container.find("input").removeAttr("name");

		container.appendTo( insertEl );
		this.s.heights.row = $('tr', tbody).eq(1).outerHeight();

		container.remove();
	},

		_draw: function ()
	{
		var
			that = this,
			heights = this.s.heights,
			iScrollTop = this.dom.scroller.scrollTop,
			iTableHeight = $(this.s.dt.nTable).height(),
			displayStart = this.s.dt._iDisplayStart,
			displayLen = this.s.dt._iDisplayLength,
			displayEnd = this.s.dt.fnRecordsDisplay();

		// Disable the scroll event listener while we are updating the DOM
		this.s.skip = true;

		// If paging is reset
		if ( (this.s.dt.bSorted || this.s.dt.bFiltered) && displayStart === 0 && !this.s.dt._drawHold ) {
			this.s.topRowFloat = 0;
		}

		iScrollTop = this.s.scrollType === 'jump' ?
			this._domain( 'virtualToPhysical', this.s.topRowFloat * heights.row ) :
			iScrollTop;

		// Store positional information so positional calculations can be based
		// upon the current table draw position
		this.s.baseScrollTop = iScrollTop;
		this.s.baseRowTop = this.s.topRowFloat;

		// Position the table in the virtual scroller
		var tableTop = iScrollTop - ((this.s.topRowFloat - displayStart) * heights.row);
		if ( displayStart === 0 ) {
			tableTop = 0;
		}
		else if ( displayStart + displayLen >= displayEnd ) {
			tableTop = heights.scroll - iTableHeight;
		}

		this.dom.table.style.top = tableTop+'px';

		
		this.s.tableTop = tableTop;
		this.s.tableBottom = iTableHeight + this.s.tableTop;

		// Calculate the boundaries for where a redraw will be triggered by the
		// scroll event listener
		var boundaryPx = (iScrollTop - this.s.tableTop) * this.s.boundaryScale;
		this.s.redrawTop = iScrollTop - boundaryPx;
		this.s.redrawBottom = iScrollTop + boundaryPx > heights.scroll - heights.viewport - heights.row ?
			heights.scroll - heights.viewport - heights.row :
			iScrollTop + boundaryPx;

		this.s.skip = false;

		// Restore the scrolling position that was saved by DataTable's state
		// saving Note that this is done on the second draw when data is Ajax
		// sourced, and the first draw when DOM soured
		if ( this.s.dt.oFeatures.bStateSave && this.s.dt.oLoadedState !== null &&
			 typeof this.s.dt.oLoadedState.scroller != 'undefined' )
		{
			// A quirk of DataTables is that the draw callback will occur on an
			// empty set if Ajax sourced, but not if server-side processing.
			var ajaxSourced = (this.s.dt.sAjaxSource || that.s.dt.ajax) && ! this.s.dt.oFeatures.bServerSide ?
				true :
				false;

			if ( ( ajaxSourced && this.s.dt.iDraw == 2) ||
			     (!ajaxSourced && this.s.dt.iDraw == 1) )
			{
				setTimeout( function () {
					$(that.dom.scroller).scrollTop( that.s.dt.oLoadedState.scroller.scrollTop );

					// In order to prevent layout thrashing we need another
					// small delay
					setTimeout( function () {
						that.s.ingnoreScroll = false;
					}, 0 );
				}, 0 );
			}
		}
		else {
			that.s.ingnoreScroll = false;
		}

		// Because of the order of the DT callbacks, the info update will
		// take precedence over the one we want here. So a 'thread' break is
		// needed.  Only add the thread break if bInfo is set
		if ( this.s.dt.oFeatures.bInfo ) {
			setTimeout( function () {
				that._info.call( that );
			}, 0 );
		}

		// Hide the loading indicator
		if ( this.dom.loader && this.s.loaderVisible ) {
			this.dom.loader.css( 'display', 'none' );
			this.s.loaderVisible = false;
		}
	},

		_domain: function ( dir, val )
	{
		var heights = this.s.heights;
		var diff;
		var magic = 10000; // the point at which the non-linear calculations start to happen

		// If the virtual and physical height match, then we use a linear
		// transform between the two, allowing the scrollbar to be linear
		if ( heights.virtual === heights.scroll ) {
			return val;
		}

		// In the first 10k pixels and the last 10k pixels, we want the scrolling
		// to be linear. After that it can be non-linear. It would be unusual for
		// anyone to mouse wheel through that much.
		if ( val < magic ) {
			return val;
		}
		else if ( dir === 'virtualToPhysical' && val >= heights.virtual - magic ) {
			diff = heights.virtual - val;
			return heights.scroll - diff;
		}
		else if ( dir === 'physicalToVirtual' && val >= heights.scroll - magic ) {
			diff = heights.scroll - val;
			return heights.virtual - diff;
		}

		// Otherwise, we want a non-linear scrollbar to take account of the
		// redrawing regions at the start and end of the table, otherwise these
		// can stutter badly - on large tables 30px (for example) scroll might
		// be hundreds of rows, so the table would be redrawing every few px at
		// the start and end. Use a simple linear eq. to stop this, effectively
		// causing a kink in the scrolling ratio. It does mean the scrollbar is
		// non-linear, but with such massive data sets, the scrollbar is going
		// to be a best guess anyway
		var m = (heights.virtual - magic - magic) / (heights.scroll - magic - magic);
		var c = magic - (m*magic);

		return dir === 'virtualToPhysical' ?
			(val-c) / m :
			(m*val) + c;
	},

		_info: function ()
	{
		if ( !this.s.dt.oFeatures.bInfo )
		{
			return;
		}

		var
			dt = this.s.dt,
			language = dt.oLanguage,
			iScrollTop = this.dom.scroller.scrollTop,
			iStart = Math.floor( this.pixelsToRow(iScrollTop, false, this.s.ani)+1 ),
			iMax = dt.fnRecordsTotal(),
			iTotal = dt.fnRecordsDisplay(),
			iPossibleEnd = Math.ceil( this.pixelsToRow(iScrollTop+this.s.heights.viewport, false, this.s.ani) ),
			iEnd = iTotal < iPossibleEnd ? iTotal : iPossibleEnd,
			sStart = dt.fnFormatNumber( iStart ),
			sEnd = dt.fnFormatNumber( iEnd ),
			sMax = dt.fnFormatNumber( iMax ),
			sTotal = dt.fnFormatNumber( iTotal ),
			sOut;

		if ( dt.fnRecordsDisplay() === 0 &&
			   dt.fnRecordsDisplay() == dt.fnRecordsTotal() )
		{
			
			sOut = language.sInfoEmpty+ language.sInfoPostFix;
		}
		else if ( dt.fnRecordsDisplay() === 0 )
		{
			
			sOut = language.sInfoEmpty +' '+
				language.sInfoFiltered.replace('_MAX_', sMax)+
					language.sInfoPostFix;
		}
		else if ( dt.fnRecordsDisplay() == dt.fnRecordsTotal() )
		{
			
			sOut = language.sInfo.
					replace('_START_', sStart).
					replace('_END_',   sEnd).
					replace('_MAX_',   sMax).
					replace('_TOTAL_', sTotal)+
				language.sInfoPostFix;
		}
		else
		{
			
			sOut = language.sInfo.
					replace('_START_', sStart).
					replace('_END_',   sEnd).
					replace('_MAX_',   sMax).
					replace('_TOTAL_', sTotal) +' '+
				language.sInfoFiltered.replace(
					'_MAX_',
					dt.fnFormatNumber(dt.fnRecordsTotal())
				)+
				language.sInfoPostFix;
		}

		var callback = language.fnInfoCallback;
		if ( callback ) {
			sOut = callback.call( dt.oInstance,
				dt, iStart, iEnd, iMax, iTotal, sOut
			);
		}

		var n = dt.aanFeatures.i;
		if ( typeof n != 'undefined' )
		{
			for ( var i=0, iLen=n.length ; i<iLen ; i++ )
			{
				$(n[i]).html( sOut );
			}
		}

		// DT doesn't actually (yet) trigger this event, but it will in future
		$(dt.nTable).triggerHandler( 'info.dt' );
	},

		_parseHeight: function(cssHeight) {
		var height;
		var matches = /^([+-]?(?:\d+(?:\.\d+)?|\.\d+))(px|em|rem|vh)$/.exec(cssHeight);

		if (matches === null) {
			return 0;
		}

		var value = parseFloat(matches[1]);
		var unit = matches[2];

		if ( unit === 'px' ) {
			height = value;
		}
		else if ( unit === 'vh' ) {
			height = ( value / 100 ) * $(window).height();
		}
		else if ( unit === 'rem' ) {
			height = value * parseFloat($(':root').css('font-size'));
		}
		else if ( unit === 'em' ) {
			height = value * parseFloat($('body').css('font-size'));
		}

		return height ?
			height :
			0;
	},

		_scroll: function ()
	{
		var
			that = this,
			heights = this.s.heights,
			iScrollTop = this.dom.scroller.scrollTop,
			iTopRow;

		if ( this.s.skip ) {
			return;
		}

		if ( this.s.ingnoreScroll ) {
			return;
		}

		if ( iScrollTop === this.s.lastScrollTop ) {
			return;
		}

				if ( this.s.dt.bFiltered || this.s.dt.bSorted ) {
			this.s.lastScrollTop = 0;
			return;
		}

		
		this._info();

				clearTimeout( this.s.stateTO );
		this.s.stateTO = setTimeout( function () {
			that.s.dtApi.state.save();
		}, 250 );

		this.s.scrollType = Math.abs(iScrollTop - this.s.lastScrollTop) > heights.viewport ?
			'jump' :
			'cont';

		this.s.topRowFloat = this.s.scrollType === 'cont' ?
			this.pixelsToRow( iScrollTop, false, false ) :
			this._domain( 'physicalToVirtual', iScrollTop ) / heights.row;

		if ( this.s.topRowFloat < 0 ) {
			this.s.topRowFloat = 0;
		}

				if ( this.s.forceReposition || iScrollTop < this.s.redrawTop || iScrollTop > this.s.redrawBottom ) {
			var preRows = Math.ceil( ((this.s.displayBuffer-1)/2) * this.s.viewportRows );

			iTopRow = parseInt(this.s.topRowFloat, 10) - preRows;
			this.s.forceReposition = false;

			if ( iTopRow <= 0 ) {
				
				iTopRow = 0;
			}
			else if ( iTopRow + this.s.dt._iDisplayLength > this.s.dt.fnRecordsDisplay() ) {
				
				iTopRow = this.s.dt.fnRecordsDisplay() - this.s.dt._iDisplayLength;
				if ( iTopRow < 0 ) {
					iTopRow = 0;
				}
			}
			else if ( iTopRow % 2 !== 0 ) {
				// For the row-striping classes (odd/even) we want only to start
				// on evens otherwise the stripes will change between draws and
				// look rubbish
				iTopRow++;
			}

			// Store calcuated value, in case the following condition is not met, but so
			// that the draw function will still use it.
			this.s.targetTop = iTopRow;

			if ( iTopRow != this.s.dt._iDisplayStart ) {
				
				this.s.tableTop = $(this.s.dt.nTable).offset().top;
				this.s.tableBottom = $(this.s.dt.nTable).height() + this.s.tableTop;

				var draw = function () {
					that.s.dt._iDisplayStart = that.s.targetTop;
					that.s.dt.oApi._fnDraw( that.s.dt );
				};

								if ( this.s.dt.oFeatures.bServerSide ) {
					this.s.forceReposition = true;

					clearTimeout( this.s.drawTO );
					this.s.drawTO = setTimeout( draw, this.s.serverWait );
				}
				else {
					draw();
				}

				if ( this.dom.loader && ! this.s.loaderVisible ) {
					this.dom.loader.css( 'display', 'block' );
					this.s.loaderVisible = true;
				}
			}
		}
		else {
			this.s.topRowFloat = this.pixelsToRow( iScrollTop, false, true );
		}

		this.s.lastScrollTop = iScrollTop;
		this.s.stateSaveThrottle();

		if ( this.s.scrollType === 'jump' && this.s.mousedown ) {
			this.s.labelVisible = true;
		}
		if (this.s.labelVisible) {
			this.dom.label
				.html( this.s.dt.fnFormatNumber( parseInt( this.s.topRowFloat, 10 )+1 ) )
				.css( 'top', iScrollTop + (iScrollTop * heights.labelFactor ) )
				.css( 'display', 'block' );
		}
	},

		_scrollForce: function ()
	{
		var heights = this.s.heights;
		var max = 1000000;

		heights.virtual = heights.row * this.s.dt.fnRecordsDisplay();
		heights.scroll = heights.virtual;

		if ( heights.scroll > max ) {
			heights.scroll = max;
		}

		// Minimum height so there is always a row visible (the 'no rows found'
		// if reduced to zero filtering)
		this.dom.force.style.height = heights.scroll > this.s.heights.row ?
			heights.scroll+'px' :
			this.s.heights.row+'px';
	}
} );





Scroller.defaults = {
		boundaryScale: 0.5,

		displayBuffer: 9,

		loadingIndicator: false,

		rowHeight: "auto",

		serverWait: 200
};

Scroller.oDefaults = Scroller.defaults;




Scroller.version = "2.0.3";




// Attach a listener to the document which listens for DataTables initialisation
// events so we can automatically initialise
$(document).on( 'preInit.dt.dtscroller', function (e, settings) {
	if ( e.namespace !== 'dt' ) {
		return;
	}

	var init = settings.oInit.scroller;
	var defaults = DataTable.defaults.scroller;

	if ( init || defaults ) {
		var opts = $.extend( {}, init, defaults );

		if ( init !== false ) {
			new Scroller( settings, opts  );
		}
	}
} );


// Attach Scroller to DataTables so it can be accessed as an 'extra'
$.fn.dataTable.Scroller = Scroller;
$.fn.DataTable.Scroller = Scroller;


// DataTables 1.10 API method aliases
var Api = $.fn.dataTable.Api;

Api.register( 'scroller()', function () {
	return this;
} );

// Undocumented and deprecated - is it actually useful at all?
Api.register( 'scroller().rowToPixels()', function ( rowIdx, intParse, virtual ) {
	var ctx = this.context;

	if ( ctx.length && ctx[0].oScroller ) {
		return ctx[0].oScroller.rowToPixels( rowIdx, intParse, virtual );
	}
	// undefined
} );

// Undocumented and deprecated - is it actually useful at all?
Api.register( 'scroller().pixelsToRow()', function ( pixels, intParse, virtual ) {
	var ctx = this.context;

	if ( ctx.length && ctx[0].oScroller ) {
		return ctx[0].oScroller.pixelsToRow( pixels, intParse, virtual );
	}
	// undefined
} );

// `scroller().scrollToRow()` is undocumented and deprecated. Use `scroller.toPosition()
Api.register( ['scroller().scrollToRow()', 'scroller.toPosition()'], function ( idx, ani ) {
	this.iterator( 'table', function ( ctx ) {
		if ( ctx.oScroller ) {
			ctx.oScroller.scrollToRow( idx, ani );
		}
	} );

	return this;
} );

Api.register( 'row().scrollTo()', function ( ani ) {
	var that = this;

	this.iterator( 'row', function ( ctx, rowIdx ) {
		if ( ctx.oScroller ) {
			var displayIdx = that
				.rows( { order: 'applied', search: 'applied' } )
				.indexes()
				.indexOf( rowIdx );

			ctx.oScroller.scrollToRow( displayIdx, ani );
		}
	} );

	return this;
} );

Api.register( 'scroller.measure()', function ( redraw ) {
	this.iterator( 'table', function ( ctx ) {
		if ( ctx.oScroller ) {
			ctx.oScroller.measure( redraw );
		}
	} );

	return this;
} );

Api.register( 'scroller.page()', function() {
	var ctx = this.context;

	if ( ctx.length && ctx[0].oScroller ) {
		return ctx[0].oScroller.pageInfo();
	}
	// undefined
} );

return Scroller;
}));
