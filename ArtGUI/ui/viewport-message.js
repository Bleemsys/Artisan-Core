// Editing hints share the existing model status row, outside the 3D canvas.
export function createViewportMessage(viewer,className){
  const message=document.createElement('span');
  message.className='viewport-message '+className;
  message.hidden=true;
  message.setAttribute('role','status');
  const slot=viewer.canvas.closest('.viewport-panel')?.querySelector('.viewport-messages');
  (slot||viewer.canvas.parentElement).append(message);
  return message;
}
