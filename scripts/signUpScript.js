import { getAuth, createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";
import { app } from "./firebase.js"

const signUpBtn = document.getElementById("sign_up_submit")
const email = document.getElementById("email")
const password = document.getElementById("pwd")
const userName = document.getElementById("userName")
const auth = getAuth();
createUserWithEmailAndPassword(auth, email, password)
    .then((userCredential) => {
        // Signed in 
        const user = userCredential.user;
    })
    .catch((error) => {
        const errorCode = error.code;
        const errorMessage = error.message;
    });

signUpBtn.onclick = function () {
    if (email.value.length > 1 && password.value.length > 8 && userName.value.length > 1)
        console.log(email.value, password.value, userName.value);
}
