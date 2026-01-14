
export class RenderTarget{

	constructor(renderer, params = {}){
		this.colorAttachments = [];
		this.depth = null;
		let baseSize = params.size ?? [128, 128];
		let texSize = baseSize.length === 2 ? [...baseSize, 1] : baseSize;
		this.size = [texSize[0], texSize[1]];
		this.renderer = renderer;
		this.version = 0;

		{ // COLOR ATTACHMENTS
			let descriptors = params.colorDescriptors ?? [{
				size: texSize,
				format: "r32uint",
				usage: GPUTextureUsage.TEXTURE_BINDING 
					| GPUTextureUsage.COPY_SRC 
					| GPUTextureUsage.COPY_DST 
					| GPUTextureUsage.RENDER_ATTACHMENT,
			}];

			console.log("RenderTarget: Creating", descriptors.length, "color attachment(s)");
			for(let i = 0; i < descriptors.length; i++){
				let descriptor = descriptors[i];
				console.log(`RenderTarget: descriptor[${i}].format =`, descriptor.format, "size=", descriptor.size);
				let texture = renderer.device.createTexture(descriptor);
				console.log(`RenderTarget: created texture[${i}].format =`, texture.format, "width=", texture.width, "height=", texture.height);

				this.colorAttachments.push({descriptor, texture});
			}
		}

		{ // DEPTH ATTACHMENT
			let descriptor = params.depthDescriptor ?? {
				size: texSize,
				format: "depth32float",
				usage: GPUTextureUsage.TEXTURE_BINDING 
					| GPUTextureUsage.COPY_SRC 
					| GPUTextureUsage.COPY_DST 
					| GPUTextureUsage.RENDER_ATTACHMENT,
			};

			let texture = renderer.device.createTexture(descriptor);

			this.depth = {descriptor, texture};
		}
	}

	// static create(descriptor){
	// 	let instance = Object.create(RenderTarget);

	// 	return instance;
	// }

	setSize(width, height){

		let resized = this.size[0] !== width || this.size[1] !== height;

		if(resized){

			this.size = [width, height];
			let texSize = [width, height, 1];
			
			// resize color attachments
			for(let attachment of this.colorAttachments){
				attachment.texture.destroy();

				let desc = attachment.descriptor;
				console.log("RenderTarget.setSize: BEFORE recreate, descriptor.format =", desc.format);
				desc.size = texSize;

				attachment.texture = this.renderer.device.createTexture(desc);
				console.log("RenderTarget.setSize: AFTER recreate, texture.format =", attachment.texture.format);
			}

			{ // resize depth attachment
				let attachment = this.depth;
				attachment.texture.destroy();
				
				let desc = attachment.descriptor;
				desc.size = texSize;

				attachment.texture = this.renderer.device.createTexture(desc);
			}

			this.version++;
		}

	}

}