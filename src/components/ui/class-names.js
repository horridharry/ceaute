// Every ui primitive combines its own base classes with a caller's className
// the same way: append, never replace, so a call site can add a utility
// without silently losing the primitive's own styling.
//
// This lives in a plain .js module rather than inside each .jsx primitive so
// the unit tests can import it directly, the way every other file in tests/
// imports a plain module. The repository has no JSX transform in `node --test`
// and this task is not the place to introduce one.
export function composeClassName(base, extra) {
  return extra ? `${base} ${extra}` : base;
}
