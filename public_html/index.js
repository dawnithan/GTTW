var colors = []   
colors.push(toCol(199, 70, 68, 255))
colors.push(toCol(156, 64, 106, 255))
colors.push(toCol(107, 120, 78, 255))
colors.push(toCol(208, 183, 113, 255))
colors.push(toCol(138, 119, 190, 255))
colors.push(toCol(71, 136, 109, 255))
colors.push(toCol(212, 96, 93, 255))
colors.push(toCol(91, 167, 98, 255))
colors.push(toCol(198, 112, 25, 255))
colors.push(toCol(125, 167, 189, 255))
colors.push(toCol(83, 133, 67, 255))
colors.push(toCol(189, 103, 39, 255))
colors.push(toCol(187, 180, 85, 255))
colors.push(toCol(180, 73, 71, 255))

var quadTexCoords = [[0,0], [0,1], [1, 1], [1,0]]

var Geometry = require('gl-geometry')
var fit      = require('canvas-fit')
var mat4     = require('gl-mat4')
var glslify  = require('glslify')
var createTexture = require("gl-texture2d")
var getPixels = require("get-pixels")
var vec3     = require('gl-vec3')
var TWEEN = require('tween.js');
var shipFactory = require('./ship');

var canvas = document.body.appendChild(document.createElement('canvas'))

// disable interaction on this canvas (so Mapbox gets it)
canvas.style.pointerEvents = "none";

var gl = require('gl-context')(canvas, render)

// Resizes the <canvas> to fully fit the window
// whenever the window is resized.
window.addEventListener('resize', fit(canvas), false)

var projection = mat4.create()
var debugModel      = mat4.create()

var scaledView       = mat4.create()
var unscaledView       = mat4.create()

var width  = gl.drawingBufferWidth
var height = gl.drawingBufferHeight

var simpleShader = glslify({vert: './shaders/simple.vert', frag: './shaders/simple.frag'})(gl)
var textShader = glslify({vert: './shaders/text.vert', frag: './shaders/text.frag'})(gl)
var labelTextShader = glslify({vert: './shaders/label-text.vert', frag: './shaders/label-text.frag'})(gl)
var vertColoredShader = glslify({vert: './shaders/vertcolored.vert', frag: './shaders/vertcolored.frag'})(gl)

var fontTexture = createTexture(gl, [512, 512, 4])
loadImage("font/Helvetica32.png", fontTexture, false)

var labelFontTexture = createTexture(gl, [512, 512, 4])
loadImage("font/Helvetica15.png", labelFontTexture, true)

var font = require("./font/Helvetica32.json")

var labelFont = require("./font/Helvetica15.json")

var data = shipData.ships

var mapLayer = require('./map-layer').create(mapData)

var originalCenter = mapLayer.getCenter()
var originalCenterCoords = mapLayer.project(originalCenter)
var originalZoom = mapLayer.getZoom()
var originalSize = {"width":width, "height":height}


var colorIndex = 0

var ships = []


for (var i = 0; i<data.length; i++){
	var path = data[i].path

	for (var j=0; j<path.length; j+=3){
		var coord = mapLayer.project(new mapboxgl.LngLat(path[j+1], path[j+2]))
		path[j+1] = (coord.x-originalCenterCoords.x)
		path[j+2] = -(coord.y-originalCenterCoords.y)
	}

	var ship = shipFactory.createShip(gl, data[i].text, path, font, colors[colorIndex], data[i].name, labelFont)
	ships.push(ship)

	colorIndex++

	if (colorIndex == colors.length){
		colorIndex = 0
	}

}

var FADE_IN = 0
var SIMULATE = 1
var FADE_OUT = 2

var state = FADE_IN

var secondsElapsed = 0
var startTime = (new Date()).getTime()

var simulationDuration = 60*60*24 // one day
var simulationTime = 0
var simulationSpeed = 200

var scale

/*
var debugTexture = createTexture(gl, [1024, 1024, 4])
loadImage("./img/debugtexture.jpg", debugTexture, true)
var debugQuad = buildQuad(20, 20, quadTexCoords)
*/

