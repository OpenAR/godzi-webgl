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

osgearth.ProxyHost = "proxy.php?url=";

//Makes a URL prepended by the ProxyHost if it's set
osgearth.getURL = function(url) {
    if (osgearth.ProxyHost !== null && window.document.URL.indexOf("file:") === 0) {
        osgearth.ProxyHost = null;
    }
    if (osgearth.ProxyHost !== undefined && osgearth.ProxyHost !== null) {
        url = osgearth.ProxyHost + encodeURIComponent(url);
    }
    return url;
};

//........................................................................

// OSG extensions ...
// eventually submit all this stuff to osgjs:

// osgjs's Quat.mult backwards?
osg.Quat.multiply = function(a, b, r) {
    if (r === undefined) {
        r = [];
    }
    return osg.Quat.mult(b, a, r);
};

osg.Quat.zeroRotation = function(q) {
    return q[0] === 0 && q[1] === 0 && q[2] === 0 && q[3] === 1;
};

osg.Quat.rotateVecOnToVec = function(from, to, r) {
    if (r === undefined) {
        r = [];
    }

    var sourceVector = osg.Vec3.copy(from, []);
    var targetVector = osg.Vec3.copy(to, []);

    var fromLen2 = osg.Vec3.length2(from);
    var fromLen = 0;
    if (fromLen2 < 1 - 1e-7 || fromLen2 > 1 + 1e-7) {
        fromLen = Math.sqrt(fromLen2);
        sourceVector = osg.Vec3.mult(sourceVector, 1.0 / fromLen, []);
    }

    var toLen2 = osg.Vec3.length2(to);
    if (toLen2 < 1 - 1e-7 || toLen2 > 1 + 1e-7) {
        var toLen = 0;
        if (toLen2 > fromLen2 - 1e-7 && toLen2 < fromLen2 + 1e-7) {
            toLen = fromLen;
        }
        else {
            toLen = Math.sqrt(toLen2);
        }
        targetVector = osg.Vec3.mult(targetVector, 1.0 / toLen, []);
    }

    var dotProdPlus1 = 1.0 + osg.Vec3.dot(sourceVector, targetVector);

    if (dotProdPlus1 < 1e-7) {
        var norm;
        if (Math.abs(sourceVector[0]) < 0.6) {
            norm = Math.sqrt(1.0 - sourceVector[0] * sourceVector[0]);
            r[0] = 0.0;
            r[1] = sourceVector[2] / norm;
            r[2] = -sourceVector[1] / norm;
            r[3] = 0.0;
        }
        else if (Math.abs(sourceVector[1]) < 0.6) {
            norm = Math.sqrt(1.0 - sourceVector[1] * sourceVector[1]);
            r[0] = -sourceVector[2] / norm;
            r[1] = 0.0;
            r[2] = sourceVector[0] / norm;
            r[3] = 0.0;
        }
        else {
            norm = Math.sqrt(1.0 - sourceVector[2] * sourceVector[2]);
            r[0] = sourceVector[1] / norm;
            r[1] = -sourceVector[0] / norm;
            r[2] = 0.0;
            r[3] = 0.0;
        }
    }

    else {
        // Find the shortest angle quaternion that transforms normalized vectors
        // into one other. Formula is still valid when vectors are colinear
        var s = Math.sqrt(0.5 * dotProdPlus1);
        var tmp = osg.Vec3.cross(sourceVector, osg.Vec3.mult(targetVector, 1.0 / (2.0 * s)), []);
        r[0] = tmp[0];
        r[1] = tmp[1];
        r[2] = tmp[2];
        r[3] = s;
    }

    return r;
};

osg.StateSet.removeUniform = function(stateSet, name) {
    delete stateSet.uniforms[name];
    var index = stateSet.uniforms.uniformKeys.indexOf(name);
    if (index !== -1) {
        delete stateSet.uniforms.uniformKeys[index];
        stateSet.uniforms.uniformKeys.splice(index, 1);
    }
};

osg.BufferArray.destroy = function(ba) {
    if (ba !== undefined && ba !== null) {
        if (ba.buffer !== undefined && ba.buffer !== null) {
            gl.deleteBuffer(ba.buffer);
        }
    }
};

