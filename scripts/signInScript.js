import {
    getAuth,
    signInWithEmailAndPassword,
    browserSessionPersistence,
    setPersistence,
    GoogleAuthProvider
} from "firebase/auth";
import { app } from "./firebase.js"
import "./navigation.js";
const signInBtn = document.getElementById("sign_in_submit")
const email = document.getElementById("email")
const password = document.getElementById("pwd")
const errorField = document.getElementById("error")
const errorContainer = document.getElementById("error_msg_container")
const auth = getAuth(app);
//check if the use is connected // by the session storage
const authUser = Object.keys(sessionStorage)
    .filter(item => item.startsWith('firebase:authUser'))[0]

if (authUser) {
    //user is signed in. Redirect to start
    goStart()
} else {
    signInBtn.onclick = function () {
        if (email.value.length > 0 && password.value.length > 0) {
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

