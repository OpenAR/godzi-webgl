
godzi.createMap = function() {
    return new osgearth.Map();
};

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
        this.viewer.initStats({});
        this.viewer.setScene(map.createNode());
        delete this.viewer.view.light;
        this.viewer.getManipulator().computeHomePosition();
        this.viewer.run();
    }
    catch (er) {
        osg.log("exception in osgViewer " + er);
    }
};
