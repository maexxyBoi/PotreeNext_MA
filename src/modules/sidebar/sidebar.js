
import {Gradients, Utils} from "potree";
import {createAttributesPanel} from "./panel_attributes.js";
import {createMeasurementsPanel} from "./panel_measurements.js";
import {createPanel as createAppearancePanel} from "./panel_appearance.js";
import {createPanel as createInfosPanel} from "./panel_infos.js";
import {createPanel as createHoveredPanel} from "./panel_hovered.js";
import {createPanel as createScenePanel} from "./panel_scene.js";
import { Measure, sliceString, octreesString, ellipseString, integrateString } from "../../interaction/measure.js";
import { GaussianSplats, PointCloudOctree, Vector3, Box3 } from "../../Potree.js";
import { simpleOctree, simpleOctreeNode } from "../../potree/octree/simpleOctree.js";

let sidebar = null;
let dir = new URL(import.meta.url + "/../").href;
let sidebarWidth = "30em";

class Section{

	constructor(){
		this.icon = null;
		this.panel = null;
	}

}

let sections = [];
let activeSection = null;

function setActiveSection(section){

	if(!section){
		sidebar.elSectionContent.innerHTML = "";
	}else if(section === activeSection){
		toggle();
	}else{
		open();

		sidebar.elSectionContent.innerHTML = "";
		sidebar.elSectionContent.append(section.panel);
	}

	activeSection = section;
}

let isOpen = true;
function toggle(){
	if(isOpen){
		isOpen = false;
		sidebar.elContainer.style.gridTemplateColumns = "48px 1fr";
	}else{
		isOpen = true;
		sidebar.elContainer.style.gridTemplateColumns = `${sidebarWidth} 1fr`;
	}
}

function open(){
	if(!isOpen){
		isOpen = true;
		sidebar.elContainer.style.gridTemplateColumns = `${sidebarWidth} 1fr`;
	}
}

function onSectionSelect(section){

	setActiveSection(section);
}

function addSection(section){

	{
		let elButton = document.createElement("input");
		elButton.classList.add("potree_sidebar_section_button");
		elButton.type = "button";
		elButton.title = "Measure";
		elButton.style.backgroundImage = section.icon;

		elButton.addEventListener("click", () => {
			onSectionSelect(section);
		});

		sidebar.elSectionSelection.append(elButton);
	}


	sections.push(section);
}

function createMainSection(){

	let elPanel = document.createElement("span");

	elPanel.innerHTML = `
		<div id="attributes_panel">
			
		</div>
	`;

	let panel_appearance = createAppearancePanel();
	elPanel.append(panel_appearance.element);

	let panel_scene = createScenePanel();
	elPanel.append(panel_scene.element);

	let panel_infos = createInfosPanel();
	elPanel.append(panel_infos.element);

	let panel_hovered = createHoveredPanel();
	elPanel.append(panel_hovered.element);

	let section = new Section();
	section.icon = `url(${dir}/icons/home.svg)`;
	section.panel = elPanel;
	section.handler = panel_appearance;

	return section;
}

function createAttributesSection(){

	let elPanel = document.createElement("span");

	elPanel.innerHTML = `
		<div id="attributes_panel">
			
		</div>
	`;

	let panel_attributes = createAttributesPanel();
	elPanel.append(panel_attributes.element);

	let section = new Section();
	section.icon = `url(${dir}/icons/material.svg)`;
	section.panel = elPanel;
	section.handler = panel_attributes;

	return section;
}

function createMeasureSection(){

	let elPanel = document.createElement("span");

	elPanel.innerHTML = `
		<div id="attributes_panel">
			
		</div>
	`;

	let panel_measurements = createMeasurementsPanel();
	elPanel.append(panel_measurements.element);

	addClickListener(elPanel);

	let section = new Section();
	section.icon = `url(${dir}/icons/measure.svg)`;
	section.panel = elPanel;
	section.handler = panel_measurements;

	return section;
}

function addClickListener(elPanel){
	elPanel.addEventListener("click", (e) => {
		if(e.target && e.target.id === "innerCalc"){
			console.log("innerCalc clicked");

			let elBlock = e.target.closest("div");
			let elDropdown = elBlock.getElementsByTagName("select")
			let id = elBlock.dataset.measureid

			calculateInnerVolume(id, elDropdown)
		}
		if (e.target && e.target.id === "innerOption") {
			console.log("Dropdown changed");
		}
	}
	);
}


export async function installSidebar(elPotree, potree){

	let {css} = await import("./sidebar.css.js");

	let style = document.createElement('style');
	style.innerHTML = css;
	document.getElementsByTagName('head')[0].appendChild(style);

	let elSidebar = document.createElement("span");
	elSidebar.id = "potree_sidebar";
	elSidebar.style.display = "grid";
	elSidebar.style.gridTemplateColumns = "48px 1fr";

	elSidebar.innerHTML = `
		<span id="potree_sidebar_section_selection"></span>
		<span id="potree_sidebar_main" style="display: flex; flex-direction: column;">
			<span id="potree_sidebar_content"></span>
			<!--
			<span style="flex-grow: 100;"></span>
			<span id="potree_sidebar_footer">
				Potree ${Potree.version}<br>
				<a href="https://github.com/m-schuetz/Potree2" target="_blank">github</a>
			</span>
			-->
		</span>
	`;

	elPotree.style.display = "grid";
	elPotree.style.gridTemplateColumns = `${sidebarWidth} 1fr`;
	elPotree.prepend(elSidebar);

	let elSectionSelection = elSidebar.querySelector("#potree_sidebar_section_selection");
	let elSectionContent = elSidebar.querySelector("#potree_sidebar_content");

	let secMain = createMainSection(potree);
	let secMeasure = createMeasureSection();
	let secAttributes = createAttributesSection();

	sidebar = {
		elContainer: elPotree,
		potree, sections, secMeasure,
		elSidebar, elSectionSelection, elSectionContent,
		toggle, open, setActiveSection
	};

	addSection(secMain);
	addSection(secAttributes);
	addSection(secMeasure);

	setActiveSection(secAttributes);
	potree.sidebar = sidebar;
	return sidebar;
}


