/**
* Godzi/WebGL
* (c) Copyright 2011 Pelican Mapping
* License: LGPL
* http://godzi.org
*/

/**
 * PlaceSearch
 * Geolocator based on Yahoo geocoding
 */

//........................................................................

// Creates style-able input element. Mostly provided as a convenience.
godzi.PlaceSearch = function(parentId, inputId, callback)
{
  if (inputId == undefined)
    inputId = "inputPlaceSearch";
  
  document.getElementById(parentId).innerHTML = 'Search: <input id="' + inputId + '" size="20em" type="text" onkeydown="if(event.keyCode==13) godzi.PlaceSearch.doSearch(value, ' + callback + ');" />';
};

godzi.PlaceSearch.doSearch = function(place, callback)
{
  var pelicanProxyURI = "http://demo.pelicanmapping.com/rmweb/proxy.php";
  var yahooGeocodeURI = "http://local.yahooapis.com/MapsService/V1/geocode";
  var yahooPlaceURI   = "http://wherein.yahooapis.com/v1/document";
  var yahooAppId = "n51Mo.jV34EwZuxIhJ0GqHLzPXoZyjSG6jhLJsQ1v1q975Lf9g7iC4gRYKecVQ--";
  
  if (place != undefined && typeof callback == "function")
  {
    var yahooURI = encodeURI(yahooPlaceURI);
	$.ajax(
	{
	  url:pelicanProxyURI,
	  async: "false",
	  type: "POST",
	  headers: { "Connection": "close" },
	  data:
	  {
	    url: yahooURI, mimeType: "text/xml",
        documentContent: encodeURI(place),
        documentType: "text/plain",
        appid: yahooAppId
	  },

      success: function(data)
	  {
		var xml = data.documentElement;

		try
		{
			var lat = xml.getElementsByTagName("latitude")[0].firstChild.nodeValue;
			var lon = xml.getElementsByTagName("longitude")[0].firstChild.nodeValue;

			var southWest = xml.getElementsByTagName("southWest")[0];
			var swlat = southWest.getElementsByTagName("latitude")[0].firstChild.nodeValue;
			var swlon = southWest.getElementsByTagName("longitude")[0].firstChild.nodeValue;

			var northEast = xml.getElementsByTagName("northEast")[0];
			var nelat = northEast.getElementsByTagName("latitude")[0].firstChild.nodeValue;
			var nelon = northEast.getElementsByTagName("longitude")[0].firstChild.nodeValue;
			  
			callback(lat, lon, swlat, swlon, nelat, nelon, data);
		}
		catch (e)
		{
			callback(0,0,0,0,0,0,"Cannot find location: " + place);
		}
      },
	  
	  error: function(jqXHR, status, error)
	  {
		callback(0,0,0,0,0,0,status);
      }
	});
  }
};

//........................................................................

godzi.PositionedElement = function(id, lon, lat, alt, options) {
  this.hAlign = "left";
  this.vAlign = "top";
  this.lat = lat;
  this.lon = lon;
  this.alt = alt;
  this.offset = [0,0];
  this.ecf = null;
  this._dirty = true;
  
  var defaults = {
    hAlign: "left",
    vAlign: "top",
    offset: [0,0]
  };
  
  var options = jQuery.extend({}, defaults, options);     
  
  this.vAlign = options.vAlign;
  this.hAlign = options.hAlign;
  
  if (options.element !== undefined) {
     this.element = options.element;
  }    
  
  this.id = id;
  this.ownsElement = this.element !== undefined;
  if (this.element === undefined) {
    this.element = jQuery("#" + id);
    //If we found an existing element we don't own it
    if (this.element) {
        this.ownsElement = false;    
    }
  }
  
}

