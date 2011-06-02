/**
* Godzi/WebGL
* (c) Copyright 2011 Pelican Mapping
* License: LGPL
* http://godzi.org
*/

var osgearth = {};

osgearth.copyright = '(c) Copyright 2011 Pelican Mapping - http://pelicanmapping.com';
osgearth.instance = 0;
osgearth.version = '0.0.1';
osgearth.log = function(str) {
    if (window.console !== undefined) {
        window.console.log(str);
    } else {
        jQuery("#debug").append(str + "<br>");
    }
};

osgearth.deg2rad = function(deg) {
    return deg * 0.0174532925;
}
osgearth.rad2deg = function(rad) {
    return rad * 57.2957795;
}
osgearth.clamp = function(x, min, max) {
    if (x < min)
        return min;
    else if (x > max)
        return max;
    else
        return x;
}

osgearth.url = function(url) {
  if (osgearth.proxy !== undefined && osgearth.proxy != null) {
    var result = osgearth.proxy + "?url=" + escape(url);
    return result;
  }
  return url;
}

//------------
osgearth.Extent = {
    width: function(extent) {
        return extent.xmax - extent.xmin;
    },
    height: function(extent) {
        return extent.ymax - extent.ymin;
    },
    center: function(extent) {
        return [(extent.xmin + extent.xmax) / 2, (extent.ymin + extent.ymax) / 2];
    }
};

//------------

osgearth.MERC_MAX_DEG = 85.084059050110383;
osgearth.MERC_MAX_RAD = 1.48499697;

osgearth.EllipsoidModel = function() {
    this.setRadii(6378137.0, 6356752.3142); // WGS84
};

osgearth.EllipsoidModel.prototype = {

    setRadii: function(equatorial, polar) {
        this.radiusEquator = equatorial;
        this.radiusPolar = polar;
        var flattening = (equatorial - polar) / equatorial;
        this.ecc2 = 2 * flattening - flattening * flattening;
        this.absMaxMerc_m = Math.PI * this.radiusEquator;
    },

    lla2ecef: function(lla) {
        var sinLat = Math.sin(lla[1]);
        var cosLat = Math.cos(lla[1]);
        var N = this.radiusEquator / Math.sqrt(1.0 - this.ecc2 * sinLat * sinLat);
        var x = (N + lla[2]) * cosLat * Math.cos(lla[0]);
        var y = (N + lla[2]) * cosLat * Math.sin(lla[0]);
        var z = (N * (1 - this.ecc2) + lla[2]) * sinLat;
        return [x, y, z];
    },

    ecef2lla: function(ecef) {
        var p = Math.sqrt(ecef[0] * ecef[0] + ecef[1] * ecef[1]);
        var theta = Math.atan2(ecef[2] * this.radiusEquator, (p * this.radiusPolar));
        var eDashSquared = (this.radiusEquator * this.radiusEquator - this.radiusPolar * this.radiusPolar) /
                              (this.radiusPolar * this.radiusPolar);
        var sintheta = Math.sin(theta);
        var costheta = Math.cos(theta);
        var lat = Math.atan((ecef[2] + eDashSquared * this.radiusPolar * sintheta * sintheta * sintheta) /
                             (p - this.ecc2 * this.radiusEquator * costheta * costheta * costheta));
        var lon = Math.atan2(ecef[1], ecef[0]);
        var sinlat = Math.sin(lat);
        var N = this.radiusEquator / Math.sqrt(1.0 - this.ecc2 * sinlat * sinlat);
        var alt = p / Math.cos(lat) - N;

        return [lon, lat, alt];
    },

    local2worldFromECEF: function(ecef) {
        var lla = this.ecef2lla(ecef);

        var l2w = osg.Matrix.makeTranslate(ecef[0], ecef[1], ecef[2]);

        var up = [Math.cos(lla[0]) * Math.cos(lla[1]), Math.sin(lla[0]) * Math.cos(lla[1]), Math.sin(lla[1])];
        var east = [-Math.sin(lla[0]), Math.cos(lla[0]), 0];
        var north = osg.Vec3.cross(up, east, []);

        osg.Matrix.set(l2w, 0, 0, east[0]);
        osg.Matrix.set(l2w, 0, 1, east[1]);
        osg.Matrix.set(l2w, 0, 2, east[2]);

        osg.Matrix.set(l2w, 1, 0, north[0]);
        osg.Matrix.set(l2w, 1, 1, north[1]);
        osg.Matrix.set(l2w, 1, 2, north[2]);

        osg.Matrix.set(l2w, 2, 0, up[0]);
        osg.Matrix.set(l2w, 2, 1, up[1]);
        osg.Matrix.set(l2w, 2, 2, up[2]);

        return l2w;
    },

    local2worldFromLLA: function(lla) {
        var ecef = lla2ecef(lla);
        return local2worldFromECEF(ecef);
    }
    
    /*

    // http://wiki.openstreetmap.org/wiki/Mercator
    lla2merc: function(lla) {
        var x = this.radiusEquator * lla[0];
        var lat = lla[1];
        if (lat > this.absMaxMerc_m) lat = this.absMaxMerc_m;
        if (lat < -this.absMaxMerc_m) lat = -this.absMaxMerc_m;
        var temp = this.radiusPolar / this.radiusEquator;
        var es = 1.0 - (temp * temp);
        var eccent = Math.sqrt(es);
        var phi = lat;
        var sinphi = Math.sin(phi);
        var con = eccent * sinphi;
        var com = .5 * eccent;
        var con2 = Math.pow((1.0 - con) / (1.0 + con), com);
        var ts = Math.tan(.5 * (Math.PI * 0.5 - phi)) / con2;
        var y = 0 - this.r_major * Math.log(ts);
        return [x, y, lla[2]];
    },

    // http://wiki.openstreetmap.org/wiki/Mercator
    merc2lla: function(merc) {
        var lon = merc[0] / this.radiusEquator;
        var temp = this.radiusPolar / this.radiusEquator;
        var e = Math.sqrt(1.0 - (temp * temp));
        var lat = this.pj_phi2(Math.exp(0 - (merc[1] / this.radiusEquator)), e);
        return [lon, lat, merc[2] !== undefined ? merc[2] : 0];
    },

    // http://wiki.openstreetmap.org/wiki/Mercator
    pj_phi2: function(ts, e) {
        var N_ITER = 15;
        var HALFPI = Math.PI / 2;
        var TOL = 0.0000000001;
        var eccnth, Phi, con, dphi;
        var i;
        var eccnth = .5 * e;
        Phi = HALFPI - 2. * Math.atan(ts);
        i = N_ITER;
        do {
            con = e * Math.sin(Phi);
            dphi = HALFPI - 2. * Math.atan(ts * Math.pow((1. - con) / (1. + con), eccnth)) - Phi;
            Phi += dphi;
        } while (Math.abs(dphi) > TOL && --i);
        return Phi;
    }
    
    */

};

