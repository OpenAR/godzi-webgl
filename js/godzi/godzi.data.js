/**
* Godzi/WebGL
* (c) Copyright 2011 Pelican Mapping
* License: LGPL
* http://godzi.org
*/
 
godzi.Map = function(args) {
    osgearth.Map.call(this, args);
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
    this.args = settings.args !== undefined ? settings.args : null;
};

godzi.TMSImageLayer.prototype = osg.objectInehrit(osgearth.ImageLayer.prototype, {

    getURL: function(key, profile) {
        var y = key[1];

        if (this.flipY) {
            var size = profile.getTileCount(key[2]);
            y = (size[1] - 1) - key[1];
        }

        var imageURL = this.url + "/" + (key[2] + this.baseLevel) + "/" + key[0] + "/" + y + "." + this.extension;
        if (this.args !== undefined && this.args != null) {
          imageURL += "?" + this.args;
        }

        if (osgearth.ProxyHost !== undefined && osgearth.ProxyHost != null) {
          imageURL = osgearth.ProxyHost + encodeURIComponent(imageURL);
        }
        return imageURL;
    },

    createTexture: function(key, profile) {
        var imageURL = this.getURL(key, profile);
        return osg.Texture.create(imageURL);
    }
});

//...................................................................

godzi.ArcGISImageLayer = function(settings) {
    osgearth.ImageLayer.call(this, settings.name);
    this.url = settings.url;
    this.extension = settings.imageType !== undefined ? settings.imageType : "jpg";
};

godzi.ArcGISImageLayer.prototype = osg.objectInehrit(osgearth.ImageLayer.prototype, {

    getURL: function(key, profile) {
        var imageURL = this.url + "/tile/" + key[2] + "/" + key[1] + "/" + key[0] + "." + this.extension;
        if (this.args !== undefined && this.args != null) {
          imageURL += "?" + this.args;
        }

        if (osgearth.ProxyHost !== undefined && osgearth.ProxyHost != null) {
          imageURL = osgearth.ProxyHost + encodeURIComponent(imageURL);
        }

        return imageURL;
    },

    createTexture: function(key, profile) {
        var imageURL = this.getURL(key, profile);
        return osg.Texture.create(imageURL);
    }
});

//...................................................................

godzi.WMSImageLayer = function(settings) {
    osgearth.ImageLayer.call(this, settings.name);
    this.url = settings.url;    
    this.format = settings.format !== undefined ? settings.format : "image/jpeg";
    this.profile = settings.profile !== undefined ? settings.profile : new osgearth.GeodeticProfile();
    this.args = settings.args !== undefined ? settings.args : null;	
	this.layers = settings.layers !== undefined ? settings.layers: "default";
	this.width = settings.width !== undefined ? settings.width  : 256;
	this.height = settings.height !== undefined ? settings.height : 256;
	this.srs = settings.srs !== undefined ? settings.srs : "EPSG:4326";
	this.styles = settings.styles !== undefined ? settings.styles : "";
};

godzi.WMSImageLayer.prototype = osg.objectInehrit(osgearth.ImageLayer.prototype, {

    getURL: function(key, profile) {	    	
	    var size = this.profile.getTileSize(key[2]);
        var xmin = this.profile.extent.xmin + (size[0] * key[0]);
        var ymax = this.profile.extent.ymax - (size[1] * key[1]);
		var xmax = xmin + size[0];
		var ymin = ymax - size[1];        
		
		xmin = Math.rad2deg( xmin );
		ymin = Math.rad2deg( ymin );
		xmax = Math.rad2deg( xmax );
		ymax = Math.rad2deg( ymax );
		
		var sep = this.url.indexOf( "?" ) >= 0 ? "&" : "?";

        var imageURL = [
		               this.url,
					   sep,
		               "SERVICE=WMS",
					   "&VERSION=" + this.version,
					   "&REQUEST=GetMap",
					   "&LAYERS=" + this.layers,
					   "&FORMAT=" + this.format,
					   "&STYLES=" + this.styles,
					   "&SRS=" + this.srs,
					   "&WIDTH=" + this.width,
					   "&HEIGHT=" + this.height,					   
                       "&BBOX=" + xmin + "," + ymin + "," + xmax + "," + ymax					   					   
					   ].join("");
	                   
        if (this.args !== undefined && this.args != null) {		  
          imageURL += "&" + this.args;
        }

        if (osgearth.ProxyHost !== undefined && osgearth.ProxyHost != null) {
          imageURL = osgearth.ProxyHost + encodeURIComponent(imageURL);
        }

        return imageURL;
    },

    createTexture: function(key, profile) {
        var imageURL = this.getURL(key, profile);
        return osg.Texture.create(imageURL);
        //return osgearth.Texture.create(imageURL);
    }
});

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
					try
					{
						if (link == undefined || link == "")
						  link = $(this).find('link').eq(0)[0].nextSibling.data;
					}
					catch (e) { }
					
					var description = undefined;
					try
					{
					    description = $(this).find('description').get(0).innerHTML;
					}
					catch(e) {}
					
					if (description == undefined || description == "")
						description = $(this).find('description').text()
						
					items.push({ guid: $(this).find('guid').text(),
					             title: $(this).find('title').text(),
								 author: $(this).find('author').text(),
								 pubDate: $(this).find('pubDate').text(),
								 description: description,
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


function showDialog(content, title) {                  
    //Create a new div on the fly
    return $('<div/>').html(content).dialog({
      bgiframe : true,
      resizable: false,
      modal: false,
      draggable: false,
      title: title,
      overlay: {
        backgroundColor: '#000',
        opacity: 0.5
      }
    });
}

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
			
			icon.offset = [this.options.width / -2, this.options.height * -1];
            icon.element.bind("click", {url: items[i].link,
			                            title: items[i].title,
			                            engine: this.positionEngine,
			                            lat: items[i].latitude,
			                            lon: items[i].longitude,
			                            description: items[i].description			                            			                            
			                            }, function(e) {					  
  			      var html = "<div><h3>" + e.data.title + "</h3>" + 
  			                 "   <p> " + e.data.description + "</p>";
  			      if (e.data.url !== undefined && e.data.url != null) {
  			        html += '<a href="' + e.data.url + '" target="_blank">Link</a>';
  			      }
  			      html += "</div>";
  			      var dlg = showDialog(html, e.data.title);
  			      dlg = dlg.parent();
  			      e.data.engine.addElement(new godzi.PositionedElement("dlg", Math.deg2rad(e.data.lon), Math.deg2rad(e.data.lat), 0, {element: dlg, vAlign: "bottom"}));
			    });			
            this.positionEngine.addElement( icon );
		}
	}
};
