
import {SceneNode, Vector3, Vector4, Matrix4, Box3, Frustum, EventDispatcher, StationaryControls, RenderTarget} from "potree";
import {Timer} from "potree";
import {compose} from "./compose.js";
import {RadixSortKernel} from "radix-sort-esm";

let initializing = false;
let initialized = false;
let pipeline = null;
let uniformsBuffer = new ArrayBuffer(512);
let uniformsGpuBuffer = null;
let layout = null;
let fbo_blending = null;

let splatSortKeys = null;
let splatSortValues = null;
let pipeline_depth = null;

// Toggle heavy GPU readbacks/logs; keep this false for performance
const DEBUG_READBACK = false;
// Safe mode: skip compute/sort and draw only a minimal triangle
const SAFE_MODE = false;
// Progressive mode: gradually increase visible splat count per frame
const PROGRESSIVE_MODE = !SAFE_MODE;
const PROGRESSIVE_BUDGET_INIT = 10000;     // start with 10k splats
const PROGRESSIVE_BUDGET_INCREASE = 5000;  // add 5k each frame up to max
const PROGRESSIVE_BUDGET_MAX = 500000;     // cap at 500k (show all splats)

let dbg_frameCounter = 0;
let _progressiveSplatBudget = PROGRESSIVE_BUDGET_INIT;
let _lastCameraMatrix = new Matrix4();

// Throttle sorting to reduce per-frame cost
const SORT_EVERY_N_FRAMES = 4;
const MAX_VERTICES_PER_DRAW = 120_000; // cap per draw to avoid long GPU tasks (~20k splats)
let _sortFrameCounter = 0;
let _sortedOnce = false;

let splatBuffers = {
	numSplats: 0,

	position:  null,
	color:     null,
	rotation:  null,
	scale:     null,
};

// Reusable matrix for world-view composition
let _worldView = new Matrix4();

