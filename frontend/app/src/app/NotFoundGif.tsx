import notFoundGif from '../assets/url-gadbad.gif';

/** The "kuch to gadbad hai" GIF shown on the not-found pages (decorative). */
export function NotFoundGif() {
  return (
    <img
      src={notFoundGif}
      alt=""
      width={200}
      height={200}
      style={{ borderRadius: 'var(--hl-radius-lg)' }}
    />
  );
}
