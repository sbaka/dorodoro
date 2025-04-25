/**
 * DoroDoro Authentication Redirect System
 * Handles page redirects based on user authentication status
 */

// Constants for page URLs
const PAGES = {
  HOME: '/home.html',
  INDEX: '/index.html',
  LOGIN: '/login.html',
  SIGNUP: '/sign-up.html',
  START: '/start.html',
  SETTINGS: '/settings.html',
  ABOUT: '/about.html'
};

/**
 * Redirects to specific page
 * @param {string} page - The page URL to redirect to
 */
function redirectTo(page) {
  window.location.href = page;
}

/**
 * Redirects users based on authentication status
 * Public pages are accessible to all users
 * Protected pages require authentication
 */
function checkAuthAndRedirect() {
  // Get current page path
  const currentPath = window.location.pathname;
  const pageName = currentPath.substring(currentPath.lastIndexOf('/'));
  
  // Define which pages require authentication and which don't
  const publicPages = [PAGES.INDEX, PAGES.LOGIN, PAGES.SIGNUP, PAGES.ABOUT];
  const protectedPages = [PAGES.HOME, PAGES.START, PAGES.SETTINGS];
  
  // Check if the user is authenticated
  firebase.auth().onAuthStateChanged(user => {
    // User is signed in
    if (user) {
      // If on a public page (login, signup, etc.), redirect to home
      if (publicPages.includes(pageName) && pageName !== PAGES.ABOUT) {
        redirectTo(PAGES.HOME);
      }
      // User already authenticated, stay on the protected page
    } 
    // User is not signed in
    else {
      // If trying to access a protected page, redirect to login
      if (protectedPages.includes(pageName)) {
        redirectTo(PAGES.LOGIN);
      }
      // User not authenticated, stay on the public page
    }
  });
}

/**
 * Navigation functions used by page buttons
 */
function goHome() {
  redirectTo(PAGES.INDEX);
}

function goStartHome() {
  redirectTo(PAGES.HOME);
}

function goSignIn() {
  redirectTo(PAGES.LOGIN);
}

function goSignUp() {
  redirectTo(PAGES.SIGNUP);
}

function goStart() {
  redirectTo(PAGES.START);
}

function goSettings() {
  redirectTo(PAGES.SETTINGS);
}

function goAbout() {
  redirectTo(PAGES.ABOUT);
}

/**
 * Handle sign-out functionality
 */
function signOut() {
  firebase.auth().signOut().then(() => {
    // Clear user session
    sessionStorage.removeItem('userLoggedIn');
    // Redirect to index page after successful logout
    redirectTo(PAGES.INDEX);
  }).catch((error) => {
    console.error("Error signing out:", error);
  });
}

// Initialize redirect check when page loads
document.addEventListener('DOMContentLoaded', function() {
  checkAuthAndRedirect();
  
  // Attach logout function to all logout buttons
  const logoutButtons = document.querySelectorAll('#logout, #logout-yes');
  logoutButtons.forEach(button => {
    if (button) {
      button.addEventListener('click', signOut);
    }
  });
});