godzi.PositionedElement.prototype = {  

  destroy : function() {
    if (this.ownsElement) {
      this.element.remove();
    }        
  },

  setLocation: function(lon, lat, alt) {
    if (this.lon != lon || this.lat != lat || this.alt != alt) {
      this.lon = lon;
      this.lat = lat;
      this.alt = alt;
      _dirty = true;
    }      
  },
  
  update : function(mapView) {
      if (this.ecf == null || this._dirty) {      
        var ecf = mapView.map.lla2world([this.lon, this.lat, this.alt]);
        this._dirty = false;
        this.ecf = ecf;
      }
	                    
      //Cluster cull geocentric
      if (mapView.map.geocentric) {
          viewMatrix = mapView._inverseViewMatrix;
          var eye = [];      
          osg.Matrix.getTrans(viewMatrix, eye);
                    
          var lookVector = [];
          osg.Vec3.sub( this.ecf, eye, lookVector );         

          var worldUp = [];
          osg.Vec3.copy(this.ecf, worldUp);
          osg.Vec3.normalize( worldUp, worldUp );
          var dot = osg.Vec3.dot(lookVector, worldUp);
          if (dot > 0) {
            this.element.offset({top:0, left:-10000});
            return;
          }                  
      }
           
      var window = mapView.projectObjectIntoWindow(this.ecf);      
      
      var x = (window[0] + this.offset[0]).toFixed();
      var y = (window[1] + this.offset[1]).toFixed();
     
      
      //Don't reposition this element if it hasn't changed
      if (this.lastWindow !== undefined) {
        var dx = this.lastWindow[0] - x;
        var dy = this.lastWindow[1] - y;
        if (dx == 0 && dy == 0) {
            return;
        } 
      }
      
      if (this.hAlign == "right") {
        x = x - this.element.width();
      }
      
      if (this.vAlign == "bottom") {
        y = y - this.element.height();
      }      
          
      this.element.position( {        
        my: "left top",
        at: "left top",
        of: mapView.viewer.canvas,
        offset: x + " " + y,
        collision: "none none"
      });      
      
      this.lastWindow = [x,y];                       
  }
}


godzi.Icon = function(id, lon, lat, alt, url, options) {  
  godzi.PositionedElement.call(this, id, lon, lat, alt);    
  this.url = url;
  this.ownsElement = true;
    
  var defaults = {
    width: 64,
    height: 64,
    class: ""
  };
 
  
  var options = jQuery.extend({}, defaults, options);
  
  this.width = options.width;
  this.height = options.height;
  this.class = options.class;
  
  this.element = jQuery('<img id="' + this.id + '" class="' + options.class + '" src="' + url +
                        '" width="' + this.width + '" height="' + this.height +
						(options.title != undefined ? '" title="' + options.title : '') + '"/>');
						
  //Disable selection
  this.element[0].onselectstart = function() { return false;} //id;
  this.element[0].onmousedown   = function() { return false;} //id;
						
  jQuery("body").append(this.element);                         
}

godzi.Icon.prototype = osg.objectInehrit(godzi.PositionedElement.prototype, {
 getWidth : function() {
   return this.width;
 },
 
 setWidth: function(width) {
   setSize(width, this.height);
 }, 
  
 getHeight : function() {
   return this.height;
 },
 
  setHeight: function(height) {
    setSize(this.width, height);
  },
 
 setSize: function(width, height) {
   if (this.height != height || this.width != width) {
     this.width = width;
     this.height = height;
     this.element.attr('height', this.height);
     this.element.attr('width', this.width);
   }
 }
 
 
});

godzi.Label = function(id, lon, lat, alt, text, options) {  
  godzi.PositionedElement.call(this, id, lon, lat, alt);    
  this.text = text;
  this.ownsElement = true;
    
  var defaults = {
    class: ""
  };
 
  
  var options = jQuery.extend({}, defaults, options);
  
  this.class = options.class;
  
  this.element = jQuery('<span id="' + this.id + '" class="' + options.class + '">' + this.text + '</span>');
  //Disable selection
  this.element[0].onselectstart = function() { return false;} //id;
  this.element[0].onmousedown   = function() { return false;} //id;

  jQuery("body").append(this.element);                         
}

godzi.Label.prototype = osg.objectInehrit(godzi.PositionedElement.prototype, {
 
});

godzi.PositionEngine = function(mapView) {
  this.mapView = mapView;
  var me = this;
  this.mapView.addFrameEndCallback( function() {
    me.frameEnd();
  } );
  this.elements = [];
}

godzi.PositionEngine.prototype = {
  addElement: function(element) {
    this.elements.push( element );
  },
  
  removeElement: function(element) {  
    var index = this.elements.indexOf( element );
    if (index >= 0) {
      element.destroy();
      this.elements.splice( index, 1 );
    }       
  },
  
  clear: function() {
    for (var i = 0; i < this.elements.length; i++) {
      this.elements[i].destroy();
    }
    this.elements = [];
  },
  
  frameEnd: function() {
  
    //Cull elements on the other side of the earth.
    var viewMatrix = mapView.viewer.view.getViewMatrix();
      
	var viewChanged = true;
    if (this._lastViewMatrix !== undefined) {
      viewChanged = !osg.Matrix.equals(viewMatrix, this._lastViewMatrix);
    }
	else {
	  this._lastViewMatrix = [];
	}
      
      //Save the last view matrix
	osg.Matrix.copy(viewMatrix, this._lastViewMatrix);
	mapView._inverseViewMatrix = osg.Matrix.inverse( viewMatrix );                        

	for (var i = 0; i < this.elements.length; i++) {
	  if (viewChanged || this.elements[i]._dirty) {
		this.elements[i].update(this.mapView);
	  }
	}
  }
}

