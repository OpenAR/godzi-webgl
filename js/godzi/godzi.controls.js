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
    
    for (var i = 0; i < this.map.imageLayers.length; i++) {
        var layer = this.map.imageLayers[i];
        var div = jQuery('<div id="layer_"' + i + '>)')
                        .addClass('ui-state-default ui-corner-all ui-helper-clearfix');
        jQuery(div).append('<input id="layercheck_' + i + '" type="checkbox" checked="checked"/><span>' + layer.name + '</span>');
        jQuery(div).append('<div id="layeropacity_' + i + '" class="opacity-slider"></div>');
                
        jQuery(this.element).append(div);                        
        
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
