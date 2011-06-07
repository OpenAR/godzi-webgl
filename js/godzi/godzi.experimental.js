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
		if (xml != undefined)
		{
		  var lat = xml.getElementsByTagName("latitude")[0].firstChild.nodeValue;
		  var lon = xml.getElementsByTagName("longitude")[0].firstChild.nodeValue;

		  var southWest = xml.getElementsByTagName("southWest")[0];
		  var swlat = southWest.getElementsByTagName("latitude")[0].firstChild.nodeValue;
		  var swlon = southWest.getElementsByTagName("longitude")[0].firstChild.nodeValue;

		  var northEast = xml.getElementsByTagName("northEast")[0];
		  var nelat = northEast.getElementsByTagName("latitude")[0].firstChild.nodeValue;
		  var nelon = northEast.getElementsByTagName("longitude")[0].firstChild.nodeValue;
		  
		  callback(lat, lon, swlat, swlon, nelat, nelon);
		}
		else
		{
		  alert("Cannot find that location.");
		}
      },
	  
	  error: function(jqXHR, status, error)
	  {
	    alert("ERROR: " + status);
      }
	});
  }
};

//........................................................................

godzi.PositionedElement = function(id, lon, lat, alt) {
  this.id = id;
  this.element = jQuery("#" + id);
  this.lat = lat;
  this.lon = lon;
  this.alt = alt;
  this.offset = [0,0];
}

godzi.PositionedElement.prototype = {  
  update : function(mapView) {
      var ecf = mapView.map.lla2world([this.lon, this.lat, this.alt]);
      
      //Cull elements on the other side of the earth.
      var viewMatrix = mapView.viewer.view.getViewMatrix();
      viewMatrix = osg.Matrix.inverse(viewMatrix);
      var eye = [];      
      osg.Matrix.getTrans(viewMatrix, eye);
      //osg.Vec3.normalize(eye, eye);
      
      /*var m = mapView.viewer.view.getViewMatrix();
      var eye = [];
      var center = [];
      var up = [];
      osg.Matrix.getLookAt(m, eye, center, up );
      */
      
      var lookVector = [];
      osg.Vec3.sub( ecf, eye, lookVector );         
      
      var worldUp = [];
      osg.Vec3.copy(ecf, worldUp);
      osg.Vec3.normalize( worldUp, worldUp );
      var dot = osg.Vec3.dot(lookVector, worldUp);
      if (dot > 0) {
        this.element.offset({top:0, left:-10000});
        return;
      }
      
      
      
     
      var window = mapView.projectObjectIntoWindow(ecf);
      

      
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
          
      this.element.position( {        
        my: "left top",
        at: "left top",
        of: mapView.viewer.canvas,
        offset: x + " " + y
      });      
      
      this.lastWindow = [x,y];            
  }
}


godzi.Icon = function(id, lon, lat, alt, url, options) {  
  godzi.PositionedElement.call(this, id, lon, lat, alt);    
  this.url = url;
    
  var defaults = {
    width: 64,
    height: 64,
    class: ""
  };
 
  
  var options = jQuery.extend({}, defaults, options);
  
  this.width = options.width;
  this.height = options.height;
  this.class = options.class;
  
  this.element = jQuery('<img id="' + this.id + '" class="' + options.class + '" src="' + url + '" width="' + this.width + '" height="' + this.height + '"/>');
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
    
  var defaults = {
    class: ""
  };
 
  
  var options = jQuery.extend({}, defaults, options);
  
  this.class = options.class;
  
  this.element = jQuery('<span id="' + this.id + '" class="' + options.class + '">' + this.text + '</span>');
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
  frameEnd: function() {
    for (var i = 0; i < this.elements.length; i++) {
      this.elements[i].update(this.mapView);
    }
  }
}
