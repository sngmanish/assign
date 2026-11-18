// CSS Modules: `import styles from './x.module.css'` gives a map of class names.
declare module '*.module.css' {
  const classes: { [key: string]: string };
  export default classes;
}
