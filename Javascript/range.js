/*\
title: $:/plugin/inmysocks/rangewidget/range.js
type: application/javascript
module-type: widget

Range widget

\*/
(function(){

/*jslint node: true, browser: true */
/*global $tw: false */
"use strict";

var Widget = require("$:/core/modules/widgets/widget.js").widget;

var RangeWidget = function(parseTreeNode,options) {
	this.initialise(parseTreeNode,options);
};

/*
Inherit from the base widget class
*/
RangeWidget.prototype = new Widget();

/*
Render this widget into the DOM
*/
RangeWidget.prototype.render = function(parent,nextSibling) {
	// Save the parent dom node
	this.parentDomNode = parent;
	// Compute our attributes
	this.computeAttributes();
	// Execute our logic
	this.execute();
	// Create our elements
	this.labelDomNode = this.document.createElement("label");
	this.labelDomNode.setAttribute("class",this.rangeClass);
	this.inputDomNode = this.document.createElement("input");
	this.inputDomNode.setAttribute("type","range");
	this.inputDomNode.min = this.rangeMin;
	this.inputDomNode.max = this.rangeMax;
	this.inputDomNode.step = this.rangeStep;
	this.inputDomNode.value = this.getValue();
/*	if(this.getValue()) {
		this.inputDomNode.setAttribute("checked","true");
	}
*/
	this.labelDomNode.appendChild(this.inputDomNode);
	this.spanDomNode = this.document.createElement("span");
	this.labelDomNode.appendChild(this.spanDomNode);
	// Add a click event handler
	$tw.utils.addEventListeners(this.inputDomNode,[
		{name: "change", handlerObject: this, handlerMethod: "handleChangeEvent"}
	]);
	// Insert the label into the DOM and render any children
	parent.insertBefore(this.labelDomNode,nextSibling);
	this.renderChildren(this.spanDomNode,null);
	this.domNodes.push(this.labelDomNode);
};

RangeWidget.prototype.getValue = function() {
	var tiddler = this.wiki.getTiddler(this.rangeTitle);
	if(tiddler) {
		if (this.rangeField) {
			return tiddler.getFieldString(this.rangeField);
		}
	}
	return 0;
};

RangeWidget.prototype.handleChangeEvent = function(event) {
/*	var checked = this.inputDomNode.checked,
		tiddler = this.wiki.getTiddler(this.rangeTitle),
		fallbackFields = {text: ""},
		newFields = {title: this.rangeTitle};
*/
	this.wiki.setText(this.rangeTitle,this.rangeField,this.rangeIndex,this.inputDomNode.value);
};

/*
Compute the internal state of the widget
*/
RangeWidget.prototype.execute = function() {
	// Get the parameters from the attributes
	this.rangeTitle = this.getAttribute("tiddler",this.getVariable("currentTiddler"));
	this.rangeField = this.getAttribute("field");
	this.rangeIndex = this.getAttribute("index");
	this.rangeDefault = this.getAttribute("default","0");
	this.rangeMin = this.getAttribute("min","0");
	this.rangeMax = this.getAttribute("max","100");
	this.rangeStep = this.getAttribute("step","1");
	this.rangeClass = this.getAttribute("class","");

	// Make the child widgets
	this.makeChildWidgets();
};

/*
Selectively refreshes the widget if needed. Returns true if the widget or any of its children needed re-rendering
*/
RangeWidget.prototype.refresh = function(changedTiddlers) {
	var changedAttributes = this.computeAttributes();
	if(changedAttributes.tiddler || changedAttributes.field || changedAttributes.index || changedAttributes.default || changedAttributes.class) {
		this.refreshSelf();
		return true;
	} else {
		var refreshed = false;
		if(changedTiddlers[this.rangeTitle]) {
			this.inputDomNode.value = this.getValue();
			refreshed = true;
		}
		return this.refreshChildren(changedTiddlers) || refreshed;
	}
};

exports.range = RangeWidget;

})();
