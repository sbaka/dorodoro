const notLoggedPages = ["./signIn.html", "./signUp.html", "./index.html"]
const loggedInPages = ["./start.html", "./startSession.html", "./settings.html"]

const isInNotLogPages = notLoggedPages.some(page => window.location.href.includes(page))
const isInLoggedPages = loggedInPages.some(page => window.location.href.includes(page))


firebase.auth().onAuthStateChanged(function (user) {
    if (user) {
        // User is logged in
        if (isInNotLogPages) {
            goStart()
        }
    } else {
        // User is not logged in
        if (isInLoggedPages) {
            goSignUp()
        }
    }
});