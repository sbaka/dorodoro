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
const THEME_STORAGE_KEY = "dorodoro-theme";

function getSystemTheme() {
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
}

function getActiveTheme() {
    const theme = document.documentElement.dataset.theme;
    return theme === "dark" || theme === "light" ? theme : getSystemTheme();
}

function applyTheme(theme, persist = false) {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;

    if (persist) {
        localStorage.setItem(THEME_STORAGE_KEY, theme);
    }

    document.querySelectorAll("[data-theme-toggle]").forEach((toggle) => {
        const nextTheme = theme === "dark" ? "light" : "dark";
        toggle.setAttribute("aria-label", `Switch to ${nextTheme} mode`);
        toggle.setAttribute("title", `Switch to ${nextTheme} mode`);
        toggle.setAttribute("aria-pressed", String(theme === "dark"));
        toggle.dataset.themeState = theme;
    });
}

function createThemeToggle() {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "theme-toggle";
    button.setAttribute("data-theme-toggle", "");
    button.innerHTML = `
        <span class="theme-toggle-icon theme-toggle-sun" aria-hidden="true">☀</span>
        <span class="theme-toggle-icon theme-toggle-moon" aria-hidden="true">☾</span>
    `;
    button.addEventListener("click", () => {
        applyTheme(getActiveTheme() === "dark" ? "light" : "dark", true);
    });
    return button;
}

function initThemeToggle() {
    const mountPoint = document.querySelector("#header-right");
    if (!mountPoint && document.querySelector("[data-theme-toggle]")) {
        applyTheme(getActiveTheme());
        return;
    }

    if (!document.querySelector("[data-theme-toggle]")) {
        const toggle = createThemeToggle();
        if (mountPoint) {
            mountPoint.insertBefore(toggle, mountPoint.firstChild);
        } else {
            toggle.classList.add("theme-toggle-floating");
            document.body.appendChild(toggle);
        }
    }

    applyTheme(getActiveTheme());

    if (window.matchMedia) {
        const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
        mediaQuery.addEventListener("change", () => {
            if (localStorage.getItem(THEME_STORAGE_KEY)) {
                return;
            }
            applyTheme(getSystemTheme());
        });
    }
}

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
    navigateTo("./login.html");
}

function goSignUp() {
    navigateTo("./sign-up.html");
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
    navigateTo("./home.html");
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

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initThemeToggle, { once: true });
} else {
    initThemeToggle();
}
