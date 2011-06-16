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

//........................................................................

osg.Matrix.equals = function(a,b) {
  if (a == b) return true;
  
  if (a.length != b.length) return false;
  
  for (var i = 0; i < a.length; i++) {
    if (a[i] != b[i]) return false;
  }
  return true;
}

//........................................................................

godzi.Manipulator = function(map) {
    this.map = map;
    this.center = [0, 0, 0];
    this.minDistance = 0.001;
    this.maxDistance = 1e10;
    this.buttonup = true;
    this.rotation = osg.Quat.makeIdentity();
    this.localAzim = 0;
    this.localPitch = Math.deg2rad(-90);
    this.settingVP = false;
    
};

godzi.Manipulator.prototype = {

    init: function() {
    },

    reset: function() {
        this.init();
    },

    setNode: function(node) {
        this.node = node;
    },

    mouseup: function(ev) {
        this.dragging = false;
        this.panning = false;
        this.releaseButton(ev);
    },

    mousedown: function(ev) {
        this.panning = true;
        this.dragging = true;
        var pos = this.convertEventToCanvas(ev);
        this.clientX = pos[0];
        this.clientY = pos[1];
        this.pushButton(ev);
    },

    pushButton: function() {
        this.dx = this.dy = 0;
        this.buttonup = false;
    },

    releaseButton: function() {
        this.buttonup = true;
    },

    setDistance: function(d) {
        this.distance = d;
        if (this.distance < this.minDistance)
            this.distance = this.minDistance;
        else if (this.distance > this.maxDistance)
            this.distance = this.maxDistance;
    },
    
    getViewpoint: function() {
        var vp = {};
        vp.center = osg.Vec3.copy(this.center, []);
        vp.heading = Math.rad2deg(this.localAzim);
        vp.pitch = Math.rad2deg(this.localPitch);
        vp.range = this.distance;
        return vp;
    },
    
    startViewpointTransition: function(lat,lon,alt,heading,pitch,range,seconds) {

        var newCenter = this.map.lla2world( [Math.deg2rad(lon), Math.deg2rad(lat), alt] );
        
        this.startVP = this.getViewpoint();
        this.deltaHeading = heading - this.startVP.heading;
        this.deltaPitch = pitch - this.startVP.pitch;
        this.deltaRange = range - this.startVP.range;
        this.deltaCenter = osg.Vec3.sub( newCenter, this.startVP.center, [] );
        
        while( this.deltaHeading > 180 ) this.deltaHeading -= 360;
        while( this.deltaHeading < -180 ) this.deltaHeading += 360;
        
        var h0 = this.startVP.range * Math.sin( Math.deg2rad(-this.startVP.pitch));
        var h1 = range * Math.sin( Math.deg2rad(-pitch));
        var dh = h1-h0;
        
        var de;
        if ( this.map.geocentric ) {
            var startFP = this.startVP.center;
            var xyz0 = [this.startVP.center[0], this.startVP.center[1], 0];
            var xyz1 = this.map.lla2world( [Math.deg2rad(lon), Math.deg2rad(lat), 0] );
            de = osg.Vec3.length( osg.Vec3.sub(xyz0, xyz1, []) );
        }
        else {
            de = osg.Vec3.length(this.deltaCenter);
        }    
        
        this.arcHeight = Math.max( de-Math.abs(dh), 0 );
        if ( this.arcHeight > 0 ) {
            var h_apex = 2*(h0+h1) + this.arcHeight;
            var dh2_up = Math.abs(h_apex - h0)/100000.0;
            this.setVPaccel = Math.log10(dh2_up);
            var dh2_down = Math.abs(h_apex - h1)/100000.0;
            this.setVPaccel2 = -Math.log10(dh2_down);                            
        }
        else { 
            var dh2 = (h1-h0)/100000.0;
            this.setVPaccel = Math.abs(dh2) <= 1.0? 0.0 : dh2 > 0.0? Math.log10(dh2) : -Math.log10(-dh2);
            if ( Math.abs( this.setVPaccel ) < 1.0 )
                this.setVPaccel = 0.0;
        }
        
        this.setVPstartTime_ms = new Date().getTime();
        
        //TODO: auto viewpoint duration code (from osgEarth)
        // auto time:
        if ( this.map.geocentric ) {
            var maxDistance = this.map.profile.ellipsoid.radiusEquator;
            var ratio = Math.clamp( de/maxDistance, 0, 1 );
            ratio = Math.accelerationInterp( ratio, -4.5 );
            var minDur = 2.0;
            var maxDur = Math.max(seconds, minDur);
            this.setVPduration_ms = (minDur + ratio*(maxDur-minDur)) * 1000.0;
        }
        else {
            this.setVPduration_ms = seconds * 1000.0;
        }
        
        this.settingVP = true;
    },
    
    updateSetViewpoint: function() {
        var now = new Date().getTime();
        var t = (now - this.setVPstartTime_ms)/this.setVPduration_ms;
        var tp = t;
        
        if ( t >= 1.0 ) {
            t = 1.0;
            tp = 1.0;
            this.settingVP = false;
        }
        else if ( this.arcHeight > 0.0 ) {
            if ( tp <= 0.5 ) {
                var t2 = 2.0*tp;
                t2 = Math.accelerationInterp( t2, this.setVPaccel );
                tp = 0.5*t2;
            }
            else {
                var t2 = 2.0*(tp-0.5);
                t2 = Math.accelerationInterp( t2, this.setVPaccel2 );
                tp = 0.5+(0.5*t2);
            }
            tp = Math.smoothStepInterp( tp );
            //tp = Math.smoothStepInterp( tp );
        }
        else if ( t > 0.0 ) {
            tp = Math.accelerationInterp( tp, this.setVPaccel );
            tp = Math.smoothStepInterp( tp );
        }
        
        var lla = this.map.world2lla( osg.Vec3.add( this.startVP.center, osg.Vec3.mult( this.deltaCenter, tp, [] ), [] ) );
        
        this.setViewpoint(
            Math.rad2deg( lla[1] ),
            Math.rad2deg( lla[0] ),
            lla[2],
            this.startVP.heading + this.deltaHeading * tp,
            this.startVP.pitch + this.deltaPitch * tp,
            this.startVP.range + this.deltaRange * tp + (Math.sin(Math.PI*tp)*this.arcHeight) );
    }
};