var overlayModel = mat4.create()
var overlayView   = mat4.create()
mat4.translate(overlayModel, mat4.create(), [0,0,-1])
var overlayQuad = buildQuad(2, 2, null, toCol(44, 47, 57, 255))
var overlayProjection = mat4.create()
mat4.ortho(overlayProjection, -1.0, 1.0, -1.0, 1.0, 0.1, 100)
var overlayInfo = {alpha:1.0};


mapLayer.setZoom(mapData.zoom)

var overlayFadeInTween = new TWEEN.Tween(overlayInfo).to({alpha : 0}, 1000).delay(1000).onComplete(handleFadeInComplete)
var overlayFadeOutTween = new TWEEN.Tween(overlayInfo).to({alpha : 1.0}, 1000).onComplete(handleFadeOutComplete)

overlayFadeInTween.start()

function handleFadeInComplete(){
	state = SIMULATE
}

function handleFadeOutComplete(){
	simulationTime = 0
	state = FADE_IN
	mapLayer.setCenter(mapData.center)
	mapLayer.setZoom(mapData.zoom)
	overlayFadeInTween.start()
}

function toCol(r, g, b, a){
	return [r/255.0, g/255.0, b/255.0, a/255.0]
}


function update() {

	TWEEN.update();

	var now = (new Date()).getTime()
	var newSecondsElapsed = (now-startTime)/1000.0
	var frameDelta = newSecondsElapsed - secondsElapsed
	secondsElapsed = newSecondsElapsed

	if (state == SIMULATE){
		simulationTime += frameDelta*simulationSpeed
		if (simulationTime >= simulationDuration){
			state = FADE_OUT
			overlayFadeOutTween.start()
		}
	}
	
	width  = gl.drawingBufferWidth
	height = gl.drawingBufferHeight

	var newCenterCoords = mapLayer.project(originalCenter)
	var zoom = mapLayer.getZoom()

 	scale = Math.pow(2, zoom ) / 512.0

	var viewOffset = [newCenterCoords.x-originalCenterCoords.x, -(newCenterCoords.y-originalCenterCoords.y), -1]
	var aspectOffset = [(width-originalSize.width)/-2.0, (height-originalSize.height)/2.0, 0]

	mat4.translate(unscaledView, mat4.create(), viewOffset)
	mat4.translate(unscaledView, unscaledView, aspectOffset)
	mat4.scale(scaledView, unscaledView, [scale, scale, scale])

	mat4.ortho(projection, -width/2.0, width/2.0, -height/2.0, height/2.0, 0.1, 1000)

}

