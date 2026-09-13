import * as T from "three";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";

// City-inspired generated panorama: distant scenery only, never pickable geometry.
export function cinematicEnvironment(
  scene: T.Scene,
  city: string,
  onReady: () => void,
  onError: () => void,
) {
  let dead = false;
  const geometry = new T.SphereGeometry(2200, 48, 24);
  const material = new T.ShaderMaterial({
    side: T.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: { panorama: { value: null } },
    vertexShader: `varying vec3 direction; void main(){direction=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader: `uniform sampler2D panorama; varying vec3 direction;
      void main(){vec3 d=normalize(direction); float u=atan(d.x,-d.z)/6.2831853*2.4+.62;
      vec2 uv=vec2(1.-abs(mod(u,2.)-1.),clamp(.61+asin(d.y)/3.14159265*1.8,.01,.99));
      gl_FragColor=texture2D(panorama,uv);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      }`,
  });
  const dome = new T.Mesh(geometry, material);
  dome.name = "Reference-derived scenic cyclorama, not surveyed geometry";
  dome.renderOrder = -100;
  const texture = new T.TextureLoader().load(
    `/site-assets/${city}-environment-v1.png`,
    () => {
      if (dead) {
        texture.dispose();
        return;
      }
      texture.colorSpace = T.SRGBColorSpace;
      // These generated photographs are not calibrated spherical panoramas.
      // An explicitly art-directed scenic dome aligns their horizon without
      // low-resolution cubemap conversion or implying a geospatial bearing.
      material.uniforms.panorama.value = texture;
      scene.add(dome);
      onReady();
    },
    undefined,
    onError,
  );
  return {
    dispose: () => {
      dead = true;
      scene.remove(dome);
      geometry.dispose();
      material.dispose();
      texture.dispose();
    },
  };
}

// Gentle cinematic colour separation and vignette. Deliberately no depth blur
// on selectable assets or operational overlays.
export function cinematicGrade() {
  return new ShaderPass({
    uniforms: { tDiffuse: { value: null }, strength: { value: 0.7 } },
    vertexShader: `varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader: `uniform sampler2D tDiffuse; uniform float strength; varying vec2 vUv;
      void main(){ vec4 sampleColour=texture2D(tDiffuse,vUv); vec3 c=sampleColour.rgb;
      float l=dot(c,vec3(.2126,.7152,.0722));
      vec3 cool=vec3(.95,1.005,1.04), warm=vec3(1.035,1.012,.965);
      c*=mix(cool,warm,smoothstep(.12,.72,l));
      float vignette=1.-strength*.22*smoothstep(.22,.74,length(vUv-.5));
      gl_FragColor=vec4(mix(sampleColour.rgb,c,strength)*vignette,sampleColour.a); }`,
  });
}
