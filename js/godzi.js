/**
* Godzi/WebGL
* (c) Copyright 2011 Pelican Mapping
* License: LGPL
* http://godzi.org
*/

/**
* jQuery extension to ensure ordered loading of dependencies. -GW 2011/05
* 
* Inspired by:
*
* $.include - script inclusion jQuery plugin
* Based on idea from http://www.gnucitizen.org/projects/jquery-include/
* @author Tobiasz Cudnik
* @link http://meta20.net/.include_script_inclusion_jQuery_plugin
* @license MIT
*/

// overload jquery's onDomReady
if (jQuery.browser.mozilla || jQuery.browser.opera) {
    document.removeEventListener("DOMContentLoaded", jQuery.ready, false);
    document.addEventListener("DOMContentLoaded", function() { jQuery.ready(); }, false);
}

jQuery.event.remove(window, "load", jQuery.ready);

jQuery.event.add(window, "load", function() { jQuery.ready(); });

jQuery.extend({

    includeList: [],
    includeLoaded: {},
    includePtr: 0,

    includeInOrder: function(libs) {
        this.includeList = libs;
        this.includePtr = 0;
        this.loadInclude(this.includePtr);
    },

    loadNext: function() {
        this.includePtr++;
        if (this.includePtr < this.includeList.length)
            this.loadInclude(this.includePtr);
    },

    loadInclude: function(i) {
        if (this.includePtr >= this.includeList.length)
            return;
        var host = this;
        var url = this.includeList[i].replace('\n', '');
        var script = document.createElement("script");
        script.type = "text/javascript";
        script.src = url;
        
        this.includeLoaded[script] = false;
        
        // set both callbacks to support different browser behaviors
        script.onload = function() {
            if (host.includeLoaded[this] === false) {
                host.includeLoaded[this] = true;
                host.loadNext();
            }
        };
        script.onreadystatechange = function() {
            if (this.readyState != 'complete' && this.readyState != 'loaded')
                return;
            if (host.includedLoaded[this] === false) {
                host.includeLoaded[this] = true;
                host.loadNext();
            }
        };
        
        document.getElementsByTagName('head')[0].appendChild(script);
    },

    readyOld: jQuery.ready,

    ready: function() {
        if (jQuery.isReady)
            return;
        var imReady = jQuery.includePtr >= jQuery.includeList.length;
        if (imReady)
            jQuery.readyOld.apply(jQuery, arguments);
        else
            setTimeout(arguments.callee, 10);
    }
});



if (!Array.prototype.indexOf)
{
  Array.prototype.indexOf = function(searchElement /*, fromIndex */)
  {
    "use strict";

    if (this === void 0 || this === null)
      throw new TypeError();

    var t = Object(this);
    var len = t.length >>> 0;
    if (len === 0)
      return -1;

    var n = 0;
    if (arguments.length > 0)
    {
      n = Number(arguments[1]);
      if (n !== n) // shortcut for verifying if it's NaN
        n = 0;
      else if (n !== 0 && n !== (1 / 0) && n !== -(1 / 0))
        n = (n > 0 || -1) * Math.floor(Math.abs(n));
    }

    if (n >= len)
      return -1;

    var k = n >= 0
          ? n
          : Math.max(len - Math.abs(n), 0);

    for (; k < len; k++)
    {
      if (k in t && t[k] === searchElement)
        return k;
    }
    return -1;
  };
}








var godzi = {};

godzi.init = function(scriptDir, onload) {

    var libs = [
        "jquery/jquery.mousewheel.js",
        "osgjs/osg-debug-0.0.4.js",
        "osgearth/osgearth.js",
        "godzi/godzi.ui.js",
        "godzi/godzi.data.js",
		"godzi/godzi.experimental.js",
		"godzi/godzi.controls.js"
    ];

    var libsWithDir = [];
    for (var i in libs) {
        libsWithDir.push(scriptDir + libs[i]);
    }

    $.includeInOrder(libsWithDir);

    window.addEventListener("load", onload, true);
};

godzi.getWindowSize = function() {

    var myWidth = 0, myHeight = 0;

    if (typeof (window.innerWidth) == 'number') {
        //Non-IE
        myWidth = window.innerWidth;
        myHeight = window.innerHeight;
    }
    else if (document.documentElement && (document.documentElement.clientWidth || document.documentElement.clientHeight)) {
        //IE 6+ in 'standards compliant mode'
        myWidth = document.documentElement.clientWidth;
        myHeight = document.documentElement.clientHeight;
    }
    else if (document.body && (document.body.clientWidth || document.body.clientHeight)) {
        //IE 4 compatible
        myWidth = document.body.clientWidth;
        myHeight = document.body.clientHeight;
    }
    return { 'w': myWidth, 'h': myHeight };
};
