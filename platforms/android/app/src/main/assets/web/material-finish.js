import * as THREE from 'three';
// Fine satin finish: deterministic, small material data, not a visible noise overlay.
export function makeFinishTexture(){const size=128,data=new Uint8Array(size*size*4);let seed=761;for(let i=0;i<size*size;i++){seed=(1664525*seed+1013904223)>>>0;const v=120+(seed>>>27);data.set([v,v,v,255],i*4);}const t=new THREE.DataTexture(data,size,size,THREE.RGBAFormat);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.minFilter=THREE.LinearMipmapLinearFilter;t.magFilter=THREE.LinearFilter;t.generateMipmaps=true;t.needsUpdate=true;return t;}
export function applyShellFinish(material,packedSurface){const finish=makeFinishTexture();material.onBeforeCompile=shader=>{
 shader.uniforms.packedSurface={value:packedSurface};shader.uniforms.fineFinish={value:finish};
 shader.fragmentShader='uniform sampler2D packedSurface;uniform sampler2D fineFinish;\n'+shader.fragmentShader;
 shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
 float sourceLuma=dot(diffuseColor.rgb,vec3(.299,.587,.114));
 float shellMask=smoothstep(.26,.76,sourceLuma);
 vec4 surfaceData=texture2D(packedSurface,vMapUv);
 float satin=texture2D(fineFinish,vMapUv*38.).r-.53;
 vec3 porcelain=vec3(.98,.965,.93)*mix(.86,1.,smoothstep(.20,.82,sourceLuma));
 diffuseColor.rgb=mix(diffuseColor.rgb,porcelain,shellMask*.63);`);
 shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
 float nativeRoughness=1.-surfaceData.a;
 roughnessFactor=clamp(mix(.55,.285,shellMask)+(nativeRoughness-.5)*.13+satin*.12,.24,.65);`);
 shader.fragmentShader=shader.fragmentShader.replace('#include <metalnessmap_fragment>',`#include <metalnessmap_fragment>
 metalnessFactor=mix(.24+surfaceData.r*.32,.035,shellMask);`);
 shader.fragmentShader=shader.fragmentShader.replace('#include <lights_physical_fragment>','#include <lights_physical_fragment>\n#ifdef USE_CLEARCOAT\nmaterial.clearcoat*=shellMask;\n#endif');
 };
 material.customProgramCacheKey=()=> 'little-d-satin-porcelain-v1';
 material.userData.finishTexture=finish;
}
export function accessoryFinish(name=''){
 if(name.includes('Copper'))return {metalness:.94,roughness:.27,clearcoat:.18,clearcoatRoughness:.25,anisotropy:.45,anisotropyRotation:Math.PI/2};
 if(name.includes('Graphite'))return {metalness:.12,roughness:.59,clearcoat:.08,specularIntensity:.65};
 if(name.includes('Teal'))return {metalness:.48,roughness:.24,clearcoat:.65,clearcoatRoughness:.18};
 if(name.includes('JadeLight'))return {metalness:.05,roughness:.32,clearcoat:.75,clearcoatRoughness:.16};
 return {metalness:.04,roughness:.31,clearcoat:.48,clearcoatRoughness:.22};
}
export function applyVisorFinish(material){material.onBeforeCompile=shader=>{shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',`float visorFacing=clamp(abs(dot(normalize(normal),normalize(vViewPosition))),0.,1.);
 diffuseColor.a=mix(.09,.43,pow(1.-visorFacing,3.));
 #include <opaque_fragment>`);};material.customProgramCacheKey=()=> 'little-d-coated-visor-v1';}
