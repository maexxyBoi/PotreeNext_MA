
import {Gradients, Utils} from "potree";
import {createAttributesPanel} from "./panel_attributes.js";
import {createMeasurementsPanel} from "./panel_measurements.js";
import {createPanel as createAppearancePanel} from "./panel_appearance.js";
import {createPanel as createInfosPanel} from "./panel_infos.js";
import {createPanel as createHoveredPanel} from "./panel_hovered.js";
import {createPanel as createScenePanel} from "./panel_scene.js";
import { Measure, sliceString, octreesString, meshString } from "../../interaction/measure.js";
import { GaussianSplats, PointCloudOctree, Vector3, Box3, Vector4 } from "../../Potree.js";
import { simpleOctree, simpleOctreeNode } from "../../potree/octree/simpleOctree.js";

export const debugColors = [ //16 colors, each neighbor i tried to make different
	new Vector3(47, 79, 79),//darkslategray
	new Vector3(255, 192, 203),//pink
	new Vector3(165, 42, 42),//brown
	new Vector3(255, 20, 147),//deeppink
	new Vector3(0, 100, 0),//darkgreen
	new Vector3(100, 149, 237),//cornflowerblue
	new Vector3(0, 0, 128),//navy
	new Vector3(240, 230, 140),//khaki
	new Vector3(255, 0, 0),//red
	new Vector3(255, 0, 255),//magenta
	new Vector3(255, 165, 0),//orange
	new Vector3(0, 0, 255),//blue
	new Vector3(255, 255, 0),//yellow
	new Vector3(0, 255, 255),//cyan
	new Vector3(0, 255, 0),	//lime
	new Vector3(0, 250, 154)//mediumspringgreen
];
export const debugPickedPoints = [];
export const debugCgalTriangles = [];

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
	addSizeChangeListener(elPanel);

	let section = new Section();
	section.icon = `url(${dir}/icons/measure.svg)`;
	section.panel = elPanel;
	section.handler = panel_measurements;

	return section;
}


function addSizeChangeListener(elPanel){

	elPanel.addEventListener("click", (e) => {
		if(e.target && e.target.id === "sizeChange"){
			console.log("sizeChange clicked");

			let elBlock = e.target.closest("div");
			let id = elBlock.dataset.measureid
			let measures = potree.measure.measures
			let measure = measures[Number(id)-1]
			let inputs = elBlock.getElementsByTagName("input");
			let isSphere = inputs[0].value === "true";
			//If sphere is checked, we actually look at the
			//radius. if not we dont
			if (isSphere)
			{
				let newRadius = Number(inputs[1].value);
				measure.sphereRadius = newRadius;
			}
			//we look at the cube size dimensions only when we know that 
			//we dont have a sphere at out hands.
			else{
				let newSize = new Vector3(
					Number(inputs[2].value),
					Number(inputs[3].value),
					Number(inputs[4].value)
				)
				measure.size = newSize
			}

			let newPos = new Vector3(
				Number(inputs[5].value),
				Number(inputs[6].value),
				Number(inputs[7].value)
			)
			
			measure.markers[0] = newPos
		}
	}
	);
}