//........................................................................

godzi.EarthManipulator = function(map) {
    godzi.Manipulator.call(this, map);
    this.minPitch = Math.deg2rad(-89.9);
    this.maxPitch = Math.deg2rad(-10.0);
    this.buttonup = true;
    this.centerRotation = osg.Quat.makeIdentity();
    this.lockAzimWhilePanning = true;
    this.settingVP = false;
    this.computeHomePosition();
}

godzi.EarthManipulator.prototype = osg.objectInehrit( godzi.Manipulator.prototype, {

    computeHomePosition: function() {
        this.setViewpoint(0, -90, 0, 0, -90, 1e7);
    },

    keydown: function(ev) {
        if (ev.keyCode === 32) {
            this.computeHomePosition();
        } else if (ev.keyCode === 33) { // pageup
            this.distanceIncrease();
            return false;
        } else if (ev.keyCode === 34) { //pagedown
            this.distanceDecrease();
            return false;
        }
        else if (ev.keyCode === 13) { // mode
            this.mode = 1 - this.mode;
            return false;
        }
    },

    mousemove: function(ev) {
        if (this.buttonup === true) {
            return;
        }
        var scaleFactor;
        var curX;
        var curY;
        var deltaX;
        var deltaY;
        var pos = this.convertEventToCanvas(ev);
        curX = pos[0];
        curY = pos[1];

        scaleFactor = 100.0;
        deltaX = (this.clientX - curX) / scaleFactor;
        deltaY = (this.clientY - curY) / scaleFactor;
        this.clientX = curX;
        this.clientY = curY;

        if (ev.shiftKey)
            this.rotateModel(-deltaX, -deltaY);
        else if (ev.ctrlKey)
            this.zoomModel(0, -deltaY);
        else
            this.panModel(-deltaX, -deltaY);

        return false;
    },

    mousewheel: function(ev, intDelta, deltaX, deltaY) {
        this.zoomModel(0, intDelta * 0.1);
    },

    dblclick: function(ev) {
    },

    touchDown: function(ev) {
    },

    touchUp: function(ev) {
    },

    touchMove: function(ev) {
    },

    getCoordFrame: function(point) {
        var l2w = this.map.profile.ellipsoid.local2worldFromECEF(point);
        var trans = osg.Matrix.getTrans(l2w);
        var x = osg.Matrix.transform3x3(l2w, [1, 0, 0]);
        var y = osg.Matrix.transform3x3(l2w, [0, 1, 0]);
        var z = osg.Matrix.transform3x3(l2w, [0, 0, 1]);
        var scale = osg.Matrix.makeScale(1.0 / osg.Vec3.length(x), 1.0 / osg.Vec3.length(y), 1.0 / osg.Vec3.length(z));
        osg.Matrix.postMult(scale, l2w);
        osg.Matrix.setTrans(l2w, trans[0], trans[1], trans[2]);
        return l2w;
    },

    normalizeAzimRad: function(azim) {
        if (Math.abs(azim) > 2 * Math.PI)
            azim = azim % (2 * Math.PI);
        while (azim < -Math.PI)
            azim += 2 * Math.PI;
        while (azim > Math.PI)
            azim -= 2 * Math.PI;
        return azim;
    },

    getSideVector: function(m) {
        return [osg.Matrix.get(m, 0, 0), osg.Matrix.get(m, 0, 1), osg.Matrix.get(m, 0, 2)];
    },

    getFrontVector: function(m) {
        return [osg.Matrix.get(m, 1, 0), osg.Matrix.get(m, 1, 1), osg.Matrix.get(m, 1, 2)];
    },

    getUpVector: function(m) {
        return [osg.Matrix.get(m, 2, 0), osg.Matrix.get(m, 2, 1), osg.Matrix.get(m, 2, 2)];
    },

    getAzimuth: function(frame) {
        return this.localAzim;

//        var m = this.getMatrix();
//        var frameInv = osg.Matrix.inverse(frame);
//        osg.Matrix.postMult(frameInv, m);

//        var look = osg.Vec3.normalize(osg.Vec3.neg(this.getUpVector(m),[]), []);
//        var up = osg.Vec3.normalize(this.getFrontVector(m), []);

//        var azim;
//        if (look[2] < -0.9)
//            azim = Math.atan2(up[0], up[1]);
//        else if (look[2] > 0.9)
//            azim = Math.atan2(-up[0], -up[1]);
//        else
//            azim = Math.atan2(look[0], look[1]);

//        return this.normalizeAzimRad(azim);
    },

    recalcLocalPitchAndAzim: function() {
        var rot = osg.Matrix.makeRotateFromQuat(this.rotation);
        this.localPitch = Math.asin(osg.Matrix.get(rot, 1, 2));
        if (Math.abs(this.localPitch - Math.PI / 2) < 0.000001)
            this.localAzim = Math.atan2(osg.Matrix.get(rot, 0, 1), osg.Matrix.get(rot, 0, 0));
        else
            this.localAzim = Math.atan2(osg.Matrix.get(rot, 1, 0), osg.Matrix.get(rot, 1, 1));
        this.localPitch -= Math.PI / 2.0;
    },

    recalculateCenter: function(localFrame) {
        var lla = this.map.profile.ellipsoid.ecef2lla(osg.Matrix.getTrans(localFrame));
        lla[2] = 0.0;
        this.center = this.map.profile.ellipsoid.lla2ecef(lla);
    },

    panModel: function(dx, dy) {
        var scale = -0.3 * this.distance;
        var oldFrame = this.getCoordFrame(this.center);

        var oldAzim = this.getAzimuth(oldFrame);

        var rotMatrix = osg.Matrix.makeRotateFromQuat(osg.Quat.multiply(this.rotation, this.centerRotation));

        var side = this.getSideVector(rotMatrix);
        var previousUp = this.getUpVector(oldFrame);

        var forward = osg.Vec3.cross(previousUp, side, []);
        side = osg.Vec3.cross(forward, previousUp, []);

        osg.Vec3.normalize(forward, forward);
        osg.Vec3.normalize(side, side);

        var dv = osg.Vec3.add(osg.Vec3.mult(forward, (dy * scale), []), osg.Vec3.mult(side, (dx * scale), []), [])

        this.center = osg.Vec3.add(this.center, dv, []);

        var newFrame = this.getCoordFrame(this.center);

        if (this.lockAzimWhilePanning) {
            this.centerRotation = osg.Matrix.getRotate(newFrame);
        }
        else {
            var newUp = this.getUpVector(newFrame);
            var panRot = osg.Quat.rotateVecOnToVec(previousUp, newUp);
            if (!osg.Quat.zeroRotation(panRot)) {
                osg.Quat.multiply(this.centerRotation, panRot, this.centerRotation);
            }
        }

        this.recalculateCenter(newFrame);
        this.recalcLocalPitchAndAzim();
    },

    rotateModel: function(dx, dy) {

        if (dy + this.localPitch > this.maxPitch || dy + this.localPitch < this.minPitch)
            dy = 0;

        var rotMat = osg.Matrix.makeRotateFromQuat(this.rotation);

        var side = this.getSideVector(rotMat);
        var front = osg.Vec3.cross([0, 0, 1], side, []);
        side = osg.Vec3.cross(front, [0, 0, 1], []);

        osg.Vec3.normalize(front, front);
        osg.Vec3.normalize(side, side);

        this.pv = side;

        var p = osg.Quat.makeRotate(dy, side[0], side[1], side[2]);
        var a = osg.Quat.makeRotate(-dx, 0, 0, 1);

        this.rotation = osg.Quat.multiply(this.rotation, osg.Quat.multiply(p, a));

        this.recalcLocalPitchAndAzim();
    },

    zoomModel: function(dx, dy) {
        var fd = 1000;
        var scale = 1 + dy;
        if (fd * scale > this.minDistance) {
            this.setDistance(this.distance * scale);
        }
        else {
            this.setDistance(this.minDistance);
        }
    },

    getRotation: function(point) {
        var cf = this.getCoordFrame(point);
        var look = osg.Vec3.neg(this.getUpVector(cf), []);
        var worldUp = [0, 0, 1];
        var dot = Math.abs(osg.Vec3.dot(worldUp, look));
        if (Math.abs(dot - 1.0) < 0.000001)
            worldUp = [0, 1, 0];
        var side = osg.Vec3.cross(look, worldUp, []);
        var up = osg.Vec3.normalize(osg.Vec3.cross(side, look, []), []);

        var offset = 1e-6;
        return osg.Matrix.makeLookAt(osg.Vec3.sub(point, osg.Vec3.mult(look, offset, []), []), point, up);
    },

    setViewpoint: function(lat, lon, alt, heading, pitch, range, seconds) {
    
        var lla = [Math.deg2rad(lon), Math.deg2rad(lat), alt];
            
        if ( seconds === undefined ) {
            this.center = this.map.lla2world(lla);

            var newPitch = Math.clamp(Math.deg2rad(pitch), this.minPitch, this.maxPitch);
            var newAzim = this.normalizeAzimRad(Math.deg2rad(heading));

            this.setDistance(range);

            var localFrame = this.getCoordFrame(this.center);
            this.centerRotation = osg.Matrix.getRotate(localFrame);

            var azim_q = osg.Quat.makeRotate(newAzim, 0, 0, 1);
            var pitch_q = osg.Quat.makeRotate(-newPitch - (Math.PI / 2.0), 1, 0, 0);
            var newRot_m = osg.Matrix.makeRotateFromQuat(osg.Quat.multiply(azim_q, pitch_q));
            this.rotation = osg.Matrix.getRotate(osg.Matrix.inverse(newRot_m));

            this.localPitch = newPitch;
            this.localAzim = newAzim;

            this.recalcLocalPitchAndAzim();
            this.recalculateCenter(localFrame);
        }
        else {
            this.startViewpointTransition(lat,lon,alt,heading,pitch,range,seconds);            
            this.recalculateCenter(this.getCoordFrame(this.center));
        }
    },
    
    frame: function() {
        if ( this.settingVP ) {
            this.updateSetViewpoint();
        }        
    },

    getMatrix: function() {
        var m = osg.Matrix.makeTranslate(0, 0, this.distance);
        osg.Matrix.postMult(osg.Matrix.makeRotateFromQuat(this.rotation), m);
        osg.Matrix.postMult(osg.Matrix.makeRotateFromQuat(this.centerRotation), m);
        osg.Matrix.postMult(osg.Matrix.makeTranslate(this.center[0], this.center[1], this.center[2]), m);
        return m;
    },

    getInverseMatrix: function() {
        this.frame();
        var m = osg.Matrix.makeTranslate(-this.center[0], -this.center[1], -this.center[2]);
        osg.Matrix.postMult(osg.Matrix.makeRotateFromQuat(osg.Quat.inverse(this.centerRotation)), m);
        osg.Matrix.postMult(osg.Matrix.makeRotateFromQuat(osg.Quat.inverse(this.rotation)), m);
        osg.Matrix.postMult(osg.Matrix.makeTranslate(0, 0, -this.distance), m);
        return m;
    }
});