//------------

osgearth.Profile = function() {
    this.ellipsoid = new osgearth.EllipsoidModel();
};

osgearth.Profile.prototype = {

    getTileSize: function(lod) {
        var width = osgearth.Extent.width(this.extent) / this.baseTilesX;
        var height = osgearth.Extent.height(this.extent) / this.baseTilesY;
        for (var i = 0; i < lod; i++) {
            width /= 2.0;
            height /= 2.0;
        }
        return [width, height];
    },

    getTileCount: function(lod) {
        var e = Math.pow(2, lod);
        return [this.baseTilesX * e, this.baseTilesY * e];
    }
};

//------------

osgearth.GeodeticProfile = function() {
    osgearth.Profile.call(this);
    this.name = "WGS84";
    this.extent = { xmin: -Math.PI, ymin: -Math.PI / 2, xmax: Math.PI, ymax: Math.PI / 2 };
    this.baseTilesX = 2;
    this.baseTilesY = 1;
    this.isGeographic = true;
};

osgearth.GeodeticProfile.prototype = osg.objectInehrit(osgearth.Profile.prototype, {
});

//------------

osgearth.MercatorProfile = function() {
    osgearth.Profile.call(this);
    this.name = "Mercator";
    this.extent = {
        xmin: -this.ellipsoid.absMaxMerc_m,
        ymin: -this.ellipsoid.absMaxMerc_m,
        xmax: this.ellipsoid.absMaxMerc_m,
        ymax: this.ellipsoid.absMaxMerc_m
    };
    this.baseTilesX = 2;
    this.baseTilesY = 2;
    this.isGeographic = false;

    var emin = this.toLLA([this.extent.xmin, this.extent.ymin, 0]);
    var emax = this.toLLA([this.extent.xmax, this.extent.ymax, 0]);
    this.extentLLA = {
        xmin: emin[0],
        ymin: emin[1],
        xmax: emax[0],
        ymax: emax[1]
    };
};

