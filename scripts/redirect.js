const notLoggedPages = ["pages/signIn.html", "pages/signUp.html", "index.html"]
const loggedInPages = ["start.html", "startSession.html", "settings.html"]

const isInNotLogPages = notLoggedPages.some(page => window.location.href.includes(page))
const isInLoggedPages = loggedInPages.some(page => window.location.href.includes(page))


firebase.auth().onAuthStateChanged(function (user) {
    if (user) {
        if (isInNotLogPages) {
            goStartHome()
        }
    } else {
        if (isInLoggedPages) {
            goHome()
        }
    }
});