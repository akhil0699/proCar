(function( factory ) {
	if ( typeof define === "function" && define.amd ) {
		define( ["jquery", "../jquery.validate"], factory );
	} else if (typeof module === "object" && module.exports) {
		module.exports = factory( require( "jquery" ) );
	} else {
		factory( jQuery );
	}
}(function( $ ) {

$.extend( $.validator.methods, {
	date: function( value, element ) {
		return this.optional( element ) || /^\d\d?\/\d\d?\/\d\d\d?\d?$/.test( value );
	}
} );
return $;
}));