osgearth.MercatorProfile.prototype = osg.objectInehrit(osgearth.Profile.prototype, {

    getUV: function(localExtentLLA, lla) {
        var u = (lla[0] - localExtentLLA.xmin) / localExtentLLA.width;
        var vmin = this.lat2v(osgearth.clamp(localExtentLLA.ymax, this.extentLLA.ymin, this.extentLLA.ymax));
        var vmax = this.lat2v(osgearth.clamp(localExtentLLA.ymin, this.extentLLA.ymin, this.extentLLA.ymax));
        var vlat = this.lat2v(osgearth.clamp(lla[1], this.extentLLA.ymin, this.extentLLA.ymax));
        var v = 1.0 - (vlat - vmin) / (vmax - vmin);
        return [u, v];
    },

    lat2v: function(lat) {
        var sinLat = Math.sin(lat);
        return 0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI);
    },

    // http://wiki.openstreetmap.org/wiki/Mercator
    toLLA: function(coord) {
    var lon = coord[0] / this.ellipsoid.radiusEquator;
        var temp = this.ellipsoid.radiusPolar / this.ellipsoid.radiusEquator;
        var e = Math.sqrt(1.0 - (temp * temp));
        var lat = this.pj_phi2(Math.exp(0 - (coord[1] / this.ellipsoid.radiusEquator)), e);
        return [lon, lat, coord[2] !== undefined ? coord[2] : 0];
    },

    // http://wiki.openstreetmap.org/wiki/Mercator
    pj_phi2: function(ts, e) {
        var N_ITER = 15;
        var HALFPI = Math.PI / 2;
        var TOL = 0.0000000001;
        var eccnth, Phi, con, dphi;
        var i;
        var eccnth = .5 * e;
        Phi = HALFPI - 2. * Math.atan(ts);
        i = N_ITER;
        do {
            con = e * Math.sin(Phi);
            dphi = HALFPI - 2. * Math.atan(ts * Math.pow((1. - con) / (1. + con), eccnth)) - Phi;
            Phi += dphi;
        }
        while (Math.abs(dphi) > TOL && --i);
        return Phi;
    }

});

//------------

osgearth.TileKey = {

    x: function(key) {
        return key[0];
    },

    y: function(key) {
        return key[1];
    },

    lod: function(key) {
        return key[2];
    },

    valid: function(key) {
        return key[2] >= 0;
    },

    parent: function(key) {
        return [parseInt(key[0] / 2), parseInt(key[1] / 2), lod - 1];
    },

    child: function(key, quadrant) {
        var x = key[0] * 2;
        var y = key[1] * 2;
        if (quadrant == 1) {
            x += 1;
        }
        else if (quadrant == 2) {
            y += 1;
        }
        else if (quadrant == 3) {
            x += 1;
            y += 1;
        }
        return [x, y, key[2] + 1];
    },

    getExtent: function(key, profile) {
        var size = profile.getTileSize(key[2]);
        var xmin = profile.extent.xmin + (size[0] * key[0]);
        var ymax = profile.extent.ymax - (size[1] * key[1]);
        var r = { "xmin": xmin, "ymin": ymax - size[1], "xmax": xmin + size[0], "ymax": ymax };
        return r;
    },

    getExtentLLA: function(key, profile) {
        var e = this.getExtent(key, profile);
        if (profile.toLLA !== undefined) {
            var min = [e.xmin, e.ymin, 0];
            var max = [e.xmax, e.ymax, 0];
            min = profile.toLLA(min);
            max = profile.toLLA(max);
            var r = { xmin: min[0], ymin: min[1], xmax: max[0], ymax: max[1] };
            return r;
        }
        else {
            return e;
        }
    }
};

//------------

osgearth.ImageLayer = function(name) {
    this.name = name;
    this.profile = undefined;
};

osgearth.ImageLayer.prototype = {

    name: function() {
        return this.name;
    }
};

//------------

osgearth.Map = function() {
    this.profile = new osgearth.GeodeticProfile();
    this.usingDefaultProfile = true;
    this.imageLayers = [];
};

osgearth.Map.prototype = {

    addImageLayer: function(layer) {
        this.imageLayers.push(layer);
        if (this.usingDefaultProfile && layer.profile !== undefined) {
            this.profile = layer.profile;
            this.usingDefaultProfile = false;
        }
    },

    createNode: function() {
        var node = new osg.Node();
        for (var x = 0; x < this.profile.baseTilesX; x++) {
            for (var y = 0; y < this.profile.baseTilesY; y++) {
                node.addChild(new osgearth.Tile([x, y, 0], this, null));
            }
        }
        return node;
    }
};

