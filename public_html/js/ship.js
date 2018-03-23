var Geometry 	= require('gl-geometry')
var vec3 		= require('gl-vec3')
var mat4     	= require('gl-mat4')

var LABEL_STICK_WIDTH          	= 2.0
var LABEL_STICK_HEIGHT         	= 35.0
var LABEL_PADDING   			= {top:1.0, right:2.0, bottom:0.0, left:2.0}

function Ship(gl, letters, path, font, color, name, labelFont) {
	this.letters = letters
	this.path = path
	this.font = font
	this.color = color
	this.name = name
	this.labelFont = labelFont

	this.pathI = 1
	this.curPathPos = 0

	this.points = []
	this.timeIntervals = []
	this.pathSegmentLengths = []
	this.pathSegmentAngles = []
	this.totalPathLength = 0

	this.pathIsLeftToRight = false

	this.pathModelMat = mat4.create()
	this.labelModelMat = mat4.create()

	this.textPathGeometry = []
	this.labelFlagGeometry = Geometry(gl)
	this.labelTextGeometry = Geometry(gl)

	// save character info
	this.atlasWidth = parseFloat(this.font.common.scaleW)
	this.atlasHeight = parseFloat(this.font.common.scaleH)
	this.lineHeight = parseFloat(this.font.common.lineHeight)

	this.charInfo = [];
	for (var i=0; i<this.font.chars.length; i++){
		var character = this.font.chars[i]
		this.charInfo[character.id] = character
	}

	this.labelAtlasWidth = parseFloat(this.labelFont.common.scaleW)
	this.labelAtlasHeight = parseFloat(this.labelFont.common.scaleH)
	this.labelLineHeight = parseFloat(this.labelFont.common.lineHeight)

	this.labelCharInfo = [];
	for (var i=0; i<this.labelFont.chars.length; i++){
		var character = this.labelFont.chars[i]
		this.labelCharInfo[character.id] = character
	}

	this.cachePathInfo()

	this.textPathGeometry.push(this.buildPathMesh(Geometry(gl), 0.8))
	this.textPathGeometry.push(this.buildPathMesh(Geometry(gl), 0.4))
	this.textPathGeometry.push(this.buildPathMesh(Geometry(gl), 0.2))
	this.textPathGeometry.push(this.buildPathMesh(Geometry(gl), 0.1))

	this.buildLabelMesh()
}

var proto = Ship.prototype

proto.buildPathMesh = function (textPathGeometry, textScale){

	var positions = []
	var cells = []
	var texCoords = []
	var animTimes = []
	var localCoords = []
	var vertColors = []

	var vertIndex = 0

	var posOnPath = 0

	var result = {pos:vec3.create(), angle:0, timeInterval:0}
	var animTime = 0
	
	this.curPathPos = 0
	this.pathI = 1

	for (var j=0; j<this.letters.length; j++){
		
		var character = this.charInfo[this.letters.charCodeAt(j)]
		if (character == null || character == undefined){
			continue
		}

		this.calcPointAndAngleAtPosition(posOnPath + character.xoffset * textScale, character.xadvance * textScale, result)

		var curYOffset = ( -character.yoffset * textScale ) + 2;

		var charWidth = character.width * textScale
		var charHeight = character.height * textScale

		var pivot = [0,0,0]
		var bl = [0, curYOffset, 0]
		var tl = [0, curYOffset-charHeight, 0]
		var tr = [charWidth, curYOffset-charHeight, 0]
		var br = [charWidth, curYOffset, 0]

		var newVert = [0,0,0];
		vec3.rotateZ(newVert, bl, pivot, result.angle)
		vec3.add(newVert, newVert, result.pos)
		positions.push(newVert)

		newVert = [0,0,0]
		vec3.rotateZ(newVert, tl, pivot, result.angle)
		vec3.add(newVert, newVert, result.pos)
		positions.push(newVert)

		newVert = [0,0,0]
		vec3.rotateZ(newVert, tr, pivot, result.angle)
		vec3.add(newVert, newVert, result.pos)
		positions.push(newVert)

		newVert = [0,0,0]
		vec3.rotateZ(newVert, br, pivot, result.angle)
		vec3.add(newVert, newVert, result.pos)
		positions.push(newVert)

		cells.push([vertIndex, vertIndex+1, vertIndex+2])
		cells.push([vertIndex+2, vertIndex+3, vertIndex])

		vertIndex += 4

		this.fillAttributesForCharacter(character, this.atlasWidth, this.atlasHeight, this.color, texCoords, vertColors, localCoords)

		animTime = result.timeInterval

		animTimes.push(animTime)
		animTimes.push(animTime)
		animTimes.push(animTime)
		animTimes.push(animTime)


		posOnPath += character.xadvance * textScale

		if (posOnPath > this.totalPathLength) break;
	}

	var mesh = {"positions": positions, "cells": cells}
	textPathGeometry.attr('aPosition', mesh)
	textPathGeometry.attr('aTexCoord', texCoords, {size:2})
	textPathGeometry.attr('aAnimTime', animTimes, {size:1})
	textPathGeometry.attr('aColor', vertColors, {size:4})
	textPathGeometry.attr('aLocalCoord', localCoords, {size:2})

	return textPathGeometry;
}

