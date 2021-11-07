import { useRef } from 'react';

export function Canvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  return (
    <div>
      <canvas ref={canvasRef} />
    </div>
  );
}
