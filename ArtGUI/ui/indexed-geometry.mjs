import * as THREE from './vendor/three.module.js';

export function indexedGroup(chunks,center,surfaceMaterial,lineMaterial){
  const group=new THREE.Group();
  // Flat lighting uses fragment derivatives, so indexed surfaces need no normals.
  const material=surfaceMaterial.clone();material.uniforms=surfaceMaterial.uniforms;
  material.fragmentShader=material.fragmentShader.replace('if(displayMode!=0){','if(false){');
  try{
    for(const chunk of chunks){
      const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(chunk.positions,3));
      geometry.setIndex(new THREE.BufferAttribute(chunk.indices,1));geometry.computeBoundingBox();geometry.computeBoundingSphere();
      const mesh=new THREE.Mesh(geometry,material);mesh.position.fromArray(chunk.center).sub(new THREE.Vector3(...center));
      mesh.userData.indexedSurface=true;group.add(mesh);
    }
    group.userData.indexedGroup=true;group.userData.edgeMaterial=lineMaterial;return group;
  }catch(error){group.traverse(o=>o.geometry?.dispose());material.dispose();lineMaterial.dispose();throw error;}
}

export function indexedDisplay(root,mode){
  root.traverse(group=>{
    if(!group.userData.indexedGroup)return;
    for(const surface of group.children){
      if(!surface.userData.indexedSurface)continue;
      // Keep the parent visible for picking; wireframe hides only its surface material.
      surface.material.visible=mode!=='wireframe';
      let edges=surface.children.find(c=>c.userData.role==='indexedEdges');
      if(mode==='solid'){
        if(edges){surface.remove(edges);edges.geometry.dispose();}
        continue;
      }
      if(!edges){
        const source=surface.geometry.index.array,Index=source.constructor,indices=new Index(source.length*2);
        for(let i=0,j=0;i<source.length;i+=3){const a=source[i],b=source[i+1],c=source[i+2];indices[j++]=a;indices[j++]=b;indices[j++]=b;indices[j++]=c;indices[j++]=c;indices[j++]=a;}
        const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',surface.geometry.attributes.position);geometry.setIndex(new THREE.BufferAttribute(indices,1));
        edges=new THREE.LineSegments(geometry,group.userData.edgeMaterial);edges.userData.role='indexedEdges';surface.add(edges);
      }
    }
  });
}

export function geometryMemoryBytes(scene){
  let bytes=0;const buffers=new Set();
  scene.traverse(obj=>{
    const attributes=[...Object.values(obj.geometry?.attributes||{}),obj.geometry?.index];
    for(const attr of attributes){const array=attr?.array||attr?.data?.array;if(array&&!buffers.has(array.buffer)){buffers.add(array.buffer);bytes+=array.buffer.byteLength;}}
  });return bytes;
}
