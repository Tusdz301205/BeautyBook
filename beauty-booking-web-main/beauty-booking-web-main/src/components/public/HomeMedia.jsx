import { useEffect, useState } from 'react';
import { Image as ImageIcon } from 'lucide-react';

export function HomeMedia({
  src,
  alt,
  ratio = '4 / 3',
  label = 'Hình ảnh BeautyBook',
  eager = false,
  className = '',
}) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setLoaded(false);
    setFailed(false);
  }, [src]);

  const showImage = Boolean(src) && !failed;

  return (
    <figure
      className={`bb-home-media ${showImage ? 'has-image' : 'is-placeholder'} ${loaded ? 'is-loaded' : ''} ${className}`.trim()}
      style={{ aspectRatio: ratio }}
    >
      {showImage ? (
        <img
          src={src}
          alt={alt}
          loading={eager ? 'eager' : 'lazy'}
          fetchPriority={eager ? 'high' : 'auto'}
          decoding="async"
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
        />
      ) : (
        <div className="bb-home-media__placeholder" role="img" aria-label={`${alt}. Hình ảnh sẽ được cập nhật.`}>
          <span className="bb-home-media__mark" aria-hidden="true"><ImageIcon size={18} strokeWidth={1.7} /></span>
          <span className="bb-home-media__copy">
            <strong>{label}</strong>
            <small>Hình ảnh sẽ được cập nhật</small>
          </span>
        </div>
      )}
      {showImage && !loaded ? <span className="bb-home-media__loading" aria-hidden="true" /> : null}
    </figure>
  );
}
