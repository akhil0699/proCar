// CodeMirror, copyright (c) by Marijn Haverbeke and others
// Distributed under an MIT license: https://codemirror.net/LICENSE

(function(mod) {
  if (typeof exports == "object" && typeof module == "object") // CommonJS
    mod(require("../../lib/codemirror"));
  else if (typeof define == "function" && define.amd) // AMD
    define(["../../lib/codemirror"], mod);
  else // Plain browser env
    mod(CodeMirror);
})(function(CodeMirror) {
"use strict";

CodeMirror.defineMode("sql", function(config, parserConfig) {
  var client         = parserConfig.client || {},
      atoms          = parserConfig.atoms || {"false": true, "true": true, "null": true},
      builtin        = parserConfig.builtin || set(defaultBuiltin),
      keywords       = parserConfig.keywords || set(sqlKeywords),
      operatorChars  = parserConfig.operatorChars || /^[*+\-%<>!=&|~^\/]/,
      support        = parserConfig.support || {},
      hooks          = parserConfig.hooks || {},
      dateSQL        = parserConfig.dateSQL || {"date" : true, "time" : true, "timestamp" : true},
      backslashStringEscapes = parserConfig.backslashStringEscapes !== false,
      brackets       = parserConfig.brackets || /^[\{}\(\)\[\]]/,
      punctuation    = parserConfig.punctuation || /^[;.,:]/

  function tokenBase(stream, state) {
    var ch = stream.next();

    // call hooks from the mime type
    if (hooks[ch]) {
      var result = hooks[ch](stream, state);
      if (result !== false) return result;
    }

    if (support.hexNumber &&
      ((ch == "0" && stream.match(/^[xX][0-9a-fA-F]+/))
      || (ch == "x" || ch == "X") && stream.match(/^'[0-9a-fA-F]+'/))) {
      // hex
      // ref: http://dev.mysql.com/doc/refman/5.5/en/hexadecimal-literals.html
      return "number";
    } else if (support.binaryNumber &&
      (((ch == "b" || ch == "B") && stream.match(/^'[01]+'/))
      || (ch == "0" && stream.match(/^b[01]+/)))) {
      // bitstring
      // ref: http://dev.mysql.com/doc/refman/5.5/en/bit-field-literals.html
      return "number";
    } else if (ch.charCodeAt(0) > 47 && ch.charCodeAt(0) < 58) {
      // numbers
      // ref: http://dev.mysql.com/doc/refman/5.5/en/number-literals.html
      stream.match(/^[0-9]*(\.[0-9]+)?([eE][-+]?[0-9]+)?/);
      support.decimallessFloat && stream.match(/^\.(?!\.)/);
      return "number";
    } else if (ch == "?" && (stream.eatSpace() || stream.eol() || stream.eat(";"))) {
      // placeholders
      return "variable-3";
    } else if (ch == "'" || (ch == '"' && support.doubleQuote)) {
      // strings
      // ref: http://dev.mysql.com/doc/refman/5.5/en/string-literals.html
      state.tokenize = tokenLiteral(ch);
      return state.tokenize(stream, state);
    } else if ((((support.nCharCast && (ch == "n" || ch == "N"))
        || (support.charsetCast && ch == "_" && stream.match(/[a-z][a-z0-9]*/i)))
        && (stream.peek() == "'" || stream.peek() == '"'))) {
      // charset casting: _utf8'str', N'str', n'str'
      // ref: http://dev.mysql.com/doc/refman/5.5/en/string-literals.html
      return "keyword";
    } else if (support.escapeConstant && (ch == "e" || ch == "E")
        && (stream.peek() == "'" || (stream.peek() == '"' && support.doubleQuote))) {
      // escape constant: E'str', e'str'
      // ref: https://www.postgresql.org/docs/current/sql-syntax-lexical.html#SQL-SYNTAX-STRINGS-ESCAPE
      state.tokenize = function(stream, state) {
        return (state.tokenize = tokenLiteral(stream.next(), true))(stream, state);
      }
      return "keyword";
    } else if (support.commentSlashSlash && ch == "/" && stream.eat("/")) {
      // 1-line comment
      stream.skipToEnd();
      return "comment";
    } else if ((support.commentHash && ch == "#")
        || (ch == "-" && stream.eat("-") && (!support.commentSpaceRequired || stream.eat(" ")))) {
      // 1-line comments
      // ref: https://kb.askmonty.org/en/comment-syntax/
      stream.skipToEnd();
      return "comment";
    } else if (ch == "/" && stream.eat("*")) {
      // multi-line comments
      // ref: https://kb.askmonty.org/en/comment-syntax/
      state.tokenize = tokenComment(1);
      return state.tokenize(stream, state);
    } else if (ch == ".") {
      // .1 for 0.1
      if (support.zerolessFloat && stream.match(/^(?:\d+(?:e[+-]?\d+)?)/i))
        return "number";
      if (stream.match(/^\.+/))
        return null
      // .table_name (ODBC)
      // // ref: http://dev.mysql.com/doc/refman/5.6/en/identifier-qualifiers.html
      if (support.ODBCdotTable && stream.match(/^[\w\d_$#]+/))
        return "variable-2";
    } else if (operatorChars.test(ch)) {
      // operators
      stream.eatWhile(operatorChars);
      return "operator";
    } else if (brackets.test(ch)) {
      // brackets
      return "bracket";
    } else if (punctuation.test(ch)) {
      // punctuation
      stream.eatWhile(punctuation);
      return "punctuation";
    } else if (ch == '{' &&
        (stream.match(/^( )*(d|D|t|T|ts|TS)( )*'[^']*'( )*}/) || stream.match(/^( )*(d|D|t|T|ts|TS)( )*"[^"]*"( )*}/))) {
      // dates (weird ODBC syntax)
      // ref: http://dev.mysql.com/doc/refman/5.5/en/date-and-time-literals.html
      return "number";
    } else {
      stream.eatWhile(/^[_\w\d]/);
      var word = stream.current().toLowerCase();
      // dates (standard SQL syntax)
      // ref: http://dev.mysql.com/doc/refman/5.5/en/date-and-time-literals.html
      if (dateSQL.hasOwnProperty(word) && (stream.match(/^( )+'[^']*'/) || stream.match(/^( )+"[^"]*"/)))
        return "number";
      if (atoms.hasOwnProperty(word)) return "atom";
      if (builtin.hasOwnProperty(word)) return "builtin";
      if (keywords.hasOwnProperty(word)) return "keyword";
      if (client.hasOwnProperty(word)) return "string-2";
      return null;
    }
  }

  // 'string', with char specified in quote escaped by '\'
  function tokenLiteral(quote, backslashEscapes) {
    return function(stream, state) {
      var escaped = false, ch;
      while ((ch = stream.next()) != null) {
        if (ch == quote && !escaped) {
          state.tokenize = tokenBase;
          break;
        }
        escaped = (backslashStringEscapes || backslashEscapes) && !escaped && ch == "\\";
      }
      return "string";
    };
  }
  function tokenComment(depth) {
    return function(stream, state) {
      var m = stream.match(/^.*?(\/\*|\*\/)/)
      if (!m) stream.skipToEnd()
      else if (m[1] == "