proto.fillAttributesForCharacter = function(character, atlasWidth, atlasHeight, color, texCoords, vertColors, localCoords){
	var x1 = character.x/atlasWidth;
	var x2 = x1 + character.width/atlasWidth;

	var y1 = character.y/atlasHeight
	var y2 = y1 + character.height/atlasHeight;
	
	texCoords.push([x1,y1])
	texCoords.push([x1,y2])
	texCoords.push([x2,y2])
	texCoords.push([x2,y1])

	vertColors.push(color)
	vertColors.push(color)
	vertColors.push(color)
	vertColors.push(color)

	localCoords.push([0.0,0.0])
	localCoords.push([0.0,1.0])
	localCoords.push([1.0,1.0])
	localCoords.push([1.0,0.0])
} 

proto.buildLabelMesh = function (){

	var whiteColor = [1.0, 1.0, 1.0, 1.0]

	var positions = []
	var cells = []
	var texCoords = []
	var localCoords = []
	var vertColors = []

	var vertIndex = 0
	var scale = 0.9

	var xOffset = LABEL_PADDING.left

	for (var j=0; j<this.name.length; j++){
		
		var character = this.labelCharInfo[this.name.charCodeAt(j)]
		if (character == null || character == undefined){
			continue
		}

		var curXOffset = xOffset + (character.xoffset * scale)
		var curYOffset = LABEL_STICK_HEIGHT - LABEL_PADDING.top - (character.yoffset * scale ) 

		var charWidth = character.width * scale
		var charHeight = character.height * scale

		var bl = [xOffset, curYOffset, 0]
		var tl = [xOffset, curYOffset-charHeight, 0]
		var tr = [xOffset+charWidth, curYOffset-charHeight, 0]
		var br = [xOffset+charWidth, curYOffset, 0]

		positions.push(bl)
		positions.push(tl)
		positions.push(tr)
		positions.push(br)

		cells.push([vertIndex, vertIndex+1, vertIndex+2])
		cells.push([vertIndex+2, vertIndex+3, vertIndex])

		vertIndex += 4

		this.fillAttributesForCharacter(character, this.labelAtlasWidth, this.labelAtlasHeight, whiteColor, texCoords, vertColors, localCoords)

		if (j==this.name.length-1){
			xOffset += charWidth
		} else {
			xOffset += character.xadvance * scale
		}
		

	}

	var textWidth = xOffset + LABEL_PADDING.right
	var textHeight = (this.labelLineHeight * scale) + (LABEL_PADDING.top + LABEL_PADDING.bottom)

	this.labelTextGeometry.attr('aPosition', {"positions": positions, "cells": cells})
	this.labelTextGeometry.attr('aTexCoord', texCoords, {size:2})
	this.labelTextGeometry.attr('aColor', vertColors, {size:4})
	this.labelTextGeometry.attr('aLocalCoord', localCoords, {size:2})

	var flagQuad = {
		"positions": [
			[0.0, 0.0, 0.0],
			[0.0, LABEL_STICK_HEIGHT, 0.0],
			[LABEL_STICK_WIDTH, LABEL_STICK_HEIGHT, 0.0],
			[LABEL_STICK_WIDTH, 0.0, 0.0],

			[0.0, LABEL_STICK_HEIGHT-textHeight, 0.0],
			[0.0, LABEL_STICK_HEIGHT, 0.0],
			[textWidth, LABEL_STICK_HEIGHT, 0.0],
			[textWidth, LABEL_STICK_HEIGHT-textHeight, 0.0]

		],
		"cells": [
			[0, 3, 1],
			[1, 3, 2],

			[4, 7, 5],
			[5, 7, 6]
		]
	}

	this.labelFlagGeometry.attr('aPosition', flagQuad)
	this.labelFlagGeometry.attr('aColor', [this.color, this.color, this.color, this.color, this.color, this.color, this.color, this.color], {size:4})
}