//........................................................................

godzi.MapManipulator = function(map) {
    godzi.Manipulator.call(this, map);
    this.computeHomePosition();
};

godzi.MapManipulator.prototype = osg.objectInehrit(godzi.Manipulator.prototype, {

    computeHomePosition: function() {
        this.center = [0,0,0];
        this.distance = osgearth.Extent.width(this.map.profile.extent)/2;
        this.maxDistance = this.distance * 1.5;        
    },
    
    setViewpoint: function(lat, lon, alt, heading, pitch, range, seconds) {
        if ( seconds === undefined || seconds == 0 ) {
            var lla = [Math.deg2rad(lon), Math.deg2rad(lat), alt];
            this.center = this.map.lla2world(lla);
            this.setDistance(range);
        }
        else {
            this.startViewpointTransition(lat, lon, alt, heading, pitch, range, seconds );
        }
    },
    
    panModel: function(dx, dy) {
        var scale = -0.3 * this.distance;
        this.center = osg.Vec3.add(this.center, [dx*scale, dy*scale, 0], []);
        osgearth.Extent.clamp( this.map.profile.extent, this.center );
    },
    
    zoomModel: function(dx, dy) {
        var fd = 1000;
        var scale = 1 + dy;
        if (fd * scale > this.minDistance)
            this.setDistance(this.distance * scale);
        else
            this.setDistance(this.minDistance);
    },
    
    frame: function() {
        if ( this.settingVP ) {
            this.updateSetViewpoint();
        }
    },

    getInverseMatrix: function() {
        this.frame();
        var eye = [];
        osg.Vec3.copy( this.center, eye );
        eye[2] = this.distance;
        var m = osg.Matrix.makeLookAt( eye, this.center, [0,1,0] );
        return m;
    },

    mousemove: function(ev) {
        if (this.buttonup === true) 
            return;
            
        var pos = this.convertEventToCanvas(ev);
        var curX = pos[0];
        var curY = pos[1];

        var scaleFactor = 100.0;
        var deltaX = (this.clientX - curX) / scaleFactor;
        var deltaY = (this.clientY - curY) / scaleFactor;
        this.clientX = curX;
        this.clientY = curY;

        this.panModel(-deltaX, -deltaY);
        return false;
    },

    mousewheel: function(ev, intDelta, deltaX, deltaY) {
        this.zoomModel(0, intDelta * 0.1);
    },
} );

