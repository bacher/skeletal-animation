import { useEffect, useRef } from 'react';
import { init, initGL } from './renderIndexed6';

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

    (async function () {
      const res = await fetch('/model.json');

      if (!res.ok) {
        throw new Error('model.json cant be loaded');
      }

      const model = await res.json();

      init();
      initGL(gl, model);
    })();
  }, []);

  return (
    <div>
      <canvas ref={canvasRef} width={500} height={500} />
    </div>
  );
}
