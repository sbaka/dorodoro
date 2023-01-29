
const auth = firebase.auth()

const signInBtn = document.getElementById("sign_in_submit")
const signUpBtn = document.getElementById("sign_up_submit")
const googleSign = document.getElementById("sign_with_google")
const email = document.getElementById("email")
const password = document.getElementById("pwd")
const userName = document.getElementById("userName")
const errorField = document.getElementById("error")
const errorContainer = document.getElementById("error_msg_container")


const provider = new firebase.auth.GoogleAuthProvider()

if (window.location.href.includes("signUp")) {
    // register with email and pwd
    signUpBtn.onclick = function () {
        if (email.value.length > 0 && password.value.length > 0 && userName.value.length > 0) {
            auth.createUserWithEmailAndPassword(email.value, password.value)
                .then((_) => {
                    // Signed in 
                    const user = userCredential.user;
                    firebase.auth().currentUser.updateProfile(user, {
                        displayName: userName.value,
                    })
                    goStartHome()
                })
                .catch((error) => {
                    errorContainer.innerHTML = error.message
                    errorField.style.display = "flex"
                });
        } else {
            //TODO: handle errors
            alert("No Input can be empty")
        }
    }
} else if (window.location.href.includes("signIn")) {
    /*login logic */
    signInBtn.onclick = function () {
        if (email.value.length > 0 && password.value.length > 0) {
            auth.signInWithEmailAndPassword(auth, email.value, password.value).then(async (creds) => {
                goStartHome()
            }).catch((error) => {
                //change the content of tje div and diplay it
                errorContainer.innerHTML = error.message
                errorField.style.display = "flex"
            });
        }
    }
}

googleSign.onclick = function () {
    auth.signInWithPopup(provider)
        .then((_) => {
            goStartHome()
        }).catch((error) => {
            errorContainer.innerHTML = error.message
            errorField.style.display = "flex"
        });
}