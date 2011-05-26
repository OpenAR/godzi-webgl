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

osgearth.url = function(url) {
  if (osgearth.proxy !== undefined && osgearth.proxy != null) {
    var result = osgearth.proxy + "?url=" + escape(url);
    return result;
  }
  return url;
}

//------------
osgearth.Extent = {

    xmin: function(extent) {
        return extent[0];
    },
    ymin: function(extent) {
        return extent[1];
    },
    xmax: function(extent) {
        return extent[2];
    },
    ymax: function(extent) {
        return extent[3];
    },
    width: function(extent) {
        return extent[2] - extent[0];
    },
    height: function(extent) {
        return extent[3] - extent[1];
    },
    centerXY: function(extent) {
        return [(extent[0] + extent[2]) / 2, (extent[1] + extent[3]) / 2];
    },
    centerLLA: function(extent) {
        return [(extent[1] + extent[3]) / 2, (extent[0] + extent[2]) / 2];
    }
};

//------------

osgearth.EllipsoidModel = function() {
    this.setRadii(6378137.0, 6356752.3142); // WGS84
};

osgearth.EllipsoidModel.prototype = {

    setRadii: function(equatorial, polar) {
        this.radiusEquator = equatorial;
        this.radiusPolar = polar;
        var flattening = (equatorial - polar) / equatorial;
        this.ecc2 = 2 * flattening - flattening * flattening;
    },

    lla2ecef: function(lla) {
        var sinLat = Math.sin(lla[0]);
        var cosLat = Math.cos(lla[0]);
        var N = this.radiusEquator / Math.sqrt(1.0 - this.ecc2 * sinLat * sinLat);
        var x = (N + lla[2]) * cosLat * Math.cos(lla[1]);
        var y = (N + lla[2]) * cosLat * Math.sin(lla[1]);
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
        
        return [lat, lon, alt];
    },

    local2worldFromECEF: function(ecef) {
        var lla = this.ecef2lla(ecef);

        var l2w = [];
        osg.Matrix.makeTranslate(ecef[0], ecef[1], ecef[2], l2w);

        var up = [Math.cos(lla[1]) * Math.cos(lla[0]), Math.sin(lla[1]) * Math.cos(lla[0]), Math.sin(lla[0])];
        var east = [-Math.sin(lla[1]), Math.cos(lla[1]), 0];
        var north = [];
        osg.Vec3.cross(up, east, north);

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
};

//------------

osgearth.Profile = function() {
    this.extent = [
        osgearth.deg2rad(-180), osgearth.deg2rad(-90),
        osgearth.deg2rad(180),  osgearth.deg2rad(90) ];
    this.ellipsoid = new osgearth.EllipsoidModel();
    this.baseTilesX = 2;
    this.baseTilesY = 1;
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
        var xmin = profile.extent[0] + (size[0] * key[0]);
        var ymax = profile.extent[3] - (size[1] * key[1]);
        return [xmin, ymax - size[1], xmin + size[0], ymax];
    }       
};

//------------

osgearth.ImageLayer = function(name) {
    this.name = name;
};

osgearth.ImageLayer.prototype = {

    name: function() {
        return this.name;
    }
};

//------------

osgearth.Map = function() {
    this.profile = new osgearth.Profile();
    this.imageLayers = [];
};

osgearth.Map.prototype = {

    addImageLayer: function(layer) {
        this.imageLayers.push(layer);
    },

    createNode: function() {
        var node = new osg.Node();
        node.addChild(new osgearth.Tile([0, 0, 0], this, null));
        node.addChild(new osgearth.Tile([1, 0, 0], this, null));
        return node;
    }
};

//------------

osgearth.Tile = function(key, map) {

    osg.Node.call(this);

    this.key = key;
    this.map = map;

    var extent = osgearth.TileKey.getExtent(key, map.profile);

    // xforms LLA to tile [0..1]
    this.lla2local = [
        osgearth.Extent.width(extent), 0.0, 0.0, 0.0,
        0.0, osgearth.Extent.height(extent), 0.0, 0.0,
        0.0, 0.0, 1.0, 0.0,
        extent[0], extent[1], 0.0, 1.0];

    var centerLLA = osgearth.Extent.centerLLA(extent);

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

        var extent = osgearth.TileKey.getExtent(this.key, this.map.profile);
        var lonSpacing = osgearth.Extent.width(extent) / (numCols - 1);
        var latSpacing = osgearth.Extent.height(extent) / (numRows - 1);

        // localizer matrix:
        var tile2ecef = this.map.profile.ellipsoid.local2worldFromECEF(this.centerECEF);
        var ecef2tile = [];
        osg.Matrix.inverse(tile2ecef, ecef2tile);

        var e = 0, v = 0, c = 0, tc = 0, vi = 0;

        for (var row = 0; row < numRows; row++) {
            var t = row / (numRows - 1);

            for (var col = 0; col < numCols; col++) {
                var s = col / (numCols - 1);
                var lla = [extent[1] + latSpacing * row, extent[0] + lonSpacing * col, 0.0];

                var ecef = this.map.profile.ellipsoid.lla2ecef(lla);
                var vert = [];
                osg.Matrix.transformVec3(ecef2tile, ecef, vert);
                this.insertArray(vert, verts, v);

                var normal = [];
                osg.Vec3.normalize(vert, normal);
                this.insertArray(normal, normals, v);

                v += 3;

                this.insertArray([1, 1, 1, 1], colors, c);
                c += 4;

                if (col < numCols - 1 && row < numRows - 1) {
                    this.insertArray([vi, vi + 1, vi + 1 + numCols, vi + 1 + numCols, vi + numCols, vi], elements, e);
                    e += 6;
                }
                vi++;

                // simple [0..1] tex coords
                this.insertArray([s, t], texcoords0, tc);
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
            this.tex = null;
            //if (this.image == null) 
            if (true) {            
              this.tex = layer.createTexture(this.key, this.map.profile);
            }
            else {
              this.tex = osg.Texture.createFromImg(this.image);
            }
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
                var range = osg.Vec3.length(osg.Vec3.sub(eye, bound.center()));

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
                    else
                    {
                      //Check to see if the images are ready
                      var allImagesReady = true;
                      for (var i = 0; i < this.children.length; i++) {
                        if (!this.children[i].tex.isImageReady())
                        {
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