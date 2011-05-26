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

godzi.TMSImageLayer = function(name, url) {
    osgearth.ImageLayer.call(this, name);
    this.url = url;
    this.flipY = true;
};

godzi.TMSImageLayer.prototype = {

    getURL: function(key, profile) {
        var y = key[1];

        if (this.flipY) {
            var size = profile.getTileCount(key[2]);
            y = (size[1] - 1) - key[1];
        }

        var imageURL = this.url + "/" + key[2] + "/" + key[0] + "/" + y + ".jpg";
        return imageURL;
    },

    createTexture: function(key, profile) {
        var imageURL = this.getURL(key, profile);
        return osg.Texture.create(imageURL);
    }
};
