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

//...................................................................

osgearth.Extent = {
    width: function(extent) {
        return extent.xmax - extent.xmin;
    },
    height: function(extent) {
        return extent.ymax - extent.ymin;
    },
    center: function(extent) {
        return [(extent.xmin + extent.xmax) / 2, (extent.ymin + extent.ymax) / 2];
    },
    clamp: function(extent, vec2) {
        vec2[0] = osgearth.clamp( vec2[0], extent.xmin, extent.xmax );
        vec2[1] = osgearth.clamp( vec2[1], extent.ymin, extent.ymax );
    }
};

//...................................................................

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
};

//...................................................................

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

//...................................................................

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

//...................................................................

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

// this is spherical mercator, but that's ok for now
osgearth.MercatorProfile.prototype = osg.objectInehrit(osgearth.Profile.prototype, {

    getUV: function(localExtentLLA, lla) {
        var u = (lla[0] - localExtentLLA.xmin) / osgearth.Extent.width(localExtentLLA);
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

    fromLLA: function(lla) {
        return [
            lla[0] * this.ellipsoid.radiusEquator,
            this.ellipsoid.absMaxMerc_m - this.lat2v(lla[1]) * 2 * this.ellipsoid.absMaxMerc_m,
            lla[2]];
    },

    toLLA: function(coord) {
        return [
            coord[0] / this.ellipsoid.radiusEquator,
            2 * Math.atan(Math.exp(coord[1]/this.ellipsoid.radiusEquator)) - Math.PI / 2,
            coord[2]];
    }
});

//...................................................................

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

//...................................................................

/**
 * Custom texture class that customizes the fragment shader
 */
osgearth.Texture = function() {

    osg.Texture.call(this);
    
    var fragInit = function(unit) {
        var str = "varying vec2 FragTexCoord" + unit + ";\n";
        str += "uniform sampler2D Texture" + unit + ";\n";
        str += "vec4 texColor" + unit + ";\n";
        str += "uniform bool Texture" + unit + "Visible;\n";
        return str;
    };
    this.setShaderGeneratorFunction(fragInit, osg.ShaderGeneratorType.FragmentInit);

    var fragMain = function(unit) {
//        var str = "texColor" + unit + " = texture2D( Texture" + unit + ", FragTexCoord" + unit + ".xy );\n";
//        str += "fragColor = vec4(mix(fragColor.rgb,texColor" + unit + ".rgb,texColor" + unit + ".a),1);\n";
//        return str;
        
        var str = "if (Texture" + unit + "Visible) { \n";
        str += "  texColor" + unit + " = texture2D( Texture" + unit + ", FragTexCoord" + unit + ".xy );\n";
        str += "}\n";
        str += "else {\n";
        str += "  texColor" + unit + " = vec4(1,0,0,1);\n";
        str += "};\n";                
        str += "  fragColor = vec4(mix(fragColor.rgb,texColor" + unit + ".rgb,texColor" + unit + ".a),1);\n";            
        return str;        
    };
    this.setShaderGeneratorFunction(fragMain, osg.ShaderGeneratorType.FragmentMain);
};

osgearth.Texture.prototype = osg.objectInehrit(osg.Texture.prototype, {
    cloneType: function() { var t = new osgearth.Texture(); t.default_type = true; return t; }
    
    /*
=======
    cloneType: function() { var t = new osgearth.Texture(); t.default_type = true; return t; },
    
    writeToShader: function(unit, type) {
        var str = "";
        switch (type) {
            case osg.ShaderGeneratorType.VertexInit:
                str = "attribute vec2 TexCoord" + unit + ";\n";
                str += "varying vec2 FragTexCoord" + unit + ";\n";
                break;
            case osg.ShaderGeneratorType.VertexMain:
                str = "FragTexCoord" + unit + " = TexCoord" + unit + ";\n";
                break;
            case osg.ShaderGeneratorType.FragmentInit:
                str = "varying vec2 FragTexCoord" + unit + ";\n";
                str += "uniform sampler2D Texture" + unit + ";\n";
                str += "vec4 texColor" + unit + ";\n";
                str += "uniform bool Texture" + unit + "Visible;\n";
                break;
            case osg.ShaderGeneratorType.FragmentMain:
                str = "if (Texture" + unit + "Visible){\n";                
//                str =  " if (true) {\n";
                str += "  texColor" + unit + " = texture2D( Texture" + unit + ", FragTexCoord" + unit + ".xy );\n";
                str += "}\n";
                str += "else {\n";
                str += "  texColor" + unit + " = vec4(1,0,0,1);\n";
                str += "};\n";                
                str += "  fragColor = vec4(mix(fragColor.rgb,texColor" + unit + ".rgb,texColor" + unit + ".a),1);\n";            
                // hack to prevent the default ShaderGenerator code from overriding our mix:
                str += "texColor" + unit + " = vec4(1,1,1,1);\n";
                break;
        }
        return str;
    },
    */
    
   /*
   getOrCreateUniforms: function(unit) {
        if (osg.Texture.uniforms === undefined) {
            osg.Texture.uniforms = [];
        }
        if (osg.Texture.uniforms[unit] === undefined) {
            var name = this.getType() + unit;
            var uniforms = {};
            uniforms[name] = osg.Uniform.createInt1(unit, name);
            uniforms[name + "Visible"] = osg.Uniform.createInt1(true, name + "Visible");
            var uniformKeys = [name, name + "Visible"];
            uniforms.uniformKeys = uniformKeys;

            osg.Texture.uniforms[unit] = uniforms;                        
        }
        return osg.Texture.uniforms[unit];
    },*/
});

osgearth.Texture.create = function(imageSource) {
    var a = new osgearth.Texture();
    if (imageSource !== undefined) {
        var img = new Image();
        img.src = imageSource;
        a.setImage(img);
    }
    return a;
};

//...................................................................

osgearth.ImageLayer = function(name) {
    this.name = name;
    this.profile = undefined;
    this.opacity = 1.0;
    this.visible = true;
};

osgearth.ImageLayer.prototype = {

    name: function() {
        return this.name;
    },
    
    getOpacity: function() {
        return this.opacity;
    },
    
    setOpacity: function(opacity) {
        if (this.opacity != opacity) {
          this.opacity = opacity;
          if (this.opacityUniform !== undefined ) {
           this.opacityUniform.set( [this.opacity] );
         }
        }
    },
    
    getVisible: function() {
      return this.visible;
    },
    
    setVisible: function( visible ) {
      if (this.visible != visible) {
         this.visible = visible;
         if (this.visibleUniform !== undefined ) {
           this.visibleUniform.set( [this.visible] );
         }
      }
    }        
};

//...................................................................

osgearth.Map = function() {
    this.profile = new osgearth.GeodeticProfile();
    this.usingDefaultProfile = true;

    // whether the map is round (geocentric) or flat (projected)
    this.geocentric = true;

    // whether this is a 3D or a 2D map
    this.threeD = true;

    // ordered list of image layers in the map
    this.imageLayers = [];

    // these handle the automatic deletion of culled tiles.
    this.drawList = {};
    this.expireList = {};

    // you can monitor this value to see how many tiles are being drawn each frame.
    this.drawListSize = 0;

    // don't subdivide beyond this level
    this.maxLevel = 22;
};

osgearth.Map.prototype = {

    addImageLayer: function(layer) {
        this.imageLayers.push(layer);
        if (this.usingDefaultProfile && layer.profile !== undefined) {
            this.profile = layer.profile;
            this.usingDefaultProfile = false;            
        }       
    },

    // converts [long,lat,alt] to world model coordinates [x,y,z]
    lla2world: function(lla) {
        if (this.geocentric)
            return this.profile.ellipsoid.lla2ecef(lla);
        else
            return this.profile.fromLLA(lla);
    },

    world2lla: function(world) {
        if (this.geocentric)
            return this.profile.ellipsoid.ecef2lla(world);
        else
            return this.profile.toLLA(world);
    },

    createNode: function() {
        var node = new osg.Node();
        for (var x = 0; x < this.profile.baseTilesX; x++) {
            for (var y = 0; y < this.profile.baseTilesY; y++) {
                node.addChild(new osgearth.Tile([x, y, 0], this, null));
            }
        }

        node.getOrCreateStateSet().setAttributeAndMode(new osg.CullFace('DISABLE'));

        this.node = node;
        
        for (var i = 0; i < this.imageLayers.length; i++) {                
          var visible = this.imageLayers[i].getVisible() ? true : false;
          var visibleUniform =  osg.Uniform.createInt1(visible,"Texture" + i + "Visible");
          this.node.getOrCreateStateSet().addUniform(visibleUniform, osg.StateAttribute.ON | osg.StateAttribute.OVERRIDE);
          this.imageLayers[i].visibleUniform = visibleUniform;          

          var opacity = this.imageLayers[i].getOpacity();
          var opacityUniform =  osg.Uniform.createFloat1(opacity,"Texture" + i + "Opacity");          
          this.node.getOrCreateStateSet().addUniform(opacityUniform, osg.StateAttribute.ON | osg.StateAttribute.OVERRIDE);
          this.imageLayers[i].opacityUniform = opacityUniform;          
          this.node.getOrCreateStateSet().addUniform(opacityUniform, osg.StateAttribute.ON | osg.StateAttribute.OVERRIDE);
        }
        
        var program = osg.Program.create(
            osg.Shader.create(gl.VERTEX_SHADER, this.getVertexShader()),
            osg.Shader.create(gl.FRAGMENT_SHADER, this.getFragmentShader())
        );      
        node.getOrCreateStateSet().setAttributeAndMode( program, osg.StateAttribute.ON | osg.StateAttribute.OVERRIDE );
        node.getOrCreateStateSet().addUniform(osg.Uniform.createInt1(0, "Texture0"));
        node.getOrCreateStateSet().addUniform(osg.Uniform.createInt1(1, "Texture1"));               
        
        return node;
    },

    // called by Tile::traverse to tell the map that the tile is in use
    markTileDrawn: function(tile) {
        this.drawList[tile.key] = tile;
        this.expireList[tile.key] = null;
        this.drawListSize++;
    },

    frame: function() {
        // anything left in the expiration list gets deleted (well its children anyway)
        for (var key in this.expireList) {
            tile = this.expireList[key];
            if (tile !== undefined && tile != null && tile.parents.length > 0) {
                tile.resetSubtiles();
            }
        }

        // use this frame's draw list as the next frame's expiration list.
        this.expireList = this.drawList;
        delete this.drawList;
        this.drawList = {};
        this.drawListSize = 0;
    },
    
    getVertexShader: function() {
      return [
       "",
       "#ifdef GL_ES",
       "precision highp float;",
       "#endif",
       "attribute vec3 Vertex;",
       "attribute vec4 Color;",
       "attribute vec3 Normal;",
       "uniform int ArrayColorEnabled;",
       "uniform mat4 ModelViewMatrix;",
       "uniform mat4 ProjectionMatrix;",
       "uniform mat4 NormalMatrix;",
       "varying vec4 VertexColor;",
       "attribute vec2 TexCoord0;",
       "varying vec2 FragTexCoord0;",
       "attribute vec2 TexCoord1;",
       "varying vec2 FragTexCoord1;",
       "uniform vec4 MaterialAmbient;",
       "uniform vec4 MaterialDiffuse;",
       "uniform vec4 MaterialSpecular;",
       "uniform vec4 MaterialEmission;",
       "uniform float MaterialShininess;",
       "vec4 Ambient;",
       "vec4 Diffuse;",
       "vec4 Specular;",
       "vec4 ftransform() {",
       "  return ProjectionMatrix * ModelViewMatrix * vec4(Vertex, 1.0);",
       "}",
       "void main(void) {",
       "  gl_Position = ftransform();",
       "  if (ArrayColorEnabled == 1) VertexColor = Color;",
       "  else VertexColor = vec4(1.0,1.0,1.0,1.0);",
       "  FragTexCoord0 = TexCoord0;",
       "  FragTexCoord1 = TexCoord1;",
       "}",
       ""
      ].join('\n'); 
    },

    getFragmentShader: function() {
    return [
      "",
      "#ifdef GL_ES",
      "precision highp float;",
      "#endif",
      "varying vec4 VertexColor;",
      "uniform int ArrayColorEnabled;",
      "vec4 fragColor;",
      "varying vec2 FragTexCoord0;",
      "uniform sampler2D Texture0;",
      "uniform float Texture0Opacity;",
      "vec4 texColor0;",
      "uniform bool Texture0Visible;",
      "uniform float Texture1Opacity;",
      "varying vec2 FragTexCoord1;",
      "uniform sampler2D Texture1;",
      "vec4 texColor1;",
      "uniform bool Texture1Visible;",
      "void main(void) {",
      "  fragColor = VertexColor;",
      "  if (Texture0Visible){",
      "    texColor0 = texture2D( Texture0, FragTexCoord0.xy );",
      "  }",
      " else {",
      "     texColor0 = vec4(0,0,0,0);",
      " };",
      " fragColor = vec4(mix(fragColor.rgb,texColor0.rgb,texColor0.a * Texture0Opacity),1);",
      " texColor0 = vec4(1,1,1,1);",
      " if (Texture1Visible){",
      "   texColor1 = texture2D( Texture1, FragTexCoord1.xy );",
      " }",
      " else {",
      "   texColor1 = vec4(1,0,0,0);",
      " };",
      " fragColor = vec4(mix(fragColor.rgb,texColor1.rgb,texColor1.a * Texture1Opacity),1);",
      " texColor1 = vec4(1,1,1,1);",
      " fragColor = fragColor * texColor0;",
      " fragColor = fragColor * texColor1;",
      " gl_FragColor = fragColor;",
      "}",
      
     ].join('\n');

    }

};

//...................................................................

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

    this.centerWorld = map.lla2world([centerLLA[0], centerLLA[1], 0]);

    this.centerNormal = [];
    osg.Vec3.normalize(this.centerWorld, this.centerNormal);
    this.deviation = 0.0;

    this.geometry = null;
    this.subtilesRequested = false;
    this.subtileRange = 1e7;
    this.textures = [];

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

    allTexturesReady: function() {
        for (var i = 0; i < this.textures.length; i++) {
            if (!this.textures[i].isImageReady()) {
                return false;
            }
        }
        return true;
    },

    resetSubtiles: function() {
        this.removeChildren();
        this.subtilesRequested = false;
    },

    build: function() {
        var verts = [];
        var elements = [];
        var normals = [];
        var colors = [];
        var texcoords0 = [];
        var corner = [];

        var numRows = this.map.threeD ? 8 : 2;
        var numCols = this.map.threeD ? 8 : 2;

        var extentLLA = osgearth.TileKey.getExtentLLA(this.key, this.map.profile);
        var lonSpacing = osgearth.Extent.width(extentLLA) / (numCols - 1);
        var latSpacing = osgearth.Extent.height(extentLLA) / (numRows - 1);

        // localizer matrix:
        var tile2world =
            this.map.threeD ?
            this.map.profile.ellipsoid.local2worldFromECEF(this.centerWorld) :
            osg.Matrix.makeTranslate(this.centerWorld[0], this.centerWorld[1], this.centerWorld[2]);
        var world2tile = [];
        osg.Matrix.inverse(tile2world, world2tile);

        var e = 0, v = 0, c = 0, tc = 0, vi = 0;

        for (var row = 0; row < numRows; row++) {
            var t = row / (numRows - 1);

            for (var col = 0; col < numCols; col++) {
                var s = col / (numCols - 1);
                var lla = [extentLLA.xmin + lonSpacing * col, extentLLA.ymin + latSpacing * row, 0.0];

                var world = this.map.lla2world(lla);
                var vert = osg.Matrix.transformVec3(world2tile, world, []);
                this.insertArray(vert, verts, v);

                // todo: fix for elevation.
                var normal =
                    this.map.geocentric ? osg.Vec3.normalize(vert, []) :
                    [0, 0, 1];

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
                var uv = [s, t];
                if (this.map.profile.getUV !== undefined)
                    uv = this.map.profile.getUV(extentLLA, lla);

                this.insertArray([s, uv[1]], texcoords0, tc);
                tc += 2;

                if (row == 0 && col == 0)
                    corner[0] = world;
                else if (row == 0 && col == numCols - 1)
                    corner[1] = world;
                else if (row == numRows - 1 && col == 0)
                    corner[2] = world;
                else if (row == numRows - 1 && col == numCols - 1)
                    corner[3] = world;
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
            var tex = layer.createTexture(this.key, this.map.profile);
            this.textures.push(tex);
            this.geometry.getOrCreateStateSet().setTextureAttributeAndMode(i, tex);
            eval("this.geometry.getAttributes().TexCoord" + i + " = osg.BufferArray.create(gl.ARRAY_BUFFER, texcoords0, 2);");
        }

        this.xform = new osg.MatrixTransform();
        this.xform.setMatrix(tile2world);
        this.xform.addChild(this.geometry);

        this.subtileRange = this.getBound().radius() * 3;

        // now determine the tile's deviation for geocentric normal-based culling
        if (this.map.geocentric && this.key[2] > 0) {
            for (var i = 0; i < 4; i++) {
                var vec = [];
                osg.Vec3.sub(corner[i], this.centerWorld, vec);
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
            osg.Vec3.sub(eye, this.centerWorld, centerToEye);
            osg.Vec3.normalize(centerToEye, centerToEye);

            if (this.key[2] == 0 || !this.map.geocentric || osg.Vec3.dot(centerToEye, this.centerNormal) >= this.deviation) {

                // tell the map we're drawing this tile (so it doesn't get exipred)
                this.map.markTileDrawn(this);

                var bound = this.getBound();
                var range = osg.Vec3.length(osg.Vec3.sub(eye, bound.center(), []));

                var traverseChildren = true;
                var numChildren = this.children.length;

                if (range > this.subtileRange || this.key[2] >= this.map.maxLevel) {
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
                            if (!this.children[i].allTexturesReady()) {
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
