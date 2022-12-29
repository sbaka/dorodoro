import { getAuth, createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { app } from "./firebase.js"
import "./navigation.js";
const signUpBtn = document.getElementById("sign_up_submit")
const email = document.getElementById("email")
const password = document.getElementById("pwd")
const userName = document.getElementById("userName")
const errorField = document.getElementById("error")
const errorContainer = document.getElementById("error_msg_container")
const auth = getAuth(app);


signUpBtn.onclick = function () {
    if (email.value.length > 0 && password.value.length > 0 && userName.value.length > 0) {
        createUserWithEmailAndPassword(auth, email.value, password.value)
            .then(async (userCredential) => {
                // Signed in 
                const user = userCredential.user;
                await updateProfile(user, {
                    displayName: userName.value,
                })
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
        //TODO: handle errors
        alert("No Input can be empty")
    }

}