proto.calcPointAndAngleAtPosition = function(targetPos, charWidth, result){

    if (targetPos<0){
        result.pos = vec3.clone(this.points[0])
        result.angle = this.pathSegmentAngles[0]
        result.timeInterval = this.timeIntervals[0]
        return
    }

    var distToEnd = Math.abs(this.totalPathLength - targetPos);
    if (distToEnd<0.01){
    	
    	result.pos = vec3.clone(this.points[this.points.length-1])

    	result.angle = this.pathSegmentAngles[this.pathSegmentAngles.length-1]
        result.timeInterval = this.timeIntervals[this.timeIntervals.length-1]
        return
    }

    
    var vectorToNextPoint = vec3.create()
    var targetPoint = vec3.create()
    var segmentLength
    var f
    var timeDiff
    var timePC
    
    //for (int i=1; i<points.size(); i++){
    //    pathI = i;
    while (this.pathI<this.points.length){
        
        segmentLength = this.pathSegmentLengths[this.pathI-1];
        
        if (this.curPathPos + segmentLength > targetPos){
            // within this segment
            if (segmentLength == 0){
            	f = 0
            } else {
            	f = (targetPos-this.curPathPos) / segmentLength
			}

            vec3.lerp(targetPoint, this.points[this.pathI-1], this.points[this.pathI], f)
            
            result.pos = targetPoint
            result.angle = this.pathSegmentAngles[this.pathI-1]
            
            timeDiff = this.timeIntervals[this.pathI]-this.timeIntervals[this.pathI-1];
            timePC = timeDiff*f;
            
            result.timeInterval = this.timeIntervals[this.pathI-1] + timePC

            if (targetPos + charWidth > this.curPathPos + segmentLength){
          		 this.curPathPos += segmentLength
       			 this.pathI++
            } else {
 
            }
			
           return
        }

        this.curPathPos += segmentLength
        this.pathI++
    }
    
    // clamp to end
    result.pos = vec3.clone(this.points[this.points.length-1])
    result.angle = this.pathSegmentAngles[this.pathSegmentAngles.length-1]
    result.timeInterval = this.timeIntervals[this.timeIntervals.length-1]
    return
}


proto.cachePathInfo = function(){

	// convert path to vec3 points & reverse order
	for (var i=this.path.length-1; i>0; i-=3){
		this.points.push([this.path[i-1], this.path[i], 0])
		this.timeIntervals.push(this.path[i-2])
	}

    numPoints = this.points.length
    
    var previousPoint = this.points[0]
    var currentPoint
    this.totalPathLength = 0
    var curLength = 0
    
    for (var i=1; i<numPoints; i++){
        currentPoint = this.points[i]
        curLength = vec3.distance(previousPoint,currentPoint)
        this.pathSegmentLengths.push(curLength)
        this.pathSegmentAngles.push(angleOfLineBetweenPoints(previousPoint,currentPoint))

        previousPoint = currentPoint
        this.totalPathLength += curLength
    }
    
    // work out if path goes left->right or right->left    
    this.pathIsLeftToRight = (this.points[0][0] < this.points[this.points.length-1][0])
    
}


proto.getPathLengthAtTimeInterval = function(timeInterval){

    var pathLength = 0.0
    
    var previousPoint = this.points[0]
    
    var previousPointTimeInterval = this.timeIntervals[0]

    if (previousPointTimeInterval>=timeInterval){
        // first point is before current time, so don't show this one
        return 0.0
    }
    
    var currentPoint
    var pointTimeInterval
    var blendFraction
    var blendedPoint = [0.0,0.0]
    
    for (var i=1; i<this.points.length; i++){
        
        currentPoint = this.points[i]
        
        pointTimeInterval = this.timeIntervals[i]
        
        if (pointTimeInterval > timeInterval) {
            
            // blend between this position and the last one
            blendFraction = (timeInterval-previousPointTimeInterval) / (pointTimeInterval - previousPointTimeInterval)

            vec3.lerp(blendedPoint, previousPoint, currentPoint, blendFraction)
            
            return Math.min(this.totalPathLength, pathLength + vec3.distance(previousPoint, blendedPoint))
            
        }
        
        pathLength += this.pathSegmentLengths[i-1]
        previousPoint = currentPoint
        previousPointTimeInterval = pointTimeInterval
    }
    
    return Math.min(this.totalPathLength, pathLength);

}

proto.getLabelPosition = function(timeInterval){
	
 	this.pathI = 1;
    this.curPathPos = 0.0;
    var pathLengthAtTime = this.getPathLengthAtTimeInterval(timeInterval)
    var result = {pos:vec3.create(), angle:0, timeInterval:0}

    this.calcPointAndAngleAtPosition(pathLengthAtTime, 0, result)

    return result.pos
}


function angleOfLineBetweenPoints(pointA, pointB){
    var dx = pointB[0]-pointA[0]
    var dy = pointB[1]-pointA[1]
    
    return Math.atan2(dy, dx)
}


exports.createShip = function(gl, letters, path, font, color, name, labelFont){
  var ship = new Ship(gl, letters, path, font, color, name, labelFont)
  return ship
}
