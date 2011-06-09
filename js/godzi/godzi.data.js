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

//...................................................................

godzi.TMSImageLayer = function(settings) {
    osgearth.ImageLayer.call(this, settings.name);
    this.url = settings.url;
    this.flipY = settings.tmsType === "google";
    this.extension = settings.imageType !== undefined ? settings.imageType : "jpg";
    this.baseLevel = settings.baseLevel !== undefined ? settings.baseLevel : 0;
};

godzi.TMSImageLayer.prototype = osg.objectInehrit(osgearth.ImageLayer.prototype, {

    getURL: function(key, profile) {
        var y = key[1];

        if (this.flipY) {
            var size = profile.getTileCount(key[2]);
            y = (size[1] - 1) - key[1];
        }

        var imageURL = this.url + "/" + (key[2] + this.baseLevel) + "/" + key[0] + "/" + y + "." + this.extension;
        return imageURL;
    },

    createTexture: function(key, profile) {
        var imageURL = this.getURL(key, profile);
        return osg.Texture.create(imageURL);
        //return osgearth.Texture.create(imageURL);
    }
});

//...................................................................

godzi.ArcGISImageLayer = function(settings) {
    osgearth.ImageLayer.call(this, settings.name);
    this.url = settings.url;
    
};

//...................................................................

godzi.GeoRSSReader = function(url, rate, updateCallback) {
    this.url = url;
	
	this.callbacks = new Array;
	if (updateCallback != undefined)
	  this.callbacks.push(updateCallback);
	
	this.updateFeed();
	this.setRate(rate);
};

godzi.GeoRSSReader.prototype = {
    updateFeed: function() {
	    this.items = new Array;
		
		if (this.url != undefined)
		{
		    var items = this.items;
			var callbacks = this.callbacks;
			
			$.ajax(
			{
			  url:this.url,
			  type: "GET",
			  //dataType: "xml",
			  
			  success: function(data)
			  {
			    var selector = $(data).find('item').length > 0 ? 'item' : 'entry';
			    $(data).find(selector).each(function(i){
					var lat = undefined;
					var lon = undefined;
					
				    var point = $(this).find('georss\\:point').text();
					if (point != "")
					{
					    lat = point.split(" ")[0];
					    lon = point.split(" ")[1];
					}
					else
					{
					    lat = $(this).find('geo\\:lat').text();
					    lon = $(this).find('geo\\:long').text();
					}
					
					var link = $(this).find('link').eq(0).attr('href');
					if (link == undefined || link == "")
					  link = $(this).find('link').eq(0)[0].nextSibling.data;
					
					items.push({ guid: $(this).find('guid').text(),
					             title: $(this).find('title').text(),
								 author: $(this).find('author').text(),
								 pubDate: $(this).find('pubDate').text(),
								 description: $(this).find('description').text(),
								 link: link,
								 latitude: lat,
								 longitude: lon,
								 src: $(this).get() });
				});
				
				for (var i in callbacks)
				{
				  var callback = callbacks[i];
				  callback(items);
				}
			  },
			  
			  error: function(jqXHR, status, error)
			  {
				//alert("Eror reading RSS feed: " + status);
				for (var i in callbacks)
				{
				  var callback = callbacks[i];
				  callback(items);
				}
			  }
			});
		}
	},
	
	setRate: function(newRate) {
	    if (this.interval != undefined)
	        window.clearInterval(this.interval);
			
		this.rate = newRate;
		if (this.rate > 0)
	        this.interval = window.setInterval(function(layer) { layer.updateFeed(); }, this.rate * 1000, this);
	},
	
	addCallback: function(updateCallback) {
	    if (updateCallback != undefined)
		{
		  this.callbacks.push(updateCallback);
		  updateCallback(this.items);
		}
	}
};

//...................................................................

godzi.GeoRSSLayer = function(mapView, url, rate, iconOptions) {
    this.mapView = mapView;
    this.url = url;
	
	var defaults = {
	  url: "http://google-maps-icons.googlecode.com/files/redblank.png",
      width: 32,
      height: 32,
      class: ""
    };
    this.options = jQuery.extend({}, defaults, iconOptions);
	
	this.positionEngine = new godzi.PositionEngine(mapView);
	
	var thisObj = this;
	this.reader = new godzi.GeoRSSReader(url, rate, function(items) { thisObj.createIcons(items); });
};

godzi.GeoRSSLayer.prototype = {
    setRate: function(newRate) {
        this.reader.setRate(newRate);	
	},
	
	createIcons: function(items) {
        //this.positionEngine.elements = [];
	    this.positionEngine.clear();
		
		for (var i in items)
		{
		    var icon = new godzi.Icon("icon" + i + "_" + items[i].guid, Math.deg2rad(items[i].longitude), Math.deg2rad(items[i].latitude), 0, this.options.url, {
              width: this.options.width,
              height: this.options.height,
			  class: this.options.class,
			  title: items[i].title
            });
			
			icon.offset = [this.options.width / -2, this.options.width * -1];
			
            this.positionEngine.addElement( icon );
		}
	}
};
