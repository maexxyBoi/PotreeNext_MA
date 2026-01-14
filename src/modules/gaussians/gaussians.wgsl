
struct Uniforms {	
	worldView        : mat4x4f,
	world            : mat4x4f,
	view             : mat4x4f,
	proj             : mat4x4f,
	screen_width     : f32,
	screen_height    : f32,
	size             : f32,
	elementCounter   : u32,
	hoveredIndex     : i32,
	numSplats        : u32,
};

@group(0) @binding(0) var<uniform> uniforms    : Uniforms;
@group(0) @binding(1) var<storage> a_ordering  : array<u32>;

@group(0) @binding(2) var<storage> a_positions : array<f32>;
@group(0) @binding(3) var<storage> a_color     : array<vec4f>;
@group(0) @binding(4) var<storage> a_rotation  : array<vec4f>;
@group(0) @binding(5) var<storage> a_scale     : array<f32>;


struct VertexIn{
	@builtin(vertex_index) vertex_index : u32,
	@builtin(instance_index) instance_index : u32,
};

struct VertexOut{
	@builtin(position) position : vec4<f32>,
	@location(1) @interpolate(linear) color : vec4<f32>,
	@location(2) @interpolate(perspective) uv : vec2f,
};

struct FragmentIn{
	@location(1) @interpolate(linear) color : vec4<f32>,
	@location(2) @interpolate(perspective) uv : vec2f,
};

struct FragmentOut{
	@location(0) color : vec4<f32>
};

// Adapted from glm mat3_cast: https://github.com/g-truc/glm/blob/2d4c4b4dd31fde06cfffad7915c2b3006402322f/glm/gtc/quaternion.inl#L47
// Licensed under MIT: https://github.com/g-truc/glm/blob/master/copying.txt
fn toMat3(q : vec4f) -> mat3x3f{

	var qxx = (q.x * q.x);
	var qyy = (q.y * q.y);
	var qzz = (q.z * q.z);
	var qxz = (q.x * q.z);
	var qxy = (q.x * q.y);
	var qyz = (q.y * q.z);
	var qwx = (q.w * q.x);
	var qwy = (q.w * q.y);
	var qwz = (q.w * q.z);

	var mat = mat3x3f(
		1.0f, 0.0f, 0.0f,
		0.0f, 1.0f, 0.0f,
		0.0f, 0.0f, 1.0f
	);

	mat[0][0] = 1.0f - 2.0f * (qyy +  qzz);
	mat[0][1] = 2.0f * (qxy + qwz);
	mat[0][2] = 2.0f * (qxz - qwy);

	mat[1][0] = 2.0f * (qxy - qwz);
	mat[1][1] = 1.0f - 2.0f * (qxx +  qzz);
	mat[1][2] = 2.0f * (qyz + qwx);

	mat[2][0] = 2.0f * (qxz + qwy);
	mat[2][1] = 2.0f * (qyz - qwx);
	mat[2][2] = 1.0f - 2.0f * (qxx +  qyy);

	return mat;
};


// Much of the splat math originates from https://github.com/mkkellogg/GaussianSplats3D (MIT License)
@vertex
fn main_vertex(vertex : VertexIn) -> VertexOut {

	var vout = VertexOut();
	
	// Get the splat index - each splat gets 6 vertices (2 triangles for a quad)
	let splatIdx = vertex.vertex_index / 6u;
	let vertexInQuad = vertex.vertex_index % 6u;
	
	// Get the ordering index (depth-sorted)
	var splatIndex = a_ordering[splatIdx];
	
	// Load splat data
	let posIdx = splatIndex * 3u;
	var pos = vec3f(
		a_positions[posIdx],
		a_positions[posIdx + 1u],
		a_positions[posIdx + 2u]
	);
	
	let color = a_color[splatIndex];
	let rotation = a_rotation[splatIndex];
	
	let scaleIdx = splatIndex * 3u;
	let scale = vec3f(
		a_scale[scaleIdx],
		a_scale[scaleIdx + 1u],
		a_scale[scaleIdx + 2u]
	);
	
	// Transform position to view space
	let worldPos = uniforms.world * vec4f(pos, 1.0);
	let viewPos = uniforms.view * worldPos;
	
	// Base sigma from average scale
	let scaleAvg = (scale.x + scale.y + scale.z) / 3.0;
	let sigma = max(1e-4, scaleAvg);
	
	// Quad corners in sigma units (±3 sigma)
	var quadOffset = vec2f(0.0);
	if (vertexInQuad == 0u) { quadOffset = vec2f(-3.0, -3.0); }
	else if (vertexInQuad == 1u) { quadOffset = vec2f(3.0, -3.0); }
	else if (vertexInQuad == 2u) { quadOffset = vec2f(3.0, 3.0); }
	else if (vertexInQuad == 3u) { quadOffset = vec2f(-3.0, -3.0); }
	else if (vertexInQuad == 4u) { quadOffset = vec2f(3.0, 3.0); }
	else if (vertexInQuad == 5u) { quadOffset = vec2f(-3.0, 3.0); }
	
	let offsetView = vec3f(quadOffset.x * sigma, quadOffset.y * sigma, 0.0);
	let clipPos = uniforms.proj * vec4f(viewPos.xyz + offsetView, 1.0);

	vout.position = clipPos;
	vout.color = color;
	vout.uv = quadOffset;
	
	return vout;
}

@fragment
fn main_fragment(fragment : FragmentIn) -> FragmentOut {

	var fout = FragmentOut();
	
	let dist2 = dot(fragment.uv, fragment.uv);
	let alpha = exp(-0.5 * dist2);
	if (alpha < 0.005) {
		discard;
	}
	
	let color = fragment.color;
	fout.color = vec4f(color.rgb, alpha);

	return fout;
}