//........................................................................

/**
* MapView
* Installs a 3D WebGL viewer within an HTML5 canvas elements.
*/
godzi.MapView = function(elementId, size, map) {

    this.map = map;
    this.viewer = null;
    this.endFrame = undefined;
    var canvas = document.getElementById(elementId);
    canvas.width = size.w;
    canvas.height = size.h;

    //try {
    this.viewer = new osgViewer.Viewer(canvas);   
     
    //If you don't do this then the mouse manipulators listen for mouse events on the whole dom
    //so dragging other controls end up moving the canvas view.
    this.viewer.eventNode = this.viewer.canvas;
 
    this.viewer.init();
    if ( map.geocentric )
        this.viewer.setupManipulator(new godzi.EarthManipulator(map));
    else
        this.viewer.setupManipulator(new godzi.MapManipulator(map));
    this.viewer.setScene( new osgearth.MapNode(map) ); //map.createNode());
    delete this.viewer.view.light;
    this.viewer.getManipulator().computeHomePosition();
    //this.viewer.run();
    this.run();
    //}
    //catch (er) {
    //osg.log("exception in osgViewer " + er);
    //}
    
    this.frameEnd=[];
};

godzi.MapView.prototype = {

    home: function() {
        this.viewer.getManipulator().computeHomePosition();
    },
    
    projectObjectIntoWindow: function(object) {
        var viewMatrix = this.viewer.view.getViewMatrix();
        var projectionMatrix = this.viewer.view.getProjectionMatrix();
        var windowMatrix = null;
        var vp = this.viewer.view.getViewport();
        if (vp !== undefined) {
        windowMatrix = vp.computeWindowMatrix();
        }

        var matrix = []; 
        osg.Matrix.copy(windowMatrix, matrix);
        osg.Matrix.preMult(matrix, projectionMatrix);
        osg.Matrix.preMult(matrix, viewMatrix);

        var result = osg.Matrix.transformVec3(matrix, object);
        var height = this.viewer.canvas.height;
        result[1] = height - result[1] - 1;
        return result;
    },

    run: function() {
        var that = this;
        var render = function() {
            window.requestAnimationFrame(render, this.canvas);
            that.viewer.frame();
            if (that.frameEnd !== undefined && that.frameEnd != null) {
                //Fire off any frame end callbacks
                for (var i = 0; i < that.frameEnd.length; i++) {
                  that.frameEnd[i]();
                }
            }
            that.map.frame();
        };
        render();
    },
    
    addFrameEndCallback: function(callback) {
      this.frameEnd.push( callback );
    }
};
