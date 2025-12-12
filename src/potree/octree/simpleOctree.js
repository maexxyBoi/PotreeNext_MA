import { Box3, Vector3 } from "potree"


//FIXME
//idk really know if i need traversing or id in any way, but leave it here for now
export class simpleOctree {
	constructor(){
		this.root = new simpleOctreeNode(0, this);
		this.maxDepth = 6
	}

	setBounds(newBounds)
	{
		this.root.boundingBox = newBounds
	}
}

export class simpleOctreeNode {

	constructor(depth, tree){
		this.id = "0" 
		this.children = []
		this.boundingBox = new Box3();
		this.currentDepth = depth
		this.tree = tree
	}

	isEmpty() {
		return this.children.length == 0; 
	}

	setBounds(newBounds)
	{
		this.boundingBox = newBounds
		return this;
	}

	split(){
		if(this.boundingBox.min && (this.currentDepth < this.tree.maxDepth))
		{
			this.currentDepth++
			let min = this.boundingBox.min
			let max = this.boundingBox.max
			let mid = min.clone().add(max).divideScalar(2)
			let children = [
				new simpleOctreeNode(this.currentDepth, this.tree).
					setBounds(new Box3(new Vector3(min.x, min.y, min.z),
						new Vector3(mid.x, mid.y, mid.z))),
				new simpleOctreeNode(this.currentDepth, this.tree).
					setBounds(new Box3(new Vector3(mid.x, min.y, min.z),
						new Vector3(max.x, mid.y, mid.z))),
				new simpleOctreeNode(this.currentDepth, this.tree).
					setBounds(new Box3(new Vector3(min.x, mid.y, min.z),
						new Vector3(mid.x, max.y, mid.z))),
				new simpleOctreeNode(this.currentDepth, this.tree).
					setBounds(new Box3(new Vector3(mid.x, mid.y, min.z),
						new Vector3(max.x, max.y, mid.z))),
				new simpleOctreeNode(this.currentDepth, this.tree).
					setBounds(new Box3(new Vector3(min.x, min.y, mid.z),
						new Vector3(mid.x, mid.y, max.z))),
				new simpleOctreeNode(this.currentDepth, this.tree).
					setBounds(new Box3(new Vector3(mid.x, min.y, mid.z),
						new Vector3(max.x, mid.y, max.z))),
				new simpleOctreeNode(this.currentDepth, this.tree).
					setBounds(new Box3(new Vector3(min.x, mid.y, mid.z),
						new Vector3(mid.x, max.y, max.z))),
				new simpleOctreeNode(this.currentDepth, this.tree).
					setBounds(new Box3(new Vector3(mid.x, mid.y, mid.z),
						new Vector3(max.x, max.y, max.z))),
			]
			this.children = children
		}
	}
}