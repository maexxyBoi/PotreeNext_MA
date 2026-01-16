
let shaderCode = `
	struct Uniforms {
		screenWidth: f32,
		screenHeight: f32,
	};

	@group(0) @binding(0) var<uniform> uniforms : Uniforms;
	@group(0) @binding(1) var mySampler   : sampler;
	@group(0) @binding(2) var myTexture   : texture_2d<f32>;

	@vertex
	fn main_vs(@builtin(vertex_index) index : u32) -> @builtin(position) vec4<f32> {

		var pos = vec4f(0.0f, 0.0f, 0.0f, 0.0f);

		if(index == 0u){ pos = vec4f(-1.0f, -1.0f, 0.0f, 1.0f); }
		if(index == 1u){ pos = vec4f( 1.0f, -1.0f, 0.0f, 1.0f); }
		if(index == 2u){ pos = vec4f( 1.0f,  1.0f, 0.0f, 1.0f); }
		if(index == 3u){ pos = vec4f(-1.0f, -1.0f, 0.0f, 1.0f); }
		if(index == 4u){ pos = vec4f( 1.0f,  1.0f, 0.0f, 1.0f); }
		if(index == 5u){ pos = vec4f(-1.0f,  1.0f, 0.0f, 1.0f); }
		
		return pos;
	}

	@fragment
	fn main_fs(@builtin(position) pos: vec4<f32>) -> @location(0) vec4<f32> {

		// Convert pixel coordinates to normalized UV coordinates [0, 1]
		var uv = pos.xy / vec2f(uniforms.screenWidth, uniforms.screenHeight);
		// Flip Y for proper texture orientation
		//uv.y = 1.0 - uv.y;

		var sourceColor = textureSample(myTexture, mySampler, uv);

		return sourceColor;
	}
`;

let initialized = false;
let pipeline = null;
let composeSampler = null;
let composeUniformBuffer = null;

function init(renderer){

	if(initialized){
		return;
	}

	let {device} = renderer;

	let module = device.createShaderModule({code: shaderCode});

	let blend = {
		color: {
			srcFactor: "one",
			dstFactor: "one-minus-src-alpha",
			operation: "add",
		},
		alpha: {
			srcFactor: "one",
			dstFactor: "one-minus-src-alpha",
			operation: "add",
		},
	};

	pipeline = device.createRenderPipeline({
		layout: "auto",
		vertex: {
			module,
			entryPoint: "main_vs",
		},
		fragment: {
			module,
			entryPoint: "main_fs",
			targets: [
				{format: "bgra8unorm", blend: blend},
			],
		},
		primitive: {
			topology: 'triangle-list',
			cullMode: 'none',
		},
	});

	// Create reusable sampler and uniform buffer (width, height)
	composeSampler = device.createSampler({
		magFilter: "linear",
		minFilter: "linear",
	});
	composeUniformBuffer = device.createBuffer({
		size: 2 * 4, // two f32 values
		usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
	});

	initialized = true;
}

export function compose(renderer, source, target){

	init(renderer);


	let colorAttachments = [{
		view: target.colorAttachments[0].texture.createView(), 
		loadOp: "load", 
		storeOp: 'store',
	}];

	let renderPassDescriptor = {
		colorAttachments,
		sampleCount: 1,
	};

	const commandEncoder = renderer.device.createCommandEncoder();
	const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);

	// Update reusable uniforms with screen dimensions
	let uniformsData = new Float32Array([
		source.colorAttachments[0].texture.width,
		source.colorAttachments[0].texture.height,
	]);
	renderer.device.queue.writeBuffer(composeUniformBuffer, 0, uniformsData);

	let bindGroup = renderer.device.createBindGroup({
		layout: pipeline.getBindGroupLayout(0),
		entries: [
			{binding: 0, resource: {buffer: composeUniformBuffer}},
			{binding: 1, resource: composeSampler},
			{binding: 2, resource: source.colorAttachments[0].texture.createView()},
		],
	});


	passEncoder.setPipeline(pipeline);
	passEncoder.setBindGroup(0, bindGroup);

	passEncoder.draw(6, 1, 0, 0);

	passEncoder.end();
	let commandBuffer = commandEncoder.finish();
	renderer.device.queue.submit([commandBuffer]);

}