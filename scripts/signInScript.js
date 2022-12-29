import {
    getAuth,
    signInWithEmailAndPassword,
    onAuthStateChanged,
    browserSessionPersistence,
    setPersistence
} from "firebase/auth";
import { app } from "./firebase.js"
import "./navigation.js";
const signUpBtn = document.getElementById("sign_in_submit")
const email = document.getElementById("email")
const password = document.getElementById("pwd")
const errorField = document.getElementById("error")
const errorContainer = document.getElementById("error_msg_container")
const auth = getAuth(app);

const authUser = Object.keys(sessionStorage)
    .filter(item => item.startsWith('firebase:authUser'))[0]

if (authUser) {
    //user is signed in. Redirect to start
    goStart()
} else {
    signUpBtn.onclick = function () {
        onAuthStateChanged
        if (email.value.length > 0 && password.value.length > 0) {
            console.log("clicked");
            setPersistence(auth, browserSessionPersistence)
                .then(() => {
                    signInWithEmailAndPassword(auth, email.value, password.value).then((_) => {
                        goStart()
                    })
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
            //TODO: handle errors
            alert("No Input can be empty")
        }
    }
}

