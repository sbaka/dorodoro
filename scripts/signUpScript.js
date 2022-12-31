import {
    getAuth,
    createUserWithEmailAndPassword,
    updateProfile,
    setPersistence,
    browserSessionPersistence,
    GoogleAuthProvider,
    signInWithPopup
} from "firebase/auth";
import { app } from "./firebase.js"
import "./navigation.js";
const signUpBtn = document.getElementById("sign_up_submit")
const googleSign = document.getElementById("sign_with_google")
const email = document.getElementById("email")
const password = document.getElementById("pwd")
const userName = document.getElementById("userName")
const errorField = document.getElementById("error")
const errorContainer = document.getElementById("error_msg_container")
//Get the credentials


//check if the use is connected // by the session storage
const authUser = Object.keys(sessionStorage)
    .filter(item => item.startsWith('firebase:authUser'))[0]

if (authUser) {
    //user is signed in. Redirect to start
    goStart()
} else {
    //if the user isn't signed in accept clicks

    const auth = getAuth(app);
    const provider = new GoogleAuthProvider()



    signUpBtn.onclick = function () {
        if (email.value.length > 0 && password.value.length > 0 && userName.value.length > 0) {
            createUserWithEmailAndPassword(auth, email.value, password.value)
                .then(async (userCredential) => {
                    // Signed in 
                    const user = userCredential.user;
                    await updateProfile(user, {
                        displayName: userName.value,
                    })
                    //set the user in session
                    await setPersistence(auth, browserSessionPersistence)
                    sessionStorage.setItem(user.uid, user.displayName)
                    goStart()
                })
                .catch((error) => {
                    //TODO: handle errors
                    const errorCode = error.code;
                    const errorMessage = error.message;
                    //change the content of tje div and diplay it
                    errorContainer.innerHTML = errorMessage
                    errorField.style.display = "flex"
                });
        } else {
            errorContainer.innerHTML = "No field should be empty"
            errorField.style.display = "flex"
        }
    }


    googleSign.onclick = function () {
        signInWithPopup(auth, provider)
            .then(async (result) => {
                // This gives you a Google Access Token. You can use it to access the Google API.
                const credential = GoogleAuthProvider.credentialFromResult(result);
                const token = credential.accessToken;
                // The signed-in user info.
                await setPersistence(auth, browserSessionPersistence)
                const user = result.user;
                console.log(user);
                // ...
            }).catch((error) => {
                // Handle Errors here.
                const errorCode = error.code;
                var errorMessage = "iniErr: " + error.message;
                // The email of the user's account used.
                const email = "em: " + error.customData.email;
                // The AuthCredential type that was used.
                const credential = "cred: " + GoogleAuthProvider.credentialFromError(error);
                //TODO: handle errors
                //change the content of tje div and diplay it
                errorMessage += " " + email + " " + credential
                errorContainer.innerHTML = errorMessage
                errorField.style.display = "flex"
                // ...
            });
    }
}