async function init(renderer){

	if(initialized) return;
	if(initializing) return;

	initializing = true;
	console.log("Initializing GaussianSplats...");
	
	try {
		let {device} = renderer;
		const colorFormat = "bgra8unorm"; // force blendable format (avoid rgba32float)
		console.log("GaussianSplats init colorFormat:", colorFormat);
		const initialSize = renderer.getSize ? renderer.getSize() : {width: 128, height: 128};

		uniformsGpuBuffer = renderer.createBuffer({
			size: uniformsBuffer.byteLength,
			usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
		});

		let size = [initialSize.width, initialSize.height];
		let descriptor = {
			size: [...size, 1],
			colorDescriptors: [
				{
					size: [...size, 1],
					format: colorFormat,
					usage: GPUTextureUsage.TEXTURE_BINDING 
						| GPUTextureUsage.RENDER_ATTACHMENT
						| GPUTextureUsage.COPY_SRC,
				}
			],
			depthDescriptor: {
				size: [...size, 1],
				format: "depth32float",
				usage: GPUTextureUsage.TEXTURE_BINDING 
					| GPUTextureUsage.RENDER_ATTACHMENT,
			}
		};
		console.log("BEFORE RenderTarget creation, descriptor.colorDescriptors[0].format:", descriptor.colorDescriptors[0].format);

		fbo_blending = new RenderTarget(renderer, descriptor);
		
		console.log("AFTER RenderTarget creation, actual texture format:", fbo_blending.colorAttachments[0].texture.format);
		console.log("AFTER RenderTarget creation, stored descriptor format:", fbo_blending.colorAttachments[0].descriptor.format);

		layout = renderer.device.createBindGroupLayout({
			label: "gaussian splat uniforms",
			entries: [
				{
					binding: 0,
					visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
					buffer: {type: 'uniform'},
				},{
					binding: 1,
					visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
					buffer: {type: 'read-only-storage'},
				},{
					binding: 2,
					visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
					buffer: {type: 'read-only-storage'},
				},{
					binding: 3,
					visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
					buffer: {type: 'read-only-storage'},
				},{
					binding: 4,
					visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
					buffer: {type: 'read-only-storage'},
				},{
					binding: 5,
					visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
					buffer: {type: 'read-only-storage'},
				}
			],
		});

		// Fetch shader source from external file
		let shaderPath = `${import.meta.url}/../gaussians.wgsl?t=${Date.now()}`;
		console.log("Fetching main shader:", shaderPath);
		let response = await fetch(shaderPath);
		if (!response.ok) {
			throw new Error(`Failed to fetch gaussians shader: ${response.status} ${response.statusText}`);
		}
		let shaderSource = await response.text();
		console.log("Main shader source length:", shaderSource.length);

		let module = device.createShaderModule({code: shaderSource});
		
		// Check compilation info synchronously
		let compilationInfo = await module.getCompilationInfo();
		console.log("Shader compilation info - message count:", compilationInfo.messages.length);
		for (let msg of compilationInfo.messages) {
			let prefix = "gaussians embedded shader (" + msg.type.toUpperCase() + ")";
			let logFn = msg.type === "error" ? console.error : console.warn;
			logFn(prefix, "line", msg.lineNum, "col", msg.linePos, ":", msg.message);
		}
		
		console.log("Shader module created");

		// log device lost once
		device.lost.then(info => {
			console.error("GPU device lost (GaussianSplats):", info.message, info.reason);
		});

		let tStart = Date.now();

		let blend = {
			color: {
				srcFactor: "src-alpha",
				dstFactor: "one-minus-src-alpha",
				operation: "add",
			},
			alpha: {
				srcFactor: "one",
				dstFactor: "one-minus-src-alpha",
				operation: "add",
			},
		};

		device.pushErrorScope("validation");
		try {
			pipeline = device.createRenderPipeline({
				layout: device.createPipelineLayout({
					bindGroupLayouts: [layout],
				}),
				vertex: {
					module,
					entryPoint: "main_vertex",
					buffers: []
				},
				fragment: {
					module,
					entryPoint: "main_fragment",
					targets: [
						{format: colorFormat, blend: blend}
					],
				},
				primitive: {
					topology: 'triangle-list',
					cullMode: 'none',
				},
				depthStencil: {
					depthWriteEnabled: false,
					depthCompare: 'always',
					format: "depth32float",
				},
			});
			let duration = Date.now() - tStart;
			console.log("Pipeline created in", duration, "ms");
			console.log("Pipeline target format was:", colorFormat);
			console.log("Pipeline fragment targets:", pipeline.getBindGroupLayout ? "available" : "N/A");
		} catch (e) {
			console.error("Failed to create GaussianSplats pipeline:", e);
			initializing = false;
			return;
		}
		device.popErrorScope().then(err => {
			if (err) {
				console.error("Pipeline validation error:", err.message ?? err);
			}
		});


		{ // sort stuff
			splatSortKeys        = renderer.createBuffer({size: 4 * 10_000_000});
			splatSortValues      = renderer.createBuffer({size: 4 * 10_000_000});

			let shaderPath = `${import.meta.url}/../gaussians_distance.wgsl?t=${Date.now()}`;
			console.log("Fetching distance shader:", shaderPath);
			let response = await fetch(shaderPath);
			if (!response.ok) {
				throw new Error(`Failed to fetch distance shader: ${response.status} ${response.statusText}`);
			}
			let shaderSource = await response.text();
			console.log("Distance shader source length:", shaderSource.length);

			let module = device.createShaderModule({code: shaderSource});
			module.getCompilationInfo().then(info => {
				for (let msg of info.messages) {
					console[msg.type === "error" ? "error" : "warn"]("gaussians_distance.wgsl:", msg.lineNum, msg.message);
				}
			});
			console.log("Distance shader module created");
			pipeline_depth = device.createComputePipeline({
				layout: "auto",
				compute: {module: module}
			});
			console.log("Depth pipeline created");
		}

		initialized = true;
		console.log("GaussianSplats initialization completed successfully");
	} catch (error) {
		console.error("Error during GaussianSplats initialization:", error);
		initializing = false;
		throw error;
	}
}

export class GaussianSplats extends SceneNode{

	constructor(url){
		super(); 

		this.url = url;
		this.dispatcher = new EventDispatcher();
		this.initialized = false;

		this.splatData = null;
		this.numSplatsUploaded = 0;
	}

	setHovered(index){
		// Placeholder for hover interaction
	}

