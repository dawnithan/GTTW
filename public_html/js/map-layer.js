var mapLayer

exports.create = function (mapData){

	mapboxgl.accessToken = 'pk.eyJ1IjoiZ2F0ZXdheXRvdGhld29ybGQiLCJhIjoiVlA2NTBROCJ9.mvESsAFM8svnG-T0L5eaSw'

	var mapLayer = new mapboxgl.Map({
	    container: 'map', // container id
	    style: mapData.style, 
	    center: mapData.center, 
	    zoom: 9, // set to this at the beginning to simplify scale calc, set to custom zoom just before fade in
	    minZoom: mapData.minZoom,
	    maxZoom: mapData.maxZoom
	})

	// disable map rotation using right click + drag
	mapLayer.dragRotate.disable()

	// disable map rotation using touch rotation gesture
	mapLayer.touchZoomRotate.disableRotation()

	// add zoom controls
	mapLayer.addControl(new mapboxgl.Navigation());
	
	return mapLayer
}