osg.Geometry.destroy = function(geom) {
    if (geom !== undefined && geom !== null) {
        var i;
        for (i in geom.attributes) {
            osg.BufferArray.destroy(geom.attributes[i]);
        }
        for (i in geom.primitives) {
            var prim = geom.primitives[i];
            if (prim !== undefined && prim !== null) {
                if (prim.indices !== undefined && prim.indices !== null) {
                    osg.BufferArray.destroy(prim.indicies);
                }
            }
        }
    }
};

osg.Texture.destroy = function(tex) {
    if (tex !== undefined && tex !== null) {
        if (tex.textureObject !== null) {
            gl.deleteTexture(tex.textureObject);
            tex.textureObject = null;
            tex.image = undefined;
        }
    }
};

//........................................................................

osgearth.FunctionLocation = {
    VertexPreTexture: 0,
    VertexPreLighting: 1,
    VertexPostLighting: 2,
    FragmentPreTexture: 3,
    FragmentPreLighting: 4,
    FragmentPostLighting: 5
};

osgearth.ShaderFactory = {};

osgearth.ShaderFactory.createVertexShaderMain = function(functions) {
    return [
        "#ifdef GL_ES",
        "precision highp float;",
        "#endif",
        // todo: insert functions here
        "attribute vec3 Vertex;",
        "attribute vec4 Color;",
        "attribute vec3 Normal;",
        "uniform int ArrayColorEnabled;",
        "uniform mat4 ModelViewMatrix;",
        "uniform mat4 ProjectionMatrix;",
        "uniform mat4 NormalMatrix;",
        "uniform int osgearth_LightingEnabled;",
        "varying vec4 VertexColor;",
        "void osgearth_vert_setupTexturing(void);",
        //todo: insert all function prototypes
        "",
        "void main() {",
        "    gl_Position = ProjectionMatrix * ModelViewMatrix * vec4(Vertex, 1.0);",
        "    if (ArrayColorEnabled == 1)",
        "        VertexColor = Color;",
        "    else",
        "        VertexColor = vec4(1.0,1.0,1.0,1.0);",
        "",
        //todo: call VertexPreTexture functions here
        "    osgearth_vert_setupTexturing();",
        //todo: call VertexPreLighting functions here
        //"    if (osgearth_LightingEnabled == 1)";
        //"        osgearth_vert_setupLighting();",
        //todo: call VertexPostLighting functions here
        "}"
    ].join('\n');
};

osgearth.ShaderFactory.createFragmentShaderMain = function(functions) {
    return [
        "#ifdef GL_ES",
        "precision highp float;",
        "#endif",
        "varying vec4 VertexColor;",
        "uniform int osgearth_LightingEnabled;",
        "void osgearth_frag_applyTexturing(inout vec4 color);",
        //todo: insert all function prototypes
        "",
        "void main(void) {",
        "    vec4 color = VertexColor;",
        //todo call FragmentPreTexture functions
        "    osgearth_frag_applyTexturing(color);",
        //todo call FragmentPreLighting functions
        //"    if (osgearth_LightingEnabled == 1)",
        //"        osgearth_frag_applyLighting(color);",
        //todo call FragmentPostLighting functions
        "    gl_FragColor = color;",
        "}"
    ].join('\n');
};

osgearth.ShaderFactory.createVertexSetupTexturing = function(imageLayers) {
    var buf = "";
    var unit;

    for (unit = 0; unit < imageLayers.length; ++unit) {
        buf += "attribute vec2 TexCoord" + unit + ";\n";
        buf += "uniform mat4 TexMat" + unit + ";\n";
        buf += "varying vec2 FragTexCoord" + unit + ";\n";
    }

    buf += "void osgearth_vert_setupTexturing(void) { \n";

    for (unit = 0; unit < imageLayers.length; unit++) {
        buf += "    FragTexCoord" + unit + " = (TexMat" + unit + " * vec4(TexCoord" + unit + ",0,1)).xy;\n";
    }
    buf += "}\n";

    return buf;
};

