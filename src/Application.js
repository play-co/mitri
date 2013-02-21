import ui.ImageView as ImageView;
import ui.TextView as TextView;
import ui.View as View;
import animate;
import src.lib.ViewPool as ViewPool;
import math.random;
import device;

exports = Class(GC.Application, function () {
	var IMAGE_WALL = "resources/images/wall.png";
	var IMAGE_TRI = "resources/images/tri.png";
	var IMAGE_GND = "resources/images/gnd.png";
	var Z_WALL = 5;
	var Z_TRI = 10;
	var Z_GND = 2;
	var WIDTH = 640; // Screen width in world units
	var MT_WIDTH = 640;
	var MT_HEIGHT = 480;
	var ORG_LEN = 10;

	this.wallPool = new ViewPool({
		ctor: ImageView,
		initCount: 10,
		initOpts: {
			parent: this.gameView,
			x: 0,
			y: 0,
			width: 1,
			height: 1,
			image: IMAGE_WALL,
			zIndex: Z_WALL
		}
	});

	this.genHolds = function(x, y) {
		var rng = new math.random.RNG(x * 1993 + y);

		// TODO: Vary difficulty
		var holdCount = 10;
		var holdLenMin = 10;
		var holdLenMax = 20;

		var holds = [];

		for (var ii = 0; ii < holdCount; ++ii) {
			var found, x, y, r, s;
			do {
				x = rng.uint32() % MT_WIDTH;
				y = rng.uint32() % MT_HEIGHT;
				r = rng.rangeReal(-Math.PI/2, Math.PI/2);
				s = rng.rangeReal(holdLenMin, holdLenMax);

				found = false;
				for (var jj = 0, hlen = holds.length; jj < hlen; ++jj) {
					var dx = holds[jj].x - x;
					var dy = holds[jj].y - y;
					var ss = (holds[jj].s + s) / 2;

					if (dx * dx + dy * dy < ss * ss) {
						found = true;
						break;
					}
				}
			} while (found);

			holds.push({
				x: x,
				y: y,
				r: r,
				s: s
			});
		}

		return holds;
	}

	// ground y = 0, 1 = next tile up, etc
	this.genTile = function(x, y) {
		var holds = this.genHolds(x, y);

		for (var ii = 0, hlen = holds.length; ii < hlen; ++ii) {
			var h = holds[ii];

			var opts = this.wallPool.obtainObject();

			opts.parentView = this.gameView;
			opts.wallMapX = x * MT_WIDTH + h.x;
			opts.wallMapY = y * MT_HEIGHT + h.y;
			opts.wallOffsetX = (data.dx - data.length) / 2;
			opts.wallOffsetY = data.dy / 2 - 2;
			opts.x = opts.wallOffsetX;
			opts.y = opts.wallOffsetY;
			opts.r = h.r;
			opts.anchorX = h.s / 2;
			opts.anchorY = 2;
			opts.width = h.s;
			opts.height = 4;
			opts.image = IMAGE_WALL;
			opts.zIndex = Z_WALL;

			return this.wallPool.obtainView(opts);
		}
	}

	this.genLine = function(x1, y1, x2, y2, img, z) {
		var opts = this.wallPool.obtainObject();

		var dx = x2 - x1, dy = y2 - y1;
		var length = Math.sqrt(dx * dx + dy * dy);

		var tox = x1 + (dx - length) / 2;
		var toy = y1 + dy / 2 - 2;

		opts.parentView = this.gameView;
		opts.x = tox;
		opts.y = toy;
		opts.r = dx
			? Math.atan(dy / dx)
			: -Math.PI / 2;
		opts.anchorX = length / 2;
		opts.anchorY = 2;
		opts.width = length;
		opts.height = 4;
		opts.image = img;
		opts.zIndex = z;

		var view = this.wallPool.obtainView(opts);

		view.tox = tox;
		view.toy = toy;

		return view;
	}

	this.moveTriLine = function(line) {
		line.style.x = this.px + this.dw/2 - this.cx + line.tox;
		line.style.y = this.py + this.dh/2 - this.cy + line.toy;
	}

	this.moveTri = function() {
		this.moveTriLine(this.tri.ul);
		this.moveTriLine(this.tri.ur);
		this.moveTriLine(this.tri.bt);
	}

	this.initTri = function() {
		var tx = 0, ty = -30;
		var lx = -45, ly = 30;
		var rx = 45, ry = 30;

		this.tri = {
			ul: this.genLine(tx, ty, lx, ly, IMAGE_TRI, Z_TRI),
			ur: this.genLine(tx, ty, rx, ry, IMAGE_TRI, Z_TRI),
			bt: this.genLine(lx, ly, rx, ry, IMAGE_TRI, Z_TRI)
		};
	}

	var animSpin = function(v) {
		animate(v)
			.now({dr: Math.PI*2}, 10000, animate.linear)
			.then(function() {
				animSpin(v);
			});
	}

	this.initOrigin = function() {
		this.origin = {
			right: this.genLine(-ORG_LEN, -ORG_LEN, ORG_LEN, ORG_LEN, IMAGE_GND, Z_GND),
			left: this.genLine(ORG_LEN, -ORG_LEN, -ORG_LEN, ORG_LEN, IMAGE_GND, Z_GND)
		}

		animSpin(this.origin.left);
		animSpin(this.origin.right);
	}

	this.initGnd = function() {
		this.ground = this.genLine(0, this.dh, this.dw, this.dh, IMAGE_GND, Z_GND);
	}

	// Center point of screen in world units
	this.cx = 0;
	this.cy = 0;

	// Player x,y coordinates in world units
	this.px = 0;
	this.py = 0;
	this.pvx = 0;
	this.pvy = 0;

	this.tick = function(dt) {
		// Shift camera
		var dcx = this.px - this.cx;
		if (Math.abs(dcx) > dt) {
			dcx = dcx > 0 ? dt : -dt;
		}
		var dcy = this.py - this.cy - this.dh/4;
		if (Math.abs(dcy) > dt) {
			dcy = dcy > 0 ? dt : -dt;
		}
		this.cx += dcx/10;
		this.cy += dcy/10;

		// Move player
		this.moveTri();

		var ox = this.dw/2 - this.cx;
		var oy = this.dh/2 - this.cy;

		// Move gorund
		this.ground.style.x = 0;
		this.ground.style.y = oy;

		// Move origin
		this.origin.left.style.x = ox + this.origin.left.tox;
		this.origin.left.style.y = oy + this.origin.left.toy;
		this.origin.right.style.x = ox + this.origin.right.tox;
		this.origin.right.style.y = oy + this.origin.right.toy;
	}

	this.hideMap = function(y) {
	}

	this.initMap = function() {
		this.dw = device.width;
		this.dh = device.height;

		this.scale = this.dw / WIDTH;
		this.sheight = this.dh / this.scale;

		this.initTri();
		this.initGnd();
		this.initOrigin();
	}

	this.initUI = function () {
		this.gameView = new View({
			superview: this.view,
			layout: "box",
			opacity: 0
		});

		this.initMap();

		var textview = new TextView({
			superview: this.view,
			layout: "box",
			text: "The Mighty Triangle",
			size: 42,
			color: "white",
			opacity: 0
		});

		animate(textview)
			.now({opacity: 1}, 3000)
			.then(bind(this, function() {
				this.cx = 0;
				this.cy = -150;

				animate(this.gameView)
					.now({opacity: 1}, 1000);
			}))
			.then({opacity: 0}, 4000)
			.then(bind(this, function() {
				textview.removeFromSuperview();
			}));
	};

	this.launchUI = function () {};
});
