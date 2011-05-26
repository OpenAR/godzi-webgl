/**
* Godzi/WebGL
* (c) Copyright 2011 Pelican Mapping
* License: LGPL
* http://godzi.org
*/

/**
 * EarthManipulator
 * Mouse/keyboard motion model for navigating a 3D global map
 */

godzi.EarthManipulator = function(map) {
    osgGA.OrbitManipulator.call(this);
    this.map = map;
    this.minDistance = map.profile.ellipsoid.radiusEquator;
    this.maxDistance = this.minDistance * 2;
};

godzi.EarthManipulator.prototype = osg.objectInehrit(osgGA.OrbitManipulator.prototype, {

    getElevation: function() {
        return Math.max(this.distance - this.minDistance, 0.0);
    },
    
    getScaleFactor: function() {
        var ratio = (this.getElevation()/(this.maxDistance-this.minDistance));
        return Math.min( 10.0 / ratio, 5500 );
    },

    mousemove: function(ev) {
        if (this.buttonup === true) {
            return;
        }
        var pos = this.convertEventToCanvas(ev);
        var curX = pos[0];
        var curY = pos[1];
        var scaleFactor = this.getScaleFactor();
        var deltaX = (this.clientX - curX) / scaleFactor;
        var deltaY = (this.clientY - curY) / scaleFactor;
        this.clientX = curX;
        this.clientY = curY;

        this.update(deltaX, deltaY);
        return false;
    },

    zoomModel: function(dx, dy) {
        this.distance += (dy * getScaleFactor());
    },
    
    distanceIncrease: function() {
        var h = this.getElevation();
        var currentTarget = this.targetDistance;
        var newTarget = currentTarget + h/10.0;
        if (this.maxDistance > 0) {
            if (newTarget > this.maxDistance) {
                newTarget = this.maxDistance;
            }
        }
        this.distance = currentTarget;
        this.targetDistance = newTarget;
        this.timeMotion = (new Date()).getTime();
    },
    
    distanceDecrease: function() {
        var h = this.getElevation();
        var currentTarget = this.targetDistance;
        var newTarget = currentTarget - h/10.0;
        if (this.minDistance > 0) {
            if (newTarget < this.minDistance) {
                newTarget = this.minDistance;
            }
        }
        this.distance = currentTarget;
        this.targetDistance = newTarget;
        this.timeMotion = (new Date()).getTime();
    },
});

//........................................................................

/**
* MapView
* Installs a 3D WebGL viewer within an HTML5 canvas elements.
*/
godzi.MapView = function(elementId, size, map) {

    this.map = map;
    this.viewer = null;
    var canvas = document.getElementById(elementId);
    canvas.width = size.w;
    canvas.height = size.h;

    try {
        this.viewer = new osgViewer.Viewer(canvas);
        this.viewer.init();
        this.viewer.setupManipulator(new godzi.EarthManipulator(map));
        //this.viewer.initStats({});
        this.viewer.setScene(map.createNode());
        delete this.viewer.view.light;
        this.viewer.getManipulator().computeHomePosition();
        this.viewer.run();
    }
    catch (er) {
        osg.log("exception in osgViewer " + er);
    }
};