function calculateInnerVolume(id, elDropdown)
{
	let measures = potree.measure.measures
	let measure = measures[Number(id)]
	//absolut keine ahnung warum ich ne collection kriege,
	//aber das is n array :roll_eyes:
	let option = elDropdown[0].value
	console.log(option)

	let newBounds = calcBounds(measure)
	let pointClouds = potree.scene.root.children.filter((entry) => entry instanceof PointCloudOctree)
	let splats = potree.scene.root.children.filter((entry) => entry instanceof GaussianSplats)


	if (option === sliceString){
		console.log(sliceString)
		alphaSlicing(newBounds, pointClouds)
	}
	if (option === octreesString){
		console.log(octreesString)
		//test measure only for vis. purposes
		measure.measureOctBoxes = []
		octreeVolume(newBounds, pointClouds, measure)
	}
	if (option === ellipseString){
		console.log(ellipseString)
		ellipseVolume(newBounds, splats)
	}
	if (option === integrateString){
		console.log(integrateString)
		integrationVolume(newBounds, splats)
	}
}

function alphaSlicing(newBounds, pointClouds){

}
function octreeVolume(newBounds, pointClouds, measure){
	let results = {}
	let originalLeaves = []
	let secondTree = new simpleOctree();
	secondTree.setBounds(newBounds);
	pointClouds.forEach(element => {
		if(element.root) {
			results[element.name] = 0
			results[element.name+"orig"] = 0
			//recDrawingBBTest(newBounds, element.root)
			//for testing
			recGetLeavesForVol(newBounds, element.root, measure, originalLeaves, results)
			recCalcVol(secondTree.root, originalLeaves, measure, results)
		}
	});
	console.log(results)
}
function ellipseVolume(newBounds, splats){
	
}
function integrationVolume(newBounds, splats){
	
}

function calcBounds(measure) {
	//ok, da ich nachgeguckt habe: von der pos der measure aus
	//gehen die hälften der scale-werte als kantenlängen in die entsprechenden richtungen
	//sprich scale (1,2,3) und pos (0,0,0): von 0,0,0 gehen die kanten + und - .5 in x
	//+ und - 1 in y und + und - 1.5 in z

	let distance = measure.size.clone().divideScalar(2)

	let min = measure.markers[0].clone().sub( distance )
	let max = measure.markers[0].clone().add( distance )

	return new Box3(min, max)
	
}

function recGetLeavesForVol (newBounds, octreeNode, measure, originalLeaves, results) {
	let empty = octreeNode.children.every(element => 
		element == null
	);

	//empty nodes can obvsly be just empty as well
	//but if theyre inside the pc, they are leaves
	if(empty && octreeNode.boundingBox.intersectsBox(newBounds))
	{
		let dims = new Vector3(0,0,0)
		dims = octreeNode.boundingBox.getSize(dims) //idk
		let vol = Math.abs(dims.x) * Math.abs(dims.y) * Math.abs(dims.z)
		//test
		//potree.renderer.drawBox(octreeNode.boundingBox.min, dims.divideScalar(2), new Vector3(255,0,0))
		measure.measureOctBoxes.push(octreeNode.boundingBox.min.add(octreeNode.boundingBox.max).divideScalar(2))
		measure.measureOctBoxes.push(dims)
		//test end
		originalLeaves.push(octreeNode)
		results[octreeNode.octree.name+"orig"] += vol
		//console.log(octreeNode.numElements)
	}
	else {
		octreeNode.children.forEach(element => {
			if (element && element.boundingBox.intersectsBox(newBounds)){
				recGetLeavesForVol(newBounds, element, measure, originalLeaves, results)
			}
		});
	}
}

function recCalcVol (node, originalLeaves, measure, results)
{

	//for testing ONCE MORE
	//measure.newOctNodeBBs.push(node.boundingBox.min)
	//measure.newOctNodeBBs.push(node.boundingBox.max)

	let containsContent = originalLeaves.some( leaf => {
		return node.boundingBox.intersectsBox(leaf.boundingBox)
		||
		node.boundingBox.containsBox(leaf.boundingBox)
	})
	if(containsContent) {
		if(node.tree.maxDepth > node.currentDepth)
		{
			node.split()
			//console.log("recCalcVol");
			//console.log(node.currentDepth)
			node.children.forEach(child => {
				recCalcVol(child, originalLeaves, measure, results)
			});
		}
		else {

	 		let dims = new Vector3(0,0,0)
			dims = node.boundingBox.getSize(dims) //idk, again :D
			let vol = Math.abs(dims.x) * Math.abs(dims.y) * Math.abs(dims.z)
			results[originalLeaves[0].octree.name] += vol
	//for testing ONCE MORE
			measure.newOctNodeBBs.push(node.boundingBox.min.add(node.boundingBox.max).divideScalar(2))
			measure.newOctNodeBBs.push(dims)
		}
	}
}

//FIXME TEST 
function recDrawingBBTest (newBounds, octreeNode) {
	octreeNode.children.forEach(element => {
		if (element && element.boundingBox.intersectsBox(newBounds)){
			let bb = element.boundingBox
			potree.renderer.drawLine(bb.min, bb.max, new Vector3(255, 255, 0))
			recDrawingBBTest(newBounds, element)
		}
	});
}