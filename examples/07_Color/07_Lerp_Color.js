/*
 * @name Lerp Color
 * @arialabel Four piles of triangles in random sizes: red, maroon, purple, and blue. The triangles move around within their pile to form different designs
 * @description Loop random shapes,
 * lerp color from red to blue.
 */
function setup() {
  createCanvas(720, 400);
  background(255);
  noStroke();
}

function draw() {
  background(255);
  var from = color(255, 0, 0, 0.2 * 255);
  var to = color(0, 0, 255, 0.2 * 255);
  var c1 = lerpColor(from, to, 0.33);
  var c2 = lerpColor(from, to, 0.66);
  for (let i = 0; i < 15; i++) {
    fill(from);
    quad(
      random(-40, 220), random(height),
      random(-40, 220), random(height),
      random(-40, 220), random(height),
      random(-40, 220), random(height)
    );
    fill(c1);
    quad(
      random(140, 380), random(height),
      random(140, 380), random(height),
      random(140, 380), random(height),
      random(140, 380), random(height)
    );
    fill(c2);
    quad(
      random(320, 580), random(height),
      random(320, 580), random(height),
      random(320, 580), random(height),
      random(320, 580), random(height)
    );
    fill(to);
    quad(
      random(500, 760), random(height),
      random(500, 760), random(height),
      random(500, 760), random(height),
      random(500, 760), random(height)
    );
  }
  frameRate(5);
}