osgearth.ShaderFactory.createFragmentApplyTexturing = function(imageLayers) {
    var buf = "";
    var unit;

    for (unit = 0; unit < imageLayers.length; ++unit) {
        buf += "varying vec2 FragTexCoord" + unit + ";\n";
        buf += "uniform sampler2D Texture" + unit + ";\n";
        buf += "uniform bool Texture" + unit + "Visible;\n";
        buf += "uniform float Texture" + unit + "Opacity;\n";
    }

    buf += "void osgearth_frag_applyTexturing(inout vec4 color) {\n";
    buf += "    vec4 texel;\n";

    for (unit = 0; unit < imageLayers.length; ++unit) {
        buf += "    if (Texture" + unit + "Visible) { \n";
        buf += "        texel = texture2D(Texture" + unit + ", FragTexCoord" + unit + ".xy );\n";
        buf += "        color = vec4( mix( color.rgb, texel.rgb, texel.a * Texture" + unit + "Opacity), 1);\n";
        buf += "    } \n";
    }

    buf += "}\n";

    return buf;
};

//........................................................................

osgearth.VirtualProgram = function() {
    osg.Program.call(this);

    this.virtualProgramMarker = true;

    // shaders, keyed by a "sematic" string: name + gl shader type
    this.shaderMap = {};

    // key is FunctionLocation; value is array of sematics
    this.funcSemanticsByLocation = {};

    // object, each key is a FunctionLocation, each value is an array of shader sematics
    this.accumulatedFuncSemanticsByLocation = {};

    // cached programs, key = accumalted attribute semantic string
    this.programCache = {};

    this.vertex = {};
    this.fragment = {};

    this._dirty = true;

    // install the base shaders
    this.refreshMains();
};