	updateUniforms(drawstate){

		let {renderer, camera} = drawstate;
		let {device} = renderer;

		let f32 = new Float32Array(uniformsBuffer);
		let view = new DataView(uniformsBuffer);

		{ // transform
			this.updateWorld();
			let world = this.world;
			let view = camera.view;
			_worldView.multiplyMatrices(view, world);

			f32.set(_worldView.elements, 0);
			f32.set(world.elements, 16);
			f32.set(view.elements, 32);
			f32.set(camera.proj.elements, 48);
			
			// Debug: log first splat position and camera info
			if (this.splatData && dbg_frameCounter % 5 === 0) {
				let posView = new Float32Array(this.splatData.positions);
				let firstPos = [posView[0], posView[1], posView[2]];
				console.log("DEBUG: First splat position:", firstPos);
				console.log("DEBUG: splatData.positions type:", this.splatData.positions.constructor.name, "byteLength:", this.splatData.positions.byteLength);
				console.log("DEBUG: Camera position:", camera.position);
				console.log("DEBUG: Camera proj matrix elements[0,5]:", camera.proj.elements[0], camera.proj.elements[5]);
			}
		}

		{ // misc
			let size = renderer.getSize();

			let offset = 256;

			view.setFloat32(offset + 0, size.width, true);
			view.setFloat32(offset + 4, size.height, true);
			view.setFloat32(offset + 8, 10.0, true);
			view.setUint32 (offset + 12, Potree.state.renderedElements, true);
			view.setInt32  (offset + 16, this.hoveredIndex ?? -1, true);
			view.setUint32 (offset + 20, this.numSplats, true);
		}

		renderer.device.queue.writeBuffer(uniformsGpuBuffer, 0, uniformsBuffer, 0, uniformsBuffer.byteLength);
	}

	project(coord){

		if(this.projector){
			return this.projector.forward(coord);
		}else{
			return coord;
		}

	}

	render(drawstate){


		let {renderer, camera} = drawstate;
		let {device} = renderer;

		console.log("GaussianSplats render called, numSplats:", this.numSplats, "initialized:", initialized, "pipeline ready:", !!pipeline);
		console.log("fbo format:", fbo_blending?.colorAttachments?.[0]?.descriptor?.format);

		init(renderer);
		if(!initialized) {
			console.warn("GaussianSplats not initialized, skipping render");
			return;
		}

		fbo_blending.setSize(...renderer.screenbuffer.size);
		console.log("After setSize, fbo texture format:", fbo_blending.colorAttachments[0].texture.format);
		console.log("After setSize, fbo descriptor format:", fbo_blending.colorAttachments[0].descriptor.format);

		// track GPU validation errors for this frame
		device.pushErrorScope("validation");

		let colorAttachments = [{
			view: fbo_blending.colorAttachments[0].texture.createView(), 
			loadOp: "clear", 
			clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 0.0 },
			storeOp: 'store',
		}];
		
		console.log("RENDER SETUP: colorAttachments[0].view exists:", !!colorAttachments[0].view);
		console.log("RENDER SETUP: fbo_blending.colorAttachments[0].texture:", fbo_blending.colorAttachments[0].texture.width, "x", fbo_blending.colorAttachments[0].texture.height);

		let renderPassDescriptor = {
			colorAttachments,
			depthStencilAttachment: {
				view: renderer.screenbuffer.depth.texture.createView(),
				depthLoadOp: "clear",
				depthClearValue: 1.0,
				depthStoreOp: "store",
			},
			sampleCount: 1,
		};

		if(this.numSplats === 0) {
			console.log("numSplats is 0, skipping render");
			return;
		}

		console.log("numSplatsLoaded:", this.numSplatsLoaded, "numSplatsUploaded:", this.numSplatsUploaded, "splatBuffers.numSplats:", splatBuffers.numSplats);

		if(!this.splatData) {
			console.log("splatData not loaded yet, skipping render");
			return;
		}

		// Transfer data to GPU
		if(this.splatData && splatBuffers.numSplats === 0){
			console.log("Creating splat buffers");
			// create splat buffer
			splatBuffers.numSplats = this.numSplats;
			splatBuffers.position = renderer.createBuffer({size: this.numSplats * 12});
			splatBuffers.color    = renderer.createBuffer({size: this.numSplats * 16});
			splatBuffers.rotation = renderer.createBuffer({size: this.numSplats * 16});
			splatBuffers.scale    = renderer.createBuffer({size: this.numSplats * 12});
			console.log("Splat buffers created");
		}

