import { useState, type ImgHTMLAttributes, type ReactNode } from 'react';

type Props = ImgHTMLAttributes<HTMLImageElement> & { sources?: ReactNode; originalSrc?: string };

export function StorefrontImage({ sources, originalSrc, ...props }: Props) {
  const [failure, setFailure] = useState<{ src: string | undefined; path: string } | null>(null);
  const [retrySrc, setRetrySrc] = useState<string>();
  if (failure && failure.src === props.src) {
    return (
      <img
        {...props}
        src="/brand/use-me-email-avatar.png"
        srcSet={undefined}
        sizes={undefined}
        data-media-fallback-for={failure.path}
        alt={props.alt ? 'Use Me With Style' : ''}
        style={{ ...props.style, objectFit: 'contain', backgroundColor: '#eee4d4' }}
      />
    );
  }

  const image = (
    <img
      {...props}
      src={retrySrc ?? props.src}
      srcSet={retrySrc ? undefined : props.srcSet}
      onError={({ currentTarget }) => {
        if (originalSrc && !retrySrc && currentTarget.currentSrc !== originalSrc) {
          setRetrySrc(originalSrc);
          return;
        }
        setFailure({ src: props.src, path: new URL(currentTarget.currentSrc || currentTarget.src).pathname });
      }}
    />
  );
  return sources ? <picture>{sources}{image}</picture> : image;
}
