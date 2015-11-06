'use strict';

var p5 = require('../core/core');
var shader = require('./shader');
require('../core/p5.Renderer');
require('./p5.Matrix');
var uMVMatrixStack = [];
var RESOLUTION = 1000;

//@TODO should implement public method
//to override these attributes
var attributes = {
  alpha: true,
  depth: true,
  stencil: true,
  antialias: false,
  premultipliedAlpha: false,
  preserveDrawingBuffer: false
};

/**
 * @class p5.Renderer3D
 * @constructor
 * @extends p5.Renderer
 * 3D graphics class.
 * @todo extend class to include public method for offscreen
 * rendering (FBO).
 *
 */
p5.Renderer3D = function(elt, pInst, isMainCanvas) {
  p5.Renderer.call(this, elt, pInst, isMainCanvas);
  this._initContext();

  this.isP3D = true; //lets us know we're in 3d mode
  this.GL = this.drawingContext;
  //Immediate mode
  this.vertexStack = [];
  this.vertexBuffer = this.GL.createBuffer();
  this.colorBuffer = this.GL.createBuffer();
  //lights
  this.ambientLightCount = 0;
  this.directionalLightCount = 0;
  this.pointLightCount = 0;
  //camera
  this._isSetCamera = false;
  /**
   * model view, projection, & normal
   * matrices
   */
  this.uMVMatrix = new p5.Matrix();
  this.uPMatrix  = new p5.Matrix();
  this.uNMatrix = new p5.Matrix();
  //Geometry & Material hashes
  this.gHash = {};
  this.mHash = {};
  return this;
};

p5.Renderer3D.prototype = Object.create(p5.Renderer.prototype);

//////////////////////////////////////////////
// Setting
//////////////////////////////////////////////

p5.Renderer3D.prototype._initContext = function() {
  try {
    this.drawingContext = this.canvas.getContext('webgl', attributes) ||
      this.canvas.getContext('experimental-webgl', attributes);
    if (this.drawingContext === null) {
      throw new Error('Error creating webgl context');
    } else {
      console.log('p5.Renderer3D: enabled webgl context');
      var gl = this.drawingContext;
      gl.enable(gl.DEPTH_TEST);
      gl.depthFunc(gl.LEQUAL);
      //@TODO fix this. or do we even need to glClear on setup?
      //this.clear(1.0,1.0,1.0,1.0);//background initialized white
      gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    }
  } catch (er) {
    throw new Error(er);
  }
};
//detect if user didn't set the camera
//then call this function below
p5.Renderer3D.prototype._setDefaultCamera = function(){
  if(!this._isSetCamera){
    var _w = this.width;
    var _h = this.height;
    this.uPMatrix = p5.Matrix.identity();
    this.uPMatrix.perspective(60 / 180 * Math.PI, _w / _h, 0.1, 100);
    this._isSetCamera = true;
  }
};

p5.Renderer3D.prototype._update = function() {
  this.uMVMatrix = p5.Matrix.identity();
  this.translate(0, 0, -800);
  this.ambientLightCount = 0;
  this.directionalLightCount = 0;
  this.pointLightCount = 0;
  this.vertexStack = [];
};

//////////////////////////////////////////////
// SHADER
//////////////////////////////////////////////

/**
 * [_initShaders description]
 * @param  {[type]} vertId [description]
 * @param  {[type]} fragId [description]
 * @return {[type]}        [description]
 */
p5.Renderer3D.prototype._initShaders = function(vertId, fragId, immediateMode) {
  var gl = this.GL;
  //set up our default shaders by:
  // 1. create the shader,
  // 2. load the shader source,
  // 3. compile the shader
  var _vertShader = gl.createShader(gl.VERTEX_SHADER);
  //load in our default vertex shader
  gl.shaderSource(_vertShader, shader[vertId]);
  gl.compileShader(_vertShader);
  // if our vertex shader failed compilation?
  if (!gl.getShaderParameter(_vertShader, gl.COMPILE_STATUS)) {
    alert('Yikes! An error occurred compiling the shaders:' +
      gl.getShaderInfoLog(_vertShader));
    return null;
  }

  var _fragShader = gl.createShader(gl.FRAGMENT_SHADER);
  //load in our material frag shader
  gl.shaderSource(_fragShader, shader[fragId]);
  gl.compileShader(_fragShader);
  // if our frag shader failed compilation?
  if (!gl.getShaderParameter(_fragShader, gl.COMPILE_STATUS)) {
    alert('Darn! An error occurred compiling the shaders:' +
      gl.getShaderInfoLog(_fragShader));
    return null;
  }

  var shaderProgram = gl.createProgram();
  gl.attachShader(shaderProgram, _vertShader);
  gl.attachShader(shaderProgram, _fragShader);
  gl.linkProgram(shaderProgram);
  if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
    alert('Snap! Error linking shader program');
  }
  //END SHADERS SETUP

  this._getLocation(shaderProgram, immediateMode);

  return shaderProgram;
};

