/**
 * Renderer application
 * 
 * @module main
 * @requires underscore, json, glMatrix
 * 
 */
var WEBGLEX = WEBGLEX || {};



WEBGLEX.log = function () {
	var args = JSON.stringify(_.toArray(arguments));
	if (window && window.console) {
		console.log(args);
	} else {
		alert(args);
	}
};
var LOG = WEBGLEX.log;



WEBGLEX.Renderer = function (errorCallback) {
	
	'use strict';
    
    if (!(this instanceof WEBGLEX.Renderer)) {
        return new WEBGLEX.Renderer();
    }
    
    var _global = window,                 // global context
    	_self   = this,                   // instance
		_ns     = WEBGLEX,                // namespace
		_proto  = _ns.Renderer.prototype, // prototype
		_canvas = null,                   // canvas element
		_gl     = null,                   // render context
		_glContextNames               = ['webgl', 'experimental-webgl', 
		                                 'webkit-3d', 'moz-webgl'],
		_canvasDomId                  = 'scene-holder',
		_fpsDomId                     = 'fps-holder',
		_errorDomId                   = 'error-holder',
		_errorCallback                = errorCallback,
		_errorHolder                  = null,
		
		_triangleVertexPositionBuffer = null,
	    _squareVertexPositionBuffer   = null,
	    _triangleVertexColorBuffer    = null,
	    _squareVertexColorBuffer      = null,
	    _shaderProgram                = null,
	    _mvMatrix                     = mat4.create(),
	    _pMatrix                      = mat4.create(),
	    
	    _prevTime                     = (new Date()).getTime(),
	    _realFps                      = 60,
	    _period                       = 1000 / 60,
	    _fpsHolder                    = null,
	    
	    _rotateValue                  = 0,
	    _rotateSpeed                  = 0.025,
	    _shiftZValue                  = -7.0,
	    _shiftZSpeed                  = 0.1;
    
    var _initHelpers = function () {
    	_fpsHolder = _global.document.getElementById(_fpsDomId);
    	_errorHolder = _global.document.getElementById(_errorDomId);
    	_errorCallback = _errorCallback && typeof _errorCallback === 'function' 
    		? _errorCallback : _errorCallbackDefault;
    	_global.onkeydown = _keyDown;
    };
    
    var _initGL = function () {
    	_canvas = _global.document.getElementById(_canvasDomId);
    	for (var i = 0, len = _glContextNames.length; i < len; i++) {
    		try {
        		_gl = _canvas.getContext(_glContextNames[i]);
        		_gl.viewportWidth = _canvas.width;
        		_gl.viewportHeight = _canvas.height;
        		if (_gl) {
            		LOG('Context name is: ' + _glContextNames[i]);
        			return true;
        		}
        	} catch (e) {}
    	}
    	var msg = 'WEBGLEX.Renderer ERROR: no WebGL!';
		_errorCallback.call(_self, msg);
		return false;
    	
    };
    
    var _getShader = function (id) {
    	var shaderScript = document.getElementById(id);
        if (!shaderScript) {
            return null;
        }

        var shaderStr = '';
        var k = shaderScript.firstChild;
        while (k) {
            if (k.nodeType == 3) {
            	shaderStr += k.textContent;
            }
            k = k.nextSibling;
        }

        var shader = null;
        if (shaderScript.type == 'x-shader/x-fragment') {
            shader = _gl.createShader(_gl.FRAGMENT_SHADER);
        } else if (shaderScript.type == 'x-shader/x-vertex') {
            shader = _gl.createShader(_gl.VERTEX_SHADER);
        } else {
            return null;
        }

        _gl.shaderSource(shader, shaderStr);
        _gl.compileShader(shader);

        if (!_gl.getShaderParameter(shader, _gl.COMPILE_STATUS)) {
            LOG(_gl.getShaderInfoLog(shader));
            return null;
        }

        return shader;
    };
    
    var _initGLShaders = function () {
    	var fragmentShader = _getShader('shader-fs');
        var vertexShader = _getShader('shader-vs');

        _shaderProgram = _gl.createProgram();
        _gl.attachShader(_shaderProgram, vertexShader);
        _gl.attachShader(_shaderProgram, fragmentShader);
        _gl.linkProgram(_shaderProgram);

        if (!_gl.getProgramParameter(_shaderProgram, _gl.LINK_STATUS)) {
            LOG('Could not initialise shaders');
        }

        _gl.useProgram(_shaderProgram);

        _shaderProgram.vertexPositionAttribute = _gl.getAttribLocation(_shaderProgram, 'aVertexPosition');
        _gl.enableVertexAttribArray(_shaderProgram.vertexPositionAttribute);
        _shaderProgram.vertexColorAttribute = _gl.getAttribLocation(_shaderProgram, 'aVertexColor');
        _gl.enableVertexAttribArray(_shaderProgram.vertexColorAttribute);

        _shaderProgram.pMatrixUniform = _gl.getUniformLocation(_shaderProgram, 'uPMatrix');
        _shaderProgram.mvMatrixUniform = _gl.getUniformLocation(_shaderProgram, 'uMVMatrix');
    };
    
    var _initGLBuffers = function () { // @todo: for refactoring
    	var vertices = null;
    	// init triangle
    	_triangleVertexPositionBuffer = _gl.createBuffer();
        _gl.bindBuffer(_gl.ARRAY_BUFFER, _triangleVertexPositionBuffer);
        vertices = [
             0.0,    1.333, 0.0,
            -1.155, -0.667, 0.0,
             1.155, -0.667, 0.0
        ];
        _gl.bufferData(_gl.ARRAY_BUFFER, new Float32Array(vertices), _gl.STATIC_DRAW);
        _triangleVertexPositionBuffer.itemSize = 3;
        _triangleVertexPositionBuffer.numItems = 3;
        
        _triangleVertexColorBuffer = _gl.createBuffer();
        _gl.bindBuffer(_gl.ARRAY_BUFFER, _triangleVertexColorBuffer);
        var colors = [
            1.0, 0.0, 0.0, 1.0,
            0.0, 1.0, 0.0, 1.0,
            0.0, 0.0, 1.0, 1.0
        ];
        _gl.bufferData(_gl.ARRAY_BUFFER, new Float32Array(colors), _gl.STATIC_DRAW);
        _triangleVertexColorBuffer.itemSize = 4;
        _triangleVertexColorBuffer.numItems = 3;
        // init square
        _squareVertexPositionBuffer = _gl.createBuffer();
        _gl.bindBuffer(_gl.ARRAY_BUFFER, _squareVertexPositionBuffer);
        vertices = [
             1.0,  1.0, 0.0,
            -1.0,  1.0, 0.0,
             1.0, -1.0, 0.0,
            -1.0, -1.0, 0.0
        ];
        _gl.bufferData(_gl.ARRAY_BUFFER, new Float32Array(vertices), _gl.STATIC_DRAW);
        _squareVertexPositionBuffer.itemSize = 3;
        _squareVertexPositionBuffer.numItems = 4;
        
        _squareVertexColorBuffer = _gl.createBuffer();
        _gl.bindBuffer(_gl.ARRAY_BUFFER, _squareVertexColorBuffer);
        colors = [
		    1.0, 1.0, 0.0, 1.0,
		    1.0, 0.0, 0.0, 1.0,
		    0.0, 1.0, 0.0, 1.0,
		    0.0, 0.0, 1.0, 1.0,
		];
        _gl.bufferData(_gl.ARRAY_BUFFER, new Float32Array(colors), _gl.STATIC_DRAW);
        _squareVertexColorBuffer.itemSize = 4;
        _squareVertexColorBuffer.numItems = 4;
    };
    
    var _initGLParams = function () {
    	_gl.clearColor(0.0, 0.0, 0.0, 1.0);
	    _gl.enable(_gl.DEPTH_TEST);

    	_gl.viewport(0, 0, _gl.viewportWidth, _gl.viewportHeight);
        mat4.perspective(45, _gl.viewportWidth / _gl.viewportHeight, 0.1, 100.0, _pMatrix);
    };
    
    var _setMatrixUniforms = function () {
        _gl.uniformMatrix4fv(_shaderProgram.pMatrixUniform, false, _pMatrix);
        _gl.uniformMatrix4fv(_shaderProgram.mvMatrixUniform, false, _mvMatrix);
    };
    
    var _drawGLScene = function () {
        _gl.clear(_gl.COLOR_BUFFER_BIT | _gl.DEPTH_BUFFER_BIT);

        // @todo: for refactoring from here
        mat4.identity(_mvMatrix);
        mat4.translate(_mvMatrix, [-1.5, 0.0, _shiftZValue]);
        mat4.rotateZ(_mvMatrix, _rotateValue, 0);
        _gl.bindBuffer(_gl.ARRAY_BUFFER, _triangleVertexPositionBuffer);
        _gl.vertexAttribPointer(_shaderProgram.vertexPositionAttribute, _triangleVertexPositionBuffer.itemSize, _gl.FLOAT, false, 0, 0);
        _gl.bindBuffer(_gl.ARRAY_BUFFER, _triangleVertexColorBuffer);
        _gl.vertexAttribPointer(_shaderProgram.vertexColorAttribute, _triangleVertexColorBuffer.itemSize, _gl.FLOAT, false, 0, 0);
    	_setMatrixUniforms();
        _gl.drawArrays(_gl.TRIANGLES, 0, _triangleVertexPositionBuffer.numItems);

        mat4.identity(_mvMatrix);
        mat4.translate(_mvMatrix, [1.5, 0.0, _shiftZValue]);
        mat4.rotateZ(_mvMatrix, _rotateValue, 0);
        _gl.bindBuffer(_gl.ARRAY_BUFFER, _squareVertexPositionBuffer);
        _gl.vertexAttribPointer(_shaderProgram.vertexPositionAttribute, _squareVertexPositionBuffer.itemSize, _gl.FLOAT, false, 0, 0);
        _gl.bindBuffer(_gl.ARRAY_BUFFER, _squareVertexColorBuffer);
        _gl.vertexAttribPointer(_shaderProgram.vertexColorAttribute, _squareVertexColorBuffer.itemSize, _gl.FLOAT, false, 0, 0);
        _setMatrixUniforms();
        _gl.drawArrays(_gl.TRIANGLE_STRIP, 0, _squareVertexPositionBuffer.numItems);
        // to here
        
        _rotateValue += _rotateSpeed;
        var curTime = (new Date()).getTime();
        _realFps = Math.ceil(1000 / (curTime - _prevTime));
        _prevTime = curTime;
        _global.setTimeout(_drawGLScene, _period);
    };
    
    var _drawLoop = function () {
    	_global.setTimeout(_drawGLScene, _period);
    	_global.setInterval(_drawFps, 1000);
    };
    
    var _drawFps = function () {
    	_fpsHolder.innerHTML = _realFps;
    };
    
    var _errorCallbackDefault = function (msg, e) {
    	var html = _errorHolder.innerHTML + '<br>\n<br>\n';
    	_errorHolder.innerHTML = html + '<b>' + msg + '<\/b><br>\n' + e;
    };
    
    var _keyDown = function (e) {
    	switch (e.keyCode) {
    	case 87: // w
            _shiftZValue -= _shiftZSpeed;
    		break;
    	case 83: // s
            _shiftZValue += _shiftZSpeed;
    		break;
    	}
    };

	(function (self, callbacks) { // constructor
		var success = callbacks.shift().call(self);
		if (!success) return;
		_.each(callbacks, function (callback) {
			callback.call(self);
		});
	})(_self, [_initGL, _initHelpers, _initGLShaders,
	           _initGLBuffers, _initGLParams, _drawLoop]);
};



// entry point
window.onload = function () { WEBGLEX.Renderer(); };
