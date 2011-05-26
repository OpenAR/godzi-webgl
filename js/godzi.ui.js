
godzi.Map = function() {
    osgearth.Map.call(this);
};

godzi.Map.prototype = osg.objectInehrit(osgearth.Map.prototype, {
});

//------------

godzi.TMSImageLayer = function(name, url) {
    osgearth.ImageLayer.call(this, name);
    this._url = url;
    this._flipY = true;
};

godzi.TMSImageLayer.prototype = {

    getURL: function(key, profile) {
        var y = key[1];

        if (this._flipY) {
            var size = profile.getTileCount(key[2]);
            y = (size[1] - 1) - key[1];
        }

        var imageURL = this._url + "/" + key[2] + "/" + key[0] + "/" + y + ".jpg";
        return imageURL;
    },

    createTexture: function(key, profile) {
        var imageURL = this.getURL(key, profile);
        return osg.Texture.create(imageURL);
    }
};

//-------------

godzi.MapView = function(elementId, size, map) {

    this.map = map;
    this.viewer = null;
    var canvas = document.getElementById(elementId);
    canvas.width = size.w;
    canvas.height = size.h;

    try {
        this.viewer = new osgViewer.Viewer(canvas);
        this.viewer.init();
        this.viewer.setupManipulator();
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