p5.Renderer3D.prototype._getLocation = function(shaderProgram, immediateMode) {
  var gl = this.GL;
  gl.useProgram(shaderProgram);
  shaderProgram.uResolution =
    gl.getUniformLocation(shaderProgram, 'uResolution');
  gl.uniform1f(shaderProgram.uResolution, RESOLUTION);

  //vertex position Attribute
  shaderProgram.vertexPositionAttribute =
    gl.getAttribLocation(shaderProgram, 'aPosition');
  gl.enableVertexAttribArray(shaderProgram.vertexPositionAttribute);

  //projection Matrix uniform
  shaderProgram.uPMatrixUniform =
    gl.getUniformLocation(shaderProgram, 'uProjectionMatrix');
  //model view Matrix uniform
  shaderProgram.uMVMatrixUniform =
    gl.getUniformLocation(shaderProgram, 'uModelViewMatrix');

  //@TODO: figure out a better way instead of if statement
  if(immediateMode === undefined){
    //vertex normal Attribute
    shaderProgram.vertexNormalAttribute =
      gl.getAttribLocation(shaderProgram, 'aNormal');
    gl.enableVertexAttribArray(shaderProgram.vertexNormalAttribute);

    //normal Matrix uniform
    shaderProgram.uNMatrixUniform =
    gl.getUniformLocation(shaderProgram, 'uNormalMatrix');

    //texture coordinate Attribute
    shaderProgram.textureCoordAttribute =
      gl.getAttribLocation(shaderProgram, 'aTexCoord');
    gl.enableVertexAttribArray(shaderProgram.textureCoordAttribute);

    shaderProgram.samplerUniform =
    gl.getUniformLocation(shaderProgram, 'uSampler');
  }
};

p5.Renderer3D.prototype._setMatrixUniforms = function(shaderKey) {
  var gl = this.GL;
  var shaderProgram = this.mHash[shaderKey];

  gl.useProgram(shaderProgram);

  gl.uniformMatrix4fv(
    shaderProgram.uPMatrixUniform,
    false, this.uPMatrix.mat4);

  gl.uniformMatrix4fv(
    shaderProgram.uMVMatrixUniform,
    false, this.uMVMatrix.mat4);

  this.uNMatrix = new p5.Matrix();
  this.uNMatrix.invert(this.uMVMatrix);
  this.uNMatrix.transpose(this.uNMatrix);

  gl.uniformMatrix4fv(
    shaderProgram.uNMatrixUniform,
    false, this.uNMatrix.mat4);
};
//////////////////////////////////////////////
// GET CURRENT | for shader and color
//////////////////////////////////////////////
p5.Renderer3D.prototype._getShader = function(vertId, fragId, immediateMode) {
  var mId = vertId + '|' + fragId;
  //create it and put it into hashTable
  if(!this.materialInHash(mId)){
    var shaderProgram = this._initShaders(vertId, fragId, immediateMode);
    this.mHash[mId] = shaderProgram;
  }
  this.curShaderId = mId;

  return this.mHash[this.curShaderId];
};

p5.Renderer3D.prototype._getCurShaderId = function(){
  //if the shader ID is not yet defined
  if(this.curShaderId === undefined){
    //default shader: normalMaterial()
    var mId = 'normalVert|normalFrag';
    var shaderProgram = this._initShaders('normalVert', 'normalFrag');
    this.mHash[mId] = shaderProgram;
    this.curShaderId = mId;
  }

  return this.curShaderId;
};

//////////////////////////////////////////////
// COLOR
//////////////////////////////////////////////
p5.Renderer3D.prototype.fill = function(r, g, b, a) {
  var color = this._pInst.color.apply(this._pInst, arguments);
  var colorNormalized = color._normalize();
  this.curColor = colorNormalized;
  this.drawMode = 'fill';
  this._pInst.basicMaterial.apply(this._pInst, arguments);
  return this;
};
//////////////////////////////////////////////
// HASH | for material and geometry
//////////////////////////////////////////////