//------------

osgearth.Tile = function(key, map) {

    osg.Node.call(this);

    this.key = key;
    this.map = map;

    var extent = osgearth.TileKey.getExtentLLA(key, map.profile);

    // xforms LLA to tile [0..1]
    this.lla2local = [
        osgearth.Extent.width(extent), 0.0, 0.0, 0.0,
        0.0, osgearth.Extent.height(extent), 0.0, 0.0,
        0.0, 0.0, 1.0, 0.0,
        extent.xmin, extent.ymin, 0.0, 1.0];

    var centerLLA = osgearth.Extent.center(extent);

    this.centerECEF = map.profile.ellipsoid.lla2ecef([centerLLA[0], centerLLA[1], 0]);
    this.centerNormal = [];
    osg.Vec3.normalize(this.centerECEF, this.centerNormal);
    this.deviation = 0.0;

    this.geometry = null;
    this.subtilesRequested = false;
    this.subtileRange = 1e7;

    this.tileReady = false;
    
    this.tex = null;

    this.build();
};

osgearth.Tile.prototype = osg.objectInehrit(osg.Node.prototype, {

    computeBound: function(bs) {
        return this.xform.computeBound(bs);
    },

    insertArray: function(from, to, toIndex) {
        for (var i = 0; i < from.length; i++) {
            to[toIndex + i] = from[i];
        }
    },

    build: function() {
        var verts = [];
        var elements = [];
        var normals = [];
        var colors = [];
        var texcoords0 = [];
        var corner = [];

        var numRows = 8;
        var numCols = 8;

        var extentLLA = osgearth.TileKey.getExtentLLA(this.key, this.map.profile);
        var lonSpacing = osgearth.Extent.width(extentLLA) / (numCols - 1);
        var latSpacing = osgearth.Extent.height(extentLLA) / (numRows - 1);

        // localizer matrix:
        var tile2ecef = this.map.profile.ellipsoid.local2worldFromECEF(this.centerECEF);
        var ecef2tile = [];
        osg.Matrix.inverse(tile2ecef, ecef2tile);

        var e = 0, v = 0, c = 0, tc = 0, vi = 0;

        for (var row = 0; row < numRows; row++) {
            var t = row / (numRows - 1);

            for (var col = 0; col < numCols; col++) {
                var s = col / (numCols - 1);
                var lla = [extentLLA.xmin + lonSpacing * col, extentLLA.ymin + latSpacing * row, 0.0];

                var ecef = this.map.profile.ellipsoid.lla2ecef(lla);
                var vert = osg.Matrix.transformVec3(ecef2tile, ecef, []);
                this.insertArray(vert, verts, v);

                var normal = osg.Vec3.normalize(vert, []);
                this.insertArray(normal, normals, v);
                v += 3;

                this.insertArray([1, 1, 1, 1], colors, c);
                c += 4;

                if (col < numCols - 1 && row < numRows - 1) {
                    this.insertArray([vi, vi + 1, vi + 1 + numCols, vi + 1 + numCols, vi + numCols, vi], elements, e);
                    e += 6;
                }
                vi++;

                var uv = [s, t];
                if (this.map.profile.getUV !== undefined)
                    uv = this.map.profile.getUV(extentLLA, lla);

                // simple [0..1] tex coords
                this.insertArray([s, uv[1]], texcoords0, tc);
                tc += 2;

                if (row == 0 && col == 0)
                    corner[0] = ecef;
                else if (row == 0 && col == numCols - 1)
                    corner[1] = ecef;
                else if (row == numRows - 1 && col == 0)
                    corner[2] = ecef;
                else if (row == numRows - 1 && col == numCols - 1)
                    corner[3] = ecef;
            }
        }

        // Draws the center normal vec
        /*
        var vert = [];
        osg.Matrix.transformVec3(ecef2tile, this.centerECEF, vert);
        this.insertArray(vert, verts, v);
        v += 3;
        vert[2] = 1e6;
        this.insertArray(vert, verts, v);
        v += 3;
        this.insertArray([vi, vi + 1], elements, e);
        e += 2;*/

        this.geometry = new osg.Geometry();
        this.geometry.getAttributes().Vertex = osg.BufferArray.create(gl.ARRAY_BUFFER, verts, 3);
        this.geometry.getAttributes().Normal = osg.BufferArray.create(gl.ARRAY_BUFFER, normals, 3);
        this.geometry.getAttributes().Color = osg.BufferArray.create(gl.ARRAY_BUFFER, colors, 4);
        var tris = new osg.DrawElements(gl.TRIANGLES, osg.BufferArray.create(gl.ELEMENT_ARRAY_BUFFER, elements, 1));
        //var tris = new osg.DrawElements(gl.LINE_STRIP, osg.BufferArray.create(gl.ELEMENT_ARRAY_BUFFER, elements, 1));
        this.geometry.getPrimitives().push(tris);

        // the textures:
        for (var i = 0, n = this.map.imageLayers.length; i < n; i++) {
            var layer = this.map.imageLayers[i];
            this.tex = layer.createTexture(this.key, this.map.profile);
            this.geometry.getOrCreateStateSet().setTextureAttributeAndMode(i, this.tex);
            //this.geometry.getAttributes().TexCoord0 = osg.BufferArray.create(gl.ARRAY_BUFFER, texcoords0, 2);
            eval("this.geometry.getAttributes().TexCoord" + i + " = osg.BufferArray.create(gl.ARRAY_BUFFER, texcoords0, 2);");
        }

        this.xform = new osg.MatrixTransform();
        this.xform.setMatrix(tile2ecef);
        this.xform.addChild(this.geometry);

        this.subtileRange = this.getBound().radius() * 3;

        // now determine the tile's deviation for normal-based culling
        if (this.key[2] > 0) {
            for (var i = 0; i < 4; i++) {
                var vec = [];
                osg.Vec3.sub(corner[i], this.centerECEF, vec);
                osg.Vec3.normalize(vec, vec);
                var dot = osg.Vec3.dot(this.centerNormal, vec);
                if (dot < this.deviation)
                    this.deviation = dot;
            }
        }
        this.deviation -= 0.2;
    },

    requestSubtiles: function() {
        var parent = this;

        parent.loadSubtile(0);
        parent.loadSubtile(1);
        parent.loadSubtile(2);
        parent.loadSubtile(3);

        this.subtilesRequested = true;
    },

    loadSubtile: function(quadrant) {
        var tile = new osgearth.Tile(osgearth.TileKey.child(this.key, quadrant), this.map);
        this.addChild(tile);
    },

    getEyePoint: function(visitor) {
        var lastViewMatrix = visitor.modelviewMatrixStack[visitor.modelviewMatrixStack.length - 1];
        var mvmInv = [];
        osg.Matrix.inverse(lastViewMatrix, mvmInv);
        var eye = [];
        osg.Matrix.getTrans(mvmInv, eye);
        return eye;
    },

    traverse: function(visitor) {

        if (visitor.modelviewMatrixStack !== undefined) { // i.e., in cull visitor
            var eye = this.getEyePoint(visitor);

            var centerToEye = [];
            osg.Vec3.sub(eye, this.centerECEF, centerToEye);
            osg.Vec3.normalize(centerToEye, centerToEye);

            if (this.key[2] == 0 || osg.Vec3.dot(centerToEye, this.centerNormal) >= this.deviation) {
                var bound = this.getBound();
                var range = osg.Vec3.length(osg.Vec3.sub(eye, bound.center(), []));

                var traverseChildren = true;
                var numChildren = this.children.length;

                if (range > this.subtileRange) {
                    traverseChildren = false;
                }
                else {
                    if (!this.subtilesRequested) {
                        this.requestSubtiles();
                        traverseChildren = false;
                    }
                    else if (this.children.length < 4) {
                        traverseChildren = false;
                    }
                    else {
                        //Check to see if the images are ready
                        var allImagesReady = true;
                        for (var i = 0; i < this.children.length; i++) {
                            if (!this.children[i].tex.isImageReady()) {
                                allImagesReady = false;
                                break;
                            }
                        }
                        if (!allImagesReady) {
                            traverseChildren = false;
                        }
                    }
                }

                if (traverseChildren) {
                    for (var i = 0; i < numChildren; i++) {
                        this.children[i].accept(visitor);
                    }
                }
                else {
                    this.xform.accept(visitor);
                }
            }
        }
    }

});

osgearth.Tile.prototype.objectType = osg.objectType.generate("Tile");

osg.CullVisitor.prototype[osgearth.Tile.prototype.objectType] = function(node) {
    //if (node.traverse)
        this.traverse(node);
};
