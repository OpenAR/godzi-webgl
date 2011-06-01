/**
* Godzi/WebGL
* (c) Copyright 2011 Pelican Mapping
* License: LGPL
* http://godzi.org
*/
 
godzi.Map = function() {
    osgearth.Map.call(this);
};

godzi.Map.prototype = osg.objectInehrit(osgearth.Map.prototype, {
});

//------------

godzi.TMSImageLayer = function(settings) {
    osgearth.ImageLayer.call(this, settings.name);
    this.url = settings.url;
    this.flipY = settings.tmsType === "google";
    this.extension = settings.imageType !== undefined ? settings.imageType : "jpg";
    this.baseLevel = settings.baseLevel !== undefined ? settings.baseLevel : 0;
};

godzi.TMSImageLayer.prototype = {

    getURL: function(key, profile) {
        var y = key[1];

        if (this.flipY) {
            var size = profile.getTileCount(key[2]);
            y = (size[1] - 1) - key[1];
        }

        var imageURL = this.url + "/" + (key[2]+this.baseLevel) + "/" + key[0] + "/" + y + "." + this.extension;
        return imageURL;
    },

    createTexture: function(key, profile) {
        var imageURL = this.getURL(key, profile);
        return osg.Texture.create(imageURL);
    }
};
