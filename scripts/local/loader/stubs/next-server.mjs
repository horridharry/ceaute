// `after` runs its callback once the response is sent; a script has no
// response, so it runs straight away, as the app would a moment later.
export function after(callback) {
  void Promise.resolve().then(callback);
}