function render() {
	update()

	gl.clearDepth(1)
	gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)

	gl.viewport(0, 0, width, height)
	gl.enable(gl.DEPTH_TEST)
	gl.enable(gl.CULL_FACE)

	gl.enable(gl.BLEND)
	gl.depthFunc(gl.LEQUAL)
	gl.depthMask(false)

	gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)

	// Render text paths
	var textMVP = mat4.create()
	mat4.multiply(textMVP, projection, scaledView) 
	// no need to multiply by a model matrix for text paths as they are always at zero

	var textSizeLevel = 0
	var zoomLevel = Math.floor(mapLayer.getZoom())

	if (zoomLevel>=11){
		textSizeLevel = 3
	} else if (zoomLevel>=10){
		textSizeLevel = 2
	} else if (zoomLevel>=9){
		textSizeLevel = 1
	}

	for (var i=0; i<ships.length; i++){
		var textPathGeometry = ships[i].textPathGeometry[textSizeLevel]

		textPathGeometry.bind(textShader)
		textShader.uniforms.uMVP = textMVP
		textShader.uniforms.uTexture = fontTexture.bind()
		textShader.uniforms.uSecondsElapsed = secondsElapsed
		textShader.uniforms.uSimulationTime = simulationTime
		textPathGeometry.draw(gl.TRIANGLES)
	}

	gl.depthMask(true)

	// Render label flags
	for (var i=0; i<ships.length; i++){
		var labelFlagGeometry = ships[i].labelFlagGeometry
		var labelPosition = ships[i].getLabelPosition(simulationTime)
		var labelModel = mat4.create()

		vec3.scale(labelPosition, labelPosition, scale)
		labelPosition[2] = -10-i*2.0
		mat4.translate(labelModel, mat4.create(), labelPosition)
		
		var labelMVP = mat4.create()
		mat4.multiply(labelMVP, projection, unscaledView)
		mat4.multiply(labelMVP, labelMVP, labelModel)

		labelFlagGeometry.bind(vertColoredShader)
		vertColoredShader.uniforms.uMVP = labelMVP
		vertColoredShader.uniforms.uAlpha = 1.0
		labelFlagGeometry.draw(gl.TRIANGLES)
	}

	// Render label text
	for (var i=0; i<ships.length; i++){
		var labelTextGeometry = ships[i].labelTextGeometry
		var labelPosition = ships[i].getLabelPosition(simulationTime)
		var labelModel = mat4.create()

		vec3.scale(labelPosition, labelPosition, scale)
		labelPosition[2] = -10-i*2.0+1
		mat4.translate(labelModel, mat4.create(), labelPosition)
		
		var labelMVP = mat4.create()
		mat4.multiply(labelMVP, projection, unscaledView)
		mat4.multiply(labelMVP, labelMVP, labelModel)

		labelTextGeometry.bind(labelTextShader)
		labelTextShader.uniforms.uMVP = labelMVP
		labelTextShader.uniforms.uTexture = labelFontTexture.bind()
		labelTextGeometry.draw(gl.TRIANGLES)
	}



	/*
	debugQuad.bind(simpleShader)
	var debugMVP = mat4.create()
	mat4.multiply(debugMVP, projection, view) 
	mat4.multiply(debugMVP, textMVP, debugModel) 
	simpleShader.uniforms.uMVP = debugMVP
	simpleShader.uniforms.uTexture = debugTexture.bind()
	debugQuad.draw(gl.TRIANGLES)
	*/
	
	gl.depthFunc(gl.ALWAYS)

	if (overlayInfo.alpha > 0){
		overlayQuad.bind(vertColoredShader)
		var overlayMVP = mat4.create()
		mat4.multiply(overlayMVP, overlayProjection, overlayView) 
		mat4.multiply(overlayMVP, overlayMVP, overlayModel) 
		vertColoredShader.uniforms.uMVP = overlayMVP
		vertColoredShader.uniforms.uAlpha = overlayInfo.alpha
		overlayQuad.draw(gl.TRIANGLES)
	}
	
	
}

function loadImage(url, texture, mipmap){
	getPixels(url, function(err, pixels) {
	if(err) {
		console.log("Bad image path")
		return
	}

	texture.setPixels(pixels)
		if (mipmap){
			texture.generateMipmap()
			texture.magFilter = gl.LINEAR
			texture.minFilter = gl.LINEAR_MIPMAP_NEAREST
		} else {
			texture.magFilter = gl.LINEAR
			texture.minFilter = gl.LINEAR
		}
	})
}

function buildQuad(width, height, texCoords, vertColor){
	var geometry = Geometry(gl)

	var halfWidth = width/2.0;
	var halfHeight = height/2.0;

	var quad = {
		"positions": [
			[-halfWidth, halfHeight, 0.0],
			[-halfWidth, -halfHeight, 0.0],
			[halfWidth, -halfHeight, 0.0],
			[halfWidth, halfHeight, 0.0]
		],
		"cells": [
			[0, 1, 2],
			[2, 3, 0]
		]
	}

	geometry.attr('aPosition', quad)

	if (texCoords != undefined && texCoords != null){
		geometry.attr('aTexCoord', texCoords, {size:2})
	}
		
	if (vertColor != undefined && vertColor != null){
		geometry.attr('aColor', [vertColor, vertColor, vertColor, vertColor], {size:4})
	}

	return geometry
}
