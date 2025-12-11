import { Box3 } from "../../Potree";

export class simpleOctree {
	constructor(){
		this.root = new simpleOctreeNode();
	}

	setBounds(newBounds)
	{
		this.root.boundingBox = newBounds
	}
}

export class simpleOctreeNode {

	constructor(){
		this.id = "0" 
		this.children = []
		this.boundingBox = new Box3();
	}

	isEmpty() {
		return this.children.length == 0; 
	}

	split(){
		if(this.boundingBox.min)
		{
			let min = this.boundingBox.min
			let max = this.boundingBox.max
			//i guess every box needs their own reference, hence cloning.
			//else one change destroys all the other too
			bb1 = new Box3(min.clone(), max.clone().divideScalar(2))
			bb2 = new Box3(min.clone().setX(max.x/2), max.clone().divideScalar(2).setX(max.x))
			bb3 = new Box3(min.clone().setY(max.y/2), max.clone().divideScalar(2).setY(max.y))
			bb4 = new Box3(max.clone().divideScalar(2).setZ(min.z), max.clone().setZ(max.z/2))
			bb5 = new Box3(min.clone().setZ(max.z/2), max.clone().divideScalar(2).setZ(max.z))
			bb6 = new Box3(min.clone().divideScalar(2).setX(min.x), max.clone().setX(max.x/2))
			bb7 = new Box3(min.clone().divideScalar(2).setY(min.y), max.clone().setY(max.y/2))
			bb8 = new Box3(max.clone().divideScalar(2), max.clone())
		}
	}
}