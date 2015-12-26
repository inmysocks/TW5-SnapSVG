/*\
title: $:/widgets/inmysocks/SnapWidget.js
type: application/javascript
module-type: widget

A widget for using snap.svg in tiddlywiki

\*/
(function(){

/*jslint node: true, browser: true */
/*global $tw: false */
"use strict";

var Widget = require("$:/core/modules/widgets/widget.js").widget;

var SnapWidget = function(parseTreeNode,options) {
	this.initialise(parseTreeNode,options);
};

/*
Inherit from the base widget class
*/
SnapWidget.prototype = new Widget();

/*
Render this widget into the DOM
*/
SnapWidget.prototype.render = function(parent,nextSibling) {
	this.parentDomNode = parent;
	this.computeAttributes();
	var domNode = this.document.createElementNS("http://www.w3.org/2000/svg","svg");
	parent.insertBefore(domNode,nextSibling);
    this.domNodes.push(domNode);
	this.SVGSurface = this.getAttribute("surface");
	domNode.id = this.SVGSurface;
	if (this.SVGSurface) {
		this.execute();
	}
};

/*
Compute the internal state of the widget
*/
SnapWidget.prototype.execute = function() {
	//Initialize variables
	var filter,
		objects;
	this.SVGObjects = {};

	//Get widget attributes
	this.type = this.getAttribute("type","");
	this.timeLine = this.getAttribute("timeline");
	this.currentTiddler = this.getAttribute("tiddler",this.getVariable("currentTiddler"));

	//Make sure that there is a SVGSurface name.
	if (this.SVGSurface) {
		var tiddler = this.wiki.getTiddler(this.SVGSurface);

		//Make sure that the surface tiddler exists.
		if (tiddler) {

			//Create the snap object.
			this.SVG = Snap("#" + this.SVGSurface);

			//If the surface exists start making the image.
			if (this.SVG) {
				//Clear the surface and set the size.
				this.SVG.clear();
				this.SVG.attr({height:tiddler.fields.height,width:tiddler.fields.width});

				//This is needed for some of the functions.
				var self = this;

				//As long as the timeline flag isn't set than add all objects to the image.
				if (this.timeLine !== "true") {
					//Create a filter to get the list of objects and then get the tiddlers.
					filter = '[tag[SVG Element]tag[' + this.SVGSurface + ']][object_type[Group]image[' + this.SVGSurface + ']]+[sort[order]]';
					objects = $tw.wiki.filterTiddlers(filter);

					//Add the objects in order. Objects are elements and groups.
					for (var i = 0; i < objects.length; i++) {
						this.addObject(this.wiki.getTiddler(objects[i]));
					}
				}

				//If creating a polygon this function makes that work.
				var addTiddler = this.wiki.getTiddler("$:/state/Add Thing");
				if (addTiddler) {
					if (addTiddler.fields.add_thing === 'polygon') {
						this.addPolygon(addTiddler.fields.image);
					}
				}

				//Add (double) click events to objects
				var eventFilter = '[tag[Action]action_type[Click Event]][tag[Action]action_type[Double Click Event]]';
				var events = $tw.wiki.filterTiddlers(eventFilter);
				for (var i = 0; i < events.length; i++) {
					//this.addClickEvent(this.wiki.getTiddler(events[i]));
					this.action(this.wiki.getTiddler(events[i]));
				}

				//This lets you edit polygons
				var polygonEditStateTiddler = this.wiki.getTiddler("$:/state/EditPolygon");
				if (polygonEditStateTiddler) {
					this.polygonEdit(polygonEditStateTiddler);
				}

				//This takes care of animations.
				if (this.type === "animation") {
					//If the animation is set to play than start the actions.
					if (tiddler.fields.play === "true" && this.timeLine !== "true") {
						this.startActions();
					}

					//If it is set as a timeline than make the timeline.
					//This may be broken.
					if (this.timeLine === "true") {
						this.makeTimeLine();
					}

					//This animates things
					//Marks, cues and actions will need to be added at some point.
					//Cues will be events that trigger actions. 
					//	Can we somehow have a timer? Because having one to set cues would be good. - This may require a startup module to work.
					//	We would want to keep how we have it now, where an animation is triggered by the previous animation. 
					//	But then we also want to have things like hovering the mouse, clicking, etc. to be able to act as cues.
					//		I think that for most of this the hover, click, etc. would set a value in a tiddler that then turns on an animation or whatever.

					//Actions would be things like adding or removing an object, starting or stopping an animation or doing something to modify the tiddler store in response to some event. I think that an exaustive list would be: add object, remove object, create group, break group, transform an object, modify tiddler store (write to a tiddler field). The last one would let actions set cues and lots of other things.
					//Marks will be a description of the state of the surface/animation that can be used to (re)set the surface state. So for my demo animation the first mark would be the state at the start of the animation, the second mark could be after the boat lands and the water is gone, the third mark would be after whatever happens next. Then you could start the animation at any of those marks. We need to figure out how we are going to describe these in a tiddler. We need a way to get the current state of an object from inside the wiki so we can store the transformation in a data tiddler. Something like 'object tiddler: transform string' where all objects that are currently on the surface would be listed. Objects that aren't transformed from their original state would just have an empty transform.
					//We may need to allow marks to be an incomplete description of a surface so that it doesn't need to include everything together, but we may be able to get the desired results through the creative use of groups.
					//A combination of cues and marks could allow looping animations since the way we have it set now breaks everything.
				}
			}
		}
	}
};

/*
This starts the ainmation by initiating all actions that should start when the animation starts.
	This doesn't take any inputs.
	Every tiddler tagged with both Action and the current svg surface is passed as the argument to the function this.action, the argument passed is the tiddler object, not just the title.
*/
SnapWidget.prototype.startActions = function () {
	//Filter to find all the actions and then iterate through them and execute them. When executing an action we need to check to make sure that it is supposed to execute at that time.
	//Create the filter to get the list of actions.
	var actionFilter = '[tag[Action]tag[' + this.SVGSurface + ']]';

	//Get the list of action tiddlers.
	var actionTiddlers = $tw.wiki.filterTiddlers(actionFilter);

	//Iterate through each action tiddler and execute each one.
	for (var i = 0; i < actionTiddlers.length; i++) {
		var actionTiddler = this.wiki.getTiddler(actionTiddlers[i]);

		//Check to make sure that the conditions for starting the action have been met.
		if (actionTiddler) {
			this.action(actionTiddler);
		}
	}
};

/*
This takes a tiddler describing a generic action and performs the action described.
	This function takes a tiddler object as input
	It can optionally take a second input 'enable', this input is only used for playign animations, see the animation function for details
*/
SnapWidget.prototype.action = function (tiddler, enable) {
	if (tiddler) {
		//Check which action type and execute the corresponding function for tha taction type.
		switch (tiddler.fields.action_type) {
			case "Add Object":
				this.addObject(this.wiki.getTiddler(tiddler.fields.action_tiddler));
				break;
			case "Remove Object":
				this.removeObject(tiddler);
				break;
			case "Animation":
				this.animate(tiddler.fields.action_tiddler, undefined, enable);
				break;
			case "Write":
				this.writeField(tiddler);
				break;
			case "Click Event":
				this.addClickEvent(tiddler);
				break;
			case "Add Click Event":
				this.addClickEvent(tiddler);
				break;
			case "Remove Click Event":
				this.removeClickEvent(tiddler);
				break;
			case "Batch":
				this.executeBatchActions(tiddler);
				break;
			/*
			case "Hover Event":
				this.addHoverEvent(tiddler);
				break;
			case "Remove Hover Event":
				this.removeHoverEvent(tiddler);
				break;
			*/
			case "Double Click Event":
				this.addDoubleClickEvent(tiddler);
				break;
			case "Add Double Click Event":
				this.addDoubleClickEvent(tiddler);
				break;
			case "Remove Double Click Event":
				this.removeDoubleClickEvent(tiddler);
				break;
			case "Button":
				this.button(tiddler);
				break;
		}
	}
};

/*
This makes the button actions work. Button actions take the text field of a tiddler and evaluates it as though it were inside a button widget that was clicked.
*/
SnapWidget.prototype.button = function (tiddler) {
	var actionText = tiddler.fields.text;
	var parsed;
	var widgets;
	var container;
	var stringPassed;

	stringPassed = "<$importvariables filter='[[$:/core/ui/PageMacros]] [all[shadows+tiddlers]tag[$:/tags/Macro]!has[draft.of]]'>"+actionText+"</$importvariables>";
	parsed = $tw.wiki.parseText("text/vnd.tiddlywiki", stringPassed, {});
	widgets = $tw.wiki.makeWidget(parsed, {parentWidget:$tw.rootWidget});
	container = $tw.fakeDocument.createElement("div");
	widgets.setVariable("currentTiddler", tiddler.fields.title);
	widgets.render(container, null);
	widgets.invokeActions({});
};

/*
This takes a list of actions and executes each one in order.
	This function takes a tiddler object as input
	
	The input is a tiddler object for a data tiddler, each index of the data tiddler is the name of a tiddler defining an action
	Each of these tiddlers are passed to the action function in sequence.
*/
SnapWidget.prototype.executeBatchActions = function (tiddler) {
	var batchActionsFilter = '[[' + tiddler.fields.title + ']indexes[]]';
	var batchActionsList = $tw.wiki.filterTiddlers(batchActionsFilter);
	for (var i = 0; i < batchActionsList.length; i++) {
		this.action(this.wiki.getTiddler(batchActionsList[i]),"true");
	}
};

/*
This adds a click event to an object
*/
SnapWidget.prototype.addClickEvent = function (tiddler) {
	var self = this;
	var targetAction = this.wiki.getTiddler(tiddler.fields.action_tiddler);
	if (tiddler) {
		if (this.SVGObjects[tiddler.fields.target_object]) {
			this.SVGObjects[tiddler.fields.target_object].click(function () {self.action(targetAction, "true");});
		}
	}
};

/*
This removes a click event from an object.
*/
SnapWidget.prototype.removeClickEvent = function (tiddler) {
	var self = this;
	var targetAction = this.wiki.getTiddler(tiddler.fields.action_tiddler);
	if (tiddler) {
		if (this.SVGObjects[tiddler.fields.target_object]) {
			this.SVGObjects[tiddler.fields.target_object].unclick(function () {self.action(targetAction, "true");});
		}
	}
};

/*
This adds a double click event to an object
*/
SnapWidget.prototype.addDoubleClickEvent = function (tiddler) {
	var self = this;
	var targetAction = this.wiki.getTiddler(tiddler.fields.action_tiddler);
	if (tiddler) {
		if (this.SVGObjects[tiddler.fields.target_object]) {
			this.SVGObjects[tiddler.fields.target_object].dblclick(function () {self.action(targetAction, "true");});
		}
	}
};

/*
This removes a double click event from an object.
*/
SnapWidget.prototype.removeDoubleClickEvent = function (tiddler) {
	var self = this;
	var targetAction = this.wiki.getTiddler(tiddler.fields.action_tiddler);
	if (tiddler) {
		if (this.SVGObjects[tiddler.fields.target_object]) {
			this.SVGObjects[tiddler.fields.target_object].undblclick(function () {self.action(targetAction, "true");});
		}
	}
};


/*
This function adds an object to the SVG surface.
*/
SnapWidget.prototype.addObject = function (tiddler) {
	if (tiddler.fields.object_type === "Element") {
		//Only add an element if it isn't already on the surface.
		if (this.SVGObjects[tiddler.fields.object_name] === undefined) {
			switch(tiddler.fields.element_type) {
				case "rect":
					this.SVGObjects[tiddler.fields.object_name] = this.SVG.rect(tiddler.fields.x_position,tiddler.fields.y_position,tiddler.fields.width,tiddler.fields.height);
					break;
				case "circle":
					this.SVGObjects[tiddler.fields.object_name] = this.SVG.circle(tiddler.fields.x_position, tiddler.fields.y_position, tiddler.fields.circle_radius);
					break;
				case "ellipse":
					this.SVGObjects[tiddler.fields.object_name] = this.SVG.ellipse(tiddler.fields.x_position,tiddler.fields.y_position,tiddler.fields.x_radius,tiddler.fields.y_radius);
					break;
				case "line":
					this.SVGObjects[tiddler.fields.object_name] = this.SVG.line(tiddler.fields.x_1,tiddler.fields.y_1,tiddler.fields.x_2,tiddler.fields.y_2);
					break;
				case "polygon":
					this.SVGObjects[tiddler.fields.object_name] = this.SVG.polygon(tiddler.fields.points);
					break;
				case "image":
					this.SVGObjects[tiddler.fields.object_name] = this.SVG.image(tiddler.fields.source, tiddler.fields.x_position, tiddler.fields.y_position, tiddler.fields.width, tiddler.fields.height);
					break;
				case "text":
					this.SVGObjects[tiddler.fields.object_name] = this.SVG.text(tiddler.fields.x_position, tiddler.fields.y_position, tiddler.fields.text);
					break;
				case "tiddler":
					var imageTiddler = this.wiki.getTiddler(tiddler.fields.image_tiddler);
					if (imageTiddler) {
						var fragment = Snap.fragment(imageTiddler.fields.text);
						this.SVGObjects[tiddler.fields.object_name] = this.SVG.el("g");
						this.SVGObjects[tiddler.fields.object_name].append(fragment.node.children[0]);
					}
					break;
			}
		}
	} else if (tiddler.fields.object_type === "Group") {
		var groupElementFilter = '[[' + tiddler.fields.title + ']tags[]sort[order]]';
		var groupElements = $tw.wiki.filterTiddlers(groupElementFilter);
		this.SVGObjects[tiddler.fields.object_name] = this.SVG.g();
		for (var i = 0; i < groupElements.length; i++) {
			if (this.wiki.getTiddler(groupElements[i])) {
				//If the element to be added isn't already on the surface than add it.
				if (this.SVGObjects[this.wiki.getTiddler(groupElements[i])] === undefined) {
					this.addObject(this.wiki.getTiddler(groupElements[i]));
				}
				this.SVGObjects[tiddler.fields.object_name].add(this.SVGObjects[this.wiki.getTiddler(groupElements[i]).fields.object_name]);
			}
		}
	}
	if (tiddler.fields.object_type) {
		this.objectTransforms(tiddler);
	}
	if (tiddler.fields.class) {
		this.addClass(tiddler);
	}
};

SnapWidget.prototype.addClass = function (tiddler) {
	if (this.SVGObjects[tiddler.fields.object_name]) {
		this.SVGObjects[tiddler.fields.object_name].addClass(tiddler.fields.class);
	}
}

/*
This is a function that applies the defined transforms to an SVG object (groups or elements).
*/
SnapWidget.prototype.objectTransforms = function (tiddler) {
	if (this.SVGObjects[tiddler.fields.object_name]) {
		var object;
		//This transform string applies all of the transforms done only to this object, like translations from dragging the object
		var transformString = "";
		if (tiddler.fields.xc && tiddler.fields.yc) {
			transformString += "t" + tiddler.fields.xc + "," + tiddler.fields.yc;
		}
		if (tiddler.fields.rotation) {
			transformString += "r" + tiddler.fields.rotation;
		}
		if (tiddler.fields.scale) {
			transformString += "s" + tiddler.fields.scale;
		}
		//These are the object attributes set in the object definition tiddler
		var objectAttributes = {};
		if (tiddler.fields.fill_color) {
			objectAttributes['fill'] = tiddler.fields.fill_color;
		}
		if (tiddler.fields.stroke_color) {
			objectAttributes['stroke'] = tiddler.fields.stroke_color;
		}
		if (tiddler.fields.stroke_width) {
			objectAttributes['strokeWidth'] = tiddler.fields.stroke_width;
		}
		if (tiddler.fields.fill_opacity) {
			objectAttributes['fill-opacity'] = Number(tiddler.fields.fill_opacity);
		}
		if (tiddler.fields.width) {
			objectAttributes['width'] = tiddler.fields.width;
		}
		if (tiddler.fields.height) {
			objectAttributes['height'] = tiddler.fields.height;
		}
		if (tiddler.fields.style) {
			objectAttributes['style'] = tiddler.fields.style;
		}
		objectAttributes['transform'] = transformString;
		this.SVGObjects[tiddler.fields.object_name].attr(objectAttributes);
		var transformMatrix = this.makeTransformMatrix(tiddler);
		//This adds the transform to the current state of the object
		if (transformMatrix) {
			var globalTransform = this.SVGObjects[tiddler.fields.object_name].transform();
			this.SVGObjects[tiddler.fields.object_name].transform({transform: globalTransform.globalMatrix.add(transformMatrix)});
		}
		object = this.SVGObjects[tiddler.fields.object_name];
		if (tiddler.fields.dragable === "true" && object) {
			this.objectDrag(tiddler, object);
		}
	}
};

/*
This function builds a transform matrix from the definition in a tiddler
*/
SnapWidget.prototype.makeTransformMatrix = function(tiddler) {
	if (tiddler.fields) {

	} else {
		tiddler = this.wiki.getTiddler(tiddler);
	}
	if (tiddler.fields.transform) {
		var transform_tiddler = this.wiki.getTiddler(tiddler.fields.transform);
		//Create an empty matrix
		if (transform_tiddler) {
			var transformMatrix = Snap.matrix(1,0,0,1,0,0);
			//Normal scaling
			if (transform_tiddler.fields.scale) {
				transformMatrix.scale(transform_tiddler.fields.scale);
			}
			var ElementBBox = this.SVGObjects[tiddler.fields.object_name].getBBox();
			var globalTransform = this.SVGObjects[tiddler.fields.object_name].transform();
			var initial_x = globalTransform.globalMatrix.invert().x(ElementBBox.cx,ElementBBox.cy);
			var initial_y = globalTransform.globalMatrix.invert().y(ElementBBox.cx,ElementBBox.cy);
			//This can scale x and y differently and set the center of the scaling
			var scale_x, scale_y, scale_x0, scale_y0;
			scale_x = transform_tiddler.fields.scale_x ? transform_tiddler.fields.scale_x:1;
			scale_y = transform_tiddler.fields.scale_y ? transform_tiddler.fields.scale_y:1;
			scale_x0 = transform_tiddler.fields.scale_x0 ? Number(transform_tiddler.fields.scale_x0)+initial_x:initial_x;
			scale_y0 = transform_tiddler.fields.scale_y0 ? Number(transform_tiddler.fields.scale_y0)+initial_y:initial_y;
			transformMatrix.scale(scale_x, scale_y, scale_x0, scale_y0);
			//This takes care of translation
			var translate_x, translate_y;
			translate_x = transform_tiddler.fields.translate_x ? Number(transform_tiddler.fields.translate_x):0;
			translate_y = transform_tiddler.fields.translate_y ? Number(transform_tiddler.fields.translate_y):0;
			transformMatrix.translate(translate_x,translate_y);
			//This takes care of rotation
			var rotate_angle, rotate_center_x, rotate_center_y;
			rotate_angle = transform_tiddler.fields.rotate_angle ? transform_tiddler.fields.rotate_angle:0;
			rotate_center_x = transform_tiddler.fields.rotate_center_x ? Number(transform_tiddler.fields.rotate_center_x)+initial_x:initial_x;
			rotate_center_y = transform_tiddler.fields.rotate_center_y ? Number(transform_tiddler.fields.rotate_center_y)+initial_y:initial_y;
			transformMatrix.rotate(rotate_angle, rotate_center_x, rotate_center_y);
			
			return transformMatrix;
		}
	} else {
		return false;
	}
};

/*
This function adds the appropriate drag function to dragable objects.
*/
SnapWidget.prototype.objectDrag = function (tiddler, object) {
	var drag_dx, drag_dy;
	var self = this;
	object.drag(
		function (dx,dy,x,y,e) {
		drag_dx = dx;
		drag_dy = dy;
		var transformString = "t" + Number(tiddler.fields.xc+dx) + "," + Number(tiddler.fields.yc+dy) + "r" + tiddler.fields.rotation + "s" + tiddler.fields.scale;
		object.attr({transform: transformString});
		}, 
		function (x,y,event) {

		},
		function (event) { 
			if (drag_dx && drag_dy) {
				$tw.wiki.setText(tiddler.fields.title, "xc", undefined, Number(tiddler.fields.xc)+drag_dx);
				$tw.wiki.setText(tiddler.fields.title, "yc", undefined, Number(tiddler.fields.yc)+drag_dy); 
				self.refreshSelf();
			}
		} 
	);
};

/*
Remove an object from the surface.
*/
SnapWidget.prototype.removeObject = function (tiddler) {
	var actionTiddler = this.wiki.getTiddler(tiddler.fields.action_tiddler);
	if (this.SVGObjects[actionTiddler.fields.object_name]) {
		this.SVGObjects[actionTiddler.fields.object_name].remove();
	}
}

/*
This is needed to let you string animations together.
*/
SnapWidget.prototype.animate = function (tiddler, triggeringAnimation, enable) {
	if (triggeringAnimation) {
		//This prevents the same animation from playing multiple times
		$tw.wiki.setText(triggeringAnimation, "finished", undefined, "true");
	}
	var animationTiddler = this.wiki.getTiddler(tiddler);
	var animationString = '';
	var animationParameters = {};
	if (animationTiddler) {
		if(animationTiddler.fields.enabled === "true" || enable === "true") {
			if (animationTiddler.fields.transform) {
				var globalTransform = this.SVGObjects[animationTiddler.fields.object_name].transform();
				var transformMatrix = this.makeTransformMatrix(animationTiddler);
				if (transformMatrix) {
					if (animationTiddler.fields.invert === "true") {
						transformMatrix = transformMatrix.invert();
						$tw.wiki.setText(animationTiddler.fields.title, 'invert', undefined, 'false');
					} else {
						$tw.wiki.setText(animationTiddler.fields.title, 'invert', undefined, 'true');
					}
					animationParameters['transform'] = globalTransform.globalMatrix.add(transformMatrix);
					this.SVGObjects[animationTiddler.fields.object_name].animate(animationParameters, Number(animationTiddler.fields.duration));
				}

			} else {
				if (animationTiddler.fields.target_location) {
					animationString = animationString + "t" + animationTiddler.fields.target_location;
				}
				if (animationTiddler.fields.rotation) {
					animationString = animationString + "r" + animationTiddler.fields.rotation;
				}
				if (animationTiddler.fields.scale) {
					animationString = animationString + "s" + animationTiddler.fields.scale;
				}
				if (animationString) {
					animationParameters['transform'] = animationString;
				}
				if (animationTiddler.fields.fill_color) {
					animationParameters['fill'] = animationTiddler.fields.fill_color;
				}
				if (animationTiddler.fields.fill_opacity) {
					animationParameters['fillOpacity'] = animationTiddler.fields.fill_opacity;
				}
				if (animationTiddler.fields.stroke_color) {
					animationParameters['stroke_color'] = animationTiddler.fields.stroke_color;
				}
				if (animationTiddler.fields.stroke_width) {
					animationParameters['strokeWidth'] = animationTiddler.fields.stroke_width;
				}
				var duration;
				if (animationTiddler.fields.finished === "true") {
					duration = 0;
				} else {
					duration = Number(animationTiddler.fields.duration);
				}
				if (animationTiddler.fields.effect !== '') {
					if (this.SVGObjects[animationTiddler.fields.object_name]) {
						this.SVGObjects[animationTiddler.fields.object_name].animate(animationParameters, duration, mina[animationTiddler.fields.effect], this.animate.bind(this, animationTiddler.fields.next, animationTiddler.fields.title));
					}
				} else {
					if (this.SVGObjects[animationTiddler.fields.object_name]) {
						this.SVGObjects[animationTiddler.fields.object_name].animate(animationParameters, duration, mina.linear, this.animate.bind(this, animationTiddler.fields.next, animationTiddler.fields.title));
					}
				}
			}
		}
	}
};

/*
This function writes a value to a field based on paramaters stored in a tiddler.
*/
SnapWidget.prototype.writeField = function (tiddler) {
	$tw.wiki.setText(tiddler.fields.target_tiddler, tiddler.fields.target_field, undefined, tiddler.fields.target_value);
};

/*
This function takes care of the various parts of adding a polygon like finding the location of mouse clicks to set points.
*/
SnapWidget.prototype.addPolygon = function (SVGSurfaceName) {
	var self = this;
	var newX, newY, newPoint, newPointIndex;
	var tiddler = this.wiki.getTiddler("$:/state/Add Thing");
	var filter = '[[$:/state/Add Thing]list[$:/state/Add Thing!!points]]';
	var points = $tw.wiki.filterTiddlers(filter);
	var newPoints = [];
	if (SVGSurfaceName) {
		if ((this.SVG.node.id === SVGSurfaceName) && document.getElementById(SVGSurfaceName)) {
			for (var i = 0; i < points.length; i++) {
				//This checks to see if you are editing the current point, if so it replaces the old point with the new one temporarily so you can see the edit before saving it.
				//If you are adding a new point it just adds the temporary point to the end of the list.
				if (points[i] === tiddler.fields.edit_point) {
					newPointIndex = i;
					this.SVG.click(
			    		function(e, newX, newY) {
			    			newX = e.clientX-document.getElementById(SVGSurfaceName).getBoundingClientRect().x;
			    			newY = e.clientY-document.getElementById(SVGSurfaceName).getBoundingClientRect().y;
		          			$tw.wiki.setText("$:/state/Add Thing", "new_point_location", undefined, newX + "," + newY);
		          			self.refreshSelf();
			      		}
			  		);
			  		newPoints.push(tiddler.getFieldString("new_point_location"));
					newPoint = tiddler.getFieldString("new_point_location").split(",");
			  	} else {
			  		newPoints.push(points[i]);
			  		var thisPoint = points[i].split(",");
			  	}
			}
			//This draws the polygon using the new points
			this.SVG.polygon(newPoints).attr({fill:"none", stroke:"#f00"});
			//If a point is being edited this finds the location of a mouse click and stores it in the wiki
			if (tiddler.fields.new_point === "true") {
				this.SVG.click(
		    		function(e, newX, newY) {
		    			newX = e.clientX-document.getElementById(SVGSurfaceName).getBoundingClientRect().x;
		    			newY = e.clientY-document.getElementById(SVGSurfaceName).getBoundingClientRect().y;
		      			$tw.wiki.setText("$:/state/Add Thing", "new_point_location", undefined, newX + "," + newY);
		      			self.refreshSelf();
		      		}
		  		);
		  		var newPoint = tiddler.getFieldString("new_point_location").split(",");
		  		//this puts an x in the location of the new point.
				this.SVG.text(Number(newPoint[0]),Number(newPoint[1]),"x").attr({fill:"#00f"});
			}
			//Number each point of the polygon on the image, if you are editing a point than that number is a different color.
			for (var i = 0; i < points.length; i++) {
				if ( i === newPointIndex) {
					thisPoint = tiddler.getFieldString("new_point_location").split(",");
					this.SVG.text(thisPoint[0],thisPoint[1],i+1).attr({fill:"#0f0"});
				} else {
					var thisPoint = points[i].split(",");
					this.SVG.text(thisPoint[0],thisPoint[1],i+1).attr({fill:"#f00"});
				}
			}
		}
	}
};

/*
*	This is the function that lets you edit polygons.
*/
SnapWidget.prototype.polygonEdit = function (polygonEditStateTiddler) {
	if (polygonEditStateTiddler.fields.editing === "true") {
		var polygonTiddler = this.wiki.getTiddler(polygonEditStateTiddler.fields.tiddler);
		if (polygonTiddler) {
			var SVGSurfaceName = polygonTiddler.fields.edit_surface;
			if (SVGSurfaceName && document.getElementById(SVGSurfaceName)) {
				this.addPolygon(SVGSurfaceName);
				var newX, newY;
				this.SVG.click(
		    		function(e, newX, newY) {
		    			newX = e.clientX-document.getElementById(SVGSurfaceName).getBoundingClientRect().x;
		    			newY = e.clientY-document.getElementById(SVGSurfaceName).getBoundingClientRect().y;
	          			$tw.wiki.setText(polygonTiddler.fields.title, "new_point_location", undefined, newX + "," + newY);
	          			self.refreshSelf();
		      		}
		  		);
		  	}
		}
	}
}

/*
This is the main function used to create a timeline for the animations.
*/
SnapWidget.prototype.makeTimeLine = function() {
	this.SVGObjects["timeline"] = {};
	this.timeLineEnd = 0;
	var animationFilter = "[tag[Animation]image[" + this.SVGSurface + "]sort[order]!callback[true]]";
	var animations = $tw.wiki.filterTiddlers(animationFilter);
	for (var i = 0; i < animations.length; i++) {
		this.addToTimeLine(animations[i], 0, i);
	}
	this.SVG.attr({height:(40+20)*animations.length+25,width:this.timeLineEnd});
	this.SVG.text(5,(40+20)*animations.length+25,"Seconds");
	for (var i = 0; i < this.timeLineEnd/100+2; i++) {
		this.SVG.text(100*i,(40+20)*animations.length+25,i);
		this.SVG.line(100*i,0,100*i,(40+20)*animations.length+25).attr({stroke:"#555",strokeWidth:1});
	}
};

/*
This is the function used to recursively add each new element to the timeline.
*/
SnapWidget.prototype.addToTimeLine = function (tiddler, currentTime, currentRow) {
	var thisScale = 0.1;
	var rowHeight = 40;
	var currentAnimation = this.wiki.getTiddler(tiddler);
	if (currentAnimation) {
		if (this.currentTiddler.fields) {
			if (this.currentTiddler.fields.scale) {
				thisScale = this.currentTiddler.fields.scale;
			}
		}
		this.SVGObjects["timeline"][currentAnimation.fields.animation_name] = this.SVG.rect(currentTime, (rowHeight+20)*(currentRow)+20, currentAnimation.fields.duration*thisScale, rowHeight).attr({fill:"#202", stroke:"#a22", strokeWidth:3});
		this.SVGObjects["timeline"][currentAnimation.fields.animation_name].text = this.SVG.text(currentTime+5, (rowHeight+20)*(currentRow)+20-5, currentAnimation.fields.animation_name);
		if (this.timeLineEnd < currentTime+currentAnimation.fields.duration) {
			this.timeLineEnd = currentTime+currentAnimation.fields.duration*thisScale;
		}
		this.addToTimeLine(currentAnimation.fields.next, currentTime+currentAnimation.fields.duration*thisScale, currentRow);
	}
};

/*
Selectively refreshes the widget if needed. Returns true if the widget or any of its children needed re-rendering
*/
SnapWidget.prototype.refresh = function(changedTiddlers) {
	var tiddler = this.wiki.getTiddler(this.SVGSurface);
	if (tiddler) {
		if ((tiddler.fields.play === "true") && (tiddler.fields.refresh === "true")) {
			this.refreshSelf();
			$tw.wiki.setText(tiddler.fields.title, "refresh", undefined, "false");
		} else {
			var filter = '[tag[SVG Element]tag[' + this.SVGSurface + ']][object_type[Group]tag[' + this.SVGSurface + ']]';
			var elements = $tw.wiki.filterTiddlers(filter);
			var changedAttributes = this.computeAttributes();
			if((Object.keys(changedAttributes).length) || changedTiddlers[this.SVGSurface]) {
				this.refreshSelf();
			}
			for (var i = 0; i < elements.length; i++) {
				if (changedTiddlers[elements[i]]) {
					this.refreshSelf();
				}
			}
		}
	}
};

exports["snap-widget"] = SnapWidget;

})();
