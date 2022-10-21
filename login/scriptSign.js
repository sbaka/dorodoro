
let showSignIn = true

function toggleSign() {
    const title = document.querySelector(".illustration > center> h1")
    const signUpDiv = document.querySelector(".signUpContainer")
    const signInDiv = document.querySelector(".signInContainer")
    if (showSignIn) {
        title.innerHTML = "Sign <b>In.</b>"
        signUpDiv.style.opacity = 0
        signUpDiv.style.zIndex = "0"
        signInDiv.style.opacity = 1
        signInDiv.style.zIndex = "99"

    } else {
        title.innerHTML = "Join <b>US.</b>"
        signUpDiv.style.opacity = 1
        signUpDiv.style.zIndex = "99"
        signInDiv.style.opacity = 0
        signInDiv.style.zIndex = "0"
    }
    showSignIn = !showSignIn
    console.log("clicked");
};