//........................................................................

godzi.WOEIDWeatherLayer = function(mapView, places, proxy, iconOptions) {
    this.positionEngine = new godzi.PositionEngine(mapView);
	this.places = places;
	this.proxy = proxy;
	
	var defaults = {
	  url: "http://google-maps-icons.googlecode.com/files/cloudsun.png",
      width: 32,
      height: 32,
      class: "",
	  renderer: undefined
    };
    this.options = jQuery.extend({}, defaults, iconOptions);
	
	this.readers = [];
	this.icons = [];
	this.init();
};

godzi.WOEIDWeatherLayer.prototype = {
    init: function() {
		for (var i in this.places)
		{
		    var place = this.places[i];
			var thisObj = this;
			godzi.PlaceSearch.doSearch(place, function(lat, lon, swlat, swlon, nelat, nelon, data) {
			    var woeid = $(data).find('woeId').eq(0).text();
				if (woeid != undefined && woeid != '')
				  thisObj.createReader(woeid);
			});
		}
	},
	
	createReader: function(id) {
	    var url = this.proxy + 'http://weather.yahooapis.com/forecastrss?w=' + id;
		var thisObj = this;
		var renderer = this.options.renderer;
		this.readers[id] = new godzi.GeoRSSReader(url, 60, function(items) {
		    if (renderer != undefined)
			    renderer(items[0], id);
			else
			    thisObj.createIcon(items[0], id);
		});
	},
	
	createIcon: function(item, id) {
		var active = false;
	    if (this.icons[id] != undefined)
		{
		    if (this.icons[id].popup != undefined)
			{
				this.positionEngine.removeElement(icons[id].popup);
				active = true;
			}
				
		    this.positionEngine.removeElement(this.icons[id]);
			this.icons[id] = undefined;
		}
		
	    var icon = new godzi.Icon("icon" + id, Math.deg2rad(item.longitude), Math.deg2rad(item.latitude), 0, this.options.url, {
		  width: this.options.width,
		  height: this.options.height,
		  class: this.options.class,
		  title: item.title
		});
		
		icon.offset = [this.options.width / -2, this.options.height / -2];
		
		if (active)
		{
			this.createIconPopup(icon, id, item.latitude, item.longitude, item.title, item.description, item.link);
		}
		
		var thisObj = this;
		icon.element.bind("click", {url: item.link,
									title: item.title,
									engine: this.positionEngine,
									lat: item.latitude,
									lon: item.longitude,
									description: item.description,
									icon: icon,
									id: id
									}, function(e) {
			  if (e.data.icon.popup != undefined)
			  {
			    e.data.engine.removeElement(e.data.icon.popup);
				e.data.icon.popup = undefined;
			  }
			  else
			  {
				  thisObj.createIconPopup(e.data.icon, e.data.id, e.data.lat, e.data.lon, e.data.title, e.data.description, e.data.url);
			  }
			});
		
		this.icons[id] = icon;
		this.positionEngine.addElement( icon );
	},
	
	createIconPopup: function(icon, id, lat, lon, title, content, url) {
		//special test for Yahoo weather image
		var imgData = "";
	    if ($(content)[0].nodeType == 8)
			imgData = $(content)[0].data.replace('[CDATA[', '') + '>';
		
		var html = '<div class="weather_popup_background"><div class="weather_popup"><h4 class="weather_popup">' + title + '</h4>' + '<div class="weather_popup_image">' + imgData + '</div><br />' + content.replace(']]&gt;', '') + '</div></div>';
		
		var htmlElem = $(html);
		jQuery("body").append(htmlElem);
		
		htmlElem[0].onselectstart = function() { return false; }
		htmlElem[0].onmousedown   = function() { return false; }
		
		htmlElem.bind("click", { icon: icon }, function(e) {
			$(e.data.icon.element).click();
		});
		
		var popup = new godzi.PositionedElement("popup_" + id, Math.deg2rad(lon), Math.deg2rad(lat), 0, {element: htmlElem, vAlign: "bottom"});
		icon.popup = popup;
		this.positionEngine.addElement(popup);
	}
};
