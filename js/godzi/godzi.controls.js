godzi.controls = {}

godzi.controls.LayerSwitcher = function(element_id, map) {
    this.id = element_id;
    this.element = jQuery("#" + element_id);
    this.map = map;
    this.init();
};

godzi.controls.LayerSwitcher.prototype = {
  init : function() {
    //Remove all existing children
    jQuery(this.element).children().remove();   
    
    jQuery(this.element).append('<div class="ui-widget-header"><span id="layer-header-toggle" style="float:left" class="ui-icon ui-icon-triangle-1-s"></span>Layers</div>');	       
    
    var layerContainer = jQuery('<div id="layer_container"/>');
    jQuery(this.element).append(layerContainer);
        
        
    
    jQuery("#layer-header-toggle").bind("click", function() {
        jQuery("#layer_container").slideToggle();    
	    var l = jQuery(this);
	    if (l.hasClass("ui-icon-triangle-1-s")) {
  		  l.removeClass("ui-icon-triangle-1-s");
		  l.addClass("ui-icon-triangle-1-e");
	    }
	    else if (l.hasClass('ui-icon-triangle-1-e')) {
		  l.addClass("ui-icon-triangle-1-s");
		  l.removeClass("ui-icon-triangle-1-e");
	    }
    });
        
    for (var i = 0; i < this.map.imageLayers.length; i++) {
        var layer = this.map.imageLayers[i];
        var div = jQuery('<div id="layer_"' + i + '>')
                        .addClass('ui-widget-content ui-state-default ui-corner-all ui-helper-clearfix');
        jQuery(div).append('<input id="layercheck_' + i + '" type="checkbox" checked="checked"/><span>' + layer.name + '</span>');
        jQuery(div).append('<div id="layeropacity_' + i + '" class="opacity-slider"></div>');        
                
        jQuery(layerContainer).append(div);                        
        
        jQuery("#layercheck_" + i).bind("click", {layer: layer}, function(event) {        
          var checked = jQuery(this).attr("checked");
          event.data.layer.setVisible( checked );
        });    
        
        jQuery('#layeropacity_' + i).slider({
               min: 0,
               max: 100,
               value: layer.getOpacity() * 100.0,
			   range: "min",
			   layer: layer,
               slide: function(event, ui){
			     var opacity = ui.value / 100.0;
			     var lyr = jQuery(this).data('slider').options.layer;
			     lyr.setOpacity(opacity);
               }
         });
    }    
  }
};
