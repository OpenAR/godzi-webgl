/**
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
    includeStates: {},
    include: function(url, callback, dependency) {
        if (typeof callback != 'function' && !dependency) {
            dependency = callback;
            callback = null;
        }
        url = url.replace('\n', '');
        jQuery.includeStates[url] = false;
        var script = document.createElement('script');
        script.type = 'text/javascript';
        script.onload = function() {
            jQuery.includeStates[url] = true;
            if (callback)
                callback.call(script);
        };
        script.onreadystatechange = function() {
            if (this.readyState != "complete" && this.readyState != "loaded") return;
            jQuery.includeStates[url] = true;
            if (callback)
                callback.call(script);
        };
        script.src = url;
        if (dependency) {
            if (dependency.constructor != Array)
                dependency = [dependency];
            setTimeout(function() {
                var valid = true;
                $.each(dependency, function(k, v) {
                    if (!v()) {
                        valid = false;
                        return false;
                    }
                })
                if (valid)
                    document.getElementsByTagName('head')[0].appendChild(script);
                else
                    setTimeout(arguments.callee, 10);
            }, 10);
        }
        else
            document.getElementsByTagName('head')[0].appendChild(script);
        return function() {
            return jQuery.includeStates[url];
        }
    },
    readyOld: jQuery.ready,
    ready: function() {
        if (jQuery.isReady) return;
        imReady = true;
        $.each(jQuery.includeStates, function(url, state) {
            if (!state)
                return imReady = false;
        });
        if (imReady) {
            jQuery.readyOld.apply(jQuery, arguments);
        } else {
            setTimeout(arguments.callee, 10);
        }
    }
});

var godzi = {};

godzi.init = function(scriptDir, onload) {

    var libs = [
        "jquery/jquery.mousewheel.js",
        "osgjs/stats.js",
        "osgjs/webgl-utils.js",
        "osgjs/osg.js",
        "osgjs/osgDB.js",
        "osgjs/osgUtil.js",
        "osgjs/osgAnimation.js",
        "osgjs/osgGA.js",
        "osgjs/osgViewer.js",
        "osgearth/osgearth.js",
        "godzi.ui.js"
    ];

    for (var i in libs) {
        $.include(scriptDir + libs[i]);
    }

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