function addClickListener(elPanel){
	elPanel.addEventListener("click", (e) => {
		if(e.target && e.target.id === "shapeSphere"){
			let elBlock = e.target.closest("div");
			let id = elBlock.dataset.measureid;
			let measures = potree.measure.measures;
			let measure = measures[Number(id) - 1];

			measure.useSphere = e.target.checked;
			measure.isCalculated = false;
		}
		if(e.target && (e.target.id === "innerCalc") || (e.target.id === "surfCalc")){
			console.log("innerCalc clicked");

			let elBlock = e.target.closest("div");
			let elDropdown = elBlock.getElementsByTagName("select")
			let checkForFloor = elBlock.getElementsByTagName("input")[0].checked
			let id = elBlock.dataset.measureid
			let isSurface =  e.target.id === "surfCalc" ? true : false;
			let alpha = elBlock.getElementsByTagName("input")[8].value;

			calculateInnerVolume(id, elDropdown, checkForFloor, isSurface, alpha);
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


function calculateInnerVolume(id, elDropdown, checkForFloor, isSurface, alpha)
{
	let measures = potree.measure.measures
	let measure = measures[Number(id) - 1] //actual number to index
	//absolut keine ahnung warum ich ne collection kriege,
	//aber das is n array :roll_eyes:
	let option = elDropdown[0].value
	console.log(option)
	measure.isCalculated = true;
	//Bounds set by measurement 
	let newBounds = calcBounds(measure)
	let pointClouds = potree.scene.root.children.filter((entry) => entry instanceof PointCloudOctree)
	let splats = potree.scene.root.children.filter((entry) => entry instanceof GaussianSplats)


	if (option === sliceString){
		console.log(sliceString)
		concaveSlicing(newBounds, pointClouds, measure, isSurface, alpha)
	}
	if (option === octreesString){
		console.log(octreesString)
		//test measure only for vis. purposes
		measure.measureOctBoxes = []
		octreeVolume(newBounds, pointClouds, measure)
	}
	if (option === meshString){
		console.log(meshString)
		meshVol(newBounds, splats)
	}
}

function concaveSlicing(newBounds, pointClouds, measure, isSurface, alpha){

	//test
	//console.log(newBounds);
	//have size of measure box
	let length = newBounds.max.clone().sub(newBounds.min)
	//determine longest axis along which to slice
	let longest = length.maxVal();

	let sliceAmount = 8; //FIXME change this to changeable
	
	let slices = [];

	for (let i = 0, j = sliceAmount-1; i < sliceAmount; i++, j--){

		let newMin = newBounds.min.clone();
		let newMax = newBounds.max.clone();
		let newValues = [];
		//since i cant really *just* get the correct dim of the logest axis
		//of the DISTANCE (bcs that is what counts, not the actual size of the box), i have to do this weird stuff
		//i check for which dim it is.
		if(longest == length.x) {
			newValues = slice( i, j, newMin.x, newMax.x, length.x, sliceAmount);
			newMin.x = newValues[0]
			newMax.x = newValues[1]
		}
		if(longest == length.y) {
			newValues = slice( i, j, newMin.y, newMax.y, length.y, sliceAmount);
			newMin.y = newValues[0]
			newMax.y = newValues[1]
		}
		if(longest == length.z) {
			newValues = slice( i, j, newMin.z, newMax.z, length.z, sliceAmount);
			newMin.z = newValues[0]
			newMax.z = newValues[1]
		}
		slices.push(new Box3(newMin, newMax))
	}

	slices.forEach(slice => {
		//for testing ONCE MORE
		measure.sliceBoxes.push(slice.min.clone().add(slice.max).divideScalar(2))
		measure.sliceBoxes.push(slice.size(slice))
	});
	//test FIXME for now ignore slicing
	//console.log(slices);
	let pointSets = extractPoints(slices, pointClouds, newBounds, measure);
    const mergedPoints = [];
    for (const set of pointSets) {
        for (const p of set) {	
            mergedPoints.push(p);
        }
    }
	console.log("Total points extracted for alpha shape: ", mergedPoints.length);
	alphaShape([mergedPoints], newBounds, isSurface, measure, alpha);


}

function slice(i,j, min, max, length, sliceAmount)
{
	min += (length * (i/sliceAmount));
	max -= (length * (j/sliceAmount))
	return [min, max];
}

function getAllNodes(array, node){
    if (!node) return;

    if (node.geometry && node.geometry.numElements > 0){
        array.push(node);
    }

    if (node.children){
        for (const child of node.children){
            if (child){
                getAllNodes(array, child);
            }
        }
    }
}
function isPointInSelection(pos, bounds, measure){
    if(measure?.useSphere && measure.markers.length > 0){
        const center = measure.markers[0];
        const radius = Math.max(0, Number(measure.sphereRadius) || 0);
        return pos.distanceTo(center) <= radius;
    }

    return checkIfInSlice(pos, bounds);
}
//Slices are excluded for now bcs they introduce border-areas where no points 
//are picked. TODO
//REFUNCTIONED TO EXTRACT POINTS FROM SPHERICAL MEASURING.
//old code will be here for slicing too, but be aware of that, this function
// has two purposes. anyway i wouldnt want to slice a sphere
function extractPoints(slices, pointClouds, newBounds, measure)
{
    debugPickedPoints.length = 0;
    const pointSets = [];

	pointClouds.forEach(cloud => {
		for (const node of cloud.visibleNodes){
			if (node.boundingBox.intersectsBox(newBounds))
			{
				let geom = node.geometry
				if (!geom || !geom.numElements) continue;

				for(let i = 0; i < geom.numPoints; i++)
				{
					const point = node.getPoint(i);
					const pos = point.position;
					const center = measure.markers[0];
					const radius = Math.max(0, Number(measure.sphereRadius) || 0);
					if(measure?.useSphere && measure.markers.length > 0 && pos.distanceTo(center) <= radius){
						const pClone = pos.clone();
						pointSets.push(pClone);
						/*debugPickedPoints.push({
							position: pClone,
							color: new Vector3(255, 0, 0),
						});*/
					}
					if (!measure?.useSphere && checkIfInSlice(pos, newBounds)) {
						const pClone = pos.clone();
						pointSets.push(pClone);
						//compute intense 
						/*debugPickedPoints.push({
							position: pClone,
							color: new Vector3(255, 0, 0),
						});*/
					}
				}
			}
		}
	});
/*
    // --- sanity: collect nodes per cloud and log total loaded points ---
    const nodesPerCloud = new Map();
    for (const pc of pointClouds){
        if (!pc.root) continue;

        const nodes = [];
        getAllNodes(nodes, pc.root);
        nodesPerCloud.set(pc, nodes);

        let totalPointsInNodes = 0;
        for (const node of nodes){
            const g = node.geometry;
            if (g && g.numElements) totalPointsInNodes += g.numElements;
        }
        console.log(`PointCloud "${pc.name}": loaded points in nodes =`, totalPointsInNodes);
    }
    // -------------------------------------------------------------------

    let colorIndex = 0;

    for (const slice of slices){
        const currentDebugColor = debugColors[colorIndex++ % debugColors.length];
        const points = [];

        for (const pc of pointClouds){
            const nodes = nodesPerCloud.get(pc);
            if (!nodes) continue;

            for (const node of nodes){
                const geom = node.geometry;
                if (!geom || !geom.numElements) continue;

                if (node.boundingBox && !node.boundingBox.intersectsBox(slice)){
                    continue;
                }

                for (let i = 0; i < geom.numElements; i++){
                    const point = node.getPoint(i);
                    const pos = point.position;

                    if (checkIfInSlice(pos, slice)){
                        const pClone = pos.clone();
                        points.push(pClone);
                        debugPickedPoints.push({
                            position: pClone,
                            color:    currentDebugColor,
                        });
                    }
                }
            }
        }

        pointSets.push(points);
    }*/

    return [pointSets];
}

function checkIfInSlice(pos, slice){
    return (
        pos.x >= slice.min.x && pos.x <= slice.max.x &&
        pos.y >= slice.min.y && pos.y <= slice.max.y &&
        pos.z >= slice.min.z && pos.z <= slice.max.z
    );
}

//On the frontend it is called concave hull bcs usually, we want
//a concave hull for volume comp even tho i use an alpha shape lib for flexibility
async function alphaShape(pointSets, newBounds, isSurface, measure, alpha) {
    // clear previous CGAL debug triangles
    debugCgalTriangles.length = 0;
	let totalVolume = 0;
    for (let pointSet of pointSets) {
        if (pointSet.length < 4) {
            continue;
        }
		let floorAndObject = addSyntheticFloor(pointSet, newBounds, measure);

		pointSet = floorAndObject;
		//Debugging of above function that should add a floor
		/*floorAndObject.forEach(p => {
			debugPickedPoints.push({
				position: p.clone(),
				color: new Vector3(0, 255, 255),
			});
		});*/
		const shape = await fetchAlphaShape(pointSet, alpha, isSurface);
          if (!shape || shape.error ) {
              continue;
          }
		  totalVolume = shape.volume
			//Wireframe visualization setup
			let color = 0;
			let triColor = new Vector3(0, 255, 0); //default color
		  if (shape.tetrahedrons) {
			for (const tet of shape.tetrahedrons) {
				if (!tet || tet.length < 4) continue;
					if(color >= debugColors.length){
						color = 0;
					}
					triColor = debugColors[color++]
					/*debugCgalTriangles.push({
					a: new Vector3(tet[0].x, tet[0].y, tet[0].z),
					b: new Vector3(tet[1].x, tet[1].y, tet[1].z),
					c: new Vector3(tet[2].x, tet[2].y, tet[2].z),
					d: new Vector3(tet[3].x, tet[3].y, tet[3].z),
					triColor: triColor,
				});*/
			}
		  }
		  if (shape.triangles) {
			for (const tri of shape.triangles) {
				if (!tri || tri.length < 3) continue;
					if(color >= debugColors.length){
						color = 0;
					}
					triColor = debugColors[color++]
              debugCgalTriangles.push({
                  a: new Vector4(tri[0].x, tri[0].y, tri[0].z),
                  b: new Vector4(tri[1].x, tri[1].y, tri[1].z),
                  c: new Vector4(tri[2].x, tri[2].y, tri[2].z),
				  triColor: triColor,
              });
			}
          }
		console.log("Time taken: ", shape.timing_ms);
		console.log("Chosen Alpha: ", shape.used_alpha);
		console.log("Result: ", (!isSurface ? "Volume " + shape.volume : "Surface " + shape.area));
      }
  }

function addSyntheticFloor(points, bounds, measure) {
	let floorZ = new Vector3(0,0,0);
	// i dont want an auxilliary floor for volume calc
	//that is at the bottom of a sphere. that is not even
	//unintuitive but unhelpful. instead, i insert the aux.
	//floor at the center. which is slightly less unhelpful.
	if (measure.useSphere)
	{
		floorZ = measure.markers[0].z;
	}
	else {
		//watch out for cloud orientation please
		floorZ = bounds.min.z;
	}
	/*debugPickedPoints.push({
		position: bounds.min.clone(),
		color: new Vector3(255, 255, 0),
	});
	debugPickedPoints.push({
		position: bounds.max.clone(),
		color: new Vector3(255, 0, 0),
	});*/
    // Estimate spacing from data density
	//TODO fixed it for 30 for now
    const n = Math.min(points.length, 30);
    let minDist = Infinity;
    for (let i = 0; i < n; i++) {
        const p = points[i];
        for (let j = i + 1; j < Math.min(i + 20, n); j++) {
            const q = points[j];
            const dx = p.x - q.x, dy = p.y - q.y;
            const d2 = dx * dx + dy * dy;
            if (d2 > 1e-4 && d2 < minDist) minDist = d2;
        }
    }
    const step = Math.max(Math.sqrt(minDist) * 1.5, 0.005);
    const floorPts = [];

    if (measure.useSphere && measure.markers.length > 0) {
        // Generate circular floor pattern for sphere mode
        const center = measure.markers[0];
        const sphereRadius = Math.max(0, Number(measure.sphereRadius) || 0);
        
        // Create concentric circles from center to edge
        const numRings = Math.max(2, Math.ceil(sphereRadius / step));
        for (let ring = 0; ring <= numRings; ring++) {
            const currentRadius = (ring / numRings) * sphereRadius;
            
            if (currentRadius < step * 0.5) {
                floorPts.push(new Vector3(center.x, center.y, floorZ));
            }
			else {
                const circumference = 2 * Math.PI * currentRadius;
                const numPoints = Math.max(6, Math.ceil(circumference / step));
                for (let i = 0; i < numPoints; i++) {
                    const angle = (2 * Math.PI * i) / numPoints;
                    const x = center.x + currentRadius * Math.cos(angle);
                    const y = center.y + currentRadius * Math.sin(angle);
                    floorPts.push(new Vector3(x, y, floorZ));
                }
            }
        }
    } else {
        // Original rectangular grid for cube mode
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        for (const p of points) {
            if (p.x < minX) minX = p.x;
            if (p.x > maxX) maxX = p.x;
            if (p.y < minY) minY = p.y;
            if (p.y > maxY) maxY = p.y;
        }

        // Add thin layer to stabilize tetrahedralization
        const eps = step * 0.2;
        const layers = [floorZ];

        for (const z of layers) {
            for (let x = minX; x <= maxX; x += step) {
                for (let y = minY; y <= maxY; y += step) {
                    floorPts.push(new Vector3(x, y, z));
                }
            }
        }
    }

    return points.concat(floorPts);
}


//==============================================OCTREE CALC
function octreeVolume(newBounds, pointClouds, measure){
	let results = {}
	let originalLeaves = []
	let secondTree = new simpleOctree();
	let starttime = performance.now();
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
	let endtime = performance.now();
	console.log("Volume: ", results, ". Time taken: ", endtime - starttime, "ms")
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
		//test---------------------------------------------------------
		//potree.renderer.drawBox(octreeNode.boundingBox.min, dims.divideScalar(2), new Vector3(255,0,0))
		measure.measureOctBoxes.push(octreeNode.boundingBox.min.add(octreeNode.boundingBox.max).divideScalar(2))
		measure.measureOctBoxes.push(dims)
		//test end-----------------------------------------------------------------
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
			dims = node.boundingBox.size(dims) //idk, again :D
			let vol = Math.abs(dims.x) * Math.abs(dims.y) * Math.abs(dims.z)
			results[originalLeaves[0].octree.name] += vol
	//FIXME for testing ONCE MORE------------------------------------------------
			measure.newOctNodeBBs.push(node.boundingBox.min.add(node.boundingBox.max).divideScalar(2))
			measure.newOctNodeBBs.push(dims)
		}
	}
}
function meshVol(newBounds, splats) {
}

async function fetchAlphaShape(pointSet, alpha, isSurface) {
	
    const usedAlpha = (alpha === undefined || alpha === null) ? 0 : alpha;

    const res = await fetch("http://localhost:8000/alpha3d_cgal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            points: pointSet.map(p => ({ x: p.x, y: p.y, z: p.z })),
            alpha: usedAlpha,
            surface: isSurface
        }),
    });

    const data = await res.json();
	if (data.error != undefined) {
    console.warn("CGAL error from server:", data.error);
    return;
	}

    console.log("CGAL stub result:", data);
	console.log("CGAL triangles:", data.triangles);
	//console.log("Volume", data.volume);
	//console.log("Alpha", data.used_alpha);
	console.log("Preset alpha: ", alpha)
    return data;
}


//FIXME TEST ==========================================
function recDrawingBBTest (newBounds, octreeNode) {
	octreeNode.children.forEach(element => {
		if (element && element.boundingBox.intersectsBox(newBounds)){
			let bb = element.boundingBox
			potree.renderer.drawLine(bb.min, bb.max, new Vector3(255, 255, 0))
			recDrawingBBTest(newBounds, element)
		}
	});
}

//DEBUG METHODS END
//===========================================================