p5.Renderer3D.prototype.geometryInHash = function(gId){
  return this.gHash[gId] !== undefined;
};

p5.Renderer3D.prototype.materialInHash = function(mId){
  return this.mHash[mId] !== undefined;
};

/**
 * [resize description]
 * @param  {[type]} w [description]
 * @param  {[tyoe]} h [description]
 * @return {[type]}   [description]
 */
p5.Renderer3D.prototype.resize = function(w,h) {
  var gl = this.GL;
  p5.Renderer.prototype.resize.call(this, w, h);
  gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
};

/**
 * [background description]
 * @return {[type]} [description]
 */
p5.Renderer3D.prototype.background = function() {
  var _col = this._pInst.color.apply(this._pInst, arguments);
  //webgl requires normalized r,g,b
  var _r = (_col.rgba[0]) / 255;
  var _g = (_col.rgba[1]) / 255;
  var _b = (_col.rgba[2]) / 255;
  var _a = (_col.rgba[3]) / 255;
  this.clear(_r,_g,_b,_a);
};
/**
 * clears color and depth buffers
 * with r,g,b,a
 * @param {Number} r normalized red val.
 * @param {Number} g normalized green val.
 * @param {Number} b normalized blue val.
 * @param {Number} a normalized alpha val.
 */
p5.Renderer3D.prototype.clear = function() {
  var gl = this.GL;
  gl.clearColor(arguments[0],
    arguments[1],
    arguments[2],
    arguments[3]);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
};

/**
 * [translate description]
 * @param  {[type]} x [description]
 * @param  {[type]} y [description]
 * @param  {[type]} z [description]
 * @return {[type]}   [description]
 * @todo implement handle for components or vector as args
 */
p5.Renderer3D.prototype.translate = function(x, y, z) {
  //@TODO: figure out how to fit the resolution
  x = x / RESOLUTION;
  y = -y / RESOLUTION;
  z = z / RESOLUTION;
  this.uMVMatrix.translate([x,y,z]);
  return this;
};

/**
 * Scales the Model View Matrix by a vector
 * @param  {Number | p5.Vector | Array} x [description]
 * @param  {Number} [y] y-axis scalar
 * @param  {Number} [z] z-axis scalar
 * @return {this}   [description]
 */
p5.Renderer3D.prototype.scale = function(x,y,z) {
  this.uMVMatrix.scale([x,y,z]);
  return this;
};

/**
 * [rotate description]
 * @param  {Number} rad  angle in radians
 * @param  {p5.Vector | Array} axis axis to rotate around
 * @return {p5.Renderer3D}      [description]
 */
p5.Renderer3D.prototype.rotate = function(rad, axis){
  this.uMVMatrix.rotate(rad, axis);
  return this;
};

/**
 * [rotateX description]
 * @param  {Number} rad radians to rotate
 * @return {[type]}     [description]
 */
p5.Renderer3D.prototype.rotateX = function(rad) {
  this.uMVMatrix.rotateX(rad);
  return this;
};

/**
 * [rotateY description]
 * @param  {Number} rad rad radians to rotate
 * @return {[type]}     [description]
 */
p5.Renderer3D.prototype.rotateY = function(rad) {
  this.uMVMatrix.rotateY(rad);
  return this;
};

/**
 * [rotateZ description]
 * @param  {Number} rad rad radians to rotate
 * @return {[type]}     [description]
 */
p5.Renderer3D.prototype.rotateZ = function(rad) {
  this.uMVMatrix.rotateZ(rad);
  return this;
};

/**
 * pushes a copy of the model view matrix onto the
 * MV Matrix stack.
 * NOTE to self: could probably make this more readable
 * @return {[type]} [description]
 */
p5.Renderer3D.prototype.push = function() {
  uMVMatrixStack.push(this.uMVMatrix.copy());
};

/**
 * [pop description]
 * @return {[type]} [description]
 */
p5.Renderer3D.prototype.pop = function() {
  if (uMVMatrixStack.length === 0) {
    throw new Error('Invalid popMatrix!');
  }
  this.uMVMatrix = uMVMatrixStack.pop();
};

module.exports = p5.Renderer3D;