osgearth.VirtualProgram.prototype = osg.objectInehrit(osg.Program.prototype, {

    isVirtualProgram: function(obj) {
        return true;
    },

    cloneType: function() {
        return new osgearth.VirtualProgram();
    },

    setShader: function(name, type, shaderSource) {
        this.shaderMap[name + ";" + type] = shaderSource;
        this._dirty = true;
    },

    // injects a GLSL function at the specified location
    setFunction: function(name, source, location, priority) {
        if (this.semanticsByLocation[location] === undefined)
            this.semanticsByLocation[location] = [];
        var type = (location <= 2) ? gl.VERTEX_SHADER : gl.FRAGMENT_SHADER;
        var semantic = name + ';' + type;
        this.setShader(semantic, source);
        this.funcSemanticsByLocation[location].push(semantic); //todo: insert sorted by priority
        this._dirty = true;
    },

    // rebuilds the main shader functions.
    refreshMains: function() {
        this.setShader(
            "osgearth_vert_main",
            gl.VERTEX_SHADER,
            osgearth.ShaderFactory.createVertexShaderMain(this.accumulatedFunctions));

        this.setShader(
            "osgearth_frag_main",
            gl.FRAGMENT_SHADER,
            osgearth.ShaderFactory.createFragmentShaderMain(this.accumulatedFunctions));
    },

    apply: function(state) {
        // pull the stack of "Program" attributes
        var attributeStack = state.attributeMap[this.attributeType];
        if (attributeStack === undefined) {
            return;
        }

        // constructs a string that uniquely identifies this accumulated shader program.
        // it is a concatenation of all shader semantics in the current attribute stack.
        var accumulatedSemantic = "";

        for (var i = 0; i < attributeStack.length; ++i) {
            var p = attributeStack[i];
            if (this.isVirtualProgram(p)) {
                for (var semantic in p.shaderMap) {
                    accumulatedSemantic += semantic;
                }
            }
        }

        // add this VP's shaders to the identifier:
        for (var semantic in this.shaderMap) {
            accumulatedSemantic += semantic;
        }

        // see if our gl program is already in the cache:
        this.program = this.programCache[accumulatedSemantic];

        // if not, build and compile it
        if (this.program === undefined) {

            // check for new user functions
            this.refreshAccumulatedFunctions(state);

            // rebuild the shaders
            this.refreshMains();

            // rebulid the shader list:
            var vertShaderSource = "";
            var fragShaderSource = "";

            for (var semantic in this.shaderMap) {
                var type = parseInt(semantic.split(';')[1]);
                if (type === gl.VERTEX_SHADER) {
                    vertShaderSource += this.shaderMap[semantic] + '\n';
                }
                else { // if ( semantic.type === gl.FRAGMENT_SHADER )
                    fragShaderSource += this.shaderMap[semantic] + '\n';
                }
            }

            this.vertex = osg.Shader.create(gl.VERTEX_SHADER, vertShaderSource);
            this.vertex.compile();

            this.fragment = osg.Shader.create(gl.FRAGMENT_SHADER, fragShaderSource);
            this.fragment.compile();

            this.program = gl.createProgram();

            gl.attachShader(this.program, this.vertex.shader);
            gl.attachShader(this.program, this.fragment.shader);
            gl.linkProgram(this.program);
            gl.validateProgram(this.program);

            if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) {
                osg.log("can't link program\n" + "vertex shader:\n" + this.vertex.text + "\n fragment shader:\n" + this.fragment.text);
                osg.log(gl.getProgramInfoLog(this.program));
                debugger;
            }

            this.uniformsCache = {};
            this.uniformsCache.uniformKeys = [];
            this.attributesCache = {};
            this.attributesCache.attributeKeys = [];

            this.cacheUniformList(this.vertex.text);
            this.cacheUniformList(this.fragment.text);
            //osg.log(this.uniformsCache);

            this.cacheAttributeList(this.vertex.text);

            // cache this gl program.
            this.programCache[accumulatedSemantic] = this.program;

            osg.log(vertShaderSource);
            osg.log(fragShaderSource);
        }

        gl.useProgram(this.program);
    },

    refreshAccumulatedFunctions: function(state) {
        // stack of all VirtualProgram attributes:
        var attributeStack = state.attributeMap[this.attributeType];
        if (attributeStack === undefined || attributeStack.length == 0) {
            return;
        }

        // accumulate all the user functions from all the VPs into a single list:
        this.accumulatedFunctions = {};

        for (var i = 0; i < attributeStack.length; ++i) {
            var vp = attributeStack[i];
            if (this.isVirtualProgram(vp)) {
                for (var location in vp.funcSemanticsByLocation) {
                    if (this.accumulatedFuncSemanticsByLocation[location] === undefined)
                        this.accumulatedFuncSemanticsByLocation[location] = {};

                    var semantics = vp.funcSemanticsByLocation[location];
                    for (var j = 0; j < semantics.length; ++j) {
                        var semantic = semantics[j].split(';')[0];
                        this.accumulatedFuncSemanticsByLocation[location][semantic] = semantic;
                    }
                }
            }
        }
    }
});

//........................................................................

Math.deg2rad = function(deg) {
    return deg * 0.0174532925;
};

Math.rad2deg = function(rad) {
    return rad * 57.2957795;
};

Math.clamp = function(x, min, max) {
    if (x < min)
        return min;
    else if (x > max)
        return max;
    else
        return x;
};

Math.log10 = function(n) {
    return Math.log(n) / Math.LN10;
};

Math.powFast = function(x, y) {
    return x / (x + y - y * x);
};

Math.smoothStepInterp = function(t) {
    return (t * t) * (3.0 - 2.0 * t);
};

Math.smootherStepInterp = function(t) {
    return t * t * t * (t * (t * 6 - 15) + 10);
};

Math.accelerationInterp = function(t, a) {
    return a == 0 ? t : a > 0 ? Math.powFast(t, a) : 1.0 - Math.powFast(1.0 - t, -a);
};

//........................................................................

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
        vec2[0] = Math.clamp( vec2[0], extent.xmin, extent.xmax );
        vec2[1] = Math.clamp( vec2[1], extent.ymin, extent.ymax);
    }
};

