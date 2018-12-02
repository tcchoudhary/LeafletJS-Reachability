// Create the Leaflet map object, set Pune city at center
	var map = L.map('map', { center: [18.516726, 73.856255], zoom: 12, minZoom: 10, zoomDelta: 0.25, zoomSnap: 0 });

	// Create a Leaflet tile layer object
	var baseLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
		attribution: 'DEMO',
		minZoom: 3,
		maxZoom: 19
	}).addTo(map);
		
	var marker = L.marker([18.516726, 73.856255], {'draggable': true});
	
	// Marker moveend event handler
	marker.on('moveend', function(e) {
	  const newLatlng = marker.getLatLng();
	  setTimeout(function() {
		polygonOptions.time = 5;
		fillArea(5);
	  }, 10);
	});
	marker.addTo(map);
	
	// marker popup
	marker.bindPopup('<div class="slidecontainer"><input type="range" min="0" max="60" value="5" step="5" class="slider myRange" id="myRange"><p><span class="s-min">5 min</span></p></div>').openPopup();
	marker.on('popupopen', function (popup) {
		setTime();
	});
	
	// configuration for polygon layers
	var polygonOptions = {
		apiKey: '5b3ce3597851110001cf62481f3717d787da48a08eb7a7e59c6dc434', // OPENROUTESERVICE KEY!
		styleFn: styleIsolines,
		mouseOverFn: highlightIsolines,
		mouseOutFn: resetIsolines,
		clickFn: clickIsolines,
		markerFn: isolinesOrigin,
		showOriginMarker: true,
		_travelMode: 'driving-car',
		rangeType: 'time',
		_deleteMode: false,
		rangeControlDistanceUnits: 'km',
		time: 5 // minutes
	};
	
	// set time value
	function setTime() {
		var slider = document.getElementsByClassName("myRange")[0];
		var output = document.getElementsByClassName("s-min")[0];
		output.innerHTML = polygonOptions.time + ' min';
		slider.oninput = function() {
			output.innerHTML = this.value + ' min';
			fillArea(this.value);
			polygonOptions.time = this.value;
		}
	}
	setTime();
	
	var isolinesGroup = L.geoJSON(null, { style: styleIsolines, pane: 'overlayPane', attribution: '&copy; Powered by <a href="https://openrouteservice.org/" target="_blank">openrouteservice</a>' })
	
	// delete all polygons
	function _deleteAll() {
		// We want to delete some isoline groups
		var isolinesGroupNum = isolinesGroup.getLayers().length;

		if (isolinesGroupNum > 0) {
			// We have some isoline groups to delete - how many?
			if (isolinesGroupNum == 1) {
				// Only one, so delete it automatically - no need to change the state of this._deleteMode
				isolinesGroup.clearLayers();
				isolinesGroup.removeFrom(map);
			} else {
				
			}
		}
	}
	
	// delete selected polygon
	function _delete(e) {
		var parent = e.sourceTarget._eventParents;

		for (var key in parent) {
			if (parent.hasOwnProperty(key) && key != '<prototype>') parent[key].removeFrom(isolinesGroup);
		}

		// Deactivate the delete control and remove the isolines group from the map if there are no more isoline groups left
		if (isolinesGroup.getLayers().length == 0) {
			isolinesGroup.removeFrom(map);
		}
	}
	
	
	// Example function to style the isoline polygons when they are returned from the API call
	function styleIsolines(feature) {
		// NOTE: You can do some conditional styling by reading the properties of the feature parameter passed to the function
		return {
			color: '#0073d4',
			opacity: 0.5,
			fillOpacity: 0.2
		};
	}

	// Example function to style the isoline polygons when the user hovers over them
	function highlightIsolines(e) {
		// NOTE: as shown in the examples on the Leaflet website, e.target = the layer the user is interacting with
		var layer = e.target;

		layer.setStyle({
			fillColor: '#ffea00',
			dashArray: '1,13',
			weight: 4,
			fillOpacity: '0.5',
			opacity: '1'
		});
	}

	// Example function to reset the style of the isoline polygons when the user stops hovering over them
	function resetIsolines(e) {
		// NOTE: as shown in the examples on the Leaflet website, e.target = the layer the user is interacting with
		var layer = e.target;

		isolinesGroup.resetStyle(layer);
	}

	// Example function to display information about an isoline in a popup when the user clicks on it
	function clickIsolines(e) {
		// NOTE: as shown in the examples on the Leaflet website, e.target = the layer the user is interacting with
		var layer = e.target;
		var props = layer.feature.properties;
		var popupContent = 'Mode of travel: ' + props['Travel mode'] + '<br />Range: 0 - ' + props['Range'] + ' ' + props['Range units'] + '<br />Area: ' + props['Area'] + ' ' + props['Area units'] + '<br />Population: ' + props['Population'];
		layer.bindPopup(popupContent).openPopup();
	}

	// Example function to create a custom marker at the origin of the isoline groups
	function isolinesOrigin(latLng, travelMode, rangeType) {
		return L.circleMarker(latLng, { radius: 4, weight: 2, color: '#0073d4', fillColor: '#fff', fillOpacity: 1 });
	}

	
	// call api to get reachable area
	function fillArea(time) {
		const newLatlng = marker.getLatLng();
		setTimeout(function() {
			var apiUrl = 'https://api.openrouteservice.org/isochrones?api_key=' + polygonOptions.apiKey;
			apiUrl += '&locations=' + newLatlng.lng + '%2C' + newLatlng.lat;
			apiUrl += '&range_type=time&range=' + time * 60;
			apiUrl += '&profile=' + polygonOptions._travelMode + '&location_type=start&attributes=area|total_pop';
			simpleAjaxRequest(apiUrl, function(data) {
				_deleteAll();
				if (data.hasOwnProperty('features')) {
					data.features.reverse();    // reverse the order of the features array

					/*
						Reformat the data in the properties object to be more readable and informative

						Returned values from API:
							value:      either metres or seconds depending on distance or time. Ignores the input in km or mi!
							total_pop:  integer value of people living in the area as given by Global Human Settlement (GHS) framework
					*/
					for (var i = 0; i < data.features.length; i++) {

						var props = data.features[i].properties;    // get the properties for the current feature
						var range,
							rangeType,
							rangeUnits,
							area;
							rangeControlDistanceUnits = polygonOptions.rangeControlDistanceUnits;

						/*
							Assume for now that the range type is distance to calculate everything with the correct units.
							If the range type is actually time we'll overwrite the range values later.
							This method reduces the number of if conditions.
						*/
					
						range = L.Util.formatNum(props.value/1000, 2);              // convert metres to kilometres for the range
						area = L.Util.formatNum(props.total_area_km, 2);            // no conversion necessary for the area
						
						// Now perform the check on the range type to set the remaining values
						rangeType = 'time';
						rangeUnits = 'min';
						range = L.Util.formatNum(props.value/60, 2);

						var newProps = {
							'Travel mode': polygonOptions._travelMode,
							'Measure': rangeType,
							'Range units': rangeUnits,
							'Range': range,
							'Area': area,
							'Area units': rangeControlDistanceUnits + '^2',
							'Latitude': props.center[1],
							'Longitude': props.center[0],
							'Population': props.total_pop
						}

						// Replace the old properties object with the new one
						data.features[i].properties = newProps;
					}

					// Create a Leaflet GeoJSON FeatureGroup object from the GeoJSON returned from the API - This is intended to be accessible externally if required
					var latestIsolines = L.geoJSON(data, { style: styleIsolines, pane: 'overlayPane' });

					latestIsolines.eachLayer(function (layer) {
						// Iterate through each layer adding events if applicable
						layer.on({
							mouseover: (function (e) { if (highlightIsolines != null) highlightIsolines(e) }),
							mouseout: (function (e) { if (resetIsolines != null) resetIsolines(e) }),
							click: (function(e) {
								if (polygonOptions._deleteMode) {
									// If we're in delete mode, call the delete function
									L.DomEvent.stopPropagation(e);
									_delete(e);
								}
								else {
									// Otherwise, if there is a user-defined click function, call that instead
									if (clickIsolines != null) clickIsolines(e);
								}
							})
						});
					});

					// Create a marker at the latlng if desired. Can be used to indicate the mode of travel etc.
					if (polygonOptions.showOriginMarker) {
						var originMarker;

						if (polygonOptions.markerFn != null) {
							// Expecting a custom Leaflet marker to be returned for the origin of the isolines group.
							// Passing the relevant factors to the function so that styling can be based on mode of travel, distance or time etc.
							originMarker = polygonOptions.markerFn(newLatlng, polygonOptions._travelMode, rangeType);
						}
						else {
							// Create a default marker for the origin of the isolines group
							originMarker = L.circleMarker(newLatlng, { radius: 3, weight: 0, fillColor: '#0073d4', fillOpacity: 1 });
						}

						// Attach events if required
						originMarker.on({
							mouseover: (function (e) { if (polygonOptions.markerOverFn != null) polygonOptions.markerOverFn(e) }),
							mouseout: (function (e) { if (polygonOptions.markerOutFn != null) polygonOptions.markerOutFn(e) }),
							click: (function(e) {
								if (polygonOptions._deleteMode) {
									// If we're in delete mode, call the delete function
									L.DomEvent.stopPropagation(e);
									polygonOptions._delete(e);
								}
								else {
									// Otherwise, if there is a user-defined click function, call that instead
									if (polygonOptions.markerClickFn != null) polygonOptions.markerClickFn(e);
								}
							})
						});

						// Add the marker to the isolines GeoJSON
						originMarker.addTo(latestIsolines);
					}

					// Add the newly created isolines GeoJSON to the overall GeoJSON FeatureGroup
					latestIsolines.addTo(isolinesGroup);

					// Add the isolines GeoJSON FeatureGroup to the map if it isn't already
					if (!map.hasLayer(isolinesGroup)) isolinesGroup.addTo(map);

				}
				
			});
		}, 300);
	}
	
	setTimeout(function() {
		fillArea(5);
	}, 10);
	