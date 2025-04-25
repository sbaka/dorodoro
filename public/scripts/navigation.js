//set the webpage logo
var link = document.querySelector("link[rel~='icon']");
if (!link) {
    link = document.createElement('link');
    link.rel = 'icon';
    document.getElementsByTagName('head')[0].appendChild(link);
}
link.href = "../assets/Logo.ico"

/**
 * Base path for navigation - can be changed if site structure changes
 * This allows for easy migration between development and production environments
 */
const basePath = "";

/**
 * Navigate to a page with error handling and optional callback
 * @param {string} path - The path to navigate to
 * @param {Function} [callback] - Optional callback before navigation
 * @returns {boolean} - Success status of navigation attempt
 */
function navigateTo(path, callback) {
    try {
        // Execute any pre-navigation logic if provided
        if (callback && typeof callback === 'function') {
            callback();
        }

        // Save current page to session storage for potential "back" functionality
        sessionStorage.setItem('previousPage', window.location.href);

        // Navigate to the specified path
        location.href = `${basePath}${path}`;
        return true;
    } catch (error) {
        console.error(`Navigation error to ${path}:`, error);
        // Provide user feedback about the error
        alert("Navigation failed. Please try again or refresh the page.");
        return false;
    }
}

/**
 * Enhanced navigation functions with consistent implementation
 */
function goSignIn() {
    navigateTo("./signIn.html");
}

function goSignUp() {
    navigateTo("./signUp.html");
}

function goHome() {
    navigateTo("./index.html");
}

function goStart() {
    navigateTo("./start.html");
}

function goSettings() {
    navigateTo("./settings.html");
}

function goStartHome() {
    navigateTo("./startSession.html");
}

/**
 * Go back to previous page if available
 */
function goBack() {
    const previousPage = sessionStorage.getItem('previousPage');
    if (previousPage) {
        location.href = previousPage;
    } else {
        goHome();
    }
}

/**
 * Check if the current page requires authentication and redirect if needed
 * @param {boolean} requiresAuth - Whether the current page requires authentication
 */
function checkAuthRequirement(requiresAuth = false) {
    // This assumes you have a way to check if the user is logged in
    const isLoggedIn = sessionStorage.getItem('userLoggedIn') === 'true' ||
        localStorage.getItem('userLoggedIn') === 'true';

    if (requiresAuth && !isLoggedIn) {
        // Redirect to login if auth is required but user is not logged in
        navigateTo("/signIn.html", () => {
            // Store the intended destination for redirect after login
            sessionStorage.setItem('intendedDestination', window.location.href);
            console.log("Authentication required. Redirecting to login page.");
        });
    } else if (!requiresAuth && isLoggedIn) {
        // Optional: Redirect logged-in users away from login/signup pages
        // Uncomment if you want this behavior

        if (window.location.pathname.includes("signIn.html") ||
            window.location.pathname.includes("signUp.html")) {
            navigateTo("/start.html");
        }

    }
}