//...................................................................

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
        var vmin = this.lat2v(Math.clamp(localExtentLLA.ymax, this.extentLLA.ymin, this.extentLLA.ymax));
        var vmax = this.lat2v(Math.clamp(localExtentLLA.ymin, this.extentLLA.ymin, this.extentLLA.ymax));
        var vlat = this.lat2v(Math.clamp(lla[1], this.extentLLA.ymin, this.extentLLA.ymax));
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

    child: function(key, q) {
        var x = (key[0] * 2) + (q == 1 ? 1 : 0) + (q == 3 ? 1 : 0);
        var y = (key[1] * 2) + (q == 2 ? 1 : 0) + (q == 3 ? 1 : 0);
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

osgearth.ImageLayer = function(name) {
    this.name = name;
    this.profile = undefined;
    this.opacity = 1.0;
    this.visible = true;
    this.draw = false; // internal
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
            if (this.opacityUniform !== undefined) {
                this.opacityUniform.set([this.opacity]);
            }
        }
    },

    getVisible: function() {
        return this.visible;
    },

    setVisible: function(visible) {
        if (this.visible != visible) {
            this.visible = visible;
            if (this.visibleUniform !== undefined) {
                this.visibleUniform.set([this.visible]);
            }
        }
    }

};

//...................................................................

osgearth.Map = function(args) {

    this.usingDefaultProfile = false;

    // whether it's a 2D or 3D map
    this.threeD = true;

    // whether the map is round (geocentric) or flat (projected)
    this.geocentric = true;

    // start at this level
    this.minLevel = 0;

    // don't subdivide beyond this level
    this.maxLevel = 22;

    // whether to draw a tile before all the layers have loaded
    this.waitForAllLayers = true;

    // scale factor for tile paging
    this.zoomScale = 1.0;

    if (args !== undefined) {
        if (args.profile !== undefined)
            this.profile = args.profile;
        if (args.threeD !== undefined)
            this.threeD = args.threeD;
        if (args.twoD !== undefined)
            this.threeD = (args.twoD !== true);
        if (args.minLevel !== undefined)
            this.minLevel = args.minLevel;
        if (args.maxLevel !== undefined)
            this.maxLevel = args.maxLevel;
        if (args.waitForAllLayers !== undefined)
            this.waitForAllLayers = args.waitForAllLayers;
        if (args.zoomScale !== undefined)
            this.zoomScale = args.zoomScale;
        if (args.geocentric !== undefined)
            this.geocentric = args.geocentric;
        else if (this.threeD === false)
            this.geocentric = false;
    }

    if (this.profile === undefined) {
        this.profile = new osgearth.GeodeticProfile();
        this.usingDefaultProfile = true;
    }

    // ordered list of image layers in the map
    this.imageLayers = [];

    // these handle the automatic deletion of culled tiles.
    this.drawList = {};
    this.expireList = {};

    // you can monitor this value to see how many tiles are being drawn each frame.
    this.drawListSize = 0;
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
    }
};

//...................................................................

osgearth.MapNode = function(map) {

    osg.Node.call(this);
    this.map = map;

    var rootSize = map.profile.getTileCount(map.minLevel);
    for (var x = 0; x < rootSize[0]; x++) {
        for (var y = 0; y < rootSize[1]; y++) {
            this.addChild(new osgearth.Tile([x, y, map.minLevel], map, null));
        }
    }

    var stateSet = this.getOrCreateStateSet();

    // set up our custom GLSL program
    var vp = new osgearth.VirtualProgram();

    vp.setShader(
        "osgearth_vert_setupTexturing",
        gl.VERTEX_SHADER,
        osgearth.ShaderFactory.createVertexSetupTexturing(map.imageLayers));

    vp.setShader(
        "osgearth_frag_applyTexturing",
        gl.FRAGMENT_SHADER,
        osgearth.ShaderFactory.createFragmentApplyTexturing(map.imageLayers));


    stateSet.setAttributeAndMode(vp, osg.StateAttribute.ON);

    stateSet.setAttributeAndMode(new osg.CullFace('DISABLE'));

    for (var i = 0; i < map.imageLayers.length; i++) {

        var visible = map.imageLayers[i].getVisible() ? true : false;
        var visibleUniform = osg.Uniform.createInt1(visible, "Texture" + i + "Visible");
        stateSet.addUniform(visibleUniform, osg.StateAttribute.ON);
        map.imageLayers[i].visibleUniform = visibleUniform;

        var opacity = map.imageLayers[i].getOpacity();
        var opacityUniform = osg.Uniform.createFloat1(opacity, "Texture" + i + "Opacity");
        map.imageLayers[i].opacityUniform = opacityUniform;
        stateSet.addUniform(opacityUniform, osg.StateAttribute.ON);

        var texMatUniform = osg.Uniform.createMatrix4(osg.Matrix.makeIdentity([]), "TexMat" + i);
        stateSet.addUniform(texMatUniform, osg.StateAttribute.ON);

        stateSet.addUniform(osg.Uniform.createInt1(i, "Texture" + i));
    }
};

