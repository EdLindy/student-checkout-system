import netlifyIdentity from 'netlify-identity-widget';

export function initIdentity() {
  try {
    netlifyIdentity.init();
  } catch (e) {
    // ignore if running in non-netlify environment
  }
}

export function openLogin() {
  netlifyIdentity.open();
}

export function currentUser() {
  return netlifyIdentity.currentUser();
}

export function onLogin(cb: (user: any) => void) {
  netlifyIdentity.on('login', cb);
}

export function onLogout(cb: () => void) {
  netlifyIdentity.on('logout', cb);
}

export default netlifyIdentity;