		if(this.numSplatsLoaded > this.numSplatsUploaded){
			console.log("Uploading splat data from", this.numSplatsUploaded, "to", this.numSplatsLoaded);
			
			// Create typed array views from ArrayBuffers
			let posView = new Float32Array(this.splatData.positions);
			let colView = new Float32Array(this.splatData.color);
			let rotView = new Float32Array(this.splatData.rotation);
			let scaleView = new Float32Array(this.splatData.scale);

			let numNew = this.numSplatsLoaded - this.numSplatsUploaded;
			const BATCH_SIZE = 10000;
			let uploaded = 0;
			while (uploaded < numNew) {
				let batchSize = Math.min(BATCH_SIZE, numNew - uploaded);
				let start = this.numSplatsUploaded + uploaded;
				console.log("Uploading batch from", start, "size", batchSize);
				
				// Create subarrays for this batch (start at 'start' index, copy 'batchSize' elements)
				let posBatch = posView.subarray(start * 3, (start + batchSize) * 3);
				let colBatch = colView.subarray(start * 4, (start + batchSize) * 4);
				let rotBatch = rotView.subarray(start * 4, (start + batchSize) * 4);
				let scaleBatch = scaleView.subarray(start * 3, (start + batchSize) * 3);
				
				try {
					// Upload to GPU at the correct offset (in bytes)
					device.queue.writeBuffer(splatBuffers.position, start * 12, posBatch);
					device.queue.writeBuffer(splatBuffers.color, start * 16, colBatch);
					device.queue.writeBuffer(splatBuffers.rotation, start * 16, rotBatch);
					device.queue.writeBuffer(splatBuffers.scale, start * 12, scaleBatch);
				} catch (error) {
					console.error("Error in writeBuffer for batch at", start, ":", error);
					throw error;
				}
				
				uploaded += batchSize;
			}

			this.numSplatsUploaded += numNew;
			// New data uploaded; force a sort next frame
			_sortedOnce = false;
			// In progressive mode, reset budget to ramp up gradually
			if (PROGRESSIVE_MODE) {
				_progressiveSplatBudget = PROGRESSIVE_BUDGET_INIT;
			}
			console.log("Upload completed, numSplatsUploaded:", this.numSplatsUploaded);
		}

		console.log("Creating radix sort kernel for", this.numSplats, "splats");
		if(!this.radixSortKernel || this.radixSortKernel.count != this.numSplats){
			try {
				this.radixSortKernel = new RadixSortKernel({
					device,
					keys: splatSortKeys,
					values: splatSortValues,
					count: this.numSplats,
					bit_count: 32,
				});
				console.log("Radix sort kernel created successfully");
			} catch (error) {
				console.error("Failed to create radix sort kernel:", error);
				return;
			}
		}

		const commandEncoder = renderer.device.createCommandEncoder();

		// Ensure sort buffers are sized to current splat count (u32 per entry)
		const requiredBytes = this.numSplats * 4;
		if (!splatSortKeys || splatSortKeys.size < requiredBytes) {
			splatSortKeys = renderer.createBuffer({ size: requiredBytes });
		}
		if (!splatSortValues || splatSortValues.size < requiredBytes) {
			splatSortValues = renderer.createBuffer({ size: requiredBytes });
		}

		// CPU-init identity ordering on first frame (avoid GPU compute for now)
		if (!_sortedOnce && PROGRESSIVE_MODE) {
			let identityIndices = new Uint32Array(this.numSplats);
			for (let i = 0; i < this.numSplats; i++) {
				identityIndices[i] = i;
			}
			renderer.device.queue.writeBuffer(splatSortValues, 0, identityIndices);
			_sortedOnce = true;
			console.log("CPU-initialized splat ordering (identity) for", this.numSplats, "splats");
		}

		// Throttle: run depth + radix sort only every N frames, always on first sort
		const shouldSortThisFrame = !SAFE_MODE && ((!_sortedOnce) || ((++_sortFrameCounter % SORT_EVERY_N_FRAMES) === 0));
		if (shouldSortThisFrame && PROGRESSIVE_MODE && this.radixSortKernel) {
			let pass = commandEncoder.beginComputePass();

			// First, create/update depth keys and identity values
			let bindGroup = device.createBindGroup({
				layout: pipeline_depth.getBindGroupLayout(0),
				entries: [
					{ binding: 0, resource: { buffer: uniformsGpuBuffer }},
					{ binding: 1, resource: { buffer: splatBuffers.position }},
					{ binding: 2, resource: { buffer: splatSortKeys }},
					{ binding: 3, resource: { buffer: splatSortValues }},
				],
			});

			pass.setPipeline(pipeline_depth);
			pass.setBindGroup(0, bindGroup);
			let numGroups = Math.ceil(Math.sqrt(this.numSplats / 256));
			pass.dispatchWorkgroups(numGroups, numGroups, 1);

			// then radix sort the keys/values in-place
			try {
				this.radixSortKernel.dispatch(pass);
			} catch (error) {
				console.error("Error during radix sort dispatch:", error);
				pass.end();
				return;
			}
			pass.end();
			_sortedOnce = true;
		}