osgearth.MapNode.prototype = osg.objectInehrit(osg.Node.prototype, {

    traverse: function(visitor) {
        if (visitor.modelviewMatrixStack !== undefined) { // i.e., in cull visitor
            var lastViewMatrix = visitor.modelviewMatrixStack[visitor.modelviewMatrixStack.length - 1];
            var mvmInv = [];
            osg.Matrix.inverse(lastViewMatrix, mvmInv);
            if ( visitor.eyePoint === undefined )
                visitor.eyePoint = [];
            osg.Matrix.getTrans(mvmInv, visitor.eyePoint);
        }
        var n = this.children.length;
        for (var i = 0; i < n; i++) {
            this.children[i].accept(visitor);
        }
    }
});

osgearth.MapNode.prototype.objectType = osg.objectType.generate("MapNode");

osg.CullVisitor.prototype[osgearth.MapNode.prototype.objectType] = function(node) {
    if (node.stateset)
        this.pushStateSet(node.stateset);
    this.traverse(node);
    if (node.stateset)
        this.popStateSet();
};

//...................................................................

osgearth.Tile = function(key, map, parentTextures) {

    osg.Node.call(this);

    //    osg.log("Create tile: " + key);

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
    this.subtileRange = 1e7 * 1e7;
    this.textures = [];
    this.textureReady = [];
    this.numTexturesReady = 0;

    this.build(parentTextures);
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
        return this.numTexturesReady === this.textures.length;
    },

    // checks to see whether all the images for this tile are available
    checkTextures: function() {
        this.numTexturesReady = 0;
        for (var i = 0; i < this.textures.length; i++) {
            if (this.textureReady[i] === true) {
                this.numTexturesReady++;
            }
            else if (this.textures[i].isImageReady()) {
                this.textureReady[i] = true;
                // in no-wait mode, remove the uniform that hides a not-yet-ready layer
                if (this.map.waitForAllLayers === false) {
                    osg.StateSet.removeUniform(this.getStateSet(), "TexMat" + i);
                    this.getStateSet().setTextureAttributeAndMode(i, this.textures[i]);
                }
                this.numTexturesReady++;
            }
        }
    },

    resetSubtiles: function() {
        // delete all the children's textures to free their memory.
        var i, n = this.children.length;
        for (i = 0; i < n; ++i) {
            this.children[i].destroy();
        }

        this.removeChildren();
        this.subtilesRequested = false;
    },

    // free memory associated with the Tile.
    // todo: check for buffer objects as well.
    destroy: function() {
        for (j = 0; j < this.textures.length; ++j) {
            osg.Texture.destroy(this.textures[j]);
        }
        osg.Geometry.destroy(this.geometry);
    },

    build: function(parentTextures) {
        var verts = [];
        var elements = [];
        var normals = [];
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

        var e = 0, v = 0, tc = 0, vi = 0;

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

        this.geometry = new osg.Geometry();
        this.geometry.getAttributes().Vertex = osg.BufferArray.create(gl.ARRAY_BUFFER, verts, 3);
        this.geometry.getAttributes().Normal = osg.BufferArray.create(gl.ARRAY_BUFFER, normals, 3);
        var tris = new osg.DrawElements(gl.TRIANGLES, osg.BufferArray.create(gl.ELEMENT_ARRAY_BUFFER, elements, 1));
        this.geometry.getPrimitives().push(tris);

        // the textures:     
        var stateSet = this.getOrCreateStateSet();
        var geomStateSet = this.geometry.getOrCreateStateSet();

        // shared texture coordinate attribute:
        var sharedTexCoordAttr = osg.BufferArray.create(gl.ARRAY_BUFFER, texcoords0, 2);

        for (var i = 0, n = this.map.imageLayers.length; i < n; i++) {
            var layer = this.map.imageLayers[i];
            var newTex = layer.createTexture(this.key, this.map.profile);
            this.textures.push(newTex);
            this.textureReady.push(false);

            if (parentTextures === null || this.map.waitForAllLayers) {
                stateSet.setTextureAttributeAndMode(i, newTex);
            }
            else {
                var texMat = [
                    0.5, 0, 0, 0,
                    0.0, 0.5, 0, 0,
                    0.0, 0.0, 0.0, 0.0,
                    (this.key[0] % 2) * 0.5, (1 - this.key[1] % 2) * 0.5, 0, 0];

                var texMatU = osg.Uniform.createMatrix4(texMat, "TexMat" + i);
                stateSet.addUniform(texMatU, osg.StateAttribute.ON);
            }

            this.geometry.getAttributes()["TexCoord" + i] = sharedTexCoordAttr;
        }

        this.xform = new osg.MatrixTransform();
        this.xform.setMatrix(tile2world);
        this.xform.addChild(this.geometry);

        this.subtileRange2 = this.getBound().radius() * 3 * this.map.zoomScale;
        this.subtileRange2 *= this.subtileRange2;

        // for geocentric maps, get the tile's deviation for geocentric normal-based culling
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
        for (var q = 0; q < 4; q++)
            this.addChild(new osgearth.Tile(osgearth.TileKey.child(this.key, q), this.map, this.textures));
        this.subtilesRequested = true;
    },

    traverse: function(visitor) {

        if (visitor.modelviewMatrixStack !== undefined) { // i.e., in cull visitor

            var centerToEye = [0, 0, 0];
            osg.Vec3.sub(visitor.eyePoint, this.centerWorld, centerToEye);
            osg.Vec3.normalize(centerToEye, centerToEye);

            if (this.key[2] == 0 || !this.map.geocentric || osg.Vec3.dot(centerToEye, this.centerNormal) >= this.deviation) {

                // tell the map we're drawing this tile (so it doesn't get exipred)
                this.map.markTileDrawn(this);

                var bound = this.getBound();
                var range2 = osg.Vec3.length2(osg.Vec3.sub(visitor.eyePoint, bound.center(), []));

                var traverseChildren = true;
                var numChildren = this.children.length;

                if (range2 > this.subtileRange2 || this.key[2] >= this.map.maxLevel) {
                    traverseChildren = false;
                }
                else {
                    // if this tile's content is all loaded, it's ok to start requesting subtiles.
                    if (!this.subtilesRequested && (this.key[2] == this.map.minLevel || this.allTexturesReady())) {
                        this.requestSubtiles();
                        traverseChildren = false;
                    }
                    else if (this.children.length < 4) {
                        traverseChildren = false;
                    }
                    else {
                        // in "wait for all layers" mode, don't traverse this tile's children
                        // until they have each loaded all of their textures.
                        if (this.map.waitForAllLayers) {
                            for (var i = 0; i < this.children.length; i++) {
                                var child = this.children[i];
                                if (!child.allTexturesReady()) {
                                    traverseChildren = false;
                                    child.checkTextures();
                                }
                            }
                        }

                        // in non-waiting mode, traverse the children as long as each one
                        // has loaded it's base layer (layer 0).
                        else {
                            for (var i = 0; i < this.children.length; i++) {
                                var child = this.children[i];
                                if (!child.textureReady[0])
                                    traverseChildren = false;
                                if (!child.allTexturesReady())
                                    child.checkTextures();
                            }
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
    if (node.stateset)
        this.pushStateSet(node.stateset);

    this.traverse(node);

    if (node.stateset)
        this.popStateSet();
};
