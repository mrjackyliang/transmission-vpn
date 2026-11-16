/**
 * Assets - PNG.
 *
 * Lets pages import PNG screenshots from the docs folders. Docusaurus turns
 * each import into the URL of the bundled image.
 *
 * @since 0.0.0
 */
declare module '*.png' {
  const src: string;

  export default src;
}