		const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);
		Timer.timestamp(passEncoder, "gaussians-start");

		console.log("Render pass descriptor depth load/store:", renderPassDescriptor.depthStencilAttachment.depthLoadOp, "/", renderPassDescriptor.depthStencilAttachment.depthStoreOp);
		console.log("Pipeline depth compare mode:", "less");

		this.updateUniforms(drawstate);

		// If ordering not computed yet and not in safe mode, skip rendering
		if (!_sortedOnce && !SAFE_MODE) {
			let commandBuffer = commandEncoder.finish();
			renderer.device.queue.submit([commandBuffer]);
			return;
		}

		// let {passEncoder} = drawstate.pass;
		passEncoder.setPipeline(pipeline);

		// Bind groups should be cached...but I honestly don't care. 
		// Why you can't just pass pointers to resources in WebGPU, like in modern 
		// bindless APIs and even OpenGL since 2010 with NV_shader_buffer_load, remains a mystery.
		console.log("Creating bind group with buffers:", {
			uniforms: uniformsGpuBuffer.size,
			ordering: splatSortValues.size,
			position: splatBuffers.position.size,
			color: splatBuffers.color.size,
			rotation: splatBuffers.rotation.size,
			scale: splatBuffers.scale.size,
		});
		let bindGroup = device.createBindGroup({
			layout: layout,
			entries: [
				{binding: 0, resource: {buffer: uniformsGpuBuffer}},
				{binding: 1, resource: {buffer: splatSortValues}},
				{binding: 2, resource: {buffer: splatBuffers.position}},
				{binding: 3, resource: {buffer: splatBuffers.color}},
				{binding: 4, resource: {buffer: splatBuffers.rotation}},
				{binding: 5, resource: {buffer: splatBuffers.scale}},
			],
		});
		console.log("Bind group created successfully");
		
		// verbose per-frame logs disabled for performance
		
		passEncoder.setBindGroup(0, bindGroup);
		
		if (SAFE_MODE) {
			// Minimal sanity draw: one triangle
			passEncoder.draw(3, 1, 0, 0);
		} else if (PROGRESSIVE_MODE) {
			// Draw up to the progressive budget of splats
			let splatsToDraw = Math.min(_progressiveSplatBudget, this.numSplats);
			let verticesToDraw = splatsToDraw * 6;
			
			// Chunk draws to avoid GPU timeouts
			let first = 0;
			while (first < verticesToDraw) {
				let count = Math.min(MAX_VERTICES_PER_DRAW, verticesToDraw - first);
				passEncoder.draw(count, 1, first, 0);
				first += count;
			}
			
			// Increase budget each frame for smooth ramp
			if (_progressiveSplatBudget < PROGRESSIVE_BUDGET_MAX) {
				_progressiveSplatBudget = Math.min(_progressiveSplatBudget + PROGRESSIVE_BUDGET_INCREASE, PROGRESSIVE_BUDGET_MAX);
			}
		} else {
			let totalVertices = this.numSplats * 6;
			let first = 0;
			while (first < totalVertices) {
				let count = Math.min(MAX_VERTICES_PER_DRAW, totalVertices - first);
				passEncoder.draw(count, 1, first, 0);
				first += count;
			}
		}
		passEncoder.end();
		
		Timer.timestamp(passEncoder, "gaussians-end");

		let commandBuffer = commandEncoder.finish();
		console.log("Command buffer finished");
		
		renderer.device.queue.submit([commandBuffer]);
		console.log("Command buffer submitted");
		// command submitted
		
		// Immediately capture validation errors
		device.popErrorScope().then(err => {
			if (err) {
				console.error("❌ GPU validation error in GaussianSplats:", err.message ?? err);
			} else {
				console.log("✓ No GPU validation errors");
			}
		}).catch(e => {
			console.error("Error checking validation scope:", e);
		});
		
		compose(renderer, 
			fbo_blending, 
			renderer.screenbuffer
		);

		// Debug: immediately readback pixels to see if anything rendered
		const DEBUG_READBACK_ENABLED = false;
		if (DEBUG_READBACK_ENABLED) {
			let tex = fbo_blending.colorAttachments[0].texture;
			console.log("DEBUG: Scheduling readback on texture", tex.width, "x", tex.height, "format:", tex.format);
			
			// Wait a tiny bit for GPU to finish, then readback center of screen
			Promise.resolve().then(() => {
				return renderer.readPixels(tex, Math.floor(tex.width/2) - 2, Math.floor(tex.height/2) - 2, 4, 4);
			}).then(buf => {
				let u32 = new Uint32Array(buf);
				let sum = 0;
				for (let i = 0; i < u32.length; i++) sum += u32[i];
				console.log("DEBUG READBACK - center (4x4):", sum, "total pixels u32:", u32.length, "bytes:", buf.byteLength, "first 4 u32:", Array.from(u32.slice(0, 4)));
			}).catch(err => console.error("GaussianSplats readPixels failed:", err));
		}
	}
}