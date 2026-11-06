import {Quaternion,Vector3} from './vendor/three.module.js';
import {OrbitControls} from './vendor/addons/controls/OrbitControls.js';

// Retain OrbitControls' input, pan, zoom and pointer lifecycle. The viewer uses
// immediate motion, so rotation can move both the eye and its up vector instead
// of accumulating a polar angle that stops at the top/bottom of a fixed up axis.
export class FreeOrbitControls extends OrbitControls{
  _rotateLeft(angle){this._rotateFrame(angle,this.object.up.clone().normalize());}
  _rotateUp(angle){this._rotateFrame(angle,new Vector3(1,0,0).applyQuaternion(this.object.quaternion));}
  _rotateFrame(angle,axis){
    if(!Number.isFinite(angle)||angle===0)return;
    const rotation=new Quaternion().setFromAxisAngle(axis,-angle);
    this.object.position.sub(this.target).applyQuaternion(rotation).add(this.target);
    this.object.up.applyQuaternion(rotation).normalize();
    this.object.lookAt(this.target);
  }
  update(deltaTime=null){
    // The base class otherwise caches its original up frame. Refresh it after
    // rotation, projection changes and saved-view restores before pan/zoom runs.
    this._quat.setFromUnitVectors(this.object.up.clone().normalize(),new Vector3(0,1,0));
    this._quatInverse.copy(this._quat).invert();
    return super.update(deltaTime);
  }
}
