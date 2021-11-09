import { useEffect, useRef } from 'react';
import { initGL } from './utils';

export function Canvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas) {
      throw new Error();
    }

    const gl = canvas.getContext('webgl2');

    if (!gl) {
      throw new Error();
    }

    initGL(gl);
  }, []);

  return (
    <div>
      <canvas ref={canvasRef} width={600} height={400} />
    </div>
  );
}
